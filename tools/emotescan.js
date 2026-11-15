// Emotes (build 120), end to end without a browser:
//   node tools/emotescan.js
// 1. the 154 emotes: four starters, 50/40/30/20/10 by grade, every part they are made of exists and
//    every one draws at every moment of its loop without throwing (on a stand-in canvas)
// 2. the daily emote shop: three a day, the same all day, from the ones you have not got, at the
//    shop's odds; 1,000 coins each, bought once; a grade you own all of gives way to another
// 3. your match menu: starters to begin with, at most eight, only ones you own
// 4. crates: emotes come out of them by grade (never a starter), counted at half weight
// 5. the server, with fake sockets: an emote reaches everyone else in the match and the people
//    watching, junk is dropped, lines and emotes share one spam limit, and nobody you blocked sees
//    yours (or you theirs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined && !ok ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };

// ------------------------------------------------------------------ the game's own code, in a sandbox
const store = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Symbol, Error, isFinite, parseInt, parseFloat,
  setTimeout, clearTimeout,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  tl: (s, args) => (args ? String(s).replace(/\{(\w+)\}/g, (m, k) => (args[k] !== undefined ? String(args[k]) : m)) : s),
  Net: null,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['config.js', 'clubs.js', 'celebs.js', 'emotes.js', 'save.js', 'meta.js', 'crates.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: 'js/' + f });
}
const G = vm.runInContext('({ EMOTES, EMOTE_STARTERS, EMOTE_DECK_MAX, EMOTE_PRICE, EMOTE_SHOP_ODDS, EMOTE_GRADES, EM_FACES, EM_PROPS, EM_FX, Emotes, Save, Shop, Crates, CRATES, PRICES })', sandbox);
const { EMOTES, EMOTE_STARTERS, Emotes, Save, Shop, Crates } = G;
const fresh = () => { Save.account = null; Save.data = Save.merge(null); Save.data.emoteSeed = 12345; };

console.log('the emotes');
{
  const by = {};
  for (const e of EMOTES) by[e.rarity] = (by[e.rarity] || 0) + 1;
  check('154 in all', EMOTES.length === 154, EMOTES.length);
  check('4 starters, then 50 common, 40 rare, 30 epic, 20 legendary, 10 mythic', by.starter === 4 && by.common === 50 && by.rare === 40 && by.epic === 30 && by.legendary === 20 && by.mythic === 10, by);
  check('every id is different', new Set(EMOTES.map((e) => e.id)).size === EMOTES.length);
  check('every name is different', new Set(EMOTES.map((e) => e.name)).size === EMOTES.length);
  const MOVES = ['bounce', 'jump', 'shake', 'wobble', 'sway', 'pulse', 'float', 'nod', 'tilt', 'spin', 'slam', 'droop', 'no', 'roll', 'dash', 'flip', 'none'];
  const missing = [];
  for (const e of EMOTES) {
    if (!G.EM_FACES[e.face]) missing.push(e.id + ' face ' + e.face);
    if (e.prop && !G.EM_PROPS[e.prop]) missing.push(e.id + ' prop ' + e.prop);
    if (e.fx && !G.EM_FX[e.fx]) missing.push(e.id + ' fx ' + e.fx);
    if (!MOVES.includes(e.move)) missing.push(e.id + ' move ' + e.move);
    if (!['joy', 'sad', 'tease', 'hi', 'gg', 'cool'].includes(e.mood)) missing.push(e.id + ' mood ' + e.mood);
  }
  check('every face, prop, effect, move and mood they use exists', !missing.length, missing);
  const looks = new Set(EMOTES.map((e) => [e.who, e.face, e.prop, e.fx].join('|')));
  check('no two look the same', looks.size === EMOTES.length);
  // a canvas that takes every call and draws nothing: what is left to fail is the emote's own code
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  const threw = [];
  for (const e of EMOTES) {
    for (let i = 0; i < 40; i++) {
      try { Emotes.draw(ctx, e.id, 50, 50, 100, i * 0.137); } catch (err) { threw.push(e.id + ': ' + err.message); break; }
    }
  }
  check('every emote draws at 40 moments of its loop without throwing', !threw.length, threw.slice(0, 5));
  check('an emote that does not exist draws nothing and does not throw', (() => { try { Emotes.draw(ctx, 'no-such', 0, 0, 10, 0); return true; } catch (e) { return false; } })());
}

