// Missions: jobs worth coins — three a day and one big one a week.
//
// Everybody gets the same set on the same day: they are picked from the date itself, not at
// random, so they do not change under you when you reload, and you and a friend can compare them.

// ---------------------------------------------------------------- missions
// kind: what counts. n: how many. coins: what it pays.
const MISSION_POOL = [
  { id: 'play3', kind: 'play', n: 3, coins: 300, text: tl('Play {n} matches') },
  { id: 'win2', kind: 'win', n: 2, coins: 450, text: tl('Win {n} matches') },
  { id: 'win4', kind: 'win', n: 4, coins: 800, text: tl('Win {n} matches') },
  { id: 'goals6', kind: 'goals', n: 6, coins: 420, text: tl('Score {n} goals') },
  { id: 'goals12', kind: 'goals', n: 12, coins: 750, text: tl('Score {n} goals') },
  { id: 'online2', kind: 'onlineWin', n: 2, coins: 700, text: tl('Win {n} online matches') },
  { id: 'skills8', kind: 'skills', n: 8, coins: 380, text: tl('Pull off {n} skills') },
  { id: 'tackles10', kind: 'tackles', n: 10, coins: 360, text: tl('Win {n} tackles') },
  { id: 'assists3', kind: 'assists', n: 3, coins: 480, text: tl('Set up {n} goals') },
  { id: 'power2', kind: 'powerGoal', n: 2, coins: 520, text: tl('Score {n} power-shot goals') },
  { id: 'clean1', kind: 'cleanSheet', n: 1, coins: 500, text: tl('Win without letting one in') },
  { id: 'pens1', kind: 'pensWin', n: 1, coins: 550, text: tl('Win a shootout') },
  { id: 'hat1', kind: 'hattrick', n: 1, coins: 650, text: tl('Score a hat-trick') },
  { id: 'saves6', kind: 'saves', n: 6, coins: 400, text: tl('Keep {n} shots out') },
];

const WEEKLY_POOL = [
  { id: 'w-win10', kind: 'win', n: 10, coins: 12000, text: tl('Win {n} matches this week') },
  { id: 'w-goals40', kind: 'goals', n: 40, coins: 13000, text: tl('Score {n} goals this week') },
  { id: 'w-online6', kind: 'onlineWin', n: 6, coins: 15000, text: tl('Win {n} online matches this week') },
  { id: 'w-play20', kind: 'play', n: 20, coins: 10000, text: tl('Play {n} matches this week') },
  { id: 'w-skills40', kind: 'skills', n: 40, coins: 11000, text: tl('Pull off {n} skills this week') },
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
    // anything but the right shape starts again: a bad save must not stop the board working
    const m0 = d.missions;
    if (!m0 || typeof m0 !== 'object' || Array.isArray(m0) || !Array.isArray(m0.daily)) {
      d.missions = { day: null, week: null, daily: [], weekly: null };
    }
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
    if (m.week !== week || !m.weekly || typeof m.weekly !== 'object') {
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
      onlineWin: won && m.net && !m.coop ? 1 : 0, // beating fill-ins with a friend is not an online win
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

if (typeof module !== 'undefined') module.exports = { MISSION_POOL, WEEKLY_POOL, Missions };
