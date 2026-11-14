// PRO MATCH (build 115): the bigger pitch and the real rules, played out by bots, headless.
//   node tools/rulesscan.js
// Loads the real game code into the server's sandbox (plus js/rules.js, which only offline matches
// use), switches to the PRO pitch and plays whole matches in every format, checking that:
//   * the ball going out is always turned into the right restart (a throw-in to the side that did
//     not touch it last; a corner or a goal kick by who touched it last), taken from the right spot
//   * every restart is taken, quickly, and play goes on (nothing gets stuck)
//   * the other side keeps its distance while a restart is set up, and the clock stops
//   * the ball never leaves the arena and nothing goes NaN
//   * nobody scores straight from a throw-in
//   * and the normal pitch is untouched by any of it (back to 2400 x 1400 afterwards)
const fs = require('fs');
const path = require('path');
const { createSim } = require('../server/sim');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };

const sim = createSim();
sim.run('globalThis.Rules = Rules;'); // (js/rules.js is in the sandbox: the server plays PRO rooms with it)
// the sandbox has no screen: the banner and the whistle go nowhere
sim.run('Game.headless = true; Game.demo = null;');

const normal = sim.run('({ W: CFG.FIELD_W, H: CFG.FIELD_H, walls: WALLS.length, gy1: GOAL_Y1 })');
sim.run("Pitch.use('pro')");
const pro = sim.run('({ W: CFG.FIELD_W, H: CFG.FIELD_H, walls: WALLS.length, gy1: GOAL_Y1, gy2: GOAL_Y2, side: CFG.SIDE_M, end: CFG.END_M, chamfer: CFG.CHAMFER })');
check('the PRO pitch is a quarter bigger each way', pro.W === 3000 && pro.H === 1750, pro);
check('its goals are centred on it', Math.abs((pro.gy1 + pro.gy2) / 2 - pro.H / 2) < 1e-9, pro);
// a corner taker stands behind the ball, outside the corner of the pitch: that spot has to be inside the boards
const room = sim.run(`(() => { const ins = (x, y) => insideArena(x, y); return [ins(-14, -14), ins(CFG.FIELD_W + 14, -14), ins(-14, CFG.FIELD_H + 14), ins(CFG.FIELD_W + 14, CFG.FIELD_H + 14), ins(1500, -20)]; })()`);
check('there is room behind every corner flag, and outside the touchline for a throw', room.every(Boolean), room);

