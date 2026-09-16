// Boot + main loop. Fixed 120 Hz simulation, render every animation frame.
const Game = {
  state: 'home',
  match: null,
  headless: false,
  last: 0,
  acc: 0,
  t: 0,
  _diff: null,
  lastOpts: { mode: 'quick' },

  difficulty() { return this._diff || DIFFICULTY[Save.data.settings.difficulty] || DIFFICULTY.normal; },

  // The difficulty setting is the base; the opponent club's level (0..3) leans on top of it.
  setDifficulty(club) {
    const b = DIFFICULTY[Save.data.settings.difficulty] || DIFFICULTY.normal;
    this._diff = levelDiff(b, club ? club.level : 1);
  },

  boot() {
    Render.init($('game'));
    Input.init();
    Net.init();
    Online.init();
    UI.init();
    UI.show('home');
    $('home').hidden = true; // nothing but the splash until we know who you are
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { Render.buildLayer(); Render.homeCrowd = null; Render._homeSpot = null; });
    document.addEventListener('visibilitychange', () => {
      // online matches can't be paused, so there's nothing to stop when the tab hides
      if (document.hidden && this.state === 'match' && !(this.match && this.match.net)) UI.togglePause();
    });
    this.last = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  },

  goFullscreen() {
    if (!UI.isTouch()) return;
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }).catch(() => {});
      }
    } catch (e) { /* not supported */ }
  },

  // opts: { mode: 'quick' | 'cup', club }
  startMatch(opts = this.lastOpts) {
    Sound.unlock();
    this.goFullscreen();
    if (!Save.data.tutorialSeen) { UI.showHowTo(() => this.startMatch(opts)); return; }
    this.lastOpts = opts;
    let club = opts.club;
    if (opts.mode === 'cup') { if (!Cup.state()) Cup.start(); club = Cup.opponent(); }
    if (!club) club = Clubs.random(Clubs.mine());
    FX.clear();
    Input.reset();
    UI.closeAll();
    this.match = Match.create({ mode: opts.mode, club, format: opts.format || Save.data.format });
    Render.updateCamera(this.match, 0, true);
    this.acc = 0;
    UI._lastTime = null; UI._lastMeter = null; UI._mode = null; UI._cd = null; UI._st = null; UI._rep = null;
    $('hud').classList.remove('replaying');
    UI.show('match');
    this.state = 'intro';
    UI.updateHUD(this.match);
    UI.showIntro(this.match);
    Sound.startMusic();
    Sound.startAmbience();
    Sound.cheer(false);
  },

  kickOff() {
    if (this.state !== 'intro') return;
    $('intro').hidden = true;
    this.state = 'match';
    this.last = performance.now();
    FX.showBanner('KICK OFF!', '#ffffff', 1.0, `${TEAMS.blue.name} vs ${TEAMS.red.name}`);
    Sound.countdown(true);
  },

  // after the splash: signed in already? straight home. Otherwise the sign-in page.
  async enter() {
    const r = await Net.resume();
    if (r) { UI.signedIn(); return; }
    UI.showAuth(r === false ? "Can't reach the server. Check your connection and try again." : '');
  },

  goHome() {
    if (this.match && this.match.net && Online.status === 'match') Net.send({ t: 'leave' });
    if (this.match && this.match.net) { Online.status = 'idle'; Online.m = null; }
    this.state = 'home';
    this.match = null;
    Render.zoom = 1;
    FX.clear();
    Input.reset();
    Sound.chargeStop();
    Sound.stopAmbience();
    UI.show('home');
  },

  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));
    const rawDt = Math.max(0, (ts - this.last) / 1000);
    const realDt = Math.min(0.1, rawDt);
    this.last = ts;
    this.t += realDt;
    this.watchFrames(rawDt);
    if (window.innerWidth !== Render.W || window.innerHeight !== Render.H) Render.resize();
    if (!Render.W || !Render.H) return;
    Input.update();
    UI.tick(realDt);
    Net.tick(realDt);
    const m = this.match;
    if (m && m.net && this.state !== 'home') {
      // online: the server runs the match, we draw it
      Online.update(realDt);
      FX.update(realDt * (m.timeScale || 1), realDt);
      Render.updateCamera(m, realDt);
      Render.drawMatch(m, this.t);
      if (this.state === 'match' || this.state === 'paused') UI.updateHUD(m);
    } else if (m && this.state !== 'home') {
      if (this.state === 'match' || this.state === 'results') {
        this.acc += realDt;
        let n = 0;
        while (this.acc >= CFG.STEP && n < 14) { Match.step(m, CFG.STEP); this.acc -= CFG.STEP; n++; }
        if (n >= 14) this.acc = 0;
        FX.update(realDt * m.timeScale, realDt);
        Render.updateCamera(m, realDt);
      } else if (this.state === 'intro') {
        Render.updateCamera(m, realDt);
      }
      Render.drawMatch(m, this.t);
      if (this.state === 'match') UI.updateHUD(m);
    } else {
      this.stepDemo(realDt);
      Render.drawHome(this.t, this.demo);
    }
  },

  // AUTO graphics: frames averaging slower than ~40fps for 2.5s step quality down; a steady
  // 55fps+ stretch puts it back. Frames longer than 80ms are the browser throttling a
  // background tab (or a load hitch), not a slow device, so they are thrown away — counting
  // them used to knock a perfectly fine machine down to low the moment the tab lost focus.
  watchFrames(dt) {
    if (Save.data.settings.graphics !== 'auto' || document.hidden) return;
    const w = this._fw || (this._fw = { t: 0, n: 0, sum: 0, grace: 2 });
    if (dt > 0.08) { w.grace = 1.5; w.t = 0; w.n = 0; w.sum = 0; return; }
    if (w.grace > 0) { w.grace -= dt; return; }
    w.t += dt; w.n++; w.sum += dt;
    if (w.t < 2.5 || w.n < 40) return;
    const avg = w.sum / w.n;
    w.t = 0; w.n = 0; w.sum = 0;
    if (avg > 1 / 40 && Render.quality < 2) { Render.quality++; Render.resize(); w.grace = 2; }
    else if (avg < 1 / 55 && Render.quality > 0) { Render.quality--; Render.resize(); w.grace = 2; }
  },

  // A bot-vs-bot match plays silently behind the home screen. It is ALWAYS on — no setting
  // and no frame rate turns it off; a slow screen just steps it at half rate.
  stepDemo(dt) {
    const slow = Render.quality >= 2 || Save.data.settings.graphics === 'low';
    const prev = this.headless;
    this.headless = true;
    const diff = this._diff;
    if (!this.demo || this.demo.phase === 'over') {
      const demoClub = Clubs.current && Clubs.current.id !== Clubs.mine().id ? Clubs.current : Clubs.random(Clubs.mine());
      Clubs.setMatch(Clubs.mine(), demoClub);
      this.demo = Match.create({ autopilot: true, minutes: 30, club: demoClub });
      this.demo.demo = true;
      this.demo.phase = 'play';
      Render.updateCamera(this.demo, 0, true);
    }
    this.demoAcc = (this.demoAcc || 0) + dt;
    const step = slow ? CFG.STEP * 2 : CFG.STEP;
    let n = 0;
    while (this.demoAcc >= step && n < 8) { Match.step(this.demo, step); this.demoAcc -= step; n++; }
    if (n >= 8) this.demoAcc = 0;
    this._diff = diff;
    this.headless = prev;
    const b = this.demo.ball, cam = Render.cam;
    const k = 1 - Math.exp(-1.5 * dt);
    cam.x += (clamp(b.x, CFG.FIELD_W * 0.15, CFG.FIELD_W * 0.85) - cam.x) * k;
    cam.y += (clamp(b.y, CFG.FIELD_H * 0.15, CFG.FIELD_H * 0.85) * CFG.TILT - cam.y) * k;
  },
};

window.addEventListener('load', () => Game.boot());
