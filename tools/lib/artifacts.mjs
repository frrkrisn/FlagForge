// Builders for the binary / encoded artifacts used by the real challenges.
// Everything here is plain Node (no dependencies) and deterministic where it matters.

import { createHash, checkPrimeSync, generatePrimeSync } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Tiny seeded PRNG (so generated files are reproducible)
// ---------------------------------------------------------------------------
export function rng(seed) {
  let s = (createHash('sha256').update(String(seed)).digest().readUInt32LE(0) || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// PCAP: a real libpcap capture with correct IPv4 + TCP checksums
// ---------------------------------------------------------------------------
function csum(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) sum += (buf[i] << 8) + (i + 1 < buf.length ? buf[i + 1] : 0);
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return ~sum & 0xffff;
}

const ip4 = (s) => Buffer.from(s.split('.').map(Number));
const mac = (s) => Buffer.from(s.split(':').map((h) => parseInt(h, 16)));

function tcpFrame({ srcMac, dstMac, srcIp, dstIp, sport, dport, seq, ack, flags, payload = Buffer.alloc(0), ipId }) {
  const tcp = Buffer.alloc(20);
  tcp.writeUInt16BE(sport, 0);
  tcp.writeUInt16BE(dport, 2);
  tcp.writeUInt32BE(seq >>> 0, 4);
  tcp.writeUInt32BE(ack >>> 0, 8);
  tcp[12] = 5 << 4;
  tcp[13] = flags;
  tcp.writeUInt16BE(64240, 14);
  const seg = Buffer.concat([tcp, payload]);

  const pseudo = Buffer.alloc(12);
  ip4(srcIp).copy(pseudo, 0);
  ip4(dstIp).copy(pseudo, 4);
  pseudo[9] = 6;
  pseudo.writeUInt16BE(seg.length, 10);
  seg.writeUInt16BE(csum(Buffer.concat([pseudo, seg])), 16);

  const ip = Buffer.alloc(20);
  ip[0] = 0x45;
  ip.writeUInt16BE(20 + seg.length, 2);
  ip.writeUInt16BE(ipId, 4);
  ip.writeUInt16BE(0x4000, 6);
  ip[8] = 64;
  ip[9] = 6;
  ip4(srcIp).copy(ip, 12);
  ip4(dstIp).copy(ip, 16);
  ip.writeUInt16BE(csum(ip), 10);

  const eth = Buffer.concat([mac(dstMac), mac(srcMac), Buffer.from([0x08, 0x00])]);
  return Buffer.concat([eth, ip, seg]);
}

/** One complete HTTP exchange (handshake, request, response, close) as ordered frames. */
function httpExchange(c, request, response, startSeq) {
  const A = { srcMac: c.cMac, dstMac: c.sMac, srcIp: c.cIp, dstIp: c.sIp, sport: c.sport, dport: 80 };
  const B = { srcMac: c.sMac, dstMac: c.cMac, srcIp: c.sIp, dstIp: c.cIp, sport: 80, dport: c.sport };
  const req = Buffer.from(request);
  const res = Buffer.from(response);
  let cs = startSeq, ss = startSeq + 700000, id = c.ipId;
  const f = [];
  f.push(tcpFrame({ ...A, seq: cs, ack: 0, flags: 0x02, ipId: id++ }));                       // SYN
  f.push(tcpFrame({ ...B, seq: ss, ack: cs + 1, flags: 0x12, ipId: id++ }));                 // SYN,ACK
  cs++; ss++;
  f.push(tcpFrame({ ...A, seq: cs, ack: ss, flags: 0x10, ipId: id++ }));                      // ACK
  f.push(tcpFrame({ ...A, seq: cs, ack: ss, flags: 0x18, payload: req, ipId: id++ }));        // request
  cs += req.length;
  f.push(tcpFrame({ ...B, seq: ss, ack: cs, flags: 0x10, ipId: id++ }));                      // ACK
  f.push(tcpFrame({ ...B, seq: ss, ack: cs, flags: 0x18, payload: res, ipId: id++ }));        // response
  ss += res.length;
  f.push(tcpFrame({ ...A, seq: cs, ack: ss, flags: 0x11, ipId: id++ }));                      // FIN,ACK
  f.push(tcpFrame({ ...B, seq: ss, ack: cs + 1, flags: 0x11, ipId: id++ }));                  // FIN,ACK
  f.push(tcpFrame({ ...A, seq: cs + 1, ack: ss + 1, flags: 0x10, ipId: id++ }));              // ACK
  return f;
}

export function buildPcap(flag) {
  const client = { cMac: '3c:22:fb:0a:19:e4', sMac: '00:1b:21:aa:44:09', cIp: '192.168.1.23', sIp: '10.0.0.8' };
  const html = '<html><body><h1>Intranet</h1><form method="POST" action="/login"><input name="user"><input name="pass"><button>Sign in</button></form></body></html>';
  const exchanges = [
    httpExchange({ ...client, sport: 51210, ipId: 1000 },
      'GET / HTTP/1.1\r\nHost: intranet.corp.local\r\nUser-Agent: Mozilla/5.0\r\nAccept: text/html\r\n\r\n',
      `HTTP/1.1 200 OK\r\nServer: nginx/1.18\r\nContent-Type: text/html\r\nContent-Length: ${html.length}\r\n\r\n${html}`, 0x1a2b0000),
    httpExchange({ ...client, sport: 51211, ipId: 1100 },
      'GET /favicon.ico HTTP/1.1\r\nHost: intranet.corp.local\r\n\r\n',
      'HTTP/1.1 404 Not Found\r\nServer: nginx/1.18\r\nContent-Length: 0\r\n\r\n', 0x2c3d0000),
    (() => {
      const body = `user=admin&pass=${encodeURIComponent(flag)}&remember=on`;
      return httpExchange({ ...client, sport: 51212, ipId: 1200 },
        `POST /login HTTP/1.1\r\nHost: intranet.corp.local\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${body.length}\r\n\r\n${body}`,
        'HTTP/1.1 302 Found\r\nServer: nginx/1.18\r\nLocation: /dashboard\r\nSet-Cookie: session=deadbeef; HttpOnly\r\nContent-Length: 0\r\n\r\n', 0x3d4e0000);
    })(),
    httpExchange({ ...client, sport: 51213, ipId: 1300 },
      'GET /dashboard HTTP/1.1\r\nHost: intranet.corp.local\r\nCookie: session=deadbeef\r\n\r\n',
      'HTTP/1.1 200 OK\r\nServer: nginx/1.18\r\nContent-Length: 17\r\n\r\n<h1>Welcome</h1>\n', 0x4e5f0000),
  ].flat();

  const global = Buffer.alloc(24);
  global.writeUInt32LE(0xa1b2c3d4, 0);
  global.writeUInt16LE(2, 4);
  global.writeUInt16LE(4, 6);
  global.writeUInt32LE(65535, 16);
  global.writeUInt32LE(1, 20); // LINKTYPE_ETHERNET

  let t = 1760000000; // fixed epoch so the file is reproducible
  const records = exchanges.map((frame, i) => {
    const h = Buffer.alloc(16);
    t += i % 9 === 0 ? 3 : 0;
    h.writeUInt32LE(t, 0);
    h.writeUInt32LE((i * 13711) % 1000000, 4);
    h.writeUInt32LE(frame.length, 8);
    h.writeUInt32LE(frame.length, 12);
    return Buffer.concat([h, frame]);
  });
  return Buffer.concat([global, ...records]);
}

// ---------------------------------------------------------------------------
// PNG with metadata chunks
// ---------------------------------------------------------------------------
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

export function buildPng(textChunks) {
  const w = 320, h = 200;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      // a dusk-sky gradient with a sun disc and a simple skyline
      const dx = x - 230, dy = y - 70;
      const sun = dx * dx + dy * dy < 34 * 34;
      const skyline = y > 150 - ((x * 7 + (x >> 3) * 13) % 38);
      let r = 30 + (y * 90) / h, g = 20 + (y * 40) / h, b = 70 + (y * 110) / h;
      if (sun) { r = 255; g = 190; b = 90; }
      if (skyline) { r = 12; g = 14; b = 24; }
      row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const texts = Object.entries(textChunks).map(([k, v]) => pngChunk('tEXt', Buffer.from(`${k}\0${v}`, 'latin1')));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...texts,
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Morse WAV
// ---------------------------------------------------------------------------
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

export function buildMorseWav(message, { wpmUnitMs = 70, freq = 640, rate = 8000 } = {}) {
  const samples = [];
  const tone = (ms) => {
    const n = Math.round((rate * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / 40, (n - i) / 40); // short fade to avoid clicks
      samples.push(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 14000 * env));
    }
  };
  const silence = (ms) => samples.push(...new Array(Math.round((rate * ms) / 1000)).fill(0));
  silence(400);
  for (const word of message.toUpperCase().split(' ')) {
    for (const ch of word) {
      for (const sym of MORSE[ch]) {
        tone(sym === '.' ? wpmUnitMs : wpmUnitMs * 3);
        silence(wpmUnitMs);
      }
      silence(wpmUnitMs * 2); // between letters (3 units total)
    }
    silence(wpmUnitMs * 4); // between words (7 units total)
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------------------
// RSA with primes that are far too close together (Fermat factoring)
// ---------------------------------------------------------------------------
const modPow = (b, e, m) => {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
};

// Integer square root by Newton's method, starting from a power of two above sqrt(n).
const isqrt = (n) => {
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
};

export function buildRsa(flag) {
  const e = 65537n;
  for (;;) {
    const p = generatePrimeSync(136, { bigint: true });
    let q = p + (1n << 30n);
    while (!checkPrimeSync(q)) q += 2n;
    const n = p * q;
    const m = BigInt('0x' + Buffer.from(flag).toString('hex'));
    if (m >= n) continue;
    const phi = (p - 1n) * (q - 1n);
    if (phi % e === 0n) continue;
    const c = modPow(m, e, n);

    // prove the intended attack works (Fermat), so the challenge is known to be solvable
    let a = isqrt(n);
    if (a * a < n) a++;
    for (let i = 0; i < 2_000_000; i++, a++) {
      const b2 = a * a - n;
      const b = isqrt(b2);
      if (b * b === b2) {
        const fp = a - b, fq = a + b;
        const d = (() => { // modular inverse by extended Euclid
          let [r0, r1, s0, s1] = [e, (fp - 1n) * (fq - 1n), 1n, 0n];
          while (r1) { const k = r0 / r1; [r0, r1] = [r1, r0 - k * r1]; [s0, s1] = [s1, s0 - k * s1]; }
          const t = (fp - 1n) * (fq - 1n);
          return ((s0 % t) + t) % t;
        })();
        let hex = modPow(c, d, n).toString(16);
        if (hex.length % 2) hex = '0' + hex;
        const back = Buffer.from(hex, 'hex').toString();
        if (back !== flag) throw new Error('RSA self-check failed');
        return { n, e, c, p, q };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Vigenère (letters only; case and punctuation preserved)
// ---------------------------------------------------------------------------
export function vigenere(text, key, decrypt = false) {
  let k = 0;
  return [...text]
    .map((ch) => {
      const lower = ch >= 'a' && ch <= 'z';
      const upper = ch >= 'A' && ch <= 'Z';
      if (!lower && !upper) return ch;
      const base = lower ? 97 : 65;
      const shift = key.toLowerCase().charCodeAt(k++ % key.length) - 97;
      const v = (ch.charCodeAt(0) - base + (decrypt ? 26 - shift : shift)) % 26;
      return String.fromCharCode(base + v);
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Memory dump with a UTF-16 secret and ASCII decoys
// ---------------------------------------------------------------------------
export function buildMemoryDump(flag) {
  const rand = rng('memory-lane');
  const size = 3 * 1024 * 1024;
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = rand() < 0.62 ? 0 : Math.floor(rand() * 256); // sparse, RAM-like
  const put = (off, str, utf16 = false) => (utf16 ? Buffer.from(str, 'utf16le') : Buffer.from(str, 'latin1')).copy(buf, off);

  const procs = ['System', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe', 'svchost.exe',
    'explorer.exe', 'chrome.exe', 'notepad.exe', 'powershell.exe', 'updater_svc.exe', 'OneDrive.exe'];
  let off = 0x4000;
  procs.forEach((name, i) => {
    put(off, `PID:${String(4 + i * 388).padStart(5, '0')} PPID:${String(4 + (i > 6 ? 3 : 0) * 388).padStart(5, '0')} ${name}`);
    off += 96;
  });
  put(0x9000, 'notes: CTF{this_is_not_the_flag_keep_looking}');                 // ASCII decoy
  put(0x1a2000, 'password reminder: hunter2 (change me)');                      // ASCII decoy
  put(0x2c4000, `notes: ${flag}`, true);                                         // the real one: UTF-16LE
  put(0x2e0000, 'C:\\Users\\analyst\\Desktop\\incident-report.docx');
  return buf;
}

// ---------------------------------------------------------------------------
// Small encoders
// ---------------------------------------------------------------------------
export const b32 = (buf) => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', out = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  while (bits.length % 5) bits += '0';
  for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5), 2)];
  while (out.length % 8) out += '=';
  return out;
};
