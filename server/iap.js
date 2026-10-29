// In-app purchases: checking that a purchase is real before a single coin is handed over.
//
// The game never tells the server "I bought 140,000 coins". It sends the store's own record of the
// purchase (an App Store transaction id, or a Google Play purchase token) and the server asks
// Apple or Google whether that purchase exists, is paid, and is for this app. Only then does it look
// the product up in js/products.js and credit what that product is worth. Nothing in the request
// is believed on its own.
//
// Switched on by environment variables (see README). With none set, every purchase is refused, so
// a server that has not been set up cannot hand out coins by accident.
//
//   Apple   APPLE_BUNDLE_ID  APPLE_ISSUER_ID  APPLE_KEY_ID  APPLE_PRIVATE_KEY  (the .p8, with \n for newlines)
//   Google  GOOGLE_PACKAGE_NAME  GOOGLE_SERVICE_ACCOUNT_JSON  (the whole key file, as one line)
//
// Both stores also hand out free *test* purchases (Apple sandbox, Google licence testers), and
// App Review uses them, so those are accepted. IAP_REJECT_TEST=1 turns them away once the game is out.
//
// The last switch, IAP_TEST_MODE=1, accepts a made-up receipt and exists so the shop can be tried
// on a laptop with no store at all. It only takes effect when the server is NOT using the real
// database, so it can never be on for the live game.

const crypto = require('crypto');
// js/products.js names its packs through tl() (js/i18n.js); here they are English
if (typeof global.tl !== 'function') global.tl = (s) => s;
const { PRODUCTS, IAP_DAILY_PACKS } = require('../js/products.js');

const b64u = (b) => Buffer.from(b).toString('base64url');
const enc = (o) => b64u(JSON.stringify(o));
const fail = (msg, retry = false) => ({ ok: false, msg, retry });

