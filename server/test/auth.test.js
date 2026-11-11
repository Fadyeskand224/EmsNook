import './env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../app.js';

// The login system, tested the way an attacker and a forgetful reader would use it.
let dev; let prod; let lim; let db;
const open = (app) => new Promise((res) => { const s = http.createServer(app).listen(0, () => res({ s, base: `http://127.0.0.1:${s.address().port}` })); });
before(async () => {
  db = await openDb({ url: ':memory:' });
  dev = await open(createApp({ db, limits: { auth: 1000, signup: 1000 } }));
  prod = await open(createApp({ db, prod: true, limits: { auth: 1000, signup: 1000 } }));
  lim = await open(createApp({ db, limits: { auth: 4, signup: 2 } }));
});
after(() => { dev.s.close(); prod.s.close(); lim.s.close(); db.close(); });

const PW = 'tea-and-dragons-42';
async function call(srv, path, { method = 'GET', body, cookie, origin = srv.base, headers = {}, raw } = {}) {
  const res = await fetch(`${srv.base}/api${path}`, {
    method,
    headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null), setCookie, cookie: setCookie.split(';')[0] };
}
const signup = (srv, email, over = {}) => call(srv, '/auth/signup', { method: 'POST', body: { name: 'Reader One', email, password: PW, ...over } });
const login = (srv, email, password = PW, extra = {}) => call(srv, '/auth/login', { method: 'POST', body: { email, password }, ...extra });

test('signing up creates an account, a session, and never reveals the password hash', async () => {
  const r = await signup(dev, 'new@example.com');
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.json.user).sort(), ['email', 'id', 'name']);
  assert.match(r.setCookie, /HttpOnly/i);
  assert.match(r.setCookie, /SameSite=Lax/i);
  assert.match(r.setCookie, /Path=\//);
  const me = await call(dev, '/auth/me', { cookie: r.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, 'new@example.com');
  assert.ok(!JSON.stringify(me.json).includes('scrypt'));
});

test('passwords and sessions are stored only as hashes', async () => {
  const r = await signup(dev, 'hashes@example.com');
  const row = await db.get('SELECT password_hash FROM users WHERE email = ?', ['hashes@example.com']);
  assert.ok(row.password_hash.startsWith('scrypt$'));
  assert.ok(!row.password_hash.includes(PW));
  const token = decodeURIComponent(r.cookie.split('=')[1]);
  const sessions = await db.all('SELECT token_hash FROM sessions');
  assert.ok(sessions.length > 0 && sessions.every((s) => s.token_hash !== token && s.token_hash.length === 64));
});

test('production cookies are __Host- prefixed, Secure, HttpOnly and host-only, and the security headers are set', async () => {
  const https = { 'x-forwarded-proto': 'https' };
  const origin = prod.base.replace('http:', 'https:');
  const r = await call(prod, '/auth/signup', { method: 'POST', body: { name: 'Prod', email: 'prod@example.com', password: PW }, headers: https, origin });
  assert.equal(r.status, 201);
  assert.match(r.setCookie, /^__Host-sid=/);
  assert.match(r.setCookie, /;\s*Secure/i);
  assert.match(r.setCookie, /HttpOnly/i);
  assert.doesNotMatch(r.setCookie, /Domain=/i);
  const h = r.headers;
  assert.match(h.get('strict-transport-security'), /max-age=\d+/);
  assert.match(h.get('content-security-policy'), /default-src 'self'/);
  assert.match(h.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.equal(h.get('x-powered-by'), null);
  assert.match(h.get('permissions-policy'), /camera=\(self\)/);
  assert.match(h.get('permissions-policy'), /microphone=\(\)/);
  assert.equal(h.get('cache-control'), 'no-store');
});

test('bad emails, short or common passwords, and passwords containing the email are refused', async () => {
  assert.equal((await signup(dev, 'nope')).status, 400);
  assert.equal((await signup(dev, 'a@b.co', { password: 'short' })).status, 400);
  assert.equal((await signup(dev, 'c@example.com', { password: 'password123' })).status, 400);
  assert.equal((await signup(dev, 'sam.reader@example.com', { password: 'sam.reader-2024' })).status, 400);
  assert.equal((await signup(dev, 'd@example.com', { name: '' })).status, 400);
  assert.equal((await signup(dev, 'e@example.com', { password: 'x'.repeat(129) })).status, 400);
  assert.equal((await call(dev, '/auth/signup', { method: 'POST', body: { name: 'A', email: ['x@y.zz'], password: PW } })).status, 400);
});

test('an email can only be used once, whatever its capitals', async () => {
  assert.equal((await signup(dev, 'Dupe@Example.com')).status, 201);
  assert.equal((await signup(dev, 'dupe@example.com')).status, 409);
  assert.equal((await login(dev, 'DUPE@EXAMPLE.COM')).status, 200);
});

test('login gives each visit a brand-new session, and wrong guesses all look the same', async () => {
  await signup(dev, 'login@example.com');
  const a = await login(dev, 'login@example.com');
  const b = await login(dev, 'login@example.com');
  assert.equal(a.status, 200);
  assert.notEqual(a.cookie, b.cookie);
  const wrong = await login(dev, 'login@example.com', 'not-the-password-1');
  const unknown = await login(dev, 'ghost@example.com', 'not-the-password-1');
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.json, unknown.json); // no hint which emails have accounts
  assert.equal(wrong.cookie, '');
  assert.equal((await call(dev, '/auth/login', { method: 'POST', body: { email: { $ne: '' }, password: PW } })).status, 400); // no operator injection
});

