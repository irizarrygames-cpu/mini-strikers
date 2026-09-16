// Generates the app icons. Run: node tools/make-icons.js
//
// The game ships no image files — everything is drawn from shapes at runtime. Icons are
// the one thing a phone insists on having as real files, so they are drawn here in the
// game's flat vocabulary (solid fills, thick ink outlines, hard shadows, no gradients):
// a flaming ball rocketing out of an arcade sunburst. PNGs are written with Node's own
// zlib (no image library); icon.svg is built from the same geometry so they match.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/* ---------------- PNG writing ---------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePNG(file, size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter type
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const buf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, buf);
  return buf;
}

/* ---------------- the design, in a 0..1 square ---------------- */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
  ray1: '#2f7bff', ray2: '#1f5fe0', ink: '#16171d', shadow: '#0f2f7a',
  white: '#ffffff', yellow: '#ffe14d', orange: '#ff7a1a', red: '#ff3f3f',
};
const RGB = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex(v)]));

const BALL = { x: 0.6, y: 0.6, r: 0.205 };
const INK = 0.022;                                        // outline thickness
const DIR = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };       // the trail runs up and left
const PERP = { x: -DIR.y, y: DIR.x };
const at = (along, across) => [BALL.x + DIR.x * along + PERP.x * across, BALL.y + DIR.y * along + PERP.y * across];

// flame: a wide base hugging the ball, three licks trailing up-left
const FLAME = [
  at(0.02, 0.2), at(0.2, 0.19), at(0.3, 0.26), at(0.36, 0.14), at(0.55, 0.13), at(0.47, 0.03),
  at(0.66, -0.02), at(0.44, -0.1), at(0.5, -0.2), at(0.3, -0.15), at(0.22, -0.23), at(0.02, -0.2),
];
const INNER = [
  at(0.05, 0.13), at(0.2, 0.12), at(0.28, 0.16), at(0.33, 0.07), at(0.46, 0.04), at(0.34, -0.04),
  at(0.36, -0.13), at(0.22, -0.1), at(0.16, -0.15), at(0.05, -0.13),
];
// speed streaks either side of the flame
const STREAKS = [
  { a: at(0.3, 0.3), b: at(0.48, 0.3), r: 0.024 },
  { a: at(0.34, -0.26), b: at(0.5, -0.26), r: 0.024 },
  { a: at(0.12, 0.42), b: at(0.26, 0.42), r: 0.018 },
];
// two four-point sparkles
const SPARKS = [{ x: 0.17, y: 0.82, r: 0.07 }, { x: 0.87, y: 0.13, r: 0.05 }];
const RAYS = 14;

function pent(cx, cy, r, turn) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = turn - Math.PI / 2 + (i * Math.PI * 2) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
const PATCHES = [pent(BALL.x, BALL.y, BALL.r * 0.36, 0.25)];
for (let k = 0; k < 5; k++) {
  const a = 0.25 - Math.PI / 2 + (k * Math.PI * 2) / 5 + Math.PI / 5;
  PATCHES.push(pent(BALL.x + Math.cos(a) * BALL.r * 0.8, BALL.y + Math.sin(a) * BALL.r * 0.8, BALL.r * 0.26, a + Math.PI));
}
const sparkPoly = (s) => {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, rr = i % 2 ? s.r * 0.28 : s.r;
    pts.push([s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr]);
  }
  return pts;
};
const SPARK_POLYS = SPARKS.map(sparkPoly);

/* ---------------- geometry tests ---------------- */

function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function polyEdgeDist(px, py, pts) {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, segDist(px, py, pts[j][0], pts[j][1], pts[i][0], pts[i][1]));
  return d;
}

// The colour at a point in the unit square, painted back to front.
function shade(x, y) {
  let col = Math.floor(((Math.atan2(y - BALL.y, x - BALL.x) + Math.PI) / (Math.PI * 2)) * RAYS) % 2 ? RGB.ray2 : RGB.ray1;
  for (const s of STREAKS) {
    const d = segDist(x, y, s.a[0], s.a[1], s.b[0], s.b[1]);
    if (d <= s.r + INK) col = d <= s.r ? RGB.white : RGB.ink;
  }
  for (const sp of SPARK_POLYS) {
    if (inPoly(x, y, sp)) col = RGB.yellow;
    else if (polyEdgeDist(x, y, sp) <= INK * 0.7) col = RGB.ink;
  }
  if (inPoly(x, y, FLAME)) col = inPoly(x, y, INNER) ? RGB.yellow : RGB.orange;
  else if (polyEdgeDist(x, y, FLAME) <= INK) col = RGB.ink;
  // hard shadow, then the ball
  const ds = Math.hypot(x - (BALL.x + 0.03), y - (BALL.y + 0.035));
  if (ds <= BALL.r + INK) col = RGB.shadow;
  const d = Math.hypot(x - BALL.x, y - BALL.y);
  if (d <= BALL.r + INK) col = RGB.ink;
  if (d <= BALL.r) {
    col = RGB.white;
    for (const p of PATCHES) if (inPoly(x, y, p)) col = RGB.ink;
  }
  return col;
}

