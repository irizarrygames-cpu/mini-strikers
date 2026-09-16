// Goal celebrations: the list you buy from, the pose for every moment of each one, and how
// the scorer moves during the celebration cutscene. Loads in the browser and on the server.
//
// Poses are in sprite units: feet at y=0, hips -18, shoulders ±10,-41, head centre 1.5,-56,
// and +x is the way the player faces. hands = [back hand, front hand], feet = [back, front].

const CELE_TIME = 2.6; // how long the celebration cutscene lasts

const CELEBRATIONS = [
  { id: 'jump', name: 'Jump', price: 0 },
  { id: 'flex', name: 'Flex', price: 500 },
  { id: 'salute', name: 'Salute', price: 700 },
  { id: 'spin', name: 'Spin', price: 900 },
  { id: 'shush', name: 'Shush', price: 1100 },
  { id: 'heart', name: 'Heart Hands', price: 1300 },
  { id: 'dab', name: 'Dab', price: 1500 },
  { id: 'kneeslide', name: 'Knee Slide', price: 1800 },
  { id: 'airplane', name: 'Airplane', price: 2100 },
  { id: 'pushups', name: 'Push-Ups', price: 2500 },
  { id: 'chestpump', name: 'Chest Pump', price: 2900 },
  { id: 'callme', name: 'Call Me', price: 3400 },
  { id: 'chill', name: 'Too Cool', price: 4000 },
  { id: 'bow', name: 'Take a Bow', price: 4600 },
  { id: 'archer', name: 'Archer', price: 5500 },
  { id: 'robot', name: 'Robot', price: 6500 },
  { id: 'griddy', name: 'Griddy', price: 8000 },
  { id: 'sleep', name: 'Nap Time', price: 9500 },
  { id: 'siuu', name: 'SIUUU', price: 12000 },
  { id: 'backflip', name: 'Backflip', price: 15000 },
];
const CELE_IDS = CELEBRATIONS.map((c) => c.id);
// cool customers keep their mouths shut
const CELE_CALM = new Set(['chill', 'salute', 'bow', 'sleep', 'archer', 'robot']);

const celeEase = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const celeUp = (wave = 0, lift = 0) => [[-19 + wave, -64 - lift], [19 + wave, -64 + lift]];
const REST = [[-13, -27], [13, -27]];

