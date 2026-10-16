// Simulated "nc" pwn services for the FlagForge PWN challenges.
//
// These do NOT run native code and never execute player input: each service is a small model of a
// vulnerable C program (a buffer overflow, a format-string bug, a return-address overwrite). The model
// decides what a real binary would do with the input and prints that. That keeps the challenge
// authentic to play (`nc host 9101`, python one-liners, pwntools) without a real exploitable process.
//
// Every service is a pure function from one input line to an output string, so the same code backs the
// raw TCP listeners (nc-server.mjs), the HTTP bridge used by the in-browser terminal, and the tests.

export const FLAGS = {
  overflow: 'CTF{smash_the_stack}',
  format: 'CTF{percent_n_is_dangerous}',
  ret2win: 'CTF{ret2win_complete}',
};

const WIN_ADDR = 0x401196n;

/** Turn the text a player types into bytes, understanding python-style \xNN escapes (as in `echo -e`). */
export function parsePayload(line) {
  const bytes = [];
  const s = String(line).replace(/\r?\n$/, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === 'x' && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 2, i + 4))) {
      bytes.push(parseInt(s.slice(i + 2, i + 4), 16));
      i += 3;
    } else {
      const code = s.charCodeAt(i);
      if (code < 256) bytes.push(code); // raw byte (the TCP side decodes as latin1, so 1 char = 1 byte)
      else for (const b of Buffer.from(s[i], 'utf8')) bytes.push(b);
    }
  }
  return bytes;
}

// ---- Overflow 101: char password[16] sits right below int is_admin -------------------------------
const overflow = {
  port: 9101,
  title: 'Overflow 101',
  banner: [
    '== vault-door v1.0 ==',
    '  char password[16];',
    '  int  is_admin = 0;',
    '  gets(password);          // no length check',
    '',
    'Enter password: ',
  ].join('\n'),
  respond(line) {
    const bytes = parsePayload(line);
    if (bytes.length <= 16) return 'Access denied. (is_admin = 0)';
    if (bytes.length > 24) return 'Segmentation fault (core dumped)';
    // bytes 16.. spill into is_admin (4 bytes) and are then non-zero
    return `Access GRANTED. (is_admin = 0x${Buffer.from(bytes.slice(16, 20)).toString('hex') || '0'})\n${FLAGS.overflow}`;
  },
};

// ---- Format Fiasco: printf(user_input) -----------------------------------------------------------
// A pretend stack. Position N (1-based) is what %N$x / %N$p / %N$s would read.
const STACK = [
  { v: 0x7ffd1c2an },
  { v: 0x1n },
  { v: 0x401136n },
  { v: 0x0n },
  { v: 0xdeadbeefn },
  { v: 0x7fff0042n },
  { v: 0x55555555a2a0n, str: 'greeting-buffer' },
  { v: 0x55555555a2c0n, str: FLAGS.format },
];

const format = {
  port: 9102,
  title: 'Format Fiasco',
  banner: [
    '== greeter v2 ==',
    '  char name[64];',
    '  fgets(name, sizeof name, stdin);',
    '  printf(name);            // the format string is yours',
    '',
    'Your name: ',
  ].join('\n'),
  respond(line) {
    const input = String(line).replace(/\r?\n$/, '');
    let next = 0; // sequential argument counter for specifiers without N$
    const out = input.replace(/%(?:(\d+)\$)?([xpsnd%])/g, (_m, pos, conv) => {
      if (conv === '%') return '%';
      if (conv === 'n') throw new Error('segfault');
      const idx = pos ? Number(pos) - 1 : next++;
      const slot = STACK[idx];
      if (!slot) return conv === 's' ? '(null)' : '(nil)';
      if (conv === 's') {
        if (!slot.str) throw new Error('segfault');
        return slot.str;
      }
      if (conv === 'p') return slot.v === 0n ? '(nil)' : `0x${slot.v.toString(16)}`;
      if (conv === 'd') return BigInt.asIntN(32, slot.v).toString();
      return slot.v.toString(16);
    });
    return `Hello, ${out}`;
  },
  crash: 'Segmentation fault (core dumped)',
};

// ---- Return Home: ret2win -------------------------------------------------------------------------
// stack layout: char buf[32] | saved rbp (8) | return address (8). win() is never called by the program.
const ret2win = {
  port: 9103,
  title: 'Return Home',
  banner: [
    '== echo-server v3 ==',
    '  char buf[32];',
    '  gets(buf);               // still no length check',
    `  void win();              // at 0x${WIN_ADDR.toString(16)}, never called`,
    '',
    'Say something: ',
  ].join('\n'),
  respond(line) {
    const bytes = parsePayload(line);
    if (bytes.length <= 32) return `You said: ${Buffer.from(bytes).toString('utf8')}`;
    if (bytes.length < 48) return 'Segmentation fault (core dumped)'; // clobbered rbp, return address mangled
    let addr = 0n;
    for (let i = 0; i < 8; i++) addr |= BigInt(bytes[40 + i] ?? 0) << BigInt(8 * i);
    if (addr === WIN_ADDR) return `win() reached. Welcome home.\n${FLAGS.ret2win}`;
    return `Segmentation fault at 0x${addr.toString(16)} (core dumped)`;
  },
};

export const SERVICES = { overflow, format, ret2win };

/** Run one line through a service. Crashes inside the model surface as a segfault, like the real thing. */
export function run(name, line) {
  const svc = SERVICES[name];
  if (!svc) return null;
  try {
    return svc.respond(line);
  } catch {
    return svc.crash ?? 'Segmentation fault (core dumped)';
  }
}
