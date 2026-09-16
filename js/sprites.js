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
    const cp = p.celebrateT > 0 && p.celebKind && CELE_POSES[p.celebKind] ? CELE_POSES[p.celebKind](ce, t, p) : null;
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

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(k * flip * squash, k);
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
      this.boot(ctx, fx, fy, kit.shoes, i === 1 && kick > 0.3);
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
      ctx.beginPath(); ctx.arc(hx, hy, p.isKeeper ? 4.8 : 3.4, 0, Math.PI * 2);
      this.blob(ctx, p.isKeeper ? kit.gloves : look.skin);
      ctx.beginPath(); ctx.arc(side * 10, shY + 1, 5.6, 0, Math.PI * 2); this.blob(ctx, kit.sleeves || kit.jersey);
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

    arm(1, armSwing);

    // ---- head ----
    this.head(ctx, look, back, t, p);
    if (cp && cp.prop) this.celebProp(ctx, cp.prop, ce, back, p);
    ctx.restore();
    if (cp && cp.screen) this.celebScreen(ctx, cp.screen, ce, sx, sy, k, flip, cp);
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
    const hx = 1.5, hy = -56, R = 15;
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
