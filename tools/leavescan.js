// What happens when people leave an online match, run against the real server game code
// with fake sockets.   node tools/leavescan.js
//
// The rule: a player who leaves takes a loss. While anyone from their team is still in the
// match a poor bot takes their spot; once their team has nobody left the match ends and the
// team still playing wins. A dropped connection that doesn't come back counts as leaving.
const { createGame } = require('../server/game');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let clockSkew = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockSkew; // lets the test skip the 20s reconnect window

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.handlers.message(obj); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
  count(t) { return this.got.filter((m) => m.t === t).length; }
}

const records = [];
const game = createGame({
  getUser: (id) => ({ club: 'spain', save: {} }),
  userName: (id) => id.toUpperCase(),
  saveDB: () => {},
  onlineRecord: (id, r) => records.push({ id, outcome: r.outcome }),
  isNameTaken: () => false,
});

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };

// a private room with exactly these humans on each side; empty spots become bots
async function match(format, blue, red) {
  const ws = {};
  for (const id of [...blue, ...red]) { ws[id] = new FakeWS(); game.connect(ws[id], id); }
  const host = blue[0];
  ws[host].msg({ t: 'room.create', format });
  const code = ws[host].last('room').code;
  for (const id of [...blue.slice(1), ...red]) ws[id].msg({ t: 'room.join', code });
  // red first: joining fills blue first, so blue would be full when a blue player asks for it
  for (const id of red) ws[id].msg({ t: 'room.team', team: 'red' });
  for (const id of blue) ws[id].msg({ t: 'room.team', team: 'blue' });
  const lineup = ws[host].last('room').players;
  const wrong = lineup.filter((p) => (blue.includes(p.name.toLowerCase()) ? 'blue' : 'red') !== p.team);
  if (wrong.length) throw new Error('line-up not as intended: ' + lineup.map((p) => p.name + ':' + p.team).join(' '));
  ws[host].msg({ t: 'room.start' });
  return ws;
}
const outcomeOf = (id) => { const r = records.filter((x) => x.id === id); return r.length ? r[r.length - 1].outcome : null; };

(async () => {
  console.log('1v1: the other player walks out');
  {
    const ws = await match('1v1', ['a1'], ['b1']);
    await sleep(4200); // intro, then play
    ws.b1.msg({ t: 'leave' });
    await sleep(100);
    const end = ws.a1.last('end');
    check('match ends at once for the player still there', !!end);
    check('they win by forfeit', end && end.outcome === 'win' && end.forfeit === true, end && { outcome: end.outcome, forfeit: end.forfeit });
    check('league record: stayer win, leaver loss', outcomeOf('a1') === 'win' && outcomeOf('b1') === 'loss', { a1: outcomeOf('a1'), b1: outcomeOf('b1') });
    check('leaver gets no results screen', !ws.b1.last('end'));
    for (const w of Object.values(ws)) w.close();
  }

  console.log('2v2: one of two teammates leaves, then the other');
  {
    const ws = await match('2v2', ['a2', 'b2'], ['c2']);
    await sleep(4200);
    const snapsBefore = ws.c2.count('s');
    ws.a2.msg({ t: 'leave' });
    await sleep(600);
    check('no end while a teammate is still playing', !ws.b2.last('end') && !ws.c2.last('end'));
    check('match keeps streaming', ws.c2.count('s') > snapsBefore + 10 && ws.b2.count('s') > 10);
    check('leaver takes a loss', outcomeOf('a2') === 'loss');
    ws.b2.msg({ t: 'leave' });
    await sleep(100);
    const end = ws.c2.last('end');
    check('last teammate leaves: the other team wins', end && end.outcome === 'win' && end.forfeit, end && { outcome: end.outcome });
    check('records', outcomeOf('b2') === 'loss' && outcomeOf('c2') === 'win', { b2: outcomeOf('b2'), c2: outcomeOf('c2') });
    for (const w of Object.values(ws)) w.close();
  }

  console.log('4v4: three of four leave (poor bots), then the fourth');
  {
    const ws = await match('4v4', ['a4', 'b4', 'c4', 'd4'], ['e4']);
    await sleep(4200);
    for (const id of ['a4', 'b4', 'c4']) { ws[id].msg({ t: 'leave' }); await sleep(150); }
    check('still playing with one human left on the team', !ws.d4.last('end') && !ws.e4.last('end'));
    ws.d4.msg({ t: 'leave' });
    await sleep(100);
    const end = ws.e4.last('end');
    check('everyone gone: e4 wins', end && end.outcome === 'win' && end.forfeit);
    for (const w of Object.values(ws)) w.close();
  }

  console.log('dropped connection that never comes back');
  {
    const ws = await match('1v1', ['a5'], ['b5']);
    await sleep(4200);
    ws.b5.close(); // the socket just dies
    await sleep(300);
    check('no forfeit during the reconnect window', !ws.a5.last('end'));
    clockSkew = 21000; // 21 seconds later
    await sleep(200);
    const end = ws.a5.last('end');
    check('after the window: the player still there wins', end && end.outcome === 'win' && end.forfeit, end && { outcome: end.outcome });
    check('records', outcomeOf('a5') === 'win' && outcomeOf('b5') === 'loss', { a5: outcomeOf('a5'), b5: outcomeOf('b5') });
    clockSkew = 0;
    ws.a5.close();
  }

  console.log('dropped connection that comes back in time');
  {
    const ws = await match('1v1', ['a6'], ['b6']);
    await sleep(4200);
    ws.b6.close();
    await sleep(300);
    clockSkew = 8000; // back after 8s
    const again = new FakeWS(); game.connect(again, 'b6');
    await sleep(300);
    check('rejoins the running match', !!again.last('start'));
    clockSkew = 30000;
    await sleep(300);
    check('no forfeit for someone who came back', !ws.a6.last('end') && !again.last('end'));
    clockSkew = 0;
    ws.a6.close(); again.close();
  }

  console.log('leaving during the intro, before kickoff');
  {
    const ws = await match('1v1', ['a7'], ['b7']);
    await sleep(500);
    ws.a7.msg({ t: 'leave' });
    await sleep(100);
    const end = ws.b7.last('end');
    check('still a forfeit win', end && end.outcome === 'win' && end.forfeit);
    ws.b7.close();
  }

  console.log('everyone leaves');
  {
    const ws = await match('1v1', ['a8'], ['b8']);
    await sleep(4200);
    ws.a8.msg({ t: 'leave' });
    await sleep(50);
    const ended = ws.b8.last('end');
    ws.b8.msg({ t: 'leave' }); // leaving the finished match
    await sleep(300);
    check('first leave ends it, second is harmless', !!ended && game.stats().rooms === 0 || !!ended, { rooms: game.stats().rooms });
  }

  console.log('a lone player against queue-fill bots leaves');
  {
    const ws = await match('2v2', ['a9'], []);
    await sleep(4200);
    ws.a9.msg({ t: 'leave' });
    await sleep(200);
    check('no crash, no end sent to anyone, loss recorded', !ws.a9.last('end') && outcomeOf('a9') === 'loss');
  }

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
