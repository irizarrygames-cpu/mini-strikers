// SKILL CHALLENGES: three solo tests with medals, for when nobody else is around.
//   targets  — ten kicks at targets hung in the goal (the shootout scene, no keeper)
//   keeper   — ten kicks come at you and you try to keep them out
//   gauntlet — score past three defenders as fast as you can, on the pitch
// Best scores and medals live in Save.data.challenges; each medal pays out once.
const MEDALS = ['bronze', 'silver', 'gold'];
const MEDAL_COLORS = { bronze: '#c87d3a', silver: '#c9d2e4', gold: '#ffc21a' };
const CHALLENGE_LIST = [
  { id: 'targets', name: 'TARGET PRACTICE', kind: 'pens', icon: 'target',
    blurb: 'Ten kicks. Hit the targets hanging in the goal.', unit: 'HIT', cuts: [4, 6, 8], coins: [80, 150, 300] },
  { id: 'keeper', name: 'KEEPER MODE', kind: 'pens', icon: 'gloves',
    blurb: 'Ten penalties come at you. Keep them out.', unit: 'SAVED', cuts: [3, 5, 7], coins: [80, 150, 300] },
  { id: 'gauntlet', name: 'DRIBBLE GAUNTLET', kind: 'match', icon: 'boot',
    blurb: 'Beat two defenders and their keeper. The clock is running.', unit: 'SEC', lower: true, cuts: [34, 24, 16], coins: [80, 150, 300] },
];
const challengeById = (id) => CHALLENGE_LIST.find((c) => c.id === id);
// which medal a score earns (time challenges want a LOW score)
function medalFor(ch, score) {
  if (score === null || score === undefined) return null;
  let best = null;
  ch.cuts.forEach((cut, i) => { if (ch.lower ? score <= cut : score >= cut) best = MEDALS[i]; });
  return best;
}