console.log('your match menu');
{
  fresh();
  check('a new player owns the four starters and nothing else', EMOTE_STARTERS.every((id) => Emotes.owns(id)) && EMOTES.filter((e) => !e.starter).every((e) => !Emotes.owns(e.id)));
  check('and has them in the menu', JSON.stringify(Emotes.deck()) === JSON.stringify(EMOTE_STARTERS), Emotes.deck());
  check('an old save with no menu gets the starters', JSON.stringify((() => { const d = Save.merge({ coins: 5, owned: { ball: [] } }); Save.data = d; return Emotes.deck(); })()) === JSON.stringify(EMOTE_STARTERS));
  fresh();
  check('one you do not own will not go in', Emotes.toggle('goatmode') === 'locked' && !Emotes.deck().includes('goatmode'));
  check('taking one out', Emotes.toggle('haha') === 'off' && !Emotes.deck().includes('haha'));
  check('and putting it back', Emotes.toggle('haha') === 'on' && Emotes.deck().includes('haha'));
  Save.data.owned.emote = EMOTES.filter((e) => !e.starter).slice(0, 10).map((e) => e.id);
  for (const id of Save.data.owned.emote.slice(0, 4)) Emotes.toggle(id);
  check('eight fit', Emotes.deck().length === G.EMOTE_DECK_MAX);
  check('a ninth is turned away ("full")', Emotes.toggle(Save.data.owned.emote[5]) === 'full' && Emotes.deck().length === 8);
  Save.data.emotes = ['haha', 'haha', 'goatmode', 42, null, '__proto__', 'grr'];
  check('a broken menu in a save is cleaned: no repeats, nothing unowned, nothing that is not an emote', JSON.stringify(Emotes.deck()) === JSON.stringify(['haha', 'grr']), Emotes.deck());
}

