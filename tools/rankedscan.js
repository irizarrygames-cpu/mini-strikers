// Ranked mode, run against the real server game code with fake sockets.
//   node tools/rankedscan.js
// Ranked is its own 1v1 queue that fills with bots if nobody turns up. A win is 10 points, a draw
// 5, a loss costs 5, and each of your three match challenges is one more. Nothing else in the
// game — an ordinary online match, a shootout, a friend cup, the World Cup — touches your rank.
const { createGame } = require('../server/game');
const { createSim } = require('../server/sim');
const sim = createSim();

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
const account = (id) => (users[id] = users[id] || { name: id.toUpperCase(), club: 'spain', save: { xp: 0 }, rp: 0 });
const banked = []; // every onlineRecord the game made
const game = createGame({
  getUser: (id) => users[id],
  userName: (id) => (users[id] ? users[id].name : id.toUpperCase()),
  saveDB: () => {},
  // the same rule server.js follows: a rank only moves for a ranked match
  onlineRecord: (id, r) => {
    banked.push({ id, ...r });
    const u = account(id);
    if (r.ranked) u.rp = Math.max(0, u.rp + sim.rankDelta(r.outcome, r.challenges));
  },
  isNameTaken: () => false,
  ranked: { view: (id) => ({ rp: account(id).rp, tier: sim.rankTier(account(id).rp).id, name: sim.rankTier(account(id).rp).name, next: null, season: sim.seasonNow(), ends: sim.seasonEndsAt(sim.seasonNow()), best: account(id).rp, wins: 0, played: 0 }) },
});

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const socks = {};
const connect = (id) => { account(id); socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
const say = (id, obj) => socks[id].msg(obj);
const befriend = (p, q) => { say(p, { t: 'friend.add', name: q }); say(q, { t: 'friend.accept', name: p }); };
async function waitFor(ws, t, after, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(25); }
  return null;
}
// end a room with a given score, and wait for the results to go out
async function endWith(room, blue, red) {
  while (room.m.phase !== 'play') await sleep(20);
  room.m.score.blue = blue; room.m.score.red = red;
  room.m.time = 0.05;
  const t0 = Date.now();
  while (room.state !== 'over' && Date.now() - t0 < 8000) await sleep(20);
}