const CELE_POSES = {
  // teammates piling in: bouncing, arms up
  hype: (e, t, p) => ({ jump: Math.abs(Math.sin(e * 9 + (p.seed || 0))) * 9, hands: celeUp(Math.sin(e * 14 + (p.seed || 0)) * 3), run: true }),

  jump: (e) => ({ jump: Math.abs(Math.sin(e * 9)) * 12, hands: celeUp(Math.sin(e * 14) * 3), legSwing: Math.sin(e * 18) * 0.5 }),

  flex: (e) => {
    const s = Math.sin(e * 6) * 2;
    return { bob: Math.sin(e * 6) * 1.5, lean: -0.05, hands: [[-26, -58 + s], [26, -58 - s]], prop: 'flex' };
  },

  salute: (e) => {
    const k = celeEase(e / 0.25);
    return { lean: -0.06, hands: [REST[0], [lerp(13, 12, k), lerp(-27, -66, k)]] };
  },

  spin: (e) => ({ faceX: Math.cos(e * 13), jump: Math.abs(Math.sin(e * 9)) * 5, hands: celeUp() }),

  shush: (e) => {
    const k = celeEase(e / 0.25);
    return { lean: -0.04, hands: [REST[0], [lerp(13, 13, k), lerp(-27, -50, k)]], screen: e > 0.35 ? 'shh' : null };
  },

  heart: (e) => {
    const k = celeEase(e / 0.3), b = Math.sin(e * 5) * 1.5;
    return { bob: Math.sin(e * 4), hands: [[lerp(-13, -5, k), lerp(-27, -77 + b, k)], [lerp(13, 7, k), lerp(-27, -77 + b, k)]], screen: k > 0.9 ? 'heart' : null };
  },

  dab: (e) => {
    const k = celeEase(e / 0.22);
    return { upper: 0.32 * k, bob: Math.sin(e * 8), hands: [[lerp(-13, -27, k), lerp(-27, -62, k)], [lerp(13, -2, k), lerp(-27, -60, k)]] };
  },

  kneeslide: (e) => {
    if (e < 0.35) return { run: true, hands: celeUp() };
    return { kneel: true, jump: -9, upper: -0.25, hands: celeUp(0, Math.sin(e * 10) * 3) };
  },

  airplane: (e) => ({ run: true, lean: 0.12, rot: Math.sin(e * 4) * 0.22, hands: [[-30, -44], [30, -44]] }),

  pushups: (e) => {
    const k = celeEase(e / 0.3);
    const lift = (Math.sin(e * 6) + 1) * 5;
    // hands and toes stay planted on the grass as the body goes up and down
    const hx = 2 + (lift + 5.45) / 0.9927, fx = 2 + (lift + 1.23) / 0.9927;
    return { lie: 'front', lift: lift * k, hands: [[hx, -38], [hx + 1, -44]], feet: [[fx, -2], [fx, -5]] };
  },

  chestpump: (e) => {
    const hit = Math.max(0, Math.sin(e * 9));
    return { lean: -0.05, jump: hit * 3, hands: [[-19, -64 + Math.sin(e * 9) * 2], [lerp(18, 5, hit), lerp(-46, -37, hit)]] };
  },

  callme: (e) => {
    const k = celeEase(e / 0.25);
    return { lean: -0.04, bob: Math.sin(e * 3) * 0.6, hands: [REST[0], [lerp(13, 14, k), lerp(-27, -58, k)]], prop: k > 0.9 ? 'ring' : null };
  },

  chill: (e) => {
    const k = celeEase(e / 0.3);
    return { lean: -0.08 * k, bob: Math.sin(e * 2) * 0.6, hands: [[lerp(-13, 9, k), lerp(-27, -35, k)], [lerp(13, -4, k), lerp(-27, -35, k)]], prop: 'shades' };
  },

  bow: (e) => {
    const k = celeEase((e - 0.3) / 0.35) * (e < 2.1 ? 1 : celeEase((2.5 - e) / 0.4));
    return { upper: 0.6 * k, hands: [[lerp(-13, -22, k), lerp(-27, -40, k)], [lerp(13, 3, k), lerp(-27, -31, k)]] };
  },

  archer: (e) => {
    const draw = celeEase(e / 0.6), released = e > 1.3;
    return { lean: -0.04, hands: [[released ? -12 : lerp(16, 0, draw), released ? -50 : -52], [26, -52]], prop: 'bow' };
  },

  robot: (e) => {
    const f = Math.floor(e * 3) % 4;
    const H = [[[-18, -30], [20, -52]], [[-24, -48], [12, -30]], [[-12, -56], [24, -46]], [[-22, -40], [22, -40]]][f];
    return { hands: H, rot: f % 2 ? 0.06 : -0.06, jump: f === 3 ? 2 : 0 };
  },

  griddy: (e) => {
    const step = Math.sin(e * 10);
    const glasses = e % 1.3 > 0.95;
    return {
      lean: 0.16, bob: Math.abs(step) * 2,
      feet: [[step > 0 ? 6 : -6, step > 0 ? -7 : -3], [step < 0 ? 14 : 2, step < 0 ? -7 : -3]],
      hands: glasses ? [[5, -56], [15, -56]] : [[-10 + step * 8, -24], [10 - step * 8, -24]],
      prop: glasses ? 'glasses' : null,
    };
  },

  sleep: (e) => {
    const k = celeEase(e / 0.35);
    if (k < 1) return { lean: -0.2 * k, jump: -6 * k, hands: [[-6, -62], [8, -64]] };
    return { lie: 'back', hands: [[-4, -66], [6, -67]], feet: [[-3, -3], [5, -8]], screen: 'zzz' };
  },

  siuu: (e) => {
    if (e < 0.5) return { run: true };
    if (e < 1.1) {
      const u = (e - 0.5) / 0.6;
      return { jump: Math.sin(u * Math.PI) * 36, faceX: Math.cos(u * Math.PI), hands: celeUp(), feet: [[-2, -10], [6, -12]] };
    }
    const k = Math.min(1, (e - 1.1) / 0.15);
    return { jump: -4 * k, faceX: -1, lean: -0.05, feet: [[-13, -2], [13, -2]], hands: [[-26, -30], [26, -30]], screen: 'siuu' };
  },

  backflip: (e) => {
    if (e < 0.25) return { jump: -6, hands: [[-18, -24], [-8, -24]] };
    if (e < 1.05) {
      const u = (e - 0.25) / 0.8;
      return { jump: Math.sin(u * Math.PI) * 50 + 2, rot: -u * Math.PI * 2, hands: [[-2, -26], [10, -24]], feet: [[-1, -12], [8, -13]] };
    }
    return { jump: Math.abs(Math.sin((e - 1.05) * 8)) * 6, hands: celeUp() };
  },
};

// How the scorer moves during the cutscene (speed in world units a second along `dir`).
const CELE_MOVES = {
  kneeslide: (e) => (e < 0.35 ? 330 : e < 1.2 ? 330 * (1 - (e - 0.35) / 0.85) : 0),
  siuu: (e) => (e < 0.5 ? 300 : e < 1.1 ? 140 : 0),
  airplane: (e) => (e < 2.3 ? 250 : 0),
  griddy: () => 0,
};
// airplane banks round in a curve instead of a straight line
const CELE_TURN = { airplane: 1.7 };

// Bots celebrate too, mostly with the cheap ones, like real players.
const BOT_CELEBS = ['jump', 'jump', 'flex', 'salute', 'spin', 'shush', 'heart', 'dab', 'kneeslide', 'kneeslide', 'airplane', 'chestpump', 'callme', 'chill', 'robot', 'griddy', 'siuu'];
