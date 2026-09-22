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
  // the big-money shelf
  { id: 'calmdown', name: 'Calm Down', price: 16000 },
  { id: 'pointsky', name: 'Point Up', price: 17000 },
  { id: 'baby', name: 'Rock the Baby', price: 18000 },
  { id: 'floss', name: 'Floss', price: 19000 },
  { id: 'windmill', name: 'Windmill', price: 20000 },
  { id: 'zombie', name: 'Zombie', price: 21000 },
  { id: 'thinker', name: 'The Thinker', price: 22000 },
  { id: 'bird', name: 'Bird Flap', price: 23000 },
  { id: 'selfie', name: 'Selfie', price: 24000 },
  { id: 'guitar', name: 'Air Guitar', price: 25000 },
  { id: 'surfer', name: "Surf's Up", price: 26000 },
  { id: 'stomp', name: 'Beast Stomp', price: 28000 },
  { id: 'kungfu', name: 'Kung Fu', price: 30000 },
  { id: 'moonwalk', name: 'Moonwalk', price: 32000 },
  { id: 'worm', name: 'The Worm', price: 34000 },
  { id: 'swim', name: 'Belly Swim', price: 36000 },
  { id: 'bowling', name: 'Bowling', price: 38000 },
  { id: 'golf', name: 'Golf Swing', price: 40000 },
  { id: 'fishing', name: 'Gone Fishing', price: 42000 },
  { id: 'ballerina', name: 'Ballerina', price: 44000 },
  { id: 'cartwheel', name: 'Flip Out', price: 46000 },
  { id: 'matrix', name: 'Bullet Dodge', price: 50000 },
  { id: 'scissor', name: 'Bicycle Kick', price: 55000 },
  { id: 'trophy', name: 'Trophy Lift', price: 60000 },
  { id: 'money', name: 'Make It Rain', price: 75000 },
  { id: 'lightning', name: 'Lightning Bolt', price: 80000 },
  { id: 'superhero', name: 'Superhero Landing', price: 85000 },
  { id: 'samba', name: 'Samba Fever', price: 90000 },
  { id: 'disco', name: 'Disco Inferno', price: 95000 },
  { id: 'micdrop', name: 'Mic Drop', price: 100000 },
  { id: 'statue', name: 'Living Statue', price: 105000 },
  { id: 'drummer', name: 'Victory Drums', price: 110000 },
  { id: 'trumpet', name: 'Goal Trumpet', price: 115000 },
  { id: 'magician', name: 'Magic Trick', price: 120000 },
  { id: 'freeze', name: 'Freeze Frame', price: 125000 },
  { id: 'earthquake', name: 'Earthquake', price: 130000 },
  { id: 'rocket', name: 'Rocket Launch', price: 135000 },
  { id: 'tornado', name: 'Tornado Spin', price: 140000 },
  { id: 'royalwave', name: 'Royal Wave', price: 145000 },
  { id: 'meditate', name: 'Zen Master', price: 150000 },
  { id: 'victorylap', name: 'Victory Lap', price: 155000 },
  { id: 'snowangel', name: 'Grass Angel', price: 160000 },
  { id: 'handstand', name: 'Handstand', price: 170000 },
  { id: 'pogo', name: 'Pogo Bounce', price: 180000 },
  { id: 'boxing', name: 'Champion Boxer', price: 190000 },
  { id: 'chefkiss', name: "Chef's Kiss", price: 200000 },
  { id: 'paparazzi', name: 'Paparazzi', price: 215000 },
  { id: 'conductor', name: 'The Conductor', price: 230000 },
  { id: 'phoenix', name: 'Phoenix Rise', price: 250000 },
  { id: 'galaxy', name: 'Galaxy Dance', price: 275000 },
  { id: 'meteor', name: 'Meteor Crash', price: 300000 },
  { id: 'portal', name: 'Portal Step', price: 325000 },
  { id: 'headspin', name: 'Headspin', price: 350000 },
  { id: 'dragonroar', name: 'Dragon Roar', price: 375000 },
  { id: 'rewind', name: 'Time Rewind', price: 400000 },
  { id: 'spotlight', name: 'Center Stage', price: 425000 },
  { id: 'hattrick', name: 'Hat Trick', price: 450000 },
  { id: 'shadowdash', name: 'Shadow Dash', price: 475000 },
  { id: 'gravityflip', name: 'Gravity Flip', price: 500000 },
  { id: 'finalwhistle', name: 'Final Whistle', price: 550000 },
];
const CELE_IDS = CELEBRATIONS.map((c) => c.id);
const CELE_PREMIUM = new Set(CELEBRATIONS.slice(CELEBRATIONS.findIndex((c) => c.id === 'lightning')).map((c) => c.id));
// cool customers keep their mouths shut
const CELE_CALM = new Set(['chill', 'salute', 'bow', 'sleep', 'archer', 'robot', 'calmdown', 'thinker', 'golf', 'fishing', 'ballerina']);