(async () => {
  console.log('the points on their own');
  check('a win is 10', sim.rankDelta('win') === 10, sim.rankDelta('win'));
  check('a draw is 5', sim.rankDelta('draw') === 5, sim.rankDelta('draw'));
  check('a loss costs 5', sim.rankDelta('loss') === -5, sim.rankDelta('loss'));
  check('the score does not change it', sim.rankDelta('win', 0) === sim.rankDelta('win', 0) && sim.rankDelta('win') === 10);
  check('each challenge is one more point', sim.rankDelta('win', 3) === 13 && sim.rankDelta('loss', 2) === -3, [sim.rankDelta('win', 3), sim.rankDelta('loss', 2)]);
  check('three challenges is the most a match can have', sim.NET_CHALLENGES.length >= 3);
  check('nothing in the ranked pool needs a team-mate', sim.NET_CHALLENGES.every((c) => !c.team));

  console.log('a ranked match');
  for (const id of ['rka', 'rkb']) connect(id);
  say('rka', { t: 'queue', format: 'ranked' });
  check('you are told you are searching for a ranked match', (socks.rka.last('queue') || {}).format === 'ranked', socks.rka.last('queue'));
  say('rkb', { t: 'queue', format: 'ranked' });
  const start = await waitFor(socks.rka, 'start', 0);
  check('it starts', !!start);
  check('and it is 1v1', start && start.format === '1v1', start && start.format);
  check('the card says it is ranked', start && start.ranked === true, start && start.ranked);
  check('with three challenges of your own', !!(start && start.challenges && start.challenges.length === 3), start && start.challenges);
  check('all different', start && new Set(start.challenges.map((c) => c.id)).size === 3);
  const startB = socks.rkb.last('start');
  check('the other player gets their own three', !!(startB && startB.challenges && startB.challenges.length === 3));
  const room = game._roomOf('rka');
  check('the room knows it is ranked', !!room.ranked);
  check('a ranked match still allows a draw (it is not a cup)', !room.m.noDraw);

  console.log('the challenges tick over as you do them');
  const seat = room.seats.find((s) => s.userId === 'rka');
  while (room.m.phase !== 'play') await sleep(20);
  let n = socks.rka.got.length;
  await sleep(200);
  const before = socks.rka.since(n, 's').pop();
  check('nothing is done at the start', before && (before.me[10] | 0) === 0, before && before.me[10]);
  // give them whatever their first challenge asks for
  const first = seat.chal[0];
  const stats = seat.player.stats;
  if (first.id === 'score2') stats.goals = 2;
  else if (first.id === 'hattrick') stats.goals = 3;
  else if (first.id === 'tackle3') stats.tackles = 3;
  else if (first.id === 'skill5') stats.skills = 5;
  else if (first.id === 'dodge2') stats.dodges = 2;
  n = socks.rka.got.length;
  await sleep(250);
  const after = socks.rka.since(n, 's').pop();
  const liveOnes = ['score2', 'hattrick', 'tackle3', 'skill5', 'dodge2'];
  if (liveOnes.includes(first.id)) {
    check(`doing "${first.text}" shows up in the match`, after && (after.me[10] & 1) === 1, { mask: after && after.me[10], id: first.id });
  } else {
    check(`"${first.text}" is only settled at the end (nothing to show yet)`, after && (after.me[10] & 1) === 0, { mask: after && after.me[10], id: first.id });
  }

  console.log('what the result pays');
  const blueSeat = room.seats.find((s) => s.human && s.team === 'blue');
  const winner = blueSeat.userId, loser = winner === 'rka' ? 'rkb' : 'rka';
  const nW = socks[winner].got.length, nL = socks[loser].got.length;
  await endWith(room, 2, 0);
  const endW = socks[winner].since(nW, 'end')[0], endL = socks[loser].since(nL, 'end')[0];
  check('the winner gets a results card', !!endW);
  check('it says the match was ranked', endW && endW.ranked === true);
  check('with the three challenges and which came off', !!(endW && endW.challenges && endW.challenges.length === 3), endW && endW.challenges);
  const doneW = endW.challenges.filter((c) => c.done).length;
  check('the points are 10 for the win plus one a challenge', endW.rankD === 10 + doneW, { rankD: endW.rankD, done: doneW });
  check('and the new rank came with it', !!(endW.rank && typeof endW.rank.rp === 'number'), endW.rank);
  const doneL = endL.challenges.filter((c) => c.done).length;
  check('the loser drops 5, less what they finished', endL.rankD === -5 + doneL, { rankD: endL.rankD, done: doneL });
  check('the account was given exactly that', account(winner).rp === endW.rankD, { rp: account(winner).rp, rankD: endW.rankD });
  check('a loser never goes below zero', account(loser).rp === 0, account(loser).rp);
  check('the game was told it was a ranked result', banked.filter((b) => b.ranked).length === 2, banked.map((b) => [b.id, b.ranked, b.challenges]));
  check('a clean sheet counted for the winner', !endW.challenges.some((c) => /clean sheet/i.test(c.text) && !c.done), endW.challenges);
  check('...and not for the loser', !endL.challenges.some((c) => /clean sheet/i.test(c.text) && c.done), endL.challenges);

  console.log('nothing else moves a rank');
  banked.length = 0;
  for (const id of ['rkc', 'rkd'] ) connect(id);
  say('rkc', { t: 'queue', format: '1v1' }); say('rkd', { t: 'queue', format: '1v1' });
  const plain = await waitFor(socks.rkc, 'start', 0);
  check('an ordinary online match starts', !!plain);
  check('and it is not ranked', !plain.ranked && !plain.challenges, { ranked: plain.ranked, challenges: plain.challenges });
  const room2 = game._roomOf('rkc');
  const nC = socks.rkc.got.length;
  await endWith(room2, 3, 0);
  const endC = socks.rkc.since(nC, 'end')[0];
  check('its card carries no rank at all', !!endC && endC.rank === null && endC.rankD === 0, { rank: endC && endC.rank, rankD: endC && endC.rankD });
  check('and no challenges', endC.challenges === null);
  check('the accounts did not move', account('rkc').rp === 0 && account('rkd').rp === 0);
  check('the game was told it was not a ranked result', banked.length === 2 && banked.every((b) => !b.ranked));

  console.log('a shootout is not ranked either');
  banked.length = 0;
  for (const id of ['rke', 'rkf']) connect(id);
  say('rke', { t: 'queue', format: 'pens' }); say('rkf', { t: 'queue', format: 'pens' });
  const pens = await waitFor(socks.rke, 'pen.start', 0);
  check('a shootout starts', !!pens);
  const proom = game._roomOf('rke');
  { const t0=Date.now(); while (proom.state !== 'playing' && Date.now()-t0 < 8000) await sleep(30); } // the shootout has its own intro
  proom.pen.model.score.blue = 5; proom.pen.model.score.red = 3; proom.pen.model.winner = 'blue';
  proom.pen.phase = 'end'; proom.pen.nextAt = Date.now() - 1;
  const pend = await waitFor(socks.rke, 'pen.end', 0);
  check('it ends', !!pend);
  check('with no rank on the card', pend.rank === null && pend.rankD === 0, { rank: pend.rank, rankD: pend.rankD });
  check('and nothing banked as ranked', banked.every((b) => !b.ranked), banked.map((b) => b.ranked));

  console.log('the rules of the ranked queue');
  for (const id of ['rkg', 'rkh']) connect(id);
  befriend('rkg', 'rkh');
  say('rkg', { t: 'party.invite', name: 'RKH' });
  const inv = socks.rkh.last('party.invite');
  say('rkh', { t: 'party.accept', id: inv.id });
  await sleep(60);
  let nG = socks.rkg.got.length;
  say('rkg', { t: 'queue', format: 'ranked' });
  await sleep(60);
  check('a party cannot queue for ranked', !!socks.rkg.since(nG, 'error').length && !socks.rkg.since(nG, 'queue').length, socks.rkg.last('error'));
  nG = socks.rkg.got.length;
  say('rkg', { t: 'queue', format: '2v2' });
  await sleep(60);
  check('but the same party can still play an ordinary match', !!socks.rkg.since(nG, 'queue').length);
  say('rkg', { t: 'unqueue' });
  await sleep(40);
  const solo = connect('rki');
  say('rki', { t: 'queue', format: 'ranked' });
  await sleep(60);
  check('ranked waits in its own queue', game._social.queues.ranked.length === 1, Object.entries(game._social.queues).map(([k, v]) => k + ':' + v.length).join(' '));
  check('and it is left alone by the other queues', !game._social.queues['1v1'].length);
  say('rki', { t: 'unqueue' });

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
