// Bug scan — not loaded by the game. In the browser console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/bugscan.js'; s.onload = r; document.head.appendChild(s); });
//   BS.sim({ matches: 40 })   // fuzzed headless matches with invariant checks
//   await BS.ui()             // clicks through every screen / panel / flow and watches for errors
// Findings come back grouped by kind with a few examples each.
window.BS = {
  // ---------- fuzzed matches ----------
  sim(opts = {}) {
    const matches = opts.matches || 24;
    const formats = opts.formats || ['1v1', '2v2', '3v3', '4v4', 'training'];
    const diffs = opts.diffs || ['easy', 'normal', 'hard'];
    const report = { matches: 0, steps: 0, issues: {}, examples: {}, errors: [], goals: 0, overtime: 0, ms: 0 };
    const add = (kind, detail) => {
      report.issues[kind] = (report.issues[kind] || 0) + 1;
      const ex = report.examples[kind] || (report.examples[kind] = []);
      if (ex.length < 4) ex.push(detail);
    };
    const prevHeadless = Game.headless, prevDiff = Save.data.settings.difficulty;
    Game.headless = true;
    const t0 = performance.now();
    for (let i = 0; i < matches; i++) {
      const format = formats[i % formats.length];
      const club = CLUBS[i % CLUBS.length];
      Save.data.settings.difficulty = diffs[i % diffs.length];
      const autopilot = i % 4 === 3; // mostly a fuzzed human, sometimes all bots
      const mode = format === 'training' ? 'training' : i % 5 === 1 ? 'cup' : 'quick';
      try {
        this.runOne({ format, club, autopilot, mode, minutes: opts.minutes || 1, add, report, seed: i });
      } catch (e) {
        report.errors.push(`${format}/${club.id}/${mode}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`);
      }
      report.matches++;
    }
    Game.headless = prevHeadless;
    Save.data.settings.difficulty = prevDiff;
    Input.reset();
    report.ms = Math.round(performance.now() - t0);
    return report;
  },

  runOne({ format, club, autopilot, mode, minutes, add, report, seed }) {
    const rng = mulberry32(1234 + seed * 77);
    const m = Match.create({ format, club, autopilot, mode: format === 'training' ? 'training' : mode, minutes });
    const W = CFG.FIELD_W, H = CFG.FIELD_H;
    const tag = `${format}/${club.id}/${mode}${autopilot ? '/auto' : ''}`;
    const maxSteps = (minutes * 60 + (mode === 'cup' ? 600 : CFG.OVERTIME_SECONDS) + 60) * 120;
    const trainingSteps = 150 * 120;
    let steps = 0, looseT = 0, holdT = 0, holder = null, lastScore = 0, phaseT = 0, lastPhase = m.phase;
    const pocketT = new Map();
    let stickT = 0, charge = 0, lineT = 0, farT = 0;
    const stack = {};
    const phaseMax = { kickoff: 2.5, goal: 3, reset: 1, timeup: 2.5, replay: 12, cele: CELE_TIME + 0.3 };
    while (m.phase !== 'over') {
      if (!autopilot) this.fuzz(m, rng, () => stickT, (v) => (stickT = v), () => charge, (v) => (charge = v));
      Match.step(m, CFG.STEP);
      steps++;
      const b = m.ball, where = `${tag} t=${m.clock.toFixed(1)} phase=${m.phase}`;

      // phases progress
      if (m.phase !== lastPhase) { lastPhase = m.phase; phaseT = 0; } else phaseT += CFG.STEP;
      if (phaseMax[m.phase] && phaseT > phaseMax[m.phase]) { add('phase-stuck', `${where} for ${phaseT.toFixed(1)}s`); phaseT = -999; }

      // numbers stay numbers, things stay in the arena
      for (const p of m.players) {
        for (const k of ['x', 'y', 'vx', 'vy', 'fx', 'fy', 'stamina', 'slideCd', 'skillCd']) {
          if (!Number.isFinite(p[k])) { add('nan-player', `${where} #${p.number}${p.team} ${k}=${p[k]}`); p[k] = 0; }
        }
        if (!insideArena(p.x, p.y)) add('player-outside', `${where} #${p.number}${p.team} ${p.x | 0},${p.y | 0}`);
        if (p.stamina < -0.001 || p.stamina > 1.001) add('stamina-range', `${where} ${p.stamina}`);
        if (p.slideCd > 4 || p.skillCd > 4 || p.slideCd < 0 || p.skillCd < 0) add('cooldown-range', `${where} slide=${p.slideCd} skill=${p.skillCd}`);
        if (p.stunT > 3) add('stun-long', `${where} #${p.number}${p.team} ${p.stunT}`);
        if (Math.hypot(p.vx, p.vy) > (p.isKeeper ? 1600 : 1100)) add('player-too-fast', `${where} #${p.number}${p.team} ${Math.hypot(p.vx, p.vy) | 0}`);
        const inPocket = (p.x < -2 || p.x > W + 2) && m.phase === 'play' && !(p.isHuman && !autopilot);
        const pt = inPocket ? (pocketT.get(p) || 0) + CFG.STEP : 0;
        pocketT.set(p, pt);
        if (pt > 4 && pt < 4 + CFG.STEP * 1.5) add(p.y > GOAL_Y1 && p.y < GOAL_Y2 ? 'bot-in-goal' : 'bot-behind-line', `${where} #${p.number}${p.team}${p.isKeeper ? ' GK' : ''} ${p.x | 0},${p.y | 0}`);
        if (p.isKeeper && m.phase === 'play') {
          const gx = ownGoalX(p.team);
          if (Math.abs(p.x - gx) > 520) add('keeper-wander', `${where} ${p.team} GK ${p.x | 0},${p.y | 0}`);
        }
      }
      for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) if (!Number.isFinite(b[k])) { add('nan-ball', `${where} ${k}=${b[k]}`); b[k] = 0; }
      if (!insideArena(b.x, b.y)) add('ball-outside', `${where} ${b.x | 0},${b.y | 0},${b.z | 0} owner=${b.owner ? b.owner.number + b.owner.team : '-'}`);
      if (b.z < -1 || b.z > 700) add('ball-z', `${where} z=${b.z}`);
      if (!b.owner || dist(b.owner.x, b.owner.y, b.x, b.y) <= b.owner.r + CFG.BALL_R + 62) farT = 0;
      if (b.owner) {
        if (!m.players.includes(b.owner)) add('owner-foreign', where);
        else if (dist(b.owner.x, b.owner.y, b.x, b.y) > b.owner.r + CFG.BALL_R + 62 && m.phase === 'play' && ++farT === 12) { const o = b.owner; add('owner-far', `${where} d=${dist(o.x, o.y, b.x, b.y) | 0} #${o.number}${o.team}${o.isKeeper ? ' GK' : ''}${o.isHuman ? ' YOU' : ''} skill=${o.skill ? o.skill.kind : '-'} slideT=${o.slideT.toFixed(2)} dive=${o.diveT.toFixed(2)} spd=${o.speed | 0} at ${o.x | 0},${o.y | 0} ball ${b.x | 0},${b.y | 0}`); }
        if (b.shot && m.phase === 'play') add('owned-shot', where);
      }

      // score bookkeeping
      const total = m.score.blue + m.score.red;
      if (total !== m.goals.length) add('score-mismatch', `${where} score=${total} goals=${m.goals.length}`);
      if (total > lastScore) {
        report.goals += total - lastScore; if (total - lastScore > 1) add('double-goal', where); lastScore = total;
        const g = m.goals[m.goals.length - 1];
        const side = b.x > W / 2 ? 'blue' : 'red';
        if (g.team !== side) add('goal-wrong-side', `${where} team=${g.team} ball=${b.x | 0}`);
        if (g.own) { report.own = (report.own || 0) + 1; add(b.lastKicker && b.lastKicker.isHuman && !autopilot ? 'own-goal-fuzzer' : 'own-goal-bot', `${where} ${g.team} how=${g.how} lastKicker=${b.lastKicker ? b.lastKicker.team + (b.lastKicker.isKeeper ? ' GK' : b.lastKicker.isHuman ? ' YOU' : ' #' + b.lastKicker.number) : 'none'}`); }
        if (g.scorer && g.scorer.team !== g.team) add('scorer-wrong-team', where);
        if (g.assist && g.assist === g.scorer) add('self-assist', where);
      }
      if (m.time < 0 || m.time > m.duration) add('clock-range', `${where} ${m.time}`);
      // a ball resting on the goal line inside the mouth that never counts
      if (m.phase === 'play' && b.y > GOAL_Y1 && b.y < GOAL_Y2 && (b.x < CFG.BALL_R + 1 || b.x > W - CFG.BALL_R - 1) && !b.owner) lineT += CFG.STEP; else lineT = 0;
      if (lineT > 2) { add('ball-on-line', `${where} ${b.x | 0},${b.y | 0}`); lineT = -999; }
      // bodies stacked on top of each other
      if (steps % 30 === 0 && m.phase === 'play') {
        for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) {
          const p = m.players[i], q = m.players[j];
          if (dist(p.x, p.y, q.x, q.y) < 6) { const key = p.id + ':' + q.id; stack[key] = (stack[key] || 0) + 1; if (stack[key] === 8) add('players-stacked', `${where} #${p.number}${p.team} + #${q.number}${q.team} at ${p.x | 0},${p.y | 0}`); } else if (stack[p.id + ':' + q.id]) stack[p.id + ':' + q.id] = 0;
        }
      }

      // nothing freezes: a loose ball nobody touches, or one player camping on it
      if (m.phase === 'play') {
        if (!b.owner && Math.hypot(b.vx, b.vy) < 5) looseT += CFG.STEP; else looseT = 0;
        if (looseT > 8) { add('ball-dead', `${where} ${b.x | 0},${b.y | 0}`); looseT = -999; }
        if (b.owner && b.owner === holder) holdT += CFG.STEP; else { holder = b.owner; holdT = 0; }
        if (holdT > 25 && !(holder && holder.isHuman && !autopilot)) { add('hold-forever', `${where} #${holder.number}${holder.team}${holder.isKeeper ? ' GK' : ''} at ${holder.x | 0},${holder.y | 0}`); holdT = -999; }
      }

      if (m.training ? steps > trainingSteps : steps > maxSteps) {
        if (!m.training) add('never-ends', `${where} score ${m.score.blue}-${m.score.red} ot=${m.overtime}`);
        break;
      }
    }
    if (m.overtime) report.overtime++;
    if (m.phase === 'over') {
      if (!m.result) add('no-result', tag);
      else if (!m.result.mvp) add('no-mvp', tag);
      if (m.noDraw && m.score.blue === m.score.red) add('cup-draw', tag);
      for (const p of m.players) if ((p.stats.tackles || 0) > (p.stats.slides || 0)) add('tackles>slides', `${tag} #${p.number}${p.team} ${p.stats.tackles}/${p.stats.slides}`);
      if (m.result && !(m.result.coins > 0)) add('coins-nonpositive', tag);
    }
    report.steps += steps;
  },

  // a restless thumb: chases the ball, drives at goal, mashes buttons
  fuzz(m, rng, getStick, setStick, getCharge, setCharge) {
    const h = m.human, b = m.ball;
    let st = getStick() - CFG.STEP;
    if (st <= 0) {
      st = 0.1 + rng() * 0.5;
      const r = rng();
      let tx, ty;
      if (r < 0.45) { tx = b.x - h.x; ty = b.y - h.y; }
      else if (r < 0.7) { tx = attackGoalX('blue') - h.x; ty = CFG.FIELD_H / 2 - h.y + (rng() - 0.5) * 400; }
      else if (r < 0.85) { const a = rng() * Math.PI * 2; tx = Math.cos(a); ty = Math.sin(a); }
      else { tx = 0; ty = 0; }
      const l = Math.hypot(tx, ty);
      Input.move.x = l ? tx / l : 0; Input.move.y = l ? ty / l : 0;
      Input.sprintHeld = rng() < 0.5;
    }
    setStick(st);
    if (rng() < 0.006) Input._passQueued = true;
    if (rng() < 0.005) Input._skillQueued = true;
    if (rng() < 0.006) Input._slideQueued = true;
    if (h.ult >= CFG.ULT_MAX && rng() < 0.05) Input._ultQueued = true;
    let c = getCharge();
    if (c > 0) { c -= CFG.STEP; if (c <= 0) { Input._shootReleased = true; Input.shootHeld = false; } }
    else if (rng() < (b.owner === h ? 0.02 : 0.003)) { Input._shootPressed = true; Input.shootHeld = true; c = rng() * 1.8; }
    setCharge(c);
  },

  // ---------- drawing every state ----------
  // headless matches, but every few steps the frame is drawn for real with a rotating look:
  // each character, ball skin, stadium, trail and celebration, both quality levels
  render(opts = {}) {
    const matches = opts.matches || 12, errors = [], seen = new Set();
    const prev = { headless: Game.headless, save: JSON.stringify(Save.data), quality: Render.quality };
    Save.data.owned.character = CHARACTERS.map((c) => c.id); Save.data.owned.ball = BALLS.map((b) => b.id);
    Save.data.owned.trail = TRAILS.map((t) => t.id); Save.data.owned.celebration = CELEBRATIONS.map((c) => c.id); Save.data.owned.stadium = STADIUMS.map((s) => s.id); Save.data.owned.accessory = ACCESSORIES.map((a) => a.id);
    let frames = 0;
    for (let i = 0; i < matches; i++) {
      const ch = CHARACTERS[i % CHARACTERS.length];
      Object.assign(Save.data, { character: ch.id, ball: BALLS[i % BALLS.length].id, trail: TRAILS[i % TRAILS.length].id, celebration: CELEBRATIONS[i % CELEBRATIONS.length].id, stadium: STADIUMS[i % STADIUMS.length].id, accessory: ACCESSORIES[i % ACCESSORIES.length].id });
      Render.quality = i % 3;
      Game.headless = false;
      const club = CLUBS[i % CLUBS.length];
      const m = Match.create({ format: ['1v1', '2v2', '3v3', '4v4'][i % 4], club, minutes: 1, autopilot: true });
      m.autopilot = true; m.humanRarity = ch.rarity; m.meter.blue = CFG.POWER_MAX;
      Game.headless = true;
      Render.buildLayer();
      let steps = 0;
      while (m.phase !== 'over' && steps < 120 * 90) {
        Match.step(m, CFG.STEP); steps++;
        if (steps % 9 === 0 || m.phase !== 'play') {
          if (m.phase !== 'play' && steps % 3) continue;
          try { Render.updateCamera(m, CFG.STEP * 9); Render.drawMatch(m, steps / 120); frames++; seen.add(m.phase); }
          catch (e) { if (errors.length < 8) errors.push(ch.id + '/' + m.phase + ': ' + e.message + ' ' + ((e.stack || '').split('\n')[1] || '')); }
        }
      }
      // a few frames of each celebration pose and the home screen
      try { for (const p of m.players) { p.celebrateT = 1.2; p.celebKind = CELEBRATIONS[i % CELEBRATIONS.length].id; } Render.drawMatch(m, 1); Render.drawHome(1, null); frames += 2; }
      catch (e) { errors.push('celebrate/home: ' + e.message); }
    }
    Game.headless = prev.headless; Save.data = JSON.parse(prev.save); Render.quality = prev.quality; Render.resize();
    return { frames, phases: [...seen], errors };
  },

  // Every celebration with every accessory, sampled through the whole animation.
  // Draws into the same size as the shop card and reports exceptions or pixels cut by an edge.
  celebrations() {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 150;
    const g = cv.getContext('2d'), times = [0.04, 0.22, 0.48, 0.82, 1.2, 1.75, 2.25, 2.55];
    const issues = [], oldScreen = Sprites.celebScreen, look = { ...Save.look() };
    Sprites.celebScreen = () => {}; // screen-space confetti/words intentionally reach the card edge
    let frames = 0;
    try {
      for (const c of CELEBRATIONS) for (const acc of [null, ...ACCESSORIES.map((a) => a.id)]) for (const e of times) {
        const p = { team: 'blue', isKeeper: false, number: 10, look: { ...look, acc }, vx: CELE_MOVES[c.id] ? CELE_MOVES[c.id](e) : 0, vy: 0,
          fx: 1, fy: 0.25, faceX: 1, kickT: 0, kickDur: 0.2, celebrateT: CELE_TIME - e, celebKind: c.id,
          diveT: 0, stunT: 0, recoverT: 0, seed: 0, runPhase: e * 9, sad: false, slideT: 0, fallT: 0, hopT: 0 };
        const pose = CELE_POSES[c.id](e, e, p), lying = pose && pose.lie, ground = 136 - (lying ? 10 : pose && pose.kneel ? 12 : 0), scale = pose && Math.abs(pose.rot || 0) > 1 ? 0.82 : 0.9;
        g.clearRect(0, 0, cv.width, cv.height);
        try { Sprites.player(g, p, 80 + (lying === 'back' ? 23 : lying === 'front' ? -20 : 0), ground, scale, e); }
        catch (err) { issues.push(`${c.id}/${acc || 'none'} @${e}: ${err.message}`); continue; }
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let edge = false;
        for (let y = 0; y < cv.height && !edge; y++) for (const x of [0, 1, cv.width - 2, cv.width - 1]) if (d[(y * cv.width + x) * 4 + 3]) { edge = true; break; }
        for (let x = 0; x < cv.width && !edge; x++) for (const y of [0, 1, cv.height - 2, cv.height - 1]) if (d[(y * cv.width + x) * 4 + 3]) { edge = true; break; }
        if (edge && issues.length < 30) issues.push(`${c.id}/${acc || 'none'} @${e}: touches preview edge`);
        frames++;
      }
    } finally { Sprites.celebScreen = oldScreen; }
    return { celebrations: CELEBRATIONS.length, accessories: ACCESSORIES.length + 1, frames, issues };
  },
  // ---------- screens and flows ----------
  async ui() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const errors = [];
    const onErr = (e) => errors.push(e.message || String(e.reason || e));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onErr);
    const log = [];
    const step = async (name, fn, ms = 60) => {
      try { await fn(); await wait(ms); log.push('ok  ' + name); } catch (e) { log.push('ERR ' + name + ': ' + e.message); errors.push(name + ': ' + e.message); }
    };
    const click = (el) => { if (!el) throw new Error('missing element'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.click(); };
    const visible = (id) => !$(id).hidden;
    const snapshot = JSON.stringify(Save.data);
    Save.data.tutorialSeen = true;

    await step('splash away', () => { $('splash').classList.add('gone'); $('splash').hidden = true; $('daily').hidden = true; });
    await step('home refresh', () => UI.refreshHome());
    for (const kind of ['play', 'characters', 'customize', 'settings', 'profile']) {
      await step('open ' + kind, () => { UI.openModal(kind); if (!visible('modal')) throw new Error('modal hidden'); });
      await step('close ' + kind, () => { click($('modal-close')); if (visible('modal')) throw new Error('modal still open'); });
    }
    await step('customize tabs', async () => {
      UI.openModal('customize');
      for (const t of ['trail', 'ball', 'celebration', 'accessory', 'stadium']) { click(document.querySelector(`[data-tab="${t}"]`)); await wait(30); }
      UI.closeModal();
    });
    await step('buy with no coins', async () => {
      Save.data.coins = 0; UI.openModal('characters');
      const card = document.querySelector('.char-card-sm.locked');
      click(card); click(card);
      if (Save.data.owned.character.includes(card.dataset.id)) throw new Error('bought without coins');
      UI.closeModal();
    });
    await step('buy + equip character', async () => {
      Save.data.coins = 1000; UI.openModal('characters');
      const card = document.querySelector('.char-card-sm.locked[data-id="buzz"]');
      click(card); await wait(20); click(document.querySelector('.char-card-sm[data-id="buzz"]'));
      if (!Save.data.owned.character.includes('buzz')) throw new Error('not owned after buy');
      if (Save.data.coins !== 500) throw new Error('coins ' + Save.data.coins);
      if (Save.character().id !== 'buzz') throw new Error('not equipped');
      UI.closeModal();
    });
    await step('buy + equip ball', async () => {
      Save.data.coins = 400; UI._custTab = 'ball'; UI.openModal('customize');
      click(document.querySelector('.trail-opt[data-id="beach"]')); await wait(20);
      click(document.querySelector('.trail-opt[data-id="beach"]'));
      if (Save.ball().id !== 'beach') throw new Error('ball not equipped');
      UI.closeModal();
    });
    await step('settings toggles', async () => {
      UI.openModal('settings');
      for (const g of document.querySelectorAll('.seg')) for (const b of g.querySelectorAll('button')) { click(b); await wait(5); }
      // put sensible values back
      Object.assign(Save.data.settings, { difficulty: 'normal', minutes: 3, graphics: 'auto', controls: 'auto', vibration: true, minimap: true, replays: true });
      Render.quality = 0; Render.resize(); UI.applyControls();
      UI.closeModal();
    });
    await step('daily claim', async () => {
      Save.data.daily = { last: null, streak: 0 };
      const before = Save.data.coins;
      UI.maybeDaily();
      if (!visible('daily')) throw new Error('daily not shown');
      click($('daily-claim'));
      if (Save.data.coins !== before + DAILY[0]) throw new Error('coins not added');
      if (Daily.pending()) throw new Error('still pending');
    });
    await step('daily streak math', () => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      Save.data.daily = { last: Daily.key(d), streak: 7 };
      const p = Daily.pending();
      if (!p || p.day !== 1) throw new Error('day 7 should loop to 1, got ' + JSON.stringify(p));
      Save.data.daily = { last: Daily.key(d), streak: 3 };
      if (Daily.pending().day !== 4) throw new Error('streak did not continue');
      d.setDate(d.getDate() - 2);
      Save.data.daily = { last: Daily.key(d), streak: 3 };
      if (Daily.pending().day !== 1) throw new Error('missed day should reset');
      const f = new Date(); f.setDate(f.getDate() + 2);
      Save.data.daily = { last: Daily.key(f), streak: 3 };
      if (Daily.pending() !== null) throw new Error('future date should not pay');
      Save.data.daily = { last: Daily.key(), streak: 1 };
    });
    await step('profile claim', async () => {
      Save.data.goals = Math.max(1, Save.data.goals);
      delete Save.data.achievements.goal1;
      const before = Save.data.coins;
      UI.openModal('profile');
      click(document.querySelector('.claim[data-id="goal1"]'));
      if (Save.data.coins !== before + 50) throw new Error('claim did not pay');
      if (document.querySelector('.claim[data-id="goal1"]')) throw new Error('claim button still there');
      if (Achievements.claim('goal1')) throw new Error('double claim paid');
      UI.closeModal();
    });

    for (const format of ['1v1', '2v2', '3v3', '4v4']) {
      await step(`quick ${format}: start`, () => { Save.data.format = format; Game.startMatch({ mode: 'quick', club: Clubs.random() }); if (Game.state !== 'intro') throw new Error('state ' + Game.state); });
      await step(`quick ${format}: kick off`, () => { click($('intro-go')); if (Game.state !== 'match') throw new Error('state ' + Game.state); }, 400);
      await step(`quick ${format}: pause`, () => { click($('btn-pause')); if (Game.state !== 'paused' || !visible('pause')) throw new Error('not paused'); });
      await step(`quick ${format}: resume`, () => { click($('p-resume')); if (Game.state !== 'match') throw new Error('not resumed'); }, 300);
      await step(`quick ${format}: finish`, async () => {
        const m = Game.match; m.time = 0.05; m.score.blue = 2; m.goals.push({ team: 'blue' }, { team: 'blue' }); m.ball.shot = null;
        for (let i = 0; i < 80 && Game.state !== 'results'; i++) await wait(50);
        if (Game.state !== 'results' || !visible('results')) throw new Error('no results, state ' + Game.state + ' phase ' + m.phase);
      });
      await step(`quick ${format}: play again`, () => { click($('r-again')); if (Game.state !== 'intro') throw new Error('state ' + Game.state); });
      await step(`quick ${format}: restart from pause`, () => { Game.kickOff(); click($('btn-pause')); click($('p-restart')); if (Game.state !== 'intro') throw new Error('state ' + Game.state); });
      await step(`quick ${format}: quit`, () => { Game.kickOff(); click($('btn-pause')); click($('p-quit')); if (Game.state !== 'home' || !visible('home')) throw new Error('not home'); }, 200);
    }

    await step('cup: run to champion', async () => {
      Save.data.cup = null; const trophies = Save.data.trophies || 0;
      Cup.start();
      for (let round = 0; round < 3; round++) {
        Game.startMatch({ mode: 'cup' });
        Game.kickOff();
        const m = Game.match;
        if (m.club.id !== Save.data.cup.opponents[round]) throw new Error('wrong opponent in round ' + round);
        m.time = 0.05; m.score.blue = 1; m.goals.push({ team: 'blue' }); m.ball.shot = null;
        for (let i = 0; i < 80 && Game.state !== 'results'; i++) await wait(50);
        if (Game.state !== 'results') throw new Error('no results in round ' + round);
      }
      if ((Save.data.trophies || 0) !== trophies + 1) throw new Error('trophy not awarded');
      if (Cup.state()) throw new Error('cup still active');
      Game.goHome();
    });
    await step('cup: lose is out', async () => {
      Cup.start(); Game.startMatch({ mode: 'cup' }); Game.kickOff();
      const m = Game.match; m.time = 0.05; m.score.red = 1; m.goals.push({ team: 'red' }); m.ball.shot = null;
      for (let i = 0; i < 80 && Game.state !== 'results'; i++) await wait(50);
      if (Cup.state()) throw new Error('cup still active after a loss');
      click($('r-home'));
    });
    await step('training: no clock, quit', async () => {
      Game.startMatch({ mode: 'training', club: Clubs.get('denmark') }); Game.kickOff(); await wait(600);
      const m = Game.match;
      if (!m.training || m.time !== m.duration) throw new Error('clock moved in training');
      m.ball.owner = null; m.ball.x = CFG.FIELD_W + 30; m.ball.y = CFG.FIELD_H / 2; m.ball.lastKicker = m.human;
      for (let i = 0; i < 80 && m.phase !== 'kickoff'; i++) await wait(50);
      if (m.phase !== 'kickoff' && m.phase !== 'play') throw new Error('training stuck in ' + m.phase);
      if (Game.match.ball.owner && Game.match.ball.owner.team !== 'blue') throw new Error('red kicked off in training');
      Game.goHome();
    });
    await step('replay: plays and skips', async () => {
      Game.startMatch({ mode: 'quick', club: Clubs.get('denmark') }); Game.kickOff(); await wait(2600);
      const m = Game.match, h = m.human;
      m.phase = 'play';
      m.ball.owner = null; m.ball.shot = null; m.ball.lastKicker = h; m.ball.x = CFG.FIELD_W + 20; m.ball.y = CFG.FIELD_H / 2;
      for (let i = 0; i < 100 && m.phase !== 'replay'; i++) await wait(50);
      if (m.phase !== 'replay') throw new Error('no replay, phase ' + m.phase);
      if (!$('hud').classList.contains('replaying')) throw new Error('hud not in replay mode');
      await wait(400);
      click($('replay-skip'));
      await wait(200);
      if (m.phase === 'replay') throw new Error('skip did not work');
      for (let i = 0; i < 40 && m.phase !== 'play'; i++) await wait(50);
      if (m.phase !== 'play') throw new Error('did not return to play: ' + m.phase);
      if ($('hud').classList.contains('replaying')) throw new Error('hud stuck in replay mode');
      Game.goHome();
    });
    await step('how to play', () => { click($('btn-howto')); if (!visible('howto')) throw new Error('howto hidden'); click($('howto-ok')); if (visible('howto')) throw new Error('howto stuck'); });

    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onErr);
    Save.data = JSON.parse(snapshot); Save.write(); UI.refreshHome();
    return { errors, failed: log.filter((l) => l.startsWith('ERR')), steps: log.length };
  },
};
