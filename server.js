// Mini Strikers server. Plain Node, no required dependencies.
//
//   node server.js [port]
//
// Serves the game, keeps accounts (sign up picks your club), stores progress,
// keeps the league table and runs live online matches over a WebSocket.
// Accounts live in data.json locally, or Postgres when DATABASE_URL is set.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { screenUsername } = require('./server/moderation');
const { attach } = require('./server/ws');
const { createGame } = require('./server/game');
const { forgetEverywhere } = require('./server/friends');

const PORT = Number(process.argv[2] || process.env.PORT || 8450);
const BUILD = 29;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const PBKDF2_ITERATIONS = 150000;
const DATABASE_URL = process.env.DATABASE_URL || '';

/* ---------------- storage ---------------- */

let DB = { users: {} };
// the league ladder is one shared record kept alongside the accounts, under an id no username can be
const LEAGUE_ID = '#league';

function makeFileStore() {
  return {
    kind: 'file',
    async load() {
      try { return JSON.parse(await fs.promises.readFile(DATA_FILE, 'utf8')).users || {}; }
      catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
    },
    async write(users) {
      await fs.promises.writeFile(DATA_FILE + '.tmp', JSON.stringify({ users }));
      await fs.promises.rename(DATA_FILE + '.tmp', DATA_FILE);
    },
    // the whole map is rewritten, so a deleted account has to trigger a write of its own
    async remove() { await this.write(DB.users); },
  };
}

function makePostgresStore(url) {
  let neon;
  try { ({ neon } = require('@neondatabase/serverless')); }
  catch (e) { console.error('DATABASE_URL is set but the Postgres driver is missing. Run "npm install".'); process.exit(1); }
  const sql = neon(url);
  return {
    kind: 'postgres',
    async load() {
      await sql`CREATE TABLE IF NOT EXISTS strikers_users (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      const rows = await sql`SELECT id, data FROM strikers_users`;
      const users = {};
      for (const row of rows) users[row.id] = row.data;
      return users;
    },
    async write(users, changed) {
      for (const id of changed) {
        if (!users[id]) continue;
        await sql`INSERT INTO strikers_users (id, data) VALUES (${id}, ${JSON.stringify(users[id])})
                  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      }
    },
    async remove(id) { await sql`DELETE FROM strikers_users WHERE id = ${id}`; },
  };
}

const store = DATABASE_URL ? makePostgresStore(DATABASE_URL) : makeFileStore();
const persisted = new Map();
let saveTimer = null, saving = false, saveQueued = false;

function saveDB() { clearTimeout(saveTimer); saveTimer = setTimeout(flushDB, 300); }
setInterval(() => flushDB(), 5000).unref();

async function flushDB() {
  if (saving) { saveQueued = true; return; }
  const changed = Object.keys(DB.users).filter((id) => persisted.get(id) !== JSON.stringify(DB.users[id]));
  if (!changed.length) return;
  saving = true;
  try {
    await store.write(DB.users, changed);
    for (const id of changed) persisted.set(id, JSON.stringify(DB.users[id]));
  } catch (e) { console.error('Could not save accounts:', e.message); }
  finally { saving = false; if (saveQueued) { saveQueued = false; saveDB(); } }
}

/* ---------------- progress sanity ----------------
   Progress is kept on the client and posted back (like War Prize). Numbers are clamped
   and can only climb so fast per save, so a forged save can't hand out a fortune. */

const SAVE_MAX_BYTES = 40000;
const LIMITS = {
  coins: { min: 0, max: 2000000000, gain: 12000 }, // max leaves room for gifts; gain still limits what a game can add
  xp: { min: 0, max: 100000000, gain: 8000 },
  trophies: { min: 0, max: 100000, gain: 3 },
  matches: { min: 0, max: 1000000, gain: 20 },
  wins: { min: 0, max: 1000000, gain: 20 },
  goals: { min: 0, max: 10000000, gain: 400 },
};
function clampNumber(v, lim, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(lim.max, Math.max(lim.min, Math.floor(n)));
}
function sanitizeSave(incoming, previous, club) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return previous || null;
  let text;
  try { text = JSON.stringify(incoming); } catch (e) { return previous || null; }
  if (!text || text.length > SAVE_MAX_BYTES) return previous || null;
  const save = JSON.parse(text);
  const prev = previous && typeof previous === 'object' ? previous : null;
  for (const [key, lim] of Object.entries(LIMITS)) {
    if (!(key in save)) continue;
    save[key] = clampNumber(save[key], lim, prev ? clampNumber(prev[key], lim, lim.min) : lim.min);
    if (prev) {
      const was = clampNumber(prev[key], lim, lim.min);
      if (save[key] > was + lim.gain) save[key] = was + lim.gain;
    }
  }
  save.club = club; // your club is set at sign-up and lives on the account, not in the save
  return save;
}

