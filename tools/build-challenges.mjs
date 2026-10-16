#!/usr/bin/env node
// Builds the real challenge packs under challenges/ (files + metadata + descriptions + writeups).
//
//   node tools/build-challenges.mjs
//
// Needs `gcc` on PATH for the two reverse-engineering executables (Windows PE, built with MinGW).
// Every artifact is checked for solvability while it is built (e.g. the crackme is run with the
// derived key and must print the flag; RSA is factored with Fermat's method and decrypted).
// Generated files are committed; this script is the record of how they were made.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { b32, buildMemoryDump, buildMorseWav, buildPcap, buildPng, buildRsa, vigenere } from './lib/artifacts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'challenges');
const SRC = join(ROOT, 'tools', 'src');
const HOST = process.env.WEBCHAL_URL || 'http://localhost:9001';

mkdirSync(SRC, { recursive: true });

/** Write one pack folder. `files` are { name, data, transform? }. */
function pack(dir, meta, description, writeup, files = []) {
  const base = join(OUT, dir);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(join(base, 'files'), { recursive: true });
  for (const f of files) writeFileSync(join(base, 'files', f.name), f.data);
  const json = { ...meta, files: files.map((f) => (f.transform ? { name: f.name, transform: f.transform } : f.name)) };
  if (files.length === 0) delete json.files;
  writeFileSync(join(base, 'challenge.json'), JSON.stringify(json, null, 2) + '\n');
  writeFileSync(join(base, 'description.md'), description.trim() + '\n');
  writeFileSync(join(base, 'writeup.md'), writeup.trim() + '\n');
  console.log(`  [+] ${dir.padEnd(18)} ${meta.category.padEnd(9)} ${meta.title} (${files.length} file${files.length === 1 ? '' : 's'})`);
}

function compile(name, source) {
  const c = join(SRC, `${name}.c`);
  const exe = join(SRC, `${name}.exe`);
  writeFileSync(c, source);
  const r = spawnSync('gcc', ['-O0', '-s', '-static', '-o', exe, c], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`gcc failed for ${name}: ${r.stderr || r.error}`);
  return exe;
}

console.log('Building challenge packs ...');

// ---------------------------------------------------------------------------
// FORENSICS
// ---------------------------------------------------------------------------
{
  const flag = 'CTF{follow_the_tcp_stream}';
  pack('packet-peek', {
    key: 'packet', title: 'Packet Peek', category: 'FORENSICS', difficulty: 'EASY', points: 150, scoring: 'DECAY',
    flag, hints: [{ text: 'HTTP login forms send what you type in the body of a POST request.', cost: 15 }],
  }, `
## Packet Peek

A colleague captured some traffic while logging in to the company intranet, then left the file on a shared drive.
The intranet does not use HTTPS.

Open \`capture.pcap\` and find the password that crossed the wire.

**Tools that help:** Wireshark (try *Follow → TCP Stream*), \`tshark\`, or even \`strings\`.

*The flag is the password, exactly as sent.*
`, `
**Approach.** Open the capture in Wireshark. Four HTTP conversations are visible; the interesting one is the \`POST /login\`.
Right-click → *Follow → TCP Stream* shows the request body: \`user=admin&pass=CTF%7Bfollow_the_tcp_stream%7D&remember=on\`.
The password is URL-encoded (\`%7B\` = \`{\`, \`%7D\` = \`}\`). Decode it to get the flag.

**Lesson.** Anything sent over plain HTTP is readable by anyone on the path. Use HTTPS.
`, [{ name: 'capture.pcap', data: buildPcap(flag) }]);
}

