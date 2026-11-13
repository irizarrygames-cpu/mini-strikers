// PRO MATCH (build 115): the real rules on a bigger pitch. The ball can go out, and the game
// restarts the way football does:
//   over a touchline              -> a THROW-IN to the side that did not touch it last
//   over a goal line, wide of the posts:
//     last touched by the defenders -> a CORNER to the attackers
//     last touched by the attackers -> a GOAL KICK to the defenders (their keeper takes it)
// The ball goes on the spot and the nearest player takes it (you, if that is you): aim with the
// stick, PASS to play it to a teammate, SHOOT for a long one (at a corner, a shot at goal). A bot
// takes its own after a moment. The other side has to stand back until it has been taken, the clock
// stops while it is set up, and the taker cannot touch it twice in a row.
//
// Only offline matches play this way (Match.create sets m.rules for mode 'pro'); nothing here runs
// in an online match.
const Rules = {
  CLEAR: 190,        // how far back the other side stands while a restart is set up
  BOT_WAIT: [0.9, 1.5], // how long a bot takes over it
  YOU_WAIT: 8,       // you get this long, then it is taken for you
  THROW_Z: 62,       // a throw-in is held over the head
  BACK_SPEED: 900,   // how fast the other side gets out of the way
  CURL_PACE: 1,      // a shot curled in from a corner (curlIn): its pace (x a normal shot's)...
  CURL_AT: [0.15, 0.42], // ...and where it crosses the line (from the near post, x the goal's width): ~12% go in (tools/rulesscan.js)

  // is the ball out of play? Wholly over a touchline, or over a goal line anywhere but in the goal
  out(b) {
    const R = CFG.BALL_R, W = CFG.FIELD_W, H = CFG.FIELD_H;
    if (b.y < -R || b.y > H + R) return true;
    if ((b.x < -R || b.x > W + R) && !(b.y > GOAL_Y1 && b.y < GOAL_Y2)) return true;
    return false;
  },

  // the ball has just gone out: work out the restart and set it up
  start(m) {
    const b = m.ball, W = CFG.FIELD_W, H = CFG.FIELD_H;
    const ox = b.x, oy = b.y, last = b.lastTouchTeam || 'blue';
    if (b.owner) loseBall(m, b.owner, 0);
    b.vx = 0; b.vy = 0; b.vz = 0; b.spinT = 0; b.shot = null; b.trailType = null; b.trail.length = 0;
    let kind, team, bx, by, aimX, aimY;
    if (oy < -CFG.BALL_R || oy > H + CFG.BALL_R) {
      kind = 'throw'; team = otherTeam(last);
      bx = clamp(ox, 40, W - 40); by = oy < 0 ? 0 : H;
      aimX = TEAMS[team].dir * 0.45; aimY = oy < 0 ? 1 : -1;
    } else {
      const leftEnd = ox < W / 2;
      const defending = ownGoalX('blue') === (leftEnd ? 0 : W) ? 'blue' : 'red';
      const top = oy < H / 2;
      if (last === defending) {
        kind = 'corner'; team = otherTeam(defending);
        bx = leftEnd ? 14 : W - 14; by = top ? 14 : H - 14;
      } else {
        kind = 'goalkick'; team = defending;
        bx = leftEnd ? CFG.SMALL_D * 0.7 : W - CFG.SMALL_D * 0.7; by = H / 2 + (top ? -1 : 1) * CFG.SMALL_W * 0.28;
      }
      const tx = kind === 'corner' ? (leftEnd ? CFG.SMALL_D * 1.6 : W - CFG.SMALL_D * 1.6) : W / 2, ty = H / 2;
      const d = Math.hypot(tx - bx, ty - by) || 1;
      aimX = (tx - bx) / d; aimY = (ty - by) / d;
    }
    { const al = Math.hypot(aimX, aimY) || 1; aimX /= al; aimY /= al; }
    // who takes it: the keeper for a goal kick, otherwise the nearest outfield player of that side
    let taker = null;
    if (kind === 'goalkick') taker = m.keepers[team];
    else {
      let best = 1e9;
      for (const p of m.players) {
        if (p.team !== team || p.isKeeper) continue;
        const d = dist(p.x, p.y, bx, by);
        if (d < best) { best = d; taker = p; }
      }
    }
    if (!taker) taker = m.players.find((p) => p.team === team) || m.players[0];
    // stand behind the ball (outside the line for a throw), facing into the pitch
    const back = taker.r + CFG.BALL_R + 3;
    const tx = kind === 'throw' ? bx : bx - aimX * back;
    const ty = kind === 'throw' ? (by === 0 ? -16 : H + 16) : by - aimY * back;
    m.restart = { kind, team, taker, bx, by, tx, ty, ax: aimX, ay: aimY, t: 0, wait: rand(this.BOT_WAIT[0], this.BOT_WAIT[1]), human: !!(taker.isHuman && !m.autopilot) };
    m.phase = 'restart'; m.phaseT = 0;
    for (const p of m.players) {
      p.kickT = 0; p.slideT = 0; p.slideWindT = 0; p.charging = false; p.passCharging = false; p.bufferT = 0; p.passBufferT = 0; p.skillBufferT = 0; p.skill = null;
      if (p.isHuman && !Game.headless) Sound.chargeStop();
    }
    this.place(m);
    b.lastPass = null; b.assist = null;
    // a goal's replay starts from the restart, not from before the ball went out
    Replay.clear(m);
    if (!Game.headless) {
      Sound.whistle();
      const label = { throw: tl('THROW-IN'), corner: tl('CORNER!'), goalkick: tl('GOAL KICK') }[kind];
      // (when it is yours, what to press stays on screen beside the ball until you take it: drawAim)
      FX.showBanner(label, team === 'blue' ? '#ffffff' : '#ffd0d2', 1.2, TEAMS[team].name);
    }
  },

  // the taker on the spot, the ball at their feet (or over their head)
  place(m) {
    const R = m.restart, p = R.taker, b = m.ball;
    p.x = R.tx; p.y = R.ty; p.vx = 0; p.vy = 0; p.mx = 0; p.my = 0;
    p.fx = R.ax; p.fy = R.ay; p.faceX = Math.abs(R.ax) > 0.1 ? Math.sign(R.ax) : p.faceX;
    p.throwIn = R.kind === 'throw';
    b.owner = p;
    if (R.kind === 'throw') { b.x = p.x; b.y = p.y + (R.by === 0 ? 1 : -1); b.z = this.THROW_Z; }
    else { b.x = R.bx; b.y = R.by; b.z = 0; }
    b.vx = 0; b.vy = 0; b.vz = 0;
    b.safeX = b.x; b.safeY = b.y;
  },

  // the 'restart' phase, every step
  step(m, dt) {
    const R = m.restart;
    if (!R) { m.phase = 'play'; return; }
    R.t += dt;
    const b = m.ball, taker = R.taker;
    // you, when you are not the one taking it: move about; PASS asks for it
    for (const h of m.humans) {
      if (h === taker || m.autopilot) continue;
      const I = h.input || Input, mv = I.move, mag = Math.hypot(mv.x, mv.y);
      h.mx = mag > 0.01 ? mv.x / mag : 0; h.my = mag > 0.01 ? mv.y / mag : 0; h.mSpeed = Math.min(1, mag); h.sprinting = I.sprintHeld;
      if (I.consumePass()) { if (h.team === R.team) { h.passRequestT = 1.2; R.wait = Math.min(R.wait, R.t + 0.25); FX.ring(h.x, h.y, '#ffffff', 10, 34, 0.35, 3); } }
      I.consumeShootPress(); I.consumeShootRelease(); I.consumeSkill(); I.consumeSlide(); if (I.consumeUlt) I.consumeUlt();
      if (I.consumePassPress) I.consumePassPress();
      if (I.aim) I.aim = null;
    }
    AI.update(m, dt);
    movePlayers(m, dt);
    this.keepBack(m, dt);
    this.place(m);
    if (R.human) this.yours(m, dt);
    else if (R.t >= R.wait) this.botTake(m);
    // (the ball is on the spot: nothing for updateBall to do but its trail)
    b.trail.length = 0;
  },

  // the other side stands back: out of a circle round the ball, and out of the box for a goal kick.
  // They walk back briskly rather than jump (a quick restart can still catch them close).
  keepBack(m, dt) {
    const R = m.restart, W = CFG.FIELD_W, H = CFG.FIELD_H, step = this.BACK_SPEED * dt;
    for (const p of m.players) {
      if (p.team === R.team || p.isKeeper) continue;
      let x = p.x, y = p.y;
      const dx = x - R.bx, dy = y - R.by, d = Math.hypot(dx, dy);
      if (d < this.CLEAR) {
        // the nearest spot on the circle: straight out, or (when that is off the pitch, at a line or
        // a corner flag) the nearest one that is on it
        const ux = d > 1 ? dx / d : -TEAMS[R.team].dir, uy = d > 1 ? dy / d : 0;
        x = R.bx + ux * (this.CLEAR + 1); y = R.by + uy * (this.CLEAR + 1);
        let best = x < 20 || x > W - 20 || y < 20 || y > H - 20 ? 1e9 : -1;
        for (let i = 0; i < 360 && best >= 0; i++) {
          const a = (i / 360) * Math.PI * 2, cx = R.bx + Math.cos(a) * (this.CLEAR + 1), cy = R.by + Math.sin(a) * (this.CLEAR + 1);
          if (cx < 20 || cx > W - 20 || cy < 20 || cy > H - 20) continue;
          const dd = (cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y);
          if (dd < best) { best = dd; x = cx; y = cy; }
        }
      }
      if (R.kind === 'goalkick') {
        const leftEnd = R.bx < W / 2;
        if (Math.abs(y - H / 2) < CFG.BOX_W / 2 + p.r) {
          if (leftEnd && x < CFG.BOX_D + p.r) x = CFG.BOX_D + p.r;
          if (!leftEnd && x > W - CFG.BOX_D - p.r) x = W - CFG.BOX_D - p.r;
        }
      }
      x = clamp(x, 20, W - 20); y = clamp(y, 20, H - 20);
      const mx = x - p.x, my = y - p.y, ml = Math.hypot(mx, my);
      if (ml < 0.01) continue;
      const k = Math.min(1, step / ml);
      p.x += mx * k; p.y += my * k;
    }
  },

  // which way a restart may be played: never back out over the line it is taken from (a corner may
  // go straight at goal), and a goal kick goes up the pitch, not back at its own goal
  legalAim(m, ax, ay, R = m.restart) {
    const W = CFG.FIELD_W, H = CFG.FIELD_H, MIN = 0.14;
    let l = Math.hypot(ax, ay);
    if (l < 0.2) { ax = R.ax; ay = R.ay; l = Math.hypot(ax, ay) || 1; }
    ax /= l; ay /= l;
    // keep one part of the direction at least lo (and the other part's sign), still a unit vector
    const atLeastX = (lo) => { if (ax < lo) { ax = lo; ay = (ay < 0 ? -1 : 1) * Math.sqrt(1 - lo * lo); } };
    const atMostX = (hi) => { if (ax > hi) { ax = hi; ay = (ay < 0 ? -1 : 1) * Math.sqrt(1 - hi * hi); } };
    const atLeastY = (lo) => { if (ay < lo) { ay = lo; ax = (ax < 0 ? -1 : 1) * Math.sqrt(1 - lo * lo); } };
    const atMostY = (hi) => { if (ay > hi) { ay = hi; ax = (ax < 0 ? -1 : 1) * Math.sqrt(1 - hi * hi); } };
    if (R.kind === 'goalkick') {
      if (R.bx < W / 2) atLeastX(0.3); else atMostX(-0.3);
    } else {
      if (R.by <= 20) atLeastY(MIN);
      if (R.by >= H - 20) atMostY(-MIN);
      if (R.bx <= 20 || R.bx >= W - 20) {
        // a corner: over the goal line is fine only into the goal
        const gx = R.bx <= 20 ? 0 : W, toward = R.bx <= 20 ? ax < 0 : ax > 0;
        const yAt = toward ? R.by + ay * (Math.abs(gx - R.bx) / Math.max(1e-6, Math.abs(ax))) : null;
        const atGoal = toward && yAt > GOAL_Y1 + CFG.BALL_R && yAt < GOAL_Y2 - CFG.BALL_R;
        if (!atGoal) { if (R.bx <= 20) atLeastX(MIN); else atMostX(-MIN); }
      }
    }
    l = Math.hypot(ax, ay) || 1;
    return [ax / l, ay / l];
  },

  // you take it: aim with the stick, PASS to play it, SHOOT (hold for power) for the long one
  yours(m, dt) {
    const R = m.restart, h = R.taker, I = h.input || Input;
    const mv = I.move, mag = Math.hypot(mv.x, mv.y);
    if (mag > 0.3) { const [ax, ay] = this.legalAim(m, mv.x, mv.y); R.ax = ax; R.ay = ay; }
    h.fx = R.ax; h.fy = R.ay;
    I.consumeSkill(); I.consumeSlide(); if (I.consumeUlt) I.consumeUlt();
    if (I.consumePassPress && I.consumePassPress()) { h.passCharging = true; h.passChargeT = 0; }
    if (h.passCharging) h.passChargeT = Math.min(CFG.PASS_CHARGE_FULL, (h.passChargeT || 0) + dt);
    if (I.consumePass()) {
      const charge = h.passCharging ? h.passChargeT : 0;
      h.passCharging = false; h.passChargeT = 0;
      this.take(m, 'pass', R.ax, R.ay, charge);
      return;
    }
    if (I.consumeShootPress()) { h.charging = true; h.chargeT = 0; if (!Game.headless) Sound.chargeStart(); }
    let release = I.consumeShootRelease();
    if (h.charging) { h.chargeT += dt; if (h.chargeT >= CFG.CHARGE_AUTO) release = true; }
    if (release && h.charging) {
      h.charging = false; if (!Game.headless) Sound.chargeStop();
      this.take(m, 'long', R.ax, R.ay, h.chargeT);
      return;
    }
    if (R.t >= this.YOU_WAIT) this.botTake(m);
  },

  // a bot takes it (or it is taken for you): to a teammate who is free, mostly forwards
  botTake(m) {
    const R = m.restart, p = R.taker, dir = TEAMS[R.team].dir, H = CFG.FIELD_H;
    const mates = m.players.filter((q) => q.team === R.team && q !== p && !q.isKeeper);
    if (!mates.length) { this.take(m, 'long', R.ax, R.ay, 0.4); return; }
    // the one you asked for it, if you did
    const asked = !m.autopilot && mates.find((q) => q.isHuman && (q.passRequestT || 0) > 0);
    const free = (q) => {
      let near = 1e9;
      for (const o of m.players) if (o.team !== R.team) near = Math.min(near, dist(o.x, o.y, q.x, q.y));
      return near;
    };
    let target = asked || null;
    if (!target && R.kind === 'corner') {
      // into the box: whoever is nearest the penalty spot, or now and then a short one
      const gx = attackGoalX(R.team), spot = { x: gx - dir * CFG.BOX_D * 0.55, y: H / 2 };
      const inBox = mates.slice().sort((a, c) => dist(a.x, a.y, spot.x, spot.y) - dist(c.x, c.y, spot.x, spot.y));
      target = Math.random() < 0.25 ? mates.slice().sort((a, c) => dist(a.x, a.y, R.bx, R.by) - dist(c.x, c.y, R.bx, R.by))[0] : inBox[0];
    }
    if (!target) {
      // the best of the rest: free of a marker, and further up the pitch counts for more
      let best = -1e9;
      for (const q of mates) {
        const d = dist(q.x, q.y, R.bx, R.by);
        if (d > (R.kind === 'goalkick' ? 1500 : 760) || d < 60) continue;
        const up = (q.x - R.bx) * dir;
        const score = Math.min(free(q), 260) * 1.2 + up * (R.kind === 'goalkick' ? 0.5 : 0.25) - d * 0.12 + (q.isHuman ? 60 : 0);
        if (score > best) { best = score; target = q; }
      }
    }
    if (!target) target = mates.slice().sort((a, c) => dist(a.x, a.y, R.bx, R.by) - dist(c.x, c.y, R.bx, R.by))[0];
    const d = dist(R.bx, R.by, target.x, target.y) || 1;
    const [ax, ay] = this.legalAim(m, (target.x - R.bx) / d, (target.y - R.by) / d);
    const lofted = R.kind === 'corner' ? d > 220 : R.kind === 'goalkick' ? d > 700 : false;
    this.take(m, 'pass', ax, ay, lofted ? CFG.PASS_CHARGE_FULL : 0, target);
  },

  // put it in play
  take(m, how, ax, ay, charge, target = null) {
    const R = m.restart;
    if (!R) return;
    const p = R.taker, b = m.ball;
    [ax, ay] = this.legalAim(m, ax, ay);
    m.restart = null;
    m.phase = 'play'; m.phaseT = 0;
    p.throwIn = false;
    // the ball where it is played from, just inside the line
    b.owner = p; b.z = 0;
    b.x = R.bx + ax * 2; b.y = R.by + ay * 2;
    b.safeX = b.x; b.safeY = b.y;
    p.fx = ax; p.fy = ay;
    let ok;
    if (how === 'long' && R.kind === 'corner') {
      // at a corner, SHOOT is a go at goal: it swings out over the pitch and curls back in
      ok = performShot(m, p, Math.max(charge, CFG.CHARGE_MED), ay);
      if (ok && !(b.shot && b.shot.ult)) this.curlIn(m, p, R);
    } else if (how === 'long') {
      ok = performPass(m, p, ax, ay, null, CFG.PASS_CHARGE_FULL);
    } else {
      ok = performPass(m, p, ax, ay, target, charge);
    }
    if (!ok) { b.owner = null; b.vx = ax * 420; b.vy = ay * 420; b.lastKicker = p; b.lastTouchTeam = p.team; }
    // the kick's own wobble can still send a ball played along a line back over it: not from a
    // restart (a corner curled at goal starts out into the pitch already)
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 1 && !(b.spinT > 0)) { const [vx, vy] = this.legalAim(m, b.vx, b.vy, R); b.vx = vx * sp; b.vy = vy * sp; }
    if (R.kind === 'throw') {
      // thrown, not kicked: up and over, a little gentler, and nobody scores from it directly
      b.z = 30; b.vz = Math.max(b.vz, 170);
      b.vx *= 0.92; b.vy *= 0.92;
      b.shot = null; b.trailType = 'pass';
    }
    b.lastTouchTeam = p.team; b.lastKicker = p;
    b.restartBy = p; b.restartKind = R.kind; b.restartT = m.clock;
    // no second touch until somebody else has had it
    p.noPickupT = Math.max(p.noPickupT, 0.55);
    p.charging = false; p.passCharging = false;
  },

  // A shot straight from a corner: the flag is level with the goal line, so a ball hit straight at
  // the goal would run along the line and out. It goes the way a real one does instead — out over
  // the pitch and bending back in, to cross the line inside the goal (where the keeper can still
  // get to it). The bend is worked out by flying the ball ahead of time with the game's own ball
  // physics, and the one that crosses nearest the spot it was meant for is kept.
  curlIn(m, p, R) {
    const b = m.ball, H = CFG.FIELD_H, dir = TEAMS[p.team].dir, gx = attackGoalX(p.team);
    const top = R.by < H / 2, lineX = gx + dir * CFG.BALL_R, vz0 = b.vz;
    const speed0 = (Math.hypot(b.vx, b.vy) || CFG.SHOT_STRONG) * this.CURL_PACE;
    const lo = GOAL_Y1 + CFG.BALL_R + 18, hi = GOAL_Y2 - CFG.BALL_R - 18;
    // where it is meant to cross: the near half of the goal, where the keeper is (see CURL_AT)
    const k = rand(this.CURL_AT[0], this.CURL_AT[1]);
    const tx = gx + dir * 50, ty = top ? GOAL_Y1 + CFG.GOAL_W * k : GOAL_Y2 - CFG.GOAL_W * k;
    const D = Math.hypot(tx - b.x, ty - b.y) || 1, ux = (tx - b.x) / D, uy = (ty - b.y) / D;
    // the bend points out over the goal line, so it is launched into the pitch and swings back
    let px = -uy, py = ux;
    if (px * dir < 0) { px = -px; py = -py; }
    let best = null;
    // a scuffed one that would never get there is hit a bit harder: the first pace that makes it
    for (const pace of [1, 1.15, 1.3, 1.5]) {
      const speed = speed0 * pace, T = D / (speed * 0.88);
      for (const B of [120, 170, 230, 300, 380]) {
        const lx = tx - px * B - b.x, ly = ty - py * B - b.y, LL = Math.hypot(lx, ly) || 1;
        for (const f of [0.7, 0.85, 1, 1.15, 1.3]) {
          const a = ((2 * B) / (T * T)) * f;
          const shot = { vx: (lx / LL) * speed, vy: (ly / LL) * speed, sx: px * a, sy: py * a, sT: T * 1.05 };
          const hit = this.flyTo(b.x, b.y, vz0, shot, lineX, dir);
          if (!hit || hit.y <= lo || hit.y >= hi) continue;
          const miss = Math.abs(hit.y - ty);
          if (!best || miss < best.miss) best = { miss, shot, hit };
        }
      }
      if (best) break;
    }
    // (none would: it stays the plain shot, and take() keeps it from going straight back out)
    if (!best) { b.spinT = 0; return; }
    const S = best.shot;
    b.vx = S.vx; b.vy = S.vy; b.spinX = S.sx; b.spinY = S.sy; b.spinT = S.sT;
    // the keeper reads it by where and when it will cross the line (AI.decideSave): a ball running
    // along the line fools his usual guess
    if (b.shot) { b.shot.curved = true; b.shot.curl = { y: best.hit.y, at: m.clock + best.hit.t }; }
    const l = Math.hypot(S.vx, S.vy) || 1;
    p.fx = S.vx / l; p.fy = S.vy / l;
  },

  // fly a free ball (no players, no walls) the way updateBall does: where and when does it cross
  // the goal line? null if it stops, or goes out over a touchline, first
  flyTo(x, y, vz, S, lineX, dir) {
    const h = 1 / 480, H = CFG.FIELD_H;
    let vx = S.vx, vy = S.vy, z = 0, spinT = S.sT;
    for (let i = 0; i < 480 * 3; i++) {
      if (spinT > 0) { vx += S.sx * h; vy += S.sy * h; spinT -= h; }
      if (z > 0 || vz > 0) {
        vz -= CFG.GRAVITY * h; z += vz * h;
        if (z <= 0) { z = 0; vz = vz < -110 ? -vz * CFG.BALL_BOUNCE : 0; }
      }
      const damp = Math.exp(-(z > 0.5 ? CFG.BALL_AIR_DRAG : CFG.BALL_FRICTION) * h);
      vx *= damp; vy *= damp;
      if (z <= 0.5) {
        const s = Math.hypot(vx, vy);
        if (s < 45 * h + 0.5) return null;
        const k = (s - 45 * h) / s; vx *= k; vy *= k;
      }
      x += vx * h; y += vy * h;
      if ((x - lineX) * dir >= 0) return { y, t: (i + 1) * h };
      if (y < -CFG.BALL_R || y > H + CFG.BALL_R) return null;
    }
    return null;
  },

  // A throw-in cannot go straight in: if the thrower's ball crosses the line between the posts with
  // nobody else touching it, it is a goal kick (or a corner, thrown into your own goal) instead.
  noGoal(m) {
    const b = m.ball;
    // (a defender who gets a touch on it — a deflection, a keeper's glove — makes it count)
    return b.restartKind === 'throw' && !!b.restartBy && b.lastKicker === b.restartBy && b.lastTouchTeam === b.restartBy.team;
  },

  // your aim at a restart, drawn from the ball: an arrow the way it will go
  drawAim(ctx, m, t) {
    const R = m.restart;
    if (!R || !R.human) return;
    const x0 = Render.sx(R.bx, R.by), y0 = Render.sy(R.by, 0), k = Render.k(R.by);
    const len = 120, x1 = Render.sx(R.bx + R.ax * len, R.by + R.ay * len), y1 = Render.sy(R.by + R.ay * len, 0);
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([10 * k, 8 * k]);
    ctx.lineWidth = 8 * k; ctx.strokeStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.lineWidth = 4.5 * k; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(y1 - y0, x1 - x0), hs = 13 * k * pulse;
    ctx.beginPath(); ctx.moveTo(x1 + Math.cos(ang) * hs, y1 + Math.sin(ang) * hs);
    ctx.lineTo(x1 + Math.cos(ang + 2.4) * hs, y1 + Math.sin(ang + 2.4) * hs);
    ctx.lineTo(x1 + Math.cos(ang - 2.4) * hs, y1 + Math.sin(ang - 2.4) * hs); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
    // the countdown before it is taken for you
    const left = Math.ceil(this.YOU_WAIT - R.t);
    if (left <= 3 && left > 0) Render.chunkyText(ctx, String(left), x0, y0 - 70 * k, 26 * k, '#ffe14d', 4 * k);
    // what to press: across the middle of the screen, on the other half from the ball — clear of
    // the scoreboard and the map at the top and the stick and buttons at the sides
    const W = Render.W, H = Render.H;
    const how = R.kind === 'throw' ? tl('AIM, THEN PASS TO THROW · SHOOT FOR A LONG ONE')
      : R.kind === 'corner' ? tl('AIM, THEN PASS TO CROSS IT · SHOOT TO GO FOR GOAL') : tl('AIM, THEN PASS · SHOOT FOR A LONG ONE');
    let size = clamp(H * 0.037, 14, 20);
    ctx.font = `400 ${size}px "Lilita One", system-ui, sans-serif`;
    const tw = ctx.measureText(how).width + size * 0.4, room = W * 0.6;
    if (tw > room) size *= room / tw;
    const hy = y0 < H * 0.5 ? H * 0.62 : H * 0.3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    Render.chunkyText(ctx, how, W / 2, hy, size, '#ffffff', size * 0.22);
    ctx.restore();
  },
};
