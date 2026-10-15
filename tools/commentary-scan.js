// Commentary: the captions that run along the top of a match.
//   node tools/commentary-scan.js
//
// Runs the real js/commentary.js against a stand-in for the page. Two things about the current
// design matter here, and this scan used to get both wrong:
//   * nothing is ever spoken out loud — it is captions only — so there is no voice to test, and
//     the scan now checks that the speech machinery is never touched at all;
//   * a caption is TYPED OUT a letter at a time, so reading it the instant it is said gets an
//     empty line. Everything below waits for the line to finish landing first.
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- a stand-in for the bits of the page commentary touches
const els = new Map();
const el = (id) => {
  if (!els.has(id)) {
    const set = new Set();
    els.set(id, {
      id, textContent: '', offsetWidth: 1,
      classList: { add: (c) => set.add(c), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, on) => (on === undefined ? (set.has(c) ? set.delete(c) : set.add(c)) : on ? set.add(c) : set.delete(c)), contains: (c) => set.has(c) },
      _classes: set,
    });
  }
  return els.get(id);
};
const line = () => el('commentary-line').textContent;
const showing = () => el('commentary')._classes.has('show');

// if commentary ever tried to speak, this would catch it
let spokeCount = 0;
const speechSynthesis = new Proxy({}, { get: () => { spokeCount++; return () => { spokeCount++; }; } });

const sandbox = {
  console, Math, Set, Map, String, Number, Object, Array, Date, JSON,
  clearTimeout, setTimeout, clearInterval, setInterval,
  Save: { data: { settings: { commentary: true, sfx: 0.8 } }, write() {} },
  TEAMS: { blue: { name: 'SPAIN' }, red: { name: 'BRAZIL' } },
  $: el,
  speechSynthesis,
  SpeechSynthesisUtterance: function () { spokeCount++; },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'commentary.js'), 'utf8'), sandbox, { filename: 'js/commentary.js' });
const C = vm.runInContext('Commentary', sandbox);
C.init(); C.unlock();

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail !== undefined && detail !== '' ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
// wait for the line being typed to finish landing
async function settled(ms = 9000) { // a long line types for several seconds at 28ms a letter
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (!C.typing) return line(); await sleep(15); }
  return line();
}
// let a small line through the five-second gate on small talk
const openGate = () => { C.lastMinorAt = 0; C.cd = 0; C.typing = null; };

const player = (team, n, human = false) => ({ team, number: n, isHuman: human, name: human ? null : `${team.toUpperCase()}${n}`, stats: { goals: 0 } });
const a = player('blue', 10, true), b = player('blue', 7), c = player('blue', 9), d = player('blue', 3), r = player('red', 4);
const match = () => ({ ball: { owner: a, shot: null }, score: { blue: 0, red: 0 },
  stats: { blue: { saves: 0, tackles: 0, skills: 0 }, red: { saves: 0, tackles: 0, skills: 0 } },
  goals: [], players: [a, b, c, d, r], phase: 'play', time: 80, trailed: {} });