{
  const flag = 'CTF{exif_never_lies}';
  pack('hidden-pixels', {
    key: 'pixels', title: 'Hidden Pixels', category: 'FORENSICS', difficulty: 'MEDIUM', points: 250, scoring: 'DECAY_FIRSTBLOOD',
    flag, hints: [{ text: 'Image files carry more than pixels. Look at the text metadata chunks.', cost: 25 }],
  }, `
## Hidden Pixels

A photographer posted this sunset and swears nothing is hidden in it. The camera software says otherwise.

Look past the pixels. **\`sunset.png\`** is a perfectly valid image, but it carries data an image viewer never shows.

**Tools that help:** \`exiftool\`, \`pngcheck -t\`, \`strings\`, or a hex editor.

*Careful: not everything you find is encoded the same way.*
`, `
**Approach.** PNG files are a sequence of chunks. \`pngcheck -t sunset.png\` (or \`exiftool\`) lists the \`tEXt\` chunks:
\`Software\`, \`Author\`, \`Description\` and a \`Comment\` containing a base64 string.
Decoding the comment (\`echo ... | base64 -d\`) gives the flag. The other chunks are decoys.

**Lesson.** Metadata survives in files long after people forget it is there. Strip it before publishing.
`, [{ name: 'sunset.png', data: buildPng({
    Software: 'FlagForge Camera 1.0',
    Author: 'A. Analyst',
    Description: 'Sunset over the harbour',
    Comment: Buffer.from(flag).toString('base64'),
  }) }]);
}

{
  const flag = 'CTF{utf16_hides_in_plain_sight}';
  pack('memory-lane', {
    key: 'memory', title: 'Memory Lane', category: 'FORENSICS', difficulty: 'HARD', points: 400, scoring: 'DECAY_FIRSTBLOOD',
    requires: ['packet'], flag,
    hints: [{ text: 'Windows programs usually store text as UTF-16, two bytes per character. Plain strings will miss it.', cost: 45 }],
  }, `
## Memory Lane

Incident response captured a RAM image from a compromised workstation. An analyst left themselves a note in a text
editor before the machine was isolated, and the note is still in memory.

\`memory.dmp\` is a (small) raw memory dump. Find the note.

Be wary: there are other "notes" in memory that are not the one you want.

**Tools that help:** \`strings\` (check its encoding options), \`grep\`, a hex editor, or Volatility if you want to go further.
`, `
**Approach.** \`strings memory.dmp | grep CTF\` finds only a decoy: \`CTF{this_is_not_the_flag_keep_looking}\`.
Windows keeps most text as little-endian UTF-16, so run \`strings -e l memory.dmp | grep CTF\` (the \`-e l\` selects 16-bit little-endian).
That reveals \`notes: CTF{utf16_hides_in_plain_sight}\`.

**Lesson.** Always search memory in more than one encoding.
`, [{ name: 'memory.dmp', data: buildMemoryDump(flag) }]);
}

// ---------------------------------------------------------------------------
// CRYPTO
// ---------------------------------------------------------------------------
{
  pack('xor-whisper', {
    key: 'xor', title: 'XOR Whisper', category: 'CRYPTO', difficulty: 'EASY', points: 120, scoring: 'DYNAMIC',
    flagType: 'DYNAMIC', hints: [{ text: 'The key is a single byte, so there are only 255 possibilities.', cost: 10 }],
  }, `
## XOR Whisper

An operator encrypted a message by XOR-ing every byte with **one secret byte**, then hex-encoded the result.
You intercepted it: \`intercepted.hex\`.

Recover the message. It contains your team's access code.

> **Every team gets a different file** (and a different key), so a teammate's answer is the only one that works for you.
> The SHA-256 shown next to the file is the hash of *your team's* copy.

*Hint: you know how the plaintext begins.*
`, `
**Approach.** Hex-decode the file, then try every key from 1 to 255, XOR-ing each byte. For the right key the output is readable
English containing the access code (\`CTF{...}\`). A known-plaintext shortcut: the message contains \`CTF{\`, so XOR the first
four ciphertext bytes with \`C\`,\`T\`,\`F\`,\`{\` to find the key directly.

\`\`\`python
data = bytes.fromhex(open("intercepted.hex").read())
for k in range(1, 256):
    out = bytes(b ^ k for b in data)
    if b"CTF{" in out:
        print(k, out.decode())
\`\`\`

**Lesson.** A single-byte XOR has a 255-key space and falls to brute force or known plaintext.
`, [{
    name: 'intercepted.hex', transform: 'flag|xor|hex',
    data: 'From: ops@harbor.example\nSubject: maintenance door\n\nThe access code for the maintenance door is {{FLAG}}.\nDestroy this message after reading.\n',
  }]);
}

