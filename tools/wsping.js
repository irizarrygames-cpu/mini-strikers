// How long does a message take to go to the server and come back, over the same kind of connection
// a live match uses?   node tools/wsping.js [url] [count]
//
// Opens a WebSocket to the game's /ws and sends protocol-level ping frames, timing each pong.
// The server answers a ping before it looks at anything else, so this is the network and the
// server's event loop and nothing of the game: the floor under every online match. It never signs
// in (the server drops an unsigned-in socket after a few seconds, which is fine for this).
const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

const target = new URL(process.argv[2] || 'https://mini-strikers.onrender.com');
const COUNT = Number(process.argv[3] || 20);
const secure = target.protocol === 'https:';
const port = Number(target.port) || (secure ? 443 : 80);

const sock = (secure ? tls.connect({ host: target.hostname, port, servername: target.hostname }) : net.connect({ host: target.hostname, port }));
sock.setNoDelay(true);
const t0 = process.hrtime.bigint();
const ms = (a) => Number(a) / 1e6;
let upgraded = false, buf = Buffer.alloc(0), sentAt = new Map(), rtts = [], seq = 0, connectMs = 0;

const mask = (data) => { const m = crypto.randomBytes(4); const out = Buffer.from(data); for (let i = 0; i < out.length; i++) out[i] ^= m[i & 3]; return Buffer.concat([m, out]); };
const pingFrame = (payload) => Buffer.concat([Buffer.from([0x89, 0x80 | payload.length]), mask(payload)]);

sock.on(secure ? 'secureConnect' : 'connect', () => {
  connectMs = ms(process.hrtime.bigint() - t0);
  const key = crypto.randomBytes(16).toString('base64');
  sock.write(`GET /ws HTTP/1.1\r\nHost: ${target.hostname}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nOrigin: ${target.origin}\r\n\r\n`);
});
sock.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  if (!upgraded) {
    const end = buf.indexOf('\r\n\r\n');
    if (end < 0) return;
    if (!/101/.test(buf.subarray(0, 20).toString())) { console.log('upgrade refused:', buf.subarray(0, 60).toString()); process.exit(1); }
    upgraded = true; buf = buf.subarray(end + 4);
    startPings();
  }
  while (buf.length >= 2) {
    const op = buf[0] & 0x0f, len = buf[1] & 0x7f;
    if (buf.length < 2 + len) break;
    const payload = buf.subarray(2, 2 + len); buf = buf.subarray(2 + len);
    if (op === 0xa) { const id = payload.toString(); if (sentAt.has(id)) { rtts.push(ms(process.hrtime.bigint() - sentAt.get(id))); sentAt.delete(id); } }
  }
});
sock.on('error', (e) => { console.log('error:', e.message); process.exit(1); });

function startPings() {
  const timer = setInterval(() => {
    if (seq >= COUNT) { clearInterval(timer); setTimeout(report, 600); return; }
    const id = String(seq++).padStart(3, '0');
    sentAt.set(id, process.hrtime.bigint());
    sock.write(pingFrame(Buffer.from(id)));
  }, 150);
}
function report() {
  rtts.sort((a, b) => a - b);
  const q = (p) => rtts[Math.min(rtts.length - 1, Math.floor(p * rtts.length))];
  const mean = rtts.reduce((a, b) => a + b, 0) / rtts.length;
  const jitter = rtts.slice(1).reduce((a, v, i) => a + Math.abs(v - rtts[i]), 0) / Math.max(1, rtts.length - 1);
  console.log(`${target.host}  connect+TLS ${connectMs.toFixed(0)} ms  |  ${rtts.length}/${COUNT} pongs`);
  console.log(`round trip: best ${rtts[0].toFixed(0)}  median ${q(0.5).toFixed(0)}  mean ${mean.toFixed(0)}  p90 ${q(0.9).toFixed(0)}  worst ${rtts[rtts.length - 1].toFixed(0)} ms`);
  process.exit(0);
}
setTimeout(() => { console.log('timed out'); process.exit(2); }, 20000);
