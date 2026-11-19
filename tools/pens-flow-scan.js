'use strict';
// Online shootout flow (build 125) — node tools/pens-flow-scan.js
//
// The kick as it happens on the real server code (fake sockets): the ball is struck straight after
// the shooter lets go, never waiting for the keeper; the keeper can dive before the kick or while the
// ball is in the air; the result comes the moment the dive is in, or when the ball gets there; a
// filled-in taker lines it up and runs at it; a filled-in keeper never holds anything up; the shot
// clock running out takes a soft one for you; and nothing out of turn or twice changes anything.
const { createGame } = require('../server/game');
const PenModel = require('../server/pens');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(e, f) { this.handlers[e] = f; }
  send(s) { const m = typeof s === 'string' ? JSON.parse(s) : s; m._at = Date.now(); this.got.push(m); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(m) { this.lastSeen = Date.now(); this.handlers.message(m); }
  since(n, t) { return this.got.slice(n).filter((m) => m.t === t); }
}
const records = [];
const game = createGame({
  getUser: (id) => ({ name: id.toUpperCase(), club: 'spain', save: { character: 'street' } }),
  userName: (id) => id.toUpperCase(), saveDB: () => {}, isNameTaken: () => false,
  onlineRecord: (id, r) => { records.push({ id, ...r }); return 0; },
  league: { move: () => {}, result: () => {}, pos: () => 1 },
});
const connect = (id) => { const ws = new FakeWS(); game.connect(ws, id); return ws; };
let fails = 0;
const check = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d === undefined ? '' : '  ' + JSON.stringify(d)}`); if (!ok) fails++; };
async function waitFor(ws, type, from = 0, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const m = ws.since(from, type)[0]; if (m) return m; await sleep(3); } return null; }
const flightMs = (shot) => (shot.out === 'wall' ? shot.T * (PenModel.FK.AT / PenModel.FK.DIST) : shot.T) * 1000;

// two people in a private shootout; returns their sockets, sides and the room once it is playing
async function pair(x, y) {
  const a = connect(x), b = connect(y);
  a.msg({ t: 'room.create', format: 'pens' }); const code = a.got.filter((m) => m.t === 'room').pop().code;
  b.msg({ t: 'room.join', code }); b.msg({ t: 'room.team', team: 'red' }); a.msg({ t: 'room.start' });
  const sa = await waitFor(a, 'pen.start'), sb = await waitFor(b, 'pen.start');
  const room = game._roomOf(x);
  room.startAt = 0;   // skip the VS card
  await waitFor(a, 'pen.turn');
  return { a, b, sa, sb, room };
}
// whose turn it is: the shooter's socket and the keeper's
function roles(P) {
  const team = P.room.pen.model.team;
  return P.sa.side === team ? { shooter: P.a, keeper: P.b } : { shooter: P.b, keeper: P.a };
}
// to the start of the next kick, without the pause between kicks
async function nextTurn(P) {
  const from = P.a.got.length;
  if (P.room.pen.phase === 'result') P.room.pen.nextAt = 0;
  await waitFor(P.a, 'pen.turn', from, 4000);
}

(async () => {
  console.log('two people: the ball never waits for the keeper');
  const P = await pair('fa', 'fb');
  {
    const turn = P.a.got.filter((m) => m.t === 'pen.turn').pop();
    check('a turn says how long the shooter has, in time left (not a clock to compare with)', turn.in === 10000 && turn.deadline > 0, { in: turn.in });
    const { shooter, keeper } = roles(P);
    const n0 = shooter.got.length, k0 = keeper.got.length;
    await sleep(700);
    const t0 = Date.now();
    shooter.msg({ t: 'pen.shot', ax: 0.7, az: 0.4, power: 0.7 });
    const run = await waitFor(keeper, 'pen.runup', k0, 500);
    check('the keeper sees the run-up start at once', !!run && run._at - t0 < 30 && run.ms === 300, run && { after: run._at - t0, ms: run.ms });
    const kick = await waitFor(shooter, 'pen.kick', n0, 1000);
    check('the ball is struck after the run-up, with no dive from the keeper yet', !!kick && kick._at - t0 >= 290 && kick._at - t0 < 380 && kick.dive === null, kick && { after: kick._at - t0, dive: kick.dive });
    const kickK = await waitFor(keeper, 'pen.kick', k0, 100);
    check('both see the same strike', !!kickK && JSON.stringify(kickK.shot) === JSON.stringify(kick.shot));
    const res = await waitFor(shooter, 'pen.result', n0, 3000);
    const want = flightMs(kick.shot) + 120;
    check('with no dive, the result comes when the ball gets there (not after the 10 s clock)', !!res && res._at - kick._at >= want - 10 && res._at - kick._at < want + 40, res && { after: res._at - kick._at, want: Math.round(want) });
    check('the keeper stood where they were (no dive sent to anyone)', !!res && res.dive === null, res && res.dive);
    const resK = await waitFor(keeper, 'pen.result', k0, 100);
    check('both get the same result', !!resK && resK.result === res.result && resK.n === res.n);
  }
  await nextTurn(P);
  {
    const { shooter, keeper } = roles(P);
    const n0 = shooter.got.length;
    await sleep(700);
    keeper.msg({ t: 'pen.dive', dx: 1, dz: 0.2, lt: -1 });
    await sleep(150);
    const t0 = Date.now();
    shooter.msg({ t: 'pen.shot', ax: -0.75, az: 0.3, power: 0.65 });
    const kick = await waitFor(shooter, 'pen.kick', n0, 1000), res = await waitFor(shooter, 'pen.result', n0, 1000);
    check('a keeper who went before the kick: their dive goes with the strike', !!kick && !!kick.dive && kick.dive.dx === 1 && kick.dive.td < -0.3, kick && kick.dive);
    check('and the result comes with it, straight away', !!res && !!kick && res._at - kick._at < 10 && res._at - t0 < 380, res && kick && { afterKick: res._at - kick._at });
    check('the dive in the result is the same one', !!res && !!res.dive && res.dive.td === kick.dive.td);
  }
  await nextTurn(P);
  {
    const { shooter, keeper } = roles(P);
    const n0 = shooter.got.length;
    await sleep(700);
    shooter.msg({ t: 'pen.shot', ax: 0.2, az: 0.5, power: 0.3 });
    const kick = await waitFor(shooter, 'pen.kick', n0, 1000);
    await sleep(80);
    keeper.msg({ t: 'pen.dive', dx: -1, dz: 0.3, lt: 0.05 });
    const res = await waitFor(shooter, 'pen.result', n0, 1000);
    const arrived = res && (res._at - kick._at) / 1000;
    check('a dive while the ball is in the air settles it there and then', !!res && arrived < flightMs(kick.shot) / 1000, res && { arrived, flight: flightMs(kick.shot) / 1000 });
    check('it is credited with when the keeper saw the strike, as far as the trip allows', !!res && !!res.dive && res.dive.td >= arrived - 0.25 - 0.01 && res.dive.td <= arrived + 0.01, res && res.dive && { td: res.dive.td, arrived });
  }
  await nextTurn(P);
  {
    const { shooter, keeper } = roles(P);
    const n0 = shooter.got.length;
    await sleep(700);
    shooter.msg({ t: 'pen.shot', ax: 0.9, az: 0.2, power: 0.2 });
    const kick = await waitFor(shooter, 'pen.kick', n0, 1000);
    await sleep(Math.min(300, flightMs(kick.shot) - 30));
    keeper.msg({ t: 'pen.dive', dx: 1, dz: 0, lt: 0 });   // claims it went the instant it saw it
    const res = await waitFor(shooter, 'pen.result', n0, 1000);
    const arrived = res && (res._at - kick._at) / 1000;
    check('a dive cannot claim more than the allowance for the trip', !!res && !!res.dive && res.dive.td >= arrived - 0.25 - 0.01, res && res.dive && { td: res.dive.td, arrived });
  }
  await nextTurn(P);
  {
    const { shooter, keeper } = roles(P);
    const n0 = shooter.got.length, before = JSON.stringify(P.room.pen.model.kicks);
    await sleep(700);
    keeper.msg({ t: 'pen.shot', ax: 0, az: 0.5, power: 1 });
    shooter.msg({ t: 'pen.dive', dx: 1, dz: 0 });
    await sleep(50);
    check('the keeper cannot shoot and the shooter cannot dive', P.room.pen.phase === 'input' && !P.room.pen.pending.shot && !P.room.pen.pending.dive);
    keeper.msg({ t: 'pen.dive', dx: 'x', dz: null, lt: 'junk' });
    keeper.msg({ t: 'pen.dive', dx: 1, dz: 0, lt: 0 });
    check('only the first dive counts (even a junk one)', P.room.pen.pending.dive && P.room.pen.pending.dive.dx !== 1);
    shooter.msg({ t: 'pen.shot', ax: 'junk', az: {}, power: -5 });
    shooter.msg({ t: 'pen.shot', ax: 1, az: 1, power: 1 });
    const res = await waitFor(shooter, 'pen.result', n0, 2000);
    check('a junk kick and a junk dive still make a kick', !!res && ['goal', 'save', 'wide', 'over', 'post', 'bar', 'postIn', 'barIn'].includes(res.result), res && res.result);
    check('one kick was taken, not two', !!res && JSON.parse(before)[res.team].length + 1 === res.kicks[res.team].length);
    const n1 = shooter.got.length;
    keeper.msg({ t: 'pen.dive', dx: 1, dz: 0 }); shooter.msg({ t: 'pen.shot', ax: 0, az: 0, power: 1 });
    await sleep(40);
    check('nothing sent after the result changes it', shooter.since(n1, 'pen.result').length === 0 && P.room.pen.phase === 'result');
  }
  await nextTurn(P);
  {
    const { shooter } = roles(P);
    const n0 = shooter.got.length;
    P.room.pen.deadline = Date.now() + 200;   // the shot clock runs out
    const run = await waitFor(shooter, 'pen.runup', n0, 1500), res = await waitFor(shooter, 'pen.result', n0, 2500);
    check('the clock running out takes a soft one for you, through the same run-up', !!run && run.ms === 300 && !!res, run && { ms: run.ms });
  }
  P.a.msg({ t: 'leave' }); await sleep(30); P.a.close(); P.b.close();

  console.log('a filled-in player on the other side');
  {
    const c = connect('fc'), cn = c.got.length; c.msg({ t: 'queue', format: 'pens' });
    const qe = game._social.queues.pens[0]; qe.at -= 40000; qe.wait = 30000;
    const st = await waitFor(c, 'pen.start', cn, 2500), room = game._roomOf('fc');
    check('a room with one filled spot', !!st && !!room && room.seats.some((s) => !s.human));
    room.startAt = 0;
    let botShots = 0, botKeeps = 0, waitsOk = true, lineUps = [], runs = [], keeps = [];
    let next = cn;
    for (let k = 0; k < 6; k++) {
      const turn = await waitFor(c, 'pen.turn', next, 4000);
      if (!turn) { waitsOk = false; break; }
      const from = c.got.indexOf(turn) + 1;
      next = from;
      if (turn.team !== st.side) {
        // their kick: a filled-in taker lines it up, runs at it, and it is struck, whether or not you dive
        botShots++;
        const run = await waitFor(c, 'pen.runup', from, 3500), kick = await waitFor(c, 'pen.kick', from, 1500), res = await waitFor(c, 'pen.result', from, 2000);
        if (!run || !kick || !res) { waitsOk = false; break; }
        lineUps.push(run._at - turn._at); runs.push(kick._at - run._at);
      } else {
        // your kick: a filled-in keeper never holds anything up
        botKeeps++;
        await sleep(700);
        c.msg({ t: 'pen.shot', ax: 0.6, az: 0.4, power: 0.7 });
        const kick = await waitFor(c, 'pen.kick', from, 1000), res = await waitFor(c, 'pen.result', from, 1000);
        if (!kick || !res) { waitsOk = false; break; }
        keeps.push(res._at - kick._at);
        if (!(kick.dive && kick.dive.td > 0.1 && kick.dive.td < 0.31)) waitsOk = false;
      }
      if (room.state !== 'playing' || room.pen.phase === 'end') break;
      if (room.pen.phase === 'result') room.pen.nextAt = 0;
    }
    check('every kick went through on its own', waitsOk && botShots > 0 && botKeeps > 0, { botShots, botKeeps });
    check('a filled-in taker lines it up for a moment (1.2 to 2.2 s), not at once and not for long', lineUps.length > 0 && lineUps.every((t) => t >= 1200 && t < 2250), lineUps);
    check('and takes a proper run at it (0.9 s)', runs.length > 0 && runs.every((t) => t >= 890 && t < 990), runs);
    check('a filled-in keeper dives as the ball is struck: the result is there at once', keeps.length > 0 && keeps.every((t) => t < 10), keeps);
    c.msg({ t: 'leave' }); await sleep(30); c.close();
  }

  console.log('back after a dropped connection mid-kick');
  {
    const Q = await pair('fd', 'fe');
    const { shooter } = roles(Q);
    await sleep(700);
    shooter.msg({ t: 'pen.shot', ax: 0.5, az: 0.5, power: 0.6 });
    await sleep(50);
    const keeperId = Q.sa.side === Q.room.pen.model.team ? 'fe' : 'fd';
    (keeperId === 'fd' ? Q.a : Q.b).close();
    const again = connect(keeperId), back = await waitFor(again, 'pen.start', 0, 1000);
    check('the view of the shootout says where it is (run-up), with no shot clock to count', !!back && back.state.phase === 'runup' && back.state.in === 0, back && { phase: back.state.phase, in: back.state.in });
    const res = await waitFor(again, 'pen.result', 0, 2000);
    check('and the result still reaches them', !!res);
    again.msg({ t: 'leave' }); await sleep(30); again.close(); (keeperId === 'fd' ? Q.b : Q.a).close();
  }

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