/* ---------------- gifts ---------------- */

// Coins handed to a player by the game's owner. Each gift is queued once at startup (its key is
// remembered on the account, so restarts never repeat it) and delivered the next time that
// player's game syncs: on sign-in / opening the game, or on a save from a game that knows gifts.
const GIFTS = [
  { key: '2026-09-17-billion', user: 'irizarrygamez1', club: 'germany', coins: 1000000000 },
];
function queueGifts() {
  for (const g of GIFTS) {
    const u = getUser(g.user);
    if (!u) { console.log(`gift ${g.key}: no account ${g.user}`); continue; }
    if (g.club && u.club !== g.club) { console.log(`gift ${g.key}: ${g.user} plays for ${u.club}, not ${g.club}`); continue; }
    u.giftsDone = Array.isArray(u.giftsDone) ? u.giftsDone : [];
    if (u.giftsDone.includes(g.key)) continue;
    u.giftsDone.push(g.key);
    u.pendingCoins = (Number(u.pendingCoins) || 0) + g.coins;
    saveDB();
    console.log(`gift ${g.key}: ${g.coins} coins queued for ${g.user}`);
  }
}
// moves queued coins into the stored save; returns how many arrived
function deliverGifts(u) {
  const n = Number(u.pendingCoins) || 0;
  if (n <= 0) return 0;
  if (!u.save || typeof u.save !== 'object') u.save = {};
  u.save.coins = clampNumber((Number(u.save.coins) || 0) + n, LIMITS.coins, 0);
  u.pendingCoins = 0;
  saveDB();
  return n;
}

/* ---------------- accounts ---------------- */

const getUser = (id) => DB.users[id];
const tokens = new Map();
const SESSIONS_PER_USER = 5;
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function str(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}
const normalizeId = (name) => str(name).trim().toLowerCase();
const userName = (id) => (getUser(id) && getUser(id).name) || String(id).toUpperCase();

function hashPassword(password, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(str(password), salt, iterations, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key.toString('base64'))));
  });
}

// Deliberately NOT checking whether another account uses the same password (see War Prize).
const COMMON_PASSWORDS = new Set(['password', 'password1', 'passw0rd', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyui',
  '1q2w3e4r', 'abc12345', 'iloveyou', 'letmein1', 'welcome1', 'admin123', 'football', 'baseball', 'sunshine', 'princess',
  'dragon123', 'monkey123', 'superman', 'trustno1', 'starwars', 'whatever', 'soccer123', 'messi123', 'ronaldo7']);

function validateUsername(username) {
  const id = normalizeId(username);
  if (id.length < 3 || id.length > 14) return 'Username must be 3-14 characters';
  if (!/^[a-z0-9_]+$/.test(id)) return 'Use letters, numbers and _ only';
  return null;
}
// Sign-up only. Login must never run password policy: old accounts have to keep working.
function validateNewPassword(username, password) {
  const bad = validateUsername(username);
  if (bad) return bad;
  const pw = str(password);
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > 200) return 'Password is too long';
  if (COMMON_PASSWORDS.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return 'That password is too easy to guess';
  if (pw.toLowerCase() === normalizeId(username)) return "Password can't be your username";
  return null;
}

