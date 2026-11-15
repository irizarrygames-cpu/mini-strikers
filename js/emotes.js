// EMOTES (build 120). 157 of them: four everyone starts with and 153 to collect (three more came in
// build 121). They come out of crates, graded like everything else (50 common, 41 rare, 31 epic,
// 21 legendary, 10 mythic), and
// out of the DAILY EMOTE SHOP: three a day, picked for you from the ones you have not got, 1,000
// coins each. A rare one only turns up now and then, which is the point of looking every day.
//
// In a match they live in the quick chat menu (your eight, picked on CUSTOMIZE · EMOTES) and pop
// up in a bubble over your head that everyone in the match sees.
//
// Every emote is put together from parts, all drawn here in the game's flat style: one of eight
// characters (a football, a striker, a keeper, the ref, the coach, a fan, a goat and a golden
// ball), a face, something they hold or wear, an effect and a way of moving. Rarer ones carry
// more: legendary and mythic ones have a burst of rays behind them.

const EMOTE_DECK_MAX = 8;
const EMOTE_PRICE = 1000;
const EMOTE_GRADES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
// the daily shop's odds for each of its three slots, out of 100
const EMOTE_SHOP_ODDS = { common: 52, rare: 28, epic: 13, legendary: 5.5, mythic: 1.5 };

// [id, name, grade, who, face, prop, effect, move, mood]  (mood: what a bot uses it for)
const EMOTE_SPECS = [
  // ---- starters: everyone has these
  ['thumbsup', tl('Thumbs Up'), 'starter', 'kid', 'happy', 'thumb', '', 'bounce', 'joy'],
  ['haha', tl('Ha Ha!'), 'starter', 'footy', 'laugh', '', '', 'shake', 'tease'],
  ['boohoo', tl('Boo Hoo'), 'starter', 'footy', 'cry', '', '', 'wobble', 'sad'],
  ['grr', tl('Grrr!'), 'starter', 'kid', 'angry', '', 'steam', 'shake', 'sad'],
  // ---- common
  ['hello', tl('Hello!'), 'common', 'kid', 'smile', 'wave', '', 'sway', 'hi'],
  ['goodgame', tl('Good Game'), 'common', 'footy', 'happy', 'clap', '', 'bounce', 'gg'],
  ['wow', tl('Wow!'), 'common', 'footy', 'shock', '', '', 'jump', 'joy'],
  ['cheeky', tl('Cheeky'), 'common', 'footy', 'cheeky', '', '', 'wobble', 'tease'],
  ['boring', tl('Boring...'), 'common', 'ref', 'yawn', '', 'zzz', 'sway', 'tease'],
  ['naptime', tl('Nap Time'), 'common', 'footy', 'sleepy', '', 'zzz', 'float', 'tease'],
  ['oops', tl('Oops'), 'common', 'kid', 'nervous', '', 'sweat', 'shake', 'sad'],
  ['shy', tl('Shy'), 'common', 'footy', 'shy', '', '', 'sway', 'hi'],
  ['yes', tl('Yes!'), 'common', 'kid', 'happy', 'fist', '', 'nod', 'joy'],
  ['nope', tl('Nope'), 'common', 'footy', 'blank', '', '', 'no', 'tease'],
  ['hmm', tl('Hmm...'), 'common', 'coach', 'think', 'chin', '', 'tilt', 'cool'],
  ['smirk', tl('Smirk'), 'common', 'kid', 'smug', '', '', 'float', 'tease'],
  ['deadpan', tl('Deadpan'), 'common', 'ref', 'blank', '', '', 'none', 'tease'],
  ['eek', tl('Eek!'), 'common', 'footy', 'scared', '', 'sweat', 'shake', 'sad'],
  ['dizzy', tl('Dizzy'), 'common', 'footy', 'dizzy', '', 'stars', 'wobble', 'sad'],
  ['lol', tl('LOL'), 'common', 'kid', 'lol', '', '', 'shake', 'tease'],
  ['mwah', tl('Mwah'), 'common', 'footy', 'kiss', '', 'hearts', 'pulse', 'joy'],
  ['sus', tl('Sus'), 'common', 'keeper', 'sus', '', '', 'sway', 'tease'],
  ['proud', tl('Proud'), 'common', 'coach', 'proud', '', '', 'bounce', 'joy'],
  ['gutted', tl('Gutted'), 'common', 'keeper', 'sad', '', '', 'droop', 'sad'],
  ['fuming', tl('Fuming'), 'common', 'coach', 'rage', '', 'steam', 'shake', 'sad'],
  ['letsgo', tl("Let's Go!"), 'common', 'fan', 'shout', 'fist', '', 'jump', 'joy'],
  ['clapclap', tl('Clap Clap'), 'common', 'fan', 'happy', 'clap', '', 'bounce', 'gg'],
  ['allgood', tl('All Good'), 'common', 'ref', 'smile', 'thumb', '', 'nod', 'cool'],
  ['peace', tl('Peace'), 'common', 'kid', 'wink', 'peace', '', 'sway', 'hi'],
  ['salute', tl('Salute'), 'common', 'keeper', 'determined', 'salute', '', 'none', 'gg'],
  ['shh', tl('Shhh'), 'common', 'kid', 'smug', 'shh', '', 'none', 'tease'],
  ['you', tl('You!'), 'common', 'coach', 'shout', 'point', '', 'pulse', 'tease'],
  ['facepalm', tl('Facepalm'), 'common', 'coach', 'facepalm', 'facepalm', '', 'nod', 'sad'],
  ['bleh', tl('Bleh'), 'common', 'footy', 'tongue', '', '', 'wobble', 'tease'],
  ['starstruck', tl('Starstruck'), 'common', 'fan', 'star', '', '', 'pulse', 'joy'],
  ['kaching', tl('Ka-Ching'), 'common', 'footy', 'money', '', '', 'bounce', 'joy'],
  ['loveit', tl('Love It'), 'common', 'kid', 'love', '', 'hearts', 'pulse', 'joy'],
  ['huh', tl('Huh?'), 'common', 'ref', 'confused', '', 'q', 'tilt', 'sad'],
  ['whoa', tl('Whoa!'), 'common', 'keeper', 'shock', '', 'bang', 'jump', 'joy'],
  ['comeon', tl('Come On!'), 'common', 'keeper', 'shout', '', '', 'shake', 'sad'],
  ['staycalm', tl('Stay Calm'), 'common', 'coach', 'calm', '', '', 'float', 'cool'],
  ['wink', tl('Wink'), 'common', 'footy', 'wink', '', 'sparkle', 'none', 'cool'],
  ['closeone', tl('Close One'), 'common', 'fan', 'nervous', '', 'sweat', 'wobble', 'joy'],
  ['biggrin', tl('Big Grin'), 'common', 'fan', 'grin', '', '', 'bounce', 'joy'],
  ['pout', tl('Pout'), 'common', 'fan', 'pout', '', '', 'sway', 'sad'],
  ['byebye', tl('Bye Bye'), 'common', 'footy', 'happy', 'wave', '', 'sway', 'gg'],
  ['thumbsdown', tl('Thumbs Down'), 'common', 'ref', 'blank', 'thumbdown', '', 'no', 'tease'],
  ['meh', tl('Meh'), 'common', 'keeper', 'meh', '', '', 'none', 'sad'],
  ['snooze', tl('Zzz'), 'common', 'coach', 'sleepy', '', 'zzz', 'float', 'tease'],
  ['eyeroll', tl('Eye Roll'), 'common', 'kid', 'eyeroll', '', '', 'tilt', 'tease'],
  ['fistbump', tl('Fist Bump'), 'common', 'fan', 'proud', 'fistbump', '', 'none', 'gg'],
  ['crazy', tl('Crazy'), 'common', 'fan', 'crazy', '', '', 'wobble', 'joy'],
  ['gasp', tl('Gasp'), 'common', 'ref', 'shock', '', '', 'jump', 'sad'],
  ['sneaky', tl('Sneaky'), 'common', 'keeper', 'sneaky', '', '', 'sway', 'tease'],
  // ---- rare
  ['yellowcard', tl('Yellow Card'), 'rare', 'ref', 'angry', 'yellowcard', '', 'pulse', 'tease'],
  ['fulltime', tl('Full Time'), 'rare', 'ref', 'blank', 'whistle', 'rings', 'shake', 'gg'],
  ['kickoff', tl('Kick Off'), 'rare', 'ref', 'happy', 'whistle', 'rings', 'bounce', 'hi'],
  ['keepyuppy', tl('Keepy-Uppy'), 'rare', 'kid', 'happy', 'juggle', '', 'none', 'cool'],
  ['header', tl('Header'), 'rare', 'kid', 'determined', 'header', '', 'none', 'joy'],
  ['popcorn', tl('Popcorn'), 'rare', 'fan', 'happy', 'popcorn', '', 'bounce', 'tease'],
  ['scarfup', tl('Scarf Up'), 'rare', 'fan', 'shout', 'scarf', '', 'sway', 'joy'],
  ['drumbeat', tl('Drum Beat'), 'rare', 'fan', 'grin', 'drum', 'notes', 'bounce', 'joy'],
  ['fanhorn', tl('Fan Horn'), 'rare', 'fan', 'blow', 'horn', 'rings', 'shake', 'joy'],
  ['medal', tl('Medal'), 'rare', 'kid', 'proud', 'medal', 'sparkle', 'bounce', 'joy'],
  ['safehands', tl('Safe Hands'), 'rare', 'keeper', 'cool', 'gloves', '', 'pulse', 'cool'],
  ['timewasting', tl('Time Wasting'), 'rare', 'keeper', 'smug', 'stopwatch', '', 'tilt', 'tease'],
  ['waterbreak', tl('Water Break'), 'rare', 'kid', 'tired', 'bottle', 'sweat', 'sway', 'cool'],
  ['halftime', tl('Half-Time'), 'rare', 'coach', 'orange', '', '', 'bounce', 'cool'],
  ['ouch', tl('Ouch'), 'rare', 'kid', 'cry', 'bandage', '', 'wobble', 'sad'],
  ['conehead', tl('Cone Head'), 'rare', 'coach', 'blank', 'cone', '', 'sway', 'tease'],
  ['tactics', tl('Tactics'), 'rare', 'coach', 'think', 'board', '', 'none', 'cool'],
  ['shoutit', tl('Shout It'), 'rare', 'coach', 'shout', 'megaphone', 'rings', 'shake', 'joy'],
  ['cornerflag', tl('Corner Flag'), 'rare', 'kid', 'happy', 'flag', '', 'sway', 'joy'],
  ['captain', tl('Captain'), 'rare', 'kid', 'determined', 'armband', 'sparkle', 'pulse', 'cool'],
  ['newboots', tl('New Boots'), 'rare', 'kid', 'love', 'boot', 'sparkle', 'bounce', 'cool'],
  ['rainyday', tl('Rainy Day'), 'rare', 'keeper', 'sad', 'cloud', 'rain', 'none', 'sad'],
  ['sunnyday', tl('Sunny Day'), 'rare', 'footy', 'cool', 'sun', '', 'float', 'cool'],
  ['snowmatch', tl('Snow Match'), 'rare', 'footy', 'cold', '', 'snow', 'shake', 'sad'],
  ['singalong', tl('Sing Along'), 'rare', 'fan', 'sing', '', 'notes', 'sway', 'joy'],
  ['bubblegum', tl('Bubblegum'), 'rare', 'kid', 'blank', 'gum', '', 'none', 'tease'],
  ['payday', tl('Payday'), 'rare', 'coach', 'money', '', 'coins', 'bounce', 'joy'],
  ['tissue', tl('Need a Tissue'), 'rare', 'footy', 'cry', 'tissue', '', 'wobble', 'sad'],
  ['nutmeg', tl('Nutmeg!'), 'rare', 'kid', 'laugh', 'nutmeg', '', 'bounce', 'tease'],
  ['offside', tl('Offside!'), 'rare', 'ref', 'shout', 'flagup', '', 'shake', 'tease'],
  ['handball', tl('Handball!'), 'rare', 'ref', 'shock', 'handup', 'bang', 'jump', 'tease'],
  ['dive', tl('Dive!'), 'rare', 'kid', 'dizzy', '', 'stars', 'roll', 'tease'],
  ['varcheck', tl('VAR Check'), 'rare', 'ref', 'think', 'var', '', 'tilt', 'tease'],
  ['selfie', tl('Selfie'), 'rare', 'kid', 'wink', 'phone', 'flash', 'none', 'cool'],
  ['smoked', tl('Smoked'), 'rare', 'kid', 'smug', '', 'smoke', 'float', 'tease'],
  ['toofast', tl('Too Fast'), 'rare', 'footy', 'determined', '', 'speed', 'sway', 'cool'],
  ['zapped', tl('Zapped'), 'rare', 'keeper', 'shock', '', 'bolt', 'shake', 'sad'],
  ['backofnet', tl('Back of the Net'), 'rare', 'footy', 'happy', 'net', '', 'bounce', 'joy'],
  ['offthepost', tl('Off the Post'), 'rare', 'footy', 'dizzy', 'post', 'stars', 'none', 'sad'],
  ['chefskiss', tl("Chef's Kiss"), 'rare', 'coach', 'kiss', 'chef', 'sparkle', 'pulse', 'cool'],
  // ---- epic
  ['redcard', tl('Red Card'), 'epic', 'ref', 'rage', 'redcard', 'bang', 'slam', 'tease'],
  ['golazo', tl('Golazo'), 'epic', 'footy', 'star', '', 'confetti', 'jump', 'joy'],
  ['hattrick', tl('Hat-Trick'), 'epic', 'kid', 'proud', 'hattrick', 'sparkle', 'none', 'joy'],
  ['topbins', tl('Top Bins'), 'epic', 'footy', 'cool', 'topcorner', '', 'none', 'joy'],
  ['rainbowflick', tl('Rainbow Flick'), 'epic', 'kid', 'wink', 'rainbowball', '', 'none', 'cool'],
  ['chipshot', tl('Chip Shot'), 'epic', 'kid', 'smug', 'chip', '', 'none', 'tease'],
  ['parkthebus', tl('Park the Bus'), 'epic', 'coach', 'smug', 'bus', '', 'none', 'tease'],
  ['tikitaka', tl('Tiki-Taka'), 'epic', 'footy', 'happy', 'passes', '', 'none', 'cool'],
  ['onfire', tl('On Fire'), 'epic', 'kid', 'determined', '', 'fire', 'shake', 'joy'],
  ['icecold', tl('Ice Cold'), 'epic', 'keeper', 'cool', '', 'frost', 'none', 'cool'],
  ['clutch', tl('Clutch'), 'epic', 'coach', 'determined', 'stopwatch', 'bolt', 'pulse', 'joy'],
  ['penalty', tl('Penalty!'), 'epic', 'ref', 'shout', 'whistle', 'bang', 'jump', 'tease'],
  ['whatasave', tl('What a Save'), 'epic', 'keeper', 'star', 'catch', 'rings', 'slam', 'joy'],
  ['woodwork', tl('Woodwork'), 'epic', 'footy', 'rage', 'post', 'bolt', 'none', 'sad'],
  ['addedtime', tl('Added Time'), 'epic', 'ref', 'blank', 'plusboard', '', 'pulse', 'tease'],
  ['subbedoff', tl('Subbed Off'), 'epic', 'coach', 'sad', 'subboard', '', 'sway', 'sad'],
  ['discoball', tl('Disco Ball'), 'epic', 'footy', 'cool', '', 'disco', 'spin', 'joy'],
  ['bigboss', tl('Big Boss'), 'epic', 'kid', 'smug', 'crown', 'sparkle', 'float', 'cool'],
  ['partymode', tl('Party Mode'), 'epic', 'fan', 'grin', 'headphones', 'notes', 'bounce', 'joy'],
  ['ninja', tl('Ninja Skills'), 'epic', 'kid', 'ninja', '', 'smoke', 'none', 'cool'],
  ['zenmaster', tl('Zen Master'), 'epic', 'coach', 'calm', '', 'aura', 'float', 'cool'],
  ['thunderclap', tl('Thunder Clap'), 'epic', 'keeper', 'shout', 'clap', 'bolt', 'shake', 'joy'],
  ['heartbroken', tl('Heartbroken'), 'epic', 'footy', 'cry', '', 'heartbreak', 'wobble', 'sad'],
  ['mindblown', tl('Mind Blown'), 'epic', 'footy', 'shock', '', 'explode', 'jump', 'joy'],
  ['ghostmode', tl('Ghost Mode'), 'epic', 'footy', 'spooky', '', 'ghost', 'float', 'tease'],
  ['vamos', tl('Vamos!'), 'epic', 'fan', 'shout', 'scarf', 'confetti', 'jump', 'joy'],
  ['badgekiss', tl('Badge Kiss'), 'epic', 'kid', 'kiss', 'badge', 'hearts', 'pulse', 'joy'],
  ['cryinglaughing', tl('Crying Laughing'), 'epic', 'footy', 'lol', '', 'bigtears', 'shake', 'tease'],
  ['tornado', tl('Tornado'), 'epic', 'footy', 'dizzy', '', 'wind', 'spin', 'tease'],
  ['superstar', tl('Superstar'), 'epic', 'fan', 'star', '', 'spotlight', 'pulse', 'joy'],
  // ---- legendary
  ['goldenboot', tl('Golden Boot'), 'legendary', 'kid', 'proud', 'goldboot', 'sparkle', 'float', 'joy'],
  ['champions', tl('Champions'), 'legendary', 'coach', 'happy', 'trophy', 'confetti', 'bounce', 'joy'],
  ['bicyclekick', tl('Bicycle Kick'), 'legendary', 'kid', 'determined', 'bicycle', 'speed', 'flip', 'joy'],
  ['rocketshot', tl('Rocket Shot'), 'legendary', 'footy', 'cool', 'rocket', '', 'shake', 'joy'],
  ['thegoat', tl('The GOAT'), 'legendary', 'goat', 'smug', '', 'sparkle', 'float', 'cool'],
  ['goatlaugh', tl('GOAT Laugh'), 'legendary', 'goat', 'lol', '', '', 'shake', 'tease'],
  ['thunderkeeper', tl('Thunder Keeper'), 'legendary', 'keeper', 'rage', 'gloves', 'bolt', 'shake', 'cool'],
  ['firestriker', tl('Fire Striker'), 'legendary', 'kid', 'rage', '', 'bigfire', 'shake', 'joy'],
  ['frozenout', tl('Frozen Out'), 'legendary', 'keeper', 'shock', 'iceblock', '', 'none', 'sad'],
  ['kingofpitch', tl('King of the Pitch'), 'legendary', 'kid', 'smug', 'crown', 'confetti', 'float', 'cool'],
  ['worldie', tl('Worldie'), 'legendary', 'footy', 'star', '', 'fireworks', 'jump', 'joy'],
  ['lasereyes', tl('Laser Eyes'), 'legendary', 'kid', 'laser', '', '', 'none', 'cool'],
  ['moneyrain', tl('Money Rain'), 'legendary', 'coach', 'money', 'chain', 'coins', 'bounce', 'joy'],
  ['supersub', tl('Super Sub'), 'legendary', 'kid', 'determined', 'cape', 'speed', 'float', 'joy'],
  ['wizardfeet', tl('Wizard Feet'), 'legendary', 'coach', 'wink', 'wizard', 'sparkle', 'float', 'cool'],
  ['lastminute', tl('Last Minute'), 'legendary', 'ref', 'shock', 'stopwatch', 'explode', 'shake', 'joy'],
  ['moonshot', tl('Moon Shot'), 'legendary', 'footy', 'cool', 'moon', 'stars', 'float', 'joy'],
  ['vip', tl('VIP'), 'legendary', 'fan', 'cool', 'chain', 'sparkle', 'sway', 'cool'],
  ['iceking', tl('Ice King'), 'legendary', 'footy', 'cool', 'crown', 'frost', 'float', 'cool'],
  ['goldengloves', tl('Golden Gloves'), 'legendary', 'keeper', 'proud', 'goldgloves', 'sparkle', 'pulse', 'cool'],
  // ---- mythic
  ['goatmode', tl('GOAT Mode'), 'mythic', 'goat', 'cool', 'crown', 'fire', 'float', 'joy'],
  ['galaxyball', tl('Galaxy Ball'), 'mythic', 'footy', 'star', 'planet', 'cosmos', 'float', 'cool'],
  ['phoenix', tl('Phoenix Rising'), 'mythic', 'kid', 'determined', 'wings', 'fire', 'float', 'joy'],
  ['stormbringer', tl('Storm Bringer'), 'mythic', 'keeper', 'rage', 'cloud', 'bigbolt', 'shake', 'cool'],
  ['goldenball', tl('Golden Ball'), 'mythic', 'golden', 'proud', '', 'sparkle', 'float', 'joy'],
  ['worldchamps', tl('World Champions'), 'mythic', 'fan', 'lol', 'trophy', 'fireworks', 'bounce', 'joy'],
  ['dragonshot', tl('Dragon Shot'), 'mythic', 'footy', 'rage', 'firebreath', 'bigfire', 'shake', 'joy'],
  ['timefreeze', tl('Time Freeze'), 'mythic', 'ref', 'blank', 'clock', 'frost', 'none', 'cool'],
  ['livinglegend', tl('Living Legend'), 'mythic', 'coach', 'proud', 'crown', 'confetti', 'float', 'cool'],
  ['cosmickeeper', tl('Cosmic Keeper'), 'mythic', 'keeper', 'star', 'gloves', 'cosmos', 'float', 'cool'],
  // ---- build 121: three for the winter and the autumn
  ['snowday', tl('Snow Day'), 'rare', 'kid', 'happy', 'scarf', 'snow', 'bounce', 'joy'],
  ['autumnbreeze', tl('Autumn Breeze'), 'epic', 'coach', 'calm', '', 'wind', 'sway', 'cool'],
  ['cosygoat', tl('Cosy Goat'), 'legendary', 'goat', 'calm', 'scarf', 'snow', 'float', 'cool'],
];

