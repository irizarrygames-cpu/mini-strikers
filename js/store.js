// In-app purchases, the game's side of it.
//
// Coins are bought through the App Store or Google Play and nowhere else: the stores take the
// payment, the game never sees a card number. All this file does is start a purchase, hand the
// store's record of it to OUR server (server/iap.js checks it with Apple or Google and credits the
// coins), and only then tell the store the purchase was delivered.
//
// That order is the whole point. A purchase the server has not confirmed is never marked finished,
// so the store keeps offering it (Apple until it is finished, Google for three days before it
// refunds it), and it is tried again at the next launch or sign-in. Coins are never lost to a bad
// connection, and never granted without a payment.
//
// On the web there is nothing to buy: the page has no store to talk to, so the shop does not
// appear at all. In the app, the purchase plugin (cordova-plugin-purchase, added when the game is
// wrapped for the stores) provides window.CdvPurchase and everything below lights up.
//
// A laptop has no store either, so a server started with IAP_TEST_MODE=1 (and only a server that
// is not using the real database) makes this behave as a make-believe one, to try the shop out.
const IAP_KNOWN_KEY = 'ms.iap';
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// a number from 0 to 99 in words, in each of the game's languages (the grown-up reads them in theirs)
const NUMBER_WORDS = {
  en: (n) => (n < 20 ? NUM_WORDS[n] : TENS_WORDS[Math.floor(n / 10)] + (n % 10 ? '-' + NUM_WORDS[n % 10] : '')),
  es: (n) => {
    const u = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
      'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    const t = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    return n < 30 ? u[n] : t[Math.floor(n / 10)] + (n % 10 ? ' y ' + u[n % 10] : '');
  },
  pt: (n) => {
    const u = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const t = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    return n < 20 ? u[n] : t[Math.floor(n / 10)] + (n % 10 ? ' e ' + u[n % 10] : '');
  },
  fr: (n) => {
    const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
    const teen = (x) => (x < 17 ? u[x] : 'dix-' + u[x - 10]);
    if (n < 20) return teen(n);
    const d = Math.floor(n / 10), r = n % 10;
    if (d === 7) return r === 1 ? 'soixante et onze' : 'soixante-' + teen(10 + r); // 70 is sixty-ten
    if (d === 8) return r ? 'quatre-vingt-' + u[r] : 'quatre-vingts';            // 80 is four-twenties
    if (d === 9) return 'quatre-vingt-' + teen(10 + r);
    const t = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'][d];
    return t + (r === 0 ? '' : r === 1 ? ' et un' : '-' + u[r]);
  },
  de: (n) => {
    const u = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
    const t = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
    if (n < 20) return u[n];
    const r = n % 10; // the ones come first: einundzwanzig
    return (r ? (r === 1 ? 'ein' : u[r]) + 'und' : '') + t[Math.floor(n / 10)];
  },
  it: (n) => {
    const u = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
    const t = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
    if (n < 20) return u[n];
    const r = n % 10, ten = t[Math.floor(n / 10)];
    if (!r) return ten;
    return (r === 1 || r === 8 ? ten.slice(0, -1) : ten) + (r === 3 ? 'tré' : u[r]); // ventuno, ventotto, ventitré
  },
};

