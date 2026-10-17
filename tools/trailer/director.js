// The trailer: two minutes of the real game, rendered a frame at a time, cut to its own music.
//
// Nothing here is a mock-up. The football is a real autopilot match stepped by the real Match
// code and drawn by the real Render code, with the real FX. The skill moves are fired with
// performSignature and the overheads with performUlt — the same calls the buttons make. Crates,
// players, balls, trails, accessories and celebrations are drawn by the same UI.crateArt,
// UI.portrait, UI.ballSwatch, UI.trailSwatch, UI.accSwatch and UI.celebSwatch the menus use. If
// it looks wrong in here, it looks wrong in the game.
//
// It is rendered a frame at a time rather than screen-recorded, so every frame lands and the
// running time is exact. The music is 120 beats a minute, which makes a bar two seconds and a
// four-bar phrase eight — so each of the fifteen scenes is one phrase long and every cut falls
// on the music without anybody counting frames.
const Trailer = {
  W: 1920, H: 1080, FPS: 60, SECONDS: 120,
  PHRASE: 8,                                   // one four-bar phrase of the music
  INK: '#161a33', YELLOW: '#ffe14d', GOLD: '#ffc21a', WHITE: '#ffffff',
  acc: 0,

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
    // a spare sheet, for the effects that need the finished frame handed back to them
    this.scratch = this.scratch || document.createElement('canvas');
    this.scratch.width = this.W; this.scratch.height = this.H;
    this.sctx = this.scratch.getContext('2d');
  },

  // ---------------------------------------------------------------- text, in the game's voice
  // Solid fill, thick dark outline, one hard shadow. No glows, no gradients — the same rules the
  // rest of the game is drawn by. Draws in whatever transform it is handed.
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
    const a = Math.min(Math.min(1, k / 0.3), Math.min(1, Math.max(0, (len - k) / 0.3)));
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
    g.fillStyle = '#d99a10'; g.beginPath(); g.arc(0, 0, r * 0.84, 0.5, 2.3); g.fill();
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(0, 0, r * 0.84, 3.6, 5.4); g.fill();
    g.fillStyle = this.GOLD; g.beginPath(); g.arc(0, 0, r * 0.7, 0, 7); g.fill();
    g.lineWidth = r * 0.07; g.strokeStyle = '#e8a81a'; g.beginPath(); g.arc(0, 0, r * 0.66, 0, 7); g.stroke();
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

  // ---------------------------------------------------------------- effects over the top
  // All hard-edged: a punch in, a shake, a flash, a wipe. Nothing blurred and nothing glowing,
  // because that is not how this game is drawn.

  // Zoom into the middle of the finished frame. The frame is copied to a spare sheet and drawn
  // back bigger, which is the only way to magnify a picture that is already painted.
  punch(amount, shake = 0) {
    if (amount <= 0.001 && shake <= 0.001) return;
    const g = this.ui();
    this.sctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sctx.clearRect(0, 0, this.W, this.H);
    this.sctx.drawImage(Render.canvas, 0, 0);
    const s = 1 + amount;
    const dx = shake ? (Math.random() * 2 - 1) * shake : 0;
    const dy = shake ? (Math.random() * 2 - 1) * shake : 0;
    g.save();
    g.translate(this.W / 2 + dx, this.H / 2 + dy);
    g.scale(s, s);
    g.drawImage(this.scratch, -this.W / 2, -this.H / 2);
    g.restore();
  },

  flash(alpha, color = '#ffffff') {
    if (alpha <= 0.001) return;
    const g = this.ui();
    g.save();
    g.globalAlpha = Math.min(1, alpha);
    g.fillStyle = color;
    g.fillRect(0, 0, this.W, this.H);
    g.restore();
  },

  // the opening of a scene: a flash and a punch that settle in a third of a second
  hit(k, strength = 1) {
    if (k > 0.34) return;
    const t = 1 - k / 0.34;
    this.punch(0.09 * t * strength);
    this.flash(0.4 * t * t * strength);
  },

  // The game shouts its own headline at a goal. That belongs in the scenes that are about a
  // goal, and gets in the way of the ones that are about something else.
  hush() { if (!this._banner) this._banner = FX.showBanner.bind(FX); FX.showBanner = () => {}; },
  unhush() { if (this._banner) FX.showBanner = this._banner; },

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
  // filmed frame spends randoms the silent run-through never did, and the goal that was found
  // becomes a save. It did.
  prime(club) {
    const m = Match.create({ autopilot: true, minutes: 30, club, format: '4v4' });
    Render.updateCamera(m, 0, true);
    Render.drawMatch(m, 0);
  },

  // Play matches through, unwatched, until one of them gives us a goal at our end. Counted in
  // frames of film, through the film's own stepping, so there is nothing left for the two runs
  // to disagree about.
  findGoal(clubId, { frames = 2700, tries = 70 } = {}) {
    const club = Clubs.get(clubId) || Clubs.random(Clubs.mine());
    Clubs.setMatch(Clubs.mine(), club);
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
  // snapped on and the effects wiped clean.
  goalRun(clubId, lead) {
    const found = this.findGoal(clubId);
    if (!found) return this.kickOff(clubId);
    const club = Clubs.get(clubId) || Clubs.random(Clubs.mine());
    Clubs.setMatch(Clubs.mine(), club);
    this.prime(club);
    this.seed(found.seed);
    Game.headless = false;
    this.acc = 0;
    FX.clear();
    const m = Match.create({ autopilot: true, minutes: 30, club, format: '4v4' });
    m.demo = true;
    m.phase = 'play';
    const dt = 1 / this.FPS;
    const preRoll = Math.max(0, found.frame - Math.round(lead * this.FPS));
    for (let f = 0; f < preRoll; f++) this.step(m, dt);
    FX.clear();                                    // the dust of the wind-forward is not ours
    Render.updateCamera(m, 0, true);
    m.goalAt = (found.frame - preRoll) / this.FPS;
    return m;
  },

  // ---------------------------------------------------------------- the football
  kickOff(clubId, format = '4v4') {
    Game.headless = false;
    this.acc = 0;
    FX.clear();
    const club = Clubs.get(clubId) || Clubs.random(Clubs.mine());
    Clubs.setMatch(Clubs.mine(), club);
    const m = Match.create({ autopilot: true, minutes: 30, club, format });
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
    while (this.acc >= CFG.STEP && n < 12) { Match.step(m, CFG.STEP); this.acc -= CFG.STEP; n++; }
    FX.update(dt * (m.timeScale || 1), dt);
    Render.updateCamera(m, dt);
  },

  // hold the camera on somebody, rather than letting it chase the ball
  watch(p, grip = 0.25) {
    if (!p) return;
    Render.cam.x += (p.x - Render.cam.x) * grip;
    Render.cam.y += (p.y * CFG.TILT - Render.cam.y) * grip;
  },

  striker(m) { return m.players.find((q) => q.team === 'blue' && !q.isKeeper); },

  // clear a space in the middle of the pitch, with a few defenders to do it to
  stage(m, skillId) {
    const p = this.striker(m);
    if (!p) return null;
    if (skillId) p.skillId = skillId;
    p.x = CFG.FIELD_W * 0.5; p.y = CFG.FIELD_H * 0.5;
    p.vx = 0; p.vy = 0; p.fx = 1; p.fy = 0; p.faceX = 1;
    p.skillCd = 0; p.skill = null; p.stunT = 0; p.fallT = 0; p.hopT = 0; p.slideT = 0;
    m.ball.owner = p; m.ball.x = p.x; m.ball.y = p.y; m.ball.z = 0;
    m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
    const foes = m.players.filter((q) => q.team === 'red' && !q.isKeeper);
    foes.forEach((q, n) => {
      q.x = p.x + 115 + n * 44; q.y = p.y - 46 + n * 44;
      q.vx = 0; q.vy = 0; q.stunT = 0; q.fallT = 0; q.slideT = 0;
    });
    Render.cam.x = p.x; Render.cam.y = p.y * CFG.TILT;
    return p;
  },

  // ---------------------------------------------------------------- offscreen art
  // The menus draw into small canvases. The trailer borrows the same calls and blows the result
  // up onto the film, so a crate in here is the crate you tap in the game.
  chip(w, draw, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h || w;
    try { draw(cv); } catch (e) { /* one awkward swatch must not take the film down */ }
    return cv;
  },

  // A wall of things, scrolling by. Used for the players, the kit and the celebrations — there
  // are far too many of any of them to sit still and look at.
  wall(g, art, k, { cols, cw, chh, from = 0, speed = 90 }) {
    const top = 240;
    const scroll = Math.max(0, k - from) * speed;
    for (let i = 0; i < art.length; i++) {
      const cx = this.W / 2 + ((i % cols) - (cols - 1) / 2) * cw;
      const cy = top + Math.floor(i / cols) * chh - scroll;
      if (cy < -chh || cy > this.H + chh) continue;
      const pop = Math.min(1, Math.max(0, (k - 0.2 - (i % cols) * 0.035 - Math.floor(i / cols) * 0.05) / 0.3));
      if (pop <= 0) continue;
      const e = 1 - Math.pow(1 - pop, 3);
      g.save();
      g.globalAlpha = e;
      g.translate(cx, cy);
      g.scale(0.84 + e * 0.16, 0.84 + e * 0.16);
      const a = art[i];
      g.drawImage(a, -a.width / 2, -a.height / 2);
      g.restore();
    }
  },

  // ---------------------------------------------------------------- sound
  // The esds box: a small tree of descriptors wrapped around the handful of bytes WebCodecs
  // gives back. Every length here fits in one byte at these sizes, which keeps it readable.
  esds(asc) {
    const d = (tag, body) => Uint8Array.from([tag, body.length, ...body]);
    const dsi = d(0x05, [...asc]);
    const dcd = d(0x04, [0x40, 0x15, 0x00, 0x18, 0x00, 0x00, 0x02, 0xee, 0x00, 0x00, 0x02, 0xee, 0x00, ...dsi]);
    const sl = d(0x06, [0x02]);
    const es = d(0x03, [0x00, 0x00, 0x00, ...dcd, ...sl]);
    return Uint8Array.from([0, 0, 0, 0, ...es]);              // version and flags first
  },

  async music(seconds) {
    if (typeof Music === 'undefined' || typeof AudioEncoder === 'undefined') return null;
    const pcm = await Music.render(seconds);
    const rate = pcm.sampleRate, channels = pcm.numberOfChannels;
    const samples = [];
    let asc = null;
    const enc = new AudioEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description) asc = new Uint8Array(meta.decoderConfig.description);
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data, duration: 1024, isKey: true });   // an AAC frame is 1024 samples
      },
      error: (e) => { this._audioError = String(e); },
    });
    enc.configure({ codec: 'mp4a.40.2', sampleRate: rate, numberOfChannels: channels, bitrate: 192000 });
    const CHUNK = 1024 * 32;
    const chans = [];
    for (let c = 0; c < channels; c++) chans.push(pcm.getChannelData(c));
    for (let at = 0; at < pcm.length; at += CHUNK) {
      const n = Math.min(CHUNK, pcm.length - at);
      const planar = new Float32Array(n * channels);           // AudioData wants it planar
      for (let c = 0; c < channels; c++) planar.set(chans[c].subarray(at, at + n), c * n);
      const frame = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((at / rate) * 1e6), data: planar });
      enc.encode(frame);
      frame.close();
    }
    await enc.flush();
    enc.close();
    if (!asc || !samples.length) return null;
    return { samples, sampleRate: rate, channels, timescale: rate, esds: this.esds(asc) };
  },

  // ---------------------------------------------------------------- the running order
  // Fifteen scenes, one four-bar phrase each, so every cut lands on the music.
  build() {
    const T = this;
    const S = [];
    const add = (setup, frame) => S.push({ at: S.length * T.PHRASE, len: T.PHRASE, setup, frame });

    // --- 1 (0:00) the game, and the name of it
    add(function () { this.m = T.kickOff('brazil'); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.5);
      const e = 1 - Math.pow(1 - Math.min(1, k / 0.45), 4);
      const g = T.ui();
      g.save();
      g.globalAlpha = Math.min(1, Math.max(0, (T.PHRASE - 0.4 - k) / 0.5));
      g.translate(T.W / 2, T.H / 2 - 40);
      g.scale(0.72 + e * 0.28, 0.72 + e * 0.28);
      g.rotate(-0.045);
      T.say('Mini', -T.W * 0.145, 0, 190, T.YELLOW);
      T.say('Strikers', T.W * 0.115, 0, 190, T.WHITE);
      g.restore();
      if (k > 1.0 && k < T.PHRASE - 0.5) T.say('A KID’S GAME OF FOOTBALL', T.W / 2, T.H / 2 + 125, 54, T.WHITE);
      if (k < 0.5) T.flash(0.5 * (1 - k / 0.5));
      if (k < 0.3) T.punch(0.07 * (1 - k / 0.3));
    });

    // --- 2 (0:08) football, with a punch in on every bar
    add(function () { this.m = T.kickOff('argentina'); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      const intoBar = k % 2;
      if (intoBar < 0.3) T.punch(0.06 * (1 - intoBar / 0.3));
      T.caption('REAL FOOTBALL', 'FOUR A SIDE. NO FOULS, NO OFFSIDE.', k, T.PHRASE);
      T.hit(k);
    });

    // --- 3 (0:16) a real goal, and what now comes with one
    add(function () { this.m = T.goalRun('argentina', 5.2); }, function (k, dt) {
      const goal = this.m.goalAt !== undefined ? this.m.goalAt : 5.2;
      const since = k - goal;
      // the ball crosses, and the world slows down for a moment
      const scale = since > 0 && since < 1.4 ? 0.28 + 0.72 * Math.min(1, since / 1.4) : 1;
      T.step(this.m, dt * scale);
      Render.drawMatch(this.m, k);
      T.ui();
      if (since > 0 && since < 0.5) { T.flash(0.5 * (1 - since / 0.5)); T.punch(0.12 * (1 - since / 0.5), 8); }
      else if (since >= 0.5 && since < 1.6) T.punch(0.05 * (1 - (since - 0.5) / 1.1));
      if (k < goal - 0.2) T.caption('EVERY GOAL IS AN EVENT', 'CONFETTI, RINGS, AND THE GROUND SHAKES', k, goal - 0.2);
      else if (since > 0.55) T.caption('GOAL!', null, since - 0.55, T.PHRASE - goal - 0.55, T.YELLOW);
      T.hit(k);
    });

    // --- 4 and 5 (0:24, 0:32) ten signature moves
    const movesA = ['infinityturn', 'thunderstep', 'goatwalk', 'eclipsestep', 'riptide'];
    const movesB = ['phoenix', 'blackout', 'novastep', 'timeskip', 'starfall'];
    const montage = (list, club, capTitle, capSub) => [
      function () { T.hush(); this.m = T.kickOff(club); this.i = -1; this.each = T.PHRASE / list.length; },
      function (k, dt) {
        const i = Math.min(list.length - 1, Math.floor(k / this.each));
        if (i !== this.i) { this.i = i; T.stage(this.m, list[i]); this.fireAt = k + 0.42; this.fired = false; }
        if (!this.fired && k >= this.fireAt) { performSignature(this.m, T.striker(this.m), 1, -0.15); this.fired = true; }
        T.step(this.m, dt);
        T.watch(T.striker(this.m), 0.3);
        Render.drawMatch(this.m, k);
        T.ui();
        const into = k - i * this.each;
        const def = skillDef(list[i]);
        // each move lands with a punch and a flash in its own colour
        if (into > 0.42 && into < 0.72) {
          const t = 1 - (into - 0.42) / 0.3;
          T.punch(0.1 * t, 6 * t);
          T.flash(0.3 * t, def.color || '#ffffff');
        }
        if (into > 0.3) {
          T.say(def.name.toUpperCase(), T.W / 2, 150, 86, def.color || T.YELLOW);
          const r = RARITIES[def.rarity];
          if (r) T.say(r.name, T.W / 2, 232, 46, r.color);
        }
        if (capTitle && k < 2.6) T.caption(capTitle, capSub, k, 2.6);
        T.hit(k);
      },
    ];
    add(...montage(movesA, 'spain', '41 SIGNATURE MOVES', 'ONE BUTTON. FORTY-ONE ANSWERS.'));
    add(...montage(movesB, 'germany', null, null));

    // --- 6 (0:40) the overheads
    // performUlt turns the power on, but it only answers to a human with a full meter — an
    // autopilot match has neither, which is why asking it politely produced a shrug and the AI
    // carried on playing. ultShot is the strike itself, and forcing p.sig picks which of the
    // four it does, so all four get shown rather than whichever came up.
    add(function () {
      T.hush();
      this.m = T.kickOff('france');
      this.i = -1;
      this.each = T.PHRASE / ULT_KINDS.length;
    }, function (k, dt) {
      const i = Math.min(ULT_KINDS.length - 1, Math.floor(k / this.each));
      if (i !== this.i) {
        this.i = i;
        const p = T.stage(this.m, 'classic');
        if (p) {
          const dir = TEAMS.blue.dir;
          p.x = attackGoalX('blue') - dir * 230; p.y = CFG.FIELD_H / 2 + 30;
          p.fx = dir; p.fy = 0; p.faceX = dir;
          p.sig = ULT_KINDS[i];                 // this one, not a random one
          p.ult = CFG.ULT_MAX; p.ultOn = true;
          const b2 = this.m.ball;
          b2.owner = p; b2.x = p.x + dir * 16; b2.y = p.y; b2.z = 30; b2.vx = 0; b2.vy = 0; b2.vz = 0;
          try { ultShot(this.m, p); } catch (e) { /* the football carries on regardless */ }
          Render.cam.x = p.x; Render.cam.y = p.y * CFG.TILT;
        }
      }
      T.step(this.m, dt);
      T.watch(T.striker(this.m), 0.18);
      Render.drawMatch(this.m, k);
      try { UltCut.draw(Render.ctx, this.m, k); } catch (e) {}
      T.ui();
      const into = k - i * this.each;
      if (into > 0.05 && into < 0.5) { const t = 1 - (into - 0.05) / 0.45; T.punch(0.12 * t, 8 * t); T.flash(0.26 * t, '#ff4df0'); }
      if (into > 0.25) T.say(String(ULT_KINDS[i]).toUpperCase(), T.W / 2, 150, 86, '#ff4df0');
      T.caption('POWER SHOTS', 'FILL THE METER AND IT CANNOT BE STOPPED', k, T.PHRASE, '#ff8a1f');
      T.hit(k);
    });

    // --- 7 (0:48) celebrations
    add(function () {
      this.m = T.kickOff('england');
      this.art = CELEBRATIONS.slice(0, 48).map((c) => T.chip(170, (cv) => UI.celebSwatch(cv, c.id, 1.5), 170));
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.66);
      T.wall(T.ui(), this.art, k, { cols: 8, cw: 215, chh: 195, from: 1.2, speed: 115 });
      T.caption('105 CELEBRATIONS', 'SOMETHING TO DO AFTERWARDS', k, T.PHRASE, '#6fd3ff');
      T.hit(k);
    });

    // --- 8 (0:56) the coin
    add(function () { this.m = T.kickOff('germany'); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.64);
      T.coin(T.W / 2, T.H / 2 - 40 + Math.sin(k * 2.4) * 18, 215, k * 1.5);
      for (let i = 0; i < 30; i++) {
        const sd = i * 97.13;
        const life = ((k + (sd % 3.7)) % 3.7) / 3.7;
        T.coin((sd * 7.3) % T.W, -70 + life * (T.H + 180), 30, sd + k * 3);
      }
      T.caption('A NEW COIN', 'AND IT GOES SOMEWHERE WHEN YOU SPEND IT', k, T.PHRASE, T.GOLD);
      T.hit(k);
    });

    // --- 9 (1:04) the crate ladder
    add(function () {
      this.m = T.kickOff('japan');
      this.art = CRATES.map((c) => T.chip(300, (cv) => UI.crateArt(cv, c), 300));
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.7);
      const g = T.ui();
      const cols = 5, cw = 345, chh = 290;
      for (let i = 0; i < CRATES.length; i++) {
        const cx = T.W / 2 + ((i % cols) - (cols - 1) / 2) * cw;
        const cy = 290 + Math.floor(i / cols) * chh;
        const pop = Math.min(1, Math.max(0, (k - 0.25 - i * 0.045) / 0.28));
        if (pop <= 0) continue;
        const e = 1 - Math.pow(1 - pop, 3);
        g.save();
        g.globalAlpha = e;
        g.translate(cx, cy + (1 - e) * 30);
        g.scale(0.85 + e * 0.15, 0.85 + e * 0.15);
        g.drawImage(this.art[i], -150, -150);
        g.restore();
        T.say(CRATES[i].name.replace(' CRATE', ''), cx, cy + 150, 38, CRATES[i].color);
      }
      T.caption('FIFTEEN CRATES', 'FROM 800 COINS TO 900,000', k, T.PHRASE, T.WHITE);
      T.hit(k);
    });

    // --- 10 (1:12) the players
    add(function () {
      this.m = T.kickOff('spain');
      const picks = CHARACTERS.filter((c) => !c.only).slice(-40);
      this.art = picks.map((c) => T.chip(200, (cv) => UI.portrait(cv, c), 200));
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.68);
      T.wall(T.ui(), this.art, k, { cols: 8, cw: 225, chh: 212, from: 1.1, speed: 120 });
      T.caption('83 PLAYERS', 'EVERY ONE WITH ITS OWN NUMBERS', k, T.PHRASE, '#b04dff');
      T.hit(k);
    });

    // --- 11 (1:20) balls and trails
    add(function () {
      this.m = T.kickOff('italy');
      this.balls = BALLS.map((b) => T.chip(200, (cv) => UI.ballSwatch(cv, b.id), 90));
      this.trails = TRAILS.map((t) => T.chip(200, (cv) => UI.trailSwatch(cv, t.id), 70));
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.7);
      const g = T.ui();
      // balls one way, trails the other
      const lane = (art, y, w, h, gap, dir) => {
        const span = art.length * gap;
        for (let i = 0; i < art.length; i++) {
          const raw = i * gap + dir * k * 160;
          const cx = ((raw % span) + span) % span - gap;
          if (cx < -gap || cx > T.W + gap) continue;
          g.drawImage(art[i], cx - w / 2, y, w, h);
        }
      };
      lane(this.balls, 300, 190, 86, 232, -1);
      lane(this.trails, 540, 190, 66, 240, 1);
      T.say('36 BALLS', T.W / 2, 250, 66, T.WHITE);
      T.say('34 POWER TRAILS', T.W / 2, 490, 66, '#46d9ff');
      T.caption('MAKE IT YOURS', 'EVERY LAST PIECE OF IT', k, T.PHRASE, T.YELLOW);
      T.hit(k);
    });

    // --- 12 (1:28) what you can wear
    add(function () {
      this.m = T.kickOff('brazil');
      this.art = ACCESSORIES.slice(0, 40).map((a) => T.chip(180, (cv) => UI.accSwatch(cv, a.id), 180));
    }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.68);
      T.wall(T.ui(), this.art, k, { cols: 8, cw: 225, chh: 198, from: 1.1, speed: 110 });
      T.caption('65 ACCESSORIES', 'HATS, MASKS, CAPES, BOOTS', k, T.PHRASE, '#ff8af0');
      T.hit(k);
    });

    // --- 13 (1:36) penalties
    add(function () {
      Game.headless = false;
      T.acc = 0;
      FX.clear();
      const club = Clubs.get('france');
      Clubs.setMatch(Clubs.mine(), club);
      this.m = Match.create({ mode: 'pens', club, format: '1v1' });
      try { Pens.init(this.m); } catch (e) { this.broken = true; }
      this.m.demo = true;
      Render.updateCamera(this.m, 0, true);
    }, function (k, dt) {
      if (!this.broken) {
        try { Pens.step(this.m, dt); Pens.draw(this.m, dt, k); } catch (e) { this.broken = true; }
      }
      if (this.broken) { T.step(this.m, dt); Render.drawMatch(this.m, k); }
      T.ui();
      T.caption('PENALTY SHOOTOUTS', 'FIVE KICKS EACH, THEN SUDDEN DEATH', k, T.PHRASE, '#f0343f');
      T.hit(k);
    });

    // --- 14 (1:44) the world
    add(function () { this.m = T.kickOff('japan'); }, function (k, dt) {
      T.step(this.m, dt);
      Render.drawMatch(this.m, k);
      T.ui();
      T.scrim(0.68);
      const g = T.ui();
      const tiers = RANK_TIERS;
      const w = (T.W - 260) / tiers.length;
      for (let i = 0; i < tiers.length; i++) {
        const cx = T.W / 2 + (i - (tiers.length - 1) / 2) * w;
        const pop = Math.min(1, Math.max(0, (k - 0.4 - i * 0.12) / 0.35));
        if (pop <= 0) continue;
        const h = 70 + i * 48;
        g.save();
        g.globalAlpha = 1 - Math.pow(1 - pop, 3);
        T.plate(cx - w * 0.34, 700 - h, w * 0.68, h, tiers[i].color, 16);
        g.restore();
        T.say(tiers[i].name, cx, 756, 36, T.WHITE);
      }
      T.say('95 COUNTRIES', T.W / 2, 190, 72, T.WHITE);
      T.say('RANKED · CUPS · FRIENDS · PARTIES', T.W / 2, 272, 44, T.YELLOW);
      T.caption('AND THE BOTS MATCH YOUR RANK', 'CLIMB, AND THEY CLIMB WITH YOU', k, T.PHRASE, T.YELLOW);
      T.hit(k);
    });

    // --- 15 (1:52) one more goal, and where to find it
    add(function () { this.m = T.goalRun('italy', 2.2); }, function (k, dt) {
      const goal = this.m.goalAt !== undefined ? this.m.goalAt : 2.2;
      const since = k - goal;
      const scale = since > 0 && since < 1.2 ? 0.3 + 0.7 * Math.min(1, since / 1.2) : 1;
      T.step(this.m, dt * scale);
      Render.drawMatch(this.m, k);
      T.ui();
      if (since > 0 && since < 0.5) { T.flash(0.55 * (1 - since / 0.5)); T.punch(0.13 * (1 - since / 0.5), 9); }
      if (k > 4.0) {
        T.scrim(Math.min(0.8, ((k - 4.0) / 1.0) * 0.8));
        const e = Math.min(1, (k - 4.2) / 0.5);
        if (e > 0) {
          const g = T.ui();
          g.save();
          g.globalAlpha = e;
          g.translate(T.W / 2, T.H / 2 - 70);
          const sc = 0.8 + (1 - Math.pow(1 - e, 3)) * 0.2;
          g.scale(sc, sc); g.rotate(-0.045);
          T.say('Mini', -T.W * 0.145, 0, 190, T.YELLOW);
          T.say('Strikers', T.W * 0.115, 0, 190, T.WHITE);
          g.restore();
        }
        if (k > 5.0) T.say('FREE IN YOUR BROWSER', T.W / 2, T.H / 2 + 110, 58, T.WHITE);
        if (k > 5.6) T.say('mini-strikers.onrender.com', T.W / 2, T.H / 2 + 210, 72, T.YELLOW);
      }
      T.hit(k);
    });

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

    let si = -1;
    for (let f = 0; f < total; f++) {
      const t = f / this.FPS;
      let s = scenes[scenes.length - 1], idx = scenes.length - 1;
      for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].at && t < scenes[i].at + scenes[i].len) { s = scenes[i]; idx = i; break; }
      if (idx !== si) { si = idx; this.unhush(); s.setup.call(s); state.scene = 'scene ' + (idx + 1) + '/' + scenes.length; }
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
      if (enc.encodeQueueSize > 8) { while (enc.encodeQueueSize > 4) await breathe(); }
      else if ((f & 7) === 0) await breathe();
    }

    await enc.flush();
    enc.close();
    this.unseed();
    state.scene = 'the music';
    const audio = opts.silent ? null : await this.music(seconds).catch(() => null);
    state.blob = MP4.build({ samples, width: this.W, height: this.H, timescale: TS, avcC, audio });
    state.done = true;
    state.bytes = state.blob.size;
    return state;
  },
};
