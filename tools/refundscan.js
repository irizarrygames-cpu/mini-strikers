// Build 111 gave back the coins spent on characters. The game does the giving, in the save it sends
// up, and the server only lets coins climb so fast — so it has to let that refund through, once,
// and never twice. Against a REAL server on its own port with a throwaway accounts file.
//   node tools/refundscan.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8483;
const DATA = path.join(os.tmpdir(), `ms-refundscan-${process.pid}.json`);
const ROOT = path.join(__dirname, '..');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(route, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* a crash answers with HTML */ }
  return { status: res.status, json, text };
}
let child = null;
const log = [];
function start() {
  child = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
}
async function waitUp() {
  for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`); if (r.ok) return true; } catch (e) { /* not up yet */ } await sleep(100); }
  return false;
}
const done = () => { try { if (child) child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} };

(async () => {
  start();
  process.on('exit', done);
  const up = await waitUp();
  check('the server starts', up);
  if (!up) { console.log(log.join('')); done(); process.exit(1); }

  const su = await post('/auth/signup', { username: 'refunder', password: 'a-good-long-password-42', club: 'spain' });
  check('signed up', !!(su.json && su.json.ok), su.json && su.json.msg);
  const token = su.json && su.json.token;
  const me = async () => (await post('/me', { token })).json;

  console.log('an account from before build 111, with characters bought');
  // ninja 7000 + viking 11000 + afroking 16000 = 34000, far more than one save may add
  const old = { coins: 5000, character: 'viking', owned: { character: ['ninja', 'viking', 'afroking', 'street'], accessory: [] }, savedAt: Date.now() };
  let r = await post('/save', { token, save: old });
  check('the old save goes up as it is', r.json && r.json.ok && r.json.save.coins === 5000 && !r.json.save.charRefund, r.json && r.json.save && { coins: r.json.save.coins, charRefund: r.json.save.charRefund });

  console.log('the new game gives the coins back and sends that up');
  const migrated = { ...old, coins: 5000 + 34000, owned: { character: [], accessory: [] }, charRefund: 1, look: { hair: 'spikes' }, stats: { spd: 0 }, savedAt: Date.now() };
  r = await post('/save', { token, save: migrated });
  check('the whole refund gets through (34,000 > the 12,000 a save may add)', r.json && r.json.save.coins === 39000, r.json && r.json.save.coins);
  let m = await me();
  check('and it is kept on the account', m && m.save.coins === 39000 && m.save.charRefund === 1, m && { coins: m.save.coins, charRefund: m.save.charRefund });

  console.log('an old tab still open sends its old save');
  r = await post('/save', { token, save: { ...old, coins: 39000, savedAt: Date.now() } });
  m = await me();
  check('the refund stays done', m && m.save.charRefund === 1, m && m.save.charRefund);
  check('and the characters stay gone', m && Array.isArray(m.save.owned.character) && m.save.owned.character.length === 0, m && m.save.owned);

  console.log('trying the refund a second time');
  r = await post('/save', { token, save: { ...migrated, coins: 39000 + 34000, savedAt: Date.now() } });
  check('only an ordinary save\'s worth gets through (no second refund)', r.json && r.json.save.coins === 39000 + 12000, r.json && r.json.save.coins);

  console.log('a new account has nothing to give back');
  const su2 = await post('/auth/signup', { username: 'freshone', password: 'a-good-long-password-42', club: 'italy' });
  const t2 = su2.json && su2.json.token;
  r = await post('/save', { token: t2, save: { coins: 50000, charRefund: 1, owned: { character: ['goat'] } } });
  check('it cannot claim one', r.json && r.json.save.coins === 12000, r.json && r.json.save.coins);

  console.log('the account says where both cups are');
  m = await me();
  check('a World Cup run and a Champions Cup run', m && m.wc && m.cc && m.cc.round === 0 && m.cc.titles === 0, m && { wc: m.wc, cc: m.cc });

  console.log(failures ? `\n${failures} FAILED` : '\nall good');
  done();
  process.exit(failures ? 1 : 0);
})();
