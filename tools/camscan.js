// Camera scan — not loaded by the game. In the browser console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/camscan.js'; s.onload = r; document.head.appendChild(s); });
//   CS.run()            // at this window size
//   CS.run(myCamera)    // the same, with another camera function (m, dt, snap) to compare against
//
// "When u walk away from the ball u cant see ur player anymore." This puts you and the ball a set
// distance apart all over the pitch, lets the camera settle, and counts how often you, or the ball,
// end up off the screen, how often you are under the stick, a button, the scoreboard or the
// minimap (on screen, but under a thumb), and how far back the camera pulled.
window.CS = {
  // on screen: your feet this far in from the edges (your head and name are above them)
  IN: { x: 24, top: 60, bottom: 16 },
  onScreen(x, y) {
    const R = Render, k = R.S * R.zoom * R.f(y);
    const px = (x - R.cam.x) * k + R.W / 2, py = (y * CFG.TILT - R.cam.y) * k + R.H / 2;
    return px >= this.IN.x && px <= R.W - this.IN.x && py >= this.IN.top && py <= R.H - this.IN.bottom;
  },
  // where you are on the screen
  at(x, y) {
    const R = Render, k = R.S * R.zoom * R.f(y);
    return [(x - R.cam.x) * k + R.W / 2, (y * CFG.TILT - R.cam.y) * k + R.H / 2];
  },
  // the things drawn over the pitch that you could end up under
  covers() {
    const out = [];
    for (const e of document.querySelectorAll('#joy-base, #hud .action, #btn-ult, #scoreboard, #btn-pause')) {
      const b = e.getBoundingClientRect();
      if (b.width > 2 && b.height > 2) out.push([b.left, b.top, b.right, b.bottom]);
    }
    const mm = Render.minimapBox(Render.W, Render.H);
    if (mm) out.push([mm.x0, mm.y0, mm.x0 + mm.mw, mm.y0 + mm.mh]);
    return out;
  },
  run(camera) {
    const cam = camera || ((m, dt, snap) => Render.updateCamera(m, dt, snap));
    const covers = this.covers();
    const m = Match.create({ mode: 'quick', club: Clubs.random(Clubs.mine()), format: '4v4' });
    const h = m.human, b = m.ball;
    m.phase = 'play'; b.owner = null;
    const was = { cam: { ...Render.cam }, zoom: Render.zoom };
    const out = { size: Render.W + 'x' + Render.H, controls: covers.length, tried: 0, youOff: 0, youUnder: 0, ballOff: 0, ballOffNear: 0, zoomMin: 9, zoomAt: {} };
    for (const hx of [300, 800, 1200, 1600, 2100]) for (const hy of [200, 450, 700, 950, 1200]) {
      for (let dx = -1600; dx <= 1600; dx += 200) for (let dy = -1000; dy <= 1000; dy += 250) {
        const bx = hx + dx, by = hy + dy, d = Math.hypot(dx, dy);
        if (!d || bx < 20 || bx > CFG.FIELD_W - 20 || by < 20 || by > CFG.FIELD_H - 20) continue;
        h.x = hx; h.y = hy; h.vx = 0; h.vy = 0; b.x = bx; b.y = by; b.vx = 0; b.vy = 0;
        cam(m, 0, true);
        for (let i = 0; i < 180; i++) cam(m, 1 / 60, false); // three seconds to settle
        out.tried++;
        const you = this.onScreen(h.x, h.y), ball = this.onScreen(b.x, b.y);
        if (!you) out.youOff++;
        // your middle (about 22px above your feet at full size) under something drawn over the pitch
        const [px, py] = this.at(h.x, h.y), my = py - 22 * Render.S * Render.zoom;
        if (you && covers.some(([l, t, r, b]) => px > l && px < r && my > t && my < b)) out.youUnder++;
        if (!ball) { out.ballOff++; if (d <= 700) out.ballOffNear++; }
        out.zoomMin = Math.min(out.zoomMin, Render.zoom);
        const bucket = d < 300 ? 'under 300' : d < 600 ? '300-600' : d < 900 ? '600-900' : d < 1200 ? '900-1200' : '1200+';
        const z = out.zoomAt[bucket] || (out.zoomAt[bucket] = { n: 0, sum: 0, youOff: 0 });
        z.n++; z.sum += Render.zoom; if (!you) z.youOff++;
      }
    }
    for (const k in out.zoomAt) { const z = out.zoomAt[k]; out.zoomAt[k] = `zoom ${(z.sum / z.n).toFixed(2)}, you off ${Math.round((100 * z.youOff) / z.n)}%`; }
    out.youOffPct = Math.round((1000 * out.youOff) / out.tried) / 10;
    out.youUnderPct = Math.round((1000 * out.youUnder) / out.tried) / 10;
    out.ballOffPct = Math.round((1000 * out.ballOff) / out.tried) / 10;
    out.zoomMin = Math.round(out.zoomMin * 100) / 100;
    Render.cam.x = was.cam.x; Render.cam.y = was.cam.y; Render.zoom = was.zoom;
    return out;
  },
};
