// Season passes (build 122), end to end without a browser:
//   node tools/passscan.js
// 1. the 5,000 passes: one emote, one accessory and one celebration each, every one a combination of
//    parts no other pass has (and no shop emote), made the same way every time, all of it real parts
// 2. they draw and move: every emote at many moments of its loop, every celebration all the way
//    through (sensible numbers, never NaN), and the lookups that ask for them by id
// 3. never for sale: not in crates, not in the daily emote shop, and nobody owns one they have not won
// 4. a pass, played: the dates, XP filling it, each reward opening and being claimed once, 20,000
//    coins, the items in the save, the next pass starting fresh while the old items stay
// 5. the server, with fake sockets: a season emote you won reaches the match and one you have not
//    does not; your season celebration and accessory are used online only if you own them; the
//    snapshot carries a season celebration so the other games can show it
// 6. the real server on its own port: a save can hold this pass's items but not a future pass's, and
//    20,000 coins in one go get through
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined && !ok ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };

// ------------------------------------------------------------------ the game's own code, in a sandbox
const store = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Reflect, Symbol, Error, isFinite, parseInt, parseFloat,
  setTimeout, clearTimeout,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  tl: (s, args) => (args ? String(s).replace(/\{(\w+)\}/g, (m, k) => (args[k] !== undefined ? String(args[k]) : m)) : s),
  Net: null, Game: { headless: false },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['config.js', 'clubs.js', 'celebs.js', 'emotes.js', 'pass.js', 'save.js', 'meta.js', 'crates.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: 'js/' + f });
}
const G = vm.runInContext(`({ PassGen, Pass, PASS_STEPS, PASS_COINS, PASS_COUNT, passAt, passNow, passNumOf, passId, passEndsAt, EMOTES, EM_FACES, EM_PROPS, EM_FX,
  CELE_POSES, CELE_MOVES, CELE_TIME, CELEBRATIONS, ACCESSORIES, Emotes, Save, Shop, Crates, CRATE_RARITIES, RARITIES, cleanAccessories, lookFromCustom, accessoryDef,
  PASS_ACC_KINDS, PASS_STARTS, PASS_MAINS, PASS_FINISHES, PASS_CELE_FX, PASS_PALETTES, SEASON_START })`, sandbox);
