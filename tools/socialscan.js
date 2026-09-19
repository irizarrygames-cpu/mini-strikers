// Friends, parties and quick chat, run against the real server game code with fake sockets.
//   node tools/socialscan.js
// Friends: ask by username, accept / decline / remove, see each other online. Parties: invite a
// friend, the leader queues and everyone goes into one match on the same side (the World Cup
// too, each with their own run). Quick chat: preset lines only, to everyone else in the match,
// never spammy; the filled spots chat now and then like people.
const { createGame } = require('../server/game');
const { forgetEverywhere } = require('../server/friends');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let clockSkew = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockSkew; // lets the test skip long waits

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

// accounts like server.js keeps them (friends live on the account)
const users = {};
const CLUB = { a: 'spain', b: 'brazil', c: 'france', d: 'japan', e: 'spain', x: 'italy', y: 'italy' }; // by first letter
const account = (id) => (users[id] = users[id] || { name: id.toUpperCase(), club: CLUB[id[0]] || 'spain', save: { xp: 0 } });
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
const game = createGame({ getUser: (id) => users[id], userName: (id) => (users[id] ? users[id].name : id.toUpperCase()), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false, worldCup });

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { account(id); socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);
const answer = (id, n) => { const r = socks[id].since(n, 'social'); return r[r.length - 1] || null; };
async function waitFor(ws, t, after, ms = 5000, pred = () => true) {
  const t0 = realNow();
  while (realNow() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t && pred(ws.got[i])) return ws.got[i]; await sleep(25); }
  return null;
}
const friendView = (id) => socks[id].last('friends');
const partyView = (id) => socks[id].last('party');
const { queues, parties, partyOf } = game._social;
const queued = () => Object.values(queues).flat();
const sideOf = (id) => { const r = game._roomOf(id); const s = r && r.seats.find((x) => x.userId === id); return s ? s.team : null; };
// befriend two players straight away
function befriend(p, q) { say(p, { t: 'friend.add', name: q }); say(q, { t: 'friend.accept', name: p }); }
async function party(leader, ...others) {
  for (const o of others) {
    const n = socks[o].got.length;
    say(leader, { t: 'party.invite', name: o });
    const inv = await waitFor(socks[o], 'party.invite', n);
    say(o, { t: 'party.accept', id: inv.id });
  }
  return partyOf.get(leader);
}
async function endRoom(id) {
  const r = game._roomOf(id);
  if (!r) return;
  for (const s of r.seats) if (s.human && !s.gone) say(s.userId, { t: 'leave' });
  await sleep(50);
}

