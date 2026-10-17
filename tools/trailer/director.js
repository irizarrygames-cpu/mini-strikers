// The trailer: two minutes of the real game, rendered a frame at a time.
//
// Nothing here is a mock-up. The football is a real autopilot match stepped by the real Match
// code and drawn by the real Render code, with the real FX. The skill moves are fired with
// performSignature, the same call the skill button makes. The crates and players are drawn by
// the same UI.crateArt and UI.portrait the menus use. If it looks wrong in here, it looks wrong
// in the game.
//
// It is rendered a frame at a time rather than recorded in real time, so every frame lands —
// nothing is dropped because the machine was busy, and the running time is exact.
const Trailer = {
  W: 1920, H: 1080, FPS: 60, SECONDS: 120,
  INK: '#161a33', YELLOW: '#ffe14d', GOLD: '#ffc21a', WHITE: '#ffffff',

  // ---------------------------------------------------------------- setup
  // The game sizes itself to the window. For a trailer it sizes itself to the film instead.
  fit() {
    const cv = document.getElementById('game');
    cv.width = this.W; cv.height = this.H;
    // the backing store is the film; what the page shows is just a monitor for it
    cv.style.width = '960px'; cv.style.height = '540px';
    Render.canvas = cv;
    Render.ctx = cv.getContext('2d');
    Render.W = this.W; Render.H = this.H; Render.dpr = 1;
    Render.quality = 0;
    Render.S = Math.min(this.W / 700, this.H / 370);
    Render._layerKey = null;
    Render.buildLayer();
    Render.homeCrowd = null;
  },

  // ---------------------------------------------------------------- text, in the game's voice
  // Solid fill, thick dark outline, one hard shadow. No glows, no gradients — the same rules the
  // rest of the game is drawn by.
  say(text, x, y, size, color = '#ffffff', align = 'center') {
    const g = Render.ctx;
    g.save();
    g.font = `${size}px 'Lilita One', system-ui, sans-serif`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(6, size * 0.17);
    g.strokeStyle = this.INK;
    g.fillStyle = this.INK;
    g.fillText(text, x, y + size * 0.07);          // the hard drop, underneath
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.restore();
  },

  // Screen coordinates, please: the match leaves its own camera on the context.
  ui() { Render.ctx.setTransform(1, 0, 0, 1, 0, 0); return Render.ctx; },

  // a caption that slides up, holds, and drops away again
  caption(text, sub, k, len, color = '#ffe14d') {
    const inT = Math.min(1, k / 0.35), outT = Math.min(1, Math.max(0, (len - k) / 0.35));
    const a = Math.min(inT, outT);
    if (a <= 0) return;
    const ease = 1 - Math.pow(1 - a, 3);
    const g = this.ui();
    g.save();
    g.globalAlpha = ease;
    const y = this.H - 150 + (1 - ease) * 60;
    this.say(text, this.W / 2, y, 88, color);
    if (sub) this.say(sub, this.W / 2, y + 78, 40, '#ffffff');
    g.restore();
  },

  // a slab behind something, so the words on it can be read
  scrim(alpha = 0.45) {
    const g = Render.ctx;
    g.save(); this.ui();
    g.fillStyle = `rgba(22, 26, 51, ${alpha})`;
    g.fillRect(0, 0, this.W, this.H);
    g.restore();
  },

  // the game's own panel: flat fill, thick outline, hard shadow below it
  plate(x, y, w, h, fill = '#f2f5ff', r = 26) {
    const g = Render.ctx;
    g.save();
    const path = (dx, dy) => {
      g.beginPath();
      g.moveTo(x + r + dx, y + dy);
      g.arcTo(x + w + dx, y + dy, x + w + dx, y + h + dy, r);
      g.arcTo(x + w + dx, y + h + dy, x + dx, y + h + dy, r);
      g.arcTo(x + dx, y + h + dy, x + dx, y + dy, r);
      g.arcTo(x + dx, y + dy, x + w + dx, y + dy, r);
      g.closePath();
    };
    g.fillStyle = this.INK; path(0, 10); g.fill();
    g.fillStyle = fill; path(0, 0); g.fill();
    g.lineWidth = 7; g.strokeStyle = this.INK; path(0, 0); g.stroke();
    g.restore();
  },

  // The coin, drawn big. The same parts as the one in the corner of the screen: dark rim, gold
  // face, a ring pressed into it, a star inside that, one hard highlight, one hard shadow.
  coin(cx, cy, r, spin = 0) {
    const g = Render.ctx;
    g.save();
    // It turns, but never edge-on. A real coin vanishes for half its spin; a coin in a trailer
    // has to be a coin the whole time.
    const squash = 0.34 + 0.66 * Math.abs(Math.cos(spin));
    g.translate(cx, cy);
    g.scale(squash, 1);
    g.fillStyle = this.INK; g.beginPath(); g.arc(0, r * 0.1, r, 0, 7); g.fill();
    g.fillStyle = this.GOLD; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.lineWidth = r * 0.14; g.strokeStyle = this.INK; g.beginPath(); g.arc(0, 0, r - r * 0.07, 0, 7); g.stroke();
    g.fillStyle = '#d99a10'; g.beginPath(); g.arc(0, 0, r * 0.84, 0.5, 2.3); g.fill();      // the shadowed side
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(0, 0, r * 0.84, 3.6, 5.4); g.fill();      // the lit side
    g.fillStyle = this.GOLD; g.beginPath(); g.arc(0, 0, r * 0.7, 0, 7); g.fill();
    g.lineWidth = r * 0.07; g.strokeStyle = '#e8a81a'; g.beginPath(); g.arc(0, 0, r * 0.66, 0, 7); g.stroke();
    // the star pressed into the face
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.21 : r * 0.47;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath();
    g.fillStyle = '#fff0bd'; g.fill();
    g.lineWidth = r * 0.055; g.strokeStyle = '#c98c0a'; g.stroke();
    g.restore();
  },

  // ---------------------------------------------------------------- a repeatable match
  // The game leans on Math.random everywhere. Swap in a generator with a seed and the same seed
  // plays the same match, which is what lets a goal be found before it is filmed.
  seed(n) {
    if (!this._realRandom) this._realRandom = Math.random;
    let s = n >>> 0;
    Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  },
  unseed() { if (this._realRandom) Math.random = this._realRandom; },

  // The stands and the crowd are built the first time a club is drawn, out of a few hundred
  // random numbers. That build has to happen BEFORE the seed goes in — otherwise the first
  // filmed frame spends randoms that the silent run-through never did, every player ends up a
  // fraction out of place from then on, and the goal that was found becomes a save. It did.
  prime(club) {
    const m = Match.create({ autopilot: true, minutes: 30, club, format: '4v4' });
    Render.updateCamera(m, 0, true);
    Render.drawMatch(m, 0);
  },

  // Play matches through, unwatched, until one of them gives us a goal at our end. Returns the
  // seed that did it and the exact step the ball crossed the line.
  //
  // headless stays OFF through the search on purpose: the effects consume random numbers as
  // they are created, so a search that skipped them would drift out of step with the filmed run.
  // Counted in frames of film, through the film's own stepping, so there is nothing left for the
  // two runs to disagree about.
  findGoal(clubId, { frames = 2700, tries = 70 } = {}) {    // 45 seconds of play per attempt
    const club = Clubs.get(clubId) || Clubs.random(Clubs.mine());
    Clubs.setMatch(Clubs.mine(), club);                     // before the seed, in both runs
    this.prime(club);
    const dt = 1 / this.FPS;
    for (let n = 1; n <= tries; n++) {
      const seed = n * 48271 + 7919;
      this.seed(seed);
      Game.headless = false;
      this.acc = 0;
      FX.clear();
      const m = Match.create({ autopilot: true, minutes: 30, club, format: '4v4' });
      m.demo = true;
      m.phase = 'play';
      for (let f = 0; f < frames; f++) {
        const before = m.score.blue;
        this.step(m, dt);
        if (m.score.blue > before) return { seed, frame: f };
      }
    }
    return null;
  },

  // The same match again, wound forward to `lead` seconds before the goal, with the camera
  // snapped on and the effects wiped clean. Nothing from the run-through is left behind.
  goalRun(clubId, lead) {
    const found = this.findGoal(clubId);
    if (!found) return this.kickOff(clubId);          // no goal to be had: ordinary football
    const club = Clubs.get(clubId) || Clubs.random(Clubs.mine());
    Clubs.setMatch(Clubs.mine(), club);               // before the seed, exactly as the search did
    this.prime(club);
    this.seed(found.seed);
    Game.headless = false;
    this.acc = 0;
    FX.clear();
    const m = Match.create({ autopilot: true, minutes: 30, club, format: '4v4' });
    m.demo = true;
    m.phase = 'play';
    // wound forward, unwatched, to `lead` seconds before the ball crosses the line
    const dt = 1 / this.FPS;
    const preRoll = Math.max(0, found.frame - Math.round(lead * this.FPS));
    for (let f = 0; f < preRoll; f++) this.step(m, dt);
    FX.clear();                                       // the dust of the wind-forward is not ours
    Render.updateCamera(m, 0, true);
    m.goalAt = (found.frame - preRoll) / this.FPS;    // when it is going to happen, for the caption
    return m;
  },

  // ---------------------------------------------------------------- the football
  kickOff(clubId) {
    Game.headless = false;
    this.acc = 0;
    FX.clear();
    const club = Clubs.get(clubId) || Clubs.random(Clubs.mine());
    Clubs.setMatch(Clubs.mine(), club);
    const m = Match.create({ autopilot: true, minutes: 30, club, format: '4v4' });
    m.demo = true;
    m.phase = 'play';
    Render.updateCamera(m, 0, true);
    return m;
  },

  // The engine wants fixed steps of CFG.STEP (1/120 of a second) and nothing else. A frame of
  // film is 1/60, so each one is two of them. Handing it 1/60 as a single step ran the game at
  // double speed, which is how a goal the search had found turned into a save.
  step(m, dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= CFG.STEP && n < 8) { Match.step(m, CFG.STEP); this.acc -= CFG.STEP; n++; }
    FX.update(dt * (m.timeScale || 1), dt);
    Render.updateCamera(m, dt);
  },

  // ---------------------------------------------------------------- offscreen art
  // The menus draw into small canvases. The trailer borrows the same calls and blows the result
  // up onto the film, so a crate in here is the crate you tap in the game.
  chip(size, draw) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    draw(cv);
    return cv;
  },

  // ---------------------------------------------------------------- the running order
  build() {
    const S = [];
    const add = (len, setup, frame) => { S.push({ at: S.length ? S[S.length - 1].at + S[S.length - 1].len : 0, len, setup, frame }); };
    const T = this;

    // --- 1. the game, and the name of it
    add(7, function () { this.m = T.kickOff('brazil'); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      const a = Math.min(1, k / 0.6);
      T.scrim(0.52 * Math.min(1, Math.max(0, (6.2 - k) / 0.8)) * a);
      if (k < 6.2) {
        const pop = Math.min(1, k / 0.5), e = 1 - Math.pow(1 - pop, 4);
        const g = T.ui();
        g.save();
        g.globalAlpha = Math.min(1, (6.2 - k) / 0.6);
        g.translate(T.W / 2, T.H / 2 - 40);
        g.scale(0.7 + e * 0.3, 0.7 + e * 0.3);
        g.rotate(-0.045);
        T.say('Mini', -T.W * 0.145, 0, 190, T.YELLOW);
        T.say('Strikers', T.W * 0.115, 0, 190, T.WHITE);
        g.restore();
        if (k > 1.1) T.say('A KID’S GAME OF FOOTBALL', T.W / 2, T.H / 2 + 125, 54, T.WHITE);
      }
    });

    // --- 2. a goal, with everything that now comes with one
    add(19, function () { this.m = T.goalRun('argentina', 13); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      const goal = this.m.goalAt !== undefined ? this.m.goalAt : 13;
      if (k < 4) T.caption('REAL FOOTBALL', 'FOUR A SIDE, NO FOULS, NO OFFSIDE', k, 4);
      else if (k > goal - 0.3 && k < this.len - 0.4) T.caption('EVERY GOAL IS AN EVENT', 'CONFETTI, RINGS AND A SHAKE OF THE GROUND', k - (goal - 0.3), 5);
    });

    // --- 3. the moves
    const show = ['infinityturn', 'thunderstep', 'goatwalk', 'eclipsestep', 'phoenix', 'riptide', 'blackout', 'novastep', 'timeskip', 'matador'];
    add(26, function () {
      this.m = T.kickOff('spain');
      this.i = -1;
      this.each = 26 / show.length;
    }, function (k, dt) {
      const i = Math.min(show.length - 1, Math.floor(k / this.each));
      if (i !== this.i) {
        // a clean stage each time: the player, the ball, and room to work
        this.i = i;
        const p = this.m.players.find((q) => q.team === 'blue' && !q.isKeeper);
        // the move a player performs is the one on the player, not the one in your save —
        // and an autopilot match hands everyone Classic, which is why this was showing HOP!
        p.skillId = show[i];
        p.x = CFG.FIELD_W * 0.5; p.y = CFG.FIELD_H * 0.5;
        p.vx = 0; p.vy = 0; p.fx = 1; p.fy = 0; p.faceX = 1;
        p.skillCd = 0; p.skill = null; p.stunT = 0; p.fallT = 0; p.hopT = 0;
        this.m.ball.owner = p; this.m.ball.x = p.x; this.m.ball.y = p.y; this.m.ball.z = 0;
        // a few opponents to do it to
        const foes = this.m.players.filter((q) => q.team === 'red' && !q.isKeeper);
        foes.forEach((q, n) => { q.x = p.x + 120 + n * 46; q.y = p.y - 40 + n * 42; q.vx = 0; q.vy = 0; q.stunT = 0; q.fallT = 0; });
        Render.cam.x = p.x; Render.cam.y = p.y * CFG.TILT;
        this.fireAt = k + 0.55;
        this.fired = false;
      }
      if (!this.fired && k >= this.fireAt) {
        const p = this.m.players.find((q) => q.team === 'blue' && !q.isKeeper);
        performSignature(this.m, p, 1, -0.15);
        this.fired = true;
      }
      T.step(this.m, dt);
      // hold the shot on whoever is doing the move
      {
        const p = this.m.players.find((q) => q.team === 'blue' && !q.isKeeper);
        if (p) { Render.cam.x += (p.x - Render.cam.x) * 0.25; Render.cam.y += (p.y * CFG.TILT - Render.cam.y) * 0.25; }
      }
      Render.drawMatch(this.m, k);
      T.ui();
      const def = skillDef(show[i]);
      const into = k - i * this.each;
      if (k < 3.6) T.caption('41 SIGNATURE MOVES', 'ONE BUTTON. FORTY-ONE ANSWERS.', k, 3.6);
      else if (into > 0.35) T.say(def.name.toUpperCase(), T.W / 2, 140, 84, def.color || T.YELLOW);
      if (into > 0.6 && k > 3.6) T.say(RARITIES[def.rarity] ? RARITIES[def.rarity].name : '', T.W / 2, 220, 46, RARITIES[def.rarity] ? RARITIES[def.rarity].color : T.WHITE);
    });

    // --- 4. the coin
    add(13, function () { this.m = T.kickOff('france'); this.bits = []; }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.62);
      const spin = k * 1.5;
      const bob = Math.sin(k * 2.4) * 18;
      T.coin(T.W / 2, T.H / 2 - 40 + bob, 210, spin);
      T.caption('A NEW COIN', 'AND IT GOES SOMEWHERE WHEN YOU SPEND IT', k, 13, T.GOLD);
      // a shower of them, thrown and falling
      if (k > 2) {
        const n = 26;
        for (let i = 0; i < n; i++) {
          const seed = i * 97.13;
          const life = ((k - 2 + (seed % 3.7)) % 3.7) / 3.7;
          const x = ((seed * 7.3) % T.W);
          const y = -60 + life * (T.H + 160);
          T.coin(x, y, 30, seed + k * 3);
        }
      }
    });

    // --- 5. crates
    add(15, function () {
      this.m = T.kickOff('england');
      this.art = CRATES.map((c) => T.chip(320, (cv) => UI.crateArt(cv, c)));
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.68);
      const g = Render.ctx;
      g.save();
      // the whole ladder, drifting past
      const cols = 5, cw = 330, ch = 300;
      const scroll = Math.min(1, Math.max(0, (k - 1.2) / 10)) * (Math.ceil(CRATES.length / cols) * ch - 430);
      for (let i = 0; i < CRATES.length; i++) {
        const cx = T.W / 2 + ((i % cols) - (cols - 1) / 2) * cw;
        const cy = 330 + Math.floor(i / cols) * ch - scroll;
        if (cy < -200 || cy > T.H + 200) continue;
        const pop = Math.min(1, Math.max(0, (k - 0.6 - i * 0.07) / 0.4));
        if (pop <= 0) continue;
        g.save();
        g.globalAlpha = pop;
        g.translate(cx, cy);
        g.scale(0.82 + pop * 0.18, 0.82 + pop * 0.18);
        g.drawImage(this.art[i], -140, -150, 280, 280);
        g.restore();
        T.say(CRATES[i].name.replace(' CRATE', ''), cx, cy + 150, 40, CRATES[i].color);
      }
      g.restore();
      T.caption('FIFTEEN CRATES', 'FROM 800 COINS TO 900,000', k, 15, T.WHITE);
    });

    // --- 6. make it yours
    add(14, function () {
      this.m = T.kickOff('germany');
      const picks = CHARACTERS.filter((c) => !c.only).slice(-10);
      // the character definition is the look, the same way the characters panel draws them
      this.faces = picks.map((c) => T.chip(300, (cv) => UI.portrait(cv, c)));
      this.names = picks.map((c) => c.name);
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.66);
      const g = Render.ctx;
      g.save();
      const cols = 5, cw = 330, rh = 340;
      for (let i = 0; i < this.faces.length; i++) {
        const cx = T.W / 2 + ((i % cols) - (cols - 1) / 2) * cw;
        const cy = 325 + Math.floor(i / cols) * rh;
        const pop = Math.min(1, Math.max(0, (k - 0.4 - i * 0.09) / 0.45));
        if (pop <= 0) continue;
        const e = 1 - Math.pow(1 - pop, 3);
        g.save();
        g.globalAlpha = e;
        g.translate(cx, cy + (1 - e) * 40);
        T.plate(-130, -140, 260, 260, '#f2f5ff');
        g.drawImage(this.faces[i], -120, -130, 240, 240);
        g.restore();
        T.say(this.names[i].toUpperCase(), cx, cy + 155, 36, T.WHITE);
      }
      g.restore();
      T.caption('MAKE IT YOURS', 'PLAYERS, BALLS, TRAILS, CELEBRATIONS', k, 14, '#6fd3ff');
    });

    // --- 7. online
    add(14, function () { this.m = T.kickOff('japan'); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.66);
      const g = Render.ctx;
      g.save();
      const tiers = RANK_TIERS;
      const w = (T.W - 260) / tiers.length;        // a margin each side, so LEGEND stays on screen
      for (let i = 0; i < tiers.length; i++) {
        const cx = T.W / 2 + (i - (tiers.length - 1) / 2) * w;
        const pop = Math.min(1, Math.max(0, (k - 0.5 - i * 0.13) / 0.4));
        if (pop <= 0) continue;
        const e = 1 - Math.pow(1 - pop, 3);
        const h = 60 + i * 44;
        g.save();
        g.globalAlpha = e;
        T.plate(cx - w * 0.34, 620 - h, w * 0.68, h, tiers[i].color, 16);
        g.restore();
        T.say(tiers[i].name, cx, 680, 34, T.WHITE);
      }
      g.restore();
      if (k < 6) T.caption('PLAY THE WORLD', 'RANKED, CUPS, FRIENDS AND PARTIES', k, 6, T.YELLOW);
      else T.caption('AND THE BOTS MATCH YOUR RANK', 'CLIMB, AND THEY CLIMB WITH YOU', k - 6, 8, T.YELLOW);
    });

    // --- 8. one more goal, and where to find it
    add(12, function () { this.m = T.goalRun('italy', 2.5); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      if (k > 5.4) {
        T.scrim(Math.min(0.78, (k - 5.4) / 1.2 * 0.78));
        const e = Math.min(1, (k - 5.6) / 0.5);
        if (e > 0) {
          const g = Render.ctx;
          g.save();
          g.globalAlpha = e;
          g.translate(T.W / 2, T.H / 2 - 70);
          const s = 0.8 + (1 - Math.pow(1 - e, 3)) * 0.2;
          g.scale(s, s); g.rotate(-0.045);
          T.say('Mini', -T.W * 0.145, 0, 190, T.YELLOW);
          T.say('Strikers', T.W * 0.115, 0, 190, T.WHITE);
          g.restore();
        }
        if (k > 6.6) T.say('FREE IN YOUR BROWSER', T.W / 2, T.H / 2 + 110, 58, T.WHITE);
        if (k > 7.4) T.say('mini-strikers.onrender.com', T.W / 2, T.H / 2 + 210, 72, T.YELLOW);
      }
    });

    for (const s of S) s.lenMinus = function (n) { return this.len - n; }.bind(s);
    return S;
  },

  // ---------------------------------------------------------------- render and encode
  async run(opts = {}) {
    const seconds = opts.seconds || this.SECONDS;
    const total = Math.round(seconds * this.FPS);
    const dt = 1 / this.FPS;
    const TS = 90000, dur = TS / this.FPS;

    this.fit();
    this.seed(opts.seed || 20261017);     // the same two minutes every time it is rendered
    const scenes = this.build();
    const state = window.__tr = { frame: 0, total, done: false, blob: null, scene: '', error: null };

    const samples = [];
    let avcC = null;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description);
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data, duration: dur, isKey: chunk.type === 'key' });
      },
      error: (e) => { state.error = String(e); },
    });
    enc.configure({
      codec: 'avc1.640028', width: this.W, height: this.H,
      bitrate: opts.bitrate || 9000000, framerate: this.FPS,
      latencyMode: 'quality', avc: { format: 'avc' },
    });

    // a yield that a hidden tab does not throttle — setTimeout would be clamped to a second
    const breathe = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

    let si = -1, prev = null;
    for (let f = 0; f < total; f++) {
      const t = f / this.FPS;
      let s = scenes[scenes.length - 1], idx = scenes.length - 1;
      for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].at && t < scenes[i].at + scenes[i].len) { s = scenes[i]; idx = i; break; }
      if (idx !== si) { si = idx; prev = s; s.setup.call(s); state.scene = 'scene ' + (idx + 1) + '/' + scenes.length; }
      try {
        s.frame.call(s, t - s.at, dt);
      } catch (e) {
        state.error = 'scene ' + (idx + 1) + ' frame ' + f + ': ' + e.message;
        break;
      }
      const frame = new VideoFrame(Render.canvas, { timestamp: Math.round((f * 1e6) / this.FPS), duration: Math.round(1e6 / this.FPS) });
      enc.encode(frame, { keyFrame: f % (this.FPS * 2) === 0 });
      frame.close();
      state.frame = f + 1;
      // let the encoder keep up rather than piling two minutes of raw 1080p into memory
      if (enc.encodeQueueSize > 8) { while (enc.encodeQueueSize > 4) await breathe(); }
      else if ((f & 7) === 0) await breathe();
    }

    await enc.flush();
    enc.close();
    this.unseed();
    state.blob = MP4.build({ samples, width: this.W, height: this.H, timescale: TS, avcC });
    state.done = true;
    state.bytes = state.blob.size;
    return state;
  },
};
