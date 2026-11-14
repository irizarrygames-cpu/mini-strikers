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
  { id: 'argentina', name: tl('ARGENTINA'), short: 'ARG', level: 3,
    home: makeKit(W_, B_, W_, '#1b1d33', { stripes: '#75aadb' }), away: makeKit('#2b2a6b', '#2b2a6b', '#2b2a6b', '#75aadb') },
  { id: 'spain', name: tl('SPAIN'), short: 'ESP', level: 3,
    home: makeKit('#c60b1e', '#1d2a52', '#1d2a52', '#ffc400'), away: makeKit(W_, W_, W_, '#c60b1e') },
  { id: 'france', name: tl('FRANCE'), short: 'FRA', level: 3,
    home: makeKit('#1f2a5c', W_, '#e1000f', W_), away: makeKit(W_, '#1f2a5c', W_, '#1f2a5c') },
  { id: 'england', name: tl('ENGLAND'), short: 'ENG', level: 3,
    home: makeKit(W_, '#1d2a52', W_, '#cf142b'), away: makeKit('#cf142b', '#cf142b', '#cf142b', W_) },
  { id: 'brazil', name: tl('BRAZIL'), short: 'BRA', level: 3,
    home: makeKit('#ffdf00', '#0a3fa8', W_, '#009b3a'), away: makeKit('#0a3fa8', W_, '#0a3fa8', '#ffdf00') },
  { id: 'portugal', name: tl('PORTUGAL'), short: 'POR', level: 3,
    home: makeKit('#b5121b', '#b5121b', '#b5121b', '#046a38', { sleeves: '#046a38' }), away: makeKit(W_, W_, W_, '#046a38') },
  { id: 'netherlands', name: tl('NETHERLANDS'), short: 'NED', level: 2,
    home: makeKit('#ff6c00', B_, '#ff6c00', B_), away: makeKit('#1b2a5a', '#1b2a5a', '#1b2a5a', '#ff6c00') },
  { id: 'belgium', name: tl('BELGIUM'), short: 'BEL', level: 2,
    home: makeKit('#e30613', B_, '#e30613', '#fdda24'), away: makeKit(W_, W_, W_, B_) },
  { id: 'italy', name: tl('ITALY'), short: 'ITA', level: 2,
    home: makeKit('#0066cc', W_, '#0066cc', '#c9a64b'), away: makeKit(W_, '#0066cc', W_, '#0066cc') },
  { id: 'germany', name: tl('GERMANY'), short: 'GER', level: 2,
    home: makeKit(W_, B_, W_, B_), away: makeKit(B_, B_, B_, '#dd0000') },
  { id: 'croatia', name: tl('CROATIA'), short: 'CRO', level: 2,
    home: makeKit(W_, W_, '#171796', '#171796', { checks: '#e30613' }), away: makeKit('#171796', '#171796', '#171796', '#e30613') },
  { id: 'morocco', name: tl('MOROCCO'), short: 'MAR', level: 2,
    home: makeKit('#c1272d', '#006233', '#c1272d', '#006233'), away: makeKit(W_, W_, W_, '#c1272d') },
  { id: 'colombia', name: tl('COLOMBIA'), short: 'COL', level: 2,
    home: makeKit('#fcd116', '#003893', W_, '#ce1126'), away: makeKit('#003893', '#003893', '#003893', '#fcd116') },
  { id: 'uruguay', name: tl('URUGUAY'), short: 'URU', level: 1,
    home: makeKit('#5cbfeb', B_, B_, W_), away: makeKit(W_, W_, W_, '#5cbfeb') },
  { id: 'usa', name: tl('USA'), short: 'USA', level: 1,
    home: makeKit(W_, '#0a3161', W_, '#b31942'), away: makeKit('#0a3161', '#0a3161', '#0a3161', '#b31942') },
  { id: 'mexico', name: tl('MEXICO'), short: 'MEX', level: 1,
    home: makeKit('#006847', W_, '#ce1126', '#ce1126'), away: makeKit(W_, B_, W_, '#006847') },
  { id: 'japan', name: tl('JAPAN'), short: 'JPN', level: 1,
    home: makeKit('#1c2a7a', W_, '#1c2a7a', '#bc002d'), away: makeKit(W_, '#1c2a7a', W_, '#1c2a7a') },
  { id: 'switzerland', name: tl('SWITZERLAND'), short: 'SUI', level: 1,
    home: makeKit('#d52b1e', W_, '#d52b1e', W_), away: makeKit(W_, '#d52b1e', W_, '#d52b1e') },
  { id: 'senegal', name: tl('SENEGAL'), short: 'SEN', level: 0,
    home: makeKit(W_, W_, W_, '#00853f', { sleeves: '#00853f' }), away: makeKit('#00853f', '#00853f', '#00853f', '#fdef42') },
  { id: 'denmark', name: tl('DENMARK'), short: 'DEN', level: 0,
    home: makeKit('#c8102e', W_, '#c8102e', W_), away: makeKit(W_, '#c8102e', W_, '#c8102e') },
  // the next fifty: the best-ranked teams we didn't have yet, plus Puerto Rico and the Dominican Republic.
  // `flag` is a list of simple shapes in 0..1 flag space, drawn by UI.flagBadge.
  { id: 'austria', name: tl('AUSTRIA'), short: 'AUT', level: 1,
    home: makeKit('#ed2939', W_, '#ed2939', W_), away: makeKit(W_, '#ed2939', W_, '#ed2939'),
    flag: [['h', ['#ed2939', '#ffffff', '#ed2939']]] },
  { id: 'ecuador', name: tl('ECUADOR'), short: 'ECU', level: 1,
    home: makeKit('#ffd100', '#034ea2', '#034ea2', '#ed1c24'), away: makeKit('#034ea2', '#034ea2', '#034ea2', '#ffd100'),
    flag: [['h', ['#ffd100', '#034ea2', '#ed1c24'], [2, 1, 1]], ['dot', '#a5732e', 0.5, 0.46, 0.13]] },
  { id: 'turkey', name: tl('TURKEY'), short: 'TUR', level: 1,
    home: makeKit('#e30a17', W_, '#e30a17', W_), away: makeKit(W_, '#e30a17', W_, '#e30a17'),
    flag: [['fill', '#e30a17'], ['crescent', '#ffffff', 0.4, 0.5, 0.26], ['star', '#ffffff', 0.61, 0.5, 0.12]] },
  { id: 'southkorea', name: tl('SOUTH KOREA'), short: 'KOR', level: 1,
    home: makeKit('#c60c30', B_, '#c60c30', '#003478'), away: makeKit(W_, B_, W_, '#c60c30'),
    flag: [['fill', '#ffffff'], ['halfdot', '#cd2e3a', '#0047a0', 0.5, 0.5, 0.25], ['rect', '#1b1b1b', 0.1, 0.12, 0.14, 0.1], ['rect', '#1b1b1b', 0.76, 0.12, 0.14, 0.1], ['rect', '#1b1b1b', 0.1, 0.78, 0.14, 0.1], ['rect', '#1b1b1b', 0.76, 0.78, 0.14, 0.1]] },
  { id: 'iran', name: tl('IRAN'), short: 'IRN', level: 1,
    home: makeKit(W_, W_, W_, '#239f40'), away: makeKit('#da0000', '#da0000', '#da0000', W_),
    flag: [['h', ['#239f40', '#ffffff', '#da0000']], ['dot', '#da0000', 0.5, 0.5, 0.09]] },
  { id: 'australia', name: tl('AUSTRALIA'), short: 'AUS', level: 1,
    home: makeKit('#ffcd00', '#00843d', '#ffcd00', '#00843d'), away: makeKit('#00843d', '#00843d', '#00843d', '#ffcd00'),
    flag: [['fill', '#012169'], ['rect', '#ffffff', 0.19, 0, 0.12, 0.5], ['rect', '#ffffff', 0, 0.19, 0.5, 0.12], ['rect', '#c8102e', 0.22, 0, 0.06, 0.5], ['rect', '#c8102e', 0, 0.22, 0.5, 0.06],
      ['star', '#ffffff', 0.25, 0.76, 0.14], ['star', '#ffffff', 0.76, 0.22, 0.07], ['star', '#ffffff', 0.88, 0.44, 0.07], ['star', '#ffffff', 0.66, 0.52, 0.07], ['star', '#ffffff', 0.76, 0.82, 0.07]] },
  { id: 'ukraine', name: tl('UKRAINE'), short: 'UKR', level: 1,
    home: makeKit('#ffd700', '#ffd700', '#ffd700', '#0057b7'), away: makeKit('#0057b7', '#0057b7', '#0057b7', '#ffd700'),
    flag: [['h', ['#0057b7', '#ffd700']]] },
  { id: 'sweden', name: tl('SWEDEN'), short: 'SWE', level: 1,
    home: makeKit('#fecc02', '#006aa7', '#fecc02', '#006aa7'), away: makeKit('#006aa7', '#006aa7', '#006aa7', '#fecc02'),
    flag: [['fill', '#006aa7'], ['nordic', '#fecc02', 0.2]] },
  { id: 'wales', name: tl('WALES'), short: 'WAL', level: 1,
    home: makeKit('#c8102e', '#c8102e', '#c8102e', '#00b140'), away: makeKit(W_, '#00b140', W_, '#00b140'),
    flag: [['h', ['#ffffff', '#00b140']], ['poly', '#c8102e', [[0.3, 0.64], [0.36, 0.42], [0.5, 0.38], [0.58, 0.24], [0.68, 0.28], [0.63, 0.4], [0.74, 0.46], [0.65, 0.52], [0.72, 0.68], [0.6, 0.62], [0.5, 0.72], [0.42, 0.62]]]] },
  { id: 'poland', name: tl('POLAND'), short: 'POL', level: 1,
    home: makeKit(W_, '#dc143c', W_, '#dc143c'), away: makeKit('#dc143c', '#dc143c', '#dc143c', W_),
    flag: [['h', ['#ffffff', '#dc143c']]] },
  { id: 'serbia', name: tl('SERBIA'), short: 'SRB', level: 1,
    home: makeKit('#c6363c', '#0c4076', W_, W_), away: makeKit(W_, W_, W_, '#c6363c'),
    flag: [['h', ['#c6363c', '#0c4076', '#ffffff']], ['dot', '#ffffff', 0.34, 0.46, 0.2], ['dot', '#c6363c', 0.34, 0.46, 0.15]] },
  { id: 'norway', name: tl('NORWAY'), short: 'NOR', level: 1,
    home: makeKit('#ba0c2f', W_, '#00205b', '#00205b'), away: makeKit(W_, '#00205b', W_, '#ba0c2f'),
    flag: [['fill', '#ba0c2f'], ['nordic', '#ffffff', 0.26], ['nordic', '#00205b', 0.13]] },
  { id: 'hungary', name: tl('HUNGARY'), short: 'HUN', level: 0,
    home: makeKit('#cd2a3e', W_, '#436f4d', '#436f4d'), away: makeKit(W_, W_, W_, '#cd2a3e'),
    flag: [['h', ['#cd2a3e', '#ffffff', '#436f4d']]] },
  { id: 'nigeria', name: tl('NIGERIA'), short: 'NGA', level: 0,
    home: makeKit('#008751', '#008751', '#008751', W_), away: makeKit(W_, '#008751', W_, '#008751'),
    flag: [['v', ['#008751', '#ffffff', '#008751']]] },
  { id: 'egypt', name: tl('EGYPT'), short: 'EGY', level: 0,
    home: makeKit('#ce1126', W_, B_, '#c09300'), away: makeKit(W_, B_, W_, '#ce1126'),
    flag: [['h', ['#ce1126', '#ffffff', '#1b1b1b']], ['dot', '#c09300', 0.5, 0.5, 0.11]] },
  { id: 'algeria', name: tl('ALGERIA'), short: 'ALG', level: 0,
    home: makeKit(W_, W_, W_, '#006233'), away: makeKit('#006233', '#006233', '#006233', W_),
    flag: [['v', ['#006233', '#ffffff']], ['crescent', '#d21034', 0.5, 0.5, 0.27], ['star', '#d21034', 0.58, 0.5, 0.11]] },
  { id: 'canada', name: tl('CANADA'), short: 'CAN', level: 0,
    home: makeKit('#d80621', '#d80621', '#d80621', W_), away: makeKit(W_, W_, W_, '#d80621'),
    flag: [['v', ['#d80621', '#ffffff', '#d80621'], [1, 2, 1]], ['star', '#d80621', 0.5, 0.46, 0.24], ['rect', '#d80621', 0.487, 0.58, 0.026, 0.2]] },
  { id: 'scotland', name: tl('SCOTLAND'), short: 'SCO', level: 0,
    home: makeKit('#1b2f5b', W_, '#1b2f5b', W_), away: makeKit(W_, '#1b2f5b', W_, '#1b2f5b'),
    flag: [['fill', '#0065bd'], ['saltire', '#ffffff', 0.18]] },
  { id: 'czechia', name: tl('CZECHIA'), short: 'CZE', level: 0,
    home: makeKit('#d7141a', W_, '#11457e', W_), away: makeKit(W_, '#11457e', W_, '#d7141a'),
    flag: [['h', ['#ffffff', '#d7141a']], ['tri', '#11457e', 0.5]] },
  { id: 'panama', name: tl('PANAMA'), short: 'PAN', level: 0,
    home: makeKit('#da121a', '#072357', '#da121a', W_), away: makeKit(W_, W_, W_, '#072357'),
    flag: [['fill', '#ffffff'], ['rect', '#da121a', 0.5, 0, 0.5, 0.5], ['rect', '#072357', 0, 0.5, 0.5, 0.5], ['star', '#072357', 0.25, 0.25, 0.13], ['star', '#da121a', 0.75, 0.75, 0.13]] },
  { id: 'peru', name: tl('PERU'), short: 'PER', level: 0,
    home: makeKit(W_, W_, W_, '#d91023', { center: '#d91023' }), away: makeKit('#d91023', '#d91023', '#d91023', W_),
    flag: [['v', ['#d91023', '#ffffff', '#d91023']]] },
  { id: 'slovakia', name: tl('SLOVAKIA'), short: 'SVK', level: 0,
    home: makeKit(W_, '#0b4ea2', W_, '#0b4ea2'), away: makeKit('#0b4ea2', '#0b4ea2', '#0b4ea2', W_),
    flag: [['h', ['#ffffff', '#0b4ea2', '#ee1c25']], ['dot', '#ffffff', 0.34, 0.5, 0.24], ['dot', '#ee1c25', 0.34, 0.5, 0.19], ['plus', '#ffffff', 0.34, 0.49, 0.2]] },
  { id: 'romania', name: tl('ROMANIA'), short: 'ROU', level: 0,
    home: makeKit('#fcd116', '#002b7f', '#ce1126', '#002b7f'), away: makeKit('#002b7f', '#002b7f', '#002b7f', '#fcd116'),
    flag: [['v', ['#002b7f', '#fcd116', '#ce1126']]] },
  { id: 'greece', name: tl('GREECE'), short: 'GRE', level: 0,
    home: makeKit(W_, W_, W_, '#0d5eaf'), away: makeKit('#0d5eaf', '#0d5eaf', '#0d5eaf', W_),
    flag: [['h', ['#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf']], ['rect', '#0d5eaf', 0, 0, 0.38, 0.556], ['rect', '#ffffff', 0.15, 0, 0.08, 0.556], ['rect', '#ffffff', 0, 0.22, 0.38, 0.111]] },
  { id: 'ivorycoast', name: tl('IVORY COAST'), short: 'CIV', level: 0,
    home: makeKit('#f77f00', W_, '#009e60', '#009e60'), away: makeKit(W_, '#f77f00', W_, '#009e60'),
    flag: [['v', ['#f77f00', '#ffffff', '#009e60']]] },
  { id: 'tunisia', name: tl('TUNISIA'), short: 'TUN', level: 0,
    home: makeKit('#e70013', W_, '#e70013', W_), away: makeKit(W_, '#e70013', W_, '#e70013'),
    flag: [['fill', '#e70013'], ['dot', '#ffffff', 0.5, 0.5, 0.28], ['crescent', '#e70013', 0.48, 0.5, 0.2], ['star', '#e70013', 0.56, 0.5, 0.09]] },
  { id: 'costarica', name: tl('COSTA RICA'), short: 'CRC', level: 0,
    home: makeKit('#ce1126', '#002b7f', W_, W_), away: makeKit(W_, W_, W_, '#002b7f'),
    flag: [['h', ['#002b7f', '#ffffff', '#ce1126', '#ffffff', '#002b7f'], [1, 1, 2, 1, 1]]] },
  { id: 'paraguay', name: tl('PARAGUAY'), short: 'PAR', level: 0,
    home: makeKit(W_, '#0038a8', '#0038a8', '#0038a8', { stripes: '#d52b1e' }), away: makeKit('#0038a8', '#0038a8', '#0038a8', W_),
    flag: [['h', ['#d52b1e', '#ffffff', '#0038a8']], ['dot', '#fcd116', 0.5, 0.5, 0.1]] },
  { id: 'chile', name: tl('CHILE'), short: 'CHI', level: 0,
    home: makeKit('#d52b1e', '#0039a6', W_, W_), away: makeKit(W_, W_, W_, '#d52b1e'),
    flag: [['h', ['#ffffff', '#d52b1e']], ['rect', '#0039a6', 0, 0, 0.334, 0.5], ['star', '#ffffff', 0.167, 0.25, 0.13]] },
  { id: 'venezuela', name: tl('VENEZUELA'), short: 'VEN', level: 0,
    home: makeKit('#7a1c2c', '#7a1c2c', '#7a1c2c', '#ffcc00'), away: makeKit(W_, '#7a1c2c', W_, '#7a1c2c'),
    flag: [['h', ['#fcd116', '#00247d', '#cf142b']], ['arcstars', '#ffffff', 0.5, 0.64, 0.24, 8, 0.04]] },
  { id: 'qatar', name: tl('QATAR'), short: 'QAT', level: 0,
    home: makeKit('#8a1538', W_, '#8a1538', W_), away: makeKit(W_, '#8a1538', W_, '#8a1538'),
    flag: [['fill', '#8a1538'], ['poly', '#ffffff', [[0, 0], [0.3, 0], [0.38, 0.056], [0.3, 0.111], [0.38, 0.167], [0.3, 0.222], [0.38, 0.278], [0.3, 0.333], [0.38, 0.389], [0.3, 0.444], [0.38, 0.5], [0.3, 0.556], [0.38, 0.611], [0.3, 0.667], [0.38, 0.722], [0.3, 0.778], [0.38, 0.833], [0.3, 0.889], [0.38, 0.944], [0.3, 1], [0, 1]]]] },
  { id: 'saudiarabia', name: tl('SAUDI ARABIA'), short: 'KSA', level: 0,
    home: makeKit(W_, W_, W_, '#006c35'), away: makeKit('#006c35', '#006c35', '#006c35', W_),
    flag: [['fill', '#006c35'], ['rect', '#ffffff', 0.25, 0.32, 0.5, 0.12], ['rect', '#ffffff', 0.28, 0.62, 0.44, 0.05], ['rect', '#ffffff', 0.69, 0.57, 0.03, 0.15]] },
  { id: 'cameroon', name: tl('CAMEROON'), short: 'CMR', level: 0,
    home: makeKit('#007a5e', '#ce1126', '#fcd116', '#fcd116'), away: makeKit('#fcd116', '#007a5e', '#fcd116', '#007a5e'),
    flag: [['v', ['#007a5e', '#ce1126', '#fcd116']], ['star', '#fcd116', 0.5, 0.5, 0.17]] },
  { id: 'mali', name: tl('MALI'), short: 'MLI', level: 0,
    home: makeKit('#14b53a', '#fcd116', '#ce1126', '#fcd116'), away: makeKit(W_, '#14b53a', W_, '#14b53a'),
    flag: [['v', ['#14b53a', '#fcd116', '#ce1126']]] },
  { id: 'ireland', name: tl('IRELAND'), short: 'IRL', level: 0,
    home: makeKit('#169b62', W_, '#169b62', '#ff883e'), away: makeKit(W_, '#169b62', W_, '#169b62'),
    flag: [['v', ['#169b62', '#ffffff', '#ff883e']]] },
  { id: 'slovenia', name: tl('SLOVENIA'), short: 'SVN', level: 0,
    home: makeKit(W_, '#005da4', W_, '#ed1c24'), away: makeKit('#1f9a4a', W_, '#1f9a4a', W_),
    flag: [['h', ['#ffffff', '#005da4', '#ed1c24']], ['poly', '#005da4', [[0.22, 0.15], [0.4, 0.15], [0.4, 0.42], [0.31, 0.52], [0.22, 0.42]]], ['poly', '#ffffff', [[0.25, 0.36], [0.31, 0.25], [0.37, 0.36]]]] },
  { id: 'albania', name: tl('ALBANIA'), short: 'ALB', level: 0,
    home: makeKit('#e41e20', B_, '#e41e20', B_), away: makeKit(B_, B_, B_, '#e41e20'),
    flag: [['fill', '#e41e20'], ['poly', '#1b1b1b', [[0.5, 0.2], [0.58, 0.34], [0.78, 0.28], [0.67, 0.48], [0.78, 0.68], [0.59, 0.62], [0.5, 0.82], [0.41, 0.62], [0.22, 0.68], [0.33, 0.48], [0.22, 0.28], [0.42, 0.34]]]] },
  { id: 'uzbekistan', name: tl('UZBEKISTAN'), short: 'UZB', level: 0,
    home: makeKit(W_, W_, W_, '#0099b5'), away: makeKit('#0099b5', '#0099b5', '#0099b5', W_),
    flag: [['h', ['#0099b5', '#ce1126', '#ffffff', '#ce1126', '#1eb53a'], [10, 1, 10, 1, 10]], ['crescent', '#ffffff', 0.15, 0.17, 0.12], ['dot', '#ffffff', 0.3, 0.1, 0.025], ['dot', '#ffffff', 0.36, 0.1, 0.025], ['dot', '#ffffff', 0.3, 0.22, 0.025], ['dot', '#ffffff', 0.36, 0.22, 0.025]] },
  { id: 'ghana', name: tl('GHANA'), short: 'GHA', level: 0,
    home: makeKit(W_, W_, W_, '#006b3f'), away: makeKit('#fcd116', B_, '#fcd116', B_),
    flag: [['h', ['#ce1126', '#fcd116', '#006b3f']], ['star', '#1b1b1b', 0.5, 0.5, 0.16]] },
  { id: 'southafrica', name: tl('SOUTH AFRICA'), short: 'RSA', level: 0,
    home: makeKit('#ffb81c', '#007a4d', '#ffb81c', '#007a4d'), away: makeKit(W_, '#007a4d', W_, '#007a4d'),
    flag: [['h', ['#e03c31', '#001489']], ['poly', '#ffffff', [[0, 0], [0.2, 0], [0.52, 0.34], [1, 0.34], [1, 0.66], [0.52, 0.66], [0.2, 1], [0, 1]]],
      ['poly', '#007749', [[0, 0.08], [0.1, 0], [0.48, 0.41], [1, 0.41], [1, 0.59], [0.48, 0.59], [0.1, 1], [0, 0.92]]], ['poly', '#ffb81c', [[0, 0.16], [0.33, 0.5], [0, 0.84]]], ['poly', '#1b1b1b', [[0, 0.25], [0.25, 0.5], [0, 0.75]]]] },
  { id: 'georgia', name: tl('GEORGIA'), short: 'GEO', level: 0,
    home: makeKit(W_, W_, W_, '#da291c'), away: makeKit('#da291c', B_, '#da291c', W_),
    flag: [['fill', '#ffffff'], ['cross', '#ff0000', 0.2], ['plus', '#ff0000', 0.2, 0.22, 0.2], ['plus', '#ff0000', 0.8, 0.22, 0.2], ['plus', '#ff0000', 0.2, 0.78, 0.2], ['plus', '#ff0000', 0.8, 0.78, 0.2]] },
  { id: 'jamaica', name: tl('JAMAICA'), short: 'JAM', level: 0,
    home: makeKit('#fed100', B_, '#fed100', '#009b3a'), away: makeKit(B_, B_, B_, '#fed100'),
    flag: [['fill', '#009b3a'], ['poly', '#1b1b1b', [[0, 0], [0.5, 0.5], [0, 1]]], ['poly', '#1b1b1b', [[1, 0], [0.5, 0.5], [1, 1]]], ['saltire', '#fed100', 0.16]] },
  { id: 'honduras', name: tl('HONDURAS'), short: 'HON', level: 0,
    home: makeKit(W_, W_, W_, '#0073cf'), away: makeKit('#0073cf', '#0073cf', '#0073cf', W_),
    flag: [['h', ['#0073cf', '#ffffff', '#0073cf']], ['star', '#0073cf', 0.5, 0.5, 0.06], ['star', '#0073cf', 0.38, 0.43, 0.06], ['star', '#0073cf', 0.38, 0.57, 0.06], ['star', '#0073cf', 0.62, 0.43, 0.06], ['star', '#0073cf', 0.62, 0.57, 0.06]] },
  { id: 'iceland', name: tl('ICELAND'), short: 'ISL', level: 0,
    home: makeKit('#02529c', '#02529c', '#02529c', '#dc1e35'), away: makeKit(W_, W_, W_, '#02529c'),
    flag: [['fill', '#02529c'], ['nordic', '#ffffff', 0.26], ['nordic', '#dc1e35', 0.13]] },
  { id: 'finland', name: tl('FINLAND'), short: 'FIN', level: 0,
    home: makeKit(W_, '#002f6c', W_, '#002f6c'), away: makeKit('#002f6c', '#002f6c', '#002f6c', W_),
    flag: [['fill', '#ffffff'], ['nordic', '#002f6c', 0.22]] },
  { id: 'newzealand', name: tl('NEW ZEALAND'), short: 'NZL', level: 0,
    home: makeKit(W_, B_, W_, B_), away: makeKit(B_, B_, B_, W_),
    flag: [['fill', '#012169'], ['rect', '#ffffff', 0.19, 0, 0.12, 0.5], ['rect', '#ffffff', 0, 0.19, 0.5, 0.12], ['rect', '#c8102e', 0.22, 0, 0.06, 0.5], ['rect', '#c8102e', 0, 0.22, 0.5, 0.06],
      ['star', '#ffffff', 0.76, 0.22, 0.1], ['star', '#c8102e', 0.76, 0.22, 0.065], ['star', '#ffffff', 0.88, 0.45, 0.1], ['star', '#c8102e', 0.88, 0.45, 0.065],
      ['star', '#ffffff', 0.65, 0.5, 0.1], ['star', '#c8102e', 0.65, 0.5, 0.065], ['star', '#ffffff', 0.76, 0.8, 0.1], ['star', '#c8102e', 0.76, 0.8, 0.065]] },
  { id: 'bosnia', name: tl('BOSNIA'), short: 'BIH', level: 0,
    home: makeKit('#002395', '#002395', '#002395', '#fecb00'), away: makeKit(W_, W_, W_, '#002395'),
    flag: [['fill', '#002395'], ['poly', '#fecb00', [[0.28, 0], [0.72, 0], [0.72, 1]]], ['star', '#ffffff', 0.24, 0.07, 0.05], ['star', '#ffffff', 0.3, 0.21, 0.05], ['star', '#ffffff', 0.36, 0.35, 0.05],
      ['star', '#ffffff', 0.42, 0.49, 0.05], ['star', '#ffffff', 0.48, 0.63, 0.05], ['star', '#ffffff', 0.55, 0.77, 0.05], ['star', '#ffffff', 0.61, 0.91, 0.05]] },
  { id: 'drcongo', name: tl('DR CONGO'), short: 'COD', level: 0,
    home: makeKit('#007fff', '#ce1021', '#007fff', '#f7d618'), away: makeKit(W_, '#007fff', W_, '#ce1021'),
    flag: [['fill', '#007fff'], ['poly', '#f7d618', [[0, 0.72], [0.82, 0], [1, 0], [1, 0.28], [0.18, 1], [0, 1]]], ['poly', '#ce1021', [[0, 0.84], [0.9, 0], [1, 0], [1, 0.16], [0.1, 1], [0, 1]]], ['star', '#f7d618', 0.16, 0.24, 0.15]] },
  { id: 'puertorico', name: tl('PUERTO RICO'), short: 'PUR', level: 0,
    home: makeKit('#ed0000', '#0050f0', W_, W_), away: makeKit(W_, '#0050f0', W_, '#ed0000'),
    flag: [['h', ['#ed0000', '#ffffff', '#ed0000', '#ffffff', '#ed0000']], ['tri', '#0050f0', 0.5], ['star', '#ffffff', 0.17, 0.5, 0.13]] },
  { id: 'dominicanrep', name: tl('DOMINICAN REP.'), short: 'DOM', level: 0,
    home: makeKit('#002d62', W_, '#002d62', '#ce1126'), away: makeKit(W_, '#ce1126', W_, '#002d62'),
    flag: [['fill', '#ffffff'], ['rect', '#002d62', 0, 0, 0.44, 0.42], ['rect', '#ce1126', 0.56, 0, 0.44, 0.42], ['rect', '#ce1126', 0, 0.58, 0.44, 0.42], ['rect', '#002d62', 0.56, 0.58, 0.44, 0.42], ['dot', '#1b7b3c', 0.5, 0.5, 0.08]] },
  // ---- twenty-five more, added with the crates
  { id: 'russia', name: tl('RUSSIA'), short: 'RUS', level: 1,
    home: makeKit('#d52b1e', W_, '#d52b1e', W_), away: makeKit(W_, '#0039a6', W_, '#d52b1e'),
    flag: [['h', ['#ffffff', '#0039a6', '#d52b1e']]] },
  { id: 'china', name: tl('CHINA'), short: 'CHN', level: 1,
    home: makeKit('#de2910', '#de2910', '#de2910', '#ffde00'), away: makeKit(W_, W_, W_, '#de2910'),
    flag: [['fill', '#de2910'], ['star', '#ffde00', 0.18, 0.28, 0.16], ['star', '#ffde00', 0.36, 0.14, 0.07], ['star', '#ffde00', 0.44, 0.26, 0.07], ['star', '#ffde00', 0.44, 0.42, 0.07], ['star', '#ffde00', 0.36, 0.54, 0.07]] },
  { id: 'india', name: tl('INDIA'), short: 'IND', level: 0,
    home: makeKit('#0057b7', '#0057b7', '#0057b7', '#ff9933'), away: makeKit('#ff9933', W_, '#ff9933', '#138808'),
    flag: [['h', ['#ff9933', '#ffffff', '#138808']], ['dot', '#000080', 0.5, 0.5, 0.09]] },
  { id: 'indonesia', name: tl('INDONESIA'), short: 'IDN', level: 0,
    home: makeKit('#ce1126', W_, '#ce1126', W_), away: makeKit(W_, '#ce1126', W_, '#ce1126'),
    flag: [['h', ['#ce1126', '#ffffff']]] },
  { id: 'thailand', name: tl('THAILAND'), short: 'THA', level: 0,
    home: makeKit('#241d4f', '#241d4f', '#241d4f', '#a51931'), away: makeKit(W_, W_, W_, '#241d4f'),
    flag: [['h', ['#a51931', '#ffffff', '#241d4f', '#ffffff', '#a51931'], [1, 1, 2, 1, 1]]] },
  { id: 'vietnam', name: tl('VIETNAM'), short: 'VIE', level: 0,
    home: makeKit('#da251d', '#da251d', '#da251d', '#ffff00'), away: makeKit(W_, '#da251d', W_, '#da251d'),
    flag: [['fill', '#da251d'], ['star', '#ffff00', 0.5, 0.5, 0.28]] },
  { id: 'philippines', name: tl('PHILIPPINES'), short: 'PHI', level: 0,
    home: makeKit('#0038a8', W_, '#0038a8', '#ce1126'), away: makeKit(W_, '#0038a8', W_, '#fcd116'),
    flag: [['h', ['#0038a8', '#ce1126']], ['poly', '#ffffff', [[0, 0], [0.42, 0.5], [0, 1]]], ['star', '#fcd116', 0.13, 0.5, 0.1]] },
  { id: 'kenya', name: tl('KENYA'), short: 'KEN', level: 0,
    home: makeKit('#006600', '#000000', '#006600', '#bb0000'), away: makeKit(W_, W_, W_, '#006600'),
    flag: [['h', ['#000000', '#bb0000', '#006600']], ['poly', '#ffffff', [[0.42, 0.14], [0.58, 0.14], [0.58, 0.86], [0.42, 0.86]]]] },
  { id: 'ethiopia', name: tl('ETHIOPIA'), short: 'ETH', level: 0,
    home: makeKit('#078930', '#078930', '#078930', '#fcdd09'), away: makeKit('#fcdd09', '#078930', '#fcdd09', '#da121a'),
    flag: [['h', ['#078930', '#fcdd09', '#da121a']], ['dot', '#0f47af', 0.5, 0.5, 0.2], ['star', '#fcdd09', 0.5, 0.5, 0.16]] },
  { id: 'zambia', name: tl('ZAMBIA'), short: 'ZAM', level: 0,
    home: makeKit('#198a00', '#198a00', '#198a00', '#ef7d00'), away: makeKit(W_, '#198a00', W_, '#ef7d00'),
    flag: [['fill', '#198a00'], ['rect', '#de2010', 0.6, 0.45, 0.13, 0.55], ['rect', '#000000', 0.73, 0.45, 0.13, 0.55], ['rect', '#ef7d00', 0.86, 0.45, 0.13, 0.55], ['dot', '#ef7d00', 0.78, 0.22, 0.14]] },
  { id: 'zimbabwe', name: tl('ZIMBABWE'), short: 'ZIM', level: 0,
    home: makeKit('#ffd200', '#006400', '#ffd200', '#de2010'), away: makeKit('#006400', '#006400', '#006400', '#ffd200'),
    flag: [['h', ['#006400', '#ffd200', '#de2010', '#000000', '#de2010', '#ffd200', '#006400']], ['poly', '#ffffff', [[0, 0], [0.34, 0.5], [0, 1]]], ['star', '#de2010', 0.11, 0.5, 0.13]] },
  { id: 'angola', name: tl('ANGOLA'), short: 'ANG', level: 0,
    home: makeKit('#ce1126', '#000000', '#ce1126', '#f9d616'), away: makeKit(W_, W_, W_, '#ce1126'),
    flag: [['h', ['#ce1126', '#000000']], ['star', '#f9d616', 0.5, 0.5, 0.15]] },
  { id: 'iraq', name: tl('IRAQ'), short: 'IRQ', level: 0,
    home: makeKit(W_, W_, W_, '#007a3d'), away: makeKit('#007a3d', '#007a3d', '#007a3d', W_),
    flag: [['h', ['#ce1126', '#ffffff', '#000000']], ['star', '#007a3d', 0.5, 0.5, 0.1]] },
  { id: 'jordan', name: tl('JORDAN'), short: 'JOR', level: 0,
    home: makeKit(W_, W_, W_, '#007a3d'), away: makeKit('#ce1126', '#000000', '#ce1126', W_),
    flag: [['h', ['#000000', '#ffffff', '#007a3d']], ['poly', '#ce1126', [[0, 0], [0.4, 0.5], [0, 1]]], ['star', '#ffffff', 0.14, 0.5, 0.09]] },
  { id: 'oman', name: tl('OMAN'), short: 'OMA', level: 0,
    home: makeKit('#db161b', '#db161b', '#db161b', W_), away: makeKit(W_, '#008000', W_, '#db161b'),
    flag: [['h', ['#ffffff', '#db161b', '#008000']], ['rect', '#db161b', 0, 0, 0.3, 1]] },
  { id: 'bolivia', name: tl('BOLIVIA'), short: 'BOL', level: 0,
    home: makeKit('#007934', '#007934', '#007934', '#fbe122'), away: makeKit(W_, '#007934', W_, '#d52b1e'),
    flag: [['h', ['#d52b1e', '#fbe122', '#007934']]] },
  { id: 'guatemala', name: tl('GUATEMALA'), short: 'GUA', level: 0,
    home: makeKit('#4997d0', W_, '#4997d0', W_), away: makeKit(W_, '#4997d0', W_, '#4997d0'),
    flag: [['v', ['#4997d0', '#ffffff', '#4997d0']], ['dot', '#4997d0', 0.5, 0.5, 0.11]] },
  { id: 'elsalvador', name: tl('EL SALVADOR'), short: 'SLV', level: 0,
    home: makeKit('#0f47af', W_, '#0f47af', W_), away: makeKit(W_, '#0f47af', W_, '#0f47af'),
    flag: [['h', ['#0f47af', '#ffffff', '#0f47af']], ['dot', '#fcd116', 0.5, 0.5, 0.1]] },
  { id: 'cuba', name: tl('CUBA'), short: 'CUB', level: 0,
    home: makeKit('#002a8f', W_, '#002a8f', '#cf142b'), away: makeKit(W_, '#002a8f', W_, '#cf142b'),
    flag: [['h', ['#002a8f', '#ffffff', '#002a8f', '#ffffff', '#002a8f']], ['poly', '#cf142b', [[0, 0], [0.4, 0.5], [0, 1]]], ['star', '#ffffff', 0.13, 0.5, 0.11]] },
  { id: 'haiti', name: tl('HAITI'), short: 'HAI', level: 0,
    home: makeKit('#00209f', '#00209f', '#00209f', '#d21034'), away: makeKit('#d21034', '#00209f', '#d21034', W_),
    flag: [['h', ['#00209f', '#d21034']], ['rect', '#ffffff', 0.36, 0.34, 0.28, 0.32]] },
  { id: 'trinidad', name: tl('TRINIDAD'), short: 'TRI', level: 0,
    home: makeKit('#ce1126', '#ce1126', '#ce1126', '#000000'), away: makeKit(W_, '#000000', W_, '#ce1126'),
    flag: [['fill', '#ce1126'], ['poly', '#ffffff', [[0, 0], [0.26, 0], [1, 1], [0.74, 1]]], ['poly', '#000000', [[0.05, 0], [0.21, 0], [1, 0.9], [1, 1], [0.95, 1]]]] },
  { id: 'estonia', name: tl('ESTONIA'), short: 'EST', level: 0,
    home: makeKit('#0072ce', '#000000', '#0072ce', W_), away: makeKit(W_, W_, W_, '#0072ce'),
    flag: [['h', ['#0072ce', '#000000', '#ffffff']]] },
  { id: 'latvia', name: tl('LATVIA'), short: 'LVA', level: 0,
    home: makeKit('#9e3039', '#9e3039', '#9e3039', W_), away: makeKit(W_, '#9e3039', W_, '#9e3039'),
    flag: [['h', ['#9e3039', '#ffffff', '#9e3039'], [2, 1, 2]]] },
  { id: 'lithuania', name: tl('LITHUANIA'), short: 'LTU', level: 0,
    home: makeKit('#fdb913', '#006a44', '#fdb913', '#c1272d'), away: makeKit(W_, '#006a44', W_, '#fdb913'),
    flag: [['h', ['#fdb913', '#006a44', '#c1272d']]] },
  { id: 'bulgaria', name: tl('BULGARIA'), short: 'BUL', level: 0,
    home: makeKit(W_, '#00966e', W_, '#d62612'), away: makeKit('#00966e', '#00966e', '#00966e', W_),
    flag: [['h', ['#ffffff', '#00966e', '#d62612']]] },
];
// ===== CLUB CAREER: a hundred clubs — fifty from Europe (build 111), fifty more from everywhere (build 116)
// Made up, on purpose. Real club names and badges belong to the clubs, so these are named after
// their cities (with a colour or a nickname in the local language) and wear similar colours, the
// way football games without a licence have always done it: as close as that allows (build 113:
// "make them as obvious as possible") — the city, the nickname fans use, the colours, and on the
// badge the animal or symbol everyone knows. js/crests.js draws the badges; none copies a real one. `stars` (2..5) is how big the club is: it sets what it pays and how hard its
// bots play (`level` 0..3, like a country's).
// crest: { shape, split, cols: [field, second colour, trim], emblem, …} — see js/crests.js, which draws it
function euroClub(id, name, short, city, country, stars, home, away, crest) {
  return { id, name, short, city, country, stars, level: Math.max(0, Math.min(3, stars - 2)), home, away, euro: true, crest };
}
const NV = '#1b2a5a', GD = '#c9a64b';
const EURO_CLUBS = [
  // Spain
  euroClub('madridblanco', 'Madrid Blancos', 'MDB', 'MADRID', 'spain', 5, makeKit(W_, W_, W_, GD), makeKit('#2a2a6e', '#2a2a6e', '#2a2a6e', GD),
    { shape: 'round', split: 'sash', cols: [W_, '#4b2a8a', GD], rim: GD, text: 'MADRID', tc: '#4b2a8a', top: 'crown', emblem: 'ball', ec: W_ }),
  euroClub('barcelonablau', 'Barcelona Blaugrana', 'BCN', 'BARCELONA', 'spain', 5, makeKit('#a50044', NV, NV, '#ffd23f', { stripes: '#1d4a9e' }), makeKit('#f7d04a', '#f7d04a', '#f7d04a', '#a50044'),
    { shape: 'pointed', split: 'blaugrana', cols: ['#a50044', '#1d4a9e', '#ffd23f'], rim: '#ffd23f', emblem: 'ball', ec: '#ffc21a', text: 'BARCELONA', ribbon: false }),
  euroClub('madridrojiblanco', 'Madrid Rojiblancos', 'MDR', 'MADRID', 'spain', 4, makeKit(W_, NV, '#cb3524', '#cb3524', { stripes: '#cb3524' }), makeKit(NV, NV, NV, '#cb3524'),
    { shape: 'shield', split: 'topband', cols: ['#cb3524', '#1d2a5a', W_], alt: W_, rim: '#1d2a5a', emblem: 'bear', ec: '#d9a066', epos: 'top', top: 'stars3', topc: W_ }),
  euroClub('bilbaozurigorri', 'Bilbao Leones', 'BIL', 'BILBAO', 'spain', 3, makeKit(W_, B_, B_, B_, { stripes: '#ee2523' }), makeKit(B_, B_, B_, '#ee2523'),
    { shape: 'shield', split: 'vstripes', cols: ['#ee2523', W_, GD], rim: B_, emblem: 'lion', ec: GD, plate: B_, text: 'BILBAO', rc: W_ }),
  euroClub('sevillablanco', 'Sevilla Nervión', 'SEV', 'SEVILLA', 'spain', 3, makeKit(W_, W_, W_, '#d6001c'), makeKit('#d6001c', '#d6001c', '#d6001c', W_),
    { shape: 'french', split: 'diag', cols: [W_, '#d6001c', GD], rim: '#d6001c', emblem: 'crown', ec: GD, text: 'SEVILLA', rc: W_ }),
  euroClub('vilarealgroc', 'Vila-real Submarino', 'VIL', 'VILA-REAL', 'spain', 3, makeKit('#ffe667', '#ffe667', '#ffe667', '#004a9e'), makeKit('#004a9e', '#004a9e', '#004a9e', '#ffe667'),
    { shape: 'round', split: 'plain', cols: ['#004a9e', '#004a9e', '#ffe667'], rim: '#ffe667', text: 'VILA-REAL', tc: '#004a9e', emblem: 'submarine', ec: '#ffe667' }),
  // England
  euroClub('manchesterblue', 'Manchester Blue', 'MCB', 'MANCHESTER', 'england', 5, makeKit('#6cabdd', W_, '#6cabdd', '#1c2c5b'), makeKit('#1c2c5b', '#1c2c5b', '#1c2c5b', '#6cabdd'),
    { shape: 'round', split: 'plain', cols: ['#6cabdd', '#6cabdd', '#ffc659'], rim: '#1c2c5b', text: 'MANCHESTER', tc: W_, emblem: 'ship', ec: '#ffc659' }),
  euroClub('manchesterred', 'Manchester Red', 'MCR', 'MANCHESTER', 'england', 5, makeKit('#da291c', W_, B_, B_), makeKit(W_, W_, W_, '#da291c'),
    { shape: 'shield', split: 'plain', cols: ['#da291c', '#da291c', '#fbe122'], rim: '#fbe122', emblem: 'trident', ec: '#fbe122', text: 'MANCHESTER', rc: '#fbe122' }),
  euroClub('merseysidered', 'Liverpool Reds', 'LIV', 'LIVERPOOL', 'england', 5, makeKit('#c8102e', '#c8102e', '#c8102e', W_), makeKit(W_, W_, W_, '#c8102e'),
    { shape: 'pointed', split: 'plain', cols: ['#c8102e', '#c8102e', '#f6eb61'], rim: '#00b2a9', emblem: 'bird', ec: '#f6eb61', text: 'LIVERPOOL', rc: '#00b2a9', rtc: W_ }),
  euroClub('northlondonred', 'North London Red', 'NLR', 'LONDON', 'england', 5, makeKit('#ef0107', W_, W_, W_, { sleeves: W_ }), makeKit('#023474', '#023474', '#023474', '#ef0107'),
    { shape: 'shield', split: 'plain', cols: ['#ef0107', '#ef0107', GD], rim: '#023474', emblem: 'cannon', ec: GD, text: 'NORTH LONDON', rc: GD }),
  euroClub('westlondonblue', 'West London Blue', 'WLB', 'LONDON', 'england', 4, makeKit('#034694', '#034694', W_, W_), makeKit(W_, W_, W_, '#034694'),
    { shape: 'round', split: 'plain', cols: ['#034694', '#034694', '#dba111'], rim: '#dba111', text: 'WEST LONDON', tc: '#034694', emblem: 'lion', ec: '#dba111' }),
  euroClub('northlondonwhite', 'London Lilywhites', 'NLW', 'LONDON', 'england', 4, makeKit(W_, '#132257', W_, '#132257'), makeKit('#132257', '#132257', '#132257', W_),
    { shape: 'shield', split: 'plain', cols: [W_, W_, '#132257'], rim: '#132257', emblem: 'cockerel', ec: '#132257', text: 'LONDON', rc: '#132257', rtc: W_ }),
  euroClub('tynesidestripes', 'Tyneside Magpies', 'TYN', 'NEWCASTLE', 'england', 4, makeKit(B_, B_, B_, W_, { stripes: W_ }), makeKit('#41b6e6', '#41b6e6', '#41b6e6', B_),
    { shape: 'round', split: 'vstripes', cols: [B_, W_, '#d6dbe4'], rim: B_, text: 'NEWCASTLE', tc: W_, emblem: 'castle', ec: '#d6dbe4', plate: '#41b6e6' }),
  euroClub('birminghamclaret', 'Birmingham Claret', 'BIR', 'BIRMINGHAM', 'england', 3, makeKit('#670e36', W_, '#95bfe5', '#95bfe5', { sleeves: '#95bfe5' }), makeKit(W_, W_, W_, '#670e36'),
    { shape: 'shield', split: 'plain', cols: ['#670e36', '#670e36', '#ffe14d'], rim: '#95bfe5', emblem: 'lion', ec: '#ffe14d', top: 'star', topc: '#ffe14d', text: 'BIRMINGHAM', rc: '#95bfe5' }),
  // Germany
  euroClub('munchenrot', 'Munich Red', 'MUN', 'MUNICH', 'germany', 5, makeKit('#dc052d', '#dc052d', '#dc052d', W_), makeKit(W_, W_, W_, '#dc052d'),
    { shape: 'round', split: 'lozenges', cols: ['#0066b2', W_, W_], rim: '#dc052d', text: 'MUNICH', tc: W_, emblem: 'none' }),
  euroClub('dortmundgelb', 'Dortmund Yellow', 'DOR', 'DORTMUND', 'germany', 4, makeKit('#fde100', B_, '#fde100', B_), makeKit(B_, B_, B_, '#fde100'),
    { shape: 'round', split: 'plain', cols: ['#fde100', '#fde100', B_], rim: B_, text: 'DORTMUND', tc: '#fde100', emblem: 'bolt', ec: B_ }),
  euroClub('leverkusenschwarzrot', 'Leverkusen Werkself', 'LEV', 'LEVERKUSEN', 'germany', 4, makeKit('#e32221', B_, B_, B_, { sleeves: B_ }), makeKit(W_, W_, W_, '#e32221'),
    { shape: 'shield', split: 'diag', cols: [B_, '#e32221', W_], rim: '#e32221', emblem: 'lion', ec: '#e32221', plate: W_, text: 'LEVERKUSEN', rc: B_, rtc: W_ }),
  euroClub('leipzigweiss', 'Leipzig Weiß', 'LEI', 'LEIPZIG', 'germany', 4, makeKit(W_, W_, W_, '#dd0741'), makeKit('#0c2043', '#0c2043', '#0c2043', '#dd0741'),
    { shape: 'badge', split: 'plain', cols: [W_, W_, '#dd0741'], rim: '#0c2043', emblem: 'bull', ec: '#dd0741', text: 'LEIPZIG', rc: '#dd0741', rtc: W_ }),
  euroClub('frankfurtadler', 'Frankfurt Eagles', 'FFM', 'FRANKFURT', 'germany', 3, makeKit(B_, B_, B_, '#e1000f'), makeKit(W_, W_, W_, '#e1000f'),
    { shape: 'round', split: 'plain', cols: [W_, W_, B_], rim: '#e1000f', text: 'FRANKFURT', tc: W_, emblem: 'eagle', ec: '#2a2b33' }),
  // Italy
  euroClub('milanorossonero', 'Milano Rossoneri', 'MIR', 'MILANO', 'italy', 5, makeKit('#fb090b', B_, B_, W_, { stripes: B_ }), makeKit(W_, W_, W_, '#fb090b'),
    { shape: 'oval', split: 'vstripes', cols: ['#fb090b', B_, W_], rim: W_, emblem: 'trident', ec: '#fb090b', plate: W_, text: 'MILANO', ribbon: false }),
  euroClub('milanonerazzurro', 'Milano Nerazzurri', 'MIN', 'MILANO', 'italy', 5, makeKit('#0068a8', B_, B_, GD, { stripes: B_ }), makeKit(W_, W_, W_, '#0068a8'),
    { shape: 'round', split: 'vstripes', cols: ['#0068a8', B_, GD], rim: GD, text: 'MILANO', tc: B_, emblem: 'snake', ec: '#3fcf4a', plate: W_ }),
  euroClub('torinobianconero', 'Torino Bianconeri', 'TOR', 'TORINO', 'italy', 5, makeKit(W_, B_, W_, B_, { stripes: B_ }), makeKit('#f2a7c3', B_, '#f2a7c3', B_),
    { shape: 'oval', split: 'vstripes', cols: [W_, B_, GD], rim: GD, top: 'stars3', emblem: 'none', text: 'TORINO', ribbon: true, rc: GD }),
  euroClub('napoliazzurro', 'Napoli Azzurri', 'NAP', 'NAPOLI', 'italy', 5, makeKit('#12a0d7', W_, '#12a0d7', W_), makeKit(W_, W_, W_, '#12a0d7'),
    { shape: 'round', split: 'plain', cols: ['#12a0d7', '#12a0d7', W_], rim: W_, text: 'NAPOLI', tc: '#12a0d7', emblem: 'volcano', ec: '#3b4a7a' }),
  euroClub('romagiallorosso', 'Roma Giallorossi', 'ROM', 'ROMA', 'italy', 4, makeKit('#8e1f2f', W_, B_, '#f0bc42'), makeKit(W_, W_, W_, '#8e1f2f'),
    { shape: 'french', split: 'plain', cols: ['#8e1f2f', '#8e1f2f', '#f0bc42'], rim: '#f0bc42', emblem: 'wolf', ec: '#f0bc42', text: 'ROMA', rc: '#f0bc42' }),
  euroClub('romabiancoceleste', 'Roma Biancocelesti', 'ROC', 'ROMA', 'italy', 4, makeKit('#87d8f7', W_, W_, NV), makeKit(NV, NV, NV, '#87d8f7'),
    { shape: 'shield', split: 'band', cols: ['#87d8f7', W_, GD], rim: W_, emblem: 'eagle', ec: GD, text: 'ROMA', rc: '#87d8f7' }),
  euroClub('bergamonerazzurro', 'Bergamo Nerazzurri', 'BGM', 'BERGAMO', 'italy', 4, makeKit('#1e71b8', B_, B_, W_, { stripes: B_ }), makeKit(W_, W_, W_, '#1e71b8'),
    { shape: 'round', split: 'vstripes', cols: ['#1e71b8', B_, GD], rim: B_, text: 'BERGAMO', tc: W_, emblem: 'laurel', ec: GD, plate: '#1e71b8' }),
  euroClub('firenzeviola', 'Firenze Viola', 'FIR', 'FIRENZE', 'italy', 3, makeKit('#5b2a86', W_, '#5b2a86', W_), makeKit(W_, W_, W_, '#5b2a86'),
    { shape: 'french', split: 'plain', cols: [W_, W_, '#d6001c'], rim: '#5b2a86', emblem: 'lily', ec: '#d6001c', text: 'FIRENZE', rc: '#5b2a86', rtc: W_ }),
  // France
  euroClub('parisbleu', 'Paris Bleu', 'PRS', 'PARIS', 'france', 5, makeKit('#0a1d4f', '#0a1d4f', '#0a1d4f', '#da291c', { center: '#da291c' }), makeKit(W_, W_, W_, '#0a1d4f'),
    { shape: 'round', split: 'plain', cols: ['#0a1d4f', '#0a1d4f', '#da291c'], rim: W_, text: 'PARIS', tc: '#0a1d4f', emblem: 'tower', ec: '#da291c' }),
  euroClub('marseilleciel', 'Marseille Olympians', 'MRS', 'MARSEILLE', 'france', 3, makeKit(W_, W_, W_, '#2faee0'), makeKit('#2faee0', '#2faee0', '#2faee0', W_),
    { shape: 'french', split: 'plain', cols: [W_, W_, '#2faee0'], rim: '#2faee0', top: 'star', topc: GD, emblem: 'wave', ec: '#2faee0', text: 'MARSEILLE', rc: '#2faee0', rtc: W_ }),
  euroClub('lyonrougebleu', 'Lyon Lions', 'LYO', 'LYON', 'france', 3, makeKit(W_, W_, W_, '#da0812', { sleeves: '#0b3d91' }), makeKit('#0b3d91', '#0b3d91', '#0b3d91', '#da0812'),
    { shape: 'round', split: 'diag', cols: ['#da0812', '#0b3d91', W_], rim: W_, text: 'LYON', tc: '#0b3d91', emblem: 'lion', ec: W_ }),
  euroClub('monacorouge', 'Monaco Rouge-Blanc', 'MON', 'MONACO', 'france', 4, makeKit(W_, W_, W_, '#e51b22', { diag: '#e51b22' }), makeKit(B_, B_, B_, '#e51b22'),
    { shape: 'shield', split: 'diag', cols: ['#e51b22', W_, GD], rim: GD, top: 'crown', emblem: 'none', text: 'MONACO', rc: W_ }),
  euroClub('lillerouge', 'Lille Dogues', 'LIL', 'LILLE', 'france', 3, makeKit('#e01e13', '#20325f', '#e01e13', W_), makeKit(W_, W_, W_, '#20325f'),
    { shape: 'round', split: 'plain', cols: ['#e01e13', '#e01e13', '#f2e6d0'], rim: '#20325f', text: 'LILLE', tc: W_, emblem: 'dog', ec: '#f2e6d0' }),
  // Portugal
  euroClub('lisboaencarnado', 'Lisboa Águias', 'LIS', 'LISBOA', 'portugal', 4, makeKit('#e20e0e', W_, '#e20e0e', W_), makeKit(B_, B_, B_, '#e20e0e'),
    { shape: 'round', split: 'plain', cols: ['#e20e0e', '#e20e0e', '#ffd23f'], rim: W_, text: 'LISBOA', tc: '#e20e0e', emblem: 'eagle', ec: '#ffd23f' }),
  euroClub('lisboaverde', 'Lisboa Leões', 'LSV', 'LISBOA', 'portugal', 4, makeKit(W_, B_, '#008057', '#008057', { hoops: '#008057' }), makeKit(B_, B_, B_, '#008057'),
    { shape: 'shield', split: 'hstripes', cols: ['#008057', W_, GD], rim: '#008057', top: 'crown', emblem: 'lion', ec: GD, plate: '#008057', text: 'LISBOA', rc: W_ }),
  euroClub('portodragao', 'Porto Dragões', 'OPO', 'PORTO', 'portugal', 4, makeKit(W_, '#003893', W_, '#003893', { stripes: '#1a5bb5' }), makeKit('#ff8a1f', B_, '#ff8a1f', B_),
    { shape: 'shield', split: 'quarters', cols: ['#003893', W_, GD], rim: '#003893', emblem: 'dragon', ec: GD, plate: '#003893', text: 'PORTO', rc: GD }),
  // the Netherlands
  euroClub('amsterdamroodwit', 'Amsterdam Rood-Wit', 'AMS', 'AMSTERDAM', 'netherlands', 4, makeKit(W_, W_, W_, '#d2122e', { center: '#d2122e' }), makeKit(NV, NV, NV, GD),
    { shape: 'round', split: 'cband', cols: ['#d2122e', B_, W_], rim: W_, text: 'AMSTERDAM', tc: '#d2122e', emblem: 'crosses3', ec: W_ }),
  euroClub('eindhovenrood', 'Eindhoven Rood', 'EIN', 'EINDHOVEN', 'netherlands', 3, makeKit('#ed1c24', B_, W_, W_, { stripes: W_ }), makeKit(B_, B_, B_, '#ed1c24'),
    { shape: 'shield', split: 'vstripes', cols: ['#ed1c24', W_, '#ffd23f'], rim: B_, emblem: 'bolt', ec: '#ffd23f', plate: B_, text: 'EINDHOVEN', rc: W_ }),
  euroClub('rotterdamhaven', 'Rotterdam Haven', 'ROT', 'ROTTERDAM', 'netherlands', 3, makeKit(W_, B_, B_, B_, { halves: '#e1000f' }), makeKit(B_, B_, B_, '#e1000f'),
    { shape: 'shield', split: 'halves', cols: ['#e1000f', W_, B_], rim: B_, emblem: 'anchor', ec: '#2a2b33', text: 'ROTTERDAM', rc: W_ }),
  // Scotland
  euroClub('glasgowhoops', 'Glasgow Hoops', 'GLH', 'GLASGOW', 'scotland', 3, makeKit(W_, W_, W_, '#018749', { hoops: '#018749' }), makeKit('#ffd23f', B_, '#ffd23f', B_),
    { shape: 'round', split: 'hstripes', cols: ['#018749', W_, '#018749'], rim: '#018749', text: 'GLASGOW', tc: W_, emblem: 'shamrock', ec: '#018749', plate: W_ }),
  euroClub('glasgowblues', 'Glasgow Blues', 'GLB', 'GLASGOW', 'scotland', 3, makeKit('#1b458f', W_, B_, '#ce1126'), makeKit(W_, W_, W_, '#1b458f'),
    { shape: 'round', split: 'plain', cols: ['#1b458f', '#1b458f', '#ce1126'], rim: W_, text: 'GLASGOW', tc: '#1b458f', emblem: 'lion', ec: '#ce1126' }),
  // Türkiye
  euroClub('istanbulaslan', 'Istanbul Aslan', 'IAS', 'ISTANBUL', 'turkey', 4, makeKit('#a90432', '#a90432', '#a90432', '#fdb912', { halves: '#fdb912' }), makeKit(W_, W_, W_, '#a90432'),
    { shape: 'round', split: 'halves', cols: ['#fdb912', '#a90432', W_], rim: '#a90432', text: 'ISTANBUL', tc: '#fdb912', emblem: 'lion', ec: '#ffc21a', plate: '#a90432' }),
  euroClub('istanbulkanarya', 'Istanbul Kanarya', 'IKN', 'ISTANBUL', 'turkey', 3, makeKit('#fff200', W_, '#fff200', '#002d72', { stripes: '#002d72' }), makeKit('#002d72', '#002d72', '#002d72', '#fff200'),
    { shape: 'round', split: 'plain', cols: ['#002d72', '#002d72', '#fff200'], rim: '#fff200', text: 'ISTANBUL', tc: '#002d72', emblem: 'bird', ec: '#fff200' }),
  euroClub('istanbulkartal', 'Istanbul Kartal', 'IKR', 'ISTANBUL', 'turkey', 3, makeKit(W_, B_, B_, B_), makeKit(B_, B_, B_, W_),
    { shape: 'shield', split: 'vstripes', cols: [B_, W_, '#e30a17'], rim: B_, emblem: 'eagle', ec: '#2a2b33', plate: W_, text: 'ISTANBUL', rc: '#e30a17', rtc: W_ }),
  // Belgium
  euroClub('bruggeblauwzwart', 'Brugge Blauw-Zwart', 'BRU', 'BRUGGE', 'belgium', 3, makeKit('#0068b2', B_, B_, B_, { stripes: B_ }), makeKit(W_, W_, W_, '#0068b2'),
    { shape: 'badge', split: 'vstripes', cols: ['#0068b2', B_, GD], rim: GD, emblem: 'lion', ec: GD, plate: B_, text: 'BRUGGE', rc: W_ }),
  euroClub('brusselmauve', 'Brussel Mauve', 'BXL', 'BRUSSEL', 'belgium', 3, makeKit('#4c2a85', W_, W_, W_), makeKit(W_, '#4c2a85', W_, '#4c2a85'),
    { shape: 'round', split: 'plain', cols: ['#4c2a85', '#4c2a85', GD], rim: W_, text: 'BRUSSEL', tc: '#4c2a85', emblem: 'crown', ec: GD }),
  // and five more
  euroClub('salzburgweiss', 'Salzburg Weiß', 'SAL', 'SALZBURG', 'austria', 3, makeKit(W_, '#d1003f', W_, '#d1003f'), makeKit('#d1003f', '#d1003f', '#d1003f', W_),
    { shape: 'hex', split: 'plain', cols: [W_, W_, '#d1003f'], rim: '#d1003f', emblem: 'peak', ec: '#d1003f', text: 'SALZBURG', rc: '#d1003f', rtc: W_ }),
  euroClub('donetskorange', 'Donetsk Miners', 'DON', 'DONETSK', 'ukraine', 3, makeKit('#f68b1f', B_, '#f68b1f', B_, { stripes: B_ }), makeKit(W_, W_, W_, '#f68b1f'),
    { shape: 'round', split: 'vstripes', cols: ['#f68b1f', B_, '#b8bfcc'], rim: B_, text: 'DONETSK', tc: '#f68b1f', emblem: 'hammers', ec: '#b8bfcc', plate: B_ }),
  euroClub('zagrebplavi', 'Zagreb Plavi', 'ZAG', 'ZAGREB', 'croatia', 2, makeKit('#0b4ea2', '#0b4ea2', '#0b4ea2', W_), makeKit(W_, W_, W_, '#0b4ea2'),
    { shape: 'round', split: 'plain', cols: ['#0b4ea2', '#0b4ea2', W_], rim: W_, text: 'ZAGREB', tc: '#0b4ea2', emblem: 'checkshield' }),
  euroClub('beogradcrveni', 'Beograd Crveni', 'BEO', 'BEOGRAD', 'serbia', 3, makeKit('#e10a17', W_, W_, W_, { stripes: W_ }), makeKit(NV, NV, NV, '#e10a17'),
    { shape: 'shield', split: 'vstripes', cols: ['#e10a17', W_, '#e10a17'], rim: NV, emblem: 'star', ec: '#e10a17', plate: W_, text: 'BEOGRAD', rc: W_ }),
  euroClub('piraeusreds', 'Piraeus Reds', 'PIR', 'PIRAEUS', 'greece', 3, makeKit('#e2001a', W_, '#e2001a', W_, { hoops: W_ }), makeKit(W_, W_, W_, '#e2001a'),
    { shape: 'round', split: 'plain', cols: ['#e2001a', '#e2001a', W_], rim: W_, text: 'PIRAEUS', tc: '#e2001a', emblem: 'laurel', ec: W_ }),

  // ===== build 116: fifty more of the best clubs in the world right now =====
  // (the same rules: the city, the nickname fans use, the colours and the symbol everyone knows)
  // England
  euroClub('brightonseagull', 'Brighton Seagulls', 'BHA', 'BRIGHTON', 'england', 4, makeKit('#0057b8', W_, W_, W_, { stripes: W_ }), makeKit('#ffcd00', '#0057b8', '#ffcd00', '#0057b8'),
    { shape: 'round', split: 'plain', cols: ['#0057b8', '#0057b8', W_], rim: W_, text: 'BRIGHTON', tc: '#0057b8', emblem: 'bird', ec: W_ }),
  euroClub('eastlondonirons', 'East London Irons', 'ELI', 'LONDON', 'england', 4, makeKit('#7a263a', W_, W_, '#1bb1e7', { sleeves: '#1bb1e7' }), makeKit(W_, W_, W_, '#7a263a'),
    { shape: 'shield', split: 'plain', cols: ['#7a263a', '#7a263a', '#1bb1e7'], rim: '#1bb1e7', emblem: 'hammers', ec: '#f3d459', text: 'EAST LONDON', rc: '#1bb1e7' }),
  euroClub('merseysideblue', 'Merseyside Blues', 'MSB', 'LIVERPOOL', 'england', 4, makeKit('#003399', W_, W_, W_), makeKit('#f5c518', '#003399', '#f5c518', '#003399'),
    { shape: 'shield', split: 'plain', cols: ['#003399', '#003399', W_], rim: W_, emblem: 'tower', ec: W_, text: 'MERSEYSIDE', rc: W_, rtc: '#003399' }),
  euroClub('southlondoneagles', 'South London Eagles', 'SLE', 'LONDON', 'england', 3, makeKit('#1b458f', '#1b458f', '#1b458f', '#c4122e', { stripes: '#c4122e' }), makeKit(W_, W_, W_, '#c4122e'),
    { shape: 'round', split: 'vstripes', cols: ['#1b458f', '#c4122e', W_], rim: '#1b458f', text: 'SOUTH LONDON', tc: W_, emblem: 'eagle', ec: W_, plate: '#1b458f' }),
  euroClub('nottinghamreds', 'Nottingham Reds', 'NTR', 'NOTTINGHAM', 'england', 3, makeKit('#dd0000', W_, '#dd0000', W_), makeKit(W_, B_, W_, '#dd0000'),
    { shape: 'badge', split: 'plain', cols: ['#dd0000', '#dd0000', W_], rim: W_, emblem: 'tree', ec: W_, text: 'NOTTINGHAM', rc: W_, rtc: '#dd0000' }),
  euroClub('wolverhamptongold', 'Wolverhampton Gold', 'WOL', 'WOLVERHAMPTON', 'england', 3, makeKit('#fdb913', B_, B_, B_), makeKit(B_, B_, B_, '#fdb913'),
    { shape: 'shield', split: 'plain', cols: [B_, B_, '#fdb913'], rim: '#fdb913', emblem: 'wolf', ec: '#fdb913', text: 'WOLVERHAMPTON', rc: '#fdb913' }),
  euroClub('bournemouthcherry', 'Bournemouth Cherries', 'BOU', 'BOURNEMOUTH', 'england', 3, makeKit('#da291c', B_, B_, B_, { stripes: B_ }), makeKit(W_, W_, W_, '#da291c'),
    { shape: 'badge', split: 'vstripes', cols: ['#da291c', B_, W_], rim: B_, emblem: 'ball', ec: W_, plate: '#da291c', text: 'BOURNEMOUTH', rc: '#da291c', rtc: W_ }),
  euroClub('fulhamwhites', 'Fulham Whites', 'FUL', 'LONDON', 'england', 3, makeKit(W_, B_, W_, B_), makeKit(B_, W_, B_, W_),
    { shape: 'shield', split: 'plain', cols: [W_, W_, B_], rim: B_, emblem: 'ball', ec: B_, text: 'FULHAM', rc: B_, rtc: W_ }),
  // Spain
  euroClub('donostiatxuri', 'Donostia Txuri-Urdin', 'DTX', 'SAN SEBASTIÁN', 'spain', 4, makeKit('#0067b1', W_, W_, W_, { stripes: W_ }), makeKit('#f6d20e', '#0067b1', '#f6d20e', '#0067b1'),
    { shape: 'round', split: 'plain', cols: ['#0067b1', '#0067b1', GD], rim: GD, text: 'DONOSTIA', tc: '#0067b1', top: 'crown', emblem: 'ball', ec: W_ }),
  euroClub('sevillaverdiblanco', 'Sevilla Verdiblancos', 'SVB', 'SEVILLA', 'spain', 4, makeKit('#00954c', W_, W_, W_, { stripes: W_ }), makeKit(W_, '#00954c', W_, '#00954c'),
    { shape: 'shield', split: 'vstripes', cols: ['#00954c', W_, GD], rim: '#00954c', top: 'crown', topc: GD, emblem: 'none', text: 'SEVILLA', rc: '#00954c', rtc: W_ }),
  euroClub('valenciamurcielago', 'Valencia Murciélagos', 'VAL', 'VALENCIA', 'spain', 4, makeKit(W_, B_, B_, '#ee3524'), makeKit(B_, B_, B_, '#f5b700'),
    { shape: 'round', split: 'vstripes', cols: ['#f5b700', '#ee3524', B_], rim: B_, text: 'VALENCIA', tc: '#f5b700', emblem: 'bat', ec: B_, plate: W_ }),
  euroClub('gironaalbirroja', 'Girona Albirrojos', 'GIR', 'GIRONA', 'spain', 3, makeKit('#e30613', W_, W_, W_, { stripes: W_ }), makeKit('#1b2a5a', '#1b2a5a', '#1b2a5a', '#e30613'),
    { shape: 'shield', split: 'vstripes', cols: ['#e30613', W_, GD], rim: GD, emblem: 'castle', ec: GD, plate: '#e30613', text: 'GIRONA', rc: GD }),
  euroClub('vigoceleste', 'Vigo Celestes', 'VIG', 'VIGO', 'spain', 3, makeKit('#8ac3ee', W_, '#8ac3ee', '#e5254e'), makeKit('#e5254e', '#e5254e', '#e5254e', W_),
    { shape: 'shield', split: 'plain', cols: ['#8ac3ee', '#8ac3ee', '#e5254e'], rim: '#e5254e', emblem: 'cross', ec: '#e5254e', top: 'crown', topc: GD, text: 'VIGO', rc: '#e5254e', rtc: W_ }),
  // Germany
  euroClub('stuttgartweissrot', 'Stuttgart Weiß-Rot', 'STU', 'STUTTGART', 'germany', 4, makeKit(W_, W_, W_, '#e32219', { band: '#e32219' }), makeKit('#e32219', '#e32219', '#e32219', W_),
    { shape: 'shield', split: 'band', cols: [W_, '#e32219', '#ffd200'], rim: '#e32219', emblem: 'stag', ec: '#ffd200', plate: '#e32219', text: 'STUTTGART', rc: '#e32219', rtc: W_ }),
  euroClub('wolfsburgwolf', 'Wolfsburg Wölfe', 'WOB', 'WOLFSBURG', 'germany', 3, makeKit('#65b32e', W_, '#65b32e', W_), makeKit(W_, W_, W_, '#65b32e'),
    { shape: 'round', split: 'plain', cols: ['#65b32e', '#65b32e', W_], rim: W_, text: 'WOLFSBURG', tc: '#65b32e', emblem: 'wolf', ec: W_ }),
  euroClub('gladbachfohlen', 'Gladbach Fohlen', 'GLA', 'MÖNCHENGLADBACH', 'germany', 3, makeKit(W_, B_, W_, '#00a651'), makeKit(B_, B_, B_, '#00a651'),
    { shape: 'diamond', split: 'plain', cols: [W_, W_, '#00a651'], rim: B_, emblem: 'horse', ec: '#00a651' }),
  euroClub('freiburgbreisgau', 'Freiburg Breisgau', 'FRE', 'FREIBURG', 'germany', 3, makeKit('#e3001b', B_, B_, W_), makeKit(W_, W_, W_, '#e3001b'),
    { shape: 'shield', split: 'plain', cols: ['#e3001b', '#e3001b', W_], rim: B_, emblem: 'peak', ec: '#2d6a2f', text: 'FREIBURG', rc: W_, rtc: '#e3001b' }),
  // Italy
  euroClub('bolognarossoblu', 'Bologna Rossoblù', 'BLG', 'BOLOGNA', 'italy', 3, makeKit('#a6192e', NV, W_, NV, { stripes: '#1a2f6e' }), makeKit(W_, W_, W_, '#a6192e'),
    { shape: 'shield', split: 'halves', cols: ['#a6192e', '#1a2f6e', W_], rim: W_, emblem: 'tower', ec: W_, text: 'BOLOGNA', rc: W_, rtc: '#a6192e' }),
  euroClub('torinogranata', 'Torino Granata', 'TOG', 'TORINO', 'italy', 3, makeKit('#8a1538', W_, '#8a1538', W_), makeKit(W_, '#8a1538', W_, '#8a1538'),
    { shape: 'oval', split: 'plain', cols: ['#8a1538', '#8a1538', GD], rim: GD, emblem: 'bull', ec: GD, text: 'TORINO', rc: GD }),
  euroClub('comolariani', 'Como Lariani', 'COM', 'COMO', 'italy', 3, makeKit('#1c4e9d', W_, '#1c4e9d', W_), makeKit(W_, W_, W_, '#1c4e9d'),
    { shape: 'round', split: 'plain', cols: ['#1c4e9d', '#1c4e9d', W_], rim: W_, text: 'COMO', tc: '#1c4e9d', emblem: 'wave', ec: W_ }),
  // France
  euroClub('niceaiglons', 'Nice Aiglons', 'NIC', 'NICE', 'france', 3, makeKit('#c8102e', B_, B_, B_, { stripes: B_ }), makeKit(W_, W_, W_, '#c8102e'),
    { shape: 'french', split: 'vstripes', cols: ['#c8102e', B_, W_], rim: B_, emblem: 'eagle', ec: W_, plate: B_, text: 'NICE', rc: '#c8102e', rtc: W_ }),
  euroClub('lenssangetor', 'Lens Sang et Or', 'LEN', 'LENS', 'france', 3, makeKit('#fee300', '#e2001a', '#fee300', '#e2001a', { sleeves: '#e2001a' }), makeKit(B_, B_, B_, '#fee300'),
    { shape: 'shield', split: 'halves', cols: ['#fee300', '#e2001a', B_], rim: B_, emblem: 'peak', ec: B_, text: 'LENS', rc: '#fee300' }),
  euroClub('rennesrougenoir', 'Rennes Rouge-Noir', 'REN', 'RENNES', 'france', 3, makeKit('#e13327', B_, B_, B_), makeKit(W_, W_, W_, '#e13327'),
    { shape: 'shield', split: 'topband', cols: ['#e13327', B_, W_], alt: B_, rim: B_, emblem: 'star', ec: W_, text: 'RENNES', rc: '#e13327', rtc: W_ }),
  // the Netherlands and Portugal
  euroClub('alkmaarkaaskop', 'Alkmaar Kaaskoppen', 'ALK', 'ALKMAAR', 'netherlands', 3, makeKit('#db0021', W_, '#db0021', W_), makeKit(W_, W_, W_, '#db0021'),
    { shape: 'shield', split: 'plain', cols: ['#db0021', '#db0021', W_], rim: W_, emblem: 'castle', ec: W_, text: 'ALKMAAR', rc: W_, rtc: '#db0021' }),
  euroClub('bragaguerreiro', 'Braga Guerreiros', 'BRG', 'BRAGA', 'portugal', 3, makeKit('#d4001c', W_, W_, W_, { sleeves: W_ }), makeKit(W_, '#d4001c', W_, '#d4001c'),
    { shape: 'shield', split: 'plain', cols: ['#d4001c', '#d4001c', GD], rim: GD, emblem: 'tower', ec: GD, top: 'crown', topc: GD, text: 'BRAGA', rc: GD }),
  // the rest of Europe
  euroClub('kobenhavnlove', 'København Løverne', 'KBH', 'KØBENHAVN', 'denmark', 3, makeKit(W_, W_, W_, '#0a2240'), makeKit('#0a2240', '#0a2240', '#0a2240', W_),
    { shape: 'round', split: 'plain', cols: ['#0a2240', '#0a2240', W_], rim: W_, text: 'KØBENHAVN', tc: '#0a2240', emblem: 'lion', ec: W_ }),
  euroClub('berngelbschwarz', 'Bern Gelb-Schwarz', 'BRN', 'BERN', 'switzerland', 3, makeKit('#ffe100', B_, B_, B_), makeKit(B_, B_, B_, '#ffe100'),
    { shape: 'round', split: 'plain', cols: ['#ffe100', '#ffe100', B_], rim: B_, text: 'BERN', tc: '#ffe100', emblem: 'bear', ec: B_ }),
  euroClub('prahastar', 'Praha Star', 'PHS', 'PRAHA', 'czechia', 3, makeKit(W_, W_, W_, '#d7141a', { halves: '#d7141a' }), makeKit('#d7141a', '#d7141a', '#d7141a', W_),
    { shape: 'round', split: 'halves', cols: [W_, '#d7141a', '#d7141a'], rim: '#d7141a', text: 'PRAHA', tc: W_, emblem: 'star', ec: '#d7141a', plate: W_ }),
  euroClub('praharudi', 'Praha Rudí', 'PRR', 'PRAHA', 'czechia', 3, makeKit('#a6192e', W_, B_, W_), makeKit(W_, W_, W_, '#a6192e'),
    { shape: 'shield', split: 'plain', cols: ['#a6192e', '#a6192e', GD], rim: GD, emblem: 'lion', ec: GD, text: 'PRAHA', rc: GD }),
  euroClub('budapestzold', 'Budapest Zöld-Fehér', 'BUD', 'BUDAPEST', 'hungary', 3, makeKit('#009a44', W_, W_, W_, { stripes: W_ }), makeKit(W_, W_, W_, '#009a44'),
    { shape: 'round', split: 'vstripes', cols: ['#009a44', W_, W_], rim: '#009a44', text: 'BUDAPEST', tc: W_, emblem: 'eagle', ec: '#009a44', plate: W_ }),
  // Brazil
  euroClub('riorubronegro', 'Rio Rubro-Negro', 'RRN', 'RIO DE JANEIRO', 'brazil', 5, makeKit('#c8102e', W_, W_, B_, { hoops: B_ }), makeKit(W_, W_, W_, '#c8102e'),
    { shape: 'shield', split: 'hstripes', cols: ['#c8102e', B_, W_], rim: B_, emblem: 'bird', ec: B_, plate: W_, top: 'star', topc: '#ffc21a' }),
  euroClub('saopauloverdao', 'São Paulo Verdão', 'SPV', 'SÃO PAULO', 'brazil', 5, makeKit('#006437', W_, W_, W_), makeKit(W_, W_, W_, '#006437'),
    { shape: 'round', split: 'plain', cols: ['#006437', '#006437', W_], rim: W_, text: 'SÃO PAULO', tc: '#006437', emblem: 'laurel', ec: W_ }),
  euroClub('saopaulotimao', 'São Paulo Timão', 'SPT', 'SÃO PAULO', 'brazil', 4, makeKit(W_, B_, W_, B_), makeKit(B_, B_, B_, W_),
    { shape: 'round', split: 'plain', cols: [W_, W_, B_], rim: B_, text: 'SÃO PAULO', tc: W_, emblem: 'anchor', ec: W_, plate: '#d32f2f' }),
  euroClub('saopaulotricolor', 'São Paulo Tricolor', 'SPC', 'SÃO PAULO', 'brazil', 4, makeKit(W_, W_, W_, '#d6001c', { band: '#d6001c' }), makeKit('#d6001c', W_, '#d6001c', B_, { stripes: B_ }),
    { shape: 'pointed', split: 'halves', cols: ['#d6001c', B_, W_], rim: W_, emblem: 'star', ec: W_, top: 'stars3', topc: '#ffc21a' }),
  euroClub('santospeixe', 'Santos Peixe', 'SNT', 'SANTOS', 'brazil', 4, makeKit(W_, W_, W_, B_), makeKit(B_, W_, B_, W_, { stripes: W_ }),
    { shape: 'shield', split: 'vstripes', cols: [B_, W_, W_], rim: B_, emblem: 'fish', ec: W_, plate: B_, text: 'SANTOS', rc: W_, rtc: B_ }),
  euroClub('riotricolor', 'Rio Tricolor', 'RTC', 'RIO DE JANEIRO', 'brazil', 4, makeKit('#7a1e3a', W_, W_, '#00613c', { stripes: '#00613c' }), makeKit(W_, W_, W_, '#7a1e3a'),
    { shape: 'shield', split: 'vstripes', cols: ['#7a1e3a', '#00613c', W_], rim: W_, emblem: 'laurel', ec: W_, text: 'RIO', rc: W_, rtc: '#7a1e3a' }),
  euroClub('rioestrela', 'Rio Estrela', 'RES', 'RIO DE JANEIRO', 'brazil', 4, makeKit(B_, B_, B_, W_, { stripes: W_ }), makeKit(W_, W_, W_, B_),
    { shape: 'shield', split: 'plain', cols: [B_, B_, W_], rim: W_, emblem: 'star', ec: W_, text: 'RIO', rc: W_, rtc: B_ }),
  euroClub('belohorizontegalo', 'Belo Horizonte Galo', 'BHG', 'BELO HORIZONTE', 'brazil', 4, makeKit(W_, B_, W_, B_, { stripes: B_ }), makeKit(B_, B_, B_, W_),
    { shape: 'shield', split: 'vstripes', cols: [B_, W_, GD], rim: GD, emblem: 'cockerel', ec: W_, plate: B_, top: 'star', topc: GD }),
  // Argentina
  euroClub('labocaxeneize', 'La Boca Xeneizes', 'LBX', 'BUENOS AIRES', 'argentina', 5, makeKit('#103f79', '#103f79', '#103f79', '#f3b229', { band: '#f3b229' }), makeKit(W_, '#103f79', W_, '#f3b229', { band: '#103f79' }),
    { shape: 'oval', split: 'band', cols: ['#103f79', '#f3b229', W_], rim: '#f3b229', top: 'stars3', topc: '#f3b229', emblem: 'none' }),
  euroClub('nunezmillonario', 'Núñez Millonarios', 'NUM', 'BUENOS AIRES', 'argentina', 5, makeKit(W_, B_, W_, '#e30613', { sash: '#e30613' }), makeKit('#e30613', B_, '#e30613', W_),
    { shape: 'french', split: 'sash', cols: [W_, '#e30613', '#e30613'], rim: B_, emblem: 'none', text: 'NÚÑEZ', rc: '#e30613', rtc: W_ }),
  // Saudi Arabia
  euroClub('riyadhzaeem', 'Riyadh Al-Zaeem', 'RZM', 'RIYADH', 'saudiarabia', 4, makeKit('#1a54a6', W_, W_, W_), makeKit(W_, '#1a54a6', W_, '#1a54a6'),
    { shape: 'round', split: 'plain', cols: ['#1a54a6', '#1a54a6', W_], rim: W_, text: 'RIYADH', tc: '#1a54a6', emblem: 'wave', ec: W_ }),
  euroClub('riyadhalami', 'Riyadh Al-Alami', 'RAA', 'RIYADH', 'saudiarabia', 4, makeKit('#fde100', '#1d3e90', '#fde100', '#1d3e90'), makeKit('#1d3e90', W_, '#1d3e90', '#fde100'),
    { shape: 'shield', split: 'plain', cols: ['#fde100', '#fde100', '#1d3e90'], rim: '#1d3e90', emblem: 'star', ec: '#1d3e90', text: 'RIYADH', rc: '#1d3e90', rtc: '#fde100' }),
  euroClub('jeddahtigers', 'Jeddah Tigers', 'JDT', 'JEDDAH', 'saudiarabia', 4, makeKit('#fcdd09', B_, B_, B_, { stripes: B_ }), makeKit(W_, W_, W_, B_),
    { shape: 'oval', split: 'vstripes', cols: ['#fcdd09', B_, B_], rim: B_, emblem: 'lion', ec: '#f28c28', plate: B_ }),
  euroClub('jeddahroyals', 'Jeddah Royals', 'JDR', 'JEDDAH', 'saudiarabia', 4, makeKit('#00843d', W_, W_, W_), makeKit(W_, '#00843d', W_, '#00843d'),
    { shape: 'round', split: 'plain', cols: ['#00843d', '#00843d', GD], rim: W_, text: 'JEDDAH', tc: '#00843d', emblem: 'crown', ec: GD }),
  // the USA and Mexico
  euroClub('miamiherons', 'Miami Herons', 'MIA', 'MIAMI', 'usa', 4, makeKit('#f7b5cd', B_, '#f7b5cd', B_), makeKit(B_, B_, B_, '#f7b5cd'),
    { shape: 'round', split: 'plain', cols: [W_, W_, B_], rim: B_, text: 'MIAMI', tc: '#f7b5cd', emblem: 'bird', ec: '#f7b5cd' }),
  euroClub('losangelesstars', 'Los Angeles Stars', 'LAS', 'LOS ANGELES', 'usa', 3, makeKit(W_, W_, W_, '#00245d', { sash: '#00245d' }), makeKit('#00245d', '#00245d', '#00245d', '#ffd200'),
    { shape: 'badge', split: 'sash', cols: ['#00245d', '#ffd200', W_], rim: '#ffd200', emblem: 'star', ec: W_, text: 'LOS ANGELES', rc: '#ffd200' }),
  euroClub('lablackgold', 'LA Black-Gold', 'LBG', 'LOS ANGELES', 'usa', 3, makeKit(B_, B_, B_, '#c39e6d'), makeKit(W_, W_, W_, '#c39e6d'),
    { shape: 'shield', split: 'plain', cols: [B_, B_, '#c39e6d'], rim: '#c39e6d', emblem: 'eagle', ec: '#c39e6d', text: 'LOS ANGELES', rc: '#c39e6d' }),
  euroClub('mexicoaguilas', 'México Águilas', 'MXA', 'CIUDAD DE MÉXICO', 'mexico', 4, makeKit('#ffd200', '#1b2a5a', '#ffd200', '#1b2a5a'), makeKit('#1b2a5a', '#1b2a5a', '#1b2a5a', '#ffd200'),
    { shape: 'round', split: 'plain', cols: ['#ffd200', '#ffd200', '#1b2a5a'], rim: '#1b2a5a', text: 'MÉXICO', tc: '#ffd200', emblem: 'eagle', ec: '#1b2a5a' }),
  euroClub('monterreyrayados', 'Monterrey Rayados', 'MTY', 'MONTERREY', 'mexico', 4, makeKit('#14215a', W_, '#14215a', W_, { stripes: W_ }), makeKit(W_, W_, W_, '#14215a'),
    { shape: 'shield', split: 'vstripes', cols: ['#14215a', W_, W_], rim: '#14215a', emblem: 'peak', ec: '#14215a', plate: W_, text: 'MONTERREY', rc: '#14215a', rtc: W_ }),
  // Egypt
  euroClub('cairoreds', 'Cairo Reds', 'CAI', 'CAIRO', 'egypt', 4, makeKit('#e30613', W_, '#e30613', W_), makeKit(W_, W_, W_, '#e30613'),
    { shape: 'round', split: 'plain', cols: ['#e30613', '#e30613', W_], rim: GD, text: 'CAIRO', tc: '#e30613', emblem: 'eagle', ec: W_ }),
];
const EURO_IDS = new Set(EURO_CLUBS.map((c) => c.id));
const isEuro = (id) => EURO_IDS.has(typeof id === 'string' ? id : id && id.id);

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
  // a country or a club: everything that draws a team takes either
  get(id) { return CLUBS.find((c) => c.id === id) || EURO_CLUBS.find((c) => c.id === id) || CLUBS[0]; },
  valid(id) { return CLUBS.some((c) => c.id === id) || EURO_IDS.has(id); },
  // Club Career is switched on (Save.data.arena 'club') and there is a club you play for
  clubMode() { return typeof Save !== 'undefined' && !!Save.data && Save.data.arena === 'club' && !!this.career(); },
  career() { const c = typeof Save !== 'undefined' && Save.data && Save.data.cc; return c && EURO_IDS.has(c.club) ? EURO_CLUBS.find((x) => x.id === c.club) : null; },
  // the country your account plays for (the league, the World Cup), whichever side you are on
  country() { return CLUBS.find((c) => c.id === ((typeof Save !== 'undefined' && Save.data && Save.data.club) || DEFAULT_CLUB)) || CLUBS[0]; },
  // who you are on the pitch right now: your club in Club Career, otherwise your country
  mine() { return (this.clubMode() && this.career()) || this.country(); },
  // the teams there are to play against right now: the clubs in Club Career, otherwise the countries
  pool() { return this.clubMode() ? EURO_CLUBS : CLUBS; },
  random(...except) { const ids = new Set(except.filter(Boolean).map((c) => typeof c === 'string' ? c : c.id)); const all = this.pool(); const pool = all.filter((c) => !ids.has(c.id)); return pick(pool.length ? pool : all); },

  // Kits for two clubs on one pitch: the home side wears its home kit, the away side
  // switches to its away kit when the two would be hard to tell apart.
  kitsFor(home, away) {
    const hk = home.home;
    let ak = away.home;
    // (a second colour over half the shirt counts as much as the shirt itself)
    const second = (k) => k.halves || k.diag || k.hoops || null;
    const clash = (a, b) => colorDist(a.jersey, b.jersey) < 110 || (a.stripes && b.stripes && colorDist(a.stripes, b.stripes) < 110) || (a.checks && b.checks)
      || (second(a) && colorDist(second(a), b.jersey) < 110) || (second(b) && colorDist(second(b), a.jersey) < 110)
      || (second(a) && second(b) && colorDist(second(a), second(b)) < 110);
    if (home.id === away.id || clash(hk, ak)) ak = away.away;
    if (clash(hk, ak)) ak = colorLum(hk.jersey) > 0.5 ? makeKit(B_, B_, B_, W_) : makeKit(W_, W_, W_, B_);
    // keepers: the colour furthest from both outfield kits, and not the same as each other
    const extra = (k, c) => Math.min(...['stripes', 'checks', 'sleeves', 'hoops', 'halves', 'diag', 'center', 'band', 'sash'].map((x) => (k[x] ? colorDist(c, k[x]) : 999)));
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
      for (const key of ['stripes', 'sleeves', 'center', 'checks', 'hoops', 'halves', 'diag', 'band', 'sash', 'hi']) delete TEAMS[slot][key];
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

if (typeof module !== 'undefined') module.exports = { CLUBS, EURO_CLUBS, DEFAULT_CLUB, countryFor };
