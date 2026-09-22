// Progression and content around the match: clubs, cup, unlocks, XP, challenges.

// ===== Match formats ================================================
// Outfield roster besides you (blue) and the opponents (red). Both sides always have a keeper.
const FORMATS = {
  '4v4': { blue: [['def', 3], ['midL', 6], ['midR', 7]], red: [['def', 2], ['midL', 4], ['midR', 5], ['att', 8]] },
  '3v3': { blue: [['def', 3], ['mid', 6]], red: [['def', 2], ['mid', 4], ['att', 8]] },
  '2v2': { blue: [['def', 3]], red: [['def', 2], ['att', 8]] },
  '1v1': { blue: [], red: [['att', 8]] },
  // practice: you, one defender to beat, and their keeper
  training: { blue: [], red: [['def', 2]] },
};
// Symmetric sides for online matches. Real players take the roles from the front.
const SIDES = {
  '4v4': { blue: [['att', 10], ['def', 3], ['midL', 6], ['midR', 7]], red: [['att', 9], ['def', 2], ['midL', 4], ['midR', 5]] },
  '3v3': { blue: [['att', 10], ['def', 3], ['mid', 6]], red: [['att', 9], ['def', 2], ['mid', 4]] },
  '2v2': { blue: [['att', 10], ['def', 3]], red: [['att', 9], ['def', 2]] },
  '1v1': { blue: [['att', 10]], red: [['att', 9]] },
};

// ===== Unlocks ======================================================
const PRICES = {
  // ~100-150 coins a match: commons in a session, legendaries take days of play
  character: { street: 0, striker: 0, buzz: 500, curly: 700, speedster: 900, captain: 2500, bandit: 3000, beanie: 3500, turbo: 4200, ninja: 7000, mohawk: 8000, robot: 9500, viking: 11000, afroking: 16000, phantom: 20000, goldenboot: 25000,
    dreads: 30000, samurai: 34000, cowboy: 38000, pirate: 45000, knight: 52000, pharaoh: 60000, shark: 70000,
    lion: 85000, wizard: 100000, astronaut: 115000, iceking: 130000, inferno: 150000, galaxy: 175000, titan: 200000, goat: 250000, jacob: 0 },
  accessory: Object.fromEntries(ACCESSORIES.map((a) => [a.id, a.price])),
  trail: { electric: 0, fire: 250, blast: 300, plasma: 350, frost: 600, toxic: 900, shadow: 1400, rainbow: 2200, golden: 3500 },
  celebration: Object.fromEntries(CELEBRATIONS.map((c) => [c.id, c.price])),
  stadium: { day: 0, sunset: 200, night: 300, rain: 800, desert: 1200, snow: 2000, royal: 3500, neon: 5000 },
  ball: { classic: 0, beach: 400, volt: 700, fire: 1200, gold: 2000, galaxy: 3000, glacier: 900, camo: 1500, neon: 2500, magma: 4000, diamond: 6000 },
};
// base = leather, patch = panels; multi cycles panel colors
const BALLS = [
  { id: 'classic', name: 'Classic', base: '#ffffff', patch: '#161a33' },
  { id: 'beach', name: 'Beach', base: '#ffffff', patch: '#ff3a3f', multi: ['#ff3a3f', '#2f7bff', '#ffe14d'] },
  { id: 'volt', name: 'Volt', base: '#d8ff3a', patch: '#161a33' },
  { id: 'fire', name: 'Inferno', base: '#ff8a1f', patch: '#8a1f00', glow: '#ffb03a' },
  { id: 'gold', name: 'Gold', base: '#ffd23a', patch: '#a86f00', glow: '#fff3a0' },
  { id: 'galaxy', name: 'Galaxy', base: '#3b2c8f', patch: '#d8c8ff', glow: '#a98bff', stars: true },
  { id: 'glacier', name: 'Glacier', base: '#dff6ff', patch: '#3f9fd8' },
  { id: 'camo', name: 'Camo', base: '#6f803d', patch: '#39441f', multi: ['#39441f', '#a08c5a', '#26301a'] },
  { id: 'neon', name: 'Neon', base: '#1b1d33', patch: '#39ff88', glow: '#39ff88' },
  { id: 'magma', name: 'Magma', base: '#2b1a1a', patch: '#ff5a1a', glow: '#ff7a1a' },
  { id: 'diamond', name: 'Diamond', base: '#eafcff', patch: '#7fd0ff', glow: '#ffffff', stars: true },
];
// pattern: how the grass is mown. weather: what plays over the match (see Render.drawWeather).
const STADIUMS = [
  { id: 'day', name: 'Day', grass: [['#5acb45', '#55c541'], ['#4fbd3b', '#4bb838']], stands: ['#34439a', '#3a4aa0'], apron: '#8fa0c8', tuft: '#3f9f31', pattern: 'checks', weather: 'clouds' },
  { id: 'sunset', name: 'Sunset', grass: [['#6cc443', '#66bd3f'], ['#5fb43a', '#5aae36']], stands: ['#7a3b78', '#86427f'], apron: '#e0a07a', tuft: '#4a9a2e', pattern: 'stripes', weather: 'sunset' },
  { id: 'night', name: 'Night', grass: [['#3fbf5a', '#3ab755'], ['#34ad4f', '#30a64a']], stands: ['#1d2552', '#232c5e'], apron: '#4a5680', tuft: '#2a8a3e', pattern: 'checks', weather: 'night', lights: true },
  { id: 'rain', name: 'Rainy', grass: [['#2f9247', '#2b8b43'], ['#28833e', '#247c3a']], stands: ['#3b4252', '#434b5c'], apron: '#5b6475', tuft: '#1f6b33', pattern: 'stripes', weather: 'rain' },
  { id: 'desert', name: 'Desert', grass: [['#a8b356', '#a2ad51'], ['#9aa54c', '#949f47']], stands: ['#a0522d', '#ad5d36'], apron: '#e8c98a', tuft: '#7e8a34', pattern: 'hstripes', weather: 'dust' },
  { id: 'snow', name: 'Snow Day', grass: [['#8fcf8a', '#89c984'], ['#80c07c', '#7bbb77']], stands: ['#c9d8e8', '#d6e3f0'], apron: '#f1f6fb', tuft: '#ffffff', pattern: 'checks', weather: 'snow' },
  { id: 'royal', name: 'Royal', grass: [['#4cc46a', '#47be65'], ['#41b55e', '#3daf59']], stands: ['#7a1f2b', '#8a2633'], apron: '#d9b24a', tuft: '#2f8f45', pattern: 'diamond', weather: 'royal' },
  { id: 'neon', name: 'Neon Arena', grass: [['#1f6b5a', '#1c6454'], ['#195c4e', '#175648']], stands: ['#2a0f4a', '#34145a'], apron: '#c92ba8', tuft: '#39ff88', pattern: 'grid', weather: 'neon', lights: true },
];

