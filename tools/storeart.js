// The Google Play pictures, drawn by the game itself: the feature graphic (1024x500) and two
// screenshots (1920x1080). Nothing is a mock-up: the football is a real autopilot match and the
// shootout is the real Pens screen, drawn by the real Render code at the store's own sizes, with
// the captions in the game's voice (solid fill, thick outline, one hard shadow; tools/trailer).
//
//   1. node tools/storeart-save.js "<out folder>" 8471 http://localhost:<port>
//   2. in the game's page on that port, load tools/trailer/mp4.js, tools/trailer/director.js and this,
//      then: await StoreArt.run()
// Each picture goes to the saver as plain red/green/blue pixels and is written as a 24-bit PNG.
// (var, so the page can load this again after an edit; a second `const` would fail without a word)
var StoreArt = {
  SAVER: 'http://127.0.0.1:8471',
  INK: '#161a33',

  // the film's size for this picture (the game draws to whatever size it is handed)
  size(w, h) { Trailer.W = w; Trailer.H = h; Trailer.fit(); Pens._lay = null; },

  async save(name) {
    const cv = Render.canvas, w = cv.width, h = cv.height;
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
    const r = await fetch(`${this.SAVER}/save?name=${name}&w=${w}&h=${h}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: rgb });
    if (!r.ok) throw new Error(name + ': ' + r.status + ' ' + (await r.text()));
    return name;
  },

  // how tall the caption band is: the game is drawn in the space above it, so nothing hides behind it
  bandH() { return Math.round(Trailer.H * 0.17); },

  // the name, the way the game's logo sets it: "Mini" in yellow, "Strikers" in white, tilted a touch
  logo(cx, cy, size) {
    const T = Trailer, g = T.ui();
    g.save();
    g.font = `${size}px 'Lilita One', system-ui, sans-serif`;
    const a = g.measureText('Mini').width, b = g.measureText('Strikers').width, gap = size * 0.24, w = a + gap + b;
    g.translate(cx, cy); g.rotate(-0.045);
    T.say('Mini', -w / 2 + a / 2, 0, size, T.YELLOW);
    T.say('Strikers', -w / 2 + a + gap + b / 2, 0, size, T.WHITE);
    g.restore();
  },

  // a band across the bottom, like the game's own panels: flat ink, a yellow edge, the words on it
  banner(title, sub, color) {
    const T = Trailer, g = T.ui(), W = T.W, H = T.H, bh = this.bandH();
    g.fillStyle = this.INK; g.fillRect(0, H - bh, W, bh);
    g.fillStyle = '#ffe14d'; g.fillRect(0, H - bh, W, Math.round(H * 0.008));
    T.say(title, W / 2, H - bh * (sub ? 0.6 : 0.48), Math.round(H * 0.085), color);
    if (sub) T.say(sub, W / 2, H - bh * 0.22, Math.round(H * 0.037), '#ffffff');
  },

  // a player as the menus draw them, big, in a pose of their own
  star(id, x, y, k, kind, t, team = 'blue') {
    const ch = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
    const p = new Player({ team, human: true, role: 'att', number: 10, attr: ratingAttr(ch.r),
      look: { hair: ch.hair, hairColor: ch.hairColor, skin: ch.skin, cap: ch.cap, band: ch.band, thin: ch.thin || 0, buff: ch.buff || 0, anime: !!ch.anime, mewing: !!ch.mewing, acc: null } });
    p.vx = 0; p.vy = 0; p.faceX = x < Trailer.W / 2 ? 1 : -1; p.fx = p.faceX; p.fy = 0;
    if (kind) { p.celebKind = kind; p.celebrateT = CELE_TIME - 0.55; }
    Sprites.player(Trailer.ui(), p, x, y, k, t);
  },

  // ---- 1. the feature graphic: the name, over a real match, with two of the stars either side
  feature(m) {
    const T = Trailer;
    this.size(1024, 500);
    Render.updateCamera(m, 0, true);
    m.demo = true; Render.zoom = 1;
    if (FX.texts) FX.texts.length = 0;               // no popups peeking out round the name
    Render.drawMatch(m, 4);
    T.ui(); T.scrim(0.45);
    // two of the stars, one in each team's kit, standing either side of the name
    this.star('iceking', 138, 476, 3.9, 'hype', 1.2, 'blue');
    this.star('inferno', 886, 476, 3.9, 'flex', 1.2, 'red');
    this.logo(512, 196, 92);
    T.say('4V4 ARCADE FOOTBALL', 512, 300, 34, T.WHITE);
    T.say('FREE TO PLAY', 512, 350, 26, T.YELLOW);
  },

  // ---- 2. a real match: our striker lets a full power shot go, with the keeper already moving
  // The moment is set up, not searched for (a searched-for goal lands somewhere different every
  // time), but the shot is the game's own performShot at full charge and full meter, and the next
  // fifth of a second is the real Match.step: the trail, the keeper's reaction, the defender closing.
  match() {
    const T = Trailer;
    this.size(1920, 1080);
    const m = T.kickOff('argentina');
    FX.clear();                                           // no KICK OFF banner over the moment
    const gx = attackGoalX('blue'), dir = gx > CFG.FIELD_W / 2 ? 1 : -1, gy = CFG.FIELD_H / 2;
    const place = (q, x, y, fx) => {
      q.x = x; q.y = y; q.vx = 0; q.vy = 0; q.fx = fx; q.fy = 0; q.faceX = fx;
      q.stunT = 0; q.fallT = 0; q.slideT = 0; q.recoverT = 0; q.hopT = 0; q.skill = null; q.celebrateT = 0;
    };
    const p = T.striker(m);
    place(p, gx - dir * 470, gy + 110, dir);
    m.ball.owner = p; m.ball.x = p.x + dir * 22; m.ball.y = p.y; m.ball.z = 0; m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
    const foes = m.players.filter((q) => q.team === 'red' && !q.isKeeper);
    if (foes[0]) place(foes[0], p.x + dir * 125, p.y - 75, -dir);   // closing the striker down
    if (foes[1]) place(foes[1], gx - dir * 230, gy + 215, -dir);    // covering
    for (let i = 2; i < foes.length; i++) place(foes[i], gx - dir * 950, gy - 320 + i * 120, -dir);
    place(m.keepers.red, gx - dir * 40, gy + 20, -dir);
    m.players.filter((q) => q.team === 'blue' && !q.isKeeper && q !== p).forEach((q, i) => place(q, gx - dir * (760 + i * 170), gy - 380 + i * 320, dir));
    m.meter.blue = CFG.POWER_MAX;
    p.fy = -0.12;
    performShot(m, p, CFG.CHARGE_POW + 0.3, -1);           // full power, for the far top corner
    for (let i = 0; i < Math.round(0.2 * T.FPS); i++) T.step(m, 1 / T.FPS);
    // drawn a little closer, in the space above the caption, between the striker and the goal
    const fullH = Render.H;
    Render.H = fullH - this.bandH();
    Render.cam.x = (p.x + gx) / 2;
    Render.cam.y = (p.y * 0.6 + gy * 0.4) * CFG.TILT;
    m.demo = false; Render.zoom = 1.05;
    FX.banner = null;
    Render.drawMatch(m, 6);
    m.demo = true; Render.zoom = 1; Render.H = fullH;
    const players = CHARACTERS.filter((c) => !c.only).length;
    this.banner('FAST 4V4 FOOTBALL', `SKILL MOVES  ·  POWER SHOTS  ·  ${players} PLAYERS TO COLLECT`, T.YELLOW);
    return m;
  },

  // ---- 3. the penalty shootout, lined up to shoot
  pens() {
    const T = Trailer;
    this.size(1920, 1080);
    const club = Clubs.get('france');
    Clubs.setMatch(Clubs.mine(), club);
    const m = Match.create({ mode: 'pens', club, format: '1v1' });
    Pens.init(m); m.demo = true;
    for (let i = 0; i < 400 && m.pens.phase !== 'aim'; i++) Pens.step(m, 1 / 60);
    // drawn in the space above the caption, so the ball on its spot is in the picture
    const fullH = Render.H;
    Render.H = fullH - this.bandH(); Pens._lay = null;
    Pens.draw(m, 1 / 60, 2.4);
    Render.H = fullH; Pens._lay = null;
    this.banner('PENALTY SHOOTOUTS', 'FIVE KICKS EACH, THEN SUDDEN DEATH', '#ff4d55');
  },

  async run() {
    if (document.fonts) await document.fonts.load("100px 'Lilita One'");
    Game.checkSize = () => {};                     // the picture's size stays put
    document.body.classList.remove('kb');         // the store is phones: touch words, not keys
    // our side plays as Brazil for the pictures (yellow is the brightest kit); nothing is saved
    const club = Save.data.club;
    Save.data.club = 'brazil';
    const made = [];
    try {
      const m = this.match(); made.push(await this.save('mini-strikers-screenshot-1-match.png'));
      this.pens(); made.push(await this.save('mini-strikers-screenshot-2-penalties.png'));
      this.feature(m); made.push(await this.save('mini-strikers-feature-graphic.png'));
    } finally { Save.data.club = club; }
    return made;
  },
};
window.StoreArt = StoreArt;
