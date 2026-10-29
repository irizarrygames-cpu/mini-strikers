// UI scan — not loaded by the game. In the browser console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/uiscan.js'; s.onload = r; document.head.appendChild(s); });
//   await US.run()          // the home screen and every panel, at this window size
//   await US.sweep()        // the same, told what sizes to try (the pane resizes from outside)
//
// bugscan's panelFit answers "is anything sitting on top of anything else". This answers the
// other half: is anything too small to hit, cut off, or hanging out of the box it lives in.
// Both are needed — the CUSTOMIZE button that spilled out of its pill was invisible to overlap
// checks, and the 25px-tall home row overlapped nothing at all.
window.US = {
  PANELS: ['play', 'characters', 'customize', 'crates', 'coins', 'collection', 'missions', 'settings',
    'profile', 'league', 'ranked', 'leaderboard', 'cup', 'worldcup', 'pensmode', 'fkmode', 'friends'],

  // the full-screen ones, which the panel sweep never touched
  OVERLAYS: ['daily', 'howto', 'results', 'pause', 'queue', 'lobby'],

  // the smallest a thing you tap is allowed to be. Not the 44px of the phone guidelines — this
  // is a dense arcade menu and 44 would not fit — but nothing below this is honestly tappable.
  TAP: 34,

  vis(e) {
    const cs = getComputedStyle(e), b = e.getBoundingClientRect();
    return !e.hidden && cs.display !== 'none' && cs.visibility !== 'hidden'
      && Number(cs.opacity) > 0.05 && b.width > 2 && b.height > 2;
  },

  name(e) {
    const base = e.id ? '#' + e.id
      : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '');
    const t = (e.textContent || '').trim();
    return base + (t ? '[' + t.slice(0, 16) + ']' : '');
  },

  // Is this element's width somebody else's problem? A thing inside a box that scrolls sideways
  // is not hanging out of the screen — it is waiting its turn, and the box is what gets checked.
  insideAScroller(el, root) {
    for (let p = el.parentElement; p && p !== root.parentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
    }
    return false;
  },

  // `scrolls` says whether being below the fold is allowed: a panel scrolls, the home screen does not.
  scan(root, where, scrolls) {
    const hits = [], rb = root.getBoundingClientRect();
    // A panel scrolls up and down, never sideways. Everything inside a scroller is let off the
    // OUTSIDE check below, so a card grown wider than its panel was invisible to this scan until
    // this line: it is the panel itself that says so.
    if (root.scrollWidth > root.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(root).overflowX))
      hits.push(`${where} SCROLLS-X ${this.name(root)} ${root.scrollWidth} in ${root.clientWidth}`);
    for (const e of root.querySelectorAll('*')) {
      if (!this.vis(e)) continue;
      const cs = getComputedStyle(e), b = e.getBoundingClientRect();
      const leaf = !e.children.length;
      // decoration (a coin's shine, an icon) clips itself on purpose — only judge things with words in them
      const hasText = !!(e.textContent && e.textContent.trim());
      // how wide the words really are: centred words spill out of both sides, and scrollWidth only
      // counts the right-hand half of that (a word 8px too wide reads as 4)
      let wordsW = 0;
      if (leaf && hasText && e.clientWidth > 0) {
        const r = document.createRange();
        r.selectNodeContents(e);
        wordsW = r.getBoundingClientRect().width / (b.width / e.offsetWidth || 1);
      }
      const tooWide = e.scrollWidth > e.clientWidth + 1 || wordsW > e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 2;
      if (leaf && hasText && e.clientWidth > 0 && tooWide && !/auto|scroll/.test(cs.overflowX)) {
        // an ellipsis means somebody decided to cut this off; a plain overflow means nobody did
        const onPurpose = cs.textOverflow === 'ellipsis' && /hidden|clip/.test(cs.overflowX);
        hits.push(`${where} ${onPurpose ? 'ELLIPSIS' : 'OVERFLOW-X'} ${this.name(e)} ${Math.round(Math.max(e.scrollWidth, wordsW))} in ${e.clientWidth}`);
      }
      if (leaf && hasText && e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 2 && cs.overflowY === 'hidden')
        hits.push(`${where} CLIPPED-Y ${this.name(e)} ${e.scrollHeight} in ${e.clientHeight}`);
      // these two only mean something if nothing above it is already handling the width
      if (!this.insideAScroller(e, root)) {
        if (b.right > rb.right + 2 || b.left < rb.left - 2)
          hits.push(`${where} OUTSIDE ${this.name(e)} ${Math.round(b.left)}-${Math.round(b.right)} vs ${Math.round(rb.left)}-${Math.round(rb.right)}`);
        if (b.right > innerWidth + 2 || b.left < -2)
          hits.push(`${where} OFFSCREEN-X ${this.name(e)} ${Math.round(b.left)}-${Math.round(b.right)} in ${innerWidth}`);
      }
      if (!scrolls && (b.bottom > innerHeight + 2 || b.top < -2))
        hits.push(`${where} OFFSCREEN-Y ${this.name(e)} ${Math.round(b.top)}-${Math.round(b.bottom)} in ${innerHeight}`);
      if (e.tagName === 'BUTTON' && (b.height < this.TAP || b.width < 30))
        hits.push(`${where} TINYTAP ${this.name(e)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    hits.push(...this.english(root, where));
    return hits;
  },

  // In another language: any words on show that are still the English of a line that language has
  // (a tl() somebody forgot, or text the page set after I18N.apply ran)
  english(root, where) {
    const hits = [];
    const d = window.I18N && I18N.lang !== 'en' && I18N.dict[I18N.lang];
    if (!d) return hits;
    const own = (k) => Object.prototype.hasOwnProperty.call(d, k) && d[k] !== k;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const n = walk.currentNode, el = n.parentElement;
      const k = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!k || !el || !this.vis(el) || !own(k)) continue;
      hits.push(`${where} ENGLISH ${this.name(el)} ${JSON.stringify(k)}`);
    }
    for (const el of root.querySelectorAll('[placeholder], [title], [aria-label]')) {
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute(a);
        if (v && own(v)) hits.push(`${where} ENGLISH ${a} ${this.name(el)} ${JSON.stringify(v)}`);
      }
    }
    return hits;
  },

  // A wait that still takes the time it says in a page nobody is looking at (the Browser pane behind
  // the chat), where the browser holds timers back to once a second, then once a minute.
  sleep(ms) {
    if (!document.hidden) return new Promise((r) => setTimeout(r, ms));
    return new Promise((r) => {
      const end = performance.now() + ms, ch = new MessageChannel();
      ch.port1.onmessage = () => (performance.now() >= end ? r() : ch.port2.postMessage(0));
      ch.port2.postMessage(0);
    });
  },

  async run() {
    const wait = (ms) => this.sleep(ms);
    const out = { size: innerWidth + 'x' + innerHeight, hits: [] };
    // how the screen was, to put back at the end: the player card below asks the server about a
    // made-up sign-in, and the answer can come back after the scan as "signed out" (the sign-in
    // page), which left every later run in the same page never looking at the home screen
    const before = { home: document.getElementById('home').hidden, auth: document.getElementById('auth').hidden };
    if (document.documentElement.scrollWidth > innerWidth + 1)
      out.hits.push(`PAGE scrolls sideways ${document.documentElement.scrollWidth} > ${innerWidth}`);
    const home = document.getElementById('home');
    if (home && !home.hidden) out.hits.push(...this.scan(home, 'home', false));
    const was = Save.data.tutorialSeen;
    Save.data.tutorialSeen = true;
    // The shop only exists inside the app, so on a plain page its panels would show the empty
    // "sold in the app" line and nothing worth scanning. Play the part of the app for them.
    const real = { kind: Store.kind, status: Store.status, token: Net.token, offline: Net.offline, sel: Store.sel, gate: Store.gate };
    const asApp = () => { Store.kind = 'test'; Store.status = { ok: true, enabled: true, canBuy: true, bought: 0, limit: 4 }; Net.token = Net.token || 'scan'; Net.offline = false; };
    const asWeb = () => { Store.kind = real.kind; Store.status = real.status; Net.token = real.token; Net.offline = real.offline; Store.sel = real.sel; Store.gate = real.gate; };
    // each screen once, and the shop a second time with the grown-up check showing
    const visits = this.PANELS.map((k) => [k, k]).concat([['coins', 'coins (grown-up check)']]);
    for (const [kind, label] of visits) {
      if (kind === 'coins' || kind === 'crates') asApp();
      if (label.includes('check')) { Store.sel = PRODUCTS[1].id; Store.newGate(); } else Store.sel = null;
      UI.openModal(kind);
      await wait(240);
      const p = document.querySelector('#modal .panel');
      if (p) {
        out.hits.push(...this.scan(p, label, true));
        // and whatever bugscan's overlap check says about the same panel, if it is loaded
        if (window.BS) { const f = BS.panelFit(); if (f.hits.length) out.hits.push(...f.hits.map((h) => label + ' STACK ' + h)); }
      }
      UI.closeModal();
      asWeb();
      await wait(60);
    }
    // and the overlays: the results card, how to play, the daily reward, the pause menu, and
    // the two waiting rooms. Each is shown as it is, looked at, and put back.
    for (const id of this.OVERLAYS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const was2 = el.hidden;
      el.hidden = false;
      if (UI.fitWords) UI.fitWords(el); // as the game does when it shows one (the results title)
      await wait(160);
      const panel = el.querySelector('.panel') || el;
      out.hits.push(...this.scan(panel, id, true));
      el.hidden = was2;
      await wait(40);
    }

    // the sign-in screen: log in, sign up (with the country picker) and the way in with no account
    {
      const home = document.getElementById('home'), auth = document.getElementById('auth');
      const homeWas = home.hidden, authWas = auth.hidden, offered = Net.offlineOffer, picked = I18N.pickedNow;
      // signing up starts with the language: looked at on its own, then the form behind it
      UI.showAuth();
      I18N.pickedNow = false;
      UI.setAuthMode('signup');
      await wait(250);
      const sheet = document.querySelector('#lang-pick .panel');
      if (sheet) out.hits.push(...this.scan(sheet, 'language (sign up)', true));
      else out.hits.push('language (sign up) NOT ASKED when signing up');
      document.querySelectorAll('#lang-pick').forEach((x) => x.remove());
      I18N.pickedNow = true;
      for (const [label, mode, offer] of [['auth (log in)', 'login', false], ['auth (sign up)', 'signup', false], ['auth (log in, no connection)', 'login', true]]) {
        Net.offlineOffer = offer;
        UI.showAuth();
        const tab = document.querySelector(`[data-auth="${mode}"]`);
        if (tab) tab.click();
        await wait(250);
        const card = document.querySelector('.auth-card');
        if (card) out.hits.push(...this.scan(card, label, true));
      }
      I18N.pickedNow = picked;
      Net.offlineOffer = offered;
      auth.hidden = authWas; home.hidden = homeWas;
      // and the same list from Settings
      UI.askLanguage('settings');
      await wait(200);
      const sheet2 = document.querySelector('#lang-pick .panel');
      if (sheet2) out.hits.push(...this.scan(sheet2, 'language (settings)', true));
      document.querySelectorAll('#lang-pick').forEach((x) => x.remove());
    }
    // the grown-up check, which goes in front of a purchase or a link out of the game
    {
      UI.grownUpCheck(tl('This opens a web page outside the game.'));
      await wait(200);
      const el = document.querySelector('.grownup .panel');
      if (el) out.hits.push(...this.scan(el, 'grown-up check', true));
      const g = document.querySelector('.grownup'); if (g) g.remove();
    }
    // build 104: a recovery code, the forgot-password form, "leave the game?", and a player's card
    // (with the longest name there can be), each shown, looked at and put away
    {
      const look = async (sel, label) => { await wait(200); const el = document.querySelector(sel); if (el) out.hits.push(...this.scan(el, label, true)); };
      UI.showCode('ABCD-EFGH-JKLM', 'reset');
      await look('.overlay.sheet .panel', 'recovery code');
      document.querySelectorAll('.overlay.sheet').forEach((x) => x.remove());
      UI.showForgot();
      await look('.overlay.sheet .panel', 'forgot password');
      document.querySelectorAll('.overlay.sheet').forEach((x) => x.remove());
      UI.askLeave();
      await look('.overlay.leave .panel', 'leave the game');
      document.querySelectorAll('.overlay.leave').forEach((x) => x.remove());
      const tok = Net.token, user = Net.user;
      Net.token = tok || 'scan'; Net.user = user || { name: 'SCAN' };
      UI.openPlayer('WWWWWWWWWWWWWW', 'friends');
      await look('#modal .panel', 'player card');
      UI.openPlayer(null, 'friends');
      await look('#modal .panel', 'player card (find)');
      UI.closeModal();
      Net.token = tok; Net.user = user;
    }

    Save.data.tutorialSeen = was;
    await wait(900);
    document.getElementById('home').hidden = before.home;
    document.getElementById('auth').hidden = before.auth;
    if (!before.home) UI.refreshHome();
    out.hits = [...new Set(out.hits)];
    out.count = out.hits.length;
    return out;
  },
};
