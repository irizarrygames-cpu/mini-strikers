// Effects for the parts of the game that are not the pitch.
//
// FX handles the match, because the match is a canvas. Everything else — crates, missions,
// buying, levelling, the results card — is ordinary page furniture, and none of it had anything.
// You opened a six-hundred-thousand-coin crate and got a line of text.
//
// So: confetti, a flash, a ring, coins flying to the counter, and a shake, all over the top of
// whatever is on screen. Hard-edged shapes in the game's own colours, cleaned up after
// themselves, and switched off for anyone who has asked for less movement.
const Pop = {
  layer: null,
  live: 0,          // pieces on screen right now, so a mad clicker cannot bury the page
  MAX: 220,

  calm() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  },
  // the game already lets you turn the pretty things down; respect that here too
  low() { return (Save.data && Save.data.settings && Save.data.settings.graphics === 'low') || this.calm(); },

  root() {
    if (this.layer && this.layer.isConnected) return this.layer;
    const el = document.createElement('div');
    el.id = 'pop-layer';
    document.body.appendChild(el);
    this.layer = el;
    return el;
  },

  // take a piece back when it has finished, so the page does not fill up with dead confetti
  retire(el, ms) {
    this.live++;
    setTimeout(() => { el.remove(); this.live--; }, ms);
  },

  // where something is on screen, for effects that start from a button or a card
  at(el) {
    if (!el || !el.getBoundingClientRect) return { x: innerWidth / 2, y: innerHeight / 2 };
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  },

  // ---- the whole screen goes a colour for an instant
  flash(color = '#ffffff', strength = 0.35, ms = 220) {
    if (this.calm()) return;
    const el = document.createElement('div');
    el.className = 'pop-flash';
    el.style.background = color;
    el.style.setProperty('--a', String(strength));
    el.style.setProperty('--ms', ms + 'ms');
    this.root().appendChild(el);
    this.retire(el, ms + 60);
  },

  // ---- a ring opening out from a point
  ring(x, y, color = '#ffffff', size = 220, ms = 460) {
    if (this.low()) return;
    const el = document.createElement('div');
    el.className = 'pop-ring';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.borderColor = color;
    el.style.setProperty('--size', size + 'px');
    el.style.setProperty('--ms', ms + 'ms');
    this.root().appendChild(el);
    this.retire(el, ms + 60);
  },

  // ---- confetti thrown from a point
  confetti(x, y, colors, n = 28, spread = 1) {
    if (this.calm()) return;
    const many = this.low() ? Math.round(n * 0.4) : n;
    const room = Math.max(0, this.MAX - this.live);
    const count = Math.min(many, room);
    const root = this.root();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('i');
      el.className = 'pop-bit';
      const a = (Math.random() * Math.PI * 2);
      const dist = (90 + Math.random() * 230) * spread;
      const ms = 700 + Math.random() * 700;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.background = colors[(Math.random() * colors.length) | 0];
      el.style.setProperty('--dx', Math.cos(a) * dist + 'px');
      el.style.setProperty('--dy', (Math.sin(a) * dist + 160 + Math.random() * 120) + 'px');
      el.style.setProperty('--spin', (Math.random() * 900 - 450) + 'deg');
      el.style.setProperty('--ms', ms + 'ms');
      el.style.width = (5 + Math.random() * 6) + 'px';
      el.style.height = (7 + Math.random() * 8) + 'px';
      if (Math.random() < 0.3) el.style.borderRadius = '50%';
      root.appendChild(el);
      this.retire(el, ms + 80);
    }
  },

  // ---- coins flying to wherever the coin counter is
  coins(fromEl, n = 10) {
    if (this.calm()) return;
    const from = this.at(fromEl);
    const target = document.querySelector('.panel-coins .coin, .coins .coin, #coins');
    const to = target ? this.at(target) : { x: innerWidth - 60, y: 40 };
    const many = Math.min(this.low() ? 5 : n, Math.max(0, this.MAX - this.live));
    const root = this.root();
    for (let i = 0; i < many; i++) {
      const el = document.createElement('i');
      el.className = 'pop-coin';
      const ms = 480 + Math.random() * 380;
      el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
      el.style.setProperty('--dx', (to.x - from.x) + 'px');
      el.style.setProperty('--dy', (to.y - from.y) + 'px');
      el.style.setProperty('--sx', (Math.random() * 120 - 60) + 'px');
      el.style.setProperty('--ms', ms + 'ms');
      el.style.animationDelay = (i * 32) + 'ms';
      root.appendChild(el);
      this.retire(el, ms + i * 32 + 120);
    }
  },

  // ---- paying for something: the coins come off the counter and go into whatever you bought
  spend(toEl, n = 10) {
    if (this.calm()) return;
    const from = this.at(this.counter());
    const to = this.at(toEl);
    const many = Math.min(this.low() ? 5 : n, Math.max(0, this.MAX - this.live));
    const root = this.root();
    for (let i = 0; i < many; i++) {
      const el = document.createElement('i');
      el.className = 'pop-coin';
      const ms = 420 + Math.random() * 300;
      el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
      el.style.setProperty('--dx', (to.x - from.x + (Math.random() * 50 - 25)) + 'px');
      el.style.setProperty('--dy', (to.y - from.y + (Math.random() * 40 - 20)) + 'px');
      el.style.setProperty('--sx', (Math.random() * 80 - 40) + 'px');
      el.style.setProperty('--ms', ms + 'ms');
      el.style.animationDelay = (i * 26) + 'ms';
      root.appendChild(el);
      this.retire(el, ms + i * 26 + 120);
    }
  },

  // where the coin counter is, whichever screen you are on
  counter() { return document.querySelector('.panel-coins .coin, #coins, .coins .coin'); },

  // ---- the counter rolls to its new number instead of flicking to it
  // Watching it climb is half the reward; watching it drop is half the price.
  count(el, from, to, ms = 700) {
    if (!el) return;
    if (this.calm() || from === to) { el.textContent = fmtCoins(to); return; }
    clearInterval(el._rollT);
    const t0 = performance.now();
    el.classList.add('counting');
    el._rollT = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtCoins(Math.round(from + (to - from) * eased));
      if (k >= 1) { clearInterval(el._rollT); el.classList.remove('counting'); el.textContent = fmtCoins(to); }
    }, 40);
  },

  // ---- a word thrown up the screen
  shout(x, y, text, color = '#ffffff', ms = 900) {
    if (this.calm()) return;
    const el = document.createElement('b');
    el.className = 'pop-shout chunky';
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.color = color;
    el.style.setProperty('--ms', ms + 'ms');
    this.root().appendChild(el);
    this.retire(el, ms + 80);
  },

  // ---- give something a shake (a card, a panel, the screen)
  shake(el, hard = 1) {
    if (!el || this.calm()) return;
    el.style.setProperty('--shake', hard.toFixed(2));
    el.classList.remove('pop-shaking');
    void el.offsetWidth;
    el.classList.add('pop-shaking');
    setTimeout(() => el.classList.remove('pop-shaking'), 420);
  },

  // ---- the big one: you have just been given something
  // grade decides how much of a fuss is made, so a common is a nod and a mythic is an event.
  prize(el, grade = 'common') {
    const r = (typeof RARITIES !== 'undefined' && RARITIES[grade]) || { color: '#ffffff' };
    const { x, y } = this.at(el);
    const big = grade === 'legendary' || grade === 'mythic';
    const huge = grade === 'mythic';
    this.ring(x, y, r.color, big ? 320 : 210, big ? 560 : 440);
    this.confetti(x, y, [r.color, '#ffffff', '#ffc21a', '#ff8a1f'], huge ? 70 : big ? 46 : 24, big ? 1.25 : 1);
    if (big) this.flash(r.color, huge ? 0.42 : 0.26, 260);
    if (huge) {
      setTimeout(() => this.confetti(x, y, [r.color, '#ffffff'], 46, 1.4), 220);
      setTimeout(() => this.ring(x, y, '#ffffff', 420, 620), 160);
    }
    this.shake(document.querySelector('#modal .panel') || document.body, huge ? 1.6 : big ? 1.1 : 0.6);
  },
};
