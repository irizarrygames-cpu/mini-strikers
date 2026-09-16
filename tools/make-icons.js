// Generates the home-screen icons. Run: node tools/make-icons.js
//
// The game ships no image files — everything is drawn from shapes at runtime. Icons
// are the one thing a phone insists on having as real PNGs, so they are drawn here in
// the same flat vocabulary (solid fills, thick dark outlines, no gradients) and written
// out with Node's own zlib. No image library, same as War Prize.

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

/* ---------------- drawing ---------------- */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BLUE = hex('#2f7bff'), BLUE_D = hex('#1f5ed6'), GRASS = hex('#4fbd3b'), WHITE = hex('#ffffff'), INK = hex('#16171d');

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// a regular pentagon, point-up, turned by `turn` radians
const pent = (cx, cy, r, turn) => {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = turn - Math.PI / 2 + (i * Math.PI * 2) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
};
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 2;
};

// A ball on a blue field with a grass stripe under it. `pad` is the share of the icon
// kept clear at the edges — a maskable icon gets cropped to a circle by the launcher,
// so its art has to sit well inside the square.
function draw(size, pad, rounded) {
  const rgba = Buffer.alloc(size * size * 4);
  const S = size;
  const R = rounded ? S * 0.22 : 0;
  const ballR = S * (0.5 - pad) * 0.62;
  const cx = S / 2, cy = S * 0.47;
  const ring = Math.max(2, S * 0.035);
  const grassTop = S * (1 - pad * 0.9) - S * 0.1;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let col = null;
      const onIcon = rounded ? inRoundRect(x, y, 0, 0, S - 1, S - 1, R) : true;
      if (onIcon) {
        col = y > grassTop ? GRASS : BLUE;
        // a darker band where the pitch meets the sky, so the two blues never smear
        if (y > grassTop - ring * 0.6 && y <= grassTop) col = BLUE_D;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= ballR + ring) col = INK;
        if (d <= ballR) {
          col = WHITE;
          // centre panel plus five around it: the flat way to say "football"
          const pr = ballR * 0.38;
          if (inPoly(x, y, pent(cx, cy, pr, 0))) col = INK;
          for (let k = 0; k < 5; k++) {
            const a = -Math.PI / 2 + (k * Math.PI * 2) / 5 + Math.PI / 5;
            const px = cx + Math.cos(a) * ballR * 0.78, py = cy + Math.sin(a) * ballR * 0.78;
            if (inPoly(x, y, pent(px, py, pr * 0.72, a + Math.PI))) col = INK;
          }
        }
      }
      if (col) { rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = 255; }
    }
  }
  return rgba;
}

const here = path.join(__dirname, '..');
const jobs = [
  ['icon-192.png', 192, 0.06, true],
  ['icon-512.png', 512, 0.06, true],
  ['icon-maskable-512.png', 512, 0.17, false], // full bleed, art inside the safe circle
  ['icon-180.png', 180, 0.06, true],           // what iOS uses for Add to Home Screen
];
const written = [];
for (const [name, size, pad, rounded] of jobs) {
  written.push(writePNG(path.join(here, name), size, draw(size, pad, rounded)));
  console.log('wrote ' + name);
}

// Every icon reference carries a hash of the icon bytes, so a redraw is a new URL and
// no browser can serve an old copy — and redrawing nothing leaves the URLs alone.
const stamp = crypto.createHash('sha1').update(Buffer.concat(written)).digest('hex').slice(0, 8);
for (const f of ['index.html', 'manifest.webmanifest']) {
  const p = path.join(here, f);
  const before = fs.readFileSync(p, 'utf8');
  let text = before;
  for (const [name] of jobs) {
    text = text.split(name + '?v=').map((part, i) => (i === 0 ? part : part.replace(/^[a-f0-9]+/, ''))).join(name);
    text = text.split(name).join(name + '?v=' + stamp);
  }
  if (text !== before) { fs.writeFileSync(p, text); console.log('stamped ' + f + ' -> ?v=' + stamp); }
}