const { PassGen, Pass, Save, Shop, Crates, Emotes } = G;
const fresh = () => { Save.account = null; Save.data = Save.merge(null); Save.data.emoteSeed = 777; };
const realDate = sandbox.Date;
const at = (iso) => { const t = new realDate(iso).getTime(); sandbox.Date = class extends realDate { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; vm.runInContext('Date = this.Date', sandbox); };

console.log('the 5,000 passes');
{
  const t0 = Date.now();
  const E = PassGen.list('emote'), A = PassGen.list('accessory'), C = PassGen.list('celebration');
  const ms = Date.now() - t0;
  check('5,000 emotes, accessories and celebrations', E.length === 5000 && A.length === 5000 && C.length === 5000, [E.length, A.length, C.length]);
  check('made quickly (all 15,000 in under half a second)', ms < 500, ms + ' ms');
  check('ids pe1..pe5000, pa1..pa5000, pc1..pc5000', E.every((e, i) => e.id === 'pe' + (i + 1)) && A.every((a, i) => a.id === 'pa' + (i + 1)) && C.every((c, i) => c.id === 'pc' + (i + 1)));
  const ek = E.map((e) => [e.who, e.face, e.prop, e.fx, e.move].join('|'));
  check('no two emotes alike (character, face, prop, effect and move)', new Set(ek).size === 5000);
  const shop = new Set(G.EMOTES.map((e) => [e.who, e.face, e.prop, e.fx, e.move].join('|')));
  check('and none like an emote in the shop', ek.every((k) => !shop.has(k)));
  const ak = A.map((a) => { const K = G.PASS_ACC_KINDS.find((k) => k[0] === a.kind); return [a.kind, a.shape, a.pal.join(), K[4] ? a.pattern : '-', K[5] ? a.extra : '-'].join('|'); });
  check('no two accessories alike (kind, shape, colours, pattern, extra)', new Set(ak).size === 5000);
  const ck = C.map((c) => [c.start, c.main, c.finish, c.fx].join('|'));
  check('no two celebrations alike (start, main move, finish, burst)', new Set(ck).size === 5000);
  const bad = [];
  for (const e of E) { if (!G.EM_FACES[e.face] || !G.EM_PROPS[e.prop] || !G.EM_FX[e.fx]) bad.push(e.id); }
  for (const a of A) { const K = G.PASS_ACC_KINDS.find((k) => k[0] === a.kind); if (!K || a.shape < 0 || a.shape >= K[3] || a.slot !== K[2] || a.pal.length !== 4) bad.push(a.id); }
  for (const c of C) { if (!G.PASS_STARTS[c.start] || !G.PASS_MAINS[c.main] || !G.PASS_FINISHES[c.finish] || !G.PASS_CELE_FX.includes(c.fx)) bad.push(c.id); }
  check('every part they are made of exists', !bad.length, bad.slice(0, 5));
  let near = 0;
  for (let i = 1; i < 5000; i++) { if (E[i].who === E[i - 1].who || C[i].main === C[i - 1].main || A[i].kind === A[i - 1].kind) near++; }
  check('one pass is never like the pass before (character, main move, kind of accessory)', near === 0, near);
  check('every name is a word and the pass number', [...E, ...A, ...C].every((x) => typeof x.name === 'string' && x.name.endsWith(' #' + x.season) && x.name.length > 4));
  const kinds = {}; for (const a of A) kinds[a.kind] = (kinds[a.kind] || 0) + 1;
  check('all 15 kinds of accessory turn up', Object.keys(kinds).length === 15, kinds);
  // the same on the server: it makes its own copy and the two have to agree
  const { createSim } = require('../server/sim');
  const sim = createSim();
  const same = sim.run('JSON.stringify([PassGen.list("emote"), PassGen.list("accessory"), PassGen.list("celebration")])') === JSON.stringify([E, A, C]);
  check('the server makes exactly the same 15,000', same);
}

console.log('drawn and moving');
{
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  const threw = [];
  for (let n = 1; n <= 5000; n++) for (let i = 0; i < 6; i++) { try { Emotes.draw(ctx, 'pe' + n, 50, 50, 100, i * 0.53); } catch (err) { threw.push('pe' + n + ': ' + err.message); break; } }
  check('every season emote draws at six moments of its loop without throwing', !threw.length, threw.slice(0, 3));
  const odd = [];
  for (let n = 1; n <= 5000; n++) {
    const id = 'pc' + n, pose = G.CELE_POSES[id], move = G.CELE_MOVES[id];
    if (typeof pose !== 'function' || typeof move !== 'function') { odd.push(id + ' missing'); continue; }
    for (let e = 0; e <= G.CELE_TIME + 1e-9; e += 0.05) {
      const p = pose(e, e, { seed: 0 }), v = move(e);
      const nums = ['jump', 'bob', 'lean', 'upper', 'rot', 'faceX', 'legSwing', 'tuck'].map((k) => p[k]).filter((x) => x !== undefined);
      const pts = [...(p.hands || []), ...(p.feet || [])];
      if (!nums.every(Number.isFinite) || !pts.every((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]))) { odd.push(id + ' NaN at ' + e.toFixed(2)); break; }
      if ((p.hands || []).some(([x, y]) => Math.abs(x) > 45 || y < -95 || y > 5)) { odd.push(id + ' hand out of reach at ' + e.toFixed(2)); break; }
      if ((p.jump || 0) > 40 || (p.jump || 0) < -12) { odd.push(id + ' jump ' + p.jump); break; }
      if (!(Number.isFinite(v) && v >= 0 && v <= 400)) { odd.push(id + ' moves ' + v); break; }
      if (p.screen !== id) { odd.push(id + ' no burst'); break; }
    }
  }
  check('every season celebration poses sensibly all the way through, and moves at a sane speed', !odd.length, odd.slice(0, 5));
  check('the ordinary celebrations are untouched', typeof G.CELE_POSES.jump === 'function' && G.CELE_POSES.jump(0.5).hands.length === 2);
  check('ids that are not passes find nothing', [0, 5001, 'x', '12a', '01'].every((s) => G.CELE_POSES['pc' + s] === undefined && G.CELE_MOVES['pc' + s] === undefined) && typeof G.CELE_POSES.hasOwnProperty === 'function' && !('pc0' in G.CELE_POSES), [0, 5001, 'x', '12a', '01'].map((s) => typeof G.CELE_POSES['pc' + s]));
  check('an emote, an accessory, a celebration by id', Emotes.get('pe7').id === 'pe7' && G.accessoryDef('pa7').id === 'pa7' && G.accessoryDef('wings').id === 'wings' && !Emotes.get('pe0') && !G.accessoryDef('pa5001'));
}