const celeEase = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const celeUp = (wave = 0, lift = 0) => [[-19 + wave, -64 - lift], [19 + wave, -64 + lift]];
const REST = [[-13, -27], [13, -27]];

// swings shared by a pose and the prop it holds. Angles: 0 = hanging straight down, + = forward.
const celeBowlAngle = (e) => (e < 0.75 ? lerp(0.6, -1.4, celeEase((e - 0.45) / 0.3)) : lerp(-1.4, 1.1, celeEase((e - 0.75) / 0.25)));
const celeGolf = (e) => (e < 0.3 ? 0 : e < 0.95 ? -2.3 * celeEase((e - 0.3) / 0.65) : e < 1.1 ? lerp(-2.3, 2.3, (e - 0.95) / 0.15) : 2.3 + Math.sin((e - 1.1) * 3) * 0.05);
// fishing rod, from +x (negative is up): wind back, cast, wait, yank
const celeRod = (e) => (e < 0.25 ? -0.7 : e < 0.55 ? lerp(-0.7, -2.3, celeEase((e - 0.25) / 0.3)) : e < 0.75 ? lerp(-2.3, -0.4, celeEase((e - 0.55) / 0.2))
  : e < 1.6 ? -0.45 + Math.sin(e * 6) * 0.04 : e < 1.8 ? lerp(-0.45, -1.6, celeEase((e - 1.6) / 0.2)) : -1.5 + Math.sin(e * 8) * 0.06);

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

  calmdown: (e) => {
    const k = celeEase(e / 0.3), pump = Math.abs(Math.sin(e * 5)) * 9 * k;
    return { lean: 0.06 * k, bob: -pump * 0.12, hands: [[lerp(-13, 6, k), lerp(-27, -42 + pump, k)], [lerp(13, 26, k), lerp(-27, -44 + pump, k)]] };
  },

  pointsky: (e) => {
    const k = celeEase(e / 0.35), b = Math.sin(e * 5) * 1.2;
    return { lean: -0.12 * k, jump: Math.abs(Math.sin(e * 3.2)) * 3 * k, hands: [[lerp(-13, -18, k), lerp(-27, -64 + b, k)], [lerp(13, 22, k), lerp(-27, -65 - b, k)]], prop: k > 0.95 ? 'point' : null };
  },

  baby: (e) => {
    const k = celeEase(e / 0.3), s = Math.sin(e * 6) * k;
    return { bob: Math.abs(s) * 0.8, rot: s * 0.1, lean: -0.05 * k, hands: [[lerp(-13, 16 + s * 4, k), lerp(-27, -38 - s * 3, k)], [lerp(13, 24 + s * 4, k), lerp(-27, -33 + s * 3, k)]] };
  },

  floss: (e) => {
    const s = Math.sin(e * 11), c = Math.cos(e * 11);
    return { rot: -s * 0.07, bob: Math.abs(c) * 1.2, hands: [[-4 + s * 16, -24 + Math.abs(s) * 2], [6 + s * 16, -24 + Math.abs(s) * 2]], feet: [[-5 - s * 2, -3], [5 - s * 2, -3]] };
  },

  windmill: (e) => {
    const a = e * 11;
    return { jump: Math.abs(Math.sin(e * 5.5)) * 4, lean: -0.05, hands: [[-10 - Math.cos(a) * 22, -41 - Math.sin(a) * 22], [10 + Math.cos(a) * 22, -41 + Math.sin(a) * 22]] };
  },

  zombie: (e) => {
    const k = celeEase(e / 0.4), wob = Math.sin(e * 4);
    return { run: true, rot: wob * 0.07, lean: 0.04, bob: Math.abs(wob) * 1.5, hands: [[lerp(-13, 16, k), lerp(-27, -44 + wob * 2, k)], [lerp(13, 30, k), lerp(-27, -46 - wob * 2, k)]] };
  },

  thinker: (e) => {
    const k = celeEase(e / 0.35);
    if (k < 1) return { jump: -9 * k, upper: 0.2 * k, hands: [[lerp(-13, -2, k), lerp(-27, -30, k)], [lerp(13, 11, k), lerp(-27, -46, k)]] };
    return { kneel: true, jump: -9, upper: 0.2, hands: [[-2, -30], [11, -46]], screen: e > 0.7 ? 'think' : null };
  },

  bird: (e) => {
    const f = Math.sin(e * 15);
    return { run: true, lean: 0.1, jump: Math.max(0, f) * 3, hands: [[-30, -46 - f * 12], [30, -46 - f * 12]] };
  },

  selfie: (e) => {
    const k = celeEase(e / 0.3), peace = celeEase((e - 0.8) / 0.2);
    return { lean: -0.06 * k, bob: Math.sin(e * 5) * (1 - peace), hands: [[lerp(-13, -24, peace), lerp(-27, -60, peace)], [lerp(13, 26, k), lerp(-27, -64, k)]], prop: 'phone', screen: e > 1.0 && e < 1.3 ? 'flash' : null };
  },

  guitar: (e) => {
    const k = celeEase(e / 0.3), strum = Math.sin(e * 22) * 3;
    return { lean: -0.14 * k, bob: Math.abs(Math.sin(e * 6)) * 2, feet: [[-9, -3], [9, -3]], hands: [[lerp(-13, 18, k), lerp(-27, -48, k)], [lerp(13, 5, k), lerp(-27, -27 + strum, k)]], prop: k > 0.6 ? 'guitar' : null, screen: e > 0.5 ? 'notes' : null };
  },

  surfer: (e) => {
    const k = celeEase(e / 0.3), w = Math.sin(e * 3.5);
    return { jump: (5 + w * 1.5) * k, rot: w * 0.1 * k, upper: 0.12 * k, feet: [[-11, -3], [11, -3]], hands: [[-26, -42 + w * 6], [24, -46 - w * 6]], prop: k > 0.2 ? 'surfboard' : null };
  },

  stomp: (e) => {
    const c = (e * 1.6) % 1, up = Math.sin(Math.min(1, c / 0.7) * Math.PI);
    return { jump: c < 0.7 ? up * 18 : 0, bob: c >= 0.7 ? -3 * (1 - (c - 0.7) / 0.3) : 0, lean: 0.08, feet: c < 0.7 ? [[-6, -8], [10, -12]] : [[-9, -2], [9, -2]], hands: [[-22, -30 - up * 10], [22, -30 - up * 10]], screen: c >= 0.7 ? 'stomp' : null };
  },

  kungfu: (e) => {
    const c = (e * 1.3) % 1;
    if (c < 0.3) { const u = c / 0.3; return { jump: -5 * u, lean: -0.1 * u, feet: [[-8, -2], [6, -3 - u * 4]], hands: [[-18, -44], [16, -46]] }; }
    if (c < 0.7) return { lean: -0.28, jump: 2, feet: [[-4, -2], [18, -32]], hands: [[-24, -52], [26, -48]], screen: 'hiya' };
    return { lean: -0.05, feet: [[-8, -2], [8, -3]], hands: [[-18, -44], [16, -46]] };
  },

  // faces the way it came from while gliding the other way
  moonwalk: (e, t, p) => {
    const s = Math.sin(e * 9);
    return { faceX: -(Math.sign(p.celeFaceX || p.faceX) || 1), lean: -0.04, bob: Math.abs(s) * 0.8, feet: [[-3 + s * 7, s > 0 ? -1 : -6], [5 - s * 7, s > 0 ? -6 : -1]], hands: [[-12 - s * 2, -28], e > 1.2 ? [6, -66] : [14 + s * 2, -28]] };
  },

  worm: (e) => {
    const k = celeEase(e / 0.3), wave = Math.sin(e * 9), lift = (wave + 1) * 3.5;
    // hands stay planted as the body rolls through them, like push-ups
    const hx = 2 + (lift + 5.45) / 0.9927, fx = 2 + (lift + 1.23) / 0.9927, kick = Math.max(0, -wave) * 6;
    return { lie: 'front', lift: lift * k, rot: wave * 0.12 * k, hands: [[hx, -38], [hx + 1, -44]], feet: [[fx - wave * 3, -2 - kick], [fx - wave * 3, -5 - kick]] };
  },

  swim: (e) => {
    const a = e * 8, kick = Math.sin(e * 18);
    return { lie: 'front', lift: 3 + Math.sin(e * 4) * 1.5, rot: Math.sin(e * 8) * 0.05, hands: [[-2 - Math.cos(a) * 12, -58 + Math.sin(a) * 16], [-2 + Math.cos(a) * 12, -58 - Math.sin(a) * 16]], feet: [[-1 + kick * 3, -3], [6 - kick * 3, -6]], screen: e > 0.2 ? 'splash' : null };
  },

  bowling: (e) => {
    if (e < 0.45) return { run: true, lean: 0.1, hands: [[-12, -30], [14 + e * 10, -36]], prop: 'bowlball' };
    const th = celeBowlAngle(e), low = celeEase((e - 0.45) / 0.3);
    return { upper: 0.35 * low, jump: -5 * low, feet: [[-15, -2], [11, -2]], hands: [[-26, -44], [10 + Math.sin(th) * 25, -41 + Math.cos(th) * 25]], prop: 'bowlball', screen: e > 0.98 ? 'bowl' : null };
  },

  golf: (e) => {
    const th = celeGolf(e), hx = 2 + Math.sin(th) * 20, hy = -41 + Math.cos(th) * 20;
    return { upper: e < 1.1 ? 0.25 : 0.05, feet: [[-9, -2], [9, -2]], rot: e > 1.1 ? -0.05 : 0, hands: [[hx - 1, hy - 1], [hx + 1, hy + 1]], prop: 'golf', screen: 'golfball' };
  },

  fishing: (e) => {
    const cheer = e > 1.85 ? Math.abs(Math.sin(e * 8)) : 0;
    return { lean: e > 1.6 ? -0.1 : 0.02, jump: cheer * 4, hands: [[6, -38], [12, -42]], prop: 'rod' };
  },

  ballerina: (e) => {
    const k = celeEase(e / 0.3), spin = e > 0.3 ? (e - 0.3) * 11 : 0;
    return { faceX: Math.cos(spin), jump: 3 * k + Math.abs(Math.sin(spin)) * 1.5, feet: [[lerp(-4.5, 3, k), lerp(-3, -16, k)], [2, -3]], hands: [[lerp(-13, -16, k), lerp(-27, -65, k)], [lerp(13, 19, k), lerp(-27, -65, k)]] };
  },

  cartwheel: (e) => {
    if (e < 0.2) return { jump: -3, hands: celeUp() };
    if (e < 1.6) {
      const u = ((e - 0.2) / 0.7) % 1;
      return { rot: u * Math.PI * 2, jump: Math.sin(u * Math.PI) * 26, hands: [[-20, -62], [22, -62]], feet: [[-12, -4], [14, -6]] };
    }
    return { jump: Math.abs(Math.sin((e - 1.6) * 9)) * 7, hands: celeUp(Math.sin(e * 14) * 3) };
  },

  matrix: (e) => {
    const k = celeEase((e - 0.2) / 0.6) * (e < 2.1 ? 1 : celeEase((2.5 - e) / 0.4)), w = Math.sin(e * 5);
    return { upper: -1.05 * k, lean: -0.1 * k, jump: -4 * k, feet: [[-10, -2], [9, -2]], hands: [[-24 + w * 4, -40 + w * 6], [22 - w * 4, -42 - w * 6]], screen: k > 0.5 ? 'bullets' : null };
  },

  scissor: (e) => {
    if (e < 0.25) return { jump: -6 * (e / 0.25), hands: [[-16, -26], [14, -26]] };
    if (e < 1.15) {
      const u = (e - 0.25) / 0.9, s = Math.sin(u * Math.PI * 3);
      return { jump: Math.sin(u * Math.PI) * 42 + 2, rot: -Math.sin(u * Math.PI) * 1.9, hands: [[-24, -40], [22, -36]], feet: [[-2 - s * 8, -10 - s * 6], [6 + s * 8, -14 + s * 6]] };
    }
    const land = e - 1.15;
    return { jump: Math.abs(Math.sin(land * 7)) * 8 * Math.max(0, 1 - land), hands: celeUp(Math.sin(e * 14) * 3), legSwing: Math.sin(e * 18) * 0.4 };
  },

  trophy: (e) => {
    const k = celeEase(e / 0.35), b = Math.abs(Math.sin(e * 7));
    return { jump: b * 7 * k, hands: [[lerp(-13, -5, k), lerp(-27, -64 - b * 2 * k, k)], [lerp(13, 8, k), lerp(-27, -64 - b * 2 * k, k)]], prop: 'trophy', screen: k > 0.8 ? 'confetti' : null };
  },

  money: (e) => {
    const flick = Math.max(0, Math.sin(e * 12));
    return { lean: -0.06, bob: Math.sin(e * 6) * 0.8, hands: [[4, -40], [18 + flick * 4, -50 - flick * 6]], prop: 'cash', screen: 'money' };
  },

  // Premium celebrations have an opening beat, a signature move, and a readable finish.
  lightning: (e) => {
    const charge = celeEase(e / 0.42), strike = Math.max(0, 1 - Math.abs(e - 0.83) / 0.18);
    return { jump: charge * 5 + strike * 17 + Math.abs(Math.sin(e * 12)) * 3, rot: Math.sin(e * 11) * 0.055,
      hands: [[-28, -40 - charge * 28], [27, -38 - strike * 35]], feet: [[-9, -3], [11, -8]], screen: 'lightning' };
  },
  superhero: (e) => {
    const u = Math.min(1, e / 0.75), land = celeEase((e - 0.75) / 0.13);
    return e < 0.75
      ? { jump: Math.sin(u * Math.PI) * 48, rot: -0.33, hands: [[-27, -60], [25, -57]], feet: [[-7, -10], [11, -14]], screen: 'superhero' }
      : { kneel: true, jump: -9 + (1 - land) * 8, upper: 0.42, hands: [[-20, -22], [17, -49]], screen: 'superhero' };
  },
  samba: (e) => {
    const s = Math.sin(e * 13), turn = Math.sin(e * 3.3);
    return { bob: Math.abs(s) * 3, jump: Math.max(0, s) * 3, rot: s * 0.12, faceX: Math.cos(e * 4.2),
      hands: [[-23 + s * 8, -51 - turn * 7], [24 + s * 8, -36 + turn * 8]], feet: [[-8 - s * 6, -3], [9 + s * 6, -7]], screen: 'samba' };
  },
  disco: (e) => {
    const beat = Math.sin(e * 9), turn = Math.cos(e * 5);
    return { jump: Math.max(0, beat) * 6, faceX: turn, rot: beat * 0.08,
      hands: beat > 0 ? [[-19, -28], [22, -72]] : [[-24, -68], [19, -29]], feet: [[-8, -3], [10, -3]], screen: 'disco' };
  },
  micdrop: (e) => {
    const drop = celeEase((e - 0.92) / 0.22);
    return { lean: -0.08 + drop * 0.13, hands: [[-14, -28], [18 + drop * 12, -53 + drop * 37]],
      bob: -drop * 2, prop: 'mic', screen: 'micdrop' };
  },
  statue: (e) => {
    const lock = celeEase((e - 0.38) / 0.16);
    return { lean: -0.12 * lock, upper: 0.08 * lock,
      hands: [[lerp(-13, -24, lock), lerp(-27, -60, lock)], [lerp(13, 26, lock), lerp(-27, -34, lock)]],
      feet: [[-11, -3], [11, -3]], screen: 'statue' };
  },
  drummer: (e) => {
    const a = Math.sin(e * 18), b = Math.sin(e * 18 + Math.PI);
    return { bob: Math.abs(a) * 2, hands: [[-12 + a * 4, -51 + Math.max(0, a) * 20], [15 + b * 4, -51 + Math.max(0, b) * 20]],
      prop: 'drums', screen: 'drummer' };
  },
  trumpet: (e) => ({ lean: -0.08, bob: Math.sin(e * 5) * 1.2,
    hands: [[7, -48], [23, -48]], feet: [[-9, -3], [9, -3]], prop: 'trumpet', screen: 'trumpet' }),
  magician: (e) => {
    const reveal = celeEase((e - 0.75) / 0.28);
    return { jump: Math.sin(e * 6) * 2, rot: reveal * Math.sin((e - 0.75) * 7) * 0.08,
      hands: [[-13 - reveal * 14, -27 - reveal * 34], [13 + reveal * 13, -27 - reveal * 38]],
      prop: 'wand', screen: 'magician' };
  },
  freeze: (e) => {
    const snap = celeEase(e / 0.28);
    return { rot: -0.22 * snap, lean: 0.18 * snap, hands: [[-28, -52], [25, -29]],
      feet: [[-13, -3], [14, -10]], jump: Math.sin(Math.min(1, e / 0.28) * Math.PI) * 8, screen: 'freeze' };
  },
  earthquake: (e) => {
    const slam = e > 0.55 ? 1 : celeEase(e / 0.55);
    return { kneel: true, jump: -8 - Math.max(0, Math.sin(e * 10)) * 3, upper: 0.35 * slam,
      hands: [[-20, -19], [18, -20]], rot: Math.sin(e * 28) * 0.025, screen: 'earthquake' };
  },
  rocket: (e) => {
    const lift = e < 0.45 ? 0 : Math.sin(Math.min(1, (e - 0.45) / 1.6) * Math.PI) * 47;
    return { jump: lift, hands: celeUp(), feet: [[-5, -12], [7, -12]], lean: -0.08, screen: 'rocket' };
  },
  tornado: (e) => {
    const k = celeEase(e / 0.26);
    return { faceX: Math.cos(e * 22), jump: k * (8 + Math.abs(Math.sin(e * 11)) * 8),
      rot: Math.sin(e * 11) * 0.15, hands: [[-25, -45], [25, -45]], screen: 'tornado' };
  },
  royalwave: (e) => ({ lean: -0.06, hands: [[-14, -28], [20 + Math.sin(e * 7) * 4, -66]],
    bob: Math.sin(e * 3) * 0.7, prop: 'crown', screen: 'royalwave' }),
  meditate: (e) => {
    const k = celeEase(e / 0.4);
    return { kneel: true, jump: -6 + Math.sin(e * 3) * 2 * k, hands: [[-8, -29], [9, -29]],
      upper: 0.05, screen: 'meditate' };
  },
  victorylap: (e) => ({ run: true, jump: Math.abs(Math.sin(e * 11)) * 4,
    hands: e % 0.8 < 0.4 ? celeUp() : [[-23, -48], [24, -48]], lean: 0.12, prop: 'flag', screen: 'victorylap' }),
  snowangel: (e) => {
    const s = Math.sin(e * 7);
    return { lie: 'back', hands: [[-8 - s * 22, -48 - Math.abs(s) * 12], [9 + s * 22, -48 - Math.abs(s) * 12]],
      feet: [[-3 - s * 8, -3], [5 + s * 8, -5]], screen: 'snowangel' };
  },
  handstand: (e) => {
    const up = celeEase(e / 0.28);
    return { rot: Math.PI * up, jump: 43 * up + Math.sin(e * 4) * 2 * up,
      hands: [[-7, -67], [8, -67]], feet: [[-11, -4], [12, -8]], screen: 'handstand' };
  },
  pogo: (e) => ({ jump: Math.abs(Math.sin(e * 8)) * 30, hands: [[-15, -39], [16, -39]],
    feet: [[-5, -8], [6, -8]], prop: 'pogo', screen: 'pogo' }),
  boxing: (e) => {
    const punch = Math.sin(e * 13), lead = punch > 0;
    return { bob: Math.sin(e * 16) * 2, lean: 0.08, hands: lead ? [[-5, -50], [29, -48]] : [[-28, -48], [7, -50]],
      feet: [[-11, -3], [11, -3]], prop: 'gloves', screen: 'boxing' };
  },
  chefkiss: (e) => {
    const k = celeEase(e / 0.35), send = celeEase((e - 1) / 0.4);
    return { hands: [[-14, -28], [lerp(14, 12 + send * 18, k), lerp(-28, -56 - send * 8, k)]],
      lean: -0.04, screen: 'chefkiss' };
  },
  paparazzi: (e) => ({ faceX: Math.cos(e * 5), hands: [[5, -54], [17, -54]],
    jump: Math.max(0, Math.sin(e * 9)) * 3, prop: 'camera', screen: 'paparazzi' }),
  conductor: (e) => ({ lean: -0.08, hands: [[-22, -42 + Math.sin(e * 6) * 16], [25, -48 + Math.cos(e * 6) * 17]],
    feet: [[-9, -3], [9, -3]], prop: 'baton', screen: 'conductor' }),
  phoenix: (e) => {
    const rise = Math.sin(Math.min(1, e / 1.75) * Math.PI);
    return { jump: rise * 48, rot: Math.sin(e * 5) * 0.12,
      hands: [[-32, -52 - rise * 8], [32, -52 - rise * 8]], feet: [[-8, -10], [10, -10]], screen: 'phoenix' };
  },
  galaxy: (e) => ({ faceX: Math.cos(e * 10), jump: 7 + Math.sin(e * 6) * 7,
    rot: Math.sin(e * 4) * 0.22, hands: [[-28, -58 + Math.sin(e * 8) * 8], [28, -58 - Math.sin(e * 8) * 8]],
    feet: [[-8, -7], [9, -10]], screen: 'galaxy' }),

  meteor: (e) => {
    const leap = e < 0.75 ? Math.sin(e / 0.75 * Math.PI) * 43 : 0;
    const slam = celeEase((e - 0.72) / 0.16);
    return { jump: leap - slam * 7, kneel: e >= 0.75, upper: slam * 0.35,
      hands: e < 0.75 ? [[-22, -55], [22, -64]] : [[-21, -19], [18, -22]],
      feet: [[-11, -3], [12, -4]], screen: 'meteor' };
  },
  portal: (e) => {
    const dash = celeEase((e - 0.45) / 0.18), pose = celeEase((e - 1.1) / 0.2);
    return { lean: 0.2 * (1 - pose), faceX: e > 1.1 ? -1 : 1,
      jump: Math.sin(Math.min(1, dash) * Math.PI) * 8,
      hands: [[-22, -51 + pose * 15], [25, -46 - pose * 20]],
      feet: [[-13 + dash * 7, -4], [13 + dash * 5, -6]], screen: 'portal' };
  },
  headspin: (e) => {
    const down = celeEase(e / 0.33), spin = Math.max(0, e - 0.33) * 13;
    return { rot: down * Math.PI + spin, jump: down * 38,
      hands: [[-18, -54], [17, -54]], feet: [[-14, -6], [14, -7]], screen: 'headspin' };
  },
  dragonroar: (e) => {
    const roar = celeEase((e - 0.3) / 0.22);
    return { lean: -0.14 * roar, jump: Math.sin(e * 6) * 2 * roar,
      hands: [[-30, -48 - roar * 9], [30, -48 - roar * 9]],
      feet: [[-12, -3], [12, -3]], screen: 'dragonroar' };
  },
  rewind: (e) => {
    const tick = Math.floor(e * 6) % 2 ? 1 : -1;
    return { faceX: e < 1.35 ? -1 : 1, lean: e < 1.35 ? -0.15 : 0.08,
      bob: Math.abs(Math.sin(e * 10)) * 2,
      hands: [[-17 + tick * 4, -33], [17 - tick * 4, -49]],
      feet: [[-9 + tick * 6, -3], [9 - tick * 6, -7]], screen: 'rewind' };
  },
  spotlight: (e) => {
    const bow = celeEase((e - 0.7) / 0.32) * (e < 1.8 ? 1 : 1 - celeEase((e - 1.8) / 0.3));
    return { upper: 0.65 * bow, lean: -0.08,
      hands: [[-23, -42 + bow * 17], [24, -40 + bow * 13]],
      feet: [[-9, -3], [9, -3]], screen: 'spotlight' };
  },
  hattrick: (e) => {
    const toss = Math.sin(e * 8);
    return { jump: Math.max(0, toss) * 4, lean: Math.sin(e * 4) * 0.07,
      hands: [[-20, -42 - toss * 8], [22, -45 + toss * 8]],
      feet: [[-8, -3], [9, -5]], screen: 'hattrick' };
  },
  shadowdash: (e) => {
    const dash = e > 0.4 && e < 1.2;
    return { run: dash, lean: dash ? 0.32 : -0.04, bob: dash ? Math.abs(Math.sin(e * 15)) * 3 : 0,
      hands: dash ? [[-22, -30], [18, -55]] : celeUp(),
      feet: dash ? [[-14, -3], [16, -7]] : [[-9, -3], [9, -3]], screen: 'shadowdash' };
  },
  gravityflip: (e) => {
    const u = celeEase((e - 0.25) / 0.8), settle = celeEase((e - 1.6) / 0.45);
    return { rot: Math.PI * 2 * u, jump: Math.sin(u * Math.PI) * 36 + (1 - settle) * 8,
      hands: [[-24, -53], [24, -53]], feet: [[-11, -8], [11, -8]], screen: 'gravityflip' };
  },
  finalwhistle: (e) => {
    const blow = celeEase(e / 0.28), cheer = celeEase((e - 1.15) / 0.2);
    return { jump: cheer * Math.abs(Math.sin(e * 8)) * 7,
      hands: [[-14 - cheer * 8, -28 - cheer * 36], [lerp(13, 14, blow), lerp(-27, -56, blow)]],
      feet: [[-9, -3], [9, -3]], prop: 'whistle', screen: 'finalwhistle' };
  },
};

