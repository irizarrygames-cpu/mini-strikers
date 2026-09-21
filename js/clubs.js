// The league: 70 national teams (the top 20 first), their kits, and how two of them share a pitch.
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
  // the next fifty: the best-ranked teams we didn't have yet, plus Puerto Rico and the Dominican Republic.
  // `flag` is a list of simple shapes in 0..1 flag space, drawn by UI.flagBadge.
  { id: 'austria', name: 'AUSTRIA', short: 'AUT', level: 1,
    home: makeKit('#ed2939', W_, '#ed2939', W_), away: makeKit(W_, '#ed2939', W_, '#ed2939'),
    flag: [['h', ['#ed2939', '#ffffff', '#ed2939']]] },
  { id: 'ecuador', name: 'ECUADOR', short: 'ECU', level: 1,
    home: makeKit('#ffd100', '#034ea2', '#034ea2', '#ed1c24'), away: makeKit('#034ea2', '#034ea2', '#034ea2', '#ffd100'),
    flag: [['h', ['#ffd100', '#034ea2', '#ed1c24'], [2, 1, 1]], ['dot', '#a5732e', 0.5, 0.46, 0.13]] },
  { id: 'turkey', name: 'TURKEY', short: 'TUR', level: 1,
    home: makeKit('#e30a17', W_, '#e30a17', W_), away: makeKit(W_, '#e30a17', W_, '#e30a17'),
    flag: [['fill', '#e30a17'], ['crescent', '#ffffff', 0.4, 0.5, 0.26], ['star', '#ffffff', 0.61, 0.5, 0.12]] },
  { id: 'southkorea', name: 'SOUTH KOREA', short: 'KOR', level: 1,
    home: makeKit('#c60c30', B_, '#c60c30', '#003478'), away: makeKit(W_, B_, W_, '#c60c30'),
    flag: [['fill', '#ffffff'], ['halfdot', '#cd2e3a', '#0047a0', 0.5, 0.5, 0.25], ['rect', '#1b1b1b', 0.1, 0.12, 0.14, 0.1], ['rect', '#1b1b1b', 0.76, 0.12, 0.14, 0.1], ['rect', '#1b1b1b', 0.1, 0.78, 0.14, 0.1], ['rect', '#1b1b1b', 0.76, 0.78, 0.14, 0.1]] },
  { id: 'iran', name: 'IRAN', short: 'IRN', level: 1,
    home: makeKit(W_, W_, W_, '#239f40'), away: makeKit('#da0000', '#da0000', '#da0000', W_),
    flag: [['h', ['#239f40', '#ffffff', '#da0000']], ['dot', '#da0000', 0.5, 0.5, 0.09]] },
  { id: 'australia', name: 'AUSTRALIA', short: 'AUS', level: 1,
    home: makeKit('#ffcd00', '#00843d', '#ffcd00', '#00843d'), away: makeKit('#00843d', '#00843d', '#00843d', '#ffcd00'),
    flag: [['fill', '#012169'], ['rect', '#ffffff', 0.19, 0, 0.12, 0.5], ['rect', '#ffffff', 0, 0.19, 0.5, 0.12], ['rect', '#c8102e', 0.22, 0, 0.06, 0.5], ['rect', '#c8102e', 0, 0.22, 0.5, 0.06],
      ['star', '#ffffff', 0.25, 0.76, 0.14], ['star', '#ffffff', 0.76, 0.22, 0.07], ['star', '#ffffff', 0.88, 0.44, 0.07], ['star', '#ffffff', 0.66, 0.52, 0.07], ['star', '#ffffff', 0.76, 0.82, 0.07]] },
  { id: 'ukraine', name: 'UKRAINE', short: 'UKR', level: 1,
    home: makeKit('#ffd700', '#ffd700', '#ffd700', '#0057b7'), away: makeKit('#0057b7', '#0057b7', '#0057b7', '#ffd700'),
    flag: [['h', ['#0057b7', '#ffd700']]] },
  { id: 'sweden', name: 'SWEDEN', short: 'SWE', level: 1,
    home: makeKit('#fecc02', '#006aa7', '#fecc02', '#006aa7'), away: makeKit('#006aa7', '#006aa7', '#006aa7', '#fecc02'),
    flag: [['fill', '#006aa7'], ['nordic', '#fecc02', 0.2]] },
  { id: 'wales', name: 'WALES', short: 'WAL', level: 1,
    home: makeKit('#c8102e', '#c8102e', '#c8102e', '#00b140'), away: makeKit(W_, '#00b140', W_, '#00b140'),
    flag: [['h', ['#ffffff', '#00b140']], ['poly', '#c8102e', [[0.3, 0.64], [0.36, 0.42], [0.5, 0.38], [0.58, 0.24], [0.68, 0.28], [0.63, 0.4], [0.74, 0.46], [0.65, 0.52], [0.72, 0.68], [0.6, 0.62], [0.5, 0.72], [0.42, 0.62]]]] },
  { id: 'poland', name: 'POLAND', short: 'POL', level: 1,
    home: makeKit(W_, '#dc143c', W_, '#dc143c'), away: makeKit('#dc143c', '#dc143c', '#dc143c', W_),
    flag: [['h', ['#ffffff', '#dc143c']]] },
  { id: 'serbia', name: 'SERBIA', short: 'SRB', level: 1,
    home: makeKit('#c6363c', '#0c4076', W_, W_), away: makeKit(W_, W_, W_, '#c6363c'),
    flag: [['h', ['#c6363c', '#0c4076', '#ffffff']], ['dot', '#ffffff', 0.34, 0.46, 0.2], ['dot', '#c6363c', 0.34, 0.46, 0.15]] },
  { id: 'norway', name: 'NORWAY', short: 'NOR', level: 1,
    home: makeKit('#ba0c2f', W_, '#00205b', '#00205b'), away: makeKit(W_, '#00205b', W_, '#ba0c2f'),
    flag: [['fill', '#ba0c2f'], ['nordic', '#ffffff', 0.26], ['nordic', '#00205b', 0.13]] },
  { id: 'hungary', name: 'HUNGARY', short: 'HUN', level: 0,
    home: makeKit('#cd2a3e', W_, '#436f4d', '#436f4d'), away: makeKit(W_, W_, W_, '#cd2a3e'),
    flag: [['h', ['#cd2a3e', '#ffffff', '#436f4d']]] },
  { id: 'nigeria', name: 'NIGERIA', short: 'NGA', level: 0,
    home: makeKit('#008751', '#008751', '#008751', W_), away: makeKit(W_, '#008751', W_, '#008751'),
    flag: [['v', ['#008751', '#ffffff', '#008751']]] },
  { id: 'egypt', name: 'EGYPT', short: 'EGY', level: 0,
    home: makeKit('#ce1126', W_, B_, '#c09300'), away: makeKit(W_, B_, W_, '#ce1126'),
    flag: [['h', ['#ce1126', '#ffffff', '#1b1b1b']], ['dot', '#c09300', 0.5, 0.5, 0.11]] },
  { id: 'algeria', name: 'ALGERIA', short: 'ALG', level: 0,
    home: makeKit(W_, W_, W_, '#006233'), away: makeKit('#006233', '#006233', '#006233', W_),
    flag: [['v', ['#006233', '#ffffff']], ['crescent', '#d21034', 0.5, 0.5, 0.27], ['star', '#d21034', 0.58, 0.5, 0.11]] },
  { id: 'canada', name: 'CANADA', short: 'CAN', level: 0,
    home: makeKit('#d80621', '#d80621', '#d80621', W_), away: makeKit(W_, W_, W_, '#d80621'),
    flag: [['v', ['#d80621', '#ffffff', '#d80621'], [1, 2, 1]], ['star', '#d80621', 0.5, 0.46, 0.24], ['rect', '#d80621', 0.487, 0.58, 0.026, 0.2]] },
  { id: 'scotland', name: 'SCOTLAND', short: 'SCO', level: 0,
    home: makeKit('#1b2f5b', W_, '#1b2f5b', W_), away: makeKit(W_, '#1b2f5b', W_, '#1b2f5b'),
    flag: [['fill', '#0065bd'], ['saltire', '#ffffff', 0.18]] },
  { id: 'czechia', name: 'CZECHIA', short: 'CZE', level: 0,
    home: makeKit('#d7141a', W_, '#11457e', W_), away: makeKit(W_, '#11457e', W_, '#d7141a'),
    flag: [['h', ['#ffffff', '#d7141a']], ['tri', '#11457e', 0.5]] },
  { id: 'panama', name: 'PANAMA', short: 'PAN', level: 0,
    home: makeKit('#da121a', '#072357', '#da121a', W_), away: makeKit(W_, W_, W_, '#072357'),
    flag: [['fill', '#ffffff'], ['rect', '#da121a', 0.5, 0, 0.5, 0.5], ['rect', '#072357', 0, 0.5, 0.5, 0.5], ['star', '#072357', 0.25, 0.25, 0.13], ['star', '#da121a', 0.75, 0.75, 0.13]] },
  { id: 'peru', name: 'PERU', short: 'PER', level: 0,
    home: makeKit(W_, W_, W_, '#d91023', { center: '#d91023' }), away: makeKit('#d91023', '#d91023', '#d91023', W_),
    flag: [['v', ['#d91023', '#ffffff', '#d91023']]] },
  { id: 'slovakia', name: 'SLOVAKIA', short: 'SVK', level: 0,
    home: makeKit(W_, '#0b4ea2', W_, '#0b4ea2'), away: makeKit('#0b4ea2', '#0b4ea2', '#0b4ea2', W_),
    flag: [['h', ['#ffffff', '#0b4ea2', '#ee1c25']], ['dot', '#ffffff', 0.34, 0.5, 0.24], ['dot', '#ee1c25', 0.34, 0.5, 0.19], ['plus', '#ffffff', 0.34, 0.49, 0.2]] },
  { id: 'romania', name: 'ROMANIA', short: 'ROU', level: 0,
    home: makeKit('#fcd116', '#002b7f', '#ce1126', '#002b7f'), away: makeKit('#002b7f', '#002b7f', '#002b7f', '#fcd116'),
    flag: [['v', ['#002b7f', '#fcd116', '#ce1126']]] },
  { id: 'greece', name: 'GREECE', short: 'GRE', level: 0,
    home: makeKit(W_, W_, W_, '#0d5eaf'), away: makeKit('#0d5eaf', '#0d5eaf', '#0d5eaf', W_),
    flag: [['h', ['#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf']], ['rect', '#0d5eaf', 0, 0, 0.38, 0.556], ['rect', '#ffffff', 0.15, 0, 0.08, 0.556], ['rect', '#ffffff', 0, 0.22, 0.38, 0.111]] },
  { id: 'ivorycoast', name: 'IVORY COAST', short: 'CIV', level: 0,
    home: makeKit('#f77f00', W_, '#009e60', '#009e60'), away: makeKit(W_, '#f77f00', W_, '#009e60'),
    flag: [['v', ['#f77f00', '#ffffff', '#009e60']]] },
  { id: 'tunisia', name: 'TUNISIA', short: 'TUN', level: 0,
    home: makeKit('#e70013', W_, '#e70013', W_), away: makeKit(W_, '#e70013', W_, '#e70013'),
    flag: [['fill', '#e70013'], ['dot', '#ffffff', 0.5, 0.5, 0.28], ['crescent', '#e70013', 0.48, 0.5, 0.2], ['star', '#e70013', 0.56, 0.5, 0.09]] },
  { id: 'costarica', name: 'COSTA RICA', short: 'CRC', level: 0,
    home: makeKit('#ce1126', '#002b7f', W_, W_), away: makeKit(W_, W_, W_, '#002b7f'),
    flag: [['h', ['#002b7f', '#ffffff', '#ce1126', '#ffffff', '#002b7f'], [1, 1, 2, 1, 1]]] },
  { id: 'paraguay', name: 'PARAGUAY', short: 'PAR', level: 0,
    home: makeKit(W_, '#0038a8', '#0038a8', '#0038a8', { stripes: '#d52b1e' }), away: makeKit('#0038a8', '#0038a8', '#0038a8', W_),
    flag: [['h', ['#d52b1e', '#ffffff', '#0038a8']], ['dot', '#fcd116', 0.5, 0.5, 0.1]] },
  { id: 'chile', name: 'CHILE', short: 'CHI', level: 0,
    home: makeKit('#d52b1e', '#0039a6', W_, W_), away: makeKit(W_, W_, W_, '#d52b1e'),
    flag: [['h', ['#ffffff', '#d52b1e']], ['rect', '#0039a6', 0, 0, 0.334, 0.5], ['star', '#ffffff', 0.167, 0.25, 0.13]] },
  { id: 'venezuela', name: 'VENEZUELA', short: 'VEN', level: 0,
    home: makeKit('#7a1c2c', '#7a1c2c', '#7a1c2c', '#ffcc00'), away: makeKit(W_, '#7a1c2c', W_, '#7a1c2c'),
    flag: [['h', ['#fcd116', '#00247d', '#cf142b']], ['arcstars', '#ffffff', 0.5, 0.64, 0.24, 8, 0.04]] },
  { id: 'qatar', name: 'QATAR', short: 'QAT', level: 0,
    home: makeKit('#8a1538', W_, '#8a1538', W_), away: makeKit(W_, '#8a1538', W_, '#8a1538'),
    flag: [['fill', '#8a1538'], ['poly', '#ffffff', [[0, 0], [0.3, 0], [0.38, 0.056], [0.3, 0.111], [0.38, 0.167], [0.3, 0.222], [0.38, 0.278], [0.3, 0.333], [0.38, 0.389], [0.3, 0.444], [0.38, 0.5], [0.3, 0.556], [0.38, 0.611], [0.3, 0.667], [0.38, 0.722], [0.3, 0.778], [0.38, 0.833], [0.3, 0.889], [0.38, 0.944], [0.3, 1], [0, 1]]]] },
  { id: 'saudiarabia', name: 'SAUDI ARABIA', short: 'KSA', level: 0,
    home: makeKit(W_, W_, W_, '#006c35'), away: makeKit('#006c35', '#006c35', '#006c35', W_),
    flag: [['fill', '#006c35'], ['rect', '#ffffff', 0.25, 0.32, 0.5, 0.12], ['rect', '#ffffff', 0.28, 0.62, 0.44, 0.05], ['rect', '#ffffff', 0.69, 0.57, 0.03, 0.15]] },
  { id: 'cameroon', name: 'CAMEROON', short: 'CMR', level: 0,
    home: makeKit('#007a5e', '#ce1126', '#fcd116', '#fcd116'), away: makeKit('#fcd116', '#007a5e', '#fcd116', '#007a5e'),
    flag: [['v', ['#007a5e', '#ce1126', '#fcd116']], ['star', '#fcd116', 0.5, 0.5, 0.17]] },
  { id: 'mali', name: 'MALI', short: 'MLI', level: 0,
    home: makeKit('#14b53a', '#fcd116', '#ce1126', '#fcd116'), away: makeKit(W_, '#14b53a', W_, '#14b53a'),
    flag: [['v', ['#14b53a', '#fcd116', '#ce1126']]] },
  { id: 'ireland', name: 'IRELAND', short: 'IRL', level: 0,
    home: makeKit('#169b62', W_, '#169b62', '#ff883e'), away: makeKit(W_, '#169b62', W_, '#169b62'),
    flag: [['v', ['#169b62', '#ffffff', '#ff883e']]] },
  { id: 'slovenia', name: 'SLOVENIA', short: 'SVN', level: 0,
    home: makeKit(W_, '#005da4', W_, '#ed1c24'), away: makeKit('#1f9a4a', W_, '#1f9a4a', W_),
    flag: [['h', ['#ffffff', '#005da4', '#ed1c24']], ['poly', '#005da4', [[0.22, 0.15], [0.4, 0.15], [0.4, 0.42], [0.31, 0.52], [0.22, 0.42]]], ['poly', '#ffffff', [[0.25, 0.36], [0.31, 0.25], [0.37, 0.36]]]] },
  { id: 'albania', name: 'ALBANIA', short: 'ALB', level: 0,
    home: makeKit('#e41e20', B_, '#e41e20', B_), away: makeKit(B_, B_, B_, '#e41e20'),
    flag: [['fill', '#e41e20'], ['poly', '#1b1b1b', [[0.5, 0.2], [0.58, 0.34], [0.78, 0.28], [0.67, 0.48], [0.78, 0.68], [0.59, 0.62], [0.5, 0.82], [0.41, 0.62], [0.22, 0.68], [0.33, 0.48], [0.22, 0.28], [0.42, 0.34]]]] },
  { id: 'uzbekistan', name: 'UZBEKISTAN', short: 'UZB', level: 0,
    home: makeKit(W_, W_, W_, '#0099b5'), away: makeKit('#0099b5', '#0099b5', '#0099b5', W_),
    flag: [['h', ['#0099b5', '#ce1126', '#ffffff', '#ce1126', '#1eb53a'], [10, 1, 10, 1, 10]], ['crescent', '#ffffff', 0.15, 0.17, 0.12], ['dot', '#ffffff', 0.3, 0.1, 0.025], ['dot', '#ffffff', 0.36, 0.1, 0.025], ['dot', '#ffffff', 0.3, 0.22, 0.025], ['dot', '#ffffff', 0.36, 0.22, 0.025]] },
  { id: 'ghana', name: 'GHANA', short: 'GHA', level: 0,
    home: makeKit(W_, W_, W_, '#006b3f'), away: makeKit('#fcd116', B_, '#fcd116', B_),
    flag: [['h', ['#ce1126', '#fcd116', '#006b3f']], ['star', '#1b1b1b', 0.5, 0.5, 0.16]] },
  { id: 'southafrica', name: 'SOUTH AFRICA', short: 'RSA', level: 0,
    home: makeKit('#ffb81c', '#007a4d', '#ffb81c', '#007a4d'), away: makeKit(W_, '#007a4d', W_, '#007a4d'),
    flag: [['h', ['#e03c31', '#001489']], ['poly', '#ffffff', [[0, 0], [0.2, 0], [0.52, 0.34], [1, 0.34], [1, 0.66], [0.52, 0.66], [0.2, 1], [0, 1]]],
      ['poly', '#007749', [[0, 0.08], [0.1, 0], [0.48, 0.41], [1, 0.41], [1, 0.59], [0.48, 0.59], [0.1, 1], [0, 0.92]]], ['poly', '#ffb81c', [[0, 0.16], [0.33, 0.5], [0, 0.84]]], ['poly', '#1b1b1b', [[0, 0.25], [0.25, 0.5], [0, 0.75]]]] },
  { id: 'georgia', name: 'GEORGIA', short: 'GEO', level: 0,
    home: makeKit(W_, W_, W_, '#da291c'), away: makeKit('#da291c', B_, '#da291c', W_),
    flag: [['fill', '#ffffff'], ['cross', '#ff0000', 0.2], ['plus', '#ff0000', 0.2, 0.22, 0.2], ['plus', '#ff0000', 0.8, 0.22, 0.2], ['plus', '#ff0000', 0.2, 0.78, 0.2], ['plus', '#ff0000', 0.8, 0.78, 0.2]] },
  { id: 'jamaica', name: 'JAMAICA', short: 'JAM', level: 0,
    home: makeKit('#fed100', B_, '#fed100', '#009b3a'), away: makeKit(B_, B_, B_, '#fed100'),
    flag: [['fill', '#009b3a'], ['poly', '#1b1b1b', [[0, 0], [0.5, 0.5], [0, 1]]], ['poly', '#1b1b1b', [[1, 0], [0.5, 0.5], [1, 1]]], ['saltire', '#fed100', 0.16]] },
  { id: 'honduras', name: 'HONDURAS', short: 'HON', level: 0,
    home: makeKit(W_, W_, W_, '#0073cf'), away: makeKit('#0073cf', '#0073cf', '#0073cf', W_),
    flag: [['h', ['#0073cf', '#ffffff', '#0073cf']], ['star', '#0073cf', 0.5, 0.5, 0.06], ['star', '#0073cf', 0.38, 0.43, 0.06], ['star', '#0073cf', 0.38, 0.57, 0.06], ['star', '#0073cf', 0.62, 0.43, 0.06], ['star', '#0073cf', 0.62, 0.57, 0.06]] },
  { id: 'iceland', name: 'ICELAND', short: 'ISL', level: 0,
    home: makeKit('#02529c', '#02529c', '#02529c', '#dc1e35'), away: makeKit(W_, W_, W_, '#02529c'),
    flag: [['fill', '#02529c'], ['nordic', '#ffffff', 0.26], ['nordic', '#dc1e35', 0.13]] },
  { id: 'finland', name: 'FINLAND', short: 'FIN', level: 0,
    home: makeKit(W_, '#002f6c', W_, '#002f6c'), away: makeKit('#002f6c', '#002f6c', '#002f6c', W_),
    flag: [['fill', '#ffffff'], ['nordic', '#002f6c', 0.22]] },
  { id: 'newzealand', name: 'NEW ZEALAND', short: 'NZL', level: 0,
    home: makeKit(W_, B_, W_, B_), away: makeKit(B_, B_, B_, W_),
    flag: [['fill', '#012169'], ['rect', '#ffffff', 0.19, 0, 0.12, 0.5], ['rect', '#ffffff', 0, 0.19, 0.5, 0.12], ['rect', '#c8102e', 0.22, 0, 0.06, 0.5], ['rect', '#c8102e', 0, 0.22, 0.5, 0.06],
      ['star', '#ffffff', 0.76, 0.22, 0.1], ['star', '#c8102e', 0.76, 0.22, 0.065], ['star', '#ffffff', 0.88, 0.45, 0.1], ['star', '#c8102e', 0.88, 0.45, 0.065],
      ['star', '#ffffff', 0.65, 0.5, 0.1], ['star', '#c8102e', 0.65, 0.5, 0.065], ['star', '#ffffff', 0.76, 0.8, 0.1], ['star', '#c8102e', 0.76, 0.8, 0.065]] },
  { id: 'bosnia', name: 'BOSNIA', short: 'BIH', level: 0,
    home: makeKit('#002395', '#002395', '#002395', '#fecb00'), away: makeKit(W_, W_, W_, '#002395'),
    flag: [['fill', '#002395'], ['poly', '#fecb00', [[0.28, 0], [0.72, 0], [0.72, 1]]], ['star', '#ffffff', 0.24, 0.07, 0.05], ['star', '#ffffff', 0.3, 0.21, 0.05], ['star', '#ffffff', 0.36, 0.35, 0.05],
      ['star', '#ffffff', 0.42, 0.49, 0.05], ['star', '#ffffff', 0.48, 0.63, 0.05], ['star', '#ffffff', 0.55, 0.77, 0.05], ['star', '#ffffff', 0.61, 0.91, 0.05]] },
  { id: 'drcongo', name: 'DR CONGO', short: 'COD', level: 0,
    home: makeKit('#007fff', '#ce1021', '#007fff', '#f7d618'), away: makeKit(W_, '#007fff', W_, '#ce1021'),
    flag: [['fill', '#007fff'], ['poly', '#f7d618', [[0, 0.72], [0.82, 0], [1, 0], [1, 0.28], [0.18, 1], [0, 1]]], ['poly', '#ce1021', [[0, 0.84], [0.9, 0], [1, 0], [1, 0.16], [0.1, 1], [0, 1]]], ['star', '#f7d618', 0.16, 0.24, 0.15]] },
  { id: 'puertorico', name: 'PUERTO RICO', short: 'PUR', level: 0,
    home: makeKit('#ed0000', '#0050f0', W_, W_), away: makeKit(W_, '#0050f0', W_, '#ed0000'),
    flag: [['h', ['#ed0000', '#ffffff', '#ed0000', '#ffffff', '#ed0000']], ['tri', '#0050f0', 0.5], ['star', '#ffffff', 0.17, 0.5, 0.13]] },
  { id: 'dominicanrep', name: 'DOMINICAN REP.', short: 'DOM', level: 0,
    home: makeKit('#002d62', W_, '#002d62', '#ce1126'), away: makeKit(W_, '#ce1126', W_, '#002d62'),
    flag: [['fill', '#ffffff'], ['rect', '#002d62', 0, 0, 0.44, 0.42], ['rect', '#ce1126', 0.56, 0, 0.44, 0.42], ['rect', '#ce1126', 0, 0.58, 0.44, 0.42], ['rect', '#002d62', 0.56, 0.58, 0.44, 0.42], ['dot', '#1b7b3c', 0.5, 0.5, 0.08]] },
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
  random(...except) { const ids = new Set(except.filter(Boolean).map((c) => typeof c === 'string' ? c : c.id)); const pool = CLUBS.filter((c) => !ids.has(c.id)); return pick(pool.length ? pool : CLUBS); },

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
