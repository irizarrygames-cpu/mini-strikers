// Club badges (build 113: "make the best badges you possibly can, like most detailed").
//
// Each badge is built from parts: a shape (round, shield, oval…), a rim, a field split in the
// club's colours (stripes, hoops, halves, a sash, diamonds…), the city's name lettered round the rim
// or on a ribbon, sometimes a crown or stars on top, and an emblem drawn here as a flat cartoon —
// a lion, an eagle, a ship, a lily. Each nods at its club the way an unlicensed football game does:
// the colours, the city and the animal or symbol fans know. None copies a real club's badge: no
// letters or monograms, no real layout. Flat fills, the game's thick outline, no gradients.
//
// Everything is drawn in a 100-unit box centred on the badge (x and y from -50 to 50), so one set
// of numbers works from a 27-pixel chip to the trophy screen.
const Crests = {
  SHAPES: {
    round: 'M0 -48 A48 48 0 1 1 0 48 A48 48 0 1 1 0 -48 Z',
    shield: 'M-42 -46 L42 -46 L42 4 C40 28 22 42 0 50 C-22 42 -40 28 -42 4 Z',
    pointed: 'M-42 -36 L0 -48 L42 -36 L42 4 C40 28 22 42 0 50 C-22 42 -40 28 -42 4 Z',
    french: 'M-44 -40 Q0 -54 44 -40 L44 6 C42 30 22 44 0 50 C-22 44 -42 30 -44 6 Z',
    badge: 'M-24 -46 L24 -46 Q42 -46 42 -28 L42 28 Q42 46 24 46 L-24 46 Q-42 46 -42 28 L-42 -28 Q-42 -46 -24 -46 Z',
    oval: 'M0 -49 C24 -49 40 -28 40 0 C40 28 24 49 0 49 C-24 49 -40 28 -40 0 C-40 -28 -24 -49 0 -49 Z',
    diamond: 'M0 -50 L48 0 L0 50 L-48 0 Z',
    hex: 'M0 -49 L42 -24.5 L42 24.5 L0 49 L-42 24.5 L-42 -24.5 Z',
  },
  _paths: {},
  path(d) { return this._paths[d] || (this._paths[d] = new Path2D(d)); },

  // draw a club's badge to fill a canvas (the badge keeps its own shape whatever the canvas is)
  badge(cv, club) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const cr = club.crest;
    if (!cr) return;
    const m = Math.min(W, H), small = m < 60;
    const top = cr.top && cr.top !== 'none';
    const S = m * (top ? 0.7 : 0.88), cx = W / 2, cy = H / 2 + (top ? m * 0.12 : 0);
    const u = S / 100, lw = Math.max(1.3, m * 0.035) / u;
    const [c0, c1, c2] = cr.cols, rim = cr.rim || c2;
    const round = cr.shape === 'round';
    const words = !small && cr.text;
    g.save();
    g.translate(cx, cy); g.scale(u, u);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const shape = this.path(this.SHAPES[cr.shape] || this.SHAPES.shield);
    // a hard drop shadow, the rim, then the field inside it
    g.save(); g.translate(0, 3.5); g.fillStyle = OUTLINE; g.fill(shape); g.restore();
    g.fillStyle = rim; g.fill(shape);
    const ringIn = round ? (words ? 0.74 : 0.84) : 0.86;
    g.save(); g.scale(ringIn, ringIn);
    g.save(); g.clip(shape);
    this.field(g, cr.split, c0, c1, cr.alt || '#f4f5f7', c2);
    // a flat highlight across the top of the field
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath(); g.ellipse(-12, -30, 34, 13, -0.35, 0, Math.PI * 2); g.fill();
    g.restore();
    g.lineWidth = lw * 0.75 / ringIn; g.strokeStyle = OUTLINE; g.stroke(shape);
    g.restore();
    // the city round the ring
    if (round && words) this.ringText(g, cr.text, cr.tc || '#ffffff', 41);
    // the emblem
    const ribbon = !round && words && cr.ribbon !== false;
    let ex = 0, ey = round ? 0 : -4, es = round ? (words ? 50 : 60) : 60;
    if (ribbon) { ey = -12; es = 46; }
    if (cr.epos === 'top') { ey = -30; es = 40; }
    if (cr.emblem && cr.emblem !== 'none') {
      if (cr.plate) {
        g.beginPath(); g.arc(ex, ey, es * 0.47, 0, Math.PI * 2);
        g.fillStyle = cr.plate; g.fill(); g.lineWidth = lw * 0.8; g.strokeStyle = OUTLINE; g.stroke();
      }
      this.emblem(g, cr.emblem, ex, ey, es * (cr.plate ? 0.8 : 1), cr.ec || c2, lw);
    }
    if (ribbon) this.ribbon(g, cr.text, cr.rc || c2, cr.rtc || OUTLINE, lw);
    // the outline round the whole badge
    g.lineWidth = lw * 1.25; g.strokeStyle = OUTLINE; g.stroke(shape);
    // a crown or stars on top
    if (top) this.topPiece(g, cr.top, cr.topc || '#ffc21a', lw);
    g.restore();
  },

  // the field, split in the club's colours (in the -50..50 box, the clip does the shape)
  field(g, split, c0, c1, alt, c2) {
    const rect = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    rect(c0, -60, -60, 120, 120);
    const bands = (n, vertical, a, b, from = -50, to = 50) => {
      const w = (to - from) / n;
      for (let i = 0; i < n; i++) if (i % 2) vertical ? rect(b, -50 + (i * 100) / n, from, 100 / n + 0.3, to - from) : rect(b, -60, from + i * w, 120, w + 0.3);
      else vertical ? rect(a, -50 + (i * 100) / n, from, 100 / n + 0.3, to - from) : rect(a, -60, from + i * w, 120, w + 0.3);
    };
    switch (split) {
      case 'vstripes': bands(7, true, c0, c1); break;
      case 'hstripes': bands(7, false, c0, c1); break;
      case 'halves': rect(c1, 0, -60, 60, 120); break;
      case 'quarters': rect(c1, 0, -60, 60, 60); rect(c1, -60, 0, 60, 60); break;
      case 'diag': g.fillStyle = c1; g.beginPath(); g.moveTo(60, -60); g.lineTo(60, 60); g.lineTo(-60, 60); g.closePath(); g.fill(); break;
      case 'sash': g.save(); g.rotate(Math.PI / 4); rect(c1, -90, -11, 180, 22); g.restore(); break;
      case 'band': rect(c1, -60, -12, 120, 24); break;
      case 'cband': rect(c1, -13, -60, 26, 120); break;
      case 'chevron': g.strokeStyle = c1; g.lineWidth = 20; g.lineCap = 'butt'; g.beginPath(); g.moveTo(-60, -40); g.lineTo(0, 10); g.lineTo(60, -40); g.stroke(); g.lineCap = 'round'; break;
      case 'checks': { const q = 100 / 8; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) rect(c1, -50 + c * q, -50 + r * q, q + 0.3, q + 0.3); break; }
      case 'lozenges': {
        // the Bavarian diamonds: rows of tilted squares
        rect(c1, -60, -60, 120, 120);
        g.fillStyle = c0;
        // (every other diamond is coloured, so it is half and half, the way the flag has it)
        for (let r = -4; r <= 4; r++) for (let c = -4; c <= 4; c++) {
          const x = c * 16, y = r * 20;
          g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 8, y); g.lineTo(x, y + 10); g.lineTo(x - 8, y); g.closePath(); g.fill();
        }
        break;
      }
      case 'topband':
        bands(7, true, c0, alt, -12, 60);
        rect(c1, -60, -60, 120, 48);
        g.fillStyle = OUTLINE; g.fillRect(-60, -13.5, 120, 3);
        break;
      case 'blaugrana':
        bands(7, true, c0, c1, -16, 60);
        rect(c2, -60, -60, 120, 44);
        for (let i = 0; i < 4; i++) rect('#d61f26', -30 + i * 18, -60, 8, 44);
        g.fillStyle = OUTLINE; g.fillRect(-60, -17.5, 120, 3);
        break;
    }
  },

  // letters round the top of a round badge's ring
  ringText(g, text, color, r) {
    const str = String(text).toUpperCase();
    const fs = str.length > 9 ? 9.5 : 11;
    g.save();
    g.font = `400 ${fs}px "Lilita One", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ws = [...str].map((ch) => g.measureText(ch).width * 1.08);
    const total = ws.reduce((a, b) => a + b, 0) / r;
    let a = -total / 2; // (0 is straight up: rotate, then step up the radius)
    g.fillStyle = color;
    [...str].forEach((ch, i) => {
      const half = ws[i] / 2 / r;
      a += half;
      g.save(); g.rotate(a); g.translate(0, -r); g.fillText(ch, 0, 0); g.restore();
      a += half;
    });
    // and a small star either side underneath, to finish the ring
    for (const s of [-1, 1]) this.star(g, s * 33, 24, 3.6, color, null, 0);
    g.restore();
  },

  ribbon(g, text, fill, color, lw) {
    const p = this.path('M-44 16 L44 16 L40 25 L44 34 L-44 34 L-40 25 Z');
    g.fillStyle = fill; g.fill(p); g.lineWidth = lw * 0.9; g.strokeStyle = OUTLINE; g.stroke(p);
    const str = String(text).toUpperCase();
    g.font = `400 ${str.length > 9 ? 9 : 11}px "Lilita One", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(str, 0, 25.5, 76);
  },

  topPiece(g, kind, col, lw) {
    if (kind === 'crown') {
      g.save(); g.translate(0, -66); g.scale(0.52, 0.42); this.emblem(g, 'crown', 0, 0, 64, col, lw / 0.47); g.restore();
    } else if (kind === 'stars3') {
      for (const x of [-15, 0, 15]) this.star(g, x, -58, 6.5, col, OUTLINE, lw * 0.6);
    } else if (kind === 'star') {
      this.star(g, 0, -60, 9, col, OUTLINE, lw * 0.7);
    }
  },

  star(g, x, y, r, fill, ink, lw) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = fill; g.fill();
    if (ink) { g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); }
  },

  // ---- the emblems: drawn in their own 0..100 box, `size` units wide, centred on (x, y) ----
  emblem(g, name, x, y, size, col, lw) {
    const k = size / 100;
    g.save();
    g.translate(x - size / 2, y - size / 2); g.scale(k, k);
    // outline width in the emblem's own units: in proportion to the emblem, so a small one on a disc
    // is not swallowed by its own outlines
    const L = clamp(lw / k * 0.55, 2.2, 5);
    const alt = shadeHex(col, colorLum(col) > 0.6 ? -0.22 : 0.32);
    const dark = shadeHex(col, -0.3);
    const P = (d) => this.path(d);
    const ink = OUTLINE;
    const fs = (p, c) => { g.fillStyle = c; g.fill(p); g.lineWidth = L; g.strokeStyle = ink; g.stroke(p); };
    const dot = (cx, cy, r, c) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = c; g.fill(); };
    const ring = (cx, cy, r, c) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = c; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke(); };
    const line = (d, w, c) => { g.lineWidth = w; g.strokeStyle = c; g.stroke(P(d)); };
    const thick = (d, w, c) => { line(d, w + L * 2, ink); line(d, w, c); };
    switch (name) {
      case 'lion': {
        // a lion's head, face on: a spiky mane, round face, ears, eyes, nose and whiskered muzzle
        g.beginPath();
        for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = i % 2 ? 37 : 48; g.lineTo(50 + Math.cos(a) * r, 52 + Math.sin(a) * r); }
        g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
        ring(32, 32, 8, alt); ring(68, 32, 8, alt);
        g.beginPath(); g.ellipse(50, 56, 26, 27, 0, 0, Math.PI * 2); g.fillStyle = alt; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
        g.beginPath(); g.ellipse(50, 68, 14, 10, 0, 0, Math.PI * 2); g.fillStyle = shadeHex(alt, 0.25); g.fill(); g.lineWidth = L * 0.8; g.stroke();
        dot(40, 50, 4.2, ink); dot(60, 50, 4.2, ink); dot(41.3, 48.6, 1.4, '#ffffff'); dot(61.3, 48.6, 1.4, '#ffffff');
        fs(P('M43 59 L57 59 L50 66 Z'), ink);
        line('M50 66 L50 71 M50 71 Q45 76 40 72 M50 71 Q55 76 60 72', L * 0.9, ink);
        line('M34 44 Q40 40 46 43 M66 44 Q60 40 54 43', L * 0.9, ink);
        break;
      }
      case 'eagle': {
        // wings spread, head turned, a fanned tail
        const wing = 'M42 38 L30 30 L14 18 L5 27 L13 31 L3 39 L13 42 L4 50 L17 50 L10 59 L26 55 L40 52 Z';
        fs(P(wing), col);
        g.save(); g.translate(100, 0); g.scale(-1, 1); fs(P(wing), col); g.restore();
        line('M30 34 L22 44 M36 40 L26 52', L * 0.7, dark);
        line('M70 34 L78 44 M64 40 L74 52', L * 0.7, dark);
        fs(P('M42 30 C37 40 37 56 42 66 L35 84 L44 80 L50 92 L56 80 L65 84 L58 66 C63 56 63 40 58 30 Z'), col);
        line('M44 74 L50 78 L56 74', L * 0.7, dark);
        ring(53, 23, 10, col);
        fs(P('M61 19 L74 24 L61 29 Z'), '#ffc21a');
        dot(55, 21, 2.6, ink);
        line('M44 66 L40 72 M56 66 L60 72', L, ink);
        break;
      }
      case 'wolf': {
        // a wolf's head in profile, ears up, looking left
        fs(P('M68 32 L66 10 L56 30 Z'), dark);
        fs(P('M80 86 L74 60 L82 38 L78 12 L64 30 L50 28 L36 34 L22 44 L8 50 L11 58 L26 61 L34 67 L40 86 Z'), col);
        fs(P('M78 16 L72 34 L66 30 Z'), alt);
        dot(45, 43, 3.6, ink); dot(46, 42, 1.2, '#ffffff');
        dot(9, 52, 3.4, ink);
        line('M13 58 L30 59', L * 0.9, ink);
        line('M58 50 L72 46 M60 58 L74 56', L * 0.7, dark);
        break;
      }
      case 'bear': {
        // a bear on its hind legs reaching up into a fruit tree (the city's old arms)
        fs(P('M75 92 L75 52 L81 52 L81 92 Z'), '#8b5a2b');
        ring(78, 36, 19, '#3fcf4a');
        for (const [fx, fy] of [[70, 30], [84, 28], [78, 42], [88, 40], [72, 44]]) ring(fx, fy, 2.6, '#ff3a3f');
        fs(P('M14 92 L18 72 C10 66 8 54 12 44 C14 36 20 30 28 30 L30 22 C30 16 36 12 42 14 L46 10 L48 16 C54 18 56 24 54 30 L60 32 L68 22 L74 26 L66 40 L56 44 C58 54 56 64 50 72 L52 92 L42 92 L40 76 L28 78 L26 92 Z'), col);
        dot(46, 22, 2.8, ink); dot(56, 27, 2.6, ink);
        line('M24 54 Q34 50 40 56', L * 0.7, dark);
        break;
      }
      case 'bull': {
        // a bull's head, horns up
        fs(P('M36 36 C24 36 12 30 8 14 C18 22 30 25 40 27 Z'), '#f4f1e6');
        fs(P('M64 36 C76 36 88 30 92 14 C82 22 70 25 60 27 Z'), '#f4f1e6');
        fs(P('M30 40 L14 38 L26 50 Z'), dark); fs(P('M70 40 L86 38 L74 50 Z'), dark);
        fs(P('M33 30 C40 26 60 26 67 30 L65 60 C63 72 58 84 50 86 C42 84 37 72 35 60 Z'), col);
        g.beginPath(); g.ellipse(50, 77, 13, 9, 0, 0, Math.PI * 2); g.fillStyle = alt; g.fill(); g.lineWidth = L * 0.8; g.strokeStyle = ink; g.stroke();
        dot(45, 77, 2.6, ink); dot(55, 77, 2.6, ink);
        dot(41, 48, 3.6, ink); dot(59, 48, 3.6, ink);
        line('M44 30 L50 40 L56 30', L * 0.9, ink);
        break;
      }
      case 'snake': {
        // a serpent coiled into an S, head up, tongue out
        thick('M26 90 C80 88 82 62 52 56 C24 50 22 28 58 24', 14, col);
        line('M30 86 C72 84 74 66 52 60 M48 52 C30 46 30 32 54 28', 2.6, alt);
        g.save(); g.translate(64, 22); g.rotate(-0.25);
        g.beginPath(); g.ellipse(0, 0, 12, 8.5, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
        g.restore();
        dot(66, 19, 2.6, ink);
        line('M75 18 L86 12 M75 18 L86 22', L * 0.9, '#ff3a3f');
        break;
      }
      case 'dragon': {
        // a winged dragon, breathing fire
        fs(P('M50 42 L56 10 L64 26 L72 8 L77 30 L88 22 L84 46 Z'), dark);
        line('M56 14 L60 40 M72 12 L72 40', L * 0.7, ink);
        fs(P('M22 30 C28 22 38 22 42 28 L54 30 C64 34 68 46 66 58 C72 62 80 70 92 74 C82 79 70 75 62 69 C58 77 52 83 46 87 L42 77 L36 85 L34 71 C40 63 42 53 38 45 L30 43 C24 43 20 37 22 30 Z'), col);
        fs(P('M30 24 L33 14 L37 24 Z'), alt);
        fs(P('M21 36 L4 31 L10 38 L2 44 L20 41 Z'), '#ff8a1f');
        dot(30, 30, 2.8, ink);
        line('M46 46 L52 50 M48 56 L56 58 M50 66 L58 66', L * 0.6, alt);
        break;
      }
      case 'bird': {
        // a small bird on its feet: the canary, the magpie, the liver bird's cousin
        fs(P('M20 66 C20 50 32 40 46 40 C48 30 56 24 64 26 C72 28 76 34 74 40 L86 44 L74 48 C74 60 66 70 54 74 L60 88 L54 88 L48 76 L42 88 L36 88 L40 74 C32 74 22 74 20 66 Z'), col);
        fs(P('M30 52 C42 46 56 50 60 58 C50 66 36 64 26 58 Z'), dark);
        fs(P('M74 40 L88 44 L74 48 Z'), '#ff8a1f');
        ring(64, 34, 4.4, '#ffffff'); dot(65, 34, 2.2, ink);
        line('M34 58 L50 58 M36 63 L50 62', L * 0.6, alt);
        break;
      }
      case 'cockerel': {
        // a cockerel standing on a ball
        fs(P('M64 72 C46 74 32 64 30 50 C28 42 32 34 38 30 L34 22 C34 16 40 12 46 16 L48 10 L52 16 L56 12 L56 20 C60 24 60 30 56 34 C60 42 66 46 72 46 C78 34 84 28 90 24 C92 40 90 54 82 62 C78 68 72 72 64 72 Z'), col);
        fs(P('M38 16 L40 6 L45 12 L49 4 L52 12 L57 8 L55 19 Z'), '#ff3a3f');
        fs(P('M34 25 L23 29 L34 31 Z'), '#ff8a1f');
        g.beginPath(); g.ellipse(34, 35, 3, 4.5, 0, 0, Math.PI * 2); g.fillStyle = '#ff3a3f'; g.fill();
        dot(40, 23, 2.6, ink);
        line('M78 34 C80 44 80 52 76 58 M84 32 C88 42 86 52 82 58', L * 0.8, dark);
        line('M50 72 L48 78 M58 72 L60 78', L, ink);
        ring(54, 87, 10, '#ffffff');
        fs(P('M50 84 L54 81 L58 84 L57 89 L51 89 Z'), ink);
        break;
      }
      case 'castle': {
        fs(P('M12 88 L12 40 L8 40 L8 26 L15 26 L15 32 L21 32 L21 26 L28 26 L28 40 L36 40 L36 32 L42 32 L42 40 L58 40 L58 32 L64 32 L64 40 L72 40 L72 26 L79 26 L79 32 L85 32 L85 26 L92 26 L92 40 L88 40 L88 88 Z'), col);
        fs(P('M40 88 L40 70 C40 62 60 62 60 70 L60 88 Z'), ink);
        line('M42 70 L58 70 M42 76 L58 76 M42 82 L58 82', 1.2, dark);
        fs(P('M17 48 L23 48 L23 58 L17 58 Z'), ink); fs(P('M77 48 L83 48 L83 58 L77 58 Z'), ink);
        line('M12 64 L36 64 M64 64 L88 64 M28 52 L36 52 M64 52 L72 52', L * 0.6, dark);
        fs(P('M50 40 L50 12 L66 18 L50 24'), '#ff3a3f');
        line('M50 40 L50 12', L, ink);
        break;
      }
      case 'ship': {
        // a sailing ship on the waves
        line('M32 14 L32 62 M52 8 L52 62 M70 16 L70 62', L * 1.3, ink);
        fs(P('M22 20 Q32 26 42 20 L42 54 Q32 58 22 54 Z'), '#ffffff');
        fs(P('M40 14 Q52 20 64 14 L64 56 Q52 60 40 56 Z'), '#ffffff');
        fs(P('M62 22 Q70 26 80 22 L80 52 Q70 56 62 52 Z'), '#ffffff');
        fs(P('M52 8 L64 11 L52 14 Z'), '#ff3a3f');
        fs(P('M6 60 L94 60 L84 78 C70 84 30 84 16 78 Z'), col);
        line('M14 68 L86 68', L * 0.7, dark);
        for (const px of [30, 44, 58, 72]) ring(px, 73, 2.6, alt);
        thick('M6 90 Q14 84 22 90 T38 90 T54 90 T70 90 T86 90 T98 90', 3, '#46d9ff');
        break;
      }
      case 'cannon': {
        // a cannon on its carriage, cannonballs stacked by it
        fs(P('M14 60 L74 36 C80 33 87 37 87 44 C87 51 82 55 76 55 L20 72 Z'), col);
        g.save(); g.translate(81, 45); g.rotate(-0.38); g.beginPath(); g.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2); g.fillStyle = dark; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke(); g.restore();
        line('M30 56 L32 64 M48 49 L50 58', L * 0.8, dark);
        ring(36, 70, 15, dark);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; line(`M36 70 L${36 + Math.cos(a) * 13} ${70 + Math.sin(a) * 13}`, L * 0.7, ink); }
        ring(36, 70, 4, col);
        for (const [bx, by] of [[66, 86], [78, 86], [72, 76]]) ring(bx, by, 6, ink);
        break;
      }
      case 'lily': {
        // the lily (fleur-de-lis)
        fs(P('M50 8 C60 20 62 36 54 50 L54 56 C64 46 80 44 89 52 C80 54 74 60 72 68 L58 64 L56 76 L66 76 L66 82 L54 82 L50 93 L46 82 L34 82 L34 76 L44 76 L42 64 L28 68 C26 60 20 54 11 52 C20 44 36 46 46 56 L46 50 C38 36 40 20 50 8 Z'), col);
        fs(P('M30 58 L70 58 L70 66 L30 66 Z'), col);
        line('M50 20 C46 32 46 42 50 50', L * 0.6, alt);
        break;
      }
      case 'crown': {
        fs(P('M14 72 L10 32 L30 52 L40 22 L50 46 L60 22 L70 52 L90 32 L86 72 Z'), col);
        fs(P('M14 70 L86 70 L86 84 L14 84 Z'), col);
        for (const [px, py] of [[10, 32], [40, 22], [60, 22], [90, 32]]) ring(px, py, 5, '#ffffff');
        ring(30, 77, 4, '#ff3a3f'); ring(50, 77, 4.6, '#2f7bff'); ring(70, 77, 4, '#ff3a3f');
        line('M24 62 L76 62', L * 0.7, dark);
        fs(P('M47 8 L53 8 L53 13 L58 13 L58 19 L53 19 L53 26 L47 26 L47 19 L42 19 L42 13 L47 13 Z'), col);
        break;
      }
      case 'tower': {
        // a tall iron tower
        fs(P('M50 6 L55 28 L61 28 L63 46 L71 46 L84 92 L64 92 C62 80 58 73 50 73 C42 73 38 80 36 92 L16 92 L29 46 L37 46 L39 28 L45 28 Z'), col);
        line('M39 46 L61 46 M41 34 L59 34 M33 62 L67 62', L * 0.8, ink);
        line('M44 50 L56 60 M56 50 L44 60 M42 36 L58 44 M58 36 L42 44', L * 0.5, dark);
        dot(50, 6, 2.5, ink);
        break;
      }
      case 'crosses3': {
        // three crosses one above the other (the city's own arms)
        for (const cy of [22, 50, 78]) { thick(`M38 ${cy - 10} L62 ${cy + 10} M62 ${cy - 10} L38 ${cy + 10}`, 8, col); }
        break;
      }
      case 'shamrock': {
        const leaf = (cx, cy, a) => {
          g.save(); g.translate(cx, cy); g.rotate(a);
          fs(P('M0 14 C-22 2 -20 -18 -8 -18 C-3 -18 0 -14 0 -10 C0 -14 3 -18 8 -18 C20 -18 22 2 0 14 Z'), col);
          line('M0 12 L0 -8', L * 0.6, alt);
          g.restore();
        };
        thick('M50 56 C52 70 56 80 64 90', 5, col);
        leaf(50, 32, 0); leaf(31, 55, -2.2); leaf(69, 55, 2.2);
        break;
      }
      case 'hammers': {
        // two hammers crossed
        for (const s of [-1, 1]) {
          g.save(); g.translate(50, 54); g.rotate(s * 0.7);
          fs(P('M-4 -30 L4 -30 L4 40 L-4 40 Z'), '#c8a46a');
          fs(P('M-16 -42 L16 -42 L16 -26 L-16 -26 Z'), col);
          line('M-12 -34 L12 -34', L * 0.6, alt);
          g.restore();
        }
        break;
      }
      case 'submarine': {
        thick('M50 36 L50 20 L62 20', 3, col);
        fs(P('M38 34 L60 34 L58 50 L40 50 Z'), col);
        g.beginPath(); g.ellipse(50, 62, 42, 14, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
        line('M14 62 L86 62', L * 0.5, dark);
        for (const px of [28, 42, 56, 70]) ring(px, 58, 3.6, alt);
        fs(P('M6 54 L10 62 L6 70 L2 62 Z'), dark);
        for (const [bx, by, r] of [[88, 44, 3], [92, 34, 2.2], [86, 26, 1.6]]) ring(bx, by, r, '#ffffff');
        break;
      }
      case 'star': {
        this.star(g, 50, 52, 46, col, ink, L);
        // facets: one side of each point a shade darker
        g.fillStyle = dark;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, b = a + Math.PI / 5;
          g.beginPath(); g.moveTo(50, 52); g.lineTo(50 + Math.cos(a) * 46, 52 + Math.sin(a) * 46); g.lineTo(50 + Math.cos(b) * 20.7, 52 + Math.sin(b) * 20.7); g.closePath(); g.fill();
        }
        this.star(g, 50, 52, 46, 'rgba(0,0,0,0)', ink, L);
        break;
      }
      case 'ball': {
        ring(50, 50, 42, '#ffffff');
        g.save(); g.beginPath(); g.arc(50, 50, 42, 0, Math.PI * 2); g.clip();
        const pent = (cx, cy, r, rot) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + (i * Math.PI * 2) / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fillStyle = ink; g.fill(); };
        pent(50, 50, 14, -Math.PI / 2);
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + Math.PI / 5 + (i * Math.PI * 2) / 5; pent(50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40, 12, a + Math.PI); line(`M${50 + Math.cos(a) * 14} ${50 + Math.sin(a) * 14} L${50 + Math.cos(a) * 30} ${50 + Math.sin(a) * 30}`, L * 0.6, ink); }
        g.restore();
        g.beginPath(); g.arc(50, 50, 42, 0, Math.PI * 2); g.lineWidth = L; g.strokeStyle = ink; g.stroke();
        break;
      }
      case 'bolt': {
        fs(P('M58 4 L22 54 L46 54 L36 96 L80 38 L54 38 L68 4 Z'), col);
        line('M56 10 L34 48', L * 0.6, alt);
        break;
      }
      case 'volcano': {
        // a volcano smoking over the bay
        for (const [sx, sy, r] of [[46, 18, 8], [57, 10, 7], [66, 18, 6], [38, 10, 5]]) ring(sx, sy, r, '#e8ebf2');
        fs(P('M4 86 L34 34 L44 40 L56 40 L66 34 L96 86 Z'), col);
        fs(P('M34 34 L44 40 L56 40 L66 34 L58 30 L42 30 Z'), '#ff5a1f');
        fs(P('M44 40 L41 58 L47 52 L49 64 L53 50 L56 40 Z'), '#ff8a1f');
        line('M20 70 L32 62 M70 64 L84 74', L * 0.6, dark);
        thick('M2 92 Q12 86 22 92 T42 92 T62 92 T82 92 T100 92', 2.6, '#46d9ff');
        break;
      }
      case 'trident': {
        fs(P('M50 4 L57 17 L54 17 L54 34 L65 34 L65 16 L72 9 L72 38 C72 42 68 45 64 45 L54 45 L54 94 L46 94 L46 45 L36 45 C32 45 28 42 28 38 L28 9 L35 16 L35 34 L46 34 L46 17 L43 17 Z'), col);
        line('M50 50 L50 90', L * 0.5, alt);
        break;
      }
      case 'anchor': {
        g.beginPath(); g.arc(50, 13, 8, 0, Math.PI * 2); g.lineWidth = 5 + L * 2; g.strokeStyle = ink; g.stroke(); g.lineWidth = 5; g.strokeStyle = col; g.stroke();
        fs(P('M46 21 L54 21 L54 80 L46 80 Z'), col);
        fs(P('M30 27 L70 27 L70 34 L30 34 Z'), col);
        fs(P('M10 56 L20 50 C22 68 34 78 50 78 C66 78 78 68 80 50 L90 56 L84 42 L74 50 C72 62 62 70 50 70 C38 70 28 62 26 50 L16 42 Z'), col);
        break;
      }
      case 'laurel': {
        // a laurel wreath round a star
        for (const s of [-1, 1]) {
          for (let i = 0; i < 7; i++) {
            const a = Math.PI / 2 + s * (0.35 + i * 0.36), px = 50 + Math.cos(a) * 36, py = 54 + Math.sin(a) * 36;
            g.save(); g.translate(px, py); g.rotate(a + (s > 0 ? -Math.PI / 2 : Math.PI / 2) + s * 0.5);
            g.beginPath(); g.ellipse(0, 0, 9, 4.6, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = L * 0.8; g.strokeStyle = ink; g.stroke();
            g.restore();
          }
        }
        this.star(g, 50, 52, 17, col, ink, L);
        thick('M38 88 L50 82 L62 88', 4, '#ff3a3f');
        break;
      }
      case 'dog': {
        // a big friendly guard dog's head
        fs(P('M24 34 L8 44 L16 64 L28 50 Z'), dark); fs(P('M76 34 L92 44 L84 64 L72 50 Z'), dark);
        fs(P('M24 40 C24 26 36 18 50 18 C64 18 76 26 76 40 L78 58 C78 74 66 86 50 86 C34 86 22 74 22 58 Z'), col);
        g.beginPath(); g.ellipse(50, 67, 18, 14, 0, 0, Math.PI * 2); g.fillStyle = alt; g.fill(); g.lineWidth = L * 0.8; g.strokeStyle = ink; g.stroke();
        g.beginPath(); g.ellipse(50, 58, 7.5, 5, 0, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
        dot(40, 44, 4, ink); dot(60, 44, 4, ink); dot(41.2, 42.8, 1.3, '#ffffff'); dot(61.2, 42.8, 1.3, '#ffffff');
        line('M50 63 L50 70 M40 72 Q50 79 60 72', L * 0.9, ink);
        line('M34 36 Q40 33 46 37 M66 36 Q60 33 54 37', L * 0.8, ink);
        break;
      }
      case 'peak': {
        fs(P('M2 86 L30 40 L42 56 L60 22 L98 86 Z'), col);
        fs(P('M60 22 L51 38 L57 35 L62 41 L69 35 Z'), '#ffffff');
        fs(P('M30 40 L23 52 L29 49 L33 53 L37 48 Z'), '#ffffff');
        line('M44 70 L56 60 M66 74 L76 64', L * 0.6, dark);
        break;
      }
      case 'checkshield': {
        // a small shield of red and white squares
        const sh = P('M18 14 L82 14 L82 52 C80 72 66 84 50 92 C34 84 20 72 18 52 Z');
        g.save(); g.clip(sh);
        const q = 64 / 5;
        for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) { g.fillStyle = (r + c) % 2 ? '#ffffff' : '#e30613'; g.fillRect(18 + c * q, 14 + r * q, q + 0.3, q + 0.3); }
        g.restore();
        g.lineWidth = L; g.strokeStyle = ink; g.stroke(sh);
        break;
      }
      case 'wave': {
        thick('M6 46 C20 30 34 30 40 42 C46 54 58 52 62 42 C68 28 86 28 94 44', 9, col);
        thick('M6 70 C20 54 34 54 40 66 C46 78 58 76 62 66 C68 52 86 52 94 68', 9, col);
        line('M24 38 C30 34 34 36 36 40 M70 36 C76 32 82 34 86 40', 2, '#ffffff');
        break;
      }
    }
    g.restore();
  },
};
