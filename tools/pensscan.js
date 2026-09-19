// Penalty shootout numbers: thousands of kicks through the real model in js/penalty.js.
//   node tools/pensscan.js [kicks]
// How often your kicks go in (by where and how hard you hit them), how often their kicks beat
// you in goal (by how you dive), and how a whole shootout ends on each difficulty.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const N = Number(process.argv[2]) || 20000;
const ctx = { console, Math, Object, Array, Number, String, JSON, Set, Map };
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/penalty.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n;this.PEN = typeof PEN !== "undefined" ? PEN : this.PEN; this.PEN_LEVELS = typeof PEN_LEVELS !== "undefined" ? PEN_LEVELS : this.PEN_LEVELS; this.rand = rand;', ctx, { filename: f });
const { PEN, PEN_LEVELS, rand } = ctx;
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');

// one of your kicks against a bot keeper: 'goal' | 'save' | 'miss'
function yourKick(ax, az, power, q, read) {
  const k = PEN.kick(ax, az, power, q);
  const could = k.out === 'in' || ((k.out === 'post' || k.out === 'bar') && k.postIn);
  if (!could) return 'miss';
  return PEN.saves(PEN.botDive(k, read), 0, k.T, k.x, k.z) ? 'save' : 'goal';
}
// one of theirs against you in goal. how: 'stay' | 'guess' (dive early, random side) | 'react' (after the kick, the right way, rt seconds late) | 'wait'
function theirKick(bot, how, rt = 0.28) {
  const a = PEN.botAim(bot.aim);
  let dive = null;
  if (how === 'guess') { const side = Math.random() < 0.5 ? -1 : 1, ang = rand(-0.3, 0.8); dive = { dx: side * Math.cos(ang), dz: Math.sin(ang), td: -0.3, v: PEN.PLAYER_DIVE }; }
  if (dive && dive.td < -0.15 && Math.random() < bot.sw) a.ax = -Math.sign(dive.dx) * rand(0.45, 0.85);
  const k = PEN.kick(a.ax, a.az, a.power, bot.q, PEN.BOT_SLOW);
  if (how === 'react') {
    const dx = k.x, dz = k.z - PEN.K.hip, l = Math.hypot(dx, dz) || 1;
    // a thumb on a stick: the right side, the angle roughly (about 20 degrees either way)
    const ang = Math.atan2(dz / l, dx / l) + PEN.gauss() * 0.35;
    dive = Math.abs(k.x) < 0.45 ? null : { dx: Math.cos(ang), dz: Math.sin(ang), td: rt, v: PEN.PLAYER_DIVE };
  }
  const could = k.out === 'in' || ((k.out === 'post' || k.out === 'bar') && k.postIn);
  if (!could) return 'miss';
  return PEN.saves(dive, 0, k.T, k.x, k.z) ? 'save' : 'goal';
}
function tally(fn, n = N) { const r = { goal: 0, save: 0, miss: 0 }; for (let i = 0; i < n; i++) r[fn()]++; return `in ${pct(r.goal, n)}  saved ${pct(r.save, n)}  missed ${pct(r.miss, n)}`; }

