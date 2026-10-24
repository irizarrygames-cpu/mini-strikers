// Receives finished pictures from tools/storeart.js running in the game's page, and writes them as
// 24-bit PNG files (red, green, blue, no transparency), which is what Google Play asks for: a canvas's
// own PNG always carries an alpha channel, and the store turns those down.
//   node tools/storeart-save.js <out folder> [port=8471] [page origin=http://localhost:8469]
// Only ever listens on this computer (127.0.0.1), and only answers the one page origin it is given.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.resolve(process.argv[2] || 'storeart');
const PORT = Number(process.argv[3] || 8471);
const ORIGIN = process.argv[4] || 'http://localhost:8469';
fs.mkdirSync(OUT, { recursive: true });

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii'), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
// rgb: width*height*3 bytes, row by row
function png(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'POST' || url.pathname !== '/save') { res.writeHead(404).end(); return; }
  const name = String(url.searchParams.get('name') || '').replace(/[^a-zA-Z0-9._-]/g, '');
  const w = Number(url.searchParams.get('w')), h = Number(url.searchParams.get('h'));
  if (!name.endsWith('.png') || !(w > 0 && h > 0 && w <= 4096 && h <= 4096)) { res.writeHead(400).end('bad'); return; }
  const parts = [];
  req.on('data', (d) => parts.push(d));
  req.on('end', () => {
    const rgb = Buffer.concat(parts);
    if (rgb.length !== w * h * 3) { res.writeHead(400).end('size ' + rgb.length); return; }
    const file = path.join(OUT, name);
    fs.writeFileSync(file, png(rgb, w, h));
    console.log('saved', file, w + 'x' + h);
    res.writeHead(200).end('ok');
  });
}).listen(PORT, '127.0.0.1', () => console.log('storeart saver on http://127.0.0.1:' + PORT + ' -> ' + OUT));
