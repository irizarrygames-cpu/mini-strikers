// ===== Name & identity ==============================================
// Temporary title. Change GAME_NAME to rename every visible title.
// STORAGE_KEY stays fixed so saved progress survives a rename.
const GAME_NAME = 'Mini Strikers';
const GAME_SLOGANS = ['SMALL PLAYERS', 'BIG MOMENTS!', 'PLAY TOGETHER!', 'GOAL!'];
const STORAGE_KEY = 'arcade-soccer.v1';

const CFG = {
  // Field (world units). Blue defends the left goal, attacks right.
  // Doubled on request (was 1200x700 with 190-wide goals). Speeds below went up ~25%
  // so crossing the bigger pitch still feels arcade-fast.
  FIELD_W: 2400,
  FIELD_H: 1400,
  SIDE_M: 40,        // side boards sit this far outside the touchlines
  END_M: 34,         // end boards sit this far behind the goal lines
  CHAMFER: 72,       // cut corners so the ball never dies in a corner
  GOAL_W: 380,
  GOAL_D: 84,
  GOAL_H: 112,
  BOX_D: 380, BOX_W: 860,
  SMALL_D: 140, SMALL_W: 540,
  CIRCLE_R: 190,
  TILT: 0.8,         // vertical squash: the "very slight tilt"

  PLAYER_R: 15,
  KEEPER_R: 17,
  BALL_R: 9,

  SPEED: 315,
  SPEED_WITH_BALL: 288,
  KEEPER_SPEED: 310,
  ACCEL: 12,
  HUMAN_ACCEL: 22,
  HUMAN_DECEL: 28,
  STEP: 1 / 120,

  BALL_FRICTION: 0.78,
  BALL_AIR_DRAG: 0.2,
  GRAVITY: 1200,
  BALL_BOUNCE: 0.42,
  WALL_BOUNCE: 0.62,
  CONTROL_MAX: 830,  // faster than this and outfield players deflect it

  PASS_MIN: 440,
  PASS_MAX: 810,
  SHOT_WEAK: 900,
  SHOT_STRONG: 1320,
  SHOT_POWER: 1650,
  // shot charge (halved from 0.3 / 0.8 / 1.4 / 1.6 so it fills twice as quickly)
  CHARGE_MED: 0.15,
  CHARGE_STRONG: 0.4,
  CHARGE_FULL: 0.7,
  CHARGE_AUTO: 0.8,
  CHARGE_POW: 0.55,       // hold this long for the hardest non-power shot
  // hold PASS to charge a harder through ball; a tap is the ordinary pass
  PASS_CHARGE_FULL: 0.5,
  PASS_CHARGE_TAP: 0.1,   // anything shorter than this is still a tap

  POWER_MAX: 100,
  // ULT: only your goals, skills, assists and won tackles fill it
  // (10 goals, 100 skills, 20 assists or ~34 tackles = full). Then one unstoppable acrobatic shot.
  ULT_MAX: 100,
  ULT_GOAL: 10,
  ULT_SKILL: 1,
  ULT_ASSIST: 5,
  ULT_TACKLE: 3,
  ULT_SHOT_SPEED: 1750,
  OVERTIME_SECONDS: 90,
};
const GOAL_Y1 = (CFG.FIELD_H - CFG.GOAL_W) / 2;
const GOAL_Y2 = GOAL_Y1 + CFG.GOAL_W;
const OUTLINE = '#161a33';

const TEAMS = {
  blue: { name: 'BLUE', dir: 1, jersey: '#2f7bff', shade: '#1b56d8', accent: '#ffffff', shorts: '#1a2350', socks: '#ffffff', shoes: '#1b1d33', fx: '#46d9ff', board: '#2464e8', lip: '#6aa2ff' },
  red:  { name: 'RED', dir: -1, jersey: '#ff3a3f', shade: '#c81f2b', accent: '#1b1d33', shorts: '#1b1d33', socks: '#ff3a3f', shoes: '#1b1d33', fx: '#ff5a3c', board: '#e3303a', lip: '#ff8a8e' },
};
const KEEPER_KITS = {
  blue: { jersey: '#a35cff', shade: '#7a3ad8', accent: '#ffffff', shorts: '#2a1f4d', socks: '#a35cff', shoes: '#1b1d33', gloves: '#ffffff' },
  red:  { jersey: '#ffc21a', shade: '#e09a00', accent: '#1b1d33', shorts: '#1b1d33', socks: '#ffc21a', shoes: '#1b1d33', gloves: '#ffffff' },
};

