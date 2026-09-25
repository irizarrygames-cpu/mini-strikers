// Watching a friend's match, run against the real server game code with fake sockets.
//   node tools/watchscan.js
// A viewer takes no seat: they get the same start card and the same snapshots as the friend they
// are watching (minus the "that's you" bits), they see the chat, they can't touch the game, and
// they are sent home when the match ends.
const { createGame } = require('../server/game');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  removeListener() {}
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
  since(n, t) { return this.got.slice(n).filter((m) => m.t === t); }
}

const users = {};
const account = (id) => (users[id] = users[id] || { name: id.toUpperCase(), club: 'spain', save: { xp: 0 } });
const game = createGame({
  getUser: (id) => users[id], userName: (id) => (users[id] ? users[id].name : id.toUpperCase()),
  saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false,
});

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { account(id); socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);
const befriend = (p, q) => { say(p, { t: 'friend.add', name: q }); say(q, { t: 'friend.accept', name: p }); };
async function waitFor(ws, t, after, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(25); }
  return null;
}

(async () => {
  for (const id of ['watchplay', 'watchfoe', 'watchfan', 'watchodd']) connect(id);
  befriend('watchplay', 'watchfan');   // the fan can watch the player
  befriend('watchodd', 'watchfan');    // ...but watchodd is never in a match

  console.log('you can only watch a friend who is actually playing');
  let n = socks.watchfan.got.length;
  say('watchfan', { t: 'watch', name: 'WATCHFOE' });
  check('not your friend: no', !!socks.watchfan.since(n, 'error').length, socks.watchfan.last('error'));
  n = socks.watchfan.got.length;
  say('watchfan', { t: 'watch', name: 'WATCHODD' });
  check('a friend who is not in a match: no', !!socks.watchfan.since(n, 'error').length, socks.watchfan.last('error'));
  n = socks.watchfan.got.length;
  say('watchfan', { t: 'watch', name: 'NOBODY-AT-ALL' });
  check('a name that is nobody: no', !!socks.watchfan.since(n, 'error').length);

  console.log('watching a real match');
  say('watchplay', { t: 'queue', format: '1v1' }); say('watchfoe', { t: 'queue', format: '1v1' });
  const started = await waitFor(socks.watchplay, 'start', 0);
  check('the match started', !!started);
  const room = game._roomOf('watchplay');
  while (room.m.phase !== 'play') await sleep(30);

  n = socks.watchfan.got.length;
  say('watchfan', { t: 'watch', name: 'WATCHPLAY' });
  const view = await waitFor(socks.watchfan, 'start', n, 2000);
  check('the fan gets the match', !!view);
  check('and is told whose match it is', view && view.watch === 'WATCHPLAY', view && view.watch);
  check('they see it from their friend\'s side', view && view.side === started.side && view.you === started.you, view && { side: view.side, you: view.you });
  check('with the same players and clubs', view && view.players.length === started.players.length && view.room === started.room);
  check('watching takes no seat in the match', room.seats.every((s) => s.userId !== 'watchfan'));
  check('and the game does not think they are playing', !game.inMatch('watchfan'));

  n = socks.watchfan.got.length;
  const before = socks.watchplay.got.filter((m) => m.t === 's').length;
  await sleep(400);
  const snaps = socks.watchfan.since(n, 's'), playerSnaps = socks.watchplay.got.filter((m) => m.t === 's').length - before;
  check('snapshots keep coming while they watch', snaps.length > 2, snaps.length);
  check('as many as the player gets', Math.abs(snaps.length - playerSnaps) <= 1, [snaps.length, playerSnaps]);
  check('every one says "there is no you"', snaps.every((s) => s.me === null));
  check('and carries the ball and the players', snaps.every((s) => Array.isArray(s.p) && s.p.length && Array.isArray(s.b)));

  console.log('a viewer cannot touch the match');
  const scoreBefore = { ...room.m.score };
  const posBefore = { x: room.m.players[0].x, y: room.m.players[0].y };
  say('watchfan', { t: 'i', k: 1, x: 100, y: 100, b: 255 });
  say('watchfan', { t: 'leave' });
  say('watchfan', { t: 'chat', m: 0 });
  await sleep(120);
  check('their input never lands in the match', !game._roomOf('watchfan'), posBefore.x === room.m.players[0].x ? 'still' : 'moving');
  check('their "leave" does not end the match', room.state === 'playing' && !!game._roomOf('watchplay'));
  check('the score is untouched', room.m.score.blue === scoreBefore.blue && room.m.score.red === scoreBefore.red);
  check('both players are still in their seats', room.seats.filter((s) => s.human).length === 2);

  console.log('they see the chat');
  n = socks.watchfan.got.length;
  say('watchplay', { t: 'chat', m: 0 });
  await sleep(60);
  const chat = socks.watchfan.since(n, 'chat');
  check('a line said in the match reaches the viewer', chat.length === 1, chat.length);
  check('and points at who said it', chat.length === 1 && chat[0].p >= 0);

  console.log('watching ends when the match does');
  n = socks.watchfan.got.length;
  room.m.score.blue = 2; room.m.score.red = 1; // a 0-0 would go to golden goal instead
  room.m.time = 0.05;
  const over = await waitFor(socks.watchfan, 'watch.end', n, 8000);
  check('the viewer is sent home', !!over);
  check('with the final score', !!(over && /\d-\d/.test(over.msg || '')), over && over.msg);
  check('they get no results screen of their own', !socks.watchfan.since(n, 'end').length);
  check('the players still got theirs', !!socks.watchplay.last('end'));

  console.log('you cannot watch while you are busy yourself');
  for (const id of ['w2a', 'w2b', 'w2c']) connect(id);
  befriend('w2a', 'w2c');
  say('w2a', { t: 'queue', format: '1v1' }); say('w2b', { t: 'queue', format: '1v1' });
  await waitFor(socks.w2a, 'start', 0);
  const room2 = game._roomOf('w2a');
  while (room2.m.phase !== 'play') await sleep(30);
  n = socks.w2c.got.length;
  say('w2c', { t: 'queue', format: '4v4' });
  say('w2c', { t: 'watch', name: 'W2A' });
  await sleep(80);
  check('searching for a match blocks it', !socks.w2c.since(n, 'start').length && !!socks.w2c.since(n, 'error').length, socks.w2c.last('error'));
  say('w2c', { t: 'unqueue' });
  await sleep(60);

  console.log('leaving under your own steam');
  n = socks.w2c.got.length;
  say('w2c', { t: 'watch', name: 'W2A' });
  check('watching again works', !!(await waitFor(socks.w2c, 'start', n, 2000)));
  check('the room has a viewer', room2.viewers && room2.viewers.size === 1);
  say('w2c', { t: 'unwatch' });
  await sleep(60);
  check('unwatch drops them', !room2.viewers.size);
  n = socks.w2c.got.length;
  await sleep(300);
  check('and the snapshots stop', !socks.w2c.since(n, 's').length, socks.w2c.since(n, 's').length);

  console.log('a viewer who disappears is cleaned up');
  say('w2c', { t: 'watch', name: 'W2A' });
  await sleep(80);
  check('watching once more', room2.viewers.size === 1);
  socks.w2c.close();
  await sleep(80);
  check('a closed socket is dropped from the room', room2.viewers.size === 0);
  const survives = room2.state === 'playing';
  check('and the match carries on', survives, room2.state);

  // tidy: end the second match
  room2.m.score.blue = 1; room2.m.time = 0.05;
  await waitFor(socks.w2a, 'end', 0, 8000);

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