sim.run(`
globalThis.__play = function (format, seed) {
  let s = seed >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const m = Match.create({ autopilot: true, mode: 'pro', format, minutes: 2 });
  const log = { restarts: [], wrong: [], stuck: 0, maxSetup: 0, crowd: 0, clockMoved: 0, outside: 0, nan: 0, throwGoals: 0, goals: 0, steps: 0, outs: 0, rules: m.rules };
  let setup = 0, lastPhase = m.phase, clockAt = 0, lastOutBy = null;
  const origStart = Rules.start.bind(Rules);
  Rules.start = function (mm) {
    const b = mm.ball, W = CFG.FIELD_W, H = CFG.FIELD_H, last = b.lastTouchTeam;
    const was = { x: b.x, y: b.y, last };
    origStart(mm);
    const R = mm.restart; log.outs++;
    if (!R) { log.wrong.push(['no restart', was]); return; }
    let want;
    if (was.y < -CFG.BALL_R || was.y > H + CFG.BALL_R) want = { kind: 'throw', team: last === 'blue' ? 'red' : 'blue' };
    else {
      const leftEnd = was.x < W / 2, defending = ownGoalX('blue') === (leftEnd ? 0 : W) ? 'blue' : 'red';
      want = last === defending ? { kind: 'corner', team: defending === 'blue' ? 'red' : 'blue' } : { kind: 'goalkick', team: defending };
    }
    if (R.kind !== want.kind || R.team !== want.team) log.wrong.push(['restart', R.kind, R.team, want, was]);
    if (R.kind === 'goalkick' && !R.taker.isKeeper) log.wrong.push(['goal kick not by the keeper']);
    if (R.kind !== 'goalkick' && R.taker.isKeeper) log.wrong.push(['keeper taking a ' + R.kind]);
    if (R.taker.team !== R.team) log.wrong.push(['taker from the wrong side']);
    if (R.kind === 'throw' && !(R.by === 0 || R.by === H)) log.wrong.push(['throw not on the line', R.by]);
    if (R.kind === 'corner' && !((R.bx < 20 || R.bx > W - 20) && (R.by < 20 || R.by > H - 20))) log.wrong.push(['corner not at a flag', R.bx, R.by]);
    log.restarts.push(R.kind);
  };
  const origGoal = Match.goalScored.bind(Match);
  Match.goalScored = function (mm, team) {
    log.goals++;
    if (mm.ball.restartKind === 'throw' && mm.ball.restartBy && mm.ball.lastKicker === mm.ball.restartBy && mm.ball.lastTouchTeam === mm.ball.restartBy.team) log.throwGoals++;
    return origGoal(mm, team);
  };
  // the bots keep it in the middle, so now and then somebody hoofs it towards a line (the way you would)
  let guard = 0, hoofIn = 2;
  const hoof = () => {
    const b = m.ball, W = CFG.FIELD_W, H = CFG.FIELD_H;
    let p = b.owner;
    if (!p) { let best = 1e9; for (const q of m.players) { const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < best) { best = d; p = q; } } }
    if (!p || p.isKeeper) return;
    if (b.owner) loseBall(m, b.owner, 0.5);
    const side = Math.floor(Math.random() * 4);
    const tx = side < 2 ? b.x + (Math.random() - 0.5) * 900 : (side === 2 ? -80 : W + 80);
    const ty = side === 0 ? -80 : side === 1 ? H + 80 : (Math.random() < 0.5 ? Math.random() * GOAL_Y1 * 0.9 : H - Math.random() * GOAL_Y1 * 0.9);
    const d = Math.hypot(tx - b.x, ty - b.y) || 1, sp = 700 + Math.random() * 700;
    b.vx = (tx - b.x) / d * sp; b.vy = (ty - b.y) / d * sp; b.vz = Math.random() < 0.3 ? 200 : 0;
    b.lastKicker = p; b.lastTouchTeam = p.team; b.shot = null; b.trailType = 'pass';
    p.noPickupT = Math.max(p.noPickupT || 0, 0.4);
    log.hoofs++;
  };
  log.hoofs = 0;
  while (m.phase !== 'over' && guard < 400000) {
    guard++;
    const clock0 = m.clock, before = m.phase;
    if (m.phase === 'play') { hoofIn -= CFG.STEP; if (hoofIn <= 0) { hoofIn = 2 + Math.random() * 3; hoof(); } }
    Match.step(m, CFG.STEP);
    log.steps++;
    const b = m.ball;
    if (!isFinite(b.x + b.y + b.z)) log.nan++;
    if (!insideArena(b.x, b.y)) log.outside++;
    if (m.phase === 'restart') {
      setup += CFG.STEP; log.maxSetup = Math.max(log.maxSetup, setup);
      if (before === 'restart' && m.clock !== clock0) log.clockMoved++;
      const R = m.restart;
      if (R && R.t > 0.4) for (const p of m.players) if (p.team !== R.team && !p.isKeeper && Math.hypot(p.x - R.bx, p.y - R.by) < Rules.CLEAR - 1) { log.crowd++; if (log.crowd < 4) log.wrong.push(["crowd", R.kind, +R.t.toFixed(2), R.bx, R.by, Math.round(p.x), Math.round(p.y), Math.round(Math.hypot(p.x - R.bx, p.y - R.by)), p.slideT, p.vx, p.vy]); }
    } else setup = 0;
    if (m.phase === 'over' && m.result) break;
    if (m.phase === 'timeup' && m.phaseT > 1.6) break;
  }
  log.stuck = guard >= 400000 ? 1 : 0;
  log.over = m.phase;
  Rules.start = origStart; Match.goalScored = origGoal;
  return log;
};
`);

