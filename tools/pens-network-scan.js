'use strict';
const { createGame } = require('../server/game');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(e, f) { this.handlers[e] = f; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(m) { this.lastSeen = Date.now(); this.handlers.message(m); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
  count(t) { return this.got.filter((m) => m.t === t).length; }
}
const records = [], moves = [], pwcRuns = { f: { round: 3, titles: 0 }, g: { round: 3, titles: 0 } };
const game = createGame({
  getUser: (id) => ({ name: id.toUpperCase(), club: id === 'a' ? 'spain' : 'brazil', save: { character: 'street' } }),
  userName: (id) => id.toUpperCase(), saveDB: () => {}, isNameTaken: () => false,
  onlineRecord: (id, r) => records.push({ id, ...r }),
  penaltyWorldCup: { round: (id) => (pwcRuns[id] || { round: 0 }).round, result: (id, won) => { const w = pwcRuns[id] || (pwcRuns[id] = { round: 0, titles: 0 }); const champion = won && w.round === 3; w.round = won && !champion ? w.round + 1 : 0; if (champion) w.titles++; return { round: w.round, champion, titles: w.titles }; } },
  league: { move: () => {}, result: (x) => moves.push(x), pos: () => 1 },
});
const connect = (id) => { const ws = new FakeWS(); game.connect(ws, id); return ws; };
let fails = 0;
const check = (n, ok, d) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${n}${d === undefined ? '' : '  ' + JSON.stringify(d)}`); if (!ok) fails++; };
async function waitFor(ws, type, from = 0, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { for (let i = from; i < ws.got.length; i++) if (ws.got[i].t === type) return ws.got[i]; await sleep(15); } return null; }

(async () => {
  console.log('two real players use one authoritative shootout');
  const a = connect('a'), b = connect('b');
  a.msg({ t: 'room.create', format: 'pens' }); const code = a.last('room').code;
  b.msg({ t: 'room.join', code }); b.msg({ t: 'room.team', team: 'red' }); a.msg({ t: 'room.start' });
  const sa = await waitFor(a, 'pen.start'), sb = await waitFor(b, 'pen.start');
  check('both receive penalty start', sa && sb && sa.room === sb.room && sa.format === 'pens');
  check('opposite sides', sa.side !== sb.side, { a: sa.side, b: sb.side });
  let ai = a.got.length, bi = b.got.length, rounds = 0;
  while (!a.last('pen.end') && !b.last('pen.end') && rounds++ < 80) {
    const ta = await waitFor(a, 'pen.turn', ai, 6000); const tb = await waitFor(b, 'pen.turn', bi, 6000);
    if (!ta || !tb) break; ai = a.got.length; bi = b.got.length;
    const shooter = ta.team === sa.side ? a : b, keeper = shooter === a ? b : a;
    shooter.msg({ t: 'pen.shot', ax: rounds % 3 ? 0.78 : -0.76, az: 0.42, power: 0.72 });
    keeper.msg({ t: 'pen.dive', dx: rounds % 2 ? -1 : 1, dz: 0.12 });
    const ra = await waitFor(a, 'pen.result', ai, 1500); const rb = await waitFor(b, 'pen.result', bi, 1500);
    check(`kick ${rounds} synchronized`, ra && rb && ra.n === rb.n && ra.result === rb.result);
    ai = a.got.length; bi = b.got.length;
  }
  const ea = await waitFor(a, 'pen.end', 0, 5000), eb = await waitFor(b, 'pen.end', 0, 5000);
  check('shootout finishes for both', ea && eb && ea.winner === eb.winner, ea && { winner: ea.winner, score: ea.score });
  check('one win and one loss recorded', records.length === 2 && records.filter((r) => r.outcome === 'win').length === 1 && records.filter((r) => r.outcome === 'loss').length === 1, records);
  check('league updated once', moves.length === 1 && moves[0].length === 2, moves);
  check('no full-match snapshots leaked', a.count('s') === 0 && b.count('s') === 0);
  a.close(); b.close();

  console.log('public queue fills with a bot after the wait');
  const c = connect('c'), cn = c.got.length; c.msg({ t: 'queue', format: 'pens' });
  const qe = game._social.queues.pens[0]; qe.at -= 40000; qe.wait = 30000;
  const cs = await waitFor(c, 'pen.start', cn, 2500);
  check('single queued player gets a penalty room', cs && cs.players.some((p) => p.bot), cs && cs.players);
  c.msg({ t: 'leave' }); await sleep(50);

  console.log('online Penalty World Cup final advances and crowns a champion');
  const f = connect('f'), g = connect('g'), fn = f.got.length, gn = g.got.length;
  f.msg({ t: 'queue', format: 'pens', wc: true }); g.msg({ t: 'queue', format: 'pens', wc: true });
  const fs = await waitFor(f, 'pen.start', fn, 2500), gs = await waitFor(g, 'pen.start', gn, 2500);
  check('same-round finalists enter a penalty World Cup room', fs && gs && fs.wc === 3 && gs.wc === 3, fs && { f: fs.wc, g: gs.wc });
  let fi = f.got.length, gi = g.got.length, cupKicks = 0;
  while (!f.last('pen.end') && !g.last('pen.end') && cupKicks++ < 80) {
    const ft = await waitFor(f, 'pen.turn', fi, 6000), gt = await waitFor(g, 'pen.turn', gi, 6000);
    if (!ft || !gt) break; fi = f.got.length; gi = g.got.length;
    const shooter = ft.team === fs.side ? f : g, keeper = shooter === f ? g : f;
    shooter.msg({ t: 'pen.shot', ax: cupKicks % 3 ? 0.8 : -0.8, az: 0.45, power: 0.75 });
    keeper.msg({ t: 'pen.dive', dx: cupKicks % 2 ? -1 : 1, dz: 0.1 });
    await waitFor(f, 'pen.result', fi, 1500); await waitFor(g, 'pen.result', gi, 1500); fi = f.got.length; gi = g.got.length;
  }
  const fe = await waitFor(f, 'pen.end', 0, 5000), ge = await waitFor(g, 'pen.end', 0, 5000);
  const champ = [fe, ge].find((x) => x && x.wc && x.wc.champion), runner = [fe, ge].find((x) => x && x.wc && !x.wc.won);
  check('winner is champion and both next runs reset', champ && champ.wc.next === 0 && champ.wc.titles === 1 && runner && runner.wc.next === 0, { champion: champ && champ.wc, runner: runner && runner.wc });
  f.close(); g.close();
  console.log('private penalty room reconnects and forfeits cleanly');
  const d = connect('d'), e = connect('e'); d.msg({ t: 'room.create', format: 'pens' }); const code2 = d.last('room').code;
  e.msg({ t: 'room.join', code: code2 }); e.msg({ t: 'room.team', team: 'red' }); d.msg({ t: 'room.start' });
  await waitFor(d, 'pen.start'); await waitFor(e, 'pen.start'); await sleep(200);
  e.close(); const e2 = connect('e'), resumed = await waitFor(e2, 'pen.start', 0, 1000);
  check('reconnect restores the authoritative shootout', resumed && resumed.room === d.last('pen.start').room && resumed.state, resumed && resumed.state);
  const before = records.length; e2.msg({ t: 'leave' }); const de = await waitFor(d, 'pen.end', 0, 1000);
  check('leaving awards the opponent a forfeit win', de && de.forfeit && de.outcome === 'win', de && { outcome: de.outcome, forfeit: de.forfeit });
  check('forfeit records winner and leaver once', records.length === before + 2 && records.slice(before).some((r) => r.id === 'd' && r.outcome === 'win') && records.slice(before).some((r) => r.id === 'e' && r.outcome === 'loss'), records.slice(before));
  d.close(); e2.close();
  if (fails) process.exitCode = 1; else console.log('all online penalty integration checks passed');
})();
