// How much of a CPU does one live online match cost the server?
//   node tools/cpubench.js [simSeconds]
//
// The live server runs on a hosting plan whose CPU share is a small fraction of one core, so the
// question that decides whether online play lags is "how many CPU-milliseconds does a second of
// match cost?". This runs real matches through the server's own engine, with real-player seats
// and bots, and reports the cost per second of play, split into the simulation and the snapshots.
// A match that costs 100 ms of CPU per second is using 10% of a core; on a host that gives you a
// tenth of a core, two such matches are the whole machine and everything starts to stutter.
const { createSim } = require('../server/sim');
const sim = createSim();

class NetInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); } consumeSkill() { return this.take(2); } consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); } consumeShootRelease() { return this.take(16); } consumePassPress() { return this.take(32); }
}
const SECONDS = Number(process.argv[2] || 30);
const STEP = 1 / 120;
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; }; // ms

function makeRoom(format, humans) {
  const size = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 }[format];
  const seats = [];
  for (const team of ['blue', 'red']) {
    for (let s = 0; s < size; s++) {
      const human = humans > 0 && (seats.length < humans);
      seats.push({ seat: seats.length, team, human, name: 'P' + seats.length, character: sim.CHARACTERS[seats.length % sim.CHARACTERS.length].id, trail: 'fire', celebration: 'spin', skill: 'classic', input: human ? new NetInput() : undefined });
    }
  }
  const events = [];
  const m = sim.create({ online: true, format, minutes: 3, seats, diff: { ...sim.DIFFICULTY.normal }, home: sim.CLUBS[1], club: sim.CLUBS[5] }, events);
  m.events = events;
  return { m, events };
}

function drive(m) {
  for (const h of m.humans) {
    const I = h.input, b = m.ball;
    if (Math.random() < 0.05) {
      const x = b.x - h.x, y = b.y - h.y, l = Math.hypot(x, y) || 1;
      I.move.x = x / l; I.move.y = y / l; I.sprintHeld = Math.random() < 0.5;
    }
    if (Math.random() < 0.01) I.q |= 1 << Math.floor(Math.random() * 6);
  }
}

// the same shape of work the server does per snapshot: the player rows and the ball, stringified
const r100 = (v) => Math.round((v || 0) * 100);
function snapshotCost(m) {
  const P = m.players.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), r100(p.fx), r100(p.fy), r100(p.faceX), 0,
    r100(p.kickT), r100(p.kickDur), r100(p.stunT), r100(p.recoverT), r100(p.diveT), 0, r100(p.celebrateT), 0, r100(p.slideT), r100(p.slideWindT), r100(p.slideDirX), r100(p.slideDirY), r100(p.fallT), r100(p.hopT), 0, 0, 0]);
  const b = m.ball;
  const common = { k: 1, ph: 1, pt: 0, tm: 1, sc: [m.score.blue, m.score.red], mt: [0, 0], ts: 100, p: P, b: [Math.round(b.x), Math.round(b.y), Math.round(b.z), Math.round(b.vx), Math.round(b.vy), Math.round(b.vz), -1, 0, -1, 0, 0, 0, 0], ev: [] };
  return JSON.stringify(common).length;
}

console.log(`one room, ${SECONDS}s of play each (after a 10s warm-up), real players + bots\n`);
console.log('format  humans   sim ms/s   snapshot ms/s   bytes/snap   CPU of one core   rooms on 0.1 core');
const rows = [];
for (const format of ['1v1', '2v2', '3v3', '4v4']) {
  for (const humans of [2]) {
    const { m, events } = makeRoom(format, humans);
    for (let i = 0; i < 120 * 10; i++) { drive(m); sim.step(m, STEP, events); events.length = 0; } // warm-up
    const steps = Math.round(SECONDS / STEP);
    let simMs = 0, snapMs = 0, bytes = 0, snaps = 0;
    for (let i = 0; i < steps; i++) {
      drive(m);
      const a = cpu(); sim.step(m, STEP, events); simMs += cpu() - a;
      events.length = 0;
      if (i % 4 === 0) { const c = cpu(); bytes += snapshotCost(m); snapMs += cpu() - c; snaps++; }
    }
    const perSecSim = simMs / SECONDS, perSecSnap = (snapMs / SECONDS) * humans; // one snapshot per human
    const total = perSecSim + perSecSnap;
    rows.push({ format, humans, total });
    console.log(`${format.padEnd(7)} ${String(humans).padEnd(8)} ${perSecSim.toFixed(1).padStart(8)}   ${perSecSnap.toFixed(1).padStart(13)}   ${String(Math.round(bytes / snaps)).padStart(10)}   ${(total / 10).toFixed(1).padStart(13)}%   ${(100 / total).toFixed(2).padStart(15)}`);
  }
}
console.log('\n(cpu() counts the whole process, so these are upper bounds; the last column assumes a host that gives the server a tenth of a core)');
