// Match flow: kickoff → play → goal → reset → ... → full time → results.
const COIN_MULT = { easy: 0.8, normal: 1, hard: 1.3 };
const Match = {
  create(opts = {}) {
    const minutes = opts.minutes || Save.data.settings.minutes || 3;
    const home = opts.home || Clubs.mine();
    const club = opts.club || Clubs.random(home);
    if (!Game.headless) Clubs.setMatch(home, club);
    if (!opts.diff) Game.setDifficulty(club);
    const diff = opts.diff || Game.difficulty();
    const m = {
      players: [], ball: new Ball(), human: null, keepers: {},
      score: { blue: 0, red: 0 },
      stats: { blue: { shots: 0, passes: 0, steals: 0, saves: 0 }, red: { shots: 0, passes: 0, steals: 0, saves: 0 } },
      meter: { blue: 0, red: 0 },
      poss: { blue: 0, red: 0 },
      duration: minutes * 60, time: minutes * 60, overtime: false, otTime: 0, buzzer: 0,
      phase: 'kickoff', phaseT: 0, clock: 0, kickoffWait: 1.0,
      kickoffTeam: 'blue', shotId: 0, slowmo: 0, freeze: 0, timeScale: 1,
      autopilot: !!opts.autopilot, diff, mateDiff: opts.mateDiff || levelDiff(MATE_BASE, home.level), home, humans: [], teamHuman: { blue: false, red: false }, online: !!opts.online,
      goals: [], result: null, resetDone: false, exciteT: 0, lastConceded: null,
      mode: opts.mode || 'quick', club, noDraw: opts.mode === 'cup', flags: {}, challenges: null, challengeT: 0,
      format: FORMATS[opts.format] ? opts.format : (FORMATS[Save.data.format] ? Save.data.format : '4v4'),
    };
    if (m.online) m.mode = 'online';
    m.training = m.mode === 'training';
    if (m.training) m.format = 'training';
    if (!m.autopilot && !Game.headless && !m.training && !m.online) m.challenges = Challenges.roll(m.format);
    const roster = FORMATS[m.format];
    const rng = mulberry32((Math.random() * 1e9) | 0);
    const r = (arr) => arr[(rng() * arr.length) | 0];
    const aiLook = () => ({ hair: r(AI_HAIRS), hairColor: r(HAIR_COLORS), skin: r(SKINS), band: r(['#ffffff', '#ffe14d', '#1b1d33']), cap: r(['#2f7bff', '#ff8a1f', '#3fcf4a', '#1b1d33']) });

    const lookOf = (ch) => ({ hair: ch.hair, hairColor: ch.hairColor, skin: ch.skin, cap: ch.cap, band: ch.band });
    if (opts.seats) {
      // online: both sides symmetric, real players take roles from the front of their side
      const sides = SIDES[m.format] || SIDES['4v4'];
      for (const team of ['blue', 'red']) {
        const mine = opts.seats.filter((s) => s.team === team);
        sides[team].forEach(([role, n], i) => {
          const s = mine[i];
          if (s && s.human) {
            const ch = CHARACTERS.find((c) => c.id === s.character) || CHARACTERS[0];
            const p = new Player({ team, human: true, role, number: n, attr: ratingAttr(ch.r), look: lookOf(ch) });
            Object.assign(p, { seat: s.seat, name: s.name, trailId: s.trail, celebId: s.celebration, rarity: ch.rarity, input: s.input });
            m.players.push(p); m.humans.push(p);
          } else {
            const ch = s && s.character && CHARACTERS.find((c) => c.id === s.character);
            const p = new Player({ team, role, number: n, look: ch ? lookOf(ch) : aiLook(), attr: ch ? ratingAttr(ch.r) : null });
            p.speedMul = diff.redSpeed; p.seat = s ? s.seat : null; p.name = s ? s.name : null; p.celebId = s ? s.celebration : null;
            m.players.push(p);
          }
        });
      }
      m.human = m.humans[0] || m.players[0];
    } else {
      const ch = Save.character();
      const human = new Player({ team: 'blue', human: true, role: 'att', number: 10, attr: m.autopilot ? null : ratingAttr(ch.r), look: lookOf(ch) });
      m.human = human;
      m.players.push(human); m.humans.push(human);
      roster.blue.forEach(([role, n]) => {
        const p = new Player({ team: 'blue', role, number: n, look: aiLook() });
        p.speedMul = m.mateDiff.redSpeed;
        m.players.push(p);
      });
      roster.red.forEach(([role, n]) => {
        const p = new Player({ team: 'red', role, number: n, look: aiLook() });
        p.speedMul = diff.redSpeed;
        m.players.push(p);
      });
    }
    if (!m.autopilot) for (const h of m.humans) m.teamHuman[h.team] = true;
    for (const team of ['blue', 'red']) {
      const k = new Player({ team, keeper: true, role: 'gk', number: 1, look: aiLook() });
      m.keepers[team] = k;
      m.players.push(k);
    }
    if (m.autopilot) m.human.speedMul = 0.95;
    m.humanRarity = m.autopilot ? null : m.human.rarity || (opts.seats ? null : Save.character().rarity);
    this.setupKickoff(m, 'blue');
    if (!Game.headless && !m.online) FX.showBanner('KICK OFF!', '#ffffff', 1.0, `${home.name} vs ${club.name}`);
    return m;
  },

  setupKickoff(m, team) {
    const W = CFG.FIELD_W, H = CFG.FIELD_H;
    const spots = { def: [0.17, 0.5], midL: [0.33, 0.26], midR: [0.33, 0.74], mid: [0.3, 0.3], att: [0.4, 0.5] };
    const b = m.ball;
    b.reset(W / 2, H / 2);
    let kicker = null;
    for (const p of m.players) {
      const dir = TEAMS[p.team].dir;
      let u, v;
      if (p.isKeeper) { u = 36 / W; v = 0.5; }
      else { [u, v] = spots[p.role]; }
      p.x = dir > 0 ? u * W : (1 - u) * W;
      p.y = v * H;
      if (!p.isKeeper && p.role === 'att' && p.team === team) {
        kicker = p;
        p.x = W / 2 - dir * (p.r + CFG.BALL_R + 3);
        p.y = H / 2;
      }
      p.vx = 0; p.vy = 0; p.mx = 0; p.my = 0;
      p.fx = dir; p.fy = 0; p.faceX = dir;
      p.kickT = 0; p.stunT = 0; p.noPickupT = 0; p.diveT = 0; p.recoverT = 0;
      p.celebrateT = 0; p.sad = false; p.celebKind = null; p.charging = false; p.chargeT = 0; p.passCharging = false; p.passChargeT = 0; p.bufferT = 0; p.holdT = 0;
      p.ai.spotT = 0; p.ai.decideT = rand(0.2, 0.5); p.ai.holdT = 0; p.ai.slideT = 0;
      p.clearActions();
    }
    Replay.clear(m);
    if (!kicker) {
      kicker = m.players.find((p) => p.team === team && !p.isKeeper) || m.players.find((p) => !p.isKeeper);
      const dir = TEAMS[kicker.team].dir;
      kicker.x = W / 2 - dir * (kicker.r + CFG.BALL_R + 3); kicker.y = H / 2;
      kicker.fx = dir; kicker.faceX = dir;
      team = kicker.team;
    }
    b.owner = kicker;
    b.x = kicker.x + kicker.fx * (kicker.r + CFG.BALL_R + 1);
    b.lastTouchTeam = team;
    kicker.protectT = 0.9;
    for (const h of m.humans) h.passRequestT = 0;
    if (!Game.headless) Sound.chargeStop();
  },

  step(m, dt) {
    let sdt = dt;
    if (m.freeze > 0) { m.freeze -= dt; sdt = 0; }
    else if (m.slowmo > 0) { m.slowmo -= dt; sdt = dt * 0.35; }
    m.timeScale = sdt / dt;
    m.phaseT += dt;

    switch (m.phase) {
      case 'kickoff':
        this.discardInput(m);
        if (sdt > 0) { movePlayers(m, sdt); updateBall(m, sdt); }
        if (m.phaseT >= m.kickoffWait) {
          m.phase = 'play'; m.phaseT = 0;
          Sound.whistle();
        }
        break;

      case 'play':
        if (sdt <= 0) break;
        m.clock += sdt;
        if (!m.autopilot) for (const h of m.humans) this.humanControl(m, h, sdt);
        AI.update(m, sdt);
        movePlayers(m, sdt);
        updateBall(m, sdt);
        checkSlides(m);
        Replay.record(m, sdt);
        this.checkGoal(m);
        if (m.phase !== 'play') break;
        for (const h of m.humans) if ((h.dribbleDist || 0) > 100) { h.dribbleDist -= 100; addMeter(m, h, 1.1); }
        if (m.ball.owner) m.poss[m.ball.owner.team] += sdt;
        this.tickClock(m, sdt);
        m.challengeT -= dt;
        if (m.challengeT <= 0) { m.challengeT = 0.25; Challenges.check(m); }
        m.exciteT -= dt;
        if (m.exciteT <= 0) {
          m.exciteT = 0.3;
          const b = m.ball;
          Sound.setExcitement(Math.min(b.x, CFG.FIELD_W - b.x) < 600 ? 1 : 0);
        }
        break;

      case 'goal':
        this.discardInput(m);
        if (sdt > 0) { this.celebrate(m, sdt); movePlayers(m, sdt); updateBall(m, sdt); Replay.record(m, sdt); }
        if (m.phaseT >= (this.wantsCutscene(m) ? 1.0 : 2.3)) {
          if (this.startCutscene(m)) break;
          this.afterGoal(m);
        }
        break;

      case 'cele': {
        // offline you can tap through it; online everyone watches the same moment
        if (!m.online && !m.autopilot && m.phaseT > 0.4) {
          const I = m.human.input || Input;
          if (I.consumePass() | I.consumeShootPress() | I.consumeSkill() | I.consumeSlide()) m.cele.skip = true;
        }
        this.discardInput(m);
        if (sdt > 0) { this.celebrate(m, sdt); movePlayers(m, sdt); updateBall(m, sdt); }
        if (m.phaseT >= CELE_TIME || m.cele.skip) this.afterGoal(m);
        break;
      }

      case 'replay':
        if (Replay.step(m, dt)) {
          if (m.overtime) this.endMatch(m);
          else { m.phase = 'reset'; m.phaseT = 0; m.resetDone = false; m.kickoffTeam = m.lastConceded; }
        }
        break;

      case 'reset':
        this.discardInput(m);
        if (m.phaseT >= 0.22 && !m.resetDone) {
          m.resetDone = true;
          this.setupKickoff(m, m.kickoffTeam || 'blue');
        }
        if (m.phaseT >= 0.45) { m.phase = 'kickoff'; m.phaseT = 0; m.kickoffWait = m.overtime && m.goals.length === 0 ? 1.2 : 0.6; }
        break;

      case 'timeup':
        this.discardInput(m);
        for (const p of m.players) { p.mx = 0; p.my = 0; }
        movePlayers(m, dt); updateBall(m, dt);
        if (m.phaseT >= 1.7) {
          m.phase = 'over';
          Challenges.check(m);
          m.result = this.result(m);
          if (!Game.headless) UI.showResults(m);
        }
        break;
    }
  },

  discardInput(m) {
    if (m.autopilot || (Game.headless && !m.online)) return;
    for (const h of m.humans) {
      const I = h.input || Input;
      I.consumePass(); I.consumeShootPress(); I.consumeShootRelease();
      I.consumeSkill(); I.consumeSlide();
      if (h.charging) { h.charging = false; Sound.chargeStop(); }
      h.mx = 0; h.my = 0; h.sprinting = false;
    }
  },

  // one real player's controls: the local Input, or that player's network input on the server
  humanControl(m, h, dt) {
    const b = m.ball, I = h.input || Input;
    const mv = I.move, mag = Math.hypot(mv.x, mv.y);
    h.mx = mag > 0.01 ? mv.x / mag : 0; h.my = mag > 0.01 ? mv.y / mag : 0;
    h.mSpeed = Math.min(1, mag);
    h.sprinting = I.sprintHeld;

    // SKILL with the ball, SLIDE without it (the mobile button does both)
    if (I.consumeSkill()) {
      if (b.owner === h) performSkill(m, h, mv.x, mv.y);
      else performSlide(m, h, mv.x, mv.y);
    }
    if (I.consumeSlide() && b.owner !== h) performSlide(m, h, mv.x, mv.y);

    // PASS charges while held and goes on release; a tap is the ordinary pass
    if (I.consumePassPress && I.consumePassPress()) { h.passCharging = true; h.passChargeT = 0; }
    if (h.passCharging) {
      h.passHeldT = (h.passHeldT || 0) + dt;
      h.passChargeT = Math.min(CFG.PASS_CHARGE_FULL, h.passChargeT + dt);
      if (h.passHeldT > 4) { h.passCharging = false; h.passChargeT = 0; }
    } else h.passHeldT = 0;
    if (I.consumePass()) {
      const charge = h.passCharging ? h.passChargeT : 0;
      h.passCharging = false; h.passChargeT = 0;
      const nearLoose = !b.owner && dist(h.x, h.y, b.x, b.y) < 44 && b.z < 30 && h.stunT <= 0;
      if (b.owner === h) performPass(m, h, mag > 0.1 ? mv.x : h.fx, mag > 0.1 ? mv.y : h.fy, null, charge);
      else if (nearLoose) { takePossession(m, h); performPass(m, h, mag > 0.1 ? mv.x : h.fx, mag > 0.1 ? mv.y : h.fy, null, charge); }
      else if (b.owner && b.owner.team === h.team && !b.owner.isKeeper && !b.owner.isHuman) { h.passRequestT = 0.6; FX.ring(h.x, h.y, '#ffffff', 10, 34, 0.35, 3); }
    }

    if (I.consumeShootPress()) {
      h.charging = true; h.chargeT = 0;
      Sound.chargeStart();
    }
    let release = I.consumeShootRelease();
    if (h.charging) {
      h.chargeT += dt;
      if (h.chargeT >= CFG.CHARGE_AUTO) release = true;
    }
    if (release && h.charging) {
      h.charging = false;
      Sound.chargeStop();
      const nearLoose = !b.owner && dist(h.x, h.y, b.x, b.y) < 46 && b.z < 34 && h.stunT <= 0;
      if (b.owner === h) performShot(m, h, h.chargeT, mv.y);
      else if (nearLoose) { takePossession(m, h); performShot(m, h, h.chargeT, mv.y); }
      else { h.bufferT = 0.3; h.bufferCharge = h.chargeT; }
    }
    if (h.bufferT > 0) {
      h.bufferT -= dt;
      if (b.owner === h) { h.bufferT = 0; performShot(m, h, h.bufferCharge, mv.y); }
    }
  },

  // every goal with a scorer gets a celebration cutscene (not in training or bot-only matches)
  wantsCutscene(m) {
    const g = m.goals[m.goals.length - 1];
    return !!(g && g.scorer && !m.autopilot && !m.training && !m.demo);
  },

  startCutscene(m) {
    if (!this.wantsCutscene(m)) return false;
    const g = m.goals[m.goals.length - 1], s = g.scorer;
    // yours from the shop; everyone else has theirs (bots pick one for the match)
    if (!s.celebId || !CELE_POSES[s.celebId]) s.celebId = s.isHuman && !m.online ? Save.celebration() : pick(BOT_CELEBS);
    const kind = s.celebId;
    const toCenter = Math.sign(CFG.FIELD_W / 2 - s.x) || 1;
    let dx = toCenter * 0.75, dy = s.y < CFG.FIELD_H * 0.7 ? 0.65 : -0.45;
    const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
    m.phase = 'cele'; m.phaseT = 0;
    m.cele = { scorer: s, kind, team: g.team, dir: { x: dx, y: dy }, skip: false };
    let mate = 0;
    for (const p of m.players) {
      p.celebKind = null; p.celebrateT = 0; p.charging = false;
      if (p.team === g.team && !p.isKeeper) {
        p.celebrateT = CELE_TIME; p.celebKind = p === s ? kind : 'hype'; p.celeFaceX = toCenter;
        // the camera cuts in, so teammates can start just out of shot and run in to join
        if (p !== s && dist(p.x, p.y, s.x, s.y) > 320) {
          const a = mate * 2.1 + 0.6;
          p.x = clamp(s.x + Math.cos(a) * 280, 20, CFG.FIELD_W - 20); p.y = clamp(s.y + Math.sin(a) * 200, 20, CFG.FIELD_H - 20);
          p.vx = 0; p.vy = 0;
        }
        if (p !== s) mate++;
      } else p.sad = p.team !== g.team;
    }
    if (m.events) m.events.push({ e: 'cele', scorer: m.players.indexOf(s), kind });
    else if (!Game.headless) { FX.banner = null; Sound.whoosh(true); Sound.cheer(true); }
    return true;
  },

  afterGoal(m) {
    if (Replay.start(m)) return;
    if (m.overtime) this.endMatch(m);
    else { m.phase = 'reset'; m.phaseT = 0; m.resetDone = false; m.kickoffTeam = m.training ? 'blue' : m.lastConceded; }
  },

  celebrate(m, dt) {
    const g = m.goals[m.goals.length - 1], s = g.scorer;
    const cele = m.phase === 'cele' ? m.cele : null;
    let mate = 0;
    for (const p of m.players) {
      p.mx = 0; p.my = 0;
      if (p.team !== g.team || p.isKeeper || !s) continue;
      if (p === s) {
        if (!cele) continue; // the ball just went in: let the scorer's run die down
        const move = CELE_MOVES[cele.kind], e = CELE_TIME - p.celebrateT;
        const speed = move ? move(e) : 0;
        if (speed > 0) {
          const a = Math.atan2(cele.dir.y, cele.dir.x) + (CELE_TURN[cele.kind] || 0) * e;
          p.mx = Math.cos(a); p.my = Math.sin(a);
          p.mSpeed = speed / (CFG.SPEED * p.speedMul * p.attr.speed);
        }
        continue;
      }
      // teammates pile in around the scorer
      const a = mate++ * 2.1 + 0.6;
      const tx = s.x + Math.cos(a) * 72, ty = s.y + Math.sin(a) * 48;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 24) { p.mx = dx / d; p.my = dy / d; p.mSpeed = d > 220 ? 1.15 : 0.75; }
    }
  },

  tickClock(m, dt) {
    if (m.training) return;
    if (!m.overtime) {
      m.time -= dt;
      if (m.time <= 0) {
        m.time = 0;
        // let a shot that is already flying finish
        if (m.ball.shot && m.buzzer < 1.2) { m.buzzer += dt; return; }
        if (m.score.blue === m.score.red) this.startOvertime(m);
        else this.endMatch(m);
      }
    } else {
      m.otTime += dt;
      if (!m.noDraw && m.otTime >= CFG.OVERTIME_SECONDS) this.endMatch(m);
    }
  },

  startOvertime(m) {
    m.overtime = true;
    m.phase = 'reset'; m.phaseT = 0; m.resetDone = false;
    m.kickoffTeam = m.lastConceded || 'red';
    Sound.whistle('long');
    FX.showBanner('GOLDEN GOAL!', '#ffe14d', 2.0, m.noDraw ? 'CUP MATCH · NEXT GOAL WINS' : 'NEXT GOAL WINS');
  },

  endMatch(m) {
    m.phase = 'timeup'; m.phaseT = 0;
    m.ball.owner = null; m.ball.shot = null;
    Sound.whistle('end');
    Sound.setExcitement(0);
    FX.showBanner('FULL TIME', '#ffffff', 1.6);
  },

  checkGoal(m) {
    const b = m.ball;
    if (b.y <= GOAL_Y1 || b.y >= GOAL_Y2) return;
    let team;
    if (b.x < -CFG.BALL_R) team = 'red';
    else if (b.x > CFG.FIELD_W + CFG.BALL_R) team = 'blue';
    else return;
    // a keeper who "decided" to save gets the save even if the dive math was a hair off
    const k = m.keepers[otherTeam(team)];
    if (b.shot && b.shot.team === team && b.shot.decided && b.shot.save && dist(k.x, k.y, b.x, b.y) < 170) {
      b.x = team === 'red' ? 2 : CFG.FIELD_W - 2;
      keeperContact(m, k, b, Math.hypot(b.vx, b.vy));
      return;
    }
    this.goalScored(m, team);
  },

  goalScored(m, team) {
    const b = m.ball;
    m.phase = 'goal'; m.phaseT = 0;
    Replay.markGoal(m);
    m.score[team]++;
    m.lastConceded = otherTeam(team);
    const kicker = b.lastKicker;
    const scorer = kicker && kicker.team === team ? kicker : null;
    if (scorer) scorer.stats.goals++;
    let assist = null;
    if (scorer && b.assist && b.assist.from !== scorer && b.assist.from.team === team && m.clock - b.assist.t < 8) {
      assist = b.assist.from; assist.stats.assists++;
      if (assist.isHuman) addMeter(m, assist, 10);
    }
    if (scorer && scorer.isHuman) addMeter(m, scorer, 15);
    const nowLeads = m.score[team] > m.score[otherTeam(team)];
    m.trailed = m.trailed || {};
    for (const t of ['blue', 'red']) if (m.score[t] < m.score[otherTeam(t)]) m.trailed[t] = true;
    if (scorer && scorer.isHuman && b.shot) {
      if (b.shot.power) { m.flags.powerGoal = true; m.flags.powerGoals = (m.flags.powerGoals || 0) + 1; }
      if (b.shot.curved) m.flags.curlGoal = true;
    }
    const how = b.owner ? 'dribble' : b.shot ? (!b.shot.decided ? 'undecided' : b.shot.save ? 'saveMissed' : 'beatKeeper') : 'loose';
    m.goals.push({ team, scorer, assist, own: !scorer, how, time: m.overtime ? m.duration + m.otTime : m.duration - m.time });
    b.owner = null;
    const wasPower = b.shot && b.shot.power;
    b.shot = null;
    m.freeze = 0.3;
    m.slowmo = 0.6;
    const side = team === 'blue' ? 'right' : 'left';
    b.netBulge[side] = 1;
    for (const p of m.players) {
      if (p.team === team) p.celebrateT = 2.3; else p.sad = true;
      if (p.isHuman && p.charging) { p.charging = false; Sound.chargeStop(); }
    }
    if (m.events) {
      const idx = (p) => (p ? m.players.indexOf(p) : -1);
      let hype = '';
      if (m.overtime) hype = 'GOLDEN GOAL!';
      else if (scorer && scorer.stats.goals === 3) hype = 'HAT-TRICK!';
      else if (m.time < 10) hype = 'LAST-GASP!';
      else if (wasPower) hype = 'SCREAMER!';
      else if (how === 'dribble') hype = 'WALKED IT IN!';
      m.events.push({ e: 'goal', team, scorer: idx(scorer), assist: idx(assist), power: !!wasPower, hype, x: b.x, y: b.y, z: b.z });
      return; // each client plays the goal moment itself (see Online.goalFX)
    }
    if (Game.headless) return;
    const colors = [TEAMS[team].jersey, TEAMS[team].stripes || TEAMS[team].checks || TEAMS[team].fx, '#ffffff', '#ffe14d'];
    const gx = team === 'blue' ? CFG.FIELD_W + 10 : -10;
    FX.confetti(gx, CFG.FIELD_H / 2, colors, 60);
    FX.sparks(b.x, b.y, b.z + 8, colors[0], 16, 420, 0.4);
    FX.burst(b.x, b.y, b.z + 10, colors[0], wasPower ? 60 : 44, 0.4);
    FX.doFlash(TEAMS[team].jersey, 0.5);
    FX.doShake(wasPower ? 13 : 9, 0.35);
    let sub = 'OWN GOAL';
    if (scorer) sub = scorer.isHuman ? 'YOU SCORED!' : `#${scorer.number} ${TEAMS[team].name}`;
    // hype callouts
    let hype = '';
    if (m.overtime) hype = 'GOLDEN GOAL!';
    else if (scorer && scorer.stats.goals === 3) hype = 'HAT-TRICK!';
    else if (m.time < 10) hype = 'LAST-GASP!';
    else if (wasPower) hype = 'SCREAMER!';
    else if (m.trailed && m.trailed[team] && nowLeads && !m.comeback) { hype = 'COMEBACK!'; m.comeback = true; }
    else if (how === 'dribble') hype = 'WALKED IT IN!';
    FX.showBanner(hype && scorer && scorer.isHuman ? hype : 'GOAL!', team === 'blue' ? '#ffe14d' : shadeHex(TEAMS.red.jersey, 0.15), 2.0, hype && !(scorer && scorer.isHuman) ? sub + ' · ' + hype : sub);
    Sound.net(); Sound.cheer(true); Sound.goalJingle(team === 'blue');
    vibrate([30, 40, 30]);
  },

  result(m) {
    const outcome = m.score.blue > m.score.red ? 'win' : m.score.blue < m.score.red ? 'loss' : 'draw';
    let mvp = null, best = -1;
    for (const p of m.players) {
      const s = p.stats;
      let rating = s.goals * 3 + s.assists * 2 + s.saves * 1.2 + s.steals * 0.8 + s.passes * 0.35 + s.shots * 0.3;
      if ((p.team === 'blue' && outcome === 'win') || (p.team === 'red' && outcome === 'loss')) rating += 0.5;
      if (rating > best) { best = rating; mvp = p; }
    }
    const mult = COIN_MULT[Save.data.settings.difficulty] || 1;
    const base = Math.round((20 + m.score.blue * 10 + (outcome === 'win' ? 50 : outcome === 'draw' ? 20 : 0)) * mult);
    const challengeCoins = (m.challenges || []).filter((c) => c.complete).reduce((a, c) => a + c.coins, 0);
    const cupBonus = m.mode === 'cup' && outcome === 'win' ? 40 : 0;
    return { outcome, mvp, coins: base + challengeCoins + cupBonus, base, challengeCoins, cupBonus, mult };
  },
};