const Store = {
  kind: null,        // 'apple' | 'google' | 'test' | null: the store this copy of the game can buy from
  plugin: null,      // window.CdvPurchase, in the app
  platformId: null,
  status: null,      // the server's last answer: is buying switched on, and may this account buy now
  known: false,      // buying was on the last time we asked (so the "+" can show before we have asked again)
  prices: {},        // product id -> the store's own price text
  busy: null,        // the pack being bought right now
  sel: null,         // the pack waiting behind the grown-up check
  gate: null,        // the grown-up check: { words, answer }
  queue: [],         // purchases the store approved that the server has not confirmed yet
  flushing: false,
  msg: '',           // what the shop says under the packs (kept short)
  onChange: null,    // the open shop redraws itself through this

  init() {
    try { this.known = localStorage.getItem(IAP_KNOWN_KEY) === '1'; } catch (e) { this.known = false; }
    const cdv = window.CdvPurchase;
    const where = window.Capacitor && typeof window.Capacitor.getPlatform === 'function' ? window.Capacitor.getPlatform() : null;
    if (cdv && cdv.store && (where === 'ios' || where === 'android')) {
      this.plugin = cdv;
      this.kind = where === 'ios' ? 'apple' : 'google';
      this.setup();
    }
  },

  // Is there a shop to show? Never on the plain web; in the app once buying is switched on.
  canShow() { return !!(this.kind && (this.status ? this.status.enabled : this.known)); },

  changed() { if (typeof this.onChange === 'function') this.onChange(); },
  say(text) { this.msg = text; this.changed(); if (typeof UI !== 'undefined' && text) UI.toast(text); },

  // ---- the plugin (the app only) ----
  setup() {
    const cdv = this.plugin, store = cdv.store;
    this.platformId = this.kind === 'apple' ? cdv.Platform.APPLE_APPSTORE : cdv.Platform.GOOGLE_PLAY;
    store.register(PRODUCTS.map((p) => ({ id: p.id, type: cdv.ProductType.CONSUMABLE, platform: this.platformId })));
    store.when()
      .productUpdated(() => this.readPrices())
      .approved((tx) => { this.queue.push(tx); this.flush(); });
    if (typeof store.error === 'function') store.error((e) => { if (e && e.code !== cdv.ErrorCode.PAYMENT_CANCELLED) console.warn('store:', e.message || e); });
    store.initialize([this.platformId]).then(() => { this.readPrices(); this.changed(); }).catch(() => {});
  },
  readPrices() {
    if (!this.plugin) return;
    for (const p of PRODUCTS) {
      const sp = this.plugin.store.get(p.id, this.platformId);
      const ph = sp && sp.offers && sp.offers[0] && sp.offers[0].pricingPhases && sp.offers[0].pricingPhases[0];
      const price = (sp && sp.pricing && sp.pricing.price) || (ph && ph.price);
      if (price) this.prices[p.id] = price;
    }
    this.changed();
  },
  priceOf(p) { return this.prices[p.id] || p.price; },

  // ---- the server ----
  async refresh() {
    if (!Net.token) return null;
    try {
      const r = await Net.api('/api/iap/status');
      if (!r || !r.ok) return this.status;
      this.status = r;
      if (!this.plugin && r.test) this.kind = 'test';
      this.known = !!r.enabled;
      try { localStorage.setItem(IAP_KNOWN_KEY, this.known ? '1' : '0'); } catch (e) {}
      this.changed();
      if (typeof UI !== 'undefined') UI.refreshHome();
      return r;
    } catch (e) { return this.status; }
  },

  // signed in (or back online): learn what the shop may do, and finish off anything that was waiting
  onSignedIn() { this.refresh().then(() => this.flush()); },
  reset() { this.status = null; this.sel = null; this.gate = null; this.busy = null; this.changed(); },

  // ---- the grown-up check ----
  // Real money. Before anything is bought, a grown-up types a few numbers that are written out in
  // words. Not hard for a grown-up, not something a young player does by tapping through.
  numberWords(n) { return (NUMBER_WORDS[I18N.lang] || NUMBER_WORDS.en)(n); },
  newGate() {
    const nums = [0, 0, 0].map(() => 13 + Math.floor(Math.random() * 86));
    this.gate = { words: nums.map((n) => this.numberWords(n)).join(', '), answer: nums.join('') };
  },
  gatePassed(text) { return !!this.gate && String(text).replace(/\D/g, '') === this.gate.answer; },

  // ---- buying ----
  async buy(productId) {
    if (this.busy || !PRODUCTS.some((p) => p.id === productId)) return;
    const st = await this.refresh();
    if (!st || !st.enabled) { this.say(tl('BUYING IS NOT AVAILABLE RIGHT NOW')); return; }
    if (!st.canBuy) { this.say(tl('THAT IS ENOUGH FOR TODAY. TRY AGAIN TOMORROW')); return; }
    this.busy = productId; this.msg = ''; this.changed();
    try {
      if (this.kind === 'test') {
        const id = 'test-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        this.queue.push({ products: [{ id: productId }], transactionId: id, finish: async () => {} });
        await this.flush();
      } else {
        const store = this.plugin.store;
        const product = store.get(productId, this.platformId);
        const offer = product && typeof product.getOffer === 'function' ? product.getOffer() : null;
        if (!offer) this.say(tl('THE STORE IS NOT READY. TRY AGAIN IN A MOMENT'));
        else {
          const err = await offer.order(); // resolves when the store sheet closes; approval arrives separately
          if (err && err.code !== this.plugin.ErrorCode.PAYMENT_CANCELLED) this.say(tl('THE PURCHASE DID NOT GO THROUGH'));
        }
      }
    } finally { this.busy = null; this.changed(); }
  },

  // Take approved purchases to the server, one at a time. Anything not confirmed stays in the
  // store, unfinished, and comes round again.
  async flush() {
    if (this.flushing || !Net.token) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const tx = this.queue[0];
        const done = await this.redeem(tx);
        this.queue.shift();
        if (!done) this.again();
      }
    } finally { this.flushing = false; }
  },
  again() {
    clearTimeout(this._again);
    if (!this.plugin) return;
    this._again = setTimeout(() => { try { this.plugin.store.update(); } catch (e) {} }, 30000);
  },

  async redeem(tx) {
    const productId = tx.products && tx.products[0] && tx.products[0].id;
    const token = (tx.nativePurchase && tx.nativePurchase.purchaseToken) || tx.purchaseToken;
    const body = this.kind === 'apple' ? { platform: 'apple', productId, transactionId: tx.transactionId }
      : this.kind === 'google' ? { platform: 'google', productId, purchaseToken: token }
      : { platform: 'test', productId, transactionId: tx.transactionId };
    let r;
    try { r = await Net.api('/api/iap/redeem', body); } catch (e) { r = { ok: false, retry: true }; }
    if (r.auth === false) return false; // signed out: it will be taken up again at the next sign-in
    if (r.ok || r.final) {
      // delivered: the coins are in the account's save on the server; take the same amount here
      const n = Number(r.delivered) || 0;
      if (n > 0 && Save.data) { Save.data.coins += n; Save.write(); }
      try { await tx.finish(); } catch (e) { /* the store will offer it once more; the server will say "already counted" */ }
      if (r.ok && !r.again) this.celebrate(Number(r.coins) || n);
      if (r.final) this.say(tl('THAT PURCHASE BELONGS TO ANOTHER ACCOUNT'));
      this.refresh();
      return true;
    }
    this.say(r.retry ? tl("COULDN'T CONFIRM YOUR PURCHASE YET. WE'LL TRY AGAIN") : tl("THE STORE COULDN'T CONFIRM THAT PURCHASE"));
    return false;
  },

  celebrate(coins) {
    if (typeof UI === 'undefined') return;
    UI.refreshHome();
    UI.toast(tl('+{0} COINS. THANK YOU!', [fmtCoins(coins)]));
    try { if (typeof Sound !== 'undefined') Sound.powerReady(); } catch (e) {}
    this.sel = null; this.gate = null;
    this.changed();
  },
};
