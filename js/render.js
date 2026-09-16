// Camera, stadium + field (pre-rendered once), goals, sorted sprites, overlays.
const Render = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1, S: 1,
  cam: { x: CFG.FIELD_W / 2, y: (CFG.FIELD_H / 2) * CFG.TILT },
  layer: null, L: null, flags: [], homeCrowd: null,
  quality: 0, // 0 full, 1 reduced, 2 low — AUTO graphics steps this up when frames run long

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    let t = 0;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => this.resize(), 120); });
  },

  resize() {
    const setting = Save.data.settings.graphics;
    this.W = window.innerWidth; this.H = window.innerHeight;
    // Resolution budget: big or retina screens used to push 8M+ pixels a frame.
    const low = setting === 'low' || this.quality >= 2;
    const budget = low ? 1.0e6 : this.quality >= 1 ? 1.7e6 : 2.4e6;
    let dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 2);
    dpr = Math.min(dpr, Math.sqrt(budget / Math.max(1, this.W * this.H)));
    this.dpr = Math.max(0.6, dpr);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    // portrait is the fallback shape: pull the camera back so the pitch is not a keyhole
    this.S = this.W >= this.H ? Math.min(this.W / 700, this.H / 370) : this.W / 620;
    this.buildLayer();
    this.homeCrowd = null;
  },

  // Slight perspective: things on the far side of the pitch shrink, the near side grows.
  PERSP: 3000,
  f(wy) {
    if (wy === undefined) return 1;
    const v = clamp(wy - this.cam.y / CFG.TILT, -2200, 2400);
    return this.PERSP / (this.PERSP - v);
  },
  k(wy) { return this.S * this.f(wy); },
  sx(wx, wy) { return (wx - this.cam.x) * this.S * this.f(wy) + this.W / 2 + FX.shake.x; },
  sy(wy, wz) { return ((wy * CFG.TILT - this.cam.y) - wz) * this.f(wy) * this.S + this.H / 2 + FX.shake.y; },

  // the flat pre-rendered stadium, drawn as thin horizontal strips so it takes the perspective
  drawLayer(ctx) {
    const L = this.L, img = this.layer, fl = this.LF, T = CFG.TILT, S = this.S;
    const rows = clamp(Math.ceil(((L.Y1 - L.Y0) * S) / 5), 60, 150);
    const step = img.height / rows;
    for (let i = 0; i < rows; i++) {
      const r0 = i * step, r1 = Math.min(img.height, r0 + step);
      const wy0 = (L.Y0 + r0 / fl) / T, wy1 = (L.Y0 + r1 / fl) / T;
      const y0 = this.sy(wy0, 0), y1 = this.sy(wy1, 0);
      if (y1 < 0 || y0 > this.H) continue;
      const f = this.f((wy0 + wy1) / 2);
      const x0 = (L.X0 - this.cam.x) * S * f + this.W / 2 + FX.shake.x;
      ctx.drawImage(img, 0, r0, img.width, r1 - r0, x0, y0, (L.X1 - L.X0) * S * f, y1 - y0 + 0.75);
    }
  },

  // ---------------- static layer ----------------
  buildLayer() {
    const T = CFG.TILT, M = CFG.SIDE_M;
    const X0 = -270, X1 = CFG.FIELD_W + 270, Y0 = -M * T - 230, Y1 = (CFG.FIELD_H + M) * T + 190;
    const f = Math.min(this.S * this.dpr * 1.1, Save.data.settings.graphics === 'low' || this.quality >= 1 ? 0.75 : 1.0);
    this.layerClub = Clubs.home && Clubs.current ? Clubs.home.id + '/' + Clubs.current.id : null;
    this.LF = f;
    const c = document.createElement('canvas');
    c.width = Math.ceil((X1 - X0) * f); c.height = Math.ceil((Y1 - Y0) * f);
    const g = c.getContext('2d');
    g.scale(f, f); g.translate(-X0, -Y0);
    this.L = { X0, X1, Y0, Y1 };
    this.drawStadium(g, X0, X1, Y0, Y1);
    this.layer = c;
    this.flags = [];
    const nFlags = Math.ceil(CFG.FIELD_W / 180);
    for (let i = 0; i < nFlags; i++) this.flags.push({ x: 60 + i * 180, y: Y0 + 26 + (i % 2) * 30, team: i < nFlags / 2 ? 'blue' : 'red', ph: i * 1.3 });
  },

  drawCrowd(g, x0, x1, y0, y1, rng, backs, split) {
    const shirtsB = [TEAMS.blue.jersey, TEAMS.blue.jersey, TEAMS.blue.stripes || TEAMS.blue.checks || TEAMS.blue.fx, '#ffffff', '#ffe14d', TEAMS.blue.shade];
    const shirtsR = [TEAMS.red.jersey, TEAMS.red.jersey, TEAMS.red.stripes || TEAMS.red.checks || TEAMS.red.fx, '#ffffff', '#ffe14d', TEAMS.red.shade];
    const st = Save.stadium();
    const hair = ['#2b1d14', '#4a2e1c', '#1b1b2a', '#f2c230', '#b8521f', '#6b3f22'];
    let row = 0;
    for (let y = y0 + 16; y < y1; y += 21, row++) {
      g.fillStyle = st.stands[row % 2];
      g.fillRect(x0, y - 16, x1 - x0, 21);
      for (let x = x0 + (row % 2 ? 9 : 0); x < x1; x += 17) {
        if (rng() < 0.08) continue;
        const cx = x + (rng() - 0.5) * 5, cy = y + (rng() - 0.5) * 3;
        const blueSide = split === undefined ? rng() < 0.5 : cx < split;
        g.lineWidth = 1.6; g.strokeStyle = OUTLINE;
        Sprites.rr(g, cx - 7, cy - 2, 14, 12, 4);
        g.fillStyle = (blueSide ? shirtsB : shirtsR)[(rng() * 6) | 0]; g.fill(); g.stroke();
        g.beginPath(); g.arc(cx, cy - 7, 5.6, 0, Math.PI * 2);
        g.fillStyle = backs ? hair[(rng() * 6) | 0] : SKINS[(rng() * SKINS.length) | 0]; g.fill(); g.stroke();
        if (!backs) {
          g.fillStyle = hair[(rng() * 6) | 0];
          g.beginPath(); g.arc(cx, cy - 8.5, 5.6, Math.PI * 1.05, Math.PI * 1.95); g.fill();
        }
      }
    }
  },

  drawStadium(g, X0, X1, Y0, Y1) {
    const T = CFG.TILT, M = CFG.SIDE_M, E = CFG.END_M, C = CFG.CHAMFER, W = CFG.FIELD_W, H = CFG.FIELD_H;
    const rng = mulberry32(7);
    const st = Save.stadium();
    g.fillStyle = st.stands[0]; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    const topBoard = -M * T;
    const boardH = 30;
    this.drawCrowd(g, X0, X1, Y0, topBoard - boardH, rng, false, W / 2);
    this.drawCrowd(g, X0, X1, (H + M) * T + 26, Y1, rng, true, W / 2);
    // side stands behind the goals
    g.save(); g.beginPath(); g.rect(X0, topBoard - boardH, -E - 48 - X0, (H + M) * T + 26 - (topBoard - boardH)); g.clip();
    this.drawCrowd(g, X0, -E - 48, topBoard - boardH, (H + M) * T + 26, rng, false, 1e9); g.restore();
    g.save(); g.beginPath(); g.rect(W + E + 48, topBoard - boardH, X1 - (W + E + 48), (H + M) * T + 26 - (topBoard - boardH)); g.clip();
    this.drawCrowd(g, W + E + 48, X1, topBoard - boardH, (H + M) * T + 26, rng, false, -1e9); g.restore();

    // concrete apron around the arena
    g.fillStyle = st.apron;
    g.beginPath();
    g.rect(-E - 48, topBoard - boardH, W + 2 * E + 96, (H + M) * T + 26 - (topBoard - boardH));
    g.fill();

    // grass floor of the arena (polygon incl. goal pockets)
    const poly = [
      [-E + C, -M], [W + E - C, -M], [W + E, -M + C], [W + E, GOAL_Y1], [W + CFG.GOAL_D, GOAL_Y1], [W + CFG.GOAL_D, GOAL_Y2], [W + E, GOAL_Y2],
      [W + E, H + M - C], [W + E - C, H + M], [-E + C, H + M], [-E, H + M - C], [-E, GOAL_Y2], [-CFG.GOAL_D, GOAL_Y2], [-CFG.GOAL_D, GOAL_Y1], [-E, GOAL_Y1], [-E, -M + C],
    ];
    g.save();
    g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y * T) : g.moveTo(x, y * T))); g.closePath();
    g.clip();
    const cols = st.grass;
    for (let i = -3; i < Math.ceil((W + 200) / 75); i++) {
      for (let j = -2; j < Math.ceil((H + 160) / 70); j++) {
        g.fillStyle = cols[(i + 20) % 2][(j + 20) % 2];
        g.fillRect(i * 75, j * 70 * T, 75.5, 70 * T + 0.5);
      }
    }
    g.strokeStyle = st.tuft; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 560; i++) {
      const x = rng() * (W + 40) - 20, y = (rng() * (H + 40) - 20) * T;
      g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x, y); g.lineTo(x + 3, y - 4); g.stroke();
    }
    // goal pocket floors
    g.fillStyle = 'rgba(20, 80, 20, 0.18)';
    g.fillRect(W, GOAL_Y1 * T, CFG.GOAL_D, CFG.GOAL_W * T);
    g.fillRect(-CFG.GOAL_D, GOAL_Y1 * T, CFG.GOAL_D, CFG.GOAL_W * T);
    g.restore();

    // boards: far side (vertical face), near side (strip), ends + chamfers
    const face = (x1, y1, x2, y2, h, color, lip) => {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2, y2 - h); g.lineTo(x1, y1 - h); g.closePath();
      g.fillStyle = color; g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUTLINE; g.stroke();
      g.beginPath(); g.moveTo(x1, y1 - h); g.lineTo(x2, y2 - h); g.lineTo(x2, y2 - h + 5); g.lineTo(x1, y1 - h + 5); g.closePath();
      g.fillStyle = lip; g.fill();
    };
    face(-E + C, topBoard, W / 2, topBoard, boardH, TEAMS.blue.board, TEAMS.blue.lip);
    face(W / 2, topBoard, W + E - C, topBoard, boardH, TEAMS.red.board, TEAMS.red.lip);
    face(-E, (-M + C) * T, -E + C, topBoard, boardH, TEAMS.blue.board, TEAMS.blue.lip);
    face(W + E - C, topBoard, W + E, (-M + C) * T, boardH, TEAMS.red.board, TEAMS.red.lip);
    // slogans on the far board
    g.font = '900 17px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = [GAME_NAME.toUpperCase(), GAME_SLOGANS[0] + ' ' + GAME_SLOGANS[1], GAME_SLOGANS[2]];
    for (let i = 0; i < Math.ceil(W / 205); i++) {
      const x = 90 + i * 205, y = topBoard - boardH / 2 + 1;
      const s = words[i % 3];
      g.lineWidth = 4; g.strokeStyle = OUTLINE; g.strokeText(s, x, y);
      g.fillStyle = '#ffffff'; g.fillText(s, x, y);
    }
    const crown = (cx, cy, s) => {
      g.beginPath();
      g.moveTo(cx - 10 * s, cy + 6 * s); g.lineTo(cx - 12 * s, cy - 6 * s); g.lineTo(cx - 5 * s, cy); g.lineTo(cx, cy - 9 * s);
      g.lineTo(cx + 5 * s, cy); g.lineTo(cx + 12 * s, cy - 6 * s); g.lineTo(cx + 10 * s, cy + 6 * s); g.closePath();
      g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    };
    for (let i = 0; i < Math.ceil(W / 205); i++) crown(90 + i * 205 - 118, topBoard - boardH / 2 + 1, 0.9);
    const tower = (tx) => {
      const baseY = topBoard - boardH - 6, topY = Y0 + 34;
      g.fillStyle = '#5b6488'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      g.beginPath(); g.moveTo(tx - 6, baseY); g.lineTo(tx - 3, topY + 30); g.lineTo(tx + 3, topY + 30); g.lineTo(tx + 6, baseY); g.closePath(); g.fill(); g.stroke();
      Sprites.rr(g, tx - 34, topY - 6, 68, 40, 6); g.fillStyle = '#39406a'; g.fill(); g.stroke();
      for (let rI = 0; rI < 2; rI++) for (let cI = 0; cI < 4; cI++) {
        g.beginPath(); g.arc(tx - 24 + cI * 16, topY + 5 + rI * 17, 6, 0, Math.PI * 2);
        g.fillStyle = '#fff6c8'; g.fill(); g.lineWidth = 2; g.stroke();
      }
    };
    tower(-190); tower(W + 190); tower(W * 0.25); tower(W * 0.75);
    // end boards (seen from above) beside each goal
    const endBoard = (x, ya, yb, dir, color, lip) => {
      g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 2.5;
      g.beginPath(); g.rect(dir < 0 ? x - 16 : x, ya * T - boardH, 16, (yb - ya) * T + boardH); g.fill(); g.stroke();
      g.fillStyle = lip; g.fillRect(dir < 0 ? x - 16 : x, ya * T - boardH, 5 * (dir < 0 ? 1 : 1), (yb - ya) * T + boardH);
    };
    endBoard(-E, -M + C, GOAL_Y1, -1, TEAMS.blue.board, TEAMS.blue.lip);
    endBoard(-E, GOAL_Y2, H + M - C, -1, TEAMS.blue.board, TEAMS.blue.lip);
    endBoard(W + E, -M + C, GOAL_Y1, 1, TEAMS.red.board, TEAMS.red.lip);
    endBoard(W + E, GOAL_Y2, H + M - C, 1, TEAMS.red.board, TEAMS.red.lip);
    // near boards (front strip)
    const nb = (H + M) * T;
    const strip = (x1, y1, x2, y2, color) => {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2, y2 + 20); g.lineTo(x1, y1 + 20); g.closePath();
      g.fillStyle = color; g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUTLINE; g.stroke();
    };
    strip(-E, (H + M - C) * T, -E + C, nb, TEAMS.blue.board);
    strip(-E + C, nb, W / 2, nb, TEAMS.blue.board);
    strip(W / 2, nb, W + E - C, nb, TEAMS.red.board);
    strip(W + E - C, nb, W + E, (H + M - C) * T, TEAMS.red.board);
    g.font = '900 13px system-ui, sans-serif';
    for (let i = 0; i < Math.ceil(W / 200); i++) {
      const s = i % 2 ? GAME_SLOGANS[3] : GAME_NAME.toUpperCase();
      g.lineWidth = 3.5; g.strokeStyle = OUTLINE; g.strokeText(s, 100 + i * 200, nb + 10.5);
      g.fillStyle = '#ffffff'; g.fillText(s, 100 + i * 200, nb + 10.5);
    }
  },

  // Pitch markings are drawn live with the perspective so they stay crisp at any zoom.
  drawPitchLive(ctx) {
    const W = CFG.FIELD_W, H = CFG.FIELD_H;
    ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, 5 * this.S);
    const pt = (x, y) => [this.sx(x, y), this.sy(y, 0)];
    const poly = (pts, close) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const [a, c] = pt(x, y); if (i) ctx.lineTo(a, c); else ctx.moveTo(a, c); });
      if (close) ctx.closePath();
      ctx.stroke();
    };
    const rect = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
    const arc = (cx, cy, r, a0, a1, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(pts, false); };
    rect(0, 0, W, H);
    poly([[W / 2, 0], [W / 2, H]]);
    arc(W / 2, H / 2, CFG.CIRCLE_R, 0, Math.PI * 2, 56);
    const cy = H / 2, spot = CFG.BOX_D * 0.71, arcR = CFG.BOX_D * 0.47, aa = Math.acos((CFG.BOX_D - spot) / arcR);
    ctx.fillStyle = '#ffffff';
    for (const [x, dir] of [[0, 1], [W, -1]]) {
      rect(dir > 0 ? 0 : W - CFG.BOX_D, cy - CFG.BOX_W / 2, CFG.BOX_D, CFG.BOX_W);
      rect(dir > 0 ? 0 : W - CFG.SMALL_D, cy - CFG.SMALL_W / 2, CFG.SMALL_D, CFG.SMALL_W);
      const px = x + dir * spot;
      arc(px, cy, arcR, dir > 0 ? -aa : Math.PI - aa, dir > 0 ? aa : Math.PI + aa, 18);
      const [sx0, sy0] = pt(px, cy);
      ctx.beginPath(); ctx.ellipse(sx0, sy0, 5 * this.S, 4 * this.S, 0, 0, Math.PI * 2); ctx.fill();
      if (dir > 0) { arc(0, 0, 30, 0, Math.PI / 2, 8); arc(0, H, 30, -Math.PI / 2, 0, 8); }
      else { arc(W, 0, 30, Math.PI / 2, Math.PI, 8); arc(W, H, 30, Math.PI, Math.PI * 1.5, 8); }
    }
    const [cx0, cy0] = pt(W / 2, H / 2);
    ctx.beginPath(); ctx.ellipse(cx0, cy0, 5 * this.S, 4 * this.S, 0, 0, Math.PI * 2); ctx.fill();
  },

  drawPitch(g) {
    const T = CFG.TILT, W = CFG.FIELD_W, H = CFG.FIELD_H;
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineJoin = 'miter'; g.lineCap = 'butt';
    const rect = (x, y, w, h) => { g.beginPath(); g.rect(x, y * T, w, h * T); g.stroke(); };
    rect(0, 0, W, H);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H * T); g.stroke();
    g.beginPath(); g.ellipse(W / 2, (H / 2) * T, CFG.CIRCLE_R, CFG.CIRCLE_R * T, 0, 0, Math.PI * 2); g.stroke();
    const cy = H / 2;
    for (const [x, dir] of [[0, 1], [W, -1]]) {
      rect(dir > 0 ? 0 : W - CFG.BOX_D, cy - CFG.BOX_W / 2, CFG.BOX_D, CFG.BOX_W);
      rect(dir > 0 ? 0 : W - CFG.SMALL_D, cy - CFG.SMALL_W / 2, CFG.SMALL_D, CFG.SMALL_W);
      const px = x + dir * 135;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(px, cy * T, 4, 4 * T, 0, 0, Math.PI * 2); g.fill();
      g.beginPath();
      g.ellipse(px, cy * T, 90, 90 * T, 0, dir > 0 ? -0.93 : Math.PI - 0.93, dir > 0 ? 0.93 : Math.PI + 0.93);
      g.stroke();
      for (const y of [0, H]) {
        g.beginPath(); g.ellipse(x, y * T, 16, 16 * T, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    // re-fill beyond the touchline corners so the corner arcs only show inside
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(W / 2, (H / 2) * T, 5, 5 * T, 0, 0, Math.PI * 2); g.fill();
  },

  // ---------------- camera ----------------
  zoom: 1,
  updateCamera(m, dt, snap) {
    const h = m.human, b = m.ball;
    let tx, ty;
    const star = m.phase === 'cele' && m.cele && m.cele.scorer;
    const zoomTo = star ? 1.85 : 1;
    this.zoom = snap ? zoomTo : this.zoom + (zoomTo - this.zoom) * (1 - Math.exp(-(star ? 3.2 : 6) * dt));
    if (star) {
      tx = star.x; ty = star.y - 16;
    } else if (m.phase === 'goal' || m.phase === 'timeup' || m.phase === 'replay') {
      tx = b.x; ty = b.y;
    } else {
      tx = h.x + h.vx * 0.35 + TEAMS.blue.dir * 60;
      ty = h.y + h.vy * 0.22;
      const d = dist(h.x, h.y, b.x, b.y);
      if (d > 120) { const w = clamp((d - 120) / 420, 0, 0.45); tx = lerp(tx, b.x, w); ty = lerp(ty, b.y, w); }
    }
    const zs = this.S * this.zoom;
    const halfW = this.W / 2 / zs, halfH = this.H / 2 / zs;
    const L = this.L;
    const minX = -CFG.END_M - 90 + halfW, maxX = CFG.FIELD_W + CFG.END_M + 90 - halfW;
    tx = minX > maxX ? CFG.FIELD_W / 2 : clamp(tx, minX, maxX);
    let py = ty * CFG.TILT;
    const minY = -CFG.SIDE_M * CFG.TILT - 95 + halfH, maxY = (CFG.FIELD_H + CFG.SIDE_M) * CFG.TILT + 80 - halfH;
    py = minY > maxY ? (CFG.FIELD_H / 2) * CFG.TILT : clamp(py, minY, maxY);
    const k = snap ? 1 : 1 - Math.exp(-(star ? 7 : 4.5) * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (py - this.cam.y) * k;
  },

  // ---------------- helpers ----------------
  chunkyText(ctx, str, x, y, size, color, stroke) {
    ctx.font = `900 ${size}px "Lilita One", system-ui, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke || Math.max(3, size * 0.2);
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText(str, x, y + size * 0.06);
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },
  star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  },

  goalPart(ctx, side, front, bulge) {
    const S = this.S, x = side === 'right' ? CFG.FIELD_W : 0, dir = side === 'right' ? 1 : -1;
    const D = CFG.GOAL_D, Hh = CFG.GOAL_H, Hb = CFG.GOAL_H * 0.76, bx = x + dir * (D + bulge * 26);
    const P = (wx, wy, wz) => [this.sx(wx, wy), this.sy(wy, wz)];
    const grid = (a, b, c, d, nu, nv) => {
      ctx.beginPath();
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const p1 = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)], p2 = [lerp(d[0], c[0], u), lerp(d[1], c[1], u)];
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        const p1 = [lerp(a[0], d[0], v), lerp(a[1], d[1], v)], p2 = [lerp(b[0], c[0], v), lerp(b[1], c[1], v)];
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
      ctx.stroke();
    };
    const quad = (pts, alpha) => {
      ctx.globalAlpha = alpha; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    };
    const post = (a, b, w) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = (w + 3) * S;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * S;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };
    ctx.lineWidth = Math.max(1, 1.3 * S);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    if (!front) {
      const a = P(bx, GOAL_Y1, 0), b = P(bx, GOAL_Y2, 0), c = P(bx, GOAL_Y2, Hb), d = P(bx, GOAL_Y1, Hb);
      quad([a, b, c, d], 0.16); grid(a, b, c, d, 9, 3);
      const e = P(x, GOAL_Y1, Hh), f2 = P(x, GOAL_Y2, Hh);
      quad([e, f2, c, d], 0.12); grid(e, f2, c, d, 9, 2);
      const s1 = P(x, GOAL_Y1, 0), s2 = P(bx, GOAL_Y1, 0);
      quad([s1, s2, d, e], 0.12); grid(s1, s2, d, e, 3, 3);
      post(d, c, 3.2);
      post(P(x, GOAL_Y1, 0), P(x, GOAL_Y1, Hh), 5);
    } else {
      const s1 = P(x, GOAL_Y2, 0), s2 = P(bx, GOAL_Y2, 0), c = P(bx, GOAL_Y2, Hb), e = P(x, GOAL_Y2, Hh);
      quad([s1, s2, c, e], 0.12); grid(s1, s2, c, e, 3, 3);
      post(P(x, GOAL_Y2, 0), P(x, GOAL_Y2, Hh), 5);
      post(P(x, GOAL_Y1, Hh), P(x, GOAL_Y2, Hh), 5);
    }
  },

  // ---------------- frame ----------------
  drawMatch(m, t) {
    // the cutscene zooms by drawing the whole frame at a bigger scale
    const baseS = this.S;
    this.S = baseS * (m.demo ? 1 : this.zoom);
    try { this.drawFrame(m, t); } finally { this.S = baseS; }
  },

  drawFrame(m, t) {
    const ctx = this.ctx, S = this.S, W = this.W, H = this.H, b = m.ball;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = Save.stadium().stands[0]; ctx.fillRect(0, 0, W, H);
    const L = this.L;
    ctx.imageSmoothingEnabled = true;
    this.drawLayer(ctx);
    this.drawPitchLive(ctx);

    // waving flags in the stands
    const excited = m.phase === 'goal';
    for (const f of this.flags) {
      const x = this.sx(f.x, f.y / CFG.TILT), y = this.sy(f.y / CFG.TILT, 0), fk = this.k(f.y / CFG.TILT);
      if (x < -60 || x > W + 60 || y < -80 || y > H + 20) continue;
      const wave = Math.sin(t * (excited ? 16 : 5) + f.ph) * 6 * fk;
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5 * fk;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 46 * fk); ctx.stroke();
      ctx.fillStyle = TEAMS[f.team].board; ctx.lineWidth = 2 * fk;
      ctx.beginPath(); ctx.moveTo(x, y - 46 * fk); ctx.lineTo(x + 30 * fk, y - 40 * fk + wave); ctx.lineTo(x, y - 30 * fk); ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // shadows
    for (const p of m.players) Sprites.shadow(ctx, this.sx(p.x, p.y), this.sy(p.y, 0), this.k(p.y), p.r * 1.3, p.diveT > 0 || p.hopT > 0 ? 14 : 0);
    Sprites.shadow(ctx, this.sx(b.x, b.y), this.sy(b.y, 0), this.k(b.y), CFG.BALL_R * 1.05, b.z);

    FX.drawGround(ctx, this);
    if (!m.demo) this.drawHumanRing(ctx, m, t);

    // depth-sorted sprites
    const list = [];
    for (const p of m.players) list.push({ y: p.y, p });
    list.push({ y: b.y + 0.5, ball: true });
    list.push({ y: GOAL_Y1, goal: 'right', front: false }, { y: GOAL_Y2 + 1, goal: 'right', front: true });
    list.push({ y: GOAL_Y1, goal: 'left', front: false }, { y: GOAL_Y2 + 1, goal: 'left', front: true });
    list.sort((a, c) => a.y - c.y);
    for (const it of list) {
      if (it.p) {
        const p = it.p, sx = this.sx(p.x, p.y), sy = this.sy(p.y, 0);
        if (sx < -100 || sx > W + 100 || sy < -40 || sy > H + 160) continue;
        Sprites.player(ctx, p, sx, sy, this.k(p.y), t);
      } else if (it.ball) {
        Sprites.trail(ctx, b, this, t);
        Sprites.ball(ctx, b, this.sx(b.x, b.y), this.sy(b.y, b.z + CFG.BALL_R), this.k(b.y), t);
      } else {
        this.goalPart(ctx, it.goal, it.front, b.netBulge[it.goal]);
      }
    }
    FX.drawAir(ctx, this);
    if (m.net) this.drawNames(ctx, m);
    if (!m.demo) {
      if (m.phase !== 'cele') this.drawIndicators(ctx, m);
      if (m.phase !== 'cele') this.drawSlideWarning(ctx, m, t);
      if (Save.data.settings.minimap && m.phase !== 'timeup' && this.zoom < 1.05) this.drawMinimap(ctx, m);
    }

    if (m.phase === 'replay') this.drawReplay(ctx, m, t);
    if (m.phase === 'cele') this.drawCutscene(ctx, m, t);
    if (m.phase === 'reset') {
      const u = m.phaseT / 0.45;
      const cover = u < 0.5 ? easeOut(u * 2) : 1 - easeOut((u - 0.5) * 2);
      ctx.fillStyle = '#2f7bff';
      ctx.fillRect(0, 0, W * cover, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(W * cover - 10, 0, 10, H);
    }
    FX.drawScreen(ctx, W, H, this);
  },

  // cinematic bars, who scored and which celebration, while the scorer celebrates
  drawCutscene(ctx, m, t) {
    const W = this.W, H = this.H, c = m.cele;
    const u = clamp(m.phaseT / 0.25, 0, 1), bar = Math.round(H * 0.1 * easeOut(u));
    ctx.fillStyle = 'rgba(10, 12, 28, 0.88)';
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    if (!c || !c.scorer || u < 1) return;
    const s = c.scorer, size = clamp(H * 0.06, 17, 34), y = H - bar / 2, x0 = Math.max(18, W * 0.03);
    const who = s === m.human && (m.net || s.isHuman) ? 'YOU' : s.name || `#${s.number} ${TEAMS[s.team].name}`;
    const def = CELEBRATIONS.find((x) => x.id === c.kind);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    this.chunkyText(ctx, 'GOAL!', x0, y, size, '#ffe14d');
    ctx.font = `900 ${size}px "Lilita One", system-ui, sans-serif`;
    const gw = ctx.measureText('GOAL! ').width;
    this.chunkyText(ctx, who, x0 + gw, y, size * 0.8, s.team === 'blue' ? '#ffffff' : '#ffd0d3');
    if (def) {
      ctx.textAlign = 'right';
      const pop = clamp((m.phaseT - 0.35) / 0.2, 0, 1);
      this.chunkyText(ctx, def.name.toUpperCase(), W - x0, y, size * (0.7 + 0.3 * easeOut(pop)), '#46d9ff');
    }
    ctx.textAlign = 'center';
  },

  // cinematic bars + REPLAY tag while a goal replays
  drawReplay(ctx, m, t) {
    const W = this.W, H = this.H, bar = Math.round(H * 0.08);
    ctx.fillStyle = 'rgba(10, 12, 28, 0.85)';
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    const size = clamp(H * 0.065, 18, 36), y = H - bar / 2, x0 = Math.max(18, W * 0.03);
    if ((t % 1) < 0.6) {
      ctx.fillStyle = '#ff3a3f'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x0 + size * 0.3, y, size * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    this.chunkyText(ctx, 'REPLAY', x0 + size * 0.75, y, size, '#ffffff');
    ctx.textAlign = 'right';
    const kb = document.body.classList.contains('kb');
    this.chunkyText(ctx, kb ? 'PRESS SPACE TO SKIP' : 'TAP TO SKIP', W - x0, y, size * 0.55, '#ffe14d');
    const rp = m.replay;
    if (rp && m.rec && m.rec.frames.length) {
      const span = rp.t1 - rp.t0;
      const u = clamp(1 - (rp.t1 - rp.t) / Math.max(0.1, span), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, H - bar, W, 4);
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(0, H - bar, W * u, 4);
    }
    ctx.textAlign = 'center';
  },

  // epic and legendary players carry a little orbit of sparkles
  drawAura(ctx, m, t, x, y, R, S) {
    const rar = m.humanRarity;
    if (rar !== 'legendary' && rar !== 'epic') return;
    const col = RARITIES[rar].color, n = rar === 'legendary' ? 3 : 2, h = m.human;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * S; ctx.fillStyle = rar === 'legendary' ? '#ffe14d' : '#d7b8ff';
    for (let i = 0; i < n; i++) {
      const a = t * 2.2 + (i * Math.PI * 2) / n;
      const px = x + Math.cos(a) * (R + 8 * S), py = y + Math.sin(a) * (R + 8 * S) * CFG.TILT - 3 * S;
      const s = (5.6 + Math.sin(t * 8 + i * 2) * 1.2) * S;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const aa = (j * Math.PI) / 4, rr = j % 2 ? s * 0.38 : s;
        ctx.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (rar === 'legendary' && h.speed > 200 && m.phase === 'play' && Math.random() < 0.25) FX.ember(h.x, h.y, 4, pick([col, '#ffe14d', '#ffffff']));
  },

  // online: every outfield player's name floats over their head
  drawNames(ctx, m) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = clamp(11 * this.S, 10, 15);
    for (const p of m.players) {
      if (!p.name || p.isKeeper) continue;
      const x = this.sx(p.x, p.y), y = this.sy(p.y, 96) - (p.hopT > 0 ? 18 : 0);
      if (x < -60 || x > this.W + 60 || y < -20 || y > this.H + 20) continue;
      const me = p === m.human;
      this.chunkyText(ctx, me ? 'YOU' : p.name, x, y, size, me ? '#ffe14d' : p.team === 'blue' ? '#ffffff' : '#ffd0d3', Math.max(2.5, size * 0.28));
    }
  },

  drawHumanRing(ctx, m, t) {
    const h = m.human, S = this.k(h.y), x = this.sx(h.x, h.y), y = this.sy(h.y, 0);
    const has = m.ball.owner === h;
    const power = m.meter.blue >= CFG.POWER_MAX;
    const R = 23 * S;
    this.drawAura(ctx, m, t, x, y, R, S);
    ctx.lineWidth = (has ? 4 : 3) * S;
    ctx.strokeStyle = has ? '#8cf0ff' : '#46d9ff';
    ctx.globalAlpha = has ? 0.28 : 0.15;
    ctx.fillStyle = '#46d9ff';
    ctx.beginPath(); ctx.ellipse(x, y, R, R * CFG.TILT, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    if (power) {
      const tr = Save.trail();
      ctx.setLineDash([7 * S, 6 * S]); ctx.lineDashOffset = -t * 40 * S;
      ctx.strokeStyle = tr.a === '#ffffff' ? '#bff3ff' : tr.a; ctx.lineWidth = 3 * S;
      const r2 = R + 6 * S + Math.sin(t * 8) * 1.5 * S;
      ctx.beginPath(); ctx.ellipse(x, y, r2, r2 * CFG.TILT, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (h.charging) {
      const p = clamp(h.chargeT / CFG.CHARGE_FULL, 0, 1);
      const level = h.chargeT < CFG.CHARGE_MED ? 0 : h.chargeT < CFG.CHARGE_STRONG ? 1 : 2;
      const col = level === 2 ? (power ? Save.trail().a === '#ffffff' ? '#bff3ff' : Save.trail().a : '#46d9ff') : level === 1 ? '#ffe14d' : '#ffffff';
      const r3 = R + 13 * S;
      ctx.lineWidth = 7 * S; ctx.strokeStyle = 'rgba(22,26,51,0.45)';
      ctx.beginPath(); ctx.ellipse(x, y, r3, r3 * CFG.TILT, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 5.5 * S; ctx.strokeStyle = col; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(x, y, r3, r3 * CFG.TILT, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p)); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = OUTLINE;
      for (const th of [CFG.CHARGE_MED, CFG.CHARGE_STRONG]) {
        const a = -Math.PI / 2 + (th / CFG.CHARGE_FULL) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r3, y + Math.sin(a) * r3 * CFG.TILT, 2.6 * S, 0, Math.PI * 2); ctx.fill();
      }
      if (level === 2) {
        Sprites.glow(ctx, x, y - 20 * S, 46 * S, col, 0.35 + Math.sin(t * 20) * 0.08);
        ctx.strokeStyle = col; ctx.lineWidth = 2 * S;
        const r4 = r3 + (6 + Math.sin(t * 30) * 2) * S;
        ctx.beginPath(); ctx.ellipse(x, y, r4, r4 * CFG.TILT, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (h.passCharging && h.passChargeT > CFG.PASS_CHARGE_TAP) {
      const p = clamp((h.passChargeT - CFG.PASS_CHARGE_TAP) / (CFG.PASS_CHARGE_FULL - CFG.PASS_CHARGE_TAP), 0, 1);
      const r5 = R + (h.charging ? 24 : 13) * S; // outside the shot ring when both are charging
      ctx.lineWidth = 6 * S; ctx.strokeStyle = 'rgba(22,26,51,0.45)';
      ctx.beginPath(); ctx.ellipse(x, y, r5, r5 * CFG.TILT, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4.5 * S; ctx.strokeStyle = p >= 0.85 ? '#ffe14d' : '#7fd0ff'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(x, y, r5, r5 * CFG.TILT, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p)); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  },

  // a red "!" over you when a slide is coming for the ball you're carrying
  drawSlideWarning(ctx, m, t) {
    const h = m.human;
    if (m.ball.owner !== h) return;
    if (!slideIncoming(m, h, 170)) return;
    const S = this.k(h.y), x = this.sx(h.x, h.y), y = this.sy(h.y, 92 + Math.sin(t * 30) * 3);
    ctx.fillStyle = '#ff3a3f'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 12 * Math.max(0.8, S * 0.6), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${16 * Math.max(0.8, S * 0.6)}px system-ui, sans-serif`;
    ctx.fillText('!', x, y + 1);
  },

  _miniBox: null,
  minimapBox(W, H) {
    const kb = document.body.classList.contains('kb');
    const c = this._miniBox;
    if (c && c.W === W && c.H === H && c.kb === kb) return c.box;
    const ratio = CFG.FIELD_H / CFG.FIELD_W;
    let mw = Math.round(clamp(W * 0.16, 110, 190)), mh = Math.round(mw * ratio);
    const edge = Math.max(16, W * 0.02);
    let x0 = W - mw - edge, y0 = Math.max(10, H * 0.025);
    const rect = (id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
    const sb = rect('scoreboard'), sprint = rect('btn-sprint');
    if (!sb || (!kb && !sprint)) return { mw, mh, x0, y0 }; // HUD not laid out, or controls hidden for a replay: don't cache
    // side by side with the scoreboard if there's room, otherwise underneath it
    if (x0 < sb.right + 8) y0 = sb.bottom + 10;
    // and never down into the SPRINT button
    if (sprint && sprint.left < x0 + mw && y0 + mh + 6 > sprint.top) {
      mh = Math.max(36, Math.floor(sprint.top - 6 - y0)); mw = Math.round(mh / ratio); x0 = W - mw - edge;
    }
    const box = { mw, mh, x0, y0 };
    this._miniBox = { W, H, kb, box };
    return box;
  },

  drawMinimap(ctx, m) {
    const W = this.W, H = this.H;
    const { mw, mh, x0, y0 } = this.minimapBox(W, H);
    const sx = (x) => x0 + (x / CFG.FIELD_W) * mw, sy = (y) => y0 + (y / CFG.FIELD_H) * mh;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#2f9a3c'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(x0 - 3, y0 - 3, mw + 6, mh + 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, mw, mh);
    ctx.beginPath(); ctx.moveTo(x0 + mw / 2, y0); ctx.lineTo(x0 + mw / 2, y0 + mh); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0 + mw / 2, y0 + mh / 2, mh * 0.13, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(x0, sy(CFG.FIELD_H / 2 - CFG.BOX_W / 2), (CFG.BOX_D / CFG.FIELD_W) * mw, (CFG.BOX_W / CFG.FIELD_H) * mh);
    ctx.strokeRect(x0 + mw - (CFG.BOX_D / CFG.FIELD_W) * mw, sy(CFG.FIELD_H / 2 - CFG.BOX_W / 2), (CFG.BOX_D / CFG.FIELD_W) * mw, (CFG.BOX_W / CFG.FIELD_H) * mh);
    ctx.globalAlpha = 1;
    // camera view box
    const halfW = W / 2 / this.S, halfH = H / 2 / this.S / CFG.TILT;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
    ctx.strokeRect(sx(this.cam.x - halfW), sy(this.cam.y / CFG.TILT - halfH), (halfW * 2 / CFG.FIELD_W) * mw, (halfH * 2 / CFG.FIELD_H) * mh);
    for (const p of m.players) {
      const kit = p.isKeeper ? KEEPER_KITS[p.team] : TEAMS[p.team];
      ctx.fillStyle = kit.jersey; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(clamp(sx(p.x), x0, x0 + mw), clamp(sy(p.y), y0, y0 + mh), p.isHuman ? 4.5 : 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (p.isHuman) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 7, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(clamp(sx(m.ball.x), x0, x0 + mw), clamp(sy(m.ball.y), y0, y0 + mh), 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  },

  drawIndicators(ctx, m) {
    const b = m.ball, W = this.W, H = this.H, S = this.S;
    const x = this.sx(b.x, b.y), y = this.sy(b.y, b.z);
    const pad = 34;
    if (x > pad && x < W - pad && y > pad + 40 && y < H - pad) return;
    const cx = W / 2, cy = H / 2;
    const dx = x - cx, dy = y - cy;
    const sc = Math.min((W / 2 - pad) / Math.abs(dx || 1), (H / 2 - pad - 20) / Math.abs(dy || 1));
    const ix = cx + dx * Math.min(1, sc), iy = cy + dy * Math.min(1, sc);
    const a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ix, iy);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(10, -9); ctx.lineTo(10, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUTLINE; Sprites.pent(ctx, 0, 0, 4.5, 0);
    ctx.restore();
  },

  // ---------------- home screen backdrop ----------------
  // Where your player can stand on the home screen without covering a button: the old
  // fixed spot (24% across, 86% down) put its feet on the bottom-left buttons and its cap
  // on the logo on a phone held sideways. The room left between the account pill, the
  // bottom row and the actions column is read from the page once per layout and cached.
  _homeSpot: null,
  homeSpot(W, H) {
    const tall = H > W;
    const base = { k: Math.min(H / 118, W / 190), px: tall ? W * 0.3 : W * 0.24, py: tall ? H * 0.62 : H * 0.86 };
    const c = this._homeSpot;
    if (c && c.W === W && c.H === H) return c.spot;
    const home = document.getElementById('home');
    const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
    const bl = rect('.home-bl'), act = rect('.home-actions'), pill = rect('.home-char');
    if (!home || home.hidden || !bl || !act || !pill) return base; // not laid out yet: try again next frame
    // the sprite reaches about 30k left, 36k right, 74k up and 10k down from its feet
    let floor = bl.top - 8, right = W - 8;
    if (act.left > W * 0.35) right = act.left - 10; // actions column on the right (landscape)
    else floor = Math.min(floor, act.top - 8);     // actions stacked across the middle (portrait)
    // the lowest thing above the player that shares its column is the ceiling
    let ceil = pill.bottom + 8;
    const spanL = base.px - 30 * base.k, spanR = base.px + 36 * base.k;
    for (const sel of ['.home-top', '#logo', '#home-record']) {
      const r = rect(sel);
      if (r && r.left < spanR && r.right > spanL && r.bottom < floor - 40) ceil = Math.max(ceil, r.bottom + 8);
    }
    const left = pill.left;
    let { k, px, py } = base;
    k = Math.max(1, Math.min(k, (floor - ceil) / 84, (right - left) / 66));
    py = Math.min(floor - 10 * k, Math.max(py, ceil + 74 * k));
    px = Math.max(left + 30 * k, Math.min(px, right - 36 * k));
    const spot = { k, px, py };
    this._homeSpot = { W, H, spot };
    return spot;
  },

  drawHome(t, demo) {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (demo) {
      this.drawMatch(demo, t);
      ctx.fillStyle = 'rgba(22, 26, 51, 0.38)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const bands = 12, bw = W / bands;
      for (let i = 0; i < bands; i++) { ctx.fillStyle = i % 2 ? '#4fbd3b' : '#5acb45'; ctx.fillRect(i * bw, 0, bw + 1, H); }
    }
    const ch = Save.character();
    const { k, px, py } = this.homeSpot(W, H);
    const fake = {
      team: 'blue', isKeeper: false, number: 10, look: { hair: ch.hair, hairColor: ch.hairColor, skin: ch.skin, cap: ch.cap, band: ch.band },
      vx: 0, vy: 0, fx: 1, fy: 0.2, faceX: 1, kickT: 0, kickDur: 0.2, celebrateT: 0, diveT: 0, stunT: 0, recoverT: 0, seed: 1, runPhase: 0, sad: false,
    };
    const cyc = (t % 0.9) / 0.9;
    if (cyc < 0.25) { fake.kickT = 0.2 * (1 - cyc / 0.25); }
    ctx.fillStyle = 'rgba(20, 60, 20, 0.28)';
    ctx.beginPath(); ctx.ellipse(px, py, 17 * k, 7.5 * k, 0, 0, Math.PI * 2); ctx.fill();
    Sprites.player(ctx, fake, px, py, k, t);
    const bz = Math.sin(cyc * Math.PI) * 55;
    const bx = px + 20 * k, by = py - 6 * k;
    ctx.fillStyle = 'rgba(20, 60, 20, 0.28)';
    ctx.beginPath(); ctx.ellipse(bx, py, 9 * k * (1 - bz / 150), 4 * k * (1 - bz / 150), 0, 0, Math.PI * 2); ctx.fill();
    Sprites.ball(ctx, { x: 0, y: 0, z: 0, vx: 1, vy: 0, roll: t * 6, shot: null, owner: null }, bx, by - bz * k * 0.9, k, t);
  },
};
