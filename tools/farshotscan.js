// Long shots (build 126): from the halfway line a shot should go in about one time in ten, whatever
// the power or the stats, and the keeper must go for every one of them.
//   node tools/farshotscan.js [shots per run]
// Runs on the real engine. A scripted player picks the ball up anywhere from 450 to 1750 from goal,
// charges a shot at a random spot in the goal and lets it go; the results are bucketed by where the
// shot really came from. Two runs: a fully charged POWER SHOT by a player with every stat maxed
// (the case that used to go in 58% of the time from halfway), and ordinary shots.
const { createSim } = require('../server/sim');

const sim = createSim();
sim.run('Game.headless = true; Save.data = Save.defaults(); Save.data.tutorialSeen = true;');
const { CFG, Clubs, DIFFICULTY } = sim;
const W = CFG.FIELD_W, H = CFG.FIELD_H;
const N = Number(process.argv[2] || 1200);
const lineX = sim.run("ownGoalX('red')"), GY1 = sim.run('GOAL_Y1');

class ScriptInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); } consumeSkill() { return this.take(2); } consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); } consumeShootRelease() { return this.take(16); } consumePassPress() { return this.take(32); }
  consumeUlt() { return this.take(64); }
}

function attempt({ charge, power, maxed, format }) {
  const m = sim.Match.create({ mode: 'quick', club: Clubs.get('croatia'), format, diff: { ...DIFFICULTY.normal }, minutes: 3 });
  const h = m.human, k = m.keepers.red, b = m.ball;
  h.input = new ScriptInput();
  if (maxed) h.attr = sim.run('ratingAttr({ spd: 110, sht: 110, pas: 110, ctl: 110, def: 110 })');
  m.phase = 'play'; m.phaseT = 0; m.clock = 0;
  for (const p of m.players) {
    if (p === h || p === k) continue;
    p.x = 120; p.y = p.team === 'blue' ? 200 : H - 200; p.vx = 0; p.vy = 0;
  }
  h.x = W - (450 + Math.random() * 1300); h.y = H / 2 + (Math.random() * 2 - 1) * 250; h.vx = 0; h.vy = 0;
  b.x = h.x + 18; b.y = h.y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.owner = h; b.shot = null;
  const ty = GY1 + 25 + Math.random() * (CFG.GOAL_W - 50);
  for (let i = 0; i < 20; i++) sim.Match.step(m, CFG.STEP);
  k.x = W - 40; k.y = H / 2;
  let pressed = false, released = false, shot = null, dove = false;
  for (let i = 0; i < 60 * 5; i++) {
    const before = m.score.blue;
    const dx = W - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
    h.input.move.x = released ? 0 : dx / d; h.input.move.y = released ? 0 : dy / d;
    if (!pressed) { h.input.q |= 8; pressed = true; }
    if (power) m.meter.blue = CFG.POWER_MAX;
    if (!released && h.charging && h.chargeT >= charge) { h.input.q |= 16; released = true; }
    sim.Match.step(m, CFG.STEP);
    if (b.shot && !shot) shot = b.shot;
    if (k.diveT > 0) dove = true;
    if (m.score.blue > before) return { r: 'goal', shot, dove };
    if (m.stats.red.saves > 0) return { r: 'save', shot, dove };
    if (released && !b.shot && i > 30) return { r: 'other', shot, dove };
  }
  return { r: 'other', shot, dove };
}

function run(label, o) {
  const bins = {};
  let noDive = 0;
  for (let t = 0; t < N; t++) {
    const a = attempt(o);
    if (!a.shot || a.r === 'other') continue;
    const d = Math.hypot(a.shot.x0 - lineX, a.shot.y0 - H / 2);
    const key = d < 600 ? 'close (under 600)' : d < 900 ? '600-900' : d < 1050 ? '900-1050' : 'halfway (1050+)';
    const bn = bins[key] || (bins[key] = { goal: 0, n: 0 });
    bn.n++; if (a.r === 'goal') { bn.goal++; if (d >= 1050 && !a.dove) noDive++; }
  }
  console.log(label);
  for (const k of ['close (under 600)', '600-900', '900-1050', 'halfway (1050+)']) {
    const b = bins[k]; if (!b) continue;
    console.log(`  ${k.padEnd(18)} ${String(b.n).padStart(4)} shots on target, ${(100 * b.goal / b.n).toFixed(0).padStart(3)}% in`);
  }
  return { half: bins['halfway (1050+)'], noDive };
}

let fail = 0;
for (const fmt of ['1v1', '4v4']) {
  const pw = run(`POWER SHOTS, every stat maxed (${fmt})`, { charge: 1.0, power: true, maxed: true, format: fmt });
  const pl = run(`ordinary shots (${fmt})`, { charge: 0.6, power: false, maxed: false, format: fmt });
  for (const [name, r] of [['power', pw], ['ordinary', pl]]) {
    const pct = r.half ? r.half.goal / r.half.n : 0;
    // about one in ten: allow for the dice on a few hundred shots
    if (!r.half || r.half.n < 60) { console.log(`FAIL ${fmt} ${name}: too few shots from halfway to judge`); fail++; }
    else if (pct > 0.15) { console.log(`FAIL ${fmt} ${name}: ${(pct * 100).toFixed(0)}% from halfway went in (want about 10%)`); fail++; }
    if (r.noDive) { console.log(`FAIL ${fmt} ${name}: the keeper never moved for ${r.noDive} goals from halfway`); fail++; }
  }
}
console.log(fail ? `farshotscan: ${fail} failure(s)` : 'farshotscan: ok — from halfway about one shot in ten goes in, and the keeper goes for every one');
process.exit(fail ? 1 : 0);
