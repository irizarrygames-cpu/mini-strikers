// Players, ball, physics and the core actions: possession, pass, shoot, steal.
let _nextPlayerId = 1;

class Player {
  constructor(o) {
    this.id = _nextPlayerId++;
    this.team = o.team;
    this.isKeeper = !!o.keeper;
    this.isHuman = !!o.human;
    this.role = o.role;
    this.number = o.number;
    this.look = o.look;
    this.r = this.isKeeper ? CFG.KEEPER_R : CFG.PLAYER_R;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.fx = TEAMS[o.team].dir; this.fy = 0;
    this.faceX = this.fx;
    this.mx = 0; this.my = 0; this.mSpeed = 1;
    this.runPhase = rand(0, 6);
    this.kickT = 0; this.kickDur = 0.2;
    this.stunT = 0; this.noPickupT = 0; this.stealCd = 0; this.protectT = 0;
    this.diveT = 0; this.diveDir = 0; this.recoverT = 0; this.holdT = 0;
    this.celebrateT = 0; this.sad = false;
    this.touchT = 0; this.dustT = 0;
    this.charging = false; this.chargeT = 0; this.passCharging = false; this.passChargeT = 0;
    this.bufferT = 0; this.bufferCharge = 0;
    this.speedMul = 1;
    this.attr = o.attr || NEUTRAL_ATTR;
    this.slideT = 0; this.slideCd = 0; this.slideDirX = 0; this.slideDirY = 0; this.slideHit = false;
    this.fallT = 0; this.slideWindT = 0; this.slideWindX = 1; this.slideWindY = 0;
    this.skill = null; this.skillCd = 0; this.burstT = 0; this.streakT = 0;
    this.hopT = 0; this.dodgeT = 0;
    this.stamina = 1; this.sprinting = false; this.exhausted = false; this.staminaDelay = 0;
    this.seed = Math.random() * 10;
    this.ai = { tx: 0, ty: 0, decideT: rand(0, 0.3), spotT: 0, chargeGoal: 0, holdT: 0, sideY: 0, slideT: 0 };
    this.stats = { goals: 0, shots: 0, passes: 0, steals: 0, saves: 0, assists: 0, skills: 0, tackles: 0 };
  }
  clearActions() {
    this.slideT = 0; this.slideWindT = 0; this.fallT = 0; this.skill = null; this.burstT = 0;
    this.slideCd = 0; this.skillCd = 0; this.slideHit = false;
    this.hopT = 0; this.dodgeT = 0;
    this.stamina = 1; this.sprinting = false; this.exhausted = false; this.staminaDelay = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
}

class Ball {
  constructor() { this.trail = []; this.reset(CFG.FIELD_W / 2, CFG.FIELD_H / 2); }
  reset(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.owner = null;
    this.spinX = 0; this.spinY = 0; this.spinT = 0;
    this.trail.length = 0; this.trailType = null; this.trailT = 0;
    this.shot = null; this.lastKicker = null; this.lastPass = null; this.lastTouchTeam = null;
    this.assist = null;
    this.roll = 0; this.touchKick = 0; this.pickupCd = 0;
    this.netBulge = { left: 0, right: 0 };
    this.safeX = x; this.safeY = y;
  }
}

// Move a carried ball out from the carrier's body in small steps so a board between them stops it.
// (Jumping straight to the dribble spot let the ball pass through the thin end boards.)
function sweepBallFrom(b, fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  b.x = fromX; b.y = fromY; b.vx = 0; b.vy = 0;
  for (let i = 0; i < n; i++) { b.x += dx / n; b.y += dy / n; collideWalls(b, CFG.BALL_R, 0); }
}

const inField = (x, y) => x >= 0 && x <= CFG.FIELD_W && y >= 0 && y <= CFG.FIELD_H;
// the whole ball is over a goal line, inside the mouth: it's a goal, nobody can touch it any more
const ballOverLine = (b) => b.y > GOAL_Y1 && b.y < GOAL_Y2 && (b.x < -CFG.BALL_R || b.x > CFG.FIELD_W + CFG.BALL_R);
const attackGoalX = (team) => (TEAMS[team].dir > 0 ? CFG.FIELD_W : 0);
const ownGoalX = (team) => (TEAMS[team].dir > 0 ? 0 : CFG.FIELD_W);
const otherTeam = (team) => (team === 'blue' ? 'red' : 'blue');
function inOwnBox(team, x, y) {
  const gx = ownGoalX(team);
  return Math.abs(x - gx) <= CFG.BOX_D + 6 && Math.abs(y - CFG.FIELD_H / 2) <= CFG.BOX_W / 2 + 6;
}

// ===== Player movement ==============================================
function turnToward(p, tx, ty, maxAngle) {
  const cur = Math.atan2(p.fy, p.fx), want = Math.atan2(ty, tx);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const a = cur + clamp(d, -maxAngle, maxAngle);
  p.fx = Math.cos(a); p.fy = Math.sin(a);
}

function movePlayers(m, dt) {
  const ps = m.players, b = m.ball;
  for (const p of ps) {
    p.kickT = Math.max(0, p.kickT - dt);
    p.stunT = Math.max(0, p.stunT - dt);
    p.noPickupT = Math.max(0, p.noPickupT - dt);
    p.stealCd = Math.max(0, p.stealCd - dt);
    p.protectT = Math.max(0, p.protectT - dt);
    p.recoverT = Math.max(0, p.recoverT - dt);
    p.celebrateT = Math.max(0, p.celebrateT - dt);
    p.slideCd = Math.max(0, p.slideCd - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.burstT = Math.max(0, p.burstT - dt);
    p.fallT = Math.max(0, p.fallT - dt);
    p.hopT = Math.max(0, p.hopT - dt);
    p.dodgeT = Math.max(0, p.dodgeT - dt);

    // sprint + stamina: running dry locks sprint until it refills to SPRINT.unlock
    const canSprint = p.sprinting && !p.exhausted && !p.isKeeper && p.slideT <= 0 && p.fallT <= 0 && p.speed > 60;
    p.sprintOn = canSprint;
    if (canSprint) {
      p.stamina -= SPRINT.drain * dt;
      p.staminaDelay = SPRINT.delay;
      if (p.stamina <= 0) { p.stamina = 0; p.exhausted = true; if (p.isHuman) FX.text(p.x, p.y, 'TIRED!', '#ff8a8e', 14); }
    } else {
      p.staminaDelay = Math.max(0, p.staminaDelay - dt);
      if (p.staminaDelay <= 0) p.stamina = Math.min(1, p.stamina + SPRINT.regen * dt);
      if (p.exhausted && p.stamina >= SPRINT.unlock) p.exhausted = false;
    }

    if ((p.slideWindT || 0) > 0) {
      // gather step: keep running at the ball while crouching into the slide
      p.slideWindT -= dt;
      const gx = b.x - p.x, gy = b.y - p.y, gl = Math.hypot(gx, gy) || 1;
      const gmax = CFG.SPEED * p.speedMul * (p.sprintOn ? SPRINT.mul : 1);
      const gk = 1 - Math.exp(-CFG.ACCEL * dt);
      p.vx += ((gx / gl) * gmax - p.vx) * gk; p.vy += ((gy / gl) * gmax - p.vy) * gk;
      p.slideWindX = gx / gl; p.slideWindY = gy / gl;
      p.fx = p.slideWindX; p.fy = p.slideWindY;
      if (p.slideWindT <= 0) {
        p.slideWindT = 0;
        const cd = p.slideCd;
        p.slideCd = 0;
        // re-aim at where the ball will be when the slide arrives (mostly): hopping always dodges
        const c = b.owner, travel = dist(p.x, p.y, b.x, b.y) / SLIDE.speed;
        const px = b.x + (c ? c.vx : b.vx) * travel * 0.8, py = b.y + (c ? c.vy : b.vy) * travel * 0.8;
        const bx = px - p.x, by = py - p.y, bl = Math.hypot(bx, by) || 1;
        const ax = lerp(p.slideWindX, bx / bl, 0.8), ay = lerp(p.slideWindY, by / bl, 0.8);
        if (!performSlide(m, p, ax, ay)) p.slideCd = cd;
      }
    } else if (p.slideT > 0) {
      // tackle lunge: short dash that homes onto the ball
      p.slideT -= dt;
      const hx = b.x - p.x, hy = b.y - p.y, hl = Math.hypot(hx, hy) || 1;
      if (!p.slideHit && hl < 220 && !(b.owner && b.owner.team === p.team)) {
        const turn = clamp((p.isHuman && !m.autopilot ? 15 : 5) * dt, 0, 1);
        p.slideDirX = lerp(p.slideDirX, hx / hl, turn); p.slideDirY = lerp(p.slideDirY, hy / hl, turn);
        const dl = Math.hypot(p.slideDirX, p.slideDirY) || 1; p.slideDirX /= dl; p.slideDirY /= dl;
      }
      const sp = Math.hypot(p.vx, p.vy) * Math.exp(-1.5 * dt);
      p.vx = p.slideDirX * sp; p.vy = p.slideDirY * sp;
      p.fx = p.slideDirX; p.fy = p.slideDirY;
      p.dustT -= dt;
      if (p.dustT <= 0) { p.dustT = 0.06; FX.dust(p.x - p.slideDirX * 6, p.y - p.slideDirY * 4); }
      if (p.slideT <= 0) { p.recoverT = p.slideHit ? 0.04 : p.isHuman ? 0.16 : 0.24; p.vx *= 0.4; p.vy *= 0.4; }
    } else if (p.skill) {
      // spin move: glide sideways while the body (and ball) rotates a full turn
      const s = p.skill;
      s.t += dt;
      const a = s.a0 + ((Math.PI * 2 * s.t) / s.dur) * s.turn;
      p.fx = Math.cos(a); p.fy = Math.sin(a); p.faceX = p.fx;
      p.vx = s.dx * CFG.SPEED * 0.95; p.vy = s.dy * CFG.SPEED * 0.95;
      if (s.t >= s.dur) { p.skill = null; p.fx = s.dx; p.fy = s.dy; }
    } else if (p.diveT > 0) {
      p.diveT -= dt;
      const d = Math.exp(-3.5 * dt);
      p.vx *= d; p.vy *= d;
      if (p.diveT <= 0) { p.recoverT = 0.25; p.vx *= 0.2; p.vy *= 0.2; }
    } else {
      let max = p.isKeeper ? CFG.KEEPER_SPEED : (b.owner === p ? CFG.SPEED_WITH_BALL : CFG.SPEED);
      if (p.charging && b.owner === p) max *= p.isHuman ? 0.86 : 0.72;
      if (p.stunT > 0) max *= 0.25;
      if (p.recoverT > 0) max *= p.isKeeper ? 0.45 : 0;
      if (p.fallT > 0) max = 0;
      if (p.burstT > 0) max *= 1.35;
      else if (p.sprintOn) max *= b.owner === p ? SPRINT.ballMul : SPRINT.mul;
      max *= p.speedMul * p.attr.speed;
      const tx = p.mx * p.mSpeed * max, ty = p.my * p.mSpeed * max;
      // you get snappier acceleration and even quicker stops than the bots
      const idle = p.mx === 0 && p.my === 0;
      const acc = p.isHuman && !m.autopilot ? (idle ? CFG.HUMAN_DECEL : CFG.HUMAN_ACCEL) : CFG.ACCEL;
      const k = 1 - Math.exp(-acc * (p.fallT > 0 ? 2 : 1) * dt);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const sp = p.speed;
    if (p.kickT <= 0 && p.diveT <= 0 && p.slideT <= 0 && !p.skill && p.fallT <= 0) {
      let fx, fy;
      if (sp > 25) { fx = p.vx / sp; fy = p.vy / sp; }
      else if (p.celebrateT > 0 && p.celeFaceX) { fx = p.celeFaceX; fy = 0.25; }
      else { const dx = b.x - p.x, dy = b.y - p.y, l = Math.hypot(dx, dy) || 1; fx = dx / l; fy = dy / l; }
      // Rotate the facing by angle. (Lerping the vector never flipped on an exact 180° turn:
      // the in-between vector renormalised straight back to the old direction.)
      let tfx = fx, tfy = fy;
      const you = p.isHuman && !m.autopilot;
      if (you && (p.mx || p.my)) { tfx = p.mx; tfy = p.my; }
      turnToward(p, tfx, tfy, (you ? 22 : 10) * dt);
    }
    if (!p.skill) {
      const wantX = Math.abs(p.fx) > 0.12 ? Math.sign(p.fx) : Math.sign(p.faceX) || 1;
      p.faceX += (wantX - p.faceX) * (1 - Math.exp(-18 * dt));
    }
    p.runPhase += sp * dt * 0.075;

    if (sp > 205 && p.diveT <= 0 && p.slideT <= 0) {
      p.dustT -= dt;
      if (p.dustT <= 0) { p.dustT = 0.11; FX.dust(p.x - p.vx / sp * 8, p.y - p.vy / sp * 4); }
    }
    if ((p.burstT > 0 || p.sprintOn) && sp > 150) {
      p.streakT -= dt;
      if (p.streakT <= 0) { p.streakT = p.burstT > 0 ? 0.05 : 0.09; FX.speedLine(p.x, p.y, p.vx, p.vy); }
    }
  }

  // push apart so nobody stands inside anybody
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], c = ps[j];
        const dx = c.x - a.x, dy = c.y - a.y, min = a.r + c.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const ux = d > 0.001 ? dx / d : 1, uy = d > 0.001 ? dy / d : 0;
        const overlap = min - d;
        const wa = a.isKeeper ? 1 : 2, wc = c.isKeeper ? 1 : 2; // keepers are harder to shove
        a.x -= ux * overlap * (wa / (wa + wc));
        a.y -= uy * overlap * (wa / (wa + wc));
        c.x += ux * overlap * (wc / (wa + wc));
        c.y += uy * overlap * (wc / (wa + wc));
      }
    }
  }
  for (const p of ps) {
    collideWalls(p, p.r, 0);
    if (p.isKeeper) {
      const gx = ownGoalX(p.team), dir = TEAMS[p.team].dir;
      p.x = dir > 0 ? clamp(p.x, 4, CFG.BOX_D) : clamp(p.x, CFG.FIELD_W - CFG.BOX_D, CFG.FIELD_W - 4);
      p.y = clamp(p.y, CFG.FIELD_H / 2 - CFG.BOX_W / 2, CFG.FIELD_H / 2 + CFG.BOX_W / 2);
      if (Math.abs(p.x - gx) < 4) p.x = gx + dir * 4;
    }
  }
}

