// Online play: matchmaking queues, private rooms and live server-run matches.
// The server runs the real match engine at 120 steps a second and sends every player
// ~30 snapshots a second. Clients only send their stick and button presses.

const { createSim } = require('./sim');

const STEP = 1 / 120;
const SNAPSHOT_EVERY = 4;           // 120 / 4 = 30 snapshots a second
const INTRO_MS = 3500;              // the VS card before kickoff
// Look for real players for a while, then fill the open spots. The wait is different every
// time so a quiet queue doesn't always start on the same beat.
const QUEUE_WAIT_MIN = 5000, QUEUE_WAIT_MAX = 13000;
const RECONNECT_MS = 20000;         // a dropped player keeps their seat this long
const MATCH_MINUTES = 3;
const FORMAT_SIZE = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 };
const PHASES = ['kickoff', 'play', 'goal', 'reset', 'timeup', 'over', 'replay', 'cele'];
const TRAIL_TYPES = [null, 'pass', 'weak', 'shot', 'strong', 'electric', 'fire', 'plasma', 'blast', 'frost', 'toxic', 'shadow', 'rainbow', 'golden'];
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const BOT_NAME_A = ['ace', 'blitz', 'cyber', 'dark', 'echo', 'frost', 'ghost', 'hyper', 'iron', 'jet', 'lunar', 'neon',
  'onyx', 'pixel', 'rapid', 'storm', 'turbo', 'vortex', 'wolf', 'zen', 'crimson', 'shadow', 'atomic', 'silver', 'goal', 'kick'];
const BOT_NAME_B = ['bolt', 'claw', 'dash', 'edge', 'fang', 'gale', 'hawk', 'jinx', 'kite', 'lynx', 'mist', 'nova',
  'pulse', 'rush', 'shade', 'spark', 'tide', 'viper', 'wave', 'zap', 'striker', 'boot', 'net'];

// Filled spots must look like people: usernames built the way people build theirs, and a
// character from the same shop everyone buys from (mostly the cheap ones, like real players).
const NAME_FIRST = ['kai', 'leo', 'max', 'zane', 'eli', 'jay', 'luca', 'mateo', 'ryan', 'omar', 'theo', 'diego', 'sami', 'finn', 'nico', 'andre', 'jojo', 'tyler', 'ivan', 'rafa'];
const NAME_BALL = ['goal', 'striker', 'boot', 'kick', 'dribble', 'volley', 'nutmeg', 'panenka', 'header', 'rabona', 'skill', 'baller', 'golazo', 'topbins'];
const NAME_END = ['king', 'god', 'pro', 'x', 'boy', 'man', 'mode', 'fc', 'yt', 'ez'];
const BOT_CHARACTERS = ['street', 'street', 'street', 'striker', 'striker', 'striker', 'buzz', 'buzz', 'curly', 'curly', 'speedster', 'speedster', 'captain', 'bandit', 'beanie', 'turbo', 'ninja', 'mohawk'];
const r100 = (v) => Math.round(v * 100);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

class NetInput {
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); }
  consumeSkill() { return this.take(2); }
  consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); }
  consumeShootRelease() { return this.take(16); }
}