console.log('the daily emote shop');
{
  fresh();
  const realDate = sandbox.Date;
  const at = (iso) => { const t = new realDate(iso).getTime(); sandbox.Date = class extends realDate { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; vm.runInContext('Date = this.Date', sandbox); };
  at('2026-11-15T10:00:00');
  const s1 = Emotes.shop();
  check('three picks', s1.picks.length === 3, s1.picks);
  check('all different, none a starter, none you own', new Set(s1.picks).size === 3 && s1.picks.every((id) => !Emotes.get(id).starter && !Emotes.owns(id)));
  at('2026-11-15T22:30:00');
  check('the same all day', JSON.stringify(Emotes.shop().picks) === JSON.stringify(s1.picks));
  at('2026-11-16T00:05:00');
  check('new ones the next day', JSON.stringify(Emotes.shop().picks) !== JSON.stringify(s1.picks));
  check('and the badge says so until you look', Emotes.unseen() && (Emotes.markSeen(), !Emotes.unseen()));
  // a different player gets a different shop on the same day
  const mine = Emotes.shop().picks.slice();
  Save.data.emoteShop = null; Save.data.emoteSeed = 999;
  check('your shop is your own (another player, the same day, another three)', JSON.stringify(Emotes.shop().picks) !== JSON.stringify(mine));
  // buying
  Save.data.coins = 1500;
  const s = Emotes.shop(), id = s.picks[0];
  check('one you cannot afford is not sold', (Save.data.coins = 999, Emotes.buy(id).error === 'poor' && !Emotes.owns(id) && Save.data.coins === 999));
  Save.data.coins = 1500;
  const r = Emotes.buy(id);
  check('1,000 coins buys it', r.ok && Emotes.owns(id) && Save.data.coins === 500);
  check('it goes straight into the menu (there was room)', Emotes.deck().includes(id));
  check('it cannot be bought twice', Emotes.buy(id).error === 'owned' && Save.data.coins === 500);
  check('one that is not in today\'s shop cannot be bought', Emotes.buy(EMOTES.find((e) => !e.starter && !s.picks.includes(e.id)).id).error === 'gone');
  check('the shop keeps its three after a buy (it shows the one you bought as yours)', JSON.stringify(Emotes.shop().picks) === JSON.stringify(s.picks));
  // the odds, over many players and days
  const count = {}; let slots = 0;
  for (let d = 0; d < 2500; d++) {
    Save.data = Save.merge(null); Save.data.emoteSeed = 1 + d * 7919;
    at(new realDate(2026, 0, 1 + (d % 365), 12).toISOString());
    for (const p of Emotes.shop().picks) { count[Emotes.get(p).rarity] = (count[Emotes.get(p).rarity] || 0) + 1; slots++; }
  }
  const pct = (g) => (100 * (count[g] || 0)) / slots;
  const near = Object.entries(G.EMOTE_SHOP_ODDS).every(([g, o]) => Math.abs(pct(g) - o) < Math.max(1.2, o * 0.25));
  check('a slot\'s grade follows the shop\'s odds (common 52, rare 28, epic 13, legendary 5.5, mythic 1.5)', near, Object.fromEntries(G.EMOTE_GRADES.map((g) => [g, +pct(g).toFixed(1)])));
  check('a mythic does turn up (and rarely)', pct('mythic') > 0.5 && pct('mythic') < 3, pct('mythic'));
  // a grade you own all of
  Save.data = Save.merge(null); Save.data.emoteSeed = 77;
  Save.data.owned.emote = EMOTES.filter((e) => e.rarity === 'common').map((e) => e.id);
  const seen = new Set();
  for (let d = 0; d < 60; d++) { Save.data.emoteShop = null; at(new realDate(2026, 2, 1 + d, 12).toISOString()); for (const p of Emotes.shop().picks) seen.add(Emotes.get(p).rarity); }
  check('own every common and the shop still fills its three, from the other grades', !seen.has('common') && seen.size >= 2, [...seen]);
  // everything
  Save.data.owned.emote = EMOTES.filter((e) => !e.starter).map((e) => e.id); Save.data.emoteShop = null;
  check('own them all and the shop is empty (and says so, no badge)', Emotes.shop().picks.length === 0 && !Emotes.unseen());
  sandbox.Date = realDate; vm.runInContext('Date = this.Date', sandbox);
}

console.log('crates');
{
  fresh();
  const all = G.CRATES.flatMap((c) => Array.from({ length: 400 }, () => Crates.roll(c)));
  const emotes = all.filter((w) => w && w.kind === 'emote');
  check('emotes come out of crates', emotes.length > 0);
  check('never a starter', emotes.every((w) => !Emotes.get(w.id).starter));
  check('each with its own grade', emotes.every((w) => w.rarity === Emotes.get(w.id).rarity));
  const share = (id) => { const c = G.CRATES.find((x) => x.id === id); let n = 0; for (let i = 0; i < 4000; i++) if (Crates.roll(c).kind === 'emote') n++; return Math.round(n / 40); };
  const gold = share('gold'), top = share('infinity');
  check('counted at half: a gold crate is mostly not emotes, the top crate rarely', gold < 45 && top < 20, { gold, infinity: top });
  // one that is won goes into the menu, like one that is bought
  Save.data.coins = 1e7;
  let won = null;
  for (let i = 0; i < 400 && !won; i++) { const w = Crates.open('copper'); if (w && w.kind === 'emote') won = w; }
  check('a crate emote is yours and in the menu', !!won && Emotes.owns(won.id) && Emotes.deck().includes(won.id), won);
}

console.log('the save');
{
  fresh();
  for (const k of Object.keys(G.PRICES)) if (k !== 'character') Save.data.owned[k] = Object.keys(G.PRICES[k]);
  Save.data.emotes = Emotes.deck();
  Emotes.shop();
  const bytes = JSON.stringify(Save.data).length;
  check('owning everything still fits in a save the server accepts (40,000 bytes)', bytes < 40000, bytes);
}

// ------------------------------------------------------------------ the server
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
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
}
const users = {};
const account = (id) => (users[id] = users[id] || { name: id.toUpperCase(), club: 'spain', save: { xp: 0 } });
const game = createGame({
  getUser: (id) => users[id], userName: (id) => (users[id] ? users[id].name : id.toUpperCase()),
  saveDB: () => {}, onlineRecord: () => 0, isNameTaken: () => false,
  worldCup: { round: () => 0, result: () => ({ round: 0, champion: false, titles: 0 }) },
});
const socks = {};
const connect = (id) => { account(id); socks[id] = new FakeWS(); game.connect(socks[id], id); socks[id].msg({ t: 'arena', pro: 1 }); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);
(async () => {
  for (const id of ['amy', 'ben', 'dee', 'eli']) connect(id);
  for (const id of ['amy', 'ben', 'dee', 'eli']) say(id, { t: 'queue', format: '2v2' });
  let room = null;
  const t0 = realNow();
  while (realNow() - t0 < 4000) { room = game._roomOf('amy'); if (room && ['ben', 'dee', 'eli'].every((id) => game._roomOf(id) === room)) break; await sleep(25); }
  check('(the four of them are in one match)', !!room && ['ben', 'dee', 'eli'].every((id) => game._roomOf(id) === room));
  const pi = (id) => room.m.players.indexOf(room.seats.find((s) => s.userId === id).player);
  const n = (id) => socks[id].got.length;

  let na = n('amy'), nb = n('ben'), nd = n('dee');
  clockSkew += 2000; say('amy', { t: 'emote', e: 'goatmode' });
  await sleep(30);
  const got = socks.ben.since(nb, 'emote');
  check('an emote reaches everyone else in the match, with who sent it', got.length === 1 && got[0].e === 'goatmode' && got[0].p === pi('amy') && socks.dee.since(nd, 'emote').length === 1, got);
  check('and is not sent back to you (your game already shows it)', socks.amy.since(na, 'emote').length === 0);

  nb = n('ben');
  for (const junk of ['not-an-emote', '', 42, null, { e: 'x' }, ['haha'], '__proto__', 'constructor', 'x'.repeat(5000)]) { clockSkew += 2000; say('amy', { t: 'emote', e: junk }); }
  await sleep(30);
  check('anything that is not one of the game\'s emotes goes nowhere', socks.ben.since(nb, 'emote').length === 0, socks.ben.since(nb, 'emote'));

  nb = n('ben');
  clockSkew += 2000; say('amy', { t: 'chat', m: 1 }); say('amy', { t: 'emote', e: 'haha' });
  await sleep(30);
  check('lines and emotes share one limit: an emote straight after a line is held back', socks.ben.since(nb, 'chat').length === 1 && socks.ben.since(nb, 'emote').length === 0);
  nb = n('ben');
  clockSkew += 1500; say('amy', { t: 'emote', e: 'haha' });
  await sleep(30);
  check('a moment later it goes', socks.ben.since(nb, 'emote').length === 1);
  nb = n('ben');
  clockSkew += 11000; // a clean ten seconds
  for (let i = 0; i < 8; i++) { clockSkew += 1200; say('amy', { t: 'emote', e: 'grr' }); } // eight tries in 9.6s
  await sleep(30);
  check('no more than five in any ten seconds', socks.ben.since(nb, 'emote').length === 5, socks.ben.since(nb, 'emote').length);

  // a friend watching the match sees it too
  connect('vic');
  say('vic', { t: 'friend.add', name: 'amy' }); say('amy', { t: 'friend.accept', name: 'vic' });
  say('vic', { t: 'watch', name: 'amy' });
  await sleep(50);
  const nv = n('vic');
  clockSkew += 11000; say('amy', { t: 'emote', e: 'vip' });
  await sleep(30);
  check('a friend watching the match sees it as well', socks.vic.since(nv, 'emote').some((m) => m.e === 'vip' && m.p === pi('amy')), socks.vic.since(nv, 'emote'));

  // blocking
  clockSkew += 15000;
  socks.amy.msg({ t: 'friend.block', name: 'ben' });
  na = n('amy'); nd = n('dee');
  clockSkew += 2000; say('ben', { t: 'emote', e: 'lol' });
  await sleep(30);
  check('an emote from someone you blocked never reaches you', socks.amy.since(na, 'emote').length === 0);
  check('everyone else still sees it', socks.dee.since(nd, 'emote').some((m) => m.p === pi('ben') && m.e === 'lol'));
  nb = n('ben'); nd = n('dee');
  clockSkew += 2000; say('amy', { t: 'emote', e: 'wink' });
  await sleep(30);
  check('and yours never reaches them', socks.ben.since(nb, 'emote').length === 0 && socks.dee.since(nd, 'emote').length === 1);

  // not in a match: nothing
  for (const id of ['amy', 'ben', 'dee', 'eli']) say(id, { t: 'leave' });
  await sleep(50);
  connect('zed');
  const nz = n('zed');
  clockSkew += 2000; say('zed', { t: 'emote', e: 'haha' });
  await sleep(30);
  check('an emote from someone not in a match goes nowhere (and does not break anything)', socks.zed.since(nz, 'error').length === 0);

  console.log(failures ? `\n${failures} FAILED` : '\nall ok');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL', e.stack); process.exit(1); });
