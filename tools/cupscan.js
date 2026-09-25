// Friend tournaments, run against the real server game code with fake sockets.
//   node tools/cupscan.js
// A knockout between 4 or 8 friends: the host invites, everyone plays 1v1s, the winners go
// through, and the last one standing lifts the cup. Walkovers cover anyone who isn't there.
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
const view = (id) => socks[id].last('cup');
async function waitFor(ws, t, after, ms = 15000, pred = () => true) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t && pred(ws.got[i])) return ws.got[i]; await sleep(25); }
  return null;
}
// play out every live match of the round: the first name given wins each one
async function playRound(winners) {
  const rooms = [];
  for (const id of Object.keys(socks)) { const r = game._roomOf(id); if (r && r.cup && !rooms.includes(r)) rooms.push(r); }
  for (const room of rooms) {
    while (room.m.phase !== 'play') await sleep(20);
    const win = room.seats.find((s) => s.human && winners.includes(s.userId));
    const team = win ? win.team : 'blue';
    room.m.score[team] = 2; room.m.score[team === 'blue' ? 'red' : 'blue'] = 0;
    room.m.time = 0.05;
  }
  for (const room of rooms) { const t0 = Date.now(); while (room.state !== 'over' && Date.now() - t0 < 8000) await sleep(20); }
  return rooms.length;
}

