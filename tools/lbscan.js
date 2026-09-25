// The ranked leaderboard, against a REAL server process with its own throwaway accounts file.
//   node tools/lbscan.js
// The board is this season's rank points, best first, ties broken by wins then by name. Last
// season's points are not on it, nor is anyone on nothing. Your own row comes back even when you
// are miles down the list.
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8481;
const DATA = path.join(os.tmpdir(), `ms-lbscan-${process.pid}.json`);
const ROOT = path.join(__dirname, '..');
const { createSim } = require('../server/sim');
const sim = createSim();
const SEASON = sim.seasonNow();
const ITERATIONS = 150000; // the same as server.js

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (password, salt) => new Promise((res, rej) => crypto.pbkdf2(password, salt, ITERATIONS, 32, 'sha256', (e, k) => (e ? rej(e) : res(k.toString('base64')))));

async function post(route, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* a crash answers with something else */ }
  return { status: res.status, json, text };
}

(async () => {
  // a seeded ladder: eight with points this season, one from last season, one on nothing
  const PASS = 'lbscan-password-42';
  const salt = crypto.randomBytes(16).toString('base64');
  const h = await hash(PASS, salt);
  const users = {};
  const add = (id, club, rank) => { users[id] = { name: id.toUpperCase(), hash: h, salt, iterations: ITERATIONS, created: Date.now(), club, save: { coins: 0, xp: 0 }, online: null, rank }; };
  const season = (rp, wins = 0, played = 0) => ({ season: SEASON, rp, best: rp, owed: 0, last: null, wins, played });
  add('lbtop', 'brazil', season(900, 40, 60));       // legend
  add('lbtwo', 'spain', season(310, 20, 30));        // platinum
  add('lbthree', 'japan', season(160, 12, 20));      // gold
  add('lbfour', 'italy', season(70, 6, 10));         // silver
  add('lbfive', 'france', season(20, 2, 4));         // bronze
  add('lbsix', 'england', season(20, 5, 9));         // same points, more wins: above lbfive
  add('lbseven', 'mexico', season(20, 5, 9));        // same points and wins: alphabetical
  add('lbme', 'ghana', season(10, 1, 3));            // bottom of the board, and it is us
  add('lbold', 'chile', { season: SEASON - 1, rp: 5000, best: 5000, owed: 0, last: 'legend', wins: 99, played: 99 });
  add('lbzero', 'peru', season(0, 0, 4));
  fs.writeFileSync(DATA, JSON.stringify({ users }));

  const log = [];
  const child = spawn(process.execPath, ['server.js', String(PORT)], {
    cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
  const done = () => { try { child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} };
  process.on('exit', done);
  let up = false;
  for (let i = 0; i < 100 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`); up = r.ok; } catch (e) { await sleep(100); } }
  check('the server starts on the seeded accounts', up);
  if (!up) { console.log(log.join('')); done(); process.exit(1); }

  console.log('the board');
  const r = (await post('/leaderboard', {})).json;
  check('it answers', !!(r && r.ok), r);
  check('it says how many are on it', r.players === 8, { players: r.players, expected: 8 });
  check('and which season, and when it ends', r.season === SEASON && r.ends > Date.now());
  const names = r.top.map((x) => x.name);
  check('best first', names.join(',') === 'LBTOP,LBTWO,LBTHREE,LBFOUR,LBSEVEN,LBSIX,LBFIVE,LBME', names);
  check('the positions are 1, 2, 3…', r.top.every((x, i) => x.pos === i + 1));
  check('level on points, more wins goes above', names.indexOf('LBSIX') < names.indexOf('LBFIVE'));
  check('level on points and wins, alphabetical (LBSEVEN before LBSIX)', names.indexOf('LBSEVEN') < names.indexOf('LBSIX') && names.indexOf('LBSIX') < names.indexOf('LBFIVE'), names);
  check('last season is not on this board', !names.includes('LBOLD'));
  check('nor is anyone on nothing', !names.includes('LBZERO'));
  const top = r.top[0];
  check('each row carries the points, the tier and the country', top.rp === 900 && top.tier === 'legend' && top.tierName === 'LEGEND' && top.club === 'brazil', top);
  check('and how they have done', top.wins === 40 && top.played === 60, { wins: top.wins, played: top.played });
  check('nobody is asked to be signed in for it', r.you === null, r.you);

  console.log('your own row');
  const li = (await post('/auth/login', { username: 'lbme', password: PASS })).json;
  check('logging in as someone on the board', !!(li && li.ok && li.token), li && li.msg);
  const mine = (await post('/leaderboard', { token: li.token })).json;
  check('the board comes back with your row on it', !!(mine.you && mine.you.name === 'LBME'), mine.you);
  check('with your real position', mine.you.pos === 8 && mine.you.rp === 10, mine.you);
  const short = (await post('/leaderboard', { token: li.token, limit: 3 })).json;
  check('a shorter board still finds you below it', short.top.length === 3 && short.you.pos === 8, { top: short.top.length, you: short.you && short.you.pos });
  check('and the top of it is the same', short.top[0].name === 'LBTOP');

  console.log('someone with no points yet');
  const su = (await post('/auth/signup', { username: 'lbnew', password: PASS, club: 'germany' })).json;
  check('a brand new account can sign up', !!(su && su.ok), su && su.msg);
  const fresh = (await post('/leaderboard', { token: su.token })).json;
  check('they are not on the board', !fresh.top.some((x) => x.name === 'LBNEW'));
  check('and are told they have no row rather than a wrong one', fresh.you === null, fresh.you);

  console.log('the limits');
  const big = (await post('/leaderboard', { limit: 9999 })).json;
  check('a silly limit is capped, not obeyed', big.top.length === 8, big.top.length);
  const rubbish = (await post('/leaderboard', { limit: 'lots' })).json;
  check('rubbish in place of a limit still works', !!(rubbish && rubbish.ok && rubbish.top.length === 8));
  const crashed = log.join('').match(/request failed:.*/g);
  check('the server never threw', !crashed, crashed && crashed.slice(0, 2));

  done();
  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
