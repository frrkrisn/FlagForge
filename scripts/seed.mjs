#!/usr/bin/env node
// FlagForge seed / demo-traffic script.
//
// Populates a *fresh* server (empty data dir) with the sample CTF from
// docs/PLAYBOOK.md §10 by talking to the real REST API, so the server does all
// hashing, scoring, first-blood and anti-cheat logic. Run it against a running
// ctf_server, then point the frontend at the same backend.
//
//   node scripts/seed.mjs [http://localhost:8080]
//
// Node 18+ (global fetch). No dependencies.

const BASE = (process.argv[2] || process.env.FF_BASE || 'http://localhost:8080').replace(/\/$/, '');

// --- tiny cookie-aware client -------------------------------------------------
function makeActor(name) {
  return { name, cookie: '' };
}

async function req(actor, method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(actor.cookie ? { Cookie: actor.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const m = /session=([^;]+)/.exec(setCookie);
    if (m) actor.cookie = `session=${m[1]}`;
  }
  const json = await res.json().catch(() => ({ ok: false, error: { message: 'bad json' } }));
  if (!json.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${json.error?.code}: ${json.error?.message}`);
  }
  return json.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// --- the sample CTF (§10) -----------------------------------------------------
const CHALLENGES = [
  { key: 'welcome', title: 'Welcome Flag', category: 'MISC', difficulty: 'EASY', basePoints: 50, strategy: 'STATIC', flagType: 'STATIC', flag: 'CTF{welcome_to_flagforge}', prereq: [], description: 'Every good CTF starts with a freebie. The flag is right here: `CTF{welcome_to_flagforge}`. Paste it below.' },
  { key: 'inspect', title: 'Inspect Me', category: 'WEB', difficulty: 'EASY', basePoints: 100, strategy: 'DECAY', flagType: 'STATIC', flag: 'CTF{view_source_luke}', prereq: [], description: '## Inspect Me\nThe answer is hidden in the page. Sometimes the browser tells you everything if you just **view source**.' },
  { key: 'caesar', title: "Caesar's Secret", category: 'CRYPTO', difficulty: 'EASY', basePoints: 100, strategy: 'DECAY', flagType: 'STATIC', flag: 'CTF{et_tu_brute}', prereq: [], description: '## A Roman cipher\n`PGS{rg_gh_oehgr}` — shifted by a familiar amount. Wheel of fortune, anyone?' },
  { key: 'robots', title: 'Robots Rule', category: 'WEB', difficulty: 'MEDIUM', basePoints: 200, strategy: 'DECAY_FIRSTBLOOD', flagType: 'STATIC', flag: 'CTF{disallow_all_the_things}', prereqKey: ['inspect'], hints: [{ text: 'Web crawlers read one special file at the site root.', cost: 20 }, { text: 'Try /robots.txt and read the Disallow lines.', cost: 40 }], description: '## Robots Rule\nWhat do search engines promise not to look at? That is exactly where you should look.' },
  { key: 'basecamp', title: 'Base Camp', category: 'CRYPTO', difficulty: 'MEDIUM', basePoints: 200, strategy: 'DECAY', flagType: 'STATIC', flag: 'CTF{layers_upon_layers}', prereqKey: ['caesar'], description: '## Base Camp\nBase64 inside base32 inside base64... peel the onion.' },
  { key: 'pixels', title: 'Hidden Pixels', category: 'FORENSICS', difficulty: 'MEDIUM', basePoints: 250, strategy: 'DECAY_FIRSTBLOOD', flagType: 'STATIC', flag: 'CTF{exif_never_lies}', prereq: [], description: '## Hidden Pixels\nA picture is worth a thousand words — and sometimes a flag in its **metadata**.' },
  { key: 'token', title: 'Team Token', category: 'WEB', difficulty: 'MEDIUM', basePoints: 300, strategy: 'DYNAMIC', flagType: 'DYNAMIC', flagPrefix: 'CTF', prereqKey: ['robots'], description: '## Team Token\nThis challenge issues a **unique flag per team**. Submitting another team’s token counts as flag sharing — and we will notice.' },
  { key: 'crackme', title: 'Crackme Lite', category: 'REVERSE', difficulty: 'HARD', basePoints: 400, strategy: 'DECAY_FIRSTBLOOD', flagType: 'STATIC', flag: 'CTF{strings_are_your_friend}', prereqKey: ['basecamp'], description: '## Crackme Lite\nA tiny binary guards a secret. `strings` is a surprisingly good disassembler.' },
  { key: 'overflow', title: 'Overflow 101', category: 'PWN', difficulty: 'HARD', basePoints: 450, strategy: 'DECAY', flagType: 'STATIC', flag: 'CTF{smash_the_stack}', prereqKey: ['crackme'], description: '## Overflow 101\nA classic. Send more than the buffer can hold and watch what happens.' },
  { key: 'boss', title: 'Final Boss', category: 'MISC', difficulty: 'HARD', basePoints: 500, strategy: 'DYNAMIC_FIRSTBLOOD', flagType: 'DYNAMIC', flagPrefix: 'CTF', prereqKey: ['token', 'overflow'], description: '## Final Boss\nEverything you have learned, combined. A **per-team** flag guards the summit.' },
  { key: 'elephant', title: 'The Elephant in the Room', category: 'MISC', difficulty: 'MEDIUM', basePoints: 150, strategy: 'DECAY_FIRSTBLOOD', flagType: 'STATIC', flag: 'CTF{the_elephant_in_the_room}', prereq: [], hints: [{ text: 'It is the English idiom for the huge, obvious problem everyone can see but nobody talks about.', cost: 20 }], description: '## Address Me  \n\nThere is an **elephant in the room** — grey, enormous, standing on the furniture, impossible to miss. Everyone sees it. Nobody says it.\n\n> "Address me."\n\nAn elephant never forgets... an *address*. Sometimes the flag is the big, obvious thing nobody dares to name out loud. Say the quiet part.\n\n**Format:** `CTF{the_..._in_the_...}` — the idiom the picture is screaming.' },
];

// Solve order (a valid topological order of the prerequisite graph).
const SOLVE_ORDER = ['welcome', 'inspect', 'caesar', 'pixels', 'robots', 'basecamp', 'token', 'crackme', 'overflow', 'boss'];

const TEAMS = [
  'NullPointers', 'SegFaultSquad', 'StackSmashers', 'RootAccess', 'ByteBenders', 'Kernel Panic',
  '0xDEADBEEF', 'PacketSniffers', 'SudoMakeSandwich', 'HashBrowns', 'CtrlAltDefeat', 'LeetSpeakers',
];
// How many challenges (from SOLVE_ORDER) each team solves — a believable spread.
const SOLVE_COUNTS = [10, 9, 8, 8, 7, 6, 5, 5, 4, 3, 2, 1];

function slug(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'team';
}

async function main() {
  console.log(`Seeding ${BASE} ...`);

  // 1) Admin = first user.
  const admin = makeActor('admin');
  await req(admin, 'POST', '/auth/register', { username: 'admin', email: 'admin@flagforge.ctf', password: 'adminpassword' });
  console.log('  [+] admin registered');

  // 2) Challenges (dependency order is preserved by CHALLENGES array order).
  const idByKey = {};
  for (const c of CHALLENGES) {
    const spec = {
      title: c.title, category: c.category, difficulty: c.difficulty, description: c.description,
      basePoints: c.basePoints,
      scoring: { strategy: c.strategy, minPoints: Math.round(c.basePoints * 0.2), decay: 10 },
      flagType: c.flagType, flag: c.flag ?? '', flagPrefix: c.flagPrefix ?? 'CTF',
      prerequisites: (c.prereqKey ?? []).map((k) => idByKey[k]),
      hints: c.hints ?? [], attachments: [], visible: true,
    };
    const created = await req(admin, 'POST', '/admin/challenges', spec);
    idByKey[c.key] = created.id;
  }
  console.log(`  [+] ${CHALLENGES.length} challenges created`);

  // 3) Start the event.
  await req(admin, 'POST', '/admin/event/start');
  console.log('  [+] event started');

  // 4) Teams + players.
  const teams = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const name = TEAMS[i];
    const s = slug(name);
    const captain = makeActor(`${s}_cap`);
    await req(captain, 'POST', '/auth/register', { username: `${s}1`, email: `${s}1@flagforge.ctf`, password: 'password123' });
    const team = await req(captain, 'POST', '/teams', { name });
    const members = [captain];
    const extra = rand(1, 3); // 2-4 members total
    for (let j = 0; j < extra; j++) {
      const p = makeActor(`${s}_${j + 2}`);
      await req(p, 'POST', '/auth/register', { username: `${s}${j + 2}`, email: `${s}${j + 2}@flagforge.ctf`, password: 'password123' });
      await req(p, 'POST', '/teams/join', { inviteCode: team.inviteCode });
      members.push(p);
    }
    teams.push({ name, id: team.id, members, captain });
  }
  console.log(`  [+] ${teams.length} teams with players created`);

  // 5) Solves — processed challenge-by-challenge (in unlock order) with the eligible
  //    teams rotated each round, so first blood is spread across many teams rather
  //    than swept by whoever we happen to iterate first.
  for (let p = 0; p < SOLVE_ORDER.length; p++) {
    const key = SOLVE_ORDER[p];
    const chId = idByKey[key];
    const ch = CHALLENGES.find((c) => c.key === key);
    // teams whose solve budget reaches this position, rotated by p for variety.
    const eligible = teams.filter((_, i) => SOLVE_COUNTS[i] > p);
    const rotated = eligible.slice(p % Math.max(1, eligible.length)).concat(eligible.slice(0, p % Math.max(1, eligible.length)));
    for (let k = 0; k < rotated.length; k++) {
      const team = rotated[k];
      const solver = team.members[p % team.members.length];
      let flag = ch.flag;
      if (ch.flagType === 'DYNAMIC') {
        const { flag: teamFlag } = await req(admin, 'GET', `/admin/teams/${team.id}/flag/${chId}`);
        flag = teamFlag;
      }
      try {
        const r = await req(solver, 'POST', `/challenges/${chId}/submit`, { flag });
        if (r.result === 'CORRECT' && r.firstBlood) console.log(`      🩸 ${team.name} first blood on ${ch.title}`);
      } catch (e) {
        console.warn(`      ! ${team.name} could not solve ${ch.title}: ${e.message}`);
      }
      await sleep(12); // stagger timestamps a little
    }
  }
  console.log('  [+] solves simulated');

  // 6) A costed hint unlock (visible score deduction).
  try {
    await req(teams[3].members[0], 'POST', `/challenges/${idByKey['robots']}/hints/h_1/unlock`);
    console.log('  [+] a hint was unlocked (score deduction)');
  } catch { /* robots may be unsolved/locked for this team */ }

  // 7) An announcement.
  await req(admin, 'POST', '/admin/announcements', {
    title: 'Round 2 is live', body: 'Pwn and Reverse challenges are now unlocked. Good luck!', severity: 'INFO',
  });

  // 8) Trigger a flag-sharing alert for the demo: a low team submits a top team's
  //    dynamic Team Token flag.
  try {
    const victim = teams[0]; // solved Team Token, so has a token flag
    const cheater = teams[5]; // solved the prereq (Robots Rule) but not Team Token itself
    const { flag: victimFlag } = await req(admin, 'GET', `/admin/teams/${victim.id}/flag/${idByKey['token']}`);
    // cheater must have the prerequisite for Team Token; if locked this will 423 — that's fine.
    const r = await req(cheater.members[0], 'POST', `/challenges/${idByKey['token']}/submit`, { flag: victimFlag }).catch((e) => ({ result: e.message }));
    console.log(`  [+] flag-sharing demo attempt: ${r.result}`);
  } catch (e) {
    console.warn(`  ! flag-sharing demo skipped: ${e.message}`);
  }

  console.log('Done. Log in as admin / adminpassword, or any team captain (e.g. nullpoin1 / password123).');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
