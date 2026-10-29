// Every word the game shows, in every language.
//   node tools/i18nscan.js            check: every line has every language, with the same holes
//   node tools/i18nscan.js --keys     print every English line the game uses (one JSON array)
//
// The English lines come from three places:
//   * the game's own code: every tl('…') and tlN(n, '…', '…') in js/
//   * the page: every piece of text, placeholder, title and aria-label in index.html
//   * the server: every message it sends a player (msg: '…', and the rules a name or a password
//     breaks), with the names it puts in turned into holes: `${name} is offline` -> '{0} is offline'
// Plus the quick chat lines (QUICK_CHAT), which are shown through tl() wherever they are drawn.
//
// For each language file js/lang-<id>.js it checks: nothing missing; nothing extra that the game no
// longer says; the same holes ({0}, {n}, {player}…) in the same number; the same spaces at either
// end (lines that are glued onto others); every letter one the game's font has (Lilita One, latin and
// latin-ext); and nothing left in English by mistake (a line of three words or more identical to its
// English is allowed only when listed in SAME). Lines that are the same in a language are still
// written out in its file, so that a missing line always means one nobody has done.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LANGS = ['es', 'pt', 'fr', 'de', 'it'];

// Lines that are the same in some or all languages on purpose: keys on a keyboard, codes, "GG"…
const SAME = new Set(['WASD', 'SHIFT', 'SPACE', 'ESC', 'LMB', 'RMB', 'MMB', 'E', 'Q', 'F', 'T', 'GG', 'OK', 'VS', 'MVP', 'XP', 'RP', 'OVR',
  '{0} RP', '+{0} XP', '+1 RP', 'POSS %', 'ULT', 'PRO', 'GOAT', 'GOAT!', 'WOW!', 'OLE!', 'SIUUU!', 'HI-YAH!', 'SHH', 'ZERO G!', 'NOVA!',
  'TIKI-TAKA!', 'ELASTICO!', 'SOMBRERO!', 'ROULETTE!', 'CRUYFF!', 'AKKA!', 'Elastico', 'Sombrero', 'Roulette', 'Akka Flick', 'Matador',
  'Ninja', 'Robot', 'Samurai', 'Pharaoh', 'Sphinx', 'Ronin', 'Corsair', 'Oracle', 'Nova', 'Echo', 'Inferno', 'Magma', 'Galaxy', 'Titan', 'Zenith',
  'Onyx', 'Bastion', 'Tundra', 'Seraph', 'Eclipse', 'Comet', 'Tempo', 'Volley', 'Moonwalk', 'Floss', 'Griddy', 'Dab', 'Selfie', 'Limbo', 'Lasso',
  'Neon', 'Cyber', 'Camo', 'Volt', 'Prism', 'Nebula', 'Lava', 'Mint', 'Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Obsidian', 'Infinity', 'Royal', 'Classic',
  'Tornado', 'Mirage', 'Hologram', 'Confetti', 'Supernova', 'Aurora', 'Plasma', 'Spectre', 'Jetstream', 'Tsunami', 'Firework', 'Circuit', 'Starlight',
  'Sandstorm', 'Lagoon', 'Toxic', 'Shadow', 'Golden', 'Electric', 'Fire', 'Rainbow', 'Celestial', 'Dragonfire', 'Black Hole', 'Phantom', 'Venom']);

// ------------------------------------------------------------------ JS string literals
const lit = (s) => vm.runInNewContext(s); // a JS literal, read as JS reads it
const STR = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"`;

