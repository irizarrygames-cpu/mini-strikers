// A bad internet connection in a box, for testing online play on this computer.
//   node tools/netproxy.js <listenPort> <targetPort> [latencyMs] [downBytesPerSec] [stallAtSec] [stallForSec]
//
// Sits between the game page and the server and passes everything through (the page's requests and
// the live socket alike, it is plain TCP), but:
//   latencyMs        every chunk is held this long each way (60 = a 120 ms round trip)
//   downBytesPerSec  the server-to-player direction can carry only this much, and what does not fit
//                    waits in an unlimited queue, as it does in a real modem or phone mast (0 = no limit)
//   stallAtSec / stallForSec   the whole link freezes for a while, then everything held arrives at once
// Point a page at it with ?native=1&api=http://localhost:<listenPort> (works on localhost only).
const net = require('net');
const [, , LISTEN, TARGET, LAT = '60', RATE = '0', STALL_AT = '0', STALL_FOR = '0'] = process.argv;
if (!LISTEN || !TARGET) { console.log('usage: node tools/netproxy.js <listenPort> <targetPort> [latencyMs] [downBytesPerSec] [stallAtSec] [stallForSec]'); process.exit(1); }
const latency = Number(LAT), rate = Number(RATE), t0 = Date.now(), stallFrom = Number(STALL_AT) * 1000, stallTo = stallFrom + Number(STALL_FOR) * 1000;
const stalled = () => { const t = Date.now() - t0; return Number(STALL_FOR) > 0 && t >= stallFrom && t < stallTo; };

function shape(from, to, down) {
  const q = [];
  let budget = 0, last = Date.now();
  from.on('data', (d) => q.push({ at: Date.now() + latency, buf: d }));
  const timer = setInterval(() => {
    const now = Date.now();
    budget = Math.min(budget + (rate * (now - last)) / 1000, rate * 0.1 + 1500); last = now;
    if (stalled()) return;
    while (q.length && q[0].at <= now) {
      const head = q[0];
      if (down && rate > 0) {
        if (budget < 1) break;
        const n = Math.min(head.buf.length, Math.floor(budget));
        to.write(head.buf.subarray(0, n)); budget -= n;
        if (n < head.buf.length) { head.buf = head.buf.subarray(n); break; }
        q.shift();
      } else { to.write(head.buf); q.shift(); }
    }
  }, 5);
  const done = () => { clearInterval(timer); to.destroy(); from.destroy(); };
  from.on('close', done); from.on('error', done); to.on('error', done);
}

net.createServer((c) => {
  c.setNoDelay(true);
  const s = net.connect(Number(TARGET), '127.0.0.1');
  s.setNoDelay(true);
  shape(c, s, false);   // the player to the server
  shape(s, c, true);    // the server to the player
}).listen(Number(LISTEN), () => console.log(`netproxy :${LISTEN} -> :${TARGET}  latency ${latency}ms each way${rate ? `, down ${rate} B/s` : ''}${Number(STALL_FOR) ? `, freezes at ${STALL_AT}s for ${STALL_FOR}s` : ''}`));