const Shop = {
  owns(kind, id) { return (PRICES[kind][id] || 0) === 0 || ((Save.data.owned || {})[kind] || []).includes(id); },
  price(kind, id) { return PRICES[kind][id] || 0; },
  buy(kind, id) {
    const cost = this.price(kind, id);
    if (this.owns(kind, id)) return true;
    if (Save.data.coins < cost) return false;
    Save.data.coins -= cost;
    (Save.data.owned[kind] = Save.data.owned[kind] || []).push(id);
    Save.write();
    return true;
  },
};

// ===== XP / levels ==================================================
const Levels = {
  need(level) { return 120 + (level - 1) * 60; }, // xp to go from level -> level+1
  info(xp) {
    let level = 1, rest = xp;
    while (rest >= this.need(level)) { rest -= this.need(level); level++; }
    return { level, into: rest, need: this.need(level) };
  },
  // coins for reaching a level
  reward(level) { return 40 + level * 10; },
  matchXp(m) {
    const h = m.human.stats;
    const r = m.result.outcome;
    return 40 + h.goals * 25 + h.assists * 15 + h.tackles * 6 + h.skills * 2 + (h.dodges || 0) * 5 + (r === 'win' ? 60 : r === 'draw' ? 25 : 0);
  },
};

// ===== Match challenges =============================================
const CHALLENGES = [
  { id: 'score2', text: 'Score 2 goals', coins: 40, done: (m) => m.human.stats.goals >= 2 },
  { id: 'hattrick', text: 'Score a hat-trick', coins: 90, done: (m) => m.human.stats.goals >= 3 },
  { id: 'tackle3', text: 'Win 3 tackles', coins: 30, done: (m) => m.human.stats.tackles >= 3 },
  { id: 'skill5', text: 'Pull off 5 skills', coins: 25, done: (m) => m.human.stats.skills >= 5 },
  { id: 'dodge2', text: 'Dodge 2 tackles', coins: 40, done: (m) => (m.human.stats.dodges || 0) >= 2 },
  { id: 'power', text: 'Score with a power shot', coins: 50, done: (m) => m.flags.powerGoal },
  { id: 'nutmeg', text: 'Nutmeg someone', coins: 40, done: (m) => m.flags.nutmeg },
  { id: 'assist', text: 'Assist a goal', coins: 35, team: true, done: (m) => m.human.stats.assists >= 1 },
  { id: 'clean', text: 'Keep a clean sheet', coins: 60, done: (m) => m.phase === 'over' && m.score.red === 0 },
  { id: 'pass8', text: 'Complete 8 passes', coins: 25, team: true, done: (m) => m.human.stats.passes >= 8 },
  { id: 'curl', text: 'Score a curling shot', coins: 45, done: (m) => m.flags.curlGoal },
  { id: 'win2', text: 'Win by 2+ goals', coins: 50, done: (m) => m.phase === 'over' && m.score.blue - m.score.red >= 2 },
];