(async () => {
  console.log('friends: ask, accept, decline, remove');
  {
    for (const id of ['ann', 'bob', 'cat', 'dan', 'eve']) connect(id);
    const n = socks.bob.got.length, na = socks.ann.got.length;
    say('ann', { t: 'friend.add', name: '  Bob ' });
    check('asking by username (any case, spaces trimmed) works', answer('ann', na) && answer('ann', na).ok, answer('ann', na));
    check('they hear about it', !!(await waitFor(socks.bob, 'friend.req', n, 500)), socks.bob.last('friend.req'));
    check('it shows as waiting on both sides', friendView('bob').incoming.some((f) => f.name === 'ANN') && friendView('ann').outgoing.some((f) => f.name === 'BOB'));
    const bad = [];
    for (const name of ['nobody_here', 'ann', '#league', '', null, { x: 1 }, 'xan'.repeat(500), 'bob']) {
      const k = socks.ann.got.length;
      say('ann', { t: 'friend.add', name });
      const r = answer('ann', k);
      if (!r || r.ok) bad.push(name);
    }
    check('no such player / yourself / junk / asking twice: all refused, nothing breaks', bad.length === 0, bad);
    say('bob', { t: 'friend.accept', name: 'ann' });
    check('accepted: friends on both lists', users.ann.friends.includes('bob') && users.bob.friends.includes('ann'), { a: users.ann.friends, b: users.bob.friends });
    check('the requests are gone', !users.ann.reqOut.length && !users.bob.reqIn.length);
    check('each sees the other online', friendView('ann').friends.find((f) => f.name === 'BOB').status === 'online' && friendView('bob').friends.find((f) => f.name === 'ANN').status === 'online');
    say('cat', { t: 'friend.add', name: 'ann' });
    say('ann', { t: 'friend.add', name: 'cat' });
    check('adding someone who already asked you = accepting', users.ann.friends.includes('cat') && users.cat.friends.includes('ann'));
    say('dan', { t: 'friend.add', name: 'ann' });
    say('ann', { t: 'friend.decline', name: 'dan' });
    check('declined: no friendship, no request left', !users.ann.friends.includes('dan') && !users.dan.reqOut.length && !users.ann.reqIn.length);
    say('ann', { t: 'friend.remove', name: 'cat' });
    check('removed: gone from both lists', !users.ann.friends.includes('cat') && !users.cat.friends.includes('ann'));
    say('eve', { t: 'friend.add', name: 'dan' });
    say('eve', { t: 'friend.remove', name: 'dan' });
    check('taking back a request you sent', !users.eve.reqOut.length && !users.dan.reqIn.length);
    befriend('ann', 'cat'); befriend('ann', 'dan'); befriend('ann', 'eve'); befriend('bob', 'cat');
    check('everyone befriended for the party tests', ['bob', 'cat', 'dan', 'eve'].every((f) => users.ann.friends.includes(f)));
  }

  console.log('friends see each other come and go');
  {
    const n = socks.ann.got.length;
    socks.bob.close();
    const off = await waitFor(socks.ann, 'friends', n, 2500, (v) => v.friends.some((f) => f.name === 'BOB' && f.status === 'offline'));
    check('B closed the game: A sees B offline within a second or so', !!off);
    const n2 = socks.ann.got.length;
    connect('bob');
    check('B back: online again', !!(await waitFor(socks.ann, 'friends', n2, 2500, (v) => v.friends.some((f) => f.name === 'BOB' && f.status === 'online'))));
    check('a fresh connection gets its friends list and party state straight away', !!socks.bob.last('friends') && !!socks.bob.last('party'));
    const n3 = socks.ann.got.length;
    say('bob', { t: 'busy', on: true });
    check('B playing against bots: shows as busy', !!(await waitFor(socks.ann, 'friends', n3, 2500, (v) => v.friends.some((f) => f.name === 'BOB' && f.status === 'busy'))));
    say('bob', { t: 'busy', on: false });
    const n4 = socks.ann.got.length;
    say('bob', { t: 'queue', format: '1v1' });
    check('B looking for a match: shows as finding one', !!(await waitFor(socks.ann, 'friends', n4, 2500, (v) => v.friends.some((f) => f.name === 'BOB' && f.status === 'queue'))));
    say('bob', { t: 'unqueue' });
    const ids = Object.keys(users);
    check('friends lists hold account ids only', ids.every((id) => ['friends', 'reqIn', 'reqOut'].every((k) => !users[id][k] || users[id][k].every((f) => typeof f === 'string' && users[f]))));
  }

  console.log('spamming requests gets slowed down');
  {
    connect('spammer');
    let slowed = false;
    for (let i = 0; i < 60; i++) { const k = socks.spammer.got.length; say('spammer', { t: 'friend.add', name: 'zz' + i }); const r = answer('spammer', k); if (r && r.msg === 'Slow down a bit') slowed = true; }
    check('more than 40 in a minute: slowed down', slowed);
  }

  console.log('parties: invite, accept, leader, leave');
  {
    const n = socks.bob.got.length;
    say('ann', { t: 'party.invite', name: 'xan' });
    check('only friends can be invited', answer('ann', socks.ann.got.length - 1) && !socks.ann.last('social').ok);
    say('ann', { t: 'party.invite', name: 'bob' });
    const inv = await waitFor(socks.bob, 'party.invite', n);
    check('B gets the invite, from A', inv && inv.from === 'ANN', inv);
    check('A sees B invited', partyView('ann') && partyView('ann').invited.includes('BOB'), partyView('ann'));
    say('bob', { t: 'party.accept', id: inv.id });
    const pa = partyView('ann'), pb = partyView('bob');
    check('both in the party, A leads', pa.members.length === 2 && pb.members.length === 2 && pa.lead && !pb.lead && pb.leader === 'ANN', { pa, pb });
    say('bob', { t: 'party.invite', name: 'cat' });
    check('only the leader invites', !socks.bob.last('social').ok);
    const nb = socks.bob.got.length;
    say('bob', { t: 'queue', format: '2v2' });
    const err = await waitFor(socks.bob, 'error', nb, 300);
    check('a member can\'t start: the leader does', err && /starts the match/.test(err.msg), err);
    const na = socks.ann.got.length;
    say('ann', { t: 'queue', format: '1v1' });
    const e1 = await waitFor(socks.ann, 'error', na, 300);
    check('a party of 2 can\'t queue 1v1', e1 && /2v2 or bigger/.test(e1.msg), e1);
    say('bob', { t: 'party.leave' });
    check('B leaves: a party of one is no party', partyView('ann').id === null && partyView('bob').id === null && !parties.size);
  }

  console.log('a party queues together and plays on the same side');
  {
    await party('ann', 'bob');
    const na = socks.ann.got.length, nb = socks.bob.got.length;
    say('ann', { t: 'queue', format: '2v2' });
    const qa = await waitFor(socks.ann, 'queue', na, 500), qb = await waitFor(socks.bob, 'queue', nb, 500);
    check('the leader queues: both are searching', qa && qb && qb.leader === 'ANN', { qa, qb });
    check('one entry for the pair', queued().length === 1 && queued()[0].ids.length === 2);
    connect('xan'); connect('yul');
    say('xan', { t: 'queue', format: '2v2' }); say('yul', { t: 'queue', format: '2v2' });
    const sa = await waitFor(socks.ann, 'start', na, 3000), sb = await waitFor(socks.bob, 'start', nb, 3000);
    check('four players: the match starts', sa && sb && sa.room === sb.room);
    check('A and B on the same side, X and Y on the other', sideOf('ann') === sideOf('bob') && sideOf('xan') === sideOf('yul') && sideOf('ann') !== sideOf('xan'), { a: sideOf('ann'), b: sideOf('bob'), x: sideOf('xan'), y: sideOf('yul') });
    const nf = socks.cat.got.length;
    check('friends see them in a match', !!(await waitFor(socks.cat, 'friends', nf, 2500, (v) => v.friends.some((f) => f.name === 'ANN' && f.status === 'match') || v.friends.some((f) => f.name === 'BOB' && f.status === 'match'))));
    const nc = socks.cat.got.length;
    say('ann', { t: 'party.invite', name: 'cat' });
    const invc = await waitFor(socks.cat, 'party.invite', nc, 500);
    say('cat', { t: 'party.accept', id: invc && invc.id });
    check('C can join the party while A and B play', partyOf.get('cat') === partyOf.get('ann'), partyView('cat'));
    await endRoom('ann');
    await endRoom('xan');
  }

  console.log('parties never split, solos fill around them');
  {
    // 3v3: parties of 3 and 2 and one player on their own
    connect('pp1'); connect('pp2'); connect('pp3');
    for (const o of ['pp2', 'pp3']) befriend('pp1', o);
    await party('pp1', 'pp2', 'pp3');
    connect('qq1'); connect('qq2'); befriend('qq1', 'qq2');
    await party('qq1', 'qq2');
    connect('ss1');
    say('ss1', { t: 'queue', format: '3v3' });
    say('qq1', { t: 'queue', format: '3v3' });
    const n = socks.pp1.got.length;
    say('pp1', { t: 'queue', format: '3v3' });
    const st = await waitFor(socks.pp1, 'start', n, 3000);
    const side = (id) => sideOf(id);
    check('3 + 2 + 1: straight into a full match', !!st);
    check('the three together, the two together with the one', side('pp1') === side('pp2') && side('pp2') === side('pp3') && side('qq1') === side('qq2') && side('qq2') === side('ss1') && side('pp1') !== side('qq1'),
      { p: [side('pp1'), side('pp2'), side('pp3')], q: [side('qq1'), side('qq2')], s1: side('ss1') });
    await endRoom('pp1'); await endRoom('qq1');
    // 3v3: three parties of 2 can't make 3 and 3 without breaking one up
    connect('uu1'); connect('uu2'); befriend('uu1', 'uu2'); await party('uu1', 'uu2');
    say('pp1', { t: 'party.kick', name: 'pp3' });
    check('the leader can take someone out', !partyOf.get('pp3') && partyOf.get('pp1').members.length === 2 && partyView('pp3').id === null);
    say('pp1', { t: 'queue', format: '3v3' }); say('qq1', { t: 'queue', format: '3v3' }); say('uu1', { t: 'queue', format: '3v3' });
    await sleep(1300);
    check('2 + 2 + 2 never starts as 3 and 3 (no party is split)', !game._roomOf('pp1') && queued().length === 3);
    // the first ones have waited long enough: they play (the empty spots fill), the third pair waits on
    for (const e of queued()) if (e.userId === 'pp1') e.at -= 40000;
    await sleep(1300);
    check('after the wait: two pairs play, one on each side, bots fill', !!game._roomOf('pp1') && !!game._roomOf('qq1') && game._roomOf('pp1') === game._roomOf('qq1') && side('pp1') === side('pp2') && side('qq1') === side('qq2') && side('pp1') !== side('qq1'));
    check('the third pair is still searching', !game._roomOf('uu1') && queued().some((e) => e.userId === 'uu1'));
    const nu = socks.uu2.got.length;
    say('uu2', { t: 'unqueue' });
    const un = await waitFor(socks.uu1, 'unqueued', 0, 500, (m) => !!m.msg);
    check('a member stopping the search stops it for the party (and says who)', un && /UU2 stopped/.test(un.msg) && !queued().some((e) => e.userId === 'uu1'), un);
    say('uu1', { t: 'queue', format: '3v3' });
    const nu1 = socks.uu1.got.length;
    socks.uu2.close();
    const lost = await waitFor(socks.uu1, 'unqueued', nu1, 1500, (m) => /lost connection/.test(m.msg || ''));
    check('a member\'s game closing stops the party\'s search', !!lost && !queued().some((e) => e.userId === 'uu1'), lost);
    check('... but they keep their party spot for a minute', partyOf.get('uu2') && partyOf.get('uu2').members.includes('uu2'));
    clockSkew += 61000;
    await sleep(1200);
    clockSkew -= 61000;
    check('gone for over a minute: out of the party', !partyOf.get('uu2') && !partyOf.get('uu1'));
    await endRoom('pp1');
  }

  console.log('who can join, and when');
  {
    say('bob', { t: 'party.leave' }); // (the party was ANN, BOB, CAT)
    connect('bb2'); befriend('ann', 'bb2');
    say('bb2', { t: 'busy', on: true });
    const pa = partyOf.get('ann');
    await party('ann', 'bb2');
    const n = socks.ann.got.length;
    say('ann', { t: 'queue', format: '4v4' });
    const e = await waitFor(socks.ann, 'error', n, 300);
    check('a member playing against bots: the leader is told, nothing starts', e && /BB2 is playing/.test(e.msg) && !queued().length, e);
    connect('fil'); befriend('ann', 'fil'); await party('ann', 'fil');
    connect('ful'); befriend('ann', 'ful');
    say('ann', { t: 'party.invite', name: 'ful' });
    check('four in the party (ANN, CAT, BB2, FIL): full, no more invites', /full/.test(socks.ann.last('social').msg || ''), socks.ann.last('social'));
    say('fil', { t: 'party.leave' });
    say('bb2', { t: 'busy', on: false });
    // an invite that runs out
    connect('late'); befriend('ann', 'late');
    const nl = socks.late.got.length;
    say('ann', { t: 'party.invite', name: 'late' });
    const inv = await waitFor(socks.late, 'party.invite', nl, 500);
    clockSkew += 61000;
    say('late', { t: 'party.accept', id: inv.id });
    clockSkew -= 61000;
    check('an invite answered after a minute has run out', !socks.late.last('social').ok && !partyOf.get('late'), socks.late.last('social'));
    say('ann', { t: 'party.invite', name: 'late' });
    const inv2 = await waitFor(socks.late, 'party.invite', nl + 1, 500);
    say('late', { t: 'party.decline', id: inv2.id });
    check('declined: the leader hears about it', /can't play right now/.test((socks.ann.last('party.info') || {}).msg || ''));
    const party4 = partyOf.get('ann');
    check('in the party now: A, C, B2', party4 && ['ann', 'cat', 'bb2'].every((m) => party4.members.includes(m)), party4 && party4.members);
    say('ann', { t: 'party.leave' });
    const p2 = partyOf.get('cat');
    check('the leader leaves: the next one leads', p2 && p2.leader === 'cat' && partyView('cat').lead === true && !partyOf.get('ann'), p2 && p2.leader);
    for (const m of [...(p2 ? p2.members : [])]) say(m, { t: 'party.leave' });
    check('everyone left: no party left over', ![...parties.values()].some((p) => ['ann', 'cat', 'bb2'].some((m) => p.members.includes(m))), [...parties.values()].map((p) => p.members));
  }

  console.log('the online World Cup as a party: each keeps their own run');
  {
    runs.ann = { round: 2, titles: 0 }; runs.bob = { round: 0, titles: 0 };
    await party('ann', 'bob');
    const na = socks.ann.got.length, nb = socks.bob.got.length;
    say('ann', { t: 'queue', format: '2v2', wc: true });
    const qa = await waitFor(socks.ann, 'queue', na, 500), qb = await waitFor(socks.bob, 'queue', nb, 500);
    check('queued at the furthest round of the two (semi-final)', queued()[0] && queues['wc/2v2/2'] && queues['wc/2v2/2'].length === 1, Object.keys(queues));
    check('each is shown their own round', qa && qb && qa.wc === 2 && qb.wc === 0, { a: qa && qa.wc, b: qb && qb.wc });
    queued()[0].at -= 40000;
    const sa = await waitFor(socks.ann, 'start', na, 3000), sb = await waitFor(socks.bob, 'start', nb, 3000);
    check('match starts, same side, each told their own round', sa && sb && sa.room === sb.room && sa.side === sb.side && sa.wc === 2 && sb.wc === 0, { a: sa && sa.wc, b: sb && sb.wc });
    const room = game._roomOf('ann');
    while (room.m.phase !== 'play') await sleep(50);
    const seat = room.seats.find((s) => s.userId === 'ann');
    room.m.score[seat.team] = 2; room.m.score[seat.team === 'blue' ? 'red' : 'blue'] = 0; room.m.time = 0.05;
    const ea = await waitFor(socks.ann, 'end', na, 5000), eb = await waitFor(socks.bob, 'end', nb, 5000);
    check('won: A into the final, B into the quarter-final', ea && eb && ea.wc.round === 2 && ea.wc.next === 3 && eb.wc.round === 0 && eb.wc.next === 1 && runs.ann.round === 3 && runs.bob.round === 1, { a: ea && ea.wc, b: eb && eb.wc });
    check('the party is still together after the match', partyOf.get('ann') === partyOf.get('bob') && partyOf.get('ann').members.length === 2);
    await sleep(100);
    const n2 = socks.bob.got.length;
    say('ann', { t: 'queue', format: '2v2' });
    check('PLAY AGAIN straight away brings the party back in', !!(await waitFor(socks.bob, 'queue', n2, 500)));
    say('ann', { t: 'unqueue' });
  }

  console.log('quick chat');
  {
    const n = socks.ann.got.length;
    connect('xan'); connect('yul');
    say('ann', { t: 'queue', format: '2v2' }); say('xan', { t: 'queue', format: '2v2' }); say('yul', { t: 'queue', format: '2v2' });
    await waitFor(socks.ann, 'start', n, 3000);
    const room = game._roomOf('ann');
    const pi = (id) => room.m.players.indexOf(room.seats.find((s) => s.userId === id).player);
    const nx = socks.xan.got.length, nb = socks.bob.got.length, na = socks.ann.got.length;
    say('ann', { t: 'chat', m: 1 });
    await sleep(50);
    const cx = socks.xan.since(nx, 'chat'), cb = socks.bob.since(nb, 'chat');
    check('everyone else in the match sees it, over A\'s player', cx.length === 1 && cb.length === 1 && cx[0].p === pi('ann') && cx[0].m === 1, { cx, cb });
    check('A isn\'t sent their own line back', socks.ann.since(na, 'chat').length === 0);
    const k = socks.xan.got.length;
    for (const m of [-1, 12, 99, 'xan', 1.5, null, { a: 1 }]) say('bob', { t: 'chat', m });
    await sleep(50);
    check('anything that isn\'t a preset line goes nowhere', socks.xan.since(k, 'chat').length === 0);
    const k2 = socks.xan.got.length;
    say('bob', { t: 'chat', m: 2 }); say('bob', { t: 'chat', m: 3 }); say('bob', { t: 'chat', m: 4 });
    await sleep(50);
    check('three at once: only the first goes out', socks.xan.since(k2, 'chat').length === 1);
    let sent = 0;
    const k3 = socks.xan.got.length;
    for (let i = 0; i < 8; i++) { clockSkew += 1300; say('yul', { t: 'chat', m: 9 }); sent++; }
    await sleep(50);
    const got = socks.ann.since(0, 'chat').filter((c) => c.p === pi('yul')).length;
    check('no more than five in any ten seconds', got === 5, { sent, got });
    clockSkew -= 8 * 1300;
    const k4 = socks.xan.got.length;
    say('cat', { t: 'chat', m: 0 });
    await sleep(50);
    check('someone not in the match can\'t chat into it', socks.xan.since(k4, 'chat').length === 0);
    await endRoom('ann');
    await endRoom('xan');
  }

  console.log('the filled spots chat like people');
  {
    // one player and three fill-ins: goals, and a player saying hi
    connect('solo');
    const n = socks.solo.got.length;
    say('solo', { t: 'queue', format: '2v2' });
    queued()[0].at -= 40000;
    await waitFor(socks.solo, 'start', n, 3000);
    const room = game._roomOf('solo');
    while (room.state !== 'playing') await sleep(50);
    const bots = room.seats.filter((s) => !s.human).map((s) => room.m.players.indexOf(s.player));
    let said = 0, trials = 300, fromBots = true, lines = new Set();
    const seen = () => socks.solo.since(0, 'chat');
    let before = seen().length;
    for (let i = 0; i < trials; i++) {
      room.botChat = []; room.botQuiet = 0;
      const scorer = room.seats[1 + (i % 3)].player;
      room.m.goals.push({ team: scorer.team, scorer, own: false, time: 0 });
      await sleep(6);
      if (room.botChat.length) room.botChat[0].at = 0;
      await sleep(6);
    }
    const all = seen().slice(before);
    said = all.length;
    for (const c of all) { lines.add(c.m); if (!bots.includes(c.p)) fromBots = false; }
    check('after a goal they sometimes say something (about 4 in 10)', said > trials * 0.25 && said < trials * 0.55, { said, trials });
    check('only ever from a filled spot, and only preset lines', fromBots && [...lines].every((m) => Number.isInteger(m) && m >= 0 && m < 12), [...lines]);
    before = seen().length;
    let replies = 0, skewed = 0;
    for (let i = 0; i < 120; i++) {
      room.botChat = []; room.botQuiet = 0;
      clockSkew += 2100; skewed += 2100; // (five lines in ten seconds is the most anyone can say)
      say('solo', { t: 'chat', m: 0 });
      await sleep(4);
      if (room.botChat.length) { room.botChat[0].at = 0; replies++; }
      await sleep(6);
    }
    clockSkew -= skewed;
    const hi = seen().slice(before).filter((c) => c.m === 0).length;
    check('say HI and about half the time someone says HI back', hi > 120 * 0.3 && hi < 120 * 0.62, { hi, of: 120 });
    const k = socks.solo.got.length;
    room.botChat = [{ at: Date.now() + 100000, player: room.seats[1].player, n: 0 }];
    check('never two lines queued up at once', (() => { room.botQuiet = 0; room.m.goals.push({ team: 'blue', scorer: room.seats[1].player, own: false, time: 0 }); return true; })());
    await sleep(60);
    check('(the pending one blocks new ones)', room.botChat.length === 1);
    await endRoom('solo');
    void k;
  }

  console.log('an account deleted comes off everyone\'s lists');
  {
    const before = users.bob.friends.includes('ann');
    game.removeUser('ann');
    delete users.ann;
    forgetEverywhere(users, 'ann', '#league');
    check('A is off B\'s list (and everyone\'s)', before && Object.values(users).every((u) => !['friends', 'reqIn', 'reqOut'].some((k) => (u[k] || []).includes('ann'))));
    check('nobody left in a party with A', ![...parties.values()].some((p) => p.members.includes('ann')));
  }

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
