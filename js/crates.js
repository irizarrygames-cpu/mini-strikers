// Crates.
//
// Nothing is bought off a shelf any more: you buy a crate, it rolls, and you get one thing out of
// it. Ten crates, cheapest to dearest. The cheap ones are mostly full of the old starter stuff and
// hold a one-in-a-thousand chance of something great; the dear ones cannot give you junk at all,
// and the very best things only ever come out of the top of the ladder.
//
// A crate never gives you something you already own — it picks from what you are missing — so the
// money is never wasted, and the odds below are the odds of the *grade* you get.

const CRATE_RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];

const CRATES = [
  { id: 'bronze',   name: 'BRONZE CRATE',   price: 2000,   color: '#c08a4a', odds: { common: 72, rare: 22, epic: 5.4, legendary: 0.5, mythic: 0.1 } },
  { id: 'silver',   name: 'SILVER CRATE',   price: 5000,   color: '#b9c2d6', odds: { common: 52, rare: 33, epic: 13, legendary: 1.7, mythic: 0.3 } },
  { id: 'gold',     name: 'GOLD CRATE',     price: 12000,  color: '#ffc21a', odds: { common: 30, rare: 40, epic: 24, legendary: 5.3, mythic: 0.7 } },
  { id: 'ruby',     name: 'RUBY CRATE',     price: 25000,  color: '#e8283a', odds: { common: 12, rare: 42, epic: 35, legendary: 9.5, mythic: 1.5 } },
  { id: 'sapphire', name: 'SAPPHIRE CRATE', price: 50000,  color: '#2f7bff', odds: { common: 0, rare: 45, epic: 40, legendary: 12.5, mythic: 2.5 } },
  { id: 'emerald',  name: 'EMERALD CRATE',  price: 90000,  color: '#1fb86a', odds: { common: 0, rare: 30, epic: 48, legendary: 18, mythic: 4 } },
  { id: 'diamond',  name: 'DIAMOND CRATE',  price: 150000, color: '#7fe0ff', odds: { common: 0, rare: 12, epic: 52, legendary: 29, mythic: 7 } },
  { id: 'cosmic',   name: 'COSMIC CRATE',   price: 250000, color: '#b04dff', odds: { common: 0, rare: 0, epic: 50, legendary: 38, mythic: 12 } },
  { id: 'legend',   name: 'LEGEND CRATE',   price: 400000, color: '#ff8a1f', odds: { common: 0, rare: 0, epic: 28, legendary: 52, mythic: 20 } },
  { id: 'goatcrate', name: 'GOAT CRATE',    price: 750000, color: '#ff3a6e', odds: { common: 0, rare: 0, epic: 0, legendary: 62, mythic: 38 } },
];

// Everything a crate can hold, and where to find its definition.
const CRATE_KINDS = ['character', 'ball', 'trail', 'celebration', 'accessory'];