function issueToken(id) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, id);
  const u = getUser(id), now = Date.now();
  u.sessions = (u.sessions || []).filter((s) => s && s.token && now - (s.at || 0) < SESSION_MAX_AGE);
  u.sessions.push({ token, at: now });
  while (u.sessions.length > SESSIONS_PER_USER) tokens.delete(u.sessions.shift().token);
  saveDB();
  return token;
}
function forgetSession(token) {
  const id = tokens.get(token);
  tokens.delete(token);
  const u = id && getUser(id);
  if (u && u.sessions) { u.sessions = u.sessions.filter((s) => s.token !== token); saveDB(); }
}
function restoreSessions() {
  const now = Date.now();
  for (const [id, u] of Object.entries(DB.users)) {
    if (id === LEAGUE_ID) continue;
    u.sessions = (u.sessions || []).filter((s) => s && s.token && now - (s.at || 0) < SESSION_MAX_AGE);
    for (const s of u.sessions) tokens.set(s.token, id);
  }
}
const userIdFromToken = (token) => tokens.get(str(token));

/* ---------------- league ----------------
   Every online match adds to your own record, and your record counts for your country. The table's
   ORDER is a ladder: every online win moves your country up one place, every loss down one (a draw
   leaves it). It started from the old points order, and new countries join at the bottom. */

// the old points order (how the ladder was seeded)
function pointsOrder() {
  const t = new Map(CLUBS.map((c) => [c.id, { club: c.id, players: 0, pts: 0, gd: 0, gf: 0 }]));
  for (const [id, u] of Object.entries(DB.users)) {
    if (id === LEAGUE_ID) continue;
    const r = t.get(u.club), o = u.online;
    if (!r) continue;
    r.players++;
    if (o) { r.pts += (o.w | 0) * 3 + (o.d | 0); r.gd += (o.gf | 0) - (o.ga | 0); r.gf += o.gf | 0; }
  }
  return [...t.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.players - a.players).map((r) => r.club);
}
function ladder() {
  let rec = DB.users[LEAGUE_ID];
  if (!rec || !Array.isArray(rec.order)) rec = DB.users[LEAGUE_ID] = { order: pointsOrder(), last: {} };
  // every country exactly once
  const known = new Set(CLUBS.map((c) => c.id));
  const order = rec.order.filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
  for (const c of CLUBS) if (!order.includes(c.id)) order.push(c.id);
  if (order.length !== rec.order.length || order.some((id, i) => id !== rec.order[i])) { rec.order = order; saveDB(); }
  if (!rec.last || typeof rec.last !== 'object') rec.last = {};
  return rec;
}
// d > 0: a win, up one place (swapping with the country above); d < 0: a loss, down one
function leagueMove(club, d) {
  const rec = ladder(), i = rec.order.indexOf(club);
  if (i < 0 || !d) return;
  const j = i - Math.sign(d);
  if (j >= 0 && j < rec.order.length) [rec.order[i], rec.order[j]] = [rec.order[j], rec.order[i]];
  rec.last[club] = { d: Math.sign(d), t: Date.now() };
  leagueCache = null;
  saveDB();
}
// one match's result for every country in it ([club, +1 | -1] ...): winners go up first, and a loser the
// winner's swap already pushed down a place has had its drop (two neighbours playing just swap)
function leagueResult(list) {
  const rec = ladder(), losers = new Set(list.filter(([, d]) => d < 0).map(([c]) => c)), dropped = new Set();
  for (const [club, d] of list) {
    if (d <= 0) continue;
    const i = rec.order.indexOf(club);
    if (i < 0) continue;
    if (i > 0) { const other = rec.order[i - 1]; [rec.order[i - 1], rec.order[i]] = [club, other]; if (losers.has(other)) dropped.add(other); }
    rec.last[club] = { d: 1, t: Date.now() };
  }
  for (const [club, d] of list) {
    if (d >= 0 || dropped.has(club)) { if (d < 0) rec.last[club] = { d: -1, t: Date.now() }; continue; }
    const i = rec.order.indexOf(club);
    if (i < 0) continue;
    if (i < rec.order.length - 1) { const other = rec.order[i + 1]; [rec.order[i], rec.order[i + 1]] = [other, club]; }
    rec.last[club] = { d: -1, t: Date.now() };
  }
  leagueCache = null;
  saveDB();
}
const leaguePos = (club) => ladder().order.indexOf(club) + 1;

