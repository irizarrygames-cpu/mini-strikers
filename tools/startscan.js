// Starting the game, with the server awake and asleep. Paste into the page (or load it with a
// <script> tag) on a FRESH load of the game, then run ONE scenario per load:
//   await SS.run('ready')            the splash only says TAP TO START once a tap does something
//   await SS.run('asleep-returning') signed in before, server not answering: in from this device at once, online by itself later
//   await SS.run('asleep-new')       never signed in here, server not answering: the sign-in page, saying so, never a blank screen
//   await SS.run('awake-returning')  signed in before, server up: straight home
//   await SS.run('save-retry')       the server turns two saves down: the game keeps trying until one lands
//   await SS.run('flush')            leaving the page sends unsaved progress in a request that outlives it
//   await SS.run('calm')             a new build never reloads the page in the middle of a match
// 'asleep-*' fake the server's silence inside the page (requests to /api/ never answer until the
// scenario lets them through); the rest talk to the real server the page came from.
const SS = {
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  vis(id) {
    const e = document.getElementById(id);
    if (!e || e.hidden) return false;
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && !e.classList.contains('gone');
  },
  // requests to /api/ hang (or are answered by `fake`) until restore() is called
  realFetch: null,
  asleep(fake) {
    if (!this.realFetch) this.realFetch = window.fetch.bind(window);
    const real = this.realFetch;
    window.fetch = (u, o) => {
      if (!String(u).includes('/api/')) return real(u, o);
      if (fake) { const f = fake(String(u), o); if (f) return f; }
      return new Promise((res, rej) => {
        if (o && o.signal) o.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      });
    };
  },
  restore() { if (this.realFetch) window.fetch = this.realFetch; },
  tap() { document.getElementById('splash').dispatchEvent(new Event('pointerdown')); },
  async until(fn, ms) { const end = performance.now() + ms; while (performance.now() < end) { if (fn()) return true; await this.wait(100); } return !!fn(); },

  // from the tap on: was there ever a moment with neither the splash, the sign-in page nor the menu up?
  watchBlank() {
    const t0 = performance.now(), blank = [];
    const timer = setInterval(() => { if (!this.vis('splash') && !this.vis('auth') && !this.vis('home')) blank.push(Math.round(performance.now() - t0)); }, 50);
    return () => { clearInterval(timer); return blank; };
  },

  async run(name) {
    const checks = [];
    const check = (what, ok, detail) => checks.push((ok ? 'ok   ' : 'FAIL ') + what + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
    const t0 = performance.now(), ms = () => Math.round(performance.now() - t0);
    const toast = () => (document.getElementById('toast') || {}).textContent || '';
    try {
      if (name === 'ready') {
        check('the game says it is ready', window.__ready === true);
        check('the splash says TAP TO START', document.getElementById('splash-tap').textContent === 'TAP TO START');
        check('and has stopped saying LOADING', !document.getElementById('splash').classList.contains('loading'));
        const html = await (await fetch('/', { cache: 'no-store' })).text();
        const tapLine = (html.match(/id="splash-tap"[^>]*>([^<]*)</) || [])[1];
        check('the page as sent says LOADING, not TAP TO START, before the game has loaded', tapLine === 'LOADING…', tapLine);
        check('the game starts when the page is parsed, not on the load event', /DOMContentLoaded', \(\) => Game\.boot\(\)/.test(await (await fetch('js/main.js', { cache: 'no-store' })).text()));
      } else if (name === 'asleep-returning') {
        check('precondition: this device has been signed in', !!Net.token && !!Net.lastUser, { token: !!Net.token, lastUser: Net.lastUser });
        this.asleep();
        const blank = this.watchBlank();
        this.tap();
        await this.wait(300);
        check('right after the tap the splash is still up, saying STARTING', this.vis('splash') && document.getElementById('splash-tap').textContent === 'STARTING…');
        await this.wait(1700);
        check('after 2 s it says the server is waking up', /Waking the server up/.test(document.getElementById('splash-sub').textContent), document.getElementById('splash-sub').textContent);
        const inAt = (await this.until(() => this.vis('home') && !this.vis('splash'), 8000)) ? ms() : null;
        const gaps = blank();
        check('the home screen is up within 7 s, from this device', inAt !== null && inAt <= 7000, inAt);
        check('playing on this device until the server answers', Net.offline === true);
        check('and it says why', /WAKING UP/.test(toast()), toast());
        check('never a moment with nothing on screen', gaps.length === 0, gaps.slice(0, 5));
        this.restore();
        const onAt = (await this.until(() => !Net.offline, 20000)) ? ms() : null;
        check('once the server answers the game comes online by itself', onAt !== null, onAt);
      } else if (name === 'asleep-new') {
        Net.token = null; Net.lastUser = null; // as if this device had never signed in
        this.asleep();
        const blank = this.watchBlank();
        this.tap();
        await this.wait(300);
        check('right after the tap the sign-in page is up (or the splash still is)', this.vis('splash') || this.vis('auth'));
        const authAt = (await this.until(() => this.vis('auth') && !this.vis('splash'), 3000)) ? ms() : null;
        const gaps = blank();
        check('the sign-in page is up straight away', authAt !== null, authAt);
        check('never a moment with nothing on screen', gaps.length === 0, gaps.slice(0, 5));
        const msgAt = (await this.until(() => /Waking the server up/.test(document.getElementById('auth-msg').textContent), 7000)) ? ms() : null;
        check('and says the server is waking up', msgAt !== null, document.getElementById('auth-msg').textContent);
        this.restore();
        const clearAt = (await this.until(() => document.getElementById('auth-msg').textContent === '', 15000)) ? ms() : null;
        check('the note goes once the server answers', clearAt !== null, document.getElementById('auth-msg').textContent);
      } else if (name === 'awake-returning') {
        check('precondition: this device has been signed in', !!Net.token);
        const blank = this.watchBlank();
        this.tap();
        const homeAt = (await this.until(() => this.vis('home') && !this.vis('splash'), 6000)) ? ms() : null;
        const gaps = blank();
        check('straight home', homeAt !== null, homeAt);
        check('never a moment with nothing on screen', gaps.length === 0, gaps.slice(0, 5));
        check('online', Net.offline === false && !!Net.user);
        check('nothing of the sign-in page left over', !this.vis('auth'));
        check('no input still holding the keyboard', !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#auth')));
      } else if (name === 'save-retry') {
        check('precondition: signed in and online', !!Net.token && !Net.offline);
        let turned = 0;
        if (!this.realFetch) this.realFetch = window.fetch.bind(window);
        const real = this.realFetch;
        window.fetch = (u, o) => {
          if (String(u).includes('/api/save') && turned < 2) { turned++; return Promise.resolve(new Response('{"ok":false,"msg":"Slow down"}', { status: 429, headers: { 'Content-Type': 'application/json' } })); }
          return real(u, o);
        };
        const want = Save.data.coins + 5;
        Save.data.coins = want; Save.write();
        const savedAt = (await this.until(() => turned >= 2 && !Net.unsaved, 20000)) ? ms() : null;
        this.restore();
        check('two saves turned down, and the game kept trying until one landed', savedAt !== null, { turned, unsaved: Net.unsaved, ms: savedAt });
        const me = await (await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: Net.token }) })).json();
        check('the server has the new coins', me && me.save && me.save.coins === want, { server: me && me.save && me.save.coins, want });
      } else if (name === 'flush') {
        check('precondition: signed in and online', !!Net.token && !Net.offline);
        const real = window.fetch.bind(window);
        let sentKeepalive = false;
        window.fetch = (u, o) => { if (String(u).includes('/api/save') && o && o.keepalive) sentKeepalive = true; return real(u, o); };
        const want = Save.data.coins + 7;
        Save.data.coins = want; Save.write();     // queued: would go up in 1.2 s
        Net.flushSave();                           // ...but the page is going away now
        check('a save went up at once, in a request that outlives the page', sentKeepalive);
        await this.wait(1500);
        window.fetch = real;
        const me = await (await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: Net.token }) })).json();
        check('the server has it', me && me.save && me.save.coins === want, { server: me && me.save && me.save.coins, want });
      } else if (name === 'calm') {
        let ran = 0;
        const was = Game.state;
        Game.state = 'match';
        check('in a match is not calm', UI.calm() === false);
        Install._calmWait = null;
        Install.whenCalm(() => { ran++; });
        await this.wait(1200);
        check('a reload for a new build waits while the match is on', ran === 0);
        Game.state = 'home';
        const at = (await this.until(() => ran === 1, 12000)) ? ms() : null;
        check('and happens once back on the menu', at !== null, at);
        Game.state = was;
      } else {
        check('a scenario called ' + name, false);
      }
    } catch (e) {
      check('ran without throwing', false, String(e && e.stack || e));
    } finally { this.restore(); }
    const failed = checks.filter((c) => c.startsWith('FAIL')).length;
    return { scenario: name, failed, checks };
  },
};
window.SS = SS;
