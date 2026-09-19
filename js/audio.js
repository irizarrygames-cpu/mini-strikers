// All sounds are synthesized with WebAudio — no audio files to load.
const Sound = {
  ctx: null, master: null, sfx: null, music: null, amb: null, noise: null,
  enabled: true, musicOn: false, _musicTimer: null, _step: 0, _nextTime: 0,
  _ambSrc: null, _ambGain: null, _charge: null, _lastBounce: 0,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 4;
      comp.connect(this.master);
      this.sfx = c.createGain(); this.sfx.connect(comp);
      this.music = c.createGain(); this.music.connect(comp);
      this.amb = c.createGain(); this.amb.connect(comp);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  applyVolumes() {
    if (!this.ctx) return;
    const s = Save.data.settings;
    this.sfx.gain.value = s.sfx;
    this.amb.gain.value = s.sfx * 0.9;
    this.music.gain.value = s.music * 0.32;
  },

  ok() { return this.enabled && this.ctx && !Game.headless; },

  tone(type, f0, f1, dur, vol, when = 0, dest = null) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  },

  hiss(dur, type, freq, q, vol, when = 0, freqTo = 0, dest = null, attack = 0.004) {
    const c = this.ctx, t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },

  // ---- game sounds ----
  kick(power) {
    if (!this.ok()) return;
    this.tone('sine', 170 + power * 40, 45, 0.14 + power * 0.06, 0.9);
    this.hiss(0.06, 'highpass', 1400, 0.7, 0.3 + power * 0.25);
    if (power > 0.6) this.hiss(0.18, 'lowpass', 900, 0.5, 0.35, 0, 200);
  },
  pass() {
    if (!this.ok()) return;
    this.tone('sine', 230, 95, 0.09, 0.55);
    this.hiss(0.035, 'highpass', 2500, 0.8, 0.18);
  },
  bounce(v) {
    if (!this.ok()) return;
    const now = this.ctx.currentTime;
    if (now - this._lastBounce < 0.06) return;
    this._lastBounce = now;
    this.tone('sine', 150, 70, 0.07, clamp(v / 900, 0.05, 0.4));
  },
  board(v) {
    if (!this.ok()) return;
    this.tone('square', 110, 60, 0.08, clamp(v / 2500, 0.03, 0.18));
    this.hiss(0.08, 'lowpass', 700, 0.6, clamp(v / 1500, 0.05, 0.35));
  },
  post() {
    if (!this.ok()) return;
    this.tone('triangle', 1250, 1180, 0.45, 0.35);
    this.tone('sine', 1870, 1800, 0.3, 0.18);
    this.hiss(0.05, 'highpass', 3000, 0.7, 0.3);
  },
  net() {
    if (!this.ok()) return;
    this.hiss(0.4, 'bandpass', 2200, 1.1, 0.7, 0, 380);
  },
  tap() {
    if (!this.ctx || !this.enabled) return;
    this.tone('sine', 620, 900, 0.06, 0.3);
  },
  chat() {
    if (!this.ctx || !this.enabled) return;
    this.tone('sine', 880, 1180, 0.05, 0.16);
  },
  steal() {
    if (!this.ok()) return;
    this.tone('square', 480, 780, 0.07, 0.12);
    this.hiss(0.05, 'bandpass', 1600, 1, 0.2);
  },
  slide() {
    if (!this.ok()) return;
    this.hiss(0.36, 'lowpass', 1600, 0.6, 0.5, 0, 260);
    this.tone('sine', 95, 50, 0.14, 0.35);
  },
  tackle() {
    if (!this.ok()) return;
    this.tone('sine', 130, 38, 0.2, 1);
    this.hiss(0.14, 'lowpass', 1000, 0.6, 0.55);
    this.tone('square', 300, 160, 0.08, 0.08);
  },
  skill() {
    if (!this.ok()) return;
    this.hiss(0.16, 'bandpass', 700, 1.6, 0.4, 0, 2600);
    this.tone('triangle', 540, 1040, 0.1, 0.1);
  },
  possession() {
    if (!this.ok()) return;
    this.tone('triangle', 900, 1250, 0.05, 0.12);
  },
  save() {
    if (!this.ok()) return;
    this.tone('sine', 130, 40, 0.2, 1);
    this.hiss(0.16, 'lowpass', 1200, 0.6, 0.6);
    this.hiss(0.05, 'highpass', 3500, 0.6, 0.3);
  },
  whistle(kind) {
    if (!this.ok()) return;
    const blow = (when, dur) => {
      const c = this.ctx, t = c.currentTime + when;
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 2750;
      lfo.frequency.value = 38; lg.gain.value = 90;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfx);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
    };
    if (kind === 'end') { blow(0, 0.22); blow(0.3, 0.22); blow(0.6, 0.7); }
    else if (kind === 'long') blow(0, 0.55);
    else blow(0, 0.28);
  },
  cheer(big) {
    if (!this.ok()) return;
    const d = big ? 3.2 : 1.4;
    this.hiss(d, 'bandpass', 900, 0.5, big ? 0.8 : 0.35, 0, 600, this.amb, 0.25);
    this.hiss(d * 0.8, 'bandpass', 2400, 0.9, big ? 0.35 : 0.15, 0.05, 1500, this.amb, 0.2);
    if (big) for (let i = 0; i < 26; i++) this.hiss(0.03, 'highpass', 2000, 0.5, rand(0.08, 0.22), rand(0.2, 2.6), 0, this.amb);
  },
  ooh() {
    if (!this.ok()) return;
    this.hiss(1.1, 'bandpass', 500, 2.5, 0.35, 0, 350, this.amb, 0.15);
  },
  goalJingle(win) {
    if (!this.ok()) return;
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262];
    notes.forEach((f, i) => this.tone('square', f, f, 0.16, 0.12, i * 0.09));
  },
  countdown(go) {
    if (!this.ok()) return;
    this.tone('square', go ? 880 : 520, go ? 880 : 520, go ? 0.22 : 0.1, 0.12);
  },
  chargeStart() {
    if (!this.ok()) return;
    this.chargeStop();
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(760, t + CFG.CHARGE_FULL);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.08);
    o.connect(g); g.connect(this.sfx); o.start(t);
    this._charge = { o, g };
  },
  chargeStop() {
    if (!this._charge || !this.ctx) return;
    const { o, g } = this._charge, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.stop(t + 0.07);
    this._charge = null;
  },
  powerShot() {
    if (!this.ok()) return;
    this.tone('sawtooth', 1100, 90, 0.4, 0.22);
    this.tone('sine', 110, 28, 0.45, 1);
    this.hiss(0.5, 'lowpass', 2400, 0.7, 0.7, 0, 180);
    this.hiss(0.12, 'highpass', 4000, 0.5, 0.35);
  },
  // replay in/out: a tape-style swoosh
  whoosh(up = true) {
    if (!this.ok()) return;
    this.hiss(0.32, 'bandpass', up ? 500 : 2600, 1.2, 0.22, 0, up ? 2600 : 500, null, 0.06);
  },
  powerReady() {
    if (!this.ok()) return;
    [660, 880, 1320].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.14, i * 0.07));
  },

  // ---- crowd ambience ----
  startAmbience() {
    if (!this.ok() || this._ambSrc) return;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.07;
    src.connect(f); f.connect(g); g.connect(this.amb); src.start();
    this._ambSrc = src; this._ambGain = g;
  },
  setExcitement(x) {
    if (!this._ambGain) return;
    this._ambGain.gain.setTargetAtTime(0.06 + x * 0.12, this.ctx.currentTime, 0.4);
  },
  stopAmbience() {
    if (this._ambSrc) { try { this._ambSrc.stop(); } catch (e) { /* already stopped */ } }
    this._ambSrc = null; this._ambGain = null;
  },

  // ---- music: short upbeat loop, kept quiet under the sound effects ----
  startMusic() {
    if (!this.ctx || !this.enabled || this.musicOn) return;
    this.musicOn = true;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    this._musicTimer = setInterval(() => this._schedule(), 30);
  },
  stopMusic() {
    this.musicOn = false;
    clearInterval(this._musicTimer);
  },
  _schedule() {
    const c = this.ctx, spb = 60 / 124 / 2; // eighth notes
    const chords = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
    const bass = [131, 110, 87, 98];
    while (this._nextTime < c.currentTime + 0.12) {
      const s = this._step % 32, bar = (this._step / 8 | 0) % 4, t = this._nextTime - c.currentTime;
      if (s % 4 === 0) this.tone('sine', 120, 45, 0.12, 0.55, t, this.music);
      if (s % 2 === 1) this.hiss(0.03, 'highpass', 7000, 0.5, 0.12, t, 0, this.music);
      if (s % 8 === 4) this.hiss(0.09, 'bandpass', 1800, 0.8, 0.28, t, 0, this.music);
      if (s % 2 === 0) this.tone('triangle', bass[bar] * (s % 4 === 2 ? 2 : 1), bass[bar] * (s % 4 === 2 ? 2 : 1), 0.2, 0.3, t, this.music);
      if (s % 8 === 2 || s % 8 === 5) chords[bar].forEach((f) => this.tone('square', f * 2, f * 2, 0.1, 0.035, t, this.music));
      this._nextTime += spb;
      this._step++;
    }
  },
};

function vibrate(pattern) {
  if (Game.headless || !Save.data.settings.vibration) return;
  // phones only, and only after a real tap (Chrome logs an error for anything else)
  if (!UI.isTouch() || Input.lastDevice !== 'touch') return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
}
