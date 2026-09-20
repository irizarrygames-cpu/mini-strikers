// How the ball feels online, measured headless: the real server game code and the real
// client netcode (js/online.js) in one process, joined by fake sockets with lag.
//   node tools/ballscan.js play  [seconds=60] [lagMs one way=55] [format=2v2] [jitterMs=10] [--old]
//   node tools/ballscan.js drill [seconds=90] [lagMs one way=55] [jitterMs=10] [--old]
// Live on Render the round trip is ~110ms, i.e. 55 each way. --old runs the client netcode from
// the last commit instead of the working copy, for a before/after on the same drills.
//
// play:  a scripted player chases, picks up, weaves, passes, shoots and does skills against bots.
// drill: 1v1 with the opponent parked out of the way; again and again a loose ball is rolled at you
//        from a random angle and speed, you pick it up, dribble a moment, then pass, shoot or skill.
//
//   pickupMs     the drawn ball touches your drawn player -> it's drawn at your feet
//   passThrough  the drawn ball reached you loose and rolled on without you getting it
//   ghost        drawn at your feet, then taken away again without a kick (a wrong guess)
//   kickMs       a pass/shot released -> the drawn ball visibly leaves your feet
//   feetGap      while you have it, how far the drawn ball strays from your feet
//   drift        loose ball near you: how much it moves that its own speed doesn't explain (units/s)
//   ballPops     frames where the drawn ball jumps further than its speed explains
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createGame } = require('../server/game');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OLD = process.argv.includes('--old');
const MODE = args[0] === 'drill' ? 'drill' : 'play';
const num = (i, d) => (args[i] !== undefined && args[i] !== '' ? +args[i] : d);
const SECONDS = num(1, MODE === 'drill' ? 90 : 60), LAG = num(2, 55);
const FORMAT = MODE === 'drill' ? '1v1' : args[3] || '2v2';
const JITTER = MODE === 'drill' ? num(3, 10) : num(4, 10);

// ---- the client: browser scripts in a sandbox, screens and sound stubbed ----
const noopProxy = (extra = {}) => new Proxy(extra, { get: (o, k) => (k in o ? o[k] : () => {}) });
const el = () => ({ hidden: true, style: {}, classList: { toggle() {}, add() {}, remove() {} }, textContent: '', querySelector: () => el() });
const handlers = {};
let toServer = null;
const Net = { rtt: LAG * 2, on: (t, fn) => { handlers[t] = fn; }, send: (o) => toServer(o), whenReady: (o) => toServer(o), user: null };
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Symbol, Error, isFinite, parseInt, parseFloat, performance,
  setTimeout, clearTimeout,
  Sound: noopProxy(), FX: noopProxy({ banner: null }), UI: noopProxy(), Render: noopProxy(), Pens: noopProxy(),
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

