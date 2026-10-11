// Missions and the season.
//
// MISSIONS are jobs worth coins: three a day and one big one a week. Everybody gets the same set
// on the same day — they are picked from the date itself, not at random — so they do not change
// under you when you reload, and you and a friend can compare them.
//
// THE SEASON is the long game: a division of six teams, ten matches, three points a win, promotion
// for the top two and the drop for the bottom two. It is played against bots, so it works when the
// server is asleep.

// ---------------------------------------------------------------- missions
// kind: what counts. n: how many. coins: what it pays.
const MISSION_POOL = [
  { id: 'play3', kind: 'play', n: 3, coins: 300, text: 'Play {n} matches' },
  { id: 'win2', kind: 'win', n: 2, coins: 450, text: 'Win {n} matches' },
  { id: 'win4', kind: 'win', n: 4, coins: 800, text: 'Win {n} matches' },
  { id: 'goals6', kind: 'goals', n: 6, coins: 420, text: 'Score {n} goals' },
  { id: 'goals12', kind: 'goals', n: 12, coins: 750, text: 'Score {n} goals' },
  { id: 'online2', kind: 'onlineWin', n: 2, coins: 700, text: 'Win {n} online matches' },
  { id: 'skills8', kind: 'skills', n: 8, coins: 380, text: 'Pull off {n} skills' },
  { id: 'tackles10', kind: 'tackles', n: 10, coins: 360, text: 'Win {n} tackles' },
  { id: 'assists3', kind: 'assists', n: 3, coins: 480, text: 'Set up {n} goals' },
  { id: 'power2', kind: 'powerGoal', n: 2, coins: 520, text: 'Score {n} power-shot goals' },
  { id: 'clean1', kind: 'cleanSheet', n: 1, coins: 500, text: 'Win without letting one in' },
  { id: 'pens1', kind: 'pensWin', n: 1, coins: 550, text: 'Win a shootout' },
  { id: 'hat1', kind: 'hattrick', n: 1, coins: 650, text: 'Score a hat-trick' },
  { id: 'saves6', kind: 'saves', n: 6, coins: 400, text: 'Keep {n} shots out' },
];

const WEEKLY_POOL = [
  { id: 'w-win10', kind: 'win', n: 10, coins: 12000, text: 'Win {n} matches this week' },
  { id: 'w-goals40', kind: 'goals', n: 40, coins: 13000, text: 'Score {n} goals this week' },
  { id: 'w-online6', kind: 'onlineWin', n: 6, coins: 15000, text: 'Win {n} online matches this week' },
  { id: 'w-play20', kind: 'play', n: 20, coins: 10000, text: 'Play {n} matches this week' },
  { id: 'w-skills40', kind: 'skills', n: 40, coins: 11000, text: 'Pull off {n} skills this week' },
];

const Missions = {
  // the same three for everybody on the same day: the date picks them
  dayKey(d = new Date()) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  weekKey(d = new Date()) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // back to Monday
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  },
  seed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },

  // make sure the save is holding today's jobs and this week's
  state() {
    const d = Save.data;
    if (!d.missions) d.missions = { day: null, week: null, daily: [], weekly: null };
    const m = d.missions;
    const day = this.dayKey(), week = this.weekKey();
    if (m.day !== day) {
      const rng = mulberry32(this.seed(day));
      const pool = MISSION_POOL.slice();
      const picks = [];
      while (picks.length < 3 && pool.length) picks.push(pool.splice((rng() * pool.length) | 0, 1)[0]);
      m.day = day;
      m.daily = picks.map((p) => ({ id: p.id, n: 0, done: false }));
      Save.write();
    }
    if (m.week !== week) {
      const rng = mulberry32(this.seed('w' + week));
      const p = WEEKLY_POOL[(rng() * WEEKLY_POOL.length) | 0];
      m.week = week;
      m.weekly = { id: p.id, n: 0, done: false };
      Save.write();
    }
    return m;
  },
  def(id) { return MISSION_POOL.find((p) => p.id === id) || WEEKLY_POOL.find((p) => p.id === id) || null; },
  label(id) { const p = this.def(id); return p ? p.text.replace('{n}', p.n) : id; },
  all() { const m = this.state(); return [...m.daily, ...(m.weekly ? [m.weekly] : [])]; },
  // how many are sitting there finished and unclaimed
  ready() { return this.all().filter((j) => { const p = this.def(j.id); return p && !j.done && j.n >= p.n; }).length; },

  // what a finished match was worth to every job on the board
  record(m, outcome) {
    if (!m || Game.headless) return;
    const hs = (m.human && m.human.stats) || {};
    const won = outcome === 'win';
    const add = {
      play: 1,
      win: won ? 1 : 0,
      onlineWin: won && m.net ? 1 : 0,
      goals: hs.goals || 0,
      skills: hs.skills || 0,
      tackles: hs.tackles || 0,
      assists: hs.assists || 0,
      saves: (m.stats && m.stats.blue ? m.stats.blue.saves : 0) || 0, // your end of the pitch, not just your own hands
      powerGoal: (m.flags && m.flags.powerGoals) || 0,
      cleanSheet: won && !m.pens && m.score.red === 0 ? 1 : 0,
      pensWin: won && m.pens ? 1 : 0,
      hattrick: (hs.goals || 0) >= 3 ? 1 : 0,
    };
    const state = this.state();
    for (const job of this.all()) {
      const p = this.def(job.id);
      if (!p || job.done) continue;
      job.n = Math.min(p.n, job.n + (add[p.kind] || 0));
    }
    void state;
    Save.write();
  },

  // take the coins for one that is finished
  claim(id) {
    const job = this.all().find((j) => j.id === id);
    const p = this.def(id);
    if (!job || !p || job.done || job.n < p.n) return 0;
    job.done = true;
    Save.data.coins += p.coins;
    Save.write();
    return p.coins;
  },
};

