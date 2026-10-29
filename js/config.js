// ===== Name & identity ==============================================
// Temporary title. Change GAME_NAME to rename every visible title.
// STORAGE_KEY stays fixed so saved progress survives a rename.
const GAME_NAME = tl('Mini Strikers');
const GAME_SLOGANS = [tl('SMALL PLAYERS'), tl('BIG MOMENTS!'), tl('PLAY TOGETHER!'), tl('GOAL!')];
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
  MATCH_MINUTES: 2,  // every match, offline and online (server/game.js MATCH_MINUTES says the same)

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
  // The goalmouth: how hard the keeper makes it to simply walk the ball in.
  // range: he leaves his line for a carrier this close to goal · close: he commits inside this
  // gap: seconds between attempts · chance/botChance: how often he goes for it
  // speed: how fast he closes · windup: the crouch that gives you a window to skill past him
  // grab: how much of the ball-winning chance he keeps when he gets there
  SMOTHER: { range: 205, close: 150, gap: 0.08, chance: 0.95, botChance: 0.97, speed: 1.7, windup: 0.16, grab: 1.4,
    // dodgeStop: a keeper at your feet is not a sliding tackle — skilling past him works, but not always
    // loose: inside the six-yard box the ball sits further ahead of you, so it is never a stroll
    dodgeStop: 0.6, loose: 1.45, retry: 0.3, fumble: 0.25 },
};
const GOAL_Y1 = (CFG.FIELD_H - CFG.GOAL_W) / 2;
const GOAL_Y2 = GOAL_Y1 + CFG.GOAL_W;
const OUTLINE = '#161a33';

