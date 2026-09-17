// Online test helpers — not loaded by the game. In the console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/nettest.js'; s.onload = r; document.head.appendChild(s); });
//   await NT.drive(10)   // plays your side with a simple bot, drawing frames even in a hidden tab
//   await NT.skills(20, { lagMs: 80 })  // skills every ~1s; counts frames where the ball or you jump
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

  // Skills online: holds the ball, does a skill every ~1s (forward, sideways, back, standing) and
  // measures how far the drawn ball and your player jump beyond their own speed each frame.
  // lagMs delays every message both ways, like a real connection.
  async skills(seconds = 20, opts = {}) {
    const lag = opts.lagMs || 0;
    if (!Online._counted) { Online._counted = true; const on = Online.onSnapshot; Online.onSnapshot = function (msg) { Online.snapCount = (Online.snapCount || 0) + 1; return on.call(this, msg); }; }
    // lag is a queue drained by the frame loop (background tabs throttle setTimeout chains)
    const q = [];
    if (lag && !Net._lagWrapped) {
      Net._lagWrapped = true;
      const ws = Net.ws, onmsg = ws.onmessage, send = Net.send.bind(Net);
      ws.onmessage = (e) => q.push({ at: performance.now() + lag, fn: () => onmsg(e) });
      Net.send = (o) => q.push({ at: performance.now() + lag, fn: () => send(o) });
    }
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    const st = { frames: 0, playFrames: 0, ownFrames: 0, ballTravel: 0, snapsAtStart: Online.snapCount || 0, skills: 0, ballPops: 0, ballPopMax: 0, mePops: 0, mePopMax: 0, errors: [] };
    let last = performance.now(), skillIn = 0.8, prevBall = null, prevMe = null, dirI = 0;
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end && Online.m) {
      const frameAt = last + 16;
      while (performance.now() < frameAt) {
        await tick();
        while (q.length && q[0].at <= performance.now()) q.shift().fn();
      }
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const m = Online.m;
      if (!m) break;
      const me = m.human, b = m.ball;
      try {
        if (b.owner === me) {
          const dx = CFG.FIELD_W * 0.8 - me.x, dy = CFG.FIELD_H / 2 - me.y, l = Math.hypot(dx, dy) || 1;
          let sx = dx / l, sy = dy / l;
          skillIn -= dt;
          if (skillIn <= 0 && m.phase === 'play') {
            const kinds = [[sx, sy], [-sy, sx], [-sx, -sy], [0, 0]];
            [sx, sy] = kinds[dirI++ % kinds.length];
            Input._skillQueued = true; st.skills++; skillIn = 0.9 + Math.random() * 0.5;
          }
          Input.stick.x = sx; Input.stick.y = sy;
        } else {
          const dx = b.x - me.x, dy = b.y - me.y, l = Math.hypot(dx, dy) || 1;
          Input.stick.x = dx / l; Input.stick.y = dy / l;
        }
        Input.update();
        Online.update(dt);
        FX.update(dt, dt);
        Render.updateCamera(m, dt);
        Render.drawMatch(m, now / 1000);
        UI.updateHUD(m);
      } catch (e) { st.errors.push(e.message + ' ' + (e.stack || '').split(String.fromCharCode(10))[1]); if (st.errors.length > 5) break; }
      if (m.phase === 'play') { st.playFrames++; if (b.owner === me) st.ownFrames++; if (prevBall) st.ballTravel += Math.hypot(b.x - prevBall.x, b.y - prevBall.y); }
      if (m.phase === 'play' && prevBall && prevMe && m.phase === prevBall.phase) {
        const expB = Math.hypot(b.vx, b.vy) * dt * 1.6 + 6, jb = Math.hypot(b.x - prevBall.x, b.y - prevBall.y) - expB;
        if (jb > 14) { st.ballPops++; st.ballPopMax = Math.max(st.ballPopMax, jb); }
        const expM = Math.max(Math.hypot(me.vx, me.vy), CFG.SPEED * 1.4) * dt * 1.3 + 4, jm = Math.hypot(me.x - prevMe.x, me.y - prevMe.y) - expM;
        if (jm > 10) { st.mePops++; st.mePopMax = Math.max(st.mePopMax, jm); (st.meWhy = st.meWhy || []).length < 8 && st.meWhy.push({ jm: Math.round(jm), predOk: Online.predOk, pred: !!Online.pred, wasPred: !!Online._wasPred, corr: Math.round(Math.hypot(Online.corr.x, Online.corr.y)), busy: !!Online.busyCorr, own: b.owner === me, stun: +me.stunT.toFixed(2), rec: +me.recoverT.toFixed(2), slide: +me.slideT.toFixed(2), fall: +me.fallT.toFixed(2), kick: +me.kickT.toFixed(2) }); }
        if (jb > 14) (st.ballWhy = st.ballWhy || []).length < 6 && st.ballWhy.push({ jb: Math.round(jb), own: b.owner === me, owner: b.owner ? m.players.indexOf(b.owner) : -1, bc: Math.round(Math.hypot(Online.ballCorr.x, Online.ballCorr.y)), pred: !!Online.pred });
      }
      prevBall = { x: b.x, y: b.y, phase: m.phase }; prevMe = { x: me.x, y: me.y };
      st.frames++;
    }
    Input.stick.x = 0; Input.stick.y = 0;
    return { ...st, ballTravel: Math.round(st.ballTravel), snaps: (Online.snapCount || 0) - st.snapsAtStart, ballPopMax: Math.round(st.ballPopMax), mePopMax: Math.round(st.mePopMax), lagMs: lag, rtt: Math.round(Net.rtt) };
  },
};
