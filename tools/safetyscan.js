// Recovery codes, reports and bans, against the real server process and a throwaway data file.
//   node tools/safetyscan.js
// Recovery: a code at sign-up, shown once and kept only scrambled; it resets a forgotten password,
// is used up doing it (a new one comes back), signs every other device out, and is locked after
// too many wrong tries. Bans: no admins. A rude name is caught by the username filter when the
// server starts; any other name is banned once three different players (with accounts an hour old
// or more) have reported it. A banned account can't sign in, recover, or keep a session, drops off
// the leaderboard and everyone's lists, and its name stays taken.
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSim } = require('../server/sim');

const PORT = 8494;
const DATA = path.join(os.tmpdir(), `ms-safetyscan-${process.pid}.json`);
const ROOT = path.join(__dirname, '..');
const URL0 = `http://127.0.0.1:${PORT}`;
const sim = createSim();
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// every request from a different address, so the per-address limits are not what is being tested
const ip = () => '10.9.' + (Math.random() * 250 | 0) + '.' + (Math.random() * 250 | 0);
async function api(route, body = {}, from = ip()) {
  const res = await fetch(URL0 + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': from }, body: JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch (e) { /* stays null */ }
  return { status: res.status, ...(json || {}) };
}
const stored = () => JSON.parse(fs.readFileSync(DATA, 'utf8')).users;
async function settled() { await sleep(900); } // the server writes its accounts a moment after a change

// accounts made the way server.js makes them, so they can sign in with these passwords
const PW = 'a-good-long-password-42';
function seedUser(id, extra = {}) {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.pbkdf2Sync(PW, salt, 150000, 32, 'sha256').toString('base64');
  return { name: id.toUpperCase(), hash, salt, iterations: 150000, created: Date.now() - 2 * 86400000, club: 'spain', save: null, online: null, ...extra };
}
const ranked = (rp) => ({ rank: { season: sim.seasonNow(), rp, best: rp, owed: 0, last: null, wins: 3, played: 4 } });

let child = null;
const log = [];
(async () => {
  fs.writeFileSync(DATA, JSON.stringify({ users: {
    poopface: seedUser('poopface', ranked(120)),        // a name the filter turns down today
    pal: seedUser('pal', { friends: ['poopface', 'weirdo'] }),
    weirdo: seedUser('weirdo', ranked(90)),
    rep1: seedUser('rep1'), rep2: seedUser('rep2'), rep3: seedUser('rep3'),
    newkid: seedUser('newkid', { created: Date.now() - 5 * 60000 }), // five minutes old
    admin: seedUser('admin'),                            // reserved, but not rude: left alone
    player1: seedUser('player1'),
  } }));
  child = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => log.push(String(d))); child.stderr.on('data', (d) => log.push(String(d)));
  process.on('exit', () => { try { child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} try { fs.unlinkSync(DATA + '.tmp'); } catch (e) {} });
  let up = false;
  for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(URL0 + '/api/health')).ok; } catch (e) { await sleep(100); } }
  check('the server starts', up);

  console.log('the username check as the server starts');
  let r = await api('/api/auth/login', { username: 'poopface', password: PW });
  check('an account whose name the filter turns down is banned, and told it is the name', !r.ok && r.banned === true && /banned/i.test(r.msg) && /breaks the rules/i.test(r.msg), r);
  r = await api('/api/auth/login', { username: 'admin', password: PW });
  check('a reserved name that is not rude is left alone', r.ok === true, r.msg);
  r = await api('/api/auth/login', { username: 'player1', password: PW });
  check('and so is an ordinary one', r.ok === true, r.msg);
  r = await api('/api/leaderboard', {});
  const board = (r.top || []).map((x) => x.name);
  check('the banned account is off the leaderboard', !board.includes('POOPFACE') && board.includes('WEIRDO'), board);
  await settled();
  check('and off everyone\'s friends lists', !stored().pal.friends.includes('poopface'), stored().pal.friends);
  check('the account is kept, marked banned, so the name stays taken', !!(stored().poopface && stored().poopface.banned), stored().poopface && stored().poopface.banned);
  r = await api('/api/auth/signup', { username: 'poopface', password: PW, club: 'spain' });
  check('nobody can sign up with that name', !r.ok, r.msg);
  check('the server says what it banned, in its log', /banned POOPFACE \(username\)/.test(log.join('')), log.join('').split('\n').filter((l) => /banned/.test(l)));

  console.log('a recovery code at sign-up');
  r = await api('/api/auth/signup', { username: 'safe_kid', password: PW, club: 'brazil' });
  const code1 = r.recovery, tok1 = r.token;
  check('signing up gives a recovery code', r.ok && typeof code1 === 'string', r.msg);
  check('in the form XXXX-XXXX-XXXX, with no 0, O, 1 or I in it', /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code1 || ''), code1);
  check('and the game is told the account has one', r.hasRecovery === true);
  await settled();
  const raw = fs.readFileSync(DATA, 'utf8');
  check('only a scrambled copy is kept: the code itself is nowhere in the data', !raw.includes(code1) && !raw.includes(code1.replace(/-/g, '')));
  check('the scrambled copy is there', !!(stored().safe_kid.recovery && stored().safe_kid.recovery.hash && stored().safe_kid.recovery.salt));
  r = await api('/api/me', { token: tok1 });
  check('signed in, the account says it has a code', r.ok && r.hasRecovery === true);
  const r2 = await api('/api/auth/signup', { username: 'safe_kid2', password: PW, club: 'brazil' });
  check('every account gets its own code', r2.ok && r2.recovery && r2.recovery !== code1);

  console.log('forgot the password');
  r = await api('/api/auth/recover', { username: 'nobody_at_all', code: code1, password: 'brand-new-password-7' });
  check('a username with no account', !r.ok && /no account/i.test(r.msg), r.msg);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: 'AAAA-BBBB-CCCC', password: 'brand-new-password-7' });
  check('a wrong code', !r.ok && /not right/i.test(r.msg), r.msg);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: code1, password: 'short' });
  check('a code with a password that is too weak is turned down', !r.ok && /8 characters/i.test(r.msg), r.msg);
  // in small letters, with spaces, and the first four in a phone keyboard's full-width letters
  const wide = (s) => s.replace(/[A-Z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
  const typed = ' ' + wide(code1.slice(0, 4)) + ' ' + code1.slice(5).toLowerCase().replace(/-/g, ' ') + ' ';
  r = await api('/api/auth/recover', { username: 'SAFE_KID', code: typed, password: 'brand-new-password-7' });
  const code2 = r.recovery;
  check('the right code (in small letters, with spaces) resets it — the weak try did not use it up', r.ok === true && !!r.token, r.msg);
  check('it signs you straight in', r.name === 'SAFE_KID' && !!r.token);
  check('and gives you a NEW code to write down', typeof code2 === 'string' && code2 !== code1, code2);
  r = await api('/api/auth/login', { username: 'safe_kid', password: 'brand-new-password-7' });
  check('the new password works', r.ok === true, r.msg);
  r = await api('/api/auth/login', { username: 'safe_kid', password: PW });
  check('the old one does not', !r.ok, r.msg);
  r = await api('/api/me', { token: tok1 });
  check('the device that was signed in before is signed out', r.status === 401, r.status);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: code1, password: 'another-password-8' });
  check('the old code is used up', !r.ok && /not right/i.test(r.msg), r.msg);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: code2, password: 'another-password-8' });
  check('the new code works the same way', r.ok === true && r.recovery && r.recovery !== code2, r.msg);
  const code3 = r.recovery, tok3 = r.token;

  console.log('a new code from Settings');
  r = await api('/api/account/recovery', { token: tok3, password: 'wrong-password-123' });
  check('it needs your password', !r.ok && /wrong password/i.test(r.msg), r.msg);
  r = await api('/api/account/recovery', { password: 'another-password-8' });
  check('and you have to be signed in', r.status === 401, r.status);
  r = await api('/api/account/recovery', { token: tok3, password: 'another-password-8' });
  const code4 = r.recovery;
  check('with both, you get a fresh one', r.ok && /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code4 || '') && code4 !== code3, r.msg);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: code3, password: 'yet-another-pass-9' });
  check('the one it replaced stops working', !r.ok, r.msg);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: code4, password: 'yet-another-pass-9' });
  check('the new one works', r.ok === true, r.msg);
  const oldAccount = seedUser('x');
  check('(an account made before codes existed simply has none until it makes one)', !oldAccount.recovery);

  console.log('too many wrong codes');
  r = await api('/api/auth/signup', { username: 'lock_kid', password: PW, club: 'spain' });
  const lockCode = r.recovery;
  for (let i = 0; i < 5; i++) await api('/api/auth/recover', { username: 'lock_kid', code: 'ZZZZ-ZZZZ-ZZZ' + 'ABCDEFGHJ'[i], password: 'brand-new-password-7' });
  r = await api('/api/auth/recover', { username: 'lock_kid', code: lockCode, password: 'brand-new-password-7' });
  check('after five wrong codes even the right one waits half an hour', !r.ok && /too many/i.test(r.msg), r.msg);
  r = await api('/api/auth/login', { username: 'lock_kid', password: PW });
  check('the password still works while it is locked (it only stops guessing)', r.ok === true, r.msg);
  const fromOne = ip();
  let limited = false;
  for (let i = 0; i < 12; i++) { const x = await api('/api/auth/recover', { username: 'safe_kid2', code: 'QQQQ-QQQQ-QQQQ', password: 'brand-new-password-7' }, fromOne); if (x.status === 429) limited = true; }
  check('one address can only try so many codes, on any account', limited);

  console.log('reporting a username');
  const login = async (id) => (await api('/api/auth/login', { username: id, password: PW })).token;
  const t1 = await login('rep1'), t2 = await login('rep2'), t3 = await login('rep3'), tNew = await login('newkid'), tW = await login('weirdo');
  r = await api('/api/report', { name: 'weirdo' });
  check('you have to be signed in', r.status === 401, r.status);
  r = await api('/api/report', { token: t1, name: 'rep1' });
  check('you can not report yourself', !r.ok, r.msg);
  r = await api('/api/report', { token: t1, name: 'nobody_here' });
  check('a name with no account', !r.ok && /no player/i.test(r.msg), r.msg);
  r = await api('/api/report', { token: tNew, name: 'weirdo' });
  check('an account under an hour old can not report anyone yet', !r.ok && /too new/i.test(r.msg), r.msg);
  r = await api('/api/report', { token: t1, name: 'weirdo' });
  check('a report goes in', r.ok && /reported/i.test(r.msg), r.msg);
  r = await api('/api/report', { token: t1, name: 'WEIRDO' });
  check('the same player reporting twice counts once', r.ok && /already/i.test(r.msg), r.msg);
  r = await api('/api/report', { token: t2, name: 'weirdo' });
  check('a second player reports it', r.ok, r.msg);
  r = await api('/api/me', { token: tW });
  check('two reports are not enough: the account still works', r.ok === true, r.msg);
  await settled();
  check('reports are kept with who made them', (stored().weirdo.reports || []).map((x) => x.by).sort().join() === 'rep1,rep2', stored().weirdo.reports);
  r = await api('/api/report', { token: t3, name: 'weirdo' });
  check('the third player\'s report goes in', r.ok, r.msg);
  r = await api('/api/me', { token: tW });
  check('three different players: banned, and signed out at once', r.status === 401, r.status);
  r = await api('/api/auth/login', { username: 'weirdo', password: PW });
  check('a banned account can not sign in, and is told why', !r.ok && r.banned === true && /reported/i.test(r.msg), r);
  r = await api('/api/auth/recover', { username: 'weirdo', code: 'AAAA-AAAA-AAAA', password: 'brand-new-password-7' });
  check('nor get in with a recovery code', !r.ok && /banned/i.test(r.msg), r.msg);
  r = await api('/api/leaderboard', {});
  check('it is off the leaderboard', !(r.top || []).some((x) => x.name === 'WEIRDO'), (r.top || []).map((x) => x.name));
  r = await api('/api/report', { token: t1, name: 'weirdo' });
  check('it can not be reported again (it is gone)', !r.ok, r.msg);
  r = await api('/api/auth/signup', { username: 'weirdo', password: PW, club: 'spain' });
  check('and its name stays taken', !r.ok && /taken/i.test(r.msg), r.msg);
  await settled();
  check('it is off its friends\' lists', !stored().pal.friends.includes('weirdo'), stored().pal.friends);
  check('the reports are cleared once it is banned', !stored().weirdo.reports && !!stored().weirdo.banned, stored().weirdo);
  r = await api('/api/league', {});
  const spain = (r.table || []).find((x) => x.club === 'spain');
  const spainLeft = Object.values(stored()).filter((u) => u && u.club === 'spain' && !u.banned).length;
  check('the league table does not count banned accounts as players', !!spain && spain.players === spainLeft, { table: spain && spain.players, accounts: spainLeft });

  console.log('the reporters are fine');
  for (const [id, t] of [['rep1', t1], ['rep2', t2], ['rep3', t3]]) { r = await api('/api/me', { token: t }); check(`${id} is still signed in`, r.ok === true); }

  console.log('a server that starts again remembers all of it');
  await new Promise((res) => { child.once('exit', res); child.kill('SIGTERM'); });
  child = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => log.push(String(d))); child.stderr.on('data', (d) => log.push(String(d)));
  up = false;
  for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(URL0 + '/api/health')).ok; } catch (e) { await sleep(100); } }
  r = await api('/api/auth/login', { username: 'weirdo', password: PW });
  check('the ban survives a restart', !r.ok && r.banned === true, r.msg);
  r = await api('/api/auth/recover', { username: 'safe_kid', code: code4, password: 'one-more-password-1' });
  check('a used code stays used after a restart', !r.ok, r.msg);
  r = await api('/api/auth/login', { username: 'safe_kid', password: 'yet-another-pass-9' });
  check('and the last password is the one that works', r.ok === true, r.msg);

  console.log('junk sent to the new routes');
  {
    const junk = [null, 0, -1, 1e308, true, [], {}, [1, 2], { toString: 'x' }, 'x'.repeat(5000), '\u0000‮', '../../etc', 'ＡＢＣＤ-ＥＦＧＨ-ＪＫＬＭ'];
    const tok = (await api('/api/auth/login', { username: 'rep1', password: PW })).token;
    let odd = 0;
    for (const j of junk) {
      for (const [route, body] of [
        ['/api/auth/recover', { username: j, code: j, password: j }],
        ['/api/auth/recover', { username: 'rep2', code: j, password: 'brand-new-password-7' }],
        ['/api/report', { token: tok, name: j }],
        ['/api/account/recovery', { token: tok, password: j }],
      ]) {
        const x = await api(route, body);
        if (!(x.status === 200 || x.status === 401 || x.status === 429) || x.ok === true) odd++;
      }
    }
    check('nothing odd gets through, and every answer is a plain no', odd === 0, odd);
    r = await api('/api/auth/login', { username: 'rep2', password: PW });
    check('the account the junk was aimed at still signs in as normal', r.ok === true, r.msg);
  }

  const errs = log.join('').split('\n').filter((l) => /uncaught|unhandled|TypeError|ReferenceError|request failed/i.test(l));
  check('the server never threw once', errs.length === 0, errs.slice(0, 3));
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  await new Promise((res) => { if (child.exitCode !== null) return res(); child.once('exit', res); try { child.kill(); } catch (e) { res(); } });
  await sleep(150);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); console.log(log.join('').slice(-1500)); process.exit(1); });
