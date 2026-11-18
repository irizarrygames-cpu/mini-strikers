// SEASON PASSES (build 122). Free, one for every two-week ranked season, 5,000 of them (until 2218).
//
// Each pass has three things nobody can get any other way: an emote, an accessory and a
// celebration. They are never in the shop, in crates or in the daily emote shop, and when the two
// weeks are over they never come back. A pass also pays 20,000 coins. You fill a pass by playing:
// every match's XP goes into it, and its four rewards open at 3,000, 6,000, 9,000 and 12,000 XP
// (about 10, 20, 30 and 40 matches).
//
// 15,000 things cannot be drawn by hand, so each one is put together from parts, the way the
// emotes already are, worked out from the pass number alone (so every player and the server get
// the same ones). No two passes share an emote, an accessory or a celebration: each is a
// combination of parts no other pass (and no emote in the shop) has.
//
// Loads in the browser and on the server (nothing here touches the page while loading).

const PASS_STEPS = [3000, 6000, 9000, 12000];
const PASS_REWARDS = ['emote', 'accessory', 'celebration', 'coins'];
const PASS_COINS = 20000;

// names: words every language file already has
const PASS_WORDS = ['Inferno', 'Galaxy', 'Comet', 'Neon', 'Cyber', 'Volt', 'Prism', 'Nebula', 'Lava', 'Ruby', 'Sapphire', 'Emerald',
  'Diamond', 'Obsidian', 'Infinity', 'Royal', 'Tornado', 'Mirage', 'Hologram', 'Supernova', 'Aurora', 'Spectre', 'Jetstream', 'Tsunami',
  'Firework', 'Circuit', 'Starlight', 'Sandstorm', 'Lagoon', 'Toxic', 'Shadow', 'Golden', 'Electric', 'Rainbow', 'Celestial', 'Dragonfire',
  'Phantom', 'Venom', 'Thunder', 'Blizzard', 'Snowfall', 'Evergreen', 'Thunderstorm', 'Melody', 'Avalanche', 'Frostbite', 'Matador', 'Magma',
  'Nightfall', 'Sunrise', 'Riptide', 'Blackout', 'Starfall', 'Northern Lights', 'Polar Night', 'Harvest Moon', 'Galaxy Swirl', 'Encore',
  'Bass Drop', 'Four Seasons', 'Black Hole', 'Blood Moon', 'Solar Flare', 'Pearl', 'Arctic', 'Carbon', 'Glacier', 'Gold', 'Sunset',
  'Whirlpool', 'Afterburn', 'Confetti', 'Cherry Blossom'];