// ---- the server, and the wire between them ----
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
  Net.send({ t: 'room.create', format: FORMAT });
  await sleep(LAG * 2 + 50); drain();
  Net.send({ t: 'room.start' });
  const t0 = performance.now();
  while (!(Online.m && Online.m.phase === 'play') && performance.now() - t0 < 15000) { await sleep(4); drain(); if (Online.m) Online.update(0.016); }
  if (!Online.m) { console.log('no match started'); process.exit(1); }
  const room = game._roomOf('tester'), srv = room.m, meS = room.seats.find((s) => s.userId === 'tester').player;

  const st = { frames: 0, playFrames: 0, ownFrames: 0, pickups: [], passThrough: 0, ghost: 0, kicks: [], kickLost: 0, feetGapSum: 0, feetGapMax: 0, driftSum: 0, driftT: 0, ballPops: 0, ballPopMax: 0, mePops: 0, mePopMax: 0, shots: 0, passes: 0, skills: 0, drills: 0, errors: [] };
  let last = performance.now(), prevBall = null, prevMe = null, act = 1.2, weave = 0, hold = 0, touch = null, kick = null, owned = false;
  const goals0 = Online.m.score.blue;
  const R = CFG.PLAYER_R + CFG.BALL_R;
  // drill: 'roll' (a ball is coming, go get it) -> 'hold' (dribble) -> pass/shot/skill -> 'wait' -> next roll
  let drill = { phase: 'setup', t: 0, holdFor: 0 };
  const end = performance.now() + SECONDS * 1000;
  while (performance.now() < end && Online.m) {
    await sleep(16 - ((performance.now() - last) % 16) || 1);
    drain();
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const m = Online.m, me = m.human, b = m.ball;
    const play = m.phase === 'play';
    let measure = true;
    if (process.env.TRACE && st.frames % 60 === 0) console.log(JSON.stringify({ t: Math.round((now - t0) / 100) / 10, ph: m.phase, drill: drill.phase, dt: +drill.t.toFixed(1), meS: [Math.round(meS.x), Math.round(meS.y)], me: [Math.round(me.x), Math.round(me.y)], sb: [Math.round(srv.ball.x), Math.round(srv.ball.y)], own: srv.ball.owner ? srv.ball.owner.team + (srv.ball.owner === meS ? "*" : "") : null, phS: srv.phase }));
    try {
      if (MODE === 'drill') {
        // the opponent waits in a corner, well away from everything
        for (const p of srv.players) if (p !== meS && !p.isKeeper) { p.x = 120; p.y = 120; p.vx = 0; p.vy = 0; }
        drill.t += dt;
        if (!play) drill = { phase: 'setup', t: 0 };
        else if ((drill.phase === 'hold' || drill.phase === 'shooting') && (drill.t > 3 || b.owner !== me)) drill = { phase: 'wait', t: 0 };
        else if (drill.phase === 'setup' || (drill.phase === 'roll' && drill.t > 3) || (drill.phase === 'wait' && drill.t > 0.9)) {
          // keep it in midfield, away from the goals, then roll a ball at (or across) the player
          // still on the ball (a skill that kept it): kick it away first, never roll a second ball in
          if (srv.ball.owner === meS) drill = { phase: 'hold', t: 0, holdFor: 0 };
          else if (meS.x < 700 || meS.x > 1700 || meS.y < 250 || meS.y > 1150) { meS.x = 1200; meS.y = 700; meS.vx = 0; meS.vy = 0; drill = { phase: 'settle', t: 0 }; }
          else {
            const a = Math.random() * Math.PI * 2, dist0 = 190 + Math.random() * 120;
            const bx = meS.x + Math.cos(a) * dist0, by = meS.y + Math.sin(a) * dist0;
            const aim = Math.atan2(meS.y - by, meS.x - bx) + (Math.random() - 0.5) * 0.9, sp = 120 + Math.random() * 360;
            const sb = srv.ball;
            sb.reset(bx, by); sb.vx = Math.cos(aim) * sp; sb.vy = Math.sin(aim) * sp; sb.lastTouchTeam = 'red';
            meS.noPickupT = 0;
            drill = { phase: 'roll', t: 0 }; st.drills++;
            touch = null; kick = null;
          }
        } else if (drill.phase === 'settle' && drill.t > 0.8) drill = { phase: 'setup', t: 0 };
        measure = drill.phase !== 'settle' && !(drill.phase === 'roll' && drill.t < 0.35);
        if (b.owner === me) {
          // dribble: weave around one heading (back toward the middle), picked when you get the ball
          if (drill.phase === 'roll') drill = { phase: 'hold', t: 0, holdFor: 0.4 + Math.random() * 0.6, head: Math.atan2(700 - me.y, 1200 - me.x) + (Math.random() - 0.5) * 1.5 };
          if (drill.head === undefined) drill.head = Math.atan2(700 - me.y, 1200 - me.x);
          weave += dt;
          const a = drill.head + Math.sin(weave * 3) * 0.9;
          Input.stick.x = Math.cos(a); Input.stick.y = Math.sin(a);
          Input.sprintHeld = false;
          if (hold > 0) { hold -= dt; if (hold <= 0) { Input._shootReleased = true; kick = { t: now }; st.shots++; drill = { phase: 'wait', t: 0 }; } }
          else if (drill.phase === 'hold' && drill.t > drill.holdFor) {
            const r = Math.random();
            if (r < 0.35) { Input._shootPressed = true; hold = 0.1 + Math.random() * 0.4; drill.phase = 'shooting'; }
            else if (r < 0.7) { Input._passPressed = true; Input._passQueued = true; kick = { t: now }; st.passes++; drill = { phase: 'wait', t: 0 }; }
            else { Input._skillQueued = true; st.skills++; drill = { phase: 'wait', t: 0 }; }
          }
        } else {
          weave = 0;
          if (hold > 0) { hold = 0; Input._shootReleased = true; }
          const dx = b.x - me.x, dy = b.y - me.y, l = Math.hypot(dx, dy) || 1;
          const go = drill.phase === 'roll';
          Input.stick.x = go ? dx / l : 0; Input.stick.y = go ? dy / l : 0;
          Input.sprintHeld = false;
        }
      } else if (b.owner === me) {
        weave += dt;
        const gx = CFG.FIELD_W - 60 - me.x, gy = CFG.FIELD_H / 2 - me.y, a = Math.atan2(gy, gx) + Math.sin(weave * 2.4) * 0.7;
        Input.stick.x = Math.cos(a); Input.stick.y = Math.sin(a);
        Input.sprintHeld = Math.sin(weave * 0.7) > 0;
        act -= dt;
        if (hold > 0) { hold -= dt; if (hold <= 0) { Input._shootReleased = true; kick = { t: now }; st.shots++; } }
        else if (act <= 0 && play) {
          const r = Math.random();
          if (me.x > CFG.FIELD_W * 0.62 && r < 0.55) { Input._shootPressed = true; hold = 0.2 + Math.random() * 0.4; }
          else if (r < 0.45) { Input._passPressed = true; Input._passQueued = true; kick = { t: now }; st.passes++; }
          else { Input._skillQueued = true; st.skills++; }
          act = 1 + Math.random() * 1.5;
        }
      } else {
        weave = 0;
        if (hold > 0) { hold = 0; Input._shootReleased = true; }
        const dx = b.x - me.x, dy = b.y - me.y, l = Math.hypot(dx, dy) || 1;
        Input.stick.x = dx / l; Input.stick.y = dy / l;
        Input.sprintHeld = l > 250;
        if (b.owner && b.owner.team !== me.team && l < 110 && Math.random() < 0.05) Input._slideQueued = true;
      }
      Input.update();
      Online.update(dt);
    } catch (e) { st.errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]); if (st.errors.length > 5) break; }
    const d = Math.hypot(b.x - me.x, b.y - me.y), mineNow = b.owner === me;
    if (play && measure) {
      st.playFrames++;
      if (mineNow) { st.ownFrames++; const gap = Math.abs(d - (R + 4)); st.feetGapSum += gap; st.feetGapMax = Math.max(st.feetGapMax, gap); }
      if (!mineNow && !b.owner && d < R + 5 && b.z < 24 && !touch && Online.predOk && (!kick || now - kick.t > 450)) touch = { t: now };
      if (touch) {
        if (mineNow) { st.pickups.push(now - touch.t); touch = null; }
        else if (b.owner) touch = null;
        else if (d > R + 45) { st.passThrough++; touch = null; if ((st.ptLog = st.ptLog || []).length < 10) st.ptLog.push({ drill: drill.phase, dt: +drill.t.toFixed(2), block: +(Online.kickBlock || 0).toFixed(2), w: Online.wBall !== undefined ? +Online.wBall.toFixed(2) : null, bsp: Math.round(Math.hypot(b.vx, b.vy)), bz: Math.round(b.z), srvOwn: srv.ball.owner ? (srv.ball.owner === meS ? 'me' : 'oth') : '-', srvD: Math.round(Math.hypot(srv.ball.x - meS.x, srv.ball.y - meS.y)), noP: +meS.noPickupT.toFixed(2), kickAgo: kick ? Math.round(now - kick.t) : null }); }
        else if (now - touch.t > 1500) touch = null;
      }
      if (kick && !kick.done) {
        if (!mineNow && d > R + 22) { st.kicks.push(now - kick.t); kick.done = true; }
        else if (now - kick.t > 1500) { st.kickLost++; kick.done = true; }
      }
      // drawn at your feet, then not, with no pass/shot/skill of yours just before: a wrong guess
      if (owned && !mineNow && (!kick || now - kick.t > 800) && drill.phase !== 'wait' && !(drill.phase === 'roll' && drill.t < 0.8)) { st.ghost++; const so = srv.ball.owner; const why = so && so !== meS ? (so.team === meS.team ? 'mate' : 'opp') + (meS.stunT > 0 ? '-tackled' : '') : so === meS ? 'srvStillMe' : 'loose'; st.ghostKinds = st.ghostKinds || {}; st.ghostKinds[why] = (st.ghostKinds[why] || 0) + 1; }
    } else touch = null;
    if (process.env.GTRACE) {
      const L = Online.snaps[Online.snaps.length - 1];
      (st.hist = st.hist || []).push({ t: Math.round(now - t0), srv: srv.ball.owner === meS ? 'ME' : srv.ball.owner ? 'oth' : '-', lat: L && L.b.owner === Online.you ? 'ME' : L && L.b.owner >= 0 ? 'oth' : '-', lo: Online.localOwn ? 1 : 0, drawn: mineNow ? 'ME' : b.owner ? 'oth' : '-', d: Math.round(d), srvD: Math.round(Math.hypot(srv.ball.x - meS.x, srv.ball.y - meS.y)), noP: +meS.noPickupT.toFixed(2), drill: drill.phase });
      if (st.hist.length > 40) st.hist.shift();
      if (owned && !mineNow && drill.phase === 'hold' && !st.dumped) { st.dumped = true; for (const h of st.hist) console.log(JSON.stringify(h)); }
    }
    if (MODE === 'drill') {
      const so = srv.ball.owner === meS;
      if (st.srvOwned && !so && Online.dbg.lastKick && (st.kLog = st.kLog || []).length < 25) {
        const k = Online.dbg.lastKick; Online.dbg.lastKick = null;
        st.kLog.push({ ...k, preFa: st.preFa, preMv: st.preMv, preSp: st.preSp, srvFa: Math.round(Math.atan2(meS.fy, meS.fx) * 57.3), srvDir: Math.round(Math.atan2(srv.ball.vy, srv.ball.vx) * 57.3), srvPos: [Math.round(meS.x), Math.round(meS.y)], srvB: [Math.round(srv.ball.x), Math.round(srv.ball.y)], srvMv: Math.round(Math.atan2(meS.input.move.y, meS.input.move.x) * 57.3), srvKickT: +meS.kickT.toFixed(2) });
      }
      st.srvOwned = so;
      if (meS.slideT > 0 && !st.inSlide) { st.srvSlides = (st.srvSlides || 0) + 1; if ((st.slideLog = st.slideLog || []).length < 6) st.slideLog.push({ drill: drill.phase, dt: +drill.t.toFixed(2), srvOwn: srv.ball.owner ? (srv.ball.owner === meS ? 'me' : 'oth') : '-', srvD: Math.round(Math.hypot(srv.ball.x - meS.x, srv.ball.y - meS.y)), drawnMine: b.owner === me, lo: !!Online.localOwn }); }
      st.inSlide = meS.slideT > 0;
      if (meS.recoverT > 0 && !st.inRec) st.srvRecover = (st.srvRecover || 0) + 1;
      st.inRec = meS.recoverT > 0;
      st.preFa = Math.round(Math.atan2(meS.fy, meS.fx) * 57.3); st.preMv = Math.round(Math.atan2(meS.input.move.y, meS.input.move.x) * 57.3); st.preSp = Math.round(Math.hypot(meS.vx, meS.vy));
    }
    // a pick-up on your screen: what did the server look like when it started, and how did it end?
    if (Online.localOwn && !st.loWas) st.loStart = { srvD: Math.round(Math.hypot(srv.ball.x - meS.x, srv.ball.y - meS.y)), srvZ: Math.round(srv.ball.z), srvSp: Math.round(Math.hypot(srv.ball.vx, srv.ball.vy)), noP: +meS.noPickupT.toFixed(2), cd: +srv.ball.pickupCd.toFixed(2), srvOwn: srv.ball.owner ? (srv.ball.owner === meS ? 'me' : 'oth') : '-', minD: 1e9, drill: drill.phase, dt: +drill.t.toFixed(2) };
    if (Online.localOwn && st.loStart) st.loStart.minD = Math.min(st.loStart.minD, Math.round(Math.hypot(srv.ball.x - meS.x, srv.ball.y - meS.y)));
    if (!Online.localOwn && st.loWas && st.loStart && (Online.dbg.pickup_late || 0) > (st.lateSeen || 0)) { st.lateSeen = Online.dbg.pickup_late; (st.lateLog = st.lateLog || []).push(st.loStart); }
    st.loWas = !!Online.localOwn;
    owned = mineNow;
    if (play && measure && prevBall && prevMe && prevBall.phase === 'play') {
      const moved = Math.hypot(b.x - prevBall.x, b.y - prevBall.y);
      const expB = Math.hypot(b.vx, b.vy) * dt * 1.6 + 6, jb = moved - expB;
      if (jb > 14) { st.ballPops++; st.ballPopMax = Math.max(st.ballPopMax, jb); if ((st.popWhy = st.popWhy || []).length < 14) st.popWhy.push({ jb: Math.round(jb), mv: Math.round(moved), own: b.owner === me ? 'me' : b.owner ? 'other' : 'loose', was: prevBall.owner === me ? 'me' : prevBall.owner ? 'other' : 'loose', w: Online.wBall !== undefined ? +Online.wBall.toFixed(2) : null, lo: !!Online.localOwn, bc: Math.round(Math.hypot(Online.ballCorr.x, Online.ballCorr.y)), sp: Math.round(Math.hypot(b.vx, b.vy)), d: Math.round(d), drill: drill.phase, dt: +drill.t.toFixed(2) }); }
      if (!b.owner && !prevBall.owner && d < 260) { st.driftSum += Math.hypot(b.x - prevBall.x - b.vx * dt, b.y - prevBall.y - b.vy * dt); st.driftT += dt; }
      const expM = Math.max(Math.hypot(me.vx, me.vy), CFG.SPEED * 1.4) * dt * 1.3 + 4, jm = Math.hypot(me.x - prevMe.x, me.y - prevMe.y) - expM;
      if (jm > 10) { st.mePops++; st.mePopMax = Math.max(st.mePopMax, jm); }
    }
    if (play && MODE === 'play') {
      const opp = (p) => p.team !== me.team && !p.isKeeper;
      // you go down from a real tackle (the server trips you: stun 0.45, a nutmeg is 0.35): the nearest
      // opponent who is (or just was) sliding, as drawn on your screen when you're drawn going down
      if (meS.stunT > 0.4 && !(st.srvStun > 0.4)) st.tripAt = now;
      st.srvStun = meS.stunT;
      const down = me.stunT > 0.05 || me.fallT > 0;
      if (down && !st.wasDown && st.tripAt && now - st.tripAt < 700) {
        let g0 = 1e9; for (const p of m.players) if (opp(p) && (p.slideT > 0 || p.slideHit || p.recoverT > 0)) g0 = Math.min(g0, Math.hypot(p.x - me.x, p.y - me.y));
        (st.hitMe = st.hitMe || []).push(Math.round(g0 > 1e8 ? -1 : g0));
      }
      st.wasDown = down;
      // you win it with a tackle: how far the player you took it off is drawn
      if (mineNow && prevBall && prevBall.owner && prevBall.owner !== me && opp(prevBall.owner) && (me.slideT > 0 || meS.slideT > 0 || (st.lastSlideAt && now - st.lastSlideAt < 600))) {
        (st.myTackles = st.myTackles || []).push(Math.round(Math.hypot(prevBall.owner.x - me.x, prevBall.owner.y - me.y)));
      }
      if (meS.slideT > 0) st.lastSlideAt = now;
      // everyone else: frames where a drawn player jumps further than their speed explains
      st.prevOthers = st.prevOthers || new Map();
      for (const p of m.players) {
        if (p === me) continue;
        const pv = st.prevOthers.get(p);
        if (pv && pv.phase === 'play') {
          const jumpO = Math.hypot(p.x - pv.x, p.y - pv.y) - (Math.max(Math.hypot(p.vx, p.vy), CFG.SPEED * 1.4) * dt * 1.3 + 4);
          if (jumpO > 10) { st.otherPops = (st.otherPops || 0) + 1; st.otherPopMax = Math.max(st.otherPopMax || 0, jumpO); }
          st.otherFrames = (st.otherFrames || 0) + 1;
        }
        st.prevOthers.set(p, { x: p.x, y: p.y, phase: m.phase });
      }
    }
    prevBall = { x: b.x, y: b.y, phase: m.phase, owner: b.owner }; prevMe = { x: me.x, y: me.y };
    st.frames++;
  }
  const dbg = { ...Online.dbg }; delete dbg.why;
  console.log(JSON.stringify({
    mode: MODE, old: OLD, lagMs: LAG, jitterMs: JITTER, format: FORMAT, seconds: SECONDS, drills: MODE === 'drill' ? st.drills : undefined,
    ownPct: Math.round((st.ownFrames / Math.max(1, st.playFrames)) * 100),
    pickups: st.pickups.length, pickupMs: med(st.pickups), pickupMs90: p90(st.pickups), passThrough: st.passThrough, ghost: st.ghost,
    kicks: st.kicks.length, kickMs: med(st.kicks), kickMs90: p90(st.kicks), kickLost: st.kickLost,
    feetGapAvg: +(st.feetGapSum / Math.max(1, st.ownFrames)).toFixed(1), feetGapMax: Math.round(st.feetGapMax),
    drift: Math.round(st.driftSum / Math.max(0.001, st.driftT)),
    ballPops: st.ballPops, ballPopMax: Math.round(st.ballPopMax), mePops: st.mePops, mePopMax: Math.round(st.mePopMax),
    tackledGap: st.hitMe ? { n: st.hitMe.length, med: med(st.hitMe.filter((x) => x >= 0)), p90: p90(st.hitMe.filter((x) => x >= 0)), noTackler: st.hitMe.filter((x) => x < 0).length } : null,
    otherPops: st.otherPops || 0, otherPopMax: Math.round(st.otherPopMax || 0), otherFrames: st.otherFrames || 0,
    myTackleGap: st.myTackles ? { n: st.myTackles.length, med: med(st.myTackles), p90: p90(st.myTackles) } : null,
    shots: st.shots, passes: st.passes, skills: st.skills, goals: Online.m ? Online.m.score.blue - goals0 : null, dbg, lateLog: st.lateLog, ghostKinds: st.ghostKinds, ptLog: st.ptLog, kLog: st.kLog, srvSlides: st.srvSlides || 0, srvRecover: st.srvRecover || 0, slideLog: st.slideLog, errors: st.errors, popWhy: st.popWhy, ghostWhy: st.ghostWhy,
  }));
  process.exit(0);
})();