// ===== Ball =========================================================
function updateBall(m, dt) {
  const b = m.ball;
  b.pickupCd = Math.max(0, b.pickupCd - dt);
  b.netBulge.left = Math.max(0, b.netBulge.left - dt * 3);
  b.netBulge.right = Math.max(0, b.netBulge.right - dt * 3);

  const o = b.owner;
  if (o) {
    if (o.isKeeper) {
      b.x += (o.x + o.fx * 10 - b.x) * 0.5;
      b.y += (o.y + o.fy * 4 - b.y) * 0.5;
      b.z = 20; b.vx = o.vx; b.vy = o.vy; b.vz = 0;
    } else {
      const sp = o.speed / CFG.SPEED;
      o.touchT -= dt;
      if (o.touchT <= 0 && sp > 0.25) { o.touchT = lerp(0.38, 0.22, clamp(sp, 0, 1)); b.touchKick = 1; }
      b.touchKick = Math.max(0, b.touchKick - dt * 3.2);
      const off = o.r + CFG.BALL_R + 1 + (sp * 7 + b.touchKick * (o.sprinting ? 17 : 11) * sp) * (1 - o.attr.ctl * 0.3);
      const tx = o.x + o.fx * off, ty = o.y + o.fy * off;
      // sharp turns: swing the ball around the body instead of dragging it through
      const lag = dist(b.x, b.y, tx, ty);
      const k = 1 - Math.exp(-((o.skill ? 45 : 22) + lag * 0.9) * dt);
      let nx = b.x + (tx - b.x) * k, ny = b.y + (ty - b.y) * k;
      const rx = nx - o.x, ry = ny - o.y, rl = Math.hypot(rx, ry), minR = o.r + CFG.BALL_R - 2;
      if (rl < minR && rl > 0.01) { nx = o.x + (rx / rl) * minR; ny = o.y + (ry / rl) * minR; }
      const px0 = b.x, py0 = b.y;
      sweepBallFrom(b, o.x, o.y, nx, ny);
      b.vx = (b.x - px0) / dt; b.vy = (b.y - py0) / dt;
      b.z = o.hopT > 0 ? Math.sin((1 - o.hopT / 0.42) * Math.PI) * 20 : 0; b.vz = 0;
      // only a wall pinning the ball away from you breaks possession
      if (dist(b.x, b.y, o.x, o.y) > o.r + CFG.BALL_R + 60) loseBall(m, o, 0.3);
      if (o.isHuman) o.dribbleDist = (o.dribbleDist || 0) + o.speed * dt;
    }
    b.roll += Math.hypot(b.vx, b.vy) * dt / CFG.BALL_R;
  } else {
    const sp0 = Math.hypot(b.vx, b.vy);
    const n = Math.max(1, Math.ceil((sp0 * dt) / 6));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      if (b.spinT > 0) { b.vx += b.spinX * h; b.vy += b.spinY * h; b.spinT -= h; }
      if (b.z > 0 || b.vz > 0) {
        b.vz -= CFG.GRAVITY * h;
        b.z += b.vz * h;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -110) { Sound.bounce(-b.vz); b.vz = -b.vz * CFG.BALL_BOUNCE; } else b.vz = 0;
        }
      }
      const damp = Math.exp(-(b.z > 0.5 ? CFG.BALL_AIR_DRAG : CFG.BALL_FRICTION) * h);
      b.vx *= damp; b.vy *= damp;
      if (b.z <= 0.5) {
        const s = Math.hypot(b.vx, b.vy);
        if (s < 45 * h + 0.5) { b.vx = 0; b.vy = 0; }
        else { const f = (s - 45 * h) / s; b.vx *= f; b.vy *= f; }
      }
      b.x += b.vx * h; b.y += b.vy * h;
      const hit = collideWalls(b, CFG.BALL_R, CFG.WALL_BOUNCE);
      if (hit.hit > 0) {
        b.spinT = 0;
        if (hit.net) {
          b.vx *= 0.3; b.vy *= 0.3;
          if (hit.hit > 140) { b.netBulge[hit.net] = 1; Sound.net(); }
        } else if (hit.post && hit.hit > 150) {
          Sound.post(); FX.doShake(4, 0.15); FX.sparks(b.x, b.y, b.z, '#ffffff', 6, 220);
          if (b.shot) Sound.ooh();
          b.shot = null;
        } else {
          if (hit.hit > 160) Sound.board(hit.hit);
          if (b.shot && hit.hit > 300) b.shot = null;
        }
      }
      ballContacts(m, b);
      if (b.owner) break;
    }
    const s = Math.hypot(b.vx, b.vy);
    b.roll += s * dt / CFG.BALL_R;
    if (b.shot && s < 330) b.shot = null;
    if (!isFinite(b.x + b.y + b.z + b.vx + b.vy + b.vz)) b.reset(CFG.FIELD_W / 2, CFG.FIELD_H / 2);
  }
  // safety: a ball that ends up outside the boards goes back to the last spot it was legal
  if (insideArena(b.x, b.y)) { b.safeX = b.x; b.safeY = b.y; }
  else {
    if (b.owner) loseBall(m, b.owner, 0.3);
    b.x = b.safeX; b.y = b.safeY; b.vx *= -0.3; b.vy *= -0.3; b.spinT = 0;
  }

  // trail samples at a fixed rate so it looks the same at any frame rate
  b.trailT -= dt;
  if (b.trailT <= 0) {
    b.trailT = 1 / 60;
    const s = Math.hypot(b.vx, b.vy);
    const maxLen = TRAIL_LEN[b.trailType] || 0;
    if (!b.owner && b.trailType && s > 260) {
      b.trail.unshift({ x: b.x, y: b.y, z: b.z });
      if (b.trail.length > maxLen) b.trail.length = maxLen;
    } else if (b.trail.length) {
      b.trail.pop();
      if (!b.trail.length) b.trailType = null;
    } else b.trailType = null;
  }
}

