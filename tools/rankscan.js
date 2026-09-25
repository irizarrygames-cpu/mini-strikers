// Ranked seasons, against the real server code with fake sockets (no accounts, no network)
const { createGame } = require('../server/game');

const { createSim } = require('../server/sim');
const sim = createSim();
const { rankTier, rankNext, rankDelta, seasonNow, seasonEndsAt, RANK_TIERS } = sim;

let failures = 0;
const check = (n, ok, d) => { console.log((ok ? '  ok   ' : '  FAIL ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!ok) failures++; };

console.log('tiers and thresholds');
check('a new player is bronze', rankTier(0).id === 'bronze');
check('150 is silver, 399 still silver', rankTier(150).id === 'silver' && rankTier(399).id === 'silver');
check('the top threshold is legend and there is nothing above it', rankTier(2000).id === 'legend' && rankNext(2000) === null, rankTier(2000).id);
check('every tier pays more than the one below', RANK_TIERS.every((t, i) => i === 0 || t.reward > RANK_TIERS[i - 1].reward));
check('the tiers climb in order', RANK_TIERS.every((t, i) => i === 0 || t.at > RANK_TIERS[i - 1].at));

console.log('what a result is worth');
const win = rankDelta('win', 3, 1), loss = rankDelta('loss', 1, 3), draw = rankDelta('draw', 1, 1);
check('a win pays, a loss costs less than a win pays', win > 0 && loss < 0 && Math.abs(loss) < win, { win, loss, draw });
check('a draw is small and positive', draw > 0 && draw < win, draw);
check('a thrashing is worth more than a squeak', rankDelta('win', 5, 0) > rankDelta('win', 1, 0));
check('the score cannot swing it wildly', rankDelta('win', 50, 0) <= 40 && rankDelta('loss', 0, 50) >= -25, [rankDelta('win', 50, 0), rankDelta('loss', 0, 50)]);

console.log('a season of real results moves you sensibly');
let rp = 0;
for (let i = 0; i < 30; i++) rp = Math.max(0, rp + rankDelta(i % 3 === 0 ? 'loss' : 'win', 2, 1)); // wins two in three
const gold = RANK_TIERS.find((x) => x.id === 'gold');
const atLeast = (id, tierId) => RANK_TIERS.findIndex((x) => x.id === tierId) >= RANK_TIERS.findIndex((x) => x.id === id);
check('winning two in three for 30 games reaches gold or better', atLeast('gold', rankTier(rp).id), { rp, tier: rankTier(rp).id });
let rp2 = 0;
for (let i = 0; i < 20; i++) rp2 = Math.max(0, rp2 + rankDelta(i % 3 === 0 ? 'win' : 'loss', 1, 2)); // loses two in three
check('losing two in three never goes below zero', rp2 >= 0, rp2);
check('and stays in the lower tiers', !atLeast('gold', rankTier(rp2).id), { rp2, tier: rankTier(rp2).id });

console.log('seasons roll over');
const now = seasonNow();
check('a season number is a whole number that is not in the future', Number.isInteger(now) && now >= 0, now);
check('the season ends later than it started', seasonEndsAt(now) > Date.now(), new Date(seasonEndsAt(now)).toISOString().slice(0, 10));
check('each season ends two weeks after the last', seasonEndsAt(now + 1) - seasonEndsAt(now) === 14 * 86400000);

console.log('the end of a match carries the new rank');
const users = {};
const account = (id) => (users[id] = users[id] || { name: id.toUpperCase(), club: 'spain', save: { xp: 0 }, rank: null });
// the same rank maths server.js keeps on an account
function rankOf(u) {
  const r = u.rank && typeof u.rank === 'object' ? u.rank : {};
  const s = seasonNow(), rp = Math.max(0, Number(r.rp) || 0);
  if ((r.season | 0) !== s) return { season: s, rp: Math.round(rp * 0.4), best: Math.max(rp, Number(r.best) || 0), owed: (rp > 0 ? rankTier(rp).reward : 0) + (Number(r.owed) || 0), last: rp ? rankTier(rp).id : null, wins: 0, played: 0 };
  return { season: s, rp, best: Math.max(rp, Number(r.best) || 0), owed: Number(r.owed) || 0, last: r.last || null, wins: r.wins | 0, played: r.played | 0 };
}
function record(u, outcome, gf, ga) {
  const r = rankOf(u);
  r.rp = Math.max(0, r.rp + rankDelta(outcome, gf, ga));
  r.best = Math.max(r.best, r.rp); r.played++; if (outcome === 'win') r.wins++;
  u.rank = r; return r;
}
const view = (u) => { const r = rankOf(u); u.rank = r; const t = rankTier(r.rp), n = rankNext(r.rp); return { rp: r.rp, tier: t.id, name: t.name, next: n ? { id: n.id, name: n.name, at: n.at } : null, season: r.season, ends: seasonEndsAt(r.season), best: r.best, wins: r.wins, played: r.played }; };

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  removeListener() {}
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(o) { this.lastSeen = Date.now(); this.handlers.message(o); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
}
const game = createGame({
  getUser: (id) => account(id),
  userName: (id) => id.toUpperCase(),
  saveDB: () => {},
  onlineRecord: (id, r) => record(account(id), r.outcome, r.goalsFor, r.goalsAgainst),
  isNameTaken: () => false,
  ranked: { view: (id) => view(account(id)) },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const a = new FakeWS(), b = new FakeWS();
  game.connect(a, 'ranka'); game.connect(b, 'rankb');
  a.msg({ t: 'queue', format: '1v1' }); b.msg({ t: 'queue', format: '1v1' });
  const t0 = Date.now();
  while (!game._roomOf('ranka') && Date.now() - t0 < 5000) await sleep(40);
  const room = game._roomOf('ranka');
  check('a match started', !!room);
  while (room.m.phase !== 'play') await sleep(30);
  const seat = room.seats.find((s) => s.userId === 'ranka');
  room.m.score[seat.team] = 3; room.m.score[seat.team === 'blue' ? 'red' : 'blue'] = 1;
  room.m.time = 0.05;
  const t1 = Date.now();
  while (!a.last('end') && Date.now() - t1 < 8000) await sleep(40);
  const endA = a.last('end'), endB = b.last('end');
  check('the winner is told their new rank', !!(endA && endA.rank) && endA.rank.rp > 0, endA && { rp: endA.rank.rp, tier: endA.rank.tier, d: endA.rankD });
  check('and how much it moved', endA && endA.rankD === rankDelta('win', 3, 1), endA && endA.rankD);
  check('the loser is told too, and lost points', !!(endB && endB.rank) && endB.rankD < 0, endB && { rp: endB.rank.rp, d: endB.rankD });
  check('a loser never goes below zero', endB && endB.rank.rp >= 0, endB && endB.rank.rp);
  check('the account kept the points', account('ranka').rank.rp === endA.rank.rp && account('ranka').rank.wins === 1, account('ranka').rank);
  check('the season and its end date came along', endA.rank.season === seasonNow() && endA.rank.ends > Date.now());

  // a season that ended while they were away
  const u = account('ranka');
  u.rank = { season: seasonNow() - 1, rp: 900, best: 900, owed: 0, last: null, wins: 8, played: 12 };
  const rolled = rankOf(u);
  check('an old season pays the tier they finished in', rolled.owed === rankTier(900).reward && rolled.owed > 0, { owed: rolled.owed, tier: rankTier(900).id });
  check('and the new season starts part way down, not at zero', rolled.rp === 360 && rolled.season === seasonNow(), { rp: rolled.rp });
  check('the best is remembered', rolled.best === 900);

  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
