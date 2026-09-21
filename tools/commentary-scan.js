'use strict';
const vm = require('vm'), fs = require('fs');
const els = new Map();
const el = (id) => els.get(id) || els.set(id, { id, textContent: '', offsetWidth: 1, classList: { add() {}, remove() {}, toggle() {} } }).get(id);
const spoken = [];
function SpeechSynthesisUtterance(text) { this.text = text; }
const sandbox = { console, Math, Set, Map, String, clearTimeout, setTimeout, clearInterval, setInterval, SpeechSynthesisUtterance,
  Save: { data: { settings: { commentary: true, sfx: .8 } }, write() {} },
  TEAMS: { blue: { name: 'SPAIN' }, red: { name: 'BRAZIL' } },
  $: el, window: { speechSynthesis: { pending: false, speaking: false, pending: false, speak: (u) => { spoken.push(u.text); if (u.onend) u.onend(); }, cancel() {}, getVoices: () => [{ name: 'Microsoft Aria Online (Natural)', voiceURI: 'Aria Natural', lang: 'en-US', localService: false }, { name: 'Microsoft Ryan Online (Natural)', voiceURI: 'Ryan Natural', lang: 'en-GB', localService: false }] } },
};
vm.createContext(sandbox); vm.runInContext(fs.readFileSync('js/commentary.js', 'utf8'), sandbox);
const C = vm.runInContext('Commentary', sandbox); C.init(); C.unlock();
const player = (team, n, human = false) => ({ team, number: n, isHuman: human, name: human ? null : `${team}${n}`, stats: { goals: 0 } });
const a = player('blue', 10, true), b = player('blue', 7), c = player('blue', 9), r = player('red', 4);
const m = { ball: { owner: a, shot: null }, score: { blue: 0, red: 0 }, stats: { blue: { saves: 0, tackles: 0, skills: 0 }, red: { saves: 0, tackles: 0, skills: 0 } }, goals: [], players: [a,b,c,r], phase: 'play', time: 80, trailed: {} };
let fails = 0; const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); if (!ok) fails++; };
C.update(m, .016); C.cd = 0; m.ball.owner = b; C.update(m, .7); check('first completed pass called', /PASS ONE/.test(el('commentary-line').textContent), el('commentary-line').textContent);
C.cd = 0; m.ball.owner = c; C.update(m, .7); check('second completed pass escalates', /PASS TWO/.test(el('commentary-line').textContent), el('commentary-line').textContent);
C.cd = 0; m.ball.shot = { power: true }; m.ball.owner = null; C.update(m, .7); check('power shot called dramatically', /POWER|THUNDERBOLT|net|remove|family plans|escape velocity|air traffic|satellite|travelling through time/i.test(el('commentary-line').textContent), el('commentary-line').textContent);
m.ball.shot = null; m.score.blue = 1; a.stats.goals = 1; m.goals.push({ team: 'blue', scorer: a, assist: b, own: false }); C.update(m, .1); check('goal call names scorer and build-up', /G+O+A+L|SCENES|WRITE|BEDLAM|outrageous|planet|WITNESSED|MUSEUM|STADIUM|HOLD ME|peaked|public service/i.test(el('commentary-line').textContent) && /YOU/.test(el('commentary-line').textContent), el('commentary-line').textContent);
const pm = { ...m, ball: {}, pens: { kicks: { blue: [true], red: [] } }, score: { blue: 1, red: 0 } }; C.reset(pm); C.update(pm, .1); check('penalty result called', /BURIES|wrong way|veins|bins|pillow|taxi|confidence/i.test(el('commentary-line').textContent), el('commentary-line').textContent);
check('large varied line library', Object.values(C.banks).reduce((n, x) => n + x.length, 0) >= 140);
check('hysterical chaos bank included', C.banks.chaos.length >= 20, String(C.banks.chaos.length));
const jokeDraws = Array.from({ length: C.banks.joke.length }, () => C.pick(C.banks.joke));
check('every joke plays before any joke repeats', new Set(jokeDraws).size === C.banks.joke.length, String(new Set(jokeDraws).size) + '/' + C.banks.joke.length);
const afterJokes = C.pick(C.banks.joke); check('exhausted jokes never repeat', !C.banks.joke.includes(afterJokes), afterJokes);
check('no unresolved commentary placeholders', Object.values(C.banks).flat().every((x) => !x.includes('{') || /\{team\}|\{player\}|\{winner\}|\{loser\}/.test(x)));
check('spoken delivery used', spoken.length >= 4, String(spoken.length));
check('natural male voice wins over female voice', C.voice && /Ryan/.test(C.voice.name), C.voice && C.voice.name);
check('occasional break capped at three seconds', C.nextVoiceAt - Date.now() <= 3050, String(C.nextVoiceAt - Date.now()));
C.speaking = true; sandbox.window.speechSynthesis.speaking = true; const queuedBefore = C.voiceQueue.length, captionBefore = el('commentary-line').textContent; C.say('THE MOVE CONTINUES!', 1, true);
check('busy speech queues rather than drops a line', C.voiceQueue.length === queuedBefore + 1, String(C.voiceQueue.length));
check('queued speech does not get ahead on screen', el('commentary-line').textContent === captionBefore, el('commentary-line').textContent); C.speaking = false; sandbox.window.speechSynthesis.speaking = false;
C.pause(); check('pause clears queued speech', C.paused && C.voiceQueue.length === 0 && !C.speaking, JSON.stringify({ paused: C.paused, queued: C.voiceQueue.length, speaking: C.speaking }));
C.resume(); check('resume restarts with fresh commentary', !C.paused && C.nextVoiceAt > Date.now(), String(C.nextVoiceAt - Date.now()));
if (fails) process.exit(1); console.log('all commentary checks passed'); process.exit(0);