{
  const flag = 'CTF{keys_repeat_so_do_patterns}';
  const plain = `The harbour authority has changed its night protocol. All containers arriving after midnight must be logged by hand, and the
duty officer must confirm each entry with the control room. Messages between the two offices are protected with a repeating
key, which the staff believe is unbreakable because it is long. It is not long, and repetition leaves fingerprints in every
language. Whoever reads this should remember the following: ${flag.replace('CTF{', 'the flag is CTF{')}. Keep it safe.`;
  pack('vigenere-vault', {
    key: 'vigenere', title: 'Vigenère Vault', category: 'CRYPTO', difficulty: 'MEDIUM', points: 220, scoring: 'DECAY',
    requires: ['caesar'], flag,
    hints: [{ text: 'The key is a short English word, repeated across the whole message.', cost: 25 }],
  }, `
## Vigenère Vault

Caesar used one shift for the whole message. This vault uses **a word** of shifts, repeating, which is stronger and still breakable.

\`vault.txt\` holds an English message encrypted with a Vigenère cipher. Letters are shifted by the key; spaces, digits and punctuation are untouched.

**Tools that help:** Kasiski examination, index of coincidence, or an online Vigenère solver.
`, `
**Approach.** Find repeated sequences in the ciphertext and measure the distances between them; the key length divides those
distances (here, 5). Split the text into 5 columns, each of which is a Caesar cipher solvable by letter frequency.
The key is \`FORGE\`. Decrypting gives the paragraph, which includes the flag.

**Lesson.** A repeating key is only as strong as it is long. Any pattern in the key shows up in the ciphertext.
`, [{ name: 'vault.txt', data: vigenere(plain, 'FORGE') + '\n' }]);
  // self-check: decrypting returns the plaintext
  if (vigenere(vigenere(plain, 'FORGE'), 'FORGE', true) !== plain) throw new Error('vigenere roundtrip failed');
}

{
  const flag = 'CTF{layers_upon_layers}';
  const l1 = Buffer.from(flag).toString('base64');
  const l2 = Buffer.from(l1).toString('hex');
  const l3 = b32(Buffer.from(l2));
  const l4 = Buffer.from(l3).toString('base64');
  pack('base-camp', {
    key: 'basecamp', title: 'Base Camp', category: 'CRYPTO', difficulty: 'MEDIUM', points: 200, scoring: 'DECAY',
    requires: ['caesar'], flag,
  }, `
## Base Camp

An archivist "protected" a secret by encoding it again and again, assuming nobody would have the patience to peel it back.

\`layers.txt\` contains the result. There are **four layers**, each a different common encoding. Work out which, and in what order, to
recover the original.

**Tools that help:** CyberChef (its *Magic* operation is made for this), or \`base64\`, \`xxd\`, \`base32\` on the command line.
`, `
**Approach.** Decode in the order: base64 → base32 → hex → base64. Each step's output visibly looks like the next encoding
(base64 charset ends in \`=\`, base32 is upper-case A-Z2-7, hex is 0-9a-f). CyberChef's *Magic* recipe does it automatically.

**Lesson.** Encoding is not encryption. Stacking encodings adds nothing without a secret.
`, [{ name: 'layers.txt', data: l4 + '\n' }]);
}

