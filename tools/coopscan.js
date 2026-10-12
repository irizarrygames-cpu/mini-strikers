// Playing WITH your friends, against fill-ins. Run against the real server game code over fake
// sockets, like the other scans:
//   node tools/coopscan.js
//
// The whole party takes one side, the other side is filled in, it starts without a queue, and
// because it is a kickabout it leaves everybody's record and the league alone.
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
const account = (id) => (users[id] = users[id] || { name: id.toUpperCase(), club: id === 'coopb' ? 'brazil' : 'spain', save: { xp: 0 } });
const records = [];
const leagueMoves = [];
const game = createGame({
  getUser: (id) => users[id],
  userName: (id) => (users[id] ? users[id].name : id.toUpperCase()),
  saveDB: () => {},
  onlineRecord: (id, r) => records.push({ id, ...r }),
  isNameTaken: () => false,
  league: { move: () => {}, result: (list) => leagueMoves.push(...list), pos: () => 7 },
});

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { account(id); socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);
const befriend = (p1, p2) => { say(p1, { t: 'friend.add', name: p2.toUpperCase() }); say(p2, { t: 'friend.accept', name: p1.toUpperCase() }); };
async function party(lead, mate) {
  befriend(lead, mate);
  await sleep(40);
  say(lead, { t: 'party.invite', name: mate.toUpperCase() });
  const inv = await waitFor(socks[mate], 'party.invite', 0, 2000);
  if (!inv) throw new Error('no party invite reached ' + mate);
  say(mate, { t: 'party.accept', id: inv.id });
  await sleep(60);
}
async function waitFor(ws, t, after, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(25); }
  return null;
}

