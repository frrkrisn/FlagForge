#!/usr/bin/env node
// FlagForge challenge host: intentionally vulnerable mini web apps for the WEB challenges.
//
//   node challenge-host/server.mjs            (listens on 127.0.0.1:9001)
//   CHAL_HOST=0.0.0.0 CHAL_PORT=9001 node challenge-host/server.mjs   (reachable from other machines)
//
// SECURITY: this process is vulnerable BY DESIGN. It is deliberately separate from ctf_server (the
// platform that stores scores and accounts) so a hole here can never touch real data. It holds only an
// in-memory SQLite database of fake users, reads no files, and never executes player input. Run it on a
// machine/network you control and bind it to 127.0.0.1 unless players need to reach it remotely.
//
// Challenges served (flags match the packs under challenges/):
//   /inspect   HTML comment left in the page source
//   /cookie    role cookie (base64) is trusted
//   /robots    discover a path through /robots.txt
//   /sql       real SQL injection against SQLite
//   /jwt       JWT verifier that accepts alg:none
//
// Node 22+ (uses the built-in node:sqlite).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const HOST = process.env.CHAL_HOST || '127.0.0.1';
const PORT = Number(process.env.CHAL_PORT || 9001);

const FLAGS = {
  inspect: 'CTF{view_source_luke}',
  cookie: 'CTF{c00kies_are_not_secure}',
  robots: 'CTF{disallow_all_the_things}',
  sql: 'CTF{or_1_equals_1}',
  jwt: 'CTF{none_algorithm_is_not_an_option}',
};

// ---- a real (in-memory) SQLite database with fake users ------------------------------------
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, pass TEXT, note TEXT);
  INSERT INTO users (name, pass, note) VALUES
    ('guest', 'guest123', 'Welcome to the harbor portal.'),
    ('admin', 'k9#Vq2$wL8!zXe4r-not-guessable', '${FLAGS.sql}');
`);

// ---- helpers --------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const page = (title, body, extraHead = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font:16px/1.55 ui-monospace,Consolas,monospace;background:#0b1210;color:#cfeadf;margin:0;display:grid;place-items:center;min-height:100vh}
  main{max-width:560px;padding:2rem;background:#101a17;border-radius:18px;box-shadow:8px 8px 18px #070c0a,-6px -6px 14px #16231f}
  h1{font-size:1.2rem;color:#4ee6a0;margin-top:0} a{color:#4ee6a0} code{color:#8fd}
  input{width:100%;box-sizing:border-box;padding:.6rem;margin:.3rem 0 .8rem;border:0;border-radius:10px;background:#0b1210;color:#cfeadf;box-shadow:inset 3px 3px 6px #070c0a,inset -2px -2px 5px #16231f}
  button{padding:.6rem 1.2rem;border:0;border-radius:10px;background:#4ee6a0;color:#04140c;font-weight:700;cursor:pointer}
  .flag{padding:.8rem;border-radius:10px;background:#0b1210;color:#4ee6a0;word-break:break-all}
  .err{color:#ff8b7e}
</style>${extraHead}</head><body><main>${body}</main></body></html>`;

