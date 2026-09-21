// Screens: home, HUD, intro, how-to-play, pause, results. Panels live in panels.js.
const $ = (id) => document.getElementById(id);

const UI = {
  init() {
    document.title = GAME_NAME;
    Commentary.init();
    $('logo').innerHTML = GAME_NAME.split(' ').map((w) => `<span>${w}</span>`).join('');
    $('splash-logo').innerHTML = $('logo').innerHTML;
    const leaveSplash = () => {
      if ($('splash').classList.contains('gone')) return;
      Sound.unlock(); Commentary.unlock(); Sound.tap(); Sound.startMusic();
      $('splash').classList.add('gone');
      setTimeout(() => { $('splash').hidden = true; }, 450);
      Game.enter();
    };
    $('splash').addEventListener('pointerdown', leaveSplash);
    window.addEventListener('keydown', leaveSplash, { once: true });
    $('btn-play').addEventListener('click', () => { this.tap(); this.openModal('play'); });
    document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { this.tap(); this.openModal(b.dataset.open); }));
    $('home-char').addEventListener('click', () => { this.tap(); this.openModal('characters'); });
    $('btn-howto').addEventListener('click', () => { this.tap(); this.showHowTo(); });
    $('btn-profile').addEventListener('click', () => { this.tap(); this.openModal('profile'); });
    $('btn-install').addEventListener('click', () => { this.tap(); Install.go(); });
    $('install-ok').addEventListener('click', () => { this.tap(); $('install-steps').hidden = true; });
    Install.init();
    $('daily-claim').addEventListener('click', () => this.claimDaily());
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('modal').hidden) { this.closeModal(); return; }
      if (!$('howto').hidden) this.closeHowTo();
    });
    $('btn-pause').addEventListener('click', () => { this.tap(); this.togglePause(); });
    $('p-resume').addEventListener('click', () => { this.tap(); this.togglePause(); });
    $('p-restart').addEventListener('click', () => { this.tap(); Game.startMatch(Game.lastOpts); });
    $('p-quit').addEventListener('click', () => { this.tap(); if (Game.match && Game.match.net) Online.quit(); else Game.goHome(); });
    $('p-howto').addEventListener('click', () => { this.tap(); this.showHowTo(); });
    $('replay-skip').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const m = Game.match;
      if (!m || m.net) return;
      if (m.replay) m.replay.skip = true;
      else if (m.phase === 'cele' && m.cele && m.phaseT > 0.4) m.cele.skip = true;
    });
    $('r-again').addEventListener('click', () => { this.tap(); if (this._againMode === 'online') Online.again(); else this.resultsAgain(); });
    $('r-home').addEventListener('click', () => { this.tap(); Game.goHome(); });
    $('modal-close').addEventListener('click', () => { this.tap(); this.closeModal(); });
    $('intro-go').addEventListener('click', () => { this.tap(); Game.kickOff(); });
    $('intro').addEventListener('pointerdown', (e) => { if (e.target === $('intro') && !(Game.match && Game.match.net)) Game.kickOff(); });
    this.initAuth();
    this.initOnline();
    $('howto-ok').addEventListener('click', () => { this.tap(); this.closeHowTo(); });
    $('rotate-dismiss').addEventListener('click', () => { this.rotateDismissed = true; this.checkRotate(); });
    ['p-sound', 'p-music', 'p-vibe'].forEach((id) => $(id).addEventListener('click', () => this.quickToggle(id)));
    window.addEventListener('resize', () => this.checkRotate());
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (Game.state === 'intro' && (e.key === 'Enter' || e.key === ' ') && !(Game.match && Game.match.net)) { e.preventDefault(); Game.kickOff(); }
      if (Game.state === 'results' && !$('results').hidden && !e.repeat) {
        if (e.key === 'Enter') { e.preventDefault(); this.tap(); if (this._againMode === 'online') Online.again(); else this.resultsAgain(); }
        else if (e.key === 'Escape') { this.tap(); Game.goHome(); }
      }
    });
    document.addEventListener('pointerdown', () => { Sound.unlock(); Sound.startMusic(); });
    this.refreshHome();
    this.checkRotate();
    this.applyControls();
  },

  tap() { Sound.unlock(); Sound.tap(); },
  isTouch() { return window.matchMedia('(pointer: coarse)').matches; },

  checkRotate() {
    const portrait = window.innerHeight > window.innerWidth;
    $('rotate').hidden = !(portrait && this.isTouch() && !this.rotateDismissed);
  },

  // rotating control tips while training
  TIPS: {
    touch: ['Drag the joystick to move · hold SPRINT to run faster', 'Hold SHOOT to charge, release to shoot', 'Push the joystick sideways while shooting to curl it', 'SKILL with no direction = HOP over a tackle',
      'SKILL toward a defender = nutmeg or flick', 'No ball? TACKLE near the carrier to steal it', 'Fill the ring around SHOOT, then fully charge = POWER SHOT', 'Tap PASS when a teammate has it to call for the ball', 'Hold PASS for a harder through ball · full charge lofts it'],
    kb: ['WASD to move · hold SHIFT to sprint', 'Hold SPACE to charge, release to shoot', 'Hold A or D while shooting to curl it', 'Q with no direction = HOP over a tackle',
      'Q toward a defender = nutmeg or flick', 'No ball? F near the carrier to tackle', 'Fill the power meter, then fully charge = POWER SHOT', 'E passes to the teammate you face', 'Hold E for a harder through ball · full charge lofts it'],
  },
  tickTips(dt) {
    const m = Game.match, show = !!(m && m.training && Game.state === 'match' && m.phase !== 'replay');
    const el = $('tip');
    if (el.hidden === show) el.hidden = !show;
    if (!show) { this._tipT = 0; return; }
    this._tipT = (this._tipT || 0) - dt;
    if (this._tipT > 0) return;
    this._tipT = 6;
    const list = this.TIPS[document.body.classList.contains('kb') ? 'kb' : 'touch'];
    this._tipI = ((this._tipI === undefined ? -1 : this._tipI) + 1) % list.length;
    el.textContent = list[this._tipI];
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  },

  tick(dt) {
    this.tickTips(dt);
    Social.tick(dt);
    if (!$('queue').hidden) {
      const before = Math.floor(this._queueT || 0);
      this._queueT = (this._queueT || 0) + dt;
      const s = Math.floor(this._queueT);
      if (s !== before) $('q-note').textContent = `Searching… ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) $('toast').classList.remove('show');
    }
    if (Game.state === 'intro') {
      this._introT -= dt;
      if (this._introT <= 0) Game.kickOff();
    }
  },

  toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    t.classList.toggle('low', !$('results').hidden);
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    this._toastT = 2.4;
  },

  refreshHome() {
    const d = Save.data;
    $('coins').textContent = fmtCoins(d.coins);
    $('trophies').textContent = d.trophies || 0;
    const ch = Save.character();
    $('home-char-name').textContent = ch.name;
    const lv = Levels.info(d.xp || 0);
    $('home-level').textContent = lv.level;
    $('home-xp').style.width = Math.round((lv.into / lv.need) * 100) + '%';
    $('home-record').textContent = `${d.wins}W · ${d.draws || 0}D · ${d.losses || 0}L` + (d.career.streak >= 2 ? ` · ${d.career.streak} WIN STREAK` : '');
    this.portrait($('home-char-canvas'), Save.look());
    const ovr = $('home-ovr');
    ovr.querySelector('b').textContent = overall(ch.r);
    ovr.style.setProperty('--rar', RARITIES[ch.rarity].color);
    const ready = Achievements.readyList().length;
    $('prof-badge').hidden = ready === 0;
    $('prof-badge').textContent = ready;
    const club = Clubs.mine();
    // menus and portraits wear your club's kit
    if (!Clubs.home || Clubs.home.id !== club.id) Clubs.setMatch(club, Clubs.current && Clubs.current.id !== club.id ? Clubs.current : Clubs.random(club));
    $('home-user').textContent = Save.account || 'GUEST';
    $('home-club-name').textContent = club.name;
    this.flagBadge($('home-club-badge'), club);
    $('home-club-pos').textContent = this._leaguePos ? '#' + this._leaguePos : '';
    this.portrait($('home-char-canvas'), Save.look());
  },

  // a simple flag for a country (no crests or emblems, just its colours and shapes)
  flagBadge(cv, club) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const pad = Math.max(2, W * 0.05), x0 = pad, y0 = pad, w = W - pad * 2, h = H - pad * 2, r = Math.min(w, h) * 0.14;
    const cx = x0 + w / 2, cy = y0 + h / 2;
    const outline = () => { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); };
    const rect = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    const bands = (cols, ratios = cols.map(() => 1)) => { const t = ratios.reduce((a, b) => a + b, 0); let y = y0; cols.forEach((c, i) => { const hh = (h * ratios[i]) / t; rect(c, x0, y, w, hh + 0.6); y += hh; }); };
    const vbands = (cols) => cols.forEach((c, i) => rect(c, x0 + (w * i) / cols.length, y0, w / cols.length + 0.6, h));
    const dot = (c, x, y, rr) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); };
    const star = (c, x, y, R, hollow) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.42 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath();
      if (hollow) { g.strokeStyle = c; g.lineWidth = Math.max(1, R * 0.22); g.stroke(); } else { g.fillStyle = c; g.fill(); }
    };
    g.save(); outline(); g.clip();
    switch (club.id) {
      case 'argentina': bands(['#75aadb', '#ffffff', '#75aadb']); dot('#f6b40e', cx, cy, h * 0.1); break;
      case 'spain': bands(['#c60b1e', '#ffc400', '#c60b1e'], [1, 2, 1]); break;
      case 'france': vbands(['#0055a4', '#ffffff', '#ef4135']); break;
      case 'england': rect('#ffffff', x0, y0, w, h); rect('#cf142b', cx - w * 0.08, y0, w * 0.16, h); rect('#cf142b', x0, cy - h * 0.12, w, h * 0.24); break;
      case 'brazil':
        rect('#009c3b', x0, y0, w, h);
        g.fillStyle = '#ffdf00'; g.beginPath(); g.moveTo(cx, y0 + h * 0.12); g.lineTo(x0 + w * 0.9, cy); g.lineTo(cx, y0 + h * 0.88); g.lineTo(x0 + w * 0.1, cy); g.closePath(); g.fill();
        dot('#002776', cx, cy, h * 0.2); break;
      case 'portugal': rect('#046a38', x0, y0, w * 0.4, h); rect('#da291c', x0 + w * 0.4, y0, w * 0.6, h); dot('#ffe000', x0 + w * 0.4, cy, h * 0.19); break;
      case 'netherlands': bands(['#ae1c28', '#ffffff', '#21468b']); break;
      case 'belgium': vbands(['#1b1b1b', '#fdda24', '#ef3340']); break;
      case 'italy': vbands(['#009246', '#ffffff', '#ce2b37']); break;
      case 'germany': bands(['#1b1b1b', '#dd0000', '#ffce00']); break;
      case 'croatia': {
        bands(['#ff0000', '#ffffff', '#171796']);
        const s = h * 0.12;
        for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) rect((rr + cc) % 2 ? '#ffffff' : '#ff0000', cx - s * 1.5 + cc * s, cy - s * 1.5 + rr * s, s + 0.4, s + 0.4);
        break;
      }
      case 'morocco': rect('#c1272d', x0, y0, w, h); star('#006233', cx, cy, h * 0.26, true); break;
      case 'colombia': bands(['#fcd116', '#003893', '#ce1126'], [2, 1, 1]); break;
      case 'uruguay':
        bands(Array.from({ length: 9 }, (_, i) => (i % 2 ? '#0038a8' : '#ffffff')));
        rect('#ffffff', x0, y0, w * 0.38, (h * 5) / 9); dot('#fcd116', x0 + w * 0.19, y0 + (h * 5) / 18, h * 0.15); break;
      case 'usa':
        bands(Array.from({ length: 7 }, (_, i) => (i % 2 ? '#ffffff' : '#b22234')));
        rect('#3c3b6e', x0, y0, w * 0.44, (h * 4) / 7);
        for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 4; cc++) dot('#ffffff', x0 + w * 0.06 + cc * w * 0.105, y0 + h * 0.1 + rr * h * 0.16, Math.max(0.8, h * 0.035));
        break;
      case 'mexico': vbands(['#006847', '#ffffff', '#ce1126']); dot('#8b5a2b', cx, cy, h * 0.12); break;
      case 'japan': rect('#ffffff', x0, y0, w, h); dot('#bc002d', cx, cy, h * 0.28); break;
      case 'switzerland': { rect('#d52b1e', x0, y0, w, h); const s = h * 0.62; rect('#ffffff', cx - s * 0.16, cy - s / 2, s * 0.32, s); rect('#ffffff', cx - s / 2, cy - s * 0.16, s, s * 0.32); break; }
      case 'senegal': vbands(['#00853f', '#fdef42', '#e31b23']); star('#00853f', cx, cy, h * 0.17); break;
      case 'denmark': rect('#c8102e', x0, y0, w, h); rect('#ffffff', x0 + w * 0.3, y0, w * 0.12, h); rect('#ffffff', x0, cy - h * 0.09, w, h * 0.18); break;
      default:
        if (club.flag) this.flagShapes(g, club.flag, x0, y0, w, h, { rect, bands, dot, star });
        else rect(club.home.jersey, x0, y0, w, h);
    }
    g.restore();
    outline(); g.lineWidth = Math.max(1.5, W * 0.045); g.lineJoin = 'round'; g.strokeStyle = OUTLINE; g.stroke();
  },

  // the newer countries' flags are data (club.flag): simple shapes in 0..1 flag space, sizes in flag heights
  flagShapes(g, ops, x0, y0, w, h, { rect, bands, dot, star }) {
    const X = (u) => x0 + u * w, Y = (v) => y0 + v * h;
    const poly = (c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v)))); g.closePath(); g.fill(); };
    for (const [op, c, ...a] of ops) {
      switch (op) {
        case 'fill': rect(c, x0, y0, w, h); break;
        case 'h': bands(c, a[0]); break;
        case 'v': { const r = a[0] || c.map(() => 1), t = r.reduce((p, q) => p + q, 0); let x = x0; c.forEach((col, i) => { const ww = (w * r[i]) / t; rect(col, x, y0, ww + 0.6, h); x += ww; }); break; }
        case 'rect': rect(c, X(a[0]), Y(a[1]), a[2] * w + 0.4, a[3] * h + 0.4); break;
        case 'dot': dot(c, X(a[0]), Y(a[1]), a[2] * h); break;
        case 'star': star(c, X(a[0]), Y(a[1]), a[2] * h, a[3]); break;
        case 'poly': poly(c, a[0]); break;
        case 'tri': poly(c, [[0, 0], [a[0], 0.5], [0, 1]]); break;
        case 'cross': rect(c, X(0.5) - (a[0] * h) / 2, y0, a[0] * h, h); rect(c, x0, Y(0.5) - (a[0] * h) / 2, w, a[0] * h); break;
        case 'nordic': rect(c, X(0.36) - (a[0] * h) / 2, y0, a[0] * h, h); rect(c, x0, Y(0.5) - (a[0] * h) / 2, w, a[0] * h); break;
        case 'plus': { const s = a[2] * h, t = s * 0.3; rect(c, X(a[0]) - t / 2, Y(a[1]) - s / 2, t, s); rect(c, X(a[0]) - s / 2, Y(a[1]) - t / 2, s, t); break; }
        case 'saltire':
          g.strokeStyle = c; g.lineWidth = a[0] * h; g.lineCap = 'butt';
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w, y0 + h); g.moveTo(x0 + w, y0); g.lineTo(x0, y0 + h); g.stroke(); break;
        case 'halfdot': {
          const [c2, u, v, r] = a;
          g.fillStyle = c; g.beginPath(); g.arc(X(u), Y(v), r * h, Math.PI, 0); g.fill();
          g.fillStyle = c2; g.beginPath(); g.arc(X(u), Y(v), r * h, 0, Math.PI); g.fill();
          break;
        }
        case 'crescent': {
          // a disc with a smaller one cut out of it, opening to the right
          const [u, v, r] = a, R = r * h;
          g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.arc(X(u) + R * 0.28, Y(v), R * 0.8, 0, Math.PI * 2); g.clip('evenodd');
          dot(c, X(u), Y(v), R); g.restore(); break;
        }
        case 'arcstars': {
          const [u, v, R, n, r] = a;
          for (let i = 0; i < n; i++) { const t = Math.PI * (1.15 + (0.7 * i) / (n - 1)); star(c, X(u) + Math.cos(t) * R * h * 1.4, Y(v) + Math.sin(t) * R * h, r * h); }
          break;
        }
      }
    }
  },

  // ---- signing in ----
  initAuth() {
    this._authMode = 'login';
    document.querySelectorAll('[data-auth]').forEach((b) => b.addEventListener('click', () => { this.tap(); this.setAuthMode(b.dataset.auth); }));
    $('auth-form').addEventListener('submit', (e) => { e.preventDefault(); this.submitAuth(); });
    $('auth-clubs').innerHTML = CLUBS.slice().sort((x, y) => x.name.localeCompare(y.name)).map((c) => `<button type="button" class="auth-club" data-club="${c.id}"><canvas width="96" height="64"></canvas><b${c.name.length > 9 ? ' class="long"' : ''}>${c.name}</b></button>`).join('');
    $('auth-clubs').querySelectorAll('.auth-club').forEach((b) => {
      this.flagBadge(b.querySelector('canvas'), Clubs.get(b.dataset.club));
      b.addEventListener('click', () => {
        this.tap();
        this._authClub = b.dataset.club;
        $('auth-clubs').querySelectorAll('.auth-club').forEach((x) => x.classList.toggle('sel', x === b));
        $('auth-msg').textContent = '';
      });
    });
  },

  setAuthMode(mode) {
    this._authMode = mode;
    document.querySelectorAll('[data-auth]').forEach((b) => b.classList.toggle('sel', b.dataset.auth === mode));
    $('auth-clubs-wrap').hidden = mode !== 'signup';
    $('auth').classList.toggle('signup', mode === 'signup');
    $('auth-go').textContent = mode === 'signup' ? 'CREATE ACCOUNT' : 'LOG IN';
    $('auth-pass').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('auth-msg').textContent = mode === 'signup' ? 'Password: 8+ characters.' : '';
    $('auth-msg').classList.remove('bad');
  },

  showAuth(msg) {
    Game.state = 'home';
    this.closeAll();
    $('home').hidden = true;
    $('auth').hidden = false;
    if (msg) { $('auth-msg').textContent = msg; $('auth-msg').classList.add('bad'); }
    $('auth-logo').innerHTML = $('logo').innerHTML;
  },

  async submitAuth() {
    const user = $('auth-user').value.trim(), pass = $('auth-pass').value;
    const msg = $('auth-msg');
    msg.classList.add('bad');
    if (!user || !pass) { msg.textContent = 'Enter a username and password.'; return; }
    if (this._authMode === 'signup' && !this._authClub) { msg.textContent = 'Pick your country first.'; return; }
    const go = $('auth-go');
    go.disabled = true; msg.classList.remove('bad'); msg.textContent = this._authMode === 'signup' ? 'Creating your account…' : 'Logging in…';
    let r;
    try { r = this._authMode === 'signup' ? await Net.signup(user, pass, this._authClub) : await Net.login(user, pass); }
    catch (e) { r = { ok: false, msg: "Can't reach the server. Check your connection." }; }
    go.disabled = false;
    if (!r.ok) { msg.classList.add('bad'); msg.textContent = r.msg || 'Something went wrong'; Sound.steal(); return; }
    $('auth-pass').value = '';
    this.tap();
    this.signedIn(this._authMode === 'signup');
  },

  signedIn(fresh) {
    $('auth').hidden = true;
    Game.state = 'home';
    Render.buildLayer();
    this.show('home');
    if (fresh) this.toast(`YOU PLAY FOR ${Clubs.mine().name}!`);
    Net.openSocket(); // puts you straight back into an online match you were still in
    this.fetchLeaguePos();
  },

  async fetchLeaguePos() {
    const r = await Net.league();
    if (!r || !r.ok) return;
    const i = r.table.findIndex((row) => row.club === Save.data.club);
    this._leaguePos = i >= 0 ? i + 1 : 0;
    this._league = r;
    if (Game.state === 'home') this.refreshHome();
  },

  // ---- online overlays ----
  initOnline() {
    $('q-cancel').addEventListener('click', () => { this.tap(); Online.cancelQueue(); });
    $('lb-leave').addEventListener('click', () => { this.tap(); Online.leaveRoom(); });
    $('lb-switch').addEventListener('click', () => {
      this.tap();
      const r = Online.room; if (!r) return;
      const me = r.players.find((p) => p.name === r.you);
      Net.send({ t: 'room.team', team: me && me.team === 'blue' ? 'red' : 'blue' });
    });
    $('lb-start').addEventListener('click', () => { this.tap(); Net.send({ t: 'room.start' }); });
  },

  showQueue(msg) {
    this.closeAll();
    $('queue').hidden = false;
    $('q-format').textContent = msg.wc !== null && msg.wc !== undefined ? `${msg.format === 'pens' ? 'PENALTY WORLD CUP' : 'WORLD CUP'} · ${WC_ROUNDS[msg.wc]}${msg.format === 'pens' ? '' : ` · ${msg.format}`}` : 'ONLINE · ' + msg.format;
    $('q-dots').innerHTML = '<i></i><i></i><i></i>';
    this._queueT = 0;
    $('q-note').textContent = 'Searching… 0:00';
    this.queueParty(null);
  },
  hideQueue() { $('queue').hidden = true; },
  queueParty(names) {
    const el = $('q-party');
    el.hidden = !names || names.length < 2;
    if (!el.hidden) el.textContent = 'PARTY: ' + names.join(' · ');
  },

  showLobby(msg) {
    this.closeAll();
    $('lobby').hidden = false;
    $('lb-code').textContent = msg.code;
    const size = { 'pens': 1, '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 }[msg.format];
    $('lb-formats').innerHTML = '<span>FORMAT</span>' + ['pens', '1v1', '2v2', '3v3', '4v4'].map((f) => `<button data-f="${f}" class="${f === msg.format ? 'sel' : ''}" ${msg.isHost ? '' : 'disabled'}>${f}</button>`).join('');
    $('lb-formats').querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { this.tap(); Net.send({ t: 'room.format', format: b.dataset.f }); }));
    const side = (team, el) => {
      const list = msg.players.filter((p) => p.team === team);
      const rows = [];
      for (let i = 0; i < size; i++) {
        const p = list[i];
        rows.push(p ? `<div class="lb-p ${p.name === msg.you ? 'me' : ''}"><canvas width="48" height="32" data-club="${p.club}"></canvas><b>${p.name}</b>${p.name === msg.host ? '<em>HOST</em>' : ''}</div>` : '<div class="lb-p empty"><b>OPEN</b></div>');
      }
      el.innerHTML = `<small>${team === 'blue' ? 'SIDE A' : 'SIDE B'}</small>` + rows.join('');
      el.querySelectorAll('canvas[data-club]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.club)));
    };
    side('blue', $('lb-blue')); side('red', $('lb-red'));
    $('lb-start').hidden = !msg.isHost;
    $('lb-note').textContent = msg.isHost ? 'Send the code to your friends, then press START.' : `Waiting for ${msg.host} to start…`;
  },
  hideLobby() { $('lobby').hidden = true; },

  show(screen) {
    $('home').hidden = screen !== 'home';
    $('hud').hidden = screen !== 'match';
    $('pause').hidden = true;
    $('results').hidden = true;
    $('intro').hidden = true;
    this.applyControls();
    if (screen === 'home') { this.refreshHome(); Render._homeSpot = null; setTimeout(() => this.maybeDaily(), 350); }
  },

  // ---- daily reward ----
  maybeDaily() {
    if (Game.state !== 'home' || !$('splash').hidden || !$('modal').hidden || !$('howto').hidden || !$('daily').hidden) return;
    const p = Daily.pending();
    if (!p) return;
    $('daily-days').innerHTML = DAILY.map((c, i) => {
      const n = i + 1, cls = n < p.day ? 'done' : n === p.day ? 'today' : '';
      return `<div class="dday ${cls}${n === 7 ? ' jackpot' : ''}"><small>DAY ${n}</small><span class="coin"></span><b>${c}</b></div>`;
    }).join('');
    $('daily-claim').innerHTML = `CLAIM <span class="coin"></span> ${p.coins}`;
    $('daily').hidden = false;
    Sound.powerReady();
  },

  claimDaily() {
    const p = Daily.claim();
    $('daily').hidden = true;
    if (!p) return;
    Sound.goalJingle(true);
    vibrate(30);
    this.toast(`DAY ${p.day} REWARD  +${p.coins} COINS`);
    this.refreshHome();
  },

  closeAll() {
    for (const id of ['modal', 'pause', 'results', 'intro', 'howto', 'daily', 'queue', 'lobby']) $(id).hidden = true;
  },

  // ---- match intro card ----
  showIntro(m, startsIn) {
    const cup = m.mode === 'cup' ? Cup.state() : null;
    $('intro-stage').textContent = m.pens ? (m.wc !== null && m.wc !== undefined ? `PENALTY WORLD CUP · ${PWC_ROUNDS[m.wc]}` : m.mode === 'penscup' && PenCup.state() ? `PENALTY WORLD CUP · ${PenCup.ROUNDS[PenCup.state().round]}` : 'PENALTY SHOOTOUT · 5 KICKS EACH') : m.net ? (m.wc !== null && m.wc !== undefined ? `WORLD CUP · ${WC_ROUNDS[m.wc]} · ${m.format}` : `ONLINE · ${m.format}`) : m.training ? 'TRAINING · NO CLOCK' : (cup ? `CUP · ${Cup.ROUNDS[cup.round]}` : 'QUICK MATCH') + ` · ${m.format}`;
    $('intro-go').hidden = !!m.net;
    $('intro-opp').textContent = TEAMS.red.name;
    $('intro-home').textContent = TEAMS.blue.name;
    const ch = Save.character();
    $('intro-you').innerHTML = `${ch.name.toUpperCase()} <b style="color:${RARITIES[ch.rarity].color}">${overall(ch.r)}</b>`;
    $('intro-stars').textContent = '★'.repeat(m.club.level + 1) + '☆'.repeat(3 - m.club.level);
    this.portrait($('intro-canvas'), ch);
    $('intro').querySelector('.intro-ch').hidden = !(m.challenges && m.challenges.length);
    $('intro').style.setProperty('--opp', kitUi(TEAMS.red));
    $('intro-challenges').innerHTML = this.challengeList(m);
    if (m.net) {
      // who's playing: real names on each side
      const names = (team) => m.players.filter((p) => p.team === team && !p.isKeeper).map((p) => (p === m.human ? 'YOU' : p.name)).join(' · ');
      $('intro-challenges').innerHTML = `<li class="done"><span>${names('blue')}</span></li><li><span>${names('red')}</span></li>`;
      $('intro').querySelector('.intro-ch').hidden = false;
      $('intro').querySelector('.intro-ch small').textContent = 'PLAYERS';
    } else $('intro').querySelector('.intro-ch small').textContent = 'CHALLENGES';
    $('intro').hidden = false;
    this._introT = m.net ? 999 : 6;
  },

  challengeList(m) {
    return (m.challenges || []).map((c) => `<li class="${c.complete ? 'done' : ''}"><i></i><span>${c.text}</span><b><span class="coin"></span>${c.coins}</b></li>`).join('');
  },

  // ---- how to play ----
  showHowTo(after) {
    this._howtoAfter = after || null;
    $('modal').hidden = true;
    const kb = document.body.classList.contains('kb');
    const k = (s) => `<span class="kc">${s}</span>`;
    const cards = [
      { t: 'MOVE & SPRINT', ico: 'move', d: kb ? `${k('WASD')} to move. Hold ${k('SHIFT')} to sprint — it drains stamina.` : 'Drag the joystick to move. Hold SPRINT to run faster — it drains stamina.' },
      { t: 'PASS & SHOOT', ico: 'shoot', d: kb ? `${k('E')} passes to the teammate you face — hold it for a harder through ball. Hold ${k('SPACE')} to charge a shot, steer to curl it.` : 'Tap PASS to pass to the teammate you face, or hold it for a harder through ball. Hold SHOOT to charge, steer while releasing to curl it.' },
      { t: 'TACKLE', ico: 'slide', d: kb ? `${k('F')} near the ball carrier lunges in and steals it. It has a short cooldown.` : 'No ball? The purple button becomes TACKLE: tap it near the carrier to lunge in and steal the ball.' },
      { t: 'SKILLS', ico: 'skill', d: kb ? `${k('Q')} with a direction: spin, flick, nutmeg, Cruyff. No direction = HOP over tackles.` : 'SKILL + joystick direction: spin, flick, nutmeg, Cruyff. No direction = HOP over tackles.' },
    ];
    $('howto-cards').innerHTML = cards.map((c, i) => `<div class="hcard"><div class="hico ${c.ico}"><b>${i + 1}</b></div><strong>${c.t}</strong><p>${c.d}</p></div>`).join('');
    $('howto').hidden = false;
  },

  closeHowTo() {
    $('howto').hidden = true;
    Save.data.tutorialSeen = true;
    Save.write();
    const cb = this._howtoAfter;
    this._howtoAfter = null;
    if (cb) cb();
  },

  // ---- HUD ----
  updateHUD(m) {
    $('sb-blue').textContent = m.score.blue;
    $('sb-red').textContent = m.score.red;
    let label;
    if (m.training) label = 'PRACTICE';
    else if (m.overtime) label = 'GOLDEN';
    else { const s = Math.ceil(m.time); label = `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
    if (this._lastTime !== label) {
      $('sb-time').textContent = label;
      $('sb-time').classList.toggle('hurry', !m.overtime && m.time <= 10 && m.time > 0);
      $('sb-time').classList.toggle('ot', m.overtime || m.training);
      this._lastTime = label;
    }
    const p = Math.round((m.meter.blue / CFG.POWER_MAX) * 100);
    if (this._lastMeter !== p) {
      $('btn-shoot').style.setProperty('--p', p);
      $('btn-shoot').classList.toggle('power', p >= 100);
      this._lastMeter = p;
    }
    if (m.net) {
      const ping = Math.round(Net.rtt);
      if (this._ping !== ping) { $('net-ping').hidden = false; $('net-ping').textContent = ping ? ping + ' ms' : '…'; $('net-ping').classList.toggle('bad', ping > 160); this._ping = ping; }
    } else if (this._ping !== null) { $('net-ping').hidden = true; this._ping = null; }
    const rep = m.phase === 'replay' || m.phase === 'cele';
    if (this._rep !== rep) { $('hud').classList.toggle('replaying', rep); $('hud').classList.toggle('noskip', !!m.net); this._rep = rep; }
    const h = m.human, has = m.ball.owner === h;
    $('btn-pass').classList.toggle('call', !has && !!m.ball.owner && m.ball.owner.team === 'blue');

    const ult = $('btn-ult');
    if (ult) {
      const u = clamp((h.ult || 0) / CFG.ULT_MAX, 0, 1), ready = u >= 1 && !h.ultOn;
      if (this._ultU !== u) { ult.querySelector('.ult-fill').style.width = Math.round(u * 100) + '%'; this._ultU = u; }
      ult.classList.toggle('ready', ready);
      ult.classList.toggle('on', !!h.ultOn);
      const label = h.ultOn ? 'ULT ON' : ready ? 'ULT READY' : 'ULT';
      if (this._ultLabel !== label) { ult.querySelector('b').textContent = label; this._ultLabel = label; }
    }

    // SKILL (with ball) / TACKLE (without) + their cooldowns
    const skillCd = Math.round(clamp(h.skillCd / skillCooldown(h), 0, 1) * 100);
    const slideCd = Math.round(clamp(h.slideCd / (tackleCooldown(h) + SLIDE.time), 0, 1) * 100);
    const cd = has ? skillCd : slideCd;
    const btn = $('btn-skill');
    if (this._mode !== has) { btn.classList.toggle('slide', !has); this._mode = has; }
    if (this._cd !== cd) { btn.style.setProperty('--cd', cd); btn.classList.toggle('ready', cd === 0); this._cd = cd; }
    const st = Math.round(h.stamina * 100);
    if (this._st !== st || this._tired !== h.exhausted) {
      $('btn-sprint').style.setProperty('--st', st);
      $('btn-sprint').classList.toggle('tired', h.exhausted);
      this._st = st; this._tired = h.exhausted;
    }
    if (document.body.classList.contains('kb')) {
      $('kl-stam').style.width = st + '%';
      $('kl-stam').style.background = h.exhausted ? '#ff8a8e' : '';
      $('kl-power').style.width = p + '%';
      $('kl-skill').style.width = 100 - skillCd + '%';
      $('kl-slide').style.width = 100 - slideCd + '%';
      const kl = this._kl || (this._kl = { q: document.querySelector('.kl[data-k="q"]'), f: document.querySelector('.kl[data-k="f"]'), sp: document.querySelector('.kl[data-k=" "]') });
      kl.q.classList.toggle('cool', skillCd > 0);
      kl.f.classList.toggle('cool', slideCd > 0);
      kl.sp.classList.toggle('hot', p >= 100);
    }
  },

  keyLegendPress(k, down) {
    let key = k;
    if (KEYS.up.includes(k) || KEYS.down.includes(k) || KEYS.left.includes(k) || KEYS.right.includes(k)) key = 'move';
    else if (KEYS.sprint.includes(k)) key = 'shift';
    else if (KEYS.pass.includes(k)) key = 'e';
    else if (KEYS.shoot.includes(k)) key = ' ';
    else if (KEYS.skill.includes(k)) key = 'q';
    else if (KEYS.slide.includes(k)) key = 'f';
    const el = document.querySelector(`.kl[data-k="${key}"]`);
    if (el) el.classList.toggle('down', down);
  },

  // auto: phones get touch buttons, computers get the key legend
  applyControls() {
    const mode = Save.data.settings.controls || 'auto';
    const kb = mode === 'keyboard' || (mode === 'auto' && !this.isTouch());
    document.body.classList.toggle('kb', kb);
  },

  togglePause() {
    if (Game.state === 'match') {
      Game.state = 'paused';
      Commentary.pause();
      Input.reset();
      Sound.chargeStop();
      if (Game.match && Game.match.human) Game.match.human.charging = false;
      this.syncToggles();
      $('p-challenges').innerHTML = this.challengeList(Game.match);
      $('p-restart').hidden = !!Game.match.net;
      $('pause').querySelector('h2').textContent = Game.match.net ? 'MENU' : 'PAUSED';
      $('p-quit').textContent = Game.match.net ? 'LEAVE MATCH (LOSS)' : 'QUIT';
      document.querySelector('.p-ch').hidden = !(Game.match.challenges && Game.match.challenges.length);
      $('pause').hidden = false;
    } else if (Game.state === 'paused') {
      Game.state = 'match';
      Commentary.resume();
      $('pause').hidden = true;
      Game.last = performance.now();
    }
  },

  syncToggles() {
    const s = Save.data.settings;
    $('p-sound').classList.toggle('off', s.sfx === 0);
    $('p-music').classList.toggle('off', s.music === 0);
    $('p-vibe').classList.toggle('off', !s.vibration);
  },

  quickToggle(id) {
    const s = Save.data.settings;
    if (id === 'p-sound') s.sfx = s.sfx === 0 ? 0.85 : 0;
    if (id === 'p-music') s.music = s.music === 0 ? 0.5 : 0;
    if (id === 'p-vibe') s.vibration = !s.vibration;
    Save.write(); Sound.applyVolumes(); this.syncToggles(); this.tap();
  },

  // ---- results ----
  showResults(m) {
    const r = m.result, d = Save.data;
    Game.state = 'results';
    const readyBefore = new Set(Achievements.readyList().map((a) => a.id));
    const levelBefore = Levels.info(d.xp || 0).level;
    const pens = !!m.pens;
    const xp = pens ? Pens.xp(m) : Levels.matchXp(m);
    d.xp = (d.xp || 0) + xp;
    d.coins += r.coins;
    d.matches++;
    d.goals = (d.goals || 0) + m.human.stats.goals;
    if (r.outcome === 'win') d.wins++; else if (r.outcome === 'draw') d.draws = (d.draws || 0) + 1; else d.losses = (d.losses || 0) + 1;
    const hs = m.human.stats, c = d.career;
    c.assists += hs.assists; c.tackles += hs.tackles; c.skills += hs.skills; c.dodges += hs.dodges || 0;
    c.passes += hs.passes; c.shots += hs.shots; c.powerGoals += m.flags.powerGoals || 0;
    if (hs.goals >= 3) c.hattricks++;
    if (m.score.red === 0 && !pens) c.cleanSheets++;
    c.formats[m.format] = (c.formats[m.format] || 0) + 1;
    c.streak = r.outcome === 'win' ? c.streak + 1 : 0;
    c.bestStreak = Math.max(c.bestStreak, c.streak);
    // a win streak pays a little extra: +10 per win after the first, up to +50
    const streakBonus = r.outcome === 'win' ? Math.min(50, (c.streak - 1) * 10) : 0;
    d.coins += streakBonus;
    const cupResult = m.mode === 'cup' ? Cup.record(m) : null;
    const penCupResult = m.mode === 'penscup' ? PenCup.record(m) : null;
    const onlinePenCup = m.net && m.onlinePenEnd ? m.onlinePenEnd.wc : null;
    if (onlinePenCup) {
      if (onlinePenCup.round === 0 || !Array.isArray(d.pwcRun)) d.pwcRun = [];
      const other = Online.penSide === 'blue' ? 'red' : 'blue';
      d.pwcRun[onlinePenCup.round] = { club: m.onlinePenEnd.clubs[other], mine: m.score.blue, theirs: m.score.red, won: onlinePenCup.won };
      d.pwcRun.length = onlinePenCup.round + 1;
      if (Net.user) Net.user.pwc = { round: onlinePenCup.next, titles: onlinePenCup.titles };
    }
    const cupPrize = cupResult === 'champion' || penCupResult === 'champion' ? 300 : onlinePenCup && onlinePenCup.champion ? PWC_PRIZE : 0;
    if (cupPrize) d.coins += cupPrize;
    Save.write();
    const levelAfter = Levels.info(d.xp).level;
    let levelCoins = 0;
    for (let lv = levelBefore + 1; lv <= levelAfter; lv++) levelCoins += Levels.reward(lv);
    d.coins += levelCoins;
    if (levelCoins) Save.write();
    const fresh = Achievements.readyList().filter((a) => !readyBefore.has(a.id));
    if (fresh.length) setTimeout(() => { if (Game.state === 'results') { this.toast(fresh.length === 1 ? `ACHIEVEMENT: ${fresh[0].name.toUpperCase()}  ·  CLAIM IN PROFILE` : `${fresh.length} ACHIEVEMENTS UNLOCKED  ·  CLAIM IN PROFILE`); Sound.powerReady(); } }, 900);

    const title = { win: 'VICTORY!', loss: 'DEFEAT', draw: 'DRAW' }[r.outcome];
    $('r-title').textContent = cupResult === 'champion' ? 'CHAMPIONS!' : title;
    $('r-title').className = 'r-title ' + (cupResult === 'champion' ? 'win champ' : r.outcome);
    $('r-blue').textContent = m.score.blue;
    $('r-red').textContent = m.score.red;
    const pt = m.poss.blue + m.poss.red, pb = pt ? Math.round((m.poss.blue / pt) * 100) : 50;
    const pk = pens ? m.pens.kicks : null;
    const rows = pens ? [
      ['SCORED', m.score.blue, m.score.red],
      ['MISSED', pk.blue.length - m.score.blue - m.pens.theirSaves, pk.red.length - m.score.red - m.pens.saves],
      ['SAVES', m.pens.saves, m.pens.theirSaves],
      ['KICKS', pk.blue.length, pk.red.length],
    ] : [
      ['GOALS', m.score.blue, m.score.red],
      ['POSS %', pb, 100 - pb],
      ['SHOTS', m.stats.blue.shots, m.stats.red.shots],
      ['PASSES', m.stats.blue.passes, m.stats.red.passes],
      ['TACKLES', m.stats.blue.tackles || 0, m.stats.red.tackles || 0],
      ['SAVES', m.stats.blue.saves, m.stats.red.saves],
    ];
    $('r-stats').innerHTML = rows.map(([k, a, b]) =>
      `<div class="r-row"><b class="${a > b ? 'lead' : ''}">${a}</b><span>${k}</span><b class="${b > a ? 'lead' : ''}">${b}</b></div>`).join('');
    const h = m.human.stats;
    $('r-you').innerHTML = pens ? `<span><b>${h.goals}</b> of ${h.shots} penalties scored</span><span><b>${m.pens.saves}</b> saves</span>`
      : `<span><b>${h.goals}</b> goals</span><span><b>${h.shots}</b> shots</span><span><b>${h.tackles}</b> tackles</span><span><b>${h.skills}</b> skills</span>`;
    const mvp = r.mvp;
    const mvpName = mvp.isHuman ? 'YOU' : `${TEAMS[mvp.team].name} #${mvp.number}${mvp.isKeeper ? ' (GK)' : ''}`;
    const s = mvp.stats;
    const line = mvp.isKeeper ? `${s.saves} saves` : pens ? `${s.goals} penalties · ${m.pens.saves} saves` : `${s.goals} G · ${s.assists} A · ${s.tackles} tackles`;
    $('r-mvp').innerHTML = `<canvas id="r-mvp-canvas" width="84" height="84"></canvas><div><small>MVP</small><strong>${mvpName}</strong><em>${line}</em></div>`;
    this.portrait($('r-mvp-canvas'), mvp.look, mvp.team, mvp.isKeeper, mvp.number);
    $('r-challenges').innerHTML = this.challengeList(m);
    $('r-coins').textContent = `+${r.coins + streakBonus + levelCoins + cupPrize}`;
    const multTag = $('r-mult');
    multTag.classList.remove('hard');
    multTag.hidden = r.mult === 1;
    multTag.textContent = `${Save.data.settings.difficulty.toUpperCase()} ×${r.mult}`;
    multTag.classList.toggle('hard', r.mult > 1);
    $('r-streak').hidden = c.streak < 2;
    $('r-streak').innerHTML = `<b>${c.streak}</b> WIN STREAK${streakBonus ? ` <span>+${streakBonus}</span>` : ''}`;
    const lv = Levels.info(d.xp);
    $('r-level').textContent = lv.level;
    $('r-xpbar').style.width = Math.round((lv.into / lv.need) * 100) + '%';
    $('r-xp').textContent = lv.level > levelBefore ? `LEVEL UP! +${xp} XP · +${levelCoins} COINS` : `+${xp} XP`;
    $('r-xp').classList.toggle('lvup', lv.level > levelBefore);

    // cup progress + what the big button does next
    const cupBox = $('r-cup');
    this._againMode = pens ? 'pens' : 'quick';
    if (m.mode === 'cup') {
      const c = Save.data.cup;
      cupBox.hidden = false;
      cupBox.innerHTML = Cup.ROUNDS.map((name, i) => {
        const res = c.results[i], club = Clubs.get(c.opponents[i]);
        const cls = res ? (res.won ? 'won' : 'lost') : i === c.round && c.active ? 'next' : '';
        return `<div class="cup-step ${cls}"><small>${name}</small><b style="--c:${clubUi(club)}">${club.name}</b><em>${res ? `${res.blue}-${res.red}` : '—'}</em></div>`;
      }).join('');
      this._againMode = cupResult === 'next' ? 'cup' : 'newcup';
      $('r-again').textContent = cupResult === 'next' ? `PLAY ${Cup.ROUNDS[c.round]}` : cupResult === 'champion' ? 'NEW CUP' : 'TRY AGAIN';
      if (cupResult === 'champion') Trophy.show({ title: 'CUP WINNERS!', sub: 'BOT WORLD CUP · +300 COINS', club: Clubs.mine(), mates: m.players.filter((p) => p.team === 'blue' && !p.isKeeper && p !== m.human).map((p) => p.look) });
    } else if (m.mode === 'penscup') {
      const c = Save.data.pensCup;
      cupBox.hidden = false;
      cupBox.innerHTML = PenCup.ROUNDS.map((name, i) => {
        const res = c.results[i], club = Clubs.get(c.opponents[i]);
        const cls = res ? (res.won ? 'won' : 'lost') : i === c.round && c.active ? 'next' : '';
        return `<div class="cup-step ${cls}"><small>${name}</small><b style="--c:${clubUi(club)}">${club.name}</b><em>${res ? `${res.blue}-${res.red}` : '—'}</em></div>`;
      }).join('');
      this._againMode = penCupResult === 'next' ? 'penscup' : 'newpenscup';
      $('r-again').textContent = penCupResult === 'next' ? `PLAY ${PenCup.ROUNDS[c.round]}` : penCupResult === 'champion' ? 'NEW PENALTY CUP' : 'TRY AGAIN';
      if (penCupResult === 'champion') Trophy.show({ title: 'WORLD CHAMPIONS!', sub: 'PENALTY WORLD CUP · +300 COINS', club: Clubs.mine(), mates: m.players.filter((p) => p.team === 'blue' && !p.isKeeper && p !== m.human).map((p) => p.look) });
    } else if (onlinePenCup) {
      const run = d.pwcRun || [];
      cupBox.hidden = false;
      cupBox.innerHTML = PWC_ROUNDS.map((name, i) => {
        const q = run[i], cls = q ? (q.won ? 'won' : 'lost') : i === onlinePenCup.next && onlinePenCup.won && !onlinePenCup.champion ? 'next' : '';
        const club = q ? Clubs.get(q.club) : null;
        return `<div class="cup-step ${cls}"><small>${name}</small><b style="--c:${club ? clubUi(club) : '#8a90b8'}">${club ? club.short : '?'}</b><em>${q ? `${q.mine}-${q.theirs}` : '—'}</em></div>`;
      }).join('');
      this._againMode = 'onlinepenscup';
      $('r-again').textContent = onlinePenCup.champion ? 'NEW PENALTY CUP' : onlinePenCup.won ? `PLAY ${PWC_ROUNDS[onlinePenCup.next]}` : 'TRY AGAIN';
      if (onlinePenCup.champion) Trophy.show({ title: 'WORLD CHAMPIONS!', sub: `ONLINE PENALTY WORLD CUP · +${PWC_PRIZE} COINS`, club: Clubs.mine(), mates: m.players.filter((p) => p.team === 'blue' && !p.isKeeper && p !== m.human).map((p) => p.look) });
    } else {
      cupBox.hidden = true;
      this._againMode = pens ? (m.net ? 'onlinepens' : 'pens') : 'quick';
      $('r-again').textContent = 'PLAY AGAIN';
    }
    $('results').hidden = false;
    $('hud').hidden = true;
    Input.reset();
  },

  // ---- online results: the server's numbers, your rewards ----
  showOnlineResults(m, msg) {
    const d = Save.data, side = msg.side, other = side === 'blue' ? 'red' : 'blue';
    const mirror = side === 'red';
    const mine = msg.score[side], theirs = msg.score[other];
    const outcome = msg.outcome;
    Game.state = 'results';
    const me = msg.players[msg.you] || { stats: {} }, st = Object.assign({ goals: 0, assists: 0, tackles: 0, skills: 0, shots: 0, passes: 0, dodges: 0 }, me.stats);
    const readyBefore = new Set(Achievements.readyList().map((a) => a.id));
    const levelBefore = Levels.info(d.xp || 0).level;
    const xp = 50 + st.goals * 25 + st.assists * 15 + st.tackles * 6 + st.skills * 2 + (st.dodges || 0) * 5 + (outcome === 'win' ? 70 : outcome === 'draw' ? 30 : 0);
    const coins = 30 + mine * 10 + st.goals * 10 + (outcome === 'win' ? 70 : outcome === 'draw' ? 25 : 0);
    d.xp = (d.xp || 0) + xp; d.coins += coins; d.matches++;
    d.goals = (d.goals || 0) + st.goals;
    if (outcome === 'win') d.wins++; else if (outcome === 'draw') d.draws = (d.draws || 0) + 1; else d.losses = (d.losses || 0) + 1;
    const c = d.career;
    c.assists += st.assists; c.tackles += st.tackles; c.skills += st.skills; c.dodges += st.dodges || 0;
    c.passes += st.passes; c.shots += st.shots; c.powerGoals += m.flags.powerGoals || 0;
    if (st.goals >= 3) c.hattricks++;
    if (theirs === 0) c.cleanSheets++;
    c.formats[msg.format] = (c.formats[msg.format] || 0) + 1;
    c.online = (c.online || 0) + 1; if (outcome === 'win') c.onlineWins = (c.onlineWins || 0) + 1;
    c.streak = outcome === 'win' ? c.streak + 1 : 0;
    c.bestStreak = Math.max(c.bestStreak, c.streak);
    const streakBonus = outcome === 'win' ? Math.min(50, (c.streak - 1) * 10) : 0;
    d.coins += streakBonus;
    // the online World Cup: remember this run's results to show the road to the final
    const cup = msg.wc || null;
    if (cup) {
      if (cup.round === 0 || !Array.isArray(d.wcRun)) d.wcRun = [];
      d.wcRun[cup.round] = { club: msg.clubs[other], mine, theirs, won: cup.won };
      d.wcRun.length = cup.round + 1;
      if (cup.champion) { d.coins += WC_PRIZE; d.wcTitles = (d.wcTitles || 0) + 1; }
      if (Net.user) Net.user.wc = { round: cup.next, titles: cup.titles };
    }
    const wcPrize = cup && cup.champion ? WC_PRIZE : 0;
    const levelAfter = Levels.info(d.xp).level;
    let levelCoins = 0;
    for (let lv = levelBefore + 1; lv <= levelAfter; lv++) levelCoins += Levels.reward(lv);
    d.coins += levelCoins;
    Save.write();
    const fresh = Achievements.readyList().filter((a) => !readyBefore.has(a.id));
    if (fresh.length) setTimeout(() => { if (Game.state === 'results') { this.toast(fresh.length === 1 ? `ACHIEVEMENT: ${fresh[0].name.toUpperCase()}  ·  CLAIM IN PROFILE` : `${fresh.length} ACHIEVEMENTS UNLOCKED  ·  CLAIM IN PROFILE`); Sound.powerReady(); } }, msg.forfeit ? 2800 : 900); // after the forfeit note has been read

    $('r-title').textContent = cup && cup.champion ? 'WORLD CHAMPIONS!' : cup && !cup.won ? 'KNOCKED OUT' : { win: 'VICTORY!', loss: 'DEFEAT', draw: 'DRAW' }[outcome];
    $('r-title').className = 'r-title ' + (cup && cup.champion ? 'win champ' : outcome);
    $('r-blue').textContent = mine; $('r-red').textContent = theirs;
    if (msg.forfeit && outcome === 'win') setTimeout(() => { if (Game.state === 'results') this.toast('THE OTHER TEAM LEFT · YOU WIN'); }, 400);
    const S = msg.stats, poss = mirror ? 100 - msg.poss : msg.poss;
    const rows = [
      ['GOALS', mine, theirs], ['POSS %', poss, 100 - poss],
      ['SHOTS', S[side].shots || 0, S[other].shots || 0], ['PASSES', S[side].passes || 0, S[other].passes || 0],
      ['TACKLES', S[side].tackles || 0, S[other].tackles || 0], ['SAVES', S[side].saves || 0, S[other].saves || 0],
    ];
    $('r-stats').innerHTML = rows.map(([k, a, b]) => `<div class="r-row"><b class="${a > b ? 'lead' : ''}">${a}</b><span>${k}</span><b class="${b > a ? 'lead' : ''}">${b}</b></div>`).join('');
    $('r-you').innerHTML = `<span><b>${st.goals}</b> goals</span><span><b>${st.assists}</b> assists</span><span><b>${st.tackles}</b> tackles</span><span><b>${st.skills}</b> skills</span>`;
    const mvp = msg.mvp, mvpPlayer = m.players[mvp.index];
    const mvpName = mvp.index === msg.you ? 'YOU' : mvp.keeper ? `${(mvp.team === side ? TEAMS.blue : TEAMS.red).name} GK` : mvp.name;
    const ms = mvp.stats || {};
    $('r-mvp').innerHTML = `<canvas id="r-mvp-canvas" width="84" height="84"></canvas><div><small>MVP</small><strong>${mvpName}</strong><em>${mvp.keeper ? `${ms.saves || 0} saves` : `${ms.goals || 0} G · ${ms.assists || 0} A · ${ms.tackles || 0} tackles`}</em></div>`;
    if (mvpPlayer) this.portrait($('r-mvp-canvas'), mvpPlayer.look, mvpPlayer.team, mvpPlayer.isKeeper, mvpPlayer.number);
    const club = Clubs.mine();
    const lg = msg.league;
    const lgText = lg && lg.pos ? (lg.d > 0 ? `${club.name} MOVES UP TO ${ordinal(lg.pos)} ▲` : lg.d < 0 ? `${club.name} DROPS TO ${ordinal(lg.pos)} ▼` : `${club.name} STAYS ${ordinal(lg.pos)}`) : `${club.name}: ${outcome === 'win' ? 'UP A PLACE' : outcome === 'loss' ? 'DOWN A PLACE' : 'NO CHANGE'}`;
    $('r-challenges').innerHTML = `<li class="${lg && lg.d > 0 ? 'done' : ''}"><i></i><span>LEAGUE: ${lgText}</span></li>`;
    $('r-coins').textContent = `+${coins + streakBonus + levelCoins + wcPrize}`;
    $('r-mult').hidden = false; $('r-mult').textContent = cup ? 'WORLD CUP' : 'ONLINE'; $('r-mult').classList.add('hard');
    $('r-streak').hidden = c.streak < 2;
    $('r-streak').innerHTML = `<b>${c.streak}</b> WIN STREAK${streakBonus ? ` <span>+${streakBonus}</span>` : ''}`;
    const lv = Levels.info(d.xp);
    $('r-level').textContent = lv.level;
    $('r-xpbar').style.width = Math.round((lv.into / lv.need) * 100) + '%';
    $('r-xp').textContent = lv.level > levelBefore ? `LEVEL UP! +${xp} XP · +${levelCoins} COINS` : `+${xp} XP`;
    $('r-xp').classList.toggle('lvup', lv.level > levelBefore);
    $('r-cup').hidden = !cup;
    if (cup) {
      const run = d.wcRun || [];
      $('r-cup').innerHTML = WC_ROUNDS.map((name, i) => {
        const r = run[i];
        const cls = r ? (r.won ? 'won' : 'lost') : i === cup.round + 1 && cup.won && !cup.champion ? 'next' : '';
        const club = r ? Clubs.get(r.club) : null;
        return `<div class="cup-step ${cls}"><small>${name}</small><b style="--c:${club ? clubUi(club) : '#8a90b8'}">${club ? club.short : '?'}</b><em>${r ? `${r.mine}-${r.theirs}` : '—'}</em></div>`;
      }).join('');
      if (cup.champion) Trophy.show({ title: 'WORLD CHAMPIONS!', sub: `ONLINE WORLD CUP · +${WC_PRIZE} COINS`, club: Clubs.mine(), mates: m.players.filter((p) => p.team === 'blue' && !p.isKeeper && p !== m.human).map((p) => p.look) });
    }
    this._againMode = 'online';
    $('r-again').textContent = !cup ? 'PLAY AGAIN' : cup.champion ? 'NEW WORLD CUP' : cup.won ? `PLAY ${WC_ROUNDS[cup.next]}` : 'TRY AGAIN';
    // in a party, the leader starts the next one (and brings you with them)
    const party = Social.party;
    if (party && party.members.length > 1 && !party.lead) $('r-again').textContent = 'HOME';
    $('results').hidden = false;
    $('hud').hidden = true;
    Input.reset();
    this._leaguePos = 0;
    this.fetchLeaguePos();
  },

  resultsAgain() {
    const previous = Game.match && Game.match.club;
    if (this._againMode === 'cup') Game.startMatch({ mode: 'cup' });
    else if (this._againMode === 'penscup') Game.startMatch({ mode: 'penscup' });
    else if (this._againMode === 'newpenscup') { PenCup.start(); Game.startMatch({ mode: 'penscup' }); }
    else if (this._againMode === 'onlinepenscup') { Game.goHome(); Online.m = null; Online.findMatch('pens', true); }
    else if (this._againMode === 'newcup') { Cup.start(); Game.startMatch({ mode: 'cup' }); }
    else if (this._againMode === 'pens') Game.startMatch({ mode: 'pens', club: Clubs.random(Clubs.mine(), previous) });
    else if (this._againMode === 'onlinepens') { Game.goHome(); Online.m = null; Online.findMatch('pens'); }
    else Game.startMatch({ mode: 'quick', format: (Game.match && Game.match.format) || Save.data.format, club: Clubs.random(Clubs.mine(), previous) });
  },
};