function createGame({ getUser, userName, saveDB, onlineRecord, isNameTaken }) {
  const sim = createSim();
  const CELEBS = [null, ...sim.CELEBRATIONS.map((c) => c.id), 'hype'];
  const BOT_CELEBS = ['jump', 'jump', 'flex', 'salute', 'spin', 'shush', 'heart', 'dab', 'kneeslide', 'kneeslide', 'airplane', 'chestpump', 'callme', 'chill', 'robot', 'griddy', 'siuu'];
  const conns = new Map();   // userId -> connection
  const queues = { '1v1': [], '2v2': [], '3v3': [], '4v4': [] };
  const rooms = new Map();   // roomId -> room
  const codes = new Map();   // code -> room (private lobbies)
  let nextRoom = 1;

  const send = (conn, obj) => { if (conn && conn.ws.open) conn.ws.send(JSON.stringify(obj)); };
  const roomOf = (id) => { for (const r of rooms.values()) if (r.seats.some((s) => s.userId === id && !s.gone)) return r; return null; };
  const inQueue = (id) => Object.values(queues).some((q) => q.some((e) => e.userId === id));

  function profileOf(id) {
    const u = getUser(id);
    const save = (u && u.save) || {};
    const has = (list, v) => !v || list.some((x) => x.id === v);
    return {
      name: userName(id),
      club: (u && u.club) || sim.CLUBS[0].id,
      character: has(sim.CHARACTERS, save.character) && save.character ? save.character : 'street',
      trail: has(sim.TRAILS, save.trail) && save.trail ? save.trail : 'electric',
      celebration: has(sim.CELEBRATIONS, save.celebration) && save.celebration ? save.celebration : 'jump',
    };
  }

  function botName(taken) {
    const digits = (max) => String(Math.floor(Math.random() * max));
    for (let i = 0; i < 40; i++) {
      const style = Math.random();
      let n;
      if (style < 0.35) n = pickOne(BOT_NAME_A) + pickOne(BOT_NAME_B) + (Math.random() < 0.4 ? digits(99) : '');
      else if (style < 0.7) n = pickOne(NAME_FIRST) + (Math.random() < 0.5 ? '_' : '') + (Math.random() < 0.5 ? digits(100) : String(2008 + Math.floor(Math.random() * 10)));
      else n = pickOne(NAME_BALL) + pickOne(NAME_END) + (Math.random() < 0.5 ? digits(1000) : '');
      n = n.slice(0, 14).toUpperCase();
      if (!taken.has(n) && !isNameTaken(n)) { taken.add(n); return n; }
    }
    return 'PLAYER' + (100 + Math.floor(Math.random() * 900));
  }

  /* ---------------- connections ---------------- */

  function connect(ws, userId) {
    const old = conns.get(userId);
    if (old && old.ws !== ws) { send(old, { t: 'kicked', msg: 'Signed in somewhere else' }); old.ws.close(4000); }
    const conn = { ws, userId, msgs: 0, msgWindow: Date.now() };
    conns.set(userId, conn);
    ws.on('message', (msg) => { try { onMessage(conn, msg); } catch (e) { console.error('ws message failed:', e && e.stack); } });
    ws.on('close', () => { if (conns.get(userId) === conn) { conns.delete(userId); dropped(userId); } });
    send(conn, { t: 'hello', name: userName(userId) });
    // back into a match that is still running
    const room = roomOf(userId);
    if (room && (room.state === 'intro' || room.state === 'playing')) {
      const seat = room.seats.find((s) => s.userId === userId);
      seat.conn = conn; seat.leftAt = 0;
      sendStart(room, seat);
    } else if (room) {
      const seat = room.seats.find((s) => s.userId === userId);
      seat.conn = conn;
      lobbyUpdate(room);
    }
  }

  function dropped(userId) {
    leaveQueue(userId);
    const room = roomOf(userId);
    if (!room) return;
    const seat = room.seats.find((s) => s.userId === userId);
    if (room.state === 'lobby') { leaveLobby(room, userId); return; }
    seat.conn = null; seat.leftAt = Date.now();
  }

  function onMessage(conn, msg) {
    // generous: inputs arrive ~30-60 a second
    const now = Date.now();
    if (now - conn.msgWindow > 1000) { conn.msgWindow = now; conn.msgs = 0; }
    if (++conn.msgs > 150) return;
    const id = conn.userId;
    switch (msg.t) {
      case 'i': return input(id, msg);
      case 'ping': return send(conn, { t: 'pong', c: msg.c, s: Date.now() });
      case 'queue': return joinQueue(conn, msg.format);
      case 'unqueue': leaveQueue(id); return send(conn, { t: 'unqueued' });
      case 'room.create': return createLobby(conn, msg.format);
      case 'room.join': return joinLobby(conn, msg.code);
      case 'room.team': return lobbyTeam(id, msg.team);
      case 'room.format': return lobbyFormat(id, msg.format);
      case 'room.start': return lobbyStart(id);
      case 'room.leave': { const r = roomOf(id); if (r && r.state === 'lobby') leaveLobby(r, id); return send(conn, { t: 'room.left' }); }
      case 'leave': return leaveMatch(id);
    }
  }

  /* ---------------- queue ---------------- */

  function joinQueue(conn, format) {
    const id = conn.userId;
    if (!FORMAT_SIZE[format]) return send(conn, { t: 'error', msg: 'Pick a format' });
    if (roomOf(id)) return send(conn, { t: 'error', msg: 'You are already in a match' });
    leaveQueue(id);
    queues[format].push({ userId: id, at: Date.now(), wait: QUEUE_WAIT_MIN + Math.random() * (QUEUE_WAIT_MAX - QUEUE_WAIT_MIN) });
    send(conn, { t: 'queue', format });
  }

  function leaveQueue(id) {
    for (const [f, q] of Object.entries(queues)) {
      const i = q.findIndex((e) => e.userId === id);
      if (i >= 0) q.splice(i, 1);
    }
  }

  function matchmake() {
    for (const [format, q] of Object.entries(queues)) {
      // anyone whose connection went away is out
      for (let i = q.length - 1; i >= 0; i--) if (!conns.has(q[i].userId)) q.splice(i, 1);
      if (!q.length) continue;
      const need = FORMAT_SIZE[format] * 2;
      if (q.length >= need || Date.now() - q[0].at >= q[0].wait) {
        const group = q.splice(0, need).map((e) => e.userId);
        startRoom(format, sideUp(group, FORMAT_SIZE[format]), null);
      }
    }
  }

  // teammates from the same club go together where the numbers allow
  function sideUp(ids, size) {
    const byClub = new Map();
    for (const id of ids) { const c = profileOf(id).club; byClub.set(c, [...(byClub.get(c) || []), id]); }
    const groups = [...byClub.values()].sort((a, b) => b.length - a.length);
    const half = Math.min(size, Math.ceil(ids.length / 2));
    const blue = [], red = [];
    for (const g of groups) {
      // the whole group goes to the emptier side if it fits there, otherwise it splits
      const first = blue.length <= red.length ? blue : red, second = first === blue ? red : blue;
      for (const id of g) (first.length < half ? first : second.length < size ? second : first).push(id);
    }
    return [...blue.map((id) => ({ id, team: 'blue' })), ...red.map((id) => ({ id, team: 'red' }))];
  }

  /* ---------------- private lobbies ---------------- */

  function newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 5; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!codes.has(c)) return c;
    }
  }

  function createLobby(conn, format) {
    const id = conn.userId;
    if (roomOf(id)) return send(conn, { t: 'error', msg: 'You are already in a room' });
    leaveQueue(id);
    const room = { id: nextRoom++, code: newCode(), host: id, format: FORMAT_SIZE[format] ? format : '2v2', state: 'lobby', seats: [] };
    room.seats.push({ userId: id, team: 'blue', conn });
    rooms.set(room.id, room); codes.set(room.code, room);
    lobbyUpdate(room);
  }

  function joinLobby(conn, code) {
    const id = conn.userId;
    const room = codes.get(String(code || '').toUpperCase().trim());
    if (!room || room.state !== 'lobby') return send(conn, { t: 'error', msg: 'No room with that code' });
    if (roomOf(id)) return send(conn, { t: 'error', msg: 'You are already in a room' });
    const size = FORMAT_SIZE[room.format];
    if (room.seats.length >= size * 2) return send(conn, { t: 'error', msg: 'That room is full' });
    leaveQueue(id);
    const blues = room.seats.filter((s) => s.team === 'blue').length;
    room.seats.push({ userId: id, team: blues < size && blues <= room.seats.length - blues ? 'blue' : 'red', conn });
    lobbyUpdate(room);
  }

  function lobbyTeam(id, team) {
    const room = roomOf(id);
    if (!room || room.state !== 'lobby' || (team !== 'blue' && team !== 'red')) return;
    const seat = room.seats.find((s) => s.userId === id);
    if (room.seats.filter((s) => s.team === team && s !== seat).length >= FORMAT_SIZE[room.format]) return;
    seat.team = team;
    lobbyUpdate(room);
  }

  function lobbyFormat(id, format) {
    const room = roomOf(id);
    if (!room || room.state !== 'lobby' || room.host !== id || !FORMAT_SIZE[format]) return;
    if (room.seats.length > FORMAT_SIZE[format] * 2) return send(conns.get(id), { t: 'error', msg: 'Too many players for ' + format });
    room.format = format;
    const size = FORMAT_SIZE[format];
    for (const s of room.seats) {
      if (room.seats.filter((x) => x.team === s.team).length > size) s.team = s.team === 'blue' ? 'red' : 'blue';
    }
    lobbyUpdate(room);
  }

  function leaveLobby(room, id) {
    room.seats = room.seats.filter((s) => s.userId !== id);
    if (!room.seats.length) { rooms.delete(room.id); codes.delete(room.code); return; }
    if (room.host === id) room.host = room.seats[0].userId;
    lobbyUpdate(room);
  }

  function lobbyUpdate(room) {
    const payload = {
      t: 'room', code: room.code, format: room.format, host: userName(room.host),
      players: room.seats.map((s) => ({ name: userName(s.userId), team: s.team, club: profileOf(s.userId).club })),
    };
    for (const s of room.seats) send(s.conn || conns.get(s.userId), { ...payload, you: userName(s.userId), isHost: s.userId === room.host });
  }

  function lobbyStart(id) {
    const room = roomOf(id);
    if (!room || room.state !== 'lobby' || room.host !== id) return;
    codes.delete(room.code);
    rooms.delete(room.id);
    startRoom(room.format, room.seats.map((s) => ({ id: s.userId, team: s.team })), room.code);
  }

  /* ---------------- matches ---------------- */

  function startRoom(format, entries, code) {
    const size = FORMAT_SIZE[format];
    const taken = new Set();
    const seats = [];
    const clubFor = {};
    for (const team of ['blue', 'red']) {
      const humans = entries.filter((e) => e.team === team).slice(0, size);
      // a side wears the club most of its real players support (the first player's on a tie)
      if (humans.length) {
        const count = new Map();
        for (const e of humans) { const c = profileOf(e.id).club; count.set(c, (count.get(c) || 0) + 1); }
        clubFor[team] = [...count.entries()].sort((x, y) => y[1] - x[1])[0][0];
      }
      for (let i = 0; i < size; i++) {
        const e = humans[i];
        if (e) {
          const pr = profileOf(e.id);
          taken.add(pr.name);
          seats.push({ seat: seats.length, team, human: true, userId: e.id, name: pr.name, character: pr.character, trail: pr.trail, celebration: pr.celebration, club: pr.club, input: new NetInput(), conn: conns.get(e.id), ack: 0 });
        } else {
          seats.push({ seat: seats.length, team, human: false, name: null, character: pickOne(BOT_CHARACTERS), celebration: pickOne(BOT_CELEBS) });
        }
      }
    }
    for (const s of seats) if (!s.human) s.name = botName(taken);
    const clubIds = sim.CLUBS.map((c) => c.id);
    if (!clubFor.blue) clubFor.blue = pickOne(clubIds.filter((c) => c !== clubFor.red));
    if (!clubFor.red) clubFor.red = pickOne(clubIds.filter((c) => c !== clubFor.blue));

    const room = { id: nextRoom++, code, format, seats, state: 'intro', clubs: clubFor, events: [], tick: 0, acc: 0, last: 0, startAt: Date.now() + INTRO_MS, created: Date.now() };
    room.m = sim.create({
      online: true, format, minutes: MATCH_MINUTES, seats, diff: { ...sim.DIFFICULTY.normal },
      home: sim.Clubs.get(clubFor.blue), club: sim.Clubs.get(clubFor.red),
    }, room.events);
    room.m.events = room.events;
    // map seats to their players
    for (const p of room.m.players) if (p.seat !== null && p.seat !== undefined) seats[p.seat].player = p;
    rooms.set(room.id, room);
    for (const s of seats) if (s.human) sendStart(room, s);
    return room;
  }

  function sendStart(room, seat) {
    const m = room.m;
    send(seat.conn, {
      t: 'start', room: room.id, code: room.code, format: room.format, minutes: MATCH_MINUTES,
      side: seat.team, you: m.players.indexOf(seat.player), clubs: room.clubs,
      startsIn: Math.max(0, room.startAt - Date.now()), tick: room.tick, character: seat.character,
      players: m.players.map((p) => ({ team: p.team, number: p.number, keeper: p.isKeeper, name: p.isKeeper ? null : p.name, look: p.look })),
      score: m.score,
    });
  }

  function input(id, msg) {
    const room = roomOf(id);
    if (!room || room.state === 'lobby') return;
    const seat = room.seats.find((s) => s.userId === id);
    const p = seat && seat.player;
    if (!p || !p.input) return;
    let x = Number(msg.x), y = Number(msg.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { x = 0; y = 0; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    p.input.move.x = x; p.input.move.y = y;
    p.input.sprintHeld = !!msg.sp;
    const a = Number(msg.a) | 0;
    if (a) p.input.q |= a & 31;
    const s = Number(msg.s);
    if (Number.isFinite(s)) seat.ack = s;
  }

  function becomeBot(room, seat) {
    const m = room.m, p = seat.player;
    if (!p || !p.isHuman) return;
    p.isHuman = false; p.input = null; p.charging = false;
    p.speedMul = m.diff.redSpeed;
    m.humans = m.humans.filter((h) => h !== p);
    m.teamHuman = { blue: m.humans.some((h) => h.team === 'blue'), red: m.humans.some((h) => h.team === 'red') };
    if (m.human === p) m.human = m.humans[0] || m.players[0];
  }

  function leaveMatch(id) {
    const room = roomOf(id);
    if (!room || room.state === 'lobby') return;
    const seat = room.seats.find((s) => s.userId === id);
    if (room.state !== 'over') {
      // walking out counts as a defeat; the match plays on without you
      onlineRecord(id, { outcome: 'loss', goalsFor: 0, goalsAgainst: 0, goals: 0 });
      becomeBot(room, seat);
    }
    seat.gone = true; seat.conn = null;
    send(conns.get(id), { t: 'left' });
  }

  function snapshot(room) {
    const m = room.m, b = m.ball;
    const P = m.players.map((p) => {
      const winding = (p.slideWindT || 0) > 0;
      const flags = (p.sad ? 1 : 0) | (p.slideHit ? 2 : 0) | (p.sprintOn ? 4 : 0) | (p.charging ? 8 : 0) | (p.skill ? 16 : 0);
      return [Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), r100(p.fx), r100(p.fy), r100(p.faceX), flags,
        r100(p.kickT), r100(p.kickDur), r100(p.stunT), r100(p.recoverT), r100(p.diveT), Math.sign(p.diveDir || 0), r100(p.celebrateT),
        Math.max(0, CELEBS.indexOf(p.celebKind)), r100(p.slideT), r100(p.slideWindT || 0),
        r100(winding ? p.slideWindX : p.slideDirX), r100(winding ? p.slideWindY : p.slideDirY), r100(p.fallT), r100(p.hopT)];
    });
    const s = b.shot;
    const B = [Math.round(b.x), Math.round(b.y), Math.round(b.z), Math.round(b.vx), Math.round(b.vy), Math.round(b.vz),
      b.owner ? m.players.indexOf(b.owner) : -1, Math.max(0, TRAIL_TYPES.indexOf(b.trailType)),
      s ? s.level : -1, s && s.power ? 1 : 0, s && s.team === 'red' ? 1 : 0, r100(b.netBulge.left), r100(b.netBulge.right)];
    const common = {
      k: room.tick, ph: PHASES.indexOf(m.phase), pt: r100(m.phaseT), tm: Math.round(m.time * 10), ot: m.overtime ? Math.round(m.otTime) : -1,
      sc: [m.score.blue, m.score.red], mt: [Math.round(m.meter.blue), Math.round(m.meter.red)], ts: r100(m.timeScale), p: P, b: B, ev: room.events.splice(0),
    };
    const body = JSON.stringify(common).slice(1);
    for (const seat of room.seats) {
      if (!seat.human || !seat.conn || !seat.conn.ws.open || seat.gone) continue;
      if (seat.conn.ws.backlog > 512 * 1024) continue; // a stalled client skips snapshots rather than queueing them
      const p = seat.player;
      const me = p ? [seat.ack, r100(p.skillCd), r100(p.slideCd), r100(p.stamina), p.exhausted ? 1 : 0, p.charging ? 1 : 0, r100(p.chargeT), p.bufferT > 0 ? 1 : 0] : null;
      seat.conn.ws.send(`{"t":"s","me":${JSON.stringify(me)},${body}`);
    }
  }

  function finish(room) {
    const m = room.m;
    room.state = 'over'; room.endedAt = Date.now();
    const pt = m.poss.blue + m.poss.red;
    const rating = (p) => { const s = p.stats; return s.goals * 3 + s.assists * 2 + s.saves * 1.2 + s.steals * 0.8 + s.passes * 0.35 + s.shots * 0.3; };
    let mvp = m.players[0];
    for (const p of m.players) if (rating(p) > rating(mvp)) mvp = p;
    const base = {
      t: 'end', score: m.score, clubs: room.clubs,
      stats: m.stats, poss: pt ? Math.round((m.poss.blue / pt) * 100) : 50,
      mvp: { index: m.players.indexOf(mvp), name: mvp.isKeeper ? null : mvp.name, team: mvp.team, keeper: mvp.isKeeper, number: mvp.number, stats: mvp.stats },
      players: m.players.map((p) => ({ name: p.isKeeper ? null : p.name, team: p.team, number: p.number, keeper: p.isKeeper, stats: p.stats })),
      goals: m.goals.map((g) => ({ team: g.team, scorer: g.scorer ? m.players.indexOf(g.scorer) : -1, own: g.own, time: Math.round(g.time) })),
    };
    for (const seat of room.seats) {
      if (!seat.human || seat.gone) continue;
      const mine = m.score[seat.team], theirs = m.score[seat.team === 'blue' ? 'red' : 'blue'];
      const outcome = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
      const stats = seat.player ? seat.player.stats : {};
      onlineRecord(seat.userId, { outcome, goalsFor: mine, goalsAgainst: theirs, goals: stats.goals || 0 });
      send(seat.conn || conns.get(seat.userId), { ...base, side: seat.team, you: m.players.indexOf(seat.player), outcome, format: room.format });
    }
    saveDB();
  }

  function tickRooms() {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.state === 'lobby') continue;
      if (room.state === 'over') { if (now - room.endedAt > 10000) rooms.delete(room.id); continue; }
      // dropped players get a bot after a grace period
      for (const s of room.seats) if (s.human && !s.conn && !s.gone && s.leftAt && now - s.leftAt > RECONNECT_MS) { becomeBot(room, s); s.gone = true; onlineRecord(s.userId, { outcome: 'loss', goalsFor: 0, goalsAgainst: 0, goals: 0 }); }
      if (!room.seats.some((s) => s.human && !s.gone)) { rooms.delete(room.id); continue; }
      if (room.state === 'intro') {
        if (now < room.startAt) continue;
        room.state = 'playing'; room.last = now; room.acc = 0;
      }
      room.acc += Math.min(0.25, (now - room.last) / 1000);
      room.last = now;
      let n = 0;
      while (room.acc >= STEP && n < 30) {
        sim.step(room.m, STEP, room.events);
        room.acc -= STEP; room.tick++; n++;
        if (room.tick % SNAPSHOT_EVERY === 0) snapshot(room);
        if (room.m.finished) { snapshot(room); finish(room); break; }
      }
    }
  }

  setInterval(tickRooms, 4).unref();
  // the client pings every few seconds; a socket silent for a minute is a dead connection
  setInterval(() => { const cut = Date.now() - 60000; for (const c of conns.values()) if (c.ws.lastSeen < cut) c.ws.close(4002); }, 15000).unref();
  setInterval(matchmake, 1000).unref();

  return {
    connect,
    clubs: sim.CLUBS,
    countryFor: sim.countryFor,
    stats: () => ({ online: conns.size, rooms: [...rooms.values()].filter((r) => r.state !== 'lobby').length, lobbies: codes.size, queued: Object.values(queues).reduce((a, q) => a + q.length, 0) }),
    inMatch: (id) => !!roomOf(id),
    removeUser(id) { leaveQueue(id); const r = roomOf(id); if (r) { if (r.state === 'lobby') leaveLobby(r, id); else leaveMatch(id); } const c = conns.get(id); if (c) c.ws.close(); },
  };
}

module.exports = { createGame, FORMAT_SIZE };