const TEAMS = {
  blue: { name: tl('BLUE'), dir: 1, jersey: '#2f7bff', shade: '#1b56d8', accent: '#ffffff', shorts: '#1a2350', socks: '#ffffff', shoes: '#1b1d33', fx: '#46d9ff', board: '#2464e8', lip: '#6aa2ff' },
  red:  { name: tl('RED'), dir: -1, jersey: '#ff3a3f', shade: '#c81f2b', accent: '#1b1d33', shorts: '#1b1d33', socks: '#ff3a3f', shoes: '#1b1d33', fx: '#ff5a3c', board: '#e3303a', lip: '#ff8a8e' },
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
// ===== SIGNATURE SKILLS ==============================================
// What the skill button does, when you are carrying a move of your own.
//
//   ball   how the ball leaves you. speed/lift are how hard and how high; keep means it stays
//          at your feet; back sends it behind you; drop leaves it where it is.
//   self   what happens to you: burst (free running speed), dodge (tackles miss), hop (off the
//          ground), kick (the leg animation), turn (which way you end up facing).
//   hit    what it does to defenders within radius: stun them, knock them back, put them down.
//   fx     the picture: a ring, sparks, a burst, stars, or the ground shaking.
//
// Nothing here can score, pass or tackle for you — a signature move buys you a moment, and what
// you do with the moment is still yours.
const SKILLS = [
  { id: 'classic', name: tl('Classic'), rarity: 'starter', read: true,
    blurb: tl('Reads the stick: nutmeg, flick, burst, Cruyff turn or hop, whichever the moment wants.') },

  // ---- rare: a trick, cleanly done
  { id: 'rainbow', name: tl('Rainbow Flick'), rarity: 'rare', say: tl('RAINBOW!'), color: '#ffc21a',
    ball: { speed: 300, lift: 620, over: true }, self: { hop: 0.34, dodge: 0.4, burst: 0.5, kick: 0.2 },
    fx: { kind: 'ring', color: '#ffc21a', r0: 8, r1: 34, life: 0.3 }, meter: 6,
    blurb: tl('Scoop it up over your own head and run onto it.') },
  { id: 'stepover', name: tl('Stepover'), rarity: 'rare', say: tl('STEPOVER!'), color: '#ffffff',
    ball: { keep: true }, self: { dodge: 0.52, turn: 'aim' }, hit: { radius: 46, stun: 0.3 },
    fx: { kind: 'ring', color: '#ffffff', r0: 6, r1: 30, life: 0.26 }, meter: 4,
    blurb: tl('Feet over the ball until whoever is watching them stops believing you.') },
  { id: 'dragback', name: tl('Drag Back'), rarity: 'rare', say: tl('DRAG BACK!'), color: '#86e8e2',
    ball: { keep: true, back: true }, self: { dodge: 0.45, turn: 'reverse', kick: 0.2 },
    fx: { kind: 'ring', color: '#86e8e2', r0: 4, r1: 22, life: 0.24 }, meter: 4,
    blurb: tl('Pull it back under your foot and leave them going the other way.') },
  { id: 'heelflick', name: tl('Heel Flick'), rarity: 'rare', say: tl('HEEL!'), color: '#ff8af0',
    ball: { speed: 420, lift: 180 }, self: { burst: 0.6, dodge: 0.3, kick: 0.18 }, hit: { radius: 40, stun: 0.25 },
    fx: { kind: 'sparks', color: '#ff8af0', n: 10, speed: 120 }, meter: 5,
    blurb: tl('Flick it on with the back of your boot without breaking stride.') },
  { id: 'roulette', name: tl('Roulette'), rarity: 'rare', say: tl('ROULETTE!'), color: '#9ad1ff',
    ball: { keep: true }, self: { dodge: 0.5, spin: 1, turn: 'aim' },
    fx: { kind: 'ring', color: '#9ad1ff', r0: 6, r1: 28, life: 0.26 }, meter: 5,
    blurb: tl('Turn right through the tackle with the ball under your foot.') },
  { id: 'scoopturn', name: tl('Scoop Turn'), rarity: 'rare', say: tl('SCOOP!'), color: '#ffd166',
    ball: { keep: true, back: true }, self: { dodge: 0.46, turn: 'reverse', kick: 0.2 },
    fx: { kind: 'ring', color: '#ffd166', r0: 5, r1: 24, life: 0.24 }, meter: 4,
    blurb: tl('Lift it back behind you and go and get it yourself.') },
  { id: 'toepoke', name: tl('Toe Poke'), rarity: 'rare', say: tl('TOE POKE!'), color: '#ff8a1f',
    ball: { speed: 480, lift: 90 }, self: { burst: 0.55, dodge: 0.28, kick: 0.16 }, hit: { radius: 38, stun: 0.22 },
    fx: { kind: 'sparks', color: '#ff8a1f', n: 9, speed: 130 }, meter: 5,
    blurb: tl('No backlift, no warning, gone.') },
  { id: 'shoulderdrop', name: tl('Shoulder Drop'), rarity: 'rare', say: tl('DROPPED HIM!'), color: '#c2f5f1',
    ball: { keep: true }, self: { dodge: 0.55, turn: 'aim' }, hit: { radius: 44, stun: 0.28 },
    fx: { kind: 'burst', color: '#c2f5f1', size: 20 }, meter: 5,
    blurb: tl('Lean one way hard enough that they buy it, then go the other.') },
  { id: 'chopcut', name: tl('Chop Cut'), rarity: 'rare', say: tl('CHOP!'), color: '#86e8e2',
    ball: { keep: true }, self: { dodge: 0.5, burst: 0.35, turn: 'aim', kick: 0.18 },
    fx: { kind: 'ring', color: '#86e8e2', r0: 5, r1: 26, life: 0.25 }, meter: 5,
    blurb: tl('Chop it back across your own body and set off again.') },

  // ---- epic: the ones that make people stand up
  { id: 'elastico', name: tl('Elastico'), rarity: 'epic', say: tl('ELASTICO!'), color: '#b04dff',
    ball: { keep: true }, self: { dodge: 0.62, burst: 0.45, turn: 'aim' }, hit: { radius: 54, stun: 0.34 },
    fx: { kind: 'ring', color: '#b04dff', r0: 6, r1: 38, life: 0.3, width: 4 }, meter: 7,
    blurb: tl('Snap it one way, take it the other, all in the same touch.') },
  { id: 'sombrero', name: tl('Sombrero'), rarity: 'epic', say: tl('SOMBRERO!'), color: '#ffe14d',
    ball: { speed: 360, lift: 760, over: true }, self: { burst: 0.75, dodge: 0.45, hop: 0.3 }, hit: { radius: 52, stun: 0.3 },
    fx: { kind: 'stars' }, meter: 8,
    blurb: tl('Straight over their head, and you are past before it lands.') },
  { id: 'spincycle', name: tl('Spin Cycle'), rarity: 'epic', say: tl('SPIN CYCLE!'), color: '#46d9ff',
    ball: { keep: true }, self: { dodge: 0.7, spin: 2, turn: 'aim' },
    fx: { kind: 'ring', color: '#46d9ff', r0: 10, r1: 44, life: 0.36, width: 4 }, meter: 7,
    blurb: tl('Two turns, not one. Nobody follows the second.') },
  { id: 'ghoststep', name: tl('Ghost Step'), rarity: 'epic', say: tl('GHOST!'), color: '#c2f5f1',
    ball: { keep: true }, self: { dodge: 0.85, burst: 0.6, ghost: true },
    fx: { kind: 'burst', color: '#c2f5f1', size: 26 }, meter: 8,
    blurb: tl('For a moment there is nothing there to tackle.') },
  { id: 'blindturn', name: tl('Blind Turn'), rarity: 'epic', say: tl('BLIND TURN!'), color: '#ffffff',
    ball: { keep: true, back: true }, self: { dodge: 0.55, burst: 0.7, turn: 'reverse' }, hit: { radius: 48, stun: 0.3 },
    fx: { kind: 'ring', color: '#ffffff', r0: 8, r1: 36, life: 0.3 }, meter: 7,
    blurb: tl('Turn without looking and go back the way you came, faster.') },
  { id: 'akka', name: tl('Akka Flick'), rarity: 'epic', say: tl('AKKA!'), color: '#ffb0f0',
    ball: { speed: 340, lift: 700, over: true }, self: { hop: 0.32, burst: 0.7, dodge: 0.42 }, hit: { radius: 48, stun: 0.28 },
    fx: { kind: 'stars' }, meter: 8,
    blurb: tl('Both feet round it and up over the lot of them.') },
  { id: 'crossover', name: tl('Crossover'), rarity: 'epic', say: tl('CROSSOVER!'), color: '#7fdcff',
    ball: { keep: true }, self: { dodge: 0.65, burst: 0.5, turn: 'aim' }, hit: { radius: 50, stun: 0.32 },
    fx: { kind: 'ring', color: '#7fdcff', r0: 6, r1: 36, life: 0.28, width: 4 }, meter: 7,
    blurb: tl('Across your body and away, before the first foot has landed.') },
  { id: 'pendulum', name: tl('Pendulum'), rarity: 'epic', say: tl('PENDULUM!'), color: '#b04dff',
    ball: { keep: true }, self: { dodge: 0.68, spin: 1.5, turn: 'aim' }, hit: { radius: 46, stun: 0.3 },
    fx: { kind: 'ring', color: '#b04dff', r0: 8, r1: 40, life: 0.34, width: 4 }, meter: 8,
    blurb: tl('Swing it one way, then all the way back through where they are standing.') },
  { id: 'slipstream', name: tl('Slipstream'), rarity: 'epic', say: tl('SLIPSTREAM!'), color: '#46d9ff',
    ball: { keep: true }, self: { burst: 0.95, dodge: 0.4 },
    fx: { kind: 'sparks', color: '#46d9ff', n: 16, speed: 170, life: 0.34 }, meter: 7,
    blurb: tl('Tuck in behind them and come out the other side at speed.') },
  { id: 'flipflap', name: tl('Flip Flap'), rarity: 'epic', say: tl('FLIP FLAP!'), color: '#ffe14d',
    ball: { keep: true }, self: { dodge: 0.7, burst: 0.45, turn: 'aim' }, hit: { radius: 52, stun: 0.3 },
    fx: { kind: 'burst', color: '#ffe14d', size: 26 }, meter: 8,
    blurb: tl('Out and back in one touch. The second one is the one that does it.') },

  // ---- legendary: now it is a weapon
  { id: 'tornado', name: tl('Tornado'), rarity: 'legendary', say: tl('TORNADO!'), color: '#7fdcff',
    ball: { keep: true }, self: { dodge: 0.7, spin: 2, turn: 'aim' }, hit: { radius: 76, stun: 0.5, push: 170 },
    fx: { kind: 'ring', color: '#7fdcff', r0: 12, r1: 76, life: 0.42, width: 5, shake: 3 }, meter: 10,
    blurb: tl('Spin hard enough and everyone near you goes with it.') },
  { id: 'blink', name: tl('Blink'), rarity: 'legendary', say: tl('BLINK!'), color: '#b04dff',
    ball: { keep: true }, self: { dodge: 0.5, burst: 0.8, dash: 86 },
    fx: { kind: 'burst', color: '#b04dff', size: 30, shake: 2 }, meter: 10,
    blurb: tl('Gone from here, already there, ball and all.') },
  { id: 'afterburn', name: tl('Afterburn'), rarity: 'legendary', say: tl('AFTERBURN!'), color: '#ff5a1f',
    ball: { keep: true }, self: { burst: 1.25, dodge: 0.45 },
    fx: { kind: 'sparks', color: '#ff5a1f', n: 22, speed: 200, life: 0.4 }, meter: 9,
    blurb: tl('Light it up and simply leave.') },
  { id: 'matador', name: tl('Matador'), rarity: 'legendary', say: tl('OLE!'), color: '#f0343f',
    ball: { keep: true }, self: { dodge: 0.95, turn: 'aim' }, hit: { radius: 66, stun: 0.4, fall: true },
    fx: { kind: 'ring', color: '#f0343f', r0: 10, r1: 58, life: 0.36, width: 4 }, meter: 10,
    blurb: tl('Step aside and let them go past you into the floor.') },
  { id: 'shadowstep', name: tl('Shadow Step'), rarity: 'legendary', say: tl('SHADOW!'), color: '#8b4dff',
    ball: { keep: true }, self: { dodge: 0.8, burst: 0.8, ghost: true, decoy: true },
    fx: { kind: 'burst', color: '#8b4dff', size: 28 }, meter: 10,
    blurb: tl('Leave something behind for them to chase.') },
  { id: 'whirlpool', name: tl('Whirlpool'), rarity: 'legendary', say: tl('WHIRLPOOL!'), color: '#2f7bff',
    ball: { keep: true }, self: { dodge: 0.7, spin: 2, turn: 'aim' }, hit: { radius: 72, stun: 0.48, push: 150 },
    fx: { kind: 'ring', color: '#2f7bff', r0: 12, r1: 72, life: 0.4, width: 5, shake: 3 }, meter: 10,
    blurb: tl('Everything near you gets pulled round and spat back out.') },
  { id: 'mirage', name: tl('Mirage'), rarity: 'legendary', say: tl('MIRAGE!'), color: '#ffd166',
    ball: { keep: true }, self: { dodge: 0.9, burst: 0.7, ghost: true },
    fx: { kind: 'burst', color: '#ffd166', size: 30 }, meter: 10,
    blurb: tl('They commit to where you look like you are. You are not there.') },
  { id: 'thunderclap', name: tl('Thunderclap'), rarity: 'legendary', say: tl('CLAP!'), color: '#ffffff',
    ball: { keep: true }, self: { dodge: 0.6, burst: 0.5 }, hit: { radius: 80, stun: 0.5, push: 190, fall: true },
    fx: { kind: 'ring', color: '#ffffff', r0: 14, r1: 80, life: 0.4, width: 6, shake: 4 }, meter: 11,
    blurb: tl('One sound, and everyone within range is on the floor.') },
  { id: 'rocketheel', name: tl('Rocket Heel'), rarity: 'legendary', say: tl('ROCKET!'), color: '#ff5a1f',
    ball: { speed: 560, lift: 240 }, self: { burst: 1, dodge: 0.4, kick: 0.2 }, hit: { radius: 56, stun: 0.35 },
    fx: { kind: 'sparks', color: '#ff5a1f', n: 24, speed: 220, life: 0.4, shake: 2 }, meter: 10,
    blurb: tl('Backheel it like you meant to hurt it, then go and catch it.') },
  { id: 'frostbite', name: tl('Frostbite'), rarity: 'legendary', say: tl('FROZEN!'), color: '#bfe0ff',
    ball: { keep: true }, self: { dodge: 0.65, burst: 0.4 }, hit: { radius: 84, stun: 0.62 },
    fx: { kind: 'ring', color: '#bfe0ff', r0: 12, r1: 84, life: 0.46, width: 5 }, meter: 11,
    blurb: tl('Nobody around you moves for a moment. You do.') },

  // ---- mythic: the ones people talk about afterwards
  { id: 'thunderstep', name: tl('Thunder Step'), rarity: 'mythic', say: tl('THUNDER!'), color: '#ffe14d',
    ball: { keep: true }, self: { dodge: 0.7, burst: 0.7 }, hit: { radius: 96, stun: 0.6, push: 230, fall: true },
    fx: { kind: 'ring', color: '#ffe14d', r0: 14, r1: 96, life: 0.44, width: 6, shake: 5, flash: 0.18 }, meter: 12,
    blurb: tl('Put your foot down and the ground answers.') },
  { id: 'zerog', name: tl('Zero Gravity'), rarity: 'mythic', say: tl('ZERO G!'), color: '#86e8e2',
    ball: { keep: true, float: 220 }, self: { dodge: 0.8, hop: 0.6, burst: 0.7 }, hit: { radius: 70, stun: 0.45 },
    fx: { kind: 'ring', color: '#86e8e2', r0: 10, r1: 70, life: 0.5, width: 4 }, meter: 12,
    blurb: tl('You and the ball stop obeying the usual rules for a second.') },
  { id: 'timeskip', name: tl('Time Skip'), rarity: 'mythic', say: tl('TIME SKIP!'), color: '#c2f5f1',
    ball: { keep: true }, self: { dodge: 0.9, burst: 0.9, dash: 54 }, hit: { radius: 110, stun: 0.7 },
    fx: { kind: 'ring', color: '#c2f5f1', r0: 16, r1: 110, life: 0.5, width: 5, flash: 0.14 }, meter: 13,
    blurb: tl('Everyone else takes a moment to catch up with where you went.') },
  { id: 'phoenix', name: tl('Phoenix Dash'), rarity: 'mythic', say: tl('PHOENIX!'), color: '#ff8a1f',
    ball: { keep: true }, self: { dodge: 0.75, burst: 1.1, dash: 60 }, hit: { radius: 86, stun: 0.5, push: 200 },
    fx: { kind: 'sparks', color: '#ff8a1f', n: 28, speed: 240, life: 0.45, shake: 4, flash: 0.14 }, meter: 13,
    blurb: tl('Go up in flames and come out of them already running.') },
  { id: 'starfall', name: tl('Starfall'), rarity: 'mythic', say: tl('STARFALL!'), color: '#ffffff',
    ball: { speed: 520, lift: 900, over: true }, self: { burst: 1.0, dodge: 0.6, hop: 0.4 }, hit: { radius: 80, stun: 0.45 },
    fx: { kind: 'stars', shake: 3 }, meter: 13,
    blurb: tl('Send it up into the lights and be waiting where it comes down.') },
  { id: 'goatwalk', name: tl('GOAT Walk'), rarity: 'mythic', say: tl('GOAT!'), color: '#ffc21a',
    ball: { keep: true, glue: true }, self: { dodge: 1.15, burst: 1.0, turn: 'aim' }, hit: { radius: 92, stun: 0.55, push: 150 },
    fx: { kind: 'ring', color: '#ffc21a', r0: 12, r1: 92, life: 0.5, width: 6, shake: 4, flash: 0.2 }, meter: 14,
    blurb: tl('Walk. Nobody takes it off you. That is the whole move.') },
  { id: 'novastep', name: tl('Nova Step'), rarity: 'mythic', say: tl('NOVA!'), color: '#ffb0f0',
    ball: { keep: true }, self: { dodge: 0.8, burst: 0.9, dash: 64 }, hit: { radius: 100, stun: 0.6, push: 210 },
    fx: { kind: 'sparks', color: '#ffb0f0', n: 30, speed: 250, life: 0.46, shake: 4, flash: 0.16 }, meter: 13,
    blurb: tl('Go off like something in the sky and arrive somewhere else entirely.') },
  { id: 'blackout', name: tl('Blackout'), rarity: 'mythic', say: tl('BLACKOUT!'), color: '#8b4dff',
    ball: { keep: true, glue: true }, self: { dodge: 1, burst: 0.8, ghost: true }, hit: { radius: 90, stun: 0.58 },
    fx: { kind: 'burst', color: '#8b4dff', size: 34, shake: 3, flash: 0.18 }, meter: 13,
    blurb: tl('The lights go out. When they come back you are through on goal.') },
  { id: 'riptide', name: tl('Riptide'), rarity: 'mythic', say: tl('RIPTIDE!'), color: '#2f7bff',
    ball: { keep: true, float: 200 }, self: { dodge: 0.85, hop: 0.5, burst: 0.8 }, hit: { radius: 96, stun: 0.5, push: 240, fall: true },
    fx: { kind: 'ring', color: '#2f7bff', r0: 14, r1: 96, life: 0.5, width: 6, shake: 4 }, meter: 13,
    blurb: tl('The ground goes out from under everybody but you.') },
  { id: 'eclipsestep', name: tl('Eclipse Step'), rarity: 'mythic', say: tl('ECLIPSE!'), color: '#c2f5f1',
    ball: { keep: true, glue: true }, self: { dodge: 1.1, burst: 0.9, dash: 50 }, hit: { radius: 94, stun: 0.56, push: 170 },
    fx: { kind: 'ring', color: '#c2f5f1', r0: 16, r1: 94, life: 0.5, width: 6, flash: 0.16 }, meter: 14,
    blurb: tl('Everything goes quiet and dark, and then you are past.') },
  { id: 'infinityturn', name: tl('Infinity Turn'), rarity: 'mythic', say: tl('INFINITY!'), color: '#ff3a6e',
    ball: { keep: true, glue: true }, self: { dodge: 1.2, spin: 2, burst: 0.8, turn: 'aim' }, hit: { radius: 100, stun: 0.6, push: 180, fall: true },
    fx: { kind: 'ring', color: '#ff3a6e', r0: 14, r1: 100, life: 0.52, width: 6, shake: 5, flash: 0.2 }, meter: 14,
    blurb: tl('Turn, and keep turning, and come out of it still holding the ball.') },
];
const SKILL_IDS = new Set(SKILLS.map((s) => s.id));
const skillDef = (id) => SKILLS.find((s) => s.id === id) || SKILLS[0];

const RARITIES = {
  starter:   { name: tl('STARTER'),   color: '#8a90b8' },
  common:    { name: tl('COMMON'),    color: '#3fcf4a' },
  rare:      { name: tl('RARE'),      color: '#2f7bff' },
  epic:      { name: tl('EPIC'),      color: '#a35cff' },
  legendary: { name: tl('LEGENDARY'), color: '#ffb400' },
  mythic:    { name: tl('MYTHIC'),    color: '#ff3a6e' },
  oneofone:  { name: tl('ONE OF ONE'), color: '#ffe14d' },
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
  // the middle of the shop: 25 players between the starters and the top shelf
  { id: 'rookie', name: 'Rookie', rarity: 'common', r: { spd: 60, sht: 58, pas: 62, ctl: 60, def: 58 }, hair: 'flat', hairColor: '#4a2e1c', skin: '#f2c49b' },
  { id: 'hustle', name: 'Hustle', rarity: 'common', r: { spd: 62, sht: 60, pas: 58, ctl: 62, def: 64 }, hair: 'fade', hairColor: '#2b1d14', skin: '#7a4a2a' },
  { id: 'scrappy', name: 'Scrappy', rarity: 'common', r: { spd: 60, sht: 62, pas: 64, ctl: 60, def: 60 }, hair: 'shaggy', hairColor: '#6b3f22', skin: '#e9b489' },
  { id: 'dash', name: 'Dash', rarity: 'common', r: { spd: 72, sht: 58, pas: 56, ctl: 62, def: 54 }, hair: 'spikes', hairColor: '#ff8a1f', skin: '#f6cfa6' },
  { id: 'bounce', name: 'Bounce', rarity: 'common', r: { spd: 62, sht: 60, pas: 66, ctl: 66, def: 56 }, hair: 'curly', hairColor: '#f2c230', skin: '#f2c49b' },
  { id: 'cleats', name: 'Cleats', rarity: 'common', r: { spd: 64, sht: 64, pas: 60, ctl: 58, def: 66 }, hair: 'buzz', hairColor: '#b8521f', skin: '#e9b489' },
  { id: 'tinker', name: 'Tinker', rarity: 'common', r: { spd: 60, sht: 62, pas: 70, ctl: 64, def: 58 }, hair: 'goggles', hairColor: '#3fcf4a', skin: '#c98b5e' },
  { id: 'braidz', name: 'Braidz', rarity: 'common', r: { spd: 66, sht: 58, pas: 64, ctl: 68, def: 58 }, hair: 'braids', hairColor: '#1b1b2a', skin: '#7a4a2a', band: '#ffe14d' },
  { id: 'topknot', name: 'Topknot', rarity: 'common', r: { spd: 62, sht: 66, pas: 62, ctl: 64, def: 62 }, hair: 'topknot', hairColor: '#2b1d14', skin: '#f6cfa6', band: '#ffffff' },
  { id: 'curtains', name: 'Curtains', rarity: 'common', r: { spd: 64, sht: 62, pas: 68, ctl: 66, def: 58 }, hair: 'curtains', hairColor: '#8a5a2b', skin: '#f2c49b' },
  { id: 'fringe', name: 'Fringe', rarity: 'common', r: { spd: 66, sht: 64, pas: 62, ctl: 70, def: 56 }, hair: 'emo', hairColor: '#1b1b2a', skin: '#f6cfa6' },
  { id: 'tank', name: 'Tank', rarity: 'common', r: { spd: 58, sht: 68, pas: 58, ctl: 56, def: 76 }, hair: 'flattop', hairColor: '#2b1d14', skin: '#a8693f' },
  { id: 'sparky', name: 'Sparky', rarity: 'common', r: { spd: 68, sht: 66, pas: 58, ctl: 64, def: 60 }, hair: 'mohawk', hairColor: '#46d9ff', skin: '#e9b489' },
  { id: 'winger', name: 'Winger', rarity: 'rare', r: { spd: 80, sht: 66, pas: 68, ctl: 74, def: 58 }, hair: 'ponytail', hairColor: '#4a2e1c', skin: '#c98b5e' },
  { id: 'maestro', name: 'Maestro', rarity: 'rare', r: { spd: 68, sht: 72, pas: 82, ctl: 78, def: 64 }, hair: 'curtains', hairColor: '#d8dce6', skin: '#f2c49b' },
  { id: 'volley', name: 'Volley', rarity: 'rare', r: { spd: 74, sht: 80, pas: 66, ctl: 70, def: 62 }, hair: 'spikes', hairColor: '#ff3a3f', skin: '#f6cfa6' },
  { id: 'anchor', name: 'Anchor', rarity: 'rare', r: { spd: 66, sht: 70, pas: 72, ctl: 68, def: 84 }, hair: 'beanie', hairColor: '#2b1d14', skin: '#7a4a2a', cap: '#1b3a8a' },
  { id: 'shuffle', name: 'Shuffle', rarity: 'rare', r: { spd: 78, sht: 68, pas: 72, ctl: 80, def: 62 }, hair: 'braids', hairColor: '#f2c230', skin: '#e9b489', band: '#ff3a8a' },
  { id: 'cannon', name: 'Cannon', rarity: 'rare', r: { spd: 70, sht: 84, pas: 66, ctl: 70, def: 70 }, hair: 'bandana', hairColor: '#1b1b2a', skin: '#a8693f', band: '#1b1b2a' },
  { id: 'silk', name: 'Silk', rarity: 'rare', r: { spd: 76, sht: 70, pas: 78, ctl: 82, def: 62 }, hair: 'emo', hairColor: '#a35cff', skin: '#f2c49b' },
  { id: 'wall', name: 'The Wall', rarity: 'rare', r: { spd: 64, sht: 68, pas: 70, ctl: 68, def: 88 }, hair: 'fade', hairColor: '#4a4f60', skin: '#c98b5e' },
  { id: 'jester', name: 'Jester', rarity: 'rare', r: { spd: 76, sht: 74, pas: 76, ctl: 78, def: 66 }, hair: 'topknot', hairColor: '#ff3a8a', skin: '#f6cfa6', band: '#ffe14d' },
  { id: 'comet', name: 'Comet', rarity: 'rare', r: { spd: 84, sht: 72, pas: 70, ctl: 76, def: 64 }, hair: 'shaggy', hairColor: '#f4f5f7', skin: '#e9b489' },
  { id: 'tempo', name: 'Tempo', rarity: 'rare', r: { spd: 74, sht: 76, pas: 80, ctl: 76, def: 70 }, hair: 'headband', hairColor: '#2b1d14', skin: '#7a4a2a', band: '#46d9ff' },
  { id: 'vault', name: 'Vault', rarity: 'rare', r: { spd: 72, sht: 78, pas: 74, ctl: 72, def: 80 }, hair: 'goggles', hairColor: '#7a3ad8', skin: '#f2c49b' },
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
  // ---- the crate shelf: these only come out of crates
  { id: 'blaze',    name: 'Blaze',    rarity: 'rare',      r: { spd: 84, sht: 80, pas: 74, ctl: 78, def: 68 }, hair: 'spikes',    hairColor: '#ff6a1a', skin: '#e9b489' },
  { id: 'frostboy', name: 'Frost',    rarity: 'rare',      r: { spd: 80, sht: 76, pas: 82, ctl: 80, def: 72 }, hair: 'spikes',    hairColor: '#9fe8ff', skin: '#f6cfa6' },
  { id: 'stormer',  name: 'Storm',    rarity: 'rare',      r: { spd: 78, sht: 82, pas: 76, ctl: 76, def: 80 }, hair: 'messy',     hairColor: '#8d93b8', skin: '#c98b5e' },
  { id: 'acecard',  name: 'Ace',      rarity: 'rare',      r: { spd: 82, sht: 78, pas: 80, ctl: 82, def: 70 }, hair: 'fade',      hairColor: '#2b1d14', skin: '#a8693f' },
  { id: 'rocketman',name: 'Rocket',   rarity: 'rare',      r: { spd: 88, sht: 76, pas: 72, ctl: 78, def: 66 }, hair: 'buzz',      hairColor: '#f2c230', skin: '#f2c49b' },
  { id: 'echo',     name: 'Echo',     rarity: 'epic',      r: { spd: 86, sht: 84, pas: 88, ctl: 86, def: 74 }, hair: 'curtains',  hairColor: '#6b3f22', skin: '#f6cfa6' },
  { id: 'novastar', name: 'Nova',     rarity: 'epic',      r: { spd: 90, sht: 86, pas: 82, ctl: 88, def: 72 }, hair: 'ponytail',  hairColor: '#f4f5f7', skin: '#e9b489' },
  { id: 'venomous', name: 'Venom',    rarity: 'epic',      r: { spd: 88, sht: 90, pas: 80, ctl: 84, def: 78 }, hair: 'mohawk',    hairColor: '#7dff3a', skin: '#7a4a2a' },
  { id: 'shade',    name: 'Shade',    rarity: 'epic',      r: { spd: 90, sht: 82, pas: 86, ctl: 90, def: 76 }, hair: 'emo',       hairColor: '#1b1b2a', skin: '#f2c49b' },
  { id: 'boltz',    name: 'Bolt',     rarity: 'epic',      r: { spd: 94, sht: 80, pas: 78, ctl: 86, def: 70 }, hair: 'spikes',    hairColor: '#ffe14d', skin: '#c98b5e' },
  { id: 'tide',     name: 'Tide',     rarity: 'epic',      r: { spd: 84, sht: 86, pas: 92, ctl: 88, def: 80 }, hair: 'shaggy',    hairColor: '#46d9ff', skin: '#f6cfa6' },
  { id: 'emberking',name: 'Ember',    rarity: 'epic',      r: { spd: 86, sht: 92, pas: 80, ctl: 86, def: 76 }, hair: 'braids',    hairColor: '#c2300a', skin: '#a8693f' },
  { id: 'bastion',  name: 'Bastion',  rarity: 'legendary', r: { spd: 86, sht: 90, pas: 90, ctl: 90, def: 96 }, hair: 'knight',    hairColor: '#c9d2de', skin: '#e9b489' },
  { id: 'corsair',  name: 'Corsair',  rarity: 'legendary', r: { spd: 92, sht: 92, pas: 88, ctl: 92, def: 82 }, hair: 'pirate',    hairColor: '#2b1d14', skin: '#c98b5e' },
  { id: 'ronin',    name: 'Ronin',    rarity: 'legendary', r: { spd: 94, sht: 90, pas: 90, ctl: 94, def: 84 }, hair: 'samurai',   hairColor: '#1b1b2a', skin: '#f2c49b' },
  { id: 'sphinx',   name: 'Sphinx',   rarity: 'legendary', r: { spd: 90, sht: 94, pas: 92, ctl: 92, def: 88 }, hair: 'pharaoh',   hairColor: '#ffc21a', skin: '#a8693f' },
  { id: 'tundra',   name: 'Tundra',   rarity: 'legendary', r: { spd: 92, sht: 92, pas: 94, ctl: 92, def: 90 }, hair: 'ice',       hairColor: '#dff6ff', skin: '#f6cfa6' },
  { id: 'magmaman', name: 'Magma',    rarity: 'legendary', r: { spd: 94, sht: 96, pas: 88, ctl: 92, def: 84 }, hair: 'flame',     hairColor: '#ff5a1a', skin: '#7a4a2a' },
  { id: 'oracle',   name: 'Oracle',   rarity: 'legendary', r: { spd: 90, sht: 92, pas: 97, ctl: 95, def: 86 }, hair: 'wizard',    hairColor: '#d8c8ff', skin: '#f2c49b' },
  { id: 'cometkid', name: 'Comet',    rarity: 'legendary', r: { spd: 97, sht: 90, pas: 90, ctl: 94, def: 82 }, hair: 'astronaut', hairColor: '#f4f5f7', skin: '#e9b489' },
  { id: 'seraph',   name: 'Seraph',   rarity: 'mythic',    r: { spd: 96, sht: 97, pas: 98, ctl: 97, def: 92 }, hair: 'crown',     hairColor: '#fff3a0', skin: '#f7dcc6' },
  { id: 'onyx',     name: 'Onyx',     rarity: 'mythic',    r: { spd: 97, sht: 98, pas: 95, ctl: 98, def: 94 }, hair: 'dreads',    hairColor: '#16171d', skin: '#6b4228' },
  { id: 'zenith',   name: 'Zenith',   rarity: 'mythic',    r: { spd: 98, sht: 97, pas: 97, ctl: 99, def: 93 }, hair: 'anime',     hairColor: '#c8d8ff', skin: '#f6cfa6', anime: true },
  { id: 'eclipse',  name: 'Eclipse',  rarity: 'mythic',    r: { spd: 98, sht: 99, pas: 96, ctl: 98, def: 95 }, hair: 'galaxy',    hairColor: '#b04dff', skin: '#c98b5e' },
  { id: 'legendx',  name: 'The Legend', rarity: 'mythic',  r: { spd: 99, sht: 99, pas: 99, ctl: 99, def: 97 }, hair: 'goat',      hairColor: '#ffc21a', skin: '#e9b489' },
  // Jacob: LILOTTER and irizarrygamez1 only. The card shows his own six stats; the three that
  // mean anything on the pitch (pace, ball control, crossing) are what he actually plays at.
  { id: 'jacob', name: 'Jacob', rarity: 'oneofone', only: ['lilotter', 'irizarrygamez1'], thin: 0.55, ovr: 98,
    stats: [[tl('SKINNY'), 99], [tl('PACE'), 21], [tl('BALL CONTROL'), 67], [tl('YAP'), 200], [tl('EXCUSES'), 200], [tl('CROSSING'), 0]],
    r: { spd: 98, sht: 98, pas: 96, ctl: 99, def: 92 }, hair: 'anime', hairColor: '#3aa0ff', skin: '#f6cfa6', anime: true, mewing: true },
  // LILOTTER's own one-of-one. The card says 200; the attributes below are the ceiling the game
  // has (ratingAttr caps at 99, so 200 there would play exactly the same and only break the maths).
  { id: 'flow', name: 'Flow', rarity: 'oneofone', only: ['lilotter'], thin: 0.82, ovr: 200,
    stats: [[tl('PACE'), 188], [tl('SHOOTING'), 200], [tl('FIRST TOUCH'), 200], [tl('BALL CONTROL'), 200], [tl('PASSING'), 176], [tl('DEFENDING'), 142]],
    r: { spd: 99, sht: 99, pas: 99, ctl: 99, def: 99 }, hair: 'anime', hairColor: '#e9e9f2', skin: '#f7dcc6', anime: true },
  // Matt: MattHidalgoCR7 only. The card shows the five numbers he was given; the game has one touch
  // stat, so his 99 dribbling is what ctl plays at (the 69 ball control is on the card). Passing 0 is
  // real: ratingAttr floors it at a pass 10% weaker than an average player's. Overall is set, not worked out.
  { id: 'matt', name: 'Matt', rarity: 'oneofone', only: ['matthidalgocr7'], buff: 1, ovr: 99,
    stats: [[tl('PACE'), 99], [tl('DRIBBLING'), 99], [tl('SHOOTING'), 99], [tl('BALL CONTROL'), 69], [tl('PASSING'), 0]],
    r: { spd: 99, sht: 99, pas: 0, ctl: 99, def: 70 }, hair: 'buzz', hairColor: '#15161c', skin: '#c98b5e' },
];
// Accessories: one slot, worn over any character. slot says where it's drawn on the body.
const ACCESSORIES = [
  { id: 'clownnose',   name: tl('Clown Nose'),      slot: 'face', price: 6000 },
  { id: 'wristbands',  name: tl('Sweatbands'),      slot: 'arm',  price: 7000 },
  { id: 'mustache',    name: tl('Mustache'),        slot: 'face', price: 7500 },
  { id: 'shades',      name: tl('Shades'),          slot: 'face', price: 8000 },
  { id: 'partyhat',    name: tl('Party Hat'),       slot: 'head', price: 8500 },
  { id: 'eyepatch',    name: tl('Eye Patch'),       slot: 'face', price: 9000 },
  { id: 'bowtie',      name: tl('Bow Tie'),         slot: 'neck', price: 9500 },
  { id: 'warpaint',    name: tl('War Paint'),       slot: 'face', price: 10000 },
  { id: 'scarf',       name: tl('Scarf'),           slot: 'neck', price: 11000 },
  { id: 'monocle',     name: tl('Monocle'),         slot: 'face', price: 12000 },
  { id: 'armband',     name: tl('Captain Armband'), slot: 'arm',  price: 13000 },
  { id: 'starshades',  name: tl('Star Shades'),     slot: 'face', price: 14000 },
  { id: 'flowercrown', name: tl('Flower Crown'),    slot: 'head', price: 15000 },
  { id: 'heromask',    name: tl('Hero Mask'),       slot: 'face', price: 16000 },
  { id: 'headphones',  name: tl('Headphones'),      slot: 'head', price: 18000 },
  { id: 'propeller',   name: tl('Propeller Cap'),   slot: 'head', price: 20000 },
  { id: 'visor',       name: tl('Cyber Visor'),     slot: 'face', price: 22000 },
  { id: 'chain',       name: tl('Gold Chain'),      slot: 'neck', price: 25000 },
  { id: 'medal',       name: tl('Gold Medal'),      slot: 'neck', price: 30000 },
  { id: 'horns',       name: tl('Devil Horns'),     slot: 'head', price: 35000 },
  { id: 'halo',        name: tl('Halo'),            slot: 'head', price: 40000 },
  { id: 'cape',        name: tl('Hero Cape'),       slot: 'back', price: 45000 },
  { id: 'goldboots',   name: tl('Golden Boots'),    slot: 'feet', price: 50000 },
  { id: 'wings',       name: tl('Angel Wings'),     slot: 'back', price: 60000 },
  { id: 'jetpack',       name: tl('Jetpack'),          slot: 'back', price: 75000 },
  { id: 'royalcrown',    name: tl('Royal Crown'),      slot: 'head', price: 80000 },
  { id: 'diamondshades', name: tl('Diamond Shades'),   slot: 'face', price: 90000 },
  { id: 'lightningvisor',name: tl('Lightning Visor'),  slot: 'face', price: 100000 },
  { id: 'neonhalo',      name: tl('Neon Halo'),        slot: 'head', price: 110000 },
  { id: 'dragonwings',   name: tl('Dragon Wings'),     slot: 'back', price: 125000 },
  { id: 'royalcape',     name: tl('Royal Cape'),       slot: 'back', price: 140000 },
  { id: 'diamondchain',  name: tl('Diamond Chain'),    slot: 'neck', price: 150000 },
  { id: 'worldmedal',    name: tl('World Medal'),      slot: 'neck', price: 160000 },
  { id: 'galaxyboots',   name: tl('Galaxy Boots'),     slot: 'feet', price: 175000 },
  { id: 'flameboots',    name: tl('Flame Boots'),      slot: 'feet', price: 185000 },
  { id: 'robotarm',      name: tl('Robot Arm'),        slot: 'arm',  price: 195000 },
  { id: 'kingmantle',    name: tl("King's Mantle"),   slot: 'back', price: 210000 },
  { id: 'spacehelmet',   name: tl('Space Helmet'),     slot: 'head', price: 225000 },
  { id: 'dragonmask',    name: tl('Dragon Mask'),      slot: 'face', price: 240000 },
  { id: 'championbelt',  name: tl('Champion Belt'),    slot: 'neck', price: 260000 },
  // ---- the crate shelf: these only come out of crates
  { id: 'beret',        name: tl('Beret'),           slot: 'head', rarity: 'rare',      price: 12000 },
  { id: 'bucket',       name: tl('Bucket Hat'),      slot: 'head', rarity: 'rare',      price: 14000 },
  { id: 'cowboyhat',    name: tl('Cowboy Hat'),      slot: 'head', rarity: 'rare',      price: 16000 },
  { id: 'maskbandit',   name: tl('Bandit Mask'),     slot: 'face', rarity: 'rare',      price: 18000 },
  { id: 'swimgoggles',  name: tl('Swim Goggles'),    slot: 'face', rarity: 'rare',      price: 20000 },
  { id: 'wraps',        name: tl('Hand Wraps'),      slot: 'arm',  rarity: 'rare',      price: 22000 },
  { id: 'backpack',     name: tl('Backpack'),        slot: 'back', rarity: 'rare',      price: 24000 },
  { id: 'antlers',      name: tl('Antlers'),         slot: 'head', rarity: 'epic',      price: 34000 },
  { id: 'tophat',       name: tl('Top Hat'),         slot: 'head', rarity: 'epic',      price: 38000 },
  { id: 'scanvisor',    name: tl('Scan Visor'),      slot: 'face', rarity: 'epic',      price: 42000 },
  { id: 'warstripes',   name: tl('War Stripes'),     slot: 'face', rarity: 'epic',      price: 46000 },
  { id: 'beads',        name: tl('Lucky Beads'),     slot: 'neck', rarity: 'epic',      price: 50000 },
  { id: 'powerband',    name: tl('Power Band'),      slot: 'arm',  rarity: 'epic',      price: 56000 },
  { id: 'neonboots',    name: tl('Neon Boots'),      slot: 'feet', rarity: 'epic',      price: 62000 },
  { id: 'firecrown',    name: tl('Crown of Fire'),   slot: 'head', rarity: 'legendary', price: 90000 },
  { id: 'icecrown',     name: tl('Frost Crown'),     slot: 'head', rarity: 'legendary', price: 100000 },
  { id: 'phantommask',  name: tl('Phantom Mask'),    slot: 'face', rarity: 'legendary', price: 115000 },
  { id: 'rubypendant',  name: tl('Ruby Pendant'),    slot: 'neck', rarity: 'legendary', price: 130000 },
  { id: 'gauntlet',     name: tl('Gauntlet'),        slot: 'arm',  rarity: 'legendary', price: 145000 },
  { id: 'icewings',     name: tl('Ice Wings'),       slot: 'back', rarity: 'legendary', price: 165000 },
  { id: 'frostboots',   name: tl('Frost Boots'),     slot: 'feet', rarity: 'legendary', price: 185000 },
  { id: 'stormcloud',   name: tl('Storm Cloud'),     slot: 'head', rarity: 'mythic',    price: 280000 },
  { id: 'voidmask',     name: tl('Void Mask'),       slot: 'face', rarity: 'mythic',    price: 330000 },
  { id: 'cosmicchain',  name: tl('Cosmic Chain'),    slot: 'neck', rarity: 'mythic',    price: 390000 },
  { id: 'phoenixwings', name: tl('Phoenix Wings'),   slot: 'back', rarity: 'mythic',    price: 480000 },
];
const ACCESSORY_IDS = new Set(ACCESSORIES.map((a) => a.id));
const ACCESSORY_FACE_IDS = new Set(ACCESSORIES.filter((a) => a.slot === 'face').map((a) => a.id));

// the four ways an ult shot can be struck, picked at random
const ULT_KINDS = ['volley', 'bicycle', 'backflip', 'scissors'];
const ULT_NAMES = { volley: tl('VOLLEY'), bicycle: tl('BICYCLE KICK'), backflip: tl('BACKFLIP KICK'), scissors: tl('SCISSOR KICK') };
// Every character has a signature finish: the kick they always pull out when their ult goes off.
// A handful are hand-picked, the rest are spread evenly and never change for that character.
const SIGNATURES = {
  goat: 'bicycle', phantom: 'scissors', ninja: 'scissors', goldenboot: 'volley', afroking: 'bicycle',
  mohawk: 'volley', viking: 'volley', robot: 'backflip', titan: 'volley', galaxy: 'backflip',
  inferno: 'bicycle', iceking: 'scissors', astronaut: 'backflip', wizard: 'scissors', lion: 'bicycle',
  shark: 'scissors', pharaoh: 'backflip', knight: 'volley', pirate: 'bicycle', cowboy: 'volley',
  samurai: 'scissors', dreads: 'bicycle', jacob: 'backflip', street: 'volley', striker: 'volley',
  flow: 'volley', matt: 'bicycle',
};
function sigKind(c) {
  if (!c) return ULT_KINDS[0];
  if (SIGNATURES[c.id]) return SIGNATURES[c.id];
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  return ULT_KINDS[h % ULT_KINDS.length];
}
const sigName = (c) => ULT_NAMES[sigKind(c)];
// the online World Cup's rounds (the server keeps which one you're in)
const WC_ROUNDS = [tl('ROUND OF 16'), tl('QUARTER-FINAL'), tl('SEMI-FINAL'), tl('FINAL')];
const WC_PRIZE = 1000;
// RANKED: online results move your rank points. Tiers are pure thresholds so both sides agree.
// A season lasts SEASON_DAYS and pays out by the tier you finished in.
const CUP_ROUNDS = [tl('THE FINAL'), tl('THE SEMI-FINALS'), tl('THE QUARTER-FINALS')]; // named from the end backwards
const CUP_ROUND_NAMES = [tl('FINAL'), tl('SEMI-FINALS'), tl('QUARTER-FINALS')]; // the same, on their own: "FRIEND CUP · FINAL"
const FCUP_PRIZE = 500; // winning a friend cup

// The thresholds are set against what a ranked match pays (about 11 for a win with a challenge
// or two), so the climb takes the same number of matches it always did.
const RANK_TIERS = [
  { id: 'bronze', name: tl('BRONZE'), at: 0, color: '#c87d3a', reward: 200 },
  { id: 'silver', name: tl('SILVER'), at: 60, color: '#c9d2e4', reward: 500 },
  { id: 'gold', name: tl('GOLD'), at: 150, color: '#ffc21a', reward: 1200 },
  { id: 'platinum', name: tl('PLATINUM'), at: 300, color: '#46d9ff', reward: 2500 },
  { id: 'diamond', name: tl('DIAMOND'), at: 500, color: '#b04dff', reward: 5000 },
  { id: 'legend', name: tl('LEGEND'), at: 800, color: '#ff3a6e', reward: 10000 },
];
const SEASON_DAYS = 14;
const SEASON_START = Date.UTC(2026, 8, 21); // seasons have counted from here
const seasonNow = () => Math.max(0, Math.floor((Date.now() - SEASON_START) / (SEASON_DAYS * 86400000)));
const seasonEndsAt = (n) => SEASON_START + (n + 1) * SEASON_DAYS * 86400000;
function rankTier(rp) {
  let t = RANK_TIERS[0];
  for (const x of RANK_TIERS) if ((rp || 0) >= x.at) t = x;
  return t;
}
function rankNext(rp) {
  const i = RANK_TIERS.indexOf(rankTier(rp));
  return i + 1 < RANK_TIERS.length ? RANK_TIERS[i + 1] : null;
}
// What a ranked match is worth: a win 10 plus a point for every challenge you finished in it,
// a draw 5, and a loss costs 5 (walking out of one counts as a loss). Points never go below
// zero. The challenges only pay when you win. Nothing else in the game moves your rank.
const RANK_CHALLENGE = 1;
const RANK_LOSS = 5;
function rankDelta(outcome, challenges = 0) {
  if (outcome === 'win') return 10 + Math.max(0, challenges | 0) * RANK_CHALLENGE;
  if (outcome === 'draw') return 5;
  return outcome === 'loss' ? -RANK_LOSS : 0;
}
// quick chat: the only things anyone can say in a match (no typing, so nothing nasty gets through)
const QUICK_CHAT = ['HI!', 'NICE ONE!', 'PASS!', 'SHOOT!', 'DEFEND!', 'WHAT A GOAL!', 'THANKS!', 'SORRY!', 'UNLUCKY', 'WOW!', "LET'S GO!", 'GG'];
const ordinal = (n) => {
  const lang = typeof I18N !== 'undefined' ? I18N.lang : 'en';
  if (lang === 'es' || lang === 'pt') return n + '.º';
  if (lang === 'it') return n + 'º';
  if (lang === 'de') return n + '.';
  if (lang === 'fr') return n + (n === 1 ? 'er' : 'e');
  if (lang === 'tr' || lang === 'pl') return n + '.';
  // these say the word for "place" around it in their lines: plaats 3, plats 3, peringkat 3, locul 3
  if (lang === 'nl' || lang === 'sv' || lang === 'id' || lang === 'ro') return String(n);
  return n + (['th', 'st', 'nd', 'rd'][n % 10 > 3 || (n % 100 > 10 && n % 100 < 14) ? 0 : n % 10]);
};
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
  // a character tied to an account is never handed to a bot
  const weight = (c) => (c.only ? 0 : (share[c.rarity] || 0) / count[c.rarity]);
  let roll = rand() * CHARACTERS.reduce((sum, c) => sum + weight(c), 0);
  for (const c of CHARACTERS) { roll -= weight(c); if (roll <= 0) return c; }
  return CHARACTERS[0];
}

