const assert = require('assert');
const { createGame } = require('../server/game');
const users = Object.fromEntries(['ann','bob','cat'].map(id => [id, { name: id.toUpperCase(), club: 'spain', save: {} }]));
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
console.log('challenge scan passed');
process.exit(0);
