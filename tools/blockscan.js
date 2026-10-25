// Blocking a player, run against the real server game code with fake sockets.
//   node tools/blockscan.js
// Block takes them off your friends and requests both ways, stops requests either way, keeps
// their quick chat away from you (and yours from them), keeps you out of each other's rooms, and
// keeps matchmaking from ever putting you in the same match. Unblock undoes the block, and nothing
// else.
const { createGame } = require('../server/game');
const { forgetEverywhere } = require('../server/friends');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let clockSkew = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockSkew; // lets the test skip the queue's waits

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.lastSeen = Date.now(); }
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
  saveDB: () => {}, onlineRecord: () => 0, isNameTaken: () => false,
  worldCup: { round: () => 0, result: () => ({ round: 0, champion: false, titles: 0 }) },
});

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { account(id); socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);
const answer = (id, n) => { const r = socks[id].since(n, 'social'); return r[r.length - 1] || null; };
const view = (id) => socks[id].last('friends');
const names = (list) => (list || []).map((x) => x.name);
async function waitFor(ws, t, after, ms = 5000) {
  const t0 = realNow();
  while (realNow() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(25); }
  return null;
}
const ask = (id, obj) => { const n = socks[id].got.length; say(id, obj); return answer(id, n); };
async function endRoom(id) {
  const r = game._roomOf(id);
  if (!r) return;
  for (const s of r.seats) if (s.human && !s.gone) say(s.userId, { t: 'leave' });
  await sleep(50);
}

