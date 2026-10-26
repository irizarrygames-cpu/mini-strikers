// Free kicks, in numbers: thousands of kicks through the real models (js/penalty.js for playing
// against the computer, server/pens.js for online), plus an online free-kick shootout run through
// the real server game code with fake sockets.
//   node tools/fkscan.js [kicks]
// What it is for: a free kick has to reward the right idea (soft and high over the wall, or round
// it on the keeper's side) and punish the wrong one (hard and low into the wall), and it should go
// in less often than a penalty, but not so rarely that it is no fun.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const Server = require('../server/pens');
const { createGame } = require('../server/game');

const N = Number(process.argv[2]) || 20000;
const ctx = { console, Math, Object, Array, Number, String, JSON, Set, Map };
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/penalty.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n;this.PEN = typeof PEN !== "undefined" ? PEN : this.PEN; this.PEN_LEVELS = typeof PEN_LEVELS !== "undefined" ? PEN_LEVELS : this.PEN_LEVELS; this.rand = rand;', ctx, { filename: f });
const { PEN, PEN_LEVELS, rand } = ctx;
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const pctN = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const side = () => (Math.random() < 0.5 ? -1 : 1);

// one of your free kicks against the bot keeper: 'goal' | 'save' | 'wall' | 'miss'
function yourFk(aimFor, q, read) {
  const wall = PEN.fkWall(), kx = -wall.side * PEN.FK.KX;
  const [ax, az, power] = aimFor(wall);
  const k = PEN.kick(ax, az, power, q, 0, wall);
  if (k.out === 'wall') return 'wall';
  const could = k.out === 'in' || ((k.out === 'post' || k.out === 'bar') && k.postIn);
  if (!could) return 'miss';
  return PEN.saves(PEN.fkBotDive(k, read, wall), kx, PEN.saveT(k), k.x, k.z) ? 'save' : 'goal';
}
function yourPen(ax, az, power, q, read) {
  const k = PEN.kick(ax, az, power, q);
  const could = k.out === 'in' || ((k.out === 'post' || k.out === 'bar') && k.postIn);
  if (!could) return 'miss';
  return PEN.saves(PEN.botDive(k, read), 0, k.T, k.x, k.z) ? 'save' : 'goal';
}
// theirs against you in goal: 'react' (the right way, roughly, rt seconds after you can see it) or
// 'stay' (never dive)
function theirFk(bot, rt, how = 'react') {
  const wall = PEN.fkWall(), kx = -wall.side * PEN.FK.KX;
  const a = PEN.fkBotAim(bot.aim, wall);
  const k = PEN.kick(a.ax, a.az, a.power, bot.q, PEN.BOT_SLOW, wall);
  if (k.out === 'wall') return 'wall';
  const dx = k.x - kx, dz = k.z - PEN.K.hip, l = Math.hypot(dx, dz) || 1, ang = Math.atan2(dz / l, dx / l) + PEN.gauss() * 0.35;
  const dive = how === 'stay' || Math.abs(dx) < 0.45 ? null : { dx: Math.cos(ang), dz: Math.sin(ang), td: rt + (k.covered ? PEN.FK.SCREEN : PEN.FK.SCREEN_OPEN), v: PEN.PLAYER_DIVE };
  const could = k.out === 'in' || ((k.out === 'post' || k.out === 'bar') && k.postIn);
  if (!could) return 'miss';
  return PEN.saves(dive, kx, k.T, k.x, k.z) ? 'save' : 'goal';
}
function tally(fn, n = N) { const r = { goal: 0, save: 0, wall: 0, miss: 0 }; for (let i = 0; i < n; i++) r[fn()]++; return r; }
const show = (r, n = N) => `in ${pctN(r.goal, n)}%  saved ${pctN(r.save, n)}%  wall ${pctN(r.wall, n)}%  missed ${pctN(r.miss, n)}%`;