(async () => {
  for (const id of ['coopa', 'coopb', 'coopc']) connect(id);

  console.log('a party plays together against fill-ins');
  await party('coopa', 'coopb');
  let n = socks.coopa.got.length, nb = socks.coopb.got.length;
  say('coopa', { t: 'party.coop', format: '3v3' });
  const a = await waitFor(socks.coopa, 'start', n, 3000);
  const b = await waitFor(socks.coopb, 'start', nb, 3000);
  check('it starts without any queue', !!a && !!b);
  check('both of you are on the same side', a && b && a.side === b.side, a && b && [a.side, b.side]);
  check('and in the same match', a && b && a.room === b.room);
  const room = game._roomOf('coopa');
  check('the other side is all fill-ins', !!room && room.seats.filter((s) => s.team !== a.side).every((s) => !s.human));
  check('your side holds both of you', !!room && room.seats.filter((s) => s.team === a.side && s.human).length === 2);
  check('and is filled up to the format', !!room && room.seats.filter((s) => s.team === a.side).length === 3);
  check('the room knows it is a kickabout', !!room && room.coop === true);
  const nMid = socks.coopa.got.length;
  say('coopa', { t: 'party.coop', format: '3v3' });
  await sleep(40);
  check('you cannot start another while this one is on', !!socks.coopa.since(nMid, 'error').length, socks.coopa.since(nMid, 'error')[0]);

  console.log('a kickabout leaves the table alone');
  records.length = 0; leagueMoves.length = 0;
  while (room.m.phase !== 'play') await sleep(30);
  room.m.score.blue = 3; room.m.score.red = 0;
  room.m.time = 0.05;
  const over = await waitFor(socks.coopa, 'end', socks.coopa.got.length - 1, 9000);
  check('it ends like any other match', !!over, over && over.outcome);
  check('you still get told you won', over && over.outcome === 'win', over && over.outcome);
  check('it is marked as a kickabout', !!(over && over.coop), over && over.coop);
  check('nobody\'s online record moved', records.length === 0, records.length);
  check('no country moved up or down', leagueMoves.length === 0, leagueMoves);
  check('and no league line on the card', over && over.league === null, over && over.league);

  console.log('the rules around it');
  n = socks.coopb.got.length;
  say('coopb', { t: 'party.coop', format: '2v2' });
  check('only the leader can start one', !!socks.coopb.since(n, 'error').length, socks.coopb.last('error'));
  n = socks.coopc.got.length;
  say('coopc', { t: 'party.coop', format: '2v2' });
  check('you need a party to start one', !!socks.coopc.since(n, 'error').length, socks.coopc.last('error'));
  n = socks.coopa.got.length;
  say('coopa', { t: 'party.coop', format: 'pens' });
  check('shootouts are not a kickabout format', !!socks.coopa.since(n, 'error').length);

  console.log('with your friends, against other people');
  for (const id of ['randa', 'randb', 'randc', 'randd']) connect(id);
  await party('coopa', 'coopb');
  let nq = socks.coopa.got.length, nq2 = socks.coopb.got.length;
  say('coopa', { t: 'queue', format: '3v3' });
  await sleep(80);
  const qa = socks.coopa.since(nq, 'queue')[0], qb = socks.coopb.since(nq2, 'queue')[0];
  check('the whole party goes into the queue', !!qa && !!qb, qa && qa.party);
  check('and it says who you are with', !!(qa && qa.party && qa.party.length === 2), qa && qa.party);
  nq = socks.coopb.got.length;
  say('coopb', { t: 'queue', format: '3v3' });
  check('only the leader queues for the party', !!socks.coopb.since(nq, 'error').length, socks.coopb.last('error'));
  // three strangers turn up
  const nStart = { coopa: socks.coopa.got.length, coopb: socks.coopb.got.length };
  for (const id of ['randa', 'randb', 'randc', 'randd']) say(id, { t: 'queue', format: '3v3' });
  const sa = await waitFor(socks.coopa, 'start', nStart.coopa, 4000);
  const sb = await waitFor(socks.coopb, 'start', nStart.coopb, 4000);
  const sr = await waitFor(socks.randa, 'start', 0, 4000);
  check('it fills and starts', !!sa && !!sb && !!sr);
  check('you and your friend are on the same side', sa && sb && sa.side === sb.side, sa && sb && [sa.side, sb.side]);
  check('the strangers are on the other side', sa && sr && sr.side !== sa.side, sr && sr.side);
  const rm = game._roomOf('coopa');
  check('everyone in it is a real person', !!rm && rm.seats.every((x) => x.human), rm && rm.seats.map((x) => x.human));
  check('and it is not a kickabout', !!rm && !rm.coop);
  rm.m.score.blue = 1; rm.m.score.red = 0; rm.m.time = 0.05;
  records.length = 0; leagueMoves.length = 0;
  const e2 = await waitFor(socks.coopa, 'end', socks.coopa.got.length - 1, 9000);
  check('this one does count', !!e2 && !e2.coop && records.length > 0, { coop: e2 && e2.coop, records: records.length });
  check('and it moves the league', leagueMoves.length > 0, leagueMoves.length);

  console.log('a room can be a kickabout too');
  for (const id of ['coopd', 'coope']) connect(id);
  say('coopd', { t: 'room.create', format: '2v2' });
  await sleep(50);
  const code = socks.coopd.last('room').code;
  say('coope', { t: 'room.join', code });
  await sleep(50);
  const beforeSides = socks.coopd.last('room').players.map((p) => p.team);
  check('a room splits you up to start with', new Set(beforeSides).size === 2, beforeSides);
  say('coopd', { t: 'room.coop', on: true });
  await sleep(50);
  const afterSides = socks.coopd.last('room').players.map((p) => p.team);
  check('turning it on puts you both on one side', new Set(afterSides).size === 1, afterSides);
  check('and the room says so', socks.coopd.last('room').coop === true);
  n = socks.coope.got.length;
  say('coope', { t: 'room.team', team: 'red' });
  await sleep(40);
  check('nobody can wander back across', socks.coope.last('room').players.every((p) => p.team === 'blue'));
  n = socks.coopd.got.length; const ne = socks.coope.got.length;
  say('coopd', { t: 'room.start' });
  const d = await waitFor(socks.coopd, 'start', n, 3000), e = await waitFor(socks.coope, 'start', ne, 3000);
  check('it starts with you together', !!d && !!e && d.side === e.side, d && e && [d.side, e.side]);
  const room2 = game._roomOf('coopd');
  check('against fill-ins', !!room2 && room2.seats.filter((s) => s.team !== d.side).every((s) => !s.human));
  check('and it counts as a kickabout', !!room2 && room2.coop === true);

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
