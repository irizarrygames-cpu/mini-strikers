'use strict';
const vm = require('vm'), fs = require('fs');
const els = new Map();
const el = (id) => els.get(id) || els.set(id, { id, textContent: '', offsetWidth: 1, classList: { add() {}, remove() {}, toggle() {} } }).get(id);
const spoken = [];
function SpeechSynthesisUtterance(text) { this.text = text; }
const sandbox = { console, Math, Set, Map, String, clearTimeout, setTimeout, SpeechSynthesisUtterance,
  Save: { data: { settings: { commentary: true, sfx: .8 } } },
  TEAMS: { blue: { name: 'SPAIN' }, red: { name: 'BRAZIL' } },
  $: el, window: { speechSynthesis: { pending: false, speaking: false, pending: false, speak: (u) => { spoken.push(u.text); if (u.onend) u.onend(); }, cancel() {}, getVoices: () => [{ name: 'Microsoft Ryan Online (Natural)', voiceURI: 'Ryan Natural', lang: 'en-GB', localService: false }] } },
};
vm.createContext(sandbox); vm.runInContext(fs.readFileSync('js/commentary.js', 'utf8'), sandbox);
const C = vm.runInContext('Commentary', sandbox); C.init(); C.unlock();
const player = (team, n, human = false) => ({ team, number: n, isHuman: human, name: human ? null : `${team}${n}`, stats: { goals: 0 } });
const a = player('blue', 10, true), b = player('blue', 7), c = player('blue', 9), r = player('red', 4);
const m = { ball: { owner: a, shot: null }, score: { blue: 0, red: 0 }, stats: { blue: { saves: 0, tackles: 0, skills: 0 }, red: { saves: 0, tackles: 0, skills: 0 } }, goals: [], players: [a,b,c,r], phase: 'play', time: 80, trailed: {} };
let fails = 0; const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); if (!ok) fails++; };
C.update(m, .016); C.cd = 0; m.ball.owner = b; C.update(m, .7); check('first completed pass called', /PASS ONE/.test(el('commentary-line').textContent), el('commentary-line').textContent);
C.cd = 0; m.ball.owner = c; C.update(m, .7); check('second completed pass escalates', /PASS TWO/.test(el('commentary-line').textContent), el('commentary-line').textContent);
C.cd = 0; m.ball.shot = { power: true }; m.ball.owner = null; C.update(m, .7); check('power shot called dramatically', /POWER|THUNDERBOLT|net|remove|family plans/i.test(el('commentary-line').textContent), el('commentary-line').textContent);
m.ball.shot = null; m.score.blue = 1; a.stats.goals = 1; m.goals.push({ team: 'blue', scorer: a, assist: b, own: false }); C.update(m, .1); check('goal call names scorer and build-up', /G+O+A+L|SCENES|WRITE|BEDLAM|outrageous|planet/i.test(el('commentary-line').textContent) && /YOU/.test(el('commentary-line').textContent), el('commentary-line').textContent);
const pm = { ...m, ball: {}, pens: { kicks: { blue: [true], red: [] } }, score: { blue: 1, red: 0 } }; C.reset(pm); C.update(pm, .1); check('penalty result called', /BURIES|wrong way|veins|bins/i.test(el('commentary-line').textContent), el('commentary-line').textContent);
check('large varied line library', Object.values(C.banks).reduce((n, x) => n + x.length, 0) >= 75);
check('spoken delivery used', spoken.length >= 4, String(spoken.length));
check('natural English voice selected', C.voice && /Natural/.test(C.voice.name), C.voice && C.voice.name);
check('occasional break capped at three seconds', C.nextVoiceAt - Date.now() <= 3050, String(C.nextVoiceAt - Date.now()));
if (fails) process.exit(1); console.log('all commentary checks passed'); process.exit(0);