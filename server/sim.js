// Runs the real game code on the server. The browser scripts are loaded unchanged into
// one sandbox, with the few browser-only things (sound, particles, screens) swapped for
// stand-ins that record what happened so it can be sent to the players as events.

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', 'js');
const FILES = ['config.js', 'clubs.js', 'celebs.js', 'save.js', 'meta.js', 'entities.js', 'ai.js', 'match.js', 'replay.js'];

// sounds everyone should hear; the charge hum is local to whoever is charging
const SOUND_SKIP = new Set(['chargeStart', 'chargeStop', 'unlock', 'startMusic', 'stopMusic', 'startAmbience', 'stopAmbience', 'applyVolumes', 'tap', 'ok', 'setExcitement']);
// particles worth sending; dust, speed lines and embers each client makes for itself
const FX_SEND = new Set(['text', 'showBanner', 'burst', 'sparks', 'ring', 'stars', 'doShake', 'doFlash']);

function createSim() {
  let target = null; // the event list of the room being stepped right now
  const record = (e) => { if (target) target.push(e); };

  const Sound = new Proxy({}, {
    get: (_, name) => (...args) => {
      if (typeof name !== 'string' || SOUND_SKIP.has(name)) return;
      record({ e: 's', n: name, a: args.filter((x) => typeof x !== 'object') });
    },
  });
  const FX = new Proxy({ shake: { x: 0, y: 0, t: 0 }, flash: { a: 0 }, ground: [], air: [], texts: [] }, {
    get: (obj, name) => {
      if (name in obj) return obj[name];
      return (...args) => { if (FX_SEND.has(name)) record({ e: 'f', n: name, a: args }); };
    },
  });
  const noop = () => {};
  const sandbox = {
    console, Math, Date, JSON, Object, Array, Number, String, Boolean, Map, Set, Proxy, Symbol, Error, isFinite, parseInt, parseFloat,
    setTimeout, clearTimeout,
    Sound, FX,
    UI: { toast: noop, showResults: (m) => { m.finished = true; }, refreshHome: noop },
    Game: { headless: false, _diff: null, difficulty() { return this._diff || api.DIFFICULTY.normal; }, setDifficulty: noop },
    Render: {},
    Input: { move: { x: 0, y: 0 }, sprintHeld: false, consumePass: () => false, consumeSkill: () => false, consumeSlide: () => false, consumeShootPress: () => false, consumeShootRelease: () => false },
    vibrate: noop,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) {
    const code = fs.readFileSync(path.join(JS, f), 'utf8');
    vm.runInContext(code, sandbox, { filename: 'js/' + f });
  }
  // lexical globals (const/let) aren't properties of the sandbox; pull out what we need
  const api = vm.runInContext(`({ Match, CLUBS, countryFor, CHARACTERS, TRAILS, CELEBRATIONS, DIFFICULTY, CFG, FORMATS, SIDES, Clubs, TEAMS })`, sandbox);

  return {
    ...api,
    // tools only: run code inside the sandbox (tools/botscan.js)
    run: (code) => vm.runInContext(code, sandbox),
    // step one room's match while recording its events into that room's list
    step(m, dt, events) {
      target = events;
      try { api.Match.step(m, dt); } finally { target = null; }
    },
    create(opts, events) {
      target = events;
      try { return api.Match.create(opts); } finally { target = null; }
    },
  };
}

module.exports = { createSim };
