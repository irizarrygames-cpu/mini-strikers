const assert = require('assert');
const { createGame } = require('../server/game');
const users = Object.fromEntries(['ann','bob','cat','dan','eve','fay','gus','hal','ivy','jon','kim','lee','old'].map(id => [id, { name: id.toUpperCase(), club: 'spain', save: {} }]));
class WS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.lastSeen = Date.now(); }
  on(e, fn) { this.handlers[e] = fn; }
  send(s) { this.got.push(JSON.parse(s)); }
  msg(m) { this.lastSeen = Date.now(); this.handlers.message(m); }
  last(t) { return this.got.filter(m => m.t === t).at(-1); }
}
const game = createGame({ getUser: id => users[id], userName: id => users[id].name, saveDB() {}, onlineRecord() {}, isNameTaken: () => false });
const ws = {};
for (const id of Object.keys(users)) { ws[id] = new WS(); game.connect(ws[id], id); }
const send = (id, m) => ws[id].msg(m);
send('ann', {t:'friend.add', name:'BOB'});
send('bob', {t:'friend.accept', name:'ANN'});
send('ann', {t:'challenge.send', name:'CAT'});
assert.equal(ws.ann.last('social').ok, false, 'non-friends cannot challenge');
send('bob', {t:'busy', on:true});
send('ann', {t:'challenge.send', name:'BOB'});
assert.equal(ws.ann.last('social').ok, false, 'busy friend cannot be challenged');
send('bob', {t:'busy', on:false});
send('ann', {t:'challenge.send', name:'BOB'});
const invite = ws.bob.last('challenge.invite');
assert(invite && ws.ann.last('social').ok, 'friend receives challenge');
send('bob', {t:'busy', on:true});
send('bob', {t:'challenge.accept', id:invite.id});
assert.equal(ws.bob.last('social').ok, false, 'acceptance rechecks busy state');
assert(!ws.ann.last('start'), 'busy acceptance never starts match');
send('bob', {t:'busy', on:false});
send('ann', {t:'challenge.send', name:'BOB'});
const invite2 = ws.bob.last('challenge.invite');
send('bob', {t:'challenge.accept', id:invite2.id});
assert.equal(ws.bob.last('social').ok, true, 'acceptance succeeds');
assert.equal(ws.ann.last('start').format, '1v1');
assert.equal(ws.bob.last('start').format, '1v1');
assert.equal(ws.ann.last('start').side, 'blue');
assert.equal(ws.bob.last('start').side, 'red');
send('ann', {t:'challenge.send', name:'BOB'});
assert.equal(ws.ann.last('social').ok, false, 'cannot challenge during match');

// build 116: the challenger picks what it is — a 1v1, penalties, free kicks or a PRO MATCH (2v2, a
// fill-in each); never a cup. A game too old for PRO MATCH is never put in one. PLAY AGAIN at the
// end is a rematch with the same friend at the same thing.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const id of ['dan','eve','fay','gus','hal','ivy','jon','kim','lee']) send(id, { t: 'arena', club: null, pro: 1 }); // 'old' is an older game
  const pair = (a, b) => { send(a, { t: 'friend.add', name: users[b].name }); send(b, { t: 'friend.accept', name: users[a].name }); };
  pair('dan','eve'); pair('fay','gus'); pair('hal','ivy'); pair('jon','kim'); pair('lee','old');
  const play = (a, b, mode) => {
    send(a, { t: 'challenge.send', name: users[b].name, mode });
    const inv = ws[b].last('challenge.invite');
    const sent = ws[a].last('social');
    if (sent.ok) send(b, { t: 'challenge.accept', id: inv.id });
    return { inv, sent, accepted: ws[b].last('social') };
  };
  const p = play('dan', 'eve', 'pens');
  assert.equal(p.inv.mode, 'pens', 'the invite says penalties');
  assert(/penalties/.test(p.sent.msg), 'the challenger is told: penalties');
  assert.equal(ws.dan.last('pen.start').kind, 'pens', 'a penalty shootout starts');
  assert.equal(ws.eve.last('pen.start').kind, 'pens');
  const f = play('fay', 'gus', 'fk');
  assert.equal(f.inv.mode, 'fk');
  assert.equal(ws.fay.last('pen.start').kind, 'fk', 'a free-kick shootout starts');
  const pr = play('hal', 'ivy', 'pro');
  assert.equal(pr.inv.mode, 'pro');
  const st = ws.hal.last('start');
  assert(st && st.pro === true && st.format === '2v2', 'a PRO MATCH 2v2 starts');
  const room = game._roomOf('hal');
  assert(room.pro && room.m.rules, 'on the big pitch with the rules');
  assert.equal(room.seats.filter((x) => x.human).length, 2, 'the two friends');
  assert.notEqual(room.seats.find((x) => x.userId === 'hal').team, room.seats.find((x) => x.userId === 'ivy').team, 'on opposite sides');
  assert.equal(room.seats.length, 4, 'and a fill-in each');
  send('lee', { t: 'challenge.send', name: 'OLD', mode: 'pro' });
  assert(!ws.lee.last('social').ok && /new version/.test(ws.lee.last('social').msg), 'an older game is never challenged to PRO MATCH');
  assert(!ws.old.last('challenge.invite'), 'and is not even asked');
  send('lee', { t: 'challenge.send', name: 'OLD', mode: 'worldcup' });
  assert.equal(ws.old.last('challenge.invite').mode, 'match', 'a cup is not a challenge: anything else asked for is a 1v1');
  send('old', { t: 'challenge.decline', id: ws.old.last('challenge.invite').id });
  // a 1v1, played to the end: the end says who to have a rematch with, and what at
  const m1 = play('jon', 'kim', 'match');
  assert.equal(ws.jon.last('start').format, '1v1', 'a 1v1 starts');
  const r1 = game._roomOf('jon');
  for (let i = 0; i < 200 && r1.m.phase !== 'play'; i++) await sleep(50);
  r1.m.score.blue = 2; r1.m.time = 0.05;
  for (let i = 0; i < 200 && !ws.jon.last('end'); i++) await sleep(50);
  assert.deepEqual(ws.jon.last('end').rematch, { name: 'KIM', mode: 'match' }, 'jon: a rematch with KIM');
  assert.deepEqual(ws.kim.last('end').rematch, { name: 'JON', mode: 'match' }, 'kim: a rematch with JON');
  // a match out of the queue has none
  const q = game._roomOf('hal');
  assert(!q.challenge || q.challenge.mode === 'pro', 'only a challenge room carries one');
  console.log('challenge scan passed (1v1, penalties, free kicks, PRO MATCH, older games, rematch)');
  process.exit(0);
})();