const Challenges = {
  roll(format = '4v4') {
    const pool = CHALLENGES.filter((c) => !(c.team && format === '1v1'));
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    return out.map((c) => ({ ...c, complete: false }));
  },
  // called every so often during a match; announces fresh completions
  check(m) {
    if (!m.challenges) return;
    for (const c of m.challenges) {
      if (c.complete || !c.done(m)) continue;
      c.complete = true;
      if (!Game.headless && m.phase === 'play') { UI.toast(`CHALLENGE: ${c.text.toUpperCase()}  +${c.coins}`); Sound.powerReady(); }
    }
  },
};

// ===== Cup ==========================================================
const Cup = {
  ROUNDS: ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'],
  start() {
    const mine = Clubs.mine().id;
    const at = (lo, hi) => pick(CLUBS.filter((c) => c.level >= lo && c.level <= hi && c.id !== mine));
    const picks = [at(0, 1), at(2, 2), at(3, 3)];
    Save.data.cup = { active: true, round: 0, opponents: picks.map((c) => c.id), results: [] };
    Save.write();
  },
  state() { return Save.data.cup && Save.data.cup.active ? Save.data.cup : null; },
  opponent() { const s = this.state(); return s ? Clubs.get(s.opponents[s.round]) : null; },
  // returns 'next' | 'champion' | 'out'
  record(m) {
    const s = this.state();
    if (!s) return null;
    const won = m.score.blue > m.score.red;
    s.results[s.round] = { blue: m.score.blue, red: m.score.red, won };
    if (!won) { s.active = false; Save.write(); return 'out'; }
    if (s.round >= 2) { s.active = false; Save.data.trophies = (Save.data.trophies || 0) + 1; Save.write(); return 'champion'; }
    s.round++; Save.write();
    return 'next';
  },
};

