// Gift scan (build 122) — node tools/giftscan.js
//
// The "everything" gift, on a real server with a throwaway data file: the account named in the
// gift gets its coins, every item in the game, and every season pass as it starts (shown finished,
// its coins paid once a pass). A game that sends up a save without them (an older app) cannot lose
// them, nothing is given twice across restarts, an account made after the gift was written gets
// nothing, and nobody else gets anything. A gift limited to passes up to one (havertz, build 124)
// gives everything but never a later pass.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 8489;
const DATA = path.join(os.tmpdir(), `ms-giftscan-${process.pid}.json`);
const CLOCK = path.join(os.tmpdir(), `ms-giftscan-clock-${process.pid}.js`);
const NAME = 'irizarrygame';
const PW = 'gift-scan-' + Math.random().toString(36).slice(2) + '-Aa1';
const TEN_T = 10000000000000;

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 300) : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the server's clock can be moved on (MS_SKEW ms), to see the next season pass arrive
fs.writeFileSync(CLOCK, "const o = Number(process.env.MS_SKEW) || 0; const n = Date.now; Date.now = () => n() + o;\n");

let child = null;
async function start(skew = 0) {
  child = spawn(process.execPath, ['--require', CLOCK, 'server.js', String(PORT)], { cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '', MS_SKEW: String(skew) }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.log = [];
  child.stdout.on('data', (d) => child.log.push(String(d)));
  child.stderr.on('data', (d) => child.log.push(String(d)));
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return true; } catch (e) { /* not yet */ }
    await sleep(100);
  }
  return false;
}
async function stop() {
  if (!child) return;
  await sleep(900); // what the server has not written yet goes to the file (it waits 300 ms to batch)
  const c = child; child = null;
  const gone = new Promise((r) => { c.once('exit', r); setTimeout(r, 4000); });
  try { c.kill(); } catch (e) {}
  await gone;
}
const post = async (route, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try { return await r.json(); } catch (e) { return null; }
};
const readData = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const usersOf = (d) => (d && d.users) || d;
function cleanUp() { try { if (child) child.kill(); } catch (e) {} for (const f of [DATA, CLOCK]) { try { fs.unlinkSync(f); } catch (e) {} } }
process.on('exit', cleanUp);

