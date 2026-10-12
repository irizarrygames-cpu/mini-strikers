// Talking to the server: accounts (sign up / log in), saving progress, the league
// table, and the live socket used for online matches.
const TOKEN_KEY = 'mini-strikers.token';

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

  init() {
    try { this.token = localStorage.getItem(TOKEN_KEY); } catch (e) { this.token = null; }
  },

  async api(path, body = {}) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, token: this.token }) });
    let data = null;
    try { data = await res.json(); } catch (e) { data = { ok: false, msg: 'Bad response from the server' }; }
    if (res.status === 401) data.auth = false;
    return data;
  },

  // The free instance sleeps after about fifteen idle minutes and takes the best part of a
  // minute to get up. This knocks until it answers (or gives up), so the game can say "waking
  // up" instead of "check your connection".
  async wake(onTry, tries = 14, gap = 4000) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) return true;
      } catch (e) { /* still asleep */ }
      if (onTry) onTry(i + 1, tries);
      await new Promise((r) => setTimeout(r, gap));
    }
    return false;
  },

  // ---- accounts ----
  async signup(username, password, club) {
    // a guest's progress on this device comes with them
    const guest = Save.data && (Save.data.matches > 0 || Save.data.coins > 0) ? Save.data : null;
    const r = await this.api('/api/auth/signup', { username, password, club, save: guest });
    if (r.ok) this.signedIn(r, true);
    return r;
  },
  async login(username, password) {
    const r = await this.api('/api/auth/login', { username, password });
    if (r.ok) this.signedIn(r, false);
    return r;
  },
  // null = not signed in, false = server unreachable, object = the account
  async resume() {
    if (!this.token) return null;
    try {
      const r = await this.api('/api/me');
      if (r.ok) { this.signedIn(r, false); return r; }
      if (r.auth === false) { this.forget(); return null; }
      return false;
    } catch (e) { return false; }
  },
  signedIn(r, fresh) {
    // a different account: the live connection still belongs to the old one, so drop it
    if (r.token && r.token !== this.token) { this.closeSocket(); if (typeof Social !== 'undefined') Social.reset(); }
    if (r.token) { this.token = r.token; try { localStorage.setItem(TOKEN_KEY, r.token); } catch (e) {} }
    this.openSocket(); // have it ready before the first thing they press
    this.user = { name: r.name, club: r.club, online: r.online, rank: r.rank || null, wc: r.wc || { round: 0, titles: 0 } };
    Save.useAccount(r.name, r.save, r.club, fresh);
    if (r.gift > 0) this.giftToast(r.gift); // already inside the save that just came back
  },
  giftToast(n) { setTimeout(() => { UI.refreshHome(); UI.toast(`GIFT  +${fmtCoins(n)} COINS`); }, 900); },
  forget() {
    this.token = null; this.user = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  },
  async logout() {
    try { await this.api('/api/logout'); } catch (e) {}
    this.closeSocket();
    this.forget();
    Social.reset();
    Save.useGuest();
  },

  // progress goes up a moment after it changes, batched
  queueSave() {
    if (!this.token) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.pushSave(), 1200);
  },
  async pushSave() {
    if (!this.token) return;
    try {
      const r = await this.api('/api/save', { save: Save.data, gifts: true });
      if (r.auth === false) { this.forget(); UI.showAuth('You were signed out. Log in again.'); }
      if (r.ok && r.gift > 0) { Save.data.coins += r.gift; Save.write(); this.giftToast(r.gift); }
    } catch (e) { this.saveTimer = setTimeout(() => this.pushSave(), 8000); }
  },

  async changePassword(password, newPassword) {
    try { return await this.api('/api/account/password', { password, newPassword }); } catch (e) { return { ok: false, msg: "Can't reach the server" }; }
  },

  async leaderboard() {
    try { return await this.api('/api/leaderboard'); } catch (e) { return { ok: false, msg: "Can't reach the server" }; }
  },

  async league() {
    try { return await this.api('/api/league'); } catch (e) { return { ok: false, msg: "Can't reach the server" }; }
  },

  // ---- live socket ----
  on(type, fn) { this.handlers[type] = fn; },

  openSocket() {
    this._wantSocket = true;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this._scheduleRetry(); return; }
    this.ws = ws; this.wsReady = false;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'auth', token: this.token })); };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.t === 'hello') { this.wsReady = true; this._retry = 0; }
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
      const waited = Date.now() - started;
      if (waited > this.WAKE_AFTER && !knocking) {
        knocking = true; this._waking = true;
        if (this.handlers.waking) this.handlers.waking();
        this.wake(null, 20, 3000).then(() => this.openSocket());
      }
      if (waited > this.GIVE_UP_AFTER) {
        this._waking = false;
        if (this.handlers.error) this.handlers.error({ msg: 'The server is still waking up — try that again in a moment' });
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
