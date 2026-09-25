// Signing up, logging in and everything the account routes answer with — against a REAL server
// process, on its own port with its own throwaway accounts file (never data.json).
//   node tools/authscan.js
// This is the scan that would have caught build 42's broken signup: the rank view on an account
// called helpers server.js never had, so every signup and login came back "Something went wrong".
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8479;
const DATA = path.join(os.tmpdir(), `ms-authscan-${process.pid}.json`);
const ROOT = path.join(__dirname, '..');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(route, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* left null on purpose: a crash answers with HTML */ }
  return { status: res.status, json, text };
}

const log = [];
let child = null;
function start() {
  child = spawn(process.execPath, ['server.js', String(PORT)], {
    cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
}
async function waitUp() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`); if (r.ok) return true; } catch (e) { /* not up yet */ }
    await sleep(100);
  }
  return false;
}
async function stop() {
  if (!child) return;
  const dead = new Promise((r) => child.once('exit', r));
  child.kill(); await dead; child = null;
  await sleep(200);
}
const done = () => { try { if (child) child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} };

(async () => {
  start();
  process.on('exit', done);
  const up = await waitUp();
  check('the server starts', up);
  if (!up) { console.log(log.join('')); done(); process.exit(1); }

  const name = 'scanuser', pass = 'a-good-long-password-42';
  console.log('signing up');
  const su = await post('/auth/signup', { username: name, password: pass, club: 'germany' });
  check('signing up answers 200', su.status === 200, { status: su.status, body: su.text.slice(0, 120) });
  check('and it worked', !!(su.json && su.json.ok), su.json);
  check('with a token to play with', !!(su.json && su.json.token));
  check('the account carries a rank straight away', !!(su.json && su.json.rank && su.json.rank.tier === 'bronze'), su.json && su.json.rank);
  check('a season with an end date', !!(su.json && su.json.rank && su.json.rank.ends > Date.now()), su.json && su.json.rank && new Date(su.json.rank.ends).toISOString().slice(0, 10));
  check('and the World Cup run it needs', !!(su.json && su.json.wc && su.json.pwc));
  const token = su.json && su.json.token;

  console.log('the rules on the way in');
  const taken = await post('/auth/signup', { username: name.toUpperCase(), password: pass, club: 'germany' });
  check('the same name twice is refused, nicely', taken.json && taken.json.ok === false && /taken/i.test(taken.json.msg || ''), taken.json);
  const noClub = await post('/auth/signup', { username: 'scanuser2', password: pass, club: 'nowhere' });
  check('a country you must pick', noClub.json && noClub.json.ok === false && /country/i.test(noClub.json.msg || ''), noClub.json);
  const shortPass = await post('/auth/signup', { username: 'scanuser3', password: 'abc', club: 'germany' });
  check('a password that is too short', shortPass.json && shortPass.json.ok === false && !!shortPass.json.msg, shortPass.json);
  check('and never a bare "something went wrong"', ![taken, noClub, shortPass].some((r) => r.status === 500 || (r.json && /something went wrong/i.test(r.json.msg || ''))));

  console.log('coming back');
  const wrong = await post('/auth/login', { username: name, password: 'not-the-password' });
  check('the wrong password is refused', wrong.json && wrong.json.ok === false && /wrong password/i.test(wrong.json.msg || ''), wrong.json);
  const missing = await post('/auth/login', { username: 'neverexisted', password: pass });
  check('a name nobody has is refused', missing.json && missing.json.ok === false && /no account/i.test(missing.json.msg || ''), missing.json);
  const back0 = await post('/auth/login', { username: name, password: pass });
  const li = back0;
  check('logging in answers 200', li.status === 200, { status: li.status, body: li.text.slice(0, 120) });
  check('and it worked', !!(li.json && li.json.ok), li.json);
  check('the rank comes back with it', !!(li.json && li.json.rank && typeof li.json.rank.rp === 'number'), li.json && li.json.rank);
  check('so does the save', !!(li.json && li.json.save));

  console.log('who am i');
  const me = await post('/me', { token });
  check('/api/me answers with the account', me.status === 200 && !!(me.json && me.json.ok && me.json.rank), { status: me.status, rank: me.json && me.json.rank });
  const bad = await post('/me', { token: 'not-a-real-token' });
  check('a made-up token gets nothing', bad.status === 401, bad.status);

  console.log('every other route answers too');
  const league = await fetch(`http://127.0.0.1:${PORT}/api/league`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('the league table comes back', league.status === 200, league.status);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/api/health`)).json();
  check('health says which build and where the accounts live', health.ok && typeof health.build === 'number' && !!health.storage, health);
  const nothing = await post('/not-a-route', { token });
  check('a route that is not there is a clean 404, not a crash', nothing.status === 404, nothing.status);

  console.log('a season that ended while you were away');
  // put last season on the account, restart the server, and see what logging in pays
  const { createSim } = require('../server/sim');
  const prize = createSim().rankTier(900).reward; // 900 points is where this account finished
  const coinsBefore = back0.json.save.coins;
  await sleep(700); // the server writes the accounts file a moment after a change
  await stop();
  const file = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const thisSeason = back0.json.rank.season;
  file.users[name].rank = { season: thisSeason - 1, rp: 900, best: 900, owed: 0, last: null, wins: 8, played: 12 };
  fs.writeFileSync(DATA, JSON.stringify(file));
  start();
  check('the server comes back up', await waitUp());
  const paid = await post('/auth/login', { username: name, password: pass });
  check('logging in pays out the season you finished', !!(paid.json && paid.json.ok && paid.json.save.coins === coinsBefore + prize), paid.json && { coins: paid.json.save.coins, was: coinsBefore, prize });
  check('the new season starts you part way down, not at zero', !!(paid.json && paid.json.rank.rp === 360 && paid.json.rank.season === thisSeason), paid.json && paid.json.rank);
  check('and your best is remembered', !!(paid.json && paid.json.rank.best === 900), paid.json && paid.json.rank.best);
  const twice = await post('/auth/login', { username: name, password: pass });
  check('and it only pays once, however often you come back', !!(twice.json && twice.json.save.coins === coinsBefore + prize), twice.json && twice.json.save.coins);

  console.log('saving and leaving');
  const save = await post('/save', { token, save: { coins: 120, xp: 300, trophies: 1, matches: 2, wins: 1, goals: 3 } });
  check('progress saves', !!(save.json && save.json.ok && save.json.save.coins === 120), save.json && save.json.save);
  const out = await post('/logout', { token });
  check('logging out works', out.status === 200 && !!(out.json && out.json.ok), out.status);
  const after = await post('/me', { token });
  check('and the token is dead afterwards', after.status === 401, after.status);
  const back = await post('/auth/login', { username: name, password: pass });
  check('the progress was kept', !!(back.json && back.json.ok && back.json.save.coins >= 120), back.json && back.json.save);
  const del = await post('/account/delete', { token: back.json.token, password: pass });
  check('an account can be deleted', !!(del.json && del.json.ok), del.json);
  const gone = await post('/auth/login', { username: name, password: pass });
  check('and is really gone', gone.json && gone.json.ok === false && /no account/i.test(gone.json.msg || ''), gone.json);

  const crashed = log.join('').match(/request failed:.*/g);
  check('the server never threw once', !crashed, crashed && crashed.slice(0, 3));

  done();
  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
