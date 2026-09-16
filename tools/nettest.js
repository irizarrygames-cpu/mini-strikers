// Online test helpers — not loaded by the game. In the console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/nettest.js'; s.onload = r; document.head.appendChild(s); });
//   await NT.drive(10)   // plays your side with a simple bot, drawing frames even in a hidden tab
window.NT = {
  async drive(seconds = 10, opts = {}) {
    const stats = { frames: 0, jerk: 0, corrMax: 0, snapsSeen: 0, errors: [], straightJerk: 0, straightFrames: 0 };
    let last = performance.now(), prev = null, prev2 = null, shootHold = 0, aim = null;
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end && Online.m) {
      await new Promise((r) => setTimeout(r, opts.frameMs || 16));
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const m = Online.m, me = m.human, b = m.ball;
      try {
        if (opts.straight) {
          // run back and forth in straight lines: any wobble is netcode, not steering
          if (!aim || Math.abs(me.x - aim) < 60) aim = me.x < CFG.FIELD_W / 2 ? CFG.FIELD_W * 0.8 : CFG.FIELD_W * 0.2;
          Input.stick.x = Math.sign(aim - me.x); Input.stick.y = 0;
        } else if (b.owner === me) {
          const dx = CFG.FIELD_W - me.x, dy = CFG.FIELD_H / 2 - me.y, l = Math.hypot(dx, dy) || 1;
          Input.stick.x = dx / l; Input.stick.y = dy / l;
          if (shootHold <= 0 && dx < 700) { Input._shootPressed = true; shootHold = 0.45; }
        } else {
          const dx = b.x - me.x, dy = b.y - me.y, l = Math.hypot(dx, dy) || 1;
          Input.stick.x = dx / l; Input.stick.y = dy / l;
          if (l < 110 && Math.random() < 0.04) Input._slideQueued = true;
        }
        if (shootHold > 0) { shootHold -= dt; if (shootHold <= 0) Input._shootReleased = true; }
        Input.sprintHeld = !!opts.sprint;
        Input.update();
        Online.update(dt);
        FX.update(dt, dt);
        Render.updateCamera(m, dt);
        Render.drawMatch(m, now / 1000);
        UI.updateHUD(m);
      } catch (e) { stats.errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]); if (stats.errors.length > 5) break; }
      stats.frames++;
      stats.corrMax = Math.max(stats.corrMax, Math.hypot(Online.corr.x, Online.corr.y));
      if (prev && prev2) {
        const j = Math.hypot(me.x - 2 * prev.x + prev2.x, me.y - 2 * prev.y + prev2.y);
        stats.jerk += j;
        if (Online.predOk) { stats.straightJerk += j; stats.straightFrames++; }
      }
      prev2 = prev; prev = { x: me.x, y: me.y };
    }
    Input.stick.x = 0; Input.stick.y = 0;
    return {
      frames: stats.frames, avgJerk: +(stats.jerk / Math.max(1, stats.frames)).toFixed(2),
      predictedJerk: +(stats.straightJerk / Math.max(1, stats.straightFrames)).toFixed(2), corrMax: +stats.corrMax.toFixed(1),
      score: Online.m && Online.m.score, phase: Online.m && Online.m.phase, rtt: Math.round(Net.rtt), errors: stats.errors,
    };
  },
};
