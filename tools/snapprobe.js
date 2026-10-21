// How stale is the match on a player's screen, once the connection is poor?
//   node tools/snapprobe.js <port> [seconds] [--ack] [--format 4v4]
//
// A bare-bones player, with no screen and no game code, that joins a real match on a real server
// and times every snapshot. A snapshot carries the server tick it describes, and the earliest one
// ever to arrive tells us what the fastest possible trip looks like; every later one is compared
// with that. "stale" is how much longer than the best trip a snapshot took, which is the delay a
// player is looking at on top of the distance. Point it at the proxy (tools/netproxy.js) to try
// a slow or stalling connection; --ack makes it report what it has received the way the game does.
const port = Number(process.argv[2] || 8459), SECONDS = Number(process.argv[3] || 25);
const ACK = process.argv.includes('--ack');
const FORMAT = (process.argv.indexOf('--format') > 0 && process.argv[process.argv.indexOf('--format') + 1]) || '4v4';
const TICK_MS = 1000 / 120;
const base = `http://127.0.0.1:${port}`;

(async () => {
  const name = 'pr' + (Date.now() % 100000), pass = 'probe-' + Math.random().toString(36).slice(2) + 'Aa1';
  const su = await fetch(base + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.1.' + (Math.random() * 250 | 0) + '.' + (Math.random() * 250 | 0) }, body: JSON.stringify({ username: name, password: pass, club: 'germany' }) }).then((r) => r.json());
  if (!su.ok) { console.log('signup failed', su); process.exit(1); }
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const est = [], gaps = [], sizes = [];
  let lastAt = null, lastK = 0, seq = 0, started = false, t0 = 0, inputTimer = null, snaps = 0;
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  ws.onopen = () => send({ t: 'auth', token: su.token });
  ws.onmessage = (e) => {
    const now = performance.now();
    const text = String(e.data);
    if (text.startsWith('{"t":"s"')) {
      const msg = JSON.parse(text);
      est.push(now - msg.k * TICK_MS); sizes.push(text.length); lastK = msg.k; snaps++;
      if (lastAt !== null) gaps.push(now - lastAt);
      lastAt = now;
      return;
    }
    const msg = JSON.parse(text);
    if (msg.t === 'hello') send({ t: 'room.create', format: FORMAT });
    else if (msg.t === 'room' || msg.t === 'lobby') { if (!started) { started = true; setTimeout(() => send({ t: 'room.start' }), 400); } }
    else if (msg.t === 'start') {
      t0 = now;
      inputTimer = setInterval(() => {
        const a = (performance.now() - t0) / 1000;
        send({ t: 'i', s: ++seq, x: +Math.sin(a).toFixed(2), y: +Math.cos(a * 0.7).toFixed(2), sp: 0, a: 0, ...(ACK ? { k: lastK } : {}) });
      }, 33);
      setTimeout(report, SECONDS * 1000);
    }
  };
  ws.onerror = () => { console.log('socket error'); process.exit(1); };

  function report() {
    clearInterval(inputTimer);
    const baseEst = Math.min(...est);
    const stale = est.map((v) => v - baseEst).sort((a, b) => a - b);
    const g = gaps.slice().sort((a, b) => a - b);
    const q = (a, p) => Math.round(a[Math.min(a.length - 1, Math.floor(p * a.length))]);
    console.log(`${snaps} snapshots in ${SECONDS}s (${(snaps / SECONDS).toFixed(1)}/s, ${Math.round(sizes.reduce((a, b) => a + b, 0) / SECONDS / 1024)} KB/s)  ${ACK ? 'with acks' : 'no acks (old game)'}`);
    console.log(`stale (ms behind the best trip):  median ${q(stale, 0.5)}   p90 ${q(stale, 0.9)}   p99 ${q(stale, 0.99)}   worst ${Math.round(stale[stale.length - 1])}`);
    console.log(`gap between snapshots (ms):       median ${q(g, 0.5)}   p99 ${q(g, 0.99)}   worst ${Math.round(g[g.length - 1])}`);
    process.exit(0);
  }
  setTimeout(() => { console.log('never reached a match'); process.exit(2); }, (SECONDS + 25) * 1000);
})();
