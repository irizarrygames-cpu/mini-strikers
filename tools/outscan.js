// PRO MATCH: how often the ball goes out when bots play bots (build 116), and what it does to goals.
//   node tools/outscan.js [matches per format]
// Bots used to keep the ball in the middle — about one restart a match. They now run it out, clear it
// into touch and put it behind now and then, the way players do. Prints restarts per 2-minute match by
// kind, goals per match, and how long a match takes on the clock (restarts stop it).
const fs = require('fs');
const path = require('path');
const { createSim } = require('../server/sim');
const N = Number(process.argv[2]) || 10;
const sim = createSim({ pitch: 'pro' });
sim.run('Game.headless = true;');
const out = sim.run(`(() => {
  const res = {};
  for (const format of ['2v2', '3v3', '4v4']) {
    const r = res[format] = { matches: 0, throw: 0, corner: 0, goalkick: 0, goals: 0, outsBy: { carry: 0, other: 0 }, steps: 0 };
    for (let i = 0; i < ${N}; i++) {
      let s = (i + 1) * 2654435761 >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const m = Match.create({ autopilot: true, mode: 'pro', format, minutes: 2 });
      const start = Rules.start.bind(Rules);
      Rules.start = (mm) => { start(mm); if (mm.restart) r[mm.restart.kind]++; };
      let n = 0;
      while (m.phase !== 'over' && n < 400000) { Match.step(m, CFG.STEP); n++; if (m.phase === 'timeup' && m.phaseT > 1.6) break; }
      Rules.start = start;
      r.matches++; r.goals += m.score.blue + m.score.red; r.steps += n; r.own = (r.own || 0) + m.goals.filter((g) => g.own).length;
    }
  }
  return res;
})()`);
let tot = { throw: 0, corner: 0, goalkick: 0, goals: 0, matches: 0, steps: 0 };
for (const [f, r] of Object.entries(out)) {
  const per = (k) => (r[k] / r.matches).toFixed(1);
  console.log(`${f}: per match  throw-ins ${per("throw")}  corners ${per("corner")}  goal kicks ${per("goalkick")}  goals ${per("goals")} (own goals ${per("own")})  (${(r.steps / r.matches / 120).toFixed(0)} s)`);
  for (const k of Object.keys(tot)) tot[k] += r[k];
}
const all = (tot.throw + tot.corner + tot.goalkick) / tot.matches;
console.log(`all: ${all.toFixed(1)} restarts a match (throw-ins ${(tot.throw / tot.matches).toFixed(1)}, corners ${(tot.corner / tot.matches).toFixed(1)}, goal kicks ${(tot.goalkick / tot.matches).toFixed(1)}), goals ${(tot.goals / tot.matches).toFixed(1)}`);
