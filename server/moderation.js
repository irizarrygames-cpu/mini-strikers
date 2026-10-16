// Username screening. This exists because the game is handed round a school: a name
// chosen once shows up on the leaderboard, on the table in front of three strangers,
// and in everyone's friends list, and until now there was no way to take it back.
//
// Two jobs, and they pull in opposite directions:
//   - catch the obvious stuff, including the usual letter-swapping dodges
//   - do not reject an innocent name because a rude word hides inside it
//
// So severe terms are matched anywhere in the name, while ordinary swearing has to
// stand as its own word. That is the classic trap: "Scunthorpe" and "assassin" and
// "Cockburn" are all real names that a naive substring check throws out.

// Letter-swapping dodges collapse back to plain letters before matching.
const LEET = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '*': '', '.': '', '-': '', '_': '',
};

// Letters other alphabets draw the same way ours are drawn. Without these a name written with
// the Cyrillic a, e, o, p, c, y, x (identical on screen to the Latin ones) was boiled down to
// nothing and sailed past every list.
const LOOKALIKE = {
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
  '\u0432': 'b', '\u043a': 'k', '\u043c': 'm', '\u043d': 'h', '\u0442': 't', '\u0456': 'i', '\u0458': 'j',
  '\u03b1': 'a', '\u03b5': 'e', '\u03b9': 'i', '\u03bf': 'o', '\u03c1': 'p', '\u03c4': 't', '\u03c5': 'u', '\u03c7': 'x',
  '\u0455': 's', '\u04bb': 'h', '\u0501': 'd', '\u051b': 'q', '\u051d': 'w', '\u0475': 'v', '\u0461': 'w',
  '\u0433': 'r', '\u043b': 'n', '\u043f': 'n', '\u0437': 'z', '\u0261': 'g', '\u0282': 's', '\u0493': 'f',
  '\u03bd': 'v', '\u03ba': 'k', '\u03c3': 's', '\u03bc': 'm', '\u03b7': 'n', '\u03b2': 'b', '\u03b3': 'y',
  '\u0131': 'i', '\u0142': 'l', '\u00f8': 'o', '\u00e6': 'ae', '\u00df': 'ss', '\u0153': 'oe',
};

// Boil a name down to plain letters before anything looks at it. The order matters: pull the
// accents off first, bring the lookalikes across, and only then drop whatever is left over —
// otherwise an accented or Cyrillic letter is deleted rather than becoming the letter it was
// pretending to be, and the word comes out a letter short and matches nothing.
function fold(name) {
  let s = String(name || '');
  try { s = s.normalize('NFKD'); } catch (e) { /* an engine without it: carry on unfolded */ }
  s = s.replace(/[\u0300-\u036f]/g, ''); // the accents themselves, now detached
  s = s.toLowerCase();
  let out = '';
  for (const ch of s) out += (ch in LOOKALIKE) ? LOOKALIKE[ch] : ch;
  return out;
}

function normalize(name) {
  const lower = fold(name);
  let out = '';
  for (const ch of lower) out += (ch in LEET) ? LEET[ch] : ch;
  return out.replace(/[^a-z]/g, '');
}

// Runs of the same letter are a dodge too ("shiiiit"), so squash them for a second pass.
function squash(s) { return s.replace(/(.)\1+/g, '$1'); }

// Matched anywhere in the name. Slurs and sexual terms -- there is no innocent
// username these turn up inside by accident.
const BANNED_ANYWHERE = [
  'nigger', 'nigga', 'faggot', 'fagget', 'retard', 'chink', 'spic', 'kike', 'wetback',
  'tranny', 'paki', 'coon', 'gook', 'raghead', 'towelhead',
  'rape', 'rapist', 'pedo', 'paedo', 'pedophile', 'molest', 'incest',
  'whore', 'slut', 'blowjob', 'handjob', 'creampie', 'cumshot', 'dildo',
  'hentai', 'porn', 'pornhub', 'xvideos', 'onlyfans', 'nude', 'nudes', 'boobs', 'titties',
  'jizz', 'wank', 'bukkake', 'fisting', 'buttplug', 'deepthroat',
  'hitler', 'nazi', 'kkk', 'holocaust', 'isis', 'alqaeda',
  'suicide', 'killyourself', 'kysyourself', 'selfharm', 'cutyourself',
];

// Must stand as its own word. These appear inside perfectly ordinary names.
const BANNED_WORDS = [
  'fuck', 'fucker', 'fucking', 'shit', 'shitter', 'bitch', 'bastard', 'arsehole',
  'asshole', 'ass', 'arse', 'dick', 'cock', 'penis', 'vagina', 'pussy', 'balls',
  'tits', 'boob', 'sex', 'sexy', 'horny', 'orgasm', 'masturbate', 'cum',
  'piss', 'crap', 'turd', 'fart', 'poop', 'douche', 'twat', 'wanker', 'prick',
  'hoe', 'thot', 'simp', 'skank', 'milf', 'gay', 'lesbo', 'homo', 'queer',
  'weed', 'cocaine', 'heroin', 'meth', 'crackhead', 'drugs', 'vape',
  'kill', 'murder', 'die', 'death', 'blood', 'gore', 'bomb', 'terrorist', 'shooter',
];

// Caught anywhere, but skipped when the name contains one of the innocent words
// these hide inside. Scunthorpe is the textbook case; 'analysis' is the other one
// everybody trips over.
const BANNED_UNLESS_INNOCENT = ['cunt', 'anal'];
const INNOCENT_HOSTS = ['scunthorpe', 'analy', 'analog', 'banal', 'canal', 'penal', 'arsenal', 'manual'];

