// Server-side bug scan for online matches. Runs the real engine the way the server does,
// with several fuzzed real players per side, and checks the same invariants as BS.sim.
//   node tools/netscan.js [matches]
const vm = require('vm');
const { createSim } = require('../server/sim');

const sim = createSim();

class NetInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); } consumeSkill() { return this.take(2); } consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); } consumeShootRelease() { return this.take(16); }
}

const N = Number(process.argv[2] || 40);
const SIZE = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 };
const issues = {}, examples = {};
const add = (k, d) => { issues[k] = (issues[k] || 0) + 1; (examples[k] = examples[k] || []).length < 3 && examples[k].push(d); };
let goals = 0, steps = 0, errors = [];
const t0 = Date.now();
const CFG = sim.CFG, W = CFG.FIELD_W, H = CFG.FIELD_H;

for (let i = 0; i < N; i++) {
  const format = ['1v1', '2v2', '3v3', '4v4'][i % 4], size = SIZE[format];
  const seats = [];
  for (const team of ['blue', 'red']) {
    for (let s = 0; s < size; s++) {
      const human = Math.random() < 0.6;
      seats.push({ seat: seats.length, team, human, name: 'P' + seats.length, character: sim.CHARACTERS[(i + s) % sim.CHARACTERS.length].id, trail: 'fire', celebration: 'spin', input: human ? new NetInput() : null });
    }
  }
  if (!seats.some((s) => s.human)) { seats[0].human = true; seats[0].input = new NetInput(); }
  const events = [];
  let m;
  try {
    m = sim.create({ online: true, format, minutes: 1, seats, diff: { ...sim.DIFFICULTY.normal }, home: sim.CLUBS[i % 20], club: sim.CLUBS[(i * 7 + 3) % 20] }, events);
    m.events = events;
  } catch (e) { errors.push(`create ${format}: ${e.stack}`); continue; }
  let n = 0, lastScore = 0, looseT = 0, phaseT = 0, lastPhase = m.phase, dropAt = 120 * (20 + Math.random() * 30);
  const tag = `${format}#${i}`;
  try {
    while (!m.finished && n < 120 * 400) {
      for (const h of m.humans) {
        const I = h.input, b = m.ball;
        if (Math.random() < 0.05) {
          const r = Math.random();
          let x = r < 0.5 ? b.x - h.x : r < 0.75 ? (h.team === 'blue' ? W : 0) - h.x : Math.random() - 0.5, y = r < 0.5 ? b.y - h.y : Math.random() - 0.5;
          const l = Math.hypot(x, y) || 1; I.move.x = x / l; I.move.y = y / l; I.sprintHeld = Math.random() < 0.5;
        }
        if (Math.random() < 0.01) I.q |= 1 << Math.floor(Math.random() * 5);
      }
      // someone's connection drops mid-match: they become a bot, like the server does
      if (n === Math.floor(dropAt) && m.humans.length > 1) {
        const p = m.humans[0];
        p.isHuman = false; p.input = null; p.speedMul = m.diff.redSpeed;
        m.humans = m.humans.filter((x) => x !== p);
        m.teamHuman = { blue: m.humans.some((x) => x.team === 'blue'), red: m.humans.some((x) => x.team === 'red') };
        if (m.human === p) m.human = m.humans[0];
      }
      sim.step(m, 1 / 120, events);
      n++;
      if (events.length > 500) events.length = 0;
      const where = `${tag} t=${m.clock.toFixed(1)} ${m.phase}`;
      if (m.phase !== lastPhase) { lastPhase = m.phase; phaseT = 0; } else phaseT += 1 / 120;
      if ({ kickoff: 2.5, goal: 3, reset: 1, timeup: 2.5, cele: 3 }[m.phase] < phaseT) { add('phase-stuck', where); phaseT = -999; }
      for (const p of m.players) {
        if (!Number.isFinite(p.x + p.y + p.vx + p.vy)) { add('nan-player', where); p.x = W / 2; p.y = H / 2; p.vx = p.vy = 0; }
        if (p.x < -CFG.END_M - CFG.GOAL_D - 4 || p.x > W + CFG.END_M + CFG.GOAL_D + 4 || p.y < -CFG.SIDE_M - 4 || p.y > H + CFG.SIDE_M + 4) add('player-outside', `${where} ${p.x | 0},${p.y | 0}`);
      }
      const b = m.ball;
      if (!Number.isFinite(b.x + b.y + b.z)) add('nan-ball', where);
      if (b.x < -CFG.END_M - CFG.GOAL_D - 30 || b.x > W + CFG.END_M + CFG.GOAL_D + 30 || b.y < -CFG.SIDE_M - 30 || b.y > H + CFG.SIDE_M + 30) add('ball-outside', where);
      const total = m.score.blue + m.score.red;
      if (total !== m.goals.length) add('score-mismatch', where);
      if (total > lastScore) { goals += total - lastScore; lastScore = total; if (!events.some((e) => e.e === 'goal')) add('goal-without-event', where); events.length = 0; }
      if (m.phase === 'play') { if (!b.owner && Math.hypot(b.vx, b.vy) < 5) looseT += 1 / 120; else looseT = 0; if (looseT > 8) { add('ball-dead', where); looseT = -999; } }
      for (const h of m.humans) if (!h.input) add('human-without-input', where);
    }
    if (!m.finished) add('never-ends', `${tag} ${m.phase} ${m.score.blue}-${m.score.red}`);
  } catch (e) { errors.push(`${tag}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`); }
  steps += n;
}
console.log(JSON.stringify({ matches: N, goals, steps, ms: Date.now() - t0, issues, examples, errors }, null, 2));
