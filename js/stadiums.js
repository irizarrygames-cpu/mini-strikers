// Every country plays at home.
//
// A ground is not something you buy any more: it belongs to the country you play for. It is built
// from four things — the climate it sits in (sky, grass, weather, what the fans wear), the team's
// own colours (the stands and the trim), how the pitch is mown, and the view over the top of the
// stand, which is a different place in every country.
//
// Loads in the browser and on the server (nothing here touches the DOM at load time).

// ---------------------------------------------------------------- climates
// The eight skies a ground can sit under. grass/apron/tuft/weather are the old stadium palettes,
// which were already tuned; `sky` and `hats` are new and feed the shootout backdrop.
const STADIUM_KINDS = {
  day: {
    grass: [['#5acb45', '#55c541'], ['#4fbd3b', '#4bb838']], stands: ['#34439a', '#3a4aa0'],
    apron: '#8fa0c8', tuft: '#3f9f31', pattern: 'checks', weather: 'clouds',
    sky: ['#5fb8ff', '#b5e3ff'], far: '#3d6fa8', hats: 'day',
  },
  dusk: {
    grass: [['#6cc443', '#66bd3f'], ['#5fb43a', '#5aae36']], stands: ['#7a3b78', '#86427f'],
    apron: '#e0a07a', tuft: '#4a9a2e', pattern: 'stripes', weather: 'sunset',
    sky: ['#ff8a4a', '#ffdf9a'], far: '#7a3357', hats: 'sunset',
  },
  night: {
    grass: [['#3fbf5a', '#3ab755'], ['#34ad4f', '#30a64a']], stands: ['#1d2552', '#232c5e'],
    apron: '#4a5680', tuft: '#2a8a3e', pattern: 'checks', weather: 'night', lights: true,
    sky: ['#0d1430', '#2b3c72'], far: '#5564a8', hats: 'night', stars: true,
  },
  rain: {
    grass: [['#2f9247', '#2b8b43'], ['#28833e', '#247c3a']], stands: ['#3b4252', '#434b5c'],
    apron: '#5b6475', tuft: '#1f6b33', pattern: 'stripes', weather: 'rain',
    sky: ['#6b7484', '#b3bccc'], far: '#434c5e', hats: 'rain',
  },
  desert: {
    grass: [['#a8b356', '#a2ad51'], ['#9aa54c', '#949f47']], stands: ['#a0522d', '#ad5d36'],
    apron: '#e8c98a', tuft: '#7e8a34', pattern: 'hstripes', weather: 'dust',
    sky: ['#efb45e', '#ffeec0'], far: '#9c5f2b', hats: 'desert',
  },
  snow: {
    grass: [['#8fcf8a', '#89c984'], ['#80c07c', '#7bbb77']], stands: ['#c9d8e8', '#d6e3f0'],
    apron: '#f1f6fb', tuft: '#ffffff', pattern: 'checks', weather: 'snow',
    sky: ['#bcd4ec', '#f2f8ff'], far: '#7e95b2', hats: 'snow',
  },
  royal: {
    grass: [['#4cc46a', '#47be65'], ['#41b55e', '#3daf59']], stands: ['#7a1f2b', '#8a2633'],
    apron: '#d9b24a', tuft: '#2f8f45', pattern: 'diamond', weather: 'royal',
    sky: ['#86b2e6', '#dfeaf9'], far: '#3f5486', hats: 'royal',
  },
  neon: {
    grass: [['#1f6b5a', '#1c6454'], ['#195c4e', '#175648']], stands: ['#2a0f4a', '#34145a'],
    apron: '#c92ba8', tuft: '#39ff88', pattern: 'grid', weather: 'neon', lights: true,
    sky: ['#140a2e', '#4b1f7a'], far: '#8a3fd8', hats: 'neon', stars: true,
  },
};