const SKINS = ['#f6cfa6', '#e9b489', '#c98b5e', '#a8693f', '#f2c49b', '#7a4a2a'];
const HAIR_COLORS = ['#2b1d14', '#4a2e1c', '#6b3f22', '#1b1b2a', '#f2c230', '#b8521f'];

// Characters have real ratings (45–95). 70 is what the bots play at.
// spd: run speed · sht: shot power + beating keepers · pas: pass speed · ctl: close dribbling,
// shrugging off tackles, shorter skill cooldown · def: tackle reach, success and cooldown.
const RARITIES = {
  starter:   { name: 'STARTER',   color: '#8a90b8' },
  common:    { name: 'COMMON',    color: '#3fcf4a' },
  rare:      { name: 'RARE',      color: '#2f7bff' },
  epic:      { name: 'EPIC',      color: '#a35cff' },
  legendary: { name: 'LEGENDARY', color: '#ffb400' },
  mythic:    { name: 'MYTHIC',    color: '#ff3a6e' },
};
const CHARACTERS = [
  { id: 'street',     name: 'Street',      rarity: 'starter',   r: { spd: 62, sht: 58, pas: 60, ctl: 60, def: 56 }, hair: 'cap',      hairColor: '#4a2e1c', skin: '#f2c49b', cap: '#2f7bff' },
  { id: 'striker',    name: 'Striker',     rarity: 'starter',   r: { spd: 58, sht: 64, pas: 56, ctl: 58, def: 54 }, hair: 'messy',    hairColor: '#2b1d14', skin: '#f6cfa6' },
  { id: 'buzz',       name: 'Buzz',        rarity: 'common',    r: { spd: 64, sht: 60, pas: 60, ctl: 62, def: 72 }, hair: 'buzz',     hairColor: '#2b1d14', skin: '#7a4a2a' },
  { id: 'curly',      name: 'Curly',       rarity: 'common',    r: { spd: 64, sht: 62, pas: 72, ctl: 68, def: 60 }, hair: 'curly',    hairColor: '#6b3f22', skin: '#c98b5e' },
  { id: 'speedster',  name: 'Speedster',   rarity: 'common',    r: { spd: 78, sht: 60, pas: 58, ctl: 66, def: 56 }, hair: 'spikes',   hairColor: '#f2c230', skin: '#e9b489' },
  { id: 'captain',    name: 'Captain',     rarity: 'rare',      r: { spd: 70, sht: 72, pas: 76, ctl: 72, def: 74 }, hair: 'headband', hairColor: '#1b1b2a', skin: '#a8693f', band: '#ffffff' },
  { id: 'bandit',     name: 'Bandit',      rarity: 'rare',      r: { spd: 78, sht: 70, pas: 66, ctl: 78, def: 64 }, hair: 'bandana',  hairColor: '#2b1d14', skin: '#e9b489', band: '#ff3a3f' },
  { id: 'beanie',     name: 'Beanie',      rarity: 'rare',      r: { spd: 72, sht: 78, pas: 70, ctl: 72, def: 68 }, hair: 'beanie',   hairColor: '#6b3f22', skin: '#f6cfa6', cap: '#ff8a1f' },
  { id: 'turbo',      name: 'Turbo',       rarity: 'rare',      r: { spd: 84, sht: 66, pas: 70, ctl: 76, def: 60 }, hair: 'goggles',  hairColor: '#b8521f', skin: '#f6cfa6' },
  { id: 'ninja',      name: 'Ninja',       rarity: 'epic',      r: { spd: 86, sht: 74, pas: 72, ctl: 86, def: 72 }, hair: 'ninja',    hairColor: '#1b1b2a', skin: '#f2c49b', band: '#ff3a3f' },
  { id: 'mohawk',     name: 'Mohawk',      rarity: 'epic',      r: { spd: 80, sht: 86, pas: 70, ctl: 76, def: 78 }, hair: 'mohawk',   hairColor: '#ff3a8a', skin: '#c98b5e' },
  { id: 'robot',      name: 'Robot',       rarity: 'epic',      r: { spd: 76, sht: 80, pas: 86, ctl: 80, def: 86 }, hair: 'robot',    hairColor: '#9aa7b8', skin: '#cfd8e3' },
  { id: 'viking',     name: 'Viking',      rarity: 'epic',      r: { spd: 72, sht: 84, pas: 72, ctl: 74, def: 92 }, hair: 'viking',   hairColor: '#e07b2a', skin: '#f2c49b' },
  { id: 'afroking',   name: 'Afro King',   rarity: 'legendary', r: { spd: 86, sht: 88, pas: 88, ctl: 90, def: 80 }, hair: 'afro',     hairColor: '#1b1b2a', skin: '#7a4a2a' },
  { id: 'phantom',    name: 'Phantom',     rarity: 'legendary', r: { spd: 94, sht: 86, pas: 82, ctl: 92, def: 76 }, hair: 'ponytail', hairColor: '#5b4bd6', skin: '#e9b489' },
  { id: 'goldenboot', name: 'Golden Boot', rarity: 'legendary', r: { spd: 90, sht: 95, pas: 90, ctl: 92, def: 84 }, hair: 'crown',    hairColor: '#2b1d14', skin: '#f2c49b' },
  // the top shelf: every one of these outplays everything above, and costs days to weeks of play
  { id: 'dreads',     name: 'Dreadlock',   rarity: 'epic',      r: { spd: 88, sht: 84, pas: 82, ctl: 88, def: 78 }, hair: 'dreads',   hairColor: '#2b1d14', skin: '#7a4a2a' },
  { id: 'samurai',    name: 'Samurai',     rarity: 'epic',      r: { spd: 86, sht: 86, pas: 80, ctl: 90, def: 84 }, hair: 'samurai',  hairColor: '#1b1b2a', skin: '#f2c49b', band: '#ff3a3f' },
  { id: 'cowboy',     name: 'Cowboy',      rarity: 'epic',      r: { spd: 84, sht: 90, pas: 84, ctl: 82, def: 82 }, hair: 'cowboy',   hairColor: '#8a4b22', skin: '#e9b489', cap: '#a8652c' },
  { id: 'pirate',     name: 'Captain Hook', rarity: 'legendary', r: { spd: 88, sht: 90, pas: 86, ctl: 88, def: 86 }, hair: 'pirate',  hairColor: '#1b1b2a', skin: '#c98b5e' },
  { id: 'knight',     name: 'Knight',      rarity: 'legendary', r: { spd: 84, sht: 88, pas: 86, ctl: 86, def: 96 }, hair: 'knight',   hairColor: '#aab4c6', skin: '#f2c49b', band: '#ff3a3f' },
  { id: 'pharaoh',    name: 'Pharaoh',     rarity: 'legendary', r: { spd: 88, sht: 90, pas: 94, ctl: 90, def: 84 }, hair: 'pharaoh',  hairColor: '#1b1b2a', skin: '#b87a4b' },
  { id: 'shark',      name: 'Shark',       rarity: 'legendary', r: { spd: 96, sht: 90, pas: 84, ctl: 90, def: 86 }, hair: 'shark',    hairColor: '#6f8aa6', skin: '#f6cfa6' },
  { id: 'lion',       name: 'Lion King',   rarity: 'mythic',    r: { spd: 92, sht: 94, pas: 90, ctl: 92, def: 92 }, hair: 'lion',     hairColor: '#e0901f', skin: '#c98b5e' },
  { id: 'wizard',     name: 'Wizard',      rarity: 'mythic',    r: { spd: 90, sht: 94, pas: 97, ctl: 95, def: 88 }, hair: 'wizard',   hairColor: '#e9eef5', skin: '#f2c49b', cap: '#5b3bd6' },
  { id: 'astronaut',  name: 'Astronaut',   rarity: 'mythic',    r: { spd: 95, sht: 92, pas: 92, ctl: 94, def: 90 }, hair: 'astronaut', hairColor: '#e9eef5', skin: '#e9b489' },
  { id: 'iceking',    name: 'Ice King',    rarity: 'mythic',    r: { spd: 94, sht: 95, pas: 92, ctl: 95, def: 94 }, hair: 'ice',      hairColor: '#7fdcff', skin: '#dfeaf5' },
  { id: 'inferno',    name: 'Inferno',     rarity: 'mythic',    r: { spd: 97, sht: 97, pas: 90, ctl: 94, def: 90 }, hair: 'flame',    hairColor: '#ff7a1a', skin: '#e9b489' },
  { id: 'galaxy',     name: 'Galaxy',      rarity: 'mythic',    r: { spd: 96, sht: 96, pas: 96, ctl: 96, def: 92 }, hair: 'galaxy',   hairColor: '#4b2aa8', skin: '#a8693f' },
  { id: 'titan',      name: 'Titan',       rarity: 'mythic',    r: { spd: 94, sht: 98, pas: 94, ctl: 96, def: 98 }, hair: 'flattop',  hairColor: '#1b1b2a', skin: '#7a4a2a' },
  { id: 'goat',       name: 'The GOAT',    rarity: 'mythic',    r: { spd: 99, sht: 99, pas: 98, ctl: 99, def: 95 }, hair: 'goat',     hairColor: '#f4f5f7', skin: '#f2c49b' },
];
// Accessories: one slot, worn over any character. slot says where it's drawn on the body.
const ACCESSORIES = [
  { id: 'clownnose',   name: 'Clown Nose',      slot: 'face', price: 6000 },
  { id: 'wristbands',  name: 'Sweatbands',      slot: 'arm',  price: 7000 },
  { id: 'mustache',    name: 'Mustache',        slot: 'face', price: 7500 },
  { id: 'shades',      name: 'Shades',          slot: 'face', price: 8000 },
  { id: 'partyhat',    name: 'Party Hat',       slot: 'head', price: 8500 },
  { id: 'eyepatch',    name: 'Eye Patch',       slot: 'face', price: 9000 },
  { id: 'bowtie',      name: 'Bow Tie',         slot: 'neck', price: 9500 },
  { id: 'warpaint',    name: 'War Paint',       slot: 'face', price: 10000 },
  { id: 'scarf',       name: 'Scarf',           slot: 'neck', price: 11000 },
  { id: 'monocle',     name: 'Monocle',         slot: 'face', price: 12000 },
  { id: 'armband',     name: 'Captain Armband', slot: 'arm',  price: 13000 },
  { id: 'starshades',  name: 'Star Shades',     slot: 'face', price: 14000 },
  { id: 'flowercrown', name: 'Flower Crown',    slot: 'head', price: 15000 },
  { id: 'heromask',    name: 'Hero Mask',       slot: 'face', price: 16000 },
  { id: 'headphones',  name: 'Headphones',      slot: 'head', price: 18000 },
  { id: 'propeller',   name: 'Propeller Cap',   slot: 'head', price: 20000 },
  { id: 'visor',       name: 'Cyber Visor',     slot: 'face', price: 22000 },
  { id: 'chain',       name: 'Gold Chain',      slot: 'neck', price: 25000 },
  { id: 'medal',       name: 'Gold Medal',      slot: 'neck', price: 30000 },
  { id: 'horns',       name: 'Devil Horns',     slot: 'head', price: 35000 },
  { id: 'halo',        name: 'Halo',            slot: 'head', price: 40000 },
  { id: 'cape',        name: 'Hero Cape',       slot: 'back', price: 45000 },
  { id: 'goldboots',   name: 'Golden Boots',    slot: 'feet', price: 50000 },
  { id: 'wings',       name: 'Angel Wings',     slot: 'back', price: 60000 },
  { id: 'jetpack',       name: 'Jetpack',          slot: 'back', price: 75000 },
  { id: 'royalcrown',    name: 'Royal Crown',      slot: 'head', price: 80000 },
  { id: 'diamondshades', name: 'Diamond Shades',   slot: 'face', price: 90000 },
  { id: 'lightningvisor',name: 'Lightning Visor',  slot: 'face', price: 100000 },
  { id: 'neonhalo',      name: 'Neon Halo',        slot: 'head', price: 110000 },
  { id: 'dragonwings',   name: 'Dragon Wings',     slot: 'back', price: 125000 },
  { id: 'royalcape',     name: 'Royal Cape',       slot: 'back', price: 140000 },
  { id: 'diamondchain',  name: 'Diamond Chain',    slot: 'neck', price: 150000 },
  { id: 'worldmedal',    name: 'World Medal',      slot: 'neck', price: 160000 },
  { id: 'galaxyboots',   name: 'Galaxy Boots',     slot: 'feet', price: 175000 },
  { id: 'flameboots',    name: 'Flame Boots',      slot: 'feet', price: 185000 },
  { id: 'robotarm',      name: 'Robot Arm',        slot: 'arm',  price: 195000 },
  { id: 'kingmantle',    name: "King's Mantle",   slot: 'back', price: 210000 },
  { id: 'spacehelmet',   name: 'Space Helmet',     slot: 'head', price: 225000 },
  { id: 'dragonmask',    name: 'Dragon Mask',      slot: 'face', price: 240000 },
  { id: 'championbelt',  name: 'Champion Belt',    slot: 'neck', price: 260000 },
];
const ACCESSORY_IDS = new Set(ACCESSORIES.map((a) => a.id));
const ACCESSORY_FACE_IDS = new Set(ACCESSORIES.filter((a) => a.slot === 'face').map((a) => a.id));

