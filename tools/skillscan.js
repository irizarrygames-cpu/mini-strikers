// You play people around your own rank.
//   node tools/skillscan.js
//
// Runs the real server matchmaking over fake sockets. The things that matter:
//   * a beginner and somebody at the top of the ladder do not get put together while there are
//     closer opponents in the queue
//   * a party counts as its best player, so a strong player cannot hide behind two beginners
//   * nobody is left in the queue for ever: once the wait is up, rank stops being a reason to
//     keep them out and they get a game against whoever is there
//   * the old promises still hold — the right number of players, nobody split off their party
const { createGame } = require('../server/game');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  removeListener() {}
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(o) { this.lastSeen = Date.now(); this.handlers.message(o); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
  since(n, t) { return this.got.slice(n).filter((m) => m.t === t); }
}

// every player gets a rank; rp is what the ladder shows
const users = {};
const mk = (id, rp, online) => (users[id] = {
  name: id.toUpperCase(), club: 'spain', save: { xp: 0 },
  rank: { rp, season: 0, best: rp, wins: 0, played: 0, last: 0 },
  online: online || null,
});

const game = createGame({
  getUser: (id) => users[id],
  userName: (id) => (users[id] ? users[id].name : id.toUpperCase()),
  saveDB: () => {},
  onlineRecord: () => {},
  isNameTaken: () => false,
  worldCup: { round: () => 0, result: () => ({ round: 0, champion: false, titles: 0 }) },
  ranked: { view: (id) => (users[id] ? users[id].rank : null) },
  league: { move: () => {}, result: () => {}, pos: () => 7 },
});

let fails = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 220) : '')); if (!ok) fails++; };
const socks = {};
const connect = (id) => { socks[id] = new FakeWS(); game.connect(socks[id], id); return socks[id]; };
const rpOf = (id) => (users[id] && users[id].rank ? users[id].rank.rp : 0);
// start each part with nobody left over from the last one
const clearQueues = () => { for (const k of Object.keys(game._social.queues)) game._social.queues[k].length = 0; };

async function waitFor(ws, t, after = 0, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { for (let i = after; i < ws.got.length; i++) if (ws.got[i].t === t) return ws.got[i]; await sleep(25); }
  return null;
}
// who ended up in the same room as this player
const roomMates = (id) => {
  const r = game._roomOf(id);
  return r ? r.seats.filter((s) => s.human).map((s) => s.userId) : [];
};

