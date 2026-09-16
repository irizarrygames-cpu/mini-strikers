// Simple role-based AI: one presser, markers, supporters, and a goalkeeper.
// Keeper save model (see decideSave). blueBonus is for the bots' shots at your keeper.
const KEEPER = { base: 0.94, speed: 0.34, power: 0.12, close: 0.2, mid: 0.08, far: 0.12, corner: 0.22, blueBonus: 0, botShot: 0.04,
  format: { '4v4': 0, '3v3': 0.03, '2v2': 0.08, '1v1': 0.18 } };
const AI = {
  update(m, dt) {
    const b = m.ball;
    const humanAI = m.autopilot;
    for (const p of m.players) p.ai.job = null;

    // loose ball: at most one chaser per team
    const chaser = { blue: null, red: null };
    if (!b.owner) {
      const px = b.x + b.vx * 0.25, py = b.y + b.vy * 0.25;
      for (const team of ['blue', 'red']) {
        let best = null, bt = 1e9, humanT = 1e9, human = null;
        for (const p of m.players) {
          if (p.team !== team || p.isKeeper) continue;
          const t = dist(p.x, p.y, px, py) / (CFG.SPEED * p.speedMul) + (p.stunT > 0 ? 0.3 : 0);
          if (p.isHuman && !humanAI) { if (t < humanT) { humanT = t; human = p; } continue; }
          if (t < bt) { bt = t; best = p; }
        }
        if (human && best) {
          const toward = ((px - human.x) * human.vx + (py - human.y) * human.vy) / (dist(human.x, human.y, px, py) || 1);
          if (humanT < bt - 0.05 && (toward > 60 || humanT < 0.35)) best = null;
        }
        chaser[team] = best;
      }
      // a pass in flight belongs to its intended receiver
      const lp = b.lastPass;
      if (lp && lp.target && m.clock - lp.t < 1.6) {
        chaser[lp.team] = lp.target.isHuman && !humanAI ? null : lp.target;
      }
    }

    // defending: nearest presses the carrier, the rest mark
    const c = b.owner;
    if (c && !c.isKeeper) {
      const defTeam = otherTeam(c.team);
      const defs = m.players.filter((p) => p.team === defTeam && !p.isKeeper && !(p.isHuman && !humanAI));
      defs.sort((a, d) => dist(a.x, a.y, c.x, c.y) - dist(d.x, d.y, c.x, c.y));
      const attackers = m.players.filter((p) => p.team === c.team && !p.isKeeper && p !== c);
      if (defs.length) defs[0].ai.job = { kind: 'press' };
      const taken = new Set();
      for (let i = 1; i < defs.length; i++) {
        let bestO = null, bd = 1e9;
        for (const o of attackers) {
          if (taken.has(o)) continue;
          const d = dist(defs[i].x, defs[i].y, o.x, o.y);
          if (d < bd) { bd = d; bestO = o; }
        }
        if (bestO) { taken.add(bestO); defs[i].ai.job = { kind: 'mark', o: bestO }; }
      }
    }

    for (const h of m.humans) h.passRequestT = Math.max(0, (h.passRequestT || 0) - dt);
    for (const p of m.players) {
      if (p.isHuman && !humanAI) continue;
      if (p.isKeeper) this.keeper(m, p, dt);
      else this.outfield(m, p, dt, chaser);
    }
  },

  anchor(m, p, phase) {
    const b = m.ball, dir = TEAMS[p.team].dir, W = CFG.FIELD_W, H = CFG.FIELD_H;
    const bu = dir > 0 ? b.x / W : 1 - b.x / W, bv = b.y / H;
    const shift = phase === 'att' ? 0.12 : phase === 'def' ? -0.1 : 0;
    let u, v;
    switch (p.role) {
      case 'def': u = 0.15 + 0.32 * bu + shift * 0.6; v = 0.5 + (bv - 0.5) * 0.45; break;
      case 'midL': u = 0.3 + 0.42 * bu + shift; v = 0.24 + (bv - 0.5) * 0.25; break;
      case 'midR': u = 0.3 + 0.42 * bu + shift; v = 0.76 + (bv - 0.5) * 0.25; break;
      case 'mid': u = 0.32 + 0.42 * bu + shift; v = 0.5 + (bv - 0.5) * 0.55 + (bv > 0.5 ? -0.18 : 0.18); break;
      default: u = 0.5 + 0.38 * bu + shift; v = 0.5 + (bv - 0.5) * 0.5;
    }
    u = clamp(u, 0.06, 0.9);
    return { x: dir > 0 ? u * W : (1 - u) * W, y: clamp(v, 0.08, 0.92) * H };
  },

  minOppDist(m, team, x, y) {
    let md = 1e9;
    for (const o of m.players) if (o.team !== team) md = Math.min(md, dist(o.x, o.y, x, y));
    return md;
  },

  // online every bot plays the same; offline your teammates play at your country's level
  // and the opponents at theirs plus the difficulty setting
  rates(m, p) {
    if (p.botDiff) return p.botDiff; // a poor bot standing in for someone who left
    if (m.online || !m.mateDiff) return m.diff;
    if (m.autopilot) return p.team === 'red' ? m.diff : m.mateDiff;
    return m.teamHuman[p.team] ? m.mateDiff : m.diff;
  },

  // sprint only with enough in the tank, so bots don't gas out constantly
  wantSprint(p, yes) { p.sprinting = yes && (p.sprintOn || p.stamina > 0.3); },

  outfield(m, p, dt, chaser) {
    const b = m.ball;
    if (b.owner === p) { p.ai.lapseT = 0; this.carrier(m, p, dt); return; }
    p.charging = false;
    p.sprinting = false;
    // average players switch off now and then: ball-watching, jogging, late to react
    if ((p.ai.lapseT || 0) > 0) p.ai.lapseT -= dt;
    else if (Math.random() < BOT_MISTAKES.lapse * (this.rates(m, p).mistakes || 1) * dt) p.ai.lapseT = rand(BOT_MISTAKES.lapseTime[0], BOT_MISTAKES.lapseTime[1]);
    const lapsing = p.ai.lapseT > 0 && dist(p.x, p.y, b.x, b.y) > 120;
    const own = b.owner ? b.owner.team : null;
    let tx, ty, sp = 1;
    if (!own) {
      const lp = b.lastPass;
      const bs = Math.hypot(b.vx, b.vy);
      if (chaser[p.team] === p && lp && lp.target === p && bs > 60) {
        // meet the pass: closest point on the ball's path, a little toward the ball
        const ux = b.vx / bs, uy = b.vy / bs;
        const along = clamp((p.x - b.x) * ux + (p.y - b.y) * uy, 0, bs / CFG.BALL_FRICTION);
        tx = b.x + ux * along * 0.85; ty = b.y + uy * along * 0.85;
      } else if (chaser[p.team] === p) {
        const t = dist(p.x, p.y, b.x, b.y) / CFG.SPEED;
        const look = Math.min(t, 0.8);
        tx = b.x + b.vx * look * 0.8; ty = b.y + b.vy * look * 0.8;
        this.wantSprint(p, dist(p.x, p.y, b.x, b.y) > 150);
      } else {
        const a = this.anchor(m, p, 'loose');
        tx = lerp(a.x, b.x, 0.12); ty = lerp(a.y, b.y, 0.12); sp = 0.85;
      }
    } else if (own === p.team) {
      p.ai.spotT -= dt;
      if (p.ai.spotT <= 0) { p.ai.spotT = rand(0.45, 0.8); this.supportSpot(m, p); }
      tx = p.ai.tx; ty = p.ai.ty; sp = 0.92;
      this.wantSprint(p, dist(p.x, p.y, tx, ty) > 300);
    } else {
      const job = p.ai.job, carrier = b.owner;
      const dC = dist(p.x, p.y, carrier.x, carrier.y);
      if (job && job.kind === 'press') {
        const gx = ownGoalX(p.team), gy = CFG.FIELD_H / 2;
        const l = dist(carrier.x, carrier.y, gx, gy) || 1;
        tx = carrier.x + carrier.vx * 0.15 + ((gx - carrier.x) / l) * 8;
        ty = carrier.y + carrier.vy * 0.15 + ((gy - carrier.y) / l) * 8;
        this.wantSprint(p, dC > 160 && !lapsing);
        if (!lapsing && this.trySlide(m, p, carrier, dC, dt, 1)) return;
      } else if (job && job.kind === 'mark') {
        const o = job.o, gx = ownGoalX(p.team), gy = CFG.FIELD_H / 2;
        const l = dist(o.x, o.y, gx, gy) || 1;
        const goalSideX = o.x + ((gx - o.x) / l) * 70, goalSideY = o.y + ((gy - o.y) / l) * 70;
        tx = lerp(goalSideX, carrier.x, 0.22); ty = lerp(goalSideY, carrier.y, 0.22);
        sp = 0.95;
        if (dC < 130 && !lapsing && this.trySlide(m, p, carrier, dC, dt, 0.4)) return;
      } else {
        const a = this.anchor(m, p, 'def');
        tx = a.x; ty = a.y; sp = 0.9;
      }
    }
    if (lapsing) { sp *= 0.4; p.sprinting = false; }
    this.steer(m, p, tx, ty, sp);
  },

  // Pressing bots commit to a tackle lunge from close range (telegraphed when it's at you).
  trySlide(m, p, carrier, dC, dt, weight) {
    p.ai.slideT -= dt;
    if (p.ai.slideT > 0) return false;
    p.ai.slideT = 0.2;
    if (dC < 28 || dC > 140 || p.slideCd > 0 || carrier.fallT > 0 || carrier.protectT > 0) return false;
    const vsHuman = carrier.isHuman && !m.autopilot;
    // only one bot at a time commits to a tackle on you
    if (vsHuman && (carrier.slideLock || 0) > m.clock) return false;
    let chance = this.rates(m, p).aiSlide * weight * (dC < 90 ? 1.2 : 0.7);
    if (Math.random() >= chance) return false;
    const b = m.ball, windup = vsHuman ? SLIDE.windup : SLIDE.botWindup;
    const lead = dC / SLIDE.speed + windup;
    const ok = performSlide(m, p, b.x + carrier.vx * lead - p.x, b.y + carrier.vy * lead - p.y, windup);
    if (ok && vsHuman) carrier.slideLock = m.clock + windup + SLIDE.time + 0.8;
    return ok;
  },

  steer(m, p, tx, ty, sp) {
    let dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    let mx = d > 0.01 ? dx / d : 0, my = d > 0.01 ? dy / d : 0;
    let rx = 0, ry = 0;
    for (const q of m.players) {
      if (q === p || q.team !== p.team) continue;
      const ex = p.x - q.x, ey = p.y - q.y, e = Math.hypot(ex, ey);
      if (e < 140 && e > 0.01) { const w = (1 - e / 140) * 0.9; rx += (ex / e) * w; ry += (ey / e) * w; }
    }
    if (m.ball.owner && m.ball.owner !== p && m.ball.owner.team === p.team) {
      // don't crowd our own ball carrier
      const o = m.ball.owner, ex = p.x - o.x, ey = p.y - o.y, e = Math.hypot(ex, ey);
      if (e < 180 && e > 0.01) { const w = (1 - e / 180) * 1.2; rx += (ex / e) * w; ry += (ey / e) * w; }
    }
    mx += rx; my += ry;
    const l = Math.hypot(mx, my);
    if (d < 10 && Math.hypot(rx, ry) < 0.2) { p.mx = 0; p.my = 0; return; }
    p.mx = l > 0.01 ? mx / l : 0; p.my = l > 0.01 ? my / l : 0;
    p.mSpeed = clamp(d / 60, 0.25, 1) * sp;
  },

  supportSpot(m, p) {
    const a = this.anchor(m, p, 'att'), dir = TEAMS[p.team].dir, c = m.ball.owner;
    const cands = [[0, 0], [160, 0], [-120, 0], [0, 160], [0, -160], [120, 120], [120, -120], [270, 0]];
    let best = a, bestS = -1e9;
    for (const [ox, oy] of cands) {
      const x = clamp(a.x + ox * dir, 40, CFG.FIELD_W - 40), y = clamp(a.y + oy, 40, CFG.FIELD_H - 40);
      let s = Math.min(this.minOppDist(m, p.team, x, y), 260) / 260;
      if (c && laneBlocked(m, p.team, c.x, c.y, x, y, 14)) s -= 0.5;
      s -= Math.hypot(ox, oy) / 900;
      s += (ox * dir > 0 ? 0.12 : 0);
      for (const q of m.players) {
        if (q !== p && q.team === p.team && dist(q.x, q.y, x, y) < 170) s -= 0.5;
      }
      if (s > bestS) { bestS = s; best = { x, y }; }
    }
    p.ai.tx = best.x; p.ai.ty = best.y;
  },

  bestPass(m, p) {
    const dir = TEAMS[p.team].dir, gx = attackGoalX(p.team);
    let best = null, bestS = -1e9;
    for (const q of m.players) {
      if (q.team !== p.team || q === p) continue;
      const d = dist(p.x, p.y, q.x, q.y);
      if (d < 90 || d > 1100) continue;
      const open = this.minOppDist(m, p.team, q.x, q.y);
      let s = clamp(open / 240, 0, 1);
      if (open < 45) s -= 0.8; // someone is standing on the receiver
      s += (((q.x - p.x) * dir) / 700) * 0.55;
      // a lane with someone near it gets chipped (fine over distance, risky up close)
      if (laneBlocked(m, p.team, p.x, p.y, q.x, q.y, 26)) s -= d > 260 ? 0.25 : 0.9;
      s -= d / 2600;
      if (q.isHuman && !m.autopilot) s += 0.35;
      if (Math.abs(q.x - gx) < 650) s += 0.25;
      if (q.isKeeper) s -= 1;
      s += rand(-1, 1) * BOT_MISTAKES.wrongPass * (this.rates(m, p).mistakes || 1); // not always the best option
      if (s > bestS) { bestS = s; best = q; }
    }
    return best ? { q: best, s: bestS } : null;
  },

  carrier(m, p, dt) {
    const b = m.ball, diff = this.rates(m, p), slip = diff.mistakes || 1;
    const gx = attackGoalX(p.team), gy = CFG.FIELD_H / 2;
    p.ai.holdT += dt;

    // a real teammate asked for the ball
    const asker = !m.autopilot && m.humans.find((h) => h.team === p.team && h.passRequestT > 0);
    if (asker) {
      asker.passRequestT = 0;
      performPass(m, p, asker.x - p.x, asker.y - p.y, asker);
      return;
    }

    // a slide is coming: roll once per slide to dodge it with a hop or a spin
    for (const o of m.players) {
      if (o.team === p.team || o.slideT <= 0 || o.slideHit) continue;
      const ox = p.x - o.x, oy = p.y - o.y, od = Math.hypot(ox, oy);
      if (od > 150 || (ox * o.slideDirX + oy * o.slideDirY) / (od || 1) < 0.5) continue;
      if (m.clock - o.slideStart > 0.18) continue; // bots react inside the first moment or not at all
      const key = o.id + '@' + o.slideStart;
      if (p.ai.dodgeKey === key) break;
      p.ai.dodgeKey = key;
      if (Math.random() < this.rates(m, p).aiDodge + (o.isHuman ? 0.1 : 0)) {
        if (Math.random() < 0.65) performSkill(m, p, 0, 0);
        else performSkill(m, p, -o.slideDirY, o.slideDirX);
      }
      break;
    }

    if (p.charging) {
      p.chargeT += dt;
      p.mx = (gx - p.x) / (dist(p.x, p.y, gx, gy) || 1); p.my = (gy - p.y) / (dist(p.x, p.y, gx, gy) || 1); p.mSpeed = 0.7;
      if (p.chargeT >= p.ai.chargeGoal) {
        p.charging = false;
        performShot(m, p, p.chargeT, p.ai.sideY, diff.aiShotNoise);
      }
      return;
    }

    p.ai.decideT -= dt;
    const dG = dist(p.x, p.y, gx, gy);
    if (p.ai.decideT <= 0) {
      p.ai.decideT = rand(0.16, 0.3) * diff.react;
      let nearOpp = 1e9;
      for (const o of m.players) {
        if (o.team === p.team) continue;
        const d = dist(o.x, o.y, p.x, p.y);
        const front = (o.x - p.x) * p.fx + (o.y - p.y) * p.fy > -10;
        if (front && d < nearOpp) nearOpp = d;
      }
      this.wantSprint(p, nearOpp > 140 && dG > 360);
      // too big a touch with a defender close: the ball runs away
      if (nearOpp < 85 && p.protectT <= 0 && !p.skill && Math.random() < BOT_MISTAKES.looseTouch * slip) {
        loseBall(m, p, 0.3);
        const a = Math.atan2(p.fy, p.fx) + rand(-0.5, 0.5), v = rand(300, 420);
        b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.vz = 30;
        b.lastTouchTeam = p.team; b.lastKicker = p;
        return;
      }
      // beat a close defender with a skill now and then
      if (nearOpp < 110 && p.skillCd <= 0 && Math.random() < this.rates(m, p).aiSkill) {
        const r = Math.random();
        const kind = r < 0.55 ? performSkill(m, p, p.fx, p.fy)
          : r < 0.85 ? performSkill(m, p, -p.fy * (Math.random() < 0.5 ? 1 : -1), p.fx * (Math.random() < 0.5 ? 1 : -1))
          : performSkill(m, p, -p.fx, -p.fy);
        if (kind) return;
      }
      const lineDist = Math.abs(p.x - gx);
      const blocked = laneBlocked(m, p.team, p.x, p.y, gx, gy, 10);
      const longShot = dG >= 880 && dG < 1300 && !blocked && Math.random() < BOT_MISTAKES.longShot * slip;
      if (longShot || (dG < 880 && lineDist > 40 && (!blocked || dG < 520) && Math.random() < (dG < 520 ? 0.9 : 0.55))) {
        p.charging = true; p.chargeT = 0;
        const powerReady = m.meter[p.team] >= CFG.POWER_MAX && (p.team === 'red' || m.autopilot);
        const cs = CFG.CHARGE_FULL / 1.4; // these hold times were tuned when a full charge took 1.4s
        p.ai.chargeGoal = (powerReady ? rand(0.85, 1.0) : dG < 380 ? rand(0.05, 0.55) : rand(0.35, 1.0)) * cs;
        p.ai.sideY = Math.random() < 0.35 ? rand(-1, 1) : 0;
        return;
      }
      const pressured = nearOpp < 100 || p.ai.holdT > 1.8 || (blocked && dG < 900 && Math.random() < 0.6);
      const opt = this.bestPass(m, p);
      if (opt && ((pressured && opt.s > 0.25) || (opt.s > 0.8 && Math.random() < 0.35))) {
        performPass(m, p, opt.q.x - p.x, opt.q.y - p.y, opt.q);
        return;
      }
      // dribble toward goal, sidestepping defenders in front
      const dir = TEAMS[p.team].dir;
      let aimX = gx, aimY = gy;
      if (lineDist < 170 && Math.abs(p.y - gy) > CFG.GOAL_W / 2 - 25) { aimX = gx - dir * 230; aimY = gy; }
      const dA = dist(p.x, p.y, aimX, aimY) || 1;
      let dx = (aimX - p.x) / dA, dy = (aimY - p.y) / dA;
      let ax = 0, ay = 0;
      for (const o of m.players) {
        if (o.team === p.team) continue;
        const ox = o.x - p.x, oy = o.y - p.y, od = Math.hypot(ox, oy);
        if (od > 180 || od < 0.01) continue;
        if (ox * dx + oy * dy < 0) continue;
        const cross = dx * oy - dy * ox;
        const side = cross > 0 ? -1 : 1;
        const w = (1 - od / 180) * 1.3;
        ax += -dy * side * w; ay += dx * side * w;
      }
      if (p.y < 150) ay += 0.6; if (p.y > CFG.FIELD_H - 150) ay -= 0.6;
      dx += ax; dy += ay;
      const l = Math.hypot(dx, dy) || 1;
      p.ai.dribX = dx / l; p.ai.dribY = dy / l;
    }
    p.mx = p.ai.dribX || 0; p.my = p.ai.dribY || 0; p.mSpeed = 1;
  },

  keeper(m, k, dt) {
    const b = m.ball, dir = TEAMS[k.team].dir, gx = ownGoalX(k.team), gy = CFG.FIELD_H / 2;
    if (b.owner === k) {
      k.holdT += dt; k.mx = 0; k.my = 0;
      if (k.holdT > 0.75) {
        const opt = this.bestPass(m, k);
        if (opt) performPass(m, k, opt.q.x - k.x, opt.q.y - k.y, opt.q);
        else performPass(m, k, dir, rand(-0.4, 0.4), null);
        k.noPickupT = 0.6;
      }
      return;
    }
    if (k.diveT > 0) { k.mx = 0; k.my = 0; return; }

    const s = b.shot;
    if (s && s.team !== k.team && !b.owner && !s.decided) this.decideSave(m, k, b, false);

    let tx, ty, sp = 1;
    const bs = Math.hypot(b.vx, b.vy);
    const threat = s && s.team !== k.team;
    let nearest = true;
    if (!b.owner && inOwnBox(k.team, b.x, b.y) && bs < 460 && b.z < 30 && !threat) {
      const dk = dist(k.x, k.y, b.x, b.y);
      for (const o of m.players) if (o.team !== k.team && dist(o.x, o.y, b.x, b.y) < dk - 10) nearest = false;
      if (nearest) { tx = b.x; ty = b.y; }
    }
    // any loose ball rolling at goal (deflection, rebound, slow shot): get in its path
    if (tx === undefined && !b.owner && !threat && b.vx * dir < -60) {
      const t = (gx - b.x) / b.vx;
      const py = b.y + b.vy * t;
      if (t > 0 && t < 1.6 && py > GOAL_Y1 - 20 && py < GOAL_Y2 + 20) {
        tx = gx + dir * 26; ty = clamp(py, GOAL_Y1 + 16, GOAL_Y2 - 16);
      }
    }
    // an attacker dribbling right at goal: come out and smother it
    // an attacker walking it in: come out and smother — telegraphed, and only up close
    if (tx === undefined && b.owner && b.owner.team !== k.team && dist(b.owner.x, b.owner.y, gx, gy) < 150) {
      tx = lerp(k.x, b.x, 0.15); ty = lerp(k.y, b.y, 0.6);
      const dC = dist(k.x, k.y, b.owner.x, b.owner.y);
      k.ai.slideT -= dt;
      if (k.ai.slideT <= 0 && dC < 80 && k.slideCd <= 0) {
        k.ai.slideT = 0.25;
        const vsHuman = b.owner.isHuman && !m.autopilot;
        if (Math.random() < (vsHuman ? 0.3 : 0.5) && performSlide(m, k, b.x - k.x, b.y - k.y, vsHuman ? SLIDE.windup : 0)) return;
      }
    }
    if (tx === undefined) {
      ty = clamp(gy + (b.y - gy) * 0.45, GOAL_Y1 + 28, GOAL_Y2 - 28);
      const dBall = dist(gx, gy, b.x, b.y);
      const out = b.owner && b.owner.team !== k.team && dBall < 700 ? (1 - dBall / 700) * 45 : 0;
      tx = gx + dir * (36 + out);
      sp = 0.9;
    }
    const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
    if (d > 3) { k.mx = dx / d; k.my = dy / d; k.mSpeed = clamp(d / 35, 0.2, 1) * sp; }
    else { k.mx = 0; k.my = 0; }
  },

  // Decide once per shot whether the keeper saves it, then dive accordingly.
  decideSave(m, k, b, late) {
    const s = b.shot;
    if (!s || s.decided) return;
    const dir = TEAMS[k.team].dir, lineX = ownGoalX(k.team);
    if (b.vx * dir > -40 && !late) return;
    const t = b.vx * dir < -1 ? (lineX - b.x) / b.vx : 0.05;
    if (!late && (t < 0 || t > 1.0)) return;
    const st = Math.min(t, b.spinT);
    const py = b.y + b.vy * t + 0.5 * b.spinY * st * st;
    s.decided = true;
    if (py < GOAL_Y1 - 30 || py > GOAL_Y2 + 30) { s.save = true; return; } // off target

    // Additive save chance so no single factor pins it at the cap. Tuned with HT.shootingReport().
    const K = KEEPER, diff = m.diff;
    const dShot = dist(s.x0, s.y0, lineX, CFG.FIELD_H / 2);
    let c = K.base;
    c -= clamp((s.speed - CFG.SHOT_WEAK) / (CFG.SHOT_POWER - CFG.SHOT_WEAK), 0, 1) * K.speed;
    if (s.power) c -= K.power;
    if (dShot < 460) c -= K.close; else if (dShot < 740) c -= K.mid; else if (dShot > 820) c += K.far;
    // only a genuinely tight angle (wide of the goal, near the line) helps the keeper
    const wide = Math.max(0, Math.abs(s.y0 - CFG.FIELD_H / 2) - CFG.GOAL_W / 2);
    const angle = wide / Math.max(80, Math.abs(s.x0 - lineX));
    if (angle > 1.2) c += 0.12; else if (angle > 0.7) c += 0.05;
    c -= clamp(Math.abs(py - k.y) / (CFG.GOAL_W * 0.42), 0, 1) * K.corner;
    if (s.curved) c -= 0.06;
    if (s.from && s.from.attr) c += s.from.attr.finish;
    if (late) c -= 0.15;
    c += (m.autopilot ? k.team === 'red' : m.teamHuman[otherTeam(k.team)]) ? diff.keeperBonus : K.blueBonus;
    if (!(s.from && s.from.isHuman && !m.autopilot)) c += K.botShot; // bots finish worse than you
    c += K.format[m.format] || 0; // fewer players = more open shots, so keepers get a little help
    c = clamp(c, 0.05, 0.9);
    s.saveChance = c; // handy for balance checks
    s.save = Math.random() < c;

    const reachY = clamp(py, GOAL_Y1 - 12, GOAL_Y2 + 12);
    const dy = reachY - k.y;
    const tt = Math.max(0.12, t);
    if (Math.abs(dy) > 34 || s.level >= 1) {
      let targetY = s.save ? reachY : k.y + dy * rand(0.2, 0.55);
      if (!s.save && Math.random() < 0.18) targetY = k.y - dy * 0.4; // wrong way!
      const decay = (1 - Math.exp(-3.5 * tt)) / 3.5;
      k.vy = clamp((targetY - k.y) / decay, -1500, 1500);
      k.vx = clamp((lineX + dir * 34 - k.x) / decay, -450, 450);
      k.diveT = tt + 0.18;
      k.diveDir = Math.sign(targetY - k.y) || 1;
      k.fx = dir; k.fy = 0;
    } else {
      k.vy = clamp(dy / tt, -600, 600);
    }
  },
};