function onlineRecord(id, { outcome, goalsFor, goalsAgainst, goals }) {
  const u = getUser(id);
  if (!u) return;
  const o = u.online || (u.online = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, goals: 0 });
  o.p++;
  if (outcome === 'win') o.w++; else if (outcome === 'draw') o.d++; else o.l++;
  o.gf += goalsFor | 0; o.ga += goalsAgainst | 0; o.goals += goals | 0;
  leagueCache = null;
  saveDB();
}

let leagueCache = null;
function leagueTable() {
  if (leagueCache && Date.now() - leagueCache.at < 10000) return leagueCache.rows;
  const rows = CLUBS.map((c) => ({ club: c.id, players: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }));
  const byId = new Map(rows.map((r) => [r.club, r]));
  const scorers = [];
  for (const [id, u] of Object.entries(DB.users)) {
    if (id === LEAGUE_ID) continue;
    const r = byId.get(u.club);
    if (!r) continue;
    r.players++;
    const o = u.online;
    if (!o) continue;
    for (const k of ['p', 'w', 'd', 'l', 'gf', 'ga']) r[k] += o[k] | 0;
    if (o.goals) scorers.push({ name: u.name, club: u.club, goals: o.goals, p: o.p });
  }
  const lad = ladder(), rank = new Map(lad.order.map((id, i) => [id, i]));
  for (const r of rows) { r.pts = r.w * 3 + r.d; r.gd = r.gf - r.ga; r.move = lad.last[r.club] ? lad.last[r.club].d : 0; }
  rows.sort((a, b) => rank.get(a.club) - rank.get(b.club));
  scorers.sort((a, b) => b.goals - a.goals || a.p - b.p);
  leagueCache = { at: Date.now(), rows: { table: rows, scorers: scorers.slice(0, 10) } };
  return leagueCache.rows;
}

/* ---------------- http ---------------- */

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 256 * 1024) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const DENY_FILES = new Set(['data.json', 'data.json.tmp', 'server.js', 'package.json', 'package-lock.json', 'serve.py', 'readme.md', 'render.yaml']);
const DENY_DIRS = new Set(['server', 'node_modules']);
// the test tools are for this computer only
const LOCAL_ONLY_DIRS = new Set(['tools']);
const isLoopback = (req) => /^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress || '') && !req.headers['x-forwarded-for'];

function serveStatic(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath); }
  catch (e) { res.writeHead(400).end('Bad request'); return; }
  const segs = rel.split('/').filter(Boolean);
  if (segs.some((s) => s.startsWith('.')) || (segs.length > 1 && (DENY_DIRS.has(segs[0]) || (LOCAL_ONLY_DIRS.has(segs[0]) && !isLoopback(req))))) { res.writeHead(404).end('Not found'); return; }
  const full = path.resolve(ROOT, '.' + rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  if (DENY_FILES.has(path.basename(full).toLowerCase())) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const hits = new Map();
function throttled(ip, key, limit, windowMs) {
  const k = ip + ':' + key, now = Date.now();
  const rec = hits.get(k) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(k, rec);
  return rec.n > limit;
}
setInterval(() => { const cut = Date.now() - 600000; for (const [k, v] of hits) if (v.t < cut) hits.delete(k); }, 60000).unref();

/* ---------------- online World Cup ----------------
   Your run lives on your account: which round you're in (0 = round of 16 ... 3 = final) and how
   many you've won. Win and you go through; lose (or walk off) and you start again next time. */
const WC_LAST = 3;
function worldCupOf(u) {
  const w = u && u.wc && typeof u.wc === 'object' ? u.wc : {};
  return { round: Math.max(0, Math.min(WC_LAST, Number(w.round) | 0)), titles: Math.max(0, Number(w.titles) | 0) };
}
const worldCup = {
  round: (id) => worldCupOf(getUser(id)).round,
  result(id, won) {
    const u = getUser(id);
    if (!u) return { round: 0, champion: false, titles: 0 };
    const w = worldCupOf(u);
    const champion = won && w.round === WC_LAST;
    u.wc = { round: won && !champion ? w.round + 1 : 0, titles: w.titles + (champion ? 1 : 0) };
    saveDB();
    return { round: u.wc.round, champion, titles: u.wc.titles };
  },
};

function penaltyWorldCupOf(u) {
  const w = u && u.pwc && typeof u.pwc === 'object' ? u.pwc : {};
  return { round: Math.max(0, Math.min(WC_LAST, Number(w.round) | 0)), titles: Math.max(0, Number(w.titles) | 0) };
}
const penaltyWorldCup = {
  round: (id) => penaltyWorldCupOf(getUser(id)).round,
  result(id, won) {
    const u = getUser(id);
    if (!u) return { round: 0, champion: false, titles: 0 };
    const w = penaltyWorldCupOf(u), champion = won && w.round === WC_LAST;
    u.pwc = { round: won && !champion ? w.round + 1 : 0, titles: w.titles + (champion ? 1 : 0) };
    saveDB();
    return { round: u.pwc.round, champion, titles: u.pwc.titles };
  },
};
const game = createGame({
  getUser, userName, saveDB, onlineRecord, worldCup, penaltyWorldCup, league: { move: (club, d) => leagueMove(club, d), result: (list) => leagueResult(list), pos: (club) => leaguePos(club) },
  isNameTaken: (name) => !!getUser(String(name).toLowerCase()),
});
const CLUBS = game.clubs;

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('request failed:', req.method, req.url, '-', err && err.message);
    try { sendJSON(res, 500, { ok: false, msg: 'Something went wrong' }); } catch (e) {}
  });
});