// colour sets: [main, second, light, dark]
const PASS_PALETTES = [
  ['#ff3a3f', '#ffc21a', '#ffe9a8', '#8c1020'], ['#2f7bff', '#46d9ff', '#dff6ff', '#0d2f7a'], ['#a35cff', '#ff5fa8', '#f3d2ff', '#3b1470'],
  ['#3fcf4a', '#ffe14d', '#e8ffc2', '#14532a'], ['#16171d', '#ffc21a', '#5b6475', '#000000'], ['#ffffff', '#46d9ff', '#e8f6ff', '#7fb3e8'],
  ['#ff8a1f', '#ff3a6e', '#ffe0c2', '#8a3a12'], ['#39ff88', '#ff4df0', '#dfffef', '#0d1b2a'], ['#c2143c', '#ffd166', '#ffb3c1', '#5a0a1a'],
  ['#0d1430', '#5fffc4', '#2a3f8a', '#05081a'], ['#ffc21a', '#ffffff', '#fff3a0', '#a86f00'], ['#e4e7f5', '#8d93b8', '#ffffff', '#3b4060'],
  ['#ff5fa8', '#ffffff', '#ffd9ec', '#a8285e'], ['#1f8f5a', '#ffffff', '#a8f0c8', '#0a3d26'], ['#46d9ff', '#ffe14d', '#d4f6ff', '#0d6b8f'],
  ['#8b4dff', '#39ff88', '#d8c8ff', '#2a0f4a'], ['#ff5a1a', '#16171d', '#ffb08a', '#5a1a0a'], ['#2a2d45', '#ff3a3f', '#5b6488', '#0e0f1a'],
  ['#ffe14d', '#2f7bff', '#fff7c2', '#a88a00'], ['#7fe0ff', '#ff9ac4', '#e8fbff', '#2a7fa8'], ['#a8561a', '#ffb03a', '#f2d27a', '#4a2008'],
  ['#ffffff', '#e8283a', '#ffe0e4', '#a80d1e'], ['#3b4252', '#bfe9ff', '#8d93b8', '#16171d'], ['#ff3a6e', '#46d9ff', '#ffd6e4', '#7a1030'],
  ['#00c2a8', '#ff8a1f', '#c2fff5', '#005a4e'], ['#6a2ad8', '#ffc21a', '#c8a8ff', '#2a0f5a'], ['#b04dff', '#ffffff', '#ead2ff', '#4a1a7a'],
  ['#ff9a1f', '#ffe14d', '#ffe0b0', '#8a4a00'], ['#1e6fd8', '#ffffff', '#bfe0ff', '#0a3a7a'], ['#e8283a', '#16171d', '#ff9aa4', '#5a0a12'],
  ['#ffd6e4', '#b04dff', '#ffffff', '#a8789a'], ['#39ff88', '#16171d', '#c2ffd8', '#0a5a2a'], ['#ffc21a', '#e8283a', '#fff0b0', '#8a5a00'],
  ['#4fe0b0', '#2f7bff', '#d8fff2', '#14705a'], ['#ff7a1a', '#ffffff', '#ffd2b0', '#8a3a00'], ['#5fffc4', '#b04dff', '#e0fff4', '#2a8a6a'],
  ['#d8a95a', '#8c1020', '#f6e3bd', '#6a4a1a'], ['#c9d2de', '#46d9ff', '#ffffff', '#5b6475'], ['#ff4df0', '#ffe14d', '#ffd2fa', '#7a1070'],
  ['#2b2f4a', '#ffffff', '#5b6488', '#0e1020'],
];

// ---- emotes: the cool end of the emote parts (EMOTE_SPECS in js/emotes.js)
const PASS_EM_WHO = ['footy', 'kid', 'keeper', 'ref', 'coach', 'fan', 'goat', 'golden'];
const PASS_EM_FACES = ['cool', 'star', 'laser', 'ninja', 'determined', 'proud', 'smug', 'grin', 'laugh', 'lol', 'wink', 'tongue', 'shout',
  'crazy', 'money', 'happy', 'sneaky', 'calm', 'sing', 'love', 'shock', 'cheeky', 'kiss'];
// the props worth showing off (no tissues, traffic cones or popcorn in a season pass)
const PASS_EM_PROPS = ['thumb', 'wave', 'fist', 'peace', 'point', 'fistbump', 'clap', 'juggle', 'header', 'scarf', 'drum', 'horn', 'medal',
  'gloves', 'megaphone', 'flag', 'boot', 'sun', 'nutmeg', 'flagup', 'handup', 'hattrick', 'topcorner', 'rainbowball', 'chip', 'catch',
  'crown', 'headphones', 'badge', 'goldboot', 'trophy', 'bicycle', 'rocket', 'cape', 'wizard', 'moon', 'chain', 'goldgloves', 'planet',
  'wings', 'firebreath', 'clock'];
const PASS_EM_FX = ['sparkle', 'stars', 'rings', 'notes', 'fire', 'bigfire', 'bolt', 'bigbolt', 'flash', 'confetti', 'frost', 'disco',
  'aura', 'explode', 'spotlight', 'fireworks', 'cosmos', 'speed', 'coins', 'hearts', 'wind', 'snow'];
const PASS_EM_MOVES = ['bounce', 'jump', 'shake', 'pulse', 'float', 'spin', 'slam', 'roll', 'flip', 'dash', 'sway', 'nod', 'wobble'];