function clientKeys() {
  const keys = new Map(); // key -> files
  const add = (k, f) => { if (!keys.has(k)) keys.set(k, new Set()); keys.get(k).add(f); };
  const dir = path.join(ROOT, 'js');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js') || f.startsWith('lang-') || f === 'i18n.js') continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(new RegExp(String.raw`\btl\(\s*(${STR})`, 'g'))) add(lit(m[1]), f);
    for (const m of src.matchAll(new RegExp(String.raw`\btlN\([^,]+,\s*(${STR})\s*,\s*(${STR})`, 'g'))) { add(lit(m[1]), f); add(lit(m[2]), f); }
    // the quick chat: English in QUICK_CHAT, shown through tl()
    const qc = src.match(/const QUICK_CHAT = (\[[^\]]*\])/);
    if (qc) for (const k of lit(qc[1])) add(k, f);
  }
  return keys;
}

// ------------------------------------------------------------------ the page
function htmlKeys() {
  const keys = new Map();
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');
  const add = (k) => { if (!keys.has(k)) keys.set(k, new Set(['index.html'])); };
  // the browser hands I18N.apply the text as shown: &#9656; is ▸
  const decode = (s) => s.replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  // stand-ins the game always writes over before anyone sees them (a name, a country, a multiplier)
  const PLACEHOLDER = new Set(['Mini Strikers', 'Street', 'STREET', 'ROCKETS', 'CLUB', 'HARD ×1.3', '+0 XP']);
  for (const m of src.matchAll(/>([^<]+)</g)) {
    const k = decode(m[1]).replace(/\s+/g, ' ').trim();
    if (/[A-Za-z]{2,}/.test(k) && !PLACEHOLDER.has(k)) add(k);
  }
  for (const m of src.matchAll(/\b(?:placeholder|title|aria-label)="([^"]*)"/g)) if (/[A-Za-z]{2,}/.test(m[1])) add(decode(m[1]));
  return keys;
}

