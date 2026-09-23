// Walking the ball into the net: how often does it work, and is shooting still fine?
//   node tools/walkinscan.js [tries] [--old] [--diff=normal|hard|online]
// Runs on the real engine. A scripted attacker gets the ball outside the box and dribbles
// straight at the goal; a "skilled" run also uses SKILL the moment the keeper commits, which
// is the dodge window. --old restores the keeper the game had before the goalmouth fix, so
// the two can be compared side by side.
const { createSim } = require('../server/sim');

const sim = createSim();
sim.run('Game.headless = true; Save.data = Save.defaults(); Save.data.tutorialSeen = true;');
const { CFG, Clubs, DIFFICULTY } = sim;
const W = CFG.FIELD_W, H = CFG.FIELD_H;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] || 300);
const OLD = process.argv.includes('--old');
const DIFF_ARG = (process.argv.find((a) => a.startsWith('--diff=')) || '').slice(7) || 'normal';
const diff = () => (DIFF_ARG === 'online' ? { ...sim.ONLINE_BOTS } : { ...(DIFFICULTY[DIFF_ARG] || DIFFICULTY.normal) });
// the keeper as it was before: a soft, occasional smother
if (OLD) sim.run('CFG.SMOTHER = { range: 150, close: 80, gap: 0.25, chance: 0.3, botChance: 0.5, speed: 1, windup: SLIDE.windup, grab: 1, dodgeStop: 0, loose: 1, retry: 99, fumble: 1 };');
const SM = sim.run('CFG.SMOTHER');

class ScriptInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); } consumeSkill() { return this.take(2); } consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); } consumeShootRelease() { return this.take(16); } consumePassPress() { return this.take(32); }
  consumeUlt() { return this.take(64); }
}

// one attempt. start: where the ball is picked up. skilled: dodge as soon as the keeper moves out.
function attempt({ startX, startY, sprint, skilled, shoot }) {
  const m = sim.Match.create({ mode: 'quick', club: Clubs.get('croatia'), format: '1v1', diff: diff(), minutes: 3 });
  const h = m.human, k = m.keepers.red;
  h.input = new ScriptInput();
  m.phase = 'play'; m.phaseT = 0; m.clock = 0;
  // everyone out of the way: this is about the keeper and the goalmouth, nothing else
  for (const p of m.players) {
    if (p === h || p === k) continue;
    p.x = 120; p.y = p.team === 'blue' ? 200 : H - 200; p.vx = 0; p.vy = 0;
  }
  h.x = startX; h.y = startY; h.vx = 0; h.vy = 0;
  k.x = W - 40; k.y = H / 2;
  const b = m.ball;
  b.x = h.x + 18; b.y = h.y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.owner = h; b.shot = null;
  const gx = W, gy = H / 2;
  let dodged = false, shotOff = false;
  for (let i = 0; i < 60 * 8; i++) {
    const before = m.score.blue, carried = b.owner === h;
    // run at the middle of the goal
    const dx = gx + 12 - h.x, dy = gy - h.y, d = Math.hypot(dx, dy) || 1;
    h.input.move.x = dx / d; h.input.move.y = dy / d;
    h.input.sprintHeld = !!sprint;
    // a skilled run: skill through the keeper the moment he commits
    if (skilled && !dodged && (k.slideWindT > 0 || k.slideT > 0) && h.skillCd <= 0) { h.input.q |= 2; dodged = true; }
    // the shooting control: let fly from the edge of the box instead of walking in
    if (shoot && !shotOff && W - h.x < CFG.BOX_D - 40) { h.input.q |= 8; shotOff = true; }
    if (shoot && shotOff && h.charging && h.chargeT > 0.5) h.input.q |= 16;
    sim.Match.step(m, CFG.STEP);
    if (m.score.blue > before) return carried ? 'walked in' : 'shot goal';
    if (m.phase !== 'play') return 'other';
    if (b.owner && b.owner !== h) return b.owner === k ? 'keeper took it' : 'lost it';
    if (!b.owner && !b.shot && Math.hypot(b.vx, b.vy) < 40 && W - b.x > CFG.BOX_D) return 'lost it';
    if (shoot && shotOff && !b.owner && Math.hypot(b.vx, b.vy) < 60) return 'shot missed';
  }
  return 'ran out of time';
}

function run(name, opts, n = N) {
  const tally = {};
  for (let i = 0; i < n; i++) {
    const o = attempt({ ...opts, startY: opts.startY + (Math.random() - 0.5) * (opts.spread || 0) });
    tally[o] = (tally[o] || 0) + 1;
  }
  const pct = (k) => Math.round(((tally[k] || 0) / n) * 100) + '%';
  const scored = (tally['walked in'] || 0) + (tally['shot goal'] || 0);
  console.log(`  ${name.padEnd(42)} scored ${String(Math.round((scored / n) * 100) + '%').padStart(4)}   ` +
    Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / n) * 100)}%`).join(', '));
  return Math.round((scored / n) * 100);
}

console.log(`${OLD ? 'BEFORE (old keeper)' : 'NOW'} · ${DIFF_ARG} · ${N} tries each`);
console.log(`  keeper smother: range ${SM.range}, commits inside ${SM.close}, every ${SM.gap}s, ${Math.round(SM.chance * 100)}% vs you\n`);
console.log('WALKING IT IN (no shot, just dribble into the net)');
const w1 = run('straight down the middle', { startX: W - 620, startY: H / 2, spread: 60 });
const w2 = run('down the middle, sprinting', { startX: W - 620, startY: H / 2, spread: 60, sprint: true });
const w3 = run('from an angle', { startX: W - 560, startY: H / 2 - 210, spread: 80 });
const w4 = run('skilled: dodge as the keeper commits', { startX: W - 620, startY: H / 2, spread: 60, sprint: true, skilled: true });
console.log('\nSHOOTING (the normal way to score, should be untouched)');
const s1 = run('shot from the edge of the box', { startX: W - 620, startY: H / 2, spread: 120, shoot: true });
const s2 = run('shot from an angle', { startX: W - 560, startY: H / 2 - 210, spread: 120, shoot: true });
console.log(`\nwalk-ins ${w1}% / ${w2}% / ${w3}% / skilled ${w4}%   ·   shots ${s1}% / ${s2}%`);