// ---------------------------------------------------------------- the view over the stand
// Each one draws a flat silhouette between x0..x1, standing on `base`, no taller than `h`.
// Two tones and a thick outline, like everything else in the game.
const STADIUM_MOTIFS = {
  obelisk(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.13;
    g.beginPath(); g.moveTo(cx - w, base); g.lineTo(cx - w * 0.6, base - h * 0.86); g.lineTo(cx, base - h); g.lineTo(cx + w * 0.6, base - h * 0.86); g.lineTo(cx + w, base); g.closePath();
    g.fillStyle = c.body; g.fill(); g.stroke();
    for (const s of [-1, 1]) { const bx = cx + s * h * 0.55; g.fillStyle = c.far; g.fillRect(bx - h * 0.16, base - h * 0.3, h * 0.32, h * 0.3); g.strokeRect(bx - h * 0.16, base - h * 0.3, h * 0.32, h * 0.3); }
  },
  spires(g, x0, x1, base, h, c) {
    const n = 5, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (i + 0.5), hh = h * (i % 2 ? 0.62 : 0.95), bw = w * 0.2;
      g.beginPath(); g.moveTo(cx - bw, base); g.lineTo(cx - bw, base - hh * 0.55); g.lineTo(cx, base - hh); g.lineTo(cx + bw, base - hh * 0.55); g.lineTo(cx + bw, base); g.closePath();
      g.fillStyle = i % 2 ? c.far : c.body; g.fill(); g.stroke();
    }
  },
  lattice(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.42;
    g.beginPath(); g.moveTo(cx - w, base); g.lineTo(cx - w * 0.22, base - h * 0.62); g.lineTo(cx - w * 0.1, base - h); g.lineTo(cx + w * 0.1, base - h); g.lineTo(cx + w * 0.22, base - h * 0.62); g.lineTo(cx + w, base); g.closePath();
    g.fillStyle = c.body; g.fill(); g.stroke();
    g.lineWidth = Math.max(1.5, h * 0.03); g.strokeStyle = c.far;
    g.beginPath(); g.moveTo(cx - w * 0.72, base - h * 0.22); g.lineTo(cx + w * 0.72, base - h * 0.22); g.moveTo(cx - w * 0.3, base - h * 0.55); g.lineTo(cx + w * 0.3, base - h * 0.55); g.stroke();
    g.strokeStyle = c.ink; g.lineWidth = c.lw;
  },
  clock(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.17;
    g.fillStyle = c.body; g.fillRect(cx - w, base - h * 0.86, w * 2, h * 0.86); g.strokeRect(cx - w, base - h * 0.86, w * 2, h * 0.86);
    g.beginPath(); g.moveTo(cx - w * 1.1, base - h * 0.86); g.lineTo(cx, base - h); g.lineTo(cx + w * 1.1, base - h * 0.86); g.closePath(); g.fillStyle = c.far; g.fill(); g.stroke();
    g.beginPath(); g.arc(cx, base - h * 0.62, w * 0.55, 0, Math.PI * 2); g.fillStyle = '#ffe9a8'; g.fill(); g.stroke();
    g.fillStyle = c.far; g.fillRect(x0, base - h * 0.3, (x1 - x0) * 0.3, h * 0.3); g.strokeRect(x0, base - h * 0.3, (x1 - x0) * 0.3, h * 0.3);
  },
  statue(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2;
    g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(cx - h * 0.1, base - h * 0.62, cx, base - h * 0.6); g.quadraticCurveTo(cx + h * 0.5, base - h * 0.5, x1, base); g.closePath();
    g.fillStyle = c.far; g.fill(); g.stroke();
    g.fillStyle = c.body;
    g.fillRect(cx - h * 0.035, base - h * 0.95, h * 0.07, h * 0.3); g.strokeRect(cx - h * 0.035, base - h * 0.95, h * 0.07, h * 0.3);
    g.fillRect(cx - h * 0.2, base - h * 0.93, h * 0.4, h * 0.05); g.strokeRect(cx - h * 0.2, base - h * 0.93, h * 0.4, h * 0.05);
    g.beginPath(); g.arc(cx, base - h * 0.99, h * 0.045, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  bridge(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.lineWidth = Math.max(2, h * 0.05); g.strokeStyle = c.body;
    g.beginPath(); g.moveTo(x0, base - h * 0.2); g.quadraticCurveTo(x0 + w / 2, base - h * 0.95, x1, base - h * 0.2); g.stroke();
    g.strokeStyle = c.ink; g.lineWidth = c.lw;
    for (const s of [0.26, 0.74]) { const bx = x0 + w * s; g.fillStyle = c.body; g.fillRect(bx - h * 0.05, base - h * 0.9, h * 0.1, h * 0.9); g.strokeRect(bx - h * 0.05, base - h * 0.9, h * 0.1, h * 0.9); }
    g.fillStyle = c.far; g.fillRect(x0, base - h * 0.18, w, h * 0.1); g.strokeRect(x0, base - h * 0.18, w, h * 0.1);
  },
  windmills(g, x0, x1, base, h, c) {
    const n = 3, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (i + 0.5), hh = h * (i === 1 ? 0.8 : 0.6), bw = hh * 0.16;
      g.beginPath(); g.moveTo(cx - bw, base); g.lineTo(cx - bw * 0.5, base - hh); g.lineTo(cx + bw * 0.5, base - hh); g.lineTo(cx + bw, base); g.closePath();
      g.fillStyle = c.body; g.fill(); g.stroke();
      g.lineWidth = Math.max(2, h * 0.035); g.strokeStyle = c.far;
      for (let a = 0; a < 4; a++) { const an = (a * Math.PI) / 2 + i; g.beginPath(); g.moveTo(cx, base - hh); g.lineTo(cx + Math.cos(an) * hh * 0.42, base - hh + Math.sin(an) * hh * 0.42); g.stroke(); }
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
    }
  },
  spheres(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, r = h * 0.13;
    g.lineWidth = Math.max(2, h * 0.035); g.strokeStyle = c.far;
    g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, base - h * 0.8); g.moveTo(cx - h * 0.3, base - h * 0.45); g.lineTo(cx + h * 0.3, base - h * 0.45); g.stroke();
    g.strokeStyle = c.ink; g.lineWidth = c.lw;
    for (const [dx, dy] of [[0, -0.86], [-0.3, -0.45], [0.3, -0.45], [-0.17, -0.18], [0.17, -0.18]]) {
      g.beginPath(); g.arc(cx + dx * h, base + dy * h, r, 0, Math.PI * 2); g.fillStyle = c.body; g.fill(); g.stroke();
    }
  },
  arches(g, x0, x1, base, h, c) {
    const w = x1 - x0, aw = w / 7;
    g.fillStyle = c.body; g.beginPath(); g.rect(x0 + aw * 0.5, base - h * 0.8, w - aw, h * 0.8); g.fill(); g.stroke();
    g.fillStyle = c.far;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
      const ax = x0 + aw * (i + 0.8), ay = base - h * (0.72 - r * 0.36);
      g.beginPath(); g.arc(ax + aw * 0.3, ay, aw * 0.28, Math.PI, 0); g.lineTo(ax + aw * 0.58, ay + h * 0.22); g.lineTo(ax + aw * 0.02, ay + h * 0.22); g.closePath(); g.fill();
    }
  },
  gate(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.55;
    g.fillStyle = c.body;
    g.fillRect(cx - w, base - h * 0.62, h * 0.1, h * 0.62); g.strokeRect(cx - w, base - h * 0.62, h * 0.1, h * 0.62);
    g.fillRect(cx + w - h * 0.1, base - h * 0.62, h * 0.1, h * 0.62); g.strokeRect(cx + w - h * 0.1, base - h * 0.62, h * 0.1, h * 0.62);
    g.beginPath(); g.moveTo(cx - w * 1.25, base - h * 0.62); g.lineTo(cx + w * 1.25, base - h * 0.62); g.lineTo(cx + w * 1.05, base - h * 0.78); g.lineTo(cx - w * 1.05, base - h * 0.78); g.closePath();
    g.fillStyle = c.far; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - w, base - h * 0.78); g.lineTo(cx + w, base - h * 0.78); g.lineTo(cx + w * 0.8, base - h * 0.94); g.lineTo(cx - w * 0.8, base - h * 0.94); g.closePath();
    g.fillStyle = c.body; g.fill(); g.stroke();
  },
  coast(g, x0, x1, base, h, c) {
    g.fillStyle = c.far;
    g.beginPath(); g.moveTo(x0, base); g.lineTo(x0 + (x1 - x0) * 0.18, base - h * 0.55); g.lineTo(x0 + (x1 - x0) * 0.34, base); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x0 + (x1 - x0) * 0.56, base); g.lineTo(x0 + (x1 - x0) * 0.72, base - h * 0.78); g.lineTo(x0 + (x1 - x0) * 0.9, base); g.closePath();
    g.fillStyle = c.body; g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) { const x = x0 + (x1 - x0) * (0.1 + i * 0.2); g.fillRect(x, base - h * 0.12, h * 0.16, h * 0.12); }
  },
  dunes(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (const [s, hh, col] of [[0.0, 0.5, c.far], [0.45, 0.72, c.body], [0.75, 0.4, c.far]]) {
      g.beginPath(); g.moveTo(x0 + w * s - w * 0.2, base);
      g.quadraticCurveTo(x0 + w * (s + 0.12), base - h * hh, x0 + w * (s + 0.4), base);
      g.closePath(); g.fillStyle = col; g.fill(); g.stroke();
    }
  },
  andes(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.far; g.beginPath(); g.moveTo(x0, base);
    for (let i = 0; i <= 6; i++) g.lineTo(x0 + (w / 6) * i, base - h * (i % 2 ? 0.55 : 0.3));
    g.lineTo(x1, base); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c.body; g.beginPath(); g.moveTo(x0 + w * 0.25, base);
    g.lineTo(x0 + w * 0.45, base - h * 0.95); g.lineTo(x0 + w * 0.68, base); g.closePath(); g.fill(); g.stroke();
  },
  lighthouse(g, x0, x1, base, h, c) {
    const cx = x0 + (x1 - x0) * 0.68, w = h * 0.12;
    g.fillStyle = c.far; g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + (x1 - x0) * 0.3, base - h * 0.3, x1, base); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - w, base); g.lineTo(cx - w * 0.6, base - h * 0.78); g.lineTo(cx + w * 0.6, base - h * 0.78); g.lineTo(cx + w, base); g.closePath();
    g.fillStyle = '#ffffff'; g.fill(); g.stroke();
    g.fillStyle = c.body; g.fillRect(cx - w * 0.8, base - h * 0.52, w * 1.6, h * 0.16);
    g.fillStyle = '#ffe14d'; g.fillRect(cx - w * 0.7, base - h * 0.92, w * 1.4, h * 0.14); g.strokeRect(cx - w * 0.7, base - h * 0.92, w * 1.4, h * 0.14);
  },
  skyline(g, x0, x1, base, h, c) {
    const w = x1 - x0, n = 9;
    const hs = [0.55, 0.85, 0.42, 0.7, 1, 0.5, 0.78, 0.38, 0.62];
    for (let i = 0; i < n; i++) {
      const bw = w / n, bx = x0 + bw * i, hh = h * hs[i];
      g.fillStyle = i % 2 ? c.far : c.body;
      g.fillRect(bx, base - hh, bw * 0.92, hh); g.strokeRect(bx, base - hh, bw * 0.92, hh);
      g.fillStyle = '#ffe9a8';
      for (let r = 0; r < Math.floor(hh / (h * 0.16)); r++) for (let q = 0; q < 2; q++) g.fillRect(bx + bw * (0.18 + q * 0.4), base - hh + h * 0.07 + r * h * 0.16, bw * 0.2, h * 0.06);
    }
  },
  temple(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.95, steps = 4;
    for (let i = 0; i < steps; i++) {
      const sw = w * (1 - i * 0.2), sh = h / steps;
      g.fillStyle = i % 2 ? c.far : c.body;
      g.fillRect(cx - sw / 2, base - sh * (i + 1), sw, sh); g.strokeRect(cx - sw / 2, base - sh * (i + 1), sw, sh);
    }
    g.fillStyle = c.body; g.fillRect(cx - w * 0.06, base - h, w * 0.12, h * 0.9);
  },
  pagoda(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const y = base - (h / tiers) * (i + 1), tw = h * (0.5 - i * 0.09);
      g.beginPath(); g.moveTo(cx - tw, y + h * 0.05); g.quadraticCurveTo(cx, y - h * 0.06, cx + tw, y + h * 0.05); g.lineTo(cx + tw * 0.7, y + h * 0.09); g.lineTo(cx - tw * 0.7, y + h * 0.09); g.closePath();
      g.fillStyle = i % 2 ? c.body : c.far; g.fill(); g.stroke();
      g.fillStyle = c.body; g.fillRect(cx - tw * 0.4, y + h * 0.09, tw * 0.8, h / tiers - h * 0.09);
    }
  },
  alps(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (const [s, hh] of [[0.05, 0.6], [0.3, 1], [0.62, 0.78]]) {
      const cx = x0 + w * s + w * 0.16;
      g.beginPath(); g.moveTo(cx - w * 0.22, base); g.lineTo(cx, base - h * hh); g.lineTo(cx + w * 0.22, base); g.closePath();
      g.fillStyle = c.body; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(cx - w * 0.075, base - h * hh * 0.66); g.lineTo(cx, base - h * hh); g.lineTo(cx + w * 0.075, base - h * hh * 0.66);
      g.lineTo(cx + w * 0.03, base - h * hh * 0.75); g.lineTo(cx - w * 0.02, base - h * hh * 0.68); g.closePath();
      g.fillStyle = '#ffffff'; g.fill(); g.stroke();
    }
  },
  acacia(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.far; g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + w * 0.5, base - h * 0.28, x1, base); g.closePath(); g.fill(); g.stroke();
    for (const s of [0.2, 0.55, 0.82]) {
      const cx = x0 + w * s, hh = h * (s === 0.55 ? 0.8 : 0.58);
      g.lineWidth = Math.max(2, h * 0.04); g.strokeStyle = c.body;
      g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, base - hh * 0.6); g.moveTo(cx, base - hh * 0.45); g.lineTo(cx - hh * 0.2, base - hh * 0.62); g.moveTo(cx, base - hh * 0.45); g.lineTo(cx + hh * 0.2, base - hh * 0.62); g.stroke();
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
      g.beginPath(); g.ellipse(cx, base - hh * 0.72, hh * 0.42, hh * 0.18, 0, 0, Math.PI * 2); g.fillStyle = c.body; g.fill(); g.stroke();
    }
  },
  canals(g, x0, x1, base, h, c) {
    const w = x1 - x0, n = 6;
    for (let i = 0; i < n; i++) {
      const bw = w / n, bx = x0 + bw * i, hh = h * (0.55 + (i % 3) * 0.14);
      g.fillStyle = i % 2 ? c.body : c.far;
      g.beginPath(); g.moveTo(bx, base); g.lineTo(bx, base - hh); g.lineTo(bx + bw * 0.45, base - hh - h * 0.12); g.lineTo(bx + bw * 0.9, base - hh); g.lineTo(bx + bw * 0.9, base); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#ffe9a8';
      g.fillRect(bx + bw * 0.25, base - hh * 0.6, bw * 0.4, h * 0.1);
    }
  },
  castle(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.far; g.fillRect(x0 + w * 0.1, base - h * 0.45, w * 0.8, h * 0.45); g.strokeRect(x0 + w * 0.1, base - h * 0.45, w * 0.8, h * 0.45);
    for (const s of [0.1, 0.46, 0.76]) {
      const tw = w * 0.14, tx = x0 + w * s, hh = h * (s === 0.46 ? 0.9 : 0.68);
      g.fillStyle = c.body; g.fillRect(tx, base - hh, tw, hh); g.strokeRect(tx, base - hh, tw, hh);
      for (let i = 0; i < 3; i++) { g.fillRect(tx + (tw / 3) * i, base - hh - h * 0.07, tw * 0.22, h * 0.07); g.strokeRect(tx + (tw / 3) * i, base - hh - h * 0.07, tw * 0.22, h * 0.07); }
    }
  },
  volcano(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2;
    g.beginPath(); g.moveTo(cx - h * 0.95, base); g.lineTo(cx - h * 0.2, base - h * 0.88); g.lineTo(cx + h * 0.2, base - h * 0.88); g.lineTo(cx + h * 0.95, base); g.closePath();
    g.fillStyle = c.body; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - h * 0.2, base - h * 0.88); g.lineTo(cx - h * 0.08, base - h * 0.72); g.lineTo(cx + h * 0.06, base - h * 0.8); g.lineTo(cx + h * 0.2, base - h * 0.88); g.closePath();
    g.fillStyle = '#ff6a2a'; g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, base - h * 1.02, h * 0.3, h * 0.1, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  domes(g, x0, x1, base, h, c) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    g.fillStyle = c.far; g.fillRect(x0 + w * 0.12, base - h * 0.34, w * 0.76, h * 0.34); g.strokeRect(x0 + w * 0.12, base - h * 0.34, w * 0.76, h * 0.34);
    const dome = (dx, r, col) => {
      g.beginPath(); g.arc(dx, base - h * 0.34, r, Math.PI, 0); g.closePath(); g.fillStyle = col; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(dx, base - h * 0.34 - r); g.lineTo(dx, base - h * 0.34 - r - h * 0.12); g.lineWidth = Math.max(2, h * 0.03); g.strokeStyle = c.body; g.stroke();
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
    };
    dome(cx, h * 0.34, c.body); dome(cx - w * 0.3, h * 0.2, c.far); dome(cx + w * 0.3, h * 0.2, c.far);
    for (const s of [0.08, 0.92]) {
      const mx = x0 + w * s;
      g.fillStyle = c.body; g.fillRect(mx - h * 0.05, base - h * 0.9, h * 0.1, h * 0.9); g.strokeRect(mx - h * 0.05, base - h * 0.9, h * 0.1, h * 0.9);
      g.beginPath(); g.moveTo(mx - h * 0.09, base - h * 0.9); g.lineTo(mx, base - h); g.lineTo(mx + h * 0.09, base - h * 0.9); g.closePath(); g.fill(); g.stroke();
    }
  },
  arch(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.62;
    g.beginPath();
    g.moveTo(cx - w, base); g.lineTo(cx - w, base - h * 0.5);
    g.quadraticCurveTo(cx, base - h * 1.25, cx + w, base - h * 0.5); g.lineTo(cx + w, base);
    g.lineTo(cx + w * 0.62, base); g.lineTo(cx + w * 0.62, base - h * 0.5);
    g.quadraticCurveTo(cx, base - h * 0.95, cx - w * 0.62, base - h * 0.5); g.lineTo(cx - w * 0.62, base); g.closePath();
    g.fillStyle = c.body; g.fill(); g.stroke();
  },
  sails(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.lineWidth = Math.max(2, h * 0.05); g.strokeStyle = c.far;
    g.beginPath(); g.moveTo(x0, base - h * 0.2); g.quadraticCurveTo(x0 + w * 0.22, base - h * 0.62, x0 + w * 0.44, base - h * 0.2); g.stroke();
    g.strokeStyle = c.ink; g.lineWidth = c.lw;
    for (let i = 0; i < 4; i++) {
      const sx = x0 + w * (0.5 + i * 0.12), hh = h * (0.5 + i * 0.14);
      g.beginPath(); g.moveTo(sx, base); g.quadraticCurveTo(sx + w * 0.02, base - hh, sx + w * 0.13, base); g.closePath();
      g.fillStyle = i % 2 ? '#ffffff' : c.far; g.fill(); g.stroke();
    }
  },
  pines(g, x0, x1, base, h, c) {
    const w = x1 - x0, n = 9;
    for (let i = 0; i < n; i++) {
      const cx = x0 + (w / n) * (i + 0.5), hh = h * (i % 3 === 1 ? 0.95 : i % 3 === 2 ? 0.7 : 0.82);
      g.beginPath(); g.moveTo(cx - w * 0.045, base); g.lineTo(cx, base - hh); g.lineTo(cx + w * 0.045, base); g.closePath();
      g.fillStyle = i % 2 ? c.body : c.far; g.fill(); g.stroke();
    }
  },
  fjord(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.body;
    g.beginPath(); g.moveTo(x0, base); g.lineTo(x0 + w * 0.1, base - h); g.lineTo(x0 + w * 0.38, base - h * 0.35); g.lineTo(x0 + w * 0.44, base); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x0 + w * 0.56, base); g.lineTo(x0 + w * 0.68, base - h * 0.82); g.lineTo(x0 + w * 0.92, base - h * 0.3); g.lineTo(x1, base); g.closePath();
    g.fillStyle = c.far; g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(x0 + w * 0.06, base - h * 0.78); g.lineTo(x0 + w * 0.1, base - h); g.lineTo(x0 + w * 0.17, base - h * 0.63); g.closePath(); g.fill();
  },
  palms(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (let i = 0; i < 4; i++) {
      const cx = x0 + w * (0.14 + i * 0.24), hh = h * (0.6 + (i % 2) * 0.25), lean = (i % 2 ? 1 : -1) * h * 0.08;
      g.lineWidth = Math.max(2, h * 0.045); g.strokeStyle = c.body;
      g.beginPath(); g.moveTo(cx, base); g.quadraticCurveTo(cx + lean, base - hh * 0.6, cx + lean * 1.6, base - hh); g.stroke();
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
      const tx = cx + lean * 1.6, ty = base - hh;
      for (let a = 0; a < 5; a++) {
        const an = Math.PI + (a / 4) * Math.PI;
        g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(an) * hh * 0.28, ty + Math.sin(an) * hh * 0.18 - hh * 0.1, tx + Math.cos(an) * hh * 0.42, ty + Math.sin(an) * hh * 0.2);
        g.lineWidth = Math.max(2, h * 0.05); g.strokeStyle = c.far; g.stroke();
      }
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
    }
  },
  pyramids(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (const [s, hh, col] of [[0.14, 0.72, c.far], [0.46, 1, c.body], [0.76, 0.6, c.far]]) {
      const cx = x0 + w * s;
      g.beginPath(); g.moveTo(cx - h * hh * 0.85, base); g.lineTo(cx, base - h * hh); g.lineTo(cx + h * hh * 0.85, base); g.closePath();
      g.fillStyle = col; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(cx, base - h * hh); g.lineTo(cx + h * hh * 0.85, base); g.lineTo(cx + h * hh * 0.3, base); g.closePath();
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fill();
    }
  },
  maple(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (let i = 0; i < 7; i++) {
      const cx = x0 + (w / 7) * (i + 0.5), hh = h * (0.5 + (i % 3) * 0.16);
      g.lineWidth = Math.max(2, h * 0.04); g.strokeStyle = c.far;
      g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, base - hh * 0.5); g.stroke();
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
      g.beginPath(); g.arc(cx, base - hh * 0.72, hh * 0.3, 0, Math.PI * 2);
      g.fillStyle = ['#e8622c', '#d8902a', '#c8452c'][i % 3]; g.fill(); g.stroke();
    }
  },
  cactus(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.far; g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + w * 0.5, base - h * 0.3, x1, base); g.closePath(); g.fill(); g.stroke();
    for (const [s, hh] of [[0.22, 0.8], [0.55, 0.55], [0.8, 0.68]]) {
      const cx = x0 + w * s, bw = h * 0.1;
      g.fillStyle = c.body;
      g.beginPath(); g.rect(cx - bw, base - h * hh, bw * 2, h * hh);
      g.rect(cx - bw * 2.6, base - h * hh * 0.72, bw * 1.6, bw);
      g.rect(cx - bw * 2.6, base - h * hh * 0.72, bw, h * hh * 0.4);
      g.rect(cx + bw, base - h * hh * 0.56, bw * 1.6, bw);
      g.rect(cx + bw * 1.6, base - h * hh * 0.56, bw, h * hh * 0.3);
      g.fill(); g.stroke();
    }
  },
  favela(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.far; g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + w * 0.45, base - h, x1, base); g.closePath(); g.fill(); g.stroke();
    const cols = ['#ffd24d', '#ff8a5a', '#67c8f0', '#f2f2f2', '#7fd98a'];
    for (let i = 0; i < 14; i++) {
      const bx = x0 + w * (0.08 + (i % 7) * 0.13), by = base - h * (0.12 + Math.floor(i / 7) * 0.26 + ((i % 3) * 0.08));
      g.fillStyle = cols[i % cols.length];
      g.fillRect(bx, by - h * 0.14, w * 0.09, h * 0.14); g.strokeRect(bx, by - h * 0.14, w * 0.09, h * 0.14);
    }
  },
  rainforest(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (let i = 0; i < 10; i++) {
      const cx = x0 + (w / 10) * (i + 0.5), hh = h * (0.45 + ((i * 7) % 5) * 0.11);
      g.beginPath(); g.ellipse(cx, base - hh, w * 0.075, hh * 0.42, 0, 0, Math.PI * 2);
      g.fillStyle = i % 2 ? c.body : c.far; g.fill(); g.stroke();
      g.fillStyle = c.body; g.fillRect(cx - w * 0.008, base - hh, w * 0.016, hh);
    }
  },
  islands(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (const [s, hh, col] of [[0.12, 0.5, c.far], [0.42, 0.78, c.body], [0.74, 0.42, c.far]]) {
      const cx = x0 + w * s;
      g.beginPath(); g.moveTo(cx - w * 0.16, base); g.quadraticCurveTo(cx, base - h * hh, cx + w * 0.16, base); g.closePath();
      g.fillStyle = col; g.fill(); g.stroke();
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, h * 0.03);
    for (let i = 0; i < 4; i++) { const x = x0 + w * (0.1 + i * 0.25); g.beginPath(); g.moveTo(x, base - h * 0.06); g.lineTo(x + w * 0.1, base - h * 0.06); g.stroke(); }
    g.strokeStyle = c.ink; g.lineWidth = c.lw;
  },
  towers(g, x0, x1, base, h, c) {
    const cx = (x0 + x1) / 2, w = h * 0.2;
    for (const s of [-1, 1]) {
      const tx = cx + s * w * 1.3;
      g.fillStyle = c.body;
      g.beginPath(); g.moveTo(tx - w * 0.5, base); g.lineTo(tx - w * 0.34, base - h * 0.92); g.lineTo(tx + w * 0.34, base - h * 0.92); g.lineTo(tx + w * 0.5, base); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(tx, base - h); g.lineTo(tx, base - h * 0.92); g.lineWidth = Math.max(2, h * 0.03); g.strokeStyle = c.far; g.stroke();
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
    }
    g.fillStyle = c.far; g.fillRect(cx - w * 1.9, base - h * 0.5, w * 3.8, h * 0.1); g.strokeRect(cx - w * 1.9, base - h * 0.5, w * 3.8, h * 0.1);
  },
  waterfall(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.body; g.fillRect(x0, base - h * 0.75, w * 0.3, h * 0.75); g.strokeRect(x0, base - h * 0.75, w * 0.3, h * 0.75);
    g.fillRect(x1 - w * 0.3, base - h * 0.75, w * 0.3, h * 0.75); g.strokeRect(x1 - w * 0.3, base - h * 0.75, w * 0.3, h * 0.75);
    g.fillStyle = '#eaf6ff';
    g.fillRect(x0 + w * 0.3, base - h * 0.75, w * 0.4, h * 0.75); g.strokeRect(x0 + w * 0.3, base - h * 0.75, w * 0.4, h * 0.75);
    g.fillStyle = c.far;
    for (let i = 0; i < 3; i++) g.fillRect(x0 + w * (0.34 + i * 0.12), base - h * 0.7, w * 0.03, h * 0.6);
  },
  safari(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    g.fillStyle = c.far; g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + w * 0.5, base - h * 0.42, x1, base); g.closePath(); g.fill(); g.stroke();
    // a giraffe and two elephants on the plain
    g.fillStyle = c.body;
    const el = (ex, s) => { g.beginPath(); g.ellipse(ex, base - h * 0.14 * s, h * 0.2 * s, h * 0.12 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.arc(ex - h * 0.2 * s, base - h * 0.18 * s, h * 0.08 * s, 0, Math.PI * 2); g.fill(); g.stroke(); };
    el(x0 + w * 0.3, 1); el(x0 + w * 0.52, 0.7);
    const gx = x0 + w * 0.76;
    g.fillRect(gx - h * 0.03, base - h * 0.55, h * 0.06, h * 0.55); g.strokeRect(gx - h * 0.03, base - h * 0.55, h * 0.06, h * 0.55);
    g.beginPath(); g.arc(gx + h * 0.03, base - h * 0.6, h * 0.07, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  blossom(g, x0, x1, base, h, c) {
    const w = x1 - x0;
    for (let i = 0; i < 5; i++) {
      const cx = x0 + (w / 5) * (i + 0.5), hh = h * (0.55 + (i % 2) * 0.22);
      g.lineWidth = Math.max(2, h * 0.045); g.strokeStyle = c.body;
      g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, base - hh * 0.45); g.stroke();
      g.strokeStyle = c.ink; g.lineWidth = c.lw;
      for (const [dx, dy, r] of [[0, -0.75, 0.3], [-0.2, -0.6, 0.22], [0.2, -0.62, 0.24]]) {
        g.beginPath(); g.arc(cx + dx * hh, base - (-dy) * hh, r * hh, 0, Math.PI * 2);
        g.fillStyle = i % 2 ? '#ffc8dd' : '#ffd9e8'; g.fill(); g.stroke();
      }
    }
  },
};

