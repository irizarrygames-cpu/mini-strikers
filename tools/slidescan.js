// Do your own actions answer the moment you press the button, online?
//   node tools/slidescan.js [trials=14] [lagMs one way=55] [jitterMs=10] [--old]
// The real server game code and the real client netcode (js/online.js) in one process, joined by
// fake sockets with lag (55 ms each way is the ~110 ms round trip the live server has). --old runs
// the client netcode from the last commit instead of the working copy, for a before/after.
//
//   slideMs    you press tackle -> your own drawn player is visibly in the lunge
//   pops       frames, from the press to a second after it, where you are drawn jumping further than
//              a tackle's own speed explains (the hand-over from your copy to the server's)
//   gap        how far the picture of you is from the server's you, a second after the press
//   rejected   the server turns the tackle down (on cooldown): how long until your screen stops
//              lunging, and the biggest jump when it does. A prediction that cannot be taken back
//              gracefully is worse than none.
//   doubles    two presses in a row must not start two lunges
//   slideSoundMs / slideSounds   press -> the tackle's sound, and how many times it played (once)
//   passSoundMs / kickSoundMs    the same for a pass and a shot, with the ball at your feet
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createGame } = require('../server/game');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OLD = process.argv.includes('--old');
const TRIALS = +(args[0] || 14), LAG = +(args[1] || 55), JITTER = +(args[2] || 10);

const noopProxy = (extra = {}) => new Proxy(extra, { get: (o, k) => (k in o ? o[k] : () => {}) });
const el = () => ({ hidden: true, style: {}, classList: { toggle() {}, add() {}, remove() {} }, textContent: '', querySelector: () => el() });
const handlers = {};
const soundLog = []; // [name, time] for the sounds of your own actions
const rec = (n) => () => { soundLog.push([n, performance.now()]); };
let toServer = null;
const Net = { rtt: LAG * 2, on: (t, fn) => { handlers[t] = fn; }, send: (o) => toServer(o), whenReady: (o) => toServer(o), user: null };
const sandbox = {
  // js/i18n.js, in English (the game says everything through tl())
  tl: (s, a) => (a ? String(s).replace(/\{(\w+)\}/g, (m, k) => (a[k] != null ? String(a[k]) : m)) : s), tlN: (n, one, many, a) => (n === 1 ? one : many).replace(/\{(\w+)\}/g, (m, k) => ((a || [n])[k] != null ? String((a || [n])[k]) : m)), I18N: { lang: 'en', server: (s) => String(s || ''), parts: (s) => s, t: (s) => s },
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Symbol, Error, isFinite, parseInt, parseFloat, performance,
  setTimeout, clearTimeout,
  Sound: noopProxy({ pass: rec('pass'), kick: rec('kick'), skill: rec('skill'), slide: rec('slide') }), FX: noopProxy({ banner: null }), UI: noopProxy(), Render: noopProxy(), Pens: noopProxy(),
  Game: { match: null, state: 'home', acc: 0, headless: false, goHome() {}, difficulty() { return null; } },
  Net, $: el, vibrate: () => {}, document: { getElementById: el, documentElement: { style: { setProperty() {} } } }, localStorage: { getItem: () => null, setItem() {} },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
for (const f of ['config.js', 'clubs.js', 'celebs.js', 'save.js', 'meta.js', 'input.js', 'entities.js', 'ai.js', 'match.js', 'online.js']) {
  const code = OLD && f === 'online.js' ? execSync('git show HEAD:js/online.js', { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'js', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'js/' + f });
}
const C = vm.runInContext('({ Online, Input, CFG, Save })', sandbox);
C.Save.data = C.Save.defaults();
const { Online, Input, CFG } = C;

const game = createGame({ getUser: () => ({ club: 'spain', save: {} }), userName: (id) => id.toUpperCase(), saveDB: () => {}, onlineRecord: () => {}, isNameTaken: () => false });
const wire = () => { let lastAt = 0; const q = []; return { q, push(fn) { const at = Math.max(lastAt, performance.now() + LAG + Math.random() * JITTER); lastAt = at; q.push({ at, fn }); } }; };
const up = wire(), down = wire();
const ws = { open: true, backlog: 0, lastSeen: Date.now(), h: {}, on(ev, fn) { this.h[ev] = fn; }, send(s) { const msg = JSON.parse(s); down.push(() => { const fn = handlers[msg.t]; if (fn) fn(msg); }); }, close() { this.open = false; } };
toServer = (o) => up.push(() => { ws.lastSeen = Date.now(); ws.h.message(o); });
game.connect(ws, 'tester');
Online.init();
Online.dbg = {};

const drain = () => { const now = performance.now(); for (const w of [up, down]) while (w.q.length && w.q[0].at <= now) w.q.shift().fn(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return Math.round(s[s.length >> 1]); };
const p90 = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.floor(s.length * 0.9)]); };