(async () => {
  console.log('a beginner is not thrown in with the best player on the ladder');
  // four in the queue at once: two beginners, two near the top
  mk('newA', 0); mk('newB', 5); mk('proA', 760); mk('proB', 800);
  for (const id of ['newA', 'proA', 'newB', 'proB']) connect(id);
  // queued in an order that would have paired a beginner with a pro under the old first-come rule
  for (const id of ['newA', 'proA', 'newB', 'proB']) socks[id].msg({ t: 'queue', format: '1v1' });
  await sleep(1600);
  const newMates = roomMates('newA'), proMates = roomMates('proA');
  check('the two beginners play each other', newMates.length === 2 && newMates.includes('newB'), newMates.map((x) => x + '(' + rpOf(x) + ')'));
  check('and the two at the top play each other', proMates.length === 2 && proMates.includes('proB'), proMates.map((x) => x + '(' + rpOf(x) + ')'));
  const gap = Math.abs(rpOf(newMates[0]) - rpOf(newMates[1]));
  check('the gap in that match is small', gap <= 50, 'rank points apart: ' + gap);
  for (const id of ['newA', 'newB', 'proA', 'proB']) socks[id].msg({ t: 'leave' });
  await sleep(120); clearQueues();

  console.log('a middling player gets the nearest of several');
  mk('mid', 300); mk('low', 20); mk('close', 330); mk('high', 790);
  for (const id of ['mid', 'low', 'close', 'high']) { connect(id); }
  socks.mid.msg({ t: 'queue', format: '1v1' });
  await sleep(50);
  for (const id of ['low', 'high', 'close']) socks[id].msg({ t: 'queue', format: '1v1' });
  await sleep(1600);
  const midMates = roomMates('mid').filter((x) => x !== 'mid');
  check('they get the one nearest their rank', midMates[0] === 'close', midMates.map((x) => x + '(' + rpOf(x) + ')'));
  for (const id of ['mid', 'low', 'close', 'high']) socks[id].msg({ t: 'leave' });
  await sleep(120); clearQueues();

  console.log('nobody is left waiting for ever');
  mk('lonely', 400); mk('faraway', 10);
  connect('lonely'); connect('faraway');
  socks.lonely.msg({ t: 'queue', format: '1v1' });
  socks.faraway.msg({ t: 'queue', format: '1v1' });
  // far apart in rank, so the first look should pass them over
  await sleep(1200);
  const early = game._roomOf('lonely');
  check('too far apart to pair straight away', !early, early ? 'paired immediately' : 'held back');
  // let their wait run out: rank must stop being a reason to keep them out
  const qs = game._social.queues['1v1'] || [];
  for (const e of qs) { e.at -= 60000; e.wait = 1000; }
  await sleep(1600);
  const mates = roomMates('lonely');
  check('once the wait is up they get a game anyway', mates.length === 2 && mates.includes('faraway'), mates.map((x) => x + '(' + rpOf(x) + ')'));
  for (const id of ['lonely', 'faraway']) socks[id].msg({ t: 'leave' });
  await sleep(120); clearQueues();

  console.log('a party counts as its best player');
  mk('carry', 780); mk('pal1', 0); mk('pal2', 0);       // one strong player, two beginners
  mk('soloA', 770); mk('soloB', 760); mk('soloC', 750); // a strong trio queueing alone
  for (const id of ['carry', 'pal1', 'pal2', 'soloA', 'soloB', 'soloC']) connect(id);
  const befriend = (a, b) => { socks[a].msg({ t: 'friend.add', name: b.toUpperCase() }); socks[b].msg({ t: 'friend.accept', name: a.toUpperCase() }); };
  befriend('carry', 'pal1'); befriend('carry', 'pal2');
  await sleep(60);
  for (const m of ['pal1', 'pal2']) {
    socks.carry.msg({ t: 'party.invite', name: m.toUpperCase() });
    const inv = await waitFor(socks[m], 'party.invite', 0, 1500);
    if (inv) socks[m].msg({ t: 'party.accept', id: inv.id });
  }
  await sleep(120);
  const partySkill = (() => { socks.carry.msg({ t: 'queue', format: '3v3' }); return true; })();
  await sleep(60);
  const q3 = game._social.queues['3v3'] || [];
  const entry = q3.find((e) => e.ids.includes('carry'));
  check('the party is rated by its best player, not its average', entry && entry.skill === 780, entry && { skill: entry.skill, members: entry.ids });
  void partySkill;
  for (const id of ['soloA', 'soloB', 'soloC']) socks[id].msg({ t: 'queue', format: '3v3' });
  await sleep(1800);
  const r3 = game._roomOf('carry');
  check('and it fills a 3v3 against players of that standard', !!r3 && r3.seats.filter((s) => s.human).length === 6, r3 && r3.seats.filter((s) => s.human).map((s) => s.userId + '(' + rpOf(s.userId) + ')'));
  check('the party is still together on one side', !!r3 && (() => {
    const t = r3.seats.filter((s) => ['carry', 'pal1', 'pal2'].includes(s.userId)).map((s) => s.team);
    return t.length === 3 && new Set(t).size === 1;
  })(), r3 && r3.seats.filter((s) => s.human).map((s) => s.userId + ':' + s.team));

  console.log('someone who only plays casual still gets rated');
  // no ranked history at all, but a strong online record
  mk('casualgood', 0, { p: 30, w: 26, d: 1, l: 3, gf: 90, ga: 25, goals: 60 });
  mk('casualnew', 0, { p: 1, w: 0, d: 0, l: 1, gf: 0, ga: 6, goals: 0 });
  connect('casualgood'); connect('casualnew');
  socks.casualgood.msg({ t: 'queue', format: '1v1' });
  await sleep(50);
  const qc = game._social.queues['1v1'] || [];
  const goodEntry = qc.find((e) => e.ids.includes('casualgood'));
  socks.casualnew.msg({ t: 'queue', format: '1v1' });
  await sleep(50);
  const newEntry = (game._social.queues['1v1'] || []).find((e) => e.ids.includes('casualnew'));
  check('a strong casual record rates well above zero', !!goodEntry && goodEntry.skill > 100, goodEntry && goodEntry.skill);
  check('and a beginner stays near the bottom', !!newEntry && newEntry.skill < 40, newEntry && newEntry.skill);
  check('so the two are not treated as equals', !!goodEntry && !!newEntry && goodEntry.skill - newEntry.skill > 80, { good: goodEntry && goodEntry.skill, beginner: newEntry && newEntry.skill });

  console.log('the players filling an empty spot match the standard too');
  // Someone alone in the queue waits it out and the spots are filled in. A beginner should not
  // be handed opponents carrying the best characters in the game.
  // the character list comes from the same sandbox the server itself uses
  const { createSim } = require('../server/sim');
  const { CHARACTERS, pickBotCharacter, BOT_RARITY_SHARE, BOT_RARITY_ONLINE } = createSim();
  const rarityOf = (id) => { const c = CHARACTERS.find((x) => x.id === id); return c ? c.rarity : '?'; };
  const fillFor = async (who, rp, rounds) => {
    let top = 0, total = 0;
    for (let i = 0; i < rounds; i++) {
      const id = who + i;
      mk(id, rp);
      connect(id);
      socks[id].msg({ t: 'queue', format: '2v2' });
      await sleep(40);
      for (const e of (game._social.queues['2v2'] || [])) { e.at -= 60000; e.wait = 400; }
      await sleep(1200);
      const r = game._roomOf(id);
      if (r) {
        for (const seat of r.seats.filter((x) => !x.human)) { total++; if (rarityOf(seat.character) === 'legendary' || rarityOf(seat.character) === 'mythic') top++; }
        for (const seat of r.seats.filter((x) => x.human)) if (socks[seat.userId]) socks[seat.userId].msg({ t: 'leave' });
      }
      await sleep(50);
      clearQueues();
    }
    return { fillIns: total, best: top, pct: total ? Math.round((top / total) * 100) : 0 };
  };
  // Does the standard of the room reach the character picker at all? Twelve rounds each is
  // plenty to answer that — every empty spot has to come back filled.
  const low = await fillFor('rookie', 0, 12);
  const high = await fillFor('ace', 800, 12);
  check('empty spots are filled in for a beginner', low.fillIns > 0, low);
  check('and for someone at the top of the ladder', high.fillIns > 0, high);

  // How often a good character turns up is a question about the odds, not about any one match,
  // so it is asked of the odds. Thirty-six draws cannot tell 6% from 24%; twenty thousand can.
  const shareFor = (skill) => {
    const t = Math.max(0, Math.min(1, (skill || 0) / 800));
    const out = {};
    for (const k of Object.keys(BOT_RARITY_ONLINE)) out[k] = (BOT_RARITY_SHARE[k] || 0) * (1 - t) + BOT_RARITY_ONLINE[k] * t;
    return out;
  };
  const topShare = (skill, n = 20000) => {
    const share = shareFor(skill);
    let top = 0;
    for (let i = 0; i < n; i++) { const r = rarityOf(pickBotCharacter(Math.random, share).id); if (r === 'legendary' || r === 'mythic') top++; }
    return Math.round((top / n) * 1000) / 10;
  };
  const pctLow = topShare(0), pctMid = topShare(400), pctTop = topShare(800);
  console.log(`  draws: beginner ${pctLow}% top-tier · middle ${pctMid}% · ladder top ${pctTop}%`);
  check('a beginner is filled in with ordinary players', pctLow < 10, pctLow + '% top-tier');
  check('and someone at the top gets the strong ones', pctTop > pctLow * 2.5, { beginner: pctLow + '%', ladderTop: pctTop + '%' });
  check('and it climbs the whole way rather than jumping at the end', pctMid > pctLow && pctTop > pctMid, { low: pctLow, mid: pctMid, top: pctTop });

  console.log(fails ? `\n${fails} FAILED` : '\nall matchmaking checks passed');
  process.exit(fails ? 1 : 0);
})();
