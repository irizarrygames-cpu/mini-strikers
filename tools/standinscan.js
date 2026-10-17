// The stand-in a walk-off leaves behind, run against the real server game code with fake
// sockets.   node tools/standinscan.js
//
// The rule it checks: how good that bot is depends on the standard of the match it is standing
// in. At the bottom of the ladder it stays the sandbag it has always been — a game down there
// is not improved by a bot that can play. Near the top it has to be able to hold a position and
// finish a chance, or the rest of the match is pointless for everyone still on the pitch.
//
// And the thing that must never change: it is always worse than ONLINE_BOTS, the fill-ins a
// match starts with. Losing a teammate always costs your side something. If that ever stops
// being true, walking off becomes a way to upgrade your team.
const { createGame } = require('../server/game');
const { createSim } = require('../server/sim');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FakeWS {
  constructor() { this.open = true; this.handlers = {}; this.got = []; this.backlog = 0; this.lastSeen = Date.now(); }
  on(ev, fn) { this.handlers[ev] = fn; }
  send(s) { this.got.push(typeof s === 'string' ? JSON.parse(s) : s); }
  close() { if (!this.open) return; this.open = false; if (this.handlers.close) this.handlers.close(); }
  msg(obj) { this.handlers.message(obj); }
  last(t) { for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i]; return null; }
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failures++;
};

// Every player in a run is given the same rank, which is what sets the standard of the room.
// Driving it through `ranked.view` rather than a win record keeps the number exact.
let RP = 0;
const game = createGame({
  getUser: () => ({ club: 'spain', save: {} }),
  userName: (id) => id.toUpperCase(),
  saveDB: () => {},
  onlineRecord: () => {},
  isNameTaken: () => false,
  ranked: { view: () => ({ rp: RP }) },
});

async function walkOff(rp) {
  RP = rp;
  const ids = ['s' + rp + 'a', 's' + rp + 'b', 's' + rp + 'c'];
  const ws = {};
  for (const id of ids) { ws[id] = new FakeWS(); game.connect(ws[id], id); }
  ws[ids[0]].msg({ t: 'room.create', format: '2v2' });
  const code = ws[ids[0]].last('room').code;
  for (const id of ids.slice(1)) ws[id].msg({ t: 'room.join', code });
  ws[ids[2]].msg({ t: 'room.team', team: 'red' });
  for (const id of ids.slice(0, 2)) ws[id].msg({ t: 'room.team', team: 'blue' });
  ws[ids[0]].msg({ t: 'room.start' });
  await sleep(4200);                       // the VS card, then kickoff
  const room = game._roomOf(ids[0]);
  ws[ids[1]].msg({ t: 'leave' });          // one of the two on blue walks out
  await sleep(120);
  const bot = room.seats.find((s) => s.userId === ids[1]).player;
  const out = { standard: room.standard, diff: bot.botDiff, attr: bot.attr, speedMul: bot.speedMul };
  for (const w of Object.values(ws)) w.close();
  return out;
}

(async () => {
  const sim = createSim();
  const START = sim.ONLINE_BOTS;        // the fill-ins a match begins with

  console.log('a stand-in at four standards');
  const runs = [];
  for (const rp of [0, 200, 450, 900]) {
    const r = await walkOff(rp);
    runs.push({ rp, ...r });
    console.log(`  rp ${String(rp).padStart(4)}  standard ${String(r.standard).padStart(3)}  speed ${r.diff.redSpeed.toFixed(3)}  react ${r.diff.react.toFixed(2)}s  mistakes ${r.diff.mistakes.toFixed(2)}  tackles ${r.diff.aiSlide.toFixed(2)}  finish ${r.attr.finish.toFixed(2)}`);
  }

  console.log('');
  const low = runs[0], top = runs[runs.length - 1];

  check('the bottom of the ladder still gets the old sandbag',
    low.diff.redSpeed === 0.8 && low.diff.react === 2.2 && low.diff.mistakes === 3 && low.attr.finish === 0.05,
    { speed: low.diff.redSpeed, react: low.diff.react, mistakes: low.diff.mistakes, finish: low.attr.finish });

  const climbs = (pick, want) => {
    for (let i = 1; i < runs.length; i++) {
      const a = pick(runs[i - 1]), b = pick(runs[i]);
      if (want === 'up' ? b < a : b > a) return false;
    }
    return true;
  };
  check('it gets faster as the standard rises', climbs((r) => r.diff.redSpeed, 'up'));
  check('it reacts sooner', climbs((r) => -r.diff.react, 'up'));
  check('it makes fewer mistakes', climbs((r) => -r.diff.mistakes, 'up'));
  check('it tackles more', climbs((r) => r.diff.aiSlide, 'up'));
  check('it finishes better', climbs((r) => r.attr.finish, 'up'));

  check('speedMul follows the blend rather than the old constant',
    runs.every((r) => r.speedMul === r.diff.redSpeed));

  // the one that must never break
  check('even at the very top it is worse than the fill-ins the match started with',
    top.diff.redSpeed < START.redSpeed
    && top.diff.react > START.react
    && top.diff.mistakes > START.mistakes
    && top.diff.aiShotNoise > START.aiShotNoise
    && top.diff.aiSlide < START.aiSlide,
    { standIn: { speed: top.diff.redSpeed, react: top.diff.react, mistakes: top.diff.mistakes, noise: top.diff.aiShotNoise, tackles: top.diff.aiSlide },
      fillIn: { speed: START.redSpeed, react: START.react, mistakes: START.mistakes, noise: START.aiShotNoise, tackles: START.aiSlide } });

  check('a stand-in is never a real player again', runs.every((r) => r.attr.ctl < 0 && r.attr.def < 0),
    runs.map((r) => ({ rp: r.rp, ctl: +r.attr.ctl.toFixed(2), def: +r.attr.def.toFixed(2) })));

  console.log('');
  console.log(failures ? `${failures} failed` : 'all stand-in checks passed');
  process.exit(failures ? 1 : 0);
})();
