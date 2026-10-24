// With no wifi, does every way into online play say so, at once, and start nothing?
//   node tools/wifiscan.js
// The real client network code (js/net.js) and online code (js/online.js) in one process, with a
// device that can have its wifi switched off. A tap on find match, ranked, a room, joining a room,
// watching a friend or a friend cup must give a "NO WI-FI" message, open no queue screen, open no
// socket and leave nothing half started; the same taps with wifi on must still go ahead.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = { toasts: [], queues: 0, hides: 0, sockets: 0, fetches: 0, sent: [] };
const reset = () => { log.toasts.length = 0; log.queues = 0; log.hides = 0; log.sockets = 0; log.fetches = 0; log.sent.length = 0; };
const navigator = { onLine: true };
const listeners = {};
const bodyClasses = new Set();
class FakeSocket { constructor() { log.sockets++; this.readyState = 0; } send(s) { log.sent.push(s); } close() {} }
const el = () => ({ hidden: true, style: {}, classList: { toggle() {}, add() {}, remove() {} }, textContent: '', querySelector: () => el() });
const noop = new Proxy({}, { get: () => () => {} });
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Symbol, Error, isFinite, parseInt, parseFloat, performance, URLSearchParams, AbortController,
  setTimeout, clearTimeout, setInterval, clearInterval,
  navigator, WebSocket: FakeSocket, location: { hostname: 'localhost', search: '', protocol: 'http:', host: 'localhost:8450' },
  fetch: () => { log.fetches++; return Promise.reject(new Error('offline')); },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { getElementById: el, body: { classList: { toggle(c, on) { if (on) bodyClasses.add(c); else bodyClasses.delete(c); }, add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c) } }, documentElement: { style: { setProperty() {} } } },
  Sound: noop, FX: noop, Pens: noop, Render: noop, Store: noop, Game: { match: null, state: 'home' },
  Social: { party: null, reset() {} },
  UI: { calm: () => true, toast: (t) => log.toasts.push(String(t)), showQueue: () => { log.queues++; }, hideQueue: () => { log.hides++; }, hideLobby() {}, showLobby() {}, queueParty() {}, refreshHome() {} },
  vibrate: () => {}, $: el,
};
sandbox.window = sandbox;
sandbox.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
for (const f of ['config.js', 'clubs.js', 'celebs.js', 'save.js', 'meta.js', 'net.js', 'online.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), sandbox, { filename: 'js/' + f });
const { Net, Online } = vm.runInContext('({ Net, Online })', sandbox);

Net.init();
Online.init();
Net.token = 'scan'; // signed in: the socket would be opened if anything asked for it

const wifi = (on) => { navigator.onLine = on; for (const fn of listeners[on ? 'online' : 'offline'] || []) fn(); };
const fresh = () => { reset(); Online.status = 'idle'; Online.room = null; Net._wantSocket = false; Net.ws = null; Net.wsReady = false; Net.offline = false; };
const wifiMsg = () => log.toasts.some((t) => /NO WI-FI/.test(t) && /PLAY ONLINE|USE THIS/.test(t));

(async () => {
  // ---- wifi OFF: every way in says so, and starts nothing
  const ways = {
    'find a match (4v4)': () => Online.findMatch('4v4'),
    'find a match (1v1)': () => Online.findMatch('1v1'),
    'ranked': () => Online.findMatch('ranked'),
    'online penalties': () => Online.findMatch('pens'),
    'friend cup / world cup round': () => Online.findMatch('4v4', true),
    'create a room': () => Online.createRoom('2v2'),
    'join a room': () => Online.joinRoom('ABCDE'),
    'watch a friend': () => Online.watch('somebody'),
  };
  wifi(false);
  check('the page notices the wifi going (body.nowifi)', bodyClasses.has('nowifi'));
  for (const [name, go] of Object.entries(ways)) {
    fresh();
    go();
    await sleep(60);
    check(`no wifi: ${name} says so`, wifiMsg(), log.toasts);
    check(`no wifi: ${name} starts nothing`, log.queues === 0 && log.sockets === 0 && log.fetches === 0 && log.sent.length === 0 && Online.status === 'idle', { queues: log.queues, sockets: log.sockets, fetches: log.fetches, sent: log.sent.length, status: Online.status });
  }
  wifi(true);
  check('the page notices the wifi coming back', !bodyClasses.has('nowifi'));

  // ---- the game opened with no connection (Net.offline) but the device thinks it is online: still says so
  fresh(); Net.offline = true;
  Online.findMatch('4v4'); await sleep(60);
  check('opened offline: find a match says so', log.toasts.some((t) => /STILL CONNECTING/.test(t)) && log.queues === 0 && Online.status === 'idle', log.toasts);
  Net.offline = false;

  // ---- wifi ON: nothing gets in the way
  fresh();
  Online.findMatch('4v4'); await sleep(60);
  check('wifi on: find a match goes ahead (queue screen, socket asked for)', log.queues === 1 && log.sockets === 1 && Online.status === 'queue' && !log.toasts.some((t) => /WI-FI/.test(t)), { queues: log.queues, sockets: log.sockets, status: Online.status, toasts: log.toasts });
  Online.cancelQueue();
  fresh();
  Online.createRoom('2v2'); await sleep(60);
  check('wifi on: create a room goes ahead', log.sockets === 1 && Online.status === 'room' && !log.toasts.some((t) => /WI-FI/.test(t)), { sockets: log.sockets, status: Online.status });
  fresh();

  // ---- the wifi goes while waiting for the server: stop at once, do not "wake the server" for a minute
  Online.findMatch('4v4');
  await sleep(300);
  check('waiting for the server, wifi still on: queue is up', Online.status === 'queue' && log.queues === 1);
  const t0 = Date.now();
  wifi(false);
  while (Online.status === 'queue' && Date.now() - t0 < 3000) await sleep(20);
  check('wifi lost while waiting: gives up within a second', Online.status === 'idle' && Date.now() - t0 < 1000, { ms: Date.now() - t0, status: Online.status });
  check('wifi lost while waiting: says no wifi and takes the queue screen down', log.toasts.some((t) => /NO WI-FI/.test(t)) && log.hides >= 1, { toasts: log.toasts, hides: log.hides });
  check('wifi lost while waiting: never claimed the server was waking up', !log.toasts.some((t) => /WAKING/.test(t)), log.toasts);
  wifi(true);

  // ---- a room that was never joined does not leave you stuck "in a room"
  fresh();
  Online.joinRoom('ZZZZZ'); await sleep(30);
  Net.handlers.error({ msg: 'No such room' });
  check('a failed room join leaves you free (not stuck in a room)', Online.status === 'idle', Online.status);

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
