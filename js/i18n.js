// Languages. Every word the game shows goes through tl('THE ENGLISH'): the English is the key, and
// js/lang-<id>.js holds the same words in that language (I18N.add). Anything a language does not
// have stays in English. Holes in a line are {0}, {1}… (or {name}), filled from the second argument:
//   tl('VS {0}', [club.name])
// (tl, not t: t is the time in half the game's drawing code)
//
// The language is asked for the first time the game starts (UI.askLanguage) and can be changed in
// Settings; it is kept on this device. Only that language's file is loaded, and it is written into
// the page right here, ahead of the rest of the game, so every tl() sees it — including the ones in
// data the game sets up as it loads. Changing language therefore reloads the game, which carries
// straight on to where it was (the same 'ms-carry-on' a new build uses).
//
// The server runs some of the same files (server/sim.js) and has its own tl(): English.
const LANGS = [
  { id: 'en', name: 'ENGLISH' },
  { id: 'es', name: 'ESPAÑOL' },
  { id: 'pt', name: 'PORTUGUÊS' },
  { id: 'fr', name: 'FRANÇAIS' },
  { id: 'de', name: 'DEUTSCH' },
  { id: 'it', name: 'ITALIANO' },
];

const I18N = {
  KEY: 'mini-strikers.lang',
  lang: 'en',
  chosen: false, // picked on this device, rather than guessed from the phone's language
  dict: {},

  known(id) { return LANGS.some((l) => l.id === id); },

  // the phone's own language, when the game has it
  guess() {
    try {
      for (const n of navigator.languages || [navigator.language]) {
        const id = String(n || '').slice(0, 2).toLowerCase();
        if (this.known(id)) return id;
      }
    } catch (e) { /* no navigator */ }
    return 'en';
  },

  start() {
    let saved = null;
    try { saved = localStorage.getItem(this.KEY); } catch (e) { /* no storage */ }
    this.chosen = !!(saved && this.known(saved));
    this.lang = this.chosen ? saved : this.guess();
    document.documentElement.lang = this.lang;
    // the words, before the game's own files: they run in order, so every one of them has them
    if (this.lang !== 'en') document.write('<script src="js/lang-' + this.lang + '.js"><\/script>');
  },

  add(id, words) { this.dict[id] = Object.assign(this.dict[id] || {}, words); },

  t(s, args) {
    let out = s;
    if (this.lang !== 'en') {
      const d = this.dict[this.lang];
      if (d && Object.prototype.hasOwnProperty.call(d, s)) out = d[s];
    }
    if (args) out = out.replace(/\{(\w+)\}/g, (m, k) => (args[k] !== undefined && args[k] !== null ? String(args[k]) : m));
    return out;
  },

  // one or many: French counts 0 as one, the others only 1
  one(n) { return this.lang === 'fr' ? Math.abs(n) < 2 : n === 1; },

  // What the server says (in English): the line itself if this language has it, or else a line with
  // holes that it fits, with what the server put in the holes (names) put back. Otherwise as it came.
  server(msg) {
    const s = String(msg || '');
    if (this.lang === 'en' || !s) return s;
    const d = this.dict[this.lang] || {};
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    if (!this._pats) {
      this._pats = [];
      for (const k of Object.keys(d)) {
        if (!/\{\d+\}/.test(k)) continue;
        const lit = k.replace(/\{\d+\}/g, '').replace(/\s+/g, '');
        if (lit.length < 6) continue; // "{0} {1}" would fit anything at all
        const src = k.split(/(\{\d+\})/).map((p) => (/^\{\d+\}$/.test(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
        this._pats.push({ k, re: new RegExp('^' + src + '$'), n: lit.length, ids: (k.match(/\{\d+\}/g) || []).map((x) => +x.slice(1, -1)) });
      }
      this._pats.sort((a, b) => b.n - a.n); // the most specific first
    }
    for (const p of this._pats) {
      const m = p.re.exec(s);
      if (!m) continue;
      const args = {};
      p.ids.forEach((id, i) => { args[id] = m[i + 1]; });
      return this.t(p.k, args);
    }
    return s;
  },

  // A popup or banner from an online match (FX), in English: as a whole, or piece by piece where the
  // server joined pieces up ("#7 SPAIN · HAT-TRICK!", "SPAIN vs FRANCE")
  parts(s) {
    if (this.lang === 'en' || !s || typeof s !== 'string') return s;
    const d = this.dict[this.lang] || {};
    const one = (x) => {
      if (Object.prototype.hasOwnProperty.call(d, x)) return d[x];
      const num = x.match(/^(#\d+ )(.+)$/);
      if (num && Object.prototype.hasOwnProperty.call(d, num[2])) return num[1] + d[num[2]];
      return x;
    };
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    return s.split(' · ').map((x) => x.split(' vs ').map(one).join(' vs ')).join(' · ');
  },

  // The page's own words (index.html), in place: every text node, and the placeholder, title and
  // aria-label of every element under root, if this language has them.
  apply(root) {
    if (this.lang === 'en' || !this.dict[this.lang]) return;
    const d = this.dict[this.lang];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const n of nodes) {
      const raw = n.nodeValue, key = raw.trim().replace(/\s+/g, ' ');
      if (!key || !Object.prototype.hasOwnProperty.call(d, key)) continue;
      const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
      n.nodeValue = lead + d[key] + trail;
    }
    for (const el of root.querySelectorAll('[placeholder], [title], [aria-label]')) {
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute(a);
        if (v && Object.prototype.hasOwnProperty.call(d, v)) el.setAttribute(a, d[v]);
      }
    }
  },

  // Pick a language. The same one: nothing to do. Another: kept, and the game reloads into it and
  // carries on from where it was.
  choose(id) {
    if (!this.known(id)) return false;
    let kept = true;
    try { localStorage.setItem(this.KEY, id); } catch (e) { kept = false; }
    this.chosen = true;
    // nowhere to keep it (storage blocked): a reload would only ask again, so stay as we are
    if (id === this.lang || !kept) return false;
    try { sessionStorage.setItem('ms-carry-on', '1'); } catch (e) { /* no storage */ }
    location.reload();
    return true;
  },

  name(id = this.lang) { const l = LANGS.find((x) => x.id === id); return l ? l.name : id; },
};

const tl = (s, args) => I18N.t(s, args);
// one or many: tlN(days, '{0} DAY LEFT', '{0} DAYS LEFT') (the count goes in {0} unless args say otherwise)
const tlN = (n, one, many, args) => I18N.t(I18N.one(n) ? one : many, args || [n]);

I18N.start();
