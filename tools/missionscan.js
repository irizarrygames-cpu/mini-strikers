// Missions (build 121): 219 jobs, three a day and one a week, without a browser.
//   node tools/missionscan.js
// 1. the list: 184 daily and 35 weekly, every id and every line different, every kind and every
//    "where" one the game can count, a number that reads right ("Win a match", "Win 3 matches"),
//    pay in line with the old ones
// 2. the deal, for five years of days: three a day, never two of the same kind, at most one that
//    needs online play, the weekly one never online-only; the same answer every time it is asked;
//    how long before a daily job comes round again
// 3. counting: real matches played by the engine, turned into what the jobs read; a shootout is not
//    goals; a friend's match against fill-ins is not an online win; club and country; the formats
// 4. a save: today's three arrive, a match moves them, CLAIM pays once; a job held from before the
//    update keeps working; things done away from a match (crates, emotes, upgrades, challenges) count
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };

const store = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Symbol, Error, isFinite, parseInt, parseFloat,
  setTimeout, clearTimeout,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  tl: (s, args) => (args ? String(s).replace(/\{(\w+)\}/g, (m, k) => (args[k] !== undefined ? String(args[k]) : m)) : s),
  Net: null,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['config.js', 'clubs.js', 'celebs.js', 'emotes.js', 'save.js', 'meta.js', 'crates.js', 'missions.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: 'js/' + f });
}
const G = vm.runInContext('({ MISSION_POOL, WEEKLY_POOL, MISSION_KINDS, MISSION_WHERE, MISSION_BUMPS, MISSION_ONLINE, Missions, Save, Crates, Clubs })', sandbox);
const { MISSION_POOL, WEEKLY_POOL, MISSION_KINDS, MISSION_WHERE, MISSION_BUMPS, Missions, Save } = G;

console.log('the list');
{
  const all = [...MISSION_POOL, ...WEEKLY_POOL];
  check('184 daily jobs', MISSION_POOL.length === 184, MISSION_POOL.length);
  check('35 weekly jobs', WEEKLY_POOL.length === 35, WEEKLY_POOL.length);
  check('200 of them new in build 121', all.filter((p) => /^[dw]-[a-z0-9-]*-\d+$/.test(p.id)).length === 200, all.filter((p) => /^[dw]-[a-z0-9-]*-\d+$/.test(p.id)).length);
  check('every id different', new Set(all.map((p) => p.id)).size === all.length);
  const lines = all.map((p) => p.text.replace('{n}', p.n));
  check('every line different', new Set(lines).size === lines.length, lines.filter((l, i) => lines.indexOf(l) !== i));
  const badKind = all.filter((p) => !MISSION_KINDS[p.kind] && !MISSION_BUMPS.has(p.kind));
  check('every kind is one the game counts', !badKind.length, badKind.map((p) => p.id));
  const badWhere = all.filter((p) => p.where && !MISSION_WHERE[p.where]);
  check('every "where" is one the game knows', !badWhere.length, badWhere.map((p) => p.id));
  const badN = all.filter((p) => !(Number.isInteger(p.n) && p.n >= 1) || (p.n === 1) === p.text.includes('{n}'));
  check('one reads "a", more reads the number', !badN.length, badN.map((p) => p.id));
  const dc = MISSION_POOL.map((p) => p.coins), wc = WEEKLY_POOL.map((p) => p.coins);
  check('daily pay 250 to 900', Math.min(...dc) >= 250 && Math.max(...dc) <= 900, [Math.min(...dc), Math.max(...dc)]);
  check('weekly pay 9,000 to 15,000', Math.min(...wc) >= 9000 && Math.max(...wc) <= 15000, [Math.min(...wc), Math.max(...wc)]);
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const oldD = MISSION_POOL.filter((p) => !/^d-/.test(p.id)).map((p) => p.coins), newD = MISSION_POOL.filter((p) => /^d-/.test(p.id)).map((p) => p.coins);
  console.log('       daily pay on average: the old 14', avg(oldD), '· the new 170', avg(newD));
  check('the new daily ones pay about what the old ones did (within a quarter)', Math.abs(avg(newD) - avg(oldD)) / avg(oldD) < 0.25);
  check('the old online weekly one is retired, not deleted', !!Missions.def('w-online6') && Missions.def('w-online6').retired === true);
}