// A full four-round knockout made entirely of shootouts. It has its own saved
// run, while wins still count toward the player's overall trophy cabinet.
const PenCup = {
  ROUNDS: PWC_ROUNDS,
  start() {
    const mine = Clubs.mine().id, used = new Set([mine]);
    const at = (lo, hi) => {
      const pool = CLUBS.filter((c) => c.level >= lo && c.level <= hi && !used.has(c.id));
      const c = pick(pool.length ? pool : CLUBS.filter((x) => !used.has(x.id)));
      used.add(c.id); return c;
    };
    const picks = [at(0, 1), at(1, 2), at(2, 3), at(3, 3)];
    Save.data.pensCup = { active: true, round: 0, opponents: picks.map((c) => c.id), results: [] };
    Save.write();
  },
  state() { return Save.data.pensCup && Save.data.pensCup.active ? Save.data.pensCup : null; },
  opponent() { const s = this.state(); return s ? Clubs.get(s.opponents[s.round]) : null; },
  record(m) {
    const s = this.state(); if (!s) return null;
    const won = m.score.blue > m.score.red;
    s.results[s.round] = { blue: m.score.blue, red: m.score.red, won };
    if (!won) { s.active = false; Save.write(); return 'out'; }
    if (s.round >= this.ROUNDS.length - 1) {
      s.active = false; Save.data.trophies = (Save.data.trophies || 0) + 1;
      Save.data.pensTrophies = (Save.data.pensTrophies || 0) + 1; Save.write(); return 'champion';
    }
    s.round++; Save.write(); return 'next';
  },
};
// ===== Career achievements ==========================================
// stat(d) reads the save; progress is capped at goal; each one pays out once when claimed.
const ownedCount = (pred) => CHARACTERS.filter((c) => pred(c) && charOk(c) && Shop.owns('character', c.id)).length;
const ACHIEVEMENTS = [
  { id: 'goal1', name: 'Off The Mark', text: 'Score your first goal', goal: 1, coins: 50, stat: (d) => d.goals },
  { id: 'win1', name: 'First Win', text: 'Win a match', goal: 1, coins: 60, stat: (d) => d.wins },
  { id: 'goal25', name: 'Sharpshooter', text: 'Score 25 goals', goal: 25, coins: 200, stat: (d) => d.goals },
  { id: 'hattrick', name: 'Hat-trick Hero', text: 'Score 3 goals in one match', goal: 1, coins: 150, stat: (d) => d.career.hattricks },
  { id: 'tackle25', name: 'Ball Winner', text: 'Win 25 tackles', goal: 25, coins: 150, stat: (d) => d.career.tackles },
  { id: 'skill50', name: 'Showboat', text: 'Pull off 50 skills', goal: 50, coins: 150, stat: (d) => d.career.skills },
  { id: 'formats', name: 'All-Rounder', text: 'Play 1v1, 2v2, 3v3 and 4v4', goal: 4, coins: 150, stat: (d) => Object.keys(d.career.formats).length },
  { id: 'assist15', name: 'Playmaker', text: 'Make 15 assists', goal: 15, coins: 250, stat: (d) => d.career.assists },
  { id: 'dodge25', name: 'Escape Artist', text: 'Dodge 25 tackles', goal: 25, coins: 200, stat: (d) => d.career.dodges },
  { id: 'clean5', name: 'Brick Wall', text: 'Keep 5 clean sheets', goal: 5, coins: 200, stat: (d) => d.career.cleanSheets },
  { id: 'win10', name: 'Winner', text: 'Win 10 matches', goal: 10, coins: 250, stat: (d) => d.wins },
  { id: 'power10', name: 'Screamers', text: 'Score 10 power-shot goals', goal: 10, coins: 300, stat: (d) => d.career.powerGoals },
  { id: 'streak5', name: 'On Fire', text: 'Win 5 matches in a row', goal: 5, coins: 400, stat: (d) => d.career.bestStreak },
  { id: 'cup1', name: 'Silverware', text: 'Win the Cup', goal: 1, coins: 300, stat: (d) => d.trophies },
  { id: 'squad', name: 'Squad Builder', text: 'Own 6 characters', goal: 6, coins: 400, stat: () => ownedCount(() => true) },
  { id: 'goal100', name: 'Goal Machine', text: 'Score 100 goals', goal: 100, coins: 600, stat: (d) => d.goals },
  { id: 'veteran', name: 'Veteran', text: 'Play 100 matches', goal: 100, coins: 800, stat: (d) => d.matches },
  { id: 'epic', name: 'Epic Signing', text: 'Own an epic character', goal: 1, coins: 500, stat: () => ownedCount((c) => c.rarity === 'epic') },
  { id: 'win50', name: 'Serial Winner', text: 'Win 50 matches', goal: 50, coins: 1000, stat: (d) => d.wins },
  { id: 'cup5', name: 'Dynasty', text: 'Win the Cup 5 times', goal: 5, coins: 1200, stat: (d) => d.trophies },
  { id: 'legend', name: 'Legendary', text: 'Own a legendary character', goal: 1, coins: 1000, stat: () => ownedCount((c) => c.rarity === 'legendary') },
  { id: 'goal300', name: 'Living Legend', text: 'Score 300 goals', goal: 300, coins: 1500, stat: (d) => d.goals },
];

const Achievements = {
  progress(a) { return Math.min(a.goal, Math.max(0, a.stat(Save.data) || 0)); },
  claimed(a) { return !!Save.data.achievements[a.id]; },
  ready(a) { return !this.claimed(a) && this.progress(a) >= a.goal; },
  readyList() { return ACHIEVEMENTS.filter((a) => this.ready(a)); },
  claim(id) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || !this.ready(a)) return 0;
    Save.data.achievements[a.id] = 1;
    Save.data.coins += a.coins;
    Save.write();
    return a.coins;
  },
};

// ===== Daily reward =================================================
// Come back on consecutive days for a bigger payout; day 7 is the jackpot, then it loops.
const DAILY = [60, 80, 100, 130, 170, 220, 400];
const Daily = {
  key(date = new Date()) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; },
  dayNum(key) { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); },
  // { day: 1..7, coins } when today's reward is unclaimed, else null
  pending() {
    const s = Save.data.daily, today = this.key();
    if (s.last === today) return null;
    const gap = s.last ? this.dayNum(today) - this.dayNum(s.last) : 99;
    if (gap < 0) return null; // clock went backwards: no free re-claims
    const day = gap === 1 ? (s.streak % 7) + 1 : 1;
    return { day, coins: DAILY[day - 1] };
  },
  claim() {
    const p = this.pending();
    if (!p) return null;
    Save.data.daily = { last: this.key(), streak: p.day };
    Save.data.coins += p.coins;
    Save.write();
    return p;
  },
};

Save.load();