function loseBall(m, p, noPickup) {
  const b = m.ball;
  if (b.owner !== p) return;
  b.owner = null;
  p.noPickupT = noPickup;
  if (p.isHuman && p.charging) { p.charging = false; Sound.chargeStop(); }
}

function ballContacts(m, b) {
  if (b.pickupCd > 0 || m.phase !== 'play' || ballOverLine(b)) return;
  let best = null, bestD = 1e9;
  for (const p of m.players) {
    if (p.noPickupT > 0 || p.stunT > 0 || p.fallT > 0 || p.slideT > 0 || (p.recoverT > 0 && !p.isKeeper)) continue;
    if (b.z > (p.isKeeper ? 64 : 24)) continue;
    const reach = p.r + CFG.BALL_R + (p.isKeeper ? (p.diveT > 0 ? 20 : 10) : 5);
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < reach && d < bestD) { best = p; bestD = d; }
  }
  if (!best) return;
  const sp = Math.hypot(b.vx, b.vy);
  if (best.isKeeper && inOwnBox(best.team, b.x, b.y)) keeperContact(m, best, b, sp);
  else if (sp <= CFG.CONTROL_MAX) { if (!heavyTouch(m, best, b, sp)) takePossession(m, best); }
  else deflectOff(m, best, b, bestD);
}