// pad: share of the icon kept clear so a launcher's circle crop never cuts the art
function draw(size, pad, rounded) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // 4x4 supersampling for clean edges
  const R = rounded ? 0.2 : 0;
  const scale = 1 - pad * 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size, v = (py + (sy + 0.5) / SS) / size;
          if (rounded) {
            const cx = Math.min(Math.max(u, R), 1 - R), cy = Math.min(Math.max(v, R), 1 - R);
            if ((u - cx) ** 2 + (v - cy) ** 2 > R * R) continue; // outside the rounded corner
          }
          // art coordinates: the design scaled into the padded area; the sunburst fills everything
          const x = 0.5 + (u - 0.5) / scale, y = 0.5 + (v - 0.5) / scale;
          const c = shade(x, y);
          r += c[0]; g += c[1]; b += c[2]; a++;
        }
      }
      const i = (py * size + px) * 4, n = SS * SS;
      if (a) { rgba[i] = Math.round(r / a); rgba[i + 1] = Math.round(g / a); rgba[i + 2] = Math.round(b / a); rgba[i + 3] = Math.round((a / n) * 255); }
    }
  }
  return rgba;
}

/* ---------------- icon.svg from the same geometry ---------------- */

function svg() {
  const K = 512, f = (v) => +(v * K).toFixed(1);
  const pts = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
  let rays = '';
  for (let i = 0; i < RAYS; i += 2) {
    const a0 = (i / RAYS) * Math.PI * 2 - Math.PI, a1 = ((i + 1) / RAYS) * Math.PI * 2 - Math.PI, L = 2;
    rays += `<polygon points="${f(BALL.x)},${f(BALL.y)} ${f(BALL.x + Math.cos(a0) * L)},${f(BALL.y + Math.sin(a0) * L)} ${f(BALL.x + Math.cos(a1) * L)},${f(BALL.y + Math.sin(a1) * L)}" fill="${C.ray1}"/>`;
  }
  const ink = f(INK) * 2;
  const streaks = STREAKS.map((s) => `<path d="M${f(s.a[0])} ${f(s.a[1])}L${f(s.b[0])} ${f(s.b[1])}" stroke="${C.ink}" stroke-width="${f(s.r * 2 + INK * 2)}" stroke-linecap="round"/><path d="M${f(s.a[0])} ${f(s.a[1])}L${f(s.b[0])} ${f(s.b[1])}" stroke="${C.white}" stroke-width="${f(s.r * 2)}" stroke-linecap="round"/>`).join('');
  const sparks = SPARK_POLYS.map((p) => `<polygon points="${pts(p)}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="${f(INK * 1.4)}" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <clipPath id="c"><rect width="512" height="512" rx="${f(0.2)}"/></clipPath>
  <g clip-path="url(#c)">
    <rect width="512" height="512" fill="${C.ray2}"/>${rays}
    ${streaks}${sparks}
    <polygon points="${pts(FLAME)}" fill="${C.orange}" stroke="${C.ink}" stroke-width="${ink}" stroke-linejoin="round"/>
    <polygon points="${pts(INNER)}" fill="${C.yellow}"/>
    <circle cx="${f(BALL.x + 0.03)}" cy="${f(BALL.y + 0.035)}" r="${f(BALL.r + INK)}" fill="${C.shadow}"/>
    <circle cx="${f(BALL.x)}" cy="${f(BALL.y)}" r="${f(BALL.r + INK / 2)}" fill="${C.white}" stroke="${C.ink}" stroke-width="${f(INK)}"/>
    ${PATCHES.map((p) => `<polygon points="${pts(p)}" fill="${C.ink}"/>`).join('')}
  </g>
</svg>
`;
}

const here = path.join(__dirname, '..');
const jobs = [
  ['icon-192.png', 192, 0, true],
  ['icon-512.png', 512, 0, true],
  ['icon-maskable-512.png', 512, 0.16, false], // full bleed, art pulled inside the 80% safe circle
  ['icon-180.png', 180, 0.05, false],           // iOS rounds the corners itself, so keep the art off them
];
const written = [];
for (const [name, size, pad, rounded] of jobs) {
  written.push(writePNG(path.join(here, name), size, draw(size, pad, rounded)));
  console.log('wrote ' + name);
}
fs.writeFileSync(path.join(here, 'icon.svg'), svg());
written.push(fs.readFileSync(path.join(here, 'icon.svg')));
console.log('wrote icon.svg');

// Every icon reference carries a hash of the icon bytes, so a redraw is a new URL and
// no browser can serve an old copy — and redrawing nothing leaves the URLs alone.
const stamp = crypto.createHash('sha1').update(Buffer.concat(written)).digest('hex').slice(0, 8);
for (const f of ['index.html', 'manifest.webmanifest']) {
  const p = path.join(here, f);
  const before = fs.readFileSync(p, 'utf8');
  let text = before;
  for (const name of [...jobs.map((j) => j[0]), 'icon.svg']) {
    text = text.split(name + '?v=').map((part, i) => (i === 0 ? part : part.replace(/^[a-f0-9]+/, ''))).join(name);
    text = text.split(name).join(name + '?v=' + stamp);
  }
  if (text !== before) { fs.writeFileSync(p, text); console.log('stamped ' + f + ' -> ?v=' + stamp); }
}