{
  const flag = 'CTF{close_primes_fall_to_fermat}';
  const { n, e, c, p, q } = buildRsa(flag);
  if (p * q !== n) throw new Error('rsa sanity');
  pack('rsa-rookie', {
    key: 'rsa', title: 'RSA Rookie', category: 'CRYPTO', difficulty: 'MEDIUM', points: 320, scoring: 'DECAY_FIRSTBLOOD',
    requires: ['xor'], flag,
    hints: [{ text: 'RSA is only as strong as the difficulty of factoring n. Look closely at how p and q were chosen.', cost: 40 }],
  }, `
## RSA Rookie

A junior engineer generated an RSA key pair by hand and encrypted the flag with the public key.

\`challenge.txt\` contains the public modulus \`n\`, the public exponent \`e\` and the ciphertext \`c\` (all in decimal).
The flag, read as a big-endian integer, is the plaintext.

They picked the two primes in a hurry.

**Tools that help:** Python (big integers are built in), \`gmpy2\`, or a factoring site for sanity checks.
`, `
**Approach.** The two primes differ by only about 2^30, while each is 136 bits. Numbers like that fall to **Fermat's factorisation**:
start at a = ceil(sqrt(n)) and increase until a² − n is a perfect square b²; then p = a − b and q = a + b.
With p and q known: φ = (p−1)(q−1), d = e⁻¹ mod φ, m = c^d mod n, and the flag is \`m\` converted to bytes.

\`\`\`python
from math import isqrt
a = isqrt(n) + 1
while isqrt(a*a - n)**2 != a*a - n: a += 1
b = isqrt(a*a - n); p, q = a - b, a + b
d = pow(e, -1, (p-1)*(q-1))
print(pow(c, d, n).to_bytes(40, "big").lstrip(b"\\0"))
\`\`\`

**Lesson.** Primes must be independent and random; close primes make factoring trivial.
`, [{ name: 'challenge.txt', data: `n = ${n}\ne = ${e}\nc = ${c}\n` }]);
}

// ---------------------------------------------------------------------------
// REVERSE (Windows executables compiled from C)
// ---------------------------------------------------------------------------
{
  const flag = 'CTF{printf_gives_it_away}';
  const exe = compile('hello', String.raw`#include <stdio.h>

static const char *secret = "${flag}";

int main(int argc, char **argv) {
    (void)argv;
    puts("== FlagForge diagnostic tool v1.2 ==");
    puts("Status: all systems nominal.");
    if (argc > 4242) puts(secret); /* never taken */
    return 0;
}
`);
  const run = spawnSync(exe, [], { encoding: 'utf8' });
  if (!run.stdout.includes('nominal') || run.stdout.includes('CTF{')) throw new Error('hello.exe misbehaves');
  pack('hello-binary', {
    key: 'hello', title: 'Hello Binary', category: 'REVERSE', difficulty: 'EASY', points: 120, scoring: 'DECAY', flag,
  }, `
## Hello Binary

\`hello.exe\` is a tiny diagnostic tool (a 64-bit Windows program). When you run it, it prints a friendly status message and exits.

The developer says it keeps a secret inside. You never have to run anything to find it.

**Tools that help:** \`strings\`, a hex editor, or just \`findstr\` on Windows.
`, `
**Approach.** The secret is a string literal stored in the program's read-only data, so it is plain text inside the file:
\`strings hello.exe | grep CTF\`. No reverse engineering is needed; this challenge teaches that literals are visible.

**Lesson.** Never store secrets as plain string constants in a binary.
`, [{ name: 'hello.exe', data: readFileSync(exe) }]);
}