const EMOTES = EMOTE_SPECS.map(([id, name, rarity, who, face, prop, fx, move, mood]) => ({ id, name, rarity, who, face, prop, fx, move, mood, starter: rarity === 'starter' }));
const EMOTE_BY_ID = new Map(EMOTES.map((e) => [e.id, e]));
const EMOTE_STARTERS = EMOTES.filter((e) => e.starter).map((e) => e.id);

/* ------------------------------------------------------------------ drawing kit
   Everything is drawn in a 100 x 100 box around (0, 0); the head sits at (0, 4) with radius 30. */
const EM_INK = typeof OUTLINE !== 'undefined' ? OUTLINE : '#161a33';
const EM_TAU = Math.PI * 2;
const EM_SKIN = { kid: '#f2c49b', keeper: '#c98b5e', ref: '#f6cfa6', coach: '#e9b489', fan: '#a8693f', goat: '#eef0f5', footy: '#ffffff', golden: '#ffd23f' };
const EM_HANDS = { kid: '#f2c49b', keeper: '#7ee05a', ref: '#f6cfa6', coach: '#e9b489', fan: '#a8693f', goat: '#eef0f5', footy: '#ffffff', golden: '#ffd23f' };
const EM_GOLD = '#ffc21a', EM_GOLD2 = '#ffe14d', EM_RED = '#ff3a3f', EM_BLUE = '#2f7bff', EM_GREEN = '#3fcf4a', EM_PINK = '#ff5fa8', EM_PURPLE = '#a35cff', EM_ORANGE = '#ff8a1f';
const EM_CONFETTI = [EM_RED, EM_GOLD2, EM_BLUE, EM_GREEN, EM_PINK, EM_PURPLE];

