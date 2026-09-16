// Balance harness — not loaded by the game. In the browser console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/balance.js'; s.onload = r; document.head.appendChild(s); });
//   HT.report()            // how hard is it to keep / win the ball vs each club
//   Sim.run(24, { club })  // AI-vs-AI full matches (goals, shots, tackles...)
// A scripted "human" plays with realistic habits: runs from pressure, sprints on stamina,
// reacts to slide warnings ~0.25s late and only 70% of the time.
window.HT = {
  keepAway(club, trials = 16, dodge = false, maxSec = 30) {
    const prev = Game.headless; Game.headless = true; const times = [];
    for (let t = 0; t < trials; t++) {
      const m = Match.create({ club: Clubs.get(club) }); const h = m.human;
      let n = 0; while (m.phase !== 'play' && n++ < 400) Match.step(m, CFG.STEP);
      let lost = maxSec; const seen = new Map();
      for (let i = 0; i < maxSec * 120; i++) {
        if (m.ball.owner !== h) { lost = i / 120; break; }
        let ax = 0, ay = 0;
        for (const o of m.players) {
          if (o.team === 'blue') continue;
          const dx = h.x - o.x, dy = h.y - o.y, d = Math.hypot(dx, dy) || 1;
          if (d < 400) { ax += (dx / d) * (1 - d / 400); ay += (dy / d) * (1 - d / 400); }
        }
        ax += ((CFG.FIELD_W / 2 - h.x) / (CFG.FIELD_W / 2)) * 0.6; ay += ((CFG.FIELD_H / 2 - h.y) / (CFG.FIELD_H / 2)) * 0.6;
        const l = Math.hypot(ax, ay) || 1;
        Input.move.x = ax / l; Input.move.y = ay / l;
        Input.sprintHeld = h.stamina > 0.4 || h.sprintOn;
        if (dodge) {
          const o = slideIncoming(m, h, 170);
          if (o) {
            const key = o.id + '@' + Math.round((o.slideCd || 0) * 2);
            if (!seen.has(key)) seen.set(key, { t: i, go: Math.random() < 0.7 });
            const s = seen.get(key);
            if (s.go && i - s.t === 30) Input._skillQueued = true;
          }
        }
        Match.step(m, CFG.STEP);
        if (m.phase !== 'play') { lost = null; break; }
      }
      if (lost !== null) times.push(lost);
    }
    Input.reset(); Game.headless = prev; times.sort((a, b) => a - b);
    return +times[times.length >> 1].toFixed(1);
  },

  winBack(club, trials = 16, maxSec = 30) {
    const prev = Game.headless; Game.headless = true; const times = []; let slides = 0, tackles = 0;
    for (let t = 0; t < trials; t++) {
      const m = Match.create({ club: Clubs.get(club) }); const h = m.human;
      Match.setupKickoff(m, 'red');
      let n = 0; while (m.phase !== 'play' && n++ < 400) Match.step(m, CFG.STEP);
      let won = maxSec, wait = -1;
      for (let i = 0; i < maxSec * 120; i++) {
        const c = m.ball.owner;
        if (c && c.team === 'blue') { won = i / 120; break; }
        const tx = m.ball.x + m.ball.vx * 0.2, ty = m.ball.y + m.ball.vy * 0.2;
        const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
        Input.move.x = dx / d; Input.move.y = dy / d; Input.sprintHeld = d > 120 && h.stamina > 0.4;
        if (c && c.team === 'red' && d < 90 && h.slideCd <= 0 && h.slideT <= 0 && wait < 0) wait = 18;
        if (wait > 0 && --wait === 0) { Input._slideQueued = true; wait = -1; }
        Match.step(m, CFG.STEP);
        if (m.phase !== 'play') { won = null; break; }
      }
      slides += h.stats.slides || 0; tackles += h.stats.tackles;
      if (won !== null) times.push(won);
    }
    Input.reset(); Game.headless = prev; times.sort((a, b) => a - b);
    return { medianWinBack: +times[times.length >> 1].toFixed(1), yourSlideSuccess: Math.round((tackles / Math.max(1, slides)) * 100) + '%' };
  },

  // Shooting vs the keeper: human-style shots from a zone, no defenders in the way.
  // zone: 'box' (inside the penalty area), 'edge' (just outside), 'far'. charge in seconds.
  shooting(club = 'rockets', zone = 'box', charge = 0.6, trials = 60, side = 0.6) {
    const prev = Game.headless; Game.headless = true; let goals = 0, saves = 0, wide = 0;
    const W = CFG.FIELD_W, B = CFG.BOX_D;
    const zones = { box: [W - B * 0.8, W - B * 0.35], edge: [W - B * 1.45, W - B * 1.05], far: [W - B * 2.3, W - B * 1.7] };
    for (let t = 0; t < trials; t++) {
      const m = Match.create({ club: Clubs.get(club) }); const h = m.human, k = m.keepers.red;
      m.phase = 'play';
      for (const p of m.players) if (p.team === 'red' && !p.isKeeper) { p.x = 300 + p.number * 60; p.y = 120; }
      for (const p of m.players) if (p.team === 'blue' && !p.isHuman && !p.isKeeper) { p.x = 600; p.y = CFG.FIELD_H - 100; }
      const [x0, x1] = zones[zone];
      h.x = rand(x0, x1); h.y = CFG.FIELD_H / 2 + rand(-1, 1) * CFG.GOAL_W * 0.65; h.fx = 1; h.fy = 0; h.vx = 0; h.vy = 0;
      m.ball.reset(h.x + 26, h.y); h.noPickupT = 0; takePossession(m, h); h.protectT = 9;
      k.x = CFG.FIELD_W - 36; k.y = CFG.FIELD_H / 2;
      for (let i = 0; i < 30; i++) Match.step(m, CFG.STEP); // keeper settles
      const sy = Math.random() < 0.5 ? side : -side;
      Input.move.x = 0.3; Input.move.y = Math.random() < 0.7 ? sy : 0;
      Input._keyHold.shoot = true; Input._syncHold('shoot');
      for (let i = 0; i < charge * 120; i++) Match.step(m, CFG.STEP);
      Input._keyHold.shoot = false; Input._syncHold('shoot');
      let res = 'wide';
      for (let i = 0; i < 240; i++) {
        Match.step(m, CFG.STEP);
        if (m.phase === 'goal') { res = 'goal'; break; }
        if (m.stats.red.saves > 0) { res = 'save'; break; }
        if (!m.ball.shot && i > 20) break;
      }
      Input.move.x = 0; Input.move.y = 0;
      if (res === 'goal') goals++; else if (res === 'save') saves++; else wide++;
    }
    Input.reset(); Game.headless = prev;
    return { goalPct: Math.round((goals / trials) * 100), savePct: Math.round((saves / trials) * 100), otherPct: Math.round((wide / trials) * 100) };
  },

  shootingReport(club = 'rockets') {
    const out = {};
    for (const zone of ['box', 'edge', 'far']) {
      out[zone] = { tap: this.shooting(club, zone, 0.1).goalPct + '%', medium: this.shooting(club, zone, 0.55).goalPct + '%', full: this.shooting(club, zone, 1.0).goalPct + '%' };
    }
    return out;
  },

  // Movement feel: seconds to reach 90% top speed, to stop, and to turn around (with the ball).
  movement() {
    const prev = Game.headless; Game.headless = true;
    const m = Match.create({ club: Clubs.get('denmark') }); const h = m.human; m.phase = 'play';
    for (const p of m.players) if (!p.isHuman) { p.x = p.team === 'blue' ? 150 : CFG.FIELD_W - 150; }
    h.x = 800; h.y = CFG.FIELD_H / 2; h.vx = 0; h.vy = 0; m.ball.reset(826, CFG.FIELD_H / 2); h.noPickupT = 0; takePossession(m, h); h.protectT = 99;
    const top = CFG.SPEED_WITH_BALL * h.speedMul;
    let i = 0; Input.move.x = 1; Input.move.y = 0;
    while (h.speed < top * 0.9 && i < 240) { Match.step(m, CFG.STEP); i++; }
    const accel = i / 120;
    for (let j = 0; j < 60; j++) Match.step(m, CFG.STEP);
    Input.move.x = 0; i = 0;
    while (h.speed > top * 0.1 && i < 240) { Match.step(m, CFG.STEP); i++; }
    const stop = i / 120;
    Input.move.x = 1; for (let j = 0; j < 90; j++) Match.step(m, CFG.STEP);
    Input.move.x = -1; i = 0;
    while (!(h.vx < -top * 0.7 && h.fx < -0.8) && i < 360) { Match.step(m, CFG.STEP); i++; }
    const turn = i / 120;
    const ballGap = +dist(h.x, h.y, m.ball.x, m.ball.y).toFixed(0);
    Input.reset(); Game.headless = prev;
    return { toTopSpeed: accel.toFixed(2) + 's', toStop: stop.toFixed(2) + 's', turnAround: turn.toFixed(2) + 's', stillHasBall: m.ball.owner === h, ballGapWhileRunning: ballGap };
  },

  // A whole match played "directly": dribble at goal, dodge 60% of slides late, shoot from
  // inside ~300 units, chase and slide when the bots have it. Blue teammates are bots.
  // skill 'pro' = sharp scripted player; 'avg' = slower reactions, fewer dodges, lazier chasing
  directPlay(club = 'rockets', format = '4v4', minutes = 2, skill = 'pro') {
    const P = skill === 'avg' ? { react: 60, dodge: 0.35, lead: 0, idle: 0.35, shootAt: 640 } : { react: 36, dodge: 0.6, lead: 0.2, idle: 0, shootAt: 540 };
    let idleT = 0;
    const prev = Game.headless; Game.headless = true;
    const m = Match.create({ club: Clubs.get(club), format, minutes }); const h = m.human; const seen = new Map();
    let wait = -1, charge = -1;
    for (let i = 0; i < 120 * 60 * (minutes + 2) && m.phase !== 'over'; i++) {
      if (m.phase === 'play') {
        const b = m.ball, has = b.owner === h;
        if (has) {
          const gx = CFG.FIELD_W, gy = CFG.FIELD_H / 2, d = dist(h.x, h.y, gx, gy);
          let ax = (gx - h.x) / d, ay = (gy - h.y) / d;
          for (const o of m.players) {
            if (o.team === 'blue' || o.isKeeper) continue;
            const ox = h.x - o.x, oy = h.y - o.y, od = Math.hypot(ox, oy) || 1;
            if (od < 180 && o.x > h.x) ay += (oy / od) * 0.9 * (1 - od / 180);
          }
          const l = Math.hypot(ax, ay) || 1; Input.move.x = ax / l; Input.move.y = ay / l; Input.sprintHeld = h.stamina > 0.35;
          const o = slideIncoming(m, h, 170);
          if (o) {
            const key = o.id + '@' + Math.round(o.slideCd * 2);
            if (!seen.has(key)) seen.set(key, { t: i, go: Math.random() < P.dodge });
            const s = seen.get(key); if (s.go && i - s.t === 30) Input._skillQueued = true;
          }
          if (d < P.shootAt && charge < 0 && !Input.shootHeld) { Input._keyHold.shoot = true; Input._syncHold('shoot'); charge = Math.round(rand(0.25, 0.9) * 120); }
        } else {
          const tx = b.x + b.vx * P.lead, ty = b.y + b.vy * P.lead, d = dist(h.x, h.y, tx, ty) || 1;
          // an average player drifts off the play now and then
          if (i % 120 === 0) idleT = Math.random() < P.idle ? 50 : 0;
          if (idleT > 0) { idleT--; Input.move.x *= 0.3; Input.move.y *= 0.3; }
          else { Input.move.x = (tx - h.x) / d; Input.move.y = (ty - h.y) / d; }
          Input.sprintHeld = d > 220 && h.stamina > 0.4;
          if (b.owner && b.owner.team === 'red' && d < 130 && h.slideCd <= 0 && wait < 0) wait = P.react;
        }
        if (wait > 0 && --wait === 0) { Input._slideQueued = true; wait = -1; }
        if (charge > 0 && --charge === 0) { Input.move.y = m.keepers.red.y > CFG.FIELD_H / 2 ? -0.7 : 0.7; Input._keyHold.shoot = false; Input._syncHold('shoot'); charge = -1; }
      }
      Match.step(m, CFG.STEP);
    }
    Input.reset(); Game.headless = prev;
    return { score: m.score.blue + '-' + m.score.red, youScored: h.stats.goals, yourShots: h.stats.shots, yourTackles: h.stats.tackles };
  },

  directReport(club = 'rockets', format = '4v4', n = 4, skill = 'pro') {
    const games = []; let gf = 0, ga = 0;
    for (let i = 0; i < n; i++) { const r = this.directPlay(club, format, 2, skill); games.push(r.score); const [a, b] = r.score.split('-').map(Number); gf += a; ga += b; }
    return { games, avgFor: +(gf / n).toFixed(1), avgAgainst: +(ga / n).toFixed(1) };
  },

  report(clubs = ['tigers', 'rockets', 'kings'], difficulty = Save.data.settings.difficulty) {
    const keep = Save.data.settings.difficulty;
    Save.data.settings.difficulty = difficulty;
    const out = {};
    for (const c of clubs) {
      const w = this.winBack(c);
      out[c] = { keepBallRunning: this.keepAway(c), keepBallDodging: this.keepAway(c, 16, true), winBallBack: w.medianWinBack, yourSlideSuccess: w.yourSlideSuccess };
    }
    Save.data.settings.difficulty = keep;
    return out;
  },
};