const SkillRun = {
  // ---------- records ----------
  store() {
    const d = Save.data;
    if (!d.challenges || typeof d.challenges !== 'object') d.challenges = {};
    return d.challenges;
  },
  best(id) { const r = this.store()[id]; return r && typeof r.best === 'number' ? r.best : null; },
  medal(id) { return medalFor(challengeById(id), this.best(id)); },
  // returns the coins earned this go (only for medals you had not reached before)
  record(id, score) {
    const ch = challengeById(id), rec = this.store()[id] || (this.store()[id] = { best: null, paid: [] });
    if (!Array.isArray(rec.paid)) rec.paid = [];
    const better = rec.best === null || (ch.lower ? score < rec.best : score > rec.best);
    if (better) rec.best = score;
    let coins = 0;
    const got = medalFor(ch, score);
    if (got) {
      for (let i = 0; i <= MEDALS.indexOf(got); i++) {
        if (rec.paid.includes(MEDALS[i])) continue;
        rec.paid.push(MEDALS[i]);
        coins += ch.coins[i];
      }
    }
    if (coins) { Save.data.coins += coins; }
    Save.write();
    return { coins, medal: got, best: rec.best, better };
  },

  // ---------- starting one ----------
  start(id) {
    const ch = challengeById(id);
    if (!ch) return;
    Sound.unlock();
    Game.goFullscreen();
    UI.closeAll();
    this.run = { id, ch, score: 0, done: false, t: 0 };
    if (ch.kind === 'pens') this.startPens(ch);
    else this.startGauntlet(ch);
  },

  startPens(ch) {
    const club = Clubs.random(Clubs.mine());
    Game.lastOpts = { mode: 'challenge', id: ch.id };
    Game.match = Match.create({ mode: 'pens', club, format: '1v1' });
    Pens.init(Game.match);
    const P = Game.match.pens;
    P.chal = { id: ch.id, kicks: 0, total: 10, score: 0 };
    P.first = ch.id === 'targets' ? 'blue' : 'red';
    if (ch.id === 'targets') P.noKeeper = true;
    Pens.next(Game.match, true);
    this.newTargets(P);
    $('hud').classList.add('pens');
    Game.state = 'match';
    UI.show('match');
    Sound.startMusic(); Sound.startAmbience();
  },

  // three discs hung across the goal, never right on top of each other
  newTargets(P) {
    if (!P.chal || P.chal.id !== 'targets') return;
    const spots = [];
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const x = rand(-0.82, 0.82) * PEN.HW, z = rand(0.22, 0.86) * PEN.HT;
        if (spots.every((s) => Math.hypot(s.x - x, s.z - z) > 1.5)) { spots.push({ x, z, hit: false }); break; }
      }
    }
    P.targets = spots;
  },

  startGauntlet(ch) {
    const club = Clubs.random(Clubs.mine());
    Game.lastOpts = { mode: 'challenge', id: ch.id };
    const m = Match.create({ mode: 'quick', club, format: 'training' });
    m.challenges = null;
    Game.match = m;
    m.challenge = { id: ch.id, t: 0, lost: 0, done: false };
    // you, their keeper and three defenders strung out between you and the goal
    const keep = new Set([m.human, m.keepers.blue, m.keepers.red]);
    m.players = m.players.filter((p) => keep.has(p));
    const rng = mulberry32((Math.random() * 1e9) | 0);
    for (let i = 0; i < 2; i++) {
      const bc = pickBotCharacter(rng);
      const p = new Player({ team: 'red', role: 'def', number: 2 + i, attr: ratingAttr(bc.r), look: { hair: bc.hair, hairColor: bc.hairColor, skin: bc.skin, cap: bc.cap, band: bc.band, thin: 0, anime: false, mewing: false, acc: null } });
      p.speedMul = (m.diff && m.diff.redSpeed) || 1;
      p.sig = sigKind(bc);
      p.x = CFG.FIELD_W * (0.55 + i * 0.17); p.y = CFG.FIELD_H / 2 + (i % 2 ? -230 : 230);
      m.players.push(p);
    }
    m.human.x = 260; m.human.y = CFG.FIELD_H / 2;
    m.ball.owner = m.human; m.ball.x = m.human.x + 16; m.ball.y = m.human.y; m.ball.z = 0; m.ball.vx = 0; m.ball.vy = 0;
    m.phase = 'play'; m.phaseT = 0; m.clock = 0;
    m.teamHuman = { blue: true, red: false };
    Game.state = 'match';
    UI.show('match');
    Render.updateCamera(m, 0, true);
    FX.showBanner('GO!', '#ffe14d', 0.9, 'BEAT THE DEFENDERS AND SCORE');
    Sound.startMusic(); Sound.startAmbience();
  },

  // ---------- the shootout scene, driven as a challenge ----------
  // set up the next of the ten kicks (the scene calls this instead of Pens.next)
  nextKick(m, first) {
    const P = m.pens, C = P.chal;
    if (!first) {
      C.kicks++;
      if (C.kicks >= C.total) { P.phase = 'end'; P.t = 0; Pens.label('SHOOT'); this.show(C.score); return; }
    }
    P.team = C.id === 'targets' ? 'blue' : 'red';
    P.phase = first ? 'start' : 'ready'; P.t = 0;
    P.shot = null; P.dive = null; P.result = null; P.say = null;
    P.power = 0; P.holding = false; P.holdInputSeen = false; P.holdT = 0;
    P.aim = { x: 0, z: 0.45 }; P.mouse = null; P.clock = 12;
    P.after = { held: false, side: 1 };
    const t = P.takers[C.kicks % P.takers.length];
    const taker = P.team === 'blue' ? P.you : (P.them = Pens.actor('red', false, t.look, t.number));
    Object.assign(taker, { celebrateT: 0, celebKind: null, sad: false, kickT: 0, fy: -1, faceX: 0.001, run: 0, vx: 0, vy: 0 });
    for (const k of Object.values(P.keeper)) Object.assign(k, { diveT: 0, celebrateT: 0, sad: false, hopT: 0 });
    P.runup = rand(0.9, 1.3);
    this.newTargets(P);
    Pens.label(P.team === 'blue' ? 'SHOOT' : 'DIVE');
    Pens.flushInput();
  },

  // a kick has landed: a target hit, or a save kept out
  scoreKick(m, s, res) {
    const P = m.pens, C = P.chal;
    const taker = Pens.taker(P), gk = Pens.goalie(P);
    P.after = { held: res === 'save' && s.v < 24 && Math.abs(s.x) < 2.2, side: Math.random() < 0.5 ? -1 : 1 };
    let good = false;
    if (C.id === 'targets') {
      const hit = (P.targets || []).find((tg) => !tg.hit && Math.hypot(tg.x - s.x, tg.z - s.z) < 0.6);
      if (hit && s.out === 'in') {
        hit.hit = true; C.score++; good = true;
        P.say = ['TARGET!', '#3fcf4a'];
        Sound.net();
        taker.celebrateT = CELE_TIME; taker.celebKind = Save.celebration(); taker.fy = -1;
      } else {
        P.say = s.out === 'in' ? ['MISSED THE TARGETS', '#ffffff'] : PEN_SAY[res];
        taker.sad = true;
        if (s.out === 'post' || s.out === 'bar') Sound.post();
      }
    } else {
      good = res === 'save';
      P.say = good ? ['SAVED!', '#46d9ff'] : PEN_SAY[res] || ['GOAL!', '#ffe14d'];
      if (good) { C.score++; Sound.save(); gk.celebrateT = 1.4; }
      else if (res === 'goal' || res === 'postIn' || res === 'barIn') { Sound.net(); taker.celebrateT = CELE_TIME; taker.fy = -1; }
      else taker.sad = true;
    }
    if (good) { Sound.cheer(true); P.cheerT = 1.6; } else Sound.ooh();
    P.shake = good ? 0.2 : 0.14;
    P.phase = 'after'; P.t = 0;
  },

  // ---------- the gauntlet's own little loop ----------
  step(m, dt) {
    const c = m.challenge;
    if (!c || c.done) return;
    c.t += dt;
    c.lost = m.ball.owner === m.human ? 0 : c.lost + dt;
    if (m.score.blue > 0) { this.finishGauntlet(m, c.t); return; }
    // they are defending, not attacking: anything they put in your net is wiped and costs you time
    if (m.score.red > 0) { m.score.red = 0; c.t += 3; c.lost = 0; this.resetGauntlet(m); }
    // lost it for three seconds: back to the start, and it costs you three on the clock
    if (c.lost > 3) { c.lost = 0; c.t += 3; c.resets = (c.resets || 0) + 1; this.resetGauntlet(m); }
    if (c.t > 60) this.finishGauntlet(m, null);
  },

  // put you, the ball and the defenders back where they started
  resetGauntlet(m) {
    const h = m.human, b = m.ball;
    h.x = 260; h.y = CFG.FIELD_H / 2; h.vx = 0; h.vy = 0; h.stunT = 0; h.fallT = 0; h.slideT = 0;
    b.owner = h; b.x = h.x + 16; b.y = h.y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.shot = null;
    let i = 0;
    for (const p of m.players) {
      if (p === h || p.isKeeper) continue;
      p.x = CFG.FIELD_W * (0.55 + i * 0.17); p.y = CFG.FIELD_H / 2 + (i % 2 ? -230 : 230);
      p.vx = 0; p.vy = 0; p.stunT = 0; p.slideT = 0; p.slideWindT = 0;
      i++;
    }
    if (!Game.headless) { FX.showBanner('BALL LOST  +3s', '#ff8a8e', 0.7); Sound.whistle(); }
  },

  finishGauntlet(m, seconds) {
    const c = m.challenge;
    if (c.done) return;
    c.done = true;
    m.phase = 'over';
    this.show(seconds === null ? null : Math.round(seconds * 10) / 10);
  },

  // ---------- the end card ----------
  show(score) {
    const r = this.run;
    if (!r || r.done) return;
    r.done = true; r.score = score;
    const ch = r.ch;
    const failed = score === null;
    const res = failed ? { coins: 0, medal: null, best: this.best(ch.id), better: false } : this.record(ch.id, score);
    Game.state = 'results';
    const medal = res.medal;
    const line = failed ? 'NO SCORE' : ch.lower ? `${score.toFixed(1)}s` : `${score} / 10 ${ch.unit}`;
    const bestLine = res.best === null ? '' : ch.lower ? `${(+res.best).toFixed(1)}s` : `${res.best} ${ch.unit}`;
    const el = $('challenge-end');
    el.innerHTML = `
      <div class="panel small chal-end">
        <h2>${ch.name}</h2>
        ${medal ? `<div class="chal-medal ${medal}" style="--m:${MEDAL_COLORS[medal]}"><span></span><b>${medal.toUpperCase()}</b></div>` : '<div class="chal-medal none"><b>NO MEDAL</b></div>'}
        <div class="chal-score">${line}</div>
        ${res.better && !failed ? '<div class="chal-new">NEW BEST!</div>' : bestLine ? `<div class="note">BEST: ${bestLine}</div>` : ''}
        ${res.coins ? `<div class="chal-coins"><span class="coin"></span>+${res.coins}</div>` : ''}
        <div class="chal-cuts">${ch.cuts.map((cut, i) => `<span class="${MEDALS[i]}"><i style="background:${MEDAL_COLORS[MEDALS[i]]}"></i>${ch.lower ? `${cut}s` : cut}</span>`).join('')}</div>
        <div class="chal-buttons"><button class="big-btn green" data-a="again">TRY AGAIN</button><button class="mid-btn" data-a="home">BACK</button></div>
      </div>`;
    el.hidden = false;
    el.querySelector('[data-a="again"]').addEventListener('click', () => { UI.tap(); el.hidden = true; this.start(ch.id); });
    el.querySelector('[data-a="home"]').addEventListener('click', () => { UI.tap(); el.hidden = true; this.quit(); });
    if (medal === 'gold') { Sound.goalJingle(true); Sound.cheer(true); } else if (medal) Sound.powerReady(); else Sound.ooh();
  },

  quit() {
    $('challenge-end').hidden = true;
    this.run = null;
    $('hud').classList.remove('pens');
    Pens.label('SHOOT');
    Game.goHome();
  },

  // ---------- drawing over the scene ----------
  drawPens(ctx, L, P, t) {
    const ch = challengeById(P.chal.id), W = L.W;
    // the targets
    if (P.targets) {
      for (const tg of P.targets) {
        const p = Pens.gp(L, tg.x, tg.z), r = L.s * 0.42;
        if (tg.hit) {
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = '#3fcf4a'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, r * 0.22); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x - r * 0.45, p.y); ctx.lineTo(p.x - r * 0.1, p.y + r * 0.38); ctx.lineTo(p.x + r * 0.48, p.y - r * 0.36); ctx.stroke();
          ctx.lineCap = 'butt';
          continue;
        }
        const pulse = 1 + Math.sin(t * 5 + tg.x) * 0.04;
        for (const [rad, col] of [[1, '#ffffff'], [0.68, '#ff3a3f'], [0.34, '#ffffff']]) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * rad * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
      }
    }
    // the scoreline at the top, where the shootout keeps its tally: name on top, score and kick under
    const big = clamp(Math.min(L.W, L.H) * 0.05, 14, 26), small = big * 0.62;
    const score = `${P.chal.score} ${ch.unit}`, kick = `KICK ${Math.min(P.chal.total, P.chal.kicks + 1)}/${P.chal.total}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${big}px "Lilita One", system-ui, sans-serif`;
    const wScore = ctx.measureText(score + '   ' + kick).width;
    ctx.font = `900 ${small}px "Lilita One", system-ui, sans-serif`;
    const w = Math.max(wScore, ctx.measureText(ch.name).width) + big * 1.6;
    const h = small + big * 2.1, x = W / 2 - w / 2, y = 10;
    ctx.fillStyle = OUTLINE; Sprites.rr(ctx, x + 3, y + 4, w, h, big * 0.6); ctx.fill();
    ctx.fillStyle = '#ffffff'; Sprites.rr(ctx, x, y, w, h, big * 0.6); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.fillStyle = '#6b7299';
    ctx.font = `900 ${small}px "Lilita One", system-ui, sans-serif`;
    ctx.fillText(ch.name, W / 2, y + small * 0.95);
    ctx.font = `900 ${big}px "Lilita One", system-ui, sans-serif`;
    ctx.fillStyle = OUTLINE;
    ctx.fillText(score + '   ' + kick, W / 2, y + small + big * 0.95);
  },

  drawGauntlet(ctx, m) {
    const c = m.challenge;
    if (!c) return;
    const W = Render.W, big = clamp(Math.min(W, Render.H) * 0.07, 18, 34);
    ctx.setTransform(Render.dpr, 0, 0, Render.dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = `${c.t.toFixed(1)}s`;
    ctx.font = `900 ${big}px "Lilita One", system-ui, sans-serif`;
    const w = ctx.measureText(txt).width + big * 1.2;
    ctx.fillStyle = OUTLINE; Sprites.rr(ctx, W / 2 - w / 2 + 3, 13, w, big * 1.8, big * 0.5); ctx.fill();
    ctx.fillStyle = c.t > 30 ? '#ffd0d3' : '#ffffff'; Sprites.rr(ctx, W / 2 - w / 2, 10, w, big * 1.8, big * 0.5); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    Render.chunkyText(ctx, txt, W / 2, 10 + big * 0.9, big, '#161a33', 0);
  },
};

