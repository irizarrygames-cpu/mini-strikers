// HOW TO PLAY: a ninety-second animated tutorial.
//
// Ten chapters, each one a little scene that loops two or three times while the caption explains
// it — moving, sprinting, passing, shooting, curling, skills, tackling, the ult, then taking a
// penalty and saving one. Every scene is drawn with the game's own sprites, so what you watch is
// what you play. SKIP leaves at any point; NEXT jumps a chapter.
//
// Every scene is a pure function of its own clock, so nothing can drift or get stuck: pause,
// resize or jump chapters and it draws exactly the same frame for the same time.
const Tutorial = {
  chapters: [
    { id: 'move', title: 'MOVE', dur: 9, loop: 3 },
    { id: 'sprint', title: 'SPRINT', dur: 9, loop: 3 },
    { id: 'pass', title: 'PASS', dur: 9, loop: 3 },
    { id: 'shoot', title: 'SHOOT', dur: 10, loop: 3.4 },
    { id: 'curl', title: 'CURL IT', dur: 9, loop: 3 },
    { id: 'skill', title: 'SKILLS', dur: 10, loop: 3.4 },
    { id: 'tackle', title: 'TACKLE', dur: 9, loop: 3 },
    { id: 'ult', title: 'THE ULT', dur: 9, loop: 4.5 },
    { id: 'penkick', title: 'PENALTIES: TAKE ONE', dur: 8, loop: 4 },
    { id: 'pensave', title: 'PENALTIES: SAVE ONE', dur: 8, loop: 4 },
  ],

  // the words, with the right keys or buttons for how you are playing
  caption(id, kb) {
    const k = (s) => `<span class="kc">${s}</span>`;
    const btn = (s) => `<span class="kc wide">${s}</span>`;
    const move = kb ? k('W') + k('A') + k('S') + k('D') : 'the joystick';
    const say = {
      move: kb ? `${move} to run. You always control the player nearest the ball.`
        : `Drag ${move} to run. You always control the player nearest the ball.`,
      sprint: kb ? `Hold ${k('SHIFT')} to sprint. It empties the bar above your head, and an empty bar leaves you jogging.`
        : `Hold ${btn('SPRINT')} to run faster. It empties the bar above your head, and an empty bar leaves you jogging.`,
      pass: kb ? `${k('E')} passes to the team-mate you are facing. Hold it for a harder ball through the gap.`
        : `Tap ${btn('PASS')} to the team-mate you are facing. Hold it for a harder ball through the gap.`,
      shoot: kb ? `Hold ${k('SPACE')} to charge, let go to shoot. The longer you hold, the harder it goes.`
        : `Hold ${btn('SHOOT')} to charge, let go to shoot. The longer you hold, the harder it goes.`,
      curl: kb ? `Steer with ${move} as you let the shot go and it bends round the keeper.`
        : `Steer with ${move} as you let the shot go and it bends round the keeper.`,
      skill: kb ? `${k('Q')} with a direction: spin, flick, nutmeg, Cruyff. No direction and you hop over the tackle.`
        : `${btn('SKILL')} with a direction: spin, flick, nutmeg, Cruyff. No direction and you hop over the tackle.`,
      tackle: kb ? `Without the ball, ${k('F')} slides in and takes it. Time it — a miss leaves you on the floor.`
        : `Without the ball, ${btn('TACKLE')} slides in and takes it. Time it — a miss leaves you on the floor.`,
      ult: kb ? `Goals, skills, assists and won tackles fill the ULT bar. Full, and ${k('SPACE')} fires your signature — and its cutscene.`
        : `Goals, skills, assists and won tackles fill the ULT bar. Full, and ${btn('ULT')} fires your signature — and its cutscene.`,
      penkick: kb ? `Aim with ${move}, hold ${k('SPACE')} for power, let go to hit it. Corners beat keepers; power alone misses.`
        : `Aim by dragging, hold ${btn('SHOOT')} for power, let go to hit it. Corners beat keepers; power alone misses.`,
      pensave: kb ? `Their turn: pick a side with ${move} as the ball leaves their boot. Too early and they change their mind.`
        : `Their turn: swipe a side as the ball leaves their boot. Too early and they change their mind.`,
    };
    return say[id] || '';
  },

  // ---------- running it ----------
  start(after) {
    this.after = after || null;
    this.i = 0;
    this.t = 0;
    this.done = false;
    this.total = this.chapters.reduce((n, c) => n + c.dur, 0);
    this.cv = $('tut-canvas');
    this.g = this.cv.getContext('2d');
    this.resize();
    this.show();
    $('howto-ok').hidden = true;
    $('tut-next').hidden = false;
  },

  stop() { this.done = true; },

  resize() {
    if (!this.cv) return;
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(200, Math.round(r.width)), h = Math.max(120, Math.round(r.height));
    if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) {
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(h * dpr);
    }
    this.W = w; this.H = h; this.dpr = dpr;
  },

  next() {
    if (this.i >= this.chapters.length - 1) { this.finish(); return; }
    this.i++; this.t = 0;
    this.show();
  },

  finish() {
    this.done = true;
    $('tut-next').hidden = true;
    $('howto-ok').hidden = false;
    $('tut-title').textContent = 'THAT IS THE LOT';
    $('tut-caption').innerHTML = 'Have a go. Everything here is in the pause menu if you want it again.';
    $('tut-time').textContent = '';
    this.bar();
  },

  show() {
    const c = this.chapters[this.i];
    $('tut-title').textContent = `${this.i + 1}/${this.chapters.length}  ${c.title}`;
    $('tut-caption').innerHTML = this.caption(c.id, document.body.classList.contains('kb'));
    this.bar();
  },

  bar() {
    const pips = this.chapters.map((c, i) => `<i class="${i < this.i || this.done ? 'on' : i === this.i ? 'now' : ''}"></i>`).join('');
    $('tut-bar').innerHTML = pips;
  },

  update(dt) {
    if (this.done || !this.cv) return;
    this.resize();
    this.t += dt;
    const c = this.chapters[this.i];
    if (this.t >= c.dur) { this.next(); return; }
    // the clock in the corner: how much is left of the whole thing
    let left = -this.t;
    for (let i = this.i; i < this.chapters.length; i++) left += this.chapters[i].dur;
    const s = Math.max(0, Math.ceil(left));
    $('tut-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} LEFT`;
    this.draw();
  },

  // ---------- the drawing kit ----------
  // a fake player the sprite code is happy with, posed however the scene needs
  pose(o) {
    const p = UI.fakePlayer(o.look || Save.look(), o.team || 'blue', !!o.keeper, o.number || 10);
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.faceX = o.faceX === undefined ? 1 : o.faceX;
    p.fx = o.fx === undefined ? p.faceX : o.fx;
    p.fy = o.fy === undefined ? 0.2 : o.fy;
    p.runPhase = o.runPhase || 0;
    p.kickT = o.kickT || 0; p.kickDur = 0.24;
    p.slideT = o.slideT || 0; p.slideDirX = o.faceX || 1; p.slideDirY = 0;
    p.diveT = o.diveT || 0; p.diveDir = o.diveDir || 0;
    p.hopT = o.hopT || 0; p.fallT = o.fallT || 0; p.stunT = o.stunT || 0;
    p.sprintOn = !!o.sprint; p.seed = o.seed || 0;
    if (o.ult) p.ultShot = { kind: o.ult, t: o.ultT || 0, dur: 0.8 };
    if (o.skill) p.skill = { kind: o.skill };
    return p;
  },

  man(g, x, y, k, o, t) { Sprites.player(g, this.pose(o), x, y, k, t); },

  pill(g, x, y, w, h, fill, fillPct) {
    g.fillStyle = OUTLINE; Sprites.rr(g, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); g.fill();
    g.fillStyle = '#dfe3f2'; Sprites.rr(g, x, y, w, h, h / 2); g.fill();
    if (fillPct > 0) { g.fillStyle = fill; Sprites.rr(g, x, y, Math.max(h, w * clamp(fillPct, 0, 1)), h, h / 2); g.fill(); }
  },

  // the grass, striped like the pitch
  turf(g, W, H) {
    g.fillStyle = '#4fbd3b'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    const n = 7, sw = W / n;
    for (let i = 0; i < n; i += 2) g.fillRect(i * sw, 0, sw, H);
  },

  // a goal seen from the side, facing right
  sideGoal(g, x, y, w, h) {
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(3, h * 0.06);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y - h * 0.18); g.lineTo(x + w, y - h); g.lineTo(x, y - h * 0.82); g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill(); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.55)';
    for (let i = 1; i < 5; i++) { const f = i / 5; g.beginPath(); g.moveTo(x + w * f, y - h * 0.18 * f); g.lineTo(x + w * f, y - h * (0.82 + 0.18 * f)); g.stroke(); }
  },

  // a goal seen from behind the ball, the way a penalty looks
  frontGoal(g, cx, y, w, h) {
    const x = cx - w / 2;
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y - h, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
    for (let i = 1; i < 9; i++) { const f = i / 9; g.beginPath(); g.moveTo(x + w * f, y - h); g.lineTo(x + w * f, y); g.stroke(); }
    for (let i = 1; i < 5; i++) { const f = i / 5; g.beginPath(); g.moveTo(x, y - h * f); g.lineTo(x + w, y - h * f); g.stroke(); }
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(4, h * 0.075); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.lineTo(x + w, y - h); g.lineTo(x + w, y); g.stroke();
  },

  bal(g, x, y, z, k, t, o = {}) {
    const b = { x, y, z: z || 0, shot: o.shot || null, owner: null, trailType: o.trail || null, roll: t * 6, skin: Save.ball(), netBulge: { left: 0, right: 0 }, vx: 0, vy: 0 };
    Sprites.ball(g, b, x, y - (z || 0), k, t);
  },

  puff(g, x, y, k, n, seed) {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < n; i++) {
      const a = seed + i * 1.7;
      g.beginPath(); g.arc(x - i * 5 * k, y - Math.abs(Math.sin(a)) * 3 * k, (2.6 - i * 0.5) * k, 0, Math.PI * 2); g.fill();
    }
  },

  // a solid arrow, for showing where somebody is going
  arrow(g, x1, y1, x2, y2, col, w) {
    const a = Math.atan2(y2 - y1, x2 - x1), head = w * 3.2;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8); g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - Math.cos(a - 0.5) * head, y2 - Math.sin(a - 0.5) * head);
    g.lineTo(x2 - Math.cos(a + 0.5) * head, y2 - Math.sin(a + 0.5) * head);
    g.closePath(); g.fill();
  },

  label(g, txt, x, y, size, col) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    Render.chunkyText(g, txt, x, y, size, col || '#ffffff', 0);
  },

  // ---------- the scenes ----------
  draw() {
    const g = this.g, W = this.W, H = this.H, c = this.chapters[this.i];
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    this.turf(g, W, H);
    const u = (this.t % c.loop) / c.loop;     // 0..1 through this loop of the scene
    const k = H / 135;                        // sprite scale: big enough to read, small enough to fit
    const gy = H * 0.86;                      // where feet stand
    const scene = this['sc_' + c.id];
    if (scene) scene.call(this, g, u, W, H, k, gy, this.t);
    // a tidy frame
    g.strokeStyle = OUTLINE; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  },

  // Everything below is laid out as a fraction of the frame; only details that belong to a body
  // (the ball at his feet, dust, a slide streak) are in units of k, the sprite scale.
  sc_move(g, u, W, H, k, gy, t) {
    const pts = [[W * 0.2, gy - H * 0.3], [W * 0.6, gy - H * 0.3], [W * 0.7, gy], [W * 0.28, gy]];
    const seg = u * 3, i = Math.min(2, Math.floor(seg)), f = seg - i;
    const a = pts[i], b = pts[i + 1];
    const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f);
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    g.setLineDash([9, 8]); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) g.lineTo(q[0], q[1]);
    g.stroke(); g.setLineDash([]);
    this.bal(g, x + 12 * k * Math.sign(dx || 1), y, 0, k, t);
    this.man(g, x, y, k, { vx: dx, vy: dy, faceX: Math.sign(dx) || 1, fx: Math.sign(dx) || 1, runPhase: t * 14 }, t);
    this.arrow(g, x + (dx / L) * W * 0.05, y + (dy / L) * W * 0.05 - H * 0.34,
      x + (dx / L) * W * 0.15, y + (dy / L) * W * 0.15 - H * 0.34, '#ffe14d', Math.max(3, W * 0.008));
  },

  sc_sprint(g, u, W, H, k, gy, t) {
    const sprinting = u < 0.62;
    const x = sprinting ? lerp(W * 0.12, W * 0.72, u / 0.62) : lerp(W * 0.72, W * 0.8, (u - 0.62) / 0.38);
    const stam = sprinting ? 1 - u / 0.62 : 0.02;
    if (sprinting) {
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
      for (let i = 1; i < 6; i++) { const lx = x - i * W * 0.035; g.beginPath(); g.moveTo(lx, gy - H * 0.12 + i * 2); g.lineTo(lx - W * 0.03, gy - H * 0.12 + i * 2); g.stroke(); }
      this.puff(g, x - 8 * k, gy, k, 3, t * 9);
    }
    this.bal(g, x + 12 * k, gy, 0, k, t);
    this.man(g, x, gy, k, { vx: sprinting ? 300 : 60, faceX: 1, runPhase: t * (sprinting ? 22 : 8), sprint: sprinting }, t);
    const bw = W * 0.1, bh = Math.max(6, H * 0.035);
    this.pill(g, x - bw / 2, gy - H * 0.68, bw, bh, stam > 0.25 ? '#3fcf4a' : '#ff3a3f', stam);
    if (!sprinting) this.label(g, 'EMPTY', x, gy - H * 0.8, Math.max(11, H * 0.085), '#ff8a8a');
  },

  sc_pass(g, u, W, H, k, gy, t) {
    const ax = W * 0.18, ay = gy, bx = W * 0.76, by = gy - H * 0.26;
    const back = u >= 0.5;
    const fly = clamp((back ? u - 0.5 : u) / 0.34, 0, 1);
    const from = back ? [bx, by] : [ax, ay], to = back ? [ax, ay] : [bx, by];
    const x = lerp(from[0], to[0], fly), y = lerp(from[1], to[1], fly);
    const z = Math.sin(fly * Math.PI) * H * 0.14;
    const kicking = fly < 0.12;
    this.arrow(g, from[0] + (to[0] > from[0] ? 1 : -1) * W * 0.06, from[1] - H * 0.16,
      to[0] - (to[0] > from[0] ? 1 : -1) * W * 0.06, to[1] - H * 0.16, 'rgba(255,225,77,0.85)', Math.max(3, W * 0.007));
    this.bal(g, x, y, z, k, t);
    this.man(g, ax, ay, k, { faceX: 1, fx: 1, kickT: !back && kicking ? 0.2 : 0 }, t);
    this.man(g, bx, by, k, { faceX: -1, fx: -1, number: 7, kickT: back && kicking ? 0.2 : 0 }, t);
  },

  sc_shoot(g, u, W, H, k, gy, t) {
    const goalX = W * 0.72, gh = H * 0.5, gw = W * 0.2;
    this.sideGoal(g, goalX, gy, gw, gh);
    const charge = clamp(u / 0.45, 0, 1);
    const shot = u > 0.5, f = clamp((u - 0.5) / 0.3, 0, 1);
    const px = W * 0.2;
    const bx = shot ? lerp(px + 12 * k, goalX + gw * 0.55, f) : px + 12 * k;
    const by = shot ? lerp(gy, gy - gh * 0.6, f) : gy;
    if (!shot) {
      g.strokeStyle = charge > 0.85 ? '#ff3a3f' : '#46d9ff'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(px, gy, (10 + charge * 16) * k, (4 + charge * 6) * k, 0, 0, Math.PI * 2); g.stroke();
      this.pill(g, px - W * 0.06, gy - H * 0.58, W * 0.12, Math.max(6, H * 0.035), charge > 0.85 ? '#ff3a3f' : '#ffe14d', charge);
    }
    const dive = shot ? clamp((f - 0.15) / 0.5, 0, 1) : 0;
    this.man(g, goalX + gw * 0.12, gy - gh * 0.06 - dive * gh * 0.2, k * 0.85, { team: 'red', keeper: true, faceX: -1, fx: -1, number: 1, diveT: dive > 0 ? 0.3 : 0, diveDir: -1 }, t);
    this.bal(g, bx, by, shot ? Math.sin(f * 2.4) * H * 0.1 : 0, k, t, { shot: shot ? { level: 2, power: charge > 0.85, team: 'blue' } : null });
    this.man(g, px, gy, k, { faceX: 1, fx: 1, kickT: shot && f < 0.22 ? 0.2 : 0 }, t);
    if (shot && f > 0.8) this.label(g, 'GOAL!', W * 0.45, H * 0.2, Math.max(16, H * 0.16), '#ffe14d');
  },

  sc_curl(g, u, W, H, k, gy, t) {
    const goalX = W * 0.72, gh = H * 0.5, gw = W * 0.2;
    this.sideGoal(g, goalX, gy, gw, gh);
    const px = W * 0.2, shot = u > 0.25, f = clamp((u - 0.25) / 0.55, 0, 1);
    const p0 = [px + 12 * k, gy], p1 = [W * 0.5, gy - gh * 1.15], p2 = [goalX + gw * 0.6, gy - gh * 0.55];
    const bez = (a, b, c2, sv) => (1 - sv) * (1 - sv) * a + 2 * (1 - sv) * sv * b + sv * sv * c2;
    g.setLineDash([8, 7]); g.strokeStyle = 'rgba(255,225,77,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(p0[0], p0[1]);
    for (let sv = 0.05; sv <= 1.0001; sv += 0.05) g.lineTo(bez(p0[0], p1[0], p2[0], sv), bez(p0[1], p1[1], p2[1], sv));
    g.stroke(); g.setLineDash([]);
    const dive = shot ? clamp((f - 0.3) / 0.4, 0, 1) : 0;
    this.man(g, goalX + gw * 0.12, gy - gh * 0.06, k * 0.85, { team: 'red', keeper: true, faceX: -1, fx: -1, number: 1, diveT: dive > 0 ? 0.3 : 0, diveDir: 1 }, t);
    if (shot) this.bal(g, bez(p0[0], p1[0], p2[0], f), bez(p0[1], p1[1], p2[1], f), H * 0.08, k, t, { shot: { level: 2, power: false, team: 'blue' } });
    else this.bal(g, p0[0], p0[1], 0, k, t);
    this.man(g, px, gy, k, { faceX: 1, fx: 1, kickT: shot && f < 0.2 ? 0.2 : 0 }, t);
    this.arrow(g, px - W * 0.03, gy - H * 0.5, px + W * 0.05, gy - H * 0.62, '#46d9ff', Math.max(3, W * 0.007));
  },

  sc_skill(g, u, W, H, k, gy, t) {
    const defX = W * 0.54;
    const run = clamp(u / 0.4, 0, 1);
    const trick = u > 0.4 && u < 0.72, past = u >= 0.72;
    const x = past ? lerp(defX + W * 0.1, W * 0.86, (u - 0.72) / 0.28) : lerp(W * 0.08, defX - W * 0.18, run);
    const hop = trick ? 0.42 * (1 - Math.abs((u - 0.56) / 0.16)) : 0;
    const side = trick ? Math.sin((u - 0.4) / 0.32 * Math.PI) * H * 0.16 : 0;
    this.man(g, defX, gy, k, { team: 'red', faceX: -1, fx: -1, number: 5, stunT: past ? 0.3 : 0, runPhase: t * 8, vx: past ? 0 : -40 }, t);
    this.bal(g, x + 12 * k, gy - side * 0.4, 0, k, t);
    this.man(g, x, gy - side, k, { faceX: 1, fx: 1, runPhase: t * 16, vx: 240, hopT: hop, skill: trick ? 'spin' : null }, t);
    if (trick || past) this.label(g, 'NUTMEG!', defX, gy - H * 0.62, Math.max(12, H * 0.1), '#ffe14d');
  },

  sc_tackle(g, u, W, H, k, gy, t) {
    const carrier = lerp(W * 0.86, W * 0.42, clamp(u / 0.62, 0, 1));
    const slide = u > 0.38 && u < 0.76, won = u >= 0.7;
    const mx = slide || won ? lerp(W * 0.04, carrier - W * 0.14, clamp((u - 0.38) / 0.32, 0, 1)) : W * 0.04;
    const bx = won ? lerp(carrier - 6 * k, W * 0.16, clamp((u - 0.7) / 0.3, 0, 1)) : carrier + 12 * k;
    const bz = won ? Math.sin(clamp((u - 0.7) / 0.3, 0, 1) * Math.PI) * H * 0.18 : 0;
    if (slide) {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      Sprites.rr(g, mx - 26 * k, gy - 2.5 * k, 28 * k, 5 * k, 2.5 * k); g.fill();
      this.puff(g, mx - 14 * k, gy, k, 3, t * 11);
    }
    this.bal(g, bx, gy, bz, k, t);
    this.man(g, carrier, gy, k, { team: 'red', faceX: -1, fx: -1, number: 9, runPhase: t * 15, vx: -260, fallT: won ? 0.4 : 0 }, t);
    this.man(g, mx, gy, k, { faceX: 1, fx: 1, runPhase: t * 15, vx: 300, slideT: slide ? 0.3 : 0 }, t);
    if (slide) this.label(g, 'SLIDE!', mx, gy - H * 0.5, Math.max(11, H * 0.085), '#ffffff');
    if (won) this.label(g, 'BALL WON!', W * 0.5, H * 0.14, Math.max(13, H * 0.11), '#46d9ff');
  },

  sc_ult(g, u, W, H, k, gy, t) {
    const goalX = W * 0.74, gh = H * 0.46, gw = W * 0.18;
    this.sideGoal(g, goalX, gy, gw, gh);
    const fill = clamp(u / 0.45, 0, 1), full = fill >= 1;
    const fired = u > 0.52, f = clamp((u - 0.52) / 0.38, 0, 1);
    const px = W * 0.2;
    const bh = Math.max(7, H * 0.045);
    this.pill(g, W * 0.05, H * 0.1, W * 0.24, bh, full && Math.sin(t * 18) > 0 ? '#ffffff' : rainbow(t * 0.7), fill);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    Render.chunkyText(g, full ? 'ULT READY' : 'ULT', W * 0.32, H * 0.1 + bh / 2, Math.max(10, H * 0.08), full ? '#ffe14d' : '#ffffff', 0);
    g.textAlign = 'center';
    if (fired) {
      const bx = lerp(px + 12 * k, goalX + gw * 0.6, f), by = lerp(gy - H * 0.1, gy - gh * 0.62, f);
      g.strokeStyle = rainbow(t); g.lineWidth = Math.max(5, H * 0.03); g.lineCap = 'round';
      g.beginPath(); g.moveTo(px + 12 * k, gy - H * 0.1); g.lineTo(bx, by); g.stroke();
      this.bal(g, bx, by, H * 0.08, k, t, { shot: { level: 2, power: true, team: 'blue' }, trail: 'rainbow' });
      this.man(g, px, gy, k, { faceX: 1, fx: 1, ult: 'bicycle', ultT: clamp(f * 1.2, 0, 1) * 0.8 }, t);
      if (f > 0.75) this.label(g, 'GOAL!', W * 0.5, H * 0.26, Math.max(16, H * 0.15), '#ffe14d');
    } else {
      this.bal(g, px + 12 * k, gy, 0, k, t);
      this.man(g, px, gy, k, { faceX: 1, fx: 1, runPhase: t * 10, vx: 80 }, t);
      if (full) this.label(g, 'PRESS IT', px, gy - H * 0.5, Math.max(12, H * 0.095), '#ffe14d');
    }
  },

  sc_penkick(g, u, W, H, k, gy, t) {
    const gh = H * 0.52, gw = W * 0.5, cx = W * 0.5, top = H * 0.74;
    this.frontGoal(g, cx, top, gw, gh);
    const aiming = u < 0.5;
    const target = [cx + gw * 0.38, top - gh * 0.74];
    const aimX = aiming ? cx + Math.sin(u * 7) * gw * 0.4 : target[0];
    const aimY = aiming ? top - gh * (0.45 + Math.sin(u * 5) * 0.22) : target[1];
    const power = clamp((u - 0.2) / 0.3, 0, 1);
    const f = clamp((u - 0.5) / 0.4, 0, 1);
    this.man(g, cx - (aiming ? 0 : f * gw * 0.34), top, k * 0.85, { team: 'red', keeper: true, faceX: 1, fx: 0, fy: 1, number: 1, diveT: u > 0.55 ? 0.3 : 0, diveDir: -1 }, t);
    const R = Math.max(9, H * 0.06);
    g.strokeStyle = '#ffe14d'; g.lineWidth = 4;
    g.beginPath(); g.arc(aimX, aimY, R, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(aimX - R * 1.6, aimY); g.lineTo(aimX + R * 1.6, aimY); g.moveTo(aimX, aimY - R * 1.6); g.lineTo(aimX, aimY + R * 1.6); g.stroke();
    this.pill(g, W * 0.32, H * 0.9, W * 0.36, Math.max(6, H * 0.035), power > 0.8 ? '#ff3a3f' : '#3fcf4a', aiming ? power : 1);
    if (!aiming) {
      const bx = lerp(cx, target[0], f), by = lerp(H * 0.86, target[1], f);
      this.bal(g, bx, by, 0, k * (1 - f * 0.45), t, { shot: { level: 2, power: true, team: 'blue' } });
      if (f > 0.85) this.label(g, 'IN THE CORNER', cx, H * 0.14, Math.max(12, H * 0.1), '#ffe14d');
    } else {
      this.bal(g, cx, H * 0.86, 0, k, t);
    }
  },

  sc_pensave(g, u, W, H, k, gy, t) {
    const gh = H * 0.52, gw = W * 0.5, cx = W * 0.5, top = H * 0.74;
    this.frontGoal(g, cx, top, gw, gh);
    const runUp = u < 0.34, flying = u >= 0.34 && u < 0.72, saved = u >= 0.7;
    const f = clamp((u - 0.34) / 0.38, 0, 1);
    const side = -1;
    const target = [cx + side * gw * 0.36, top - gh * 0.44];
    this.man(g, cx + W * 0.2, H * 0.94, k * 0.6, { team: 'red', faceX: -1, fx: -1, number: 9, runPhase: t * 12, vx: runUp ? -120 : 0, kickT: flying && f < 0.15 ? 0.2 : 0 }, t);
    const dive = flying || saved ? clamp((f - 0.1) / 0.45, 0, 1) : 0;
    this.man(g, cx + side * dive * gw * 0.32, top, k * 0.85, { team: 'blue', keeper: true, faceX: side, fx: 0, fy: 1, number: 1, diveT: dive > 0 ? 0.3 : 0, diveDir: side }, t);
    if (flying) {
      const bx = lerp(cx + W * 0.12, target[0], f), by = lerp(H * 0.88, target[1], f);
      this.arrow(g, cx + W * 0.06, H * 0.84, target[0], target[1] + H * 0.08, 'rgba(70,217,255,0.8)', Math.max(3, W * 0.007));
      this.bal(g, bx, by, 0, k * (1 - f * 0.4), t, { shot: { level: 1, power: false, team: 'red' } });
    } else if (saved) {
      const sv = clamp((u - 0.7) / 0.3, 0, 1);
      this.bal(g, lerp(target[0], target[0] - side * gw * 0.55, sv), lerp(target[1], top - gh * 0.08, sv), 0, k * 0.8, t);
      this.label(g, 'SAVED!', cx, H * 0.14, Math.max(14, H * 0.12), '#46d9ff');
    } else {
      this.bal(g, cx + W * 0.12, H * 0.88, 0, k, t);
    }
  },
};
