// Club Career online (build 111), run against the real server game code with fake sockets.
//   node tools/clubscan.js
// A player who says they play for a club wears its kit online and a team with nobody on it is a club
// too; your own player comes from the save the server keeps (look, stat levels, and only the
// accessories you own, as many as you wear); better stats are matched with better players and
// better fill-ins; and the online Champions Cup keeps its own run, apart from the World Cup.
const { createGame } = require('../server/game');
const { createSim } = require('../server/sim');
const sim = createSim();
const EURO = new Set(sim.EURO_CLUBS.map((c) => c.id));
const COUNTRY = new Set(sim.CLUBS.map((c) => c.id));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
}

// two runs per account, like server.js keeps them: 'wc' and 'cc'
const runs = {};
const worldCup = {
  round: (id, kind = 'wc') => ((runs[id] && runs[id][kind]) ? runs[id][kind].round : 0),
  result(id, won, kind = 'wc') {
    runs[id] = runs[id] || {};
    const w = runs[id][kind] || { round: 0, titles: 0 };
    const champion = won && w.round === 3;
    runs[id][kind] = { round: won && !champion ? w.round + 1 : 0, titles: w.titles + (champion ? 1 : 0) };
    return { round: runs[id][kind].round, champion, titles: runs[id][kind].titles };
  },
};
const users = {
  star: { club: 'spain', save: { look: { hair: 'afro', hairColor: '#2f7bff', skin: '#7a4a2a', cap: '#ff3a3f', build: 'buff' }, stats: { spd: 60, sht: 60, pas: 60, ctl: 60, def: 60 }, accessories: ['halo', 'cape', 'shades', 'wings'], owned: { accessory: ['halo', 'cape', 'shades'] } } },
  rookie: { club: 'italy', save: {} },
  rookie2: { club: 'france', save: {} },
  champ: { club: 'germany', save: { stats: { spd: 9999999, sht: 'lots', pas: -5 } } },
};
const game = createGame({ getUser: (id) => users[id], userName: (id) => id.toUpperCase(), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false, worldCup });

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
async function waitFor(ws, t, after, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(50); }
  return null;
}
async function finishWith(id, mine, theirs) {
  const room = game._roomOf(id), m = room.m, seat = room.seats.find((s) => s.userId === id);
  while (m.phase !== 'play') await sleep(50);
  const other = seat.team === 'blue' ? 'red' : 'blue';
  m.score[seat.team] = mine; m.score[other] = theirs;
  m.time = 0.05;
  return room;
}

