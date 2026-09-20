// Chunky flat cartoon players, the ball and ball trails — all drawn in code.
const Sprites = {
  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 3.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  },

  blob(ctx, fill) {
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = OUTLINE; ctx.stroke();
  },

  // p: player-like object. k: pixels per world unit. t: time in seconds.
  // Drawn in "sprite units": feet at y=0, head top near y=-68.
  player(ctx, p, sx, sy, k, t) {
    const kit = p.isKeeper ? KEEPER_KITS[p.team] : TEAMS[p.team];
    const look = p.look;
    const sp = Math.hypot(p.vx, p.vy) / CFG.SPEED;
    // a celebration drives the whole pose for its duration
    const ce = CELE_TIME - p.celebrateT;
    const up = p.ultShot && ULT_POSES[p.ultShot.kind] ? ULT_POSES[p.ultShot.kind](clamp(p.ultShot.t / p.ultShot.dur, 0, 1), p) : null;
    const cp = up || (p.celebrateT > 0 && p.celebKind && CELE_POSES[p.celebKind] ? CELE_POSES[p.celebKind](ce, t, p) : null);
    const back = !cp && p.fy < -0.62 && p.kickT <= 0 && p.celebrateT <= 0 && p.slideT <= 0 && p.diveT <= 0;
    let faceX = p.faceX;
    if (cp && cp.faceX !== undefined) faceX = cp.faceX;
    const flip = faceX < 0 ? -1 : 1;
    const squash = Math.abs(faceX) < 0.35 ? 0.86 + Math.abs(faceX) * 0.4 : 1;

    let legSwing = 0, armSwing = 0, bob = 0, jump = 0, lean = 0, rot = 0, kick = 0;
    let armsUp = 0, slide = 0, upperLean = 0, tuck = 0, dive = 0, fall = 0;
    if ((p.slideWindT || 0) > 0) {
      lean = 0.35; jump = -5; legSwing = 0.6; armSwing = -0.6; // crouched, about to slide
    } else if (p.slideT > 0) {
      kick = 1; lean = 0.3; jump = -2; // tackle lunge: poking a leg in
    } else if (p.fallT > 0) {
      fall = 1; jump = -4;
    } else if (p.diveT > 0) {
      dive = 1; rot = (Math.PI / 2.2) * (p.diveDir * TEAMS[p.team].dir > 0 ? 1 : -1) * flip;
      jump = 10; armsUp = 1;
    } else if (cp) {
      if (cp.run && sp > 0.08) { legSwing = Math.sin(p.runPhase) * Math.min(1, sp * 1.3); armSwing = -legSwing; bob = Math.abs(Math.sin(p.runPhase)) * 2.2 * Math.min(1, sp); }
      jump = cp.jump || 0; bob += cp.bob || 0; lean = cp.lean || 0; rot = cp.rot || 0; upperLean = cp.upper || 0;
      if (cp.legSwing) legSwing = cp.legSwing;
      if (cp.kneel) slide = 1;
      armsUp = cp.hands ? 1 : 0;
    } else if (p.celebrateT > 0) {
      jump = Math.abs(Math.sin(t * 9 + p.seed)) * 11; armsUp = 1;
      legSwing = Math.sin(t * 18 + p.seed) * 0.5;
    } else if (p.kickT > 0) {
      kick = Math.sin((1 - p.kickT / p.kickDur) * Math.PI);
      lean = -0.14 * kick;
    } else if (p.stunT > 0) {
      rot = Math.sin(t * 40) * 0.12;
    } else if (sp > 0.08) {
      legSwing = Math.sin(p.runPhase) * Math.min(1, sp * 1.3);
      armSwing = -legSwing;
      bob = Math.abs(Math.sin(p.runPhase)) * 2.2 * Math.min(1, sp);
      lean = 0.1 * Math.min(1, sp);
    } else {
      bob = Math.sin(t * 3 + p.seed) * 0.6;
      if (p.sad) { bob -= 1; lean = 0.12; }
    }
    if (p.recoverT > 0 && !slide && !dive) rot = 0.25 * flip * Math.min(1, p.recoverT / 0.25);
    if (p.hopT > 0) { jump += Math.sin((1 - p.hopT / 0.42) * Math.PI) * 22; tuck = 1; armsUp = 0.5; }
    if (p.sprintOn && sp > 0.5 && !slide) lean += 0.12;

    if (p.ultOn || p.ultShot) this.ultFire(ctx, p, t, sx, sy, k, false);
    ctx.save();
    ctx.translate(sx, sy);
    // Every celebration gets a soft anticipation/pop. It is time-based, so the motion stays
    // identical at 30, 60 and 120 FPS, and accessories share the exact same transform.
    const celeIn = cp && p.celebrateT > 0 ? celeEase(ce / 0.18) : 0;
    const celePop = cp ? Math.sin(Math.min(1, ce / 0.34) * Math.PI) * 0.055 * celeIn : 0;
    ctx.scale(k * flip * squash * (1 + celePop), k * (1 - celePop * 0.45));
    if (fall) {
      // tripped: lying on the grass, face down
      ctx.translate(0, -4);
      ctx.rotate(1.45);
      ctx.translate(-2, 26);
    }
    if (cp && cp.lie) {
      // lying down: face down for push-ups, on your back for a nap
      ctx.translate(0, -4 - (cp.lift || 0));
      ctx.rotate(cp.lie === 'front' ? 1.45 : -1.45);
      ctx.translate(cp.lie === 'front' ? -2 : 2, 26);
    }
    ctx.translate(0, -jump - bob);
    if (rot) { ctx.translate(0, -26); ctx.rotate(cp ? rot : rot * flip); ctx.translate(0, 26); }
    if (lean) { ctx.translate(0, -16); ctx.rotate(lean); ctx.translate(0, 16); }
    ctx.lineJoin = 'round';

    const acc = look.acc || null;
    // capes, wings and jetpacks hang behind you (seen from behind they're drawn over the shirt)
    if (acc && !back) this.accessory(ctx, acc, 'back', p, t, back, sp);

    // ---- legs + boots ----
    const hipY = -18;
    for (let i = 0; i < 2; i++) {
      const hx = i ? 4.5 : -4.5, sw = i ? legSwing : -legSwing;
      let fx = hx + sw * 7, fy = -3 + Math.max(0, -sw) * -2.5;
      if (kick && i === 1) { fx = hx + 13 * kick; fy = -7 - 6 * kick; }
      if (slide) { if (i === 1) { fx = hx + 20; fy = -11; } else { fx = hx + 7; fy = -4; } }
      if (tuck) { fy = -9; fx = hx + (i ? 4 : -2); }
      if (dive) { fx = hx * 1.3; fy = -1; }
      if (cp && cp.feet) { fx = cp.feet[i][0]; fy = cp.feet[i][1]; }
      this.leg(ctx, hx, hipY, fx, fy, look.skin, kit.socks);
      this.boot(ctx, fx, fy, acc === 'goldboots' && !p.isKeeper ? '#ffc21a' : kit.shoes, i === 1 && kick > 0.3);
    }

    // ---- shorts ----
    this.rr(ctx, -10.5, -27, 21, 11.5, 4.5); this.blob(ctx, kit.shorts);
    ctx.fillStyle = shadeHex(kit.shorts, kit.shorts === '#ffffff' ? -0.12 : -0.3);
    ctx.fillRect(-9.2, -19.5, 18.4, 2.8);
    ctx.fillStyle = kit.accent === OUTLINE ? '#3a3f66' : kit.accent;
    ctx.fillRect(7.2, -25.5, 2.2, 8.5);

    if (upperLean) { ctx.translate(0, -22); ctx.rotate(upperLean); ctx.translate(0, 22); }

    // ---- arms (back arm first) ----
    const shY = -41;
    const arm = (side, swing) => {
      let hx = side * 13 + swing * 6, hy = -28 + Math.abs(swing) * -2;
      if (armsUp === 0.7) { hx = side * 21; hy = -52 + Math.sin(t * 6) * 2; }
      else if (armsUp) {
        const wave = p.celebrateT > 0 ? Math.sin(t * 14 + side) * 3 : 0;
        hx = side * 19 + (dive ? 6 : 0) + wave; hy = -64 - (dive ? 10 : 0);
      }
      if (kick) { hx = side * 16; hy = -34; }
      if (slide && side < 0) { hx = -16; hy = -22; }
      if (cp && cp.hands) { const hand = cp.hands[side < 0 ? 0 : 1]; hx = hand[0]; hy = hand[1]; }
      this.limb(ctx, side * 10, shY, hx, hy, 5.6, look.skin);
      const armLen = Math.hypot(hx - side * 10, hy - shY) || 1;
      if (acc === 'wristbands' && !p.isKeeper) {
        const f = Math.max(0.5, (armLen - 3.6) / armLen), wx = lerp(side * 10, hx, f), wy = lerp(shY, hy, f);
        ctx.beginPath(); ctx.arc(wx, wy, 4.1, 0, Math.PI * 2); this.blob(ctx, '#ff3a3f');
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(wx, wy, 1.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(hx, hy, p.isKeeper ? 4.8 : 3.4, 0, Math.PI * 2);
      this.blob(ctx, p.isKeeper ? kit.gloves : look.skin);
      ctx.beginPath(); ctx.arc(side * 10, shY + 1, 5.6, 0, Math.PI * 2); this.blob(ctx, kit.sleeves || kit.jersey);
      if (acc === 'armband' && side > 0 && !p.isKeeper) {
        const f = Math.min(0.62, 7 / armLen), ax = lerp(side * 10, hx, f), ay = lerp(shY, hy, f);
        ctx.beginPath(); ctx.arc(ax, ay, 4.4, 0, Math.PI * 2); this.blob(ctx, '#ffe14d');
        ctx.fillStyle = OUTLINE; ctx.font = '900 6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('C', ax, ay + 0.4);
      }
    };
    arm(-1, -armSwing);

    // ---- torso: flat cel-shaded jersey ----
    this.rr(ctx, -12, -46, 24, 22, 8);
    ctx.fillStyle = kit.jersey; ctx.fill();
    if (kit.stripes) { ctx.fillStyle = kit.stripes; ctx.fillRect(-8.4, -44.6, 3.8, 19.4); ctx.fillRect(-1.9, -45.4, 3.8, 21); ctx.fillRect(4.6, -44.6, 3.8, 19.4); }
    if (kit.center) { ctx.fillStyle = '#ffffff'; ctx.fillRect(-4.8, -45.4, 9.6, 21); ctx.fillStyle = kit.center; ctx.fillRect(-3, -45.4, 6, 21); }
    if (kit.checks) { ctx.fillStyle = kit.checks; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) ctx.fillRect(-9 + c * 4.5, -44 + r * 4.5, 4.5, 4.5); }
    ctx.fillStyle = kit.stripes || kit.center || kit.checks ? 'rgba(0, 0, 0, 0.16)' : kit.shade;
    this.rr(ctx, -11, -31, 22, 6.5, 3); ctx.fill();   // lower shadow band
    ctx.fillRect(-10.5, -42, 4, 13);                   // back-side panel
    ctx.fillStyle = kit.accent === OUTLINE ? '#ffffff' : kit.accent;
    ctx.fillRect(8.6, -42, 2.4, 13);                   // side stripe
    ctx.fillStyle = kit.hi || (kit.hi = shadeHex(kit.jersey, 0.25));
    ctx.fillRect(-2, -44.5, 9, 2.2);                   // shoulder highlight
    this.rr(ctx, -12, -46, 24, 22, 8);
    ctx.lineWidth = 2.6; ctx.strokeStyle = OUTLINE; ctx.stroke();
    if (!back) {
      ctx.fillStyle = kit.accent === OUTLINE ? '#ffffff' : kit.accent;
      ctx.beginPath(); ctx.moveTo(-4.5, -45.6); ctx.lineTo(1, -40); ctx.lineTo(6.5, -45.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.moveTo(-2.6, -45.6); ctx.lineTo(1, -42); ctx.lineTo(4.6, -45.6); ctx.closePath(); ctx.fill();
    }
    // number
    ctx.save();
    ctx.scale(flip / squash, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${back ? 15 : 9}px system-ui, sans-serif`;
    const nx = back ? 0 : -3.5 * flip, ny = back ? -35 : -35.5;
    ctx.lineWidth = back ? 3.2 : 2.4; ctx.strokeStyle = OUTLINE;
    ctx.strokeText(String(p.number), nx, ny);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(p.number), nx, ny);
    ctx.restore();

    if (acc) { if (back) this.accessory(ctx, acc, 'back', p, t, back, sp); this.accessory(ctx, acc, 'neck', p, t, back, sp); }
    arm(1, armSwing);

    // ---- head ----
    this.head(ctx, look, back, t, p);
    const faceProp = cp && (cp.prop === 'shades' || cp.prop === 'glasses');
    const faceAcc = acc && ACCESSORY_FACE_IDS.has(acc);
    if (acc && !(faceProp && faceAcc)) this.accessory(ctx, acc, 'head', p, t, back, sp);
    if (cp && cp.prop) this.celebProp(ctx, cp.prop, ce, back, p);
    ctx.restore();
    if (p.ultOn || p.ultShot) this.ultFire(ctx, p, t, sx, sy, k, true);
    if (cp && cp.screen) this.celebScreen(ctx, cp.screen, ce, sx, sy, k, flip, cp);
  },

  // Rainbow fire round the player while the ult is up: flat flame tongues, colours running through
  // them, drawn in screen space so they always stand up (the body can be upside down mid-kick).
  ultFire(ctx, p, t, sx, sy, k, front) {
    const seed = p.seed || 0, big = p.ultShot ? 1.45 : 1;
    if (!front) {
      ctx.lineWidth = 3.4 * k; ctx.strokeStyle = OUTLINE; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(sx, sy, 23 * k, 8.5 * k, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2.2 * k; ctx.strokeStyle = rainbow(t * 0.9 + 0.7, 2); ctx.stroke();
    }
    const spots = front ? [[12, 0, 0.5], [-12, 0, 0.45]]
      : [[-21, 0, 0.85], [-9, -1, 0.65], [2, -2, 0.6], [11, -1, 0.7], [22, 0, 0.8]];
    for (let i = 0; i < spots.length; i++) {
      const [ox, oy, sc] = spots[i];
      const x = sx + ox * k, y = sy + oy * k;
      const h = (12 + Math.abs(Math.sin(t * 8 + i * 2.1 + seed)) * 10) * sc * big * k;
      const w = 5.2 * sc * k, lean = Math.sin(t * 11 + i * 1.7 + seed) * 3.2 * k;
      for (let L = 0; L < 3; L++) {
        const fr = 1 - L * 0.34, hh = h * fr, ww = w * fr;
        if (hh < 2.5 || ww < 0.8) continue;
        ctx.beginPath();
        ctx.moveTo(x - ww, y);
        ctx.quadraticCurveTo(x - ww * 1.15, y - hh * 0.62, x + lean * fr, y - hh);
        ctx.quadraticCurveTo(x + ww * 1.15, y - hh * 0.62, x + ww, y);
        ctx.quadraticCurveTo(x, y + 2.6 * k, x - ww, y);
        ctx.closePath();
        if (L === 0) { ctx.fillStyle = rainbow(t * 0.9, i); ctx.fill(); ctx.lineWidth = 2.4 * k; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
        else { ctx.fillStyle = rainbow(t * 0.9 + L * 0.45, i + L * 2); ctx.fill(); }
      }
    }
  },

  // props drawn on the body (they turn and lean with the player)
  celebProp(ctx, name, e, back, p) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (name) {
      case 'shades': {
        if (back) return;
        ctx.fillStyle = '#161a33';
        this.rr(ctx, 1.6, -58.4, 9.4, 7.6, 3); ctx.fill();
        this.rr(ctx, 9.4, -58.4, 9.4, 7.6, 3); ctx.fill();
        ctx.fillRect(-10, -57, 13, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(3.4, -57, 3, 1.8); ctx.fillRect(11.2, -57, 3, 1.8);
        break;
      }
      case 'flex': {
        // biceps: a bump on each arm, halfway to the fist
        const bump = 4.4 + Math.sin(e * 6) * 0.6;
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.arc(side * 19, -48.5, bump, 0, Math.PI * 2);
          this.blob(ctx, p.look.skin);
        }
        break;
      }
      case 'glasses': {
        ctx.lineWidth = 3.4; ctx.strokeStyle = OUTLINE;
        for (const x of [5, 15]) { ctx.beginPath(); ctx.arc(x, -56, 4.6, 0, Math.PI * 2); ctx.stroke(); }
        ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffffff';
        for (const x of [5, 15]) { ctx.beginPath(); ctx.arc(x, -56, 4.6, 0, Math.PI * 2); ctx.stroke(); }
        break;
      }
      case 'ring': {
        const u = (e * 2.2) % 1;
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 3; i++) {
          const r = 6 + ((u + i / 3) % 1) * 12;
          ctx.globalAlpha = 1 - ((u + i / 3) % 1);
          ctx.beginPath(); ctx.arc(16, -58, r, -0.8, 0.8); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'bow': {
        const draw = celeEase(e / 0.6), released = e > 1.3;
        const bx = 18, by = -52, R = 17;
        const top = [bx + Math.cos(-1.05) * R, by + Math.sin(-1.05) * R], bot = [bx + Math.cos(1.05) * R, by + Math.sin(1.05) * R];
        const pull = released ? [top[0] - 2, by] : [lerp(16, 0, draw), by];
        ctx.lineWidth = 1.4; ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(pull[0], pull[1]); ctx.lineTo(bot[0], bot[1]); ctx.stroke();
        ctx.lineWidth = 4.6; ctx.strokeStyle = OUTLINE;
        ctx.beginPath(); ctx.arc(bx, by, R, -1.05, 1.05); ctx.stroke();
        ctx.lineWidth = 2.6; ctx.strokeStyle = '#c47a2c';
        ctx.beginPath(); ctx.arc(bx, by, R, -1.05, 1.05); ctx.stroke();
        const arrow = (x0, x1, y) => {
          ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
          ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(x1 + 5, y); ctx.lineTo(x1 - 1, y - 3); ctx.lineTo(x1 - 1, y + 3); ctx.closePath(); ctx.fill();
        };
        if (!released) arrow(pull[0], bx + R + 4, by);
        else if (e < 2.2) { const ax = 40 + (e - 1.3) * 320; arrow(ax - 16, ax, by - (e - 1.3) * 30); }
        break;
      }
      case 'point': {
        const b = Math.sin(e * 5) * 1.2;
        for (const [x, y] of [[-18, -64 + b], [22, -65 - b]]) {
          ctx.lineWidth = 4.6; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 0.6, y - 9); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = p.look.skin; ctx.stroke();
        }
        break;
      }
      case 'phone': {
        const k = celeEase(e / 0.3), x = lerp(13, 26, k), y = lerp(-27, -64, k);
        this.rr(ctx, x - 3.5, y - 12, 8, 13, 2); this.blob(ctx, '#23263f');
        ctx.fillStyle = '#7fdcff'; ctx.fillRect(x - 1.7, y - 10.2, 4.4, 8.6);
        break;
      }
      case 'guitar': {
        const strum = Math.sin(e * 22) * 3;
        ctx.lineWidth = 5.6; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(4, -34); ctx.lineTo(21, -50); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = '#8a5a2b'; ctx.stroke();
        this.rr(ctx, 19, -57, 7, 7, 2); this.blob(ctx, '#23263f');
        // one outline round both bulges, then the fill over its inner half
        ctx.beginPath(); ctx.arc(-1, -28, 8, 0, Math.PI * 2); ctx.moveTo(12, -35); ctx.arc(6, -35, 6, 0, Math.PI * 2);
        ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.fillStyle = '#e8283a'; ctx.fill();
        ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(2, -31.5, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe14d'; ctx.fillRect(-5, -26, 7, 1.8);
        ctx.beginPath(); ctx.arc(5, -27 + strum, 3.4, 0, Math.PI * 2); this.blob(ctx, p.look.skin);
        break;
      }
      case 'surfboard': {
        ctx.beginPath(); ctx.ellipse(1, 2.5, 25, 3.8, 0, 0, Math.PI * 2); this.blob(ctx, '#ffe14d');
        ctx.fillStyle = '#ff5fa8'; ctx.fillRect(-19, 1.7, 40, 1.8);
        break;
      }
      case 'bowlball': {
        if (e >= 0.98) break;
        const th = celeBowlAngle(e), x = e < 0.45 ? 14 + e * 10 : 10 + Math.sin(th) * 25, y = e < 0.45 ? -36 : -41 + Math.cos(th) * 25;
        ctx.beginPath(); ctx.arc(x, y + 1, 5.2, 0, Math.PI * 2); this.blob(ctx, '#2f7bff');
        ctx.fillStyle = OUTLINE;
        for (const [dx, dy] of [[-1.6, -1.2], [1, -1.8], [-0.2, 0.8]]) { ctx.beginPath(); ctx.arc(x + dx, y + 1 + dy, 0.8, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'golf': {
        const th = celeGolf(e), s = Math.sin(th), c = Math.cos(th);
        const hx = 2 + s * 20, hy = -41 + c * 20, cx = 2 + s * 41, cy = -41 + c * 41;
        ctx.lineWidth = 3.8; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#c9d2de'; ctx.stroke();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-th); this.rr(ctx, -2, -2.2, 9, 4.6, 1.5); this.blob(ctx, '#23263f'); ctx.restore();
        ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, Math.PI * 2); this.blob(ctx, '#ffffff');
        break;
      }
      case 'rod': {
        const a = celeRod(e), bx = 9, by = -40, tx = bx + Math.cos(a) * 32, ty = by + Math.sin(a) * 32;
        ctx.lineWidth = 3.6; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(bx - Math.cos(a) * 5, by - Math.sin(a) * 5); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#c47a2c'; ctx.stroke();
        ctx.beginPath(); ctx.arc(bx + Math.cos(a) * 3, by + Math.sin(a) * 3 + 2.5, 2.6, 0, Math.PI * 2); this.blob(ctx, '#8e99ad');
        // the line: flying out, bobbing on the grass, then a fish on the end
        let ex, ey;
        if (e < 0.55) { ex = tx; ey = ty + 6; }
        else if (e < 0.8) { const u = (e - 0.55) / 0.25; ex = lerp(tx, 46, u); ey = lerp(ty, -1, u) - Math.sin(u * Math.PI) * 18; }
        else if (e < 1.6) { ex = 46; ey = -1 + Math.sin(e * 7) * 1.2 + (e > 1.3 ? Math.sin(e * 40) * 1.5 : 0); }
        else if (e < 1.85) { const u = (e - 1.6) / 0.25; ex = lerp(46, tx + 2, u); ey = lerp(-1, ty + 14, u) - Math.sin(u * Math.PI) * 24; }
        else { ex = tx + 1 + Math.sin(e * 16) * 2; ey = ty + 14; }
        ctx.lineWidth = 1.1; ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + ex) / 2, Math.max(ty, ey) + 4, ex, ey); ctx.stroke();
        if (e < 1.6) {
          ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); this.blob(ctx, '#ff3a3f');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(ex - 2.4, ey - 0.6, 4.8, 1.3);
        } else {
          ctx.save(); ctx.translate(ex, ey + 6); ctx.rotate(Math.PI / 2 + Math.sin(e * 16) * 0.4);
          ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(11, -4.5); ctx.lineTo(11, 4.5); ctx.closePath(); this.blob(ctx, '#ff9a1f');
          ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 4, 0, 0, Math.PI * 2); this.blob(ctx, '#ff9a1f');
          ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(-4, -1, 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'trophy': {
        const k = celeEase(e / 0.35), b = Math.abs(Math.sin(e * 7)) * 2 * k;
        ctx.save(); ctx.translate(1.5, lerp(-30, -66, k) - b);
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.arc(s * 8, -16, 4, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5);
          ctx.lineWidth = 4.4; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffc21a'; ctx.stroke();
        }
        this.rr(ctx, -2, -10, 4, 8, 1); this.blob(ctx, '#ffc21a');
        this.rr(ctx, -6.5, -3, 13, 4.5, 1.5); this.blob(ctx, '#c98a12');
        ctx.beginPath(); ctx.moveTo(-9, -25); ctx.lineTo(9, -25); ctx.quadraticCurveTo(9, -9, 0, -9); ctx.quadraticCurveTo(-9, -9, -9, -25); ctx.closePath(); this.blob(ctx, '#ffc21a');
        ctx.fillStyle = '#fff3a0'; ctx.fillRect(-5.5, -22.5, 2.4, 8);
        ctx.restore();
        break;
      }
      case 'cash': {
        this.rr(ctx, -1, -47, 11, 7, 1.5); this.blob(ctx, '#3fbf5a');
        ctx.fillStyle = '#2a8a3f'; ctx.fillRect(1, -45, 7, 1.2); ctx.fillRect(1, -42.6, 7, 1.2);
        break;
      }
    }
  },

  // props drawn upright on screen (text and floating shapes)
  celebScreen(ctx, name, e, sx, sy, k, flip, cp) {
    const headY = sy - (76 + Math.max(0, cp.jump || 0)) * k;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    switch (name) {
      case 'siuu': {
        const pop = clamp((e - 1.1) / 0.18, 0, 1);
        Render.chunkyText(ctx, 'SIUUU!', sx, headY - 14 * k - pop * 6 * k, 15 * k * (0.5 + 0.5 * pop), '#ffe14d', 4 * k);
        break;
      }
      case 'shh': {
        ctx.globalAlpha = 0.6 + Math.sin(e * 6) * 0.4;
        Render.chunkyText(ctx, 'SHH', sx + 24 * k * flip, headY + 8 * k, 9 * k, '#ffffff', 3 * k);
        ctx.globalAlpha = 1;
        break;
      }
      case 'heart': {
        const s = (7 + Math.sin(e * 9) * 1.2) * k, x = sx + 1 * k * flip, y = headY - 12 * k;
        ctx.beginPath();
        ctx.moveTo(x, y + 0.9 * s);
        ctx.bezierCurveTo(x - 1.3 * s, y + 0.05 * s, x - 0.75 * s, y - 0.85 * s, x, y - 0.25 * s);
        ctx.bezierCurveTo(x + 0.75 * s, y - 0.85 * s, x + 1.3 * s, y + 0.05 * s, x, y + 0.9 * s);
        ctx.closePath();
        ctx.fillStyle = '#ff3a5c'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
        break;
      }
      case 'zzz': {
        for (let i = 0; i < 3; i++) {
          const u = (e * 0.7 + i / 3) % 1;
          ctx.globalAlpha = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
          Render.chunkyText(ctx, 'Z', sx + (-50 + u * 20) * k * flip, sy - (18 + u * 38) * k, (7 + u * 7) * k, '#ffffff', 2.6 * k);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'think': {
        const x = sx + 24 * k * flip, y = headY + 2 * k;
        ctx.globalAlpha = clamp((e - 0.7) / 0.3, 0, 1);
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE;
        for (const [dx, dy, r] of [[-12, 10, 2], [-7, 4, 3]]) { ctx.beginPath(); ctx.arc(x + dx * k * flip, y + dy * k, r * k, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.6 * k; ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(x + 4 * k * flip, y - 7 * k, 11 * k, 8 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2 * k; ctx.stroke();
        Render.chunkyText(ctx, '?', x + 4 * k * flip, y - 7 * k, 11 * k, '#ffe14d', 2.6 * k);
        ctx.globalAlpha = 1;
        break;
      }
      case 'flash': {
        const u = clamp((e - 1.0) / 0.3, 0, 1), x = sx + 30 * k * flip, y = sy - 78 * k, r = (6 + u * 10) * k;
        ctx.globalAlpha = 1 - u;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, d = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
        ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'notes': {
        for (let i = 0; i < 3; i++) {
          const u = (e * 0.8 + i / 3) % 1;
          const x = sx + (14 + u * 26 + i * 4) * k * flip, y = sy - (40 + u * 40) * k;
          ctx.globalAlpha = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
          ctx.beginPath(); ctx.moveTo(x + 2.6 * k, y); ctx.lineTo(x + 2.6 * k, y - 10 * k); ctx.lineTo(x + 7 * k, y - 7 * k);
          ctx.lineWidth = 3.2 * k; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 1.4 * k; ctx.strokeStyle = '#ffe14d'; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x, y, 3.2 * k, 2.4 * k, -0.4, 0, Math.PI * 2); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'stomp': {
        const c = (e * 1.6) % 1, u = clamp((c - 0.7) / 0.25, 0, 1);
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = '#e9dfc4'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6 * k;
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(sx + s * (14 + u * 18 + i * 7) * k, sy - (2 + i * 2 + u * 4) * k, (4 - i) * k * (1 - u * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'hiya': {
        Render.chunkyText(ctx, 'HI-YAH!', sx + 6 * k * flip, headY - 8 * k, 11 * k, '#ff5a3c', 3 * k);
        break;
      }
      case 'bowl': {
        const f = e - 0.98, x = sx + (34 + f * 170) * k * flip, y = sy - 5.2 * k;
        ctx.beginPath(); ctx.arc(x, y, 5.2 * k, 0, Math.PI * 2); ctx.fillStyle = '#2f7bff'; ctx.fill(); ctx.lineWidth = 2.2 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.fillStyle = OUTLINE;
        for (let i = 0; i < 3; i++) { const a = f * 12 * flip + i * 0.7; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.4 * k, y + Math.sin(a) * 2.4 * k, 0.8 * k, 0, Math.PI * 2); ctx.fill(); }
        if (e > 1.7) { const pop = clamp((e - 1.7) / 0.15, 0, 1); Render.chunkyText(ctx, 'STRIKE!', sx, headY - 10 * k, 13 * k * (0.5 + 0.5 * pop), '#ffe14d', 3.5 * k); }
        break;
      }
      case 'golfball': {
        const f = e - 1.02;
        const x = sx + (8 + Math.max(0, f) * 230) * k * flip, y = sy - (2 + (f > 0 ? Math.sin(Math.min(1, f / 1.3) * Math.PI) * 60 : 0)) * k;
        ctx.beginPath(); ctx.arc(x, y, 2.6 * k, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
        break;
      }
      case 'splash': {
        for (let i = 0; i < 6; i++) {
          const u = (e * 1.8 + i / 6) % 1, side = i % 2 ? 1 : -1;
          ctx.globalAlpha = 1 - u;
          ctx.beginPath(); ctx.arc(sx + (40 + side * u * 12 + i * 2) * k * flip, sy - (4 + Math.sin(u * Math.PI) * 18) * k, (2.6 - u) * k, 0, Math.PI * 2);
          ctx.fillStyle = '#7fdcff'; ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'bullets': {
        for (let i = 0; i < 3; i++) {
          const u = (e * 1.1 + i * 0.37) % 1, x = sx + (60 - u * 130) * k * flip, y = sy - (52 + i * 9) * k;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4 * k;
          for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(x + (8 + j * 2) * k * flip, y + (j - 1) * 2 * k); ctx.lineTo(x + (20 + j * 6) * k * flip, y + (j - 1) * 2 * k); ctx.stroke(); }
          ctx.beginPath(); ctx.ellipse(x, y, 5 * k, 2.2 * k, 0, 0, Math.PI * 2); ctx.fillStyle = '#c9d2de'; ctx.fill(); ctx.lineWidth = 1.4 * k; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
        break;
      }
      case 'confetti': {
        const cols = ['#ff3a3f', '#ffe14d', '#2f7bff', '#3fcf4a', '#ff5fa8', '#ffffff'];
        for (let i = 0; i < 18; i++) {
          const u = (e * 0.55 + ((i * 0.618) % 1)) % 1;
          ctx.save(); ctx.translate(sx + ((((i * 37) % 80) - 40) + Math.sin(e * 3 + i) * 4) * k, sy - (110 - u * 110) * k); ctx.rotate(e * 5 + i);
          ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-2 * k, -1.2 * k, 4 * k, 2.4 * k);
          ctx.restore();
        }
        break;
      }
      case 'money': {
        for (let i = 0; i < 7; i++) {
          const u = (e * 0.9 + i / 7) % 1;
          const x = sx + (20 + u * 22 + ((i * 13) % 9) - 4 + Math.sin(u * 9 + i) * 4) * k * flip, y = sy - (58 + Math.sin(u * Math.PI) * 26 - u * u * 54) * k;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(u * 8 + i) * 0.7);
          ctx.fillStyle = '#3fbf5a'; ctx.fillRect(-4.5 * k, -2.4 * k, 9 * k, 4.8 * k);
          ctx.lineWidth = 1.2 * k; ctx.strokeStyle = OUTLINE; ctx.strokeRect(-4.5 * k, -2.4 * k, 9 * k, 4.8 * k);
          ctx.fillStyle = '#2a8a3f'; ctx.beginPath(); ctx.arc(0, 0, 1.3 * k, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        break;
      }
    }
  },

  leg(ctx, x1, y1, x2, y2, skin, sock) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 9.8;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 6.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const mx = lerp(x1, x2, 0.45), my = lerp(y1, y2, 0.45);
    ctx.strokeStyle = sock; ctx.lineWidth = 6.8; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineCap = 'round';
  },

  boot(ctx, x, y, color, lifted) {
    ctx.beginPath(); ctx.ellipse(x + 3, y + 0.5, 7.2, 4.2, lifted ? -0.35 : 0, 0, Math.PI * 2);
    this.blob(ctx, color);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 0.5, y - 0.5); ctx.lineTo(x + 6, y - 1.8); ctx.stroke();
  },

  head(ctx, look, back, t, p) {
    const hx = 1.5, hy = -56, R = 15, seed = p ? p.seed || 0 : 0;
    const style = look.hair;
    const hc = look.hairColor, hl = shadeHex(hc, 0.28);
    // neck
    ctx.fillStyle = look.skin; ctx.fillRect(-2.5, -47, 7, 5);
    if (style === 'robot') {
      this.rr(ctx, hx - 14, hy - 14, 28, 27, 8); this.blob(ctx, '#cfd8e3');
      ctx.fillStyle = '#9aa7b8'; ctx.fillRect(hx - 14, hy + 6, 28, 4);
      ctx.fillStyle = '#e9eef5'; ctx.fillRect(hx - 9, hy - 11, 12, 3);
      if (!back) { this.rr(ctx, hx - 4, hy - 6, 18, 9, 4); this.blob(ctx, '#46d9ff'); ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 7, hy - 4, 4, 2.5); }
      ctx.lineWidth = 2.6; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(hx, hy - 14); ctx.lineTo(hx, hy - 22); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy - 23.5, 3.2, 0, Math.PI * 2); this.blob(ctx, '#ff3a3f');
      return;
    }

    // face / back of head
    ctx.beginPath(); ctx.ellipse(hx, hy, R, R * 0.96, 0, 0, Math.PI * 2);
    this.blob(ctx, back ? hc : look.skin);
    if (!back) {
      // cel shade: darker crescent on the side facing away from the light
      // shade crescent from two nested ellipses (no clip — clipping is slow)
      ctx.fillStyle = look.shade || (look.shade = shadeHex(look.skin, -0.14));
      ctx.beginPath(); ctx.ellipse(hx, hy, R - 1.2, R * 0.96 - 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.ellipse(hx + 2.4, hy - 1.6, R - 3.4, R * 0.94 - 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.hi || (look.hi = shadeHex(look.skin, 0.22));
      ctx.beginPath(); ctx.ellipse(hx + 7, hy - 7, 3.5, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    if (back) {
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.ellipse(hx, hy + 10.5, 8, 4, 0, 0, Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - R + 1, hy + 2, 3.2, 0, Math.PI * 2); ctx.arc(hx + R - 1, hy + 2, 3.2, 0, Math.PI * 2);
      this.blob(ctx, look.skin);
    } else {
      // ear on the far side, face toward facing direction
      ctx.beginPath(); ctx.arc(hx - 10.5, hy + 2, 3.6, 0, Math.PI * 2); this.blob(ctx, look.skin);
      ctx.fillStyle = OUTLINE;
      const blink = Math.sin(t * 1.3 + (p ? p.seed : 0)) > 0.985;
      for (const ex of [5.2, 11.6]) {
        if (blink) { ctx.fillRect(hx + ex - 2, hy + 1, 4, 1.6); continue; }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(hx + ex, hy + 1.2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = OUTLINE;
        ctx.beginPath(); ctx.ellipse(hx + ex + 0.8, hy + 1.8, 2.2, 3.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(hx + ex + 1.5, hy + 0.3, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = OUTLINE;
      }
      // brows
      ctx.strokeStyle = shadeHex(hc, -0.2); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      const angry = p && (p.slideT > 0 || p.charging);
      ctx.beginPath(); ctx.moveTo(hx + 3, hy - 4.5 + (angry ? 1 : 0)); ctx.lineTo(hx + 7.5, hy - 5.5 - (angry ? -1.2 : 0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 9.6, hy - 5.5 - (angry ? -1.2 : 0)); ctx.lineTo(hx + 13.6, hy - 4.5 + (angry ? 1 : 0)); ctx.stroke();
      // mouth
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.7;
      if (p && (p.celebrateT > 0 || p.fallT > 0) && !(p.celebrateT > 0 && CELE_CALM.has(p.celebKind))) {
        ctx.fillStyle = '#7a2230';
        ctx.beginPath(); ctx.ellipse(hx + 8.5, hy + 8.5, 3, p.fallT > 0 ? 2.4 : 2.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (p && p.sad) {
        ctx.beginPath(); ctx.arc(hx + 8.5, hy + 10.5, 2.6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(hx + 8.5, hy + 6.5, 2.6, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 110, 110, 0.35)';
      ctx.beginPath(); ctx.ellipse(hx + 1.5, hy + 6, 2.8, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.lineWidth = 2.6; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
    const tuft = (pts, fill) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(hx + x, hy + y) : ctx.moveTo(hx + x, hy + y)));
      ctx.closePath(); this.blob(ctx, fill);
    };
    switch (style) {
      case 'cap': {
        const cap = look.cap || '#2f7bff';
        ctx.beginPath(); ctx.arc(hx, hy - 1.5, R + 1.4, Math.PI * 1.03, Math.PI * 1.97); ctx.closePath();
        this.blob(ctx, cap);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(hx + (back ? -2 : 3), hy - 2, R - 3, Math.PI * 1.22, Math.PI * 1.72); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shadeHex(cap, 0.3); ctx.fillRect(hx - 2, hy - R - 1, 3, 3);
        if (!back) {
          this.rr(ctx, hx + 6, hy - 4.5, 16, 5.2, 2.5); this.blob(ctx, cap);
          tuft([[-R + 0.5, -2], [-R - 2.5, 6], [-R + 4, 4]], hc);
        } else {
          this.rr(ctx, hx - 21, hy - 4.5, 13, 5.2, 2.5); this.blob(ctx, cap);
        }
        break;
      }
      case 'spikes': {
        const spikes = back
          ? [[-R, 2], [-R - 3, -12], [-9, -10], [-8, -26], [-1, -15], [4, -29], [7, -14], [15, -22], [R, -4], [R, 6], [0, 8]]
          : [[-R, 4], [-R - 4, -10], [-10, -9], [-9, -26], [-2, -15], [3, -30], [7, -15], [15, -24], [R - 1, -8], [R + 3, -2], [9, -5], [5, -1], [0, -5], [-6, -1]];
        tuft(spikes, hc);
        ctx.fillStyle = hl;
        ctx.beginPath(); ctx.moveTo(hx - 7, hy - 22); ctx.lineTo(hx - 3, hy - 13); ctx.lineTo(hx - 8, hy - 12); ctx.closePath(); ctx.fill();
        break;
      }
      case 'curly': {
        const pts = back ? 11 : 8;
        for (let i = 0; i < pts; i++) {
          const a = Math.PI * (back ? 0.75 + (1.5 * i) / (pts - 1) : 0.92 + (1.16 * i) / (pts - 1));
          ctx.beginPath(); ctx.arc(hx + Math.cos(a) * (R - 1), hy - 2 + Math.sin(a) * (R - 1), 6.2, 0, Math.PI * 2);
          this.blob(ctx, hc);
        }
        ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(hx, hy - 4, R - 3, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(hx - 4, hy - 12, 2.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'buzz': {
        ctx.beginPath(); ctx.arc(hx, hy, R + 0.4, Math.PI * 1.02, Math.PI * 1.98);
        if (!back) ctx.quadraticCurveTo(hx + 4, hy - 7, hx - R + 1, hy - 1);
        ctx.closePath(); this.blob(ctx, hc);
        break;
      }
      case 'bandana': {
        const band = look.band || '#ff3a3f';
        tuft([[-R - 1, 4], [-R - 2, -2], [-R + 2, 6]], hc);
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 1.2, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath();
        this.blob(ctx, band);
        ctx.fillStyle = '#ffffff';
        for (const [dx, dy] of [[-7, -8], [0, -11], [7, -8], [-3, -4], [4, -4]]) { ctx.beginPath(); ctx.arc(hx + dx, hy + dy, 1.3, 0, Math.PI * 2); ctx.fill(); }
        const wave = Math.sin(t * 12 + (p ? p.seed : 0)) * 2;
        tuft([[-R, -2], [-R - 10, -6 + wave], [-R - 8, 2 + wave]], band);
        tuft([[-R, -1], [-R - 7, 4 + wave], [-R - 3, 6]], band);
        break;
      }
      case 'beanie': {
        const cap = look.cap || '#ff8a1f';
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 1.6, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath();
        this.blob(ctx, cap);
        this.rr(ctx, hx - R - 2, hy - 4, R * 2 + 4, 5.5, 2.5); this.blob(ctx, shadeHex(cap, -0.18));
        ctx.strokeStyle = shadeHex(cap, -0.25); ctx.lineWidth = 1.4;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(hx + i * 5, hy - 5); ctx.lineTo(hx + i * 4, hy - R + 1); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(hx, hy - R - 4, 4.2, 0, Math.PI * 2); this.blob(ctx, '#ffffff');
        break;
      }
      case 'mohawk': {
        ctx.beginPath(); ctx.arc(hx, hy, R + 0.2, Math.PI * 1.05, Math.PI * 1.95);
        ctx.closePath(); this.blob(ctx, shadeHex(look.skin, -0.32)); // shaved sides
        tuft([[-6, -12], [-8, -24], [-3, -18], [-1, -31], [3, -19], [6, -29], [7, -16], [10, -22], [8, -10], [1, -13]], hc);
        ctx.fillStyle = shadeHex(hc, 0.35);
        ctx.beginPath(); ctx.moveTo(hx - 3, hy - 24); ctx.lineTo(hx, hy - 16); ctx.lineTo(hx - 4, hy - 15); ctx.closePath(); ctx.fill();
        break;
      }
      case 'afro': {
        ctx.beginPath(); ctx.arc(hx - 1, hy - 7, R + 8, Math.PI * 0.8, Math.PI * 2.2);
        ctx.closePath(); this.blob(ctx, hc);
        if (!back) {
          ctx.fillStyle = look.skin;
          ctx.beginPath(); ctx.ellipse(hx + 3, hy + 3, R - 2.5, R - 5, 0, 0, Math.PI * 2); ctx.fill();
          // redraw the face features the hair just covered
          ctx.fillStyle = '#ffffff';
          for (const ex of [5.2, 11.6]) { ctx.beginPath(); ctx.ellipse(hx + ex, hy + 1.2, 3, 4, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = OUTLINE;
          for (const ex of [5.2, 11.6]) { ctx.beginPath(); ctx.ellipse(hx + ex + 0.8, hy + 1.8, 2.2, 3.1, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.7;
          ctx.beginPath(); ctx.arc(hx + 8.5, hy + 6.5, 2.6, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
        }
        ctx.fillStyle = shadeHex(hc, 0.25);
        for (const [dx, dy] of [[-8, -18], [4, -21], [12, -13], [-14, -8]]) { ctx.beginPath(); ctx.arc(hx + dx, hy + dy, 2, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'ponytail': {
        const swing = Math.sin(t * 9 + (p ? p.seed : 0)) * 3;
        tuft([[-R + 2, -6], [-R - 8, -2 + swing], [-R - 14, 10 + swing], [-R - 6, 8 + swing * 0.5], [-R + 1, 2]], hc);
        ctx.beginPath(); ctx.arc(hx, hy, R + 0.8, Math.PI * 1.0, Math.PI * 1.98);
        if (!back) ctx.quadraticCurveTo(hx + 6, hy - 9, hx - R + 2, hy - 2);
        ctx.closePath(); this.blob(ctx, hc);
        ctx.fillStyle = shadeHex(hc, -0.2); ctx.fillRect(hx - R - 3, hy - 6, 4, 4);
        break;
      }
      case 'goggles': {
        const spikes = back
          ? [[-R, 2], [-R - 3, -12], [-9, -10], [-8, -24], [-1, -15], [4, -27], [7, -14], [15, -20], [R, -4], [R, 6], [0, 8]]
          : [[-R, 4], [-R - 4, -10], [-10, -9], [-9, -24], [-2, -15], [3, -27], [7, -15], [15, -22], [R - 1, -8], [R + 3, -2], [9, -5], [5, -1], [0, -5], [-6, -1]];
        tuft(spikes, hc);
        // strap round the forehead, lenses pushed up on the front
        this.rr(ctx, hx - R - 1.5, hy - 12, R * 2 + 3, 4.5, 2); this.blob(ctx, '#2a2d45');
        if (!back) {
          for (const ex of [3, 11.5]) {
            ctx.beginPath(); ctx.arc(hx + ex, hy - 11, 4.6, 0, Math.PI * 2); this.blob(ctx, '#ffc21a');
            ctx.fillStyle = '#46d9ff'; ctx.beginPath(); ctx.arc(hx + ex, hy - 11, 2.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + ex - 1.6, hy - 13, 1.8, 1.8);
          }
        }
        break;
      }
      case 'viking': {
        if (!back) {
          // big braided beard over the chin
          tuft([[-6, 4], [-5, 13], [0, 20], [6, 23], [12, 19], [16, 10], [15, 3], [11, 8], [5, 9], [0, 7]], hc);
          ctx.fillStyle = shadeHex(hc, 0.3);
          ctx.beginPath(); ctx.arc(hx + 6, hy + 15, 1.6, 0, Math.PI * 2); ctx.arc(hx + 1, hy + 11, 1.3, 0, Math.PI * 2); ctx.fill();
        } else {
          tuft([[-R, 2], [-R - 1, 10], [-R + 6, 8]], hc);
        }
        // horns first so the helmet overlaps their roots
        tuft([[-R + 3, -9], [-R - 5, -13], [-R - 7, -24], [-R - 1, -17], [-R + 6, -13]], '#fff3d6');
        tuft([[R - 3, -9], [R + 5, -13], [R + 7, -24], [R + 1, -17], [R - 6, -13]], '#fff3d6');
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 1.6, Math.PI, Math.PI * 2); ctx.closePath();
        this.blob(ctx, '#aab4c6');
        ctx.fillStyle = '#d7dde8'; ctx.beginPath(); ctx.ellipse(hx - 4, hy - 11, 4, 2.2, -0.4, 0, Math.PI * 2); ctx.fill();
        this.rr(ctx, hx - R - 2.5, hy - 5, R * 2 + 5, 5.5, 2.5); this.blob(ctx, '#6b7690');
        ctx.fillStyle = '#d7dde8';
        for (const dx of [-10, -3, 4, 11]) { ctx.beginPath(); ctx.arc(hx + dx, hy - 2.2, 1.1, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'crown': {
        tuft([[-R, 4], [-R - 4, -10], [-10, -9], [-9, -24], [-2, -14], [3, -27], [7, -14], [15, -22], [R - 1, -8], [R + 3, -2], [9, -5], [5, -1], [0, -5], [-6, -1]], hc);
        const cy = hy - R - 6;
        tuft([[-9, -R - 2], [-11, -R - 14], [-5, -R - 8], [0, -R - 17], [5, -R - 8], [11, -R - 14], [9, -R - 2]], '#ffc21a');
        ctx.fillStyle = '#ff3a3f'; ctx.beginPath(); ctx.arc(hx, cy - 2, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#46d9ff'; ctx.beginPath(); ctx.arc(hx - 6, cy + 1, 1.4, 0, Math.PI * 2); ctx.arc(hx + 6, cy + 1, 1.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'dreads': {
        const sway = Math.sin(t * 6 + seed) * 1.6;
        const lock = (x1, y1, x2, y2) => {
          ctx.lineCap = 'round';
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6.6; ctx.beginPath(); ctx.moveTo(hx + x1, hy + y1); ctx.lineTo(hx + x2, hy + y2); ctx.stroke();
          ctx.strokeStyle = hc; ctx.lineWidth = 4; ctx.stroke();
        };
        for (const x of back ? [-12, -6, 0, 6, 12] : [-15, -11, -7]) lock(x, -9, x - 3 + sway, 17);
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 1.2, Math.PI * 1.02, Math.PI * 1.98);
        if (!back) ctx.quadraticCurveTo(hx + 5, hy - 8, hx - R + 1, hy - 1);
        ctx.closePath(); this.blob(ctx, hc);
        ctx.fillStyle = '#ffc21a';
        for (const x of back ? [-8, 0, 8] : [-12]) { ctx.fillRect(hx + x - 2.4, hy + 6, 4.8, 2.2); }
        break;
      }
      case 'samurai': {
        ctx.beginPath(); ctx.arc(hx, hy, R + 0.4, Math.PI * 1.02, Math.PI * 1.98);
        if (!back) ctx.quadraticCurveTo(hx + 4, hy - 7, hx - R + 1, hy - 1);
        ctx.closePath(); this.blob(ctx, hc);
        this.rr(ctx, hx - 3.5, hy - R - 8, 7, 9, 2.5); this.blob(ctx, hc);
        ctx.beginPath(); ctx.arc(hx, hy - R - 10, 4.6, 0, Math.PI * 2); this.blob(ctx, hc);
        const band = look.band || '#ff3a3f';
        this.rr(ctx, hx - R - 1, hy - 9, R * 2 + 2, 4.6, 2); this.blob(ctx, band);
        const wave = Math.sin(t * 12 + seed) * 2;
        tuft([[-R, -8], [-R - 11, -10 + wave], [-R - 9, -3 + wave]], band);
        break;
      }
      case 'cowboy': {
        const hat = look.cap || '#a8652c';
        tuft([[-R + 1, 1], [-R - 2, 9], [-R + 5, 6]], hc);
        ctx.beginPath(); ctx.ellipse(hx + (back ? 0 : 2), hy - 8, R + 11, 4.4, 0, 0, Math.PI * 2); this.blob(ctx, hat);
        ctx.beginPath(); ctx.moveTo(hx - 10, hy - 9); ctx.lineTo(hx - 9, hy - 25); ctx.quadraticCurveTo(hx, hy - 20, hx + 9, hy - 25); ctx.lineTo(hx + 10, hy - 9); ctx.closePath();
        this.blob(ctx, hat);
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(hx - 9.6, hy - 14, 19.2, 3.2);
        ctx.fillStyle = shadeHex(hat, 0.28); ctx.fillRect(hx - 6, hy - 22, 3, 6);
        break;
      }
      case 'pirate': {
        tuft([[-R, 2], [-R - 3, 12], [-R + 4, 8]], hc);
        tuft([[-R - 7, -5], [-R + 1, -25], [0, -19], [R - 1, -25], [R + 8, -5], [0, -9]], '#1b1b2a');
        ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(hx - R - 5, hy - 6.5); ctx.lineTo(hx, hy - 10); ctx.lineTo(hx + R + 6, hy - 6.5); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + 1, hy - 17, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = OUTLINE; ctx.fillRect(hx - 0.6, hy - 17.8, 1, 1); ctx.fillRect(hx + 1.8, hy - 17.8, 1, 1);
        break;
      }
      case 'knight': {
        const plume = look.band || '#ff3a3f', wave = Math.sin(t * 8 + seed) * 2;
        tuft([[-2, -R - 2], [-7, -R - 17 + wave], [-17, -R - 13 + wave], [-10, -R - 3]], plume);
        ctx.beginPath(); ctx.arc(hx, hy, R + 1.8, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); this.blob(ctx, '#aab4c6');
        this.rr(ctx, hx - R - 1.8, hy - 3, 7, 14, 3); this.blob(ctx, '#8e99ad');
        if (!back) { ctx.fillStyle = OUTLINE; ctx.fillRect(hx - 1, hy - 7, 18, 2.6); ctx.fillRect(hx + 7, hy - 12, 2.2, 7); }
        ctx.fillStyle = '#d7dde8'; ctx.beginPath(); ctx.ellipse(hx - 4, hy - 11, 4, 2.2, -0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'pharaoh': {
        tuft([[-R + 1, -6], [-R - 6, 10], [-R - 4, 19], [-R + 6, 12]], '#2f5bd6');
        ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 1.8;
        for (const dy of [4, 10]) { ctx.beginPath(); ctx.moveTo(hx - R - 4, hy + dy); ctx.lineTo(hx - R + 3, hy + dy + 1); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 1.8, Math.PI, Math.PI * 2); ctx.closePath(); this.blob(ctx, '#ffc21a');
        ctx.strokeStyle = '#2f5bd6'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx, hy - 1, R - 2 - i * 4, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
        if (!back) { ctx.beginPath(); ctx.arc(hx + 7, hy - R - 2, 2.6, 0, Math.PI * 2); this.blob(ctx, '#2f5bd6'); }
        break;
      }
      case 'shark': {
        const g = hc;
        tuft([[-7, -R], [-3, -R - 15], [6, -R - 1]], g);
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 2.4, Math.PI, Math.PI * 2); ctx.closePath(); this.blob(ctx, g);
        ctx.fillStyle = shadeHex(g, 0.3); ctx.beginPath(); ctx.ellipse(hx - 3, hy - 11, 5, 2.4, -0.3, 0, Math.PI * 2); ctx.fill();
        if (!back) {
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 5; i++) { const x = hx - 2 + i * 3.8; ctx.beginPath(); ctx.moveTo(x, hy - 1.6); ctx.lineTo(x + 1.9, hy + 1.8); ctx.lineTo(x + 3.8, hy - 1.6); ctx.closePath(); ctx.fill(); }
          ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(hx - 7, hy - 8, 1.8, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'lion': {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(hx + Math.cos(a) * (R + 3), hy + Math.sin(a) * (R + 2.5), 7.4, 0, Math.PI * 2);
          this.blob(ctx, i % 2 ? hc : shadeHex(hc, -0.18));
        }
        // the mane went over the face: put the face back
        ctx.beginPath(); ctx.ellipse(hx, hy, R, R * 0.96, 0, 0, Math.PI * 2); this.blob(ctx, back ? hc : look.skin);
        if (!back) this.faceAgain(ctx, hx, hy);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * 9, hy - R - 1, 3.6, 0, Math.PI * 2); this.blob(ctx, shadeHex(hc, -0.18)); }
        break;
      }
      case 'wizard': {
        const hat = look.cap || '#5b3bd6';
        if (!back) tuft([[-4, 5], [-3, 14], [3, 22], [9, 25], [15, 19], [17, 9], [14, 4], [8, 8], [2, 8]], hc);
        ctx.beginPath(); ctx.ellipse(hx, hy - 8, R + 8, 4.6, 0, 0, Math.PI * 2); this.blob(ctx, hat);
        const tip = Math.sin(t * 3 + seed) * 2.5;
        tuft([[-11, -10], [-3 + tip, -R - 27], [5 + tip, -R - 22], [11, -10]], hat);
        this.star(ctx, hx - 1, hy - 19, 3.6, '#ffe14d');
        this.star(ctx, hx + 5, hy - 27, 2.2, '#ffffff');
        break;
      }
      case 'astronaut': {
        ctx.beginPath(); ctx.arc(hx, hy, R + 0.4, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); this.blob(ctx, '#6b3f22');
        this.rr(ctx, hx - 15, hy + 12, 30, 6, 3); this.blob(ctx, '#e9eef5');
        ctx.globalAlpha = 0.3; ctx.fillStyle = '#bff3ff';
        ctx.beginPath(); ctx.arc(hx, hy - 1, R + 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.arc(hx, hy - 1, R + 6, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.6; ctx.strokeStyle = '#e9eef5'; ctx.beginPath(); ctx.arc(hx, hy - 1, R + 4.4, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(hx + 9, hy - 13, 4, 1.8, -0.7, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ice': {
        const spikes = back
          ? [[-R, 2], [-R - 4, -12], [-9, -12], [-8, -30], [-1, -16], [4, -33], [7, -15], [15, -26], [R + 1, -4], [R, 6], [0, 8]]
          : [[-R, 4], [-R - 5, -9], [-11, -12], [-12, -29], [-4, -16], [0, -35], [5, -17], [12, -31], [12, -14], [R + 5, -12], [R, -3], [9, -6], [4, -2], [-2, -6], [-8, -2]];
        tuft(spikes, hc);
        ctx.fillStyle = '#ffffff';
        for (const [x, y] of back ? [[-7, -25], [4, -28], [13, -21]] : [[-10, -24], [1, -30], [11, -26]]) { ctx.beginPath(); ctx.moveTo(hx + x, hy + y); ctx.lineTo(hx + x + 2.5, hy + y + 6); ctx.lineTo(hx + x - 1, hy + y + 5); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'flame': {
        const f = (i) => Math.sin(t * 16 + i * 1.7 + seed) * 2.6;
        tuft([[-R, 4], [-R - 4, -10 + f(0)], [-10, -9], [-12, -29 + f(1)], [-3, -17], [0, -37 + f(2)], [5, -17], [12, -31 + f(3)], [11, -13], [R + 5, -15 + f(4)], [R, -3], [0, -5]], hc);
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); [[-9, -8], [-8, -22 + f(1) * 0.6], [-2, -14], [0, -28 + f(2) * 0.6], [4, -14], [9, -24 + f(3) * 0.6], [9, -9]].forEach(([x, y], i) => (i ? ctx.lineTo(hx + x, hy + y) : ctx.moveTo(hx + x, hy + y)));
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'galaxy': {
        const hair = back
          ? [[-R - 1, 4], [-R - 3, -8], [-11, -15], [-6, -20], [0, -18], [5, -21], [10, -16], [R + 2, -9], [R + 1, 5], [0, 9]]
          : [[-R - 1, 5], [-R - 5, -5], [-13, -11], [-15, -19], [-8, -17], [-5, -25], [0, -19], [5, -26], [8, -18], [15, -20], [R + 1, -10], [R + 3, -5], [11, -6], [8, -1], [4, -6], [0, -2], [-5, -6], [-9, 1]];
        tuft(hair, hc);
        const tw = (i) => 0.55 + 0.45 * Math.sin(t * 5 + i * 2.1 + seed);
        for (const [i, x, y, c] of [[0, -9, -14, '#ffffff'], [1, -1, -19, '#ffe14d'], [2, 7, -14, '#7fdcff'], [3, -12, -5, '#ffffff'], [4, 3, -9, '#ff9ee8']]) {
          ctx.globalAlpha = tw(i); this.star(ctx, hx + x, hy + y, 2.1, c); ctx.globalAlpha = 1;
        }
        break;
      }
      case 'flattop': {
        this.rr(ctx, hx - R + 1, hy - R - 12, R * 2 - 2, 17, 3); this.blob(ctx, hc);
        ctx.beginPath(); ctx.arc(hx, hy, R + 0.4, Math.PI * 1.02, Math.PI * 1.98);
        if (!back) ctx.quadraticCurveTo(hx + 4, hy - 7, hx - R + 1, hy - 1);
        ctx.closePath(); this.blob(ctx, hc);
        ctx.fillStyle = hl; ctx.fillRect(hx - R + 4, hy - R - 9, 11, 2);
        ctx.fillStyle = '#ffc21a'; ctx.fillRect(hx - R + 1.5, hy - R - 2, R * 2 - 3, 2.2);
        break;
      }
      case 'goat': {
        const hair = back
          ? [[-R - 1, 4], [-R - 3, -8], [-11, -15], [-6, -20], [0, -18], [5, -21], [10, -16], [R + 2, -9], [R + 1, 5], [0, 9]]
          : [[-R - 1, 5], [-R - 5, -5], [-13, -11], [-15, -19], [-8, -17], [-5, -25], [0, -19], [5, -26], [8, -18], [15, -20], [R + 1, -10], [R + 3, -5], [11, -6], [8, -1], [4, -6], [0, -2], [-5, -6], [-9, 1]];
        tuft(hair, hc);
        // curled golden horns
        for (const s of [-1, 1]) {
          const x0 = hx + s * 8, y0 = hy - R + 1;
          ctx.lineCap = 'round';
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6.4;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + s * 9, y0 - 12, x0 + s * 13, y0 - 2); ctx.stroke();
          ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 3.8; ctx.stroke();
        }
        this.star(ctx, hx + 1, hy - R - 7, 3, '#ffe14d');
        break;
      }
      case 'ninja':
      case 'headband':
      case 'messy':
      default: {
        const hair = back
          ? [[-R - 1, 4], [-R - 3, -8], [-11, -15], [-6, -20], [0, -18], [5, -21], [10, -16], [R + 2, -9], [R + 1, 5], [0, 9]]
          : [[-R - 1, 5], [-R - 5, -5], [-13, -11], [-15, -19], [-8, -17], [-5, -25], [0, -19], [5, -26], [8, -18], [15, -20], [R + 1, -10], [R + 3, -5], [11, -6], [8, -1], [4, -6], [0, -2], [-5, -6], [-9, 1]];
        tuft(hair, hc);
        ctx.fillStyle = hl;
        ctx.beginPath(); ctx.moveTo(hx - 6, hy - 17); ctx.lineTo(hx + 1, hy - 15); ctx.lineTo(hx - 4, hy - 12); ctx.closePath(); ctx.fill();
        if (style === 'headband' || style === 'ninja') {
          const band = look.band || '#ffffff';
          ctx.save();
          ctx.beginPath(); ctx.ellipse(hx, hy, R + 0.4, R, 0, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = band; ctx.fillRect(hx - R - 2, hy - 9, R * 2 + 4, 5);
          ctx.restore();
          ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE;
          ctx.beginPath(); ctx.moveTo(hx - R + 0.5, hy - 9); ctx.lineTo(hx + R - 0.5, hy - 9); ctx.moveTo(hx - R + 0.5, hy - 4); ctx.lineTo(hx + R - 0.5, hy - 4); ctx.stroke();
          if (style === 'ninja') {
            const wave = Math.sin(t * 14 + (p ? p.seed : 0)) * 3;
            tuft([[-R + 1, -8], [-R - 13, -11 + wave], [-R - 10, -3 + wave]], band);
          }
        }
      }
    }
  },

  // eyes and a smile, for head styles that draw over the face
  faceAgain(ctx, hx, hy) {
    for (const ex of [5.2, 11.6]) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(hx + ex, hy + 1.2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(hx + ex + 0.8, hy + 1.8, 2.2, 3.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + ex + 1.5, hy + 0.3, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.arc(hx + 8.5, hy + 6.5, 2.6, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  },

  star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.35); ctx.strokeStyle = OUTLINE; ctx.stroke();
  },

  // Accessories, in sprite space (facing +x). layer: 'back' behind or over the body,
  // 'neck' on the chest, 'head' on the face or on top of the head.
  scarfTail(ctx, t, seed, speed, poly) {
    const wave = Math.sin(t * 11 + seed) * 2 + speed * 3;
    poly([[-8, -41], [-17 - speed * 9, -36 + wave], [-14 - speed * 8, -28 + wave], [-3, -37]], '#8b4dff');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-15.5 - speed * 8.5, -32 + wave); ctx.lineTo(-13 - speed * 8, -29 + wave); ctx.lineTo(-11 - speed * 6, -31 + wave); ctx.lineTo(-13.5 - speed * 6.5, -34 + wave); ctx.closePath(); ctx.fill();
  },

  accessory(ctx, id, layer, p, t, back, sp) {
    const def = ACCESSORIES.find((a) => a.id === id);
    if (!def || p.isKeeper) return;
    const hx = 1.5, hy = -56, R = 15, seed = p.seed || 0;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); this.blob(ctx, fill); };
    const speed = Math.min(1, sp || 0);
    if (layer === 'back' && id === 'scarf') { this.scarfTail(ctx, t, seed, speed, poly); return; }
    if (layer === 'back' && def.slot === 'back') {
      if (id === 'cape') {
        const wave = Math.sin(t * 10 + seed) * (2 + speed * 3), out = 4 + speed * 10;
        poly([[-9, -45], [-14 - out * 0.4, -30], [-20 - out, -6 + wave], [-9 - out * 0.5, -3 - wave], [2, -6], [9, -45]], '#e8283a');
        ctx.fillStyle = '#ffc21a'; ctx.fillRect(-9, -47, 18, 3);
      } else if (id === 'wings') {
        const flap = Math.sin(t * 7 + seed) * 0.25;
        for (const s of back ? [-1, 1] : [-1]) {
          ctx.save(); ctx.translate(s * 4, -42); ctx.rotate(s * flap); ctx.scale(s, 1);
          poly([[0, 0], [-10, -16], [-26, -22], [-34, -14], [-28, -10], [-34, -4], [-26, -1], [-30, 6], [-18, 4], [-8, 8]], '#ffffff');
          ctx.strokeStyle = '#bcd6ee'; ctx.lineWidth = 1.4;
          for (const [a, b] of [[[-10, -8], [-27, -12]], [[-9, -3], [-25, -3]], [[-8, 3], [-20, 3]]]) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
          ctx.restore();
        }
      } else if (id === 'jetpack') {
        this.rr(ctx, -19, -47, 11, 22, 3); this.blob(ctx, '#8e99ad');
        this.rr(ctx, -17, -44, 7, 5, 2); this.blob(ctx, '#ff3a3f');
        for (const nx of [-17.5, -11.5]) {
          this.rr(ctx, nx - 2.5, -26, 5, 5, 1.5); this.blob(ctx, '#4b5566');
          if (speed > 0.15 || p.celebrateT > 0) {
            const flick = 7 + Math.sin(t * 40 + nx) * 3 + speed * 6;
            poly([[nx - 2.5, -21], [nx, -21 + flick], [nx + 2.5, -21]], '#ff8a1f');
            ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(nx - 1.2, -21); ctx.lineTo(nx, -21 + flick * 0.55); ctx.lineTo(nx + 1.2, -21); ctx.closePath(); ctx.fill();
          }
        }
      }
      return;
    }
    if (layer === 'neck' && def.slot === 'neck') {
      if (id === 'scarf') {
        if (back) this.scarfTail(ctx, t, seed, speed, poly);
        this.rr(ctx, -11, -43, 25, 7.5, 3.7); this.blob(ctx, '#8b4dff');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-5, -42, 3.2, 5.5); ctx.fillRect(3.5, -42, 3.2, 5.5);
        if (!back) { this.rr(ctx, 3.5, -38, 7, 15, 2.5); this.blob(ctx, '#8b4dff'); ctx.fillStyle = '#ffffff'; ctx.fillRect(4.3, -28.5, 5.4, 2.6); }
        return;
      }
      if (back) return;
      if (id === 'chain') {
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-7, -44); ctx.quadraticCurveTo(1.5, -26, 10, -44); ctx.stroke();
        ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(1.5, -33, 4.6, 0, Math.PI * 2); this.blob(ctx, '#ffc21a');
        ctx.fillStyle = '#fff3a0'; ctx.fillRect(-0.2, -35.2, 2.2, 2.2);
      } else if (id === 'medal') {
        poly([[-4, -46], [0.5, -36], [3, -36], [-1, -46]], '#e8283a');
        poly([[7, -46], [3, -36], [0.5, -36], [4, -46]], '#2f7bff');
        ctx.beginPath(); ctx.arc(1.8, -33, 4.8, 0, Math.PI * 2); this.blob(ctx, '#ffc21a');
        this.star(ctx, 1.8, -33, 2.4, '#fff3a0');
      } else if (id === 'bowtie') {
        poly([[1.5, -36.5], [-7, -41.5], [-7, -31.5]], '#e8283a');
        poly([[1.5, -36.5], [10, -41.5], [10, -31.5]], '#e8283a');
        ctx.beginPath(); ctx.arc(1.5, -36.5, 2.6, 0, Math.PI * 2); this.blob(ctx, '#b81d2c');
      }
      return;
    }
    if (layer !== 'head') return;
    if (def.slot === 'head') {
      if (id === 'halo') {
        const bob = Math.sin(t * 4 + seed) * 1.5;
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(hx, hy - R - 12 + bob, 11, 3.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2.8; ctx.stroke();
      } else if (id === 'horns') {
        for (const s of [-1, 1]) poly([[hx + s * 4, hy - R + 4], [hx + s * 16, hy - R - 15], [hx + s * 12.5, hy - R + 2]], '#e8283a');
      } else if (id === 'partyhat') {
        poly([[hx - 8, hy - R + 2], [hx + 2, hy - R - 20], [hx + 9, hy - R + 1]], '#ff5fa8');
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx - 5, hy - R - 4); ctx.lineTo(hx + 6, hy - R - 5); ctx.moveTo(hx - 2, hy - R - 11); ctx.lineTo(hx + 4.5, hy - R - 12); ctx.stroke();
        ctx.beginPath(); ctx.arc(hx + 2, hy - R - 21, 3.2, 0, Math.PI * 2); this.blob(ctx, '#46d9ff');
      } else if (id === 'headphones') {
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.arc(hx, hy - 1, R + 2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.strokeStyle = '#2a2d45'; ctx.lineWidth = 3; ctx.stroke();
        this.rr(ctx, hx - R - 4, hy - 4, 7, 12, 3); this.blob(ctx, '#ff3a3f');
        if (back) { this.rr(ctx, hx + R - 3, hy - 4, 7, 12, 3); this.blob(ctx, '#ff3a3f'); }
      } else if (id === 'flowercrown') {
        const cols = ['#ff5fa8', '#ffe14d', '#ffffff', '#b58cff'];
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * (1.08 + (0.84 * i) / 6), x = hx + Math.cos(a) * (R - 1), y = hy - 3 + Math.sin(a) * (R - 3);
          ctx.fillStyle = '#3fcf4a'; ctx.beginPath(); ctx.ellipse(x + 3, y + 1, 2.4, 1.2, 0.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); this.blob(ctx, cols[i % cols.length]);
          ctx.fillStyle = '#ffb400'; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (id === 'propeller') {
        ctx.beginPath(); ctx.arc(hx, hy - R + 5, 8, Math.PI, Math.PI * 2); ctx.closePath(); this.blob(ctx, '#ffe14d');
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy - R - 3); ctx.lineTo(hx, hy - R - 8); ctx.stroke();
        const spin = Math.cos(t * 30 + seed) * 11;
        this.rr(ctx, hx - Math.abs(spin), hy - R - 10.5, Math.max(2, Math.abs(spin) * 2), 3.4, 1.5); this.blob(ctx, spin > 0 ? '#ff3a3f' : '#2f7bff');
      }
      return;
    }
    if (def.slot !== 'face' || back) return;
    if (id === 'shades') this.celebProp(ctx, 'shades', 0, back, p);
    else if (id === 'starshades') {
      for (const ex of [5.2, 11.6]) this.star(ctx, hx + ex, hy + 1, 5.4, '#ff5fa8');
      ctx.fillStyle = OUTLINE; ctx.fillRect(hx - 10, hy - 0.8, 10, 1.8);
    } else if (id === 'visor') {
      this.rr(ctx, hx - 12, hy - 3, 32, 8, 4); this.blob(ctx, '#46d9ff');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 6, hy - 1.5, 7, 2);
      ctx.fillStyle = 'rgba(22, 26, 51, 0.35)'; ctx.fillRect(hx - 10, hy + 2, 28, 2);
    } else if (id === 'eyepatch') {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(hx + 8, hy - 3); ctx.lineTo(hx - R + 1, hy - 9); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx + 11.6, hy + 1.4, 4.6, 5, 0, 0, Math.PI * 2); this.blob(ctx, '#1b1b2a');
    } else if (id === 'monocle') {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(hx + 11.6, hy + 1.2, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx + 11.6, hy + 6.2); ctx.quadraticCurveTo(hx + 14, hy + 13, hx + 9, hy + 16); ctx.stroke();
    } else if (id === 'mustache') {
      poly([[hx + 8.5, hy + 4.4], [hx + 3, hy + 3.8], [hx + 1.5, hy + 6.8], [hx + 4.5, hy + 6], [hx + 8.5, hy + 5.8]], '#3b2416');
      poly([[hx + 8.5, hy + 4.4], [hx + 14, hy + 3.8], [hx + 15.5, hy + 6.8], [hx + 12.5, hy + 6], [hx + 8.5, hy + 5.8]], '#3b2416');
    } else if (id === 'warpaint') {
      ctx.fillStyle = '#16171d';
      for (const ex of [5.2, 11.6]) { ctx.fillRect(hx + ex - 2.4, hy + 6, 4.8, 1.5); ctx.fillRect(hx + ex - 2.4, hy + 8.6, 4.8, 1.5); }
    } else if (id === 'heromask') {
      this.rr(ctx, hx - 12, hy - 3.5, 31, 9, 4.5); this.blob(ctx, '#e8283a');
      const wave = Math.sin(t * 12 + seed) * 2;
      poly([[hx - 12, hy - 1], [hx - R - 9, hy - 3 + wave], [hx - R - 7, hy + 3 + wave]], '#e8283a');
      for (const ex of [5.2, 11.6]) {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(hx + ex, hy + 1.2, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(hx + ex + 0.6, hy + 1.6, 1.7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (id === 'clownnose') {
      ctx.beginPath(); ctx.arc(hx + 15.5, hy + 3.4, 3.8, 0, Math.PI * 2); this.blob(ctx, '#ff3a3f');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + 14.6, hy + 2.2, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  },

  shadow(ctx, sx, sy, k, r, z) {
    const s = clamp(1 - z / 140, 0.45, 1);
    ctx.fillStyle = 'rgba(20, 60, 20, 0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.05 * s * k, r * 0.5 * s * k, 0, 0, Math.PI * 2); ctx.fill();
  },

  ball(ctx, b, sx, sy, k, t) {
    const r = CFG.BALL_R * k * (1 + b.z / 500);
    const s = b.shot;
    const skin = b.skin || Save.ball();
    // energy glow on charged / power shots
    if (s && s.level >= 1 && !b.owner) {
      const tr = s.power ? (TRAILS.find((x) => x.id === b.trailType) || (s.team === 'blue' ? Save.trail() : TRAILS[1])) : { a: '#46d9ff', b: '#ffffff' };
      const pulse = 1 + Math.sin(t * 40) * 0.08;
      this.glow(ctx, sx, sy, r * (s.power ? 4.2 : 3) * pulse, tr.a, s.power ? 0.85 : 0.55);
      this.glow(ctx, sx, sy, r * 1.9, tr.b, 0.7);
    }
    if (skin.glow) this.glow(ctx, sx, sy, r * 2.2, skin.glow, 0.45);
    ctx.fillStyle = skin.base;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const dx = b.vx / sp, dy = b.vy / sp;
    const phase = ((b.roll % (Math.PI * 2)) / (Math.PI * 2)) * 2 - 1; // -1..1
    ctx.fillStyle = skin.patch;
    for (let j = -1; j <= 1; j++) {
      const off = (phase + j * 1.0) * r * 1.3;
      const cx = sx + dx * off, cy = sy + dy * off * CFG.TILT;
      if (skin.multi) ctx.fillStyle = skin.multi[(j + 4) % 3];
      this.pent(ctx, cx, cy, r * 0.36, b.roll * 0.3 + j);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + b.roll * 0.3 + j;
        if (skin.multi) ctx.fillStyle = skin.multi[(i + j + 4) % 3];
        this.pent(ctx, cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95, r * 0.26, a);
      }
    }
    if (skin.stars) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const a = i * 2.4 + b.roll * 0.5, rr = r * (0.3 + ((i * 37) % 10) / 16);
        ctx.fillRect(sx + Math.cos(a) * rr - r * 0.05, sy + Math.sin(a) * rr - r * 0.05, r * 0.11, r * 0.11);
      }
    }
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, 2.2 * k); ctx.strokeStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
  },

  // soft additive glow (energy effects only)
  // glow sprites are rendered once per color, then stamped (gradients every frame were costly)
  glowCache: {},
  glow(ctx, x, y, r, color, alpha) {
    if (r < 1 || Render.quality >= 2 || Save.data.settings.graphics === 'low') return;
    let img = this.glowCache[color];
    if (!img) {
      img = document.createElement('canvas'); img.width = img.height = 64;
      const g = img.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      this.glowCache[color] = img;
    }
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = 1;
  },

  pent(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  },

  // Tapered ribbon through the trail samples.
  ribbon(ctx, pts, w0, color, alpha) {
    const n = pts.length;
    if (n < 2) return;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)];
      let dx = c.x - a.x, dy = c.y - a.y;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = w0 * (1 - i / n);
      left.push([pts[i].x - dy * w, pts[i].y + dx * w]);
      right.push([pts[i].x + dy * w, pts[i].y - dx * w]);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  },

  trail(ctx, b, R, t) {
    if (!b.trailType || b.trail.length < 2) return;
    const pts = [{ x: R.sx(b.x, b.y), y: R.sy(b.y, b.z + CFG.BALL_R) }];
    for (const p of b.trail) pts.push({ x: R.sx(p.x, p.y), y: R.sy(p.y, p.z + CFG.BALL_R) });
    const k = R.k ? R.k(b.y) : R.S, rad = CFG.BALL_R * k;
    const glowCol = { strong: '#46d9ff', electric: '#1fb8ff', fire: '#ff6a1a', plasma: '#a23dff', blast: '#9fe8ff',
      frost: '#7fd8ff', toxic: '#7dff3a', shadow: '#7b3bff', rainbow: '#ff5fa8', golden: '#ffc21a' }[b.trailType];
    if (glowCol && Save.data.settings.graphics !== 'low' && Render.quality === 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      this.ribbon(ctx, pts, rad * 3.6, glowCol, 0.18);
      this.ribbon(ctx, pts, rad * 2.6, glowCol, 0.22);
      ctx.restore();
    }
    switch (b.trailType) {
      case 'pass': this.ribbon(ctx, pts, rad * 0.55, '#ffffff', 0.45); break;
      case 'weak': this.ribbon(ctx, pts, rad * 0.7, '#ffffff', 0.55); break;
      case 'shot': this.ribbon(ctx, pts, rad * 0.9, '#46d9ff', 0.55); this.ribbon(ctx, pts, rad * 0.4, '#ffffff', 0.8); break;
      case 'strong':
        this.ribbon(ctx, pts, rad * 1.5, '#46d9ff', 0.6);
        this.ribbon(ctx, pts, rad * 0.75, '#ffffff', 0.95);
        break;
      case 'electric': {
        this.ribbon(ctx, pts, rad * 2.3, '#1fb8ff', 0.5);
        this.ribbon(ctx, pts, rad * 1.2, '#bff3ff', 0.9);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2 * k; ctx.lineJoin = 'miter';
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const jit = (Math.random() * 2 - 1) * rad * 1.6 * (i / pts.length + 0.2);
            ctx.lineTo(pts[i].x + jit, pts[i].y - jit);
          }
          ctx.stroke();
        }
        break;
      }
      case 'fire':
        this.ribbon(ctx, pts, rad * 2.4, '#ff5a1a', 0.6);
        this.ribbon(ctx, pts, rad * 1.5, '#ffb03a', 0.9);
        this.ribbon(ctx, pts, rad * 0.7, '#fff3a0', 1);
        if (Math.random() < 0.7) FX.ember(b.x, b.y, b.z, pick(['#ffb03a', '#ff5a1a', '#ffe14d']));
        break;
      case 'plasma': {
        this.ribbon(ctx, pts, rad * 2.2, '#8a2be2', 0.5);
        this.ribbon(ctx, pts, rad * 1.0, '#f3d2ff', 0.95);
        ctx.fillStyle = '#e0a3ff';
        for (let i = 1; i < pts.length; i++) {
          const a = t * 30 + i * 0.9, w = rad * 1.5 * (1 - i / pts.length);
          ctx.beginPath(); ctx.arc(pts[i].x + Math.cos(a) * w, pts[i].y + Math.sin(a) * w, 2.2 * k, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'blast':
        this.ribbon(ctx, pts, rad * 2.6, '#bff3ff', 0.45);
        this.ribbon(ctx, pts, rad * 1.5, '#ffffff', 1);
        if (Math.random() < 0.25) FX.ring(b.x, b.y, '#ffffff', 6, 26, 0.25, 2.5);
        break;
      case 'frost': {
        this.ribbon(ctx, pts, rad * 2.3, '#4fc3ff', 0.5);
        this.ribbon(ctx, pts, rad * 1.2, '#dff6ff', 0.95);
        // snowflakes spinning off the path
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8 * k; ctx.lineCap = 'round';
        for (let i = 1; i < pts.length; i += 2) {
          const a = t * 6 + i, w = rad * 1.9 * (1 - i / pts.length), r2 = rad * 0.5;
          const x = pts[i].x + Math.cos(a) * w, y = pts[i].y + Math.sin(a * 1.3) * w * 0.6;
          for (let s2 = 0; s2 < 3; s2++) {
            const ang = a + (s2 * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(ang) * r2, y - Math.sin(ang) * r2);
            ctx.lineTo(x + Math.cos(ang) * r2, y + Math.sin(ang) * r2);
            ctx.stroke();
          }
        }
        break;
      }
      case 'toxic': {
        this.ribbon(ctx, pts, rad * 2.4, '#4aa81f', 0.55);
        this.ribbon(ctx, pts, rad * 1.3, '#7dff3a', 0.9);
        this.ribbon(ctx, pts, rad * 0.6, '#e8ffc2', 1);
        // bubbles drifting up out of the slime
        ctx.lineWidth = 1.6 * k; ctx.strokeStyle = '#2f6b12';
        for (let i = 1; i < pts.length; i++) {
          const a = t * 9 + i * 1.7, w = rad * 1.6 * (1 - i / pts.length);
          const r2 = (2.6 - (i / pts.length) * 1.4) * k;
          if (r2 < 0.6) continue;
          ctx.fillStyle = i % 2 ? '#a6ff6b' : '#d9ffb0';
          ctx.beginPath(); ctx.arc(pts[i].x + Math.cos(a) * w, pts[i].y - Math.abs(Math.sin(a)) * w, r2, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'shadow': {
        this.ribbon(ctx, pts, rad * 2.6, '#2a1050', 0.6);
        this.ribbon(ctx, pts, rad * 1.5, '#7b3bff', 0.75);
        this.ribbon(ctx, pts, rad * 0.6, '#1b1033', 0.95);
        // ghosts of the ball peeling off behind it
        for (let i = 2; i < pts.length; i += 2) {
          ctx.globalAlpha = 0.35 * (1 - i / pts.length);
          ctx.fillStyle = '#1b1033';
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rad * (1 - i / (pts.length * 2)), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'rainbow': {
        const bands = [['#ff4d6d', 2.8], ['#ff8a1f', 2.3], ['#ffe14d', 1.8], ['#3fcf4a', 1.35], ['#46d9ff', 0.9], ['#b04dff', 0.45]];
        for (const [col, w] of bands) this.ribbon(ctx, pts, rad * w, col, 0.9);
        break;
      }
      case 'golden': {
        this.ribbon(ctx, pts, rad * 2.4, '#c98a00', 0.5);
        this.ribbon(ctx, pts, rad * 1.4, '#ffc21a', 0.9);
        this.ribbon(ctx, pts, rad * 0.6, '#fff3a0', 1);
        // coin sparkles
        ctx.fillStyle = '#fff8cf';
        for (let i = 1; i < pts.length; i++) {
          const a = t * 14 + i * 2.1, w = rad * 1.8 * (1 - i / pts.length), s2 = 2.4 * k * (1 - i / pts.length);
          if (s2 < 0.5) continue;
          const x = pts[i].x + Math.cos(a) * w, y = pts[i].y + Math.sin(a) * w * 0.7;
          ctx.beginPath();
          ctx.moveTo(x, y - s2); ctx.lineTo(x + s2 * 0.5, y); ctx.lineTo(x, y + s2); ctx.lineTo(x - s2 * 0.5, y);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
    }
  },
};