// how prone this player is to average-player mistakes: 0 for real players, else the bot's factor
function botSlip(m, p) {
  if (p.isHuman && !m.autopilot) return 0;
  return AI.rates(m, p).mistakes || 1;
}
const underPressure = (m, p, r) => AI.minOppDist(m, p.team, p.x, p.y) < r;

// a firm ball can bounce off a bot instead of being controlled
function heavyTouch(m, p, b, sp) {
  const slip = sp > 260 && !p.isKeeper && !b.shot ? botSlip(m, p) : 0;
  if (!slip) return false;
  const chance = BOT_MISTAKES.heavyTouch * slip * clamp((sp - 200) / 450, 0.25, 1.3) * (underPressure(m, p, 90) ? 1.5 : 1);
  if (Math.random() >= chance) return false;
  const a = Math.atan2(b.vy, b.vx) + rand(-0.7, 0.7), v = sp * rand(0.42, 0.62);
  b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.vz = rand(40, 110);
  b.lastTouchTeam = p.team; b.lastKicker = p; b.lastPass = null;
  p.noPickupT = 0.35;
  Sound.kick(0.15);
  return true;
}

function keeperContact(m, k, b, sp) {
  const shot = b.shot && b.shot.team !== k.team ? b.shot : null;
  if (shot) {
    if (!shot.decided) AI.decideSave(m, k, b, true);
    if (!shot.save) return; // beaten — let it through
  }
  if (shot && Math.random() < BOT_MISTAKES.keeperSpill * botSlip(m, k)) {
    // spilled: it squirts back out in front of goal for anyone to pounce on
    const out = TEAMS[k.team].dir, line = ownGoalX(k.team);
    if ((b.x - line) * out < CFG.BALL_R + 10) b.x = line + out * (CFG.BALL_R + 10);
    b.vx = out * rand(170, 320); b.vy = rand(-240, 240); b.vz = rand(60, 140);
    b.spinT = 0; b.shot = null; b.lastTouchTeam = k.team;
    k.noPickupT = 0.55;
    k.stats.saves++; m.stats[k.team].saves++;
    Sound.save(); Sound.ooh();
    FX.burst(b.x, b.y, b.z + 10, '#ffe14d', 16);
    FX.text(k.x, k.y, 'SPILLED!', '#ffffff', 17);
    return;
  }
  if (!shot || (sp < 950 && !shot.power && Math.random() < 0.75) || sp < 520) {
    const wasShot = !!shot;
    takePossession(m, k);
    if (wasShot) {
      k.stats.saves++; m.stats[k.team].saves++;
      Sound.save();
      FX.burst(b.x, b.y, b.z + 10, '#ffe14d', 22);
      FX.text(k.x, k.y, 'SAVE!', '#ffe14d', 18);
      if (shot.level >= 1) FX.doShake(4, 0.14);
    }
    return;
  }
  // parry wide
  const out = TEAMS[k.team].dir, line = ownGoalX(k.team);
  if ((b.x - line) * out < CFG.BALL_R + 6) b.x = line + out * (CFG.BALL_R + 6);
  b.vx = out * rand(380, 540);
  b.vy = (b.y < CFG.FIELD_H / 2 ? -1 : 1) * rand(180, 380);
  b.vz = rand(180, 300);
  b.spinT = 0;
  b.shot = null;
  b.lastTouchTeam = k.team;
  k.noPickupT = 0.4;
  k.stats.saves++; m.stats[k.team].saves++;
  Sound.save(); Sound.ooh();
  FX.burst(b.x, b.y, b.z + 12, '#ffe14d', shot.power ? 38 : 28);
  FX.sparks(b.x, b.y, b.z + 12, '#ffffff', 10, 320);
  FX.text(k.x, k.y, shot.power ? 'HUGE SAVE!' : 'SAVE!', '#ffe14d', shot.power ? 22 : 18);
  FX.doShake(shot.power ? 9 : 6, 0.2);
  m.slowmo = Math.max(m.slowmo, shot.power ? 0.35 : 0.15);
}

function deflectOff(m, p, b, d) {
  const nx = (b.x - p.x) / (d || 1), ny = (b.y - p.y) / (d || 1);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
  b.vx *= 0.45; b.vy *= 0.45; b.vz = rand(90, 200);
  const reach = p.r + CFG.BALL_R + 6;
  b.x = p.x + nx * reach; b.y = p.y + ny * reach;
  b.shot = null; b.spinT = 0;
  b.lastTouchTeam = p.team; // a deflected shot that still goes in stays the shooter's goal
  p.noPickupT = 0.12; p.stunT = 0.12;
  Sound.kick(0.2);
  FX.sparks(b.x, b.y, b.z + 6, '#ffffff', 6, 200);
  if (p.isHuman) FX.text(p.x, p.y, 'BLOCK!', '#ffffff', 16);
}