(async () => {
  const four = ['cupa', 'cupb', 'cupc', 'cupd'];
  for (const id of [...four, 'cupx']) connect(id);
  for (const id of four.slice(1)) befriend('cupa', id);

  console.log('making a cup');
  let n = socks.cupa.got.length;
  say('cupa', { t: 'cup.create', size: 3 });
  check('only 4 or 8 players', !!socks.cupa.since(n, 'error').length, socks.cupa.last('error'));
  say('cupa', { t: 'cup.create', size: 4 });
  check('a cup of four is made', view('cupa') && view('cupa').size === 4 && view('cupa').state === 'lobby');
  check('the host is in it already', view('cupa').players.length === 1 && view('cupa').players[0].name === 'CUPA');
  n = socks.cupa.got.length;
  say('cupa', { t: 'cup.invite', name: 'CUPX' });
  check('you can only invite a friend', !!socks.cupa.since(n, 'error').length, socks.cupa.last('error'));
  n = socks.cupb.got.length;
  say('cupa', { t: 'cup.invite', name: 'CUPB' });
  const inv = socks.cupb.since(n, 'cup.invite')[0];
  check('a friend gets asked', !!inv && inv.from === 'CUPA' && inv.size === 4, inv);
  check('the host sees them waiting', view('cupa').invited.includes('CUPB'));
  n = socks.cupa.got.length;
  say('cupa', { t: 'cup.start' });
  check('you cannot start it half empty', !!socks.cupa.since(n, 'error').length, socks.cupa.last('error'));

  say('cupb', { t: 'cup.accept', id: inv.id });
  check('they join', view('cupa').players.length === 2 && view('cupb').players.length === 2);
  check('and are off the waiting list', !view('cupa').invited.length);
  for (const id of ['cupc', 'cupd']) { say('cupa', { t: 'cup.invite', name: id.toUpperCase() }); say(id, { t: 'cup.accept', id: inv.id }); }
  check('all four are in', view('cupa').players.length === 4, view('cupa').players.map((p) => p.name));
  n = socks.cupa.got.length;
  say('cupa', { t: 'cup.invite', name: 'CUPB' });
  check('a full cup takes nobody else', !!socks.cupa.since(n, 'error').length, socks.cupa.last('error'));
  n = socks.cupb.got.length;
  say('cupb', { t: 'cup.start' });
  check('only the host can start it', !!socks.cupb.since(n, 'error').length, socks.cupb.last('error'));

  console.log('round one');
  say('cupa', { t: 'cup.start' });
  await sleep(120);
  const v = view('cupa');
  check('the draw is made', v.state === 'playing' && v.rounds.length === 1 && v.rounds[0].length === 2, v.rounds);
  check('everybody is drawn once', new Set(v.rounds[0].flatMap((t) => [t.a, t.b])).size === 4);
  check('both ties are on', v.rounds[0].every((t) => t.live));
  check('everyone is in a match', four.every((id) => !!game._roomOf(id)));
  check('and those matches are golden goal', four.every((id) => game._roomOf(id).m.noDraw));
  n = socks.cupa.got.length;
  say('cupa', { t: 'queue', format: '1v1' });
  check('a cup player cannot go looking for other matches', !!socks.cupa.since(n, 'error').length, socks.cupa.last('error'));

  const semiWinners = [v.rounds[0][0].a, v.rounds[0][1].a].map((nm) => nm.toLowerCase());
  const semiLosers = [v.rounds[0][0].b, v.rounds[0][1].b].map((nm) => nm.toLowerCase());
  n = socks[semiWinners[0]].got.length;
  const nLose = socks[semiLosers[0]].got.length;
  check('two matches were played', (await playRound(semiWinners)) === 2);
  const endW = socks[semiWinners[0]].since(n, 'end')[0], endL = socks[semiLosers[0]].since(nLose, 'end')[0];
  check('the winner is told they are through', !!(endW && endW.fcup && endW.fcup.won && !endW.fcup.champion), endW && endW.fcup);
  check('with the round and how big the cup is', !!(endW && endW.fcup.round === 0 && endW.fcup.of === 2 && endW.fcup.size === 4), endW && endW.fcup);
  check('the loser is told they are out', !!(endL && endL.fcup && !endL.fcup.won), endL && endL.fcup);
  const after = view(semiWinners[0]);
  check('the bracket kept the scores', after.rounds[0].every((t) => t.sa !== null && t.sb !== null), after.rounds[0]);
  check('the final is drawn', after.rounds.length === 2 && after.rounds[1].length === 1, after.rounds[1]);
  check('with the two winners in it', [after.rounds[1][0].a, after.rounds[1][0].b].sort().join() === semiWinners.map((x) => x.toUpperCase()).sort().join(), after.rounds[1][0]);
  check('and a countdown to it', after.nextIn > 0 && after.nextIn <= 9000, after.nextIn);
  check('the losers are marked out', after.players.filter((p) => p.out).length === 2);
  n = socks[semiWinners[0]].got.length;
  say(semiWinners[0], { t: 'queue', format: '4v4' });
  await sleep(60);
  check('you cannot go looking for another match while the cup waits', !!socks[semiWinners[0]].since(n, 'error').length && !socks[semiWinners[0]].since(n, 'queue').length, socks[semiWinners[0]].last('error'));

  console.log('the final');
  const final = await waitFor(socks[semiWinners[0]], 'start', socks[semiWinners[0]].got.length, 15000);
  check('it starts on its own', !!final);
  check('the start card says which round it is', !!(final && final.fcup && final.fcup.round === 1 && final.fcup.of === 2), final && final.fcup);
  const champ = semiWinners[0], runnerUp = semiWinners[1];
  n = socks[champ].got.length;
  check('one match was played', (await playRound([champ])) === 1);
  const endC = socks[champ].since(n, 'end')[0];
  check('the winner lifts the cup', !!(endC && endC.fcup && endC.fcup.champion), endC && endC.fcup);
  check('and is told so on its own', !!(await waitFor(socks[champ], 'cup.won', n, 3000)));
  const done = view(champ);
  check('the cup is finished', done.state === 'done' && done.champion === champ.toUpperCase(), { state: done.state, champion: done.champion });
  check('the runner-up sees the same board', view(runnerUp).champion === champ.toUpperCase());
  check('nobody is left in a match', four.every((id) => !game._roomOf(id)));

  console.log('walkovers: a cup carries on without you');
  const eight = ['c8a', 'c8b', 'c8c', 'c8d'];
  for (const id of eight) connect(id);
  for (const id of eight.slice(1)) befriend('c8a', id);
  say('c8a', { t: 'cup.create', size: 4 });
  const cupId = view('c8a').id;
  for (const id of eight.slice(1)) { say('c8a', { t: 'cup.invite', name: id.toUpperCase() }); say(id, { t: 'cup.accept', id: cupId }); }
  say('c8a', { t: 'cup.start' });
  await sleep(120);
  const v8 = view('c8a');
  const tie = v8.rounds[0].find((t) => t.a !== 'C8A' && t.b !== 'C8A') || v8.rounds[0][0];
  const quit = tie.a.toLowerCase(), stay = tie.b.toLowerCase();
  n = socks[stay].got.length;
  say(quit, { t: 'cup.leave' });
  await sleep(200);
  check('leaving mid-match hands the tie over', !!game._roomOf(stay) || view(stay).rounds[0].some((t) => t.w === stay.toUpperCase()));
  // the abandoned match forfeits on its own; play the other tie out and make sure the cup still runs
  const room = game._roomOf(stay);
  if (room) { while (room.m.phase !== 'play') await sleep(20); room.m.score[room.seats.find((s) => s.userId === stay).team] = 1; room.m.time = 0.05; }
  await playRound([stay, 'c8a']);
  const v8b = view('c8a');
  check('the cup moved on to the final', v8b.rounds.length === 2 || v8b.state === 'done', { rounds: v8b.rounds.length, state: v8b.state });
  check('the one who left is marked out', v8b.players.find((p) => p.name === quit.toUpperCase()).out);

  console.log('calling it off');
  for (const id of ['cz1', 'cz2']) connect(id);
  befriend('cz1', 'cz2');
  say('cz1', { t: 'cup.create', size: 4 });
  const zid = view('cz1').id;
  say('cz1', { t: 'cup.invite', name: 'CZ2' }); say('cz2', { t: 'cup.accept', id: zid });
  n = socks.cz2.got.length;
  say('cz1', { t: 'cup.leave' });
  await sleep(60);
  check('the host leaving calls it off for everyone', !!socks.cz2.since(n, 'cup.end').length, socks.cz2.last('cup.end'));
  check('and nobody is left holding a cup', !game._social.cupOf.has('cz1') && !game._social.cupOf.has('cz2'));
  say('cz1', { t: 'cup.create', size: 4 });
  say('cz1', { t: 'cup.invite', name: 'CZ2' }); say('cz2', { t: 'cup.accept', id: view('cz1').id });
  n = socks.cz1.got.length;
  socks.cz2.close();
  await sleep(80);
  check('someone dropping out of a waiting cup leaves it', view('cz1').players.length === 1, view('cz1').players.map((p) => p.name));

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