// the four ways an ult shot can be struck, picked at random
const ULT_KINDS = ['volley', 'bicycle', 'backflip', 'scissors'];
// the online World Cup's rounds (the server keeps which one you're in)
const WC_ROUNDS = ['ROUND OF 16', 'QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];
const WC_PRIZE = 1000;
const PWC_ROUNDS = ['ROUND OF 16', 'QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];
const PWC_PRIZE = 750;
// quick chat: the only things anyone can say in a match (no typing, so nothing nasty gets through)
const QUICK_CHAT = ['HI!', 'NICE ONE!', 'PASS!', 'SHOOT!', 'DEFEND!', 'WHAT A GOAL!', 'THANKS!', 'SORRY!', 'UNLUCKY', 'WOW!', "LET'S GO!", 'GG'];
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][n % 10 > 3 || (n % 100 > 10 && n % 100 < 14) ? 0 : n % 10]);
const ULT_COLORS = ['#ff3a3f', '#ff8a1f', '#ffe14d', '#3fcf4a', '#46d9ff', '#b04dff', '#ff4df0'];
const rainbow = (t, i = 0) => ULT_COLORS[(Math.floor(t * 9 + i) % ULT_COLORS.length + ULT_COLORS.length) % ULT_COLORS.length];

const AI_HAIRS = ['messy', 'spikes', 'curly', 'buzz', 'headband', 'messy', 'curly', 'beanie', 'mohawk', 'afro'];

