// Challenge pack loader.
//
// A pack is a folder under challenges/ describing ONE challenge:
//
//   challenges/packet-peek/
//     challenge.json     metadata (see PACK_FORMAT below)
//     description.md     the markdown shown to players   (or "description" inline in the json)
//     writeup.md         optional: shown to a team only after it solves the challenge
//     files/             optional: attachments players download
//
// challenge.json:
//   {
//     "key": "packet",                 // unique key; other packs reference it in "requires"
//     "title": "Packet Peek",
//     "category": "FORENSICS",         // WEB | CRYPTO | FORENSICS | REVERSE | PWN | MISC
//     "difficulty": "EASY",            // EASY | MEDIUM | HARD
//     "points": 150,
//     "scoring": "DECAY",              // STATIC | DECAY | DECAY_FIRSTBLOOD | DYNAMIC | DYNAMIC_FIRSTBLOOD
//     "flag": "CTF{...}",              // static flag   (omit for per-team flags)
//     "flagType": "DYNAMIC",           // optional: per-team flag derived on the server
//     "requires": ["inspect"],         // optional: keys of prerequisite challenges
//     "hints": [{ "text": "...", "cost": 20 }],
//     "files": ["capture.pcap", { "name": "cipher.hex", "transform": "flag|xor|hex" }]
//   }
//
// "files" lists what to upload from files/. A transform personalises the file for each team on
// download (per-team files); see docs/challenge-packs.md.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = ['WEB', 'CRYPTO', 'FORENSICS', 'REVERSE', 'PWN', 'MISC'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const SCORING = ['STATIC', 'DECAY', 'DECAY_FIRSTBLOOD', 'DYNAMIC', 'DYNAMIC_FIRSTBLOOD'];

function fail(dir, msg) {
  throw new Error(`pack "${dir}": ${msg}`);
}

/** Load one pack directory into the shape the seed/import scripts use. */
export function loadPack(dir) {
  const jsonPath = join(dir, 'challenge.json');
  if (!existsSync(jsonPath)) fail(dir, 'missing challenge.json');
  let m;
  try {
    m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    fail(dir, `challenge.json is not valid JSON (${e.message})`);
  }

  for (const k of ['key', 'title', 'category', 'difficulty', 'points', 'scoring']) {
    if (m[k] === undefined || m[k] === '') fail(dir, `"${k}" is required`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(m.key)) fail(dir, `"key" must be lowercase letters, digits and dashes`);
  if (!CATEGORIES.includes(m.category)) fail(dir, `"category" must be one of ${CATEGORIES.join(', ')}`);
  if (!DIFFICULTIES.includes(m.difficulty)) fail(dir, `"difficulty" must be one of ${DIFFICULTIES.join(', ')}`);
  if (!SCORING.includes(m.scoring)) fail(dir, `"scoring" must be one of ${SCORING.join(', ')}`);
  if (!Number.isInteger(m.points) || m.points <= 0) fail(dir, '"points" must be a positive integer');

  const dynamic = m.flagType === 'DYNAMIC' || m.scoring.startsWith('DYNAMIC');
  if (!dynamic && !m.flag) fail(dir, 'a static challenge needs a "flag"');

  const descFile = join(dir, 'description.md');
  const description = existsSync(descFile) ? readFileSync(descFile, 'utf8') : m.description;
  if (!description) fail(dir, 'needs description.md (or an inline "description")');

  const writeFile = join(dir, 'writeup.md');
  const writeup = existsSync(writeFile) ? readFileSync(writeFile, 'utf8') : m.writeup ?? '';

  const files = (m.files ?? []).map((f) => {
    const spec = typeof f === 'string' ? { name: f } : f;
    const path = join(dir, 'files', spec.name);
    if (!existsSync(path) || !statSync(path).isFile()) fail(dir, `listed file "${spec.name}" not found in files/`);
    return { name: spec.name, path, transform: spec.transform ?? '' };
  });

  return {
    key: m.key,
    title: m.title,
    category: m.category,
    difficulty: m.difficulty,
    basePoints: m.points,
    strategy: m.scoring,
    flagType: dynamic ? 'DYNAMIC' : 'STATIC',
    flag: dynamic ? '' : m.flag,
    flagPrefix: m.flagPrefix ?? 'CTF',
    prereqKey: m.requires ?? [],
    hints: m.hints ?? [],
    description,
    writeup,
    files,
    service: m.service ?? null,
  };
}

/** Load every pack under a challenges/ directory (missing directory = no packs). */
export function loadPacks(root) {
  if (!existsSync(root)) return [];
  const packs = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (statSync(dir).isDirectory() && existsSync(join(dir, 'challenge.json'))) packs.push(loadPack(dir));
  }
  const seen = new Set();
  for (const p of packs) {
    if (seen.has(p.key)) throw new Error(`duplicate pack key "${p.key}"`);
    seen.add(p.key);
  }
  return packs;
}

/**
 * Order challenges so every prerequisite comes before its dependents (stable otherwise).
 * Throws on an unknown prerequisite or a cycle.
 */
export function topoSort(list) {
  const byKey = new Map(list.map((c) => [c.key, c]));
  const out = [];
  const state = new Map(); // key -> 1 visiting, 2 done
  const visit = (c) => {
    if (state.get(c.key) === 2) return;
    if (state.get(c.key) === 1) throw new Error(`prerequisite cycle involving "${c.key}"`);
    state.set(c.key, 1);
    for (const k of c.prereqKey ?? []) {
      const dep = byKey.get(k);
      if (!dep) throw new Error(`"${c.key}" requires unknown challenge "${k}"`);
      visit(dep);
    }
    state.set(c.key, 2);
    out.push(c);
  };
  list.forEach(visit);
  return out;
}