function takePossession(m, p) {
  const b = m.ball;
  const prevTeam = b.lastTouchTeam;
  const lp = b.lastPass;
  if (lp && lp.from !== p && lp.team === p.team && m.clock - lp.t < 5) {
    lp.from.stats.passes++;
    m.stats[p.team].passes++;
    b.assist = { from: lp.from, t: m.clock };
    if (lp.from.isHuman) { addMeter(m, lp.from, 8); FX.text(p.x, p.y, '+PASS', '#ffffff', 15); }
    else if (p.isHuman) addMeter(m, p, 3);
    if (p.team === 'red') addMeter(m, p, 5);
  }
  if (lp && lp.team !== p.team) b.assist = null;
  b.lastPass = null;
  b.owner = p;
  b.lastKicker = p; // whoever has it last gets the credit if it goes in
  b.shot = null; b.spinT = 0; b.vz = 0;
  if (!p.isKeeper) b.z = 0;
  b.touchKick = 0;
  b.pickupCd = 0.08;
  p.touchT = 0.15;
  p.holdT = 0;
  p.ai.holdT = 0;
  if (prevTeam && prevTeam !== p.team) {
    p.protectT = p.isHuman ? 1.1 : 0.9;
    b.assist = null;
    Sound.possession();
    FX.ring(p.x, p.y, TEAMS[p.team].fx, 8, 30, 0.3, 3);
  }
  b.lastTouchTeam = p.team;
}

function addMeter(m, p, amt) {
  const team = p.team;
  if (m.teamHuman && m.teamHuman[team] && !p.isHuman && !m.autopilot) return;
  const before = m.meter[team];
  m.meter[team] = Math.min(CFG.POWER_MAX, m.meter[team] + amt);
  if (p.isHuman && before < CFG.POWER_MAX && m.meter[team] >= CFG.POWER_MAX && !Game.headless) {
    Sound.powerReady();
    FX.text(p.x, p.y, 'POWER READY!', '#46d9ff', 17);
  }
}

// ===== Pass =========================================================
function laneBlocked(m, team, x1, y1, x2, y2, width) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  for (const o of m.players) {
    if (o.team === team) continue;
    const t = ((o.x - x1) * dx + (o.y - y1) * dy) / l2;
    if (t < 0.08 || t > 0.96) continue;
    const px = x1 + dx * t, py = y1 + dy * t;
    if (dist(o.x, o.y, px, py) < width + o.r) return true;
  }
  return false;
}

function choosePassTarget(m, p, ax, ay) {
  let best = null, bestScore = -1e9;
  for (const q of m.players) {
    if (q.team !== p.team || q === p) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d < 40 || d > 1300) continue;
    const cos = (dx * ax + dy * ay) / d;
    if (cos < 0.34) continue;
    let score = cos * 1.6 - d / 900;
    if (laneBlocked(m, p.team, p.x, p.y, q.x, q.y, 14)) score -= 0.3;
    if (q.isKeeper) score -= 0.9;
    if (score > bestScore) { bestScore = score; best = q; }
  }
  return best;
}

