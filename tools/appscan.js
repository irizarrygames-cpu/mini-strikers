// The server, as seen from inside a store app. Real server process, throwaway data file.
//   node tools/appscan.js
//
// A wrapped app holds the game's files itself, so every request to the server comes from another
// origin (capacitor://localhost on iPhone, https://localhost on Android) and the browser engine
// inside the app asks permission first. This checks the permission is given to the app and to
// nobody else, and that the plain web game - which sends no Origin header at all - is unchanged.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8493;
const DATA = path.join(os.tmpdir(), `ms-appscan-${process.pid}.json`);
const ROOT = path.join(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL0 = `http://127.0.0.1:${PORT}`;

async function req(method, route, { origin, body, headers } = {}) {
  const h = { 'X-Forwarded-For': '10.7.' + (Math.random() * 250 | 0) + '.' + (Math.random() * 250 | 0), ...(headers || {}) };
  if (origin) h.Origin = origin;
  if (body) h['Content-Type'] = 'application/json';
  const res = await fetch(URL0 + route, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* stays null */ }
  return { status: res.status, h: res.headers, json, text };
}

let child = null;
const log = [];
(async () => {
  child = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => log.push(String(d))); child.stderr.on('data', (d) => log.push(String(d)));
  process.on('exit', () => { try { child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} });
  let up = false;
  for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(URL0 + '/api/health')).ok; } catch (e) { await sleep(100); } }
  check('the server starts', up);

  console.log('the app\'s own origins are let in');
  for (const origin of ['capacitor://localhost', 'https://localhost', 'ionic://localhost']) {
    const r = await req('OPTIONS', '/api/auth/login', { origin, headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    check(`${origin}: the preflight is answered 204 and names the origin`, r.status === 204 && r.h.get('access-control-allow-origin') === origin && /content-type/i.test(r.h.get('access-control-allow-headers') || ''), { status: r.status, allow: r.h.get('access-control-allow-origin') });
  }
  let r = await req('POST', '/api/league', { origin: 'capacitor://localhost', body: {} });
  check('and a real request from the app can be read (it carries the allow header)', r.status === 200 && r.h.get('access-control-allow-origin') === 'capacitor://localhost' && r.json && r.json.ok, { status: r.status });
  r = await req('GET', '/api/health', { origin: 'https://localhost' });
  check('so can the health check the app uses to see the server is awake', r.status === 200 && r.h.get('access-control-allow-origin') === 'https://localhost' && r.json && r.json.ok === true);
  r = await req('POST', '/api/auth/signup', { origin: 'capacitor://localhost', body: { username: 'appscan1', password: 'a-good-long-password-42', club: 'germany' } });
  check('signing up from the app works', r.status === 200 && r.json && r.json.ok && !!r.json.token, r.json && { ok: r.json.ok, msg: r.json.msg });
  const token = r.json && r.json.token;
  r = await req('POST', '/api/me', { origin: 'capacitor://localhost', body: { token } });
  check('and so does being recognised afterwards', r.status === 200 && r.json && r.json.ok && r.json.name === 'APPSCAN1', r.json && r.json.name);

  console.log('nobody else is');
  for (const origin of ['https://evil.example', 'http://mini-strikers.onrender.com.evil.example', 'null', 'capacitor://evil', 'https://localhost.evil.example', 'http://localhost']) {
    r = await req('OPTIONS', '/api/auth/login', { origin, headers: { 'Access-Control-Request-Method': 'POST' } });
    check(`${origin}: the preflight is refused and gives no allow header`, r.status === 403 && !r.h.get('access-control-allow-origin'), { status: r.status });
  }
  r = await req('POST', '/api/league', { origin: 'https://evil.example', body: {} });
  check('a page on another site can send the request but is given no allow header, so it cannot read the answer', !r.h.get('access-control-allow-origin'));

  console.log('the plain web game is unchanged');
  r = await req('POST', '/api/league', { body: {} });
  check('a same-site request carries no Origin header, and gets no CORS headers', r.status === 200 && !r.h.get('access-control-allow-origin'));
  r = await req('GET', '/api/health');
  check('health still answers a plain GET', r.status === 200 && r.json && r.json.ok === true);
  r = await req('GET', '/api/league');
  check('and other GETs are still refused (405)', r.status === 405, r.status);
  r = await req('OPTIONS', '/api/auth/login');
  check('an OPTIONS with no origin is refused, not crashed on', r.status === 403, r.status);

  console.log('a developer\'s localhost (only without the real database)');
  r = await req('OPTIONS', '/api/auth/login', { origin: 'http://localhost:8450', headers: { 'Access-Control-Request-Method': 'POST' } });
  check('http://localhost:PORT is let in on a laptop', r.status === 204 && r.h.get('access-control-allow-origin') === 'http://localhost:8450', r.status);

  const errs = log.join('').split('\n').filter((l) => /uncaught|unhandled|TypeError|ReferenceError/i.test(l));
  check('the server never threw once', errs.length === 0, errs.slice(0, 3));
  console.log(failures ? `\n${failures} FAILED` : '\nall app-origin checks passed');
  // Stop the server and let its connections close before leaving. Exiting while they were still
  // closing could trip a libuv assertion on Windows (exit 127) after every check had passed.
  await new Promise((r) => { if (child.exitCode !== null) return r(); child.once('exit', r); try { child.kill(); } catch (e) { r(); } });
  await new Promise((r) => setTimeout(r, 150));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); console.log(log.join('').slice(-1200)); process.exit(1); });
