// Friends: add someone by their username, they accept, and from then on you each see when the
// other is online (and can invite them to a party). Kept on the account:
//   u.friends  ids you're friends with
//   u.reqIn    ids that asked to be your friend
//   u.reqOut   ids you asked
//   u.blocked  ids you blocked: no requests either way, no quick chat, never in your matches
const MAX_FRIENDS = 100, MAX_REQUESTS = 50, MAX_BLOCKED = 200;
const ID_OK = /^[a-z0-9_]{3,14}$/;
// who shows first: people you can play with right now, then everyone else
const STATUS_ORDER = { online: 0, queue: 1, room: 2, busy: 3, match: 4, offline: 5 };

// statusOf(id) -> 'offline' | 'online' | 'queue' | 'room' | 'busy' | 'match'
// push(id, message) sends to them if they're connected
function createFriends({ getUser, userName, saveDB, statusOf, push }) {
  const list = (u, key) => (Array.isArray(u[key]) ? u[key] : (u[key] = []));
  const drop = (u, key, id) => { const l = list(u, key), i = l.indexOf(id); if (i >= 0) { l.splice(i, 1); return true; } return false; };
  // a username typed in, as an account id (or null: no such player — a banned account counts as gone)
  const idOf = (name) => { const id = String(name == null ? '' : name).trim().toLowerCase(); return ID_OK.test(id) && getUser(id) && !getUser(id).banned ? id : null; };
  const areFriends = (a, b) => { const u = getUser(a); return !!u && list(u, 'friends').includes(b); };
  // either one blocked the other: that is enough to keep them apart
  const blocks = (a, b) => { const u = getUser(a); return !!u && Array.isArray(u.blocked) && u.blocked.includes(b); };
  const isBlocked = (a, b) => !!a && !!b && a !== b && (blocks(a, b) || blocks(b, a));
  const friendsOf = (id) => { const u = getUser(id); return u ? list(u, 'friends').filter((f) => getUser(f)) : []; };

  function view(id) {
    const u = getUser(id);
    if (!u) return { t: 'friends', friends: [], incoming: [], outgoing: [] };
    const alive = (key) => list(u, key).filter((f) => getUser(f));
    const friends = alive('friends').map((f) => ({ name: userName(f), club: getUser(f).club, status: statusOf(f) }))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
    return {
      t: 'friends', friends,
      incoming: alive('reqIn').map((f) => ({ name: userName(f), club: getUser(f).club })),
      outgoing: alive('reqOut').map((f) => ({ name: userName(f) })),
      blocked: alive('blocked').map((f) => ({ name: userName(f) })),
    };
  }
  const refresh = (...ids) => { for (const id of ids) push(id, view(id)); };

  // every action answers { ok, msg } for the toast
  function add(me, name) {
    const them = idOf(name);
    if (!them) return { ok: false, msg: `No player called ${String(name || '').trim().toUpperCase().slice(0, 14) || 'that'}` };
    if (them === me) return { ok: false, msg: "That's you!" };
    const u = getUser(me), v = getUser(them);
    if (blocks(me, them)) return { ok: false, msg: `You blocked ${userName(them)}. Unblock them first` };
    // they blocked you: say no without saying why
    if (blocks(them, me)) return { ok: false, msg: `Can't send ${userName(them)} a request` };
    if (list(u, 'friends').includes(them)) return { ok: false, msg: `You're already friends with ${userName(them)}` };
    // they already asked you: adding them back is saying yes
    if (list(u, 'reqIn').includes(them)) return accept(me, them);
    if (list(u, 'reqOut').includes(them)) return { ok: false, msg: `Already asked ${userName(them)}` };
    if (list(u, 'friends').length >= MAX_FRIENDS) return { ok: false, msg: 'Your friends list is full' };
    if (list(u, 'reqOut').length >= MAX_REQUESTS) return { ok: false, msg: 'Too many requests waiting' };
    if (list(v, 'reqIn').length >= MAX_REQUESTS) return { ok: false, msg: `${userName(them)} has too many requests` };
    list(u, 'reqOut').push(them);
    list(v, 'reqIn').push(me);
    saveDB();
    refresh(me, them);
    push(them, { t: 'friend.req', name: userName(me) });
    return { ok: true, msg: `Friend request sent to ${userName(them)}` };
  }

  function accept(me, name) {
    const them = idOf(name);
    const u = getUser(me), v = them && getUser(them);
    if (!v || !list(u, 'reqIn').includes(them) || isBlocked(me, them)) return { ok: false, msg: 'That request has gone' };
    if (list(u, 'friends').length >= MAX_FRIENDS) return { ok: false, msg: 'Your friends list is full' };
    if (list(v, 'friends').length >= MAX_FRIENDS) return { ok: false, msg: `${userName(them)}'s friends list is full` };
    drop(u, 'reqIn', them); drop(v, 'reqOut', me);
    drop(u, 'reqOut', them); drop(v, 'reqIn', me);
    if (!list(u, 'friends').includes(them)) list(u, 'friends').push(them);
    if (!list(v, 'friends').includes(me)) list(v, 'friends').push(me);
    saveDB();
    refresh(me, them);
    push(them, { t: 'friend.new', name: userName(me) });
    return { ok: true, msg: `You and ${userName(them)} are friends` };
  }

  function decline(me, name) {
    const them = idOf(name);
    const u = getUser(me);
    if (!them || !drop(u, 'reqIn', them)) return { ok: false, msg: 'That request has gone' };
    drop(getUser(them), 'reqOut', me);
    saveDB();
    refresh(me, them);
    return { ok: true };
  }

  // unfriend, or take back a request you sent
  function remove(me, name) {
    const them = idOf(name);
    if (!them) return { ok: false, msg: 'Not on your list' };
    const u = getUser(me), v = getUser(them);
    const had = [drop(u, 'friends', them), drop(v, 'friends', me), drop(u, 'reqOut', them), drop(v, 'reqIn', me)].some(Boolean);
    if (!had) return { ok: false, msg: 'Not on your list' };
    saveDB();
    refresh(me, them);
    return { ok: true };
  }

  // Block: they come off your friends and requests (both ways), can't ask again, and their quick
  // chat never reaches you. It works on anyone with an account, friend or not.
  function block(me, name) {
    const them = idOf(name);
    if (!them) return { ok: false, msg: `No player called ${String(name || '').trim().toUpperCase().slice(0, 14) || 'that'}` };
    if (them === me) return { ok: false, msg: "You can't block yourself" };
    const u = getUser(me), v = getUser(them);
    if (list(u, 'blocked').includes(them)) return { ok: true, msg: `${userName(them)} is already blocked` };
    if (list(u, 'blocked').length >= MAX_BLOCKED) return { ok: false, msg: 'Your blocked list is full' };
    for (const [x, y] of [[u, them], [v, me]]) for (const key of ['friends', 'reqIn', 'reqOut']) drop(x, key, y);
    list(u, 'blocked').push(them);
    saveDB();
    refresh(me, them);
    return { ok: true, msg: `${userName(them)} is blocked` };
  }

  function unblock(me, name) {
    const id = String(name == null ? '' : name).trim().toLowerCase();
    if (!drop(getUser(me), 'blocked', id)) return { ok: false, msg: 'Not on your blocked list' };
    saveDB();
    refresh(me);
    return { ok: true, msg: `${userName(id)} is unblocked` };
  }

  return { view, add, accept, decline, remove, block, unblock, isBlocked, idOf, areFriends, friendsOf };
}

// an account going away comes off everyone else's lists
function forgetEverywhere(users, id, skip) {
  let changed = false;
  for (const [uid, u] of Object.entries(users)) {
    if (uid === skip || !u || typeof u !== 'object') continue;
    for (const key of ['friends', 'reqIn', 'reqOut', 'blocked']) {
      if (Array.isArray(u[key]) && u[key].includes(id)) { u[key] = u[key].filter((x) => x !== id); changed = true; }
    }
  }
  return changed;
}

module.exports = { createFriends, forgetEverywhere };