// charge: seconds PASS was held. A tap is the ordinary pass; holding it leads the runner
// further and hits it harder, and a full charge lofts it over anyone in the lane.
function performPass(m, p, ax, ay, forced, charge = 0) {
  const b = m.ball;
  if (b.owner !== p) return false;
  p.skill = null;
  let l = Math.hypot(ax, ay);
  if (l < 0.1) { ax = p.fx; ay = p.fy; l = 1; }
  ax /= l; ay /= l;
  const target = forced || choosePassTarget(m, p, ax, ay);
  const power = charge > CFG.PASS_CHARGE_TAP ? clamp((charge - CFG.PASS_CHARGE_TAP) / (CFG.PASS_CHARGE_FULL - CFG.PASS_CHARGE_TAP), 0, 1) : 0;
  let dx, dy, speed, vz = 25;
  if (target) {
    const d0 = dist(b.x, b.y, target.x, target.y);
    const lead = (d0 / 650) * 0.9 * (1 + power * 1.1);
    const tx = clamp(target.x + target.vx * lead, 20, CFG.FIELD_W - 20);
    const ty = clamp(target.y + target.vy * lead, 20, CFG.FIELD_H - 20);
    const D = dist(b.x, b.y, tx, ty) || 1;
    dx = (tx - b.x) / D; dy = (ty - b.y) / D;
    speed = clamp(240 + CFG.BALL_FRICTION * D, CFG.PASS_MIN, CFG.PASS_MAX) * p.attr.pass;
    if (!p.isHuman || m.autopilot) speed = Math.min(CFG.PASS_MAX, speed * 1.15); // bots zip it
    // harder, but never past what a teammate can still control
    if (power) speed = Math.min(CFG.CONTROL_MAX - 10, speed * (1 + power * 0.45));
    if (power >= 0.85 && D > 180) {
      vz = 340; speed = clamp(D / 0.9, 420, CFG.CONTROL_MAX - 10); // full charge: lofted over the top
    } else if (D > 180 && laneBlocked(m, p.team, b.x, b.y, tx, ty, p.isHuman && !m.autopilot ? 12 : 26)) {
      vz = 360; speed = clamp(D / 0.95, 380, 780); // chip it over
    }
  } else {
    dx = ax; dy = ay; speed = 440 + power * 320;
  }
  const slip = target ? botSlip(m, p) * (p.isKeeper ? 0.5 : 1) : 0;
  if (slip) {
    // a bot's pass wobbles, and now and then it's just a bad ball
    const pressed = underPressure(m, p, 100) ? 2 : 1;
    let err = rand(-1, 1) * BOT_MISTAKES.passAim * slip * pressed;
    if (Math.random() < BOT_MISTAKES.passBad * slip * (pressed > 1 ? 1.5 : 1)) {
      err += (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.42);
      speed *= Math.random() < 0.5 ? rand(0.6, 0.8) : rand(1.12, 1.3);
    }
    const c = Math.cos(err), s = Math.sin(err);
    [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
  }
  b.owner = null;
  b.vx = dx * speed; b.vy = dy * speed; b.vz = vz;
  b.shot = null; b.spinT = 0;
  b.trailType = 'pass'; b.trail.length = 0;
  b.lastPass = { from: p, team: p.team, t: m.clock, target };
  b.lastKicker = p; b.lastTouchTeam = p.team;
  m.stats[p.team].passTries = (m.stats[p.team].passTries || 0) + 1;
  p.noPickupT = 0.28; p.kickT = 0.18; p.kickDur = 0.18;
  p.fx = dx; p.fy = dy;
  if (p.isHuman && p.charging) { p.charging = false; Sound.chargeStop(); }
  Sound.pass();
  FX.ring(b.x, b.y, '#ffffff', 4, power ? 30 : 18, power ? 0.3 : 0.22, power ? 4 : 2.5);
  return true;
}

// ===== Shoot ========================================================
function performShot(m, p, chargeT, sideY, noise = 0) {
  const b = m.ball;
  if (b.owner !== p) return false;
  p.skill = null;
  const team = TEAMS[p.team];
  const gx = attackGoalX(p.team), gy = CFG.FIELD_H / 2;
  const level = chargeT < CFG.CHARGE_MED ? 0 : chargeT < CFG.CHARGE_STRONG ? 1 : 2;
  const c01 = clamp(chargeT / CFG.CHARGE_POW, 0, 1);
  const canPower = p.isHuman || !(m.teamHuman && m.teamHuman[p.team]) || m.autopilot;
  const isPower = level === 2 && canPower && m.meter[p.team] >= CFG.POWER_MAX;
  let speed = (isPower ? CFG.SHOT_POWER : lerp(CFG.SHOT_WEAK, CFG.SHOT_STRONG, easeOut(c01))) * p.attr.shot;
  // bots scuff some and blaze some wide
  const slip = isPower ? 0 : botSlip(m, p);
  const wild = slip > 0 && Math.random() < BOT_MISTAKES.shotWild * slip;
  if (slip && Math.random() < BOT_MISTAKES.shotScuff * slip) speed *= rand(0.6, 0.75);

  const toX = gx - b.x, toY = gy - b.y, dG = Math.hypot(toX, toY) || 1;
  const facingDot = p.fx * (toX / dG) + p.fy * (toY / dG);
  let dx, dy, spinX = 0, spinY = 0, spinT = 0;
  if (facingDot > -0.25 || dG < 820) {
    const keeper = m.keepers[otherTeam(p.team)];
    // Your shots aim for the corner away from the keeper unless you push hard to one side
    // on purpose (running diagonally used to steer shots straight at him).
    const you = p.isHuman && !m.autopilot;
    const aimAt = you ? 0.75 : 0.2;
    let side = clamp(sideY, -1, 1);
    if (Math.abs(side) <= aimAt) side = 0;
    const GW2 = CFG.GOAL_W / 2;
    // far side: away from the keeper if he's clearly off-centre, otherwise the post away from you
    const kOff = keeper.y - gy;
    const farSign = kOff > GW2 * 0.2 ? -1 : kOff < -GW2 * 0.2 ? 1 : (b.y > gy ? -1 : 1);
    let offset = side ? side * GW2 * 0.8 : farSign * GW2 * (you ? rand(0.58, 0.78) : rand(0.37, 0.65));
    offset += rand(-noise, noise);
    if (wild) offset = (offset < 0 ? -1 : 1) * rand(GW2 + 35, GW2 + 160);
    offset = clamp(offset, -(GW2 + 170), GW2 + 170);
    if (!noise) offset = clamp(offset, -(GW2 - 28), GW2 - 28);
    const tx = gx + team.dir * 40, ty = gy + offset;
    let D = dist(b.x, b.y, tx, ty) || 1;
    dx = (tx - b.x) / D; dy = (ty - b.y) / D;
    if (Math.abs(side) > 0.3 && D > 200) {
      // curl: launch away from the target, bend back into it
      const B = lerp(40, 90, clamp((Math.abs(side) - 0.3) / 0.7, 0, 1));
      let px = -dy, py = dx;
      if (py * side < 0) { px = -px; py = -py; }
      const lx = tx - px * B - b.x, ly = ty - py * B - b.y, LL = Math.hypot(lx, ly);
      const T = D / (speed * 0.88);
      const a = (2 * B) / (T * T);
      dx = lx / LL; dy = ly / LL;
      spinX = px * a; spinY = py * a; spinT = T * 1.05;
    }
  } else {
    dx = p.fx; dy = p.fy;
  }

  b.owner = null;
  b.vx = dx * speed; b.vy = dy * speed;
  b.vz = isPower ? 70 : [55, 105, 145][level] * rand(0.8, 1.1) * (wild ? 1.5 : 1);
  b.spinX = spinX; b.spinY = spinY; b.spinT = spinT;
  b.shot = { team: p.team, from: p, x0: b.x, y0: b.y, level, power: isPower, speed, decided: false, save: false, curved: spinT > 0, id: ++m.shotId };
  b.trailType = isPower ? (p.trailId || (p.isHuman && !m.online ? Save.trail().id : 'fire')) : level === 2 ? 'strong' : level === 1 ? 'shot' : 'weak';
  b.trail.length = 0;
  b.lastKicker = p; b.lastTouchTeam = p.team; b.lastPass = null;
  p.noPickupT = 0.35; p.kickT = 0.24; p.kickDur = 0.24;
  p.fx = dx; p.fy = dy;
  p.stats.shots++; m.stats[p.team].shots++;
  if (isPower) m.meter[p.team] = 0; else addMeter(m, p, 6);

  const fxColor = p.team === 'blue' ? '#46d9ff' : '#ffb03a';
  FX.sparks(b.x, b.y, 6, level === 2 ? fxColor : '#ffffff', 5 + level * 4, 240 + level * 90);
  if (isPower) {
    const tr = TRAILS.find((x) => x.id === b.trailType) || TRAILS[1];
    FX.burst(b.x, b.y, 8, tr.a, 44, 0.32);
    FX.ring(b.x, b.y, tr.b, 10, 70, 0.35, 5);
    FX.doFlash(tr.b, 0.35);
    FX.doShake(9, 0.22);
    FX.text(p.x, p.y, 'POWER SHOT!', tr.a, 20);
    Sound.powerShot();
    if (p.isHuman) vibrate(45);
  } else {
    if (level === 2) { FX.burst(b.x, b.y, 8, '#ffffff', 26, 0.22); FX.doShake(4, 0.12); }
    Sound.kick(level / 2);
    if (p.isHuman) vibrate(level === 2 ? 22 : 12);
  }
  if (p.isHuman && p.charging) { p.charging = false; Sound.chargeStop(); }
  return true;
}

// ===== Sprint =======================================================
// Full tank lasts ~2.4s of sprinting. Empty = no sprint until 35% refilled.
const SPRINT = { mul: 1.32, ballMul: 1.2, drain: 0.42, regen: 0.3, delay: 0.35, unlock: 0.35 };

// ===== Tackle (replaced the slide; identifiers still say "slide") ====
// Press TACKLE near the ball: a short homing lunge that takes the ball on contact.
// Every tackle has a cooldown (shown on the button). Bots crouch first with a "!" over you,
// so a HOP still dodges them. DEF rating adds reach, success and a shorter cooldown.
const SLIDE = {
  speed: 640, time: 0.22, cooldown: 1.1, humanCooldown: 1.1, reach: 12, humanReach: 28,
  front: 0.8, behind: 0.65, body: 0.6, keeperSpeed: 560, windup: 0.3, botWindup: 0.1, range: 150,
};

function canAct(p) {
  return p.slideT <= 0 && (p.slideWindT || 0) <= 0 && p.fallT <= 0 && p.recoverT <= 0 && p.stunT <= 0 && p.diveT <= 0;
}

// is a tackle (winding up or already lunging) coming at this player?
function slideIncoming(m, p, range = 150) {
  for (const o of m.players) {
    if (o.team === p.team) continue;
    const winding = (o.slideWindT || 0) > 0;
    if (!winding && (o.slideT <= 0.02 || o.slideHit)) continue;
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d > range) continue;
    const dirX = winding ? o.slideWindX : o.slideDirX, dirY = winding ? o.slideWindY : o.slideDirY;
    if ((dx * dirX + dy * dirY) / (d || 1) > 0.35) return o;
  }
  return null;
}

