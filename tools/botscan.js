// How well do the bots play? Offline matches on the real engine with a scripted, average
// "you" on blue, then the same numbers for your bot teammates and the bot opponents.
//   node tools/botscan.js [matches] [format] [opponent] [--ai] [--clean]
//   --ai     bots on both sides (your spot is a bot too), groups are blue / red
//   --clean  turn every BOT_MISTAKES chance off, to compare against
//   --diff=normal|hard|online  play the bots at that preset exactly (online = online fill-ins)
const { createSim } = require('../server/sim');

const sim = createSim();
sim.run('Game.headless = true; Save.data = Save.defaults(); Save.data.tutorialSeen = true;');
const { CFG, Clubs, DIFFICULTY } = sim;
const W = CFG.FIELD_W, H = CFG.FIELD_H;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const AUTO = process.argv.includes('--ai'), CLEAN = process.argv.includes('--clean');
const N = Number(args[0] || 12);
const FORMAT = args[1] || '4v4';
const OPP = args[2] || 'croatia';
if (CLEAN) sim.run('for (const k in BOT_MISTAKES) if (typeof BOT_MISTAKES[k] === "number") BOT_MISTAKES[k] = 0;');
// --oldkeeper: the goalmouth as it was before the smother fix, to compare balance against
if (process.argv.includes('--oldkeeper')) sim.run('CFG.SMOTHER = { range: 150, close: 80, gap: 0.25, chance: 0.3, botChance: 0.5, speed: 1, windup: SLIDE.windup, grab: 1, dodgeStop: 0, loose: 1, retry: 99, fumble: 1 };');

class ScriptInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); } consumeSkill() { return this.take(2); } consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); } consumeShootRelease() { return this.take(16); } consumePassPress() { return this.take(32); }
}

// the offline difficulty for an opponent, same as Game.setDifficulty
const levelDiff = sim.run('levelDiff');
const DIFF_ARG = (process.argv.find((a) => a.startsWith('--diff=')) || '').slice(7);
// --diff=normal|hard|online: that preset as it is (online = the fill-ins of an online match)
const diffFor = (club) => (DIFF_ARG === 'online' ? { ...sim.ONLINE_BOTS } : DIFFICULTY[DIFF_ARG] ? { ...DIFFICULTY[DIFF_ARG] } : levelDiff(DIFFICULTY.normal, club.level));