// ---------------------------------------------------------------- the season
const DIVISIONS = [
  { name: 'DIVISION 4', lo: 0, hi: 1, prize: 1500 },
  { name: 'DIVISION 3', lo: 0, hi: 2, prize: 3000 },
  { name: 'DIVISION 2', lo: 1, hi: 2, prize: 6000 },
  { name: 'DIVISION 1', lo: 2, hi: 3, prize: 12000 },
  { name: 'WORLD ELITE', lo: 3, hi: 3, prize: 25000 },
];

const Season = {
  SIZE: 6,      // you and five others
  GAMES: 10,    // everyone twice

  div(n) { return DIVISIONS[clamp(n, 0, DIVISIONS.length - 1)]; },

  start(divIndex = 0) {
    const d = this.div(divIndex), mine = Clubs.mine().id;
    const pool = CLUBS.filter((c) => c.id !== mine && c.level >= d.lo && c.level <= d.hi);
    const rivals = [];
    while (rivals.length < this.SIZE - 1 && pool.length) rivals.push(pool.splice((Math.random() * pool.length) | 0, 1)[0].id);
    // every rival twice, shuffled
    const fixtures = [...rivals, ...rivals];
    for (let i = fixtures.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]]; }
    const row = (id) => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    Save.data.season = {
      active: true, div: divIndex, game: 0, fixtures,
      table: [row('you'), ...rivals.map(row)],
      last: null, done: null,
    };
    Save.write();
    return Save.data.season;
  },
  state() { return Save.data.season && Save.data.season.active ? Save.data.season : null; },
  opponent() { const s = this.state(); return s ? Clubs.get(s.fixtures[Math.min(s.game, s.fixtures.length - 1)]) : null; },
  name(id) { return id === 'you' ? (Net.user ? String(Net.user.name).toUpperCase() : 'YOU') : (Clubs.get(id) || { name: id }).name; },

  row(s, id) { return s.table.find((r) => r.id === id); },
  sorted(s) {
    return s.table.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || this.name(a.id).localeCompare(this.name(b.id)));
  },
  place(s) { return this.sorted(s).findIndex((r) => r.id === 'you') + 1; },

  score(s, id, gf, ga) {
    const r = this.row(s, id);
    if (!r) return;
    r.p++; r.gf += gf; r.ga += ga;
    if (gf > ga) { r.w++; r.pts += 3; } else if (gf === ga) { r.d++; r.pts += 1; } else r.l++;
  },

  // the other four play each other while you play yours
  others(s, playedId) {
    const rest = s.table.map((r) => r.id).filter((id) => id !== 'you' && id !== playedId);
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const a = Clubs.get(rest[i]), b = Clubs.get(rest[i + 1]);
      const edge = ((a ? a.level : 1) - (b ? b.level : 1)) * 0.4;
      const ga = Math.max(0, Math.round(1.4 + edge + (Math.random() * 2.4 - 1.2)));
      const gb = Math.max(0, Math.round(1.4 - edge + (Math.random() * 2.4 - 1.2)));
      this.score(s, rest[i], ga, gb);
      this.score(s, rest[i + 1], gb, ga);
    }
  },

  // a finished match of yours: 'next' when the season goes on, otherwise how it ended
  record(m) {
    const s = this.state();
    if (!s) return null;
    const foe = s.fixtures[Math.min(s.game, s.fixtures.length - 1)];
    const gf = m.score.blue, ga = m.score.red;
    this.score(s, 'you', gf, ga);
    this.score(s, foe, ga, gf);
    this.others(s, foe);
    s.last = { foe, gf, ga };
    s.game++;
    if (s.game < this.GAMES) { Save.write(); return 'next'; }
    // the season is over: where did you finish?
    const place = this.place(s), top = s.div === DIVISIONS.length - 1;
    const out = place <= 2 && !top ? 'promoted' : place >= 5 && s.div > 0 ? 'relegated' : place === 1 && top ? 'champion' : 'stayed';
    const d = this.div(s.div);
    const prize = Math.round(d.prize * (place === 1 ? 1 : place === 2 ? 0.6 : place === 3 ? 0.4 : place === 4 ? 0.25 : 0.15));
    Save.data.coins += prize;
    if (out === 'champion') Save.data.trophies = (Save.data.trophies || 0) + 1;
    s.active = false;
    s.done = { place, out, prize, div: s.div };
    Save.data.seasonsPlayed = (Save.data.seasonsPlayed || 0) + 1;
    if (out === 'promoted' || out === 'champion') Save.data.bestDiv = Math.max(Save.data.bestDiv || 0, Math.min(DIVISIONS.length - 1, s.div + (out === 'promoted' ? 1 : 0)));
    Save.write();
    return out;
  },

  // after a season ends, the next one starts a division up or down
  nextDiv() {
    const s = Save.data.season;
    if (!s || !s.done) return 0;
    if (s.done.out === 'promoted') return Math.min(DIVISIONS.length - 1, s.div + 1);
    if (s.done.out === 'relegated') return Math.max(0, s.div - 1);
    return s.div;
  },
};

if (typeof module !== 'undefined') module.exports = { MISSION_POOL, WEEKLY_POOL, Missions, DIVISIONS, Season };