console.log('never for sale');
{
  fresh();
  const lists = ['ball', 'trail', 'celebration', 'accessory', 'skill', 'emote'].flatMap((k) => Crates.list(k).map((x) => x.id));
  check('nothing from a pass is in the crates', !lists.some((id) => /^p[eac]\d+$/.test(id)));
  check('a crate can never hand one out', G.CRATE_RARITIES.every((r) => !Crates.missing(r).some((it) => /^p[eac]\d+$/.test(it.id))));
  const picks = new Set();
  for (let d = 1; d <= 60; d++) { at(`2027-01-${String((d % 28) + 1).padStart(2, '0')}T10:00:00`); Save.data.emoteShop = null; Save.data.emoteSeed = 1000 + d; for (const id of Emotes.shop().picks) picks.add(id); }
  check('the daily emote shop never offers one (60 shops)', ![...picks].some((id) => /^pe\d+$/.test(id)));
  fresh();
  check('nobody owns one they have not won (an item with no price is not free)', !Shop.owns('emote', 'pe1') && !Shop.owns('accessory', 'pa1') && !Shop.owns('celebration', 'pc1') && !Emotes.owns('pe1'));
  check('so it cannot go in the match menu, be worn, or be your celebration', Emotes.toggle('pe1') === 'locked' && Save.toggleAccessory('pa1') === false && (Save.data.celebration = 'pc1', Save.celebration() === 'jump'));
  check('the shop\'s own free things are still free', Shop.owns('celebration', 'jump') && Shop.owns('trail', 'electric'));
}

console.log('a pass, played');
{
  at('2026-11-15T23:00:00Z');
  check('nothing before the first pass (15 Nov 2026)', G.passNow() === 0);
  at('2026-11-16T00:00:01Z');
  check('pass 1 starts on 16 Nov 2026 (with ranked season 5)', G.passNow() === 1);
  check('and ends two weeks later', new Date(G.passEndsAt(1)).toISOString() === '2026-11-30T00:00:00.000Z');
  check('pass 5,000 runs into 2218, and then there are no more', G.passAt(G.passEndsAt(5000) - 1000) === 5000 && G.passAt(G.passEndsAt(5000) + 1000) === 0 && new Date(G.passEndsAt(5000)).getUTCFullYear() === 2218);
  fresh();
  const s = Pass.state();
  check('a new pass: nothing yet', s.n === 1 && s.xp === 0 && s.got.every((g) => !g) && Pass.ready() === 0);
  check('2,999 XP opens nothing', Pass.addXp(2999).length === 0 && Pass.ready() === 0);
  check('the next XP opens the emote', JSON.stringify(Pass.addXp(1)) === '[0]' && Pass.ready() === 1);
  check('the accessory cannot be taken yet', Pass.claim(1) === false);
  const coins0 = Save.data.coins;
  check('CLAIM the emote: yours, and in the match menu', Pass.claim(0) === true && Emotes.owns('pe1') && Emotes.deck().includes('pe1'));
  check('only once', Pass.claim(0) === false);
  check('a big match opens the rest (and the bar stops at the top)', JSON.stringify(Pass.addXp(50000)) === '[1,2,3]' && Pass.state().xp === 12000 && Pass.ready() === 3);
  check('claim them all', Pass.claim(1) && Pass.claim(2) && Pass.claim(3));
  check('20,000 coins', Save.data.coins === coins0 + 20000, Save.data.coins - coins0);
  check('the accessory goes on', Save.toggleAccessory('pa1') === true && Save.accessories().includes('pa1') && G.lookFromCustom(Save.data.look, Save.accessories()).accs.includes('pa1'));
  Save.data.celebration = 'pc1';
  check('the celebration is yours to use', Save.celebration() === 'pc1');
  check('Pass.owned lists them', Pass.owned('emote').join() === 'pe1' && Pass.owned('accessory').join() === 'pa1' && Pass.owned('celebration').join() === 'pc1');
  at('2026-11-30T00:00:05Z');
  const s2 = Pass.state();
  check('two weeks on: pass 2, empty again', s2.n === 2 && s2.xp === 0 && s2.got.every((g) => !g) && s2.seen === 0);
  check('and you keep everything from pass 1', Emotes.owns('pe1') && Shop.owns('accessory', 'pa1') && Save.celebration() === 'pc1');
  check('pass 1 can no longer be claimed from (it is pass 2 now)', !Pass.claim(0) || Pass.owned('emote').includes('pe2') === false);
  check('a broken pass in a save starts again', (Save.data.pass = 'junk', Pass.state().n === 2));
  // rewards opened but not claimed before the pass ended are handed over when the next one starts
  Pass.addXp(6500);
  check('pass 2: the emote and the accessory open', Pass.ready() === 2);
  check('claim only the emote', Pass.claim(0) === true);
  const coinsLate = Save.data.coins;
  at('2026-12-14T00:00:05Z');
  const s3 = Pass.state();
  check('pass 3 starts empty', s3.n === 3 && s3.xp === 0 && s3.got.every((g) => !g));
  check('the accessory left in pass 2 is yours anyway', Shop.owns('accessory', 'pa2') && Save.data.owned.accessory.filter((id) => id === 'pa2').length === 1);
  check('and only what was opened: no celebration, no coins from pass 2', !Shop.owns('celebration', 'pc2') && Save.data.coins === coinsLate);
  check('the emote was not given twice', Save.data.owned.emote.filter((id) => id === 'pe2').length === 1);
  Pass.addXp(12000);
  at('2026-12-28T00:00:05Z');
  Pass.state();
  check('a whole pass left unclaimed: all four handed over, 20,000 coins too', Emotes.owns('pe3') && Shop.owns('accessory', 'pa3') && Shop.owns('celebration', 'pc3') && Save.data.coins === coinsLate + 20000, Save.data.coins - coinsLate);
  Save.data.pass = { n: 9, xp: 12000, got: [false, false, false, false], seen: 0 };
  Pass.state();
  check('a pass from the future (a clock set back) gives nothing', !Emotes.owns('pe9') && Save.data.pass.n === 4);
  Save.data.pass = { n: 2.5, xp: 'lots', got: 'no' };
  const ownedBefore = JSON.stringify(Save.data.owned), coinsBefore = Save.data.coins;
  check('a broken old pass gives nothing and starts again', Pass.state().n === 4 && JSON.stringify(Save.data.owned) === ownedBefore && Save.data.coins === coinsBefore);
  // years of passes in a save
  for (let n = 1; n <= 500; n++) for (const k of ['emote', 'accessory', 'celebration']) Save.data.owned[k].push(G.passId(k, n));
  const bytes = JSON.stringify(Save.data).length;
  check('500 passes\' worth (19 years) still fits in a save (40,000 bytes)', bytes < 40000, bytes);
  check('worn accessories are capped (no endless list)', G.cleanAccessories(Array.from({ length: 50 }, (x, i) => 'pa' + (i + 1))).length === 12);
}

