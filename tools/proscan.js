// PRO MATCH online (build 116), run against the real server game code with fake sockets.
//   node tools/proscan.js
// PRO MATCH has queues of its own (pro/2v2, pro/3v3, pro/4v4) and a PRO switch in private rooms. Its
// rooms play in a sandbox of their own on the bigger pitch, side by side with ordinary rooms on the
// normal one. The snapshots carry the restart (phase 'restart', rs) and the thrower's pose, the taker's
// PASS takes it, and a game too old to draw the big pitch is kept out of all of it.
const { createGame } = require('../server/game');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
}
const users = {};
for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'old1', 'n1', 'n2']) users[id] = { club: 'spain', save: {} };
const game = createGame({ getUser: (id) => users[id], userName: (id) => id.toUpperCase(), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false });

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id, pro = true) => { socks[id] = new FakeWS(); game.connect(socks[id], id); socks[id].msg({ t: 'arena', club: null, pro: pro ? 1 : undefined }); return socks[id]; };
async function waitFor(ws, pred, after = 0, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (pred(ws.got[i])) return ws.got[i]; await sleep(25); }
  return null;
}
const PH_RESTART = 8, PH_PLAY = 1;

(async () => {
  for (const id of Object.keys(users)) connect(id, id !== 'old1');

  console.log('who can ask for PRO MATCH, and for what');
  {
    let n = socks.old1.got.length;
    socks.old1.msg({ t: 'queue', format: 'pro/2v2' });
    const e = await waitFor(socks.old1, (x) => x.t === 'error', n, 1000);
    check('a game too old for the big pitch is turned away, and told why', e && /new version of the game for PRO MATCH/.test(e.msg), e);
    n = socks.p1.got.length;
    socks.p1.msg({ t: 'queue', format: 'pro/1v1' });
    const e2 = await waitFor(socks.p1, (x) => x.t === 'error', n, 1000);
    check('there is no PRO MATCH 1v1', e2 && /Pick a format/.test(e2.msg), e2);
    n = socks.p1.got.length;
    socks.p1.msg({ t: 'queue', format: 'pro/3v3', wc: true });
    const e3 = await waitFor(socks.p1, (x) => x.t === 'error', n, 1000);
    check('nor a PRO MATCH World Cup', !!e3, e3);
  }

  console.log('four players in the pro/2v2 queue');
  const before = Object.fromEntries(['p1', 'p2', 'p3', 'p4'].map((id) => [id, socks[id].got.length]));
  for (const id of ['p1', 'p2', 'p3', 'p4']) socks[id].msg({ t: 'queue', format: 'pro/2v2' });
  const q = await waitFor(socks.p1, (x) => x.t === 'queue', before.p1, 2000);
  check('the queue says which one it is', q && q.format === 'pro/2v2', q);
  const starts = await Promise.all(['p1', 'p2', 'p3', 'p4'].map((id) => waitFor(socks[id], (x) => x.t === 'start', before[id], 5000)));
  check('one match for all four, at once (no waiting for fill-ins)', starts.every((s) => s && s.room === starts[0].room), starts.map((s) => s && s.room));
  check('it starts as a PRO MATCH, 2v2', starts.every((s) => s && s.pro === true && s.format === '2v2'), starts[0] && { pro: starts[0].pro, format: starts[0].format });
  const room = game._roomOf('p1');
  check('the room plays by the rules', room && room.pro && room.m.rules === true, room && { pro: room.pro, rules: room.m.rules });

  console.log('an ordinary room at the same time');
  {
    const n1 = socks.n1.got.length;
    socks.n1.msg({ t: 'room.create', format: '2v2' });
    const lob = await waitFor(socks.n1, (x) => x.t === 'room', n1, 1000);
    socks.n2.msg({ t: 'room.join', code: lob.code });
    await sleep(100);
    socks.n1.msg({ t: 'room.start' });
    const st = await waitFor(socks.n1, (x) => x.t === 'start', n1, 2000);
    check('an ordinary room is not PRO', st && !st.pro, st && st.pro);
    const nr = game._roomOf('n1');
    check('and does not play by the rules', nr && !nr.pro && nr.m.rules === false);
  }

  // both kick off: the ball is on the centre spot of each one's own pitch
  const nroom = game._roomOf('n1');
  for (let i = 0; i < 200 && (room.m.phase !== 'play' || nroom.m.phase !== 'play'); i++) await sleep(50);
  check('the PRO room kicks off in the middle of the big pitch (3000 wide)', Math.abs(room.m.ball.x - 1500) < 80, Math.round(room.m.ball.x));
  check('the ordinary room in the middle of the normal one (2400 wide)', Math.abs(nroom.m.ball.x - 1200) < 80, Math.round(nroom.m.ball.x));

  console.log('a throw-in, online');
  {
    const seat = room.seats.find((s) => s.userId === 'p1'), me = seat.player, ws = socks.p1;
    const other = me.team === 'blue' ? 'red' : 'blue';
    const m = room.m, b = m.ball;
    // the ball goes out off the other side, right by p1: p1's throw
    for (const p of m.players) if (p !== me && !p.isKeeper && Math.hypot(p.x - 1500, p.y) < 500) p.y = 900;
    me.x = 1500; me.y = 60; me.noPickupT = 1;
    if (b.owner) b.owner = null;
    b.x = 1500; b.y = -12; b.vx = 0; b.vy = -50; b.z = 0; b.shot = null; b.lastTouchTeam = other;
    const n = ws.got.length;
    const snap = await waitFor(ws, (x) => x.t === 's' && x.ph === PH_RESTART && Array.isArray(x.rs), n, 3000);
    check('the snapshots say a restart is on, and what it is', !!snap && snap.rs[0] === 0, snap && snap.rs);
    const you = starts[0] && room.m.players.indexOf(me);
    check("it is p1's to take (the nearest of the side that did not touch it)", snap && snap.rs[2] === you && snap.rs[1] === (me.team === 'red' ? 1 : 0), snap && { rs: snap.rs, you });
    check('the thrower is drawn with the ball over their head', snap && (snap.p[you][7] & 32) === 32 && snap.b[2] > 40, snap && { flags: snap.p[you][7], z: snap.b[2] });
    check('the clock has stopped', snap && (await (async () => { const t0 = m.time; await sleep(300); return m.time === t0 && m.phase === 'restart'; })()));
    const banner = ws.got.slice(n).some((x) => x.t === 's' && x.ev.some((e) => e.e === 'f' && e.n === 'showBanner' && e.a[0] === 'THROW-IN'));
    const whistle = ws.got.slice(n).some((x) => x.t === 's' && x.ev.some((e) => e.e === 's' && e.n === 'whistle'));
    check('everyone gets the THROW-IN banner and the whistle', banner && whistle, { banner, whistle });
    // p1 aims into the pitch and presses PASS
    const n2 = ws.got.length;
    ws.msg({ t: 'i', s: 1, x: 0.3, y: 1, sp: 0, a: 32 });
    await sleep(60);
    ws.msg({ t: 'i', s: 2, x: 0.3, y: 1, sp: 0, a: 1 });
    const back = await waitFor(ws, (x) => x.t === 's' && x.ph === PH_PLAY, n2, 2000);
    check("p1's PASS takes it, and play goes on", !!back && !back.rs, back && back.ph);
    check('thrown into the pitch, not back out', back && back.b[4] > 0, back && back.b.slice(0, 6));
  }

  console.log('nobody stands about: a restart a bot takes');
  {
    const m = room.m, b = m.ball;
    const n = socks.p2.got.length;
    // over p1's own goal line wide of the post, off the other side: a goal kick, which a keeper takes
    const seat = room.seats.find((s) => s.userId === 'p1');
    const own = seat.team === 'blue' ? 0 : 3000, other = seat.team === 'blue' ? 'red' : 'blue';
    if (b.owner) b.owner = null;
    b.x = own === 0 ? -12 : 3012; b.y = 200; b.vx = 0; b.vy = 0; b.z = 0; b.shot = null; b.lastTouchTeam = other;
    const snap = await waitFor(socks.p2, (x) => x.t === 's' && x.ph === PH_RESTART && x.rs, n, 3000);
    check('a goal kick, taken by a keeper', snap && snap.rs[0] === 2 && m.players[snap.rs[2]] && m.players[snap.rs[2]].isKeeper, snap && snap.rs);
    const back = await waitFor(socks.p2, (x) => x.t === 's' && x.ph === PH_PLAY, n, 3000);
    check('taken within a second and a half', !!back);
  }

  console.log('the ordinary room never has one');
  {
    const ws = socks.n1, start = ws.got.findIndex((x) => x.t === 'start');
    const seen = ws.got.slice(start).filter((x) => x.t === 's');
    check('no restart phase, no rs, in all its snapshots', seen.length > 30 && !seen.some((x) => x.ph === PH_RESTART || x.rs), seen.length);
  }

  console.log('a private room with PRO MATCH on');
  {
    let n = socks.p5.got.length;
    socks.p5.msg({ t: 'room.create', format: '3v3' });
    let lob = await waitFor(socks.p5, (x) => x.t === 'room', n, 1000);
    n = socks.p5.got.length;
    socks.p5.msg({ t: 'room.pro', on: true });
    lob = await waitFor(socks.p5, (x) => x.t === 'room', n, 1000);
    check('the host switches it on, and the room says so', lob && lob.pro === true, lob && lob.pro);
    n = socks.old1.got.length;
    socks.old1.msg({ t: 'room.join', code: lob.code });
    const e = await waitFor(socks.old1, (x) => x.t === 'error', n, 1000);
    check('a game too old for it cannot join', e && /PRO MATCH/.test(e.msg), e);
    n = socks.p6.got.length;
    socks.p6.msg({ t: 'room.join', code: lob.code });
    const j = await waitFor(socks.p6, (x) => x.t === 'room', n, 1000);
    check('a new one can', j && j.pro === true && j.players.length === 2, j && j.players.length);
    n = socks.p5.got.length;
    socks.p5.msg({ t: 'room.format', format: '1v1' });
    lob = await waitFor(socks.p5, (x) => x.t === 'room', n, 1000);
    check('1v1 switches it off (PRO MATCH is 2v2 and up)', lob && lob.format === '1v1' && lob.pro === false, lob && { f: lob.format, pro: lob.pro });
    socks.p5.msg({ t: 'room.format', format: '3v3' }); await sleep(50);
    socks.p5.msg({ t: 'room.pro', on: true }); await sleep(50);
    n = socks.p6.got.length;
    socks.p5.msg({ t: 'room.start' });
    const st = await waitFor(socks.p6, (x) => x.t === 'start', n, 2000);
    check('it starts as a PRO MATCH 3v3', st && st.pro === true && st.format === '3v3', st && { pro: st.pro, f: st.format });
    const r = game._roomOf('p5');
    check('on the big pitch, with the rules', r && r.pro && r.m.rules, r && r.pro);
  }

  console.log(failures ? `\n${failures} FAILED` : '\nall good');
  for (const ws of Object.values(socks)) ws.close();
  process.exit(failures ? 1 : 0);
})();