// ---- accessories: a kind, one of its shapes, a colour set, a pattern and something extra
// [id, name, slot, shapes, takes a pattern, takes an extra]
const PASS_ACC_KINDS = [
  ['crown', tl('Crown'), 'head', 5, false, true], ['horns', tl('Horns'), 'head', 4, false, true], ['halo', tl('Halo'), 'head', 3, false, true],
  ['beanie', tl('Beanie'), 'head', 4, true, false], ['tophat', tl('Top Hat'), 'head', 3, true, false], ['headband', tl('Headband'), 'head', 4, true, false],
  ['helmet', tl('Helmet'), 'head', 4, false, true], ['shades', tl('Shades'), 'face', 5, false, false], ['mask', tl('Mask'), 'face', 4, false, false],
  ['paint', tl('War Paint'), 'face', 4, false, false], ['chain', tl('Chain'), 'neck', 5, false, true], ['scarf', tl('Scarf'), 'neck', 3, true, false],
  ['medal', tl('Medal'), 'neck', 4, false, true], ['cape', tl('Cape'), 'back', 4, true, false], ['wings', tl('Wings'), 'back', 4, true, false],
];
const PASS_PATTERNS = ['plain', 'stripes', 'dots', 'stars', 'zigzag', 'checks'];
const PASS_EXTRAS = ['none', 'gem', 'sparkle', 'flame'];