console.log('PRO MATCH, bots against bots, every format');
const totals = { throw: 0, corner: 0, goalkick: 0, matches: 0, goals: 0 };
let wrong = [], worstSetup = 0, crowd = 0, clockMoved = 0, outside = 0, nan = 0, throwGoals = 0, stuck = 0, notRules = 0;
for (const format of ['2v2', '3v3', '4v4']) {
  for (let i = 0; i < 8; i++) {
    const r = sim.run(`__play(${JSON.stringify(format)}, ${1000 + i * 7919 + format.charCodeAt(0)})`);
    totals.matches++; totals.goals += r.goals;
    for (const k of r.restarts) totals[k]++;
    wrong = wrong.concat(r.wrong.slice(0, 3));
    worstSetup = Math.max(worstSetup, r.maxSetup); crowd += r.crowd; clockMoved += r.clockMoved; outside += r.outside; nan += r.nan; throwGoals += r.throwGoals; stuck += r.stuck;
    if (!r.rules) notRules++;
  }
}
console.log('  ' + JSON.stringify(totals));
check('a PRO match plays by the rules', notRules === 0, notRules);
check('the ball goes out, and all three restarts happen', totals.throw > 100 && totals.corner > 20 && totals.goalkick > 20, totals);
check('every out is the right restart, from the right spot, by the right player', wrong.length === 0, wrong.slice(0, 4));
check('every restart is taken (a bot within 1.5 s)', worstSetup <= 1.6, +worstSetup.toFixed(2));
check('the other side keeps its distance while it is set up', crowd === 0, crowd);
check('the clock stops while a restart is set up', clockMoved === 0, clockMoved);
check('the ball never leaves the arena', outside === 0, outside);
check('nothing goes NaN', nan === 0, nan);
check('nobody scores straight from a throw-in', throwGoals === 0, throwGoals);
check('every match ends', stuck === 0, stuck);
check('goals still go in', totals.goals > totals.matches, totals.goals);

