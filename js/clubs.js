// The league: the top 20 national teams, their kits, and how two of them share a pitch.
// (Identifiers still say "club" from when these were clubs.) Names, kit colours and simple
// flags only — no crests. `level` (0..3) is how hard that team's bots play.
// Loads in the browser and on the server (no DOM at load time).

// jersey, shorts, socks, accent (trim / collar), extras: stripes | sleeves | center | checks
function makeKit(jersey, shorts, socks, accent, extra = {}) {
  const light = colorLum(jersey) > 0.72;
  return {
    jersey, shorts, socks, accent, shoes: '#1b1d33',
    shade: shadeHex(jersey, light ? -0.16 : -0.24),
    board: shadeHex(jersey, light ? -0.06 : -0.06),
    lip: shadeHex(jersey, 0.35),
    fx: light ? shadeHex(accent === '#ffffff' ? '#46d9ff' : accent, 0.2) : shadeHex(jersey, 0.3),
    ...extra,
  };
}
function colorLum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function colorDist(a, b) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  return Math.hypot(((x >> 16) & 255) - ((y >> 16) & 255), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255));
}

const W_ = '#f4f5f7', B_ = '#16171d';
const CLUBS = [
  { id: 'argentina', name: 'ARGENTINA', short: 'ARG', level: 3,
    home: makeKit(W_, B_, W_, '#1b1d33', { stripes: '#75aadb' }), away: makeKit('#2b2a6b', '#2b2a6b', '#2b2a6b', '#75aadb') },
  { id: 'spain', name: 'SPAIN', short: 'ESP', level: 3,
    home: makeKit('#c60b1e', '#1d2a52', '#1d2a52', '#ffc400'), away: makeKit(W_, W_, W_, '#c60b1e') },
  { id: 'france', name: 'FRANCE', short: 'FRA', level: 3,
    home: makeKit('#1f2a5c', W_, '#e1000f', W_), away: makeKit(W_, '#1f2a5c', W_, '#1f2a5c') },
  { id: 'england', name: 'ENGLAND', short: 'ENG', level: 3,
    home: makeKit(W_, '#1d2a52', W_, '#cf142b'), away: makeKit('#cf142b', '#cf142b', '#cf142b', W_) },
  { id: 'brazil', name: 'BRAZIL', short: 'BRA', level: 3,
    home: makeKit('#ffdf00', '#0a3fa8', W_, '#009b3a'), away: makeKit('#0a3fa8', W_, '#0a3fa8', '#ffdf00') },
  { id: 'portugal', name: 'PORTUGAL', short: 'POR', level: 3,
    home: makeKit('#b5121b', '#b5121b', '#b5121b', '#046a38', { sleeves: '#046a38' }), away: makeKit(W_, W_, W_, '#046a38') },
  { id: 'netherlands', name: 'NETHERLANDS', short: 'NED', level: 2,
    home: makeKit('#ff6c00', B_, '#ff6c00', B_), away: makeKit('#1b2a5a', '#1b2a5a', '#1b2a5a', '#ff6c00') },
  { id: 'belgium', name: 'BELGIUM', short: 'BEL', level: 2,
    home: makeKit('#e30613', B_, '#e30613', '#fdda24'), away: makeKit(W_, W_, W_, B_) },
  { id: 'italy', name: 'ITALY', short: 'ITA', level: 2,
    home: makeKit('#0066cc', W_, '#0066cc', '#c9a64b'), away: makeKit(W_, '#0066cc', W_, '#0066cc') },
  { id: 'germany', name: 'GERMANY', short: 'GER', level: 2,
    home: makeKit(W_, B_, W_, B_), away: makeKit(B_, B_, B_, '#dd0000') },
  { id: 'croatia', name: 'CROATIA', short: 'CRO', level: 2,
    home: makeKit(W_, W_, '#171796', '#171796', { checks: '#e30613' }), away: makeKit('#171796', '#171796', '#171796', '#e30613') },
  { id: 'morocco', name: 'MOROCCO', short: 'MAR', level: 2,
    home: makeKit('#c1272d', '#006233', '#c1272d', '#006233'), away: makeKit(W_, W_, W_, '#c1272d') },
  { id: 'colombia', name: 'COLOMBIA', short: 'COL', level: 2,
    home: makeKit('#fcd116', '#003893', W_, '#ce1126'), away: makeKit('#003893', '#003893', '#003893', '#fcd116') },
  { id: 'uruguay', name: 'URUGUAY', short: 'URU', level: 1,
    home: makeKit('#5cbfeb', B_, B_, W_), away: makeKit(W_, W_, W_, '#5cbfeb') },
  { id: 'usa', name: 'USA', short: 'USA', level: 1,
    home: makeKit(W_, '#0a3161', W_, '#b31942'), away: makeKit('#0a3161', '#0a3161', '#0a3161', '#b31942') },
  { id: 'mexico', name: 'MEXICO', short: 'MEX', level: 1,
    home: makeKit('#006847', W_, '#ce1126', '#ce1126'), away: makeKit(W_, B_, W_, '#006847') },
  { id: 'japan', name: 'JAPAN', short: 'JPN', level: 1,
    home: makeKit('#1c2a7a', W_, '#1c2a7a', '#bc002d'), away: makeKit(W_, '#1c2a7a', W_, '#1c2a7a') },
  { id: 'switzerland', name: 'SWITZERLAND', short: 'SUI', level: 1,
    home: makeKit('#d52b1e', W_, '#d52b1e', W_), away: makeKit(W_, '#d52b1e', W_, '#d52b1e') },
  { id: 'senegal', name: 'SENEGAL', short: 'SEN', level: 0,
    home: makeKit(W_, W_, W_, '#00853f', { sleeves: '#00853f' }), away: makeKit('#00853f', '#00853f', '#00853f', '#fdef42') },
  { id: 'denmark', name: 'DENMARK', short: 'DEN', level: 0,
    home: makeKit('#c8102e', W_, '#c8102e', W_), away: makeKit(W_, '#c8102e', W_, '#c8102e') },
];
const DEFAULT_CLUB = 'argentina';
// accounts made when the league was clubs play for that club's country
const OLD_CLUB_COUNTRY = {
  realmadrid: 'spain', barcelona: 'spain', atletico: 'spain', mancity: 'england', liverpool: 'england', arsenal: 'england',
  chelsea: 'england', manutd: 'england', tottenham: 'england', newcastle: 'england', astonvilla: 'england',
  bayern: 'germany', leverkusen: 'germany', dortmund: 'germany', psg: 'france', inter: 'italy', juventus: 'italy',
  milan: 'italy', napoli: 'italy', benfica: 'portugal',
};
const countryFor = (id) => (CLUBS.some((c) => c.id === id) ? id : OLD_CLUB_COUNTRY[id] || DEFAULT_CLUB);
// flat colour a white/yellow kit uses wherever white UI text sits on it
const kitUi = (kit) => (colorLum(kit.jersey) > 0.7 ? shadeHex(kit.jersey === W_ ? '#8a90b8' : kit.jersey, -0.35) : kit.jersey);
const clubUi = (club) => kitUi(club.home);