{
  const flag = 'CTF{xor_then_compare_reveals_all}';
  const key = 'HARBOR-7731-WATCH';
  const enc = [...key].map((ch, i) => (ch.charCodeAt(0) ^ ((0x5a + i * 3) & 0xff)) & 0xff);
  const blob = [...flag].map((ch, j) => (ch.charCodeAt(0) ^ 0x37 ^ ((j * 5) & 0xff)) & 0xff);
  const arr = (a) => a.map((v) => '0x' + v.toString(16).padStart(2, '0')).join(', ');
  const exe = compile('crackme', String.raw`#include <stdio.h>
#include <string.h>

static const unsigned char enc[] = { ${arr(enc)} };
static const unsigned char blob[] = { ${arr(blob)} };

int main(void) {
    char in[96];
    printf("Enter license key: ");
    if (!fgets(in, sizeof in, stdin)) return 1;
    in[strcspn(in, "\r\n")] = 0;

    size_t n = sizeof enc;
    if (strlen(in) != n) { puts("Invalid license."); return 1; }
    for (size_t i = 0; i < n; i++) {
        if ((unsigned char)(in[i] ^ (0x5A + i * 3)) != enc[i]) { puts("Invalid license."); return 1; }
    }
    printf("License valid. Your reward: ");
    for (size_t j = 0; j < sizeof blob; j++) putchar(blob[j] ^ 0x37 ^ (unsigned char)(j * 5));
    putchar('\n');
    return 0;
}
`);
  const good = spawnSync(exe, [], { input: key + '\n', encoding: 'utf8' });
  if (!good.stdout.includes(flag)) throw new Error('crackme does not print the flag for the right key');
  const bad = spawnSync(exe, [], { input: 'WRONG-KEY\n', encoding: 'utf8' });
  if (bad.stdout.includes('CTF{')) throw new Error('crackme leaks the flag for a wrong key');
  const strings = readFileSync(exe).toString('latin1');
  if (strings.includes('CTF{') || strings.includes(key)) throw new Error('crackme exposes the flag or key as plain text');
  pack('crackme-lite', {
    key: 'crackme', title: 'Crackme Lite', category: 'REVERSE', difficulty: 'HARD', points: 400, scoring: 'DECAY_FIRSTBLOOD',
    requires: ['basecamp'], flag,
    hints: [{ text: 'The program never stores the key in plain text. Find the loop that checks each character and undo it.', cost: 50 }],
  }, `
## Crackme Lite

\`crackme.exe\` (64-bit Windows) asks for a license key and prints a reward if the key is valid.

The key is not stored anywhere as readable text, and neither is the reward. You have to understand the check.

**Tools that help:** Ghidra, IDA Free, x64dbg, or Cutter. Static analysis is enough; you do not need to guess the key.

*Run it only in a VM or sandbox, as with any unknown binary.*
`, `
**Approach.** In a decompiler the \`main\` function is short: it reads a line, requires its length to equal the size of a table, and
for each character *i* checks \`(in[i] ^ (0x5A + i*3)) == enc[i]\`. Invert that: \`key[i] = enc[i] ^ (0x5A + i*3)\`, which gives
\`HARBOR-7731-WATCH\`. Entering it prints the reward, which is XOR-decoded from another table
(\`blob[j] ^ 0x37 ^ (j*5)\`). You can also skip running it and decode the table yourself.

**Lesson.** XOR "obfuscation" with a fixed schedule hides nothing from someone who reads the check.
`, [{ name: 'crackme.exe', data: readFileSync(exe) }]);
}

// ---------------------------------------------------------------------------
// MISC
// ---------------------------------------------------------------------------
{
  const flag = 'CTF{emoji_are_just_unicode}';
  const cipher = [...flag].map((ch) => String.fromCodePoint(0x1f300 + ch.charCodeAt(0) - 32)).join('');
  pack('emoji-cipher', {
    key: 'emoji', title: 'Emoji Cipher', category: 'MISC', difficulty: 'EASY', points: 80, scoring: 'DECAY', flag,
  }, `
## Emoji Cipher

A friend sent \`message.txt\` and swears it is a message. It looks like a row of pictures to everyone else.

Every symbol is just a **code point** wearing a costume. Strip the costume.

**Tools that help:** Python (\`ord()\` and \`chr()\`), or any Unicode code point viewer.
`, `
**Approach.** Look at the code points: the first symbol is U+1F323, the next U+1F334, and so on. Each is \`0x1F300 + (ascii - 32)\`.
Reverse it: \`chr(ord(sym) - 0x1F300 + 32)\`.

\`\`\`python
print("".join(chr(ord(c) - 0x1F300 + 32) for c in open("message.txt", encoding="utf8").read().strip().split("\\n")[-1]))
\`\`\`

**Lesson.** Text is just numbers; "obfuscation" by remapping a range is trivial to undo once you look at the numbers.
`, [{ name: 'message.txt', data: `Message from the cipher cafe:\n${cipher}\n` }]);
}

