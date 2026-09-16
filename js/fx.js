// Particles, popups, banners, flash and camera shake. Pooled and capped.
const FX = {
  ground: [],   // drawn under the players
  air: [],      // drawn over the players
  texts: [],    // floating world text (+PASS, SAVE!)
  banner: null, // big center text (GOAL!)
  flash: { a: 0, color: '#fff' },
  shake: { t: 0, mag: 0, x: 0, y: 0 },
  MAX: 260,

  low() { return Save.data.settings.graphics === 'low' || Render.quality >= 2; },

  clear() {
    this.ground.length = 0; this.air.length = 0; this.texts.length = 0;
    this.banner = null; this.flash.a = 0; this.shake.t = 0;
  },

  _push(list, p) {
    if (Game.headless) return;
    if (this.ground.length + this.air.length > this.MAX) return;
    list.push(p);
  },

  // ---- spawners (world coordinates) ----
  dust(x, y) {
    if (this.low() && Math.random() < 0.5) return;
    this._push(this.ground, { k: 'dust', x: x + rand(-4, 4), y: y + rand(-3, 3), z: 0, t: 0, life: 0.38, r: rand(3, 5), vx: rand(-15, 15), vy: rand(-10, 10) });
  },
  ring(x, y, color, r0, r1, life, width = 3) {
    this._push(this.ground, { k: 'ring', x, y, z: 0, t: 0, life, r0, r1, color, width });
  },
  sparks(x, y, z, color, n, speed, life = 0.28) {
    if (this.low()) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * rand(0.4, 1);
      this._push(this.air, { k: 'streak', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(-0.3, 1) * s * 0.6, t: 0, life: life * rand(0.7, 1.2), color, len: rand(8, 16) });
    }
  },
  burst(x, y, z, color, size, life = 0.3) {
    this._push(this.air, { k: 'burst', x, y, z, t: 0, life, size, color });
  },
  confetti(x, y, colors, n) {
    if (this.low()) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 330);
      this._push(this.air, { k: 'confetti', x, y, z: rand(10, 40), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(250, 560), t: 0, life: rand(1.1, 1.8), color: pick(colors), rot: rand(0, 6), vr: rand(-12, 12), w: rand(4, 7) });
    }
  },
  ember(x, y, z, color) {
    if (this.low()) return;
    this._push(this.air, { k: 'ember', x: x + rand(-4, 4), y: y + rand(-4, 4), z: z + rand(-3, 3), vx: rand(-30, 30), vy: rand(-30, 30), vz: rand(20, 80), t: 0, life: rand(0.2, 0.4), color, r: rand(2, 3.5) });
  },
  speedLine(x, y, vx, vy) {
    if (this.low()) return;
    const s = Math.hypot(vx, vy) || 1;
    const side = rand(-9, 9);
    this._push(this.air, { k: 'streak', x: x - (vx / s) * 10 + (-vy / s) * side, y: y - (vy / s) * 10 + (vx / s) * side, z: rand(10, 34), vx: -vx * 0.25, vy: -vy * 0.25, vz: 0, t: 0, life: 0.18, color: '#ffffff', len: 16 });
  },
  stars(x, y, z) {
    this._push(this.air, { k: 'stars', x, y, z, t: 0, life: 0.45 });
  },
  text(x, y, str, color, size = 18) {
    if (Game.headless) return;
    // no spam: replace an identical popup that is still rising
    for (const t of this.texts) if (t.str === str && t.t < 0.3) return;
    this.texts.push({ x, y, z: 60, str, color, size, t: 0, life: 0.9 });
  },
  showBanner(str, color, life = 1.4, sub = '') {
    if (Game.headless) return;
    this.banner = { str, color, sub, t: 0, life };
  },
  doFlash(color, a) {
    if (Game.headless) return;
    this.flash.color = color; this.flash.a = Math.max(this.flash.a, a);
  },
  doShake(mag, t) {
    if (Game.headless) return;
    if (mag >= this.shake.mag || this.shake.t <= 0) { this.shake.mag = mag; this.shake.t = t; this.shake.dur = t; }
  },

  update(dt, realDt) {
    const step = (list) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.t += dt;
        if (p.t >= p.life) { list[i] = list[list.length - 1]; list.pop(); continue; }
        if (p.vx !== undefined) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.k === 'dust') { p.vx *= 0.9; p.vy *= 0.9; }
          if (p.vz !== undefined) {
            p.z += p.vz * dt;
            if (p.k === 'confetti') { p.vz -= 700 * dt; p.vx *= 0.97; p.vy *= 0.97; p.rot += p.vr * dt; if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; } }
            else if (p.k === 'streak') { p.vz -= 300 * dt; p.vx *= 0.92; p.vy *= 0.92; }
          }
        }
      }
    };
    step(this.ground); step(this.air);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += realDt; t.z += 40 * realDt;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
    if (this.banner) { this.banner.t += realDt; if (this.banner.t >= this.banner.life) this.banner = null; }
    this.flash.a = Math.max(0, this.flash.a - realDt * 2.8);
    if (this.shake.t > 0) {
      this.shake.t -= realDt;
      const k = Math.max(0, this.shake.t / this.shake.dur) * this.shake.mag;
      this.shake.x = rand(-1, 1) * k; this.shake.y = rand(-1, 1) * k;
    } else { this.shake.x = 0; this.shake.y = 0; this.shake.mag = 0; }
  },

  // ---- drawing (Render supplies projection helpers) ----
  drawGround(ctx, R) {
    const S = R.S;
    for (const p of this.ground) {
      const u = p.t / p.life, sx = R.sx(p.x, p.y), sy = R.sy(p.y, 0);
      if (p.k === 'dust') {
        ctx.globalAlpha = 0.55 * (1 - u);
        ctx.fillStyle = '#eaf7d8';
        ctx.beginPath(); ctx.arc(sx, sy, p.r * (1 + u * 1.4) * S, 0, Math.PI * 2); ctx.fill();
      } else if (p.k === 'ring') {
        const r = lerp(p.r0, p.r1, easeOut(u)) * S;
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.width * S;
        ctx.beginPath(); ctx.ellipse(sx, sy, r, r * CFG.TILT, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawAir(ctx, R) {
    const S = R.S;
    for (const p of this.air) {
      const u = p.t / p.life, sx = R.sx(p.x, p.y), sy = R.sy(p.y, p.z);
      if (p.k === 'streak') {
        const l = Math.hypot(p.vx, p.vy) || 1, len = p.len * (1 - u) * S;
        ctx.globalAlpha = 1 - u * 0.6;
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.6 * S; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - (p.vx / l) * len, sy - (p.vy / l) * len * CFG.TILT); ctx.stroke();
      } else if (p.k === 'burst') {
        // flat star burst: spikes + ring, no blur
        const r = p.size * (0.5 + easeOut(u) * 0.8) * S;
        if (!this.low()) Sprites.glow(ctx, sx, sy, r * 1.8, p.color, (1 - u) * 0.55);
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + p.size, rr = i % 2 ? r * 0.45 : r;
          ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.32 * (1 - u), 0, Math.PI * 2); ctx.fill();
      } else if (p.k === 'confetti') {
        ctx.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
        ctx.fillRect(-p.w * S / 2, -p.w * 0.35 * S, p.w * S, p.w * 0.7 * S * Math.abs(Math.cos(p.rot * 1.7)) + 1);
        ctx.restore();
      } else if (p.k === 'ember') {
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, p.r * (1 - u * 0.6) * S, 0, Math.PI * 2); ctx.fill();
      } else if (p.k === 'stars') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * S;
        for (let i = 0; i < 3; i++) {
          const a = p.t * 9 + (i * Math.PI * 2) / 3;
          R.star(ctx, sx + Math.cos(a) * 13 * S, sy + Math.sin(a) * 5 * S, 4.5 * S);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const u = t.t / t.life, sx = R.sx(t.x, t.y), sy = R.sy(t.y, t.z);
      const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.5 : u < 0.25 ? 1.1 - (u - 0.15) : 1;
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      R.chunkyText(ctx, t.str, sx, sy, t.size * pop * Math.max(0.8, S), t.color);
    }
    ctx.globalAlpha = 1;
  },

  drawScreen(ctx, W, H, R) {
    if (this.flash.a > 0) {
      ctx.globalAlpha = Math.min(0.55, this.flash.a);
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    const b = this.banner;
    if (b) {
      const u = b.t / b.life;
      let sc = u < 0.12 ? easeOut(u / 0.12) * 1.25 : u < 0.2 ? 1.25 - ((u - 0.12) / 0.08) * 0.25 : 1;
      let a = 1;
      if (u > 0.82) { a = (1 - u) / 0.18; sc *= 1 + (u - 0.82) * 0.8; }
      const size = Math.min(W * 0.14, H * 0.24) * sc;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(W / 2, H * 0.42);
      ctx.rotate(-0.06);
      R.chunkyText(ctx, b.str, 0, 0, size, b.color, size * 0.14);
      if (b.sub) R.chunkyText(ctx, b.sub, 0, size * 0.72, size * 0.3, '#ffffff', size * 0.06);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  },
};