function tackleCooldown(p) {
  const base = p.isHuman ? SLIDE.humanCooldown : SLIDE.cooldown;
  return base * (1 - p.attr.def * 0.2);
}

function performSlide(m, p, ix, iy, windup = 0) {
  const b = m.ball;
  if (b.owner === p || p.slideCd > 0 || !canAct(p)) return false;
  if (windup > 0) {
    // crouch first; the lunge launches in movePlayers when the windup runs out
    const l0 = Math.hypot(ix, iy) || 1;
    p.slideWindT = windup; p.slideWindX = ix / l0; p.slideWindY = iy / l0;
    p.slideCd = tackleCooldown(p) + SLIDE.time + windup;
    return true;
  }
  if (p.isKeeper && !inOwnBox(p.team, p.x, p.y)) return false;
  let l = Math.hypot(ix, iy);
  let dx = l > 0.2 ? ix / l : p.fx, dy = l > 0.2 ? iy / l : p.fy;
  // aim assist: go for the ball if it's anywhere near, whatever way you're pointing
  const bx = b.x - p.x, by = b.y - p.y, bd = Math.hypot(bx, by);
  const range = SLIDE.range + (p.isHuman ? 20 + p.attr.def * 20 : 0);
  const mates = b.owner && b.owner.team === p.team; // never home in on a teammate's ball
  if (!mates && bd > 1 && bd < range && (p.isHuman || (bx * dx + by * dy) / bd > 0.3)) { dx = bx / bd; dy = by / bd; }
  if (p.charging) { p.charging = false; Sound.chargeStop(); }
  const speed = p.isKeeper ? SLIDE.keeperSpeed : SLIDE.speed;
  p.slideT = SLIDE.time * (p.isHuman && !m.autopilot ? 1.4 : 1); // your lunge carries further
  p.slideCd = tackleCooldown(p) + p.slideT; p.slideHit = false; p.slideStart = m.clock;
  p.slideDirX = dx; p.slideDirY = dy;
  p.vx = dx * speed; p.vy = dy * speed;
  p.fx = dx; p.fy = dy; p.faceX = Math.abs(dx) > 0.1 ? Math.sign(dx) : p.faceX;
  p.stats.slides = (p.stats.slides || 0) + 1;
  m.stats[p.team].slides = (m.stats[p.team].slides || 0) + 1;
  Sound.slide();
  FX.dust(p.x, p.y);
  return true;
}

// a clean tackle: the tackler comes away with the ball
function trip(m, tackler, c) {
  const b = m.ball;
  if (c.charging) { c.charging = false; Sound.chargeStop(); }
  c.skill = null; c.burstT = 0; c.hopT = 0;
  c.stunT = 0.45; c.noPickupT = 0.6; c.vx *= 0.3; c.vy *= 0.3;
  tackler.slideHit = true; tackler.slideT = Math.min(tackler.slideT, 0.04);
  tackler.stats.steals++; tackler.stats.tackles++;
  m.stats[tackler.team].steals++; m.stats[tackler.team].tackles = (m.stats[tackler.team].tackles || 0) + 1;
  b.owner = null; b.lastPass = null; b.assist = null; b.shot = null;
  if (tackler.isKeeper && !inOwnBox(tackler.team, b.x, b.y)) {
    b.vx = TEAMS[tackler.team].dir * 280; b.vy = b.y < CFG.FIELD_H / 2 ? -200 : 200;
    b.lastTouchTeam = tackler.team;
  } else {
    tackler.noPickupT = 0; b.pickupCd = 0;
    takePossession(m, tackler);
  }
  FX.stars(c.x, c.y, 52);
  FX.burst(b.x, b.y, 6, '#ffffff', 22, 0.22);
  FX.doShake(3, 0.1);
  Sound.tackle();
  if (tackler.isHuman || c.isHuman) FX.text(tackler.x, tackler.y, 'STEAL!', '#ffb03a', 17);
  if (tackler.isHuman || c.isHuman) vibrate(c.isHuman ? 30 : 15);
  addMeter(m, tackler, tackler.isHuman ? 12 : 8);
}

function dodged(m, tackler, c) {
  tackler.slideHit = true;
  c.stats.dodges = (c.stats.dodges || 0) + 1;
  m.stats[c.team].dodges = (m.stats[c.team].dodges || 0) + 1;
  FX.text(c.x, c.y, 'DODGED!', '#46d9ff', 16);
  FX.ring(c.x, c.y, '#46d9ff', 10, 36, 0.3, 3);
  Sound.skill();
  addMeter(m, c, c.isHuman ? 8 : 5);
}

