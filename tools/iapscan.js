// In-app purchases, end to end against a REAL server process.
//   node tools/iapscan.js
//
// There is no real App Store or Google Play here and no real key. A fake Apple and a fake Google
// run on a local port; the server is pointed at them and given throwaway keys made a second ago.
// The fakes are not lenient: the fake Apple checks the server's ES256 token signature, issuer,
// bundle id and audience, and the fake Google checks its RS256 sign-in and the access token on
// every call. So "the server asked the store correctly" is tested, not assumed.
//
// What must hold, whatever the store says or the player sends:
//   - nothing is credited unless the store says the purchase is real, paid, for this app and this pack
//   - the coins come from the product list, never from the request
//   - one purchase pays once, to one account, even if asked ten times at the same moment
//   - a store that is down or slow never costs a player a purchase: the answer says "retry"
//   - the ledger is on disk before the game is told, so a crash cannot lose a payment
const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { PRODUCTS, IAP_DAILY_PACKS } = require('../js/products.js');
const coinsOf = (id) => PRODUCTS.find((p) => p.id === id).coins;

const STORE_PORT = 8490, GAME_PORT = 8491;
const BUNDLE = 'com.example.ministrikers', ISSUER = 'issuer-123', KEYID = 'KEY123', PACKAGE = 'com.example.ministrikers', GMAIL = 'play@example.iam.gserviceaccount.com';
const DATA = path.join(os.tmpdir(), `ms-iapscan-${process.pid}.json`);

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64u = (b) => Buffer.from(b).toString('base64url');
const enc = (o) => b64u(JSON.stringify(o));

// ---------------- throwaway keys ----------------
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ecPem = ec.privateKey.export({ type: 'pkcs8', format: 'pem' });
const rsaPem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' });

// ---------------- the fake stores ----------------
const apple = new Map();   // transactionId -> { env: 'live'|'sandbox', bundleId, productId, revoked }
const google = new Map();  // purchaseToken -> { state, type, orderId }
const seen = { appleCalls: 0, googleCalls: 0, tokenCalls: 0, appleBad: 0, googleBad: 0 };
let appleDown = false;

function verifyAppleJwt(auth) {
  try {
    const [h, b, s] = String(auth || '').replace(/^Bearer /, '').split('.');
    const head = JSON.parse(Buffer.from(h, 'base64url')), claims = JSON.parse(Buffer.from(b, 'base64url'));
    const good = crypto.verify('sha256', Buffer.from(h + '.' + b), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    return good && head.alg === 'ES256' && head.kid === KEYID && claims.iss === ISSUER && claims.bid === BUNDLE && claims.aud === 'appstoreconnect-v1' && claims.exp > Date.now() / 1000;
  } catch (e) { return false; }
}
let gTokens = 0; const validG = new Set();
function verifyGoogleAssertion(form) {
  try {
    const [h, b, s] = String(new URLSearchParams(form).get('assertion')).split('.');
    const claims = JSON.parse(Buffer.from(b, 'base64url'));
    const good = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + b), rsa.publicKey, Buffer.from(s, 'base64url'));
    return good && claims.iss === GMAIL && /androidpublisher/.test(claims.scope) && claims.aud === `http://127.0.0.1:${STORE_PORT}/token` && claims.exp > Date.now() / 1000;
  } catch (e) { return false; }
}

