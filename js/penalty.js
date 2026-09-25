// PENALTY SHOOTOUT: a mode of its own. Five kicks each, then sudden death. You take all of
// your side's kicks and you're in goal for theirs. It's drawn from behind the taker, looking
// at the goal, so picking a corner reads the way it does on TV.
//
// PEN is the whole kick in plain maths (metres: goal 7.32 x 2.44, spot 11m out), with no screen,
// so tools/pensscan.js can take thousands of kicks and measure how often they go in.
const PEN = {
  HW: 3.66, HT: 2.44, SPOT: 11, BR: 0.11, POST: 0.06,
  // keeper: hips start at hip height and travel up to `reach` along the dive at `speed` m/s; the
  // body runs `legs` back from the hips to `arm` out to the fingertips, `r` thick
  // (you in goal get quicker feet than the bots: PLAYER_DIVE)
  K: { hip: 0.72, reach: 1.75, up: 0.6, speed: 5.2, legs: 0.5, arm: 1.35, r: 0.33, standR: 0.38 },
  PLAYER_DIVE: 7.2, BOT_SLOW: 2.5,

  gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },

  // a strike. ax: -1..1 across the goal (posts at ±1), az: 0..1 up to the bar, power 0..1,
  // q: the taker's finishing 0..1. Too much power sprays it and lifts it.
  // slow: m/s off the pace (the bots' kicks, so you can see them coming)
  kick(ax, az, power, q, slow = 0) {
    const sigma = 0.16 + (1 - q) * 0.22 + Math.max(0, power - 0.82) * 2.4;
    const lift = Math.max(0, power - 0.78) * 2.0;
    const x = ax * this.HW + this.gauss() * sigma;
    const z = Math.max(this.BR, az * this.HT + lift + this.gauss() * sigma * 0.6);
    const v = 16 + power * 13 + q * 2 - slow;
    const k = { x, z, v, T: this.SPOT / v, power, out: 'in', postIn: false };
    k.out = this.frame(k);
    // grazing the inside of the post or the bar: sometimes it goes in off it
    if (k.out === 'post' || k.out === 'bar') k.postIn = Math.random() < 0.4;
    return k;
  },

  // where the ball crosses the line if nobody touches it
  frame(k) {
    const ax = Math.abs(k.x);
    if (ax > this.HW + this.BR) return 'wide';
    if (k.z > this.HT + this.BR) return 'over';
    if (ax > this.HW - this.BR - this.POST) return 'post';
    if (k.z > this.HT - this.BR - this.POST) return 'bar';
    return 'in';
  },

  // the keeper t seconds after the kick. dive: { dx, dz, td } (unit direction, start time) or null
  // (stays standing). Returns hips p, body axis a, how far they've gone s.
  keeper(dive, kx, t) {
    const K = this.K;
    if (!dive) return { p: { x: kx, z: K.hip }, a: { x: 0, z: 1 }, s: 0, phi: 0, stand: true };
    const up = Math.abs(dive.dx) < 0.3 && dive.dz > 0;
    const s = clamp((dive.v || K.speed) * (t - dive.td), 0, up ? K.up : K.reach);
    const phi = Math.atan2(dive.dx, dive.dz) * clamp(s / 0.7, 0, 1);
    return { p: { x: kx + dive.dx * s, z: Math.max(0.3, K.hip + dive.dz * s) }, a: { x: Math.sin(phi), z: Math.cos(phi) }, s, phi, stand: false };
  },

  // does the keeper get something on a ball crossing the line at (x, z) at time t?
  saves(dive, kx, t, x, z) {
    const K = this.K, k = this.keeper(dive, kx, t);
    const legs = k.stand ? K.hip - 0.1 : K.legs, arm = k.stand ? 1.0 : K.arm, r = (k.stand ? K.standR : K.r) + this.BR;
    const ax = k.p.x - k.a.x * legs, az = k.p.z - k.a.z * legs, bx = k.p.x + k.a.x * arm, bz = k.p.z + k.a.z * arm;
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const u = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    return Math.hypot(x - (ax + dx * u), z - (az + dz * u)) < r;
  },

  // a bot in goal: now and then it reads the kick and goes the right way a moment after it's
  // struck; otherwise it guesses a side (or stays up) as the ball is hit
  botDive(k, read) {
    // a soft one gives it time to read
    if (Math.random() < read + (1 - k.power) * 0.4) {
      const dx = k.x, dz = k.z - this.K.hip, l = Math.hypot(dx, dz) || 1;
      if (Math.abs(k.x) < 0.45) return null;
      return { dx: dx / l, dz: dz / l, td: rand(0.1, 0.18) };
    }
    const r = Math.random();
    if (r < 0.22) return null;
    const side = r < 0.61 ? -1 : 1, ang = rand(-0.35, 1.0);
    return { dx: side * Math.cos(ang), dz: Math.sin(ang), td: rand(-0.08, 0.04) };
  },

  // a bot taking one: mostly a side, the odd one down the middle; better takers go closer to the corners
  botAim(aim) {
    if (Math.random() < 0.12 - aim * 0.06) return { ax: rand(-0.2, 0.2), az: rand(0.05, 0.55), power: rand(0.5, 0.8) };
    const side = Math.random() < 0.5 ? -1 : 1;
    return { ax: side * rand(0.4, 0.8 + aim * 0.14), az: rand(0.05, 0.6 + aim * 0.3), power: rand(0.42 + aim * 0.12, 0.74 + aim * 0.12) };
  },

  // who's won, if anyone yet: 'blue' | 'red' | null. Five each, stopping early when one side can't
  // catch up, then one each until one scores and the other doesn't.
  decided(kicks) {
    const b = kicks.blue, r = kicks.red, gb = b.filter(Boolean).length, gr = r.filter(Boolean).length;
    if (b.length < 5 || r.length < 5) {
      if (gb + (5 - b.length) < gr) return 'red';
      if (gr + (5 - r.length) < gb) return 'blue';
      return null;
    }
    if (b.length === r.length && gb !== gr) return gb > gr ? 'blue' : 'red';
    return null;
  },
};

const PEN_LEVELS = {
  // read: how often the bot keeper reads your kick; q/aim: their takers' finishing and placement;
  // sw: how often their taker spots you diving early and puts it the other way
  easy: { read: 0.1, q: 0.3, aim: 0.15, sw: 0.3 },
  normal: { read: 0.2, q: 0.5, aim: 0.45, sw: 0.5 },
  hard: { read: 0.3, q: 0.68, aim: 0.75, sw: 0.65 },
};
const PEN_SAY = {
  goal: ['GOAL!', '#ffe14d'], save: ['SAVED!', '#46d9ff'], wide: ['WIDE!', '#ffffff'], over: ['OVER THE BAR!', '#ffffff'],
  post: ['OFF THE POST!', '#ffffff'], bar: ['OFF THE BAR!', '#ffffff'], postIn: ['IN OFF THE POST!', '#ffe14d'], barIn: ['IN OFF THE BAR!', '#ffe14d'],
};

