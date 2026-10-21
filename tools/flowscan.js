// Flow control for online matches: a player who falls behind must not be buried in stale pictures.
//   node tools/flowscan.js            (about two minutes)
//
// Part 1, in this process, with the real server code and a fake socket whose acknowledgements we control:
//   - a player who acknowledges every snapshot gets all of them (full rate)
//   - one who stops acknowledging is slowed to a trickle instead of being sent a queue
//   - nothing that happened while snapshots were being skipped is lost or doubled: five marker
//     events are slipped into the match during the slowdown and each must arrive exactly once
//   - an older copy of the game, which sends no acknowledgements, is never throttled
// Part 2, a real server and a real bad connection (tools/netproxy.js), timed by tools/snapprobe.js:
//   - on a link too slow for the stream, the picture stays within a second of live (it used to fall
//     seconds behind and keep falling)
//   - on a clean link nothing changes
const { createGame } = require('../server/game');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.join(__dirname, '..');

// ================= Part 1: the send loop =================
function makeGame() {
  const game = createGame({ getUser: () => ({ club: 'spain', save: {} }), userName: (id) => id.toUpperCase(), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false });
  const got = [];
  const ws = { open: true, backlog: 0, lastSeen: Date.now(), h: {}, on(ev, fn) { this.h[ev] = fn; }, send(s) { if (s.startsWith('{"t":"s"')) got.push({ at: Date.now(), msg: JSON.parse(s) }); }, close() { this.open = false; } };
  game.connect(ws, 'tester');
  let seq = 0;
  const input = (k) => ws.h.message({ t: 'i', s: ++seq, x: 0, y: 0, sp: 0, a: 0, ...(k === undefined ? {} : { k }) });
  return { game, ws, got, input };
}
async function startMatch(t) {
  t.ws.h.message({ t: 'room.create', format: '1v1' });
  await sleep(100);
  t.ws.h.message({ t: 'room.start' });
  const until = Date.now() + 20000;
  while (!t.got.length && Date.now() < until) await sleep(20);
  return t.got.length > 0;
}
// acknowledge every snapshot the moment it arrives, for `ms`
async function ackFor(t, ms) {
  const end = Date.now() + ms; let seen = t.got.length;
  while (Date.now() < end) { while (seen < t.got.length) t.input(t.got[seen++].msg.k); await sleep(5); }
}

async function part1() {
  console.log('part 1: the send loop');
  const t = makeGame();
  check('a match starts', await startMatch(t));
  const room = t.game._roomOf('tester');

  // full rate while the player keeps up
  let c0 = t.got.length;
  await ackFor(t, 3000);
  const fast = t.got.length - c0;
  check('a player who acknowledges everything gets every snapshot (~30 a second)', fast >= 80, { in3s: fast });

  // goes quiet: no acknowledgements for 3 seconds, with markers slipped into the match meanwhile
  c0 = t.got.length;
  const markers = [1, 2, 3, 4, 5];
  const t1 = Date.now();
  let mi = 0;
  while (Date.now() - t1 < 3000) {
    t.input(); // still sends input, but says nothing about what it has received
    if (mi < markers.length && Date.now() - t1 > 400 + mi * 450) room.events.push({ e: 'marker', n: markers[mi++] });
    await sleep(20);
  }
  const slow = t.got.length - c0;
  check('one who stops acknowledging is slowed to a trickle, not sent a queue', slow <= 30, { in3s: slow, wouldHaveBeen: '~90' });
  check('but is never forgotten: a snapshot at least every quarter second', slow >= 8, { in3s: slow });

  // catches up again
  c0 = t.got.length;
  await ackFor(t, 1500);
  check('and goes back to full rate the moment it catches up', t.got.length - c0 >= 35, { in1_5s: t.got.length - c0 });
  await sleep(100); await ackFor(t, 200);

  // every marker arrived once
  const seen = new Map();
  for (const g of t.got) for (const e of g.msg.ev || []) if (e.e === 'marker') seen.set(e.n, (seen.get(e.n) || 0) + 1);
  check('every event that happened while snapshots were skipped still arrived', markers.every((n) => seen.has(n)), [...seen.entries()]);
  check('and none of them arrived twice', markers.every((n) => seen.get(n) === 1), [...seen.entries()]);
  const order = []; for (const g of t.got) for (const e of g.msg.ev || []) if (e.e === 'marker') order.push(e.n);
  check('in the order they happened', order.join() === markers.join(), order);

  // a socket whose own queue is deep is skipped too, and its events are kept
  t.ws.backlog = 200 * 1024;
  c0 = t.got.length;
  room.events.push({ e: 'marker', n: 99 });
  await sleep(700);
  const deep = t.got.length - c0;
  t.ws.backlog = 0;
  check('a socket with a deep queue is skipped, not fed more (a probe every quarter second)', deep <= 4, { in0_7s: deep });
  await ackFor(t, 800);
  let n99 = 0; for (const g of t.got) for (const e of g.msg.ev || []) if (e.e === 'marker' && e.n === 99) n99++;
  check('and what happened meanwhile arrives once the queue is clear', n99 === 1, { n99 });

  // an older copy of the game never says what it has received: it must never be throttled
  const o = makeGame();
  check('an older game starts a match', await startMatch(o));
  const o0 = o.got.length;
  const e0 = Date.now();
  while (Date.now() - e0 < 3000) { o.input(); await sleep(20); }
  const old = o.got.length - o0;
  check('and gets the full rate with no acknowledgements at all', old >= 80, { in3s: old });
}