// ---- celebrations: a start, a main move and a finish, then a burst in the pass's colours.
// Each part is a pose over its own stretch of the 2.6 seconds (u goes 0..1 through it; e is the
// time since the goal). Poses are in sprite units like CELE_POSES: hands = [back hand, front hand].
const PASS_UP = (w = 0, l = 0) => [[-19 + w, -64 - l], [19 + w, -64 + l]];
const PASS_STARTS = {
  sprint: { move: () => 300, f: (u, e) => { const s = Math.sin(e * 16); return { run: true, lean: 0.12, hands: [[-16 + s * 6, -34], [14 - s * 6, -36]] }; } },
  slide: { move: (u) => (u < 0.3 ? 320 : 320 * (1 - (u - 0.3) / 0.7)), f: (u, e) => (u < 0.3 ? { run: true, hands: PASS_UP() } : { kneel: true, jump: -9, upper: -0.25, hands: PASS_UP(0, Math.sin(e * 10) * 3) }) },
  leap: { move: () => 140, f: (u) => ({ jump: Math.sin(u * Math.PI) * 28, tuck: u > 0.3 && u < 0.7 ? 1 : 0, hands: PASS_UP(), legSwing: 0.4 }) },
  spin: { move: () => 0, f: (u) => ({ faceX: Math.cos(u * Math.PI * 4), jump: Math.abs(Math.sin(u * Math.PI * 2)) * 6, hands: [[-24, -50], [24, -50]] }) },
  fistpump: { move: () => 0, f: (u) => { const a = Math.abs(Math.sin(u * Math.PI * 3)); return { lean: -0.05, jump: a * 4, hands: [[-13, -27], [16, -30 - a * 36]] }; } },
  airplane: { move: () => 250, f: (u, e) => ({ run: true, lean: 0.12, rot: Math.sin(e * 4) * 0.22, hands: [[-30, -44], [30, -44]] }) },
  skip: { move: () => 160, f: (u) => ({ jump: Math.abs(Math.sin(u * Math.PI * 3)) * 10, legSwing: 0.4, hands: [[-18, -40], [18, -46]] }) },
  pointcrowd: { move: () => 80, f: (u, e) => ({ lean: -0.06, bob: Math.sin(e * 6), hands: [[-13, -27], [30, -50]] }) },
  crouch: { move: () => 0, f: (u) => (u < 0.6 ? { jump: -7 * celeEase(u / 0.3), upper: 0.4 * celeEase(u / 0.3), hands: [[-16, -22], [10, -20]] } : { jump: Math.sin(((u - 0.6) / 0.4) * Math.PI) * 22, hands: PASS_UP() }) },
  cartwheel: { move: () => 150, f: (u) => ({ rot: -u * Math.PI * 2, jump: Math.sin(u * Math.PI) * 18, hands: [[-26, -42], [26, -42]], legSwing: 0.6 }) },
  shimmy: { move: () => 40, f: (u, e) => { const s = Math.sin(e * 20) * 4; return { lean: -0.1, bob: Math.abs(Math.sin(e * 10)) * 1.5, hands: [[-16 + s, -40], [16 - s, -40]] }; } },
  superman: { move: () => 300, f: () => ({ run: true, lean: 0.3, hands: [[18, -50], [26, -52]] }) },
};
const PASS_MAINS = {
  dab: (u, e) => { const k = celeEase(Math.min(1, u * 4)); return { upper: 0.32 * k, bob: Math.sin(e * 8), hands: [[lerp(-13, -27, k), lerp(-27, -62, k)], [lerp(13, -2, k), lerp(-27, -60, k)]] }; },
  flex: (u, e) => { const s = Math.sin(e * 6) * 2; return { bob: Math.sin(e * 6) * 1.5, lean: -0.05, hands: [[-26, -58 + s], [26, -58 - s]] }; },
  robot: (u, e) => { const f = Math.floor(e * 3) % 4; return { hands: [[[-18, -30], [20, -52]], [[-24, -48], [12, -30]], [[-12, -56], [24, -46]], [[-22, -40], [22, -40]]][f], rot: f % 2 ? 0.06 : -0.06 }; },
  floss: (u, e) => { const s = Math.sin(e * 12); return { bob: Math.abs(s) * 1.2, rot: -s * 0.08, hands: [[-10 + s * 14, -24], [12 + s * 14, -24]] }; },
  shuffle: (u, e) => { const s = Math.sin(e * 14), a = Math.abs(s); return { bob: a * 2, feet: [[-6 + s * 5, s > 0 ? -5 : -1], [6 - s * 5, s < 0 ? -5 : -1]], hands: [[-18, -36 - a * 4], [18, -36 - a * 4]] }; },
  heart: (u, e) => { const b = Math.sin(e * 5) * 1.5; return { bob: Math.sin(e * 4), hands: [[-5, -77 + b], [7, -77 + b]] }; },
  salute: (u, e) => ({ lean: -0.06, bob: Math.sin(e * 3) * 0.6, hands: [[-13, -27], [12, -66]] }),
  windmill: (u, e) => { const a = e * 9; return { lean: -0.04, hands: [[-13, -27], [3 + Math.cos(a) * 24, -41 + Math.sin(a) * 24]] }; },
  drums: (u, e) => { const s = Math.sin(e * 20); return { upper: 0.1, hands: [[2, -36 - Math.max(0, s) * 12], [16, -36 - Math.max(0, -s) * 12]] }; },
  guitar: (u, e) => { const s = Math.sin(e * 22); return { lean: -0.12, bob: Math.abs(Math.sin(e * 6)) * 2, hands: [[2 + s * 3, -30], [24, -44]] }; },
  boxing: (u, e) => { const s = Math.sin(e * 14); return { bob: Math.abs(Math.sin(e * 7)) * 1.5, hands: [[s > 0 ? 26 : 6, -44], [s < 0 ? 28 : 8, -46]] }; },
  twirl: (u) => ({ faceX: Math.cos(u * Math.PI * 4), jump: 2, hands: PASS_UP(Math.sin(u * 20) * 3) }),
  jacks: (u, e) => { const open = (1 - Math.cos(e * 10)) / 2, th = open * Math.PI * 0.9; const arm = (sd) => [sd * (10 + 24 * Math.sin(th)), -41 + 24 * Math.cos(th)]; return { jump: Math.abs(Math.sin(e * 10)) * 6, hands: [arm(-1), arm(1)], feet: [[-4 - 9 * open, -1], [4 + 9 * open, -1]] }; },
  wave: (u, e) => { const s = Math.sin(e * 6) * 10; return { rot: Math.sin(e * 6) * 0.05, hands: [[-14 + s, -66], [18 + s, -66]] }; },
  chest: (u, e) => { const hit = Math.max(0, Math.sin(e * 9)); return { lean: -0.05, jump: hit * 3, hands: [[-19, -64 + Math.sin(e * 9) * 2], [lerp(18, 5, hit), lerp(-46, -37, hit)]] }; },
  calm: (u, e) => { const pump = Math.abs(Math.sin(e * 5)) * 9; return { lean: 0.06, bob: -pump * 0.12, hands: [[6, -42 + pump], [26, -44 + pump]] }; },
  levitate: (u, e) => ({ jump: 6 + celeEase(u) * 10 + Math.sin(e * 4) * 2, hands: [[-2, -44], [10, -44]], legSwing: 0.2 }),
  lasso: (u, e) => { const a = e * 10; return { lean: -0.05, hands: [[-13, -27], [8 + Math.cos(a) * 10, -70 + Math.sin(a) * 4]] }; },
  moonwalk: (u, e) => { const s = Math.sin(e * 8); return { lean: -0.06, feet: [[-8 + s * 6, s > 0 ? -1 : -4], [8 - s * 6, s < 0 ? -1 : -4]], hands: [[-16, -30], [16, -34]] }; },
  bounce: (u, e) => { const b = Math.abs(Math.sin(e * 8)); return { bob: b * 3, hands: [[14, -40 - b * 4], [26, -42 - b * 4]] }; },
  hero: (u, e) => ({ lean: -0.1, bob: Math.sin(e * 3) * 0.6, hands: [[-12, -22], [14, -22]], feet: [[-9, -1], [10, -1]] }),
  kick: (u, e) => { const k = Math.abs(Math.sin(e * 5)); return { lean: -0.1 * k, hands: [[-24, -48], [10, -44]], feet: [[-4, -1], [lerp(6, 24, k), lerp(-2, -28, k)]] }; },
};
const PASS_FINISHES = {
  armsup: (u, e) => ({ jump: Math.abs(Math.sin(e * 8)) * 5, hands: PASS_UP(Math.sin(e * 13) * 3) }),
  pointsky: (u) => { const k = celeEase(Math.min(1, u * 2)); return { lean: -0.12 * k, hands: [[-18, -60], [22, -70]] }; },
  bow: (u) => { const k = celeEase(Math.min(1, u / 0.5)) * (u < 0.85 ? 1 : celeEase((1 - u) / 0.15)); return { upper: 0.6 * k, hands: [[lerp(-13, -22, k), lerp(-27, -40, k)], [lerp(13, 3, k), lerp(-27, -31, k)]] }; },
  thumbs: (u, e) => ({ lean: -0.04, bob: Math.sin(e * 6), hands: [[10, -40], [24, -40]] }),
  kneelfist: (u, e) => ({ kneel: true, jump: -9, upper: -0.15, hands: [[-16, -34], [14, -66 - Math.abs(Math.sin(e * 6)) * 3]] }),
  salute: () => ({ lean: -0.06, hands: [[-13, -27], [12, -66]] }),
  flex: (u, e) => { const s = Math.sin(e * 6) * 2; return { lean: -0.05, hands: [[-26, -58 + s], [26, -58 - s]] }; },
  bigjump: (u) => ({ jump: Math.sin(u * Math.PI) * 26, tuck: u > 0.3 && u < 0.7 ? 1 : 0, hands: PASS_UP() }),
  crossarms: (u, e) => ({ lean: -0.08, bob: Math.sin(e * 2) * 0.6, hands: [[9, -35], [-4, -35]], prop: 'shades' }),
  kiss: (u) => { const k = u < 0.4 ? 0 : celeEase((u - 0.4) / 0.3); return { hands: [[-13, -27], [lerp(12, 30, k), lerp(-54, -58, k)]] }; },
  shush: () => ({ lean: -0.04, hands: [[-13, -27], [13, -50]] }),
  shrug: (u, e) => { const b = Math.abs(Math.sin(e * 5)); return { bob: -b, hands: [[-24, -34 - b * 3], [24, -34 - b * 3]] }; },
};
const PASS_CELE_FX = ['fireworks', 'confetti', 'stars', 'rings', 'bolts', 'glitter'];
const PASS_CELE_PARTS = [0, 0.75, 1.9]; // where the start, the main move and the finish begin

function passHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const PassGen = {
  _lists: {},
  list(kind) {
    if (!this._lists[kind]) this._lists[kind] = kind === 'emote' ? this.buildEmotes() : kind === 'accessory' ? this.buildAccs() : this.buildCelebs();
    return this._lists[kind];
  },
  emote(n) { return n >= 1 && n <= PASS_COUNT ? this.list('emote')[n - 1] : null; },
  acc(n) { return n >= 1 && n <= PASS_COUNT ? this.list('accessory')[n - 1] : null; },
  celeb(n) { return n >= 1 && n <= PASS_COUNT ? this.list('celebration')[n - 1] : null; },
  word(i) { return tl(PASS_WORDS[((i % PASS_WORDS.length) + PASS_WORDS.length) % PASS_WORDS.length]); },
  pal(n, salt) { return PASS_PALETTES[(passHash(salt + n) >>> 3) % PASS_PALETTES.length]; },

  // Pick the parts for pass 1, then 2, and so on, each from its own random draw: a combination any
  // earlier pass (or a shop emote) already has is drawn again, and so is one too like the pass just
  // before it. The same every time, everywhere.
  pickAll(salt, draw, keyOf, near) {
    const used = new Set(), out = [];
    let prev = null;
    for (let n = 1; n <= PASS_COUNT; n++) {
      const rng = mulberry32(passHash(salt + n));
      let pick = null;
      for (let tries = 0; tries < 400; tries++) {
        const c = draw(rng, n);
        if (!c || used.has(keyOf(c))) continue;
        if (prev && tries < 300 && near(c, prev)) continue;
        pick = c; break;
      }
      if (!pick) throw new Error('season pass ' + salt + ' ran out of combinations at ' + n);
      used.add(keyOf(pick)); out.push(pick); prev = pick;
    }
    return out;
  },

  buildEmotes() {
    const props = PASS_EM_PROPS.filter((p) => EM_PROPS[p]);
    const fx = PASS_EM_FX.filter((f) => EM_FX[f]);
    const shop = new Set(EMOTES.map((e) => [e.who, e.face, e.prop, e.fx, e.move].join('|')));
    const keyOf = (c) => [c.who, c.face, c.prop, c.fx, c.move].join('|');
    const one = (rng, list) => list[Math.floor(rng() * list.length)];
    const picks = this.pickAll('emote-', (rng) => {
      const c = { who: one(rng, PASS_EM_WHO), face: one(rng, PASS_EM_FACES), prop: one(rng, props), fx: one(rng, fx), move: one(rng, PASS_EM_MOVES) };
      return shop.has(keyOf(c)) ? null : c; // (a shop emote's parts are never used)
    }, keyOf, (c, p) => c.who === p.who || c.fx === p.fx || c.prop === p.prop);
    return picks.map((c, i) => {
      const n = i + 1;
      return { id: passId('emote', n), name: this.word(n * 7 + 3) + ' #' + n, rarity: 'season', season: n, who: c.who, face: c.face, prop: c.prop, fx: c.fx, move: c.move, mood: 'cool', pal: this.pal(n, 'em-') };
    });
  },

  buildAccs() {
    const keyOf = (c) => { const K = PASS_ACC_KINDS[c.kind]; return [c.kind, c.shape, c.pal, K[4] ? c.pattern : '-', K[5] ? c.extra : '-'].join('|'); };
    const picks = this.pickAll('acc-', (rng) => {
      const kind = Math.floor(rng() * PASS_ACC_KINDS.length), K = PASS_ACC_KINDS[kind];
      return { kind, shape: Math.floor(rng() * K[3]), pal: Math.floor(rng() * PASS_PALETTES.length), pattern: Math.floor(rng() * PASS_PATTERNS.length), extra: Math.floor(rng() * PASS_EXTRAS.length) };
    }, keyOf, (c, p) => c.kind === p.kind);
    return picks.map((c, i) => {
      const n = i + 1, K = PASS_ACC_KINDS[c.kind];
      return { id: passId('accessory', n), name: K[1] + ' #' + n, slot: K[2], kind: K[0], shape: c.shape, pal: PASS_PALETTES[c.pal],
        pattern: K[4] ? PASS_PATTERNS[c.pattern] : 'plain', extra: K[5] ? PASS_EXTRAS[c.extra] : 'none', season: n, rarity: 'season' };
    });
  },

  buildCelebs() {
    const S = Object.keys(PASS_STARTS), M = Object.keys(PASS_MAINS), F = Object.keys(PASS_FINISHES);
    const one = (rng, list) => list[Math.floor(rng() * list.length)];
    const picks = this.pickAll('celeb-', (rng) => ({ start: one(rng, S), main: one(rng, M), finish: one(rng, F), fx: one(rng, PASS_CELE_FX) }),
      (c) => [c.start, c.main, c.finish, c.fx].join('|'), (c, p) => c.main === p.main || c.start === p.start);
    return picks.map((c, i) => {
      const n = i + 1;
      let w = n * 11 + 29;
      if (((w % PASS_WORDS.length) + PASS_WORDS.length) % PASS_WORDS.length === ((n * 7 + 3) % PASS_WORDS.length)) w++;
      return { id: passId('celebration', n), name: this.word(w) + ' #' + n, season: n, start: c.start, main: c.main, finish: c.finish, fx: c.fx, pal: this.pal(n, 'ce-'), rarity: 'season' };
    });
  },
};

