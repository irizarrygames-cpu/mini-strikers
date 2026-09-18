// Online matches on this side of the wire: finding a match, private rooms, and turning
// server snapshots into the same match object the renderer and HUD already draw.
//
// The picture is always drawn from your side: if the server put you on the red team,
// everything is mirrored left-to-right so you still attack to the right in your
// club's colours. Other players are shown ~80ms in the past and smoothly interpolated;
// your own player is predicted from your stick so it answers instantly.

const NET_PHASES = ['kickoff', 'play', 'goal', 'reset', 'timeup', 'over', 'replay', 'cele'];
const NET_CELEBS = [null, ...CELEBRATIONS.map((c) => c.id), 'hype'];
const NET_TRAILS = [null, 'pass', 'weak', 'shot', 'strong', 'electric', 'fire', 'plasma', 'blast', 'frost', 'toxic', 'shadow', 'rainbow', 'golden'];
const NET_ULTS = ULT_KINDS;
const NET_TICK_MS = 1000 / 120;
const NET_DELAY_TICKS = 10;           // how far behind the newest snapshot other players are drawn
const NET_POS_FX = new Set(['text', 'burst', 'sparks', 'ring', 'stars']);

const Online = {
  m: null, mirror: false, you: -1, format: '2v2', status: 'idle', // idle | queue | room | match
  snaps: [], offset: null, seq: 0, sendT: 0, bits: 0, lastSent: null, inputs: [],
  pred: null, predOk: false, corr: { x: 0, y: 0 }, lastEnd: null, room: null, ballCorr: { x: 0, y: 0 }, ballPrev: null, busyCorr: null,
  lead: 0, localOwn: null, kick: null, kickSeq: 0, kickBlock: 0, kickT: 0, wBall: 0, pendingBurst: 0,

  init() {
    Net.on('queue', (m) => this.onQueue(m));
    Net.on('unqueued', () => { this.status = 'idle'; UI.hideQueue(); });
    Net.on('room', (m) => this.onRoom(m));
    Net.on('room.left', () => { this.status = 'idle'; this.room = null; UI.hideLobby(); });
    Net.on('start', (m) => this.start(m));
    Net.on('s', (m) => this.onSnapshot(m));
    Net.on('end', (m) => this.end(m));
    Net.on('left', () => {});
    Net.on('error', (m) => { UI.toast((m.msg || 'Something went wrong').toUpperCase()); if (this.status === 'queue') { this.status = 'idle'; UI.hideQueue(); } });
    Net.on('kicked', () => { this.abandon(); UI.toast('SIGNED IN ON ANOTHER DEVICE'); });
    Net.on('authLost', () => { this.abandon(); Net.forget(); UI.showAuth('Your session ended. Log in again.'); });
    Net.on('disconnected', () => { if (this.status === 'match') UI.toast('CONNECTION LOST · RECONNECTING…'); });
  },

  // ---------- finding a match ----------
  findMatch(format) {
    this.format = format;
    this.status = 'queue';
    UI.showQueue({ format });
    Net.whenReady({ t: 'queue', format });
  },
  cancelQueue() { Net.send({ t: 'unqueue' }); this.status = 'idle'; UI.hideQueue(); },
  onQueue() {},

  createRoom(format) { this.status = 'room'; Net.whenReady({ t: 'room.create', format }); },
  joinRoom(code) { this.status = 'room'; Net.whenReady({ t: 'room.join', code }); },
  onRoom(msg) { this.status = 'room'; this.room = msg; UI.showLobby(msg); },
  leaveRoom() { Net.send({ t: 'room.leave' }); this.status = 'idle'; this.room = null; UI.hideLobby(); },

  // ---------- match start ----------
  start(msg) {
    const resync = this.m && this.m.roomId === msg.room;
    this.status = 'match';
    this.mirror = msg.side === 'red';
    this.you = msg.you;
    this.format = msg.format;
    this.snaps = []; this.offset = null; this.inputs = []; this.bits = 0; this.pred = null; this.corr = { x: 0, y: 0 };
    this.ballCorr = { x: 0, y: 0 }; this.ballPrev = null; this.busyCorr = null;
    this.lead = 0; this.localOwn = null; this.kick = null; this.kickSeq = 0; this.kickBlock = 0; this.kickT = 0; this.wBall = 0; this.pendingBurst = 0;
    const flipTeam = (t) => (this.mirror ? (t === 'blue' ? 'red' : 'blue') : t);
    const mine = Clubs.get(msg.clubs[msg.side]), theirs = Clubs.get(msg.clubs[msg.side === 'blue' ? 'red' : 'blue']);
    Clubs.setMatch(mine, theirs);
    const players = msg.players.map((info, i) => {
      const p = new Player({ team: flipTeam(info.team), keeper: info.keeper, number: info.number, look: info.look, human: i === msg.you });
      p.name = info.name;
      if (i === msg.you) {
        const ch = CHARACTERS.find((c) => c.id === msg.character) || Save.character();
        p.attr = ratingAttr(ch.r);
        p.rarity = ch.rarity;
      }
      return p;
    });
    const keepers = {};
    for (const p of players) if (p.isKeeper) keepers[p.team] = p;
    const m = {
      net: true, online: true, roomId: msg.room, code: msg.code, players, ball: new Ball(), human: players[msg.you], humans: [players[msg.you]], keepers,
      teamHuman: { blue: true, red: false }, score: { blue: 0, red: 0 }, meter: { blue: 0, red: 0 }, poss: { blue: 0, red: 0 },
      stats: { blue: {}, red: {} }, duration: msg.minutes * 60, time: msg.minutes * 60, overtime: false, otTime: 0,
      phase: 'kickoff', phaseT: 0, clock: 0, format: msg.format, mode: 'online', club: theirs, home: mine, goals: [], flags: {},
      challenges: null, timeScale: 1, demo: false, replay: null, rec: null, humanRarity: players[msg.you].rarity, events: null,
    };
    this.m = m;
    Game.match = m;
    Game.acc = 0;
    FX.clear(); Input.reset();
    UI._lastTime = null; UI._lastMeter = null; UI._mode = null; UI._cd = null; UI._st = null; UI._rep = null;
    const fromQueue = !$('queue').hidden;
    UI.closeAll(); UI.hideQueue(); UI.hideLobby();
    UI.show('match');
    if (fromQueue) Sound.powerReady();
    Render.updateCamera(m, 0, true);
    if (resync || msg.startsIn <= 0) {
      Game.state = 'match';
    } else {
      Game.state = 'intro';
      UI.showIntro(m, msg.startsIn);
      Sound.cheer(false);
    }
    Sound.startMusic(); Sound.startAmbience();
  },

  // leave a live match (counts as a loss) and go home
  quit() {
    if (this.status === 'match') Net.send({ t: 'leave' });
    this.abandon();
    if (Game.state !== 'home') Game.goHome();
  },
  abandon() {
    this.status = 'idle'; this.m = null; this.snaps = []; this.room = null;
    UI.hideQueue(); UI.hideLobby();
    if (Game.match && Game.match.net) Game.goHome();
  },

  // ---------- snapshots ----------
  onSnapshot(msg) {
    const m = this.m;
    if (!m || this.status !== 'match') return;
    const W = CFG.FIELD_W, s = this.mirror ? -1 : 1;
    const X = (x) => (this.mirror ? W - x : x);
    const now = performance.now();
    const snap = {
      k: msg.k, at: now, phase: NET_PHASES[msg.ph] || 'play', phaseT: msg.pt / 100, time: msg.tm / 10, ot: msg.ot,
      score: this.mirror ? { blue: msg.sc[1], red: msg.sc[0] } : { blue: msg.sc[0], red: msg.sc[1] },
      meter: this.mirror ? { blue: msg.mt[1], red: msg.mt[0] } : { blue: msg.mt[0], red: msg.mt[1] },
      ts: msg.ts / 100, me: msg.me, fired: false,
      p: msg.p.map((r) => ({
        x: X(r[0]), y: r[1], vx: s * r[2], vy: r[3], fx: s * r[4] / 100, fy: r[5] / 100, faceX: s * r[6] / 100, flags: r[7],
        kickT: r[8] / 100, kickDur: r[9] / 100 || 0.2, stunT: r[10] / 100, recoverT: r[11] / 100, diveT: r[12] / 100, diveDir: r[13],
        celebrateT: r[14] / 100, celebKind: NET_CELEBS[r[15]], slideT: r[16] / 100, slideWindT: r[17] / 100, sdx: s * r[18] / 100, sdy: r[19] / 100,
        fallT: r[20] / 100, hopT: r[21] / 100,
        ultFlags: r[22] || 0, ultKind: NET_ULTS[r[23] || 0], ultShotT: (r[24] || 0) / 100,
      })),
      b: (() => {
        const r = msg.b;
        const shotTeam = r[10] ? 'red' : 'blue';
        return { x: X(r[0]), y: r[1], z: r[2], vx: s * r[3], vy: r[4], vz: r[5], owner: r[6], trailType: NET_TRAILS[r[7]], level: r[8], power: r[9],
          team: this.mirror ? (shotTeam === 'blue' ? 'red' : 'blue') : shotTeam, bl: (this.mirror ? r[12] : r[11]) / 100, br: (this.mirror ? r[11] : r[12]) / 100 };
      })(),
      ev: msg.ev.map((e) => this.flipEvent(e)),
    };
    // clock: the earliest a tick could have arrived is our best guess at "now" on the server
    const est = now - msg.k * NET_TICK_MS;
    if (this.offset === null || est < this.offset) this.offset = est;
    else this.offset += Math.min(est - this.offset, 2) * 0.02; // drift up slowly if the network got slower
    this.snaps.push(snap);
    if (this.snaps.length > 40) {
      // a long stall (hidden tab, slow phone) can push snapshots out before they were shown: still play goals and celebrations
      const old = this.snaps.shift();
      if (!old.fired) { old.fired = true; for (const e of old.ev) if (e.e === 'goal' || e.e === 'cele') this.playEvent(e); }
    }
    if (Game.state === 'intro') { $('intro').hidden = true; Game.state = 'match'; }
    this.reconcile(snap);
  },

  flipEvent(e) {
    if (!this.mirror) return e;
    const W = CFG.FIELD_W;
    if (e.e === 'f' && NET_POS_FX.has(e.n) && e.a.length) { const a = e.a.slice(); a[0] = W - a[0]; return { ...e, a }; }
    if (e.e === 'goal') return { ...e, team: e.team === 'blue' ? 'red' : 'blue', x: W - e.x };
    return e;
  },

  // ---------- every frame ----------
  update(dt) {
    const m = this.m;
    if (!m) return;
    this.sendInput(dt);
    if (!this.snaps.length) return;
    const renderTick = (performance.now() - this.offset) / NET_TICK_MS - NET_DELAY_TICKS;
    let a = this.snaps[0], b = a;
    for (let i = 0; i < this.snaps.length; i++) {
      if (this.snaps[i].k <= renderTick) { a = this.snaps[i]; b = this.snaps[Math.min(i + 1, this.snaps.length - 1)]; }
    }
    if (renderTick < this.snaps[0].k) { a = b = this.snaps[0]; }
    const u = b.k > a.k ? clamp((renderTick - a.k) / (b.k - a.k), 0, 1) : 0;
    const cur = u < 0.5 ? a : b;
    // events fire as the picture reaches them, so sounds line up with what you see
    for (const snap of this.snaps) {
      if (snap.fired || snap.k > renderTick) continue;
      snap.fired = true;
      for (const e of snap.ev) this.playEvent(e);
    }

    m.phase = cur.phase; m.phaseT = lerp(a.phaseT, b.phaseT, u); m.time = lerp(a.time, b.time, u);
    // the cutscene starting clears the big GOAL! banner so it never covers the celebration
    if (m.phase === 'cele' && this._lastPhase !== 'cele') FX.banner = null;
    this._lastPhase = m.phase;
    m.overtime = cur.ot >= 0; m.otTime = Math.max(0, cur.ot);
    m.score = cur.score; m.meter = cur.meter; m.timeScale = cur.ts;
    const me = m.human;
    m.players.forEach((p, i) => {
      const A = a.p[i], B = b.p[i];
      if (!A || !B) return;
      if (p === me && this.pred) return;
      this.applyPlayer(p, A, B, u, dt);
    });
    this.updateMe(a, b, u, dt);

    // ball. Everyone else is drawn a little in the past, but YOU are drawn ahead (prediction), so the
    // ball has two clocks to live on:
    //  - yours, whenever it's yours or loose near you: "you have it" comes from the newest snapshot,
    //    touching a loose ball picks it up at once (the server confirms a moment later), a pass or shot
    //    leaves your feet the moment you let go, and a loose ball near you is run forward with the
    //    game's own ball physics to where it will be when your stick gets there. So you never chase a
    //    ball that's really further back, run through it, or wait for your own kick.
    //  - theirs, when someone else has it or it's near them, so their touches line up with the ball.
    // Loose balls blend between the two by who is closer. Any jump left over (a correction, a switch)
    // is folded into an offset that fades, so the ball never teleports.
    const ball = m.ball, A = a.b, B = b.b, latest = this.snaps[this.snaps.length - 1];
    const ownR = cur.b.owner >= 0 ? m.players[cur.b.owner] : null, ownL = latest.b.owner >= 0 ? m.players[latest.b.owner] : null;
    const play = m.phase === 'play', wait = Math.max(0.22, (Net.rtt || 0) / 1000 + 0.15);
    const count = (k) => { if (this.dbg) this.dbg[k] = (this.dbg[k] || 0) + 1; };
    if (this.kickBlock > 0) this.kickBlock -= dt;
    // until the server has your last kick or skill, its "you have the ball" is from before it
    const fresh = !(latest.me && latest.me[0] < this.kickSeq);
    // a pick-up you made on your screen: the server agrees, someone beat you to it, or it never came
    const lo = this.localOwn;
    if (lo) {
      lo.t += dt;
      const why = ownL === me && fresh ? 'ok' : ownL && ownL !== me ? 'other' : lo.t > wait ? 'late' : !play || !this.predOk ? 'off' : null;
      if (why) { this.localOwn = null; count('pickup_' + why); }
    }
    // your pass/shot in flight on your screen: fly it until the server has your kick (its ack covers the
    // input that carried it) and its ball is loose, then hand over. Still at your feet well after that
    // means the server didn't kick it (you'd lost it first): let it go.
    let kp = this.kick;
    if (kp) {
      kp.t += dt;
      this.stepBall(kp, dt);
      const seen = latest.me && latest.me[0] >= kp.seq;
      const why = !play || !this.predOk || (ownL && ownL !== me) || kp.t > 2 ? 'off' : seen && ownL === me && kp.t > wait ? 'late' : null;
      if (why) { this.kick = kp = null; count('kick_' + why); }
      else if (seen && !ownL) kp.hand += dt;
    }
    if (kp && kp.kind === 'skill' && this.kickBlock <= 0 && this.predOk && this.pred && kp.z < 24 &&
      Math.hypot(kp.x - this.pred.x, kp.y - this.pred.y) < me.r + CFG.BALL_R + 5 && !m.players.some((p) => p !== me && Math.hypot(kp.x - p.x, kp.y - p.y) < 60)) {
      this.kick = kp = null; this.localOwn = { t: 0 }; count('pickup_start');
    }
    const mine = !kp && ((ownL === me && fresh) || !!this.localOwn);
    let tx, ty, tz, tvx, tvy, f = null;
    const rx = lerp(A.x, B.x, u), ry = lerp(A.y, B.y, u), rz = lerp(A.z, B.z, u);
    if (kp) {
      ball.owner = null; this.wBall = 1;
      tx = kp.x; ty = kp.y; tz = kp.z; tvx = kp.vx; tvy = kp.vy;
      if (kp.hand > 0 && this.predOk) {
        f = this.advanceBall(latest.b, Math.min(0.5, this.lead));
        const h = clamp(kp.hand / 0.2, 0, 1);
        tx = lerp(kp.x, f.x, h); ty = lerp(kp.y, f.y, h); tz = lerp(kp.z, f.z, h); tvx = lerp(kp.vx, f.vx, h); tvy = lerp(kp.vy, f.vy, h);
        if (h >= 1) { this.kick = null; count('kick_ok'); }
      }
    } else if (mine) {
      const off = me.r + CFG.BALL_R + 4 + Math.min(1, Math.hypot(me.vx, me.vy) / CFG.SPEED) * 7;
      tx = me.x + me.fx * off; ty = me.y + me.fy * off; tvx = me.vx; tvy = me.vy;
      tz = me.hopT > 0 ? Math.sin((1 - me.hopT / 0.42) * Math.PI) * 20 : 0;
      ball.owner = me; this.wBall = 1;
    } else if ((ownR && ownR !== me) || (ownL && ownL !== me)) {
      // someone else has it (or is about to, on their clock): with them
      tx = rx; ty = ry; tz = rz; tvx = B.vx; tvy = B.vy;
      ball.owner = ownR && ownR !== me ? ownR : null;
    } else {
      // loose: where it is on their clock, and where it'll be on yours
      ball.owner = null;
      f = this.predOk && play ? this.advanceBall(latest.b, Math.min(0.5, this.lead)) : null;
      let wT = 0;
      if (f) {
        const dMe = Math.hypot(f.x - me.x, f.y - me.y);
        let dO = 1e9;
        for (const p of m.players) if (p !== me) dO = Math.min(dO, Math.hypot(rx - p.x, ry - p.y));
        // right next to you it's always on your clock; further out, whoever is closer decides
        // (the delayed copy still at your feet means your own kick is in flight: that's all yours)
        wT = ownR === me ? 1 : Math.max(clamp(0.5 + (dO - dMe) / 300, 0, 1), clamp((120 - dMe) / 60, 0, 1));
      }
      const w = this.wBall = f ? this.wBall + (wT - this.wBall) * (1 - Math.exp(-(wT > this.wBall ? 14 : 8) * dt)) : 0;
      tx = f ? lerp(rx, f.x, w) : rx; ty = f ? lerp(ry, f.y, w) : ry; tz = f ? lerp(rz, f.z, w) : rz;
      tvx = f ? lerp(B.vx, f.vx, w) : B.vx; tvy = f ? lerp(B.vy, f.vy, w) : B.vy;
    }
    const bc = this.ballCorr, prev = this.ballPrev;
    if (prev && m.phase === 'play' && prev.phase === 'play') {
      // how far the target moved beyond its own speed this frame = a jump to hide
      const moved = Math.hypot(tx - prev.tx, ty - prev.ty), allowed = Math.hypot(tvx, tvy) * dt * 1.5 + 8;
      if (moved > allowed && moved < 700) { bc.x += prev.tx - tx; bc.y += prev.ty - ty; }
      const fade = Math.exp(-12 * dt);
      bc.x *= fade; bc.y *= fade;
      if (Math.hypot(bc.x, bc.y) > 400) { bc.x = 0; bc.y = 0; }
    } else { bc.x = 0; bc.y = 0; }
    this.ballPrev = { tx, ty, phase: m.phase };
    ball.x = tx + bc.x; ball.y = ty + bc.y; ball.z = tz;
    ball.vx = tvx; ball.vy = tvy; ball.vz = kp ? kp.vz : B.vz;
    // touching a loose ball is a pick-up right away on your screen, by the server's own rules (in reach,
    // low enough, slow enough, you're free to take it), judged on the ball on your clock and where the
    // server will have you, not the smoothed picture. Only when nobody else could get there first:
    // anyone who could reach the ball's path between the newest snapshot and now might take it on the
    // server, so then we wait for its word.
    const S = latest.p[this.you];
    if (f && !kp && !mine && !ball.owner && play && this.predOk && this.pred && this.wBall > 0.5 && this.kickBlock <= 0 && S && S.recoverT <= 0) {
      const reach = me.r + CFG.BALL_R + 5, d = Math.hypot(f.x - this.pred.x, f.y - this.pred.y);
      const L = latest.b, sx = f.x - L.x, sy = f.y - L.y, s2 = sx * sx + sy * sy || 1;
      const rival = () => latest.p.some((P, i) => {
        if (i === this.you) return false;
        const k = clamp(((P.x - L.x) * sx + (P.y - L.y) * sy) / s2, 0, 1);
        const gap = Math.hypot(L.x + sx * k - P.x, L.y + sy * k - P.y);
        return gap < reach + 20 + CFG.SPEED * 1.2 * this.lead * k + (m.players[i].isKeeper ? 30 : 0);
      });
      if (d < reach && f.z < 24 && Math.hypot(f.vx, f.vy) <= CFG.CONTROL_MAX && !rival()) { this.localOwn = { t: 0 }; count('pickup_start'); }
    }
    const bs = kp || (this.wBall > 0.5 ? latest.b : cur.b); // the look (trail, shot) from whichever clock it's on
    if (bs.trailType) ball.trailType = bs.trailType;
    ball.shot = bs.level >= 0 ? { level: bs.level, power: !!bs.power, team: kp ? 'blue' : bs.team } : null;
    ball.netBulge.left = lerp(A.bl, B.bl, u); ball.netBulge.right = lerp(A.br, B.br, u);
    ball.roll += Math.hypot(ball.vx, ball.vy) * dt / CFG.BALL_R;
    this.trail(ball, dt, !!bs.trailType);
    this.cosmetics(m, dt);
    const cheer = Math.min(ball.x, CFG.FIELD_W - ball.x) < 600 && m.phase === 'play';
    if (cheer !== this._excite) { this._excite = cheer; Sound.setExcitement(cheer ? 1 : 0); }
  },

  // a loose ball `t` seconds on, moved exactly the way the server moves it (gravity, bounces, grass,
  // air, boards). Curl and ult homing aren't sent, so those bend a little late and get smoothed.
  advanceBall(s, t) {
    return this.stepBall({ x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz }, t);
  },
  stepBall(b, t) {
    for (let left = t; left > 1e-4;) {
      const dt = Math.min(CFG.STEP, left); left -= dt;
      const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 6)), h = dt / n;
      for (let i = 0; i < n; i++) {
        if (b.spinT > 0) { b.vx += b.spinX * h; b.vy += b.spinY * h; b.spinT -= h; }
        if (b.z > 0 || b.vz > 0) {
          b.vz -= CFG.GRAVITY * h; b.z += b.vz * h;
          if (b.z <= 0) { b.z = 0; b.vz = b.vz < -110 ? -b.vz * CFG.BALL_BOUNCE : 0; }
        }
        const damp = Math.exp(-(b.z > 0.5 ? CFG.BALL_AIR_DRAG : CFG.BALL_FRICTION) * h);
        b.vx *= damp; b.vy *= damp;
        if (b.z <= 0.5) {
          const sp = Math.hypot(b.vx, b.vy);
          if (sp < 45 * h + 0.5) { b.vx = 0; b.vy = 0; } else { const f = (sp - 45 * h) / sp; b.vx *= f; b.vy *= f; }
        }
        b.x += b.vx * h; b.y += b.vy * h;
        const hit = collideWalls(b, CFG.BALL_R, CFG.WALL_BOUNCE);
        if (hit.hit > 0 && hit.net) { b.vx *= 0.3; b.vy *= 0.3; }
      }
    }
    return b;
  },

  // Your pass or shot leaves your feet the moment you let go: the very same pass/shot code the server
  // runs, on a scratch copy of the pitch as you see it (sounds and sparks still come from the server's
  // own kick). The server's ball takes over as soon as it arrives. Ult shots are left to the server.
  predictKick(kind, charge) {
    const m = this.m, me = m.human, mv = Input.move;
    if (kind !== 'skill') { this.kickBlock = 0.45; this.localOwn = null; }
    if (!this.predOk || me.ultOn || m.phase !== 'play' || m.ball.owner !== me) return;
    const clone = (q) => { const c = Object.assign(Object.create(Object.getPrototypeOf(q)), q); c.stats = { ...q.stats }; return c; };
    const p = clone(me);
    p.charging = false; p.passCharging = false; p.skill = null;
    p.skillCd = Math.max(0, me.skillCd - this.lead); // (the cooldown you last heard of has run on since)
    const sb = new Ball();
    sb.x = m.ball.x; sb.y = m.ball.y; sb.owner = p;
    // everyone else as copies too: a nutmeg stuns the one you go through
    const sm = { ...m, players: m.players.map((q) => (q === me ? p : clone(q))), ball: sb, meter: { ...m.meter }, stats: { blue: {}, red: {} }, shotId: 0, flags: {} };
    const mag = Math.hypot(mv.x, mv.y);
    const ok = this.quietly(() => (kind === 'shot' ? performShot(sm, p, charge, mv.y)
      : kind === 'pass' ? performPass(sm, p, mag > 0.1 ? mv.x : p.fx, mag > 0.1 ? mv.y : p.fy, null, charge)
      : performSkill(sm, p, mv.x, mv.y)));
    if (!ok) return;
    // a burst (skill) starts now on your screen: the next inputs carry it until the server has it
    if (kind === 'skill' && p.burstT > 0) { this.pendingBurst = p.burstT; if (this.pred) this.pred.burstT = p.burstT; }
    if (sb.owner) return; // hop, spin, cruyff: the ball stays with you
    this.kickSeq = this.seq + 1;
    if (kind === 'skill') { this.kickBlock = p.noPickupT + 0.02; this.localOwn = null; }
    me.fx = p.fx; me.fy = p.fy; this.kickT = p.kickT; // you face the ball you just hit, as on the server
    this.kick = { kind, t: 0, hand: 0, seq: this.seq + 1, x: sb.x, y: sb.y, z: sb.z, vx: sb.vx, vy: sb.vy, vz: sb.vz, spinX: sb.spinX, spinY: sb.spinY, spinT: sb.spinT,
      trailType: sb.trailType, level: sb.shot ? sb.shot.level : -1, power: !!(sb.shot && sb.shot.power) };
    if (this.dbg) this.dbg.kick_start = (this.dbg.kick_start || 0) + 1; // (tools/ballscan.js counts these)
  },
  // run game code without its sounds and particles
  quietly(fn) {
    const saved = [];
    for (const o of [Sound, FX]) for (const k of Object.keys(o)) if (typeof o[k] === 'function') { saved.push([o, k, o[k]]); o[k] = () => {}; }
    try { return fn(); } catch (e) { return false; } finally { for (const [o, k, v] of saved) o[k] = v; }
  },

  applyPlayer(p, A, B, u, dt) {
    p.x = lerp(A.x, B.x, u); p.y = lerp(A.y, B.y, u);
    p.vx = lerp(A.vx, B.vx, u); p.vy = lerp(A.vy, B.vy, u);
    p.fx = u < 0.5 ? A.fx : B.fx; p.fy = u < 0.5 ? A.fy : B.fy;
    p.faceX = lerp(A.faceX, B.faceX, u);
    const S = u < 0.5 ? A : B;
    p.kickT = lerp(A.kickT, B.kickT, u); p.kickDur = S.kickDur;
    p.stunT = S.stunT; p.recoverT = S.recoverT; p.diveT = S.diveT; p.diveDir = S.diveDir;
    p.celebrateT = S.celebrateT; p.celebKind = S.celebKind;
    p.slideT = S.slideT; p.slideWindT = S.slideWindT; p.fallT = S.fallT; p.hopT = lerp(A.hopT, B.hopT, u);
    p.slideDirX = S.sdx; p.slideDirY = S.sdy; p.slideWindX = S.sdx; p.slideWindY = S.sdy;
    p.sad = !!(S.flags & 1); p.slideHit = !!(S.flags & 2); p.sprintOn = !!(S.flags & 4);
    p.ultOn = !!(S.ultFlags & 1);
    p.ultShot = S.ultFlags & 2 ? { kind: S.ultKind, t: S.ultShotT, dur: 0.8 } : null;
    if (p !== this.m.human) p.charging = !!(S.flags & 8);
    p.runPhase += Math.hypot(p.vx, p.vy) * dt * 0.075;
  },

  // ---------- your own player ----------
  sendInput(dt) {
    const m = this.m;
    if (Game.state === 'paused') { Input.move.x = 0; Input.move.y = 0; }
    const s = this.mirror ? -1 : 1;
    const mv = Input.move;
    if (Input.consumePassPress()) { this.bits |= 32; m.human.passCharging = true; m.human.passChargeT = 0; }
    if (Input.consumePass()) {
      const charge = m.human.passCharging ? m.human.passChargeT : 0;
      this.bits |= 1; m.human.passCharging = false; m.human.passChargeT = 0;
      this.predictKick('pass', charge);
    }
    if (m.human.passCharging) m.human.passChargeT = Math.min(CFG.PASS_CHARGE_FULL, m.human.passChargeT + dt);
    if (Input.consumeUlt && Input.consumeUlt()) this.bits |= 64;
    if (Input.consumeSkill()) { this.bits |= 2; this.predictKick('skill'); }
    if (Input.consumeSlide()) this.bits |= 4;
    if (Input.consumeShootPress()) { this.bits |= 8; m.human.charging = true; m.human.chargeT = 0; Sound.chargeStart(); }
    if (Input.consumeShootRelease()) { this.bits |= 16; if (m.human.charging) { m.human.charging = false; Sound.chargeStop(); this.predictKick('shot', m.human.chargeT); } }
    if (m.human.charging) {
      m.human.chargeT += dt;
      if (m.human.chargeT >= CFG.CHARGE_AUTO) { m.human.charging = false; Sound.chargeStop(); this.predictKick('shot', m.human.chargeT); }
    }
    const x = +(mv.x * s).toFixed(2), y = +mv.y.toFixed(2), sp = Input.sprintHeld ? 1 : 0;
    this.sendT -= dt;
    const changed = !this.lastSent || Math.abs(x - this.lastSent.x) > 0.08 || Math.abs(y - this.lastSent.y) > 0.08 || sp !== this.lastSent.sp;
    const seqNow = this.seq + 1;
    this.inputs.push({ seq: seqNow, dt, x: mv.x, y: mv.y, sp, burst: this.pendingBurst });
    this.pendingBurst = 0;
    if (this.inputs.length > 240) this.inputs.shift();
    if (this.bits || (changed && this.sendT <= 1 / 60) || this.sendT <= 0) {
      if (this.bits & (1 | 16)) { this.kickBlock = 0.45; this.localOwn = null; }
      this.seq = seqNow;
      Net.send({ t: 'i', s: this.seq, x, y, sp, a: this.bits });
      this.bits = 0; this.sendT = 1 / 30; this.lastSent = { x, y, sp };
    }
  },

  // a new snapshot: restart prediction from the server's word plus inputs it hasn't seen yet
  reconcile(snap) {
    const m = this.m, me = m.human, S = snap.p[this.you];
    if (!S || !snap.me) return;
    const [ack, skillCd, slideCd, stamina, exhausted, charging, chargeT, , burstT, ult] = snap.me;
    me.ult = ult || 0;
    me.skillCd = skillCd / 100; me.slideCd = slideCd / 100; me.stamina = stamina / 100; me.exhausted = !!exhausted;
    if (!charging && me.charging && me.chargeT > 0.25) { me.charging = false; Sound.chargeStop(); }
    if (charging) { me.charging = true; me.chargeT = Math.max(me.chargeT, chargeT / 100); }
    this.inputs = this.inputs.filter((i) => i.seq > ack);
    // the server is moving you itself (lunge, spin, dive, trip, celebration, restart): follow it
    const busy = S.slideT > 0 || S.slideWindT > 0 || (S.flags & 16) || (S.ultFlags & 2) || S.fallT > 0 || S.stunT > 0.2 || S.celebrateT > 0 || snap.phase !== 'play';
    this.predOk = !busy;
    if (busy) return;
    const p = { x: S.x, y: S.y, vx: S.vx, vy: S.vy, r: me.r, stamina: me.stamina, exhausted: me.exhausted, burstT: (burstT || 0) / 100 };
    const hasBall = (snap.b.owner === this.you && !this.kick) || !!this.localOwn;
    let lead = 0;
    for (const inp of this.inputs) { if (inp.burst) p.burstT = inp.burst; this.predictStep(p, inp, inp.dt, hasBall, S); lead += inp.dt; }
    this.lead = lead;
    // small disagreements are folded into an offset that fades out, so corrections never pop
    if (this.pred && this.predOk) {
      this.corr.x += this.pred.x - p.x; this.corr.y += this.pred.y - p.y;
      // a big miss (a skill, a tackle, a laggy connection) glides too; only an absurd one is capped.
      // (It used to reset to zero past 120, which drew your player jumping ~120 units in one frame.)
      const c = Math.hypot(this.corr.x, this.corr.y);
      if (c > 300) { this.corr.x *= 300 / c; this.corr.y *= 300 / c; }
    }
    this.pred = p;
  },

  predictStep(p, inp, dt, hasBall, S) {
    const me = this.m.human;
    const mag = Math.hypot(inp.x, inp.y);
    const mx = mag > 0.01 ? inp.x / mag : 0, my = mag > 0.01 ? inp.y / mag : 0;
    let max = hasBall ? CFG.SPEED_WITH_BALL : CFG.SPEED;
    if (me.charging && hasBall) max *= 0.86;
    if (S.recoverT > 0) max = 0;
    const speed = Math.hypot(p.vx, p.vy);
    if (p.burstT > 0) { max *= 1.35; p.burstT -= dt; } // a skill burst, as the server runs it
    else if (inp.sp && !p.exhausted && speed > 60) max *= hasBall ? SPRINT.ballMul : SPRINT.mul;
    max *= me.attr.speed;
    const tx = mx * Math.min(1, mag) * max, ty = my * Math.min(1, mag) * max;
    const k = 1 - Math.exp(-(mx === 0 && my === 0 ? CFG.HUMAN_DECEL : CFG.HUMAN_ACCEL) * dt);
    p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    collideWalls(p, p.r, 0);
  },

  updateMe(a, b, u, dt) {
    const m = this.m, me = m.human, A = a.p[this.you], B = b.p[this.you];
    if (!A || !B) return;
    // keep the prediction rolling forward between snapshots with the stick you're holding now
    if (this.pred && this.predOk) {
      const latest = this.snaps[this.snaps.length - 1];
      this.predictStep(this.pred, { x: Input.move.x, y: Input.move.y, sp: Input.sprintHeld ? 1 : 0 }, dt, (latest.b.owner === this.you && !this.kick) || !!this.localOwn, latest.p[this.you]);
      this.lead += dt;
    }
    const shown = { x: me.x, y: me.y, fx: me.fx, fy: me.fy, faceX: me.faceX };
    this.applyPlayer(me, A, B, u, dt);
    if (this.pred && this.predOk) {
      this.busyCorr = null;
      me.fx = shown.fx; me.fy = shown.fy; me.faceX = shown.faceX; // facing follows your stick, not the server's lagging copy
      const fade = Math.exp(-(Math.hypot(this.corr.x, this.corr.y) > 60 ? 16 : 9) * dt); // big corrections settle faster
      this.corr.x *= fade; this.corr.y *= fade;
      // coming out of a server-driven move: start the prediction from where you are drawn and let the
      // gap fade like any other correction (a timed glide used to snap the last bit when it ran out)
      if (!this._wasPred) {
        this.corr.x = shown.x - this.pred.x; this.corr.y = shown.y - this.pred.y;
        const c = Math.hypot(this.corr.x, this.corr.y);
        if (c > 300) { this.corr.x *= 300 / c; this.corr.y *= 300 / c; }
        this._wasPred = true;
      }
      me.x = this.pred.x + this.corr.x; me.y = this.pred.y + this.corr.y;
      me.vx = this.pred.vx; me.vy = this.pred.vy;
      // facing turns exactly the way the server turns you (a pass or shot you just hit, or skills
      // decide the direction, so it has to agree): toward the stick, else where you're running, else the ball
      const sp = Math.hypot(me.vx, me.vy), mv = Input.move;
      if (this.kickT > 0) this.kickT -= dt;
      else if (mv.x || mv.y) turnToward(me, mv.x, mv.y, 22 * dt);
      else if (sp > 25) turnToward(me, me.vx / sp, me.vy / sp, 22 * dt);
      else { const bx = m.ball.x - me.x, by = m.ball.y - me.y, l = Math.hypot(bx, by) || 1; turnToward(me, bx / l, by / l, 22 * dt); }
      if (Math.abs(me.fx) > 0.12) me.faceX += (Math.sign(me.fx) - me.faceX) * (1 - Math.exp(-18 * dt));
    } else {
      // the server is moving you (spin, tackle, fall): follow its copy, but keep the gap you had
      // when it started and let it fade, instead of sliding back to where the delayed copy is
      if (m.phase !== 'play') this.busyCorr = null;
      else if (!this.busyCorr) this.busyCorr = { x: shown.x - me.x, y: shown.y - me.y };
      const c = this.busyCorr;
      if (c) {
        const fade = Math.exp(-5 * dt);
        c.x *= fade; c.y *= fade;
        if (Math.hypot(c.x, c.y) > 220) { c.x = 0; c.y = 0; }
        me.x += c.x; me.y += c.y;
      }
      this.pred = null; this.corr.x = 0; this.corr.y = 0; this._wasPred = false;
    }
  },

  // ---------- look and sound ----------
  trail(b, dt, flying) {
    b.trailT -= dt;
    if (b.trailT > 0) return;
    b.trailT = 1 / 60;
    const s = Math.hypot(b.vx, b.vy);
    const maxLen = TRAIL_LEN[b.trailType] || 0;
    if (!b.owner && flying && b.trailType && s > 260) {
      b.trail.unshift({ x: b.x, y: b.y, z: b.z });
      if (b.trail.length > maxLen) b.trail.length = maxLen;
    } else if (b.trail.length) {
      b.trail.pop();
      if (!b.trail.length) b.trailType = null;
    } else b.trailType = null;
  },

  cosmetics(m, dt) {
    for (const p of m.players) {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 205 && p.diveT <= 0) {
        p.dustT = (p.dustT || 0) - dt;
        if (p.dustT <= 0) { p.dustT = p.slideT > 0 ? 0.06 : 0.11; FX.dust(p.x - (p.vx / sp) * 8, p.y - (p.vy / sp) * 4); }
      }
      if (p.sprintOn && sp > 150) {
        p.streakT = (p.streakT || 0) - dt;
        if (p.streakT <= 0) { p.streakT = 0.09; FX.speedLine(p.x, p.y, p.vx, p.vy); }
      }
    }
  },

  playEvent(e) {
    if (e.e === 's') { const fn = Sound[e.n]; if (typeof fn === 'function') fn.apply(Sound, e.a || []); return; }
    if (e.e === 'f') { const fn = FX[e.n]; if (typeof fn === 'function') fn.apply(FX, e.a || []); return; }
    if (e.e === 'goal') this.goalFX(e);
    if (e.e === 'cele' && this.m) {
      this.m.cele = { scorer: this.m.players[e.scorer], kind: e.kind };
      FX.banner = null; Sound.whoosh(true); Sound.cheer(true);
    }
  },

  goalFX(e) {
    const m = this.m, team = e.team;
    const scorer = e.scorer >= 0 ? m.players[e.scorer] : null;
    const mineScored = scorer === m.human;
    const colors = [TEAMS[team].jersey, TEAMS[team].stripes || TEAMS[team].checks || TEAMS[team].fx, '#ffffff', '#ffe14d'];
    FX.confetti(team === 'blue' ? CFG.FIELD_W + 10 : -10, CFG.FIELD_H / 2, colors, 60);
    FX.sparks(e.x, e.y, e.z + 8, colors[0], 16, 420, 0.4);
    FX.burst(e.x, e.y, e.z + 10, colors[0], e.power ? 60 : 44, 0.4);
    FX.doFlash(TEAMS[team].jersey, 0.5);
    FX.doShake(e.power ? 13 : 9, 0.35);
    let sub = 'OWN GOAL';
    if (scorer) sub = mineScored ? 'YOU SCORED!' : scorer.name ? scorer.name : `#${scorer.number} ${TEAMS[team].name}`;
    const big = team === 'blue' ? (mineScored && e.hype ? e.hype : 'GOAL!') : 'GOAL!';
    if (m.phase !== 'cele') FX.showBanner(big, team === 'blue' ? '#ffe14d' : shadeHex(TEAMS.red.jersey, 0.15), 2.0, e.hype && !mineScored ? sub + ' · ' + e.hype : sub);
    Sound.net(); Sound.cheer(true); Sound.goalJingle(team === 'blue');
    if (team === 'blue') vibrate([30, 40, 30]);
    if (mineScored) { m.flags.goals = (m.flags.goals || 0) + 1; if (e.power) m.flags.powerGoals = (m.flags.powerGoals || 0) + 1; }
  },

  // ---------- full time ----------
  end(msg) {
    if (this.status !== 'match' || !this.m) return;
    // show the last moments before the results come up
    const m = this.m;
    this.status = 'over';
    this.lastEnd = msg;
    setTimeout(() => { if (Game.match === m) UI.showOnlineResults(m, msg); }, 1200);
  },

  again() {
    const f = this.format;
    Game.goHome();
    this.m = null;
    this.findMatch(f);
  },
};

const FORMAT_SIZE_NET = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 };