const normal = PEN_LEVELS.normal, bot = (lv) => ({ read: lv.read, q: lv.q, aim: lv.aim, sw: lv.sw });
const q = 0.5; // an average character's finishing
console.log(`YOUR KICKS vs a normal keeper (${N} each, average finisher)`);
const spots = [
  ['down the middle, medium', () => [rand(-0.15, 0.15), rand(0.1, 0.5), 0.6]],
  ['low to a side, medium', () => [(Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.7), rand(0.05, 0.3), 0.65]],
  ['halfway to the post, mid height', () => [(Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.7), rand(0.3, 0.6), 0.7]],
  ['low corner, firm', () => [(Math.random() < 0.5 ? -1 : 1) * rand(0.78, 0.9), rand(0.05, 0.2), 0.78]],
  ['top corner, firm', () => [(Math.random() < 0.5 ? -1 : 1) * rand(0.78, 0.9), rand(0.75, 0.9), 0.78]],
  ['top corner, full power', () => [(Math.random() < 0.5 ? -1 : 1) * rand(0.78, 0.9), rand(0.75, 0.9), 1]],
  ['anywhere, a tap (weak)', () => [rand(-0.8, 0.8), rand(0.05, 0.8), 0.25]],
  ['a kid mashing: random aim, random power', () => [rand(-1, 1), rand(0, 1), rand(0.3, 1)]],
];
for (const [name, f] of spots) console.log(`  ${name.padEnd(40)} ${tally(() => { const [ax, az, p] = f(); return yourKick(ax, az, p, q, normal.read); })}`);
console.log(`  ${'mid-side firm, GOAT finisher (q .95)'.padEnd(40)} ${tally(() => yourKick((Math.random() < 0.5 ? -1 : 1) * rand(0.6, 0.8), rand(0.2, 0.6), 0.78, 0.95, normal.read))}`);
console.log(`  ${'mid-side firm, starter (q .2)'.padEnd(40)} ${tally(() => yourKick((Math.random() < 0.5 ? -1 : 1) * rand(0.6, 0.8), rand(0.2, 0.6), 0.78, 0.2, normal.read))}`);

console.log(`\nTHEIR KICKS vs you in goal (normal takers)`);
for (const [name, how, rt] of [['you never dive', 'stay'], ['you guess a side early', 'guess'], ['you react fast (0.2s)', 'react', 0.2], ['you react (0.28s)', 'react', 0.28], ['you react (0.34s)', 'react', 0.34], ['you react slowly (0.4s)', 'react', 0.4]]) {
  console.log(`  ${name.padEnd(40)} ${tally(() => theirKick(bot(normal), how, rt))}`);
}

// whole shootouts: a player who aims halfway-to-the-corner and reacts in goal
for (const RT of [0.3, 0.36, 0.42]) {
console.log(`\nWHOLE SHOOTOUTS (you: mid-side firm kicks, react ${RT}s in goal)`);
for (const [lvName, lv] of Object.entries(PEN_LEVELS)) {
  let won = 0, len = 0;
  const games = 4000;
  for (let g = 0; g < games; g++) {
    const kicks = { blue: [], red: [] };
    let n = 0, w = null;
    const first = Math.random() < 0.5 ? 'blue' : 'red';
    while (!w && n < 60) {
      const team = n % 2 === 0 ? first : first === 'blue' ? 'red' : 'blue';
      const r = team === 'blue' ? yourKick((Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.8), rand(0.1, 0.7), rand(0.6, 0.85), q, lv.read) : theirKick(bot(lv), 'react', RT);
      kicks[team].push(r === 'goal');
      w = PEN.decided(kicks); n++;
    }
    if (w === 'blue') won++;
    len += n;
  }
  console.log(`  ${lvName.padEnd(8)} you win ${pct(won, games)}   average ${(len / games).toFixed(1)} kicks`);
}
}

// the rules: every finished shootout is decided the right way
let bad = 0;
for (let g = 0; g < 20000; g++) {
  const kicks = { blue: [], red: [] };
  let n = 0, w = null;
  while (!w && n < 80) { const team = n % 2 ? 'red' : 'blue'; kicks[team].push(Math.random() < 0.7); w = PEN.decided(kicks); n++; }
  const gb = kicks.blue.filter(Boolean).length, gr = kicks.red.filter(Boolean).length;
  const regOver = kicks.blue.length >= 5 && kicks.red.length >= 5;
  if (!w) bad++;
  else if (regOver && (kicks.blue.length !== kicks.red.length || (w === 'blue') !== (gb > gr))) bad++;
  else if (!regOver && (w === 'blue' ? gb + 0 <= gr + (5 - kicks.red.length) : gr <= gb + (5 - kicks.blue.length))) bad++;
}
console.log(`\nRULES: ${bad ? bad + ' shootouts ended wrongly' : 'every shootout ended the right way (20000)'}`);
