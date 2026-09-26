// The ULT cutscene.
//
// Offline: the world is held nearly still while the camera dives onto the striker, his face fills
// half the screen, and the bicycle kick / volley / backflip / scissor kick plays out in slow
// motion. Then the camera swings onto the ball and hands back with it already rocketing away.
// Nothing about the shot itself changes — the ball is struck the same way it always was, time is
// just crawling while it happens, so a cutscene can never turn a goal into a miss.
//
// Online: the other player's match cannot be slowed down, so it is the same card at a fifth of
// the length with the world running underneath at full speed.
const UltCut = {
  DUR: 4.8,     // offline, real seconds
  NET: 1.1,     // online, or somebody else's ult
  // the beats, in real seconds: the strike, his face, the move, the flight, and handing back
  STRIKE: 0.3, FACE: 1.7, MOVE: 3.3, FLIGHT: 4.2,

  // a shot that has just been struck, by anyone, on this screen: play it once
  watch(m) {
    if (m.ultCut || Game.headless) return;
    for (const p of m.players) {
      if (!p.ultShot) { p.ultCutDone = false; continue; }
      if (p.ultCutDone || p.ultShot.t > 0.25) continue; // (joining late: no cutscene for it)
      p.ultCutDone = true;
      this.start(m, p, p.ultShot.kind, !!m.net);
      return;
    }
  },

  start(m, p, kind, net) {
    m.ultCut = {
      p, kind, t: 0,
      // the long one is for your own ult: online it cannot slow the other player down, and a
      // team-mate or opponent pulling one off should not hold the match up for five seconds
      short: !!net || !p.isHuman,
      dur: net || !p.isHuman ? this.NET : this.DUR,
      // (an offline fill-in has no name of its own, so its shirt number does the job)
      name: p.isHuman ? 'YOU' : String(p.name || '').toUpperCase() || ('#' + p.number),
      move: ULT_NAMES[kind] || 'ULT',
      look: p.look, team: p.team, number: p.number,
    };
  },

  end(m) {
    const c = m.ultCut;
    if (!c) return;
    if (c.p.ultShot) c.p.ultShot.t = c.p.ultShot.dur; // let the sim finish the pose off
    m.ultCut = null;
  },

  update(m, realDt) {
    this.watch(m);
    const c = m.ultCut;
    if (!c) return;
    c.t += realDt;
    // a goal, a save, the whistle: whatever happens next has the screen
    if (c.t >= c.dur || (m.phase !== 'play' && c.t > 0.5)) { this.end(m); return; }
    if (c.short) return;
    // the pose is drawn from its own clock so the swing plays through the slow-motion beat
    if (c.p.ultShot) c.p.ultShot.t = this.pose(c) * c.p.ultShot.dur;
  },

  // 0..1 through the kick: a flicker at the strike, held mid-air for his face, then the full swing
  pose(c) {
    const t = c.t;
    if (t < this.STRIKE) return 0.15 * (t / this.STRIKE);
    if (t < this.FACE) return 0.15;
    if (t < this.MOVE) return lerp(0.15, 1, (t - this.FACE) / (this.MOVE - this.FACE));
    return 1;
  },

  // what time does while it runs (offline only)
  scale(m) {
    const c = m.ultCut;
    if (!c || c.short) return 1;
    const t = c.t;
    if (t < this.STRIKE) return 0.02;
    if (t < this.FACE) return 0.03;
    if (t < this.MOVE) return 0.13;
    if (t < this.FLIGHT) return 0.3;
    return lerp(0.3, 1, (t - this.FLIGHT) / (c.dur - this.FLIGHT));
  },

  // where the camera looks, and how close
  camera(m) {
    const c = m.ultCut;
    if (!c || c.short) return null;
    const t = c.t, p = c.p, b = m.ball;
    const zoom = t < this.STRIKE ? lerp(1, 2.7, easeOut(t / this.STRIKE))
      : t < this.FACE ? 2.7
        : t < this.MOVE ? 2.45
          : t < this.FLIGHT ? lerp(2.45, 1.9, (t - this.MOVE) / (this.FLIGHT - this.MOVE))
            : lerp(1.9, 1, (t - this.FLIGHT) / (c.dur - this.FLIGHT));
    // it sits on him, then swings onto the ball as it goes
    const w = t < this.MOVE ? 0 : clamp((t - this.MOVE) / (this.FLIGHT - this.MOVE), 0, 1);
    return { x: lerp(p.x, b.x, w), y: lerp(p.y - 14, b.y, w), zoom };
  },

  // ---------- the picture on top ----------
  draw(ctx, m, now) {
    const c = m.ultCut;
    if (!c) return;
    const W = Render.W, H = Render.H, t = c.t;
    ctx.setTransform(Render.dpr, 0, 0, Render.dpr, 0, 0);
    const col = rainbow(now * 0.6);

    // cinema bars, in and out
    const inT = c.short ? 0.1 : 0.2, outAt = c.dur - (c.short ? 0.25 : 0.55);
    const bar = Math.min(1, t / inT) * (t > outAt ? Math.max(0, 1 - (t - outAt) / (c.dur - outAt)) : 1);
    const bh = Math.round(H * (c.short ? 0.07 : 0.115) * bar);
    if (bh > 0) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, W, bh);
      ctx.fillRect(0, H - bh, W, bh);
      ctx.fillStyle = col;
      ctx.fillRect(0, bh, W, 4);
      ctx.fillRect(0, H - bh - 4, W, 4);
    }

    // speed lines: solid spokes chasing in from the edges while his face is up
    const lineT = c.short ? Math.min(1, t / 0.12) * Math.max(0, 1 - Math.max(0, t - c.dur * 0.6) / (c.dur * 0.4))
      : t < this.MOVE ? Math.min(1, t / 0.18) : Math.max(0, 1 - (t - this.MOVE) / 0.5);
    if (lineT > 0.02) {
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) * 0.6;
      ctx.save();
      ctx.globalAlpha = 0.5 * lineT;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + now * 0.25;
        const sp = 0.012 + (i % 3) * 0.006;
        const r0 = R * (0.42 + ((i * 37) % 100) / 100 * 0.2) * (1.15 - lineT * 0.15);
        ctx.fillStyle = i % 5 === 0 ? col : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a + sp) * R, cy + Math.sin(a + sp) * R);
        ctx.lineTo(cx + Math.cos(a - sp) * R, cy + Math.sin(a - sp) * R);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // his face, sliding in
    const faceStart = c.short ? 0.05 : this.STRIKE * 0.6;
    const faceEnd = c.short ? c.dur : this.FACE + 0.25;
    if (t > faceStart && t < faceEnd) {
      const into = clamp((t - faceStart) / 0.18, 0, 1);
      const outOf = clamp((faceEnd - t) / 0.2, 0, 1);
      const slide = (1 - easeOut(into)) * -W * 0.5 + (1 - easeOut(outOf)) * W * 0.35;
      const PH = Math.round(Math.min(H * 0.52, W * 0.42));
      const PW = Math.round(PH * 0.92);
      const px = Math.round(W * 0.08 + slide), py = Math.round((H - PH) / 2);
      ctx.save();
      // the card
      ctx.fillStyle = OUTLINE; Sprites.rr(ctx, px + 7, py + 8, PW, PH, 22); ctx.fill();
      ctx.fillStyle = col; Sprites.rr(ctx, px, py, PW, PH, 22); ctx.fill();
      ctx.save();
      Sprites.rr(ctx, px + 6, py + 6, PW - 12, PH - 12, 17); ctx.clip();
      ctx.fillStyle = TEAMS[c.team].board;
      ctx.fillRect(px, py, PW, PH);
      // blocks of colour behind him, flat and hard-edged
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = 0; i < 4; i++) ctx.fillRect(px, py + PH * (0.12 + i * 0.2), PW, PH * 0.06);
      // Measured off the sprite: the head sits 59k above the feet and stands about 35k tall, so
      // k = PH/45 with the feet 1.76 cards down fills about four fifths of it with his face.
      const k = PH / 45;
      Sprites.player(ctx, UI.fakePlayer(c.look, c.team, false, c.number), px + PW / 2 - 4 * k, py + PH * 1.76, k, now);
      ctx.restore();
      ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE;
      Sprites.rr(ctx, px, py, PW, PH, 22); ctx.stroke();
      ctx.restore();

      // who it is, and what he is about to do
      const big = clamp(Math.min(W, H) * 0.085, 22, 58);
      const tx = px + PW + Math.max(14, W * 0.03);
      if (tx < W - 40) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        Render.chunkyText(ctx, c.name, tx, py + PH * 0.36, big * 0.62, '#ffffff', 0);
        Render.chunkyText(ctx, c.move, tx, py + PH * 0.36 + big * 0.95, big, col, 0);
        ctx.textAlign = 'center';
      }
    }

    // the word ULT, stamped in the middle of the strike
    if (!c.short && t < this.STRIKE) {
      const u = t / this.STRIKE;
      const size = clamp(Math.min(W, H) * 0.2, 40, 150) * (1.6 - easeOut(u) * 0.6);
      ctx.save();
      ctx.globalAlpha = 1 - u * 0.15;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      Render.chunkyText(ctx, 'ULT', W / 2, H / 2, size, col, 0);
      ctx.restore();
    }
  },
};
