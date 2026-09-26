// Online play: matchmaking queues, private rooms and live server-run matches.
// The server runs the real match engine at 120 steps a second and sends every player
// ~30 snapshots a second. Clients only send their stick and button presses.

const { createSim } = require('./sim');
const { createFriends } = require('./friends');
const PenModel = require('./pens');

const STEP = 1 / 120;
const SNAPSHOT_EVERY = 4;           // 120 / 4 = 30 snapshots a second
const INTRO_MS = 3500;              // the VS card before kickoff
// Look for real players for a while, then fill the open spots. The wait is different every
// time so a quiet queue doesn't always start on the same beat.
// nobody else coming: after 30s (and a few seconds either way, so the timing gives nothing away) the
// empty spots fill with players who look like everyone else
const QUEUE_WAIT_MIN = 30000, QUEUE_WAIT_MAX = 33000;
const RECONNECT_MS = 20000;         // a dropped player keeps their seat this long
const PARTY_MAX = 4;                // a party fills one side at most
const PARTY_INVITE_MS = 60000;      // an invite you don't answer runs out
const CHALLENGE_INVITE_MS = 60000;
const PARTY_OFFLINE_MS = 60000;     // someone whose game closed keeps their party spot this long
const CHAT_GAP_MS = 1200, CHAT_BURST = 5, CHAT_BURST_MS = 10000; // quick chat: one at a time, five in any 10s
const MATCH_MINUTES = 3;
const FORMAT_SIZE = { 'pens': 1, '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4 };
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
const BOT_ACCESSORIES = ['shades', 'shades', 'wristbands', 'wristbands', 'mustache', 'partyhat', 'bowtie', 'scarf', 'warpaint', 'headphones', 'armband', 'eyepatch', 'chain'];
const r100 = (v) => Math.round(v * 100);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

class NetInput {
  // aim: the stick as it was in the message that carried a button press. A quick flick off the stick
  // right after tapping PASS can land in the same tick; the pass still goes where you were aiming.
  constructor() { this.move = { x: 0, y: 0 }; this.sprintHeld = false; this.q = 0; this.aim = null; }
  take(bit) { const v = (this.q & bit) !== 0; this.q &= ~bit; return v; }
  consumePass() { return this.take(1); }
  consumeSkill() { return this.take(2); }
  consumeSlide() { return this.take(4); }
  consumeShootPress() { return this.take(8); }
  consumeShootRelease() { return this.take(16); }
  consumePassPress() { return this.take(32); }
  consumeUlt() { return this.take(64); }
}

// Online World Cup: a knockout run kept on your account. Each round is an online match against
// real players at the same round (filled like any match), no draws (golden goal). Lose and you're out.
const WC_ROUNDS = ['ROUND OF 16', 'QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];

// worldCup: { round(id) -> 0..3, result(id, won) -> { round, champion, titles } } (the run lives on the account)
// league: { move(club, +1 up | -1 down), result([[club, ±1]...]) for a whole match, pos(club) -> 1.. } (server.js)
function createGame({ getUser, userName, saveDB, onlineRecord, isNameTaken, worldCup, penaltyWorldCup, ranked, league }) {
  const wc = worldCup || { round: () => 0, result: () => ({ round: 0, champion: false, titles: 0 }) };
  const pwc = penaltyWorldCup || { round: () => 0, result: () => ({ round: 0, champion: false, titles: 0 }) };
  const ladder = league || { move: () => {}, result: () => {}, pos: () => 0 };
  // ranked seasons: read AFTER the result is banked, so the view carries the new points
  const rankOf = (ranked && ranked.view) || (() => null);
  const rankDeltaFor = (outcome, gf, ga) => (sim.rankDelta ? sim.rankDelta(outcome, gf, ga) : 0);
  const sim = createSim();
  const CELEBS = [null, ...sim.CELEBRATIONS.map((c) => c.id), 'hype'];
  const ULTS = sim.ULT_KINDS;

  // the level the fill bots play to: the average level of the real players in the room
  function roomLevel(seats) {
    const levels = seats.filter((s) => s.human).map((s) => {
      const u = getUser(s.userId);
      return sim.Levels.info(u && u.save ? Number(u.save.xp) || 0 : 0).level;
    });
    return levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 1;
  }
  const BOT_CELEBS = ['jump', 'jump', 'flex', 'salute', 'spin', 'shush', 'heart', 'dab', 'kneeslide', 'kneeslide', 'airplane', 'chestpump', 'callme', 'chill', 'robot', 'griddy', 'siuu', 'calmdown', 'pointsky', 'floss', 'bird', 'kungfu'];
  const conns = new Map();   // userId -> connection
  const queues = { 'pens': [], '1v1': [], '2v2': [], '3v3': [], '4v4': [], 'ranked': [] };
  const rooms = new Map();   // roomId -> room
  const codes = new Map();   // code -> room (private lobbies)
  let nextRoom = 1;

  const send = (conn, obj) => { if (conn && conn.ws.open) conn.ws.send(JSON.stringify(obj)); };
  const pickSome = (list, n) => { const l = list.slice(); const out = []; while (out.length < n && l.length) out.push(l.splice(Math.floor(Math.random() * l.length), 1)[0]); return out; };
  // which of a seat's ranked challenges are done right now (a clean sheet or a 2-goal win only
  // counts once it is over, so nothing can come undone)
  function chalMask(room, seat) {
    if (!seat.chal || !seat.player) return 0;
    const m = room.m, mine = m.score[seat.team], theirs = m.score[seat.team === 'blue' ? 'red' : 'blue'];
    const over = m.phase === 'over' || !!m.finished;
    let bits = 0;
    seat.chal.forEach((c, i) => { if (c.net(seat.player.stats, mine, theirs, over)) bits |= 1 << i; });
    return bits;
  }
  // (a finished match waits ~10s before it's cleared away; you're not in it any more, so PLAY AGAIN right away works)
  const roomOf = (id) => { for (const r of rooms.values()) if (r.state !== 'over' && r.seats.some((s) => s.userId === id && !s.gone)) return r; return null; };
  // a queue entry is one player, or a whole party that plays together (ids: everyone in it)
  const entryOf = (id) => { for (const q of Object.values(queues)) for (const e of q) if (e.ids.includes(id)) return e; return null; };
  const inQueue = (id) => !!entryOf(id);
  const push = (id, obj) => send(conns.get(id), obj);

  // what your friends see next to your name
  function statusOf(id) {
    const c = conns.get(id);
    if (!c) return 'offline';
    const r = roomOf(id);
    if (r) return r.state === 'lobby' ? 'room' : 'match';
    if (inQueue(id)) return 'queue';
    return c.busy ? 'busy' : 'online';
  }
  const friends = createFriends({ getUser, userName, saveDB, statusOf, push });

  // Direct friend challenges skip matchmaking, but availability is checked again on acceptance.
  const challenges = new Map(); // recipient -> { id, from, until }
  let nextChallenge = 1;
  function challengeInvite(me, name) {
    const them = friends.idOf(name);
    if (!them || them === me || !friends.areFriends(me, them)) return { ok: false, msg: 'You can only challenge friends' };
    if (statusOf(me) !== 'online') return { ok: false, msg: 'Finish your match or search first' };
    if (statusOf(them) !== 'online') return { ok: false, msg: `${userName(them)} is unavailable right now` };
    if (inCup(me)) return { ok: false, msg: 'You are in the middle of a cup' };
    if (inCup(them)) return { ok: false, msg: `${userName(them)} is in the middle of a cup` };
    const pending = challenges.get(them);
    if (pending && pending.until > Date.now()) return { ok: false, msg: `${userName(them)} already has a challenge waiting` };
    const invite = { id: nextChallenge++, from: me, until: Date.now() + CHALLENGE_INVITE_MS };
    challenges.set(them, invite);
    push(them, { t: 'challenge.invite', id: invite.id, from: userName(me), club: profileOf(me).club });
    return { ok: true, msg: `Challenged ${userName(them)} to a 1v1` };
  }
  function challengeAccept(me, inviteId) {
    const invite = challenges.get(me);
    if (!invite || invite.id !== Number(inviteId)) return { ok: false, msg: 'That challenge is gone' };
    challenges.delete(me);
    if (invite.until < Date.now()) return { ok: false, msg: 'That challenge ran out' };
    if (!friends.areFriends(me, invite.from) || statusOf(me) !== 'online' || statusOf(invite.from) !== 'online' || inCup(me) || inCup(invite.from)) {
      push(invite.from, { t: 'challenge.info', msg: `${userName(me)} is unavailable for a 1v1` });
      return { ok: false, msg: 'One of you is already in a match or search' };
    }
    startRoom('1v1', [{ id: invite.from, team: 'blue' }, { id: me, team: 'red' }], null);
    return { ok: true, msg: `1v1 with ${userName(invite.from)} starting` };
  }
  function challengeDecline(me, inviteId) {
    const invite = challenges.get(me);
    if (!invite || invite.id !== Number(inviteId)) return { ok: true };
    challenges.delete(me);
    push(invite.from, { t: 'challenge.info', msg: `${userName(me)} declined the 1v1 challenge` });
    return { ok: true };
  }

  /* ---------------- parties ----------------
     Friends team up: the leader queues and the whole party goes into the same match on the same
     side (online matches and the online World Cup). */
  const parties = new Map();  // partyId -> { id, leader, members: [ids], invites: Map(id -> expires), off: Map(id -> since) }
  const partyOf = new Map();  // userId -> party
  let nextParty = 1;

  function partyView(party, forId) {
    return {
      t: 'party', id: party.id, leader: userName(party.leader), lead: party.leader === forId,
      members: party.members.map((m) => ({ name: userName(m), club: profileOf(m).club, status: statusOf(m), leader: m === party.leader, you: m === forId })),
      invited: [...party.invites.keys()].map((m) => userName(m)),
    };
  }
  const partyUpdate = (party) => { for (const m of party.members) push(m, partyView(party, m)); };
  const noParty = (id) => push(id, { t: 'party', id: null });

  function partyInvite(me, name) {
    const them = friends.idOf(name);
    if (!them || !friends.areFriends(me, them)) return { ok: false, msg: 'You can only invite friends' };
    if (!conns.has(them)) return { ok: false, msg: `${userName(them)} is offline` };
    let party = partyOf.get(me);
    if (party && party.members.includes(them)) return { ok: false, msg: `${userName(them)} is already in your party` };
    if (party && party.leader !== me) return { ok: false, msg: 'Only the party leader can invite' };
    if (party && party.members.length >= PARTY_MAX) return { ok: false, msg: 'Your party is full' };
    if (!party) {
      party = { id: nextParty++, leader: me, members: [me], invites: new Map(), off: new Map() };
      parties.set(party.id, party); partyOf.set(me, party);
    }
    party.invites.set(them, Date.now() + PARTY_INVITE_MS);
    push(them, { t: 'party.invite', id: party.id, from: userName(me), club: profileOf(me).club });
    partyUpdate(party);
    return { ok: true, msg: `Invited ${userName(them)}` };
  }

  function partyAccept(me, partyId) {
    const party = parties.get(Number(partyId));
    const exp = party && party.invites.get(me);
    if (!party || !exp || exp < Date.now()) { if (party) party.invites.delete(me); return { ok: false, msg: 'That invite ran out' }; }
    if (party.members.includes(me)) return { ok: true };
    if (roomOf(me)) return { ok: false, msg: 'Finish your match first' };
    if (party.members.length >= PARTY_MAX) return { ok: false, msg: 'That party is full' };
    const old = partyOf.get(me);
    if (old) leaveParty(me);
    stopQueue(me);
    party.invites.delete(me);
    stopQueue(party.leader, `${userName(me)} joined the party`); // the search restarts with everyone
    party.members.push(me); partyOf.set(me, party);
    partyUpdate(party);
    return { ok: true, msg: `You joined ${userName(party.leader)}'s party` };
  }

  function partyDecline(me, partyId) {
    const party = parties.get(Number(partyId));
    if (!party || !party.invites.delete(me)) return { ok: true };
    push(party.leader, { t: 'party.info', msg: `${userName(me)} can't play right now` });
    tidyParty(party);
    return { ok: true };
  }

  // leaving (or being taken out by the leader, or gone too long) — the next member takes over as leader
  function leaveParty(id, why) {
    const party = partyOf.get(id);
    if (!party) return;
    stopQueue(id, why === 'kicked' ? null : `${userName(id)} left the party`);
    party.members = party.members.filter((m) => m !== id);
    party.off.delete(id);
    partyOf.delete(id);
    noParty(id);
    if (why === 'kicked') push(id, { t: 'party.info', msg: 'You were taken out of the party' });
    if (party.leader === id && party.members.length) party.leader = party.members[0];
    tidyParty(party);
  }

  // a party of one with nobody invited is just a player again
  function tidyParty(party) {
    const now = Date.now();
    for (const [m, exp] of party.invites) if (exp < now) party.invites.delete(m);
    if (!party.members.length || (party.members.length === 1 && !party.invites.size)) {
      for (const m of party.members) { partyOf.delete(m); noParty(m); }
      parties.delete(party.id);
      return;
    }
    partyUpdate(party);
  }

  function partyKick(me, name) {
    const party = partyOf.get(me), them = friends.idOf(name);
    if (!party || party.leader !== me) return { ok: false, msg: 'Only the party leader can do that' };
    if (them && party.invites.delete(them)) { tidyParty(party); return { ok: true }; }
    if (!them || them === me || !party.members.includes(them)) return { ok: false, msg: 'Not in your party' };
    leaveParty(them, 'kicked');
    return { ok: true };
  }

  // invites run out, and someone whose game has been closed for a minute leaves the party
  function sweepParties() {
    const now = Date.now();
    for (const party of [...parties.values()]) {
      for (const [m, since] of party.off) if (now - since > PARTY_OFFLINE_MS) leaveParty(m);
      if (!parties.has(party.id)) continue;
      let expired = false;
      for (const [, exp] of party.invites) if (exp < now) expired = true;
      if (expired) tidyParty(party);
    }
  }

  // friends see each other come online, start matches, finish them... (checked once a second)
  let lastStatus = new Map();
  function sweepStatus() {
    for (const [id, room] of watchers) if (!rooms.has(room.id) || room.state === 'over') stopWatching(id, true);
    const now = new Map();
    for (const id of conns.keys()) now.set(id, statusOf(id));
    const changed = [];
    for (const [id, st] of now) if (lastStatus.get(id) !== st) changed.push(id);
    for (const id of lastStatus.keys()) if (!now.has(id)) changed.push(id);
    lastStatus = now;
    const views = new Set(), partiesToSend = new Set();
    for (const id of changed) {
      for (const f of friends.friendsOf(id)) if (conns.has(f)) views.add(f);
      const party = partyOf.get(id);
      if (party) partiesToSend.add(party);
    }
    for (const f of views) push(f, friends.view(f));
    for (const party of partiesToSend) partyUpdate(party);
  }

  // a character locked to certain accounts is only ever worn by those accounts, whatever a save claims
  function charFor(wanted, id) {
    const ch = sim.CHARACTERS.find((c) => c.id === wanted);
    return ch && (!ch.only || ch.only.includes(id)) ? ch.id : 'street';
  }

  function profileOf(id) {
    const u = getUser(id);
    const save = (u && u.save) || {};
    const has = (list, v) => !v || list.some((x) => x.id === v);
    return {
      name: userName(id),
      club: (u && u.club) || sim.CLUBS[0].id,
      character: charFor(save.character, id),
      trail: has(sim.TRAILS, save.trail) && save.trail ? save.trail : 'electric',
      celebration: has(sim.CELEBRATIONS, save.celebration) && save.celebration ? save.celebration : 'jump',
      // only an accessory the save actually owns
      accessory: save.accessory && sim.ACCESSORIES.some((a) => a.id === save.accessory) && save.owned && Array.isArray(save.owned.accessory) && save.owned.accessory.includes(save.accessory) ? save.accessory : null,
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
    send(conn, friends.view(userId));
    const party = partyOf.get(userId);
    if (party) { party.off.delete(userId); send(conn, partyView(party, userId)); } else send(conn, { t: 'party', id: null });
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
    stopWatching(userId, false);
    { const c = cupOf.get(userId); if (c && c.state === 'lobby') cupLeave(userId, false); }
    stopQueue(userId, `${userName(userId)} lost connection`);
    const party = partyOf.get(userId);
    if (party) party.off.set(userId, Date.now());
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
    // friends and parties: plenty for anyone clicking about, not enough to spam people
    if (/^(friend|party|challenge)\./.test(msg.t)) {
      if (now - (conn.socialWindow || 0) > 60000) { conn.socialWindow = now; conn.social = 0; }
      if (++conn.social > 40) return send(conn, { t: 'social', ok: false, msg: 'Slow down a bit' });
    }
    const answer = (r) => send(conn, { t: 'social', ok: r.ok, msg: r.msg || null });
    switch (msg.t) {
      case 'i': return input(id, msg);
      case 'pen.shot': return penShot(id, msg);
      case 'pen.dive': return penDive(id, msg);
      case 'ping': return send(conn, { t: 'pong', c: msg.c, s: Date.now() });
      case 'chat': return quickChat(conn, msg.m);
      // playing a match against bots on this device (so friends see you're busy and parties don't pull you out)
      case 'busy': conn.busy = msg.on === true; return;
      case 'cup.create': return cupCreate(conn, msg.size | 0);
      case 'cup.invite': return cupInvite(conn, msg.name);
      case 'cup.uninvite': return cupUninvite(conn, msg.name);
      case 'cup.accept': return cupAnswer(conn, msg.id | 0, true);
      case 'cup.decline': return cupAnswer(conn, msg.id | 0, false);
      case 'cup.start': return cupStart(conn);
      case 'cup.leave': return cupLeave(id, true);
      case 'cup.view': { const c = cupOf.get(id); return send(conn, c ? cupView(c) : { t: 'cup', state: null }); }
      case 'watch': return watchFriend(conn, msg.name);
      case 'unwatch': return stopWatching(id, true);
      case 'friends': return send(conn, friends.view(id));
      case 'friend.add': return answer(friends.add(id, msg.name));
      case 'friend.accept': return answer(friends.accept(id, msg.name));
      case 'friend.decline': return answer(friends.decline(id, msg.name));
      case 'friend.remove': return answer(friends.remove(id, msg.name));
      case 'party.invite': return answer(partyInvite(id, msg.name));
      case 'party.accept': return answer(partyAccept(id, msg.id));
      case 'party.decline': return answer(partyDecline(id, msg.id));
      case 'party.leave': leaveParty(id); return;
      case 'party.kick': return answer(partyKick(id, msg.name));
      case 'challenge.send': return answer(challengeInvite(id, msg.name));
      case 'challenge.accept': return answer(challengeAccept(id, msg.id));
      case 'challenge.decline': return answer(challengeDecline(id, msg.id));
      case 'queue': return joinQueue(conn, msg.format, msg.wc === true);
      case 'unqueue': if (!stopQueue(id, `${userName(id)} stopped the search`)) send(conn, { t: 'unqueued' }); return;
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

  const wcRoundOf = (id, format) => Math.max(0, Math.min(WC_ROUNDS.length - 1, (format === 'pens' ? pwc : wc).round(id) | 0));

  // In a party, the leader's PLAY brings everyone: they all go into one match on the same side.
  function joinQueue(conn, format, worldCup) {
    const id = conn.userId;
    const fail = (msg) => send(conn, { t: 'error', msg });
    // ranked is its own queue, and it is 1v1: your rank is yours, not a team's
    const ranked = format === 'ranked';
    const fmt = ranked ? '1v1' : format;
    if (!FORMAT_SIZE[fmt]) return fail('Pick a format');
    const party = partyOf.get(id);
    let ids = [id];
    if (party && party.members.length > 1) {
      if (ranked) return fail('Ranked is 1v1 — leave your party first');
      if (party.leader !== id) return fail(`${userName(party.leader)} starts the match for your party`);
      const n = party.members.length;
      if (n > FORMAT_SIZE[fmt]) return fail(`Your party of ${n} needs ${n}v${n} or bigger`);
      for (const m of party.members) {
        if (m === id) continue;
        if (!conns.has(m)) return fail(`${userName(m)} is offline`);
        if (roomOf(m)) return fail(`${userName(m)} is still in a match`);
        if (inCup(m)) return fail(`${userName(m)} is in the middle of a cup`);
        if (conns.get(m).busy) return fail(`${userName(m)} is playing a match`);
      }
      ids = party.members.slice();
    }
    if (roomOf(id)) return fail('You are already in a match');
    if (inCup(id)) return fail('Your cup match is next');
    for (const m of ids) { const e = entryOf(m); if (e) removeEntry(e); }
    // a party plays the World Cup round the furthest of them has reached (each one's own run moves on)
    const round = worldCup && !ranked ? Math.max(...ids.map((x) => wcRoundOf(x, fmt))) : null;
    const key = ranked ? 'ranked' : round === null ? fmt : `wc/${fmt}/${round}`;
    (queues[key] = queues[key] || []).push({ userId: id, ids, at: Date.now(), wait: QUEUE_WAIT_MIN + Math.random() * (QUEUE_WAIT_MAX - QUEUE_WAIT_MIN) });
    for (const m of ids) push(m, { t: 'queue', format, wc: round === null ? null : wcRoundOf(m, fmt), party: ids.length > 1 ? ids.map(userName) : null, leader: userName(id) });
  }

  function removeEntry(e) {
    for (const q of Object.values(queues)) { const i = q.indexOf(e); if (i >= 0) { q.splice(i, 1); return true; } }
    return false;
  }

  // take whatever `id` is queued in out of the queue (their whole party with them): everyone in it
  // is told, the others with why. Returns the entry, or null if they weren't queued.
  function stopQueue(id, why) {
    const e = entryOf(id);
    if (!e) return null;
    removeEntry(e);
    for (const m of e.ids) push(m, m === id || !why ? { t: 'unqueued' } : { t: 'unqueued', msg: why });
    return e;
  }

  // two sides of `size` from these queue entries (parties can't be split), taking people in the
  // order they came; returns the entries that fit
  function packQueue(q, size) {
    const chosen = [];
    let total = 0;
    for (const e of q) {
      if (total + e.ids.length > size * 2) continue;
      if (!splitSides([...chosen, e].map((x) => x.ids.length), size)) continue;
      chosen.push(e); total += e.ids.length;
      if (total === size * 2) break;
    }
    return chosen;
  }
  // can groups of these sizes go on two sides of `size` without breaking any up? (the mask of
  // groups on blue, the most even split, or -1)
  function splitSides(lengths, size) {
    const total = lengths.reduce((a, b) => a + b, 0);
    let best = -1, bestGap = Infinity;
    for (let mask = 0; mask < 1 << lengths.length; mask++) {
      let blue = 0;
      for (let i = 0; i < lengths.length; i++) if (mask & (1 << i)) blue += lengths[i];
      if (blue > size || total - blue > size) continue;
      const gap = Math.abs(total - 2 * blue);
      if (gap < bestGap) { bestGap = gap; best = mask; }
    }
    return best >= 0 ? { mask: best } : null;
  }

  function matchmake() {
    sweepParties();
    for (const [key, q] of Object.entries(queues)) {
      const wcKey = key.startsWith('wc/'), ranked = key === 'ranked';
      const format = wcKey ? key.split('/')[1] : ranked ? '1v1' : key;
      const round = wcKey ? Number(key.split('/')[2]) : null;
      // anyone whose connection went away is out (a party with them stops looking)
      for (let i = q.length - 1; i >= 0; i--) {
        const e = q[i];
        if (e.ids.every((m) => conns.has(m))) continue;
        q.splice(i, 1);
        const lost = e.ids.find((m) => !conns.has(m));
        for (const m of e.ids) if (conns.has(m)) push(m, { t: 'unqueued', msg: `${userName(lost)} lost connection` });
      }
      if (!q.length) continue;
      const size = FORMAT_SIZE[format];
      const pick = packQueue(q, size);
      const full = pick.reduce((n, e) => n + e.ids.length, 0) === size * 2;
      if (full || Date.now() - q[0].at >= q[0].wait) {
        for (const e of pick) q.splice(q.indexOf(e), 1);
        startRoom(format, sideUp(pick.map((e) => e.ids), size), null, round, null, ranked);
      }
    }
  }

  // Parties stay together on one side; everyone else: teammates from the same club go together
  // where the numbers allow. `groups`: lists of ids (a party, or one player on their own).
  function sideUp(groups, size) {
    const together = groups.filter((g) => g.length > 1);
    const ids = groups.filter((g) => g.length === 1).map((g) => g[0]);
    const blue = [], red = [];
    const split = splitSides(together.map((g) => g.length), size);
    together.forEach((g, i) => (split && split.mask & (1 << i) ? blue : red).push(...g));
    // the bigger party goes on blue (it doesn't matter which, but it keeps it tidy)
    if (red.length > blue.length) { const t = blue.splice(0); blue.push(...red.splice(0)); red.push(...t); }
    const byClub = new Map();
    for (const id of ids) { const c = profileOf(id).club; byClub.set(c, [...(byClub.get(c) || []), id]); }
    const clubGroups = [...byClub.values()].sort((a, b) => b.length - a.length);
    const half = Math.min(size, Math.ceil((ids.length + blue.length + red.length) / 2));
    for (const g of clubGroups) {
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
    stopQueue(id);
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
    stopQueue(id);
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

  /* ---------------- online penalty shootouts ---------------- */

  function penView(room, seat) {
    const p = room.pen, other = seat.team === 'blue' ? 'red' : 'blue';
    return {
      t: 'pen.start', room: room.id, code: room.code, format: 'pens', side: seat.team,
      clubs: room.clubs, wc: seat.wc, startsIn: Math.max(0, room.startAt - Date.now()),
      // (nothing here says which spots are filled in: online, a filled spot is just another player)
      players: room.seats.map((s) => ({ team: s.team, name: s.name, character: s.character })),
      state: { first: p.model.first, team: p.model.team, n: p.model.n, score: p.model.score, kicks: p.model.kicks, winner: p.model.winner, phase: p.phase, deadline: p.deadline },
      opponent: room.seats.find((s) => s.team === other).name,
    };
  }
  function penBroadcast(room, payload) { for (const s of room.seats) if (s.human && s.conn && !s.gone) send(s.conn, payload); }
  function startPensRoom(entries, code, wcRound = null) {
    const taken = new Set(), seats = [], clubs = {};
    for (const team of ['blue', 'red']) {
      const e = entries.find((x) => x.team === team);
      if (e) {
        const pr = profileOf(e.id); taken.add(pr.name); clubs[team] = pr.club;
        seats.push({ seat: seats.length, team, human: true, userId: e.id, name: pr.name, character: pr.character, club: pr.club, conn: conns.get(e.id), gone: false, wc: wcRound === null ? null : wcRoundOf(e.id, 'pens') });
      } else {
        const character = sim.pickBotCharacter(Math.random, sim.BOT_RARITY_ONLINE).id;
        seats.push({ seat: seats.length, team, human: false, name: null, character, club: null, conn: null, gone: false });
      }
    }
    for (const s of seats) if (!s.human) s.name = botName(taken);
    const clubIds = sim.CLUBS.map((c) => c.id);
    if (!clubs.blue) clubs.blue = pickOne(clubIds.filter((c) => c !== clubs.red));
    if (!clubs.red) clubs.red = pickOne(clubIds.filter((c) => c !== clubs.blue));
    const model = PenModel.create((Date.now() ^ nextRoom * 2654435761) >>> 0);
    const room = { id: nextRoom++, code, format: 'pens', seats, state: 'intro', clubs, startAt: Date.now() + INTRO_MS, created: Date.now(), wc: wcRound,
      pen: { model, phase: 'intro', pending: { shot: null, dive: null }, deadline: Date.now() + INTRO_MS + 10000, nextAt: 0 } };
    rooms.set(room.id, room);
    for (const seat of seats) if (seat.human) send(seat.conn, penView(room, seat));
    return room;
  }
  function penSeat(room, id) { return room.seats.find((s) => s.userId === id && s.human && !s.gone); }
  function penRoles(room) {
    const shooter = room.seats.find((s) => s.team === room.pen.model.team);
    const keeper = room.seats.find((s) => s.team !== room.pen.model.team);
    return { shooter, keeper };
  }
  function penShot(id, msg) {
    const room = roomOf(id); if (!room || !room.pen || room.state !== 'playing' || room.pen.phase !== 'input') return;
    const { shooter } = penRoles(room); if (!shooter || shooter.userId !== id || room.pen.pending.shot) return;
    room.pen.pending.shot = { ax: Number(msg.ax), az: Number(msg.az), power: Number(msg.power), at: Date.now() };
    penTryResolve(room);
  }
  function penDive(id, msg) {
    const room = roomOf(id); if (!room || !room.pen || room.state !== 'playing' || room.pen.phase !== 'input') return;
    const { keeper } = penRoles(room); if (!keeper || keeper.userId !== id || room.pen.pending.dive) return;
    room.pen.pending.dive = { dx: Number(msg.dx), dz: Number(msg.dz), at: Date.now() };
    penTryResolve(room);
  }
  function penBotInputs(room) {
    const p = room.pen, { shooter, keeper } = penRoles(room);
    if (!shooter.human && !p.pending.shot) {
      const side = Math.random() < 0.5 ? -1 : 1;
      p.pending.shot = { ax: side * (0.45 + Math.random() * 0.42), az: 0.08 + Math.random() * 0.68, power: 0.55 + Math.random() * 0.3 };
    }
    if (!keeper.human && !p.pending.dive) {
      const r = Math.random(), side = r < 0.44 ? -1 : r < 0.88 ? 1 : 0;
      p.pending.dive = { dx: side, dz: side ? -0.05 + Math.random() * 0.65 : 1, td: 0.12 + Math.random() * 0.18 };
    }
  }
  function penTryResolve(room) {
    const p = room.pen; penBotInputs(room);
    if (!p.pending.shot || !p.pending.dive || p.phase !== 'input') return;
    const shooter = penRoles(room).shooter, shot = { ...p.pending.shot }, dive = { ...p.pending.dive };
    if (Number.isFinite(shot.at) && Number.isFinite(dive.at)) dive.td = Math.max(-0.8, Math.min(1, (dive.at - shot.at) / 1000));
    else if (!Number.isFinite(dive.td)) dive.td = 0;
    delete shot.at; delete dive.at;
    const quality = shooter.human ? 0.65 : 0.55;
    const result = PenModel.resolve(p.model, shot, dive, quality);
    p.phase = result.winner ? 'end' : 'result'; p.nextAt = Date.now() + (result.winner ? 2600 : 2300); p.deadline = 0;
    penBroadcast(room, { t: 'pen.result', ...result });
  }
  function penBeginTurn(room, now) {
    const p = room.pen; p.pending = { shot: null, dive: null }; p.phase = 'input'; p.turnAt = now; p.deadline = now + 10000;
    penBotInputs(room);
    penBroadcast(room, { t: 'pen.turn', team: p.model.team, n: p.model.n, deadline: p.deadline, score: p.model.score, kicks: p.model.kicks });
    penTryResolve(room);
  }
  function finishPens(room, forfeitTeam = null) {
    if (room.state === 'over') return;
    const winner = forfeitTeam ? (forfeitTeam === 'blue' ? 'red' : 'blue') : room.pen.model.winner;
    if (!winner) return;
    room.state = 'over'; room.endedAt = Date.now(); room.pen.model.winner = winner;
    const moves = new Map(), results = [];
    for (const seat of room.seats) {
      if (!seat.human || seat.gone) continue;
      const outcome = seat.team === winner ? 'win' : 'loss', mine = room.pen.model.score[seat.team], other = room.pen.model.score[seat.team === 'blue' ? 'red' : 'blue'];
      onlineRecord(seat.userId, { outcome, goalsFor: mine, goalsAgainst: other, goals: mine, ranked: false, challenges: 0 });
      if (seat.club) moves.set(seat.club, (moves.get(seat.club) || 0) + (outcome === 'win' ? 1 : -1));
      const cup = room.wc === null || room.wc === undefined ? null : pwc.result(seat.userId, outcome === 'win');
      results.push({ seat, outcome, cup, mine, other });
    }
    ladder.result([...moves].filter(([, d]) => d).map(([club, d]) => [club, Math.sign(d)]));
    for (const { seat, outcome, cup, mine, other } of results) send(seat.conn || conns.get(seat.userId), { t: 'pen.end', winner, outcome, side: seat.team, rank: null, rankD: 0, score: room.pen.model.score, kicks: room.pen.model.kicks, clubs: room.clubs, wc: cup ? { round: seat.wc, won: outcome === 'win', champion: cup.champion, next: cup.round, titles: cup.titles } : null, forfeit: !!forfeitTeam, league: seat.club ? { pos: ladder.pos(seat.club), d: Math.sign(moves.get(seat.club) || 0) } : null });
    saveDB();
  }
  function tickPens(room, now) {
    const p = room.pen;
    if (room.state === 'intro') { if (now < room.startAt) return; room.state = 'playing'; penBeginTurn(room, now); return; }
    if (room.state !== 'playing') return;
    if (p.phase === 'input' && now >= p.deadline) {
      const { shooter, keeper } = penRoles(room);
      if (!p.pending.shot) p.pending.shot = shooter.human ? { ax: 0, az: 0.42, power: 0.58 } : null;
      if (!p.pending.dive) p.pending.dive = keeper.human ? { dx: 0, dz: 1, td: 1 } : null;
      penTryResolve(room);
    } else if (p.phase === 'result' && now >= p.nextAt) penBeginTurn(room, now);
    else if (p.phase === 'end' && now >= p.nextAt) finishPens(room);
  }
  /* ---------------- matches ---------------- */

  // wcRound: the World Cup round this match is (0..3), or null for an ordinary match
  function startRoom(format, entries, code, wcRound = null, cup = null, ranked = false) {
    if (format === 'pens') return startPensRoom(entries, code, wcRound);
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
          seats.push({ seat: seats.length, team, human: true, userId: e.id, name: pr.name, character: pr.character, trail: pr.trail, celebration: pr.celebration, accessory: pr.accessory, club: pr.club, input: new NetInput(), conn: conns.get(e.id), ack: 0, wc: wcRound === null ? null : wcRoundOf(e.id) });
        } else {
          // filled spots dress like people do: some with an accessory, mostly the cheaper ones
          seats.push({ seat: seats.length, team, human: false, name: null, character: sim.pickBotCharacter(Math.random, sim.BOT_RARITY_ONLINE).id, celebration: pickOne(BOT_CELEBS), accessory: Math.random() < 0.3 ? pickOne(BOT_ACCESSORIES) : null });
        }
      }
    }
    for (const s of seats) if (!s.human) s.name = botName(taken);
    const clubIds = sim.CLUBS.map((c) => c.id);
    if (!clubFor.blue) clubFor.blue = pickOne(clubIds.filter((c) => c !== clubFor.red));
    if (!clubFor.red) clubFor.red = pickOne(clubIds.filter((c) => c !== clubFor.blue));

    const room = { id: nextRoom++, code, format, seats, state: 'intro', clubs: clubFor, events: [], tick: 0, acc: 0, last: 0, startAt: Date.now() + INTRO_MS, created: Date.now(), wc: wcRound, cup, ranked: !!ranked };
    room.m = sim.create({
      // World Cup rounds: no draws, and each round a notch tougher than the last
      online: true, format, minutes: MATCH_MINUTES, seats, noDraw: wcRound !== null || !!cup,
      // (the fill-ins start strong, so your level and the round only add half as much as they do offline)
      diff: sim.playerRamp({ ...sim.ONLINE_BOTS }, Math.round(1 + (roomLevel(seats) - 1) * 0.5) + (wcRound || 0) * 3),
      home: sim.Clubs.get(clubFor.blue), club: sim.Clubs.get(clubFor.red),
    }, room.events);
    room.m.events = room.events;
    // map seats to their players
    // ranked: everyone gets three of their own to go for, worth a rank point each
    if (room.ranked) for (const s of seats) if (s.human) s.chal = pickSome(sim.NET_CHALLENGES, 3);
    for (const p of room.m.players) if (p.seat !== null && p.seat !== undefined) seats[p.seat].player = p;
    rooms.set(room.id, room);
    for (const s of seats) if (s.human) sendStart(room, s);
    return room;
  }

  function sendStart(room, seat, viewer) {
    const to = viewer ? viewer.conn : seat.conn;
    if (!viewer) stopWatching(seat.userId, true); // taking a seat of your own ends any watch
    if (room.pen) return send(to, penView(room, seat));
    const m = room.m;
    send(to, {
      watch: viewer ? viewer.name : undefined, fcup: room.cup ? { round: room.cup.round, of: room.cup.of } : undefined,
      ranked: room.ranked || undefined, challenges: seat.chal ? seat.chal.map((c) => ({ id: c.id, text: c.text })) : undefined,
      t: 'start', room: room.id, code: room.code, format: room.format, minutes: MATCH_MINUTES,
      side: seat.team, you: m.players.indexOf(seat.player), clubs: room.clubs,
      startsIn: Math.max(0, room.startAt - Date.now()), tick: room.tick, character: seat.character, wc: seat.wc == null ? room.wc : seat.wc,
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
    if (a) { p.input.q |= a & 127; p.input.aim = { x, y }; }
    const s = Number(msg.s);
    if (Number.isFinite(s)) seat.ack = s;
  }

  /* ---------------- friend tournaments ----------------
     A knockout between four or eight friends. The host invites, everyone plays 1v1s, the winner
     of each tie goes through, and the last one standing lifts the cup. Nobody waits on a player
     who isn't there: an empty side of a tie is a walkover. */
  const CUP_SIZES = [4, 8];
  const CUP_GAP_MS = 9000;        // the breather between rounds
  const CUP_LOBBY_MS = 30 * 60000; // a cup nobody starts goes away
  const cups = new Map();         // cup id -> cup
  const cupOf = new Map();        // user id -> the cup they're in
  let nextCupId = 1;
  const shuffled = (a) => { const l = a.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
  const cupTies = (ids) => { const t = []; for (let i = 0; i < ids.length; i += 2) t.push({ a: ids[i] || null, b: ids[i + 1] || null, sa: null, sb: null, w: null, live: false, done: false }); return t; };
  const cupBusy = (id) => (roomOf(id) ? 'Finish your match first' : inQueue(id) ? 'Stop searching first' : conns.get(id) && conns.get(id).busy ? 'In a match right now' : null);
  const inCup = (id) => { const c = cupOf.get(id); return c && c.state === 'playing' && !c.out.has(id) ? c : null; };

  function cupView(cup) {
    return {
      t: 'cup', id: cup.id, size: cup.size, host: userName(cup.host), state: cup.state, round: cup.round,
      of: Math.round(Math.log2(cup.size)),
      players: cup.players.map((p) => ({ name: userName(p), club: profileOf(p).club, out: cup.out.has(p), gone: !conns.has(p) })),
      invited: [...cup.invites].map((i) => userName(i)),
      rounds: cup.rounds.map((r) => r.map((t) => ({
        a: t.a ? userName(t.a) : null, b: t.b ? userName(t.b) : null, sa: t.sa, sb: t.sb,
        w: t.w ? userName(t.w) : null, live: !!t.live, done: !!t.done,
      }))),
      nextIn: cup.nextAt && cup.state === 'playing' ? Math.max(0, cup.nextAt - Date.now()) : 0,
      champion: cup.champion ? userName(cup.champion) : null,
    };
  }
  function cupPush(cup) { const v = cupView(cup); for (const id of cup.players) push(id, v); }

  function cupCreate(conn, size) {
    const id = conn.userId, fail = (msg) => send(conn, { t: 'error', msg });
    if (!CUP_SIZES.includes(size)) return fail('A cup is 4 or 8 players');
    if (cupOf.has(id)) return fail('You are already in a cup');
    const busy = cupBusy(id); if (busy) return fail(busy);
    const cup = { id: nextCupId++, host: id, size, players: [id], invites: new Set(), out: new Set(), state: 'lobby', rounds: [], round: 0, champion: null, nextAt: 0, made: Date.now() };
    cups.set(cup.id, cup); cupOf.set(id, cup);
    return cupPush(cup);
  }

  function cupInvite(conn, name) {
    const id = conn.userId, cup = cupOf.get(id), fail = (msg) => send(conn, { t: 'error', msg });
    if (!cup || cup.host !== id) return fail('Only the host can invite');
    if (cup.state !== 'lobby') return fail('The cup has already started');
    const them = friends.idOf(name);
    if (!them || !friends.areFriends(id, them)) return fail('You can only invite a friend');
    if (cup.players.includes(them)) return fail(userName(them) + ' is already in');
    if (cup.invites.has(them)) return fail(userName(them) + ' has already been asked');
    if (cup.players.length + cup.invites.size >= cup.size) return fail('The cup is full');
    if (!conns.has(them)) return fail(userName(them) + ' is offline');
    if (cupOf.has(them)) return fail(userName(them) + ' is already in a cup');
    cup.invites.add(them);
    push(them, { t: 'cup.invite', id: cup.id, from: userName(id), club: profileOf(id).club, size: cup.size });
    return cupPush(cup);
  }

  function cupUninvite(conn, name) {
    const cup = cupOf.get(conn.userId);
    if (!cup || cup.host !== conn.userId) return;
    const them = friends.idOf(name);
    if (them && cup.invites.delete(them)) { push(them, { t: 'cup.gone', id: cup.id }); cupPush(cup); }
  }

  function cupAnswer(conn, cupId, yes) {
    const id = conn.userId, cup = cups.get(cupId), fail = (msg) => send(conn, { t: 'error', msg });
    if (!cup || !cup.invites.has(id)) return fail('That cup has gone');
    cup.invites.delete(id);
    if (!yes) { push(cup.host, { t: 'error', msg: userName(id) + ' said no' }); return cupPush(cup); }
    if (cup.state !== 'lobby') return fail('The cup has already started');
    if (cupOf.has(id)) return fail('You are already in a cup');
    const busy = cupBusy(id); if (busy) return fail(busy);
    if (cup.players.length >= cup.size) return fail('The cup is full');
    cup.players.push(id); cupOf.set(id, cup);
    return cupPush(cup);
  }

  function cupStart(conn) {
    const id = conn.userId, cup = cupOf.get(id), fail = (msg) => send(conn, { t: 'error', msg });
    if (!cup || cup.host !== id) return fail('Only the host can start it');
    if (cup.state !== 'lobby') return fail('It has already started');
    if (cup.players.length !== cup.size) return fail('Wait until all ' + cup.size + ' are in');
    for (const p of cup.players) {
      if (!conns.has(p)) return fail(userName(p) + ' has gone offline');
      const busy = cupBusy(p);
      if (busy) return fail(userName(p) + ' is busy right now');
    }
    cup.state = 'playing'; cup.round = 0; cup.rounds = [cupTies(shuffled(cup.players))];
    return cupRun(cup);
  }

  // start every tie of this round that has two players; the rest are walkovers
  function cupRun(cup) {
    const ties = cup.rounds[cup.round];
    cup.nextAt = 0;
    let live = 0;
    ties.forEach((tie, i) => {
      if (tie.w || tie.done) return;
      const ready = (p) => !!p && conns.has(p) && !cup.out.has(p) && !roomOf(p) && !inQueue(p);
      const a = ready(tie.a), b = ready(tie.b);
      if (a && b) {
        startRoom('1v1', [{ id: tie.a, team: 'blue' }, { id: tie.b, team: 'red' }], null, null, { id: cup.id, round: cup.round, tie: i, of: Math.round(Math.log2(cup.size)) });
        tie.live = true; live++;
      } else if (a || b) {
        tie.w = a ? tie.a : tie.b;
        push(tie.w, { t: 'cup.bye', msg: 'YOU GO THROUGH · NOBODY TURNED UP' });
      } else { tie.done = true; }
    });
    cupPush(cup);
    if (!live) cupRoundDone(cup);
  }

  // called the moment a cup match ends, before its results card goes out
  function cupResult(room, forfeitTeam) {
    const cup = cups.get(room.cup.id);
    if (!cup || cup.state !== 'playing') return null;
    const tie = (cup.rounds[room.cup.round] || [])[room.cup.tie];
    if (!tie || tie.w || tie.done) return null;
    const m = room.m, A = tie.a, B = tie.b; // a kicks off in blue, b in red
    tie.sa = m.score.blue; tie.sb = m.score.red; tie.live = false;
    const w = forfeitTeam ? (forfeitTeam === 'blue' ? B : A)
      : m.score.blue !== m.score.red ? (m.score.blue > m.score.red ? A : B)
        : conns.has(A) ? A : B; // (a cup match is golden goal, so a draw can't really happen)
    tie.w = w;
    cup.out.add(w === A ? B : A);
    cupRoundDone(cup);
    return { winner: w, round: room.cup.round, of: Math.round(Math.log2(cup.size)), champion: cup.champion, size: cup.size };
  }

  function cupRoundDone(cup) {
    if (cup.state !== 'playing') return;
    const ties = cup.rounds[cup.round];
    if (!ties.every((t) => t.w || t.done)) return;
    const through = ties.map((t) => t.w).filter(Boolean);
    if (through.length <= 1) {
      cup.state = 'done'; cup.champion = through[0] || null; cup.nextAt = Date.now() + 120000;
      cupPush(cup);
      if (cup.champion) push(cup.champion, { t: 'cup.won', size: cup.size });
      return;
    }
    cup.rounds.push(cupTies(through));
    cup.round++;
    cup.nextAt = Date.now() + CUP_GAP_MS;
    cupPush(cup);
  }

  function cupLeave(id, tell) {
    const cup = cupOf.get(id);
    if (!cup) return;
    cupOf.delete(id);
    if (cup.state === 'lobby') {
      cup.players = cup.players.filter((p) => p !== id);
      if (tell) push(id, { t: 'cup.end' });
      if (cup.host === id || !cup.players.length) return cupDisband(cup, 'THE CUP WAS CALLED OFF');
      return cupPush(cup);
    }
    // once it's under way, leaving is giving up: your tie is a walkover for the other one
    cup.out.add(id);
    if (tell) push(id, { t: 'cup.end', msg: 'YOU LEFT THE CUP' });
    if (cup.state === 'playing') {
      for (const tie of cup.rounds[cup.round]) {
        if (tie.w || tie.done || tie.live || (tie.a !== id && tie.b !== id)) continue;
        const other = tie.a === id ? tie.b : tie.a;
        if (other && !cup.out.has(other) && conns.has(other)) { tie.w = other; push(other, { t: 'cup.bye', msg: 'YOU GO THROUGH · THEY LEFT' }); }
        else tie.done = true;
      }
      cupPush(cup);
      cupRoundDone(cup);
    }
    return undefined;
  }

  function cupDisband(cup, msg) {
    cups.delete(cup.id);
    for (const id of cup.players) { if (cupOf.get(id) === cup) cupOf.delete(id); push(id, { t: 'cup.end', msg }); }
    for (const id of cup.invites) push(id, { t: 'cup.gone', id: cup.id });
    cup.invites.clear();
  }

  function tickCups() {
    const now = Date.now();
    for (const cup of [...cups.values()]) {
      if (!cup.nextAt || now < cup.nextAt) {
        if (cup.state === 'lobby' && now - cup.made > CUP_LOBBY_MS) cupDisband(cup, 'THE CUP TIMED OUT');
        continue;
      }
      if (cup.state === 'playing') { cup.nextAt = 0; cupRun(cup); }
      else if (cup.state === 'done') cupDisband(cup, null);
    }
  }

  /* ---------------- watching a friend ----------------
     A viewer takes no seat and sends no input: they are simply copied every snapshot the players
     get, and are let go when the match finishes or they walk away. */
  const watchers = new Map(); // viewer id -> the room they're watching

  function watchFriend(conn, name) {
    const me = conn.userId;
    const fail = (msg) => send(conn, { t: 'error', msg });
    const them = friends.idOf(name);
    if (!them || !friends.areFriends(me, them)) return fail('You can only watch a friend');
    if (roomOf(me)) return fail('Finish your own match first');
    if (inQueue(me)) return fail('Stop searching first');
    const room = roomOf(them);
    if (!room || room.state === 'lobby' || !room.m) return fail(userName(them) + ' is not in a match');
    if (room.pen) return fail(userName(them) + ' is in a shootout');
    const seat = room.seats.find((s) => s.userId === them && s.player);
    if (!seat) return fail(userName(them) + ' is not in a match');
    stopWatching(me, false);
    room.viewers = room.viewers || new Map();
    room.viewers.set(me, seat.team);
    watchers.set(me, room);
    sendStart(room, seat, { conn, name: userName(them) });
    return undefined;
  }

  function stopWatching(id, tell) {
    const room = watchers.get(id);
    if (room && room.viewers) room.viewers.delete(id);
    watchers.delete(id);
    if (tell && room) push(id, { t: 'watch.end' });
  }

  // the match is over (or gone): everyone watching it is sent home with the score
  function dropViewers(room) {
    if (!room.viewers || !room.viewers.size) return;
    for (const [v, team] of room.viewers) {
      watchers.delete(v);
      const s = room.m && room.m.score;
      push(v, { t: 'watch.end', msg: s ? `THAT MATCH FINISHED ${s[team]}-${s[team === 'blue' ? 'red' : 'blue']}` : 'THAT MATCH FINISHED' });
    }
    room.viewers.clear();
  }

  /* ---------------- quick chat ----------------
     Only the preset lines (sim.QUICK_CHAT), never typed text. It shows as a bubble over the
     player who said it, for everyone in the match. */
  function quickChat(conn, m) {
    const n = m, now = Date.now();
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= sim.QUICK_CHAT.length) return;
    const room = roomOf(conn.userId);
    if (!room || room.state === 'lobby' || !room.m) return;
    const seat = room.seats.find((s) => s.userId === conn.userId);
    if (!seat || !seat.player || seat.gone) return;
    // no spamming (the game holds the button back just the same, so what you see is what they see)
    conn.chatAt = (conn.chatAt || []).filter((t) => now - t < CHAT_BURST_MS);
    if (conn.chatAt.length >= CHAT_BURST || (conn.chatAt.length && now - conn.chatAt[conn.chatAt.length - 1] < CHAT_GAP_MS - 100)) return;
    conn.chatAt.push(now);
    roomChat(room, seat.player, n, seat);
    botAnswer(room, seat, n);
  }
  function roomChat(room, player, n, from) {
    const msg = { t: 'chat', p: room.m.players.indexOf(player), m: n };
    for (const s of room.seats) if (s.human && !s.gone && s !== from) send(s.conn, msg);
    if (room.viewers) for (const v of room.viewers.keys()) push(v, msg);
  }

  // The filled spots chat like people do: now and then, about what just happened.
  const LINE = (text) => sim.QUICK_CHAT.indexOf(text);
  const fillIns = (room) => room.seats.filter((s) => !s.human && s.player && !s.player.isKeeper);
  function botSay(room, player, lines, delayMs) {
    const now = Date.now();
    if ((room.botQuiet || 0) > now || (room.botChat || []).length) return;
    room.botQuiet = now + 4000;
    (room.botChat = room.botChat || []).push({ at: now + delayMs, player, n: LINE(pickOne(lines)) });
  }
  function botGoal(room, g) {
    room.lastGoalAt = Date.now();
    const bots = fillIns(room);
    if (!bots.length || Math.random() > 0.4) return;
    const scorer = room.seats.find((s) => s.player === g.scorer);
    const mates = bots.filter((s) => s.team === g.team), others = bots.filter((s) => s.team !== g.team);
    if (scorer && !scorer.human && !g.own && Math.random() < 0.5) botSay(room, g.scorer, ["LET'S GO!", "LET'S GO!", 'WOW!'], 900 + Math.random() * 1500);
    else if (mates.length && Math.random() < 0.75) botSay(room, pickOne(mates).player, scorer && scorer.human ? ['NICE ONE!', 'WHAT A GOAL!', 'NICE ONE!', 'WOW!'] : ['NICE ONE!', "LET'S GO!"], 1000 + Math.random() * 1800);
    else if (others.length) botSay(room, pickOne(others).player, ['UNLUCKY', 'DEFEND!', 'WOW!'], 1200 + Math.random() * 1800);
  }
  function botAnswer(room, seat, n) {
    const bots = fillIns(room), said = sim.QUICK_CHAT[n];
    if (!bots.length) return;
    const delay = 800 + Math.random() * 1600;
    if ((said === 'HI!' || said === 'GG') && Math.random() < 0.45) botSay(room, pickOne(bots).player, [said], delay);
    else if (said === 'NICE ONE!' || said === 'WHAT A GOAL!') {
      const g = room.m.goals[room.m.goals.length - 1], scorer = g && bots.find((s) => s.player === g.scorer && s.team === seat.team);
      if (scorer && Date.now() - (room.lastGoalAt || 0) < 12000 && Math.random() < 0.55) botSay(room, scorer.player, ['THANKS!'], delay);
    } else if (said === 'SORRY!') {
      const mates = bots.filter((s) => s.team === seat.team);
      if (mates.length && Math.random() < 0.35) botSay(room, pickOne(mates).player, ['UNLUCKY'], delay);
    }
  }
  function botChatTick(room) {
    const m = room.m, now = Date.now();
    if (m.goals.length > (room.seenGoals || 0)) { room.seenGoals = m.goals.length; botGoal(room, m.goals[m.goals.length - 1]); }
    // some people say hi at kickoff, and GG as it ends
    if (!room.saidHi && room.state === 'playing') { room.saidHi = true; const b = fillIns(room); if (b.length && Math.random() < 0.2) botSay(room, pickOne(b).player, ['HI!'], 600 + Math.random() * 2500); }
    if (!room.saidGG && !m.overtime && m.time < 4 && m.phase === 'play') { room.saidGG = true; room.botQuiet = 0; const b = fillIns(room); if (b.length && Math.random() < 0.3) botSay(room, pickOne(b).player, ['GG'], Math.random() * 1500); }
    const q = room.botChat;
    while (q && q.length && q[0].at <= now) { const c = q.shift(); if (c.n >= 0) roomChat(room, c.player, c.n, null); }
  }

  // A player who leaves is replaced by a deliberately poor bot: slow, late to everything,
  // sloppy on the ball. Nobody gets a better teammate out of someone walking off.
  function becomeBot(room, seat) {
    const m = room.m, p = seat.player;
    if (!p || !p.isHuman) return;
    p.isHuman = false; p.input = null; p.charging = false; p.passCharging = false;
    p.botDiff = { ...m.diff, redSpeed: 0.8, aiSlide: 0.06, aiDodge: 0.05, aiSkill: 0.04, aiShotNoise: 95, react: 2.2, mistakes: 3 };
    p.speedMul = p.botDiff.redSpeed;
    p.attr = { speed: 0.96, shot: 0.9, pass: 0.9, finish: 0.05, ctl: -0.6, def: -0.6 };
    m.humans = m.humans.filter((h) => h !== p);
    m.teamHuman = { blue: m.humans.some((h) => h.team === 'blue'), red: m.humans.some((h) => h.team === 'red') };
    if (m.human === p) m.human = m.humans[0] || m.players[0];
  }

  // Someone walked out, or never came back from a dropped connection. It's a loss for them.
  // While anyone from their team is still playing, a poor bot takes their spot; once their
  // team has nobody left, the match ends there and the team still on the pitch wins it.
  function playerLeft(room, seat) {
    if (room.pen) {
      const mine = room.pen.model.score[seat.team], other = room.pen.model.score[seat.team === 'blue' ? 'red' : 'blue'];
      onlineRecord(seat.userId, { outcome: 'loss', goalsFor: mine, goalsAgainst: other, goals: mine });
      if (seat.club) ladder.move(seat.club, -1);
      if (room.wc !== null && room.wc !== undefined && room.state !== 'over') pwc.result(seat.userId, false);
      seat.gone = true; seat.conn = null; finishPens(room, seat.team); saveDB(); return;
    }
    onlineRecord(seat.userId, { outcome: 'loss', goalsFor: 0, goalsAgainst: 0, goals: 0, ranked: !!room.ranked, challenges: 0 });
    if (room.state !== 'over' && seat.club) ladder.move(seat.club, -1);
    if (room.wc !== null && room.wc !== undefined && room.state !== 'over') wc.result(seat.userId, false);
    becomeBot(room, seat);
    seat.gone = true; seat.conn = null;
    const stillPlaying = (team) => room.seats.some((s) => s.human && !s.gone && s.team === team);
    if (room.state !== 'over' && !stillPlaying(seat.team) && room.seats.some((s) => s.human && !s.gone)) finish(room, seat.team);
  }

  function leaveMatch(id) {
    const room = roomOf(id);
    if (!room || room.state === 'lobby') return;
    const seat = room.seats.find((s) => s.userId === id);
    if (room.state !== 'over') playerLeft(room, seat);
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
        r100(winding ? p.slideWindX : p.slideDirX), r100(winding ? p.slideWindY : p.slideDirY), r100(p.fallT), r100(p.hopT),
        (p.ultOn ? 1 : 0) | (p.ultShot ? 2 : 0), p.ultShot ? Math.max(0, ULTS.indexOf(p.ultShot.kind)) : 0, r100(p.ultShot ? p.ultShot.t : 0)];
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
      const me = p ? [seat.ack, r100(p.skillCd), r100(p.slideCd), r100(p.stamina), p.exhausted ? 1 : 0, p.charging ? 1 : 0, r100(p.chargeT), p.bufferT > 0 ? 1 : 0, r100(p.burstT), Math.round(p.ult || 0), chalMask(room, seat)] : null;
      seat.conn.ws.send(`{"t":"s","me":${JSON.stringify(me)},${body}`);
    }
    // anyone watching sees exactly what the players see, minus the "that's you" bits
    if (room.viewers && room.viewers.size) {
      for (const v of room.viewers.keys()) {
        const c = conns.get(v);
        if (!c || !c.ws.open || c.ws.backlog > 512 * 1024) continue;
        c.ws.send(`{"t":"s","me":null,${body}`);
      }
    }
  }

  function finish(room, forfeitTeam) {
    const m = room.m;
    room.state = 'over'; room.endedAt = Date.now();
    dropViewers(room);
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
      forfeit: !!forfeitTeam,
    };
    const fc = room.cup ? cupResult(room, forfeitTeam) : null;
    const results = [], moves = new Map();
    const chalDone = (seat) => { // judged on the final stats, the same way the snapshots judged it
      if (!seat.chal || !seat.player) return [];
      const mine = m.score[seat.team], theirs = m.score[seat.team === 'blue' ? 'red' : 'blue'];
      return seat.chal.filter((c) => c.net(seat.player.stats, mine, theirs, true));
    };
    for (const seat of room.seats) {
      if (!seat.human || seat.gone) continue;
      const mine = m.score[seat.team], theirs = m.score[seat.team === 'blue' ? 'red' : 'blue'];
      const outcome = forfeitTeam ? (seat.team === forfeitTeam ? 'loss' : 'win') : mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
      const stats = seat.player ? seat.player.stats : {};
      // only a ranked match moves your rank, and each challenge you finished in it is a point
      const chal = chalDone(seat);
      onlineRecord(seat.userId, { outcome, goalsFor: mine, goalsAgainst: theirs, goals: stats.goals || 0, ranked: !!room.ranked, challenges: chal.length });
      let cup = null;
      if (room.wc !== null && room.wc !== undefined) {
        const r = wc.result(seat.userId, outcome === 'win');
        cup = { round: seat.wc == null ? room.wc : seat.wc, won: outcome === 'win', champion: r.champion, next: r.round, titles: r.titles };
      }
      if (seat.club) moves.set(seat.club, (moves.get(seat.club) || 0) + (outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0));
      results.push({ seat, outcome, cup, chal });
    }
    // a country moves one place per match, however many of its players were in it
    ladder.result([...moves].filter(([, d]) => d).map(([club, d]) => [club, Math.sign(d)]));
    for (const { seat, outcome, cup, chal } of results) {
      const d = seat.club ? Math.sign(moves.get(seat.club) || 0) : 0;
      send(seat.conn || conns.get(seat.userId), { ...base, side: seat.team, you: m.players.indexOf(seat.player), outcome, format: room.format, wc: cup, league: seat.club ? { pos: ladder.pos(seat.club), d } : null, ranked: !!room.ranked, challenges: seat.chal ? seat.chal.map((c) => ({ text: c.text, done: chal.includes(c) })) : null, rank: room.ranked ? rankOf(seat.userId) : null, rankD: room.ranked ? rankDeltaFor(outcome, chal.length) : 0, fcup: fc ? { round: fc.round, of: fc.of, size: fc.size, won: seat.userId === fc.winner, champion: fc.champion === seat.userId } : null });
    }
    saveDB();
  }

  function tickRooms() {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.state === 'lobby') continue;
      if (room.pen) {
        for (const s of room.seats) if (s.human && !s.conn && !s.gone && s.leftAt && now - s.leftAt > RECONNECT_MS && room.state !== 'over') playerLeft(room, s);
        if (room.state !== 'over') tickPens(room, now);
        if (room.state === 'over' && now - room.endedAt > 10000) rooms.delete(room.id);
        continue;
      }
      if (room.state === 'over') { if (now - room.endedAt > 10000) rooms.delete(room.id); continue; }
      // dropped players get a bot after a grace period
      for (const s of room.seats) if (s.human && !s.conn && !s.gone && s.leftAt && now - s.leftAt > RECONNECT_MS && room.state !== 'over') playerLeft(room, s);
      if (room.state === 'over') continue;
      if (!room.seats.some((s) => s.human && !s.gone)) { dropViewers(room); rooms.delete(room.id); continue; }
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
      if (room.state === 'playing') botChatTick(room);
    }
  }

  setInterval(tickRooms, 4).unref();
  setInterval(sweepStatus, 1000).unref();
  // the client pings every few seconds; a socket silent for a minute is a dead connection
  setInterval(() => { const cut = Date.now() - 60000; for (const c of conns.values()) if (c.ws.lastSeen < cut) c.ws.close(4002); }, 15000).unref();
  setInterval(matchmake, 1000).unref();
  setInterval(tickCups, 500).unref();

  return {
    connect,
    clubs: sim.CLUBS,
    // the rank maths the accounts need (server.js keeps the points, this keeps the rules in one place)
    rank: { tier: sim.rankTier, next: sim.rankNext, delta: sim.rankDelta, seasonNow: sim.seasonNow, seasonEndsAt: sim.seasonEndsAt, tiers: sim.RANK_TIERS },
    countryFor: sim.countryFor,
    stats: () => ({ online: conns.size, rooms: [...rooms.values()].filter((r) => r.state !== 'lobby').length, lobbies: codes.size, queued: Object.values(queues).reduce((a, q) => a + q.length, 0) }),
    inMatch: (id) => !!roomOf(id),
    removeUser(id) { stopWatching(id, false); cupLeave(id, false); stopQueue(id, `${userName(id)} left`); leaveParty(id); for (const p of parties.values()) if (p.invites.delete(id)) tidyParty(p); const r = roomOf(id); if (r) { if (r.state === 'lobby') leaveLobby(r, id); else leaveMatch(id); } const c = conns.get(id); if (c) c.ws.close(); },
    _roomOf: roomOf, // tools only (tools/ballscan.js sets up drills in a live room)
    _social: { queues, parties, partyOf, cups, cupOf }, // tools only (tools/socialscan.js, tools/cupscan.js)
  };
}

module.exports = { createGame, FORMAT_SIZE, WC_ROUNDS };