// ---------------------------------------------------------------- the grounds
// country, city, climate, how the pitch is mown, what you can see over the stand, what the fans sing
const GROUND_ROWS = [
  ['argentina', 'BUENOS AIRES', 'day', 'stripes', 'obelisk', 'VAMOS ARGENTINA!'],
  ['spain', 'MADRID', 'dusk', 'checks', 'spires', 'OLE OLE OLE!'],
  ['france', 'PARIS', 'night', 'diamond', 'lattice', 'ALLEZ LES BLEUS!'],
  ['england', 'LONDON', 'rain', 'stripes', 'clock', 'COME ON ENGLAND!'],
  ['brazil', 'RIO', 'day', 'hstripes', 'statue', 'VAI BRASIL!'],
  ['portugal', 'LISBON', 'dusk', 'stripes', 'bridge', 'FORCA PORTUGAL!'],
  ['netherlands', 'AMSTERDAM', 'day', 'checks', 'windmills', 'HUP HOLLAND HUP!'],
  ['belgium', 'BRUSSELS', 'rain', 'diamond', 'spheres', 'ALLEZ LES DIABLES!'],
  ['italy', 'ROME', 'dusk', 'checks', 'arches', 'FORZA ITALIA!'],
  ['germany', 'BERLIN', 'day', 'grid', 'gate', 'DEUTSCHLAND VOR!'],
  ['croatia', 'ZAGREB', 'day', 'diamond', 'coast', 'IDEMO HRVATSKA!'],
  ['morocco', 'CASABLANCA', 'desert', 'hstripes', 'domes', 'DIMA MAGHRIB!'],
  ['colombia', 'BOGOTA', 'day', 'stripes', 'andes', 'VAMOS COLOMBIA!'],
  ['uruguay', 'MONTEVIDEO', 'dusk', 'hstripes', 'lighthouse', 'ARRIBA URUGUAY!'],
  ['usa', 'NEW YORK', 'night', 'grid', 'skyline', 'U-S-A! U-S-A!'],
  ['mexico', 'MEXICO CITY', 'day', 'diamond', 'temple', 'MEXICO! MEXICO!'],
  ['japan', 'TOKYO', 'neon', 'grid', 'pagoda', 'NIPPON! NIPPON!'],
  ['switzerland', 'BERN', 'snow', 'checks', 'alps', 'HOPP SCHWIIZ!'],
  ['senegal', 'DAKAR', 'desert', 'stripes', 'acacia', 'ALLEZ LES LIONS!'],
  ['denmark', 'COPENHAGEN', 'rain', 'checks', 'canals', 'KOM SA DANMARK!'],
  ['austria', 'VIENNA', 'snow', 'diamond', 'castle', 'AUF GEHTS!'],
  ['ecuador', 'QUITO', 'day', 'checks', 'volcano', 'VAMOS ECUADOR!'],
  ['turkey', 'ISTANBUL', 'dusk', 'grid', 'domes', 'TURKIYE! TURKIYE!'],
  ['southkorea', 'SEOUL', 'neon', 'stripes', 'gate', 'DAEHAN MINGUK!'],
  ['iran', 'TEHRAN', 'desert', 'diamond', 'arch', 'IRAN! IRAN!'],
  ['australia', 'SYDNEY', 'day', 'stripes', 'sails', 'AUSSIE AUSSIE AUSSIE!'],
  ['ukraine', 'KYIV', 'day', 'checks', 'domes', 'SLAVA UKRAINI!'],
  ['sweden', 'STOCKHOLM', 'snow', 'stripes', 'pines', 'HEJA SVERIGE!'],
  ['wales', 'CARDIFF', 'rain', 'checks', 'castle', 'CYMRU AM BYTH!'],
  ['poland', 'WARSAW', 'rain', 'grid', 'skyline', 'POLSKA! BIALO-CZERWONI!'],
  ['serbia', 'BELGRADE', 'dusk', 'stripes', 'castle', 'SRBIJA! SRBIJA!'],
  ['norway', 'OSLO', 'snow', 'hstripes', 'fjord', 'HEIA NORGE!'],
  ['hungary', 'BUDAPEST', 'dusk', 'diamond', 'spires', 'HAJRA MAGYAROK!'],
  ['nigeria', 'LAGOS', 'day', 'hstripes', 'palms', 'SUPER EAGLES!'],
  ['egypt', 'CAIRO', 'desert', 'checks', 'pyramids', 'MASR! MASR!'],
  ['algeria', 'ALGIERS', 'desert', 'stripes', 'dunes', 'ONE TWO THREE VIVA!'],
  ['canada', 'TORONTO', 'snow', 'stripes', 'maple', 'GO CANADA GO!'],
  ['scotland', 'GLASGOW', 'rain', 'diamond', 'alps', 'SCOTLAND THE BRAVE!'],
  ['czechia', 'PRAGUE', 'dusk', 'checks', 'spires', 'DO TOHO CESKO!'],
  ['panama', 'PANAMA CITY', 'day', 'grid', 'skyline', 'ARRIBA PANAMA!'],
  ['peru', 'LIMA', 'dusk', 'hstripes', 'temple', 'ARRIBA PERU!'],
  ['slovakia', 'BRATISLAVA', 'rain', 'checks', 'castle', 'SLOVENSKO!'],
  ['romania', 'BUCHAREST', 'day', 'stripes', 'arch', 'HAI ROMANIA!'],
  ['greece', 'ATHENS', 'dusk', 'checks', 'coast', 'HELLAS! HELLAS!'],
  ['ivorycoast', 'ABIDJAN', 'day', 'hstripes', 'palms', 'ALLEZ LES ELEPHANTS!'],
  ['tunisia', 'TUNIS', 'desert', 'checks', 'arches', 'TUNISIE! TUNISIE!'],
  ['costarica', 'SAN JOSE', 'day', 'checks', 'rainforest', 'VAMOS TICOS!'],
  ['paraguay', 'ASUNCION', 'dusk', 'stripes', 'waterfall', 'VAMOS PARAGUAY!'],
  ['chile', 'SANTIAGO', 'day', 'diamond', 'andes', 'VAMOS CHILE!'],
  ['venezuela', 'CARACAS', 'day', 'stripes', 'waterfall', 'VINOTINTO!'],
  ['qatar', 'DOHA', 'neon', 'grid', 'towers', 'QATAR! QATAR!'],
  ['saudiarabia', 'RIYADH', 'desert', 'grid', 'towers', 'GREEN FALCONS!'],
  ['cameroon', 'YAOUNDE', 'day', 'hstripes', 'rainforest', 'ALLEZ LES LIONS!'],
  ['mali', 'BAMAKO', 'desert', 'hstripes', 'acacia', 'ALLEZ LES AIGLES!'],
  ['ireland', 'DUBLIN', 'rain', 'stripes', 'coast', 'COME ON YOU BOYS IN GREEN!'],
  ['slovenia', 'LJUBLJANA', 'snow', 'checks', 'alps', 'NAPREJ SLOVENIJA!'],
  ['albania', 'TIRANA', 'dusk', 'diamond', 'castle', 'SHQIPERIA!'],
  ['uzbekistan', 'TASHKENT', 'desert', 'diamond', 'domes', 'OZBEKISTON!'],
  ['ghana', 'ACCRA', 'day', 'stripes', 'palms', 'GO BLACK STARS!'],
  ['southafrica', 'JOHANNESBURG', 'day', 'grid', 'safari', 'BAFANA BAFANA!'],
  ['georgia', 'TBILISI', 'dusk', 'checks', 'alps', 'SAKARTVELO!'],
  ['jamaica', 'KINGSTON', 'day', 'hstripes', 'islands', 'REGGAE BOYZ!'],
  ['honduras', 'TEGUCIGALPA', 'day', 'checks', 'rainforest', 'VAMOS CATRACHOS!'],
  ['iceland', 'REYKJAVIK', 'snow', 'stripes', 'volcano', 'HU! HU! HU!'],
  ['finland', 'HELSINKI', 'snow', 'grid', 'pines', 'SUOMI! SUOMI!'],
  ['newzealand', 'AUCKLAND', 'rain', 'hstripes', 'islands', 'ALL WHITES!'],
  ['bosnia', 'SARAJEVO', 'snow', 'diamond', 'domes', 'ZMAJEVI!'],
  ['drcongo', 'KINSHASA', 'day', 'stripes', 'rainforest', 'LES LEOPARDS!'],
  ['puertorico', 'SAN JUAN', 'day', 'diamond', 'islands', 'BORICUA!'],
  ['dominicanrep', 'SANTO DOMINGO', 'dusk', 'hstripes', 'palms', 'VAMOS QUISQUEYA!'],
  // ---- the twenty-five that came with the crates
  ['russia', 'MOSCOW', 'snow', 'checks', 'domes', 'ROSSIYA! ROSSIYA!'],
  ['china', 'SHANGHAI', 'neon', 'grid', 'towers', 'ZHONGGUO JIAYOU!'],
  ['india', 'MUMBAI', 'dusk', 'hstripes', 'arch', 'CHAK DE INDIA!'],
  ['indonesia', 'JAKARTA', 'day', 'stripes', 'volcano', 'GARUDA DI DADAKU!'],
  ['thailand', 'BANGKOK', 'dusk', 'diamond', 'temple', 'CHANG SUEK!'],
  ['vietnam', 'HANOI', 'rain', 'checks', 'islands', 'VIET NAM VO DICH!'],
  ['philippines', 'MANILA', 'day', 'hstripes', 'islands', 'LABAN PILIPINAS!'],
  ['kenya', 'NAIROBI', 'day', 'grid', 'safari', 'HARAMBEE STARS!'],
  ['ethiopia', 'ADDIS ABABA', 'day', 'checks', 'andes', 'WALIA IBEX!'],
  ['zambia', 'LUSAKA', 'day', 'stripes', 'waterfall', 'CHIPOLOPOLO!'],
  ['zimbabwe', 'HARARE', 'dusk', 'hstripes', 'safari', 'GO WARRIORS!'],
  ['angola', 'LUANDA', 'day', 'diamond', 'palms', 'FORCA PALANCAS!'],
  ['iraq', 'BAGHDAD', 'desert', 'checks', 'domes', 'IRAQ! IRAQ!'],
  ['jordan', 'AMMAN', 'desert', 'stripes', 'arches', 'NASHAMA!'],
  ['oman', 'MUSCAT', 'desert', 'diamond', 'dunes', 'OMAN! OMAN!'],
  ['bolivia', 'LA PAZ', 'snow', 'stripes', 'andes', 'VAMOS BOLIVIA!'],
  ['guatemala', 'GUATEMALA CITY', 'day', 'checks', 'temple', 'VAMOS AZUL Y BLANCO!'],
  ['elsalvador', 'SAN SALVADOR', 'dusk', 'hstripes', 'volcano', 'VAMOS SELECTA!'],
  ['cuba', 'HAVANA', 'day', 'stripes', 'canals', 'VAMOS CUBA!'],
  ['haiti', 'PORT-AU-PRINCE', 'day', 'hstripes', 'favela', 'ALLEZ GRENADIERS!'],
  ['trinidad', 'PORT OF SPAIN', 'day', 'diamond', 'islands', 'SOCA WARRIORS!'],
  ['estonia', 'TALLINN', 'snow', 'checks', 'castle', 'EESTI! EESTI!'],
  ['latvia', 'RIGA', 'rain', 'stripes', 'spires', 'LATVIJA!'],
  ['lithuania', 'VILNIUS', 'snow', 'diamond', 'pines', 'LIETUVA!'],
  ['bulgaria', 'SOFIA', 'dusk', 'checks', 'alps', 'BULGARIA!'],
];

