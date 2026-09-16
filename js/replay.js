// Instant replay of your team's goals: light snapshots of the last few seconds, played back slowed down.
const Replay = {
  RATE: 1 / 40,  // snapshot spacing (sim seconds)
  KEEP: 3.4,     // seconds kept while nothing has happened
  PRE: 2.2,      // shown before the ball crossed the line
  POST: 0.6,     // and after it
  SPEED: 0.6,    // playback speed

  wanted(m) { return !m.autopilot && !m.demo && !m.training && !m.online && !Game.headless && Save.data.settings.replays !== false; },

  // numbers and booleans only: references (owner, shot.from, ai, stats) are handled separately or left alone
  snap(o) {
    const s = {};
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'number' || typeof v === 'boolean') s[k] = v;
    }
    return s;
  },

  frame(m, t) {
    const b = m.ball;
    return {
      t,
      players: m.players.map((p) => this.snap(p)),
      kinds: m.players.map((p) => p.celebKind),
      ball: this.snap(b),
      owner: b.owner ? m.players.indexOf(b.owner) : -1,
      trail: b.trail.map((q) => ({ x: q.x, y: q.y, z: q.z })),
      trailType: b.trailType,
      shot: b.shot ? { ...b.shot } : null,
      bulge: { left: b.netBulge.left, right: b.netBulge.right },
    };
  },

  clear(m) { m.rec = null; m.replay = null; },

  record(m, sdt) {
    if (sdt <= 0 || !this.wanted(m)) return;
    const r = m.rec || (m.rec = { t: 0, next: 0, frames: [], goalT: null });
    if (r.goalT !== null && r.t > r.goalT + this.POST) return;
    r.t += sdt;
    if (r.t < r.next) return;
    r.next = r.t + this.RATE;
    r.frames.push(this.frame(m, r.t));
    const keepFrom = r.goalT !== null ? r.goalT - this.PRE - 0.1 : r.t - this.KEEP;
    while (r.frames.length > 2 && r.frames[1].t < keepFrom) r.frames.shift();
  },

  markGoal(m) { if (m.rec) m.rec.goalT = m.rec.t; },

  start(m) {
    const r = m.rec, g = m.goals[m.goals.length - 1];
    if (!this.wanted(m) || !r || r.goalT === null || r.frames.length < 8 || !g || g.team !== 'blue') return false;
    const t0 = Math.max(r.frames[0].t, r.goalT - this.PRE);
    const t1 = r.frames[r.frames.length - 1].t;
    if (t1 - t0 < 0.8) return false;
    m.replay = { t: t0, t0, t1, i: 0, skip: false, live: this.frame(m, 0) };
    m.phase = 'replay'; m.phaseT = 0;
    Sound.whoosh(true);
    Input.consumePass(); Input.consumeShootPress(); Input.consumeShootRelease(); Input.consumeSkill(); Input.consumeSlide();
    return true;
  },

  // returns true once the replay is over (finished or skipped)
  step(m, dt) {
    const rp = m.replay;
    if (!rp) return true;
    // any action button skips (| so every queue is drained)
    if (Input.consumePass() | Input.consumeShootPress() | Input.consumeSkill() | Input.consumeSlide()) rp.skip = true;
    Input.consumeShootRelease();
    rp.t += dt * this.SPEED;
    if (rp.skip || rp.t >= rp.t1) { this.finish(m); return true; }
    const fr = m.rec.frames;
    while (rp.i < fr.length - 2 && fr[rp.i + 1].t <= rp.t) rp.i++;
    const a = fr[rp.i], c = fr[rp.i + 1] || a;
    const u = c.t > a.t ? clamp((rp.t - a.t) / (c.t - a.t), 0, 1) : 0;
    this.apply(m, a, c, u);
    return false;
  },

  apply(m, a, c, u) {
    m.players.forEach((p, i) => {
      const s = a.players[i], e = c.players[i];
      Object.assign(p, s);
      p.x = lerp(s.x, e.x, u); p.y = lerp(s.y, e.y, u);
      p.celebKind = a.kinds[i];
    });
    const b = m.ball;
    Object.assign(b, a.ball);
    b.x = lerp(a.ball.x, c.ball.x, u); b.y = lerp(a.ball.y, c.ball.y, u); b.z = lerp(a.ball.z, c.ball.z, u);
    b.owner = a.owner >= 0 ? m.players[a.owner] : null;
    b.trail.length = 0;
    for (const q of a.trail) b.trail.push({ x: q.x, y: q.y, z: q.z });
    b.trailType = a.trailType;
    b.shot = a.shot ? { ...a.shot } : null;
    b.netBulge.left = a.bulge.left; b.netBulge.right = a.bulge.right;
  },

  // put the real (post-goal) state back
  finish(m) {
    const rp = m.replay;
    if (!rp) return;
    this.apply(m, rp.live, rp.live, 0);
    m.replay = null;
    Sound.whoosh(false);
  },
};