console.log('PRO MATCH with you in it (your restarts, your buttons)');
sim.run(`
globalThis.__you = function (seed, format) {
  let s = seed >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const m = Match.create({ mode: 'pro', format, minutes: 3 });
  const F = { move: { x: 0, y: 0 }, sprintHeld: false, aim: null, q: {},
    press(k) { this.q[k] = true; },
    take(k) { const v = !!this.q[k]; this.q[k] = false; return v; },
    consumePass() { return this.take('pass'); }, consumePassPress() { return this.take('passPress'); },
    consumeShootPress() { return this.take('shootPress'); }, consumeShootRelease() { return this.take('shootRelease'); },
    consumeSkill() { return false; }, consumeSlide() { return false; }, consumeUlt() { return false; } };
  const h = m.human; h.input = F;
  const log = { mine: 0, byPass: 0, byLong: 0, byWait: 0, asked: 0, askedGot: 0, wrongWay: [], stuck: 0, legal: 0, waitT: 0, outs: 0, shotAtCorner: 0 };
  let plan = null, guard = 0, hoofIn = 2, wander = 0;
  while (m.phase !== 'over' && guard < 300000) {
    guard++;
    // in play: run about, and now and then hoof it at a line
    if (m.phase === 'play') {
      wander -= CFG.STEP; if (wander <= 0) { wander = 1; const a = Math.random() * 6.283; F.move = { x: Math.cos(a), y: Math.sin(a) }; }
      hoofIn -= CFG.STEP;
      if (hoofIn <= 0) {
        hoofIn = 2 + Math.random() * 2.5;
        const b = m.ball; let p = b.owner;
        if (!p) { let best = 1e9; for (const q of m.players) { const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < best) { best = d; p = q; } } }
        if (p && !p.isKeeper) {
          if (b.owner) loseBall(m, b.owner, 0.5);
          const top = Math.random() < 0.5, end = Math.random() < 0.3;
          const tx = end ? (Math.random() < 0.5 ? -80 : CFG.FIELD_W + 80) : b.x + (Math.random() - 0.5) * 600, ty = end ? (top ? 200 : CFG.FIELD_H - 200) : (top ? -80 : CFG.FIELD_H + 80);
          const d = Math.hypot(tx - b.x, ty - b.y) || 1;
          b.vx = (tx - b.x) / d * 1100; b.vy = (ty - b.y) / d * 1100; b.lastKicker = p; b.lastTouchTeam = p.team; b.shot = null;
          p.noPickupT = 0.4;
          // half the time it is the other side's, and you are the one nearest where it goes out
          if (p.team !== h.team && Math.random() < 0.6) {
            const ox = clamp(end ? tx : b.x + (tx - b.x) * ((top ? -b.y : CFG.FIELD_H - b.y) / ((ty - b.y) || 1)), 60, CFG.FIELD_W - 60);
            h.x = clamp(ox + (Math.random() < 0.5 ? -1 : 1) * 110, 40, CFG.FIELD_W - 40); h.y = end ? (top ? 260 : CFG.FIELD_H - 260) : (top ? 70 : CFG.FIELD_H - 70);
            h.noPickupT = 1;
          }
        }
      }
    }
    // a restart: yours to take, or your side's and you ask for it
    const R = m.restart;
    if (m.phase === 'restart' && R && !plan) {
      log.outs++;
      if (R.human) {
        log.mine++;
        const k = log.mine % 4;
        // 0: tap PASS aiming somewhere; 1: hold SHOOT; 2: aim back out over the line, then PASS; 3: leave it
        plan = { R, kind: R.kind, how: k, at: 0.3 + Math.random() * 0.8, dir: k === 2 ? { x: R.by <= 1 ? 0 : R.by >= CFG.FIELD_H - 1 ? 0 : (R.bx < CFG.FIELD_W / 2 ? -1 : 1), y: R.by <= 1 ? -1 : R.by >= CFG.FIELD_H - 1 ? 1 : 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 } };
      } else if (R.team === h.team && h !== R.taker && Math.random() < 0.5) {
        plan = { R, ask: true, at: 0.1 };
      } else plan = { R, none: true };
    }
    if (plan && m.phase === 'restart' && m.restart === plan.R) {
      const t = plan.R.t;
      if (plan.none) {}
      else if (plan.ask) { if (t >= plan.at && !plan.done) { F.press('pass'); plan.done = true; log.asked++; } }
      else if (plan.how === 3) { F.move = { x: 0, y: 0 }; }
      else if (t >= plan.at) {
        F.move = plan.dir;
        if (plan.how === 0 || plan.how === 2) { if (!plan.done) { F.press('passPress'); plan.done = 1; } else if (plan.done === 1 && t >= plan.at + 0.1) { F.press('pass'); plan.done = 2; } }
        if (plan.how === 1) { if (!plan.done) { F.press('shootPress'); plan.done = 1; } else if (plan.done === 1 && t >= plan.at + 0.35) { F.press('shootRelease'); plan.done = 2; } }
      }
    }
    const was = m.phase;
    Match.step(m, CFG.STEP);
    if (plan && was === 'restart' && m.phase !== 'restart') {
      // it has just been taken: which way did it go?
      const b = m.ball, P = plan.R, sp = Math.hypot(b.vx, b.vy);
      if (!plan.none && !plan.ask) {
        if (plan.how === 0 || plan.how === 2) log.byPass++; else if (plan.how === 1) log.byLong++; else { log.byWait++; log.waitT = Math.max(log.waitT, P.t); }
        if (plan.how === 1 && P.kind === 'corner' && b.shot) log.shotAtCorner++;
      }
      if (plan.ask) { const lp = b.lastPass; if (lp && lp.target === h) log.askedGot++; }
      // never straight back out over the line it was taken from
      const W = CFG.FIELD_W, H = CFG.FIELD_H, ux = b.vx / (sp || 1), uy = b.vy / (sp || 1);
      let into;
      if (P.kind === 'throw') into = P.by <= 1 ? uy > 0.1 : uy < -0.1;
      else if (P.kind === 'goalkick') into = P.bx < W / 2 ? ux > 0.25 : ux < -0.25;
      else {
        const inY = P.by <= 20 ? uy > 0.1 : uy < -0.1;
        const inX = P.bx <= 20 ? ux > 0.1 : ux < -0.1;
        into = inY && (inX || !!b.shot);
      }
      if (!into || sp < 100) log.wrongWay.push([P.kind, P.bx, P.by, Math.round(b.vx), Math.round(b.vy), plan.how]); else log.legal++;
      plan = null;
    }
    if (plan && m.phase !== 'restart') plan = null;
    if (m.phase === 'timeup' && m.phaseT > 1.6) break;
  }
  log.stuck = guard >= 300000 ? 1 : 0;
  return log;
};
`);
const you = { mine: 0, byPass: 0, byLong: 0, byWait: 0, asked: 0, askedGot: 0, legal: 0, outs: 0, shotAtCorner: 0 };
let youWrong = [], youStuck = 0, youWait = 0;
for (let i = 0; i < 9; i++) {
  const r = sim.run(`__you(${7 + i * 104729}, '${['2v2', '3v3', '4v4'][i % 3]}')`);
  for (const k in you) you[k] += r[k];
  youWrong = youWrong.concat(r.wrongWay); youStuck += r.stuck; youWait = Math.max(youWait, r.waitT);
}
console.log('  ' + JSON.stringify(you));
check('you take your own throw-ins, corners and goal kicks', you.mine > 30 && you.byPass > 10 && you.byLong > 5 && you.byWait > 3, you);
check('PASS plays it, SHOOT hits the long one, and leaving it gets it taken for you after 8 s', youWait >= 7.9 && youWait <= 8.1, +youWait.toFixed(2));
check('at a corner, SHOOT is a go at goal', you.shotAtCorner > 0 || you.byLong < 6, you.shotAtCorner);
check('nothing is ever played back out over the line it is taken from (even aimed that way)', youWrong.length === 0, youWrong.slice(0, 4));
check('when a teammate takes it, PASS asks for it, and you get it', you.asked > 5 && you.askedGot >= you.asked * 0.8, { asked: you.asked, got: you.askedGot });
check('your matches end', youStuck === 0, youStuck);