function checkSlides(m) {
  const b = m.ball;
  for (const p of m.players) {
    if (p.slideT <= 0 || p.slideHit) continue;
    const footX = p.x + p.slideDirX * 10, footY = p.y + p.slideDirY * 10;
    const c = b.owner;
    const onCarrier = c && c.team !== p.team && !c.isKeeper;
    const reach = p.isHuman ? SLIDE.humanReach + p.attr.def * 5 : SLIDE.reach;
    const hitBall = dist(footX, footY, b.x, b.y) < p.r + CFG.BALL_R + reach && b.z < 26;
    const hitBody = onCarrier && dist(footX, footY, c.x, c.y) < p.r + c.r + 6;
    if (onCarrier && (hitBall || hitBody)) {
      if (c.dodgeT > 0) { dodged(m, p, c); continue; }
      p.slideHit = true;
      const d = dist(p.x, p.y, c.x, c.y) || 1;
      const fromFront = c.fx * ((p.x - c.x) / d) + c.fy * ((p.y - c.y) / d) > -0.35;
      let chance = hitBall ? (fromFront ? SLIDE.front : SLIDE.behind) : SLIDE.body;
      chance *= (1 + p.attr.def * 0.12) * (1 - c.attr.ctl * 0.12);
      if (c.isHuman) chance *= (m.diff || Game.difficulty()).slideOnHuman;
      if (Math.random() < BOT_MISTAKES.tackleMiss * botSlip(m, p)) chance = 0; // mistimed
      if (Math.random() < chance) trip(m, p, c);
      else {
        p.recoverT = 0.2;
        if (c.isHuman || p.isHuman) FX.text(c.x, c.y, 'MISSED!', '#ffffff', 14);
      }
    } else if (!c && hitBall && !ballOverLine(b) && !(p.isKeeper && !inOwnBox(p.team, b.x, b.y))) {
      // lunging onto a loose ball just wins it
      p.slideHit = true; p.slideT = Math.min(p.slideT, 0.04);
      p.noPickupT = 0; b.pickupCd = 0;
      takePossession(m, p);
    }
  }
}

// ===== Skill moves ==================================================
// Every skill gives a short dodge window that makes slides miss.
// No stick: HOP (best dodge). Stick forward: nutmeg / flick / burst.
// Stick sideways: SPIN. Stick backward: CRUYFF turn.
const SKILL = { cooldown: 1.1, aiCooldown: 1.6, hopDodge: 0.45 };

function performSkill(m, p, ix, iy) {
  const b = m.ball;
  if (b.owner !== p || p.isKeeper || p.skillCd > 0 || !canAct(p) || p.skill || p.hopT > 0) return false;
  if (p.charging) { p.charging = false; Sound.chargeStop(); }
  const mag = Math.hypot(ix, iy);
  const fwd = mag > 0.3 ? (ix * p.fx + iy * p.fy) / mag : 0;

  let front = null, frontD = 1e9;
  for (const o of m.players) {
    if (o.team === p.team || o.fallT > 0) continue;
    const ox = o.x - p.x, oy = o.y - p.y, d = Math.hypot(ox, oy);
    if (d < 95 && d > 1 && (ox * p.fx + oy * p.fy) / d > 0.6 && d < frontD) { front = o; frontD = d; }
  }

  let kind;
  if (p.isHuman && slideIncoming(m, p)) kind = 'hop';
  else if (mag <= 0.3) kind = 'hop';
  else if (fwd > 0.45) kind = front ? (frontD < 55 && !front.isKeeper ? 'nutmeg' : 'flick') : 'burst';
  else if (fwd < -0.45) kind = 'cruyff';
  else kind = 'spin';

  const fx = p.fx, fy = p.fy;
  p.skillCd = (p.isHuman ? SKILL.cooldown : SKILL.aiCooldown) * (1 - p.attr.ctl * 0.2);
  p.stats.skills++;
  m.stats[p.team].skills = (m.stats[p.team].skills || 0) + 1;
  const say = (s, c) => { if (p.isHuman || Math.random() < 0.5) FX.text(p.x, p.y, s, c, 15); };
  Sound.skill();

  switch (kind) {
    case 'hop':
      p.hopT = 0.42; p.dodgeT = SKILL.hopDodge;
      say('HOP!', '#ffffff');
      addMeter(m, p, 2);
      break;
    case 'nutmeg':
      b.owner = null;
      b.vx = fx * 480; b.vy = fy * 480; b.vz = 0;
      front.noPickupT = 0.6; front.stunT = 0.35;
      p.burstT = 0.6; p.noPickupT = 0.22; p.dodgeT = 0.3;
      b.lastTouchTeam = p.team; b.lastPass = null;
      say('NUTMEG!', '#ff8af0');
      if (p.isHuman) m.flags.nutmeg = true;
      Sound.ooh();
      addMeter(m, p, 8);
      break;
    case 'flick':
      b.owner = null;
      b.vx = fx * 410; b.vy = fy * 410; b.vz = 460; b.z = 2;
      p.burstT = 0.65; p.noPickupT = 0.3; p.kickT = 0.22; p.kickDur = 0.22; p.dodgeT = 0.35; p.hopT = 0.3;
      b.lastTouchTeam = p.team; b.lastPass = null;
      say('FLICK!', '#ffe14d');
      addMeter(m, p, 6);
      break;
    case 'burst':
      b.owner = null;
      b.vx = fx * 500; b.vy = fy * 500; b.vz = 20;
      p.burstT = 0.7; p.noPickupT = 0.15; p.kickT = 0.14; p.kickDur = 0.14; p.dodgeT = 0.25;
      b.lastTouchTeam = p.team; b.lastPass = null;
      say('BURST!', '#46d9ff');
      addMeter(m, p, 2);
      break;
    case 'spin': {
      let sx = ix, sy = iy;
      const along = sx * fx + sy * fy;
      sx -= fx * along * 0.7; sy -= fy * along * 0.7;
      const sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
      const cross = fx * sy - fy * sx;
      p.skill = { kind, t: 0, dur: 0.42, dx: sx, dy: sy, a0: Math.atan2(fy, fx), turn: cross >= 0 ? 1 : -1 };
      p.dodgeT = 0.45;
      FX.ring(p.x, p.y, '#ffffff', 10, 30, 0.3, 3);
      say('SPIN!', '#ffffff');
      addMeter(m, p, 3);
      break;
    }
    case 'cruyff': {
      const dx = ix / mag, dy = iy / mag;
      p.fx = dx; p.fy = dy; p.faceX = Math.abs(dx) > 0.1 ? Math.sign(dx) : p.faceX;
      p.vx = dx * CFG.SPEED * 0.5; p.vy = dy * CFG.SPEED * 0.5;
      b.x = p.x + dx * (p.r + CFG.BALL_R + 1); b.y = p.y + dy * (p.r + CFG.BALL_R + 1);
      p.kickT = 0.2; p.kickDur = 0.2; p.dodgeT = 0.3;
      FX.ring(b.x, b.y, '#ffffff', 4, 20, 0.25, 2.5);
      say('CRUYFF!', '#ffffff');
      addMeter(m, p, 3);
      break;
    }
  }
  return kind;
}