const overall = (r) => Math.round((r.spd + r.sht + r.pas + r.ctl + r.def) / 5);
// characters can be locked to certain accounts, and can show their own stat lines
const charOk = (c) => !c.only || (typeof Save !== 'undefined' && c.only.includes(String(Save.account || '').toLowerCase()));
const charStats = (c) => c.stats || [[tl('SPD'), c.r.spd], [tl('SHT'), c.r.sht], [tl('PAS'), c.r.pas], [tl('CTL'), c.r.ctl], [tl('DEF'), c.r.def]];
const charOvr = (c) => (c.ovr !== undefined ? c.ovr : overall(c.r));
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
  // 2026-09-27 "make bots better 2x for normal matches": the same again at x2 — they lunge twice
  // as often, dodge twice as much, skill twice as much, decide twice as fast, shoot half as wide
  // 2026-10-17 "the bots are too good, make them 2x worse": measured at 3.9-4.7 against a
  // scripted average player, so the opposition were winning. The 2x is undone and then some —
  // every knob halved (or doubled where lower is better) and the speed gap opened back up.
  // Only the opposition: your teammates run on MATE_BASE and keep what they had, because
  // making them worse too would leave the game exactly as hard as it was.
  // and make half the mistakes, with the speed gap halved. The caps are the level ramp's own
  // (dodge 0.8, skill 0.6, react 0.5, noise 14) so a high level cannot push it past playable,
  // and a lunge chance over 0.8 per check just gets you dribbled round.
  easy:   { redSpeed: 0.912, slideOnHuman: 1, aiSlide: 0.2,  aiDodge: 0.21, aiSkill: 0.16, keeperBonus: -0.05,  aiShotNoise: 52, react: 1.16, mistakes: 1.36 },
  normal: { redSpeed: 0.94,  slideOnHuman: 1, aiSlide: 0.27, aiDodge: 0.375, aiSkill: 0.26, keeperBonus: 0.05,  aiShotNoise: 40, react: 1.0,  mistakes: 1.04 },
  hard:   { redSpeed: 1.0,   slideOnHuman: 1, aiSlide: 0.4,  aiDodge: 0.4,  aiSkill: 0.3,  keeperBonus: 0.13,   aiShotNoise: 28, react: 1.0,  mistakes: 0.75 },
};
// online fill-ins (2026-09-19 "bots that are actually good"): quicker, sharper and cleaner than hard,
// on both sides of an online match. Your level and the World Cup round still add to this.
// 2026-10-18: halved too, the same as the offline presets. These are the players who fill an
// online match when there are not enough people, so they are meant to pass for one — and a
// weaker bot is an easier bot to spot. Asked for anyway, and the offline ones were measured at
// 3.9-4.7 against an average player, so these were almost certainly too good as well.
const ONLINE_BOTS = { redSpeed: 0.96, slideOnHuman: 0.95, aiSlide: 0.18, aiDodge: 0.3, aiSkill: 0.2, keeperBonus: 0.07, aiShotNoise: 48, react: 1.4, mistakes: 1.2 };
// your bot teammates offline: what "normal" was before the bots were made worse, so the
// players on your side did not get worse too
const MATE_BASE = { redSpeed: 0.984, slideOnHuman: 0.95, aiSlide: 0.34, aiDodge: 0.48, aiSkill: 0.33, keeperBonus: 0.1, aiShotNoise: 30, react: 0.77, mistakes: 0.75 };