// Bots play as real characters. Each rarity's share of all bots is split evenly across its
// characters, so rarer ones turn up less: a mythic like The GOAT is about 1 bot in 800.
const BOT_RARITY_SHARE = { starter: 35, common: 27, rare: 20, epic: 12, legendary: 5, mythic: 1 };
// online, the players filling an empty spot (after 30s in the queue) play like people who have put the
// hours in: mostly rare-to-legendary characters, the odd mythic
const BOT_RARITY_ONLINE = { starter: 4, common: 12, rare: 30, epic: 30, legendary: 18, mythic: 6 };
function pickBotCharacter(rand = Math.random, share = BOT_RARITY_SHARE) {
  const count = {};
  for (const c of CHARACTERS) count[c.rarity] = (count[c.rarity] || 0) + 1;
  const weight = (c) => (share[c.rarity] || 0) / count[c.rarity];
  let roll = rand() * CHARACTERS.reduce((sum, c) => sum + weight(c), 0);
  for (const c of CHARACTERS) { roll -= weight(c); if (roll <= 0) return c; }
  return CHARACTERS[0];
}

const overall = (r) => Math.round((r.spd + r.sht + r.pas + r.ctl + r.def) / 5);
// rating 70 = 0; 95 ≈ +1; 99 ≈ +1.16; 45 ≈ -1. Kept small on purpose: better, not unfair.
const NEUTRAL_ATTR = { speed: 1, shot: 1, pass: 1, finish: 0, ctl: 0, def: 0 };
function ratingAttr(r) {
  const f = (v) => clamp((v - 70) / 25, -1, 1.16);
  return { speed: 1 + f(r.spd) * 0.08, shot: 1 + f(r.sht) * 0.07, finish: -f(r.sht) * 0.07, pass: 1 + f(r.pas) * 0.1, ctl: f(r.ctl), def: f(r.def) };
}

