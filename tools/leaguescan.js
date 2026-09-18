// The league ladder: every online win moves your country up one place, every loss down one.
//   node tools/leaguescan.js
// Part 1 runs the ladder code from server.js on a made-up table; part 2 plays matches through the
// real server game code (fake sockets) and checks who moves, once per country per match.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createGame } = require('../server/game');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- part 1: the ladder itself ----------
console.log('the ladder (server.js)');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const a = src.indexOf('function pointsOrder()'), b = src.indexOf('const leaguePos =');
  if (b < 0) throw new Error('layout');
  const code = src.slice(a, src.indexOf('\n', b) + 1);
  const ctx = { CLUBS: ['aa', 'bb', 'cc', 'dd'].map((id) => ({ id })), LEAGUE_ID: '#league', DB: { users: {} }, saveDB: () => { ctx.saves++; }, saves: 0, leagueCache: null, Date, Math, Array, Map, Set, JSON };
  vm.createContext(ctx);
  vm.runInContext(code + ';this.api = { ladder, leagueMove, leagueResult, leaguePos, pointsOrder };', ctx);
  const { ladder, leagueMove, leagueResult, leaguePos } = ctx.api;
  // players: cc has the most points, then aa
  ctx.DB.users.p1 = { club: 'cc', online: { w: 5, d: 0, l: 0, gf: 9, ga: 1 } };
  ctx.DB.users.p2 = { club: 'aa', online: { w: 2, d: 1, l: 3, gf: 5, ga: 6 } };
  check('seeded from the points table', ladder().order.join() === 'cc,aa,bb,dd', ladder().order);
  check('the ladder is stored under its own id, not as a player', !!ctx.DB.users['#league'] && ctx.DB.users['#league'].order.length === 4);
  leagueMove('bb', 1);
  check('a win: up one place (swaps with the one above)', ladder().order.join() === 'cc,bb,aa,dd', ladder().order);
  leagueMove('bb', -1);
  check('a loss: down one place', ladder().order.join() === 'cc,aa,bb,dd', ladder().order);
  leagueMove('cc', 1);
  check('top of the table can\'t go higher', leaguePos('cc') === 1);
  leagueMove('dd', -1);
  check('bottom can\'t go lower', leaguePos('dd') === 4);
  leagueMove('dd', 1); leagueMove('dd', 1); leagueMove('dd', 1);
  check('three wins in a row: bottom to top', leaguePos('dd') === 1, ladder().order);
  check('last move remembered for the arrows', ctx.DB.users['#league'].last.dd.d === 1 && ctx.DB.users['#league'].last.bb.d === -1);
  ctx.CLUBS.push({ id: 'ee' });
  ctx.DB.users['#league'].order.push('aa'); // a duplicate that must be cleaned up
  check('a new country joins at the bottom, duplicates dropped', ladder().order.join() === 'dd,cc,aa,bb,ee', ladder().order);
  leagueMove('zz', 1);
  check('an unknown country is ignored', ladder().order.length === 5);
  // dd cc aa bb ee
  leagueResult([['cc', 1], ['dd', -1]]);
  check('neighbours play: they just swap (winner up one, loser down one)', ladder().order.join() === 'cc,dd,aa,bb,ee', ladder().order);
  leagueResult([['ee', 1], ['cc', -1]]);
  check('far apart: winner up one, loser down one', ladder().order.join() === 'dd,cc,aa,ee,bb' && leaguePos('ee') === 4 && leaguePos('cc') === 2, ladder().order);
}

