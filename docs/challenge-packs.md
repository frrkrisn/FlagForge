# Challenge packs

A **pack** is a folder that describes one challenge, including its files. Packs make FlagForge
extensible: drop a folder under `challenges/`, run one command, and the challenge (with its
downloads) appears on the platform.

```
challenges/packet-peek/
├── challenge.json     metadata (below)
├── description.md     what players read (markdown)
├── writeup.md         optional: the author's explanation (shown to a team after it solves)
└── files/             optional: attachments players download
    └── capture.pcap
```

## `challenge.json`

```json
{
  "key": "packet",
  "title": "Packet Peek",
  "category": "FORENSICS",
  "difficulty": "EASY",
  "points": 150,
  "scoring": "DECAY",
  "flag": "CTF{follow_the_tcp_stream}",
  "requires": ["inspect"],
  "hints": [{ "text": "HTTP login forms send what you type in the POST body.", "cost": 15 }],
  "files": ["capture.pcap"]
}
```

| Field | Required | Meaning |
|---|---|---|
| `key` | yes | Unique id (lower-case, digits, dashes). Other packs list it in `requires`. |
| `title` | yes | Shown to players. Packs are matched to existing challenges **by title**, so re-importing updates in place. |
| `category` | yes | `WEB` `CRYPTO` `FORENSICS` `REVERSE` `PWN` `MISC` |
| `difficulty` | yes | `EASY` `MEDIUM` `HARD` |
| `points` | yes | Starting value. |
| `scoring` | yes | `STATIC`, `DECAY`, `DECAY_FIRSTBLOOD`, `DYNAMIC`, `DYNAMIC_FIRSTBLOOD` |
| `flag` | static only | Stored on the server only as a SHA-256 hash. |
| `flagType: "DYNAMIC"` | optional | Every team gets its own flag, derived on the server. Omit `flag`. |
| `requires` | optional | Keys of prerequisite challenges (cycles are rejected). |
| `hints` | optional | `{ text, cost }`. Unlocking costs the team points. |
| `files` | optional | Names inside `files/`, or `{ "name": "...", "transform": "..." }` (see below). |

`description.md` may be replaced by an inline `"description"`. A missing or invalid field fails
with a message naming the pack and the field.

## Importing

```bash
node scripts/import-pack.mjs challenges/packet-peek     # one pack
node scripts/import-pack.mjs challenges                 # every pack
node scripts/import-pack.mjs challenges --url http://host:8080
```

Admin credentials come from `FF_ADMIN_USER` / `FF_ADMIN_PASS` (default `admin` / `adminpassword`).
The command is idempotent. `node scripts/seed.mjs` imports every pack too, then builds a demo event.

## Files and integrity

Each uploaded file is stored under `<data>/files/<challengeId>/` with its size and **SHA-256**.
Players see both next to the download so they can verify it (`sha256sum capture.pcap`).
A file is only downloadable when the challenge is visible, the event is running and the team has
solved the prerequisites. Names must be 1–80 characters of `[A-Za-z0-9._-]` and cannot start with `.`;
files are capped at 25 MB.

## Per-team files (`transform`)

A file can be **personalised for each team** at download time, so a team's copy, and the answer
inside it, differ from every other team's. Set `"transform"` to a pipeline of operations separated by `|`:

| Op | Effect |
|---|---|
| `flag` | Replace every `{{FLAG}}` with the downloading team's own flag. Needs a challenge with per-team flags. |
| `xor` | XOR every byte with a single-byte key derived from the server secret, the challenge and the team. |
| `hex` | Lower-case hex encode. |
| `base64` | Base64 encode. |

Example: `{ "name": "intercepted.hex", "transform": "flag|xor|hex" }` with the stored template
`The access code is {{FLAG}}.` Each team receives a hex string that decodes (after finding *their*
XOR key) to *their* flag. Because the flag is per-team, submitting another team's recovered flag is
detected as **flag sharing**. The hash shown to a team is the hash of **its own** copy. Admins
download the stored template.

## Writing a good challenge

* Build real artifacts (a capture, a binary, an image) rather than describing them.
* Prove it is solvable before you publish: run the intended solution yourself.
* Keep the flag out of anything players can read without solving (check with `strings`).
* Include a `writeup.md`: it turns a solved challenge into something people learn from.

The shipped challenges are produced by `tools/build-challenges.mjs`, which builds every artifact and
checks its solvability while it runs (the crackme is executed with the derived key, RSA is factored
with Fermat's method, and so on). Re-run it to regenerate `challenges/`.

## Web challenges

The `WEB` packs point at a separate process, `challenge-host/server.mjs`, which serves intentionally
vulnerable apps (cookie tampering, SQL injection against a real SQLite database, a JWT `alg: none`
flaw, `robots.txt`). It is deliberately separate from `ctf_server` so a hole there can never touch
scores or accounts, and it binds to `127.0.0.1` unless you set `CHAL_HOST`.

```bash
node challenge-host/server.mjs
```