// ===== Getting it onto a phone or desktop =====================================
// The game has been a proper web app all along — a manifest, icons, a service worker —
// so a phone can install it and run it fullscreen with no browser around it. Nothing
// told anyone that, so there is a button now.
//
// Two browsers, two different jobs. Chrome, Edge and Android fire beforeinstallprompt
// when they decide the site is installable and hand over an object you can fire later
// from a tap: a real one-tap install. Safari has no such event and no API — Add to Home
// Screen lives in its share menu and only a person can pick it — so on iPhone the
// button shows the steps instead. Anywhere neither applies the button stays hidden.
const Install = {
  event: null,
  init() {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.event = e; this.refresh(); });
    window.addEventListener('appinstalled', () => {
      this.event = null; this.refresh();
      UI.toast('INSTALLED! LOOK FOR MINI STRIKERS ON YOUR HOME SCREEN');
    });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    this.refresh();
  },
  installed() {
    return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia('(display-mode: ' + m + ')').matches)
      || navigator.standalone === true; // the iOS way of saying it
  },
  ios() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // an iPad calling itself a Mac
  },
  refresh() {
    // Always offered unless the game is already installed. It used to hide itself unless
    // the browser had handed over an install event, which meant it was invisible on the
    // phone it was built for — Chrome only fires that event once it feels like it, and
    // Safari never does. Tapping it either installs or shows how.
    $('btn-install').hidden = this.installed();
    if (typeof Render !== 'undefined') Render._homeSpot = null;
  },
  go() {
    if (this.event) {
      const e = this.event;
      this.event = null;
      e.prompt();
      e.userChoice.then(() => this.refresh()).catch(() => {});
      return;
    }
    // no API here: show where the button they need actually is
    $('install-how').innerHTML = this.ios()
      ? '<b>1. Tap the Share button</b>the square with an arrow coming out of it, at the bottom of Safari<b>2. Scroll down and tap "Add to Home Screen"</b><b>3. Tap Add</b>Mini Strikers lands on your home screen and opens fullscreen, like any other game.'
      : '<b>Open your browser menu</b>the three dots in the corner<b>Tap "Install app" or "Add to Home screen"</b>then confirm. The game opens fullscreen with no browser around it.';
    $('install-steps').hidden = false;
  },
};