const Crates = {
  get(id) { return CRATES.find((c) => c.id === id) || null; },

  list(kind) {
    if (kind === 'character') return CHARACTERS.filter(charOk);
    if (kind === 'ball') return BALLS;
    if (kind === 'trail') return TRAILS;
    if (kind === 'celebration') return CELEBRATIONS;
    return ACCESSORIES;
  },
  def(kind, id) { return this.list(kind).find((x) => x.id === id) || null; },
  name(kind, id) { const d = this.def(kind, id); return d ? d.name : id; },

  // A grade for every item: what its own row says, or what it costs if it does not say.
  rarity(kind, id) {
    const d = this.def(kind, id);
    if (d && d.rarity) return d.rarity === 'starter' || d.rarity === 'oneofone' ? 'common' : d.rarity;
    const p = Shop.price(kind, id);
    return p >= 120000 ? 'mythic' : p >= 25000 ? 'legendary' : p >= 6000 ? 'epic' : p >= 1000 ? 'rare' : 'common';
  },

  // everything of one grade that you have not got yet (a one-of-one is never in a crate)
  missing(rarity) {
    const out = [];
    for (const kind of CRATE_KINDS) {
      for (const item of this.list(kind)) {
        if (item.rarity === 'oneofone' || item.only) continue;
        if (Shop.owns(kind, item.id)) continue;
        if (this.rarity(kind, item.id) !== rarity) continue;
        out.push({ kind, id: item.id });
      }
    }
    return out;
  },

  // what the whole ladder still has in it
  anyMissing() { return CRATE_RARITIES.some((r) => this.missing(r).length); },

  // the grades a crate deals in, and how much it still has of each
  stock(crate) {
    const out = {};
    for (const r of CRATE_RARITIES) if ((crate.odds[r] || 0) > 0) out[r] = this.missing(r).length;
    return out;
  },
  // how many things this crate can still give you at all
  left(crate) {
    const st = this.stock(crate);
    let n = 0;
    for (const r in st) n += st[r];
    return n;
  },
  // The highest grade a crate may fall back on when its own roll comes up empty: the best grade it
  // offers at odds worth reading. Anything above that has to be rolled properly.
  ceiling(crate) {
    let top = CRATE_RARITIES[0];
    for (const r of CRATE_RARITIES) if ((crate.odds[r] || 0) >= 10) top = r;
    return top;
  },

  // Roll a grade on the crate's own odds and take something of it. An empty grade falls to the
  // best cheaper grade it has; only if there is nothing cheaper does it climb, and never past the
  // crate's ceiling — so a bronze crate can never become a cheap way to a mythic.
  roll(crate) {
    const odds = crate.odds;
    let total = 0;
    for (const r of CRATE_RARITIES) total += odds[r] || 0;
    let pick = Math.random() * total, chosen = CRATE_RARITIES[0];
    for (const r of CRATE_RARITIES) { pick -= odds[r] || 0; if (pick <= 0) { chosen = r; break; } }
    const at = CRATE_RARITIES.indexOf(chosen);
    const take = (r) => { const pool = this.missing(r); return pool.length ? { ...pool[(Math.random() * pool.length) | 0], rarity: r } : null; };
    let got = take(chosen);
    for (let i = at - 1; i >= 0 && !got; i--) if ((odds[CRATE_RARITIES[i]] || 0) > 0) got = take(CRATE_RARITIES[i]);
    const top = CRATE_RARITIES.indexOf(this.ceiling(crate));
    for (let i = at + 1; i <= top && !got; i++) if ((odds[CRATE_RARITIES[i]] || 0) > 0) got = take(CRATE_RARITIES[i]);
    return got;
  },

  // the reel you watch: a run of things it could have given you, with the real one near the end
  reel(crate, win, n = 44) {
    const cells = [];
    const grades = CRATE_RARITIES.filter((r) => (crate.odds[r] || 0) > 0);
    const owned = [];
    for (const kind of CRATE_KINDS) for (const item of this.list(kind)) {
      if (item.rarity === 'oneofone' || item.only) continue;
      if (grades.includes(this.rarity(kind, item.id))) owned.push({ kind, id: item.id });
    }
    for (let i = 0; i < n; i++) cells.push(owned.length ? owned[(Math.random() * owned.length) | 0] : win);
    if (win) cells[n - 9] = win;
    return { cells, at: n - 9 };
  },

  // open one: take the coins, hand over the thing, remember it
  open(crateId) {
    const crate = this.get(crateId);
    if (!crate) return null;
    if (Save.data.coins < crate.price) return { poor: true };
    const win = this.roll(crate);
    if (!win) return { empty: true };
    Save.data.coins -= crate.price;
    Save.data.owned[win.kind] = Save.data.owned[win.kind] || [];
    Save.data.owned[win.kind].push(win.id);
    Save.data.crateCount = (Save.data.crateCount || 0) + 1;
    Save.write();
    return win;
  },
};

if (typeof module !== 'undefined') module.exports = { CRATES, Crates };