const COUNTRY_GROUNDS = {};
for (const [id, city, kind, pattern, motif, chant] of GROUND_ROWS) COUNTRY_GROUNDS[id] = { city, kind, pattern, motif, chant };

const DEFAULT_GROUND = { city: 'MINI STRIKERS PARK', kind: 'day', pattern: 'checks', motif: 'skyline', chant: "LET'S GO!" };

// ---------------------------------------------------------------- building one
const _grounds = {};
function stadiumFor(club) {
  const id = (club && club.id) || (typeof DEFAULT_CLUB === 'string' ? DEFAULT_CLUB : 'spain');
  if (_grounds[id]) return _grounds[id];
  const ground = COUNTRY_GROUNDS[id] || DEFAULT_GROUND;
  const k = STADIUM_KINDS[ground.kind] || STADIUM_KINDS.day;
  const kit = club && club.home ? club.home : null;
  // the stands take the country's colours, dark enough that the crowd still reads on top of them
  const seat = kit ? kit.jersey : '#34439a';
  const st = {
    ...k,
    id, kind: ground.kind, name: ground.city, chant: ground.chant,
    pattern: ground.pattern || k.pattern, motif: ground.motif,
    stands: [shadeHex(seat, -0.52), shadeHex(seat, -0.4)],
    roof: shadeHex(seat, -0.66),
    trim: kit ? kit.accent : '#ffe14d',
    seat,
  };
  _grounds[id] = st;
  return st;
}