(async () => {
  console.log('a club player online: their kit, their own player, their accessories');
  {
    const ws = connect('star');
    ws.msg({ t: 'arena', club: 'madridblanco' });
    const n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1' });
    const st = await waitFor(ws, 'start', n);
    check('the match started (filled in after the wait)', !!st);
    const room = game._roomOf('star'), seat = room.seats.find((s) => s.userId === 'star');
    check('they wear their club', st && st.clubs[st.side] === 'madridblanco', st && st.clubs);
    const other = st && st.clubs[st.side === 'blue' ? 'red' : 'blue'];
    check('the side with nobody on it is a club too, not a country', EURO.has(other) && other !== 'madridblanco', other);
    const me = st && st.players[st.you];
    check('their look comes from the save', me && me.look.hair === 'afro' && me.look.buff === 1 && me.look.hairColor === '#2f7bff', me && me.look);
    check('every accessory they own and wear, and none they do not own', me && JSON.stringify(me.look.accs) === JSON.stringify(['shades', 'halo', 'cape']), me && me.look.accs);
    check('their stat levels are sent to their game', st && st.stats && st.stats.spd === 60 && st.stats.def === 60, st && st.stats);
    const p = seat.player, r = sim.statRatings({ spd: 60, sht: 60, pas: 60, ctl: 60, def: 60 });
    check('the server plays them at those stats', p && Math.abs(p.attr.speed - (1 + Math.max(-1, Math.min(1.6, (r.spd - 70) / 25)) * 0.08)) < 1e-9, p && p.attr);
    check('a club seat moves no country in the league', seat.club === null, seat.club);
    check('the fill-ins are sharper for a strong player than the online base', room.m.diff.aiShotNoise < sim.ONLINE_BOTS.aiShotNoise, { noise: room.m.diff.aiShotNoise, base: sim.ONLINE_BOTS.aiShotNoise });
    await finishWith('star', 1, 0);
    const end = await waitFor(ws, 'end', n);
    check('the result reaches them, no league line', end && end.league === null, end && end.league);
  }

  console.log('back to their country: the kit goes back too');
  {
    const ws = socks.star;
    ws.msg({ t: 'arena', club: null });
    await sleep(200);
    const n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1' });
    const st = await waitFor(ws, 'start', n);
    check('they wear their country again', st && st.clubs[st.side] === 'spain', st && st.clubs);
    const other = st && st.clubs[st.side === 'blue' ? 'red' : 'blue'];
    check('and the empty side is a country', COUNTRY.has(other), other);
    const seat = game._roomOf('star').seats.find((s) => s.userId === 'star');
    check('a country seat moves its country in the league', seat.club === 'spain', seat.club);
    await finishWith('star', 0, 0);
    await waitFor(ws, 'end', n);
  }

  console.log('junk in the arena message changes nothing');
  {
    const ws = connect('rookie');
    for (const club of ['__proto__', 'spain', 12, { a: 1 }, 'x'.repeat(5000), 'MADRIDBLANCO']) ws.msg({ t: 'arena', club });
    const n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1' });
    const st = await waitFor(ws, 'start', n);
    check('still their country', st && st.clubs[st.side] === 'italy', st && st.clubs);
    const me = st && st.players[st.you];
    check('an empty save is the default look with no accessories', me && me.look.hair === 'cap' && me.look.accs.length === 0, me && me.look);
    check('and 60 in every stat', st && Object.values(st.stats).every((v) => v === 0), st && st.stats);
    await finishWith('rookie', 0, 1);
    await waitFor(ws, 'end', n);
  }

  console.log('better stats meet better players');
  {
    // star (OVR 87) and two at 60: with a rank gap of 135 the two 60s are matched first
    const a = connect('rookie2'), b = socks.rookie, c = socks.star;
    await sleep(300);
    const na = a.got.length, nb = b.got.length, nc = c.got.length;
    c.msg({ t: 'queue', format: '1v1' });
    await sleep(50);
    a.msg({ t: 'queue', format: '1v1' });
    await sleep(50);
    b.msg({ t: 'queue', format: '1v1' });
    const sa = await waitFor(a, 'start', na, 8000);
    const room = sa && game._roomOf('rookie2');
    const ids = room ? room.seats.filter((s) => s.human).map((s) => s.userId).sort() : [];
    check('the two 60s play each other, not the 87', JSON.stringify(ids) === JSON.stringify(['rookie', 'rookie2']), ids);
    if (room) { await finishWith('rookie2', 1, 1); await waitFor(a, 'end', na); }
    c.msg({ t: 'unqueue' });
    await sleep(200);
  }

  console.log('a broken save cannot make a superhuman');
  {
    const ws = connect('champ');
    const n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1' });
    const st = await waitFor(ws, 'start', n);
    check('levels are clamped (and nonsense is 0)', st && st.stats.spd <= 2000 && st.stats.sht === 0 && st.stats.pas === 0, st && st.stats);
    const p = game._roomOf('champ').seats.find((s) => s.userId === 'champ').player;
    check('speed tops out where it should', p && p.attr.speed <= 1 + 1.6 * 0.08 + 1e-9, p && p.attr.speed);
    await finishWith('champ', 0, 1);
    await waitFor(ws, 'end', n);
  }

  console.log('the online Champions Cup: its own run, apart from the World Cup');
  {
    // (a fresh connection: the server drops one that has been quiet for a minute, as a phone's would be)
    const ws = connect('star');
    ws.msg({ t: 'arena', club: 'madridblanco' });
    await sleep(200);
    let n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1', wc: true, cup: 'cc' });
    const q = await waitFor(ws, 'queue', n);
    check('queued for the Champions Cup round of 16', q && q.wc === 0 && q.cup === 'cc', q && { wc: q.wc, cup: q.cup });
    const st = await waitFor(ws, 'start', n);
    check('the match says it is the Champions Cup', st && st.wc === 0 && st.cup === 'cc', st && { wc: st.wc, cup: st.cup });
    const room = await finishWith('star', 2, 0);
    check('no draws in a cup match', room.m.noDraw === true);
    const end = await waitFor(ws, 'end', n);
    check('won: through to the quarter-final of the Champions Cup', end && end.cup === 'cc' && end.wc && end.wc.won && end.wc.next === 1, end && { cup: end.cup, wc: end.wc });
    check('the Champions Cup run moved on, the World Cup run did not', runs.star.cc.round === 1 && !(runs.star.wc && runs.star.wc.round), runs.star);
    // and a World Cup round now is round of 16, whatever the Champions Cup is up to
    ws.msg({ t: 'arena', club: null });
    await sleep(200);
    n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1', wc: true });
    const q2 = await waitFor(ws, 'queue', n);
    check('the World Cup is still at its own round of 16', q2 && q2.wc === 0 && q2.cup === 'wc', q2 && { wc: q2.wc, cup: q2.cup });
    ws.msg({ t: 'unqueue' });
    await sleep(200);
    // walking off a Champions Cup match knocks you out of the Champions Cup only
    ws.msg({ t: 'arena', club: 'madridblanco' });
    await sleep(100);
    n = ws.got.length;
    ws.msg({ t: 'queue', format: '1v1', wc: true, cup: 'cc' });
    const st2 = await waitFor(ws, 'start', n);
    check('the next one is the quarter-final', st2 && st2.wc === 1 && st2.cup === 'cc', st2 && { wc: st2.wc, cup: st2.cup });
    const r2 = game._roomOf('star');
    while (r2.m.phase !== 'play') await sleep(50);
    ws.msg({ t: 'leave' });
    await sleep(300);
    check('walking off: out of the Champions Cup', runs.star.cc.round === 0, runs.star.cc);
  }

  console.log(failures ? `\n${failures} FAILED` : '\nall good');
  process.exit(failures ? 1 : 0);
})();
