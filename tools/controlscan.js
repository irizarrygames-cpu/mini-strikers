// The controls do what you pressed, even a moment early, and every match is two minutes.
//   node tools/controlscan.js
// Runs on the real engine (the server's copy of the game code, which is the same files):
//   * every match is CFG.MATCH_MINUTES (2) long, offline and online, and Settings no longer offers others
//   * PASS pressed while a pass to you is still on its way goes as soon as the ball is yours
//   * SKILL pressed while your own side's pass is on its way waits for the ball: no lunge at it
//   * SKILL without the ball near an opponent's ball is still a tackle; PASS while a bot teammate
//     has it still calls for it; a press long before the ball comes is forgotten
// SPRINT's tap-to-lock is in the page (Input.sprintLock); it is checked in the browser.
const fs = require('fs');
const path = require('path');
const { createSim } = require('../server/sim');

const sim = createSim();
sim.run('Game.headless = true; Save.data = Save.defaults(); Save.data.tutorialSeen = true;');
const { CFG, Clubs } = sim;
const passComing = sim.run('passComing');
const W = CFG.FIELD_W, H = CFG.FIELD_H;
const ROOT = path.join(__dirname, '..');

let fails = 0;
const check = (what, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); if (!ok) fails++; };

class ScriptInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); } consumeSkill() { return this.take(2); } consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); } consumeShootRelease() { return this.take(16); } consumePassPress() { return this.take(32); }
  consumeUlt() { return this.take(64); }
}

// a 2v2 with everybody out of the way: you, a teammate, and one opponent where the test wants him
function setup() {
  const m = sim.Match.create({ mode: 'quick', club: Clubs.get('croatia'), format: '2v2' });
  const h = m.human;
  h.input = new ScriptInput();
  m.phase = 'play'; m.phaseT = 0; m.clock = 0;
  const mate = m.players.find((p) => p.team === h.team && p !== h && !p.isKeeper) || m.players.find((p) => p.team === h.team && p !== h);
  const opp = m.players.find((p) => p.team !== h.team && !p.isKeeper);
  for (const p of m.players) { p.x = p.team === h.team ? 200 : W - 200; p.y = p.isKeeper ? H / 2 : 150; p.vx = 0; p.vy = 0; }
  h.x = 1200; h.y = 700; mate.x = 860; mate.y = 700; opp.x = 1700; opp.y = 1200;
  return { m, h, mate, opp, b: m.ball };
}

// step the match, holding the others where they are (the bots would otherwise run at the ball)
function step(s, n = 1) {
  for (let i = 0; i < n; i++) {
    const keep = s.m.players.filter((p) => p !== s.h).map((p) => [p, p.x, p.y]);
    sim.Match.step(s.m, CFG.STEP);
    for (const [p, x, y] of keep) { if (s.m.ball.owner !== p) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.mx = 0; p.my = 0; } }
  }
}

// a clean pass from the teammate to you (a bot's own passes wobble on purpose, and now and then go astray)
function passTo(m, from, to, speed = 560) {
  const b = m.ball, dx = to.x - b.x, dy = to.y - b.y, d = Math.hypot(dx, dy) || 1;
  b.owner = null; b.vx = (dx / d) * speed; b.vy = (dy / d) * speed; b.vz = 0; b.z = 0; b.shot = null;
  b.lastPass = { from, team: from.team, t: m.clock, target: to };
  b.lastKicker = from; b.lastTouchTeam = from.team; from.noPickupT = 0.3;
}

// the teammate passes to you; press `bit` when the ball is `early` seconds from you
function incoming(bit, early) {
  const s = setup(), { m, h, mate, b } = s;
  b.owner = mate; b.x = mate.x + 16; b.y = mate.y; b.z = 0; b.vx = b.vy = b.vz = 0; b.shot = null;
  passTo(m, mate, h);
  const res = { pressedAt: null, gotAt: null, passedAt: null, slid: false, skilled: false };
  for (let i = 0; i < 240 && res.passedAt === null; i++) {
    const t = i * CFG.STEP, d = Math.hypot(b.x - h.x, b.y - h.y), v = Math.hypot(b.vx, b.vy) || 1;
    if (res.pressedAt === null && !b.owner && d / v < early) { h.input.q |= bit; res.pressedAt = t; }
    // standing still: a pass aimed ahead of a runner can miss him, which is not what this is about
    h.input.move.x = 0; h.input.move.y = 0;
    step(s);
    if (h.slideT > 0 || h.slideWindT > 0) res.slid = true;
    if (b.owner === h && res.gotAt === null) res.gotAt = t;
    if (h.skillCd > 0) res.skilled = true;
    // passed on by you (a ball already within reach when you press is taken and passed in one go)
    if (b.lastPass && b.lastPass.from === h) res.passedAt = t;
  }
  for (const k of ['pressedAt', 'gotAt', 'passedAt']) if (res[k] !== null) res[k] = Math.round(res[k] * 1000) / 1000;
  return { s, res };
}

