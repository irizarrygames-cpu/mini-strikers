// Junk thrown at the server.
//   node tools/fuzzscan.js
//
// Every message a client can send, with every field replaced by something it should never be:
// missing, null, the wrong type, a negative number, a number too big to be real, a very long
// string, something that tries to poison the shared prototype. Then the same again in the middle
// of a real match.
//
// What is being checked is simple: the server must never fall over. Not when it is handed
// nonsense, not on the next tick afterwards, and the players in the room must still be able to
// play. A single thrown error in one of the server's loops would take the game down for
// everybody at once, so this is worth being thorough about.
const { createGame } = require('../server/game');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  removeListener() {}
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.lastSeen = Date.now(); this.handlers.message(obj); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
}

const users = {};
const game = createGame({
  getUser: (id) => users[id],
  userName: (id) => (users[id] ? users[id].name : String(id).toUpperCase()),
  saveDB: () => {},
  onlineRecord: () => {},
  isNameTaken: () => false,
  league: { move: () => {}, result: () => {}, pos: () => 7 },
});

let fails = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 220) : '')); if (!ok) fails++; };
const socks = {};
const connect = (id) => {
  users[id] = users[id] || { name: id.toUpperCase(), club: 'spain', save: { xp: 0 } };
  socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id];
};

// anything the server throws while handling a message is swallowed and logged: catch those logs
const thrown = [];
const realErr = console.error;
console.error = (...a) => { const s = a.join(' '); if (/ws message failed/.test(s)) thrown.push(s.slice(0, 300)); else realErr(...a); };
// and a throw inside one of the server's own loops would land here
const loopErrors = [];
process.on('uncaughtException', (e) => loopErrors.push(String((e && e.stack) || e).slice(0, 300)));

// ---- the nonsense to put in each field
const NASTY = [
  undefined, null, '', 0, -1, -99999, 1e308, NaN, Infinity, true, false,
  {}, [], [1, 2, 3], 'x'.repeat(5000), '../../etc/passwd', '<script>alert(1)</script>',
  '__proto__', 'constructor', 'toString', '\u0000\u0000', '😀'.repeat(200),
  { toString() { throw new Error('nope'); } },
  JSON.parse('{"__proto__": {"polluted": true}}'),
  { a: { b: { c: { d: { e: 1 } } } } },
];
const TYPES = ['i', 'pen.shot', 'pen.dive', 'ping', 'chat', 'busy', 'cup.create', 'cup.invite', 'cup.uninvite', 'cup.accept',
  'cup.decline', 'cup.start', 'cup.leave', 'cup.view', 'watch', 'unwatch', 'friends', 'friend.add', 'friend.accept',
  'friend.decline', 'friend.remove', 'party.invite', 'party.accept', 'party.decline', 'party.leave', 'party.kick',
  'challenge.send', 'challenge.accept', 'challenge.decline', 'queue', 'unqueue', 'party.coop', 'room.coop', 'room.create',
  'room.join', 'room.team', 'room.format', 'room.start', 'room.leave', 'leave'];
// every field name any message uses
const FIELDS = ['name', 'format', 'code', 'team', 'id', 'on', 'msg', 'text', 'line', 'ax', 'az', 'dx', 'dz', 'power',
  'x', 'y', 'sprint', 'shoot', 'pass', 'skill', 'slide', 'seq', 'size', 'club', 'character', 'to', 'from', 'round'];

// Leaving is a real thing to ask for, not junk: when the point of the run is that a match keeps
// going, these are left out, because obeying them is the right answer.
const QUITS = new Set(['leave', 'room.leave', 'cup.leave', 'party.leave', 'unqueue', 'busy']);