(async () => {
  const q = 0.5, read = PEN_LEVELS.normal.read;
  console.log(`YOUR FREE KICKS vs a normal keeper (${N} each, an average finisher)`);
  const ways = {
    over: ['soft and high, over the wall into its corner', (w) => [w.side * rand(0.6, 0.85), rand(0.78, 0.95), rand(0.38, 0.52)]],
    round: ["firm, round the wall on the keeper's side", (w) => [-w.side * rand(0.55, 0.85), rand(0.15, 0.6), rand(0.6, 0.78)]],
    lowWall: ['hard and low at the wall side', (w) => [w.side * rand(0.4, 0.8), rand(0.05, 0.35), rand(0.7, 0.9)]],
    hardHigh: ['hard and high at the wall side', (w) => [w.side * rand(0.5, 0.8), rand(0.7, 0.9), rand(0.82, 0.95)]],
    middle: ['straight at the middle', () => [rand(-0.1, 0.1), rand(0.2, 0.6), 0.65]],
    random: ['a kid mashing: random aim, random power', () => [rand(-1, 1), rand(0, 1), rand(0.3, 1)]],
  };
  const res = {};
  for (const [key, [name, f]] of Object.entries(ways)) { res[key] = tally(() => yourFk(f, q, read)); console.log(`  ${name.padEnd(46)} ${show(res[key])}`); }
  const pen = tally(() => yourPen(side() * rand(0.5, 0.7), rand(0.3, 0.6), 0.7, q, read));
  console.log(`  ${'(a penalty, halfway to the post, firm)'.padEnd(46)} ${show(pen)}`);

  console.log('\nwhat the numbers have to say');
  check('soft and high over the wall is a real chance (25-60% in)', pctN(res.over.goal, N) >= 25 && pctN(res.over.goal, N) <= 60, pctN(res.over.goal, N));
  check("round it on the keeper's side is a real chance too (25-60%)", pctN(res.round.goal, N) >= 25 && pctN(res.round.goal, N) <= 60, pctN(res.round.goal, N));
  check('hard and low into the wall nearly always hits it (70%+)', pctN(res.lowWall.wall, N) >= 70, pctN(res.lowWall.wall, N));
  check('blasting it high at the wall side does not work either (under 25% in)', pctN(res.hardHigh.goal, N) < 25, pctN(res.hardHigh.goal, N));
  check('the best free kick goes in less often than a penalty', Math.max(pctN(res.over.goal, N), pctN(res.round.goal, N)) < pctN(pen.goal, N), [pctN(res.over.goal, N), pctN(res.round.goal, N), pctN(pen.goal, N)]);
  check('mashing scores less than thinking about it', pctN(res.random.goal, N) < Math.min(pctN(res.over.goal, N), pctN(res.round.goal, N)), pctN(res.random.goal, N));

  console.log('\nTHEIR FREE KICKS vs you in goal (normal takers)');
  const bot = PEN_LEVELS.normal;
  const theirs = {};
  // (a free kick is in the air long enough that a keeper who goes the right way is always there in
  // time: what decides it is going the right way at all)
  for (const rt of [0.2, 0.4]) { theirs[rt] = tally(() => theirFk(bot, rt)); console.log(`  you dive the right way ${rt}s after you see it`.padEnd(48) + show(theirs[rt])); }
  theirs.stay = tally(() => theirFk(bot, 0, 'stay'));
  console.log('  you never dive'.padEnd(48) + show(theirs.stay));
  check('a keeper who dives the right way saves a fair share (they score under 60%)', pctN(theirs[0.2].goal, N) < 60, pctN(theirs[0.2].goal, N));
  check('a keeper who never dives is beaten far more often', pctN(theirs.stay.goal, N) > pctN(theirs[0.2].goal, N) + 10, [pctN(theirs[0.2].goal, N), pctN(theirs.stay.goal, N)]);

  console.log('\nthe online model says the same as the offline one');
  {
    // the deterministic parts: blocked or not, and the time the keeper gets
    let same = 0, n = 0;
    for (let i = 0; i < 4000; i++) {
      const wall = { side: side(), jump: Math.random() < 0.5 };
      const power = rand(0.2, 1), z = rand(0.1, 2.6), x = rand(-4.5, 4.5);
      const off = PEN.fkCovered(x, wall) && PEN.fkAtWall(z, power) < PEN.fkTop(wall);
      const on = Server.fkCovered(x, wall) && Server.fkAtWall(z, power) < Server.fkTop(wall);
      n++; if (off === on) same++;
    }
    check('blocked by the wall: the same answer every time', same === n, `${same}/${n}`);
    check('the same numbers for the wall and the keeper', JSON.stringify(Server.FK) === JSON.stringify(PEN.FK), [Server.FK, PEN.FK]);
    const s = Server.create(12345, 'fk');
    check('an online free-kick shootout starts with a wall', !!(s.wall && (s.wall.side === 1 || s.wall.side === -1)), s.wall);
    let walls = 0, kicks = 0, finished = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const st = Server.create(seed, 'fk');
      while (!st.winner && st.n < 200) {
        const w = st.wall, r = Server.resolve(st, { ax: w.side * 0.6, az: Math.random(), power: Math.random() }, { dx: -w.side, dz: 0.2, td: 0.25 }, 0.6);
        kicks++; if (r.result === 'wall') walls++;
        if (!r.winner && !(st.wall && st.wall.side)) { check('every kick has a wall', false, seed); break; }
      }
      if (st.winner) finished++;
    }
    check('3000 online free-kick shootouts all finish', finished === 3000, finished);
    check('online, the wall blocks some kicks (and not all)', walls > 0 && walls < kicks, { walls, kicks });
    const p = Server.create(7, 'pens');
    check('a penalty shootout has no wall', !p.wall, p.wall);
  }

  console.log('\nan online free-kick shootout through the real server');
  {
    class FakeWS {
      constructor() { this.open = true; this.handlers = {}; this.got = []; this.lastSeen = Date.now(); }
      on(e, f) { this.handlers[e] = f; } removeListener() {}
      send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
      close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
      msg(m) { this.lastSeen = Date.now(); this.handlers.message(m); }
      last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
    }
    const records = [];
    const game = createGame({
      getUser: (id) => ({ name: id.toUpperCase(), club: id === 'fa' ? 'spain' : 'brazil', save: { character: 'street' } }),
      userName: (id) => id.toUpperCase(), saveDB: () => {}, isNameTaken: () => false,
      onlineRecord: (id, r) => { records.push({ id, ...r }); return 0; },
      league: { move: () => {}, result: () => {}, pos: () => 1 },
    });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const a = new FakeWS(), b = new FakeWS();
    game.connect(a, 'fa'); game.connect(b, 'fb');
    a.msg({ t: 'queue', format: 'fk' }); b.msg({ t: 'queue', format: 'fk' });
    let start = null;
    for (let i = 0; i < 100 && !start; i++) { await sleep(50); start = a.last('pen.start'); }
    check('two players queued for free kicks are put in one', !!start && !!b.last('pen.start'));
    check('it says it is a free-kick shootout', start && start.kind === 'fk' && start.format === 'fk', start && { kind: start.kind, format: start.format });
    // play it out: whoever is shooting shoots, whoever is in goal dives
    const seen = new Set();
    let end = null, guard = 0;
    while (!end && guard++ < 400) {
      for (const [ws, id] of [[a, 'fa'], [b, 'fb']]) {
        const turn = ws.last('pen.turn');
        if (turn && turn.wall) seen.add(turn.wall.side);
        const room = game._roomOf(id);
        if (!room || !room.pen || room.pen.phase !== 'input') continue;
        const mine = room.seats.find((s) => s.userId === id);
        const w = room.pen.model.wall;
        if (mine.team === room.pen.model.team) ws.msg({ t: 'pen.shot', ax: w.side * 0.7, az: Math.random(), power: Math.random() });
        else ws.msg({ t: 'pen.dive', dx: -w.side, dz: 0.3 });
      }
      // skip the pause between kicks
      for (const id of ['fa', 'fb']) { const r = game._roomOf(id); if (r && r.pen && (r.pen.phase === 'result' || r.pen.phase === 'end')) r.pen.nextAt = 0; if (r && r.state === 'intro') r.startAt = 0; }
      await sleep(15);
      end = a.last('pen.end');
    }
    const results = a.got.filter((m) => m.t === 'pen.result');
    check('the turns name the wall for the kick', seen.size > 0, [...seen]);
    check('the shootout finishes', !!end, end && { winner: end.winner, score: end.score });
    check('kicks come back with what happened, the wall included', results.length > 0 && results.every((r) => ['goal', 'save', 'wall', 'wide', 'over', 'post', 'bar', 'postIn', 'barIn'].includes(r.result)), [...new Set(results.map((r) => r.result))]);
    check('both players got an online record of it', records.filter((r) => r.id === 'fa' || r.id === 'fb').length === 2, records.length);
  }

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