const Pens = {
  // ---------- setup ----------
  init(m) {
    const lvl = PEN_LEVELS[Save.data.settings.difficulty] || PEN_LEVELS.normal, cl = m.club.level || 0;
    const ch = Save.character();
    const rng = mulberry32((Math.random() * 1e9) | 0);
    const takerLook = () => { const bc = pickBotCharacter(rng); return { hair: bc.hair, hairColor: bc.hairColor, skin: bc.skin, cap: bc.cap, band: bc.band, acc: null }; };
    m.mode = 'pens'; m.format = 'pens'; m.phase = 'play'; m.challenges = null;
    m.pens = {
      bot: { read: lvl.read + cl * 0.025, q: clamp(lvl.q + cl * 0.05, 0, 0.95), aim: clamp(lvl.aim + cl * 0.08, 0, 1), sw: lvl.sw },
      q: clamp(((ch.r && ch.r.sht) || 70) - 50, 0, 50) / 50 * 0.9 + 0.1,
      kicks: { blue: [], red: [] }, first: Math.random() < 0.5 ? 'blue' : 'red',
      n: 0, team: null, phase: 'start', t: 0, winner: null, saves: 0, theirSaves: 0,
      aim: { x: 0, z: 0.45 }, power: 0, holding: false, holdInputSeen: false, holdT: 0, clock: 0, mouse: null,
      shot: null, dive: null, kickAt: 0, result: null, say: null, cheerT: 0, shake: 0,
      takers: [0, 1, 2, 3, 4].map((i) => ({ look: takerLook(), number: [9, 7, 11, 8, 10][i] })),
      you: this.actor('blue', false, m.human.look, 10), them: null,
      keeper: { blue: this.actor('blue', true, m.keepers.blue.look, 1), red: this.actor('red', true, m.keepers.red.look, 1) },
    };
    m.human.celebKind = null;
    m.score = { blue: 0, red: 0 };
    this.next(m, true);
  },

  // something the sprite code can draw
  actor(team, keeper, look, number) {
    return { team, isKeeper: keeper, look, number, vx: 0, vy: 0, fx: 0, fy: keeper ? 1 : -1, faceX: 0.001, kickT: 0, kickDur: 0.22,
      celebrateT: 0, celebKind: null, diveT: 0, diveDir: 0, stunT: 0, recoverT: 0, seed: Math.random() * 10, runPhase: 0, sad: false,
      slideT: 0, slideWindT: 0, fallT: 0, hopT: 0, skill: null, ultOn: false, ultShot: null, sprintOn: false, speed: 0 };
  },

  // the next kick (or the end)
  next(m, first) {
    const P = m.pens;
    if (P.chal) return SkillRun.nextKick(m, first);
    if (!first) {
      P.winner = PEN.decided(P.kicks);
      if (P.winner) { P.phase = 'end'; P.t = 0; this.label('SHOOT'); if (P.winner === 'blue') { Sound.cheer(true); Sound.goalJingle(true); } else Sound.ooh(); return; }
      P.n++;
    }
    const other = P.first === 'blue' ? 'red' : 'blue';
    P.team = P.n % 2 === 0 ? P.first : other;
    P.phase = first ? 'start' : 'ready'; P.t = 0; P.shot = null; P.dive = null; P.result = null; P.say = null; P.power = 0; P.holding = false; P.holdInputSeen = false; P.holdT = 0;
    P.aim = { x: 0, z: 0.45 }; P.mouse = null; P.clock = 10;
    const taker = P.team === 'blue' ? P.you : this.actor('red', false, P.takers[Math.floor(P.n / 2) % 5].look, P.takers[Math.floor(P.n / 2) % 5].number);
    if (P.team === 'red') P.them = taker;
    Object.assign(taker, { celebrateT: 0, celebKind: null, sad: false, kickT: 0, fy: -1, faceX: 0.001, run: 0, vx: 0, vy: 0 });
    for (const k of Object.values(P.keeper)) Object.assign(k, { diveT: 0, celebrateT: 0, sad: false, hopT: 0 });
    P.runup = rand(0.9, 1.3);
    this.label(P.team === 'blue' ? 'SHOOT' : 'DIVE');
    this.flushInput();
  },

  label(text) { const l = document.querySelector('#btn-shoot .label'); if (l && l.textContent !== text) l.textContent = text; },
  taker(P) { return P.team === 'blue' ? P.you : P.them; },
  goalie(P) { return P.keeper[P.team === 'blue' ? 'red' : 'blue']; },
  sudden(P) { return P.n >= 10; },

  // ---------- the game ----------
  step(m, dt) {
    const P = m.pens;
    if (P.net) return this.netStep(m, dt);
    P.t += dt;
    P.cheerT = Math.max(0, P.cheerT - dt);
    P.shake = Math.max(0, P.shake - dt);
    const taker = this.taker(P), gk = this.goalie(P);
    for (const a of [P.you, P.them, P.keeper.blue, P.keeper.red]) if (a) { a.kickT = Math.max(0, a.kickT - dt); a.celebrateT = Math.max(0, a.celebrateT - dt); a.hopT = Math.max(0, a.hopT - dt); }

    switch (P.phase) {
      case 'start':
      case 'ready':
        if (P.t >= (P.n === 0 ? 1.6 : 1.1)) { P.phase = P.team === 'blue' ? 'aim' : 'runup'; P.t = 0; Sound.whistle(); this.flushInput(); }
        break;

      case 'aim': {
        // your kick: move the aim around the goal, hold SHOOT for power, let go to hit it
        const mv = Input.move, q = P.q;
        if (Math.hypot(mv.x, mv.y) > 0.05) P.mouse = null;
        if (P.mouse) { P.aim.x += (P.mouse.x - P.aim.x) * Math.min(1, dt * 14); P.aim.z += (P.mouse.z - P.aim.z) * Math.min(1, dt * 14); }
        else { P.aim.x += mv.x * 1.25 * dt; P.aim.z -= mv.y * 1.1 * dt; }
        P.aim.x = clamp(P.aim.x, -1.08, 1.08); P.aim.z = clamp(P.aim.z, 0.03, 1.1);
        // a steadier finisher's aim wobbles less
        const wob = 0.035 + (1 - q) * 0.05;
        P.sway = { x: Math.sin(P.t * 2.3) * wob, z: Math.sin(P.t * 1.7 + 1) * wob * 0.8 };
        // Use both the queued edge and the live held state. Browsers can drop a pointer edge when
        // focus changes or pointer capture moves, which used to leave SHOOT visibly held while the
        // penalty never charged. The live state repairs that missed edge without firing on its own.
        const press = Input.consumeShootPress();
        if ((press || Input.shootHeld) && !P.holding) {
          P.holding = true; P.holdInputSeen = !!Input.shootHeld; P.holdT = 0; Sound.chargeStart();
        }
        let release = Input.consumeShootRelease();
        if (P.holding) {
          if (Input.shootHeld) P.holdInputSeen = true;
          if (P.holdInputSeen && !Input.shootHeld) release = true;
          P.holdT += dt;
          P.power = Math.min(1, P.holdT / 0.85);
          if (P.holdT >= 1.6) release = true;
        }
        P.clock -= dt;
        if (P.clock <= 0 && !P.holding) { P.holding = true; P.power = 0.55; release = true; }
        if (release && P.holding) {
          P.holding = false; P.holdInputSeen = false; Sound.chargeStop();
          P.shot = PEN.kick(P.aim.x + P.sway.x, P.aim.z + P.sway.z, P.power, q);
          P.phase = 'strike'; P.t = 0;
        }
        break;
      }

      case 'strike':
        // two quick steps into it
        taker.run = Math.min(1, P.t / 0.3);
        if (P.t >= 0.3) this.strike(m);
        break;

      case 'runup':
        // their kick: they run up; you can dive whenever you like
        taker.run = Math.min(1, P.t / P.runup);
        this.keeperInput(m, P.t - P.runup);
        if (P.t >= P.runup) {
          const a = PEN.botAim(P.bot.aim);
          // dive early and a good taker sees it and puts it the other way
          if (P.dive && P.dive.td < -0.15 && Math.abs(P.dive.dx) > 0.3 && Math.random() < P.bot.sw) a.ax = -Math.sign(P.dive.dx) * rand(0.45, 0.85);
          P.shot = PEN.kick(a.ax, a.az, a.power, P.bot.q, PEN.BOT_SLOW);
          this.strike(m);
        }
        break;

      case 'flight':
        if (P.team === 'red') this.keeperInput(m, P.t);
        this.pose(gk, P.dive, P.t);
        if (P.t >= P.shot.T) this.resolve(m);
        break;

      case 'after':
        this.pose(gk, P.dive, P.shot.T + P.t);
        if (P.t >= 2.1) this.next(m, false);
        break;

      case 'end':
        if (P.t >= 2.6 && m.phase !== 'over') this.finish(m);
        break;
    }
  },

  flushInput() { Input.consumeShootPress(); Input.consumeShootRelease(); Input.consumeSkill(); Input.consumeSlide(); Input.consumePass(); if (Input.consumePassPress) Input.consumePassPress(); },

  // you in goal: the stick picks where (up = high, down = low, centre = stay up), any button dives
  keeperInput(m, tSinceKick) {
    const P = m.pens;
    const press = Input.consumeShootPress() | Input.consumeSkill() | Input.consumeSlide() | (Input.consumePassPress ? Input.consumePassPress() : false);
    Input.consumeShootRelease(); Input.consumePass();
    if (!press || P.dive) return;
    const mv = Input.move, l = Math.hypot(mv.x, mv.y);
    P.dive = l < 0.25 ? { dx: 0, dz: 1, td: tSinceKick, v: PEN.PLAYER_DIVE } : { dx: mv.x / l, dz: -mv.y / l, td: tSinceKick, v: PEN.PLAYER_DIVE };
    Sound.whoosh(true);
  },

  strike(m) {
    const P = m.pens, taker = this.taker(P);
    taker.kickT = taker.kickDur; taker.faceX = P.shot.x < 0 ? -1 : 1; taker.fy = 0;
    Sound.kick(0.4 + P.shot.power * 0.6);
    if (P.team === 'blue') P.dive = PEN.botDive(P.shot, P.bot.read);
    P.phase = 'flight'; P.t = 0;
  },

  // the keeper sprite follows the model
  pose(gk, dive, t) {
    if (!dive) return;
    gk.diveT = 1;
    const side = dive.dx >= 0 ? 1 : -1;
    gk.diveDir = side * TEAMS[gk.team].dir;
  },

  resolve(m) {
    const P = m.pens, s = P.shot, taker = this.taker(P), gk = this.goalie(P);
    let res;
    const couldGoIn = s.out === 'in' || ((s.out === 'post' || s.out === 'bar') && s.postIn);
    if (couldGoIn && PEN.saves(P.dive, 0, s.T, s.x, s.z)) res = 'save';
    else if (s.out === 'in') res = 'goal';
    else if (s.out === 'post' || s.out === 'bar') res = s.postIn ? (s.out === 'post' ? 'postIn' : 'barIn') : s.out;
    else res = s.out;
    const scored = res === 'goal' || res === 'postIn' || res === 'barIn';
    P.result = res; P.say = PEN_SAY[res];
    if (P.chal) return SkillRun.scoreKick(m, s, res);
    P.kicks[P.team].push(scored);
    m.score = { blue: P.kicks.blue.filter(Boolean).length, red: P.kicks.red.filter(Boolean).length };
    // the catch-or-parry and where a rebound goes
    P.after = { held: res === 'save' && s.v < 24 && Math.abs(s.x) < 2.2, side: Math.random() < 0.5 ? -1 : 1 };
    if (P.team === 'blue') { m.human.stats.shots++; m.stats.blue.shots++; if (scored) m.human.stats.goals++; }
    else m.stats.red.shots++;
    if (res === 'save') {
      if (P.team === 'red') { P.saves++; m.keepers.blue.stats.saves++; m.stats.blue.saves++; } else { P.theirSaves++; m.keepers.red.stats.saves++; m.stats.red.saves++; }
    }
    const good = (scored && P.team === 'blue') || (!scored && P.team === 'red');
    if (scored) { Sound.net(); taker.celebrateT = CELE_TIME; taker.celebKind = P.team === 'blue' ? Save.celebration() : null; taker.fy = -1; }
    else { taker.sad = true; if (res === 'save') { Sound.save(); gk.celebrateT = 1.4; } else if (res === 'post' || res === 'bar') Sound.post(); }
    if (good) { Sound.cheer(true); P.cheerT = 1.8; } else Sound.ooh();
    P.shake = res === 'save' || res === 'post' || res === 'bar' ? 0.25 : scored ? 0.18 : 0;
    P.phase = 'after'; P.t = 0;
  },

  finish(m) {
    const P = m.pens, won = P.winner === 'blue';
    const mult = COIN_MULT[Save.data.settings.difficulty] || 1;
    const scored = m.score.blue;
    const coins = Math.round((20 + scored * 8 + P.saves * 10 + (won ? 50 : 0)) * mult);
    // you took every kick and kept goal: a win is all yours, a loss goes to their keeper
    m.result = { outcome: won ? 'win' : 'loss', mvp: won ? m.human : m.keepers.red, coins, base: coins, challengeCoins: 0, cupBonus: 0, mult };
    m.phase = 'over';
    this.label('SHOOT');
    if (!Game.headless) UI.showResults(m);
  },

  xp(m) { const P = m.pens; return 30 + m.score.blue * 15 + P.saves * 15 + (P.winner === 'blue' ? 50 : 0); },

  // ---------- server-authoritative online shootout ----------
  netTeam(P, team) { return team === P.serverSide ? 'blue' : 'red'; },
  netTurn(m, msg) {
    const P = m.pens; P.team = this.netTeam(P, msg.team); P.n = msg.n; P.phase = 'ready'; P.t = 0; P.clock = Math.max(0, (msg.deadline - Date.now()) / 1000);
    P.shot = null; P.dive = null; P.result = null; P.say = null; P.power = 0; P.holding = false; P.holdT = 0; P.netSent = false; P.netDeadline = msg.deadline; P.aim = { x: 0, z: 0.45 }; P.mouse = null;
    P.kicks = P.serverSide === 'blue' ? { blue: [...msg.kicks.blue], red: [...msg.kicks.red] } : { blue: [...msg.kicks.red], red: [...msg.kicks.blue] };
    m.score = P.serverSide === 'blue' ? { ...msg.score } : { blue: msg.score.red, red: msg.score.blue };
    if (P.team === 'red') P.them = this.actor('red', false, P.takers[Math.floor(msg.n / 2) % 5].look, P.takers[Math.floor(msg.n / 2) % 5].number);
    this.label(P.team === 'blue' ? 'SHOOT' : 'DIVE'); this.flushInput(); if (Game.state === 'intro') { $('intro').hidden = true; Game.state = 'match'; }
  },
  netResult(m, msg) {
    const P = m.pens; P.team = this.netTeam(P, msg.team); P.shot = msg.shot; P.dive = msg.dive; P.netResultData = msg; P.phase = 'flight'; P.t = 0;
    const taker = this.taker(P); taker.run = 1; taker.kickT = taker.kickDur; taker.faceX = P.shot.x < 0 ? -1 : 1; taker.fy = 0; Sound.kick(0.4 + P.shot.power * 0.6);
  },
  netApply(m) {
    const P = m.pens, r = P.netResultData, taker = this.taker(P), gk = this.goalie(P);
    P.result = r.result; P.say = PEN_SAY[r.result]; P.kicks = P.serverSide === 'blue' ? { blue: [...r.kicks.blue], red: [...r.kicks.red] } : { blue: [...r.kicks.red], red: [...r.kicks.blue] };
    m.score = P.serverSide === 'blue' ? { ...r.score } : { blue: r.score.red, red: r.score.blue }; P.after = { held: r.result === 'save' && P.shot.v < 24 && Math.abs(P.shot.x) < 2.2, side: Math.random() < 0.5 ? -1 : 1 };
    if (P.team === 'blue') { m.human.stats.shots++; m.stats.blue.shots++; if (r.scored) m.human.stats.goals++; }
    if (r.result === 'save' && P.team === 'red') { P.saves++; m.keepers.blue.stats.saves++; m.stats.blue.saves++; }
    if (r.scored) { Sound.net(); taker.celebrateT = CELE_TIME; taker.celebKind = P.team === 'blue' ? Save.celebration() : null; } else { taker.sad = true; if (r.result === 'save') { Sound.save(); gk.celebrateT = 1.4; } }
    P.phase = 'after'; P.t = 0; P.netResultData = null;
  },
  netStep(m, dt) {
    const P = m.pens; P.t += dt; P.cheerT = Math.max(0, P.cheerT - dt); P.shake = Math.max(0, P.shake - dt); const taker = this.taker(P), gk = this.goalie(P);
    if (P.phase === 'ready') { if (P.t > 0.65) { P.phase = P.team === 'blue' ? 'aim' : 'runup'; P.t = 0; Sound.whistle(); this.flushInput(); } return; }
    if (P.phase === 'aim') {
      const mv = Input.move; if (Math.hypot(mv.x, mv.y) > 0.05) P.mouse = null; if (P.mouse) { P.aim.x += (P.mouse.x - P.aim.x) * Math.min(1, dt * 14); P.aim.z += (P.mouse.z - P.aim.z) * Math.min(1, dt * 14); } else { P.aim.x += mv.x * 1.25 * dt; P.aim.z -= mv.y * 1.1 * dt; }
      P.aim.x = clamp(P.aim.x, -1.08, 1.08); P.aim.z = clamp(P.aim.z, 0.03, 1.1); const wob = 0.035 + (1 - P.q) * 0.05; P.sway = { x: Math.sin(P.t * 2.3) * wob, z: Math.sin(P.t * 1.7 + 1) * wob * 0.8 };
      if (Input.consumeShootPress() && !P.holding) { P.holding = true; P.holdT = 0; Sound.chargeStart(); } let release = Input.consumeShootRelease(); if (P.holding) { P.holdT += dt; P.power = Math.min(1, P.holdT / 0.85); if (P.holdT >= 1.6) release = true; }
      P.clock = Math.max(0, (P.netDeadline - Date.now()) / 1000); if (P.clock <= 0 && !P.holding) { P.holding = true; P.power = 0.58; release = true; }
      if (release && P.holding && !P.netSent) { P.holding = false; P.netSent = true; Sound.chargeStop(); Net.send({ t: 'pen.shot', ax: P.aim.x + P.sway.x, az: P.aim.z + P.sway.z, power: P.power }); P.phase = 'wait'; P.t = 0; }
      return;
    }
    if (P.phase === 'wait') { taker.run = Math.min(1, P.t / 0.24); return; }
    if (P.phase === 'runup') {
      taker.run = Math.min(1, P.t / 1.1); const press = Input.consumeShootPress() | Input.consumeSkill() | Input.consumeSlide() | (Input.consumePassPress ? Input.consumePassPress() : false); Input.consumeShootRelease(); Input.consumePass();
      if (press && !P.dive && !P.netSent) { const mv = Input.move, l = Math.hypot(mv.x, mv.y); P.dive = l < 0.25 ? { dx: 0, dz: 1, td: P.t, v: PEN.PLAYER_DIVE } : { dx: mv.x / l, dz: -mv.y / l, td: P.t, v: PEN.PLAYER_DIVE }; P.netSent = true; Net.send({ t: 'pen.dive', dx: P.dive.dx, dz: P.dive.dz }); Sound.whoosh(true); }
      return;
    }
    if (P.phase === 'flight') { this.pose(gk, P.dive, P.t); if (P.t >= P.shot.T) this.netApply(m); return; }
    if (P.phase === 'after') this.pose(gk, P.dive, P.shot.T + P.t);
  },
  // ---------- the picture ----------
  layout(W, H) {
    const L = this._lay;
    if (L && L.W === W && L.H === H) return L;
    const portrait = W < H;
    const gw = portrait ? W * 0.84 : Math.min(W * 0.56, H * 1.2);
    const s = gw / (PEN.HW * 2), gh = PEN.HT * s;
    const gy = portrait ? H * 0.42 : Math.max(gh + H * 0.2, H * 0.52);
    const spot = { x: W / 2, y: portrait ? H * 0.74 : H * 0.86 };
    const near = portrait ? 1.9 : 2.0;
    const lay = { W, H, gw, gh, s, gx: W / 2, gy, spot, near, board: gh * 0.22, crowd: null };
    // the crowd behind the goal, placed once per screen size
    const rng = mulberry32(7), crowd = [];
    const rowH = Math.max(10, gh * 0.12), top = gy - lay.board;
    for (let y = top - rowH * 0.3, row = 0; y > -rowH; y -= rowH * 0.78, row++) {
      const size = rowH * Math.max(0.3, 0.5 - row * 0.012);
      for (let x = (row % 2) * size * 0.6 - size; x < W + size; x += size * 1.25 + rng() * size * 0.5) crowd.push({ x, y, size: Math.max(4, size), c: (rng() * 8) | 0, skin: (rng() * 4) | 0, ph: rng() * 6 });
    }
    lay.crowd = crowd;
    this._lay = lay;
    return lay;
  },

  // goal-plane metres -> screen
  gp(L, x, z) { return { x: L.gx + x * L.s, y: L.gy - z * L.s }; },

  draw(m, dt, t) {
    const ctx = Render.ctx, W = Render.W, H = Render.H, P = m.pens, L = this.layout(W, H);
    ctx.setTransform(Render.dpr, 0, 0, Render.dpr, 0, 0);
    const shake = P.shake > 0 ? P.shake * 18 : 0;
    ctx.save();
    if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    // the stands and pitch never change during a shootout: one picture, stamped each frame (the
    // crowd alone is thousands of shapes); a cheer bounces the crowd part of it
    const bg = this.backdrop(L);
    ctx.drawImage(bg, 0, 0, W, H);
    if (P.cheerT > 0) { const hop = Math.abs(Math.sin(t * 10)) * L.gh * 0.035, ch = L.gy - L.board; ctx.drawImage(bg, 0, 0, bg.width, ch * (bg.height / H), 0, -hop, W, ch); }
    const ball = this.ballPos(L, P);
    this.drawNet(ctx, L, P, ball);
    if (ball && ball.behind) this.drawBall(ctx, ball, t);
    this.drawFrame(ctx, L);
    this.drawKeeper(ctx, L, P, t);
    if (ball && !ball.behind && !ball.atSpot) this.drawBall(ctx, ball, t);
    if (ball && ball.atSpot) this.drawBall(ctx, ball, t);
    this.drawTaker(ctx, L, P, t);
    ctx.restore();
    this.drawOverlay(ctx, L, P, t);
  },

  backdrop(L) {
    const st = Save.stadium(), dpr = Render.dpr;
    const key = [st.id, TEAMS.blue.jersey, TEAMS.red.jersey, dpr, document.fonts ? document.fonts.status : ''].join('|');
    if (L.bg && L.bgKey === key) return L.bg;
    const c = document.createElement('canvas');
    c.width = Math.ceil(L.W * dpr); c.height = Math.ceil(L.H * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawStands(g, L, { cheerT: 0 }, 0);
    this.drawGrass(g, L);
    L.bg = c; L.bgKey = key;
    return c;
  },

  drawStands(ctx, L, P, t) {
    const st = Save.stadium();
    ctx.fillStyle = st.stands[0]; ctx.fillRect(0, 0, L.W, L.gy);
    const cols = [TEAMS.blue.jersey, TEAMS.red.jersey, '#ffffff', '#ffe14d', TEAMS.blue.jersey, '#ff8a1f', TEAMS.red.jersey, '#46d9ff'];
    const skins = ['#f2c29b', '#d99a6c', '#a86b43', '#6b4228'];
    const jump = P.cheerT > 0 ? 1 : 0;
    for (const f of L.crowd) {
      const hop = jump ? Math.abs(Math.sin(t * 9 + f.ph)) * f.size * 0.5 : Math.sin(t * 2 + f.ph) * f.size * 0.04;
      const y = f.y - hop;
      ctx.fillStyle = cols[f.c]; ctx.fillRect(f.x - f.size * 0.45, y, f.size * 0.9, f.size * 0.9);
      ctx.fillStyle = skins[f.skin]; ctx.beginPath(); ctx.arc(f.x, y - f.size * 0.2, f.size * 0.32, 0, Math.PI * 2); ctx.fill();
      if (jump && f.c % 3 === 0) { ctx.fillStyle = cols[f.c]; ctx.fillRect(f.x - f.size * 0.55, y - f.size * 0.75, f.size * 0.2, f.size * 0.5); }
    }
    // advertising boards along the goal line
    const by = L.gy - L.board;
    ctx.fillStyle = '#1b2a6b'; ctx.fillRect(0, by, L.W, L.board);
    ctx.fillStyle = OUTLINE; ctx.fillRect(0, by - 3, L.W, 3); ctx.fillRect(0, L.gy - 3, L.W, 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = L.board * 0.5, word = 'MINI STRIKERS';
    ctx.font = `900 ${fs}px "Lilita One", system-ui, sans-serif`;
    const step = ctx.measureText(word).width + fs * 2.2;
    for (let x = step / 2 - ((t * 20) % step); x < L.W + step; x += step) {
      ctx.fillStyle = '#ffe14d'; ctx.fillText(word, x, by + L.board / 2 + 1);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + step / 2, by + L.board / 2, fs * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  },

  drawGrass(ctx, L) {
    const st = Save.stadium(), g = st.grass;
    const a = g[0][0], b = g[1][0];
    let y = L.gy, i = 0, h = L.gh * 0.12;
    while (y < L.H) { ctx.fillStyle = i % 2 ? a : b; ctx.fillRect(0, y, L.W, h + 1); y += h; h *= 1.18; i++; }
    // the lines: goal line, the six-yard box, the spot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, L.gy - 1, L.W, Math.max(3, L.s * 0.08));
    const box = L.gy + (L.spot.y - L.gy) * 0.3, lw = Math.max(3, L.s * 0.09);
    const x1 = L.gx - L.gw * 0.78, x2 = L.gx + L.gw * 0.78, x1b = L.gx - L.gw * 0.86, x2b = L.gx + L.gw * 0.86;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lw; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(x1, L.gy); ctx.lineTo(x1b, box); ctx.lineTo(x2b, box); ctx.lineTo(x2, L.gy); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(L.spot.x, L.spot.y + L.s * L.near * 0.1, L.s * L.near * 0.16, L.s * L.near * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  },

  // the goal: net first (the ball can end up in it), then the frame over it
  drawNet(ctx, L, P, ball) {
    const x0 = L.gx - L.gw / 2, x1 = L.gx + L.gw / 2, top = L.gy - L.gh;
    const inset = L.gw * 0.05, back = { x0: x0 + inset, x1: x1 - inset, top: top + L.gh * 0.1 };
    ctx.fillStyle = 'rgba(22, 26, 51, 0.28)';
    ctx.fillRect(x0, top, L.gw, L.gh);
    // a goal pushes the net back around where it went in
    const hit = P.result && ball && ball.inNet ? { x: ball.hitX, y: ball.hitY, k: ball.bulge } : null;
    const bend = (x, y) => {
      if (!hit) return [x, y];
      const d = Math.hypot(x - hit.x, y - hit.y), r = L.gh * 0.55;
      if (d > r) return [x, y];
      const f = (1 - d / r) * 0.28 * hit.k;
      return [x + (hit.x - x) * f, y + (hit.y - y) * f];
    };
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = Math.max(1, L.s * 0.025);
    const cell = L.gw / 22;
    for (let x = back.x0; x <= back.x1 + 0.5; x += cell) {
      ctx.beginPath();
      for (let y = back.top; y <= L.gy + 0.5; y += cell / 2) { const [px, py] = bend(x, y); if (y === back.top) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
    }
    for (let y = back.top; y <= L.gy + 0.5; y += cell) {
      ctx.beginPath();
      for (let x = back.x0; x <= back.x1 + 0.5; x += cell / 2) { const [px, py] = bend(x, y); if (x === back.x0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
    }
    // side and roof netting
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const u = i / 4;
      ctx.moveTo(x0, top + L.gh * u); ctx.lineTo(back.x0, back.top + (L.gy - back.top) * u);
      ctx.moveTo(x1, top + L.gh * u); ctx.lineTo(back.x1, back.top + (L.gy - back.top) * u);
    }
    for (let i = 0; i <= 10; i++) { const u = i / 10; ctx.moveTo(x0 + L.gw * u, top); ctx.lineTo(back.x0 + (back.x1 - back.x0) * u, back.top); }
    ctx.stroke();
  },

  drawFrame(ctx, L) {
    const pw = Math.max(5, L.s * 0.12), x0 = L.gx - L.gw / 2, x1 = L.gx + L.gw / 2, top = L.gy - L.gh;
    const bar = (x, y, w, h) => {
      ctx.fillStyle = OUTLINE; ctx.fillRect(x + 3, y + 3, w, h); // hard shadow
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
    };
    bar(x0 - pw, top - pw, pw, L.gh + pw);
    bar(x1, top - pw, pw, L.gh + pw);
    bar(x0 - pw, top - pw, L.gw + pw * 2, pw);
  },

  drawKeeper(ctx, L, P, t) {
    if (P.noKeeper) return;
    const gk = this.goalie(P), k = (1.9 * L.s) / 68;
    const flying = P.phase === 'flight' || P.phase === 'after' || (P.net && P.phase === 'runup' && P.dive);
    const tt = P.phase === 'flight' ? P.t : P.phase === 'after' ? P.shot.T + P.t : P.phase === 'runup' ? P.t : 0;
    const K = flying && P.dive ? PEN.keeper(P.dive, 0, tt) : null;
    gk.fy = 1; gk.fx = 0; gk.faceX = 0.001;
    if (!K || (K.s <= 0 && P.dive && tt < P.dive.td)) {
      // ready on the line, bouncing on their toes
      gk.diveT = 0;
      const feet = this.gp(L, 0, 0);
      Sprites.player(ctx, gk, feet.x, feet.y - Math.abs(Math.sin(t * 5)) * L.s * 0.04, k, t);
      return;
    }
    // diving: hips where the model says, the body along its axis
    gk.diveT = 1;
    const side = P.dive.dx >= 0 ? 1 : -1;
    gk.diveDir = side * TEAMS[gk.team].dir;
    const hip = this.gp(L, K.p.x, K.p.z);
    const base = side * (Math.PI / 2.2);
    ctx.save();
    ctx.translate(hip.x, hip.y); ctx.rotate(K.phi - base); ctx.translate(-hip.x, -hip.y);
    Sprites.player(ctx, gk, hip.x, hip.y + 36 * k, k, t);
    ctx.restore();
  },

  // where the ball is on screen now: sitting on the spot, flying, in the net, gone wide, bouncing out
  ballPos(L, P) {
    const spotR = 0.11 * L.s * L.near;
    const atSpot = { x: L.spot.x, y: L.spot.y, r: spotR, atSpot: true, spin: 0 };
    if (!P.shot || P.phase === 'aim' || P.phase === 'ready' || P.phase === 'start' || P.phase === 'runup' || P.phase === 'strike') return P.phase === 'end' ? null : atSpot;
    const s = P.shot, g = this.gp(L, s.x, s.z), rg = 0.11 * L.s;
    if (P.phase === 'flight') {
      const u = clamp(P.t / s.T, 0, 1), k = 1.6, e = (u * (1 + k)) / (1 + k * u);
      return { x: lerp(L.spot.x, g.x, e), y: lerp(L.spot.y, g.y, e), r: 1 / lerp(1 / spotR, 1 / rg, u), spin: u * 12 };
    }
    if (P.phase !== 'after') return null;
    const a = P.t, res = P.result;
    if (res === 'goal' || res === 'postIn' || res === 'barIn') {
      // into the net, then it drops
      const u = clamp(a / 0.18, 0, 1), fall = clamp((a - 0.18) / 0.5, 0, 1);
      const bx = lerp(g.x, L.gx + (g.x - L.gx) * 0.9, u), by = lerp(g.y, g.y + L.gh * 0.08, u) + (L.gy - L.gh * 0.08 - g.y) * fall * fall * (fall > 0 ? 1 : 0);
      return { x: bx, y: Math.min(by, L.gy - rg * 0.9), r: rg * lerp(1, 0.9, u), behind: true, inNet: true, hitX: g.x, hitY: g.y, bulge: Math.max(0, 1 - Math.abs(a - 0.2) / 0.6), spin: 12 };
    }
    if (res === 'wide' || res === 'over') {
      const u = clamp(a / 0.4, 0, 1);
      if (u >= 1) return null;
      return { x: g.x + (g.x - L.spot.x) * u * 0.5, y: g.y + (g.y - L.spot.y) * u * 0.5, r: rg * (1 - u * 0.3), behind: true, spin: 12 + u * 6 };
    }
    if (res === 'save' && P.after.held) {
      const K = PEN.keeper(P.dive, 0, s.T + a), hand = this.gp(L, K.p.x + K.a.x * 1.2, K.p.z + K.a.z * 1.2);
      return { x: hand.x, y: hand.y, r: rg, spin: 12 };
    }
    // parried, or off the woodwork: back out towards us and bouncing
    const u = clamp(a / 0.9, 0, 1), side = res === 'save' ? P.after.side : -Math.sign(s.x) || 1;
    const x = g.x + side * L.gw * 0.35 * u + (res === 'post' ? -Math.sign(s.x) * L.gw * 0.15 * u : 0);
    const groundY = lerp(L.gy, L.spot.y, u * 0.7);
    const arc = Math.abs(Math.sin(u * Math.PI * 1.5)) * L.gh * 0.5 * (1 - u);
    return { x, y: lerp(g.y, groundY, Math.min(1, u * 2.2)) - arc, r: rg * lerp(1, 1.6, u), spin: 12 + u * 8 };
  },

  drawBall(ctx, bp, t) {
    const b = this._ballObj || (this._ballObj = { x: 0, y: 0, z: 0, vx: 1, vy: 0, roll: 0, shot: null, owner: null, skin: null });
    b.roll = bp.spin || 0;
    // a flat shadow on the grass under the ball on the spot
    Sprites.ball(ctx, b, bp.x, bp.y - bp.r, bp.r / CFG.BALL_R, t);
  },

  drawTaker(ctx, L, P, t) {
    const a = this.taker(P);
    if (!a) return;
    const k = ((1.9 * L.s) / 68) * L.near * 0.75, m = L.s * L.near;
    // standing back and to the left of the ball, then two steps into it
    const run = clamp(a.run || 0, 0, 1), smoothRun = run * run * (3 - 2 * run);
    const x = L.spot.x - m * lerp(0.95, 0.42, smoothRun), y = L.spot.y + m * lerp(0.55, 0.12, smoothRun);
    a.vx = run > 0 && run < 1 ? CFG.SPEED : 0; a.vy = 0;
    if (run > 0 && run < 1) a.runPhase = t * 12;
    if (a.kickT <= 0 && a.celebrateT <= 0 && P.phase !== 'after') { a.fy = -1; a.faceX = 0.001; }
    if (P.phase === 'after' && a.celebrateT <= 0 && !a.sad) { a.fy = -1; a.faceX = 0.001; }
    Sprites.player(ctx, a, x, y, k, t);
  },

  // the tally, the call, the aim, the power and what to press
  drawOverlay(ctx, L, P, t) {
    const W = L.W, H = L.H;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // tally: a row of five for each side (sudden death shows the latest)
    const chal = !!P.chal;
    const n = Math.max(5, P.kicks.blue.length, P.kicks.red.length), from = Math.max(0, n - 5);
    const dot = clamp(H * 0.028, 9, 15), gap = dot * 2.7, rowH = dot * 2.6;
    const pw = gap * 5 + dot * 7.5, ph = rowH * 2 + dot * 0.8, px = W / 2 - pw / 2, py = Math.max(8, Render.S ? 10 : 10);
    if (chal) SkillRun.drawPens(ctx, L, P, t);
    if (!chal) { ctx.fillStyle = OUTLINE; Sprites.rr(ctx, px + 3, py + 4, pw, ph, dot); ctx.fill();
    ctx.fillStyle = '#ffffff'; Sprites.rr(ctx, px, py, pw, ph, dot); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke(); }
    if (!chal) ['blue', 'red'].forEach((team, row) => {
      const cy = py + dot * 0.4 + rowH * (row + 0.5);
      const fcv = this.flag(team, dot * 3.2);
      if (fcv) ctx.drawImage(fcv, px + dot * 0.8, cy - dot * 1.07, dot * 3.2, dot * 2.13);
      Render.chunkyText(ctx, String(P.kicks[team].filter(Boolean).length), px + dot * 5.4, cy, dot * 1.9, team === 'blue' ? '#ffffff' : '#ffd0d3', 3);
      for (let i = 0; i < 5; i++) {
        const k = from + i, v = P.kicks[team][k], cx = px + dot * 7.6 + gap * i + dot;
        const nextUp = P.phase !== 'end' && P.team === team && k === P.kicks[team].length;
        ctx.beginPath(); ctx.arc(cx, cy, dot * (nextUp ? 1 + Math.sin(t * 8) * 0.12 : 1), 0, Math.PI * 2);
        ctx.fillStyle = v === true ? '#3fcf4a' : v === false ? '#ff3a3f' : nextUp ? '#ffe14d' : '#e4e7f5';
        ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, dot * 0.28); ctx.lineCap = 'round';
        if (v === true) { ctx.beginPath(); ctx.moveTo(cx - dot * 0.45, cy); ctx.lineTo(cx - dot * 0.1, cy + dot * 0.38); ctx.lineTo(cx + dot * 0.48, cy - dot * 0.36); ctx.stroke(); }
        if (v === false) { const e = dot * 0.4; ctx.beginPath(); ctx.moveTo(cx - e, cy - e); ctx.lineTo(cx + e, cy + e); ctx.moveTo(cx + e, cy - e); ctx.lineTo(cx - e, cy + e); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
    });
    const big = clamp(Math.min(W, H) * 0.11, 30, 76);
    const sub = clamp(big * 0.42, 14, 30);
    const cy = py + ph + sub * 1.1;
    // who's up
    if (P.phase === 'start' || P.phase === 'ready') {
      const u = clamp(P.t / 0.3, 0, 1), z = easeOut(u);
      ctx.save(); ctx.translate(W / 2, L.gy - L.gh * 0.55); ctx.scale(z, z);
      if (chal) Render.chunkyText(ctx, P.chal.id === 'targets' ? 'HIT A TARGET' : 'SAVE IT!', 0, 0, big, P.chal.id === 'targets' ? '#ffe14d' : '#46d9ff');
      else {
      if (P.phase === 'start') Render.chunkyText(ctx, P.first === 'blue' ? 'YOU KICK FIRST' : `${TEAMS.red.name} KICK FIRST`, 0, -big * 0.8, big * 0.55, '#ffffff');
      Render.chunkyText(ctx, this.sudden(P) && P.team === P.first ? 'SUDDEN DEATH' : P.team === 'blue' ? 'YOUR KICK' : 'SAVE IT!', 0, 0, big, P.team === 'blue' ? '#ffe14d' : '#46d9ff');
      }
      ctx.restore();
    } else if (P.phase !== 'after' && P.phase !== 'end' && this.sudden(P)) {
      Render.chunkyText(ctx, 'SUDDEN DEATH', W / 2, cy, sub, '#ff8a8e');
    }
    // your aim
    if (P.phase === 'aim') {
      const sw = P.sway || { x: 0, z: 0 };
      const c = this.gp(L, (P.aim.x + sw.x) * PEN.HW, (P.aim.z + sw.z) * PEN.HT);
      const r = Math.max(10, L.s * 0.3) * (1 + Math.sin(t * 7) * 0.06);
      ctx.lineWidth = 7; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = P.holding ? '#ffe14d' : '#ffffff';
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x - r * 1.5, c.y); ctx.lineTo(c.x - r * 0.5, c.y); ctx.moveTo(c.x + r * 0.5, c.y); ctx.lineTo(c.x + r * 1.5, c.y);
      ctx.moveTo(c.x, c.y - r * 1.5); ctx.lineTo(c.x, c.y - r * 0.5); ctx.moveTo(c.x, c.y + r * 0.5); ctx.lineTo(c.x, c.y + r * 1.5); ctx.stroke();
      // power: fills while you hold, the top bit (red) is too much
      const bw = Math.max(14, L.s * 0.32), bh = L.gh * 1.05, bx = Math.min(W - bw - 16, L.gx + L.gw / 2 + L.s * 0.6), by = L.gy - bh;
      ctx.fillStyle = OUTLINE; Sprites.rr(ctx, bx + 3, by + 3, bw, bh, bw / 2); ctx.fill();
      ctx.fillStyle = '#e4e7f5'; Sprites.rr(ctx, bx, by, bw, bh, bw / 2); ctx.fill();
      ctx.fillStyle = '#ffc9cb'; ctx.fillRect(bx + 2, by + 2, bw - 4, bh * 0.18);
      const fh = (bh - 4) * P.power;
      ctx.fillStyle = P.power > 0.82 ? '#ff3a3f' : P.power > 0.55 ? '#ffe14d' : '#3fcf4a';
      if (fh > 0) { Sprites.rr(ctx, bx + 2, by + bh - 2 - fh, bw - 4, fh, Math.min(bw / 2 - 2, fh / 2)); ctx.fill(); }
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; Sprites.rr(ctx, bx, by, bw, bh, bw / 2); ctx.stroke();
      Render.chunkyText(ctx, 'POWER', bx + bw / 2, by + bh + sub * 0.8, sub * 0.6, '#ffffff', 3);
      if (P.clock < 3.5) Render.chunkyText(ctx, String(Math.ceil(P.clock)), c.x, c.y - r * 2.4, sub * 1.1, '#ff8a8e');
    }
    // you in goal: where the stick points is where you'll go
    if ((P.phase === 'runup' || P.phase === 'flight') && P.team === 'red' && !P.dive) {
      const mv = Input.move, l = Math.hypot(mv.x, mv.y), hip = this.gp(L, 0, PEN.K.hip);
      if (l > 0.25) {
        const dx = mv.x / l, dy = mv.y / l, len = L.s * 1.6;
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hip.x + dx * L.s * 0.5, hip.y + dy * L.s * 0.5); ctx.lineTo(hip.x + dx * len, hip.y + dy * len); ctx.stroke();
        ctx.strokeStyle = '#46d9ff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(hip.x + dx * L.s * 0.5, hip.y + dy * L.s * 0.5); ctx.lineTo(hip.x + dx * len, hip.y + dy * len); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
    // the call
    if (P.say && P.phase === 'after') {
      const u = clamp(P.t / 0.25, 0, 1), z = easeOut(u) * (1 + Math.sin(P.t * 5) * 0.03);
      ctx.save(); ctx.translate(W / 2, L.gy - L.gh * 0.55); ctx.rotate(-0.04); ctx.scale(z, z);
      Render.chunkyText(ctx, P.say[0], 0, 0, big * (P.say[0].length > 8 ? 0.8 : 1), P.say[1]);
      ctx.restore();
    }
    if (P.phase === 'end' && !chal) {
      const u = clamp(P.t / 0.35, 0, 1), z = easeOut(u);
      ctx.save(); ctx.translate(W / 2, L.gy - L.gh * 0.5); ctx.scale(z, z);
      Render.chunkyText(ctx, P.winner === 'blue' ? 'YOU WIN THE SHOOTOUT!' : `${TEAMS.red.name} WIN IT`, 0, 0, big * 0.8, P.winner === 'blue' ? '#ffe14d' : '#ffffff');
      ctx.restore();
    }
    // what to press
    const kb = document.body.classList.contains('kb');
    let hint = null;
    if (P.phase === 'aim') hint = P.holding ? 'LET GO TO SHOOT' : kb ? 'AIM: WASD OR MOUSE  ·  HOLD SPACE OR CLICK FOR POWER' : 'AIM WITH THE STICK  ·  HOLD SHOOT FOR POWER';
    else if ((P.phase === 'runup' || P.phase === 'flight') && P.team === 'red' && !P.dive) hint = kb ? 'WATCH THE KICK  ·  WASD + SPACE TO DIVE' : 'WATCH THE KICK  ·  STICK + DIVE';
    if (hint) {
      const hs = clamp(Math.min(W, H) * 0.034, 12, 18);
      ctx.font = `900 ${hs}px "Lilita One", system-ui, sans-serif`;
      const w = ctx.measureText(hint).width + hs * 1.6, hy = kb ? H - hs * 2.2 : L.gy + (L.spot.y - L.gy) * 0.18;
      ctx.fillStyle = 'rgba(22, 26, 51, 0.78)'; Sprites.rr(ctx, W / 2 - w / 2, hy - hs, w, hs * 2, hs * 0.6); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillText(hint, W / 2, hy + 1);
    }
  },

  flag(team, w) {
    const club = team === 'blue' ? Clubs.home : Clubs.current;
    if (!club) return null;
    const key = club.id + ':' + Math.round(w);
    this._flags = this._flags || {};
    if (!this._flags[key]) {
      const cv = document.createElement('canvas'); cv.width = 48; cv.height = 32;
      UI.flagBadge(cv, club);
      this._flags[key] = cv;
    }
    return this._flags[key];
  },

  // mouse aiming on PC: point at the goal
  mouseAim(e) {
    const m = Game.match;
    if (!m || !m.pens || m.pens.phase !== 'aim' || e.pointerType !== 'mouse') return;
    const L = this.layout(Render.W, Render.H);
    const x = (e.clientX - L.gx) / L.s / PEN.HW, z = (L.gy - e.clientY) / L.s / PEN.HT;
    if (x < -1.6 || x > 1.6 || z < -0.4 || z > 1.8) return;
    m.pens.mouse = { x: clamp(x, -1.08, 1.08), z: clamp(z, 0.03, 1.1) };
  },
};