// ================= Part 2: a real bad connection =================
const PORT = 8494, PA = 8495, PB = 8496;
const children = [];
const spawnNode = (args, env) => { const c = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'ignore' }); children.push(c); return c; };
const probe = (port, secs, ack) => {
  const out = execFileSync(process.execPath, ['tools/snapprobe.js', String(port), String(secs), ...(ack ? ['--ack'] : [])], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const m = out.match(/(\d+) snapshots[^\n]*\nstale[^\n]*median (\d+)\s+p90 (\d+)\s+p99 (\d+)\s+worst (\d+)/);
  if (!m) throw new Error('could not read the probe: ' + out);
  return { snaps: +m[1], median: +m[2], p90: +m[3], p99: +m[4], worst: +m[5] };
};
async function part2() {
  console.log('part 2: a real bad connection');
  const data = path.join(os.tmpdir(), `ms-flowscan-${process.pid}.json`);
  spawnNode(['server.js', String(PORT)], { MS_DATA_FILE: data, DATABASE_URL: '' });
  spawnNode(['tools/netproxy.js', String(PA), String(PORT), '62', '0']);        // a clean link, 125 ms round trip
  spawnNode(['tools/netproxy.js', String(PB), String(PORT), '75', '14000']);    // too slow for the stream: 14 KB/s
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) break; } catch (e) { /* not yet */ } await sleep(100); }
  await sleep(500);

  const old = probe(PB, 22, false);
  const now = probe(PB, 22, true);
  console.log(`  (slow link: an old game is a median ${old.median} ms and at worst ${old.worst} ms behind; the new one ${now.median} and ${now.worst})`);
  check('on a link too slow for the stream, the picture stays close to live', now.median < 600 && now.p99 < 1500, now);
  check('where an older game falls seconds behind (so this test can tell the difference)', old.median > 1500, old);

  const clean = probe(PA, 18, true);
  check('on a clean link the new game is exactly as good as it was', clean.snaps >= 380 && clean.p99 < 120, clean);
  try { fs.unlinkSync(data); } catch (e) { /* not there */ }
}

(async () => {
  await part1();
  try { if (!process.env.FLOWSCAN_FAST) await part2(); } catch (e) { check('part 2 ran', false, String(e && e.message || e).slice(0, 300)); }
  for (const c of children) { try { c.kill(); } catch (e) { /* gone */ } }
  console.log(failures ? `\n${failures} FAILED` : '\nall flow-control checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); for (const c of children) { try { c.kill(); } catch (x) { /* gone */ } } process.exit(1); });