// Headless balance check: Sim.run(50) plays AI-vs-AI matches with no rendering.
const Sim = {
  run(n = 30, opts = {}) {
    const prev = Game.headless;
    Game.headless = true;
    const out = { matches: n, blue: 0, red: 0, shots: 0, saves: 0, passes: 0, steals: 0, draws: 0, overtime: 0, zeroZero: 0, perTeam: [] };
    for (let i = 0; i < n; i++) {
      const m = Match.create({ autopilot: true, minutes: opts.minutes || 3, club: opts.club, format: opts.format });
      let steps = 0;
      while (m.phase !== 'over' && steps < 200000) { Match.step(m, CFG.STEP); steps++; }
      out.blue += m.score.blue; out.red += m.score.red;
      out.shots += m.stats.blue.shots + m.stats.red.shots;
      out.saves += m.stats.blue.saves + m.stats.red.saves;
      out.passes += m.stats.blue.passes + m.stats.red.passes;
      out.passTries = (out.passTries || 0) + (m.stats.blue.passTries || 0) + (m.stats.red.passTries || 0);
      out.steals += m.stats.blue.steals + m.stats.red.steals;
      for (const k of ['slides', 'tackles', 'skills', 'dodges']) out[k] = (out[k] || 0) + (m.stats.blue[k] || 0) + (m.stats.red[k] || 0);
      if (m.overtime) out.overtime++;
      if (m.score.blue === m.score.red) out.draws++;
      if (m.score.blue + m.score.red === 0) out.zeroZero++;
      out.perTeam.push(m.score.blue, m.score.red);
      for (const g of m.goals) { out.how = out.how || {}; out.how[g.how] = (out.how[g.how] || 0) + 1; if (g.own) out.own = (out.own || 0) + 1; }
    }
    Game.headless = prev;
    const inRange = out.perTeam.filter((g) => g >= 1 && g <= 5).length / out.perTeam.length;
    return {
      goalsPerTeam: +((out.blue + out.red) / (2 * n)).toFixed(2),
      teamScoresIn1to5: Math.round(inRange * 100) + '%',
      shotsPerTeam: +(out.shots / (2 * n)).toFixed(1),
      savePct: Math.round((out.saves / Math.max(1, out.shots)) * 100) + '%',
      passesPerTeam: +(out.passes / (2 * n)).toFixed(1),
      passCompletion: Math.round((out.passes / Math.max(1, out.passTries)) * 100) + '%',
      stealsPerTeam: +(out.steals / (2 * n)).toFixed(1),
      slidesPerTeam: +((out.slides || 0) / (2 * n)).toFixed(1),
      tackleSuccess: Math.round(((out.tackles || 0) / Math.max(1, out.slides || 0)) * 100) + '%',
      skillsPerTeam: +((out.skills || 0) / (2 * n)).toFixed(1),
      dodgesPerTeam: +((out.dodges || 0) / (2 * n)).toFixed(1),
      overtimePct: Math.round((out.overtime / n) * 100) + '%',
      blueGoals: out.blue, redGoals: out.red, how: out.how, ownGoals: out.own || 0,
    };
  },
};
