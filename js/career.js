// Club Career: playing for a club instead of your country.
//
// Every three days four clubs make you an offer. Each one pays coins for every goal you score and
// every goal you set up, and the bigger the club the more it pays (your stats count too). Sign one
// and you play for it — its kit, its badge, its ground — in every mode, with the Champions Cup in
// place of the World Cup. The contract runs for three days; then there are new offers to look at.
//
// The clubs and their badges are made up (js/clubs.js says why). Everything here lives in the save
// (Save.data.cc), so it works with no connection; the server only ever sees which club's kit you
// are wearing in an online match.

const CC_PERIOD = 3 * 86400000;            // new offers, and how long a contract runs
const CC_EPOCH = Date.UTC(2026, 10, 1);    // offer windows are counted from here
const CC_BOT_PRIZE = 400;                  // winning the Champions Cup against bots
const CC_PRIZE = 1200;                     // and online
const CC_PENS_RATE = 0.5;                  // a goal in a shootout pays half a goal in a match

const Career = {
  // which three-day window it is, and when it ends
  period(now = Date.now()) { return Math.floor((now - CC_EPOCH) / CC_PERIOD); },
  periodEnds(p = this.period()) { return CC_EPOCH + (p + 1) * CC_PERIOD; },

  state() {
    if (!Save.data.cc) Save.data.cc = { club: null, goal: 0, assist: 0, since: 0, until: 0, goals: 0, assists: 0, earned: 0, total: 0, titles: 0, signed: 0, run: [], cup: null, offers: null, signedIn: -1, seen: -1 };
    const s = Save.data.cc;
    if (!Number.isInteger(s.signedIn)) s.signedIn = -1;
    if (!Number.isInteger(s.seen)) s.seen = -1;
    if (!Array.isArray(s.run)) s.run = [];
    return s;
  },
  club() { return Clubs.career(); },
  // still under contract (and so being paid)
  active(now = Date.now()) { const s = Save.data.cc; return !!(s && s.club && now < s.until); },
  // offers you have not looked at yet
  fresh() { return this.state().seen !== this.period(); },
  // you sign once per window: after that the other three have gone elsewhere
  signedThisWindow() { return this.state().signedIn === this.period(); },

  // a number that is the same for this player every time, so the offers do not change on a reload
  seed() {
    let s = Save.data.ccSeed;
    if (!s) { s = Save.data.ccSeed = ((Math.random() * 2147483647) | 0) || 7; }
    const name = String(Save.account || '');
    let h = s >>> 0;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 2654435761) >>> 0;
    return h;
  },

  // this window's four offers (made once, then kept)
  offers() {
    const s = this.state(), p = this.period();
    const ok = s.offers && s.offers.period === p && Array.isArray(s.offers.list) && s.offers.list.length === 4
      && s.offers.list.every((o) => o && EURO_IDS.has(o.club) && o.goal > 0 && o.assist > 0);
    if (!ok) { s.offers = { period: p, list: this.makeOffers(p) }; Save.write(); }
    return s.offers.list;
  },

  // Four different clubs, four different wages. How far up the ladder they come from depends on
  // how good your player is: the giants start calling once your stats are up.
  makeOffers(p) {
    const rng = mulberry32((this.seed() + p * 7919) >>> 0);
    const ovr = Save.character().ovr;
    const reach = clamp((ovr - 58) / 24, 0, 1);            // 0 at OVR 58, 1 at OVR 82
    const mine = Save.data.cc && Save.data.cc.club;
    const used = new Set(mine ? [mine] : []);
    const pickStars = (stars) => {
      for (let s = stars; s >= 2; s--) {
        const pool = EURO_CLUBS.filter((c) => c.stars === s && !used.has(c.id));
        if (pool.length) { const c = pool[(rng() * pool.length) | 0]; used.add(c.id); return c; }
      }
      const rest = EURO_CLUBS.filter((c) => !used.has(c.id));
      const c = rest[(rng() * rest.length) | 0]; used.add(c.id); return c;
    };
    const tiers = [
      rng() < 0.3 + reach * 0.7 ? 5 : 4,
      rng() < reach * 0.6 ? 5 : 4,
      rng() < 0.35 + reach * 0.5 ? 4 : 3,
      rng() < 0.15 ? 2 : 3,
    ];
    const out = tiers.map((stars) => {
      const c = pickStars(stars);
      const goal = Math.max(5, Math.round(((6 + c.stars * 8) * (1 + (ovr - 60) / 50) * (0.85 + rng() * 0.3)) / 5) * 5);
      const assist = Math.max(5, Math.round((goal * (0.55 + rng() * 0.15)) / 5) * 5);
      return { club: c.id, goal, assist };
    });
    // every offer pays something different
    out.sort((a, b) => b.goal - a.goal || b.assist - a.assist);
    for (let i = 1; i < out.length; i++) if (out[i].goal >= out[i - 1].goal) out[i].goal = Math.max(5, out[i - 1].goal - 5);
    return out;
  },

  // sign for one of this window's offers
  sign(clubId) {
    const s = this.state();
    if (this.signedThisWindow()) return false;
    const o = this.offers().find((x) => x.club === clubId);
    if (!o) return false;
    const now = Date.now(), changed = s.club !== o.club;
    Object.assign(s, { club: o.club, goal: o.goal, assist: o.assist, since: now, until: now + CC_PERIOD, goals: 0, assists: 0, earned: 0, signed: (s.signed || 0) + 1, signedIn: this.period(), seen: this.period() });
    // a cup run belongs to the club you started it with
    if (changed) { s.cup = null; s.run = []; }
    Save.data.arena = 'club';
    Save.write();
    if (typeof Net !== 'undefined' && Net.sendArena) Net.sendArena();
    return true;
  },

  // Pay for a match played as your club: goals and assists at the contract's rates, only while it
  // runs. Returns what was paid (and what for), or null when nothing was owed.
  pay(m, goals, assists, pens) {
    if (!Clubs.clubMode() || !this.active() || (m && (m.training || m.autopilot))) return null;
    const s = Save.data.cc;
    const g = Math.max(0, Math.min(60, goals | 0)), a = pens ? 0 : Math.max(0, Math.min(60, assists | 0));
    const goalRate = pens ? Math.max(1, Math.round(s.goal * CC_PENS_RATE)) : s.goal;
    const coins = g * goalRate + a * s.assist;
    if (!coins) return { goals: g, assists: a, coins: 0, goalRate, assistRate: s.assist };
    s.goals += g; s.assists += a; s.earned += coins; s.total = (s.total || 0) + coins;
    Save.data.coins += coins;
    return { goals: g, assists: a, coins, goalRate, assistRate: s.assist };
  },

  // "2 DAYS 4 H", "5 H 12 MIN", "3 MIN"
  timeLeft(ms) {
    const m = Math.max(0, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return h ? tlN(d, '{0} DAY', '{0} DAYS') + ' ' + tl('{0} H', [h]) : tlN(d, '{0} DAY', '{0} DAYS');
    if (h) return tl('{0} H {1} MIN', [h, mm]);
    return tl('{0} MIN', [Math.max(1, mm)]);
  },
  // the biggest unit only, for small spaces: "3 DAYS", "5 H", "12 MIN"
  timeShort(ms) {
    const m = Math.max(0, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m / 60);
    if (d) return tlN(d, '{0} DAY', '{0} DAYS');
    if (h) return tl('{0} H', [h]);
    return tl('{0} MIN', [Math.max(1, m)]);
  },

  // switch sides: 'club' (needs a club) or 'intl'
  setArena(arena) {
    const want = arena === 'club' && this.club() ? 'club' : 'intl';
    if (Save.data.arena === want) return want;
    Save.data.arena = want;
    Save.write();
    if (typeof Net !== 'undefined' && Net.sendArena) Net.sendArena();
    return want;
  },
};