console.log('PRO MATCH is 2v2 or bigger');
const fm = sim.run(`['1v1', '2v2', '3v3', '4v4'].map((f) => { const m = Match.create({ autopilot: true, mode: 'pro', format: f, minutes: 2 }); return [f, m.format, m.players.length]; })`);
check('picking 1v1 plays 2v2; the rest as picked', fm[0][1] === '2v2' && fm[1][1] === '2v2' && fm[2][1] === '3v3' && fm[3][1] === '4v4', fm);
const fq = sim.run(`Match.create({ autopilot: true, mode: 'quick', format: '1v1', minutes: 2 }).format`);
check('an ordinary match can still be 1v1', fq === '1v1', fq);

console.log('a shot straight from a corner (SHOOT at a corner)');
const cs = sim.run(`(() => {
  const res = { n: 0, curled: 0, goals: 0, wide: 0, wrongFirst: 0 }, W = CFG.FIELD_W, H = CFG.FIELD_H;
  for (let i = 0; i < 900; i++) {
    const m = Match.create({ autopilot: true, mode: 'pro', format: ['2v2', '3v3', '4v4'][i % 3], minutes: 2 });
    m.phase = 'play';
    const b = m.ball; if (b.owner) loseBall(m, b.owner, 0);
    const gx = attackGoalX('blue'); b.x = gx === W ? W + 12 : -12; b.y = i % 2 ? 200 : H - 200; b.lastTouchTeam = 'red';
    Rules.start(m);
    for (let k = 0; k < 60 && m.restart; k++) Rules.step(m, CFG.STEP);
    if (!m.restart || m.restart.kind !== 'corner') continue;
    const R = m.restart; res.n++;
    Rules.take(m, 'long', R.ax, R.ay, 0.2 + Math.random() * 0.6);
    if (b.spinT > 0 && b.shot && b.shot.curl) res.curled++;
    if ((R.bx < W / 2 ? b.vx : -b.vx) < 0 && !(b.spinT > 0)) res.wrongFirst++;
    const s0 = m.score.blue;
    for (let k = 0; k < 120 * 5 && m.phase === 'play'; k++) Match.step(m, CFG.STEP);
    if (m.score.blue > s0 || m.phase === 'goal') res.goals++;
    else if (m.phase === 'restart' && m.restart.kind === 'goalkick') res.wide++;
  }
  return res;
})()`);
console.log('  ' + JSON.stringify(cs) + '  goals ' + (cs.goals / cs.n * 100).toFixed(1) + '%');
check('it curls (every time)', cs.curled === cs.n, cs);
check('it hardly ever goes wide', cs.wide <= cs.n * 0.03, cs.wide);
check('it is a real chance, not a sure thing: 6-20% go in (the keeper reads it)', cs.goals >= cs.n * 0.06 && cs.goals <= cs.n * 0.2, +(cs.goals / cs.n * 100).toFixed(1));