// the stadium of whoever is at home, which is you unless nobody has picked sides yet
function homeStadium() {
  const club = (typeof Clubs !== 'undefined' && (Clubs.home || (Clubs.mine && Clubs.mine()))) || null;
  return stadiumFor(club);
}

// Motifs that already fill a whole horizon; the rest are one landmark and need something behind.
const MOTIF_WIDE = new Set(['skyline', 'pines', 'canals', 'dunes', 'palms', 'pyramids', 'maple', 'rainforest',
  'islands', 'safari', 'alps', 'andes', 'fjord', 'coast', 'acacia', 'blossom', 'favela', 'cactus', 'windmills',
  'spires', 'waterfall', 'sails']);

// roofs (in a city) or hills (everywhere else) right across the back of the sky
function horizonLine(g, st, x0, x1, base, h, c) {
  const w = x1 - x0;
  g.fillStyle = c.far;
  g.beginPath(); g.moveTo(x0, base);
  if (st.kind === 'night' || st.kind === 'neon' || st.kind === 'rain') {
    const n = 16;
    for (let i = 0; i < n; i++) { const bx = x0 + (w / n) * i, hh = h * (0.4 + (((i * 37) % 7) / 10)); g.lineTo(bx, base - hh); g.lineTo(bx + w / n, base - hh); }
  } else {
    const n = 7;
    for (let i = 0; i <= n; i++) g.quadraticCurveTo(x0 + (w / n) * (i - 0.5), base - h * (i % 2 ? 1 : 0.45), x0 + (w / n) * i, base - h * 0.6);
  }
  g.lineTo(x1, base); g.closePath(); g.fill(); g.stroke();
}

// what you can see over the stand, drawn into a band of sky
function drawSkyline(g, st, x0, x1, base, h) {
  const motif = STADIUM_MOTIFS[st.motif] || STADIUM_MOTIFS.skyline;
  const lw = Math.max(2, h * 0.055);
  const c = { body: st.far, far: shadeHex(st.far, -0.2), ink: OUTLINE, lw };
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = OUTLINE; g.lineWidth = lw;
  if (MOTIF_WIDE.has(st.motif)) {
    motif(g, x0, x1, base, h, c);
  } else {
    const w = x1 - x0;
    horizonLine(g, st, x0, x1, base + 1, h * 0.34, c);
    motif(g, x0 + w * 0.04, x0 + w * 0.3, base + 1, h * 0.95, c);
  }
  g.restore();
}

if (typeof module !== 'undefined') module.exports = { STADIUM_KINDS, COUNTRY_GROUNDS, stadiumFor };