// ===== Bot difficulty (moved from main.js so the server can load it) =====
const DIFFICULTY = {
  // aiSlide: chance per 0.2s check that a pressing bot slides; aiDodge: chance a bot carrier dodges a slide
  // mistakes: how often bots get it wrong (BOT_MISTAKES), 1 = an average player
  // 2026-09-16 "make the bots worse": every preset is slower, tackles less, decides later,
  // shoots wider and slips up more than it did. Your own teammates keep MATE_BASE below.
  // 2026-09-17 "just barely better", then "make the bots 1.25x better": every knob x1.25 (or /1.25
  // where lower is better), and the speed gap to a full-speed player closed by a quarter.
  easy:   { redSpeed: 0.904, slideOnHuman: 0.71, aiSlide: 0.2,  aiDodge: 0.21,  aiSkill: 0.16, keeperBonus: -0.05, aiShotNoise: 51, react: 1.16, mistakes: 1.36 },
  normal: { redSpeed: 0.96,  slideOnHuman: 0.9,  aiSlide: 0.27, aiDodge: 0.375, aiSkill: 0.26, keeperBonus: 0.05,  aiShotNoise: 39, react: 0.92, mistakes: 1.04 },
  hard:   { redSpeed: 1.02,  slideOnHuman: 1,    aiSlide: 0.46, aiDodge: 0.55,  aiSkill: 0.36, keeperBonus: 0.13,  aiShotNoise: 27, react: 0.74, mistakes: 0.75 },
};
// online fill-ins (2026-09-19 "bots that are actually good"): quicker, sharper and cleaner than hard,
// on both sides of an online match. Your level and the World Cup round still add to this.
const ONLINE_BOTS = { redSpeed: 1.0, slideOnHuman: 0.95, aiSlide: 0.36, aiDodge: 0.6, aiSkill: 0.4, keeperBonus: 0.14, aiShotNoise: 24, react: 0.7, mistakes: 0.6 };
// your bot teammates offline: what "normal" was before the bots were made worse, so the
// players on your side did not get worse too
const MATE_BASE = { redSpeed: 0.984, slideOnHuman: 0.95, aiSlide: 0.34, aiDodge: 0.48, aiSkill: 0.33, keeperBonus: 0.1, aiShotNoise: 30, react: 0.77, mistakes: 0.75 };