// The ult shot: how the strike looks, 0..1 through it. Same shape as a celebration pose.
const ULT_POSES = {
  // leaning back and lashing through the ball with the laces
  volley: (u) => {
    const swing = u < 0.3 ? -0.8 + u / 0.3 * 0.4 : Math.min(1, (u - 0.3) / 0.2);
    return { jump: 8 + Math.max(0, Math.sin(u * Math.PI)) * 10, lean: -0.45 + swing * 0.25, upper: -0.2,
      feet: [[-8 - swing * 4, -6 - swing * 2], [lerp(-4, 30, (swing + 0.8) / 1.8), lerp(-2, -40, (swing + 0.8) / 1.8)]],
      hands: [[-26, -52 - swing * 6], [22 + swing * 6, -58]] };
  },
  // upside down, both legs cycling over the top
  bicycle: (u) => {
    const s = Math.sin(u * Math.PI * 2.2);
    return { jump: Math.sin(Math.min(1, u * 1.15) * Math.PI) * 46 + 4, rot: -Math.sin(Math.min(1, u * 1.2) * Math.PI) * 2.3,
      feet: [[-4 - s * 10, -12 - s * 8], [8 + s * 12, -18 + s * 8]],
      hands: [[-26, -38], [24, -34]] };
  },
  // a full backflip, striking it on the way round
  backflip: (u) => ({ jump: Math.sin(Math.min(1, u * 1.1) * Math.PI) * 52 + 4, rot: -u * Math.PI * 2,
    feet: [[-2, -14], [10, -20]], hands: [[-6, -28], [12, -26]] }),
  // both feet off the deck, legs scissoring through it
  scissors: (u) => {
    const s = Math.sin(u * Math.PI * 3);
    return { jump: Math.sin(Math.min(1, u * 1.2) * Math.PI) * 34 + 3, rot: -0.55, lean: -0.2,
      feet: [[-6 - s * 12, -10 - s * 6], [6 + s * 14, -16 + s * 6]],
      hands: [[-28, -46], [26, -44]] };
  },
};