function publicUser(id) {
  const u = getUser(id);
  return { name: u.name, club: u.club, save: u.save, online: u.online || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, goals: 0 }, wc: worldCupOf(u), pwc: penaltyWorldCupOf(u) };
}


async function handleRequest(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return sendJSON(res, 400, { ok: false, msg: 'Bad request' }); }
  const route = url.pathname;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!route.startsWith('/api/')) return serveStatic(req, res, route);
  // the host's health check is a plain GET, so this one route answers both
  if (route === '/api/health' && req.method === 'GET') return sendJSON(res, 200, { ok: true, build: BUILD, storage: store.kind });
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, msg: 'Use POST' });

  let body;
  try { body = await readBody(req); } catch (e) { return sendJSON(res, 400, { ok: false, msg: 'Bad request' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

  if (route === '/api/health') return sendJSON(res, 200, { ok: true, build: BUILD, storage: store.kind });

  if (route === '/api/league') {
    if (throttled(ip, 'league', 60, 60000)) return sendJSON(res, 429, { ok: false, msg: 'Slow down' });
    return sendJSON(res, 200, { ok: true, ...leagueTable() });
  }

  if (route === '/api/auth/signup' || route === '/api/auth/login') {
    if (throttled(ip, 'auth', 20, 60000)) return sendJSON(res, 429, { ok: false, msg: 'Too many attempts, wait a minute' });
    const signup = route === '/api/auth/signup';
    const problem = signup ? validateNewPassword(body.username, body.password) : validateUsername(body.username);
    if (problem) return sendJSON(res, 200, { ok: false, msg: problem });
    const id = normalizeId(body.username);
    if (signup) {
      const rude = screenUsername(body.username);
      if (rude) return sendJSON(res, 200, { ok: false, msg: rude });
      const club = str(body.club);
      if (!CLUBS.some((c) => c.id === club)) return sendJSON(res, 200, { ok: false, msg: 'Pick your country' });
      if (getUser(id)) return sendJSON(res, 200, { ok: false, msg: 'That username is taken' });
      const salt = crypto.randomBytes(16).toString('base64');
      const hash = await hashPassword(body.password, salt, PBKDF2_ITERATIONS);
      if (getUser(id)) return sendJSON(res, 200, { ok: false, msg: 'That username is taken' });
      DB.users[id] = { name: id.toUpperCase(), hash, salt, iterations: PBKDF2_ITERATIONS, created: Date.now(), club, save: null, online: null };
      // a guest's progress on this device comes along, clamped like any other save
      DB.users[id].save = sanitizeSave(body.save, { coins: 0, xp: 0, trophies: 0, matches: 0, wins: 0, goals: 0 }, club);
      leagueCache = null;
      saveDB();
      return sendJSON(res, 200, { ok: true, token: issueToken(id), ...publicUser(id) });
    }
    const u = getUser(id);
    if (!u) return sendJSON(res, 200, { ok: false, msg: 'No account with that username' });
    if (str(body.password).length > 200) return sendJSON(res, 200, { ok: false, msg: 'Wrong password' });
    if (await hashPassword(body.password, u.salt, u.iterations) !== u.hash) return sendJSON(res, 200, { ok: false, msg: 'Wrong password' });
    const gift = deliverGifts(u); // the game takes the account's save as it comes back here
    return sendJSON(res, 200, { ok: true, token: issueToken(id), ...publicUser(id), gift });
  }

  const me = userIdFromToken(body.token);
  if (!me || !getUser(me)) return sendJSON(res, 401, { ok: false, msg: 'Not signed in' });
  const meUser = getUser(me);

  if (route === '/api/me') { const gift = deliverGifts(meUser); return sendJSON(res, 200, { ok: true, ...publicUser(me), gift }); }

  if (route === '/api/save') {
    if (throttled(ip, 'save', 40, 60000)) return sendJSON(res, 429, { ok: false, msg: 'Slow down' });
    meUser.save = sanitizeSave(body.save, meUser.save, meUser.club);
    // only a game that adds the gift to its own coins may take it (older open pages would overwrite it)
    const gift = body.gifts === true ? deliverGifts(meUser) : 0;
    saveDB();
    return sendJSON(res, 200, { ok: true, save: meUser.save, gift });
  }

  if (route === '/api/logout') { forgetSession(str(body.token)); return sendJSON(res, 200, { ok: true }); }

  if (route === '/api/account/delete') {
    if (await hashPassword(str(body.password), meUser.salt, meUser.iterations) !== meUser.hash) return sendJSON(res, 200, { ok: false, msg: 'Wrong password' });
    game.removeUser(me);
    for (const [tok, id] of tokens) if (id === me) tokens.delete(tok);
    delete DB.users[me]; persisted.delete(me); leagueCache = null;
    forgetEverywhere(DB.users, me, LEAGUE_ID); // off everyone's friends lists
    try { await store.remove(me); } catch (e) { console.error('delete failed:', e.message); }
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { ok: false, msg: 'Unknown endpoint' });
}

// Live play. The first message has to be {t:'auth', token} within a few seconds.
attach(server, '/ws', (ws) => {
  const timer = setTimeout(() => ws.close(4001), 5000);
  const onAuth = (msg) => {
    if (msg.t !== 'auth') return;
    clearTimeout(timer);
    ws.removeListener('message', onAuth);
    const id = userIdFromToken(msg.token);
    if (!id || !getUser(id)) { ws.send(JSON.stringify({ t: 'error', msg: 'Not signed in', auth: false })); ws.close(4001); return; }
    game.connect(ws, id);
  };
  ws.on('message', onAuth);
});
process.on('unhandledRejection', (err) => console.error('unhandled rejection:', (err && err.stack) || err));
process.on('uncaughtException', (err) => console.error('uncaught exception:', (err && err.stack) || err));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => { clearTimeout(saveTimer); try { await flushDB(); } catch (e) {} process.exit(0); });
}

(async () => {
  try { DB.users = await store.load(); }
  catch (e) { console.error(`Could not load accounts from ${store.kind}: ${e.message}`); process.exit(1); }
  for (const id of Object.keys(DB.users)) persisted.set(id, JSON.stringify(DB.users[id]));
  // the league used to be clubs: anyone still on a club plays for that club's country
  for (const [id, u] of Object.entries(DB.users)) {
    if (id === LEAGUE_ID) continue;
    const country = game.countryFor(u.club);
    if (u.club !== country) { u.club = country; if (u.save) { u.save.club = country; u.save.cup = null; } leagueCache = null; saveDB(); }
  }
  restoreSessions();
  queueGifts();
  server.listen(PORT, () => {
    console.log(`Mini Strikers server on http://localhost:${PORT}`);
    console.log(`accounts: ${Object.keys(DB.users).filter((id) => id !== LEAGUE_ID).length} (storage: ${store.kind})`);
  });
})();