// ------------------------------------------------------------------ the server's game, fake sockets
console.log('in a match (the real server code, fake sockets)');
const { createGame } = require('../server/game');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let clockSkew = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockSkew;
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  removeListener() {}
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
  since(n, t) { return this.got.slice(n).filter((m) => m.t === t); }
}
const nowPass = G.passAt(realNow());
const users = {
  amy: { name: 'AMY', club: 'spain', save: { xp: 0, celebration: 'pc' + nowPass, accessories: ['pa' + nowPass, 'pa' + (nowPass + 1)], owned: { emote: ['pe' + nowPass, 'pe' + (nowPass + 30)], celebration: ['pc' + nowPass], accessory: ['pa' + nowPass] } } },
  ben: { name: 'BEN', club: 'spain', save: { xp: 0, celebration: 'pc' + nowPass, owned: { emote: [], celebration: [] } } },
  dee: { name: 'DEE', club: 'spain', save: { xp: 0 } },
  eli: { name: 'ELI', club: 'spain', save: { xp: 0 } },
};
const game = createGame({
  getUser: (id) => users[id], userName: (id) => (users[id] ? users[id].name : id.toUpperCase()),
  saveDB: () => {}, onlineRecord: () => 0, isNameTaken: () => false,
  worldCup: { round: () => 0, result: () => ({ round: 0, champion: false, titles: 0 }) },
});
const socks = {};
const connect = (id) => { socks[id] = new FakeWS(); game.connect(socks[id], id); socks[id].msg({ t: 'arena', pro: 1 }); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);