const fakeStore = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let m;
    if ((m = url.pathname.match(/^\/(live|sandbox)\/inApps\/v1\/transactions\/(\d+)$/))) {
      seen.appleCalls++;
      if (!verifyAppleJwt(req.headers.authorization)) { seen.appleBad++; return send(401, {}); }
      if (appleDown) return send(500, {});
      const t = apple.get(m[2]);
      if (!t || t.env !== (m[1] === 'live' ? 'live' : 'sandbox')) return send(404, { errorCode: 4040010 });
      const payload = { transactionId: m[2], originalTransactionId: m[2], bundleId: t.bundleId, productId: t.productId, type: 'Consumable', quantity: 1, environment: t.env === 'live' ? 'Production' : 'Sandbox' };
      if (t.revoked) payload.revocationDate = Date.now();
      return send(200, { signedTransactionInfo: enc({ alg: 'ES256' }) + '.' + enc(payload) + '.sig' });
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      seen.tokenCalls++;
      if (!verifyGoogleAssertion(body)) { seen.googleBad++; return send(401, {}); }
      const tok = 'gtok-' + (++gTokens); validG.add(tok);
      return send(200, { access_token: tok, expires_in: 3600 });
    }
    if ((m = url.pathname.match(new RegExp(`^/androidpublisher/v3/applications/${PACKAGE}/purchases/products/([^/]+)/tokens/([^/]+)$`)))) {
      seen.googleCalls++;
      if (!validG.has(String(req.headers.authorization || '').replace(/^Bearer /, ''))) { seen.googleBad++; return send(401, {}); }
      const t = google.get(decodeURIComponent(m[2]));
      if (!t) return send(404, {});
      return send(200, { kind: 'androidpublisher#productPurchase', purchaseState: t.state, purchaseType: t.type, orderId: t.orderId, productId: decodeURIComponent(m[1]) });
    }
    send(404, {});
  });
});

// ---------------- the real server ----------------
const log = [];
let child = null;
function start(extraEnv, port = GAME_PORT) {
  child = spawn(process.execPath, ['server.js', String(port)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MS_DATA_FILE: DATA, DATABASE_URL: '', IAP_TEST_MODE: '', IAP_REJECT_TEST: '', ...extraEnv },
  });
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
}
async function waitUp(port = GAME_PORT) {
  for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) return true; } catch (e) { /* not yet */ } await sleep(100); }
  return false;
}
async function stop(hard) {
  if (!child) return;
  const dead = new Promise((r) => child.once('exit', r));
  child.kill(hard ? 'SIGKILL' : undefined); await dead; child = null; await sleep(150);
}
const STORES = {
  APPLE_BUNDLE_ID: BUNDLE, APPLE_ISSUER_ID: ISSUER, APPLE_KEY_ID: KEYID, APPLE_PRIVATE_KEY: ecPem.replace(/\n/g, '\\n'),
  GOOGLE_PACKAGE_NAME: PACKAGE, GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: GMAIL, private_key: rsaPem }),
  IAP_APPLE_URL: `http://127.0.0.1:${STORE_PORT}/live`, IAP_APPLE_SANDBOX_URL: `http://127.0.0.1:${STORE_PORT}/sandbox`,
  IAP_GOOGLE_API: `http://127.0.0.1:${STORE_PORT}`, IAP_GOOGLE_TOKEN_URL: `http://127.0.0.1:${STORE_PORT}/token`,
};