console.log('the deal');
{
  const day0 = Date.UTC(2026, 9, 5);
  const dayDate = (i) => { const t = new Date(day0 + i * 86400000); return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 12); };
  let bad = [], seen = new Map(), gaps = [], borrowed = 0, onlineDays = 0;
  const N = 365 * 5;
  for (let i = 0; i < N; i++) {
    const d = dayDate(i), ids = Missions.dailyIds(d);
    const defs = ids.map((id) => Missions.def(id));
    if (ids.length !== 3 || new Set(ids).size !== 3 || defs.some((p) => !p)) { bad.push([i, 'not three', ids]); continue; }
    if (new Set(defs.map((p) => Missions.group(p))).size !== 3) bad.push([i, 'two alike', ids]);
    const on = defs.filter((p) => Missions.online(p)).length;
    if (on > 1) bad.push([i, 'two online', ids]);
    if (on) onlineDays++;
    if (Missions.dayIndex(d) !== i) bad.push([i, 'day index', Missions.dayIndex(d)]);
    for (const id of ids) { if (seen.has(id) && i >= 0) gaps.push(i - seen.get(id)); seen.set(id, i); }
  }
  check('three different jobs every day for five years', !bad.filter((b) => b[1] === 'not three').length, bad.slice(0, 3));
  check('never two of the same kind on one day', !bad.filter((b) => b[1] === 'two alike').length, bad.filter((b) => b[1] === 'two alike').slice(0, 3));
  check('never two online-only jobs on one day', !bad.filter((b) => b[1] === 'two online').length);
  check('days counted by the calendar', !bad.filter((b) => b[1] === 'day index').length);
  check('every daily job gets dealt', seen.size === MISSION_POOL.length, MISSION_POOL.length - seen.size);
  gaps.sort((a, b) => a - b);
  const pct = (q) => gaps[Math.floor(q * (gaps.length - 1))];
  console.log(`       a daily job comes round again after: shortest ${gaps[0]} days, typical ${pct(0.5)}, 1 in 20 sooner than ${pct(0.05)} · online-only job on ${Math.round((onlineDays / N) * 100)}% of days`);
  check('a daily job does not come back for at least six weeks', gaps[0] >= 42, gaps[0]);
  check('and usually not for about two months', pct(0.5) >= 50, pct(0.5));
  const again = Missions.dailyIds(dayDate(400)).join(), cleared = (Missions._deal = null, Missions.dailyIds(dayDate(400)).join());
  check('the same day always gets the same three', again === cleared);
  // the weekly one
  let wbad = [], wseen = new Map(), wgaps = [];
  for (let k = 0; k < 260; k++) {
    const id = Missions.weeklyId(dayDate(k * 7 + 3)), p = Missions.def(id);
    if (!p || p.retired || Missions.online(p)) wbad.push([k, id]);
    if (Missions.weeklyId(dayDate(k * 7)) !== id || Missions.weeklyId(dayDate(k * 7 + 6)) !== id) wbad.push([k, 'changes in the week']);
    if (wseen.has(id)) wgaps.push(k - wseen.get(id)); wseen.set(id, k);
  }
  check('the weekly job: never retired, never online-only, the same all week', !wbad.length, wbad.slice(0, 3));
  check('every weekly job gets dealt', wseen.size === WEEKLY_POOL.length - 1, wseen.size);
  wgaps.sort((a, b) => a - b);
  console.log(`       a weekly job comes round again after: shortest ${wgaps[0]} weeks, typical ${wgaps[Math.floor(wgaps.length / 2)]}`);
  check('a weekly job does not come back for at least half a year', wgaps[0] >= 26, wgaps[0]);
  const tq = Date.now(); Missions._deal = null; Missions.dailyIds(dayDate(3650)); const ms = Date.now() - tq;
  check('ten years of days work out quickly', ms < 400, ms + ' ms');
  check('a clock set before the deal began still gets three', Missions.dailyIds(new Date(2020, 0, 1)).length === 3);
  // a week starts on Monday: Sunday night and Monday morning are different weeks
  const sun = new Date(2026, 10, 22, 23, 30), mon = new Date(2026, 10, 23, 0, 30);
  check('the weekly job changes over at Monday midnight', Missions.weekKey(sun) !== Missions.weekKey(mon) && Missions.weeklyId(sun) !== Missions.weeklyId(mon));
}

