// Talking to the server: accounts (sign up / log in), saving progress, the league
// table, and the live socket used for online matches.
// Where the server is. On the web the page is served BY the server, so every address is relative
// and API_BASE is ''. Inside a store app the game's files are on the phone and the server is far
// away, so every address needs its name in front. (On a developer's own computer, a page can be
// pointed at another local server with ?api=http://localhost:PORT and made to act like the app
// with ?native=1, to try the app set-up without a phone. That only works on localhost, so a link
// somewhere else cannot point the game at a server of its own.)
const LIVE_SERVER = 'https://mini-strikers.onrender.com';
const ON_LOCALHOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())
  || (ON_LOCALHOST && /[?&]native=1\b/.test(location.search));
const API_BASE = (() => {
  const dev = ON_LOCALHOST ? new URLSearchParams(location.search).get('api') : null;
  if (dev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(dev)) return dev;
  return NATIVE ? LIVE_SERVER : '';
})();
const TOKEN_KEY = 'mini-strikers.token';
// Who was last signed in on this device. The token alone does not say, and with no connection
// there is nobody to ask — without this the game cannot find your cached save to play offline.
const USER_KEY = 'mini-strikers.user';

const Net = {
  token: null,
  user: null,        // { name, club, online }
  ws: null,
  wsReady: false,
  handlers: {},      // message type -> fn
  saveTimer: 0,
  rtt: 0,
  _pingT: 0,
  _wantSocket: false,
  _retry: 0,
  offline: false,      // the server could not be reached: solo play only, saving to this device
  offlineOffer: false, // PLAY OFFLINE on the sign-in page (set once the server cannot be reached at all)
  unsaved: false,      // progress changed here that the server has not taken yet
  // how long starting up waits on the server before going on without it (it sleeps: see Game.enter)
  RESUME_WAIT: 5000,
  WAKING_MSG: tl('Waking the server up… this can take up to a minute.'),
  NO_WIFI_MSG: tl('No Wi-Fi. Connect to log in or sign up, or play offline as a guest.'),

  init() {
    try { this.token = localStorage.getItem(TOKEN_KEY); } catch (e) { this.token = null; }
    try { this.lastUser = localStorage.getItem(USER_KEY); } catch (e) { this.lastUser = null; }
    // the wifi going off (or coming back) while the game is open: the online buttons grey out with it
    const wifi = () => document.body.classList.toggle('nowifi', this.noWifi());
    window.addEventListener('offline', wifi);
    window.addEventListener('online', wifi);
    wifi();
  },

  // the device has no network at all: wifi off, airplane mode, no signal
  noWifi() { return typeof navigator !== 'undefined' && navigator.onLine === false; },
  // Why an online thing cannot start right now, in words for a toast, or null if it can. play is
  // for the things that start a match; the rest (league, friends, rank) say "use this".
  offlineWhy(play = true) {
    if (!this.noWifi() && !this.offline) return null;
    if (this.noWifi()) return play ? tl('NO WI-FI — CONNECT TO PLAY ONLINE') : tl('NO WI-FI — CONNECT TO USE THIS');
    // a guest is not short of a connection, they are short of an account
    if (typeof Save !== 'undefined' && !Save.account) return play ? tl('MAKE AN ACCOUNT TO PLAY ONLINE — IT IS FREE') : tl('MAKE AN ACCOUNT TO USE THIS — IT IS FREE');
    return tl('STILL CONNECTING TO THE SERVER — TRY AGAIN IN A MOMENT');
  },

  // While offline, look now and then for the connection coming back: every few seconds at first (a
  // sleeping server is up within the minute), then every 20 s. Only while the game is in front of
  // you, and the switch back to online only happens when nothing is going on: swapping the save over
  // in the middle of a match, or under a half-typed name, is not something to do to anyone.
  watchForConnection() {
    clearTimeout(this._watch);
    const started = Date.now();
    const calm = () => typeof UI === 'undefined' || UI.calm();
    const tick = async () => {
      const again = () => { clearTimeout(this._watch); this._watch = setTimeout(tick, Date.now() - started < 120000 ? 5000 : 20000); };
      if (!this.offline || this._looking) return;
      if (document.hidden || this.noWifi() || !calm()) return again();
      this._looking = true;
      try {
        if (!(await this.reachable(4000)) || !calm()) return again();
        const r = await this.resume(8000);
        if (r === null) return;             // reachable, but this device is not signed in: leave it alone
        if (!r) return again();
        this.goOnline();
        if (typeof UI !== 'undefined') { UI.signedIn(); UI.toast(tl('BACK ONLINE — PROGRESS SAVED')); }
      } finally { this._looking = false; }
    };
    this._tick = tick;
    this._watch = setTimeout(tick, 3000);
  },
  // Something says the server may be back (the game came to the front, the live connection opened,
  // which only happens with the server up): look now rather than at the next turn of the loop.
  pokeConnection() { if (this.offline && this._tick) { clearTimeout(this._watch); this._tick(); } },
  // start the server waking now (it sleeps when nobody has played for a while), without waiting
  prewarm() { try { fetch(API_BASE + '/api/health', { cache: 'no-store' }).catch(() => {}); } catch (e) { /* no fetch */ } },

  // no connection: play on with what this device already knows
  goOffline() {
    this.offline = true;
    this.offlineOffer = true;
    this.closeSocket();
    document.body.classList.add('offline');
    if (this.lastUser) this.watchForConnection();
  },
  goOnline() {
    this.offlineOffer = false;
    clearTimeout(this._watch);
    if (!this.offline) return;
    this.offline = false;
    document.body.classList.remove('offline');
    // anything won while there was no connection goes up now
    if (Save.playedOffline || Save.account) { Save.playedOffline = false; this.queueSave(); }
    Store.onSignedIn();
  },

  // opts.ms: give up (throw) after this long. opts.keepalive: the request survives the page closing.
  async api(path, body = {}, opts = {}) {
    let stop = null, timer = null;
    if (opts.ms && typeof AbortController !== 'undefined') { stop = new AbortController(); timer = setTimeout(() => stop.abort(), opts.ms); }
    try {
      const res = await fetch(API_BASE + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, token: this.token }),
        signal: stop ? stop.signal : undefined, keepalive: !!opts.keepalive,
      });
      let data = null;
      try { data = await res.json(); } catch (e) { data = { ok: false, msg: tl('Bad response from the server') }; }
      if (res.status === 401) data.auth = false;
      return data;
    } finally { if (timer) clearTimeout(timer); }
  },

  // Can the server be reached at all, right now? One quick knock with a short deadline — used
  // before showing a sign-in screen, so somebody with no connection is offered a game instead of
  // a box they cannot type their way out of.
  async reachable(ms = 4000) {
    try {
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), ms);
      const res = await fetch(API_BASE + '/api/health', { cache: 'no-store', signal: stop.signal });
      clearTimeout(timer);
      return !!(res && res.ok);
    } catch (e) { return false; }
  },

  // The free instance sleeps after about fifteen idle minutes and takes the best part of a
  // minute to get up. This knocks until it answers (or gives up), so the game can say "waking
  // up" instead of "check your connection".
  // Each knock has its own deadline: a request to a sleeping host just hangs, which used to stop the
  // count (and any message with it) for as long as the host took.
  async wake(onTry, tries = 16, gap = 1500, perTry = 5000) {
    for (let i = 0; i < tries; i++) {
      if (await this.reachable(perTry)) return true;
      if (this.noWifi()) return false; // nothing to wake with no network at all
      if (onTry) onTry(i + 1, tries);
      await new Promise((r) => setTimeout(r, gap));
    }
    return false;
  },

  // ---- accounts ----
  async signup(username, password, club) {
    // a guest's progress on this device comes with them
    const carried = Save.data && (Save.data.matches > 0 || Save.data.coins > 0) ? Save.data : null;
    const r = await this.api('/api/auth/signup', { username, password, club, save: carried });
    // the recovery code comes back this once, to be shown and written down (UI.signedIn shows it)
    if (r.ok) { this.freshCode = r.recovery || null; this.signedIn(r, true); }
    return r;
  },
  // Forgot the password: the recovery code and a new password sign you in, and a new code comes
  // back (the one just used is spent).
  async recover(username, code, password) {
    const r = await this.api('/api/auth/recover', { username, code, password });
    if (r.ok) { this.freshCode = r.recovery || null; this.signedIn(r, false); }
    return r;
  },
  async newRecovery(password) {
    try { return await this.api('/api/account/recovery', { password }); } catch (e) { return { ok: false, msg: tl("Can't reach the server") }; }
  },
  async report(name) {
    try { return await this.api('/api/report', { name }); } catch (e) { return { ok: false, msg: tl("Can't reach the server") }; }
  },
  async login(username, password) {
    const r = await this.api('/api/auth/login', { username, password });
    if (r.ok) this.signedIn(r, false);
    return r;
  },
  // null = not signed in, false = server unreachable (or slower than ms), object = the account
  async resume(ms = 0) {
    if (!this.token) return null;
    try {
      const r = await this.api('/api/me', {}, { ms });
      if (r.ok) { this.signedIn(r, false); return r; }
      if (r.auth === false) { this.forget(true); return null; }
      return false;
    } catch (e) { return false; }
  },
  signedIn(r, fresh) {
    // a different account: the live connection still belongs to the old one, so drop it
    if (r.token && r.token !== this.token) { this.closeSocket(); if (typeof Social !== 'undefined') Social.reset(); }
    if (r.token) { this.token = r.token; try { localStorage.setItem(TOKEN_KEY, r.token); } catch (e) {} }
    if (r.name) { this.lastUser = r.name; try { localStorage.setItem(USER_KEY, r.name); } catch (e) {} }
    this.openSocket(); // have it ready before the first thing they press
    this.user = { name: r.name, club: r.club, online: r.online, rank: r.rank || null, wc: r.wc || { round: 0, titles: 0 }, hasRecovery: r.hasRecovery };
    Save.useAccount(r.name, r.save, r.club, fresh);
    Store.onSignedIn();
    if (r.gift > 0) this.giftToast(r.gift); // already inside the save that just came back
  },
  giftToast(n) { setTimeout(() => { UI.refreshHome(); UI.toast(tl('GIFT  +{0} COINS', [fmtCoins(n)])); }, 900); },
  // forNow: the sign-in expired, but this is still the same player on the same device, so the
  // name stays and they can keep playing offline. Only a real log out clears it.
  forget(forNow) {
    this.token = null; this.user = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    if (forNow) return;
    this.lastUser = null;
    try { localStorage.removeItem(USER_KEY); } catch (e) {}
  },
  async logout() {
    try { await this.api('/api/logout'); } catch (e) {}
    this.closeSocket();
    this.forget();
    Social.reset();
    Store.reset();
    Save.useGuest();
  },

  // progress goes up a moment after it changes, batched
  queueSave() {
    if (!this.token) return;
    this.unsaved = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.pushSave(), 1200);
  },
  // Any answer but "saved" is tried again, a little less often each time: a server waking up, one
  // that said "slow down", or a page of HTML from the host in front of it. That used to be dropped
  // without a word, so the server kept the old progress. The copy on this device is kept either way.
  async pushSave() {
    if (!this.token) return;
    clearTimeout(this.saveTimer);
    try {
      const r = await this.api('/api/save', { save: Save.data, gifts: true }, { ms: 30000 });
      if (r.auth === false) {
        this.forget(true);
        // mid-game is no moment to be thrown out: carry on offline and say so
        if (Game.state === 'match' || !$('home').hidden) { UI.playOffline(); UI.toast(tl('SIGNED OUT — PLAYING ON THIS DEVICE')); }
        else UI.showAuth(tl('You were signed out. Log in again.'));
        return;
      }
      if (!r.ok) throw new Error(r.msg || 'not saved');
      this.unsaved = false; this._saveFails = 0;
      if (r.gift > 0) { Save.data.coins += r.gift; Save.write(); this.giftToast(r.gift); }
    } catch (e) {
      this._saveFails = (this._saveFails || 0) + 1;
      this.saveTimer = setTimeout(() => this.pushSave(), Math.min(60000, 4000 * this._saveFails));
    }
  },
  // The page is going away (the app closed, or a phone switched to something else and may never
  // come back to it): what has not gone up yet goes now, in a request that outlives the page.
  // No gift is taken here, since nothing would be left to add it to the coins.
  flushSave() {
    if (!this.token || !this.unsaved || !Save.data) return;
    clearTimeout(this.saveTimer);
    this.api('/api/save', { save: Save.data, gifts: false }, { keepalive: true })
      .then((r) => { if (r && r.ok) this.unsaved = false; else this.queueSave(); })
      .catch(() => this.queueSave());
  },

  async changePassword(password, newPassword) {
    try { return await this.api('/api/account/password', { password, newPassword }); } catch (e) { return { ok: false, msg: tl("Can't reach the server") }; }
  },

  async leaderboard() {
    try { return await this.api('/api/leaderboard'); } catch (e) { return { ok: false, msg: tl("Can't reach the server") }; }
  },

  async league() {
    try { return await this.api('/api/league'); } catch (e) { return { ok: false, msg: tl("Can't reach the server") }; }
  },

  // ---- live socket ----
  on(type, fn) { this.handlers[type] = fn; },

  openSocket() {
    this._wantSocket = true;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    const url = API_BASE ? API_BASE.replace(/^http/, 'ws') + '/ws' : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this._scheduleRetry(); return; }
    this.ws = ws; this.wsReady = false;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'auth', token: this.token })); };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.t === 'hello') { this.wsReady = true; this._retry = 0; if (this.offline) this.pokeConnection(); }
      if (msg.t === 'pong') { this.rtt = Math.max(1, performance.now() - msg.c); return; }
      const fn = this.handlers[msg.t];
      if (fn) fn(msg);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.wsReady = false; this.ws = null;
      if (e.code === 4001) { this._wantSocket = false; if (this.handlers.authLost) this.handlers.authLost(); return; }
      if (e.code === 4000) { this._wantSocket = false; if (this.handlers.kicked) this.handlers.kicked(); return; }
      if (this.handlers.disconnected) this.handlers.disconnected();
      if (this._wantSocket) this._scheduleRetry();
    };
  },
  _scheduleRetry() {
    this._retry = Math.min(6, this._retry + 1);
    setTimeout(() => { if (this._wantSocket && this.token) this.openSocket(); }, 600 * this._retry);
  },
  closeSocket() {
    this._wantSocket = false;
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch (e) {} }
    this.wsReady = false;
  },
  send(obj) {
    if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; }
    return false;
  },
  // send it now if we can, and otherwise as soon as the connection is up
  sendSoon(obj) { if (!this.send(obj)) this.whenReady(obj); },
  // Send once the connection is up, opening it if needed. The host sleeps when nobody has played
  // for a while and takes most of a minute to wake, so this knocks on the door to wake it and waits
  // for as long as that really takes rather than throwing the message away after a few seconds.
  WAKE_AFTER: 1800,     // start knocking if the connection has not come up by now
  GIVE_UP_AFTER: 75000, // longer than a cold start
  whenReady(obj) {
    this.openSocket();
    const started = Date.now();
    let knocking = false;
    const done = () => { if (this._waking) { this._waking = false; if (this.handlers.awake) this.handlers.awake(); } };
    const tryIt = () => {
      if (this.wsReady) { this.send(obj); done(); return; }
      if (this.noWifi()) {
        this._waking = false;
        if (this.handlers.error) this.handlers.error({ msg: tl('No Wi-Fi — connect and try again') });
        return;
      }
      const waited = Date.now() - started;
      if (waited > this.WAKE_AFTER && !knocking) {
        knocking = true; this._waking = true;
        if (this.handlers.waking) this.handlers.waking();
        this.wake(null, 20, 3000).then(() => this.openSocket());
      }
      if (waited > this.GIVE_UP_AFTER) {
        this._waking = false;
        if (this.handlers.error) this.handlers.error({ msg: tl('The server is still waking up — try that again in a moment') });
        return;
      }
      setTimeout(tryIt, 250);
    };
    tryIt();
  },
  tick(dt) {
    if (!this.wsReady) return;
    this._pingT -= dt;
    if (this._pingT <= 0) { this._pingT = 3; this.send({ t: 'ping', c: performance.now() }); }
  },
};