let ipN = 0;
const newIp = () => '10.9.' + (++ipN >> 8) + '.' + (ipN & 255); // the rate limit is per address; each group gets its own
async function post(route, body, ip, port = GAME_PORT) {
  const res = await fetch(`http://127.0.0.1:${port}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip || newIp() }, body: JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* stays null */ }
  return { status: res.status, json, text };
}
let userN = 0;
async function player(port = GAME_PORT) {
  const name = 'ip' + (++userN) + 'x' + (Date.now() % 1000); // usernames are 14 characters at most
  const r = await post('/auth/signup', { username: name, password: 'a-good-long-password-42', club: 'germany' }, null, port);
  if (!r.json || !r.json.token) throw new Error('the scan could not sign up ' + name + ': ' + r.text);
  return { name, token: r.json.token, ip: newIp(), port };
}
const redeem = (p, body) => post('/iap/redeem', { token: p.token, ...body }, p.ip, p.port);
const coins = async (p) => { const r = await post('/me', { token: p.token }, p.ip, p.port); return r.json && r.json.save ? r.json.save.coins : 0; };
const status = (p) => post('/iap/status', { token: p.token }, p.ip, p.port).then((r) => r.json);
let appleId = 700000000; const nextApple = (productId, over = {}) => { const id = String(++appleId); apple.set(id, { env: 'live', bundleId: BUNDLE, productId, revoked: false, ...over }); return id; };
let gN = 0; const nextGoogle = (over = {}) => { const tok = 'GPA.token.' + (++gN) + '.' + crypto.randomBytes(12).toString('hex'); google.set(tok, { state: 0, type: 1, orderId: 'GPA.3300-' + gN, ...over }); return tok; };

(async () => {
  await new Promise((r) => fakeStore.listen(STORE_PORT, '127.0.0.1', r));
  process.on('exit', () => { try { if (child) child.kill(); } catch (e) {} try { fs.unlinkSync(DATA); } catch (e) {} });

  // ================= A server nobody has set up =================
  console.log('a server with no store configured');
  start({});
  check('it starts', await waitUp());
  let p = await player();
  let st = await status(p);
  check('buying is off', st && st.ok && st.enabled === false && st.canBuy === false, st);
  let r = await redeem(p, { platform: 'apple', productId: 'coins_pack_1', transactionId: '700000001' });
  check('an Apple purchase is refused, nothing credited', r.json && r.json.ok === false && (await coins(p)) === 0, r.json);
  r = await redeem(p, { platform: 'test', productId: 'coins_pack_1', transactionId: 'test-abcdef' });
  check('and so is the make-believe store, which is off', r.json && r.json.ok === false, r.json);
  await stop();

  // ================= Both stores set up =================
  console.log('both stores configured');
  start(STORES);
  check('it starts', await waitUp());
  p = await player();
  st = await status(p);
  check('buying is on, the make-believe store is not', st && st.enabled === true && st.test === false && st.canBuy === true && st.limit === IAP_DAILY_PACKS, st);

  r = await post('/iap/redeem', { platform: 'apple', productId: 'coins_pack_1', transactionId: '1' }, newIp());
  check('signed out, redeeming is refused (401)', r.status === 401, r.status);

  console.log('Apple');
  let id = nextApple('coins_pack_3');
  r = await redeem(p, { platform: 'apple', productId: 'coins_pack_3', transactionId: id });
  check('a real purchase pays', r.json && r.json.ok === true && r.json.coins === coinsOf('coins_pack_3') && r.json.delivered === coinsOf('coins_pack_3'), r.json);
  check('the account has the coins', (await coins(p)) === coinsOf('coins_pack_3'));
  check('the server signed its request correctly (fake Apple checked the ES256 token)', seen.appleCalls >= 1 && seen.appleBad === 0, seen);

  r = await redeem(p, { platform: 'apple', productId: 'coins_pack_3', transactionId: id });
  check('asking again pays nothing more', r.json && r.json.ok === true && r.json.again === true && r.json.coins === 0, r.json);
  check('and the balance has not moved', (await coins(p)) === coinsOf('coins_pack_3'));

  const other = await player();
  r = await redeem(other, { platform: 'apple', productId: 'coins_pack_3', transactionId: id });
  check('another account cannot cash the same purchase in', r.json && r.json.ok === false && r.json.final === true && (await coins(other)) === 0, r.json);

  id = nextApple('coins_pack_1');
  r = await redeem(other, { platform: 'apple', productId: 'coins_pack_5', transactionId: id });
  check('a small pack cannot be passed off as the big one', r.json && r.json.ok === false && (await coins(other)) === 0, r.json);

  id = nextApple('coins_pack_5', { bundleId: 'com.someone.else' });
  r = await redeem(other, { platform: 'apple', productId: 'coins_pack_5', transactionId: id });
  check('a purchase from a different app is refused', r.json && r.json.ok === false && (await coins(other)) === 0, r.json);

  id = nextApple('coins_pack_2', { revoked: true });
  r = await redeem(other, { platform: 'apple', productId: 'coins_pack_2', transactionId: id });
  check('a refunded purchase is refused', r.json && r.json.ok === false && (await coins(other)) === 0, r.json);

  r = await redeem(other, { platform: 'apple', productId: 'coins_pack_2', transactionId: '799999999' });
  check('one the store has never heard of is refused, and is final (no retry)', r.json && r.json.ok === false && !r.json.retry && (await coins(other)) === 0, r.json);

  for (const bad of ['abc', '12', "1'; DROP TABLE", '1'.repeat(40), '']) {
    r = await redeem(other, { platform: 'apple', productId: 'coins_pack_1', transactionId: bad });
    if (!(r.json && r.json.ok === false)) { check('a junk transaction id is refused: ' + JSON.stringify(bad), false, r.json); }
  }
  check('junk transaction ids are all refused', (await coins(other)) === 0);

  id = nextApple('coins_pack_2', { env: 'sandbox' });
  r = await redeem(other, { platform: 'apple', productId: 'coins_pack_2', transactionId: id });
  check('a test purchase from the sandbox is accepted (App Review uses these)', r.json && r.json.ok === true && (await coins(other)) === coinsOf('coins_pack_2'), r.json);

  const q = await player();
  id = nextApple('coins_pack_1');
  appleDown = true;
  r = await redeem(q, { platform: 'apple', productId: 'coins_pack_1', transactionId: id });
  check('when Apple is down the answer is "retry", and nothing is credited', r.json && r.json.ok === false && r.json.retry === true && (await coins(q)) === 0, r.json);
  appleDown = false;
  r = await redeem(q, { platform: 'apple', productId: 'coins_pack_1', transactionId: id });
  check('and when Apple is back, the same purchase goes through', r.json && r.json.ok === true && (await coins(q)) === coinsOf('coins_pack_1'), r.json);

  console.log('Google');
  const g = await player();
  let tok = nextGoogle();
  r = await redeem(g, { platform: 'google', productId: 'coins_pack_4', purchaseToken: tok });
  check('a real purchase pays', r.json && r.json.ok === true && r.json.coins === coinsOf('coins_pack_4') && (await coins(g)) === coinsOf('coins_pack_4'), r.json);
  check('the server signed in to Google correctly (fake Google checked the RS256 token)', seen.tokenCalls >= 1 && seen.googleBad === 0, seen);
  r = await redeem(g, { platform: 'google', productId: 'coins_pack_4', purchaseToken: tok });
  check('asking again pays nothing more', r.json && r.json.ok === true && r.json.again === true && (await coins(g)) === coinsOf('coins_pack_4'), r.json);

  const g2 = await player();
  tok = nextGoogle({ state: 1 });
  r = await redeem(g2, { platform: 'google', productId: 'coins_pack_1', purchaseToken: tok });
  check('a cancelled purchase is refused', r.json && r.json.ok === false && !r.json.retry && (await coins(g2)) === 0, r.json);
  tok = nextGoogle({ state: 2 });
  r = await redeem(g2, { platform: 'google', productId: 'coins_pack_1', purchaseToken: tok });
  check('a payment still pending is "retry", not a refusal', r.json && r.json.ok === false && r.json.retry === true && (await coins(g2)) === 0, r.json);
  google.get(tok).state = 0;
  r = await redeem(g2, { platform: 'google', productId: 'coins_pack_1', purchaseToken: tok });
  check('and once it clears it pays', r.json && r.json.ok === true && (await coins(g2)) === coinsOf('coins_pack_1'), r.json);
  r = await redeem(g2, { platform: 'google', productId: 'coins_pack_1', purchaseToken: 'GPA.nobody.knows.this.token.at.all' });
  check('an unknown token is refused', r.json && r.json.ok === false && !r.json.retry, r.json);
  for (const bad of ['short', 'has spaces in it and is long enough to pass the length', '../../etc/passwd/../../x', 'x'.repeat(500)]) {
    r = await redeem(g2, { platform: 'google', productId: 'coins_pack_1', purchaseToken: bad });
    if (!(r.json && r.json.ok === false)) check('a junk token is refused: ' + bad.slice(0, 20), false, r.json);
  }
  check('junk tokens are all refused', (await coins(g2)) === coinsOf('coins_pack_1'));
  const g3 = await player();
  tok = nextGoogle({ type: 0 });
  r = await redeem(g3, { platform: 'google', productId: 'coins_pack_2', purchaseToken: tok });
  check('a licence-tester purchase is accepted', r.json && r.json.ok === true, r.json);

  console.log('what the player sends is never believed');
  const h = await player();
  id = nextApple('coins_pack_1');
  r = await redeem(h, { platform: 'apple', productId: 'coins_pack_1', transactionId: id, coins: 999999999, delivered: 999999999, price: '$0.01' });
  check('a made-up coin amount in the request is ignored', r.json && r.json.coins === coinsOf('coins_pack_1') && (await coins(h)) === coinsOf('coins_pack_1'), r.json);
  for (const body of [{ platform: 'paypal', productId: 'coins_pack_1', transactionId: '1' }, { platform: 'apple', productId: 'coins_pack_999', transactionId: '1' }, { platform: 'apple', transactionId: '1' }, { productId: 'coins_pack_1' }, { platform: { a: 1 }, productId: ['x'], transactionId: {} }]) {
    r = await redeem(h, body);
    if (!(r.status === 200 && r.json && r.json.ok === false)) check('nonsense is refused: ' + JSON.stringify(body), false, r.json);
  }
  check('unknown stores, unknown packs and nonsense are all refused cleanly', (await coins(h)) === coinsOf('coins_pack_1'));

  console.log('ten requests at once for one purchase');
  const c = await player();
  id = nextApple('coins_pack_2');
  const results = await Promise.all(Array.from({ length: 10 }, () => redeem(c, { platform: 'apple', productId: 'coins_pack_2', transactionId: id })));
  const paid = results.filter((x) => x.json && x.json.ok && !x.json.again).length;
  check('exactly one of them paid', paid === 1, { paid, answers: results.map((x) => x.json && (x.json.again ? 'again' : x.json.ok ? 'paid' : x.json.msg)) });
  check('and the balance is one pack', (await coins(c)) === coinsOf('coins_pack_2'));
  const racer = await player();
  id = nextApple('coins_pack_1');
  const two = await Promise.all([redeem(c, { platform: 'apple', productId: 'coins_pack_1', transactionId: id }), redeem(racer, { platform: 'apple', productId: 'coins_pack_1', transactionId: id })]);
  const winners = two.filter((x) => x.json && x.json.ok && !x.json.again).length;
  check('two accounts racing for one purchase: only one wins', winners === 1, two.map((x) => x.json));

  console.log('the daily limit');
  const d = await player();
  for (let i = 0; i < IAP_DAILY_PACKS; i++) await redeem(d, { platform: 'apple', productId: 'coins_pack_1', transactionId: nextApple('coins_pack_1') });
  st = await status(d);
  check(`after ${IAP_DAILY_PACKS} packs the shop says enough for today`, st && st.enabled === true && st.canBuy === false && st.bought === IAP_DAILY_PACKS, st);
  r = await redeem(d, { platform: 'apple', productId: 'coins_pack_1', transactionId: nextApple('coins_pack_1') });
  check('but a purchase already paid for is still credited, never refused', r.json && r.json.ok === true && (await coins(d)) === coinsOf('coins_pack_1') * (IAP_DAILY_PACKS + 1), r.json);

  console.log('rate limit');
  const t = await player();
  const burst = [];
  for (let i = 0; i < 30; i++) burst.push(await redeem(t, { platform: 'apple', productId: 'coins_pack_1', transactionId: '799999998' }));
  check('hammering the endpoint is slowed down (429)', burst.some((x) => x.status === 429), burst.map((x) => x.status).filter((s, i, a) => a.indexOf(s) === i));

  console.log('a crash cannot lose a payment');
  const k = await player();
  id = nextApple('coins_pack_4');
  r = await redeem(k, { platform: 'apple', productId: 'coins_pack_4', transactionId: id });
  check('the purchase was paid', r.json && r.json.ok === true, r.json);
  await stop(true); // killed outright: no chance to save anything
  start(STORES);
  check('it starts again', await waitUp());
  const k2 = { ...k, ip: newIp() };
  const back = await post('/me', { token: k.token }, k2.ip);
  check('the old sign-in is gone with the restart (sessions are saved lazily) or the coins are there', back.status === 401 || (back.json && back.json.save && back.json.save.coins === coinsOf('coins_pack_4')), back.status);
  const login = await post('/auth/login', { username: k.name, password: 'a-good-long-password-42' }, newIp());
  check('logging back in shows the coins, every one', login.json && login.json.ok && login.json.save && login.json.save.coins === coinsOf('coins_pack_4'), login.json && login.json.save && login.json.save.coins);
  const k3 = { name: k.name, token: login.json.token, ip: newIp() };
  r = await redeem(k3, { platform: 'apple', productId: 'coins_pack_4', transactionId: id });
  check('the ledger survived: the same purchase is "already counted", not paid again', r.json && r.json.ok === true && r.json.again === true && (await coins(k3)) === coinsOf('coins_pack_4'), r.json);
  await stop();

  // ================= Refusing test purchases once the game is out =================
  console.log('IAP_REJECT_TEST=1');
  start({ ...STORES, IAP_REJECT_TEST: '1' });
  check('it starts', await waitUp());
  const rj = await player();
  id = nextApple('coins_pack_1', { env: 'sandbox' });
  r = await redeem(rj, { platform: 'apple', productId: 'coins_pack_1', transactionId: id });
  check('a sandbox purchase is now refused', r.json && r.json.ok === false && (await coins(rj)) === 0, r.json);
  tok = nextGoogle({ type: 0 });
  r = await redeem(rj, { platform: 'google', productId: 'coins_pack_1', purchaseToken: tok });
  check('and so is a licence-tester purchase', r.json && r.json.ok === false && (await coins(rj)) === 0, r.json);
  id = nextApple('coins_pack_1');
  r = await redeem(rj, { platform: 'apple', productId: 'coins_pack_1', transactionId: id });
  check('while a real one still pays', r.json && r.json.ok === true, r.json);
  await stop();

  // ================= The make-believe store, for a laptop =================
  console.log('IAP_TEST_MODE=1 (laptop only)');
  start({ IAP_TEST_MODE: '1' });
  check('it starts', await waitUp());
  const tm = await player();
  st = await status(tm);
  check('the shop is on, as a make-believe store', st && st.enabled === true && st.test === true, st);
  r = await redeem(tm, { platform: 'test', productId: 'coins_pack_2', transactionId: 'test-abc123' });
  check('a made-up receipt pays', r.json && r.json.ok === true && (await coins(tm)) === coinsOf('coins_pack_2'), r.json);
  r = await redeem(tm, { platform: 'test', productId: 'coins_pack_2', transactionId: 'test-abc123' });
  check('once only', r.json && r.json.again === true && (await coins(tm)) === coinsOf('coins_pack_2'), r.json);
  r = await redeem(tm, { platform: 'apple', productId: 'coins_pack_2', transactionId: '700000099' });
  check('and a real store still is not on', r.json && r.json.ok === false, r.json);
  await stop();

  // The live game uses the real database. The make-believe store must be impossible there.
  const { create } = require('../server/iap.js');
  const live = create({ isProduction: true, env: { IAP_TEST_MODE: '1', IAP_APPLE_URL: 'http://evil.example', APPLE_BUNDLE_ID: 'x' } });
  check('with the real database, IAP_TEST_MODE does nothing', live.status().test === false && live.status().enabled === false, live.status());
  const lv = await live.verify({ platform: 'test', productId: 'coins_pack_1', transactionId: 'test-abc123' });
  check('and a make-believe receipt is refused', lv.ok === false, lv);

  const errs = log.join('').split('\n').filter((l) => /uncaught|unhandled|TypeError|ReferenceError/i.test(l));
  check('the server never threw once', errs.length === 0, errs.slice(0, 3));
  console.log(failures ? `\n${failures} FAILED` : '\nall in-app purchase checks passed');
  fakeStore.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); console.log(log.join('').slice(-1500)); process.exit(1); });