(async () => {
  const sim = require('../server/sim').createSim();
  const all = {
    ball: sim.run('BALLS').map((x) => x.id), trail: sim.TRAILS.map((x) => x.id), celebration: sim.CELEBRATIONS.map((x) => x.id),
    accessory: sim.ACCESSORIES.map((x) => x.id), skill: sim.SKILLS.map((x) => x.id), emote: sim.EMOTES.map((x) => x.id),
  };
  const hasAll = (sv) => !!sv && !!sv.owned && Object.entries(all).every(([k, ids]) => Array.isArray(sv.owned[k]) && ids.every((id) => sv.owned[k].includes(id)));
  const pass = sim.passNow();
  const passItems = (n) => [['emote', 'pe' + n], ['accessory', 'pa' + n], ['celebration', 'pc' + n]];
  const hasPass = (sv, n) => !!sv && passItems(n).every(([k, id]) => (sv.owned[k] || []).includes(id));
  const DAY = 86400000;

  console.log('before the gift');
  check('a season pass is on (the test needs one)', pass >= 1, pass);
  check('the server starts', await start());
  let su = await post('/auth/signup', { username: NAME, password: PW, club: 'spain' });
  check('the account is made', !!(su && su.token), su && su.msg);
  const other = await post('/auth/signup', { username: 'giftscanother', password: PW, club: 'brazil' });
  check('and somebody else', !!(other && other.token));
  const hv = await post('/auth/signup', { username: 'havertz', password: PW, club: 'germany' });
  check('and havertz', !!(hv && hv.token), hv && hv.msg);
  const iz = await post('/auth/signup', { username: 'irizarry', password: PW, club: 'spain' });
  check('and irizarry', !!(iz && iz.token), iz && iz.msg);
  check('a new account made now is too late for the gift: nothing', su && !su.gift && !hasAll(su.save), su && su.gift);
  await post('/save', { token: su.token, save: { coins: 500, owned: { ball: ['watermelon'] }, savedAt: Date.now() }, gifts: true });
  await stop();

  // the account was there before the gift was written (as the real one is)
  const d = readData(), users = usersOf(d);
  const id = Object.keys(users).find((k) => users[k] && (users[k].name === NAME || k === NAME));
  check('found the account in the data file', !!id, Object.keys(users));
  users[id].created = Date.UTC(2026, 0, 1);
  const hid = Object.keys(users).find((k) => users[k] && (users[k].name === 'havertz' || k === 'havertz'));
  check('and havertz\'s', !!hid);
  if (hid) users[hid].created = Date.UTC(2026, 0, 1);
  const iid = Object.keys(users).find((k) => users[k] && (users[k].name === 'irizarry' || k === 'irizarry'));
  check('and the irizarry account', !!iid);
  if (iid) users[iid].created = Date.UTC(2026, 0, 1);
  fs.writeFileSync(DATA, JSON.stringify(d));

  console.log('the gift');
  check('the server starts again (the gift is queued as it starts)', await start());
  check('it says so in the log', child.log.join('').includes(`coins queued for ${NAME}, and everything`), child.log.join('').slice(-400));
  const li = await post('/auth/login', { username: NAME, password: PW });
  check('logged in', !!(li && li.token), li && li.msg);
  check('10 trillion coins, and this pass\'s 20,000', li.gift === TEN_T + 20000 && li.save.coins === 500 + TEN_T + 20000, { gift: li.gift, coins: li.save.coins });
  check('every item in the game', hasAll(li.save), Object.fromEntries(Object.entries(li.save.owned || {}).map(([k, v]) => [k, v.length])));
  check('and this season pass\'s emote, accessory and celebration', hasPass(li.save, pass));
  check('the pass shows as finished', li.save.pass && li.save.pass.n === pass && li.save.pass.xp === 12000 && li.save.pass.got.every((g) => g === true), li.save.pass);
  check('nothing from a pass that has not started', !hasPass(li.save, pass + 1));
  check('nothing twice', Object.values(li.save.owned).every((l) => new Set(l).size === l.length));
  const bytes = JSON.stringify(li.save).length;
  check('the save is still small enough to send back (under 40,000 bytes)', bytes < 40000, bytes);
  check('newer than anything the game had, so the game takes it', li.save.savedAt > Date.now() - 60000);

  console.log('an older app sends up a save without them');
  const coins = li.save.coins;
  const old = await post('/save', { token: li.token, save: { coins, owned: { ball: ['watermelon'] }, savedAt: Date.now() + 5000, mark: 'old' }, gifts: true });
  check('saved', !!(old && old.ok), old && old.msg);
  check('everything is put back', hasAll(old.save) && hasPass(old.save, pass), old.save && Object.keys(old.save.owned || {}));
  check('the rest of that save is kept', old.save.mark === 'old' && old.save.coins === coins, { mark: old.save.mark, coins: old.save.coins });
  check('and made newer than it, so the next time the game opens it comes back down', old.save.savedAt > Date.now() + 5000 - 100, old.save.savedAt - Date.now());
  check('no more coins', old.gift === 0, old.gift);
  const full = await post('/save', { token: li.token, save: { ...li.save, mark: 'full' }, gifts: true });
  check('the whole save, with everything in it, goes back up fine', full && full.ok && full.save.mark === 'full', full && full.msg);
  const me = await post('/me', { token: li.token });
  check('opening the game again: no more coins, still everything', me && me.gift === 0 && hasAll(me.save), me && me.gift);
  const nobody = await post('/auth/login', { username: 'giftscanother', password: PW });
  const h1 = await post('/auth/login', { username: 'havertz', password: PW });
  check('havertz: 10 trillion coins and this pass\'s 20,000', h1 && h1.gift === TEN_T + 20000, h1 && h1.gift);
  check('havertz: every item in the game, and this pass, finished', h1 && hasAll(h1.save) && hasPass(h1.save, pass) && h1.save.pass && h1.save.pass.n === pass && h1.save.pass.got.every((g) => g === true));
  check('havertz: nothing from a later pass', h1 && !hasPass(h1.save, pass + 1));
  // build 127: irizarry's three gifts (a billion, 10 trillion, 10 trillion and everything); the real
  // account already had the first two, so it gets 10 trillion more and everything
  const z1 = await post('/auth/login', { username: 'irizarry', password: PW });
  check('irizarry: its gifts and the 20,000 for this pass', z1 && z1.gift === 1e9 + 2 * TEN_T + 20000, z1 && z1.gift);
  check('irizarry: every item in the game, and this pass, finished', z1 && hasAll(z1.save) && hasPass(z1.save, pass) && z1.save.pass && z1.save.pass.got.every((g) => g === true));
  check('nobody else gets anything', nobody && nobody.gift === 0 && !hasAll(nobody.save) && !(nobody.save && nobody.save.owned && (nobody.save.owned.emote || []).includes('pe' + pass)), nobody && nobody.gift);
  await stop();

  console.log('restarted');
  check('the server starts again', await start());
  const again = await post('/auth/login', { username: NAME, password: PW });
  check('the gift is not given twice', again && again.gift === 0 && again.save.coins === coins, again && { gift: again.gift, coins: again.save.coins });
  check('still everything', hasAll(again.save) && hasPass(again.save, pass));
  await stop();

  console.log('two weeks on: the next season pass');
  check('the server starts, 14 days later', await start(14 * DAY));
  const next = await post('/auth/login', { username: NAME, password: PW });
  check('the next pass is theirs as it starts', next && hasPass(next.save, pass + 1), next && next.msg);
  check('and kept the last one', hasPass(next.save, pass));
  check('shown finished', next.save.pass && next.save.pass.n === pass + 1 && next.save.pass.got.every((g) => g === true), next.save.pass);
  check('its 20,000 coins, once', next.gift === 20000, next.gift);
  const twice = await post('/me', { token: next.token });
  check('not twice', twice && twice.gift === 0, twice && twice.gift);
  check('still nothing from a pass that has not started', !hasPass(twice.save, pass + 2));
  const h2 = await post('/auth/login', { username: 'havertz', password: PW });
  check('havertz two weeks on: still everything from before', h2 && hasAll(h2.save) && hasPass(h2.save, pass), h2 && h2.msg);
  check('havertz: the new pass is not given (earned like anyone else)', h2 && !hasPass(h2.save, pass + 1) && !(h2.save.pass && h2.save.pass.n === pass + 1 && h2.save.pass.got.every((g) => g === true)), h2 && h2.save && h2.save.pass);
  check('havertz: and not its coins', h2 && h2.gift === 0, h2 && h2.gift);
  const z2 = await post('/auth/login', { username: 'irizarry', password: PW });
  check('irizarry two weeks on: the new pass as it starts, and its coins once', z2 && hasPass(z2.save, pass + 1) && hasPass(z2.save, pass) && z2.gift === 20000, z2 && z2.gift);
  await stop();

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exitCode = failures ? 1 : 0;
})().catch(async (e) => { console.error(e); if (child) console.log(child.log.join('').slice(-2000)); await stop(); process.exitCode = 1; });
