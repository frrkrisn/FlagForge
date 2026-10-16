#!/usr/bin/env node
// Import challenge pack(s) into a running server.
//
//   node scripts/import-pack.mjs challenges/packet-peek              one pack
//   node scripts/import-pack.mjs challenges                          every pack in the folder
//   node scripts/import-pack.mjs challenges --url http://host:8080   another server
//
// Admin credentials come from FF_ADMIN_USER / FF_ADMIN_PASS (default: admin / adminpassword).
// Idempotent: a challenge is matched by title and updated in place (its files are replaced).
// Prerequisites are resolved by key, so a pack can require a challenge that already exists
// on the server or one that is defined in challenges/ or scripts/ctf-data.mjs.

import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { CHALLENGES } from './ctf-data.mjs';
import { createClient, syncChallenge } from './lib/api.mjs';
import { loadPack, loadPacks, topoSort } from './lib/packs.mjs';

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const BASE = (urlIdx >= 0 ? args[urlIdx + 1] : process.env.FF_BASE || 'http://localhost:8080').replace(/\/$/, '');
const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--url');

if (!target || !existsSync(target)) {
  console.error('usage: node scripts/import-pack.mjs <pack-dir | challenges-dir> [--url http://localhost:8080]');
  process.exit(2);
}

async function main() {
  const dir = resolve(target);
  // a folder with challenge.json is one pack; otherwise treat it as a folder of packs
  const packs = existsSync(resolve(dir, 'challenge.json')) ? [loadPack(dir)] : loadPacks(dir);
  if (packs.length === 0) throw new Error(`no packs found in ${target}`);

  const client = createClient(BASE);
  const admin = client.makeActor('admin');
  await client.req(admin, 'POST', '/auth/login', {
    username: process.env.FF_ADMIN_USER || 'admin',
    password: process.env.FF_ADMIN_PASS || 'adminpassword',
  });

  const existing = (await client.req(admin, 'GET', '/challenges')).challenges;

  // Resolve prerequisites by key: first against everything we know about (so a pack can
  // depend on a seeded challenge), then against the server by title.
  const known = new Map(CHALLENGES.map((c) => [c.key, c]));
  const idByKey = {};
  for (const c of known.values()) {
    const found = existing.find((x) => x.title === c.title);
    if (found) idByKey[c.key] = found.id;
  }

  // Order the packs among themselves; prerequisites outside this import come from the server.
  const packKeys = new Set(packs.map((p) => p.key));
  const order = topoSort(packs.map((p) => ({ key: p.key, prereqKey: p.prereqKey.filter((k) => packKeys.has(k)) }))).map((o) => o.key);
  for (const p of order.map((k) => packs.find((x) => x.key === k))) {
    for (const k of p.prereqKey) {
      if (!idByKey[k] && !packKeys.has(k)) throw new Error(`"${p.key}" requires "${k}", which is not on the server`);
    }
    const r = await syncChallenge(client, admin, p, idByKey, existing, { updateExisting: true });
    idByKey[p.key] = r.id;
    console.log(`  [${r.created ? '+' : '~'}] ${p.title} (${r.id}) ${r.created ? 'created' : 'updated'}, ${p.files.length} file(s)`);
  }
  console.log(`Imported ${packs.length} pack(s) from ${basename(dir)}.`);
}

main().catch((e) => {
  console.error('IMPORT FAILED:', e.message);
  process.exit(1);
});