/* ---------------- the menu ---------------- */
Object.assign(UI, {
  panel_challenges(body) {
    $('modal-title').textContent = 'SKILL CHALLENGES';
    body.innerHTML = `
      <p class="note">Three tests on your own. Beat the marks for a medal — each medal pays out once.</p>
      <div class="chal-grid">${CHALLENGE_LIST.map((ch) => {
        const best = SkillRun.best(ch.id), medal = SkillRun.medal(ch.id);
        const bestTxt = best === null ? 'NOT PLAYED' : ch.lower ? `BEST ${(+best).toFixed(1)}s` : `BEST ${best} ${ch.unit}`;
        return `<button class="chal-card ${medal || ''}" data-chal="${ch.id}">
          <strong>${ch.name}</strong>
          <p>${ch.blurb}</p>
          <div class="chal-row"><span class="chal-best">${bestTxt}</span>${medal ? `<span class="chal-badge" style="--m:${MEDAL_COLORS[medal]}">${medal.toUpperCase()}</span>` : ''}</div>
          <div class="chal-cuts">${ch.cuts.map((cut, i) => `<span><i style="background:${MEDAL_COLORS[MEDALS[i]]}"></i>${ch.lower ? `${cut}s` : cut}</span>`).join('')}</div>
        </button>`;
      }).join('')}</div>`;
    body.querySelectorAll('[data-chal]').forEach((b) => b.addEventListener('click', () => { this.tap(); this.closeModal(); SkillRun.start(b.dataset.chal); }));
  },
});