function create({ env = process.env, isProduction = true } = {}) {
  const hooks = !isProduction; // URL overrides and the make-believe store are for a laptop only

  const apple = { bundleId: env.APPLE_BUNDLE_ID, issuerId: env.APPLE_ISSUER_ID, keyId: env.APPLE_KEY_ID, key: String(env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n') };
  const appleOn = !!(apple.bundleId && apple.issuerId && apple.keyId && apple.key.includes('PRIVATE KEY'));

  let google = null;
  try { google = env.GOOGLE_SERVICE_ACCOUNT_JSON ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) : null; } catch (e) { google = null; }
  const googleOn = !!(google && google.client_email && google.private_key && env.GOOGLE_PACKAGE_NAME);

  const testOn = hooks && env.IAP_TEST_MODE === '1';
  const rejectTest = env.IAP_REJECT_TEST === '1';

  const APPLE_URL = (hooks && env.IAP_APPLE_URL) || 'https://api.storekit.itunes.apple.com';
  const APPLE_SANDBOX_URL = (hooks && env.IAP_APPLE_SANDBOX_URL) || 'https://api.storekit-sandbox.itunes.apple.com';
  const GOOGLE_API = (hooks && env.IAP_GOOGLE_API) || 'https://androidpublisher.googleapis.com';
  const GOOGLE_TOKEN_URL = (hooks && env.IAP_GOOGLE_TOKEN_URL) || 'https://oauth2.googleapis.com/token';

  async function get(url, opts = {}) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 10000);
    try { return await fetch(url, { ...opts, signal: stop.signal }); } finally { clearTimeout(timer); }
  }

  // ---- Apple: App Store Server API, "get transaction info" ----
  let appleJwtCache = null;
  function appleJwt() {
    const now = Math.floor(Date.now() / 1000);
    if (appleJwtCache && appleJwtCache.exp > now + 60) return appleJwtCache.jwt;
    const head = enc({ alg: 'ES256', kid: apple.keyId, typ: 'JWT' });
    const body = enc({ iss: apple.issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1', bid: apple.bundleId });
    const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: apple.key, dsaEncoding: 'ieee-p1363' });
    appleJwtCache = { exp: now + 1200, jwt: head + '.' + body + '.' + b64u(sig) };
    return appleJwtCache.jwt;
  }

  async function verifyApple(productId, transactionId) {
    if (!appleOn) return fail('Buying with the App Store is not switched on yet');
    if (!/^\d{5,20}$/.test(transactionId)) return fail('That is not an App Store transaction');
    let jwt;
    try { jwt = appleJwt(); } catch (e) { console.error('iap: Apple key unusable:', e.message); return fail('The store could not be reached right now', true); }
    // a test purchase is not known to the real store, so ask the live one and then the sandbox
    for (const [base, label] of [[APPLE_URL, 'live'], [APPLE_SANDBOX_URL, 'test']]) {
      let res;
      try { res = await get(`${base}/inApps/v1/transactions/${transactionId}`, { headers: { Authorization: 'Bearer ' + jwt } }); }
      catch (e) { return fail('The store could not be reached right now', true); }
      if (res.status === 404) continue;
      if (res.status === 401 || res.status === 403) { console.error('iap: Apple rejected our key (' + res.status + ')'); return fail('The store could not be reached right now', true); }
      if (!res.ok) return fail('The store could not be reached right now', true);
      let tx;
      try {
        const data = await res.json();
        tx = JSON.parse(Buffer.from(String(data.signedTransactionInfo).split('.')[1], 'base64url').toString('utf8'));
      } catch (e) { return fail('The store sent something unreadable', true); }
      // The answer came straight from Apple over TLS with our own key, so it is Apple's. What is
      // left to check is that it is about THIS app, THIS pack, and that it was not refunded.
      if (tx.bundleId !== apple.bundleId) return fail('That purchase is for a different app');
      if (tx.productId !== productId) return fail('That purchase is for a different pack');
      if (String(tx.transactionId) !== transactionId) return fail('That purchase does not match');
      if (tx.revocationDate) return fail('That purchase was refunded');
      const env2 = String(tx.environment || '').toLowerCase() === 'production' ? 'live' : label === 'test' ? 'test' : 'live';
      if (env2 === 'test' && rejectTest) return fail('Test purchases are switched off');
      return { ok: true, txid: 'apple:' + transactionId, productId, env: env2 };
    }
    return fail('The App Store has no record of that purchase');
  }

  // ---- Google: Play Developer API, purchases.products.get ----
  let googleTok = null;
  async function googleAccessToken() {
    if (googleTok && googleTok.exp > Date.now() + 60000) return googleTok.value;
    const now = Math.floor(Date.now() / 1000);
    const head = enc({ alg: 'RS256', typ: 'JWT' });
    const claims = enc({ iss: google.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 });
    const sig = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + claims), google.private_key);
    const res = await get(GOOGLE_TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claims + '.' + b64u(sig) }),
    });
    if (!res.ok) throw new Error('Google token ' + res.status);
    const j = await res.json();
    googleTok = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
    return googleTok.value;
  }

  async function verifyGoogle(productId, token) {
    if (!googleOn) return fail('Buying with Google Play is not switched on yet');
    if (typeof token !== 'string' || token.length < 20 || token.length > 400 || /[^A-Za-z0-9._-]/.test(token)) return fail('That is not a Google Play purchase');
    let access;
    try { access = await googleAccessToken(); } catch (e) { console.error('iap: Google sign-in failed:', e.message); return fail('The store could not be reached right now', true); }
    const url = `${GOOGLE_API}/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
    let res;
    try { res = await get(url, { headers: { Authorization: 'Bearer ' + access } }); }
    catch (e) { return fail('The store could not be reached right now', true); }
    if (res.status === 400 || res.status === 404 || res.status === 410) return fail('Google Play has no record of that purchase');
    if (!res.ok) { if (res.status === 401 || res.status === 403) { googleTok = null; console.error('iap: Google rejected our key (' + res.status + ')'); } return fail('The store could not be reached right now', true); }
    let p;
    try { p = await res.json(); } catch (e) { return fail('The store sent something unreadable', true); }
    if (p.purchaseState === 2) return fail('That payment has not gone through yet', true);
    if (p.purchaseState !== 0) return fail('That purchase was cancelled or refunded');
    const isTest = p.purchaseType === 0;
    if (isTest && rejectTest) return fail('Test purchases are switched off');
    const orderId = typeof p.orderId === 'string' && p.orderId ? p.orderId : crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
    return { ok: true, txid: 'google:' + orderId, productId, env: isTest ? 'test' : 'live' };
  }

  // ---- the make-believe store, laptop only ----
  function verifyTest(productId, transactionId) {
    if (!testOn) return fail('Buying is not switched on yet');
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(transactionId)) return fail('That is not a test purchase');
    return { ok: true, txid: 'test:' + transactionId, productId, env: 'test' };
  }

  // body: { platform: 'apple' | 'google' | 'test', productId, transactionId, purchaseToken }
  async function verify(body) {
    const productId = typeof body.productId === 'string' ? body.productId : '';
    if (!PRODUCTS.some((p) => p.id === productId)) return fail('Unknown pack');
    const tid = typeof body.transactionId === 'string' ? body.transactionId.trim() : String(body.transactionId || '');
    if (body.platform === 'apple') return verifyApple(productId, tid);
    if (body.platform === 'google') return verifyGoogle(productId, typeof body.purchaseToken === 'string' ? body.purchaseToken : '');
    if (body.platform === 'test') return verifyTest(productId, tid);
    return fail('Unknown store');
  }

  return {
    // what the shop is allowed to offer: nothing, unless a store is configured
    status: () => ({ apple: appleOn, google: googleOn, test: testOn, enabled: appleOn || googleOn || testOn }),
    verify,
    product: (id) => PRODUCTS.find((p) => p.id === id) || null,
  };
}

// ---- the ledger: what each account has bought ----
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// packs bought today (UTC) on this account
function boughtToday(user, now = Date.now()) {
  const today = dayKey(now);
  let n = 0;
  for (const rec of Object.values((user && user.purchases) || {})) if (rec && rec.day === today) n++;
  return n;
}

module.exports = { create, dayKey, boughtToday, IAP_DAILY_PACKS, PRODUCTS };
