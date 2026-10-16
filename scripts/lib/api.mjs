// Shared API helpers for the seed / import / live scripts. Node 18+, no dependencies.

import { readFileSync } from 'node:fs';

/** A tiny cookie-aware client bound to a server base URL. */
export function createClient(base) {
  const BASE = base.replace(/\/$/, '');

  function makeActor(name) {
    return { name, cookie: '' };
  }

  async function request(actor, method, path, body, raw) {
    const headers = actor.cookie ? { Cookie: actor.cookie } : {};
    if (raw !== undefined) headers['Content-Type'] = 'application/octet-stream';
    else if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    const m = setCookie && /session=([^;]+)/.exec(setCookie);
    if (m) actor.cookie = `session=${m[1]}`;
    const json = await res.json().catch(() => ({ ok: false, error: { message: 'bad json' } }));
    if (!json.ok) throw new Error(`${method} ${path} -> ${res.status} ${json.error?.code}: ${json.error?.message}`);
    return json.data;
  }

  /** Register, or log in if the account already exists. */
  async function ensureUser(name, username, email, password) {
    const actor = makeActor(name);
    try {
      await request(actor, 'POST', '/auth/register', { username, email, password });
    } catch (e) {
      if (!/CONFLICT/.test(e.message)) throw e;
      await request(actor, 'POST', '/auth/login', { username, password });
    }
    return actor;
  }

  return { BASE, makeActor, req: request, ensureUser };
}

/** Points fall from base to the 20% floor over this many solves (scales with team count). */
export const DECAY = 30;

/** The challenge spec the API expects, built from a loaded pack / seed entry. */
export function buildSpec(c, idByKey) {
  return {
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    description: c.description,
    writeup: c.writeup ?? "",
    basePoints: c.basePoints,
    scoring: { strategy: c.strategy, minPoints: Math.round(c.basePoints * 0.2), decay: DECAY },
    flagType: c.flagType,
    flag: c.flag ?? '',
    flagPrefix: c.flagPrefix ?? 'CTF',
    prerequisites: (c.prereqKey ?? []).map((k) => idByKey[k]).filter(Boolean),
    hints: c.hints ?? [],
    attachments: [],
    visible: true,
  };
}

/**
 * Create the challenge if it does not exist (matched by title), otherwise update it in place,
 * then upload its files. Idempotent. Returns { id, created }.
 */
export async function syncChallenge(client, admin, c, idByKey, existingList, { updateExisting = true } = {}) {
  const found = existingList.find((x) => x.title === c.title);
  const spec = buildSpec(c, idByKey);
  let id;
  let created = false;
  if (found) {
    id = found.id;
    if (updateExisting) await client.req(admin, 'PUT', `/admin/challenges/${id}`, spec);
  } else {
    id = (await client.req(admin, 'POST', '/admin/challenges', spec)).id;
    created = true;
    existingList.push({ id, title: c.title });
  }
  for (const file of c.files ?? []) {
    await client.req(
      admin,
      'PUT',
      `/admin/challenges/${id}/files/${encodeURIComponent(file.name)}${file.transform ? `?transform=${encodeURIComponent(file.transform)}` : ''}`,
      undefined,
      readFileSync(file.path),
    );
  }
  return { id, created };
}