// coin counts for display: 999999 stays exact, then 1.25M, 1B
function fmtCoins(n) {
  n = Math.floor(Number(n) || 0);
  if (n < 1e6) return String(n);
  const [v, unit] = n >= 1e9 ? [n / 1e9, 'B'] : [n / 1e6, 'M'];
  return (v >= 100 ? Math.floor(v) : Math.floor(v * 100) / 100) + unit;
}

// YOUR level makes every match harder: level 1 plays as before, level 50+ is the full ramp.
// Ranks are just a name for where you are on it.
const LEVEL_RAMP_TOP = 50;
const RANKS = [[1, 'ROOKIE'], [6, 'PRO'], [12, 'STAR'], [20, 'ELITE'], [30, 'WORLD CLASS'], [40, 'LEGEND'], [50, 'GOAT']];
const rankFor = (level) => { let n = RANKS[0][1]; for (const [lv, name] of RANKS) if (level >= lv) n = name; return n; };
const levelRampPct = (level) => Math.round(clamp((level - 1) / (LEVEL_RAMP_TOP - 1), 0, 1) * 100);
function playerRamp(b, level) {
  const u = clamp(((level || 1) - 1) / (LEVEL_RAMP_TOP - 1), 0, 1);
  if (u <= 0) return { ...b, playerLevel: level || 1, ramp: 0 };
  return {
    ...b,
    redSpeed: b.redSpeed + u * 0.07,
    slideOnHuman: Math.min(1, b.slideOnHuman * (1 + u * 0.35)),
    aiSlide: b.aiSlide * (1 + u * 0.9),
    aiDodge: Math.min(0.8, b.aiDodge * (1 + u * 0.8)),
    aiSkill: Math.min(0.6, b.aiSkill * (1 + u * 0.8)),
    keeperBonus: b.keeperBonus + u * 0.1,
    aiShotNoise: Math.max(14, b.aiShotNoise * (1 - u * 0.45)),
    react: Math.max(0.5, b.react * (1 - u * 0.4)),
    mistakes: Math.max(0.28, b.mistakes * (1 - u * 0.65)),
    playerLevel: level,
    ramp: u,
  };
}

