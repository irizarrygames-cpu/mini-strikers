// Touch: joystick (bottom-left), PASS / SHOOT / SKILL / SPRINT buttons (bottom-right).
// PC: keyboard + mouse, see KEYS below.
const KEYS = {
  up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'],
  sprint: ['shift'],
  pass: ['e', 'j'],
  shoot: [' ', 'k'],
  skill: ['q', 'l'],
  slide: ['f', 'i'],
  ult: ['r'],
  pause: ['escape', 'p'],
};
const keyIs = (k, action) => KEYS[action].includes(k);

const Input = {
  move: { x: 0, y: 0 },
  stick: { x: 0, y: 0 },   // touch joystick only
  keys: new Set(),
  shootHeld: false,
  sprintHeld: false,
  passHeld: false,
  lastDevice: 'touch',
  _passQueued: false,
  _skillQueued: false,
  _ultQueued: false,
  _slideQueued: false,
  _shootPressed: false,
  _shootReleased: false,
  _passPressed: false,
  _joyId: null,
  _joyCenter: { x: 0, y: 0 },
  _holds: { shoot: new Set(), sprint: new Set(), pass: new Set() },
  _keyHold: { shoot: false, sprint: false, pass: false },
  _mouseShoot: false,
  _mousePass: false,

  init() {
    this.zone = document.getElementById('touch-zone');
    this.base = document.getElementById('joy-base');
    this.knob = document.getElementById('joy-knob');
    this.btnPass = document.getElementById('btn-pass');
    this.btnShoot = document.getElementById('btn-shoot');
    this.btnSkill = document.getElementById('btn-skill');
    this.btnSprint = document.getElementById('btn-sprint');
    this.btnUlt = document.getElementById('btn-ult');

    this.zone.addEventListener('pointerdown', (e) => this._joyDown(e));
    window.addEventListener('pointermove', (e) => this._joyMove(e));
    window.addEventListener('pointerup', (e) => this._joyUp(e));
    window.addEventListener('pointercancel', (e) => this._joyUp(e));

    this._holdButton(this.btnPass, 'pass');
    this._tapButton(this.btnSkill, () => { this._skillQueued = true; });
    if (this.btnUlt) this._tapButton(this.btnUlt, () => { this._ultQueued = true; });
    this._holdButton(this.btnShoot, 'shoot');
    this._holdButton(this.btnSprint, 'sprint');

    const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k.startsWith('arrow') || k === 'tab') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      this.lastDevice = 'keyboard';
      if (keyIs(k, 'pass')) { this._keyHold.pass = true; this._syncHold('pass'); }
      if (keyIs(k, 'ult')) { this._ultQueued = true; this._flash(this.btnUlt); }
      if (keyIs(k, 'skill')) { this._skillQueued = true; this._flash(this.btnSkill); }
      if (keyIs(k, 'slide')) { this._slideQueued = true; this._flash(this.btnSkill); }
      if (keyIs(k, 'shoot')) { this._keyHold.shoot = true; this._syncHold('shoot'); }
      if (keyIs(k, 'sprint')) { this._keyHold.sprint = true; this._syncHold('sprint'); }
      if (keyIs(k, 'pause')) UI.togglePause();
      UI.keyLegendPress(k, true);
    });
    window.addEventListener('keyup', (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (keyIs(k, 'shoot')) { this._keyHold.shoot = false; this._syncHold('shoot'); }
      if (keyIs(k, 'sprint')) { this._keyHold.sprint = false; this._syncHold('sprint'); }
      if (keyIs(k, 'pass')) { this._keyHold.pass = false; this._syncHold('pass'); }
      UI.keyLegendPress(k, false);
    });

    // mouse on the pitch: left = hold to shoot, right = hold to pass
    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', (e) => {
      if (Game.state !== 'match') return;
      Sound.unlock();
      this.lastDevice = 'keyboard';
      if (e.button === 0) { this._mouseShoot = true; this._syncHold('shoot'); }
      if (e.button === 2) { this._mousePass = true; this._syncHold('pass'); }
      if (e.button === 1) { e.preventDefault(); this._skillQueued = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this._mouseShoot) { this._mouseShoot = false; this._syncHold('shoot'); }
      if (e.button === 2 && this._mousePass) { this._mousePass = false; this._syncHold('pass'); }
    });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  _flash(btn) {
    btn.classList.add('down');
    setTimeout(() => btn.classList.remove('down'), 110);
  },

  _tapButton(btn, fn) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      this.lastDevice = 'touch';
      fn();
      btn.classList.add('down');
    });
    const up = () => btn.classList.remove('down');
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  },

  _holdButton(btn, name) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      this.lastDevice = 'touch';
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this._holds[name].add(e.pointerId);
      this._syncHold(name);
    });
    const up = (e) => {
      if (!this._holds[name].delete(e.pointerId)) return;
      this._syncHold(name);
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  },

  _syncHold(name) {
    const down = this._holds[name].size > 0 || this._keyHold[name] || (name === 'shoot' && this._mouseShoot) || (name === 'pass' && this._mousePass);
    if (name === 'pass') {
      if (down === this.passHeld) return;
      this.passHeld = down;
      if (down) this._passPressed = true; else this._passQueued = true; // the pass itself goes on release
      this.btnPass.classList.toggle('down', down);
      return;
    }
    if (name === 'shoot') {
      if (down === this.shootHeld) return;
      this.shootHeld = down;
      if (down) this._shootPressed = true; else this._shootReleased = true;
      this.btnShoot.classList.toggle('down', down);
    } else {
      this.sprintHeld = down;
      this.btnSprint.classList.toggle('down', down);
    }
  },

  _restCenter() {
    const r = this.base.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },

  _joyDown(e) {
    Sound.unlock();
    if (this._joyId !== null) return;
    if (e.clientX > window.innerWidth * 0.5) return;
    e.preventDefault();
    this.lastDevice = 'touch';
    this._joyId = e.pointerId;
    const rad = this.base.offsetWidth / 2;
    const cx = clamp(e.clientX, rad + 8, window.innerWidth * 0.5 - rad);
    const cy = clamp(e.clientY, rad + 8, window.innerHeight - rad - 8);
    this._joyCenter = { x: cx, y: cy };
    const rest = this._restCenter();
    this.base.style.transform = `translate(${cx - rest.x}px, ${cy - rest.y}px)`;
    this.base.classList.add('active');
    this._joyMove(e);
  },

  _joyMove(e) {
    if (e.pointerId !== this._joyId) return;
    const rad = this.base.offsetWidth / 2;
    const max = rad * 0.72;
    let dx = e.clientX - this._joyCenter.x, dy = e.clientY - this._joyCenter.y;
    const l = Math.hypot(dx, dy);
    if (l > max) { dx *= max / l; dy *= max / l; }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    let mx = dx / max, my = dy / max;
    const m = Math.hypot(mx, my);
    if (m < 0.18) { mx = 0; my = 0; } else { const s = Math.min(1, (m - 0.18) / 0.72) / m; mx *= s; my *= s; }
    this.stick.x = mx; this.stick.y = my;
  },

  _joyUp(e) {
    if (e.pointerId !== this._joyId) return;
    this._joyId = null;
    this.stick.x = 0; this.stick.y = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.style.transform = '';
    this.base.classList.remove('active');
  },

  update() {
    const held = (a) => KEYS[a].some((k) => this.keys.has(k));
    let kx = 0, ky = 0;
    if (held('left')) kx -= 1;
    if (held('right')) kx += 1;
    if (held('up')) ky -= 1;
    if (held('down')) ky += 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      this.move.x = kx / l; this.move.y = ky / l;
    } else {
      this.move.x = this.stick.x; this.move.y = this.stick.y;
    }
  },

  consumePass() { const v = this._passQueued; this._passQueued = false; return v; },
  consumePassPress() { const v = this._passPressed; this._passPressed = false; return v; },
  consumeSkill() { const v = this._skillQueued; this._skillQueued = false; return v; },
  consumeUlt() { const v = this._ultQueued; this._ultQueued = false; return v; },
  consumeSlide() { const v = this._slideQueued; this._slideQueued = false; return v; },
  consumeShootPress() { const v = this._shootPressed; this._shootPressed = false; return v; },
  consumeShootRelease() { const v = this._shootReleased; this._shootReleased = false; return v; },

  reset() {
    this.keys.clear();
    this._passQueued = false; this._skillQueued = false; this._slideQueued = false;
    this._shootPressed = false; this._shootReleased = false; this._passPressed = false;
    this._holds.shoot.clear(); this._holds.sprint.clear(); this._holds.pass.clear();
    this._keyHold.shoot = false; this._keyHold.sprint = false; this._keyHold.pass = false; this._mouseShoot = false; this._mousePass = false;
    this.shootHeld = false; this.sprintHeld = false; this.passHeld = false;
    for (const b of [this.btnShoot, this.btnPass, this.btnSkill, this.btnSprint, this.btnUlt]) if (b) b.classList.remove('down');
    if (this._joyId !== null) this._joyUp({ pointerId: this._joyId });
    this.stick.x = 0; this.stick.y = 0; this.move.x = 0; this.move.y = 0;
  },
};