// ---- two minutes ----
{
  check('CFG.MATCH_MINUTES is 2', CFG.MATCH_MINUTES === 2, CFG.MATCH_MINUTES);
  const m = sim.Match.create({ mode: 'quick', club: Clubs.get('croatia'), format: '4v4' });
  check('a match with no length given lasts two minutes', m.duration === 120 && m.time === 120, m.duration);
  sim.run('Save.data.settings.minutes = 4;');
  const old = sim.Match.create({ mode: 'quick', club: Clubs.get('croatia'), format: '4v4' });
  check('an old save that picked 4 minutes still gets two', old.duration === 120, old.duration);
  const game = fs.readFileSync(path.join(ROOT, 'server/game.js'), 'utf8');
  check('online matches are two minutes too (server MATCH_MINUTES)', /const MATCH_MINUTES = 2;/.test(game));
  const panels = fs.readFileSync(path.join(ROOT, 'js/panels.js'), 'utf8');
  check('Settings no longer offers other lengths', !/seg\('minutes'/.test(panels));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('the scoreboard starts at 02:00', /id="sb-time">02:00</.test(html));
}

// ---- PASS a moment early ----
{
  // passed on by you, and no later than the ball's arrival allows (it reaches you 0.15 s after the press)
  const { res } = incoming(1, 0.15);
  check('PASS pressed 0.15 s before the ball arrives: it goes on as soon as it is yours', res.passedAt !== null && res.passedAt - res.pressedAt <= 0.15 + 0.12, res);
}
{
  const { res } = incoming(1, 0.25);
  check('PASS pressed 0.25 s early: the same', res.passedAt !== null && res.passedAt - res.pressedAt <= 0.25 + 0.12, res);
}
{
  // pressed long before: forgotten, so a ball you get later does not fly off by itself
  const s = setup(), { m, h, opp, b } = s;
  b.owner = opp; b.x = opp.x + 16; b.y = opp.y; b.z = 0; b.vx = b.vy = 0; b.shot = null;
  h.input.q |= 1;
  step(s, Math.round(0.6 / CFG.STEP));
  b.owner = null; b.x = h.x + 10; b.y = h.y; b.vx = b.vy = 0;
  step(s, 6);
  const had = b.owner === h;
  step(s, Math.round(0.4 / CFG.STEP));
  check('a PASS pressed long before you get the ball is forgotten', had && b.owner === h, { had, owner: b.owner === h });
}
{
  const s = setup(), { h, mate, b } = s;
  b.owner = mate; b.x = mate.x + 16; b.y = mate.y; b.vx = b.vy = 0; b.shot = null;
  h.input.q |= 1;
  step(s);
  // the call, or the teammate already answering it with a pass to you
  const answered = !!(b.lastPass && b.lastPass.from === mate && b.lastPass.target === h);
  check('PASS while a bot teammate has the ball still calls for it', (h.passRequestT > 0 || answered) && !(h.passBufferT > 0), { request: h.passRequestT, answered, buffer: h.passBufferT });
}

// ---- SKILL a moment early ----
{
  const { s, res } = incoming(2, 0.2);
  check('SKILL pressed while your pass is on its way: no lunge at it', !res.slid, res);
  check('and the skill happens when the ball arrives', res.gotAt !== null && res.skilled, { ...res, skillCd: s.h.skillCd });
}
{
  // the button says SKILL, not TACKLE, while it comes
  const s = setup(), { m, h, mate, b } = s;
  b.owner = mate; b.x = mate.x + 16; b.y = mate.y; b.vx = b.vy = 0; b.shot = null;
  passTo(m, mate, h);
  step(s, 4);
  check('a pass from your side on its way to you counts as coming (the button shows SKILL)', passComing(m, h) === true);
  b.lastTouchTeam = h.team === 'blue' ? 'red' : 'blue';
  check("the other side's loose ball does not", passComing(m, h) === false);
}
{
  // still a tackle when they have it
  const s = setup(), { h, opp, b } = s;
  opp.x = h.x + 70; opp.y = h.y;
  b.owner = opp; b.x = opp.x + 16; b.y = opp.y; b.vx = b.vy = 0; b.shot = null;
  h.input.move.x = 1; h.input.move.y = 0;
  h.input.q |= 2;
  step(s);
  check('SKILL near an opponent with the ball is still a tackle', h.slideT > 0 || h.slideWindT > 0, { slideT: h.slideT, wind: h.slideWindT });
}

console.log(fails ? `\n${fails} FAILED` : '\nall control checks passed');
process.exit(fails ? 1 : 0);