// ---------- part 2: matches through the real server game ----------
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
}
const clubOf = { a1: 'spain', a2: 'spain', b1: 'brazil', c1: 'puertorico', d1: 'japan' };
const moves = [];
const order = ['brazil', 'spain', 'japan', 'puertorico'];
const swap = (club, d) => { const i = order.indexOf(club), j = i - Math.sign(d); if (i >= 0 && j >= 0 && j < order.length) [order[i], order[j]] = [order[j], order[i]]; };
const league = {
  move(club, d) { moves.push([club, d]); swap(club, d); },
  // like server.js: winners first; a loser the winner's swap already dropped doesn't drop again
  result(list) {
    const losers = new Set(list.filter(([, d]) => d < 0).map(([c]) => c)), dropped = new Set();
    for (const [c, d] of list) if (d > 0) { moves.push([c, d]); const i = order.indexOf(c); if (i > 0 && losers.has(order[i - 1])) dropped.add(order[i - 1]); swap(c, 1); }
    for (const [c, d] of list) if (d < 0) { moves.push([c, d]); if (!dropped.has(c)) swap(c, -1); }
  },
  pos: (club) => order.indexOf(club) + 1,
};
const game = createGame({ getUser: (id) => ({ club: clubOf[id] || 'argentina', save: {} }), userName: (id) => id.toUpperCase(), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false, league });
const socks = {};
const connect = (id) => { socks[id] = socks[id] || new FakeWS(); if (!socks[id].connected) { game.connect(socks[id], id); socks[id].connected = true; } return socks[id]; };
async function waitFor(ws, t, after, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(40); } return null; }
async function room(format, blue, red) {
  const all = [...blue, ...red];
  for (const id of all) connect(id);
  const host = blue[0];
  socks[host].msg({ t: 'room.create', format });
  const code = socks[host].last('room').code;
  for (const id of all.slice(1)) socks[id].msg({ t: 'room.join', code });
  for (const id of red) socks[id].msg({ t: 'room.team', team: 'red' });
  for (const id of blue) socks[id].msg({ t: 'room.team', team: 'blue' });
  const marks = Object.fromEntries(all.map((id) => [id, socks[id].got.length]));
  socks[host].msg({ t: 'room.start' });
  const r = game._roomOf(host);
  while (r.m.phase !== 'play') await sleep(40);
  return { r, marks };
}
async function finish({ r, marks }, blueGoals, redGoals, who) {
  r.m.score.blue = blueGoals; r.m.score.red = redGoals; r.m.time = 0.05;
  return waitFor(socks[who], 'end', marks[who]);
}

(async () => {
  console.log('matches through the server');
  {
    moves.length = 0;
    const g = await room('2v2', ['a1', 'a2'], ['b1']);
    const end = await finish(g, 2, 0, 'a1');
    await waitFor(socks.b1, 'end', g.marks.b1);
    check('two Spain players win together: Spain moves up once, Brazil down once', JSON.stringify(moves) === JSON.stringify([['spain', 1], ['brazil', -1]]), moves);
    check('the winners hear their new place', end && end.league && end.league.d === 1 && end.league.pos === 1, end && end.league);
    const lost = socks.b1.last('end');
    check('the loser hears it too', lost && lost.league && lost.league.d === -1 && lost.league.pos === 2, lost && lost.league);
  }
  {
    moves.length = 0;
    await sleep(200);
    const g = await room('1v1', ['c1'], ['d1']);
    const end = await finish(g, 1, 1, 'c1');
    // a level ordinary match goes to golden goal; settle it as a draw by running the clock out of overtime too
    if (!end) { g.r.m.otTime = 999; }
    const e2 = end || await waitFor(socks.c1, 'end', g.marks.c1, 5000);
    check('a draw moves nobody', moves.length === 0 && (!e2 || !e2.league || e2.league.d === 0), { moves, league: e2 && e2.league });
  }
  {
    moves.length = 0;
    await sleep(200);
    const g = await room('1v1', ['c1'], ['d1']);
    socks.d1.msg({ t: 'leave' });
    await sleep(300);
    check('walking off: your country goes down, theirs up', moves.some(([c, d]) => c === 'japan' && d === -1) && moves.some(([c, d]) => c === 'puertorico' && d === 1), moves);
    check('and only once each', moves.filter(([c]) => c === 'japan').length === 1, moves);
  }
  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