// ---- the celebrations as poses: the three parts, each running on from where the last one left off
function passBlend(a, b, k) {
  const out = { ...b };
  for (const key of ['jump', 'bob', 'lean', 'upper', 'rot', 'legSwing', 'tuck']) {
    let va = a[key] || 0;
    if (key === 'rot') va = Math.atan2(Math.sin(va), Math.cos(va)); // a full turn ends where it began
    out[key] = lerp(va, b[key] || 0, k);
  }
  if (a.faceX !== undefined || b.faceX !== undefined) out.faceX = lerp(a.faceX === undefined ? 1 : a.faceX, b.faceX === undefined ? 1 : b.faceX, k);
  for (const key of ['hands', 'feet']) {
    const from = a[key] || (key === 'hands' ? [[-13, -27], [13, -27]] : null), to = b[key] || (key === 'hands' ? [[-13, -27], [13, -27]] : null);
    if (from && to) out[key] = [0, 1].map((i) => [lerp(from[i][0], to[i][0], k), lerp(from[i][1], to[i][1], k)]);
  }
  return out;
}
function passCelePose(C) {
  const parts = [[PASS_CELE_PARTS[0], PASS_CELE_PARTS[1], PASS_STARTS[C.start].f], [PASS_CELE_PARTS[1], PASS_CELE_PARTS[2], PASS_MAINS[C.main]], [PASS_CELE_PARTS[2], CELE_TIME, PASS_FINISHES[C.finish]]];
  const at = (i, e, p) => { const [a, b, f] = parts[i]; return f(clamp((e - a) / (b - a), 0, 1), e, p) || {}; };
  return (e, t, p) => {
    const i = e < PASS_CELE_PARTS[1] ? 0 : e < PASS_CELE_PARTS[2] ? 1 : 2;
    let pose = at(i, e, p);
    const since = e - parts[i][0];
    if (i > 0 && since < 0.16) pose = passBlend(at(i - 1, parts[i][0] - 1e-6, p), pose, celeEase(since / 0.16));
    if (!pose.screen) pose = { ...pose, screen: C.id }; // the burst in the pass's colours (Sprites.passCelebFX)
    return pose;
  };
}
function passCeleMove(C) {
  return (e) => (e < PASS_CELE_PARTS[1] ? PASS_STARTS[C.start].move(e / PASS_CELE_PARTS[1]) : C.main === 'moonwalk' && e < PASS_CELE_PARTS[2] ? 60 : 0);
}
// CELE_POSES['pc12'] and CELE_MOVES['pc12'] work like any other celebration's: asked for, made, kept
function passLookup(obj, make) {
  const base = Object.getPrototypeOf(obj);
  Object.setPrototypeOf(obj, new Proxy(base, {
    get(target, key, receiver) {
      const n = typeof key === 'string' ? passNumOf(key, 'celebration') : 0;
      if (n) { const v = make(PassGen.celeb(n)); Object.defineProperty(obj, key, { value: v, writable: true, configurable: true }); return v; }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) { return (typeof key === 'string' && passNumOf(key, 'celebration') > 0) || Reflect.has(target, key); },
  }));
}
passLookup(CELE_POSES, passCelePose);
passLookup(CELE_MOVES, passCeleMove);