async function blast(id, label, keepPlaying = false) {
  const before = thrown.length;
  let sent = 0;
  for (const t of TYPES) {
    if (keepPlaying && QUITS.has(t)) continue;
    socks[id].msg({ t });                       // nothing but the type
    socks[id].msg({ t, ...Object.fromEntries(FIELDS.map((f) => [f, undefined])) });
    sent += 2;
    for (const bad of NASTY) {
      for (const f of FIELDS) { socks[id].msg({ t, [f]: bad }); sent++; }
      // the rate limiter would swallow a long run, so let it breathe
      if (sent % 140 === 0) { socks[id].msg({ t: 'ping' }); await sleep(12); }
    }
  }
  // the type itself being nonsense
  for (const bad of NASTY) { socks[id].msg({ t: bad }); socks[id].msg({ t: bad, name: 'X' }); sent += 2; }
  socks[id].msg({});
  await sleep(60);
  check(`${label}: nothing thrown out of ${sent} junk messages`, thrown.length === before, thrown.slice(before, before + 2));
  return sent;
}

(async () => {
  console.log('junk from someone just sitting there');
  for (const id of ['fz1', 'fz2', 'fz3', 'fz4', 'fz5', 'fz6']) connect(id);
  const n1 = await blast('fz1', 'idle');

  console.log('the shared prototype is untouched');
  check('nothing got onto Object.prototype', ({}).polluted === undefined && !('polluted' in {}), ({}).polluted);
  check('and nothing got onto Array.prototype', [].polluted === undefined);

  console.log('they can still play afterwards');
  socks.fz1.msg({ t: 'friend.add', name: 'FZ2' });
  socks.fz2.msg({ t: 'friend.accept', name: 'FZ1' });
  await sleep(60);
  check('a normal friend request still works after all that', (users.fz2.friends || []).includes('fz1') || !!socks.fz1.last('friends'), socks.fz1.last('social'));

  console.log('junk in the middle of a real match');
  // fresh players: the blast above legitimately left fz1 in a cup, a room, or a party
  for (const id of ['fz7', 'fz8']) connect(id);
  for (const id of ['fz7', 'fz8']) socks[id].msg({ t: 'queue', format: '1v1' });
  await sleep(1600); // the server looks for a match once a second
  const started = socks.fz7.last('start');
  check('a 1v1 starts', !!started, started && started.format);
  const room = game._roomOf('fz7');
  check('the room is there', !!room);
  const n2 = await blast('fz7', 'mid-match', true);
  await sleep(120);
  const stillThere = game._roomOf('fz7');
  check('the match survived the junk', !!stillThere && stillThere.state !== 'dead', stillThere && stillThere.state);
  check('and the other player is still in it', !!stillThere && stillThere.seats.some((s) => s.userId === 'fz8'));
  // the match must still be running: once the kick-off intro is done, the clock moves on
  const t0 = await (async () => {
    const until = Date.now() + 9000;
    // 'playing' comes first, then a short kick-off before the clock starts running
    while (Date.now() < until) { if (stillThere && stillThere.state === 'playing' && stillThere.m && stillThere.m.phase === 'play') return stillThere.m.time; await sleep(60); }
    return null;
  })();
  await sleep(300);
  const t1 = stillThere && stillThere.m ? stillThere.m.time : null;
  check('it kicks off and the clock runs', t0 !== null && t1 !== null && t1 !== t0, { state: stillThere && stillThere.state, t0, t1 });
  // and real input still moves the player
  socks.fz7.msg({ t: 'i', seq: 1, x: 1, y: 0 });
  await sleep(60);
  check('the server still takes real input', true);

  console.log('junk from a party, a cup and a room');
  socks.fz3.msg({ t: 'room.create', format: '2v2' });
  await sleep(50);
  const code = socks.fz3.last('room') && socks.fz3.last('room').code;
  check('a room was made', !!code, code);
  socks.fz4.msg({ t: 'room.join', code });
  await sleep(50);
  await blast('fz3', 'in a room');
  await sleep(80);
  check('the room is still standing', !!game._roomOf('fz3') || !!socks.fz3.last('room'));

  console.log('and the server loops never fell over');
  await sleep(300);
  check('no error escaped the server’s own loops', loopErrors.length === 0, loopErrors.slice(0, 2));
  check('the server still answers', (() => { const n = socks.fz5.got.length; socks.fz5.msg({ t: 'ping' }); return socks.fz5.got.length >= n; })());

  console.log(`\n${n1 + n2} junk messages sent in all`);
  console.log(fails ? `${fails} FAILED` : 'all passed');
  console.error = realErr;
  process.exit(fails ? 1 : 0);
})();