{
  const flag = 'CTF{dit_dah_signal_saved}';
  pack('radio-silence', {
    key: 'radio', title: 'Radio Silence', category: 'MISC', difficulty: 'MEDIUM', points: 180, scoring: 'DECAY_FIRSTBLOOD', flag,
    hints: [{ text: 'Short beeps are dots, long beeps are dashes. A longer gap separates letters, an even longer one separates words.', cost: 20 }],
  }, `
## Radio Silence

A weak signal came in on a frequency that is supposed to be empty. Somebody is keying a message in an old, old code.

\`signal.wav\` is the recording. Decode the message.

*Submit it as the flag: lower-case, words joined with underscores, inside \`CTF{ }\`.* The message has four words.

**Tools that help:** Audacity (zoom in on the waveform or open the spectrogram), or an online Morse decoder.
`, `
**Approach.** Open the file in Audacity and zoom into the waveform: you will see short and long tone bursts. Short = dot, long = dash.
Letter gaps are three units, word gaps seven. Decoded: \`DIT DAH SIGNAL SAVED\`.
Lower-case it, join with underscores, wrap in \`CTF{ }\`.

**Lesson.** Morse is just timing; once you can see the waveform, decoding is mechanical.
`, [{ name: 'signal.wav', data: buildMorseWav('DIT DAH SIGNAL SAVED') }]);
}

// ---------------------------------------------------------------------------
// WEB: dynamic (per-team files) ones
// ---------------------------------------------------------------------------
pack('team-token', {
  key: 'token', title: 'Team Token', category: 'WEB', difficulty: 'MEDIUM', points: 300, scoring: 'DYNAMIC',
  requires: ['robots'], flagType: 'DYNAMIC',
}, `
## Team Token

The admin panel issues each team its own **session token**. Yours was exported to \`session.dat\`, but exports are never sent in the clear.

Recover your team's token. It is your flag.

> The file is **unique to your team**. Submitting another team's token is detected and reported to the organisers.

**Tools that help:** \`base64 -d\`, CyberChef.
`, `
**Approach.** The file is \`team-session=<base64>\`. Base64-decode the value and you have the token. Because the token is derived
from a server secret and your team id, no other team's token will be accepted, and submitting one raises a flag-sharing alert.

**Lesson.** Per-team secrets stop answer sharing: leaking a flag only ever leaks that team's.
`, [{ name: 'session.dat', transform: 'flag|base64', data: 'team-session={{FLAG}}\n' }]);

pack('session-secrets', {
  key: 'session', title: 'Session Secrets', category: 'WEB', difficulty: 'HARD', points: 350, scoring: 'DYNAMIC_FIRSTBLOOD',
  requires: ['sql'], flagType: 'DYNAMIC',
  hints: [{ text: 'Two layers: undo the base64 first, then the single-byte XOR.', cost: 35 }],
}, `
## Session Secrets

Your team's browser cookie jar was dumped to \`cookiejar.txt\` after an incident. The dump was obfuscated in two layers before it left the machine.

Recover the session cookie for the admin console. That cookie is your team's flag.

> Every team's dump is different. Another team's cookie will not work for you, and submitting it raises an alert.
`, `
**Approach.** Layer 1 is base64. Layer 2 is a single-byte XOR over the decoded bytes, with a key unique to your team.
Decode the base64, then try the 255 keys until readable text appears (the file starts with the known line
\`# Netscape HTTP Cookie File\`, so XOR-ing its first byte \`#\` against the first ciphertext byte reveals the key at once).
The recovered cookie jar contains your team's session cookie, which is the flag.

**Lesson.** Layering weak transforms does not make a strong one; per-team data stops answers being shared.
`, [{
  name: 'cookiejar.txt', transform: 'flag|xor|base64',
  data: '# Netscape HTTP Cookie File\nadmin.harbor.example\tTRUE\t/\tTRUE\t0\tsession\t{{FLAG}}\n',
}]);

// ---------------------------------------------------------------------------
// WEB: hosted challenges (served by the separate challenge-host process)
// ---------------------------------------------------------------------------
pack('inspect-me', {
  key: 'inspect', title: 'Inspect Me', category: 'WEB', difficulty: 'EASY', points: 100, scoring: 'DECAY', flag: 'CTF{view_source_luke}',
}, `
## Inspect Me

The Harbor Authority launched a new landing page. A developer swears nothing sensitive is on it.

**Target:** ${HOST}/inspect

Browsers show you what the server sends, including the parts the page never displays. Take a closer look at the page.

*(Start the challenge host first: \`node challenge-host/server.mjs\`.)*
`, `
**Approach.** View the page source (Ctrl+U) or use developer tools. A leftover HTML comment near the footer contains the flag.

**Lesson.** Anything delivered to the browser is visible to the user, including comments and hidden fields.
`);