(async () => {
  Net.send({ t: 'room.create', format: '1v1' });
  await sleep(LAG * 2 + 50); drain();
  Net.send({ t: 'room.start' });
  const t0 = performance.now();
  while (!(Online.m && Online.m.phase === 'play') && performance.now() - t0 < 15000) { await sleep(4); drain(); if (Online.m) Online.update(0.016); }
  if (!Online.m) { console.log('no match started'); process.exit(1); }
  const room = game._roomOf('tester'), srv = room.m, meS = room.seats.find((s) => s.userId === 'tester').player;

  let last = performance.now();
  const frame = async () => {
    await sleep(16 - ((performance.now() - last) % 16) || 1);
    drain();
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const p of srv.players) if (p !== meS && !p.isKeeper) { p.x = 120; p.y = 120; p.vx = 0; p.vy = 0; p.stunT = 0; }
    Input.update();
    Online.update(dt);
    return { now, dt };
  };
  const settle = async (ms) => { const end = performance.now() + ms; while (performance.now() < end) await frame(); };

  const st = { slideSoundMs: [], slideSounds: [], passSoundMs: [], passSounds: [], kickSoundMs: [], kickSounds: [], slideMs: [], pops: 0, popMax: 0, gaps: [], rejected: [], rejectedJump: 0, doubles: 0, noStart: 0, errors: [] };
  for (let trial = 0; trial < TRIALS; trial++) {
    const reject = trial % 3 === 2, dbl = trial % 5 === 4;
    // everyone out of the way, you standing mid-pitch, a loose ball a short run ahead
    meS.x = 1200; meS.y = 700; meS.vx = 0; meS.vy = 0; meS.stunT = 0; meS.fallT = 0; meS.recoverT = 0; meS.slideT = 0; meS.slideWindT = 0; meS.slideCd = 0;
    srv.ball.reset(1420, 700); srv.ball.vx = 0; srv.ball.vy = 0; srv.ball.lastTouchTeam = 'red'; meS.noPickupT = 0;
    Input.stick.x = 0; Input.stick.y = 0;
    await settle(900);
    const me = Online.m.human;
    if (Online.m.phase !== 'play' || !Online.predOk) { trial--; await settle(500); if (performance.now() - t0 > 120000) break; continue; }
    // press: facing the ball
    Input.stick.x = 1; Input.stick.y = 0;
    await frame();
    Input._slideQueued = true;
    // the server turns it down: its cooldown is set at the moment of the press, so the picture of
    // you that the client holds (a round trip old) still says you may tackle
    if (reject) meS.slideCd = 6;
    const pressAt = performance.now();
    soundLog.length = 0;
    const starts0 = Online.dbg.slide_start || 0; // lunges the client began on its own (online.js counts them)
    let started = null, ended = null, prev = null, lunges = 0, wasSliding = false, gapAt1s = null;
    let pressedAgain = false;
    while (performance.now() - pressAt < 1100) {
      const { now, dt } = await frame();
      Input.stick.x = 1; Input.stick.y = 0;
      if (dbl && !pressedAgain && now - pressAt > 70) { Input._slideQueued = true; pressedAgain = true; }
      const sliding = me.slideT > 0;
      if (sliding && !wasSliding) { lunges++; if (started === null) started = now - pressAt; }
      if (!sliding && wasSliding && started !== null && ended === null) ended = now - pressAt;
      wasSliding = sliding;
      if (prev) {
        const d = Math.hypot(me.x - prev.x, me.y - prev.y), expect = Math.max(Math.hypot(me.vx, me.vy), 640) * dt * 1.6 + 12;
        if (d - expect > 14) { st.pops++; st.popMax = Math.max(st.popMax, d - expect); }
      }
      prev = { x: me.x, y: me.y };
      if (gapAt1s === null && now - pressAt > 1000) gapAt1s = Math.hypot(me.x - meS.x, me.y - meS.y);
    }
    if (reject) {
      // the server said no: the drawn lunge must have stopped, and not by a jump
      if (started === null) st.rejected.push(0); else st.rejected.push(ended === null ? 1100 : Math.round(ended - started));
    } else {
      if (started === null) st.noStart++; else st.slideMs.push(started);
      if (gapAt1s !== null) st.gaps.push(gapAt1s);
    }
    if (dbl && ((Online.dbg.slide_start || 0) - starts0 > 1 || lunges > 1)) st.doubles++;
    const heard = soundLog.filter(([n, t]) => n === 'slide' && t >= pressAt);
    st.slideSoundMs.push(heard.length ? heard[0][1] - pressAt : null);
    st.slideSounds.push(heard.length);
  }

  // a pass and a shot, with the ball at your feet
  for (let trial = 0; trial < Math.min(TRIALS, 8); trial++) {
    const shot = trial % 2 === 1;
    meS.x = 1200; meS.y = 700; meS.vx = 0; meS.vy = 0; meS.stunT = 0; meS.fallT = 0; meS.recoverT = 0; meS.slideT = 0; meS.skillCd = 0;
    srv.ball.reset(meS.x + 26, meS.y); srv.ball.owner = meS; srv.ball.vx = 0; srv.ball.vy = 0;
    Input.stick.x = 0; Input.stick.y = 0;
    await settle(1000);
    const me = Online.m.human;
    if (Online.m.phase !== 'play' || Online.m.ball.owner !== me || !Online.predOk) { trial--; await settle(400); if (performance.now() - t0 > 150000) break; continue; }
    Input.stick.x = 1; Input.stick.y = 0;
    await frame();
    soundLog.length = 0;
    const pressAt = performance.now();
    if (shot) { Input._shootPressed = true; await frame(); await frame(); Input._shootReleased = true; }
    else { Input._passPressed = true; Input._passQueued = true; }
    const releaseAt = performance.now();
    while (performance.now() - releaseAt < 700) { await frame(); Input.stick.x = 1; Input.stick.y = 0; }
    const name = shot ? 'kick' : 'pass';
    const heard = soundLog.filter(([n, t]) => n === name && t >= releaseAt - 40);
    (shot ? st.kickSoundMs : st.passSoundMs).push(heard.length ? Math.max(0, heard[0][1] - releaseAt) : null);
    (shot ? st.kickSounds : st.passSounds).push(heard.length);
  }
  const out = {
    client: OLD ? 'last commit' : 'working copy', lagMs: LAG, trials: TRIALS,
    slideMs: med(st.slideMs), slideMs90: p90(st.slideMs), noStart: st.noStart,
    pops: st.pops, popMax: Math.round(st.popMax),
    gapMed: med(st.gaps), gapMax: st.gaps.length ? Math.round(Math.max(...st.gaps)) : null,
    rejectedLungeMs: med(st.rejected), rejectedLungeMax: st.rejected.length ? Math.max(...st.rejected) : null,
    doubles: st.doubles,
    slideSoundMs: med(st.slideSoundMs.filter((v) => v !== null)), slideSounds: [...new Set(st.slideSounds)].sort().join('/'),
    passSoundMs: med(st.passSoundMs.filter((v) => v !== null)), passSounds: [...new Set(st.passSounds)].sort().join('/'),
    kickSoundMs: med(st.kickSoundMs.filter((v) => v !== null)), kickSounds: [...new Set(st.kickSounds)].sort().join('/'),
    errors: st.errors,
  };
  console.log(JSON.stringify(out));
  if (OLD) process.exit(0); // the last commit is only there to be compared with
  let failures = 0;
  const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
  const frameMs = 40; // a frame, with room for a slow machine
  check('a tackle shows on your screen within a frame or two of the press (it was ~170 ms)', out.slideMs !== null && out.slideMs <= frameMs && out.noStart === 0, { slideMs: out.slideMs, slideMs90: out.slideMs90 });
  check('and its sound too, played once', out.slideSoundMs !== null && out.slideSoundMs <= frameMs && out.slideSounds === '1', { ms: out.slideSoundMs, plays: out.slideSounds });
  check('a pass sounds at once, once', out.passSoundMs !== null && out.passSoundMs <= frameMs && out.passSounds === '1', { ms: out.passSoundMs, plays: out.passSounds });
  check('a shot sounds at once, once', out.kickSoundMs !== null && out.kickSoundMs <= frameMs && out.kickSounds === '1', { ms: out.kickSoundMs, plays: out.kickSounds });
  check('you are never drawn jumping when the server takes the lunge over', out.pops === 0, { pops: out.pops, popMax: out.popMax });
  check('and the picture of you ends up where the server has you', out.gapMax !== null && out.gapMax < 120, { gapMed: out.gapMed, gapMax: out.gapMax });
  check('two presses are one lunge', out.doubles === 0, { doubles: out.doubles });
  check('a tackle the server turns down stops by itself, within the length of a lunge', out.rejectedLungeMax !== null && out.rejectedLungeMax <= 700, { ms: out.rejectedLungeMs, max: out.rejectedLungeMax });
  check('no errors', out.errors.length === 0, out.errors.slice(0, 2));
  console.log(failures ? `\n${failures} FAILED` : '\nall instant-response checks passed');
  process.exit(failures ? 1 : 0);
})();