// Nobody gets to look like the game itself or like staff.
const RESERVED = [
  'admin', 'administrator', 'moderator', 'mod', 'staff', 'owner', 'official',
  'system', 'server', 'root', 'support', 'help', 'ministrikers', 'strikers',
  'bot', 'robot', 'npc', 'player', 'guest', 'anonymous', 'null', 'undefined',
  'everyone', 'here',
];

// Insults are usually built as one word: fuckface, dickhead, asshat. A word-only
// term therefore also matches when the WHOLE name is that term plus one of these --
// still never as a substring, so Dickinson and Hancock stay fine.
const SUFFIXES = ['', 's', 'z', 'y', 'ie', 'er', 'ers', 'ed', 'ing', 'face', 'head', 'hole',
  'hat', 'bag', 'wad', 'tard', 'boy', 'girl', 'lord', 'master', 'god', 'man', 'brain', 'stain',
  'r', 'rs', 'a', 'o', 'in', 'n', 'x', 'xx', 'xd', '69', '420'];
const PREFIXES = ['', 'big', 'lil', 'little', 'the', 'ur', 'your', 'my', 'i', 'im', 'xx', 'x'];

// People swap letters that look or sound alike. Each variant is screened separately.
const SWAPS = [
  t => t.replace(/v/g, 'u'),     // fvck
  t => t.replace(/ph/g, 'f'),    // phuck
  t => t.replace(/ck/g, 'k'),    // fuk
  t => t.replace(/z/g, 's'),     // azzhole
  t => t.replace(/x/g, 'ks'),    // dix
];

// Every step is kept, not just the end of the chain: applying them in sequence turned
// 'fvck' into 'fuck' and then straight on into 'fuk', so the match was gone by the
// time anything looked at it.
function variants(flat) {
  const out = new Set([flat, squash(flat)]);
  // 'ph' read as 'f'. An extra reading, not a replacement, so an ordinary name is only caught
  // if it genuinely spells something out that way.
  if (flat.includes('ph')) { const f = flat.split('ph').join('f'); out.add(f); out.add(squash(f)); }
  let cur = flat;
  for (const swap of SWAPS) {
    cur = swap(cur);
    out.add(cur);
    out.add(squash(cur));
    out.add(swap(flat));         // and the swap on its own
  }
  return [...out].filter(Boolean);
}

// A name is split on the separators people actually use, so 'fuck_face' is caught by
// the whole-word list without 'assassin' being caught with it.
function wordsIn(raw) {
  return String(raw || '').toLowerCase().split(/[^a-z0-9]+/).map(normalize).filter(Boolean);
}

// Listing every insult somebody can build is whack-a-mole -- 'fuckwit' walked past a
// suffix list containing 'face', 'head' and 'boy'. For terms that begin no innocent
// English word, anything STARTING with them is out, whatever got stuck on the end.
// This list is deliberately short: 'shit' would take out shitake, and 'dick' would
// take out Dickinson, so those stay on the suffix rule.
// 'slut' and 'whore' are left off: Slutsky and Whorley are real surnames, and the
// suffix rule still catches the actual insults built from them.
const STRONG_STARTS = ['fuck', 'bitch', 'wank', 'twat', 'cunt', 'nigg'];

function matchesWordTerm(word, term) {
  if (STRONG_STARTS.includes(term) && word.startsWith(term)) return true;
  for (const pre of PREFIXES) {
    if (!word.startsWith(pre)) continue;
    const rest = word.slice(pre.length);
    for (const suf of SUFFIXES) {
      if (rest === term + suf) return true;
    }
  }
  return false;
}

function screenUsername(raw) {
  const flat = normalize(raw);
  if (!flat) return 'Pick a name with some letters in it';

  // Digits normally stand in for letters (0 -> o), but they are also just tacked on
  // the end: 'shit69' became 'shitgg' and sailed through. So try the name with the
  // digits dropped entirely as well.
  const flatNoDigits = normalize(String(raw || '').replace(/[0-9]/g, ''));
  const forms = [...new Set([...variants(flat), ...variants(flatNoDigits)])];

  for (const form of forms) {
    for (const term of BANNED_ANYWHERE) {
      if (form.includes(term)) return 'Pick a different name';
      // Only squash-match terms that stay distinctive when squashed. Without this,
      // 'kkk' collapses to 'k' and blocks every name with a K in it.
      const sq = squash(term);
      if (sq.length >= 5 && squash(form).includes(sq)) return 'Pick a different name';
    }
    if (!INNOCENT_HOSTS.some(h => form.includes(h))) {
      for (const term of BANNED_UNLESS_INNOCENT) {
        if (form.includes(term)) return 'Pick a different name';
      }
    }
  }

  // Whole words only, plus the whole name with its separators taken out.
  const words = new Set(wordsIn(raw));
  forms.forEach(f => words.add(f));
  for (const w of words) {
    for (const term of BANNED_WORDS) {
      if (matchesWordTerm(w, term)) return 'Pick a different name';
    }
  }

  // Reserved names are checked against the name as actually typed. Checking the
  // digit-stripped form too would turn down 'player1', which is nobody's problem.
  if (RESERVED.includes(flat) || wordsIn(raw).some(w => RESERVED.includes(w))) {
    return 'That name is reserved';
  }
  return null;
}

module.exports = { screenUsername, normalize };