const emLine = (g, w = 3.2) => { g.lineWidth = w; g.strokeStyle = EM_INK; };
const emFS = (g, col, w = 3.2) => { g.fillStyle = col; g.fill(); if (w > 0) { emLine(g, w); g.stroke(); } };
const emCirc = (g, x, y, r, col, w) => { g.beginPath(); g.arc(x, y, r, 0, EM_TAU); emFS(g, col, w); };
const emEll = (g, x, y, rx, ry, rot, col, w) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, EM_TAU); emFS(g, col, w); };
function emRR(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const emBox = (g, x, y, w, h, r, col, lw) => { emRR(g, x, y, w, h, r); emFS(g, col, lw); };
function emPoly(g, pts, col, lw) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) (i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]));
  g.closePath(); emFS(g, col, lw);
}
function emStar(g, x, y, r, col, lw = 2.4, rot = -Math.PI / 2, n = 5, inner = 0.46) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); emFS(g, col, lw);
}
// a four-pointed twinkle
function emSpark(g, x, y, r, col = '#ffffff', lw = 1.8) {
  if (r <= 0.3) return;
  g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.closePath();
  emFS(g, col, lw);
}
function emHeart(g, x, y, r, col = EM_RED, lw = 2.4) {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.25, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  g.closePath(); emFS(g, col, lw);
}
function emDrop(g, x, y, r, col = '#7fd6ff', lw = 2) {
  g.beginPath();
  g.moveTo(x, y - r * 1.7);
  g.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x + r, y + r * 0.2);
  g.arc(x, y + r * 0.2, r, 0, Math.PI);
  g.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.7);
  g.closePath(); emFS(g, col, lw);
}
function emFlame(g, x, y, w, h, col, lw = 2.4) {
  g.beginPath();
  g.moveTo(x, y - h);
  g.quadraticCurveTo(x + w * 0.9, y - h * 0.35, x + w * 0.55, y);
  g.quadraticCurveTo(x, y + w * 0.5, x - w * 0.55, y);
  g.quadraticCurveTo(x - w * 0.9, y - h * 0.35, x, y - h);
  g.closePath(); emFS(g, col, lw);
}
function emBolt(g, x, y, s, rot = 0, col = EM_GOLD2) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s / 10, s / 10);
  emPoly(g, [[2, -12], [-5, 1], [0, 1], [-3, 12], [6, -2], [1, -2], [4, -12]], col, 2.2 * 10 / s);
  g.restore();
}
// a cloud: outline every bump thick, then fill them all, so no lines show inside
function emCloud(g, x, y, s, col = '#ffffff', lw = 3) {
  const bumps = [[-14, 2, 9], [-4, -5, 11], [9, -2, 9], [16, 4, 7], [0, 5, 9]];
  g.fillStyle = col; emLine(g, lw * 2);
  for (const [bx, by, r] of bumps) { g.beginPath(); g.arc(x + bx * s, y + by * s, r * s, 0, EM_TAU); g.stroke(); }
  for (const [bx, by, r] of bumps) { g.beginPath(); g.arc(x + bx * s, y + by * s, r * s, 0, EM_TAU); g.fill(); }
}
// a little football
function emBall(g, x, y, r, rot = 0, col = '#ffffff', patch = '#2b2f4a') {
  emCirc(g, x, y, r, col, Math.max(1.6, r * 0.24));
  g.save(); g.beginPath(); g.arc(x, y, r - 0.6, 0, EM_TAU); g.clip();
  g.fillStyle = patch;
  const pent = (cx, cy, pr, a0) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = a0 + (i * EM_TAU) / 5; g.lineTo(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr); } g.closePath(); g.fill(); };
  pent(x, y, r * 0.36, rot - Math.PI / 2);
  for (let i = 0; i < 5; i++) { const a = rot - Math.PI / 2 + (i * EM_TAU) / 5; pent(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98, r * 0.32, a + Math.PI / 2); }
  g.restore();
  emLine(g, Math.max(1.6, r * 0.24)); g.beginPath(); g.arc(x, y, r, 0, EM_TAU); g.stroke();
}
function emText(g, s, x, y, size, col, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `400 ${size}px "Lilita One", system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; emLine(g, size * 0.26); g.strokeText(s, 0, 0);
  g.fillStyle = col; g.fillText(s, 0, 0);
  g.restore();
}
const emCycle = (t, p) => ((t % p) + p) % p / p;   // 0..1 through a loop of p seconds
const emBounce = (t, speed = 1) => Math.abs(Math.sin(t * Math.PI * speed));

/* ------------------------------------------------------------------ hands */
// kind: fist, thumb, open, point, peace. Drawn upright at (x, y); rot turns it.
function emHand(g, x, y, kind, col, rot = 0, s = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const lw = 2.8;
  const finger = (fx, fy, w, h, a = 0) => { g.save(); g.translate(fx, fy); g.rotate(a); emBox(g, -w / 2, -h, w, h + 3, w / 2, col, lw); g.restore(); };
  if (kind === 'open') {
    finger(-6, -4, 4.6, 12, -0.18); finger(-2, -6, 4.6, 14, -0.06); finger(2.4, -6, 4.6, 14, 0.06); finger(6.4, -4, 4.6, 12, 0.18);
    finger(-8, 3, 4.6, 10, -1.1);
    emBox(g, -8.5, -6, 17, 15, 6, col, lw);
  } else {
    if (kind === 'thumb') finger(-5.5, -4, 6, 11, -0.08);
    if (kind === 'point' || kind === 'peace') finger(kind === 'peace' ? -3 : 0, -5, 5, 15, kind === 'peace' ? -0.22 : 0);
    if (kind === 'peace') finger(3.5, -5, 5, 15, 0.22);
    emBox(g, -8, -6, 16, 14, 6, col, lw);
    emLine(g, 1.8); g.beginPath();
    if (kind === 'fist') { g.moveTo(-3, -6); g.lineTo(-3, -1); g.moveTo(2, -6); g.lineTo(2, -1); }
    else { g.moveTo(-1, 1); g.lineTo(5, 1); }
    g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------------ faces
   [eyes, mouth, brows, extra] */
const EM_FACES = {
  happy: ['happy', 'grin'], grin: ['dot', 'grin', 'up'], tongue: ['dot', 'tongue', 'up'], smile: ['dot', 'smile'], laugh: ['squint', 'laugh'], lol: ['squint', 'laugh', '', 'joy'],
  cry: ['closed', 'wail', 'sad', 'tears'], angry: ['dot', 'teeth', 'angry', 'red'], rage: ['wide', 'shout', 'angry', 'red'],
  shock: ['wide', 'o', 'up'], cool: ['shades', 'smirk'], wink: ['wink', 'tongue'], love: ['heart', 'smile', '', 'blush'],
  dizzy: ['spiral', 'wavy'], sleepy: ['sleep', 'small'], smug: ['half', 'smirk', 'raised'], scared: ['wide', 'wavy', 'up'],
  crazy: ['crazy', 'tongue'], think: ['dot', 'flat', 'raised'], shout: ['dot', 'shout', 'angry'], kiss: ['closed', 'kiss', '', 'blush'],
  star: ['star', 'grin'], money: ['coin', 'grin'], nervous: ['dot', 'teeth', 'sad'], determined: ['half', 'flat', 'angry'],
  yawn: ['closed', 'yawn'], cheeky: ['dot', 'tongue', 'raised'], proud: ['happy', 'smile', 'up', 'blush'], blank: ['dot', 'flat'],
  sus: ['side', 'flat', 'raised'], facepalm: ['closed', 'frown'], shy: ['happy', 'small', '', 'blush'], sad: ['dot', 'frown', 'sad'],
  confused: ['dot', 'wavy', 'raised'], calm: ['closed', 'smile', 'up'], pout: ['dot', 'pout', 'sad'], meh: ['half', 'flat'],
  eyeroll: ['roll', 'flat'], sneaky: ['side', 'smirk', 'angry'], tired: ['half', 'o', 'sad'], orange: ['happy', 'orange'],
  cold: ['wide', 'chatter', 'up', 'blue'], sing: ['closed', 'o', 'up'], blow: ['closed', 'blow', 'up'], ninja: ['half', 'none', 'angry', 'mask'],
  spooky: ['hollow', 'o'], laser: ['laser', 'flat', 'angry'],
};

const Emotes = {
  get(id) { return EMOTE_BY_ID.get(id) || null; },
  all() { return EMOTES; },
  owns(id) { return typeof Shop !== 'undefined' && EMOTE_BY_ID.has(id) ? Shop.owns('emote', id) : false; },

  // ---- your eight, for the match menu: only ones you own, each once, at most eight
  deck() {
    const raw = Save.data && Array.isArray(Save.data.emotes) ? Save.data.emotes : EMOTE_STARTERS;
    const out = [];
    for (const id of raw) if (typeof id === 'string' && EMOTE_BY_ID.has(id) && this.owns(id) && !out.includes(id) && out.length < EMOTE_DECK_MAX) out.push(id);
    return out;
  },
  // tap one on CUSTOMIZE: in, out, or "the menu is full"
  toggle(id) {
    if (!this.owns(id)) return 'locked';
    const deck = this.deck();
    if (deck.includes(id)) { Save.data.emotes = deck.filter((x) => x !== id); Save.write(); return 'off'; }
    if (deck.length >= EMOTE_DECK_MAX) return 'full';
    Save.data.emotes = [...deck, id];
    Save.write();
    return 'on';
  },
  // a new one goes straight into the menu if there is room for it
  got(id) {
    const deck = this.deck();
    if (deck.length < EMOTE_DECK_MAX && !deck.includes(id)) Save.data.emotes = [...deck, id];
  },

  // any emote that says this (joy, sad, hi, gg, tease, cool): what bots use, from every grade
  forMood(mood, rnd = Math.random) {
    const list = EMOTES.filter((e) => e.mood === mood);
    return list.length ? list[Math.floor(rnd() * list.length)].id : null;
  },

  // ---- the daily emote shop
  dayKey(d = new Date()) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  // whose shop it is: the account, or this device for a guest
  seedKey() {
    if (Save.account) return 'acct:' + String(Save.account).toLowerCase();
    if (!Number.isInteger(Save.data.emoteSeed) || Save.data.emoteSeed <= 0) { Save.data.emoteSeed = 1 + Math.floor(Math.random() * 2e9); Save.write(); }
    return 'dev:' + Save.data.emoteSeed;
  },
  // Today's three, made once a day from the ones you have not got and kept in the save, so they
  // stay put when you buy one or a crate gives you one of them.
  shop() {
    const d = Save.data, day = this.dayKey();
    let s = d.emoteShop;
    const ok = s && typeof s === 'object' && s.day === day && Array.isArray(s.picks) && Array.isArray(s.bought);
    if (!ok) {
      const rng = mulberry32(this.hash(day + '|' + this.seedKey()));
      const picks = [];
      for (let slot = 0; slot < 3; slot++) {
        let roll = rng() * 100, grade = EMOTE_GRADES[0];
        for (const r of EMOTE_GRADES) { roll -= EMOTE_SHOP_ODDS[r]; if (roll <= 0) { grade = r; break; } }
        const pool = (r) => EMOTES.filter((e) => e.rarity === r && !this.owns(e.id) && !picks.includes(e.id));
        // a grade you have all of gives way to the nearest one you have not, cheaper side first
        let list = pool(grade);
        const at = EMOTE_GRADES.indexOf(grade);
        for (let k = 1; !list.length && k < EMOTE_GRADES.length; k++) {
          if (at - k >= 0) list = pool(EMOTE_GRADES[at - k]);
          if (!list.length && at + k < EMOTE_GRADES.length) list = pool(EMOTE_GRADES[at + k]);
        }
        const pick = rng(); // drawn every slot, so one slot never changes what the next one gets
        if (list.length) picks.push(list[Math.floor(pick * list.length)].id);
      }
      s = d.emoteShop = { day, picks, bought: [], seen: false };
      Save.write();
    }
    return s;
  },
  buy(id) {
    const s = this.shop();
    if (!s.picks.includes(id)) return { error: 'gone' };
    if (this.owns(id)) return { error: 'owned' };
    if ((Save.data.coins || 0) < EMOTE_PRICE) return { error: 'poor' };
    Save.data.coins -= EMOTE_PRICE;
    Save.data.owned.emote = Array.isArray(Save.data.owned.emote) ? Save.data.owned.emote : [];
    Save.data.owned.emote.push(id);
    s.bought.push(id);
    this.got(id);
    Save.write();
    return { ok: true };
  },
  // the home screen's CRATES button says when today's three have not been looked at
  unseen() { const s = this.shop(); return !s.seen && s.picks.some((id) => !this.owns(id)); },
  markSeen() { const s = this.shop(); if (!s.seen) { s.seen = true; Save.write(); } },
  hoursLeft(now = new Date()) {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.max(0, (end - now) / 3600000);
  },

  /* ---------------------------------------------------------------- drawing
     draw(g, id, x, y, size, t): the emote in a size x size box centred on (x, y), at t seconds
     into its loop. opts.backdrop false leaves out the rays behind legendary and mythic ones. */
  draw(g, id, x, y, size, t = 0, opts = {}) {
    const e = typeof id === 'object' ? id : EMOTE_BY_ID.get(id);
    if (!e) return;
    g.save();
    g.translate(x, y);
    // everything is drawn a little inside its box, and nothing leaves it: a ball kicked across
    // comes in at one edge and goes out at the other
    const k = (size / 100) * 0.86;
    g.scale(k, k);
    if (opts.clip !== false) { g.beginPath(); g.rect(-58, -58, 116, 116); g.clip(); }
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (opts.backdrop !== false) this.backdrop(g, e, t);
    const fx = EM_FX[e.fx] || null, prop = EM_PROPS[e.prop] || null;
    if (fx && fx.b) fx.b(g, t, e);
    if (prop && prop.wb) prop.wb(g, t, e);
    const mv = this.move(e.move, t);
    g.save();
    g.translate(mv.x, mv.y); g.rotate(mv.r); g.scale(mv.sx, mv.sy);
    if (prop && prop.b) prop.b(g, t, e);
    this.head(g, e, t);
    this.face(g, e, t);
    if (prop && prop.f) prop.f(g, t, e);
    g.restore();
    if (prop && prop.wf) prop.wf(g, t, e);
    if (fx && fx.f) fx.f(g, t, e);
    g.restore();
  },

  // rays behind the rarest: gold for legendary, every colour in turn for mythic
  backdrop(g, e, t) {
    if (e.rarity !== 'legendary' && e.rarity !== 'mythic') return;
    const myth = e.rarity === 'mythic';
    g.save();
    g.beginPath(); g.arc(0, 0, 49, 0, EM_TAU); g.clip();
    const n = 14, spin = t * (myth ? 0.7 : 0.45);
    const cols = myth ? ['#ffd6e4', '#e3d4ff', '#d4ecff', '#d8ffe0', '#fff2c2'] : ['#fff2c2', '#ffe08a'];
    for (let i = 0; i < n; i++) {
      const a0 = spin + (i * EM_TAU) / n, a1 = a0 + EM_TAU / n;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 60, a0, a1); g.closePath();
      g.fillStyle = myth ? cols[(i + Math.floor(t * 2)) % cols.length] : cols[i % 2]; g.fill();
    }
    g.restore();
  },

  move(kind, t) {
    const m = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
    switch (kind) {
      case 'bounce': { const b = emBounce(t, 1.6); m.y = -b * 7; m.sy = 1 - (1 - b) * 0.05; m.sx = 1 + (1 - b) * 0.05; break; }
      case 'jump': { const b = emBounce(t, 1.1); m.y = -b * 13; m.sy = b < 0.15 ? 0.9 : 1.04; m.sx = b < 0.15 ? 1.08 : 0.97; break; }
      case 'shake': m.x = Math.sin(t * 42) * 2.4; m.r = Math.sin(t * 31) * 0.04; break;
      case 'wobble': m.r = Math.sin(t * 5) * 0.14; break;
      case 'sway': m.r = Math.sin(t * 2.6) * 0.1; m.x = Math.sin(t * 2.6) * 3; break;
      case 'pulse': { const s = 1 + Math.sin(t * 6) * 0.05; m.sx = s; m.sy = s; break; }
      case 'float': m.y = Math.sin(t * 2.2) * 4; break;
      case 'nod': m.y = emBounce(t, 2.4) * 3; m.r = emBounce(t, 2.4) * 0.05; break;
      case 'tilt': m.r = 0.16 + Math.sin(t * 2) * 0.04; break;
      case 'spin': m.r = t * 3.2; break;
      case 'slam': { const u = emCycle(t, 2); const s = u < 0.18 ? 1.25 - (u / 0.18) * 0.25 : u < 0.26 ? 1 - Math.sin(((u - 0.18) / 0.08) * Math.PI) * 0.08 : 1; m.sx = s; m.sy = s; break; }
      case 'droop': m.y = 3 + Math.sin(t * 1.5) * 1.5; m.r = -0.08; break;
      case 'no': { const u = emCycle(t, 1.6); m.x = u < 0.5 ? Math.sin(u * 2 * EM_TAU * 2) * 4 : 0; m.r = m.x * 0.01; break; }
      case 'roll': { const u = emCycle(t, 2.4); m.r = u < 0.5 ? u * 2 * EM_TAU : 0; m.x = u < 0.5 ? Math.sin(u * 2 * Math.PI) * 10 : 0; break; }
      case 'dash': m.x = Math.sin(t * 3) * 8; m.r = Math.cos(t * 3) * 0.12; break;
      case 'flip': { const u = emCycle(t, 2.2); m.r = u < 0.45 ? -(u / 0.45) * EM_TAU : 0; m.y = u < 0.45 ? -Math.sin((u / 0.45) * Math.PI) * 10 : 0; break; }
      default: break;
    }
    return m;
  },

  // ---- the character
  head(g, e, t) {
    const who = e.who, skin = EM_SKIN[who] || '#f2c49b';
    const ghost = e.fx === 'ghost';
    if (ghost) g.globalAlpha *= 0.8;
    if (who === 'goat') return this.goat(g, e, t);
    if (who === 'ref') {
      emBox(g, -22, 24, 44, 20, 8, '#1b1d33');
      emPoly(g, [[-12, 25], [0, 36], [12, 25]], '#ffffff', 2.4);
    }
    if (who === 'fan') emBox(g, -26, 26, 52, 16, 7, EM_RED);
    if (who !== 'footy' && who !== 'golden') { emCirc(g, -29, 7, 6, skin); emCirc(g, 29, 7, 6, skin); }
    if (ghost) {
      // a sheet with a wavy hem instead of a round bottom
      g.beginPath(); g.arc(0, 4, 30, Math.PI, 0);
      for (let i = 0; i <= 6; i++) { const x = 30 - i * 10; g.lineTo(x, 34 + (i % 2 ? 6 : 0) + Math.sin(t * 6 + i) * 2); }
      g.closePath(); emFS(g, '#ffffff');
    } else emCirc(g, 0, 4, 30, skin);
    if (who === 'footy' || who === 'golden') {
      g.save(); g.beginPath(); g.arc(0, 4, 28.5, 0, EM_TAU); g.clip();
      g.fillStyle = who === 'golden' ? '#d99a0a' : '#2b2f4a';
      const pent = (cx, cy, r, a0) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = a0 + (i * EM_TAU) / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); };
      pent(0, -24, 9, -Math.PI / 2); pent(-30, -2, 9, 0.3); pent(30, -2, 9, -0.3); pent(-19, 33, 9, 0.2); pent(19, 33, 9, -0.2);
      g.restore();
      if (who === 'golden') { emSpark(g, -16, -12, 4 + Math.sin(t * 5) * 1.5, '#ffffff', 1.4); }
      emLine(g); g.beginPath(); g.arc(0, 4, 30, 0, EM_TAU); g.stroke();
    }
    if (who === 'kid') {
      emPoly(g, [[-30, 0], [-29, -16], [-24, -34], [-15, -24], [-8, -42], [0, -27], [8, -43], [14, -27], [23, -36], [28, -18], [30, 0], [22, -11], [8, -15], [-8, -15], [-22, -11]], '#4a2e1c');
    } else if (who === 'keeper') {
      g.beginPath(); g.arc(0, 3, 31, Math.PI * 1.2, Math.PI * 1.8); g.closePath(); emFS(g, EM_GREEN);
      emBox(g, -30, -21, 60, 8, 4, '#2a9d4b');
    } else if (who === 'ref') {
      emEll(g, -26, -4, 5, 9, 0.3, '#1b1d33', 2.4); emEll(g, 26, -4, 5, 9, -0.3, '#1b1d33', 2.4);
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-12, -17, 6, 3, -0.5, 0, EM_TAU); g.fill();
    } else if (who === 'coach') {
      g.beginPath(); g.arc(0, 3, 31, Math.PI * 1.2, Math.PI * 1.8); g.closePath(); emFS(g, '#2b3a7a');
      emBox(g, -8, -20, 44, 7, 3.5, '#1d2a5c');
    } else if (who === 'fan') {
      emCirc(g, 0, -33, 6, EM_GOLD2);
      g.beginPath(); g.arc(0, 3, 31, Math.PI * 1.18, Math.PI * 1.82); g.closePath(); emFS(g, EM_BLUE);
      emBox(g, -30, -21, 60, 8, 4, '#ffffff');
      // face paint: a stripe on each cheek
      g.fillStyle = EM_BLUE; g.fillRect(-23, 10, 7, 3); g.fillRect(16, 10, 7, 3);
      g.fillStyle = '#ffffff'; g.fillRect(-23, 13, 7, 3); g.fillRect(16, 13, 7, 3);
    }
    if (ghost) g.globalAlpha /= 0.8;
  },

  goat(g, e, t) {
    const skin = EM_SKIN.goat;
    // horns, ears, the long face, a beard
    g.save();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 10, -18); g.quadraticCurveTo(s * 20, -46, s * 34, -36); g.quadraticCurveTo(s * 24, -36, s * 18, -16); g.closePath(); emFS(g, '#d8c49a');
      emEll(g, s * 30, -2, 12, 6, s * 0.4, '#d9dce6');
    }
    g.restore();
    emPoly(g, [[-6, 34], [0, 48], [6, 34]], '#d9dce6');
    emEll(g, 0, 4, 25, 31, 0, skin);
    emEll(g, 0, 18, 13, 9, 0, '#ffd0dc', 2.6);
    g.fillStyle = EM_INK; g.beginPath(); g.ellipse(-4, 16, 1.8, 2.4, 0, 0, EM_TAU); g.ellipse(4, 16, 1.8, 2.4, 0, 0, EM_TAU); g.fill();
  },

  // ---- the face on it
  face(g, e, t) {
    const f = EM_FACES[e.face] || EM_FACES.smile;
    const [eyes, mouth, brows, extra] = f;
    const goat = e.who === 'goat';
    const EY = goat ? -5 : 0, EX = goat ? 10 : 11, MY = goat ? 25 : 15;
    if (extra === 'red') { g.save(); g.beginPath(); g.arc(0, 4, 28.5, 0, EM_TAU); g.clip(); g.fillStyle = 'rgba(255, 58, 63, 0.28)'; g.fillRect(-30, -12, 60, 46); g.restore(); }
    if (extra === 'blue') { g.save(); g.beginPath(); g.arc(0, 4, 28.5, 0, EM_TAU); g.clip(); g.fillStyle = 'rgba(70, 160, 255, 0.25)'; g.fillRect(-30, -12, 60, 46); g.restore(); }
    if (extra === 'blush') { g.fillStyle = 'rgba(255, 95, 140, 0.45)'; g.beginPath(); g.ellipse(-17, 10, 5.5, 3.2, 0, 0, EM_TAU); g.ellipse(17, 10, 5.5, 3.2, 0, 0, EM_TAU); g.fill(); }
    if (extra === 'mask') {
      emBox(g, -31, -7, 62, 13, 5, '#1b1d33', 2.6);
      const w = Math.sin(t * 7) * 3;
      g.fillStyle = '#1b1d33'; g.beginPath(); g.moveTo(-30, -4); g.lineTo(-44, -10 + w); g.lineTo(-42, 0 + w); g.closePath(); g.fill();
    }
    this.eyes(g, eyes, EX, EY, t, extra === 'mask', extra === 'mask' ? '#1b1d33' : EM_SKIN[e.who] || '#f2c49b');
    this.brows(g, brows, EX, EY, t);
    this.mouth(g, mouth, MY, t);
    if (extra === 'tears') {
      for (const s of [-1, 1]) {
        g.fillStyle = '#7fd6ff'; emLine(g, 2.2);
        g.beginPath(); g.moveTo(s * (EX - 4), EY + 3); g.lineTo(s * (EX + 1), EY + 3); g.lineTo(s * (EX + 1), 32); g.lineTo(s * (EX - 4), 32); g.closePath(); g.fill(); g.stroke();
        const dy = emCycle(t + (s > 0 ? 0.5 : 0), 1) * 14;
        emDrop(g, s * (EX - 1.5), 34 + dy, 2.6);
      }
    }
    if (extra === 'joy') {
      for (const s of [-1, 1]) { const u = emCycle(t + (s > 0 ? 0.3 : 0), 0.8); emDrop(g, s * (EX + 9 + u * 10), EY - 2 + u * 8, 2.4 * (1 - u * 0.4)); }
    }
  },

  eyes(g, kind, EX, EY, t, masked, skin) {
    const both = (fn) => { fn(-EX, -1); fn(EX, 1); };
    const blinkOn = emCycle(t, 3.1) > 0.95;
    const dot = (x, s, dx = 0, dy = 0) => {
      if (blinkOn) { emLine(g, 3); g.beginPath(); g.moveTo(x - 4, EY); g.lineTo(x + 4, EY); g.stroke(); return; }
      g.fillStyle = masked ? '#ffffff' : EM_INK; g.beginPath(); g.ellipse(x + dx, EY + dy, 3.6, 4.8, 0, 0, EM_TAU); g.fill();
      if (!masked) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + dx + 1.2, EY + dy - 1.6, 1.3, 0, EM_TAU); g.fill(); }
    };
    switch (kind) {
      case 'dot': both((x) => dot(x)); break;
      case 'half': both((x) => dot(x, 1, 0, 1)); this.lids(g, EX, EY, skin); break;
      case 'side': { const dx = Math.sin(t * 2.2) * 2.4; both((x) => dot(x, 1, dx, 1)); this.lids(g, EX, EY, skin); break; }
      case 'roll': both((x) => { emCirc(g, x, EY, 5.6, '#ffffff', 2.4); g.fillStyle = EM_INK; g.beginPath(); g.arc(x + Math.sin(t * 3) * 1.5, EY - 2.8, 2.6, 0, EM_TAU); g.fill(); }); break;
      case 'wide': both((x) => { emCirc(g, x, EY, 6.4, '#ffffff', 2.4); g.fillStyle = EM_INK; g.beginPath(); g.arc(x, EY + 0.5, 2.4, 0, EM_TAU); g.fill(); }); break;
      case 'crazy': emCirc(g, -EX, EY, 7, '#ffffff', 2.4); g.fillStyle = EM_INK; g.beginPath(); g.arc(-EX + Math.sin(t * 9) * 2, EY + Math.cos(t * 9) * 2, 2.6, 0, EM_TAU); g.fill(); dot(EX); break;
      case 'happy': both((x) => { emLine(g, 3.4); g.beginPath(); g.moveTo(x - 5, EY + 2); g.quadraticCurveTo(x, EY - 6, x + 5, EY + 2); g.stroke(); }); break;
      case 'closed': both((x) => { emLine(g, 3.2); g.beginPath(); g.moveTo(x - 5, EY); g.quadraticCurveTo(x, EY + 4, x + 5, EY); g.stroke(); }); break;
      case 'sleep': both((x) => { emLine(g, 3); g.beginPath(); g.moveTo(x - 5, EY + 1); g.quadraticCurveTo(x, EY + 4, x + 5, EY + 1); g.stroke(); }); break;
      case 'squint': both((x, s) => { emLine(g, 3.4); g.beginPath(); g.moveTo(x - 4 * s, EY - 4); g.lineTo(x + 3 * s, EY); g.lineTo(x - 4 * s, EY + 4); g.stroke(); }); break;
      case 'wink': emLine(g, 3.4); g.beginPath(); g.moveTo(-EX - 5, EY + 1); g.quadraticCurveTo(-EX, EY - 5, -EX + 5, EY + 1); g.stroke(); dot(EX); break;
      case 'heart': both((x) => emHeart(g, x, EY, 6 + Math.sin(t * 8) * 0.8, EM_RED, 2.2)); break;
      case 'star': both((x) => emStar(g, x, EY, 7.4 + Math.sin(t * 7) * 0.8, EM_GOLD2, 2.2, -Math.PI / 2 + t * 0.6)); break;
      case 'coin': both((x) => { emCirc(g, x, EY, 6.4, EM_GOLD, 2.2); emCirc(g, x, EY, 3.4, EM_GOLD2, 1.6); }); break;
      case 'spiral': both((x, s) => { emLine(g, 2.2); g.beginPath(); for (let i = 0; i < 26; i++) { const a = i * 0.55 + t * 6 * s, r = i * 0.26; g.lineTo(x + Math.cos(a) * r, EY + Math.sin(a) * r); } g.stroke(); }); break;
      case 'shades': {
        emBox(g, -22, EY - 6, 18, 12, 4, '#1b1d33', 2.6); emBox(g, 4, EY - 6, 18, 12, 4, '#1b1d33', 2.6);
        emLine(g, 2.6); g.beginPath(); g.moveTo(-4, EY - 3); g.lineTo(4, EY - 3); g.moveTo(-22, EY - 4); g.lineTo(-29, EY - 6); g.moveTo(22, EY - 4); g.lineTo(29, EY - 6); g.stroke();
        const sh = emCycle(t, 2.4);
        if (sh < 0.3) { g.fillStyle = '#ffffff'; g.save(); g.beginPath(); g.rect(-21, EY - 5, 16, 10); g.rect(5, EY - 5, 16, 10); g.clip(); const sx = -26 + sh * 180; g.beginPath(); g.moveTo(sx, EY - 6); g.lineTo(sx + 5, EY - 6); g.lineTo(sx - 3, EY + 6); g.lineTo(sx - 8, EY + 6); g.closePath(); g.fill(); g.restore(); }
        break;
      }
      case 'hollow': both((x) => { emEll(g, x, EY, 4.6, 6.6, 0, '#1b1d33', 2); }); break;
      case 'laser': {
        // two beams straight out at you, pulsing
        const w = 5 + Math.sin(t * 18) * 1.6;
        both((x, s) => {
          g.strokeStyle = EM_RED; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x, EY); g.lineTo(x + s * 40, EY + 52); g.stroke();
          g.strokeStyle = '#ffd0d0'; g.lineWidth = w * 0.45; g.beginPath(); g.moveTo(x, EY); g.lineTo(x + s * 40, EY + 52); g.stroke();
        });
        both((x) => { emCirc(g, x, EY, 5.2, EM_RED, 2.2); emCirc(g, x, EY, 2, '#ffffff', 0); });
        break;
      }
      default: both((x) => dot(x)); break;
    }
  },
  // heavy lids over dot eyes (smug, side-eye): the top half covered in skin, a line along the edge
  lids(g, EX, EY, skin) {
    for (const x of [-EX, EX]) {
      g.fillStyle = skin; g.fillRect(x - 5.5, EY - 7, 11, 6.6);
      emLine(g, 3); g.beginPath(); g.moveTo(x - 5.5, EY - 0.6); g.lineTo(x + 5.5, EY - 0.6); g.stroke();
    }
  },
  brows(g, kind, EX, EY, t) {
    if (!kind) return;
    emLine(g, 3.2);
    const y = EY - 9;
    g.beginPath();
    if (kind === 'angry') { g.moveTo(-EX - 6, y - 3); g.lineTo(-EX + 5, y + 2); g.moveTo(EX + 6, y - 3); g.lineTo(EX - 5, y + 2); }
    else if (kind === 'sad') { g.moveTo(-EX - 6, y + 2); g.lineTo(-EX + 5, y - 3); g.moveTo(EX + 6, y + 2); g.lineTo(EX - 5, y - 3); }
    else if (kind === 'up') { g.moveTo(-EX - 6, y - 1); g.quadraticCurveTo(-EX, y - 6, -EX + 6, y - 1); g.moveTo(EX - 6, y - 1); g.quadraticCurveTo(EX, y - 6, EX + 6, y - 1); }
    else if (kind === 'raised') { const r = Math.sin(t * 3) * 1.5; g.moveTo(-EX - 6, y + 1); g.lineTo(-EX + 6, y + 1); g.moveTo(EX - 6, y - 2 + r); g.quadraticCurveTo(EX, y - 8 + r, EX + 6, y - 3 + r); }
    g.stroke();
  },
  mouth(g, kind, MY, t) {
    const dark = '#5a1a2a', tongue = '#ff6f7d';
    switch (kind) {
      case 'smile': emLine(g, 3.2); g.beginPath(); g.moveTo(-8, MY - 2); g.quadraticCurveTo(0, MY + 6, 8, MY - 2); g.stroke(); break;
      case 'small': emLine(g, 3); g.beginPath(); g.moveTo(-4, MY); g.quadraticCurveTo(0, MY + 3, 4, MY); g.stroke(); break;
      case 'grin': {
        g.beginPath(); g.moveTo(-11, MY - 3); g.quadraticCurveTo(0, MY - 1, 11, MY - 3); g.quadraticCurveTo(9, MY + 10, 0, MY + 10); g.quadraticCurveTo(-9, MY + 10, -11, MY - 3); g.closePath(); emFS(g, dark, 3);
        g.save(); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-12, MY - 4, 24, 4.5); g.fillStyle = tongue; g.beginPath(); g.ellipse(0, MY + 9, 6, 4, 0, 0, EM_TAU); g.fill(); g.restore();
        emLine(g, 3); g.beginPath(); g.moveTo(-11, MY - 3); g.quadraticCurveTo(0, MY - 1, 11, MY - 3); g.quadraticCurveTo(9, MY + 10, 0, MY + 10); g.quadraticCurveTo(-9, MY + 10, -11, MY - 3); g.stroke();
        break;
      }
      case 'laugh': {
        const o = 1 + emBounce(t, 3.4) * 0.35;
        g.save(); g.translate(0, MY); g.scale(1, o);
        g.beginPath(); g.moveTo(-12, -3); g.quadraticCurveTo(0, -1, 12, -3); g.quadraticCurveTo(10, 12, 0, 12); g.quadraticCurveTo(-10, 12, -12, -3); g.closePath(); emFS(g, dark, 3);
        g.save(); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-13, -4, 26, 4); g.fillStyle = tongue; g.beginPath(); g.ellipse(0, 11, 7, 5, 0, 0, EM_TAU); g.fill(); g.restore();
        g.restore();
        break;
      }
      case 'wail': {
        const o = 0.85 + Math.sin(t * 9) * 0.15;
        g.save(); g.translate(0, MY + 2); g.scale(1, o);
        g.beginPath(); g.moveTo(-9, 4); g.quadraticCurveTo(0, -8, 9, 4); g.quadraticCurveTo(0, 9, -9, 4); g.closePath(); emFS(g, dark, 3);
        g.restore();
        break;
      }
      case 'teeth': emBox(g, -10, MY - 4, 20, 9, 3, '#ffffff', 2.8); emLine(g, 1.8); g.beginPath(); g.moveTo(-10, MY + 0.5); g.lineTo(10, MY + 0.5); for (const x of [-5, 0, 5]) { g.moveTo(x, MY - 4); g.lineTo(x, MY + 5); } g.stroke(); break;
      case 'shout': {
        const o = 0.9 + Math.sin(t * 14) * 0.12;
        g.save(); g.translate(0, MY + 2); g.scale(1, o);
        emEll(g, 0, 0, 9, 9, 0, dark, 3);
        g.save(); g.beginPath(); g.ellipse(0, 0, 8, 8, 0, 0, EM_TAU); g.clip(); g.fillStyle = tongue; g.beginPath(); g.ellipse(0, 7, 6, 4, 0, 0, EM_TAU); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(-8, -9, 16, 3.5); g.restore();
        g.restore();
        break;
      }
      case 'o': emEll(g, 0, MY + 1, 4.6, 5.6, 0, dark, 2.8); break;
      case 'yawn': { const o = 0.7 + emBounce(t, 0.5) * 0.5; emEll(g, 0, MY + 2, 7, 8 * o, 0, dark, 3); break; }
      case 'smirk': emLine(g, 3.2); g.beginPath(); g.moveTo(-7, MY + 1); g.quadraticCurveTo(3, MY + 3, 9, MY - 3); g.stroke(); break;
      case 'flat': emLine(g, 3.2); g.beginPath(); g.moveTo(-7, MY + 1); g.lineTo(7, MY + 1); g.stroke(); break;
      case 'frown': emLine(g, 3.2); g.beginPath(); g.moveTo(-8, MY + 4); g.quadraticCurveTo(0, MY - 4, 8, MY + 4); g.stroke(); break;
      case 'pout': emLine(g, 3.2); g.beginPath(); g.moveTo(-5, MY + 3); g.quadraticCurveTo(0, MY - 2, 5, MY + 3); g.stroke(); break;
      case 'wavy': emLine(g, 3); g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(-9 + i * 2.25, MY + 1 + (i % 2 ? -2 : 2)); g.stroke(); break;
      case 'chatter': { const j = Math.sin(t * 40) * 1.2; emBox(g, -9, MY - 3 + j, 18, 7, 3, '#ffffff', 2.6); emLine(g, 1.6); g.beginPath(); g.moveTo(-9, MY + 0.5 + j); g.lineTo(9, MY + 0.5 + j); g.stroke(); break; }
      case 'tongue': {
        emLine(g, 3.2); g.beginPath(); g.moveTo(-8, MY - 1); g.quadraticCurveTo(0, MY + 4, 8, MY - 1); g.stroke();
        const w = Math.sin(t * 8) * 0.25;
        g.save(); g.translate(3, MY + 2); g.rotate(w); emBox(g, -4, -1, 8, 10, 4, tongue, 2.6); g.restore();
        break;
      }
      case 'kiss': {
        const p = 1 + Math.sin(t * 7) * 0.15;
        g.save(); g.translate(2, MY + 1); g.scale(p, p); emLine(g, 3); g.beginPath(); g.moveTo(-1, -5); g.quadraticCurveTo(5, -3, 0, 0); g.quadraticCurveTo(5, 3, -1, 5); g.stroke(); g.restore();
        break;
      }
      case 'blow': {
        // cheeks puffed out round, blowing into something
        const p = 7 + Math.sin(t * 10) * 0.8;
        g.fillStyle = 'rgba(255, 95, 140, 0.4)'; g.beginPath(); g.arc(-15, MY - 3, p, 0, EM_TAU); g.arc(15, MY - 3, p, 0, EM_TAU); g.fill();
        emEll(g, 0, MY + 1, 4, 4, 0, '#5a1a2a', 2.6);
        break;
      }
      case 'orange': {
        // a slice of orange for a smile: half-time, every match
        g.beginPath(); g.moveTo(-17, MY - 4); g.quadraticCurveTo(0, MY + 20, 17, MY - 4); g.closePath(); emFS(g, EM_ORANGE, 3);
        g.beginPath(); g.moveTo(-13, MY - 2); g.quadraticCurveTo(0, MY + 14, 13, MY - 2); g.closePath(); g.fillStyle = '#ffc56b'; g.fill();
        emLine(g, 1.8); g.beginPath(); for (const a of [-0.75, -0.25, 0.25, 0.75]) { g.moveTo(0, MY - 2); g.lineTo(Math.sin(a) * 12, MY - 2 + Math.cos(a) * 10); } g.stroke();
        break;
      }
      case 'none': default: break;
    }
  },
};

// a card held up by the ref
function emCard(g, t, e, col) {
  const lift = emBounce(t, 1.2) * 4;
  g.save(); g.translate(26, -10 - lift); g.rotate(0.18);
  emBox(g, -8, -30, 17, 24, 2.5, col, 2.8);
  emHand(g, 0, -2, 'fist', EM_HANDS[e.who], 0, 1);
  g.restore();
}
// the board held up on the touchline: added time, or a substitution's two arrows
function emSubBoard(g, t, e, text) {
  g.save(); g.translate(28, -8 - emBounce(t, 1.2) * 3);
  emBox(g, -16, -14, 32, 22, 3, '#1b1d33', 2.8);
  if (text) emText(g, text, 0, -3, 14, '#5cff6a');
  else {
    emPoly(g, [[-12, -8], [-4, -13], [-4, -3]], EM_RED, 1.4); g.fillStyle = EM_RED; g.fillRect(-4, -10, 9, 4);
    emPoly(g, [[12, 2], [4, -3], [4, 7]], EM_GREEN, 1.4); g.fillStyle = EM_GREEN; g.fillRect(-5, 0, 9, 4);
  }
  emHand(g, 0, 14, 'fist', EM_HANDS[e.who], 0, 0.9);
  g.restore();
}

/* ------------------------------------------------------------------ props
   b: behind the head (moves with it), f: in front (moves with it), wb/wf: behind/in front, still */
const EM_PROPS = {
  thumb: { f: (g, t, e) => emHand(g, 26, 26 - emBounce(t, 1.6) * 2, 'thumb', EM_HANDS[e.who], -0.12, 1.15) },
  thumbdown: { f: (g, t, e) => emHand(g, 26, 26, 'thumb', EM_HANDS[e.who], Math.PI + 0.12, 1.15) },
  wave: { f: (g, t, e) => emHand(g, 28, 8, 'open', EM_HANDS[e.who], Math.sin(t * 9) * 0.45, 1.1) },
  fist: { f: (g, t, e) => emHand(g, 28, -4 - emBounce(t, 2) * 6, 'fist', EM_HANDS[e.who], 0.1, 1.15) },
  peace: { f: (g, t, e) => emHand(g, 27, 12, 'peace', EM_HANDS[e.who], 0.2 + Math.sin(t * 3) * 0.1, 1.1) },
  chin: { f: (g, t, e) => emHand(g, 10, 32, 'point', EM_HANDS[e.who], -0.5, 1.05) },
  salute: { f: (g, t, e) => emHand(g, -24, -14, 'open', EM_HANDS[e.who], -1.2, 1.05) },
  shh: { f: (g, t, e) => emHand(g, 2, 26, 'point', EM_HANDS[e.who], 0, 1.05) },
  point: { f: (g, t, e) => { const s = 1.1 + Math.sin(t * 6) * 0.12; emHand(g, 24, 26, 'point', EM_HANDS[e.who], -0.7, s); } },
  facepalm: { f: (g, t, e) => emHand(g, -4, 2, 'open', EM_HANDS[e.who], -0.25, 1.45) },
  fistbump: {
    f: (g, t, e) => {
      const u = emCycle(t, 1.4), s = u < 0.5 ? 1 + u * 0.9 : 1.45 - (u - 0.5) * 0.9;
      emHand(g, 18, 26, 'fist', EM_HANDS[e.who], -0.3, s * 1.1);
      if (u > 0.4 && u < 0.62) { emLine(g, 2.6); g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * EM_TAU) / 6; g.moveTo(18 + Math.cos(a) * 18, 26 + Math.sin(a) * 18); g.lineTo(18 + Math.cos(a) * 25, 26 + Math.sin(a) * 25); } g.stroke(); }
    },
  },
  clap: {
    f: (g, t, e) => {
      const gap = 3 + emBounce(t, 2.6) * 9;
      emHand(g, -gap - 4, 34, 'open', EM_HANDS[e.who], 0.5, 1); emHand(g, gap + 4, 34, 'open', EM_HANDS[e.who], -0.5, 1);
      if (gap < 4.5) { emLine(g, 2.4); g.beginPath(); for (const a of [-2.4, -1.6, -0.8]) { g.moveTo(Math.cos(a) * 14, 26 + Math.sin(a) * 14); g.lineTo(Math.cos(a) * 20, 26 + Math.sin(a) * 20); } g.stroke(); }
    },
  },
  yellowcard: { f: (g, t, e) => emCard(g, t, e, EM_GOLD2) },
  redcard: { f: (g, t, e) => emCard(g, t, e, EM_RED) },
  whistle: {
    f: (g, t, e) => {
      const j = Math.sin(t * 30) * 0.8;
      emLine(g, 1.8); g.beginPath(); g.moveTo(14, 18); g.quadraticCurveTo(22, 36, 6, 40); g.stroke();
      emBox(g, 4 + j, 11, 16, 9, 4, '#c9d2e4', 2.6);
      emCirc(g, 19 + j, 18, 5.5, '#c9d2e4', 2.6);
    },
  },
  juggle: {
    wf: (g, t) => { const h = emBounce(t, 1.4); emBall(g, 0, -38 - h * 12, 8.5, t * 5); },
  },
  header: {
    wf: (g, t) => {
      const u = emCycle(t, 1.6);
      const x = -54 + u * 108, y = u < 0.5 ? -8 - (u / 0.5) * 34 + Math.sin(u * Math.PI) * -6 : -42 - ((u - 0.5) / 0.5) * 12;
      emLine(g, 2.2); g.beginPath(); for (let i = 1; i <= 3; i++) { g.moveTo(x - 10 - i * 5, y - 3 + i * 3); g.lineTo(x - 18 - i * 5, y - 3 + i * 3); } g.stroke();
      emBall(g, x, y, 8, t * 9);
    },
  },
  popcorn: {
    f: (g, t, e) => {
      emPoly(g, [[10, 22], [34, 22], [31, 48], [13, 48]], '#ffffff', 2.8);
      g.fillStyle = EM_RED; for (const x of [15, 24]) { g.beginPath(); g.moveTo(x, 23); g.lineTo(x + 4, 23); g.lineTo(x + 3.4, 47); g.lineTo(x + 0.6, 47); g.closePath(); g.fill(); }
      emLine(g, 2.8); g.beginPath(); g.moveTo(10, 22); g.lineTo(34, 22); g.lineTo(31, 48); g.lineTo(13, 48); g.closePath(); g.stroke();
      emCloud(g, 22, 18, 0.5, '#fff6d6', 2.4);
      const u = emCycle(t, 0.9); emCirc(g, 20 + u * 8, 12 - Math.sin(u * Math.PI) * 18, 3.2, '#fff6d6', 1.8);
      emHand(g, 8, 40, 'fist', EM_HANDS[e.who], 0.3, 0.9);
    },
  },
  scarf: {
    f: (g, t, e) => {
      const w = Math.sin(t * 5) * 3;
      g.save(); g.translate(0, -40);
      emBox(g, -34, -6 + w * 0.3, 68, 12, 3, EM_RED, 2.8);
      g.save(); emRR(g, -34, -6 + w * 0.3, 68, 12, 3); g.clip(); g.fillStyle = '#ffffff'; for (let x = -26; x < 34; x += 16) g.fillRect(x, -8, 6, 16); g.restore();
      emLine(g, 2.8); emRR(g, -34, -6 + w * 0.3, 68, 12, 3); g.stroke();
      emHand(g, -34, 4, 'fist', EM_HANDS[e.who], 0, 0.95); emHand(g, 34, 4, 'fist', EM_HANDS[e.who], 0, 0.95);
      g.restore();
    },
  },
  drum: {
    f: (g, t, e) => {
      emBox(g, -22, 30, 44, 18, 4, EM_RED, 2.8);
      emEll(g, 0, 30, 22, 6, 0, '#fff6d6', 2.8);
      const a = emBounce(t, 2.8), b = emBounce(t + 0.18, 2.8);
      for (const [x, k] of [[-12, a], [12, b]]) { emLine(g, 3); g.beginPath(); g.moveTo(x * 1.9, 14 - k * 6); g.lineTo(x * 0.6, 28 - k * 2); g.stroke(); emCirc(g, x * 0.6, 28 - k * 2, 2.6, '#ffffff', 2); }
    },
  },
  horn: {
    f: (g, t) => {
      const j = Math.sin(t * 25) * 0.8;
      emPoly(g, [[2, 14 + j], [40, 2 + j], [46, 14 + j], [2, 20 + j]], EM_GOLD2, 2.8);
      emEll(g, 43, 8 + j, 3.5, 7.5, -0.3, EM_GOLD, 2.6);
    },
  },
  medal: {
    f: (g, t) => {
      const sw = Math.sin(t * 3) * 0.12;
      g.save(); g.translate(0, 28); g.rotate(sw);
      emPoly(g, [[-10, -4], [-3, -4], [2, 10], [-4, 10]], EM_BLUE, 2.4); emPoly(g, [[10, -4], [3, -4], [-2, 10], [4, 10]], EM_RED, 2.4);
      emCirc(g, 0, 16, 8, EM_GOLD, 2.6); emStar(g, 0, 16, 4.2, EM_GOLD2, 1.4);
      g.restore();
    },
  },
  gloves: {
    f: (g, t, e) => {
      const col = e.prop === 'goldgloves' ? EM_GOLD : EM_HANDS.keeper, b = emBounce(t, 1.6) * 3;
      emHand(g, -30, 24 - b, 'open', col, -0.3, 1.25); emHand(g, 30, 24 - b, 'open', col, 0.3, 1.25);
    },
  },
  stopwatch: {
    f: (g, t, e) => {
      g.save(); g.translate(26, 20);
      emBox(g, -2.5, -15, 5, 5, 1.5, '#c9d2e4', 2.2);
      emCirc(g, 0, 0, 11, '#e9edf7', 2.8); emCirc(g, 0, 0, 1.6, EM_INK, 0);
      const a = t * 4; emLine(g, 2.4); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); g.stroke();
      emHand(g, 0, 15, 'fist', EM_HANDS[e.who], 0, 0.85);
      g.restore();
    },
  },
  bottle: {
    f: (g, t, e) => {
      g.save(); g.translate(16, 12); g.rotate(-0.95 + Math.sin(t * 3) * 0.08);
      emBox(g, -5, -6, 10, 26, 3, '#7fd6ff', 2.6); emBox(g, -3, -11, 6, 6, 1.5, '#ffffff', 2.2); emBox(g, -5, 4, 10, 6, 0, EM_BLUE, 2.2);
      g.restore();
      emHand(g, 26, 26, 'fist', EM_HANDS[e.who], -0.4, 0.95);
    },
  },
  bandage: { f: (g) => { g.save(); g.translate(16, -14); for (const a of [0.7, -0.7]) { g.save(); g.rotate(a); emBox(g, -11, -3.5, 22, 7, 3, '#ffd9b0', 2.4); g.restore(); } g.restore(); } },
  cone: {
    b: (g, t) => {
      g.save(); g.translate(0, -26); g.rotate(Math.sin(t * 3) * 0.08);
      emPoly(g, [[-14, 4], [14, 4], [3, -30], [-3, -30]], EM_ORANGE, 2.8);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-9, -8); g.lineTo(9, -8); g.lineTo(7, -15); g.lineTo(-7, -15); g.closePath(); g.fill();
      emBox(g, -18, 1, 36, 6, 2, EM_ORANGE, 2.6);
      g.restore();
    },
  },
  board: {
    f: (g, t, e) => {
      g.save(); g.translate(26, 26); g.rotate(-0.12);
      emBox(g, -15, -13, 30, 26, 3, '#2a9d4b', 2.8);
      emLine(g, 1.6); g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.arc(0, 0, 5, 0, EM_TAU); g.stroke();
      const u = emCycle(t, 1.6);
      g.strokeStyle = EM_GOLD2; g.lineWidth = 2; g.beginPath(); g.moveTo(-9, 6); g.quadraticCurveTo(-4, -8, -9 + u * 18, -6 + u * 2); g.stroke();
      g.strokeStyle = EM_RED; g.beginPath(); g.moveTo(5, 3); g.lineTo(9, 7); g.moveTo(9, 3); g.lineTo(5, 7); g.stroke();
      g.restore();
    },
  },
  megaphone: {
    f: (g, t) => {
      const j = Math.sin(t * 22) * 0.6;
      emPoly(g, [[6, 12 + j], [34, 2 + j], [38, 30 + j], [6, 20 + j]], '#ffffff', 2.8);
      g.fillStyle = EM_RED; g.beginPath(); g.moveTo(18, 8 + j); g.lineTo(25, 5.5 + j); g.lineTo(26.5, 26 + j); g.lineTo(18, 23 + j); g.closePath(); g.fill();
      emLine(g, 2.8); g.beginPath(); g.moveTo(6, 12 + j); g.lineTo(34, 2 + j); g.lineTo(38, 30 + j); g.lineTo(6, 20 + j); g.closePath(); g.stroke();
      emEll(g, 36, 16 + j, 3.5, 14, -0.15, '#e9edf7', 2.6);
    },
  },
  flag: {
    f: (g, t, e) => {
      emLine(g, 3); g.strokeStyle = EM_INK; g.beginPath(); g.moveTo(32, 46); g.lineTo(32, -40); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(32, 46); g.lineTo(32, -40); g.stroke();
      const w = t * 6;
      g.beginPath(); g.moveTo(32, -40);
      for (let i = 0; i <= 6; i++) g.lineTo(32 + i * 3.6, -40 + i * 1.4 + Math.sin(w + i) * 2);
      for (let i = 6; i >= 0; i--) g.lineTo(32 + i * 3.6, -22 - i * 1.4 + Math.sin(w + i) * 2);
      g.closePath(); emFS(g, EM_GOLD2, 2.6);
      emHand(g, 32, 26, 'fist', EM_HANDS[e.who], 0, 1);
    },
  },
  armband: {
    f: (g, t, e) => {
      const y = -6 - emBounce(t, 1.8) * 4;
      emHand(g, 28, y, 'fist', EM_HANDS[e.who], 0.1, 1.15);
      emBox(g, 18, y + 9, 20, 9, 3, EM_GOLD2, 2.6);
      emText(g, 'C', 28, y + 13.6, 9, EM_INK);
    },
  },
  boot: {
    f: (g, t) => {
      g.save(); g.translate(26, 14); g.rotate(-0.3 + Math.sin(t * 3) * 0.08);
      g.beginPath(); g.moveTo(-10, -12); g.lineTo(2, -12); g.lineTo(3, -2); g.quadraticCurveTo(18, 0, 16, 8); g.lineTo(-10, 8); g.closePath(); emFS(g, EM_BLUE, 2.8);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(8, -1); g.lineTo(10, 3); g.lineTo(-6, 4); g.closePath(); g.fill();
      for (const x of [-6, 2, 10]) emBox(g, x - 1.8, 8, 3.6, 4, 1, '#c9d2e4', 1.6);
      g.restore();
    },
  },
  cloud: {
    wb: (g, t, e) => {
      const dark = e.fx === 'bigbolt';
      emCloud(g, Math.sin(t * 1.2) * 4, dark ? -38 : -42, dark ? 1.12 : 1, dark ? '#6b7299' : '#c9d2e4', 3);
    },
  },
  sun: {
    wb: (g, t) => {
      g.save(); g.translate(30, -30); g.rotate(t * 0.8);
      for (let i = 0; i < 10; i++) { g.save(); g.rotate((i * EM_TAU) / 10); emPoly(g, [[-3, -14], [3, -14], [0, -22]], EM_GOLD, 2); g.restore(); }
      emCirc(g, 0, 0, 12, EM_GOLD2, 2.8);
      g.restore();
    },
  },
  gum: {
    f: (g, t) => {
      const u = emCycle(t, 2.4);
      if (u < 0.85) { const r = 3 + (u / 0.85) * 15; emCirc(g, 0, 16 + r * 0.55, r, '#ff9ee8', 2.6); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-r * 0.35, 16 + r * 0.2, r * 0.18, 0, EM_TAU); g.fill(); }
      else { emLine(g, 2.4); g.strokeStyle = '#ff6fd0'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 7; i++) { const a = (i * EM_TAU) / 7; g.moveTo(Math.cos(a) * 10, 22 + Math.sin(a) * 10); g.lineTo(Math.cos(a) * 18, 22 + Math.sin(a) * 18); } g.stroke(); }
    },
  },
  tissue: {
    f: (g, t, e) => {
      const y = Math.sin(t * 5) * 3;
      emCloud(g, -22, 6 + y, 0.45, '#ffffff', 2.2);
      emHand(g, -24, 16 + y, 'fist', EM_HANDS[e.who], -0.3, 0.95);
    },
  },
  nutmeg: {
    wf: (g, t) => {
      const u = emCycle(t, 1.3), x = -50 + u * 100;
      emLine(g, 2.2); g.beginPath(); for (let i = 1; i <= 3; i++) { g.moveTo(x - 10 - i * 4, 40 + i * 2 - 2); g.lineTo(x - 20 - i * 4, 40 + i * 2 - 2); } g.stroke();
      emBall(g, x, 42, 7, u * 14);
    },
  },
  flagup: {
    f: (g, t, e) => {
      const w = Math.sin(t * 9) * 0.25;
      g.save(); g.translate(28, -4); g.rotate(0.15 + w);
      emLine(g, 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -40); g.stroke();
      emPoly(g, [[0, -40], [18, -40], [18, -26], [0, -26]], EM_RED, 2.4);
      g.fillStyle = EM_GOLD2; g.beginPath(); g.moveTo(0, -26); g.lineTo(18, -40); g.lineTo(18, -26); g.closePath(); g.fill();
      emLine(g, 2.4); g.strokeRect(0, -40, 18, 14);
      emHand(g, 0, 2, 'fist', EM_HANDS[e.who], 0, 1);
      g.restore();
    },
  },
  handup: { f: (g, t, e) => emHand(g, 30, -10 + Math.sin(t * 6) * 2, 'open', EM_HANDS[e.who], 0.15, 1.2) },
  var: {
    wb: (g, t) => {
      g.save(); g.translate(30, -28);
      emBox(g, -17, -13, 34, 26, 4, '#1b1d33', 2.8);
      g.fillStyle = '#3a4a8a'; g.fillRect(-13, -9, 26, 18);
      const u = emCycle(t, 1.4); g.fillStyle = '#7fd6ff'; g.fillRect(-13, -9 + u * 16, 26, 2);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-4, -5); g.lineTo(6, 0); g.lineTo(-4, 5); g.closePath(); g.fill();
      g.restore();
    },
  },
  phone: {
    f: (g, t, e) => {
      g.save(); g.translate(26, -6); g.rotate(0.12);
      emBox(g, -9, -16, 18, 30, 4, '#1b1d33', 2.6);
      g.fillStyle = '#7fd6ff'; g.fillRect(-6, -12, 12, 20);
      emHand(g, 0, 14, 'fist', EM_HANDS[e.who], 0, 0.9);
      g.restore();
    },
  },
  net: {
    wb: (g) => {
      emLine(g, 1.2); g.strokeStyle = '#9aa3c7';
      g.beginPath(); for (let x = -40; x <= 40; x += 8) { g.moveTo(x, -36); g.lineTo(x * 0.85, 44); } for (let y = -36; y <= 44; y += 8) { g.moveTo(-40, y); g.lineTo(40, y); } g.stroke();
      emLine(g, 6); g.beginPath(); g.moveTo(-44, 46); g.lineTo(-44, -40); g.lineTo(44, -40); g.lineTo(44, 46); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-44, 46); g.lineTo(-44, -40); g.lineTo(44, -40); g.lineTo(44, 46); g.stroke();
    },
  },
  post: {
    wb: (g, t) => {
      const u = emCycle(t, 1.6), hit = u < 0.12 ? Math.sin((u / 0.12) * Math.PI * 4) * 2 : 0;
      emLine(g, 8); g.beginPath(); g.moveTo(-40 + hit, 50); g.lineTo(-40 + hit, -50); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-40 + hit, 50); g.lineTo(-40 + hit, -50); g.stroke();
      if (u < 0.2) { emLine(g, 2.4); g.beginPath(); for (const a of [-0.6, 0, 0.6]) { g.moveTo(-34 + Math.cos(a) * 4, Math.sin(a) * 6); g.lineTo(-34 + Math.cos(a) * 12, Math.sin(a) * 14); } g.stroke(); }
    },
  },
  chef: {
    f: (g, t, e) => {
      const u = emCycle(t, 1.4);
      emHand(g, 8 + u * 14, 18 - u * 6, u < 0.5 ? 'point' : 'open', EM_HANDS[e.who], -0.3 + u * 0.6, 1);
    },
  },
  hattrick: {
    wf: (g, t) => {
      for (let i = 0; i < 3; i++) {
        const p = emCycle(t + i * 0.5, 1.5), a = Math.PI + p * Math.PI;
        emBall(g, Math.cos(a) * 26, -36 + Math.sin(a) * 18, 7, t * 6 + i);
      }
    },
  },
  topcorner: {
    wb: (g, t) => {
      emLine(g, 1.2); g.strokeStyle = '#9aa3c7';
      g.beginPath(); for (let x = -14; x <= 44; x += 7) { g.moveTo(x, -42); g.lineTo(x, 46); } for (let y = -42; y <= 46; y += 7) { g.moveTo(-14, y); g.lineTo(44, y); } g.stroke();
      emLine(g, 6); g.beginPath(); g.moveTo(-50, -44); g.lineTo(42, -44); g.lineTo(42, 50); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-50, -44); g.lineTo(42, -44); g.lineTo(42, 50); g.stroke();
    },
    wf: (g, t) => {
      const u = emCycle(t, 1.6);
      if (u < 0.55) { const k = u / 0.55; emBall(g, -46 + k * 76, 40 - k * 74, 6 + k * 1.5, k * 12); }
      else { const k = (u - 0.55) / 0.45; emBall(g, 30, -34 + k * 2, 7.5, 0); if (k < 0.35) { emLine(g, 2.2); g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI + (i * Math.PI) / 4; g.moveTo(30 + Math.cos(a) * 11, -34 + Math.sin(a) * 11); g.lineTo(30 + Math.cos(a) * 17, -34 + Math.sin(a) * 17); } g.stroke(); } }
    },
  },
  rainbowball: {
    wf: (g, t) => {
      const u = emCycle(t, 1.8), a = Math.PI * (1 - u);
      const x = Math.cos(a) * 34, y = 8 - Math.sin(a) * 52;
      const cols = [EM_RED, EM_ORANGE, EM_GOLD2, EM_GREEN, EM_BLUE, EM_PURPLE];
      for (let i = 0; i < cols.length; i++) { g.strokeStyle = cols[i]; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 8, 34 + (i - 2.5) * 2.4, Math.PI, Math.PI + Math.PI * u); g.stroke(); }
      emBall(g, x, y, 8, u * 10);
    },
  },
  chip: {
    wf: (g, t) => {
      const u = emCycle(t, 2.2), x = -40 + u * 80, y = 30 - Math.sin(u * Math.PI) * 74;
      emBall(g, x, y, 7, u * 4);
    },
  },
  bus: {
    wf: (g, t) => {
      const x = Math.sin(t * 1.4) * 3;
      g.save(); g.translate(x, 0);
      emBox(g, -40, 26, 80, 20, 5, EM_GOLD2, 2.8);
      for (let i = 0; i < 4; i++) emBox(g, -34 + i * 18, 29, 13, 8, 2, '#7fd6ff', 2);
      emCirc(g, -24, 47, 5.5, '#1b1d33', 2.4); emCirc(g, 24, 47, 5.5, '#1b1d33', 2.4);
      g.restore();
    },
  },
  passes: {
    wf: (g, t) => {
      const pts = [[-34, -26], [34, -20], [0, 44]];
      const u = emCycle(t, 0.75), leg = Math.floor(emCycle(t, 2.25) * 3) % 3;
      const [ax, ay] = pts[leg], [bx, by] = pts[(leg + 1) % 3];
      for (const [px, py] of pts) emCirc(g, px, py, 3.2, '#ffffff', 2);
      emBall(g, ax + (bx - ax) * u, ay + (by - ay) * u, 6.5, t * 10);
    },
  },
  catch: {
    f: (g, t, e) => {
      emBall(g, 0, 32, 10, 0.4);
      emHand(g, -13, 32, 'open', EM_HANDS.keeper, 1.1, 1.05); emHand(g, 13, 32, 'open', EM_HANDS.keeper, -1.1, 1.05);
    },
  },
  plusboard: { f: (g, t, e) => emSubBoard(g, t, e, '+5') },
  subboard: { f: (g, t, e) => emSubBoard(g, t, e, null) },
  crown: {
    f: (g, t) => {
      g.save(); g.translate(0, -30 + Math.sin(t * 3) * 1.2);
      emPoly(g, [[-18, 4], [-20, -14], [-9, -5], [0, -18], [9, -5], [20, -14], [18, 4]], EM_GOLD, 2.8);
      emCirc(g, 0, -1, 3, EM_RED, 1.8); emCirc(g, -11, 0, 2.2, EM_BLUE, 1.6); emCirc(g, 11, 0, 2.2, EM_GREEN, 1.6);
      emSpark(g, -14, -12, 3 + Math.sin(t * 6) * 1.5, '#ffffff', 1.2);
      g.restore();
    },
  },
  headphones: {
    f: (g, t) => {
      emLine(g, 4.5); g.beginPath(); g.arc(0, 2, 33, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.strokeStyle = EM_PINK; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 2, 33, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      const b = emBounce(t, 2.4) * 1.5;
      emBox(g, -40, -6 - b, 12, 20, 5, EM_PINK, 2.8); emBox(g, 28, -6 - b, 12, 20, 5, EM_PINK, 2.8);
    },
  },
  badge: {
    f: (g, t, e) => {
      g.save(); g.translate(16, 22); g.rotate(-0.2);
      emPoly(g, [[-9, -11], [9, -11], [9, 2], [0, 11], [-9, 2]], EM_BLUE, 2.6);
      emStar(g, 0, -2, 4.6, EM_GOLD2, 1.4);
      emHand(g, 2, 15, 'fist', EM_HANDS[e.who], 0, 0.85);
      g.restore();
    },
  },
  goldboot: {
    f: (g, t, e) => {
      g.save(); g.translate(26, -18 - emBounce(t, 1) * 4); g.rotate(-0.35);
      g.beginPath(); g.moveTo(-10, -12); g.lineTo(2, -12); g.lineTo(3, -2); g.quadraticCurveTo(18, 0, 16, 8); g.lineTo(-10, 8); g.closePath(); emFS(g, EM_GOLD, 2.8);
      g.fillStyle = EM_GOLD2; g.beginPath(); g.moveTo(-6, -8); g.lineTo(0, -8); g.lineTo(0, 2); g.lineTo(-6, 2); g.closePath(); g.fill();
      emSpark(g, 10, -10, 4 + Math.sin(t * 7) * 2, '#ffffff', 1.4);
      g.restore();
      emHand(g, 26, -2 - emBounce(t, 1) * 4, 'fist', EM_HANDS[e.who], 0, 1);
    },
  },
  trophy: {
    f: (g, t, e) => {
      const lift = emBounce(t, 1.6) * 4;
      g.save(); g.translate(0, -36 - lift);
      emLine(g, 3); g.beginPath(); g.arc(-15, -4, 6, Math.PI * 0.5, Math.PI * 1.5); g.moveTo(15, 2); g.arc(15, -4, 6, Math.PI * 0.5, -Math.PI * 0.5, true); g.stroke();
      g.beginPath(); g.moveTo(-14, -12); g.lineTo(14, -12); g.quadraticCurveTo(14, 8, 0, 10); g.quadraticCurveTo(-14, 8, -14, -12); g.closePath(); emFS(g, EM_GOLD, 2.8);
      emBox(g, -3, 9, 6, 8, 1, EM_GOLD, 2.4); emBox(g, -10, 16, 20, 6, 2, '#a8761a', 2.4);
      emSpark(g, -6, -6, 3 + Math.sin(t * 6) * 1.4, '#ffffff', 1.2);
      g.restore();
      emHand(g, -20, -16 - lift, 'fist', EM_HANDS[e.who], 0.2, 1); emHand(g, 20, -16 - lift, 'fist', EM_HANDS[e.who], -0.2, 1);
    },
  },
  bicycle: {
    wf: (g, t) => {
      const u = emCycle(t, 2.2);
      if (u < 0.45) { emBall(g, -20 + u * 40, -46 + u * 20, 7, u * 8); }
      else { const k = (u - 0.45) / 0.55; const x = 2 + k * 44, y = -36 - k * 8; emLine(g, 2.4); g.beginPath(); for (let i = 1; i <= 3; i++) { g.moveTo(x - 10 - i * 5, y + i * 3 - 3); g.lineTo(x - 20 - i * 5, y + i * 3 - 3); } g.stroke(); emBall(g, x, y, 7, k * 20); }
    },
  },
  rocket: {
    b: (g, t) => {
      for (let i = 0; i < 3; i++) {
        const f = emCycle(t * 3 + i * 0.33, 1);
        emFlame(g, -30 - f * 10, 4 + (i - 1) * 10, 9 * (1 - f * 0.4), 22 * (1 - f * 0.3), i === 1 ? EM_GOLD2 : EM_ORANGE, 2.2);
      }
    },
    wb: (g, t) => {
      emLine(g, 2.4); g.beginPath(); for (let i = 0; i < 4; i++) { const y = -30 + i * 20, x = -48 + emCycle(t * 2 + i * 0.25, 1) * -10; g.moveTo(x + 18, y); g.lineTo(x, y); } g.stroke();
    },
  },
  iceblock: {
    wf: (g, t) => {
      g.fillStyle = 'rgba(150, 215, 255, 0.45)'; emRR(g, -40, -38, 80, 86, 8); g.fill();
      emLine(g, 3); g.strokeStyle = '#3f8fd0'; g.stroke();
      g.fillStyle = 'rgba(255, 255, 255, 0.7)'; g.beginPath(); g.moveTo(-34, -32); g.lineTo(-20, -32); g.lineTo(-34, -14); g.closePath(); g.fill();
      for (const [x, h] of [[-26, 8], [-6, 12], [16, 7]]) emPoly(g, [[x - 4, 48], [x + 4, 48], [x, 48 + h]], '#c8ecff', 1.8);
      emSpark(g, 30, -30, 4 + Math.sin(t * 5) * 2, '#ffffff', 1.4);
    },
  },
  cape: {
    b: (g, t) => {
      g.beginPath(); g.moveTo(-22, 14);
      for (let i = 0; i <= 8; i++) { const x = -24 - i * 2.2, y = 14 + i * 4 + Math.sin(t * 7 + i * 0.7) * (i * 0.6); g.lineTo(x, y); }
      g.lineTo(26, 46 + Math.sin(t * 7) * 2);
      g.lineTo(22, 14); g.closePath(); emFS(g, EM_RED, 2.8);
      emStar(g, -28, 34, 6, EM_GOLD2, 1.6);
    },
  },
  wizard: {
    f: (g, t, e) => {
      g.save(); g.translate(0, -20);
      emPoly(g, [[-26, 2], [26, 2], [6, -32 + Math.sin(t * 2) * 2], [-4, -29]], EM_PURPLE, 2.8);
      emBox(g, -28, -2, 56, 8, 4, '#6b2fbf', 2.6);
      emStar(g, -6, -14, 4, EM_GOLD2, 1.4); emStar(g, 8, -22, 3, EM_GOLD2, 1.2);
      g.restore();
      g.save(); g.translate(28, 20); g.rotate(-0.5 + Math.sin(t * 4) * 0.25);
      emLine(g, 3.4); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke();
      g.strokeStyle = '#8a5a32'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke();
      emStar(g, 0, -28, 6, EM_GOLD2, 1.8, t * 2);
      emHand(g, 0, 2, 'fist', EM_HANDS[e.who], 0, 0.9);
      g.restore();
    },
  },
  moon: { wb: (g) => { g.save(); g.translate(28, -30); g.beginPath(); g.arc(0, 0, 14, 0.6, EM_TAU - 0.6); g.arc(8, -4, 11, EM_TAU - 0.9, 0.9, true); g.closePath(); emFS(g, '#fff2a8', 2.6); g.restore(); } },
  chain: {
    f: (g, t) => {
      emLine(g, 4); g.strokeStyle = EM_INK; g.beginPath(); g.arc(0, 4, 26, 0.5, Math.PI - 0.5); g.stroke();
      g.strokeStyle = EM_GOLD; g.lineWidth = 2.2; g.setLineDash([3, 2]); g.beginPath(); g.arc(0, 4, 26, 0.5, Math.PI - 0.5); g.stroke(); g.setLineDash([]);
      g.save(); g.translate(0, 34); g.rotate(Math.sin(t * 3) * 0.15);
      emCirc(g, 0, 0, 8, EM_GOLD, 2.6); emStar(g, 0, 0, 4.4, EM_GOLD2, 1.4);
      g.restore();
    },
  },
  goldgloves: { f: (g, t, e) => EM_PROPS.gloves.f(g, t, e) },
  planet: {
    b: (g, t) => { g.save(); g.rotate(-0.35); emLine(g, 5); g.beginPath(); g.ellipse(0, 4, 46, 12, 0, Math.PI, EM_TAU); g.stroke(); g.strokeStyle = EM_PURPLE; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, 4, 46, 12, 0, Math.PI, EM_TAU); g.stroke(); g.restore(); },
    f: (g, t) => { g.save(); g.rotate(-0.35); emLine(g, 5); g.beginPath(); g.ellipse(0, 4, 46, 12, 0, 0, Math.PI); g.stroke(); g.strokeStyle = EM_PURPLE; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, 4, 46, 12, 0, 0, Math.PI); g.stroke(); emCirc(g, Math.cos(t * 2) * 46, 4 + Math.sin(t * 2) * 12, 3.2, EM_GOLD2, 1.6); g.restore(); },
  },
  wings: {
    b: (g, t) => {
      const flap = Math.sin(t * 5) * 0.22;
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 18, 6); g.rotate(s * flap); g.scale(s, 1);
        for (let i = 0; i < 4; i++) emFlame(g, 14 + i * 7, 4 - i * 4, 9, 30 - i * 2, i % 2 ? EM_GOLD2 : EM_ORANGE, 2.4);
        g.restore();
      }
    },
  },
  firebreath: {
    wf: (g, t) => {
      for (let i = 0; i < 5; i++) {
        const u = emCycle(t * 2.2 + i * 0.2, 1), x = 22 + u * 22, y = 18 + Math.sin(u * 6 + i) * 3;
        g.save(); g.translate(x, y); g.rotate(Math.PI / 2);
        emFlame(g, 0, 6, 7 + u * 5, 12 + u * 8, i % 2 ? EM_GOLD2 : EM_ORANGE, 2.2);
        g.restore();
      }
    },
  },
  clock: {
    wb: (g, t) => {
      g.save(); g.translate(30, -30);
      emCirc(g, -9, -12, 5, EM_RED, 2.2); emCirc(g, 9, -12, 5, EM_RED, 2.2);
      emCirc(g, 0, 0, 15, '#ffffff', 2.8);
      emLine(g, 2.6); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -10); g.moveTo(0, 0); g.lineTo(7, 3); g.stroke();
      g.restore();
    },
  },
};

/* ------------------------------------------------------------------ effects (b: behind everything, f: in front) */
const EM_FX = {
  steam: { f: (g, t) => { for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const u = emCycle(t + i * 0.45 + (s > 0 ? 0.2 : 0), 0.9); g.globalAlpha = 1 - u; emCloud(g, s * (24 + u * 6), -24 - u * 22, 0.32 + u * 0.18, '#ffffff', 2); g.globalAlpha = 1; } } },
  zzz: { f: (g, t) => { for (let i = 0; i < 3; i++) { const u = emCycle(t + i * 0.6, 1.8); g.globalAlpha = Math.min(1, (1 - u) * 1.6); emText(g, 'Z', 22 + u * 18, -22 - u * 26, 9 + u * 8, '#ffffff', 0.2); g.globalAlpha = 1; } } },
  sweat: { f: (g, t) => { const u = emCycle(t, 1.2); emDrop(g, 28, -12 + u * 16, 3.6, '#7fd6ff', 2); } },
  stars: { f: (g, t) => { for (let i = 0; i < 3; i++) { const a = t * 3 + (i * EM_TAU) / 3; emStar(g, Math.cos(a) * 30, -30 + Math.sin(a) * 7, 5, EM_GOLD2, 1.8, a); } } },
  hearts: { f: (g, t) => { for (let i = 0; i < 3; i++) { const u = emCycle(t + i * 0.5, 1.5); g.globalAlpha = Math.min(1, (1 - u) * 1.8); emHeart(g, (i - 1) * 24 + Math.sin(u * 6) * 4, -20 - u * 30, 4 + u * 3, EM_RED, 1.8); g.globalAlpha = 1; } } },
  q: { f: (g, t) => { const s = 1 + emBounce(t, 1.4) * 0.2; g.save(); g.translate(32, -34); g.scale(s, s); emText(g, '?', 0, 0, 22, EM_GOLD2, 0.15); g.restore(); } },
  bang: { f: (g, t) => { const u = emCycle(t, 1.4), s = u < 0.2 ? 0.6 + u * 3 : 1.2 - Math.min(0.2, (u - 0.2)); g.save(); g.translate(-33, -30); g.scale(s, s); emText(g, '!', 0, 0, 26, EM_RED, -0.15); g.restore(); } },
  sparkle: { f: (g, t) => { const P = [[-34, -26], [34, -20], [-30, 30], [36, 26]]; P.forEach(([x, y], i) => emSpark(g, x, y, 3 + Math.max(0, Math.sin(t * 5 + i * 1.7)) * 5, i % 2 ? EM_GOLD2 : '#ffffff', 1.5)); } },
  rings: { f: (g, t) => { for (let i = 0; i < 3; i++) { const u = emCycle(t + i * 0.3, 0.9); g.globalAlpha = 1 - u; emLine(g, 2.6); g.beginPath(); g.arc(28, 14, 6 + u * 18, -0.8, 0.8); g.stroke(); g.globalAlpha = 1; } } },
  notes: {
    f: (g, t) => {
      for (let i = 0; i < 3; i++) {
        const u = emCycle(t + i * 0.55, 1.6), x = (i % 2 ? 30 : -32) + Math.sin(u * 7) * 4, y = -10 - u * 34;
        g.globalAlpha = Math.min(1, (1 - u) * 1.8);
        emEll(g, x, y, 4.2, 3.2, -0.4, i % 2 ? EM_PURPLE : EM_BLUE, 1.8);
        emLine(g, 2.2); g.beginPath(); g.moveTo(x + 3.6, y - 1); g.lineTo(x + 3.6, y - 14); g.quadraticCurveTo(x + 9, y - 11, x + 8, y - 6); g.stroke();
        g.globalAlpha = 1;
      }
    },
  },
  rain: { f: (g, t) => { for (let i = 0; i < 6; i++) { const u = emCycle(t + i * 0.17, 0.7); emDrop(g, -22 + i * 9, -32 + u * 76, 2.2, '#7fd6ff', 1.4); } } },
  snow: { f: (g, t) => { for (let i = 0; i < 7; i++) { const u = emCycle(t * 0.6 + i * 0.143, 1); emStar(g, -40 + i * 13 + Math.sin(u * 6 + i) * 4, -46 + u * 96, 3.4, '#ffffff', 1.2, u * 4, 6, 0.42); } } },
  coins: { f: (g, t) => { for (let i = 0; i < 5; i++) { const u = emCycle(t * 0.9 + i * 0.2, 1); const x = -36 + i * 18; g.save(); g.translate(x, -50 + u * 100); g.scale(Math.cos(u * 12), 1); emCirc(g, 0, 0, 5, EM_GOLD, 1.8); g.restore(); } } },
  bigtears: {
    f: (g, t) => {
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const u = emCycle(t + i * 0.25, 1), x = s * (12 + u * 30), y = -2 - Math.sin(u * Math.PI) * 18 + u * 30;
        emDrop(g, x, y, 2.8 * (1 - u * 0.3), '#7fd6ff', 1.6);
      }
    },
  },
  smoke: { b: (g, t) => { for (let i = 0; i < 6; i++) { const a = t * 1.4 + (i * EM_TAU) / 6, u = emCycle(t + i * 0.3, 1.8); g.globalAlpha = 0.9 - u * 0.5; emCloud(g, Math.cos(a) * 34, 26 + Math.sin(a) * 10 - u * 10, 0.45 + u * 0.25, '#c9d2e4', 2); g.globalAlpha = 1; } } },
  speed: { b: (g, t) => { emLine(g, 2.6); g.strokeStyle = '#9aa3c7'; g.beginPath(); for (let i = 0; i < 5; i++) { const y = -28 + i * 14, x = -38 - emCycle(t * 2 + i * 0.2, 1) * 8; g.moveTo(x, y); g.lineTo(x - 10, y); } g.stroke(); } },
  bolt: { f: (g, t) => { const u = emCycle(t, 0.8); if (u < 0.55) { emBolt(g, -36, -24, 18, -0.3); } else emBolt(g, 36, -20, 18, 0.3); } },
  flash: { f: (g, t) => { const u = emCycle(t, 1.6); if (u < 0.18) { g.globalAlpha = 1 - u / 0.18; emStar(g, 28, -18, 30, '#ffffff', 0, 0, 8, 0.4); g.globalAlpha = 1; } } },
  confetti: {
    f: (g, t) => {
      for (let i = 0; i < 12; i++) {
        const u = emCycle(t * 0.7 + i * 0.083, 1), x = -44 + ((i * 37) % 88) + Math.sin(u * 8 + i) * 5, y = -52 + u * 104;
        g.save(); g.translate(x, y); g.rotate(u * 10 + i); g.fillStyle = EM_CONFETTI[i % EM_CONFETTI.length]; g.fillRect(-2.5, -4, 5, 8); g.restore();
      }
    },
  },
  fire: {
    b: (g, t) => {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI, f = Math.sin(t * 12 + i * 2) * 4;
        g.save(); g.translate(Math.cos(a) * 30, 6 + Math.sin(a) * 32); g.rotate(a + Math.PI / 2);
        emFlame(g, 0, 0, 12, 22 + f, i % 2 ? EM_GOLD2 : EM_ORANGE, 2.4);
        g.restore();
      }
    },
  },
  bigfire: {
    b: (g, t) => {
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * 0.85 + (i / 10) * Math.PI * 1.3, f = Math.sin(t * 13 + i * 2) * 5;
        g.save(); g.translate(Math.cos(a) * 30, 6 + Math.sin(a) * 32); g.rotate(a + Math.PI / 2);
        emFlame(g, 0, 0, 14, 24 + f, [EM_RED, EM_ORANGE, EM_GOLD2][i % 3], 2.4);
        g.restore();
      }
    },
    f: (g, t) => { for (let i = 0; i < 4; i++) { const u = emCycle(t + i * 0.25, 1); emFlame(g, -30 + i * 20, 48 - u * 12, 6, 12 * (1 - u), EM_GOLD2, 1.8); } },
  },
  frost: {
    f: (g, t) => {
      for (let i = 0; i < 5; i++) { const a = t * 0.8 + (i * EM_TAU) / 5; emStar(g, Math.cos(a) * 40, 4 + Math.sin(a) * 40, 4.5, '#d4f1ff', 1.4, a, 6, 0.4); }
      g.fillStyle = 'rgba(190, 235, 255, 0.85)'; emLine(g, 1.8);
      for (const [x, y, r] of [[-20, -18, 5], [22, -20, 4], [-24, 22, 4]]) { g.beginPath(); g.arc(x, y, r, 0, EM_TAU); g.fill(); g.stroke(); }
    },
  },
  disco: {
    b: (g, t) => {
      const cols = [EM_PINK, EM_BLUE, EM_GOLD2, EM_GREEN];
      for (let i = 0; i < 4; i++) {
        const a = t * 1.6 + (i * EM_TAU) / 4;
        g.globalAlpha = 0.45; g.fillStyle = cols[i]; g.beginPath(); g.moveTo(0, 4); g.arc(0, 4, 60, a - 0.18, a + 0.18); g.closePath(); g.fill(); g.globalAlpha = 1;
      }
    },
    f: (g, t) => { for (let i = 0; i < 4; i++) emSpark(g, Math.cos(t * 2 + i * 1.6) * 38, Math.sin(t * 2 + i * 1.6) * 38, 3 + Math.max(0, Math.sin(t * 6 + i)) * 4, '#ffffff', 1.3); },
  },
  aura: { b: (g, t) => { for (let i = 0; i < 3; i++) { const u = emCycle(t + i * 0.7, 2.1); g.globalAlpha = 0.6 * (1 - u); emLine(g, 2.4); g.strokeStyle = '#7fd6ff'; g.beginPath(); g.arc(0, 4, 32 + u * 18, 0, EM_TAU); g.stroke(); g.globalAlpha = 1; } } },
  heartbreak: {
    f: (g, t) => {
      const u = emCycle(t, 1.8), split = u < 0.35 ? 0 : Math.min(1, (u - 0.35) * 3) * 5;
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * split, -44 + split * 0.6); g.rotate(s * split * 0.05);
        g.beginPath(); g.rect(s < 0 ? -20 : 0, -20, 20, 40); g.clip();
        emHeart(g, 0, 0, 10, EM_RED, 2.4);
        g.restore();
      }
      if (split > 0) { emLine(g, 2); g.beginPath(); g.moveTo(0, -52); g.lineTo(-2, -46); g.lineTo(2, -42); g.lineTo(-1, -36); g.stroke(); }
    },
  },
  explode: {
    f: (g, t) => {
      const u = emCycle(t, 1.6), s = u < 0.3 ? u / 0.3 : 1 - (u - 0.3) * 0.4;
      g.save(); g.translate(0, -36); g.scale(s, s);
      emStar(g, 0, 0, 22, EM_ORANGE, 2.6, t, 10, 0.55); emStar(g, 0, 0, 13, EM_GOLD2, 2, -t, 8, 0.55);
      g.restore();
    },
  },
  ghost: {},
  wind: {
    b: (g, t) => {
      emLine(g, 2.6); g.strokeStyle = '#9aa3c7';
      for (let i = 0; i < 4; i++) { const a = -t * 4 + (i * EM_TAU) / 4; g.beginPath(); g.arc(0, 4, 38 + (i % 2) * 6, a, a + 1.4); g.stroke(); }
    },
  },
  spotlight: {
    b: (g, t) => {
      g.fillStyle = 'rgba(255, 242, 168, 0.75)'; g.beginPath(); g.moveTo(-8, -52); g.lineTo(8, -52); g.lineTo(44, 50); g.lineTo(-44, 50); g.closePath(); g.fill();
    },
    f: (g, t) => { for (let i = 0; i < 3; i++) emSpark(g, -30 + i * 30, -32 + (i % 2) * 8, 3 + Math.max(0, Math.sin(t * 6 + i * 2)) * 4, EM_GOLD2, 1.4); },
  },
  fireworks: {
    b: (g, t) => {
      const spots = [[-30, -30], [32, -26], [0, -44]];
      spots.forEach(([x, y], i) => {
        const u = emCycle(t + i * 0.45, 1.35);
        if (u > 0.7) return;
        const r = 4 + u * 20, col = [EM_PINK, EM_GOLD2, EM_BLUE][i];
        g.globalAlpha = 1 - u / 0.7; g.strokeStyle = col; g.lineWidth = 2.6;
        g.beginPath(); for (let j = 0; j < 8; j++) { const a = (j * EM_TAU) / 8; g.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke();
        g.globalAlpha = 1;
      });
    },
  },
  bigbolt: {
    f: (g, t) => {
      const u = emCycle(t, 0.9);
      if (u < 0.12) { g.globalAlpha = 0.5; g.fillStyle = '#ffffff'; g.fillRect(-50, -50, 100, 100); g.globalAlpha = 1; }
      emBolt(g, -30, -18, 22, -0.25); emBolt(g, 32, -14, 20, 0.3);
      if (u < 0.5) emBolt(g, 0, -40, 16, 0.1);
    },
  },
  cosmos: {
    b: (g, t) => {
      for (let i = 0; i < 6; i++) emSpark(g, Math.cos(i * 1.9) * 40, Math.sin(i * 2.7) * 40, 2 + Math.max(0, Math.sin(t * 4 + i)) * 3, '#ffffff', 1.2);
      const a = t * 1.3;
      emCirc(g, Math.cos(a) * 42, 4 + Math.sin(a) * 16, 5, EM_PINK, 2);
      emCirc(g, Math.cos(a + 2.6) * 40, 4 + Math.sin(a + 2.6) * 14, 4, '#7fd6ff', 2);
    },
  },
};
