// The username filter.
//   node tools/namescan.js
//
// Two jobs that pull against each other: catch what it should, and never reject a real name.
// Both are checked here. The rude words are built up from pieces rather than written out, so
// this file can be read over someone's shoulder.
//
// The disguises below are the ones that actually got through before: a letter with an accent on
// it, and the letters other alphabets draw exactly the way ours are drawn. Everything a name is
// checked against gets boiled down to plain a-z first, and anything that is not a-z used to be
// simply deleted — so those letters vanished instead of becoming the letter they were imitating,
// and the word came out a letter short and matched nothing.
'use strict';
const path = require('path');
const { screenUsername, normalize } = require(path.join(__dirname, '..', 'server', 'moderation'));

const bad = [];
let checked = 0;
const t = (name, shouldPass, why) => {
  checked++;
  const r = screenUsername(name);
  const passed = !r;
  if (passed !== shouldPass) bad.push(`${passed ? 'ALLOWED' : 'blocked'} ${JSON.stringify(name)} (${why})`);
};

// ---- real names, including accented ones, must still get through
const fine = ['Scunthorpe', 'assassin', 'Cockburn', 'Shuttleworth', 'Penistone', 'Noah', 'Sophie', 'Phil',
  'Phoenix', 'Joseph', 'Stephanie', 'Jos\u00e9', 'Zo\u00eb', 'Bj\u00f6rn', 'Ren\u00e9e', 'M\u00fcller',
  '\u00c5sa', 'Fran\u00e7ois', 'Se\u00e1n', 'Bumblebee', 'Grasshopper', 'KAI2012', 'Mittens', 'Analyst'];
for (const n of fine) t(n, true, 'a real name');

// ---- a mild swear, written every way someone tries to sneak it past
const w = 's' + 'h' + 'i' + 't';
const dodges = [
  w,                                   // plain
  w.toUpperCase(),                     // shouting
  's' + 'h' + '\u00ed' + 't',          // accented i
  's' + 'h' + '\u0456' + 't',          // Cyrillic i
  '\u0455' + 'h' + 'i' + 't',          // Cyrillic s
  's' + 'h' + '1' + 't',               // one for i
  's' + 'h' + '!' + 't',               // bang for i
  's.h.i.t',                           // dotted
  's_h_i_t',                           // underscored
  'sh' + 'iiii' + 't',                 // stretched
  w + '69',                            // digits on the end
  '\uff53\uff48\uff49\uff54',          // full-width letters
];
for (const n of dodges) t(n, false, 'a swear in disguise');

// ---- and the ph-for-f reading
t('p' + 'h' + 'u' + 'c' + 'k', false, 'ph standing in for f');

// ---- shape rules still hold
// length and which characters are allowed are server.js's job (validateUsername), not this file's
t('', false, 'nothing but spaces or symbols');

console.log(`checked ${checked} names`);
if (bad.length) { console.log('WRONG ANSWERS:'); for (const b of bad) console.log('  ' + b); }
else console.log('  ok   real names get through, every disguise is caught');

// show the folding works, using a harmless word
console.log('\nfolding check (harmless word):');
for (const [raw, label] of [['Jos\u00e9', 'accented'], ['\u0430bc', 'Cyrillic a'], ['\uff41bc', 'full-width a']]) {
  console.log(`  ${label.padEnd(14)} ${JSON.stringify(raw)} -> ${JSON.stringify(normalize(raw))}`);
}
process.exit(bad.length ? 1 : 0);