// an accessory by id: one of the shop's, or a season pass's own
function accessoryDef(id) {
  const n = passNumOf(id, 'accessory');
  return n ? PassGen.acc(n) : ACCESSORIES.find((a) => a.id === id) || null;
}
const accIsFace = (id) => ACCESSORY_FACE_IDS.has(id) || (passNumOf(id, 'accessory') > 0 && PassGen.acc(passNumOf(id, 'accessory')).slot === 'face');

// ---- your pass: progress lives in the save (so it follows you to another phone)
const Pass = {
  now() { return passNow(); },
  items(n) { return { emote: PassGen.emote(n), accessory: PassGen.acc(n), celebration: PassGen.celeb(n) }; },
  endsAt(n) { return passEndsAt(n); },
  state() {
    const d = Save.data, n = passNow();
    let s = d.pass;
    if (!s || typeof s !== 'object' || Array.isArray(s) || s.n !== n || !Array.isArray(s.got)) {
      // a pass that ended with rewards opened but not claimed: they are still yours
      if (s && typeof s === 'object' && Number.isInteger(s.n) && s.n >= 1 && s.n < n && Array.isArray(s.got)) {
        const xp = Math.max(0, Math.floor(Number(s.xp) || 0));
        PASS_STEPS.forEach((need, i) => { if (xp >= need && !s.got[i]) this.give(PASS_REWARDS[i], s.n); });
      }
      s = d.pass = { n, xp: 0, got: [false, false, false, false], seen: s && s.n === n ? s.seen || 0 : 0 };
      Save.write();
    }
    s.xp = Math.max(0, Math.min(PASS_STEPS[PASS_STEPS.length - 1], Math.floor(Number(s.xp) || 0)));
    return s;
  },
  // how many rewards are open and not yet claimed
  ready() {
    if (!passNow()) return 0;
    const s = this.state();
    return PASS_STEPS.filter((need, i) => s.xp >= need && !s.got[i]).length;
  },
  step() { const s = this.state(); return PASS_STEPS.filter((need) => s.xp >= need).length; },
  // a finished match's XP: returns the rewards it opened (their indexes)
  addXp(xp) {
    if (!passNow() || !(xp > 0) || (typeof Game !== 'undefined' && Game.headless)) return [];
    const s = this.state(), before = s.xp;
    s.xp = Math.min(PASS_STEPS[PASS_STEPS.length - 1], before + Math.floor(xp));
    Save.write();
    return PASS_STEPS.map((need, i) => (before < need && s.xp >= need ? i : -1)).filter((i) => i >= 0);
  },
  // take one reward: true when it was given
  claim(i) {
    const n = passNow();
    if (!n || !(i >= 0 && i < PASS_STEPS.length)) return false;
    const s = this.state();
    if (s.xp < PASS_STEPS[i] || s.got[i]) return false;
    this.give(PASS_REWARDS[i], n);
    s.got[i] = true;
    Save.write();
    return true;
  },
  // one reward of pass n into the save
  give(kind, n) {
    const d = Save.data;
    if (kind === 'coins') { d.coins = (d.coins || 0) + PASS_COINS; return; }
    const id = passId(kind, n);
    if (!d.owned || typeof d.owned !== 'object') d.owned = {};
    d.owned[kind] = Array.isArray(d.owned[kind]) ? d.owned[kind] : [];
    if (!d.owned[kind].includes(id)) d.owned[kind].push(id);
    if (kind === 'emote' && typeof Emotes !== 'undefined') Emotes.got(id);
  },
  // the season items you own, newest first
  owned(kind) {
    const list = (Save.data.owned || {})[kind] || [];
    return list.filter((id) => passNumOf(id, kind)).sort((a, b) => passNumOf(b, kind) - passNumOf(a, kind));
  },
};

if (typeof module !== 'undefined') module.exports = { PassGen, Pass, PASS_STEPS, PASS_COINS };