test('five wrong passwords lock the account for a while, even against the right password, and unknown emails lock the same way', async () => {
  await signup(dev, 'lock@example.com');
  for (let i = 0; i < 5; i++) assert.equal((await login(dev, 'lock@example.com', `wrong-guess-${i}`)).status, 401);
  assert.equal((await login(dev, 'lock@example.com')).status, 429);
  for (let i = 0; i < 5; i++) await login(dev, 'nobody-here@example.com', `wrong-guess-${i}`);
  assert.equal((await login(dev, 'nobody-here@example.com')).status, 429);
});

test('logging out ends the session on the server, not just in the browser', async () => {
  const r = await signup(dev, 'bye@example.com');
  assert.equal((await call(dev, '/auth/me', { cookie: r.cookie })).status, 200);
  const out = await call(dev, '/auth/logout', { method: 'POST', cookie: r.cookie });
  assert.equal(out.status, 200);
  assert.equal((await call(dev, '/auth/me', { cookie: r.cookie })).status, 401); // the old cookie is dead
});

test('forged, truncated and oversized session cookies are rejected', async () => {
  for (const c of ['sid=', 'sid=abc', `sid=${'a'.repeat(43)}`, `sid=${'a'.repeat(5000)}`, 'sid=%E0%A4%A', 'other=1']) {
    const r = await call(dev, '/auth/me', { cookie: c });
    assert.equal(r.status, 401, c.slice(0, 20));
  }
  assert.equal((await call(dev, '/library')).status, 401);
});

test('changing the password checks the old one, signs out every other device and keeps this one', async () => {
  const first = await signup(dev, 'change@example.com');
  const other = await login(dev, 'change@example.com');
  assert.equal((await call(dev, '/auth/password', { method: 'POST', cookie: first.cookie, body: { currentPassword: 'wrong-current-1', newPassword: 'a-brand-new-pass-9' } })).status, 401);
  assert.equal((await call(dev, '/auth/password', { method: 'POST', cookie: first.cookie, body: { currentPassword: PW, newPassword: 'short' } })).status, 400);
  const ok = await call(dev, '/auth/password', { method: 'POST', cookie: first.cookie, body: { currentPassword: PW, newPassword: 'a-brand-new-pass-9' } });
  assert.equal(ok.status, 200);
  assert.equal((await call(dev, '/auth/me', { cookie: other.cookie })).status, 401);
  assert.equal((await call(dev, '/auth/me', { cookie: first.cookie })).status, 401); // the old token is replaced…
  assert.equal((await call(dev, '/auth/me', { cookie: ok.cookie })).status, 200); // …by a fresh one
  assert.equal((await login(dev, 'change@example.com', PW)).status, 401);
  assert.equal((await login(dev, 'change@example.com', 'a-brand-new-pass-9')).status, 200);
});

test('deleting an account needs the password and removes everything', async () => {
  const r = await signup(dev, 'gone@example.com');
  assert.equal((await call(dev, '/auth/account', { method: 'DELETE', cookie: r.cookie, body: { password: 'wrong-password-1' } })).status, 401);
  assert.equal((await call(dev, '/auth/account', { method: 'DELETE', cookie: r.cookie, body: {} })).status, 401);
  assert.equal((await call(dev, '/auth/account', { method: 'DELETE', cookie: r.cookie, body: { password: PW } })).status, 200);
  assert.equal((await call(dev, '/auth/me', { cookie: r.cookie })).status, 401);
  assert.equal((await login(dev, 'gone@example.com')).status, 401);
  assert.equal(await db.get('SELECT 1 AS x FROM users WHERE email = ?', ['gone@example.com']), undefined);
});

test('requests from other sites cannot change anything (CSRF)', async () => {
  const r = await signup(dev, 'csrf@example.com');
  assert.equal((await call(dev, '/auth/logout', { method: 'POST', cookie: r.cookie, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(dev, '/auth/logout', { method: 'POST', cookie: r.cookie, origin: null })).status, 403); // no Origin and no same-origin hint
  assert.equal((await call(dev, '/auth/login', { method: 'POST', body: { email: 'csrf@example.com', password: PW }, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(dev, '/auth/me', { cookie: r.cookie })).status, 200); // still signed in
});

test('malformed or giant bodies are refused politely, with no stack traces', async () => {
  const bad = await call(dev, '/auth/login', { method: 'POST', raw: '{"email": ' });
  assert.equal(bad.status, 400);
  assert.ok(!JSON.stringify(bad.json).includes('at '));
  const big = await call(dev, '/auth/login', { method: 'POST', raw: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(40000) }) });
  assert.equal(big.status, 400);
  assert.equal((await call(dev, '/nothing-here')).status, 404);
});

test('the data export never contains a password hash', async () => {
  const r = await signup(dev, 'export@example.com');
  const out = await call(dev, '/auth/export', { cookie: r.cookie });
  assert.equal(out.status, 200);
  assert.ok(!JSON.stringify(out.json).toLowerCase().includes('scrypt'));
  assert.ok(!JSON.stringify(out.json).includes('password'));
});

test('too many requests from one place are slowed down (sign-ups and logins)', async () => {
  assert.equal((await signup(lim, 'l1@example.com')).status, 201);
  assert.equal((await signup(lim, 'l2@example.com')).status, 201);
  assert.equal((await signup(lim, 'l3@example.com')).status, 429);
  let last;
  for (let i = 0; i < 6; i++) last = await login(lim, 'l1@example.com', 'definitely-wrong-1');
  assert.equal(last.status, 429);
});