// a difficulty leaned on by a team's level (0..3): better teams are quicker and slip up less
function levelDiff(b, lv) {
  return {
    ...b,
    redSpeed: b.redSpeed + (lv - 1) * 0.015,
    aiSlide: b.aiSlide * (0.85 + lv * 0.08),
    aiDodge: b.aiDodge * (0.85 + lv * 0.1),
    aiSkill: b.aiSkill * (0.8 + lv * 0.12),
    keeperBonus: b.keeperBonus + (lv - 1) * 0.03,
    aiShotNoise: Math.max(16, b.aiShotNoise - (lv - 1) * 4),
    slideOnHuman: b.slideOnHuman * (0.95 + lv * 0.04),
    mistakes: (b.mistakes || 1) * (1.12 - lv * 0.08),
  };
}

// Bots play like average players, on both teams and online: misplaced and badly weighted
// passes, heavy first touches, loose dribbles, scuffed and wild shots, mistimed tackles,
// switching off, and keepers spilling the odd one. Chances are per action, times the
// difficulty's mistakes factor.
const BOT_MISTAKES = {
  passAim: 0.06,       // radians of aim wobble on every pass (doubled under pressure)
  passBad: 0.1,        // a pass that is badly off: well wide and under/over-hit
  wrongPass: 0.3,      // score noise when picking who to pass to
  heavyTouch: 0.13,    // a firm pass bounces off the receiver instead of being controlled
  looseTouch: 0.08,    // per decision while a defender is close: knocks it too far ahead
  shotScuff: 0.12,     // shot comes off weak
  shotWild: 0.15,      // shot flies well wide
  longShot: 0.06,      // per decision from 900-1300 away: have a go anyway
  tackleMiss: 0.14,    // a tackle that connects but is mistimed
  lapse: 0.07,         // per second off the ball: switches off for a moment
  lapseTime: [0.5, 1.3],
  keeperSpill: 0.07,   // a saved shot squirts back out in front of goal
};

const TRAILS = [
  { id: 'electric', name: 'Electric', a: '#46d9ff', b: '#ffffff' },
  { id: 'fire',     name: 'Fire',     a: '#ff7a1a', b: '#ffe14d' },
  { id: 'plasma',   name: 'Plasma Spin', a: '#b04dff', b: '#f3d2ff' },
  { id: 'blast',    name: 'White Blast', a: '#ffffff', b: '#bff3ff' },
  { id: 'frost',    name: 'Frostbite', a: '#8fe3ff', b: '#ffffff' },
  { id: 'toxic',    name: 'Toxic',     a: '#7dff3a', b: '#e8ffc2' },
  { id: 'shadow',   name: 'Shadow',    a: '#7b3bff', b: '#1b1033' },
  { id: 'rainbow',  name: 'Rainbow',   a: '#ff5fa8', b: '#ffe14d' },
  { id: 'golden',   name: 'Golden',    a: '#ffc21a', b: '#fff3a0' },
];

