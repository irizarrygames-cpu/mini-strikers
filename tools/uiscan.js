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
  PANELS: ['play', 'characters', 'customize', 'crates', 'collection', 'missions', 'settings', 'profile'],

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

  // `scrolls` says whether being below the fold is allowed: a panel scrolls, the home screen does not.
  scan(root, where, scrolls) {
    const hits = [], rb = root.getBoundingClientRect();
    for (const e of root.querySelectorAll('*')) {
      if (!this.vis(e)) continue;
      const cs = getComputedStyle(e), b = e.getBoundingClientRect();
      const leaf = !e.children.length;
      // decoration (a coin's shine, an icon) clips itself on purpose — only judge things with words in them
      const hasText = !!(e.textContent && e.textContent.trim());
      if (leaf && hasText && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && !/auto|scroll/.test(cs.overflowX))
        hits.push(`${where} OVERFLOW-X ${this.name(e)} ${e.scrollWidth} in ${e.clientWidth}`);
      if (leaf && hasText && e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 2 && cs.overflowY === 'hidden')
        hits.push(`${where} CLIPPED-Y ${this.name(e)} ${e.scrollHeight} in ${e.clientHeight}`);
      if (b.right > rb.right + 2 || b.left < rb.left - 2)
        hits.push(`${where} OUTSIDE ${this.name(e)} ${Math.round(b.left)}-${Math.round(b.right)} vs ${Math.round(rb.left)}-${Math.round(rb.right)}`);
      if (b.right > innerWidth + 2 || b.left < -2)
        hits.push(`${where} OFFSCREEN-X ${this.name(e)} ${Math.round(b.left)}-${Math.round(b.right)} in ${innerWidth}`);
      if (!scrolls && (b.bottom > innerHeight + 2 || b.top < -2))
        hits.push(`${where} OFFSCREEN-Y ${this.name(e)} ${Math.round(b.top)}-${Math.round(b.bottom)} in ${innerHeight}`);
      if (e.tagName === 'BUTTON' && (b.height < this.TAP || b.width < 30))
        hits.push(`${where} TINYTAP ${this.name(e)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return hits;
  },

  async run() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { size: innerWidth + 'x' + innerHeight, hits: [] };
    if (document.documentElement.scrollWidth > innerWidth + 1)
      out.hits.push(`PAGE scrolls sideways ${document.documentElement.scrollWidth} > ${innerWidth}`);
    const home = document.getElementById('home');
    if (home && !home.hidden) out.hits.push(...this.scan(home, 'home', false));
    const was = Save.data.tutorialSeen;
    Save.data.tutorialSeen = true;
    for (const kind of this.PANELS) {
      UI.openModal(kind);
      await wait(240);
      const p = document.querySelector('#modal .panel');
      if (p) {
        out.hits.push(...this.scan(p, kind, true));
        // and whatever bugscan's overlap check says about the same panel, if it is loaded
        if (window.BS) { const f = BS.panelFit(); if (f.hits.length) out.hits.push(...f.hits.map((h) => kind + ' STACK ' + h)); }
      }
      UI.closeModal();
      await wait(60);
    }
    Save.data.tutorialSeen = was;
    out.hits = [...new Set(out.hits)];
    out.count = out.hits.length;
    return out;
  },
};