// How the scorer moves during the cutscene (speed in world units a second along `dir`).
const CELE_MOVES = {
  kneeslide: (e) => (e < 0.35 ? 330 : e < 1.2 ? 330 * (1 - (e - 0.35) / 0.85) : 0),
  siuu: (e) => (e < 0.5 ? 300 : e < 1.1 ? 140 : 0),
  airplane: (e) => (e < 2.3 ? 250 : 0),
  griddy: () => 0,
  zombie: (e) => (e < 2.3 ? 55 : 0),
  bird: (e) => (e < 2.3 ? 240 : 0),
  surfer: (e) => (e > 0.3 && e < 2.3 ? 170 : 0),
  moonwalk: (e) => (e > 0.1 && e < 2.3 ? 95 : 0),
  worm: (e) => (e > 0.3 && e < 2.3 ? 75 : 0),
  swim: (e) => (e > 0.2 && e < 2.3 ? 120 : 0),
  bowling: (e) => (e < 0.45 ? 220 : 0),
  cartwheel: (e) => (e > 0.2 && e < 1.6 ? 200 : 0),
  portal: (e) => (e > 0.4 && e < 0.95 ? 160 : 0),
  rewind: (e) => (e < 1.3 ? 110 : 0),
  shadowdash: (e) => (e > 0.4 && e < 1.2 ? 360 : 0),
};
// airplane banks round in a curve instead of a straight line
const CELE_TURN = { airplane: 1.7, bird: 1.4, surfer: 0.6 };

// Bots celebrate too, mostly with the cheap ones, like real players.
const BOT_CELEBS = ['jump', 'jump', 'flex', 'salute', 'spin', 'shush', 'heart', 'dab', 'kneeslide', 'kneeslide', 'airplane', 'chestpump', 'callme', 'chill', 'robot', 'griddy', 'siuu', 'calmdown', 'pointsky', 'floss', 'bird', 'kungfu'];
