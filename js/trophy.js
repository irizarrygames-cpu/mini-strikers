// Lifting the cup: win the bot World Cup or the online World Cup and your team gets a trophy
// ceremony before the results: a stage in a packed stadium, jets of fire, fireworks and confetti,
// your teammates going wild and you with the cup over your head. Flat shapes, like the rest of the
// game. Tap (or any key) to carry on; it moves on by itself after a while.
const Trophy = {
  active: false,

  // opts: { title, sub, club, mates: [look...], onDone }
  show(opts) {
    if (this.active) this.finish();
    const el = $('trophy');
    if (!el) { if (opts.onDone) opts.onDone(); return; }
    this.opts = opts;
    this.active = true;
    this.t0 = performance.now();
    this.lastT = 0;
    el.hidden = false;
    el.classList.remove('ready');
    // flag for the country, drawn once
    this.flag = document.createElement('canvas'); this.flag.width = 96; this.flag.height = 64;
    UI.flagBadge(this.flag, opts.club || Clubs.mine());
    // your side: you in the middle, four teammates around the stage
    const rnd = mulberry32(((Math.random() * 1e9) | 0) + 7);
    const pickR = (a) => a[(rnd() * a.length) | 0];
    const aiLook = () => ({ hair: pickR(AI_HAIRS), hairColor: pickR(HAIR_COLORS), skin: pickR(SKINS), band: '#ffffff', cap: '#1b1d33' });
    const looks = (opts.mates || []).filter(Boolean).slice(0, 4);
    while (looks.length < 4) looks.push(aiLook());
    this.me = UI.fakePlayer(Save.look(), 'blue', false, 10);
    this.mates = looks.map((look, i) => Object.assign(UI.fakePlayer(look, 'blue', false, [7, 9, 11, 4][i]), { seed: i * 1.7, kind: i % 2 ? 'jump' : 'hype' }));
    this.fx = { rockets: [], sparks: [], confetti: [], nextRocket: 0.9, nextBurst: 0 };
    this.stars = Array.from({ length: 40 }, () => [rnd(), rnd() * 0.34, 0.6 + rnd() * 1.4]);
    Sound.powerShot(); Sound.goalJingle(true); Sound.cheer(true);
    if (typeof vibrate === 'function') vibrate([40, 40, 80]);
    const tap = () => { if (this.t() > 1.2) this.finish(); };
    el.onclick = tap;
    // capture first so the results screen's Enter/Space doesn't also start the next match
    this._key = (e) => { if (!this.active) return; e.stopImmediatePropagation(); e.preventDefault(); tap(); };
    window.addEventListener('keydown', this._key, true);
    const loop = () => { if (!this.active) return; this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },

  t() { return (performance.now() - this.t0) / 1000; },

  finish() {
    if (!this.active) return;
    this.active = false;
    const el = $('trophy');
    if (el) { el.hidden = true; el.onclick = null; }
    window.removeEventListener('keydown', this._key, true);
    const done = this.opts && this.opts.onDone;
    this.opts = null;
    if (done) done();
  },

  draw() {
    if (!this.active || !this.opts) return;
    const cv = $('trophy-canvas'), el = $('trophy');
    const W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = this.t(), dt = Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (t > 1.5) el.classList.add('ready');
    if (t > 11) { this.finish(); return; }
    const kit = TEAMS.blue, S = Math.min(W, H * 1.25);
    const floorY = H * 0.72;

    // night sky, stars, the stands packed with your colours
    g.fillStyle = '#131838'; g.fillRect(0, 0, W, H);
    for (const [x, y, r] of this.stars) { g.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 3 + x * 20)})`; g.fillRect(x * W, y * H, r, r); }
    const standTop = H * 0.36;
    g.fillStyle = '#20264f'; g.fillRect(0, standTop, W, floorY - standTop);
    g.fillStyle = '#2a3163'; for (let i = 0; i < 5; i++) g.fillRect(0, standTop + i * (floorY - standTop) / 5, W, 3);
    const cols = [kit.jersey, kit.accent || '#ffffff', '#ffffff', kit.shorts || kit.jersey];
    const n = Math.ceil(W / 13);
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i < n; i++) {
        const x = i * 13 + (row % 2) * 6 + 4, y = standTop + 8 + row * (floorY - standTop) / 5 - Math.abs(Math.sin(t * 7 + i * 0.7 + row)) * 4;
        g.fillStyle = cols[(i * 7 + row * 3) % cols.length];
        g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.fill();
      }
    }
    // floodlights
    for (const fx of [0.07, 0.93]) {
      const x = fx * W;
      g.fillStyle = '#3a4270'; g.fillRect(x - 3, standTop - H * 0.2, 6, H * 0.2);
      g.fillStyle = '#fff6c8'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      this.rrect(g, x - 26, standTop - H * 0.26, 52, 26, 6); g.fill(); g.stroke();
    }
    // the pitch
    g.fillStyle = '#48b53c'; g.fillRect(0, floorY, W, H - floorY);
    g.fillStyle = '#52c145'; for (let x = 0; x < W; x += 80) g.fillRect(x, floorY, 40, H - floorY);
    g.fillStyle = OUTLINE; g.fillRect(0, floorY - 2, W, 4);

    // the stage
    const pw = Math.min(W * 0.42, S * 0.62), ph = H * 0.06, px = W / 2 - pw / 2, py = floorY + H * 0.05 - ph;
    const pop = Math.min(1, t / 0.35);
    g.save(); g.translate(W / 2, py + ph); g.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop); g.translate(-W / 2, -(py + ph));
    g.fillStyle = '#ffd23f'; g.strokeStyle = OUTLINE; g.lineWidth = 4;
    this.rrect(g, px, py, pw, ph, 10); g.fill(); g.stroke();
    g.fillStyle = '#e0a100'; g.fillRect(px + 4, py + ph * 0.62, pw - 8, ph * 0.3);
    g.restore();

    // jets of fire either side of the stage, in bursts
    const burst = (t % 1.6) < 0.5 ? 1 : 0.45;
    for (const jx of [0.12, 0.27, 0.73, 0.88]) this.flame(g, jx * W, floorY + H * 0.03, S * 0.2 * burst * (0.85 + 0.15 * Math.sin(t * 30 + jx * 9)), t + jx * 3);
    if ((t % 1.6) < dt && t > 0.2) Sound.powerShot();

    // your teammates on the grass, you on the stage with the cup
    // (sized to fit under the words on wide, short screens and across narrow ones)
    const k = Math.min(H * 0.27, W * 0.22) / 72;
    const matePos = [[-0.36, 0.1], [-0.2, 0.17], [0.2, 0.17], [0.36, 0.1]];
    this.mates.forEach((p, i) => {
      const [mx, my] = matePos[i];
      const x = W / 2 + mx * Math.min(W, S * 1.3), y = floorY + H * my;
      const e = 0.2 + ((t + p.seed) % 2.2);
      p.celebKind = p.kind; p.celebrateT = CELE_TIME - Math.min(e, CELE_TIME - 0.05);
      p.faceX = mx < 0 ? 1 : -1; p.fx = p.faceX * 0.8; p.fy = 0.3; p.runPhase = t * 9;
      this.shadow(g, x, y, k * 0.85);
      Sprites.player(g, p, x, y, k * 0.85, t);
    });
    const e = t < 2.4 ? Math.max(0, t - 0.5) : 0.4 + ((t - 2.4) % 2);
    const me = this.me;
    me.celebKind = 'trophy'; me.celebrateT = CELE_TIME - Math.min(e, CELE_TIME - 0.05);
    me.faceX = 1; me.fx = 0.3; me.fy = 0.6;
    this.shadow(g, W / 2, py + 2, k);
    Sprites.player(g, me, W / 2, py + 2, k, t);
    // the cup glints
    if (t > 0.9) for (let i = 0; i < 4; i++) {
      const a = t * 2 + (i * Math.PI) / 2, r = 50 * k + Math.sin(t * 5 + i) * 8;
      this.sparkle(g, W / 2 + Math.cos(a) * r, py - 72 * k + Math.sin(a) * r * 0.5, 6 + 3 * Math.sin(t * 9 + i), '#fff6a8');
    }

    // fireworks and confetti
    const f = this.fx;
    if (t > f.nextRocket) {
      f.nextRocket = t + 0.35 + Math.random() * 0.5;
      f.rockets.push({ x: W * (0.1 + Math.random() * 0.8), y: floorY, tx: H * (0.08 + Math.random() * 0.22), c: pick(['#ff3a3f', '#ffe14d', '#46d9ff', '#3fcf4a', '#ff4df0', '#ffffff', kit.jersey]) });
    }
    for (const r of f.rockets) {
      r.y -= H * 1.1 * dt;
      g.fillStyle = '#fff6c8'; g.fillRect(r.x - 2, r.y, 4, 12);
      if (r.y <= r.tx && !r.done) {
        r.done = true;
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; f.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * S * 0.28, vy: Math.sin(a) * S * 0.28, c: r.c, life: 1.2 }); }
        if (Math.random() < 0.5) Sound.bounce(260);
      }
    }
    f.rockets = f.rockets.filter((r) => !r.done);
    for (const s of f.sparks) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += S * 0.25 * dt; s.vx *= 1 - dt * 1.2; s.vy *= 1 - dt * 1.2;
      g.globalAlpha = Math.max(0, Math.min(1, s.life / 0.6));
      g.fillStyle = s.c; g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    f.sparks = f.sparks.filter((s) => s.life > 0);
    if (t > 0.6 && f.confetti.length < 160) for (let i = 0; i < 3; i++) f.confetti.push({ x: Math.random() * W, y: -10, vy: 60 + Math.random() * 90, vx: (Math.random() - 0.5) * 40, a: Math.random() * 6, va: (Math.random() - 0.5) * 8, c: pick(['#ffe14d', '#ff3a3f', '#46d9ff', '#3fcf4a', '#ffffff', kit.jersey, kit.accent || '#ffffff']) });
    for (const c of f.confetti) {
      c.y += c.vy * dt; c.x += c.vx * dt + Math.sin(t * 3 + c.a) * 0.6; c.a += c.va * dt;
      g.save(); g.translate(c.x, c.y); g.rotate(c.a); g.fillStyle = c.c; g.fillRect(-4, -2.5, 8, 5); g.restore();
    }
    f.confetti = f.confetti.filter((c) => c.y < H + 10);

    // the words
    const tp = Math.min(1, Math.max(0, (t - 0.25) / 0.35));
    const ts = tp < 1 ? 0.4 + tp * 0.75 : 1 + Math.sin(t * 4) * 0.03;
    const size = Math.min(W * 0.1, H * 0.11, 84);
    g.save(); g.translate(W / 2, H * 0.12); g.rotate(-0.04); g.scale(ts, ts);
    g.font = `${size}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = OUTLINE; g.strokeText(this.opts.title, 0, 0);
    g.fillStyle = '#ffe14d'; g.fillText(this.opts.title, 0, 0);
    g.restore();
    if (t > 0.5) {
      const fs = Math.min(W * 0.045, H * 0.055, 30), y = H * 0.12 + size * 0.85;
      const name = (this.opts.club || Clubs.mine()).name;
      g.font = `${fs}px ${getComputedStyle(document.body).fontFamily}`; g.textBaseline = 'middle';
      const tw = g.measureText(name).width, fw = fs * 1.6, gap = fs * 0.4, x0 = W / 2 - (fw + gap + tw) / 2;
      g.drawImage(this.flag, x0, y - fw / 3, fw, (fw * 2) / 3);
      g.textAlign = 'left'; g.lineWidth = fs * 0.22; g.strokeStyle = OUTLINE; g.strokeText(name, x0 + fw + gap, y);
      g.fillStyle = '#ffffff'; g.fillText(name, x0 + fw + gap, y);
      if (this.opts.sub) {
        g.textAlign = 'center'; const ss = fs * 0.72;
        g.font = `${ss}px ${getComputedStyle(document.body).fontFamily}`;
        g.lineWidth = ss * 0.22; g.strokeText(this.opts.sub, W / 2, y + fs * 1.15);
        g.fillStyle = '#ffe14d'; g.fillText(this.opts.sub, W / 2, y + fs * 1.15);
      }
    }
    // the flash as it starts
    if (t < 0.35) { g.fillStyle = `rgba(255,255,255,${1 - t / 0.35})`; g.fillRect(0, 0, W, H); }
  },

  // (canvas roundRect isn't on older phones)
  rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },

  shadow(g, x, y, k) { g.fillStyle = 'rgba(10,40,10,0.3)'; g.beginPath(); g.ellipse(x, y, 20 * k, 6 * k, 0, 0, Math.PI * 2); g.fill(); },

  sparkle(g, x, y, r, c) {
    g.fillStyle = c; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  },

  // a jet of fire: three flat tongues (red, orange, yellow) with the game's outline
  flame(g, x, y, h, t) {
    const layers = [['#e8341c', 1, 1], ['#ff8a1f', 0.72, 0.7], ['#ffe14d', 0.45, 0.42]];
    for (const [c, sw, sh] of layers) {
      const w = h * 0.34 * sw, hh = h * sh;
      g.beginPath(); g.moveTo(x - w, y);
      for (let i = 0; i <= 6; i++) {
        const u = i / 6, side = -1 + 2 * u;
        const wob = Math.sin(t * 20 + u * 9) * w * 0.18;
        const top = y - hh * (0.55 + 0.45 * Math.cos(side * Math.PI * 0.5)) - Math.abs(Math.sin(t * 13 + i * 2)) * hh * 0.15;
        g.lineTo(x + side * w * 0.85 + wob, top);
      }
      g.lineTo(x + w, y); g.closePath();
      g.fillStyle = c; g.fill();
      if (c === '#e8341c') { g.lineWidth = 3; g.strokeStyle = OUTLINE; g.stroke(); }
    }
  },
};
