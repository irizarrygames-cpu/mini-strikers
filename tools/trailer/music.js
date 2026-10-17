// The trailer's music. Written here, note by note, because nothing borrowed may go in it.
//
// It is an arcade march: square-wave lead, a saw bass, and drums made out of filtered noise and
// a falling sine. 120 beats a minute, so a bar is exactly two seconds and a four-bar phrase is
// eight — which is how the film can cut on the music without anybody counting frames.
//
// Fifteen phrases, one per scene, arranged so it grows: a bare intro, the tune, the tune with
// everything on top, a breakdown where it drops to almost nothing, and a last eight bars with
// the lot. Rendered offline, so the result is identical every time and never depends on the
// machine keeping up.
const Music = {
  BPM: 120,
  get beat() { return 60 / this.BPM; },          // 0.5s
  get bar() { return this.beat * 4; },           // 2s

  // ---- notes. A4 is 440; everything else is worked out from it.
  hz(name) {
    if (!name || name === '-') return 0;
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return 0;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    const midi = 12 * (+m[3] + 1) + base + acc;
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  // ---- the tune.
  //
  // Four chords that go round: C - G - Am - F. Bright, and it lifts in the middle, which is what
  // a game for a kid should sound like. Each string below is one bar of sixteenth notes; a dash
  // holds whatever came before and a dot is silence.
  CHORDS: [
    ['C3', 'E3', 'G3'],
    ['G2', 'B2', 'D3'],
    ['A2', 'C3', 'E3'],
    ['F2', 'A2', 'C3'],
  ],

  // the hook: eight bars that answer each other
  LEAD: [
    'G4 . C5 . E5 . D5 . C5 . . . G4 . . .',
    'D5 . . . B4 . . . G4 . A4 . B4 . . .',
    'C5 . E5 . A5 . G5 . E5 . . . C5 . . .',
    'F5 . E5 . D5 . C5 . D5 . . . . . . .',
    'G4 . C5 . E5 . G5 . E5 . . . C5 . . .',
    'D5 . G5 . B5 . A5 . G5 . . . D5 . . .',
    'A5 . G5 . E5 . C5 . D5 . E5 . G5 . . .',
    'C6 . . . . . . . G5 . . . E5 . . .',
  ],
  // a counter-line, an octave down, that fills the gaps the hook leaves
  HARM: [
    '. . . . G3 . . . . . E3 . . . C4 .',
    '. . . . D4 . . . . . B3 . . . G3 .',
    '. . . . C4 . . . . . A3 . . . E4 .',
    '. . . . A3 . . . . . F3 . . . C4 .',
    '. . . . E4 . . . . . C4 . . . G3 .',
    '. . . . B3 . . . . . G3 . . . D4 .',
    '. . . . C4 . . . . . E4 . . . A3 .',
    '. . . . G3 . . . . . . . . . . .',
  ],

  // ---- how loud each four-bar phrase is, and what is playing in it.
  // One row per scene of the film. drums/bass/lead/harm are on or off; gain shapes the swell.
  PHRASES: [
    { drums: 0.0, bass: 0.7, lead: 0.8, harm: 0, gain: 0.55 }, // 1  the name
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0, gain: 0.85 }, // 2  football
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.7, gain: 1.0 }, // 3  the goal
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.7, gain: 1.0 }, // 4  skills
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.8, gain: 1.0 }, // 5  skills again
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.8, gain: 1.0 }, // 6  power shots
    { drums: 1.0, bass: 1.0, lead: 0.9, harm: 0.6, gain: 0.95 }, // 7  tackles
    { drums: 0.4, bass: 0.8, lead: 0.6, harm: 0, gain: 0.7 }, // 8  the coin  (it drops away)
    { drums: 0.8, bass: 1.0, lead: 0.9, harm: 0.5, gain: 0.9 }, // 9  crates
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.7, gain: 1.0 }, // 10 characters
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.7, gain: 1.0 }, // 11 kit
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.8, gain: 1.0 }, // 12 celebrations
    { drums: 0.5, bass: 0.9, lead: 0.7, harm: 0, gain: 0.8 }, // 13 penalties  (tense)
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 0.8, gain: 1.0 }, // 14 the world
    { drums: 1.0, bass: 1.0, lead: 1.0, harm: 1.0, gain: 1.0 }, // 15 the end
  ],

  // ---------------------------------------------------------------- rendering
  // One voice: an oscillator through its own envelope. Hard attack, short decay — it should
  // sound struck rather than swelled, like the game looks drawn rather than lit.
  voice(ctx, to, { type, hz, at, len, peak, decay = 0.6, detune = 0 }) {
    if (!hz) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = hz;
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.3), at + len * decay);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g); g.connect(to);
    o.start(at); o.stop(at + len + 0.02);
  },

  kick(ctx, to, at, peak) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.11);
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    o.connect(g); g.connect(to);
    o.start(at); o.stop(at + 0.22);
  },

  // snare and hats are the same burst of noise with different filters and lengths
  noiseHit(ctx, to, at, peak, len, hp, tone) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * len));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = Math.floor(at * 9973) + 1;                 // the same noise every render
    for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(f); f.connect(g); g.connect(to);
    src.start(at); src.stop(at + len);
    if (tone) this.voice(ctx, to, { type: 'triangle', hz: tone, at, len: 0.09, peak: peak * 0.5, decay: 0.3 });
  },

  // ---- one four-bar phrase
  phrase(ctx, to, startAt, p, barFrom) {
    const B = this.bar, beat = this.beat, six = beat / 4;
    for (let bar = 0; bar < 4; bar++) {
      const barAt = startAt + bar * B;
      const idx = (barFrom + bar) % 8;
      const chord = this.CHORDS[(barFrom + bar) % 4];

      // drums
      if (p.drums > 0) {
        this.kick(ctx, to, barAt, 0.9 * p.drums);
        this.kick(ctx, to, barAt + beat * 2, 0.8 * p.drums);
        if (p.drums > 0.6) this.kick(ctx, to, barAt + beat * 2.75, 0.5 * p.drums);
        this.noiseHit(ctx, to, barAt + beat, 0.35 * p.drums, 0.16, 1200, 180);
        this.noiseHit(ctx, to, barAt + beat * 3, 0.35 * p.drums, 0.16, 1200, 180);
        for (let h = 0; h < 8; h++) {
          const open = h === 7 && p.drums > 0.8;
          this.noiseHit(ctx, to, barAt + h * (beat / 2), (open ? 0.16 : 0.09) * p.drums, open ? 0.22 : 0.045, 7000, 0);
        }
        // a fill into the next phrase
        if (bar === 3 && p.drums > 0.8) {
          for (let f = 0; f < 4; f++) this.noiseHit(ctx, to, barAt + beat * 3 + f * six, 0.3 * p.drums, 0.08, 900, 200 - f * 20);
        }
      }

      // bass: the root, driving along in eighths, with the fifth on the off-beats
      if (p.bass > 0) {
        for (let e = 0; e < 8; e++) {
          const note = e % 4 === 2 ? chord[2] : chord[0];
          this.voice(ctx, to, { type: 'sawtooth', hz: this.hz(note) / 2, at: barAt + e * (beat / 2), len: beat * 0.46, peak: 0.2 * p.bass, decay: 0.7 });
        }
      }

      // the tune, and the line underneath it
      const play = (row, type, vol, octave, detune) => {
        if (!vol) return;
        const cells = row.trim().split(/\s+/);
        for (let i = 0; i < cells.length && i < 16; i++) {
          const c = cells[i];
          if (c === '.' || c === '-') continue;
          const hz = this.hz(c) * octave;
          this.voice(ctx, to, { type, hz, at: barAt + i * six, len: six * 3.2, peak: vol, decay: 0.5, detune });
        }
      };
      play(this.LEAD[idx], 'square', 0.13 * p.lead, 1, 0);
      play(this.LEAD[idx], 'square', 0.07 * p.lead, 1, 9);      // a second one, slightly off, for width
      play(this.HARM[idx], 'triangle', 0.1 * p.harm, 1, 0);

      // a chord stab on the first beat of each bar
      if (p.lead > 0.5) for (const n of chord) {
        this.voice(ctx, to, { type: 'square', hz: this.hz(n), at: barAt, len: beat * 0.9, peak: 0.05 * p.lead, decay: 0.4 });
      }
    }
  },

  // ---------------------------------------------------------------- the whole track
  // Rendered offline: no clock to keep up with, and the same result every time.
  async render(seconds, sampleRate = 48000) {
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);

    // a gentle ceiling, so the loud phrases stay the right side of harsh
    const out = ctx.createDynamicsCompressor();
    out.threshold.value = -10; out.knee.value = 12; out.ratio.value = 4;
    out.attack.value = 0.004; out.release.value = 0.14;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    out.connect(master); master.connect(ctx.destination);

    const phraseLen = this.bar * 4;                 // eight seconds
    const n = Math.ceil(seconds / phraseLen);
    for (let i = 0; i < n; i++) {
      const p = this.PHRASES[Math.min(i, this.PHRASES.length - 1)];
      const bus = ctx.createGain();
      bus.gain.value = p.gain;
      bus.connect(out);
      this.phrase(ctx, bus, i * phraseLen, p, (i * 4) % 8);
    }

    // and let the last note ring rather than stop dead
    const tail = ctx.createGain();
    tail.connect(out);
    this.voice(ctx, tail, { type: 'square', hz: this.hz('C5'), at: seconds - 1.2, len: 1.2, peak: 0.12, decay: 0.8 });
    this.voice(ctx, tail, { type: 'sawtooth', hz: this.hz('C3') / 2, at: seconds - 1.2, len: 1.2, peak: 0.16, decay: 0.8 });

    return ctx.startRendering();
  },
};