console.log('counting');
{
  const base = { won: false, outcome: 'loss', online: false, coop: false, ranked: false, pens: false, fk: false, format: '2v2', pro: false, cup: false, club: false, hard: false,
    mine: 0, theirs: 0, goals: 0, assists: 0, tackles: 0, skills: 0, shots: 0, passes: 0, dodges: 0, steals: 0, saves: 0, powerGoals: 0, curlGoals: 0, nutmegs: 0, kicksScored: 0, kicksSaved: 0, cupChampion: false };
  const S = (o) => Object.assign({}, base, o);
  const c = (id, s) => Missions.count(Missions.def(id), s);
  check('goals count', c('d-goals-5', S({ goals: 3 })) === 3);
  check('a shootout is not goals', c('d-goals-5', S({ pens: true, goals: 4, kicksScored: 4 })) === 0);
  check('but it is penalties', c('d-pensscored-4', S({ pens: true, kicksScored: 4 })) === 4);
  check('free kicks are not penalties', c('d-pensscored-4', S({ pens: true, fk: true, kicksScored: 4 })) === 0 && c('d-fkscored-3', S({ pens: true, fk: true, kicksScored: 2 })) === 2);
  check('a shootout is a match played', c('play3', S({ pens: true })) === 1);
  check('a 1v1 job wants a 1v1', c('d-win-1v1-1', S({ won: true, format: '1v1' })) === 1 && c('d-win-1v1-1', S({ won: true, format: '2v2' })) === 0);
  check('PRO MATCH', c('d-play-pro-1', S({ pro: true })) === 1 && c('d-play-pro-1', S({})) === 0);
  check('for a club, for your country', c('d-win-club-1', S({ won: true, club: true })) === 1 && c('d-win-club-1', S({ won: true })) === 0 && c('d-win-country-1', S({ won: true })) === 1 && c('d-win-country-1', S({ won: true, club: true })) === 0);
  check('an online win', c('d-onlinewin-1', S({ won: true, online: true })) === 1);
  check("beating fill-ins with a friend is not an online win", c('d-onlinewin-1', S({ won: true, online: true, coop: true })) === 0);
  check('ranked', c('d-rankedwin-1', S({ won: true, online: true, ranked: true })) === 1 && c('d-rankedwin-1', S({ won: true, online: true })) === 0);
  check('goals online', c('d-goals-online-3', S({ online: true, goals: 2 })) === 2 && c('d-goals-online-3', S({ goals: 2 })) === 0);
  check('HARD', c('d-win-hard-1', S({ won: true, hard: true })) === 1 && c('d-win-hard-1', S({ won: true })) === 0);
  check('a clean sheet is a win with nothing let in', c('clean1', S({ won: true, mine: 2, theirs: 0 })) === 1 && c('clean1', S({ won: false, mine: 0, theirs: 0 })) === 0);
  check('win by 3', c('d-bigwin-1', S({ won: true, mine: 4, theirs: 1 })) === 1 && c('d-bigwin-1', S({ won: true, mine: 3, theirs: 1 })) === 0);
  check('6 goals in a match', c('d-goalfest-1', S({ mine: 3, theirs: 3 })) === 1 && c('d-goalfest-1', S({ mine: 3, theirs: 2 })) === 0);
  check('cups', c('d-cupwin-1', S({ won: true, cup: true })) === 1 && c('w-cupchampion-1', S({ cupChampion: true })) === 1);
  check('away-from-the-pitch jobs never move on a match', c('d-crate-1', S({ won: true, goals: 9 })) === 0);

  // real matches, played out by the engine (bots in your place), read the way the results screen reads them
  const { createSim } = require('../server/sim');
  const sim = createSim();
  sim.run('Game.headless = true; Game.demo = null;');
  sim.run(fs.readFileSync(path.join(ROOT, 'js', 'missions.js'), 'utf8'));
  const got = sim.run(`(() => {
    let s = 7; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const out = [];
    for (const format of ['1v1', '2v2', '3v3', '4v4']) {
      const m = Match.create({ autopilot: true, mode: 'quick', format, minutes: 2 });
      let n = 0; while (m.phase !== 'over' && n++ < 60 * 60 * 6) Match.step(m, CFG.STEP);
      const outcome = m.score.blue > m.score.red ? 'win' : m.score.blue < m.score.red ? 'loss' : 'draw';
      m.autopilot = false; // (only so it is read: an autopilot match never counts)
      out.push(Missions.fromMatch(m, outcome));
    }
    return out;
  })()`);
  const nums = ['mine', 'theirs', 'goals', 'assists', 'tackles', 'skills', 'shots', 'passes', 'dodges', 'steals', 'saves', 'powerGoals'];
  const okShape = got.every((s) => s && nums.every((k) => Number.isFinite(s[k]) && s[k] >= 0) && ['1v1', '2v2', '3v3', '4v4'].includes(s.format));
  check('real matches read cleanly in every format', okShape, got.map((s) => s && { f: s.format, score: s.mine + '-' + s.theirs, g: s.goals, sh: s.shots, p: s.passes, t: s.tackles }));
  const jobs = MISSION_POOL.filter((p) => !MISSION_BUMPS.has(p.kind));
  const moved = jobs.filter((p) => got.some((s) => Missions.count(p, s) > 0)).length;
  console.log(`       ${moved} of ${jobs.length} match jobs moved in those four matches`);
  check('a real match moves plenty of jobs', moved > 40, moved);
  check('an autopilot match never counts', sim.run('Missions.fromMatch(Match.create({ autopilot: true, mode: "quick", format: "2v2", minutes: 2 }), "win")') === null);
}

