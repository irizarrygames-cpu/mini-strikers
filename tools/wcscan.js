// The online World Cup, run against the real server game code with fake sockets.
//   node tools/wcscan.js
// Win and you go to the next round; lose or walk off and you're out; win the final and you're
// champion (then it starts again); no draws; players at the same round meet each other; an
// ordinary online match isn't touched by any of it.
const { createGame } = require('../server/game');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
}

// the run lives on the account, like server.js keeps it
const runs = {};
const worldCup = {
  round: (id) => (runs[id] ? runs[id].round : 0),
  result(id, won) {
    const w = runs[id] || { round: 0, titles: 0 };
    const champion = won && w.round === 3;
    runs[id] = { round: won && !champion ? w.round + 1 : 0, titles: w.titles + (champion ? 1 : 0) };
    return { round: runs[id].round, champion, titles: runs[id].titles };
  },
};
const game = createGame({ getUser: () => ({ club: 'spain', save: {} }), userName: (id) => id.toUpperCase(), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false, worldCup });

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
async function waitFor(ws, t, after, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(50); }
  return null;
}
// play the match out with this score for `id`'s side (the engine ends it at full time)
async function finishWith(id, mine, theirs) {
  const room = game._roomOf(id), m = room.m, seat = room.seats.find((s) => s.userId === id);
  while (m.phase !== 'play') await sleep(50);
  const other = seat.team === 'blue' ? 'red' : 'blue';
  m.score[seat.team] = mine; m.score[other] = theirs;
  m.time = 0.05;
  return room;
}