// coin counts for display: 999999 stays exact, then 1.25M, 1B
function fmtCoins(n) {
  n = Math.floor(Number(n) || 0);
  // Below a million, group the digits: 125,000 reads at a glance where 125000 has to be counted.
  // Above it the short form is already clearer than any amount of grouping — 2.5M beats
  // 2,500,000 — which is what it is for.
  if (n < 1e6) return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const [v, unit] = n >= 1e9 ? [n / 1e9, 'B'] : [n / 1e6, 'M'];
  return (v >= 100 ? Math.floor(v) : Math.floor(v * 100) / 100) + unit;
}

// YOUR level makes every match harder: level 1 plays as before, level 50+ is the full ramp.
// Ranks are just a name for where you are on it.
const LEVEL_RAMP_TOP = 50;
const RANKS = [[1, tl('ROOKIE')], [6, tl('PRO')], [12, tl('STAR')], [20, tl('ELITE')], [30, tl('WORLD CLASS')], [40, tl('LEGEND')], [50, tl('GOAT')]];
const rankFor = (level) => { let n = RANKS[0][1]; for (const [lv, name] of RANKS) if (level >= lv) n = name; return n; };
const levelRampPct = (level) => Math.round(clamp((level - 1) / (LEVEL_RAMP_TOP - 1), 0, 1) * 100);
// The bigger the format, the more room an attacker gets and the less each bot can cover, so the
// opposition is sharpened to match. 1v1 stays exactly as it was; 4v4 was the runaway one.
const FORMAT_RAMP = { '4v4': 1, '3v3': 0.8, '2v2': 0.45, '1v1': 0, training: 0 };
// How much of the preset a format keeps. 2026-09-27: doubling the bots made 4v4 a proper contest
// but 1v1 brutal — one bot, on you the whole match, with nobody on your side to take the weight.
// The ramp above only ever pushed the big formats up, so this takes some back off the small ones.
const FORMAT_EASE = { '4v4': 1, '3v3': 0.95, '2v2': 0.85, '1v1': 0.45, training: 0.45 };
function formatRamp(b, format) {
  const u = FORMAT_RAMP[format] || 0;
  let r = b;
  if (u > 0) {
    r = {
      ...b,
      redSpeed: b.redSpeed + u * 0.05,
      aiSlide: b.aiSlide * (1 + u * 0.8),
      aiDodge: Math.min(0.85, b.aiDodge * (1 + u * 0.5)),
      aiSkill: Math.min(0.6, b.aiSkill * (1 + u * 0.5)),
      aiShotNoise: Math.max(14, b.aiShotNoise * (1 - u * 0.3)),
      react: Math.max(0.45, b.react * (1 - u * 0.3)),
      mistakes: Math.max(0.35, b.mistakes * (1 - u * 0.35)),
    };
  }
  const e = FORMAT_EASE[format] === undefined ? 1 : FORMAT_EASE[format];
  if (e >= 1) return r;
  return {
    ...r,
    redSpeed: 1 - (1 - r.redSpeed) / e,   // the speed gap to you opens back up
    // slideOnHuman is left alone on purpose: it is what stops you strolling the ball into the
    // net, and easing it took 1v1 walk-ins from 1% to 12%.
    aiSlide: r.aiSlide * e,
    aiDodge: r.aiDodge * e,
    aiSkill: r.aiSkill * e,
    keeperBonus: r.keeperBonus * e,
    aiShotNoise: r.aiShotNoise / e,
    react: r.react / e,
    mistakes: r.mistakes / e,
  };
}

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
  { id: 'electric', name: tl('Electric'), a: '#46d9ff', b: '#ffffff' },
  { id: 'fire',     name: tl('Fire'),     a: '#ff7a1a', b: '#ffe14d' },
  { id: 'plasma',   name: tl('Plasma Spin'), a: '#b04dff', b: '#f3d2ff' },
  { id: 'blast',    name: tl('White Blast'), a: '#ffffff', b: '#bff3ff' },
  { id: 'frost',    name: tl('Frostbite'), a: '#8fe3ff', b: '#ffffff' },
  { id: 'toxic',    name: tl('Toxic'),     a: '#7dff3a', b: '#e8ffc2' },
  { id: 'shadow',   name: tl('Shadow'),    a: '#7b3bff', b: '#1b1033' },
  { id: 'rainbow',  name: tl('Rainbow'),   a: '#ff5fa8', b: '#ffe14d' },
  { id: 'golden',   name: tl('Golden'),    a: '#ffc21a', b: '#fff3a0' },
  // ---- the crate shelf. bands = [colour, width] from the outside in, spark = what spins off it
  { id: 'sunrise', name: tl('Sunrise'), rarity: 'rare', a: '#ff9a3c', b: '#ffe9a8', bands: [['#ff6a1a', 2.3], ['#ffb03a', 1.4], ['#fff3a0', 0.6]] },
  { id: 'mintfizz', name: tl('Mint Fizz'), rarity: 'rare', a: '#4fe0b0', b: '#eafff7', bands: [['#1f8f6a', 2.2], ['#4fe0b0', 1.2]], spark: 'bubble', sparkA: '#eafff7', sparkB: '#9ff5da' },
  { id: 'bubblegum', name: tl('Bubblegum'), rarity: 'rare', a: '#ff5fa8', b: '#ffd9ec', bands: [['#e03a84', 2.3], ['#ff8ec4', 1.3], ['#ffd9ec', 0.6]], spark: 'bubble', sparkA: '#ffd9ec', sparkB: '#ff8ec4' },
  { id: 'inkwell', name: tl('Inkwell'), rarity: 'rare', a: '#3b4060', b: '#aab0d0', bands: [['#15182a', 2.5], ['#3b4060', 1.4], ['#8d93b8', 0.5]] },
  { id: 'cherry', name: tl('Cherry Blossom'), rarity: 'rare', a: '#ff9ac4', b: '#ffffff', bands: [['#d85a8a', 2.0], ['#ffc8dd', 1.2]], spark: 'petal', sparkA: '#ffd9e8', sparkB: '#ff9ac4' },
  { id: 'lagoon', name: tl('Lagoon'), rarity: 'epic', a: '#2fd0e0', b: '#dffcff', bands: [['#0d7b8f', 2.4], ['#2fd0e0', 1.4], ['#dffcff', 0.6]], spark: 'bubble', sparkA: '#dffcff', sparkB: '#7fe8f5' },
  { id: 'sandstorm', name: tl('Sandstorm'), rarity: 'epic', a: '#d8a95a', b: '#f6e3bd', bands: [['#8a6a2a', 2.5], ['#d8a95a', 1.5], ['#f6e3bd', 0.7]], spark: 'dust', sparkA: '#f6e3bd', sparkB: '#d8a95a' },
  { id: 'bloodmoon', name: tl('Blood Moon'), rarity: 'epic', a: '#c2143c', b: '#ff8a6a', bands: [['#5a0a1a', 2.6], ['#c2143c', 1.5], ['#ff8a6a', 0.6]], spark: 'ring', sparkA: '#ff8a6a', sparkB: '#c2143c' },
  { id: 'circuit', name: tl('Circuit'), rarity: 'epic', a: '#39ff88', b: '#0d1b2a', bands: [['#0d1b2a', 2.4], ['#1f8f5a', 1.4], ['#39ff88', 0.6]], spark: 'cube', sparkA: '#39ff88', sparkB: '#aaffcf' },
  { id: 'starlight', name: tl('Starlight'), rarity: 'epic', a: '#bfe9ff', b: '#ffffff', bands: [['#4a7fd8', 2.2], ['#bfe9ff', 1.2], ['#ffffff', 0.5]], spark: 'star', sparkA: '#ffffff', sparkB: '#bfe9ff' },
  { id: 'aurora', name: tl('Aurora'), rarity: 'epic', a: '#5fffc4', b: '#b04dff', bands: [['#2a7fd8', 2.6], ['#5fffc4', 1.7], ['#b04dff', 0.9], ['#ffffff', 0.4]], spark: 'star', sparkA: '#eaffff', sparkB: '#b04dff' },
  { id: 'honey', name: tl('Honeycomb'), rarity: 'epic', a: '#ffb400', b: '#fff0b8', bands: [['#a86f00', 2.3], ['#ffb400', 1.4], ['#fff0b8', 0.6]], spark: 'cube', sparkA: '#ffd166', sparkB: '#fff0b8' },
  { id: 'nightfall', name: tl('Nightfall'), rarity: 'legendary', a: '#6a2ad8', b: '#1b1033', bands: [['#0d0820', 2.8], ['#4b1f9a', 1.7], ['#8a3fd8', 0.8]], spark: 'star', sparkA: '#d8c8ff', sparkB: '#8a3fd8' },
  { id: 'firework', name: tl('Firework'), rarity: 'legendary', a: '#ff3a6e', b: '#ffe14d', bands: [['#ff3a6e', 2.4], ['#ffe14d', 1.5], ['#46d9ff', 0.8], ['#ffffff', 0.4]], spark: 'burstspark', sparkA: '#ffffff', sparkB: '#ffe14d' },
  { id: 'tsunami', name: tl('Tsunami'), rarity: 'legendary', a: '#1e6fd8', b: '#dff6ff', bands: [['#0a3a7a', 2.7], ['#1e6fd8', 1.7], ['#7fc8ff', 0.9], ['#ffffff', 0.4]], spark: 'bubble', sparkA: '#ffffff', sparkB: '#7fc8ff' },
  { id: 'magmatrail', name: tl('Magma'), rarity: 'legendary', a: '#ff5a1a', b: '#2b1a1a', bands: [['#2b1a1a', 2.7], ['#c2300a', 1.8], ['#ff7a1a', 1.0], ['#ffd166', 0.4]], spark: 'ember', sparkA: '#ff7a1a', sparkB: '#ffd166' },
  { id: 'spectre', name: tl('Spectre'), rarity: 'legendary', a: '#b9bfe8', b: '#3b4060', bands: [['#2a2d45', 2.6], ['#6a71a0', 1.6], ['#d8dcff', 0.7]], spark: 'ghost', sparkA: '#d8dcff', sparkB: '#8d93b8' },
  { id: 'jetstream', name: tl('Jetstream'), rarity: 'legendary', a: '#ffffff', b: '#46d9ff', bands: [['#1f8fd8', 2.5], ['#7fe0ff', 1.5], ['#ffffff', 0.7]], spark: 'bolt', sparkA: '#ffffff', sparkB: '#46d9ff' },
  { id: 'confetti', name: tl('Confetti'), rarity: 'legendary', a: '#ffe14d', b: '#ff5fa8', bands: [['#ffffff', 2.2], ['#ffe14d', 1.2]], spark: 'confetti', sparkA: '#ff5fa8', sparkB: '#46d9ff' },
  { id: 'hologram', name: tl('Hologram'), rarity: 'legendary', a: '#46d9ff', b: '#ff5fa8', bands: [['#46d9ff', 2.5], ['#ff5fa8', 1.6], ['#ffffff', 0.7]], spark: 'cube', sparkA: '#46d9ff', sparkB: '#ff5fa8' },
  { id: 'supernova', name: tl('Supernova'), rarity: 'mythic', a: '#fff3a0', b: '#ff8a1f', bands: [['#ff8a1f', 3.0], ['#ffd166', 2.0], ['#fff3a0', 1.1], ['#ffffff', 0.5]], spark: 'ring', sparkA: '#ffffff', sparkB: '#ffd166' },
  { id: 'blackhole', name: tl('Black Hole'), rarity: 'mythic', a: '#8a3fd8', b: '#07060f', bands: [['#07060f', 3.2], ['#2a1a4a', 2.1], ['#6a2ad8', 1.1], ['#d8c8ff', 0.4]], spark: 'ring', sparkA: '#b04dff', sparkB: '#07060f' },
  { id: 'dragonfire', name: tl('Dragonfire'), rarity: 'mythic', a: '#ff7a1a', b: '#ffc21a', bands: [['#8c1020', 3.0], ['#ff5a1a', 2.0], ['#ffb03a', 1.1], ['#fff3a0', 0.5]], spark: 'ember', sparkA: '#ffc21a', sparkB: '#ff5a1a' },
  { id: 'celestial', name: tl('Celestial'), rarity: 'mythic', a: '#ffffff', b: '#ffd166', bands: [['#2a3f8a', 3.0], ['#7fb3ff', 2.0], ['#ffffff', 1.1], ['#ffd166', 0.5]], spark: 'star', sparkA: '#ffffff', sparkB: '#ffd166' },
  { id: 'infinitytrail', name: tl('Infinity'), rarity: 'mythic', a: '#ff3a6e', b: '#46d9ff', bands: [['#ff3a6e', 3.1], ['#ff8a1f', 2.4], ['#ffe14d', 1.8], ['#3fcf4a', 1.3], ['#46d9ff', 0.8], ['#b04dff', 0.4]], spark: 'star', sparkA: '#ffffff', sparkB: '#ffe14d' },
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