const KEEPER_COLORS = ['#3fcf4a', '#ffc21a', '#ff8a1f', '#a35cff', '#46d9ff', '#ff5fa8', '#2b2d42'];

const Clubs = {
  current: null, home: null,
  get(id) { return CLUBS.find((c) => c.id === id) || CLUBS[0]; },
  valid(id) { return CLUBS.some((c) => c.id === id); },
  mine() { return this.get((typeof Save !== 'undefined' && Save.data && Save.data.club) || DEFAULT_CLUB); },
  random(except) { const pool = CLUBS.filter((c) => !except || c.id !== except.id); return pick(pool); },

  // Kits for two clubs on one pitch: the home side wears its home kit, the away side
  // switches to its away kit when the two would be hard to tell apart.
  kitsFor(home, away) {
    const hk = home.home;
    let ak = away.home;
    const clash = (a, b) => colorDist(a.jersey, b.jersey) < 110 || (a.stripes && b.stripes && colorDist(a.stripes, b.stripes) < 110) || (a.checks && b.checks);
    if (home.id === away.id || clash(hk, ak)) ak = away.away;
    if (clash(hk, ak)) ak = colorLum(hk.jersey) > 0.5 ? makeKit(B_, B_, B_, W_) : makeKit(W_, W_, W_, B_);
    // keepers: the colour furthest from both outfield kits, and not the same as each other
    const extra = (k, c) => Math.min(k.stripes ? colorDist(c, k.stripes) : 999, k.checks ? colorDist(c, k.checks) : 999, k.sleeves ? colorDist(c, k.sleeves) : 999);
    const score = (c) => Math.min(colorDist(c, hk.jersey), colorDist(c, ak.jersey), extra(hk, c), extra(ak, c));
    const ranked = KEEPER_COLORS.slice().sort((a, b) => score(b) - score(a));
    const gk = (c) => ({ jersey: c, shade: shadeHex(c, -0.22), accent: colorLum(c) > 0.6 ? '#1b1d33' : '#ffffff', shorts: '#1b1d33', socks: c, shoes: '#1b1d33', gloves: '#ffffff' });
    return { home: hk, away: ak, homeKeeper: gk(ranked[0]), awayKeeper: gk(ranked[1]), awayAlt: ak !== away.home };
  },

  // Paint the blue slot (your side) and the red slot (the other side) everywhere.
  setMatch(home, away) {
    this.home = home; this.current = away;
    const k = this.kitsFor(home, away);
    const fill = (slot, club, kit) => {
      for (const key of ['stripes', 'sleeves', 'center', 'checks', 'hi']) delete TEAMS[slot][key];
      Object.assign(TEAMS[slot], kit, { name: club.name, short: club.short });
    };
    fill('blue', home, k.home);
    fill('red', away, k.away);
    Object.assign(KEEPER_KITS.blue, k.homeKeeper);
    Object.assign(KEEPER_KITS.red, k.awayKeeper);
    delete KEEPER_KITS.blue.hi; delete KEEPER_KITS.red.hi;
    if (typeof document !== 'undefined') {
      const root = document.documentElement.style;
      root.setProperty('--home', kitUi(k.home)); root.setProperty('--home-d', shadeHex(kitUi(k.home), -0.25));
      root.setProperty('--red', kitUi(k.away)); root.setProperty('--red-d', shadeHex(kitUi(k.away), -0.25));
      const key = home.id + '/' + away.id;
      if (typeof Render !== 'undefined' && Render.ctx && Render.layerClub !== key) Render.buildLayer();
    }
  },
  // old single-club entry point: your club against this one
  apply(club) { this.setMatch(this.mine(), club); },
};

if (typeof module !== 'undefined') module.exports = { CLUBS, DEFAULT_CLUB, countryFor };