(async () => {
  for (const id of ['amy', 'ben', 'cal', 'dee', 'eli']) connect(id);

  console.log('blocking a friend');
  ask('amy', { t: 'friend.add', name: 'ben' }); ask('ben', { t: 'friend.accept', name: 'amy' });
  check('(they start as friends)', names(view('amy').friends).includes('BEN') && names(view('ben').friends).includes('AMY'));
  let r = ask('amy', { t: 'friend.block', name: 'ben' });
  check('blocking says so', r && r.ok && /blocked/i.test(r.msg), r);
  check('they are off your friends', !names(view('amy').friends).includes('BEN'), view('amy').friends);
  check('and you are off theirs', !names(view('ben').friends).includes('AMY'), view('ben').friends);
  check('your blocked list shows them', names(view('amy').blocked).includes('BEN'), view('amy').blocked);
  check('their blocked list is empty (it is yours, not theirs)', !names(view('ben').blocked).length, view('ben').blocked);
  r = ask('ben', { t: 'friend.add', name: 'amy' });
  check('they can not send you a request', r && !r.ok, r);
  check('and they are not told you blocked them', r && !/block/i.test(r.msg), r && r.msg);
  check('no request reached you', !names(view('amy').incoming).includes('BEN'), view('amy').incoming);
  r = ask('amy', { t: 'friend.add', name: 'ben' });
  check('you can not send them one either, until you unblock them', r && !r.ok && /unblock/i.test(r.msg), r);
  r = ask('amy', { t: 'friend.block', name: 'ben' });
  check('blocking twice is fine', r && r.ok, r);
  check('and does not list them twice', names(view('amy').blocked).filter((n) => n === 'BEN').length === 1);

  console.log('blocking someone who sent you a request');
  ask('cal', { t: 'friend.add', name: 'amy' });
  check('(their request is waiting)', names(view('amy').incoming).includes('CAL'));
  ask('amy', { t: 'friend.block', name: 'cal' });
  check('the request is gone from your list', !names(view('amy').incoming).includes('CAL'), view('amy').incoming);
  check('and from their sent list', !names(view('cal').outgoing).includes('AMY'), view('cal').outgoing);
  r = ask('amy', { t: 'friend.accept', name: 'cal' });
  check('and it can not be accepted any more', r && !r.ok, r);

  console.log('what can not be blocked');
  r = ask('amy', { t: 'friend.block', name: 'amy' });
  check('yourself', r && !r.ok, r);
  r = ask('amy', { t: 'friend.block', name: 'nobody_here' });
  check('a name with no account', r && !r.ok && /no player/i.test(r.msg), r);
  users.zed = { name: 'ZED', club: 'spain', banned: { at: Date.now(), why: 'reported' } };
  r = ask('amy', { t: 'friend.add', name: 'zed' });
  check('a banned account is as good as gone: no requests to it', r && !r.ok && /no player/i.test(r.msg), r);

  console.log('quick chat');
  {
    for (const id of ['amy', 'ben', 'dee', 'eli']) say(id, { t: 'queue', format: '2v2' });
    await waitFor(socks.dee, 'start', 0, 3000);
    // amy and ben blocked each other, so the queue keeps them apart: get them into one match through
    // a block made after it started
    const room = game._roomOf('dee');
    const inIt = room ? room.seats.filter((s) => s.human).map((s) => s.userId) : [];
    check('the queue never put AMY and BEN in one match', !(inIt.includes('amy') && inIt.includes('ben')), inIt);
    for (const id of ['amy', 'ben', 'dee', 'eli']) { say(id, { t: 'unqueue' }); await endRoom(id); }
    ask('amy', { t: 'friend.unblock', name: 'ben' });
    for (const id of ['amy', 'ben', 'dee', 'eli']) say(id, { t: 'queue', format: '2v2' });
    const t0 = realNow();
    let mr = null;
    while (realNow() - t0 < 3000) { mr = game._roomOf('amy'); if (mr && game._roomOf('ben') === mr) break; await sleep(25); }
    check('(unblocked, the four of them make one match)', !!mr && ['ben', 'dee', 'eli'].every((id) => game._roomOf(id) === mr));
    ask('amy', { t: 'friend.block', name: 'ben' });
    const pi = (id) => mr.m.players.indexOf(mr.seats.find((s) => s.userId === id).player);
    let na = socks.amy.got.length, nd = socks.dee.got.length;
    clockSkew += 2000; say('ben', { t: 'chat', m: 1 });
    await sleep(30);
    check('a line from someone you blocked never reaches you', socks.amy.since(na, 'chat').length === 0, socks.amy.since(na, 'chat'));
    check('everyone else still sees it', socks.dee.since(nd, 'chat').some((c) => c.p === pi('ben')), socks.dee.since(nd, 'chat'));
    let nb = socks.ben.got.length;
    nd = socks.dee.got.length;
    clockSkew += 2000; say('amy', { t: 'chat', m: 2 });
    await sleep(30);
    check('and yours never reaches them', socks.ben.since(nb, 'chat').length === 0, socks.ben.since(nb, 'chat'));
    check('while everyone else gets yours', socks.dee.since(nd, 'chat').some((c) => c.p === pi('amy')));
    na = socks.amy.got.length;
    clockSkew += 2000; say('dee', { t: 'chat', m: 3 });
    await sleep(30);
    check('lines from people you did not block arrive as normal', socks.amy.since(na, 'chat').length === 1);
    for (const id of ['amy', 'ben', 'dee', 'eli']) await endRoom(id);
  }

  console.log('rooms');
  {
    for (const id of ['amy', 'ben', 'dee', 'eli']) { say(id, { t: 'unqueue' }); await endRoom(id); }
    say('amy', { t: 'room.create', format: '2v2' });
    const code = socks.amy.last('room').code;
    const nb = socks.ben.got.length;
    say('ben', { t: 'room.join', code });
    const err = socks.ben.since(nb, 'error').pop();
    check('someone you blocked can not walk into your room', !!err && !game._roomOf('ben'), err);
    const nc = socks.cal.got.length;
    say('cal', { t: 'room.join', code });
    check('nor can someone you blocked earlier', !!socks.cal.since(nc, 'error').pop() && !game._roomOf('cal'));
    say('dee', { t: 'room.join', code });
    check('anyone else can', game._roomOf('dee') === game._roomOf('amy'));
    say('amy', { t: 'room.leave' }); say('dee', { t: 'room.leave' });
    await sleep(30);
    say('ben', { t: 'room.create', format: '1v1' });
    const code2 = socks.ben.last('room').code;
    const na = socks.amy.got.length;
    say('amy', { t: 'room.join', code: code2 });
    check('and you can not walk into theirs', !!socks.amy.since(na, 'error').pop() && !game._roomOf('amy'));
    say('ben', { t: 'room.leave' });
    await sleep(30);
  }

  console.log('matchmaking keeps you apart');
  {
    for (const id of ['amy', 'ben']) say(id, { t: 'queue', format: '1v1' });
    // well past the longest wait: rank is no reason to hold anyone back any more, a block still is
    clockSkew += 120000;
    // the queue starts one short match a tick, filled in with bots: wait for both of theirs
    const t1 = realNow();
    while (realNow() - t1 < 5000 && !(game._roomOf('amy') && game._roomOf('ben'))) await sleep(50);
    const ra = game._roomOf('amy'), rb = game._roomOf('ben');
    check('two people alone in the queue, one blocked by the other: never the same match', !!ra && !!rb && ra !== rb, { amy: !!ra, ben: !!rb, same: ra === rb });
    await endRoom('amy'); await endRoom('ben');
    for (const id of ['amy', 'ben', 'dee']) say(id, { t: 'queue', format: '1v1' });
    clockSkew += 120000;
    const t2 = realNow();
    while (realNow() - t2 < 5000 && !['amy', 'ben', 'dee'].every((id) => game._roomOf(id))) await sleep(50);
    const rooms = ['amy', 'ben', 'dee'].map((id) => game._roomOf(id));
    check('with a third player there, AMY and BEN still never meet', !!rooms[0] && !!rooms[1] && rooms[0] !== rooms[1], rooms.map(Boolean));
    for (const id of ['amy', 'ben', 'dee']) { say(id, { t: 'unqueue' }); await endRoom(id); }
  }

  console.log('parties, challenges and watching all need friends, and a block ends that');
  {
    let r2 = ask('amy', { t: 'party.invite', name: 'ben' });
    check('no party invite', r2 && !r2.ok, r2);
    r2 = ask('amy', { t: 'challenge.send', name: 'ben' });
    check('no 1v1 challenge', r2 && !r2.ok, r2);
  }

  console.log('unblocking');
  {
    let r2 = ask('amy', { t: 'friend.unblock', name: 'ben' });
    check('unblocking says so', r2 && r2.ok && /unblocked/i.test(r2.msg), r2);
    check('they are off your blocked list', !names(view('amy').blocked).includes('BEN'), view('amy').blocked);
    check('it does not make you friends again', !names(view('amy').friends).includes('BEN'));
    r2 = ask('ben', { t: 'friend.add', name: 'amy' });
    check('they can ask again', r2 && r2.ok, r2);
    r2 = ask('amy', { t: 'friend.accept', name: 'ben' });
    check('and you can say yes', r2 && r2.ok && names(view('amy').friends).includes('BEN'), r2);
    r2 = ask('amy', { t: 'friend.unblock', name: 'ben' });
    check('unblocking someone who is not blocked says so', r2 && !r2.ok, r2);
  }

  console.log('an account going away comes off blocked lists too');
  {
    ask('dee', { t: 'friend.block', name: 'eli' });
    check('(DEE blocked ELI)', names(view('dee').blocked).includes('ELI'));
    forgetEverywhere(users, 'eli', null);
    check('gone from DEE\'s blocked list', !(users.dee.blocked || []).includes('eli'), users.dee.blocked);
  }

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