// how many samples of ball path each trail keeps (the shop trails are the long ones)
const TRAIL_LEN = { pass: 7, weak: 8, shot: 10, strong: 14 };
for (const t of TRAILS) TRAIL_LEN[t.id] = 18;

// ===== Small math helpers ===========================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
// Lighten (amt > 0) or darken (amt < 0) a #rrggbb color — flat highlight/shade tones.
function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===== Arena walls ==================================================
// One closed polygon (boards + goal pockets) plus two stubs that close the
// gap between each post and the end boards. Circle-vs-segment collision.
const WALLS = [];
const POSTS = [];
const ARENA_POLY = [];
(function buildWalls() {
  const W = CFG.FIELD_W, H = CFG.FIELD_H, M = CFG.SIDE_M, E = CFG.END_M, C = CFG.CHAMFER, D = CFG.GOAL_D;
  const pts = [
    [-E + C, -M], [W + E - C, -M], [W + E, -M + C], [W + E, GOAL_Y1],
    [W + D, GOAL_Y1], [W + D, GOAL_Y2], [W + E, GOAL_Y2], [W + E, H + M - C],
    [W + E - C, H + M], [-E + C, H + M], [-E, H + M - C], [-E, GOAL_Y2],
    [-D, GOAL_Y2], [-D, GOAL_Y1], [-E, GOAL_Y1], [-E, -M + C],
  ];
  const add = (ax, ay, bx, by, kind, side) => {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
    WALLS.push({ ax, ay, bx, by, dx, dy, len2: l * l, nx: -dy / l, ny: dx / l, kind, side });
  };
  ARENA_POLY.push(...pts);
  const pocket = [3, 4, 5, 11, 12, 13];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const side = a[0] > W / 2 ? 'right' : 'left';
    add(a[0], a[1], b[0], b[1], pocket.includes(i) ? 'net' : 'board', side);
  }
  add(W, GOAL_Y1, W + E, GOAL_Y1, 'net', 'right');
  add(W, GOAL_Y2, W + E, GOAL_Y2, 'net', 'right');
  add(0, GOAL_Y1, -E, GOAL_Y1, 'net', 'left');
  add(0, GOAL_Y2, -E, GOAL_Y2, 'net', 'left');
  POSTS.push({ x: W, y: GOAL_Y1 }, { x: W, y: GOAL_Y2 }, { x: 0, y: GOAL_Y1 }, { x: 0, y: GOAL_Y2 });
})();

// point-in-polygon (ray cast) against the arena outline, goal pockets included
function insideArena(x, y) {
  let inside = false;
  for (let i = 0, j = ARENA_POLY.length - 1; i < ARENA_POLY.length; j = i++) {
    const [xi, yi] = ARENA_POLY[i], [xj, yj] = ARENA_POLY[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const WALL_HIT = { hit: 0, net: null, post: false };
function collideWalls(o, r, bounce) {
  WALL_HIT.hit = 0; WALL_HIT.net = null; WALL_HIT.post = false;
  for (let i = 0; i < WALLS.length; i++) {
    const s = WALLS[i];
    let t = ((o.x - s.ax) * s.dx + (o.y - s.ay) * s.dy) / s.len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.ax + s.dx * t, cy = s.ay + s.dy * t;
    const dx = o.x - cx, dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    let d = Math.sqrt(d2), nx, ny;
    if (d < 1e-4) { nx = s.nx; ny = s.ny; d = 0; } else { nx = dx / d; ny = dy / d; }
    o.x += nx * (r - d);
    o.y += ny * (r - d);
    const vn = o.vx * nx + o.vy * ny;
    if (vn < 0) {
      o.vx -= (1 + bounce) * vn * nx;
      o.vy -= (1 + bounce) * vn * ny;
      if (-vn > WALL_HIT.hit) WALL_HIT.hit = -vn;
      if (s.kind === 'net') WALL_HIT.net = s.side;
    }
  }
  for (let i = 0; i < POSTS.length; i++) {
    if (Math.abs(o.x - POSTS[i].x) < r + 4 && Math.abs(o.y - POSTS[i].y) < r + 4) WALL_HIT.post = true;
  }
  return WALL_HIT;
}