console.log('a save');
{
  Save.account = null; Save.data = Save.merge(null);
  const m = Missions.state();
  check("today's three and this week's one arrive", m.daily.length === 3 && !!m.weekly && m.daily.every((j) => Missions.def(j.id)));
  check('today matches the deal', m.daily.map((j) => j.id).join() === Missions.dailyIds().join());
  // finish one by hand: a match that does a lot
  const big = { won: true, outcome: 'win', online: false, coop: false, ranked: false, pens: false, fk: false, format: '2v2', pro: false, cup: false, club: false, hard: false,
    mine: 9, theirs: 0, goals: 9, assists: 9, tackles: 20, skills: 20, shots: 30, passes: 50, dodges: 9, steals: 15, saves: 15, powerGoals: 9, curlGoals: 9, nutmegs: 9, kicksScored: 0, kicksSaved: 0, cupChampion: false };
  // a day whose three are all match jobs anyone can do offline
  m.daily = [{ id: 'd-goals-3', n: 0, done: false }, { id: 'd-skills-5', n: 0, done: false }, { id: 'd-emote-3', n: 0, done: false }];
  const before = Save.data.coins;
  Missions.record(big);
  check('one match finishes the jobs it covers, and no more than the number', m.daily[0].n === 3 && m.daily[1].n === 5 && m.daily[2].n === 0);
  check('two ready to claim', Missions.ready() >= 2);
  const paid = Missions.claim('d-goals-3'), again = Missions.claim('d-goals-3');
  check('CLAIM pays the job, once', paid === Missions.def('d-goals-3').coins && again === 0 && Save.data.coins === before + paid);
  for (let i = 0; i < 3; i++) Missions.bump('emote');
  check('emotes used in a match count', m.daily[2].n === 3);
  Missions.bump('nonsense');
  check('an unknown kind moves nothing', m.daily.every((j) => j.n <= Missions.def(j.id).n));
  // a save from before the update, holding the old jobs today: it keeps them
  const today = Missions.dayKey();
  Save.data.missions = { day: today, week: Missions.weekKey(), daily: [{ id: 'play3', n: 1, done: false }, { id: 'online2', n: 0, done: false }, { id: 'hat1', n: 0, done: false }], weekly: { id: 'w-online6', n: 2, done: false } };
  const kept = Missions.state();
  check("a job held from before the update stays today's job", kept.daily[0].id === 'play3' && kept.daily[0].n === 1 && kept.weekly.id === 'w-online6');
  Missions.record(Object.assign({}, big, { online: true }));
  check('and still counts (online matches too, now)', kept.daily[0].n === 2 && kept.daily[1].n === 1 && kept.weekly.n === 3);
  // the next day the deal takes over
  Save.data.missions.day = '2000-1-1';
  check('a new day deals new ones', Missions.state().daily.map((j) => j.id).join() === Missions.dailyIds().join());
  // a crate opened from the save
  Save.data.missions.daily = [{ id: 'd-crate-1', n: 0, done: false }, { id: 'd-upgrade-1', n: 0, done: false }, { id: 'd-challenge-1', n: 0, done: false }];
  Save.data.coins = 100000;
  const win = G.Crates.open('copper');
  check('opening a crate counts', !!win && !win.poor && Save.data.missions.daily[0].n === 1);
  Save.upgrade('spd');
  check('upgrading a stat counts', Save.data.missions.daily[1].n === 1);
  // a bad save shape never stops the board
  Save.data.missions = 'junk';
  check('a broken missions block starts again', Missions.state().daily.length === 3);
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