const send = (res, status, body, type = 'text/html; charset=utf-8', headers = {}) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 16_384) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const cookies = (req) =>
  Object.fromEntries((req.headers.cookie || '').split(';').map((p) => p.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fromB64url = (s) => Buffer.from(s, 'base64url');
const JWT_SECRET = 'not-the-secret-you-are-looking-for-' + Math.random();

// ---- routes ---------------------------------------------------------------------------------
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/') {
    return send(res, 200, page('FlagForge challenge host', `<h1>flagforge challenge host</h1>
<p>Intentionally vulnerable practice targets for the FlagForge web challenges.</p>
<ul><li><a href="/inspect">/inspect</a></li><li><a href="/cookie">/cookie</a></li><li><a href="/robots">/robots</a></li>
<li><a href="/sql">/sql</a></li><li><a href="/jwt">/jwt</a></li></ul>
<p>Read each challenge's description on the platform for what to do.</p>`));
  }

  // --- Inspect Me: the flag is a leftover HTML comment
  if (path === '/inspect') {
    return send(res, 200, page('Harbor Authority', `<h1>Harbor Authority</h1>
<p>Welcome to the new landing page. Ships arrive daily; the tide tables are updated hourly.</p>
<p>Contact the duty officer for berth assignments.</p>
<!-- TODO: remove debug note before launch: ${FLAGS.inspect} -->
<p><small>&copy; Harbor Authority</small></p>`));
  }

  // --- Cookie Monster: the role cookie is trusted
  if (path === '/cookie') {
    const role = cookies(req).role;
    let who = 'guest';
    if (role) {
      try { who = Buffer.from(decodeURIComponent(role), 'base64').toString('utf8'); } catch { who = 'guest'; }
    }
    const headers = role ? {} : { 'Set-Cookie': 'role=Z3Vlc3Q=; Path=/' };
    const body = who === 'admin'
      ? `<h1>Staff portal</h1><p>Welcome, administrator.</p><p class="flag">${FLAGS.cookie}</p>`
      : `<h1>Staff portal</h1><p>You are signed in as <code>${esc(who)}</code>. Only administrators may view the secrets page.</p>`;
    return send(res, 200, page('Staff portal', body), 'text/html; charset=utf-8', headers);
  }

  // --- Robots Rule: find the hidden path through robots.txt
  if (path === '/robots') {
    return send(res, 200, page('Archive', `<h1>The Archive</h1><p>Nothing to see here. Search engines index this site nicely.</p>`));
  }
  if (path === '/robots.txt') {
    return send(res, 200, 'User-agent: *\nDisallow: /s3cr3t-panel-7f3a/\n', 'text/plain; charset=utf-8');
  }
  if (path === '/s3cr3t-panel-7f3a') {
    return send(res, 200, page('Secret panel', `<h1>Secret panel</h1><p>You should not be here. But since you are:</p><p class="flag">${FLAGS.robots}</p>`));
  }

  // --- SQL Sleuth: a real SQL injection (string-concatenated query on real SQLite)
  if (path === '/sql' && req.method === 'GET') {
    return send(res, 200, page('Harbor login', `<h1>Harbor staff login</h1>
<form method="POST" action="/sql"><label>Username<input name="user" autocomplete="off"></label>
<label>Password<input name="pass" type="password" autocomplete="off"></label><button>Sign in</button></form>`));
  }
  if (path === '/sql' && req.method === 'POST') {
    const form = new URLSearchParams(await readBody(req));
    const user = form.get('user') ?? '';
    const pass = form.get('pass') ?? '';
    const sql = `SELECT * FROM users WHERE name = '${user}' AND pass = '${pass}'`; // vulnerable on purpose
    let message;
    try {
      const row = db.prepare(sql).get();
      if (!row) message = `<p class="err">Invalid username or password.</p>`;
      else if (row.name === 'admin') message = `<p>Signed in as <code>admin</code>.</p><p class="flag">${esc(row.note)}</p>`;
      else message = `<p>Signed in as <code>${esc(row.name)}</code>. ${esc(row.note)}</p>`;
    } catch (e) {
      message = `<p class="err">Database error: ${esc(e.message)}</p><p><small>query: <code>${esc(sql)}</code></small></p>`;
    }
    return send(res, 200, page('Harbor login', `<h1>Harbor staff login</h1>${message}<p><a href="/sql">back</a></p>`));
  }

  // --- Token Trouble: a JWT verifier that trusts the alg in the header
  if (path === '/jwt') {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ user: 'guest' }));
    const sig = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
    return send(res, 200, page('API', `<h1>Harbor API</h1><p>Your guest token:</p><p class="flag" style="color:#cfeadf">${header}.${payload}.${sig}</p>
<p>Send it as <code>Authorization: Bearer &lt;token&gt;</code> to <a href="/jwt/admin">/jwt/admin</a>.</p>`));
  }
  if (path === '/jwt/admin') {
    const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
    if (!m) return send(res, 401, JSON.stringify({ error: 'missing bearer token' }), 'application/json');
    const parts = m[1].split('.');
    if (parts.length < 2) return send(res, 400, JSON.stringify({ error: 'malformed token' }), 'application/json');
    try {
      const head = JSON.parse(fromB64url(parts[0]).toString());
      const body = JSON.parse(fromB64url(parts[1]).toString());
      // VULNERABLE: the algorithm is taken from the (attacker-controlled) token header.
      if (head.alg === 'none') {
        /* no signature check */
      } else if (head.alg === 'HS256') {
        const expected = createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
        const given = fromB64url(parts[2] || '');
        if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
          return send(res, 401, JSON.stringify({ error: 'bad signature' }), 'application/json');
        }
      } else {
        return send(res, 400, JSON.stringify({ error: 'unsupported alg' }), 'application/json');
      }
      if (body.user === 'admin') return send(res, 200, JSON.stringify({ user: 'admin', flag: FLAGS.jwt }), 'application/json');
      return send(res, 403, JSON.stringify({ error: 'admins only', you: body.user ?? null }), 'application/json');
    } catch {
      return send(res, 400, JSON.stringify({ error: 'invalid token' }), 'application/json');
    }
  }

  return send(res, 404, page('Not found', `<h1>404</h1><p>No such page.</p>`));
}

createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 500, page('Error', '<h1>500</h1><p>Something went wrong.</p>'));
  });
}).listen(PORT, HOST, () => {
  console.log(`FlagForge challenge host on http://${HOST}:${PORT}  (intentionally vulnerable; keep it off untrusted networks)`);
});
