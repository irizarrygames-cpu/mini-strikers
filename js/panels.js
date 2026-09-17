// Panels: mode select, characters shop, customize shop, settings.
Object.assign(UI, {
  openModal(kind) {
    const body = $('modal-body');
    $('modal').hidden = false;
    $('modal').dataset.kind = kind;
    this['panel_' + kind](body);
  },

  closeModal() { $('modal').hidden = true; this.refreshHome(); },

  // ---- PLAY: pick a mode ----
  panel_play(body) {
    $('modal-title').textContent = 'PLAY';
    const cup = Cup.state();
    const quickClub = Clubs.random(Clubs.mine());
    const fmt = Save.data.format || '4v4';
    const club = Clubs.mine();
    body.innerHTML = `
      <div class="formats"><span>FORMAT</span>${['1v1', '2v2', '3v3', '4v4'].map((f) => `<button data-format="${f}" class="${f === fmt ? 'sel' : ''}">${f}</button>`).join('')}</div>
      <div class="online-row">
        <button class="mode online" data-mode="online">
          <strong>PLAY ONLINE</strong>
          <p>Play real people from every country.</p>
          <span class="tag">WIN = 3 LEAGUE POINTS FOR ${club.name}</span>
        </button>
        <div class="room-box">
          <small>PLAY WITH FRIENDS</small>
          <button class="mid-btn" data-room="create">CREATE ROOM</button>
          <div class="join"><input id="join-code" maxlength="5" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="mid-btn" data-room="join">JOIN</button></div>
        </div>
      </div>
      <p class="note vs-bots">OR PLAY OFFLINE</p>
      <div class="modes">
        <button class="mode quick" data-mode="quick">
          <strong>QUICK MATCH</strong>
          <p>One match vs a random country. Fast, loose, fun.</p>
          <span class="tag">3 CHALLENGES · COINS · XP</span>
        </button>
        <button class="mode cup" data-mode="cup">
          <strong>${cup ? 'CONTINUE CUP' : 'THE CUP'}</strong>
          <p>${cup ? `Next: ${Cup.ROUNDS[cup.round]} vs ${Clubs.get(cup.opponents[cup.round]).name}` : 'Win 3 knockout matches in a row. No draws — golden goal decides it.'}</p>
          <span class="tag">WIN IT: +300 COINS &amp; A TROPHY</span>
        </button>
        <button class="mode training" data-mode="training">
          <strong>TRAINING</strong>
          <p>No clock, no pressure: beat a defender and practice shots, skills and tackles.</p>
        </button>
      </div>
      <p class="note clubs-note">OR PICK YOUR OPPONENT</p>
      <div class="clubs-row">${CLUBS.filter((c) => c.id !== Clubs.mine().id).map((c) => `<button class="club-chip" data-club="${c.id}" style="--c:${clubUi(c)}" title="Quick match vs ${c.name}"><canvas width="42" height="28" data-flag="${c.id}"></canvas><b>${c.short}</b><i>${'★'.repeat(c.level + 1)}</i></button>`).join('')}</div>`;
    body.querySelectorAll('canvas[data-flag]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.flag)));
    body.querySelectorAll('[data-club]').forEach((b) => b.addEventListener('click', () => { this.tap(); Game.startMatch({ mode: 'quick', club: Clubs.get(b.dataset.club) }); }));
    body.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => {
      Save.data.format = b.dataset.format; Save.write(); this.tap();
      body.querySelectorAll('[data-format]').forEach((x) => x.classList.toggle('sel', x === b));
    }));
    body.querySelector('[data-mode="quick"]').addEventListener('click', () => { this.tap(); Game.startMatch({ mode: 'quick', club: quickClub }); });
    const fmtNow = () => Save.data.format || '4v4';
    body.querySelector('[data-mode="online"]').addEventListener('click', () => { this.tap(); Online.findMatch(fmtNow()); });
    body.querySelector('[data-room="create"]').addEventListener('click', () => { this.tap(); Online.createRoom(fmtNow()); });
    const join = () => { const code = body.querySelector('#join-code').value.trim().toUpperCase(); if (code.length < 4) { UI.toast('ENTER THE ROOM CODE'); return; } this.tap(); Online.joinRoom(code); };
    body.querySelector('[data-room="join"]').addEventListener('click', join);
    body.querySelector('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    body.querySelector('[data-mode="training"]').addEventListener('click', () => { this.tap(); Game.startMatch({ mode: 'training', club: Clubs.random(Clubs.mine()) }); });
    body.querySelector('[data-mode="cup"]').addEventListener('click', () => {
      this.tap();
      if (!Cup.state()) Cup.start();
      Game.startMatch({ mode: 'cup' });
    });
  },

  // shared buy/equip card behaviour: first tap on a locked item arms "BUY", second tap buys
  shopCard(el, kind, id, onEquip) {
    el.addEventListener('click', () => {
      if (Shop.owns(kind, id)) { this.tap(); onEquip(); return; }
      const price = Shop.price(kind, id);
      if (Save.data.coins < price) { Sound.steal(); el.classList.add('nope'); setTimeout(() => el.classList.remove('nope'), 400); return; }
      if (!el.classList.contains('armed')) { this.tap(); el.parentElement.querySelectorAll('.armed').forEach((x) => x.classList.remove('armed')); el.classList.add('armed'); return; }
      Shop.buy(kind, id);
      Sound.powerReady();
      onEquip();
    });
  },

  priceTag(kind, id) {
    if (Shop.owns(kind, id)) return '';
    return `<span class="price"><span class="coin"></span>${Shop.price(kind, id)}</span><span class="buy">TAP TO BUY</span>`;
  },

  coinsLine() { return `<div class="panel-coins"><span class="coin"></span><b>${fmtCoins(Save.data.coins)}</b></div>`; },

  // ---- characters ----
  panel_characters(body) {
    $('modal-title').textContent = 'CHARACTERS';
    const statRow = (label, v) => `<div class="bar"><i>${label}</i><span><b style="width:${Math.round(((v - 40) / 60) * 100)}%;background:${v >= 85 ? '#ffb400' : v >= 75 ? '#3fcf4a' : v >= 65 ? '#2f7bff' : '#8a90b8'}"></b></span><em>${v}</em></div>`;
    const list = CHARACTERS.slice().sort((a, b) => Shop.price('character', a.id) - Shop.price('character', b.id));
    body.innerHTML = `${this.coinsLine()}<p class="note">Better players are faster, shoot harder, pass sharper, keep the ball and win tackles. The best ones take days of play to afford.</p><div class="char-grid">${list.map((c) => `
      <button class="char-card-sm rar-${c.rarity} ${c.id === Save.character().id ? 'sel' : ''} ${Shop.owns('character', c.id) ? '' : 'locked'}" data-id="${c.id}" style="--rar:${RARITIES[c.rarity].color}">
        <span class="rar-tag">${RARITIES[c.rarity].name}</span>
        <span class="ovr"><b>${overall(c.r)}</b><small>OVR</small></span>
        <canvas width="96" height="96" data-portrait="${c.id}"></canvas>
        <strong>${c.name}</strong>
        ${this.priceTag('character', c.id)}
        <div class="bars">${statRow('SPD', c.r.spd)}${statRow('SHT', c.r.sht)}${statRow('PAS', c.r.pas)}${statRow('CTL', c.r.ctl)}${statRow('DEF', c.r.def)}</div>
      </button>`).join('')}</div>`;
    body.querySelectorAll('canvas[data-portrait]').forEach((cv) => this.portrait(cv, CHARACTERS.find((c) => c.id === cv.dataset.portrait)));
    body.querySelectorAll('.char-card-sm').forEach((el) => this.shopCard(el, 'character', el.dataset.id, () => {
      Save.data.character = el.dataset.id; Save.write();
      this.panel_characters(body);
      this.refreshHome();
    }));
  },

  // ---- customize: trails, celebrations, stadiums ----
  panel_customize(body) {
    $('modal-title').textContent = 'CUSTOMIZE';
    const tab = this._custTab || 'trail';
    const tabs = [['trail', 'POWER TRAIL'], ['ball', 'BALL'], ['celebration', 'CELEBRATION'], ['accessory', 'ACCESSORY'], ['stadium', 'STADIUM']];
    let grid = '';
    if (tab === 'trail') {
      grid = TRAILS.map((t) => `<button class="trail-opt ${t.id === Save.trail().id ? 'sel' : ''} ${Shop.owns('trail', t.id) ? '' : 'locked'}" data-id="${t.id}">
        <canvas width="200" height="70" data-trail="${t.id}"></canvas><strong>${t.name}</strong>${this.priceTag('trail', t.id)}</button>`).join('');
    } else if (tab === 'celebration') {
      grid = CELEBRATIONS.map((c) => `<button class="trail-opt celeb-opt ${c.id === Save.celebration() ? 'sel' : ''} ${Shop.owns('celebration', c.id) ? '' : 'locked'}" data-id="${c.id}">
        <canvas width="160" height="150" data-celeb="${c.id}"></canvas><strong>${c.name}</strong>${this.priceTag('celebration', c.id)}</button>`).join('');
    } else if (tab === 'accessory') {
      const on = Save.accessory();
      grid = [{ id: 'none', name: 'Nothing' }, ...ACCESSORIES].map((a) => `<button class="trail-opt acc-opt ${(a.id === 'none' ? !on : a.id === on) ? 'sel' : ''} ${a.id === 'none' || Shop.owns('accessory', a.id) ? '' : 'locked'}" data-id="${a.id}">
        <canvas width="120" height="120" data-acc="${a.id}"></canvas><strong>${a.name}</strong>${a.id === 'none' ? '' : this.priceTag('accessory', a.id)}</button>`).join('');
    } else if (tab === 'ball') {
      grid = BALLS.map((b) => `<button class="trail-opt ${b.id === Save.ball().id ? 'sel' : ''} ${Shop.owns('ball', b.id) ? '' : 'locked'}" data-id="${b.id}">
        <canvas width="200" height="90" data-ball="${b.id}"></canvas><strong>${b.name}</strong>${this.priceTag('ball', b.id)}</button>`).join('');
    } else {
      grid = STADIUMS.map((s) => `<button class="trail-opt ${s.id === Save.stadium().id ? 'sel' : ''} ${Shop.owns('stadium', s.id) ? '' : 'locked'}" data-id="${s.id}">
        <canvas width="200" height="90" data-stadium="${s.id}"></canvas><strong>${s.name}</strong>${this.priceTag('stadium', s.id)}</button>`).join('');
    }
    const notes = { accessory: 'Worn by your player in every match — online, everyone sees it.', trail: 'Shown on power shots. Fill the meter around SHOOT, then fully charge.', ball: 'The match ball in every game you play.', celebration: 'Score and the camera zooms in on you doing this. Everyone in the match sees it.', stadium: 'Where every match is played.' };
    body.innerHTML = `${this.coinsLine()}<div class="tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${id === tab ? 'sel' : ''}">${l}</button>`).join('')}</div>
      <p class="note">${notes[tab]}</p><div class="trail-grid ${tab === 'celebration' ? 'celeb-grid' : ''}">${grid}</div>`;
    body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.tap(); this._custTab = b.dataset.tab; this.panel_customize(body); }));
    body.querySelectorAll('canvas[data-trail]').forEach((cv) => this.trailSwatch(cv, cv.dataset.trail));
    if (tab === 'celebration') this.animateCelebs(body);
    body.querySelectorAll('canvas[data-stadium]').forEach((cv) => this.stadiumSwatch(cv, cv.dataset.stadium));
    body.querySelectorAll('canvas[data-ball]').forEach((cv) => this.ballSwatch(cv, cv.dataset.ball));
    body.querySelectorAll('canvas[data-acc]').forEach((cv) => this.portrait(cv, { ...Save.look(), acc: cv.dataset.acc === 'none' ? null : cv.dataset.acc }));
    body.querySelectorAll('.trail-opt').forEach((el) => this.shopCard(el, tab, el.dataset.id, () => {
      if (tab === 'trail') Save.data.trail = el.dataset.id;
      if (tab === 'celebration') Save.data.celebration = el.dataset.id;
      if (tab === 'ball') Save.data.ball = el.dataset.id;
      if (tab === 'accessory') { Save.data.accessory = el.dataset.id === 'none' ? null : el.dataset.id; this.refreshHome(); }
      if (tab === 'stadium') { Save.data.stadium = el.dataset.id; Render.buildLayer(); Render.homeCrowd = null; }
      Save.write();
      this.panel_customize(body);
    }));
  },

  // ---- settings ----
  panel_settings(body) {
    $('modal-title').textContent = 'SETTINGS';
    const s = Save.data.settings;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
    body.innerHTML = `
      <label class="set"><span>MUSIC</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-key="music"></label>
      <label class="set"><span>SOUND</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-key="sfx"></label>
      <div class="set"><span>VIBRATION</span>${seg('vibration', [[true, 'ON'], [false, 'OFF']])}</div>
      <div class="set"><span>DIFFICULTY</span>${seg('difficulty', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']])}</div>
      <div class="set"><span>MATCH</span>${seg('minutes', [[2, '2 MIN'], [3, '3 MIN'], [4, '4 MIN']])}</div>
      <div class="set"><span>MINIMAP</span>${seg('minimap', [[true, 'ON'], [false, 'OFF']])}</div>
      <div class="set"><span>REPLAYS</span>${seg('replays', [[true, 'ON'], [false, 'OFF']])}</div>
      <div class="set"><span>GRAPHICS</span>${seg('graphics', [['auto', 'AUTO'], ['high', 'HIGH'], ['low', 'LOW']])}</div>
      <div class="set"><span>CONTROLS</span>${seg('controls', [['auto', 'AUTO'], ['touch', 'TOUCH'], ['keyboard', 'KEYBOARD']])}</div>
      ${this.controlsRef()}
      <div class="set account"><span>ACCOUNT</span><em>${Save.account || 'GUEST'} · ${Clubs.mine().name}</em><button id="logout" class="mini-danger">LOG OUT</button></div>
      <div class="set danger"><span>PROGRESS</span><button id="reset-progress" class="mini-danger">RESET SAVE</button></div>`;
    $('logout').addEventListener('click', async () => { this.tap(); await Net.logout(); UI.showAuth('Logged out.'); $('auth-msg').classList.remove('bad'); });
    body.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
      s[inp.dataset.key] = parseFloat(inp.value); Save.write(); Sound.applyVolumes();
    }));
    body.querySelectorAll('.seg').forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const key = g.dataset.key;
      let v = b.dataset.v;
      if (key === 'vibration' || key === 'minimap' || key === 'replays') v = v === 'true';
      if (key === 'minutes') v = parseInt(v, 10);
      s[key] = v; Save.write(); this.tap();
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      if (key === 'graphics') { Render.quality = 0; Render.resize(); }
      if (key === 'controls') this.applyControls();
      if (key === 'vibration' && v) vibrate(20);
    })));
    const reset = $('reset-progress');
    reset.addEventListener('click', () => {
      if (!reset.classList.contains('armed')) { reset.classList.add('armed'); reset.textContent = 'TAP AGAIN TO WIPE'; return; }
      const settings = Save.data.settings, club = Save.data.club;
      Save.data = Save.defaults();
      Save.data.settings = settings; Save.data.club = club;
      Save.write();
      this.tap();
      this.panel_settings(body);
      this.refreshHome();
    });
  },

  controlsRef() {
    const k = (s, wide) => `<span class="kc${wide ? ' wide' : ''}">${s}</span>`;
    return `<div class="controls-ref">
      <div><h3>PC</h3><ul>
        <li>${k('WASD', 1)} move (arrows work too)</li>
        <li>${k('SHIFT', 1)} hold to sprint</li>
        <li>${k('SPACE', 1)} hold to charge, release to shoot</li>
        <li>${k('E')} pass &nbsp; ${k('Q')} skill &nbsp; ${k('F')} tackle</li>
        <li>${k('LMB', 1)} shoot &nbsp; ${k('RMB', 1)} pass &nbsp; ${k('MMB', 1)} skill</li>
        <li>${k('ESC', 1)} pause</li>
      </ul></div>
      <div><h3>SKILLS &amp; TACKLES</h3><ul>
        <li>Skill + no direction: HOP (jumps tackles)</li>
        <li>Skill + forward: nutmeg / flick / burst</li>
        <li>Skill + sideways: SPIN · backward: CRUYFF</li>
        <li>Any skill makes tackles miss for a moment</li>
        <li>TACKLE near the carrier to lunge and steal it</li>
        <li>Sprint drains stamina — empty means wait</li>
      </ul></div>
    </div>`;
  },

  // ---- league: every club, points from every online match its players play ----
  async panel_league(body) {
    $('modal-title').textContent = 'LEAGUE';
    body.innerHTML = '<p class="note">Loading the table…</p>';
    const r = await Net.league();
    if ($('modal').dataset.kind !== 'league') return;
    if (!r || !r.ok) { body.innerHTML = `<p class="note">${(r && r.msg) || "Can't reach the server"}</p>`; return; }
    const mine = Save.data.club;
    const pos = r.table.findIndex((row) => row.club === mine) + 1;
    this._leaguePos = pos;
    body.innerHTML = `
      <p class="note">The top 20 countries, one table. Every online match a country's players win is 3 points for that country (a draw is 1). You're playing for <b>${Clubs.mine().name}</b>${pos ? ` — ${pos}${['th', 'st', 'nd', 'rd'][pos % 10 > 3 || (pos % 100 > 10 && pos % 100 < 14) ? 0 : pos % 10]} in the table` : ''}.</p>
      <div class="league-wrap">
        <div class="lg-table-wrap"><table class="lg-table">
          <thead><tr><th>#</th><th class="lg-club">COUNTRY</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th><th title="Players">👥</th></tr></thead>
          <tbody>${r.table.map((row, i) => { const c = Clubs.get(row.club); return `<tr class="${row.club === mine ? 'mine' : ''} ${i < 4 ? 'top' : ''}"><td>${i + 1}</td><td class="lg-club"><span class="lg-name"><canvas width="42" height="28" data-club="${c.id}"></canvas><b>${c.name}</b></span></td><td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td><td class="pts">${row.pts}</td><td>${row.players}</td></tr>`; }).join('')}</tbody>
        </table></div>
        <div class="lg-side">
          <h3>TOP SCORERS</h3>
          ${r.scorers.length ? `<ol class="lg-scorers">${r.scorers.map((s) => `<li><canvas width="42" height="28" data-club="${s.club}"></canvas><b>${s.name}</b><em>${s.goals}</em></li>`).join('')}</ol>` : '<p class="note">No online goals yet. Be the first.</p>'}
        </div>
      </div>`;
    body.querySelectorAll('canvas[data-club]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.club)));
  },

  // ---- profile: career stats + achievements ----
  panel_profile(body) {
    $('modal-title').textContent = 'PROFILE';
    const d = Save.data, c = d.career, ch = Save.character(), lv = Levels.info(d.xp || 0);
    const winPct = d.matches ? Math.round((d.wins / d.matches) * 100) : 0;
    const stats = [['MATCHES', d.matches], ['WINS', d.wins], ['GOALS', d.goals], ['ASSISTS', c.assists], ['TACKLES', c.tackles], ['SKILLS', c.skills],
      ['DODGES', c.dodges], ['POWER GOALS', c.powerGoals], ['HAT-TRICKS', c.hattricks], ['CLEAN SHEETS', c.cleanSheets], ['BEST STREAK', c.bestStreak], ['ONLINE WINS', c.onlineWins || 0]];
    const rank = (a) => (Achievements.ready(a) ? 0 : Achievements.claimed(a) ? 2 : 1);
    const list = ACHIEVEMENTS.slice().sort((a, b) => rank(a) - rank(b) || Achievements.progress(b) / b.goal - Achievements.progress(a) / a.goal);
    const done = ACHIEVEMENTS.filter((a) => Achievements.claimed(a)).length;
    body.innerHTML = `
      <div class="prof-top">
        <canvas width="96" height="96" id="prof-canvas"></canvas>
        <div class="prof-id">
          <strong>${ch.name}</strong>
          <small>${Save.account || 'GUEST'} · ${Clubs.mine().name} · LEVEL ${lv.level} ${rankFor(lv.level)} · <em style="color:${RARITIES[ch.rarity].color}">${RARITIES[ch.rarity].name}</em> · OVR ${overall(ch.r)}</small>
          <small class="ramp-note">Every level makes every match harder — opponents are +${levelRampPct(lv.level)}% sharper than at level 1${lv.level >= LEVEL_RAMP_TOP ? ' (maxed)' : ''}.</small>
          <span>${d.wins}W · ${d.draws || 0}D · ${d.losses || 0}L · ${winPct}% WON</span>
        </div>
        ${this.coinsLine()}
      </div>
      <div class="prof-stats">${stats.map(([k, v]) => `<div><b>${v || 0}</b><small>${k}</small></div>`).join('')}</div>
      <h3 class="prof-h">ACHIEVEMENTS <small>${done} / ${ACHIEVEMENTS.length}</small></h3>
      <div class="ach-list">${list.map((a) => {
        const p = Achievements.progress(a), ready = Achievements.ready(a), claimed = Achievements.claimed(a);
        const right = ready ? `<button class="claim" data-id="${a.id}">CLAIM <span class="coin"></span>${a.coins}</button>`
          : claimed ? '<span class="ach-done">DONE</span>'
          : `<span class="ach-prog">${p} / ${a.goal}</span><span class="ach-coins"><span class="coin"></span>${a.coins}</span>`;
        return `<div class="ach ${ready ? 'ready' : claimed ? 'claimed' : ''}"><i class="medal"></i>
          <div class="ach-txt"><strong>${a.name}</strong><small>${a.text}</small><span class="ach-bar"><b style="width:${Math.round((p / a.goal) * 100)}%"></b></span></div>
          <div class="ach-right">${right}</div></div>`;
      }).join('')}</div>`;
    this.portrait($('prof-canvas'), Save.look());
    body.querySelectorAll('.claim').forEach((btn) => btn.addEventListener('click', () => {
      const coins = Achievements.claim(btn.dataset.id);
      if (!coins) return;
      Sound.goalJingle(true); vibrate(25);
      this.toast(`+${coins} COINS`);
      const scroll = body.parentElement.scrollTop;
      this.panel_profile(body);
      body.parentElement.scrollTop = scroll;
      this.refreshHome();
    }));
  },

  // ---- little canvases ----
  fakePlayer(look, team = 'blue', keeper = false, number = 10) {
    return { team, isKeeper: keeper, number, look, vx: 0, vy: 0, fx: 1, fy: 0.3, faceX: 1, kickT: 0, kickDur: 0.2, celebrateT: 0, diveT: 0, stunT: 0, recoverT: 0, seed: 0, runPhase: 0, sad: false, slideT: 0, fallT: 0, hopT: 0 };
  },

  portrait(cv, look, team = 'blue', keeper = false, number = 10) {
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = TEAMS[team].board;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.clip();
    const k = w / 50;
    Sprites.player(g, this.fakePlayer(look, team, keeper, number), w / 2 - 2 * k, h * 0.46 + 56 * k, k, 0);
    g.restore();
    g.lineWidth = 3; g.strokeStyle = OUTLINE;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.stroke();
  },

  trailSwatch(cv, id) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#4fbd3b'; g.fillRect(0, 0, w, h);
    const pts = [];
    for (let i = 0; i < 12; i++) pts.push({ x: w - 30 - i * 13, y: h / 2 + Math.sin(i * 0.5) * 6 });
    const R = { S: 1.6, sx: (x) => x, sy: (y) => y };
    const b = { trailType: id, trail: pts.slice(1).map((p) => ({ x: p.x, y: p.y, z: -CFG.BALL_R })), x: pts[0].x, y: pts[0].y, z: -CFG.BALL_R };
    const prev = Game.headless; Game.headless = true; // no stray particles from the swatch
    Sprites.trail(g, b, R, 0.3);
    Game.headless = prev;
    Sprites.ball(g, { x: 0, y: 0, z: 0, vx: 1, vy: 0, roll: 0.6, shot: null, owner: null }, pts[0].x, pts[0].y, 1.8, 0);
  },

  // every celebration card plays its animation on a loop while the tab is open
  animateCelebs(body) {
    const cards = [...body.querySelectorAll('canvas[data-celeb]')];
    const start = performance.now();
    const frame = () => {
      if ($('modal').hidden || !cards.length || !cards[0].isConnected) return;
      const e = ((performance.now() - start) / 1000) % (CELE_TIME + 0.5);
      for (const cv of cards) this.celebSwatch(cv, cv.dataset.celeb, Math.min(e, CELE_TIME - 0.02));
      requestAnimationFrame(frame);
    };
    frame();
  },

  celebSwatch(cv, id, e = 1.5) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#55c541'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4fbd3b'; for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 20, h);
    const ch = Save.character();
    this._celebFake = this._celebFake || {};
    const p = this._celebFake[id] || (this._celebFake[id] = this.fakePlayer({ hair: ch.hair, hairColor: ch.hairColor, skin: ch.skin, cap: ch.cap, band: ch.band }));
    p.look = Save.look();
    const run = CELE_MOVES[id] ? CELE_MOVES[id](e) : 0;
    p.celebrateT = CELE_TIME - e; p.celebKind = id; p.faceX = 1; p.fx = 1; p.fy = 0.25;
    p.vx = run; p.vy = 0; p.runPhase = e * 9;
    const pose = CELE_POSES[id] ? CELE_POSES[id](e, e, p) : null;
    const lying = pose && pose.lie;
    g.fillStyle = 'rgba(20,60,20,0.28)'; g.beginPath(); g.ellipse(w / 2, h - 12, lying ? 44 : 28, 9, 0, 0, Math.PI * 2); g.fill();
    Sprites.player(g, p, w / 2 + (lying === 'back' ? 30 : lying === 'front' ? -26 : 0), h - 12, 1.4, e);
  },

  ballSwatch(cv, id) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#4fbd3b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#55c541'; for (let i = 0; i < 8; i += 2) g.fillRect(i * 25, 0, 25, h);
    const skin = BALLS.find((b) => b.id === id);
    g.fillStyle = 'rgba(20,60,20,0.28)'; g.beginPath(); g.ellipse(w / 2, h - 16, 26, 8, 0, 0, Math.PI * 2); g.fill();
    Sprites.ball(g, { x: 0, y: 0, z: 0, vx: 1, vy: 0.3, roll: 0.9, shot: null, owner: null, skin }, w / 2, h / 2 - 4, 3.2, Game.t);
  },

  stadiumSwatch(cv, id) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const st = STADIUMS.find((s) => s.id === id);
    // the real stadium, drawn small, with a still of its weather on top
    g.drawImage(Render.stadiumThumb(st), 0, 0, w, h);
    const sc = w / 1020;
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    Render.drawWeather(g, 1.3, { st, W: w, H: h, S: 0.6, px: (x) => (x + 150) * sc, py: (y) => (y * CFG.TILT + 210) * sc, k: () => sc });
    g.restore();
  },
});
