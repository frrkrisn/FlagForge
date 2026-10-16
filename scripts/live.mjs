#!/usr/bin/env node
// FlagForge live-traffic simulator: keeps the event moving during a demo.
//
// Every few seconds a random team attempts something (a correct solve, a wrong guess, or
// a costed hint), all through the real API, so the scoreboard, feed, first-blood toasts and
// timeline update exactly as they would in a real CTF. Stop with Ctrl+C.
//
//   node scripts/live.mjs [http://localhost:8080] [--fast]
//
// Requires a seeded event (node scripts/seed.mjs). Node 18+.

import { CHALLENGES, SOLVE_COUNTS, TEAMS, slug } from './ctf-data.mjs';

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('http')) || process.env.FF_BASE || 'http://localhost:8080').replace(/\/$/, '');
const FAST = args.includes('--fast');

const C = { dim: '\x1b[2m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function req(actor, method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(actor.cookie ? { Cookie: actor.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get('set-cookie');
  const m = set && /session=([^;]+)/.exec(set);
  if (m) actor.cookie = `session=${m[1]}`;
  const json = await res.json().catch(() => null);
  if (!json || !json.ok) throw new Error(json?.error?.code || `HTTP ${res.status}`);
  return json.data;
}

async function login(username, password) {
  const actor = { cookie: '' };
  await req(actor, 'POST', '/auth/login', { username, password });
  return actor;
}

async function main() {
  const admin = await login('admin', 'adminpassword');
  const board = await req(admin, 'GET', '/scoreboard');
  const idByName = Object.fromEntries(board.rows.map((r) => [r.teamName, r.teamId]));

  // Log in each team's captain once. Weaker teams (later in the list) act a bit less.
  const teams = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const name = TEAMS[i];
    if (!idByName[name]) continue;
    try {
      teams.push({ name, id: idByName[name], actor: await login(`${slug(name)}1`, 'password123'), weight: 1 + Math.round(SOLVE_COUNTS[i] / 6) });
    } catch {
      /* captain missing: skip */
    }
  }
  if (teams.length === 0) throw new Error('No team accounts found. Run: node scripts/seed.mjs');
  console.log(`${C.cyan}live traffic on ${BASE} with ${teams.length} teams. Ctrl+C to stop.${C.reset}`);

  const bag = teams.flatMap((t) => Array(t.weight).fill(t));
  const wrongCount = new Map(); // `${team}:${challenge}` -> wrong attempts made

  for (;;) {
    const team = pick(bag);
    try {
      const list = (await req(team.actor, 'GET', '/challenges')).challenges;
      const open = list.filter((c) => !c.solved && !c.locked);
      if (open.length === 0) {
        await sleep(300);
        continue;
      }
      // Prefer easier (cheaper) challenges: weight by inverse points.
      const target = pick(open.flatMap((c) => Array(Math.max(1, Math.round(600 / c.basePoints))).fill(c)));
      const meta = CHALLENGES.find((c) => c.title === target.title);
      if (!meta) {
        await sleep(200);
        continue;
      }

      const roll = Math.random();
      const key = `${team.id}:${target.id}`;
      const wrongs = wrongCount.get(key) ?? 0;

      if (roll < 0.1 && target.hasHints) {
        const detail = await req(team.actor, 'GET', `/challenges/${target.id}`);
        const hint = detail.hints.find((h) => !h.unlocked);
        if (hint) {
          await req(team.actor, 'POST', `/challenges/${target.id}/hints/${hint.id}/unlock`);
          console.log(`${C.yellow}[hint ]${C.reset} ${team.name} unlocked a hint on ${target.title} ${C.dim}(-${hint.cost})${C.reset}`);
        }
      } else if (roll < 0.4 && wrongs < 2) {
        wrongCount.set(key, wrongs + 1);
        await req(team.actor, 'POST', `/challenges/${target.id}/submit`, { flag: `CTF{guess_${rand(100, 999)}}` });
        console.log(`${C.red}[miss ]${C.reset} ${team.name} missed on ${target.title}`);
      } else {
        let flag = meta.flag;
        if (meta.flagType === 'DYNAMIC') flag = (await req(admin, 'GET', `/admin/teams/${team.id}/flag/${target.id}`)).flag;
        const r = await req(team.actor, 'POST', `/challenges/${target.id}/submit`, { flag });
        if (r.result === 'CORRECT') {
          const fb = r.firstBlood ? `${C.red}🩸 FIRST BLOOD ${C.reset}` : '';
          console.log(`${C.green}[solve]${C.reset} ${fb}${team.name} solved ${target.title} ${C.dim}(+${r.awardedPoints})${C.reset}`);
        }
      }
    } catch (e) {
      console.log(`${C.dim}[skip ] ${team.name}: ${e.message}${C.reset}`);
    }
    await sleep(FAST ? rand(400, 1200) : rand(2500, 7000));
  }
}

main().catch((e) => {
  console.error('LIVE FAILED:', e.message);
  process.exit(1);
});