const blank = () => ({ players: 0, goals: 0, shots: 0, onTarget: 0, passes: 0, passDone: 0, passLost: 0, lost: 0, won: 0, tackles: 0, slides: 0, touches: 0 });
const tot = AUTO ? { blue: blank(), red: blank() } : { you: blank(), mates: blank(), opps: blank() };
const scores = [];
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const club = Clubs.get(OPP);
  const m = sim.Match.create({ mode: 'quick', club, home: Clubs.get('argentina'), format: FORMAT, minutes: 3, diff: diffFor(club), autopilot: AUTO });
  const h = m.human, I = new ScriptInput(); h.input = I;
  const group = (p) => (AUTO ? p.team : p === h ? 'you' : p.team === 'blue' ? 'mates' : 'opps');
  const shots = new Set();
  const stat = new Map();
  for (const p of m.players) if (!p.isKeeper) { stat.set(p, blank()); tot[group(p)].players++; }

  let prevOwner = null, pending = null, wait = -1, charge = -1, idle = 0, n = 0, lastShot = 0;
  while (m.phase !== 'over' && n++ < 120 * 60 * 12) {
    const b = m.ball;
    if (m.phase === 'play' && !AUTO) {
      const has = b.owner === h;
      if (n % 120 === 0) idle = Math.random() < 0.3 ? 45 : 0; // an average player drifts now and then
      if (has) {
        const d = Math.hypot(W - h.x, H / 2 - h.y);
        let ax = (W - h.x) / d, ay = (H / 2 - h.y) / d;
        let near = 1e9;
        for (const o of m.players) {
          if (o.team === 'blue' || o.isKeeper) continue;
          const ox = h.x - o.x, oy = h.y - o.y, od = Math.hypot(ox, oy) || 1;
          near = Math.min(near, od);
          if (od < 180 && o.x > h.x) ay += (oy / od) * 0.9 * (1 - od / 180);
        }
        const l = Math.hypot(ax, ay) || 1; I.move.x = ax / l; I.move.y = ay / l; I.sprintHeld = h.stamina > 0.35;
        if (d < 640 && charge < 0) { I.q |= 8; charge = Math.round((0.2 + Math.random() * 0.7) * 120); }
        else if (near < 90 && charge < 0 && Math.random() < 0.02) I.q |= 1; // pass under pressure
      } else {
        const tx = b.x, ty = b.y, d = Math.hypot(tx - h.x, ty - h.y) || 1;
        if (idle > 0) { idle--; I.move.x *= 0.3; I.move.y *= 0.3; } else { I.move.x = (tx - h.x) / d; I.move.y = (ty - h.y) / d; }
        I.sprintHeld = d > 220 && h.stamina > 0.4;
        if (b.owner && b.owner.team === 'red' && d < 130 && h.slideCd <= 0 && wait < 0) wait = 60;
      }
      if (wait > 0 && --wait === 0) { I.q |= 4; wait = -1; }
      if (charge > 0 && --charge === 0) { I.move.y = m.keepers.red.y > H / 2 ? -0.7 : 0.7; I.q |= 16; charge = -1; }
    }
    sim.step(m, CFG.STEP, null);

    // who had it, how they gave it up, and who got it next
    const o = b.owner;
    if (o !== prevOwner) {
      if (prevOwner && !prevOwner.isKeeper) {
        const kind = b.shot && b.shot.from === prevOwner ? 'shot' : b.lastPass && b.lastPass.from === prevOwner ? 'pass' : 'loose';
        pending = { p: prevOwner, kind };
        if (kind === 'pass') stat.get(prevOwner).passes++;
        if (kind === 'shot') { stat.get(prevOwner).shots++; lastShot = b.shot.id; }
      }
      if (o) {
        if (!o.isKeeper) stat.get(o).touches++;
        if (pending && pending.p !== o) {
          const s = stat.get(pending.p), same = o.team === pending.p.team;
          if (pending.kind === 'pass') { if (same) s.passDone++; else s.passLost++; }
          if (pending.kind === 'loose' && !same) { s.lost++; if (!o.isKeeper) stat.get(o).won++; }
          if (pending.kind === 'pass' && !same && !o.isKeeper) stat.get(o).won++;
        }
        pending = null;
      }
      prevOwner = o;
    }
    if (b.shot && b.shot.from && stat.has(b.shot.from)) shots.add(b.shot);
  }
  // on target: the keeper had to make a save decision on it (off-target shots skip that)
  for (const s of shots) if (s.saveChance !== undefined) stat.get(s.from).onTarget++;
  for (const g of m.goals) if (g.scorer && stat.has(g.scorer)) stat.get(g.scorer).goals++;
  for (const g of m.goals) if (!g.scorer) tot.ownGoals = (tot.ownGoals || 0) + 1;
  for (const [p, s] of stat) {
    s.tackles = p.stats.tackles || 0; s.slides = p.stats.slides || 0;
    const T = tot[group(p)];
    for (const k in s) if (k !== 'players') T[k] += s[k];
  }
  scores.push(`${m.score.blue}-${m.score.red}`);
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
const per = (T, v) => +(v / N / Math.max(1, T.players / N)).toFixed(2); // per player per match
const rows = {};
for (const [k, T] of Object.entries(tot)) {
  if (typeof T !== 'object') continue;
  rows[k] = {
    goals: per(T, T.goals), shots: per(T, T.shots), onTarget: pct(T.onTarget, T.shots), goalPerShot: pct(T.goals, T.shots),
    passes: per(T, T.passes), passCompletion: pct(T.passDone, T.passDone + T.passLost),
    dispossessed: per(T, T.lost), ballsWon: per(T, T.won), tackles: per(T, T.tackles), tackleSuccess: pct(T.tackles, T.slides), touches: per(T, T.touches),
  };
}
const [bf, ba] = scores.reduce((a, s) => { const [x, y] = s.split('-').map(Number); return [a[0] + x, a[1] + y]; }, [0, 0]);
console.log(`${N} x ${FORMAT} vs ${OPP}${AUTO ? ' bots only' : ''}${CLEAN ? ' NO MISTAKES' : ''} (per player, per 3-min match, own goals ${tot.ownGoals || 0}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.table(rows);
console.log('scores', scores.join('  '), `| avg ${(bf / N).toFixed(1)}-${(ba / N).toFixed(1)}`);