(async () => {
  const m = match();

  console.log('a move being built gets called, pass by pass');
  C.update(m, 0.016);
  await settled();
  openGate(); m.ball.owner = b; C.update(m, 0.7);
  check('the first pass is called', /PASS ONE/.test(await settled()), line());
  openGate(); m.ball.owner = c; C.update(m, 0.7);
  check('the second one builds on it', /PASS TWO/.test(await settled()), line());
  openGate(); m.ball.owner = d; C.update(m, 0.7);
  check('and the third', /PASS THREE/.test(await settled()), line());
  openGate(); m.ball.owner = r; C.update(m, 0.7);
  const turnover = await settled();
  check('losing it is called a turnover', C.banks.turnover.includes(turnover), turnover);

  console.log('shots, saves and goals');
  openGate(); m.ball.owner = null; m.ball.shot = { power: true }; C.update(m, 0.7);
  const powerCall = await settled();
  check('a power shot gets a big call', C.banks.power.includes(powerCall), powerCall);
  openGate(); m.ball.shot = null; m.stats.red.saves = 1; C.update(m, 0.7);
  const saveCall = await settled();
  check('a save gets called', C.banks.save.includes(saveCall), saveCall);
  openGate(); m.score.blue = 1; a.stats.goals = 1; m.goals.push({ team: 'blue', scorer: a, assist: b, own: false });
  C.update(m, 0.1);
  const goalCall = await settled();
  // the call has to be one the goal bank actually holds, rather than a list that goes stale
  check('a goal is called', C.banks.goal.some((g) => goalCall.startsWith(g)), goalCall);
  check('and it says who scored it', /YOU HAVE DONE IT/.test(goalCall), goalCall);
  check('and who set it up', /build-up/.test(goalCall), goalCall);
  // an own goal is called as one
  openGate(); const m2 = match(); C.reset(m2); await settled();
  m2.score.red = 1; m2.goals.push({ team: 'red', scorer: d, assist: null, own: true });
  C.update(m2, 0.1);
  const ownCall = await settled();
  check('an own goal is called as an own goal', C.banks.own.some((g) => ownCall.startsWith(g)), ownCall);
  // a hat-trick is called
  openGate(); const m3 = match(); C.reset(m3); await settled();
  a.stats.goals = 3; m3.score.blue = 1; m3.goals.push({ team: 'blue', scorer: a, assist: null, own: false });
  C.update(m3, 0.1);
  check('a hat-trick gets its own shout', /HAT-TRICK/.test(await settled()), line());
  a.stats.goals = 0;

  console.log('a shootout is left alone');
  // The shootout draws its own GOAL! / SAVED! over the net. A caption on top of that covered the
  // one thing you were looking at, so commentary keeps out of the way entirely.
  const pm = { ...match(), pens: { kicks: { blue: [true], red: [] } } };
  C.update(pm, 0.1);
  await sleep(40);
  check('no caption during a shootout', !showing(), 'showing=' + showing());
  check('and it is not holding one back to say later', !C.typing);

  console.log('the line library');
  const total = Object.values(C.banks).reduce((n, x) => n + x.length, 0);
  check('plenty of lines to draw on', total >= 140, String(total));
  check('a bank for when it all goes mad', C.banks.chaos.length >= 20, String(C.banks.chaos.length));
  const jokeDraws = Array.from({ length: C.banks.joke.length }, () => C.pick(C.banks.joke));
  check('every joke plays before any repeats', new Set(jokeDraws).size === C.banks.joke.length, new Set(jokeDraws).size + '/' + C.banks.joke.length);
  check('once they run out it moves on instead of repeating', !C.banks.joke.includes(C.pick(C.banks.joke)));
  check('no line has a gap left in it', Object.values(C.banks).flat().every((x) => !x.includes('{') || /\{team\}|\{player\}|\{winner\}|\{loser\}/.test(x)));

  console.log('how it behaves on screen');
  const m4 = match(); C.reset(m4); const first = await settled();
  check('a caption types itself out', first.length > 3, first.slice(0, 40));
  // a small line must not chop a big one that is still landing
  C.say('A BIG ONE HAPPENS NOW!', 3, false);
  const mid = line();
  C.say('small talk', 1, true);
  check('small talk never chops a big call', line() === mid, line());
  await settled();
  // and small talk is held back for a few seconds after the last one
  C.typing = null; C.cd = 0; C.lastMinorAt = Date.now();
  const held = line();
  C.say('another small line', 1, true);
  check('small talk is spaced out', line() === held, line());

  // A caption taken away while it was still being typed used to leave commentary convinced it was
  // mid-sentence for ever, and every small line after it was dropped.
  console.log('a caption cut off part-way does not silence the rest');
  const m5 = match(); C.reset(m5); await sleep(40);
  C.say('A LONG LINE THAT IS STILL BEING TYPED OUT RIGHT NOW!', 3, false);
  await sleep(40);
  check('it is mid-line', !!C.typing, String(!!C.typing));
  C.hide(); // what tabbing away, a shootout, or the end of the match does
  check('cutting it off lets go of the line', !C.typing, String(C.typing));
  openGate();
  m5.ball.owner = b; C.update(m5, 0.7);
  check('small talk still gets through afterwards', /PASS ONE/.test(await settled()), line());

  console.log('leaving and coming back');
  C.pause();
  check('pausing takes the caption away', C.paused && !showing(), JSON.stringify({ paused: C.paused, showing: showing() }));
  C.resume();
  check('coming back waits a moment before talking again', !C.paused && C.nextLineAt > Date.now(), String(C.nextLineAt - Date.now()));
  C.stop();
  check('stopping lets go of the match', C.m === null);

  console.log('and it never says a word out loud');
  check('the speech machinery is never touched', spokeCount === 0, String(spokeCount));

  console.log(fails ? `\n${fails} FAILED` : '\nall commentary checks passed');
  process.exit(fails ? 1 : 0);
})();