pack('cookie-monster', {
  key: 'cookie', title: 'Cookie Monster', category: 'WEB', difficulty: 'EASY', points: 100, scoring: 'DECAY', flag: 'CTF{c00kies_are_not_secure}',
  hints: [{ text: 'Cookies are controlled by the client. Look at how the value is encoded.', cost: 15 }],
}, `
## Cookie Monster

The staff portal decides what you may see from a cookie it hands you. You arrive as a guest.

**Target:** ${HOST}/cookie

Become someone more interesting.
`, `
**Approach.** The portal sets \`role=Z3Vlc3Q=\`, which is base64 for \`guest\`. Cookies live on the client, so change it to the
base64 of \`admin\` (\`YWRtaW4=\`) in your browser's developer tools and reload.

**Lesson.** Never trust client-side data for authorisation, and base64 is not protection.
`);

pack('robots-rule', {
  key: 'robots', title: 'Robots Rule', category: 'WEB', difficulty: 'MEDIUM', points: 200, scoring: 'DECAY_FIRSTBLOOD',
  requires: ['inspect'], flag: 'CTF{disallow_all_the_things}',
  hints: [{ text: 'Web crawlers read one special file at the site root.', cost: 20 }, { text: 'Try /robots.txt and read the Disallow lines.', cost: 40 }],
}, `
## Robots Rule

What do search engines promise not to look at? That is exactly where you should look.

**Target:** ${HOST}/robots
`, `
**Approach.** \`/robots.txt\` lists a path the site owner did not want indexed: \`Disallow: /s3cr3t-panel-7f3a\`. Visiting that path
shows the flag.

**Lesson.** robots.txt is a request to crawlers, not access control. It also advertises exactly what is sensitive.
`);

pack('sql-sleuth', {
  key: 'sql', title: 'SQL Sleuth', category: 'WEB', difficulty: 'MEDIUM', points: 250, scoring: 'DECAY_FIRSTBLOOD',
  requires: ['inspect'], flag: 'CTF{or_1_equals_1}',
  hints: [{ text: 'The login query concatenates your input straight into the SQL string.', cost: 30 }],
}, `
## SQL Sleuth

The admin login builds its query like this:

\`\`\`sql
SELECT * FROM users WHERE name = '$user' AND pass = '$pass';
\`\`\`

**Target:** ${HOST}/sql

You have no password. You do have an apostrophe.
`, `
**Approach.** The input is concatenated into the query, so a username of \`admin' --\` comments out the password check, and
\`' OR 1=1 --\` matches every row. Logging in as the admin account reveals the flag. The application is backed by a real SQLite database.

**Lesson.** Use parameterised queries. Never build SQL by joining strings.
`);

pack('token-trouble', {
  key: 'jwt', title: 'Token Trouble', category: 'WEB', difficulty: 'MEDIUM', points: 280, scoring: 'DECAY',
  requires: ['cookie'], flag: 'CTF{none_algorithm_is_not_an_option}',
}, `
## Token Trouble

The API trusts a signed **JWT**. The header says which algorithm verifies it:

\`\`\`json
{ "alg": "HS256", "typ": "JWT" }
\`\`\`

**Target:** ${HOST}/jwt

Visit the page to get a guest token, then reach the admin endpoint. What if the server believed *you* about that header?

**Tools that help:** jwt.io, CyberChef, or a few lines of Python.
`, `
**Approach.** Get the guest token, then craft a new one with header \`{"alg":"none","typ":"JWT"}\` and a payload of
\`{"user":"admin"}\` (base64url, no signature part, keep the trailing dot). The vulnerable server accepts \`alg: none\` and skips
verification. Send it as \`Authorization: Bearer <token>\` to \`/jwt/admin\`.

**Lesson.** Servers must choose the algorithm themselves; never accept the one named inside the token.
`);

console.log('Done.');
