#!/usr/bin/env node
// FlagForge seed script (idempotent: safe to re-run, it EXTENDS an existing event).
//
// Populates a running server through the real REST API, so hashing, scoring, first-blood
// and anti-cheat all run server-side. It creates the admin (or logs in if one exists), the
// challenges (text-only ones from scripts/ctf-data.mjs plus every pack under challenges/,
// with their files) and 30 teams, then simulates a believable spread of solves, wrong
// attempts and hint unlocks.
//
//   node scripts/seed.mjs [http://localhost:8080] [--alerts]
//
// --alerts  also stage three flag-sharing incidents for the admin Alerts panel.
// Node 18+ (global fetch). No dependencies.

import { CHALLENGES, SOLVE_COUNTS, SOLVE_ORDER, TEAMS, slug } from './ctf-data.mjs';
import { DECAY, createClient, syncChallenge } from './lib/api.mjs';

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('http')) || process.env.FF_BASE || 'http://localhost:8080').replace(/\/$/, '');
const WITH_ALERTS = args.includes('--alerts');

const client = createClient(BASE);
const { req, ensureUser } = client;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function main() {
  console.log(`Seeding ${BASE} ...`);

  // 1) Admin
  const admin = await ensureUser('admin', 'admin', 'admin@flagforge.ctf', 'adminpassword');
  console.log('  [+] admin ready');

  // 2) Challenges. Packs (which carry files) are always synced; text-only challenges are
  //    created if missing and retuned if their decay window is out of date.
  const existing = (await req(admin, 'GET', '/challenges')).challenges;
  const idByKey = {};
  let created = 0;
  let updated = 0;
  let files = 0;
  for (const c of CHALLENGES) {
    const found = existing.find((x) => x.title === c.title);
    const isPack = c.files !== undefined;
    const needsUpdate = isPack || (found && found.decay !== DECAY && c.strategy !== 'STATIC');
    const r = await syncChallenge(client, admin, c, idByKey, existing, { updateExisting: Boolean(needsUpdate) });
    idByKey[c.key] = r.id;
    if (r.created) created++;
    else if (needsUpdate) updated++;
    files += c.files?.length ?? 0;
  }
  console.log(`  [+] challenges ready (${created} new, ${updated} updated, ${files} files uploaded)`);

  // 3) Make sure the event is running
  try {
    await req(admin, 'POST', '/admin/event/start');
  } catch {
    /* already running / paused / ended */
  }

  // 4) Teams + players (reusing any that exist)
  const teams = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const name = TEAMS[i];
    const s = slug(name);
    const captain = await ensureUser(`${s}_cap`, `${s}1`, `${s}1@flagforge.ctf`, 'password123');
    let team;
    try {
      team = await req(captain, 'POST', '/teams', { name });
    } catch (e) {
      if (!/CONFLICT/.test(e.message)) throw e;
      team = await req(captain, 'GET', '/teams/me');
    }
    const members = [captain];
    const extra = rand(1, 3);
    for (let j = 0; j < extra; j++) {
      try {
        const p = await ensureUser(`${s}_${j + 2}`, `${s}${j + 2}`, `${s}${j + 2}@flagforge.ctf`, 'password123');
        try {
          await req(p, 'POST', '/teams/join', { inviteCode: team.inviteCode });
        } catch {
          /* already on a team / team full */
        }
        members.push(p);
      } catch {
        /* skip a member that cannot be created */
      }
    }
    teams.push({ name, id: team.id, members, captain });
  }
  console.log(`  [+] ${teams.length} teams ready`);

  // 5) Solves: challenge by challenge, rotating which teams go first so first blood is
  //    spread around. ~35% of teams miss once before getting it right.
  let solved = 0;
  for (let p = 0; p < SOLVE_ORDER.length; p++) {
    const ch = CHALLENGES.find((c) => c.key === SOLVE_ORDER[p]);
    const chId = idByKey[ch.key];
    const eligible = teams.filter((_, i) => SOLVE_COUNTS[i] > p);
    const shift = eligible.length ? (p * 7) % eligible.length : 0;
    const rotated = eligible.slice(shift).concat(eligible.slice(0, shift));
    for (const team of rotated) {
      const solver = team.members[p % team.members.length];
      let flag = ch.flag;
      if (ch.flagType === 'DYNAMIC') {
        flag = (await req(admin, 'GET', `/admin/teams/${team.id}/flag/${chId}`)).flag;
      }
      try {
        if (Math.random() < 0.35) {
          await req(solver, 'POST', `/challenges/${chId}/submit`, { flag: `CTF{wrong_${rand(1000, 9999)}}` });
        }
        const r = await req(solver, 'POST', `/challenges/${chId}/submit`, { flag });
        if (r.result === 'CORRECT') {
          solved++;
          if (r.firstBlood) console.log(`      🩸 ${team.name} first blood on ${ch.title}`);
        }
      } catch {
        /* locked, cooldown, closed, or already solved: all fine on a re-run */
      }
      await sleep(8);
    }
  }
  console.log(`  [+] ${solved} new solves simulated`);

  // 6) A few costed hints, spread over teams
  let hints = 0;
  for (const c of CHALLENGES.filter((x) => x.hints?.length)) {
    for (const team of teams.slice(rand(3, 8), rand(10, 18))) {
      try {
        await req(team.members[0], 'POST', `/challenges/${idByKey[c.key]}/hints/h_1/unlock`);
        hints++;
      } catch {
        /* challenge locked for this team */
      }
      if (hints % 7 === 0) break;
    }
  }
  console.log(`  [+] ${hints} hint unlocks`);

  // 7) Announcements
  try {
    await req(admin, 'POST', '/admin/announcements', { title: 'Round 2 is live', body: 'Pwn and Reverse challenges are now unlocked. Good luck!', severity: 'INFO' });
    await req(admin, 'POST', '/admin/announcements', { title: 'Scoreboard freezes soon', body: 'The public board freezes one hour before the end. The final minutes stay secret.', severity: 'WARNING' });
  } catch {
    /* ignore */
  }

  // 8) Optional: stage flag-sharing incidents for the Alerts panel
  if (WITH_ALERTS) {
    const incidents = [
      { cheater: 8, victim: 0, key: 'token' },
      { cheater: 9, victim: 1, key: 'token' },
      { cheater: 7, victim: 2, key: 'session' },
    ];
    for (const { cheater, victim, key } of incidents) {
      try {
        const stolen = (await req(admin, 'GET', `/admin/teams/${teams[victim].id}/flag/${idByKey[key]}`)).flag;
        const r = await req(teams[cheater].members[0], 'POST', `/challenges/${idByKey[key]}/submit`, { flag: stolen });
        console.log(`  [!] ${teams[cheater].name} submitted ${teams[victim].name}'s ${key} flag -> ${r.result}`);
      } catch (e) {
        console.warn(`  ! incident skipped: ${e.message}`);
      }
    }
  }

  console.log('Done. Log in as admin / adminpassword, or any captain (e.g. nullpoin1 / password123).');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