console.log('a throw-in straight into the goal');
const tg = sim.run(`(() => {
  const out = [];
  for (const deflect of [false, true]) {
    Math.random = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    const m = Match.create({ autopilot: true, mode: 'pro', format: '2v2', minutes: 2 });
    m.phase = 'play';
    const b = m.ball, W = CFG.FIELD_W;
    // blue knocks it out over the top touchline near red's goal end: red's throw
    const gxRed = attackGoalX('red');
    const blue = m.players.find((p) => p.team === 'blue' && !p.isKeeper);
    if (b.owner) loseBall(m, b.owner, 0);
    b.x = gxRed === W ? W - 260 : 260; b.y = -20; b.z = 0; b.vx = 0; b.vy = 0; b.lastTouchTeam = 'blue'; b.lastKicker = blue;
    Rules.start(m);
    const R = m.restart, kind = R && R.kind, team = R && R.team;
    Rules.take(m, 'pass', 0, 1, 0);
    // ...and it flies straight in, untouched (or off a blue defender)
    const thrower = b.lastKicker;
    for (const p of m.players) { p.x = W / 2; p.y = 300 + Math.random() * 200; }
    b.owner = null; b.x = gxRed === W ? W - 30 : 30; b.y = CFG.FIELD_H / 2; b.z = 10; b.vz = 0; b.vx = (gxRed === W ? 1 : -1) * 900; b.vy = 0;
    if (deflect) b.lastTouchTeam = 'blue';
    const score0 = m.score.red + m.score.blue;
    for (let i = 0; i < 40 && m.phase === 'play'; i++) Match.step(m, CFG.STEP);
    out.push({ kind, team, thrower: thrower && thrower.team, phase: m.phase, next: m.restart && m.restart.kind, nextTeam: m.restart && m.restart.team, goals: m.score.red + m.score.blue - score0 });
  }
  return out;
})()`);
check('the ball out off blue is a throw-in to red', tg[0].kind === 'throw' && tg[0].team === 'red' && tg[0].thrower === 'red', tg[0]);
check('thrown straight in, it is no goal: a goal kick to the other side', tg[0].goals === 0 && tg[0].phase === 'restart' && tg[0].next === 'goalkick' && tg[0].nextTeam === 'blue', tg[0]);
check('off a defender on the way, it counts', tg[1].goals === 1, tg[1]);

console.log('and back to the normal pitch');
sim.run("Pitch.use('normal')");
const back = sim.run('({ W: CFG.FIELD_W, H: CFG.FIELD_H, walls: WALLS.length, gy1: GOAL_Y1 })');
check('everything is as it was', JSON.stringify(back) === JSON.stringify(normal), { back, normal });
const q = sim.run(`(() => { const m = Match.create({ autopilot: true, mode: 'quick', format: '4v4', minutes: 1 }); let n = 0, outs = 0; while (m.phase !== 'over' && n < 200000) { Match.step(m, CFG.STEP); n++; if (m.phase === 'restart') outs++; if (m.phase === 'timeup' && m.phaseT > 1.6) break; } return { rules: m.rules, restarts: outs }; })()`);
check('an ordinary match has no outs at all', q.rules === false && q.restarts === 0, q);

console.log(failures ? `\n${failures} FAILED` : '\nall good');
process.exit(failures ? 1 : 0);