(async () => {
  console.log('win the round of 16, go through to the quarter-final');
  {
    const ws = connect('p1');
    const n = ws.got.length;
    const tq = Date.now();
    ws.msg({ t: 'queue', format: '1v1', wc: true });
    const q = await waitFor(ws, 'queue', n);
    check('queued for the round of 16', q && q.wc === 0, q && q.wc);
    const st = await waitFor(ws, 'start', n);
    const waited = (Date.now() - tq) / 1000;
    check('nobody else coming: the empty spots fill after 30s (30-34s)', waited >= 30 && waited <= 34.5, +waited.toFixed(1));
    check('the match is a World Cup round of 16', st && st.wc === 0, st && st.wc);
    const fr = game._roomOf('p1');
    check('the fill-ins play at the strong online level', fr && fr.m.diff.aiDodge >= 0.6 && fr.m.diff.mistakes <= 0.6 && fr.m.diff.aiShotNoise <= 24, fr && { dodge: fr.m.diff.aiDodge, mistakes: fr.m.diff.mistakes, noise: fr.m.diff.aiShotNoise });
    const room = await finishWith('p1', 2, 1);
    check('no draws in a World Cup match', room.m.noDraw === true);
    const end = await waitFor(ws, 'end', n);
    check('won: through to round 1 (quarter-final)', end && end.wc && end.wc.won && end.wc.next === 1 && !end.wc.champion, end && end.wc);
    check('the account run moved on', runs.p1.round === 1, runs.p1);
  }

  console.log('lose the quarter-final: knocked out, the next run starts at the round of 16');
  {
    const ws = socks.p1, n = ws.got.length;
    await sleep(300);
    ws.msg({ t: 'queue', format: '1v1', wc: true });
    const st = await waitFor(ws, 'start', n);
    check('the next match is the quarter-final', st && st.wc === 1, st && st.wc);
    await finishWith('p1', 0, 3);
    const end = await waitFor(ws, 'end', n);
    check('lost: out, back to the round of 16', end && end.wc && !end.wc.won && end.wc.next === 0, end && end.wc);
  }

  console.log('win the final: world champions, +1 title, the next run starts again');
  {
    runs.p1 = { round: 3, titles: 0 };
    const ws = socks.p1, n = ws.got.length;
    await sleep(300);
    ws.msg({ t: 'queue', format: '1v1', wc: true });
    const st = await waitFor(ws, 'start', n);
    check('the match is the final', st && st.wc === 3, st && st.wc);
    await finishWith('p1', 1, 0);
    const end = await waitFor(ws, 'end', n);
    check('champion, one title, back to round 0', end && end.wc && end.wc.champion && end.wc.titles === 1 && end.wc.next === 0, end && end.wc);
  }

  console.log('a draw at full time goes to golden goal and never ends as a draw');
  {
    const ws = socks.p1, n = ws.got.length;
    await sleep(300);
    ws.msg({ t: 'queue', format: '1v1', wc: true });
    await waitFor(ws, 'start', n);
    const room = await finishWith('p1', 1, 1);
    await sleep(800);
    check('level at full time: golden goal, not the end', room.m.overtime === true && !ws.got.slice(n).some((x) => x.t === 'end'), { overtime: room.m.overtime });
    room.m.otTime = 500;
    await sleep(800);
    check('still no end long past the normal overtime', !ws.got.slice(n).some((x) => x.t === 'end'));
    const seat = room.seats.find((s) => s.userId === 'p1');
    room.m.score[seat.team] = 2; // the golden goal (set straight on the score, then the clock settles it)
    room.m.overtime = false; room.m.time = 0.05;
    const end = await waitFor(ws, 'end', n);
    check('decided: a win and through', end && end.wc && end.wc.won, end && end.wc);
  }

  console.log('walking off a World Cup match knocks you out');
  {
    runs.p1 = { round: 2, titles: 1 };
    const ws = socks.p1, n = ws.got.length;
    await sleep(300);
    ws.msg({ t: 'queue', format: '1v1', wc: true });
    const st = await waitFor(ws, 'start', n);
    check('semi-final', st && st.wc === 2, st && st.wc);
    const room = game._roomOf('p1');
    while (room.m.phase !== 'play') await sleep(50);
    ws.msg({ t: 'leave' });
    await sleep(200);
    check('out: back to the round of 16, titles kept', runs.p1.round === 0 && runs.p1.titles === 1, runs.p1);
  }

  console.log('two real players at the same round meet each other');
  {
    runs.a = { round: 1, titles: 0 }; runs.b = { round: 1, titles: 0 }; runs.c = { round: 0, titles: 0 };
    const wa = connect('a'), wb = connect('b'), wc = connect('c');
    wc.msg({ t: 'queue', format: '1v1', wc: true });
    wa.msg({ t: 'queue', format: '1v1', wc: true });
    wb.msg({ t: 'queue', format: '1v1', wc: true });
    const sa = await waitFor(wa, 'start', 0, 3000), sb = await waitFor(wb, 'start', 0, 3000);
    check('same round: straight into one match together', sa && sb && sa.room === sb.room && sa.wc === 1, sa && sb && { a: sa.room, b: sb.room });
    check('the player at another round is not in it', !(await waitFor(wc, 'start', 0, 500)) || (wc.last('start').room !== (sa && sa.room)));
  }

  console.log('an ordinary online match is not a World Cup match');
  {
    const ws = connect('o1'), n = ws.got.length;
    ws.msg({ t: 'queue', format: '2v2' });
    const q = await waitFor(ws, 'queue', n);
    check('ordinary queue', q && (q.wc === null || q.wc === undefined), q && q.wc);
    const st = await waitFor(ws, 'start', n);
    check('ordinary match (wc null)', st && (st.wc === null || st.wc === undefined), st && st.wc);
    const room = await finishWith('o1', 1, 1);
    const end = await waitFor(ws, 'end', n, 120000 * 0 + 8000);
    check('a level ordinary match may still go to golden goal but carries no World Cup result', room.m.noDraw === false && (!end || !end.wc), { noDraw: room.m.noDraw, wc: end && end.wc });
    check('nobody\'s run touched', !runs.o1);
  }

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