(async () => {
  check('(there is a pass on right now)', nowPass >= 1);
  for (const id of ['amy', 'ben', 'dee', 'eli']) connect(id);
  for (const id of ['amy', 'ben', 'dee', 'eli']) say(id, { t: 'queue', format: '2v2' });
  let room = null;
  const t0 = realNow();
  while (realNow() - t0 < 4000) { room = game._roomOf('amy'); if (room && ['ben', 'dee', 'eli'].every((id) => game._roomOf(id) === room)) break; await sleep(25); }
  check('(the four of them are in one match)', !!room && ['ben', 'dee', 'eli'].every((id) => game._roomOf(id) === room));
  const seat = (id) => room.seats.find((s) => s.userId === id);
  check('your season celebration is used online when you own it', seat('amy').celebration === 'pc' + nowPass, seat('amy').celebration);
  check('and not when you do not', seat('ben').celebration === 'jump', seat('ben').celebration);
  const amyLook = seat('amy').player.look || {};
  check('the season accessory you own is worn, the one you do not is not', (seat('amy').accessories || []).join() === 'pa' + nowPass, seat('amy').accessories);

  let nb = socks.ben.got.length;
  clockSkew += 2000; say('amy', { t: 'emote', e: 'pe' + nowPass });
  await sleep(30);
  check('a season emote you won reaches the match', socks.ben.since(nb, 'emote').some((m) => m.e === 'pe' + nowPass));
  nb = socks.ben.got.length;
  clockSkew += 2000; say('amy', { t: 'emote', e: 'pe' + (nowPass + 30) });
  clockSkew += 2000; say('ben', { t: 'emote', e: 'pe' + nowPass });
  clockSkew += 2000; say('amy', { t: 'emote', e: 'pe99999' });
  await sleep(30);
  check('one from a pass that has not started, one you have not won, or a made-up one goes nowhere', socks.ben.since(nb, 'emote').length === 0 && socks.amy.since(nb > 0 ? 0 : 0, 'emote').every((m) => m.e !== 'pe' + nowPass || m.p !== undefined));

  // a season celebration in the snapshot: past the end of the list, so a game can read it back
  const amyP = seat('amy').player;
  amyP.celebKind = 'pc3'; amyP.celebrateT = 2;
  const nd = socks.dee.got.length;
  const t1 = realNow();
  let snap = null;
  while (realNow() - t1 < 2000 && !snap) { snap = socks.dee.since(nd, 's').find((m) => m.p && m.p[room.m.players.indexOf(amyP)][15] > 0); await sleep(20); }
  const sim = require('../server/sim').createSim();
  const listLen = 1 + sim.CELEBRATIONS.length + 1;
  const sent = snap ? snap.p[room.m.players.indexOf(amyP)][15] : null;
  check('a season celebration travels in the snapshot as its own number', sent === listLen + 2, { sent, want: listLen + 2 });
  check('which the game reads back as pc3', sent !== null && sent >= listLen && G.passId('celebration', sent - listLen + 1) === 'pc3');

  for (const id of Object.keys(socks)) socks[id].close();
  Date.now = realNow;

  // ------------------------------------------------------------------ the real server
  console.log('the real server');
  const PORT = 8487, DATA = path.join(os.tmpdir(), `ms-passscan-${process.pid}.json`);
  const child = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = []; child.stdout.on('data', (d) => log.push(String(d))); child.stderr.on('data', (d) => log.push(String(d)));
  const done = () => { try { child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} };
  process.on('exit', done);
  const post = async (route, body) => { const r = await fetch(`http://127.0.0.1:${PORT}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); try { return await r.json(); } catch (e) { return null; } };
  let up = false;
  for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok; } catch (e) { /* not yet */ } if (!up) await sleep(100); }
  check('the server starts', up);
  if (up) {
    const su = await post('/auth/signup', { username: 'passer', password: 'a-good-long-password-42', club: 'spain' });
    const token = su && su.token;
    check('signed up', !!token, su && su.msg);
    const owned = { emote: ['pe' + nowPass, 'pe' + (nowPass + 10)], accessory: ['pa' + nowPass, 'pa' + (nowPass + 10)], celebration: ['pc' + nowPass, 'pc' + (nowPass + 10)] };
    const r = await post('/save', { token, save: { coins: 20000, owned, savedAt: Date.now() } });
    const sv = r && r.save;
    check('this pass\'s items are kept', !!sv && ['emote', 'accessory', 'celebration'].every((k) => sv.owned[k].includes(G.passId(k, nowPass))), sv && sv.owned);
    check('a pass that has not started yet cannot be in a save', !!sv && ['emote', 'accessory', 'celebration'].every((k) => !sv.owned[k].includes(G.passId(k, nowPass + 10))), sv && sv.owned);
    check('20,000 coins in one go get through', !!sv && sv.coins === 20000, sv && sv.coins);
  } else console.log(log.join(''));
  // stop the server and wait for it to go before leaving (Windows trips over a child still closing)
  const gone = new Promise((r) => { child.once('exit', r); setTimeout(r, 3000); });
  done();
  await gone;
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exitCode = failures ? 1 : 0;
})();