// ------------------------------------------------------------------ the server
// What the server says to players. Templates become lines with holes; a few lines are built by
// joining a piece onto a word (the format), listed by hand.
const SERVER_EXTRA = ['Too many players for {0}', 'Too many of you for {0}'];
function serverKeys() {
  const keys = new Map();
  const add = (k, f) => { if (!keys.has(k)) keys.set(k, new Set()); keys.get(k).add(f); };
  const files = ['server.js', ...fs.readdirSync(path.join(ROOT, 'server')).filter((f) => f.endsWith('.js')).map((f) => 'server/' + f)];
  const hole = (tpl) => { let n = 0; return tpl.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, () => '{' + n++ + '}'); };
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(new RegExp(String.raw`\bmsg: (${STR})`, 'g'))) add(lit(m[1]), f);
    for (const m of src.matchAll(/\bmsg: `([^`]*)`/g)) add(hole(m[1]), f);
    // the rules a username or a password breaks, and why an account is banned
    for (const m of src.matchAll(new RegExp(String.raw`\breturn (${STR});`, 'g'))) {
      const s = lit(m[1]);
      if (/^[A-Z][a-z]/.test(s) && / /.test(s)) add(s, f);
    }
    for (const m of src.matchAll(new RegExp(String.raw`\? (${STR})\s*:\s*(${STR})\)`, 'g'))) for (const x of [m[1], m[2]]) { const s = lit(x); if (/^This account/.test(s)) add(s, f); }
  }
  for (const k of SERVER_EXTRA) add(k, 'server/game.js');
  // ones that are not words: protocol messages nobody sees
  for (const k of ['Use POST', 'Unknown endpoint', 'Bad request', 'not saved', 'Too many of you for ', 'Too many players for ']) keys.delete(k);
  return keys;
}

function allKeys() {
  const out = new Map();
  for (const [kind, map] of [['client', clientKeys()], ['page', htmlKeys()], ['server', serverKeys()]]) {
    for (const [k, files] of map) {
      if (!out.has(k)) out.set(k, { kinds: new Set(), files: new Set() });
      out.get(k).kinds.add(kind);
      for (const f of files) out.get(k).files.add(f);
    }
  }
  return out;
}

// ------------------------------------------------------------------ checks
const holes = (s) => (s.match(/\{\w+\}/g) || []).slice().sort().join(',');
// what Lilita One draws (latin + latin-ext), plus the punctuation the game uses
const okChar = (ch) => {
  const c = ch.codePointAt(0);
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0x24f) || '‘’“”–—…•·×★☆✓▲▼▸✕€№'.includes(ch);
};

function loadLang(id) {
  const file = path.join(ROOT, 'js', `lang-${id}.js`);
  if (!fs.existsSync(file)) return null;
  const box = { I18N: { dict: {}, add(l, w) { this.dict[l] = Object.assign(this.dict[l] || {}, w); } } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), box, { filename: file });
  return box.I18N.dict[id] || {};
}

function check() {
  const keys = allKeys();
  let fails = 0;
  const problem = (s) => { fails++; if (fails <= 200) console.log('FAIL ' + s); };
  console.log(`${keys.size} English lines (${[...keys.values()].filter((v) => v.kinds.has('server')).length} from the server, ${[...keys.values()].filter((v) => v.kinds.has('page')).length} on the page)`);
  for (const id of LANGS) {
    const d = loadLang(id);
    if (!d) { problem(`${id}: js/lang-${id}.js is missing`); continue; }
    let missing = 0, same = 0;
    for (const k of keys.keys()) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) { missing++; if (missing <= 15) problem(`${id}: no translation for ${JSON.stringify(k)}`); continue; }
      const v = d[k];
      if (typeof v !== 'string' || !v.trim()) { problem(`${id}: empty translation for ${JSON.stringify(k)}`); continue; }
      if (holes(v) !== holes(k)) problem(`${id}: holes differ for ${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
      if ((k.match(/^\s*/)[0].length > 0) !== (v.match(/^\s*/)[0].length > 0) || (k.match(/\s*$/)[0].length > 0) !== (v.match(/\s*$/)[0].length > 0)) problem(`${id}: spaces at the ends differ for ${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
      const bad = [...v].filter((ch) => !okChar(ch));
      if (bad.length) problem(`${id}: the font has no ${JSON.stringify(bad.join(''))} in ${JSON.stringify(v)}`);
      // markup carried through the same
      const tags = (s) => (s.match(/<[^>]+>|&[a-z]+;/g) || []).join('');
      if (tags(v) !== tags(k)) problem(`${id}: markup differs for ${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
      // a line of three words or more the same as the English was missed; one or two can be right
      // as they are (a country, a name, a word every language borrows: CHAT, MENU, SPRINT)
      if (v === k && (k.match(/[A-Za-z]{2,}/g) || []).length >= 3 && !SAME.has(k)) { same++; if (same <= 40) problem(`${id}: left in English: ${JSON.stringify(k)}`); }
      // shouting stays shouting: an all-capitals line stays in capitals
      if (k === k.toUpperCase() && /[A-Z]{2,}/.test(k) && v !== v.toUpperCase()) problem(`${id}: not in capitals like the English: ${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
    }
    if (missing > 15) problem(`${id}: ${missing} lines missing in all`);
    if (same > 40) problem(`${id}: ${same} lines left in English in all`);
    const extra = Object.keys(d).filter((k) => !keys.has(k));
    if (extra.length) problem(`${id}: ${extra.length} lines the game no longer says, e.g. ${JSON.stringify(extra.slice(0, 5))}`);
    console.log(`${missing || same || extra.length ? '    ' : 'ok  '} ${id}: ${Object.keys(d).length} lines`);
  }
  console.log(fails ? `\n${fails} FAILED` : '\nevery language has every line');
  process.exit(fails ? 1 : 0);
}

if (require.main === module) {
  if (process.argv.includes('--keys')) {
    const keys = allKeys();
    console.log(JSON.stringify([...keys.entries()].map(([k, v]) => ({ k, kinds: [...v.kinds], files: [...v.files] })), null, 1));
  } else check();
}
module.exports = { allKeys, loadLang, LANGS };
