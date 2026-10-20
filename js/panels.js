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
    const pensClub = Clubs.random(Clubs.mine());
    const fmt = Save.data.format || '4v4';
    const club = Clubs.mine();
    const wcRound = Online.wcRound();
    body.innerHTML = `
      <div class="formats"><span>FORMAT</span>${['1v1', '2v2', '3v3', '4v4'].map((f) => `<button data-format="${f}" class="${f === fmt ? 'sel' : ''}">${f}</button>`).join('')}</div>
      <div class="online-row">
        <button class="mode online" data-needs-net data-mode="online">
          <strong>PLAY ONLINE</strong>
          <p>Play real people from every country.</p>
          <span class="tag">WIN = ${club.name} MOVES UP THE LEAGUE</span>
        </button>
        <div class="room-box">
          <small>PLAY WITH FRIENDS</small>
          <button class="mid-btn" data-needs-net data-room="create">CREATE ROOM</button>
          <div class="join"><input id="join-code" maxlength="5" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="mid-btn" data-needs-net data-room="join">JOIN</button></div>
        </div>
      </div>
      <p class="note vs-bots">MORE WAYS TO PLAY</p>
      <div class="modes">
        <button class="mode ranked" data-needs-net data-mode="ranked">
          <strong>RANKED</strong>
          <p>1v1 for rank points — the only place they are won. Win +10, draw +5, and every one of your three challenges is +1 more when you win. Lose and you drop nothing.</p>
          <span class="tag">ONLINE · 1V1</span>
        </button>
        <button class="mode quick" data-mode="quick">
          <strong>QUICK MATCH</strong>
          <p>One match vs a random country. Fast, loose, fun.</p>
          <span class="tag">3 CHALLENGES · COINS · XP</span>
        </button>
        <button class="mode cup" data-mode="worldcup">
          <strong>WORLD CUP</strong>
          <p>Two cups: online against real players, or against bots. No draws. Lose once and you're out.</p>
          <span class="tag">ONLINE: ${WC_ROUNDS[wcRound]} · BOTS: ${cup ? Cup.ROUNDS[cup.round] : 'NEW CUP'}</span>
        </button>
        <button class="mode pens" data-mode="pens">
          <strong>PENALTY SHOOTOUT</strong>
          <p>Five kicks each, then sudden death. Pick your corner, then save theirs.</p>
          <span class="tag">VS ${pensClub.name}</span>
        </button>
        <button class="mode friendcup" data-needs-net data-mode="friendcup">
          <strong>FRIEND CUP</strong>
          <p>A knockout between 4 or 8 friends. Win your 1v1 and you go through. No draws.</p>
          <span class="tag">ONLINE · WITH FRIENDS</span>
        </button>
        <button class="mode chal" data-mode="challenges">
          <strong>SKILL CHALLENGES</strong>
          <p>Target practice, keeper mode and the dribble gauntlet. Medals and coins.</p>
          <span class="tag">3 TESTS</span>
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
    body.querySelector('[data-mode="pens"]').addEventListener('click', () => { this.tap(); this._pensClub = pensClub; this.openModal('pensmode'); });
    body.querySelector('[data-mode="challenges"]').addEventListener('click', () => { this.tap(); this.openModal('challenges'); });
    body.querySelector('[data-mode="friendcup"]').addEventListener('click', () => { this.tap(); this.openModal('cup'); });
    body.querySelector('[data-mode="ranked"]').addEventListener('click', () => { this.tap(); Online.findMatch('ranked'); });
    body.querySelector('[data-mode="training"]').addEventListener('click', () => { this.tap(); Game.startMatch({ mode: 'training', club: Clubs.random(Clubs.mine()) }); });
    body.querySelector('[data-mode="worldcup"]').addEventListener('click', () => { this.tap(); this.openModal('worldcup'); });
  },

  // ---- PENALTY SHOOTOUT: choose local or online without leaving the game UI ----
  panel_pensmode(body) {
    $('modal-title').textContent = 'PENALTY SHOOTOUT';
    const club = this._pensClub || Clubs.random(Clubs.mine());
    body.innerHTML = `
      <div class="modes pen-choice">
        <button class="mode pens" data-pens="offline">
          <strong>OFFLINE</strong>
          <p>Play five kicks each against a computer-controlled opponent.</p>
          <span class="tag">VS ${club.name}</span>
        </button>
        <button class="mode online" data-pens="online">
          <strong>ONLINE</strong>
          <p>Kick for kick against a real opponent, live.</p>
          <span class="tag">ONLINE PENALTIES</span>
        </button>
      </div>`;
    body.querySelector('[data-pens="offline"]').addEventListener('click', () => { this.tap(); Game.startMatch({ mode: 'pens', club }); });
    body.querySelector('[data-pens="online"]').addEventListener('click', () => { this.tap(); Online.findMatch('pens'); });
  },

  // ---- FRIEND CUP: a knockout between four or eight friends ----
  panel_cup(body) {
    $('modal-title').textContent = 'FRIEND CUP';
    const c = Social.cup;
    if (!Net.user) { body.innerHTML = '<p class="note">Log in to run a cup with your friends.</p>'; return; }
    if (!c) {
      body.innerHTML = `
        <p class="note">A knockout between your friends. Everyone plays 1v1, the winner of each tie goes through, and the last one standing lifts the cup. No draws: golden goal decides it.</p>
        <div class="cup-pick"><button class="big-btn" data-size="4">4 PLAYERS</button><button class="big-btn" data-size="8">8 PLAYERS</button></div>
        <p class="note">You pick the size, then invite friends who are online. The draw is random.</p>`;
      body.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => { this.tap(); Net.send({ t: 'cup.create', size: Number(b.dataset.size) }); }));
      return;
    }
    const you = Net.user.name, host = c.host === you;
    const slots = [];
    for (const p of c.players) slots.push(`<div class="cup-slot ${p.out ? 'out' : ''} ${p.name === you ? 'you' : ''}"><canvas width="36" height="24" data-club="${p.club}"></canvas><b>${esc(p.name)}</b>${p.name === c.host ? '<i class="crown"></i>' : ''}${p.gone ? '<small>OFFLINE</small>' : ''}</div>`);
    for (const nm of c.invited) slots.push(`<div class="cup-slot asked"><b>${esc(nm)}</b><small>ASKED…</small>${host ? `<button class="fr-x" data-drop="${esc(nm)}" aria-label="Cancel">×</button>` : ''}</div>`);
    while (slots.length < c.size) slots.push('<div class="cup-slot empty"><b>EMPTY</b></div>');

    if (c.state === 'lobby') {
      const free = Social.friends.filter((f) => f.status !== 'offline' && !c.players.some((p) => p.name === f.name) && !c.invited.includes(f.name));
      body.innerHTML = `
        <div class="cup-slots">${slots.join('')}</div>
        ${host ? `<h3 class="fr-h">INVITE FRIENDS</h3>
          ${free.length ? free.map((f) => `<div class="fr-row"><b>${esc(f.name)}</b><em class="fr-st on">${(FRIEND_STATUS[f.status] || FRIEND_STATUS.online)[0]}</em><button class="mid-btn blue" data-ask="${esc(f.name)}">INVITE</button></div>`).join('')
            : '<p class="note">No friends online to ask right now.</p>'}` : '<p class="note">Waiting for the host to start it.</p>'}
        <div class="cup-foot">
          ${host ? `<button class="big-btn green" data-start ${c.players.length === c.size ? '' : 'disabled'}>${c.players.length === c.size ? 'START THE CUP' : `WAITING · ${c.players.length}/${c.size}`}</button>` : ''}
          <button class="mid-btn red" data-leave>${host ? 'CALL IT OFF' : 'LEAVE'}</button>
        </div>`;
    } else {
      const left = Social.cupAt ? Math.max(0, Math.ceil((Social.cupAt - performance.now()) / 1000)) : 0;
      const rounds = c.rounds.map((ties, r) => `
        <h3 class="fr-h">${CUP_ROUNDS[c.of - 1 - r] || 'ROUND ' + (r + 1)}</h3>
        <div class="cup-ties">${ties.map((t) => {
          const line = (nm, sc, won) => `<span class="${won ? 'won' : ''} ${nm === you ? 'you' : ''}"><b>${esc(nm || '—')}</b><em>${sc === null || sc === undefined ? '' : sc}</em></span>`;
          return `<div class="cup-tie ${t.live ? 'live' : ''}">${line(t.a, t.sa, t.w && t.w === t.a)}${line(t.b, t.sb, t.w && t.w === t.b)}${t.live ? '<i class="tag-live">LIVE</i>' : ''}</div>`;
        }).join('')}</div>`).join('');
      body.innerHTML = `
        ${c.state === 'done' ? `<div class="cup-champ"><small>WINNER</small><strong>${esc(c.champion || 'NOBODY')}</strong></div>`
        : left ? `<p class="note big-note">${CUP_ROUNDS[c.of - 1 - c.round] || 'THE NEXT ROUND'} STARTS IN ${left}…</p>`
          : '<p class="note big-note">MATCHES ARE ON</p>'}
        ${rounds}
        <div class="cup-foot"><button class="mid-btn red" data-leave>${c.state === 'done' ? 'CLOSE THE CUP' : 'GIVE UP'}</button></div>`;
    }
    body.querySelectorAll('canvas[data-club]').forEach((cv) => UI.flagBadge(cv, Clubs.get(cv.dataset.club)));
    const on = (sel, fn) => body.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); fn(b); }));
    on('[data-ask]', (b) => { this.tap(); Net.send({ t: 'cup.invite', name: b.dataset.ask }); });
    on('[data-drop]', (b) => { this.tap(); Net.send({ t: 'cup.uninvite', name: b.dataset.drop }); });
    on('[data-start]', () => { this.tap(); Net.send({ t: 'cup.start' }); });
    on('[data-leave]', () => { this.tap(); Net.send({ t: 'cup.leave' }); this.closeModal(); });
  },

  // ---- LEADERBOARD: the ranked ladder, best first ----
  async panel_leaderboard(body) {
    $('modal-title').textContent = 'LEADERBOARD';
    body.innerHTML = '<p class="note">Loading the ladder…</p>';
    const r = await Net.leaderboard();
    if ($('modal').dataset.kind !== 'leaderboard') return;
    if (!r || !r.ok) { body.innerHTML = `<p class="note">${(r && r.msg) || "Can't reach the server"}</p>`; return; }
    const days = Math.max(0, Math.ceil((r.ends - Date.now()) / 86400000));
    const me = Net.user && Net.user.name;
    const row = (x) => {
      const t = RANK_TIERS.find((y) => y.id === x.tier) || RANK_TIERS[0];
      return `<li class="${x.name === me ? 'you' : ''} ${x.pos <= 3 ? 'podium p' + x.pos : ''}">
        <b>${x.pos}</b><canvas width="42" height="28" data-club="${x.club}"></canvas>
        <span>${esc(x.name)}</span>
        <em style="--t:${t.color}">${x.tierName}</em>
        <i>${x.rp}<small>RP</small></i></li>`;
    };
    const outside = r.you && r.you.pos > r.top.length;
    body.innerHTML = `
      <p class="note">${r.players} player${r.players === 1 ? '' : 's'} on the board this season · ${days} day${days === 1 ? '' : 's'} left. Rank points come from RANKED matches only.</p>
      ${r.top.length ? `<ol class="lb-board">${r.top.map(row).join('')}</ol>` : '<p class="note">Nobody has won a ranked match yet. Be the first one on it.</p>'}
      ${outside ? `<h3 class="fr-h">YOU</h3><ol class="lb-board">${row(r.you)}</ol>` : ''}
      ${!r.you && Net.user ? '<p class="note">Win a ranked match and you are on it.</p>' : ''}
      <div class="cup-foot"><button class="mid-btn" data-open2="ranked">YOUR RANK</button><button class="big-btn green" data-rankplay>PLAY RANKED</button></div>`;
    body.querySelectorAll('canvas[data-club]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.club)));
    const go = body.querySelector('[data-rankplay]');
    if (go) go.addEventListener('click', () => { this.tap(); this.closeModal(); Online.findMatch('ranked'); });
    const back = body.querySelector('[data-open2="ranked"]');
    if (back) back.addEventListener('click', () => { this.tap(); this.openModal('ranked'); });
  },

  // ---- RANKED: your tier this season and what is left to climb ----
  panel_ranked(body) {
    $('modal-title').textContent = 'RANKED';
    const rk = (Net.user && Net.user.rank) || null;
    if (!rk) { body.innerHTML = '<p class="note">Play an online match and your rank starts here.</p>'; return; }
    const tier = RANK_TIERS.find((x) => x.id === rk.tier) || RANK_TIERS[0];
    const next = rk.next;
    const into = next ? clamp((rk.rp - tier.at) / (next.at - tier.at), 0, 1) : 1;
    const days = Math.max(0, Math.ceil((rk.ends - Date.now()) / 86400000));
    body.innerHTML = `
      <div class="rank-head" style="--t:${tier.color}">
        <div class="rank-badge"><i></i><b>${tier.name}</b></div>
        <div class="rank-rp"><b>${rk.rp}</b><small>RANK POINTS</small></div>
      </div>
      <div class="rank-bar"><b style="width:${Math.round(into * 100)}%;background:${tier.color}"></b></div>
      <p class="note">${next ? `${Math.max(0, next.at - rk.rp)} RP TO ${next.name}` : 'TOP TIER — NOBODY IS ABOVE YOU'} · SEASON ENDS IN ${days} DAY${days === 1 ? '' : 'S'}</p>
      <div class="rank-stats"><span>WON <b>${rk.wins}</b></span><span>PLAYED <b>${rk.played}</b></span><span>BEST <b>${rk.best}</b></span></div>
      <h3 class="fr-h">TIERS · WHAT EACH PAYS WHEN THE SEASON ENDS</h3>
      <div class="rank-tiers">${RANK_TIERS.map((x) => `<div class="rank-tier ${x.id === tier.id ? 'you' : ''}" style="--t:${x.color}"><i></i><b>${x.name}</b><small>${x.at} RP</small><em><span class="coin"></span>${x.reward}</em></div>`).join('')}</div>
      <div class="rank-how"><b>HOW POINTS WORK</b><span>WIN <em>+10</em></span><span>DRAW <em>+5</em></span><span>LOSE <em>0</em></span><span>EACH CHALLENGE YOU WIN WITH <em>+1</em></span></div>
      <p class="note">Only RANKED matches move your rank — 1v1, from PLAY. Every ranked match sets you three challenges, each worth a point if you win the match. A rank never goes backwards: losing costs nothing. When a season ends you are paid for the tier you finished in and the next one starts you part of the way back down.</p>
      <div class="cup-foot"><button class="mid-btn" data-board>LEADERBOARD</button><button class="big-btn green rank-play" data-rankplay>PLAY RANKED</button></div>`;
    const lb = body.querySelector('[data-board]');
    if (lb) lb.addEventListener('click', () => { this.tap(); this.openModal('leaderboard'); });
    const go = body.querySelector('[data-rankplay]');
    if (go) go.addEventListener('click', () => { this.tap(); this.closeModal(); Online.findMatch('ranked'); });
  },

  // ---- WORLD CUP: two cups side by side, online and vs bots, each with its road to the final ----
  panel_worldcup(body) {
    $('modal-title').textContent = 'WORLD CUP';
    const fmt = Save.data.format || '4v4';
    const flagCell = (id) => { const c = Clubs.get(id); return `<span><canvas width="42" height="28" data-flag="${c.id}"></canvas>${c.short}</span>`; };
    // online: the round you're in comes from the server; this run's results from your last matches
    const round = Online.wcRound(), titles = (Net.user && Net.user.wc && Net.user.wc.titles) || 0;
    const runAll = Array.isArray(Save.data.wcRun) ? Save.data.wcRun : [];
    const run = runAll.length === round ? runAll : [];
    const online = WC_ROUNDS.map((name, i) => {
      const r = run[i];
      const cls = i < round ? 'won' : i === round ? 'next' : '';
      return `<li class="${cls}"><small>${name}</small>${r ? flagCell(r.club) : `<span>${i === round ? 'NEXT' : '—'}</span>`}<em>${r ? `${r.mine}-${r.theirs}` : ''}</em></li>`;
    }).join('');
    // bots: three set opponents per cup
    const cup = Cup.state();
    const bots = Cup.ROUNDS.map((name, i) => {
      const res = cup && cup.results[i];
      const cls = !cup ? '' : res ? (res.won ? 'won' : 'lost') : i === cup.round ? 'next' : '';
      return `<li class="${cls}"><small>${name}</small>${cup ? flagCell(cup.opponents[i]) : '<span>?</span>'}<em>${res ? `${res.blue}-${res.red}` : ''}</em></li>`;
    }).join('');
    body.innerHTML = `
      <div class="formats"><span>FORMAT</span>${['1v1', '2v2', '3v3', '4v4'].map((f) => `<button data-format="${f}" class="${f === fmt ? 'sel' : ''}">${f}</button>`).join('')}</div>
      <div class="wc-panels">
        <section class="wc-panel online">
          <header><strong>ONLINE</strong><small>Against real players from every country, round of 16 to the final.</small></header>
          <ol class="wc-bracket">${online}</ol>
          <div class="wc-foot"><span class="tag">WIN IT: +${WC_PRIZE} COINS${titles ? ` · WON ${titles}` : ''}</span><button class="mid-btn" data-needs-net data-cup="online">PLAY ${WC_ROUNDS[round]}</button></div>
        </section>
        <section class="wc-panel bots">
          <header><strong>VS BOTS</strong><small>Three knockout matches offline, each one tougher.</small></header>
          <ol class="wc-bracket">${bots}</ol>
          <div class="wc-foot"><span class="tag">WIN IT: +300 COINS${Save.data.trophies ? ` · WON ${Save.data.trophies}` : ''}</span><button class="mid-btn" data-cup="bots">${cup ? `PLAY ${Cup.ROUNDS[cup.round]}` : 'START CUP'}</button></div>
        </section>
      </div>
      <p class="note" style="margin-top:12px">No draws in either cup: level at full time goes to golden goal. Lose once and you're out. Win it and lift the trophy.</p>`;
    body.querySelectorAll('canvas[data-flag]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.flag)));
    body.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => {
      Save.data.format = b.dataset.format; Save.write(); this.tap();
      body.querySelectorAll('[data-format]').forEach((x) => x.classList.toggle('sel', x === b));
    }));
    body.querySelector('[data-cup="online"]').addEventListener('click', () => { this.tap(); Online.findMatch(Save.data.format || '4v4', true); });
    body.querySelector('[data-cup="bots"]').addEventListener('click', () => {
      this.tap();
      if (!Cup.state()) Cup.start();
      Game.startMatch({ mode: 'cup' });
    });
  },

  // Redraw a panel without losing your place in it.
  //
  // Panels redraw themselves after you equip something, so the card you picked shows as the one
  // you are wearing. The redraw replaces the element you were scrolling with a brand new one,
  // and a brand new one starts at the top — so equipping a skill near the bottom of forty-one
  // threw you back up to Classic every time.
  //
  // The positions are remembered by selector, not by element: the elements themselves do not
  // survive the redraw, but a '.trail-grid' before is a '.trail-grid' after.
  redraw(body, render) {
    const key = (el) => {
      if (el === body) return ':body';
      if (el === body.parentElement) return ':parent';
      const cls = String(el.className || '').trim().split(/\s+/)[0];
      return cls ? '.' + cls : el.tagName.toLowerCase();
    };
    const marks = [];
    for (const el of [body, body.parentElement, ...body.querySelectorAll('*')]) {
      if (el && el.scrollTop > 0) marks.push([key(el), el.scrollTop]);
    }
    render();
    for (const [sel, top] of marks) {
      const el = sel === ':body' ? body : sel === ':parent' ? body.parentElement : body.querySelector(sel);
      if (el) el.scrollTop = top;
    }
  },

  // shared buy/equip card behaviour: first tap on a locked item arms "BUY", second tap buys
  shopCard(el, kind, id, onEquip) {
    el.addEventListener('click', () => {
      if (Shop.owns(kind, id)) { this.tap(); onEquip(); return; }
      Sound.steal();
      el.classList.add('nope'); setTimeout(() => el.classList.remove('nope'), 400);
      this.toast('OPEN CRATES TO FIND THIS ONE');
    });
  },

  // Nothing is sold item by item any more. An item you have not got says which grade of crate it
  // is hiding in instead.
  priceTag(kind, id) {
    if (Shop.owns(kind, id)) return '';
    const rar = Crates.rarity(kind, id);
    return `<span class="price locked-tag" style="--r:${RARITIES[rar].color}"><i></i>${RARITIES[rar].name}</span><span class="buy">FROM CRATES</span>`;
  },

  coinsLine() { return `<div class="panel-coins"><span class="coin"></span><b>${fmtCoins(Save.data.coins)}</b></div>`; },

  // ---- characters ----
  panel_characters(body) {
    $('modal-title').textContent = 'CHARACTERS';
    const list = this.charList();
    body.innerHTML = `${this.coinsLine()}<p class="note">Better players are faster, shoot harder, pass sharper, keep the ball and win tackles. The best ones take days of play to afford.</p><div class="char-grid">${list.map((c) => this.charCard(c)).join('')}</div>`;
    body.querySelectorAll('canvas[data-portrait]').forEach((cv) => this.portrait(cv, CHARACTERS.find((c) => c.id === cv.dataset.portrait)));
    body.querySelectorAll('.char-card-sm').forEach((el) => this.shopCard(el, 'character', el.dataset.id, () => {
      Save.data.character = el.dataset.id; Save.write();
      this.redraw(body, () => this.panel_characters(body));
      this.refreshHome();
    }));
  },

  // ---- missions: jobs worth coins ----
  panel_missions(body) {
    $('modal-title').textContent = 'MISSIONS';
    const m = Missions.state();
    const row = (job, big) => {
      const def = Missions.def(job.id);
      if (!def) return '';
      const done = job.n >= def.n, pct = Math.round((job.n / def.n) * 100);
      return `<div class="mission ${big ? 'big' : ''} ${job.done ? 'paid' : done ? 'ready' : ''}">
        <div class="m-top"><strong>${def.text.replace('{n}', def.n)}</strong><span class="m-coins"><span class="coin"></span>${fmtCoins(def.coins)}</span></div>
        <i class="m-bar"><b style="width:${Math.min(100, pct)}%"></b></i>
        <div class="m-bot"><em>${Math.min(job.n, def.n)} / ${def.n}</em>
        ${job.done ? '<span class="m-paid">CLAIMED</span>' : done ? `<button class="m-claim" data-claim="${job.id}">CLAIM</button>` : ''}</div>
      </div>`;
    };
    // "day N of your run" only while the run is alive: a new player has no day 0, and after a
    // missed day the saved number is stale (the next claim starts again at day 1)
    const dl = Save.data.daily || {};
    const runAlive = dl.last && dl.streak > 0 && Daily.dayNum(Daily.key()) - Daily.dayNum(dl.last) <= 1;
    const streak = runAlive ? dl.streak : 0;
    body.innerHTML = `${this.coinsLine()}
      <p class="note">Jobs pay coins, and coins open crates. They swap over at midnight; the big one lasts the week.</p>
      <div class="m-head">TODAY${streak ? `<small>day ${streak} of your run</small>` : ''}</div>
      <div class="mission-list">${m.daily.map((j) => row(j, false)).join('')}</div>
      <div class="m-head">THIS WEEK</div>
      <div class="mission-list">${m.weekly ? row(m.weekly, true) : ''}</div>`;
    body.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => {
      const got = Missions.claim(b.dataset.claim);
      if (!got) return;
      Sound.powerReady();
      // the coins actually go somewhere, rather than a number quietly changing
      const at = Pop.at(b);
      Pop.coins(b, got >= 5000 ? 16 : 10);
      Pop.ring(at.x, at.y, '#ffc21a', 180, 420);
      Pop.shout(at.x, at.y - 24, '+' + fmtCoins(got), '#ffc21a', 900);
      Pop.confetti(at.x, at.y, ['#ffc21a', '#ffffff', '#35c06a'], got >= 5000 ? 34 : 18);
      this.toast('+' + fmtCoins(got) + ' COINS');
      this.redraw(body, () => this.panel_missions(body));
      this.refreshHome();
    }));
  },

  // ---- collection: everything in the game, and how much of it is yours ----
  panel_collection(body) {
    $('modal-title').textContent = 'COLLECTION';
    const kinds = [['character', 'PLAYERS'], ['ball', 'BALLS'], ['trail', 'POWER TRAILS'], ['celebration', 'CELEBRATIONS'], ['accessory', 'ACCESSORIES']];
    let own = 0, all = 0;
    const order = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    let best = null, bestRank = -1;
    const rows = kinds.map(([kind, label]) => {
      const list = Crates.list(kind).filter((x) => x.rarity !== 'oneofone' && !x.only);
      const mine = list.filter((x) => Shop.owns(kind, x.id));
      own += mine.length; all += list.length;
      for (const it of mine) { const r = order.indexOf(Crates.rarity(kind, it.id)); if (r > bestRank) { bestRank = r; best = { kind, id: it.id }; } }
      const byRarity = order.map((r) => {
        const of = list.filter((x) => Crates.rarity(kind, x.id) === r);
        if (!of.length) return '';
        const got = of.filter((x) => Shop.owns(kind, x.id)).length;
        return `<i style="--r:${RARITIES[r].color}">${got}/${of.length}</i>`;
      }).join('');
      const pct = Math.round((mine.length / Math.max(1, list.length)) * 100);
      return `<div class="coll-row">
        <div class="coll-top"><strong>${label}</strong><em>${mine.length} / ${list.length}</em></div>
        <i class="coll-bar"><b style="width:${pct}%"></b></i>
        <div class="coll-rar">${byRarity}</div>
      </div>`;
    }).join('');
    const pct = Math.round((own / Math.max(1, all)) * 100);
    body.innerHTML = `<div class="coll-head">
        <div class="coll-big"><b>${pct}%</b><small>${own} of ${all} things</small><i class="coll-bar wide"><b style="width:${pct}%"></b></i></div>
        <div class="coll-best"><small>BEST FIND</small><canvas id="coll-best-art" width="120" height="120"></canvas>
          <strong id="coll-best-name">—</strong></div>
      </div>
      <div class="coll-list">${rows}</div>
      <button class="big-btn green" id="coll-crates">OPEN CRATES</button>`;
    const art = $('coll-best-art');
    if (best && art) {
      this.itemSwatch(art, best);
      const rar = Crates.rarity(best.kind, best.id);
      $('coll-best-name').textContent = Crates.name(best.kind, best.id);
      $('coll-best-name').style.color = RARITIES[rar].color;
    } else if (art) {
      art.getContext('2d').clearRect(0, 0, art.width, art.height);
      $('coll-best-name').textContent = 'NOTHING YET';
    }
    $('coll-crates').addEventListener('click', () => { this.tap(); this.openModal('crates'); });
  },

  // ---- crates: the only way to get anything new ----
  // ---- coins: packs bought with real money, in the app only (js/store.js does the buying) ----
  panel_coins(body) {
    $('modal-title').textContent = 'GET COINS';
    // the shop redraws itself when the store answers, but only while it is the thing on screen
    Store.onChange = () => { if (!$('modal').hidden && $('modal').dataset.kind === 'coins') this.panel_coins($('modal-body')); };
    const note = (t) => `<p class="note">${t}</p>`;
    const st = Store.status;
    let inner;
    if (!Store.kind) inner = note('Coin packs are sold in the Mini Strikers app, from the App Store or Google Play.');
    else if (!Net.token) inner = note('Sign in to buy coins, so they follow your account to any device.') + '<div class="coins-go"><button class="mid-btn" id="coins-signin">SIGN IN</button></div>';
    else if (Net.offline) inner = note('Buying needs a connection. Come back when you are online.');
    else if (Store.sel) {
      const p = PRODUCTS.find((x) => x.id === Store.sel);
      inner = `<div class="gate">
        <strong>ASK A GROWN-UP</strong>
        <p class="gate-pack">${p.name} · <span class="coin"></span>${fmtCoins(p.coins)} · ${Store.priceOf(p)}</p>
        <p>This costs real money. To go on, a grown-up types these numbers, with no spaces:</p>
        <div class="gate-words">${Store.gate.words}</div>
        <input id="gate-in" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="THE NUMBERS">
        <p id="gate-msg" class="note"></p>
        <div class="gate-btns"><button class="mid-btn" id="gate-no">CANCEL</button><button class="mid-btn green" id="gate-ok">CONTINUE</button></div>
      </div>`;
    } else {
      const off = !!Store.busy || !st || !st.canBuy;
      const packs = PRODUCTS.map((p) => `<button class="pack ${p.id === Store.busy ? 'busy' : ''}" data-pack="${p.id}" ${off ? 'disabled' : ''}>
          <strong>${p.name}</strong>
          <span class="pack-coins"><span class="coin"></span>${fmtCoins(p.coins)}</span>
          <em class="pack-bonus">${p.bonus ? '+' + p.bonus + '% EXTRA' : '&nbsp;'}</em>
          <span class="pack-price">${p.id === Store.busy ? 'WAITING…' : Store.priceOf(p)}</span>
        </button>`).join('');
      inner = `${st && !st.canBuy && st.enabled ? note('That is enough packs for today. Come back tomorrow.') : ''}
        <div class="pack-grid">${packs}</div>
        ${Store.msg ? note(Store.msg) : ''}
        <p class="note fine">These cost real money, so ask a grown-up first. Coins cannot be turned back into money. Crates cost coins, and every crate shows its odds on the crate shelf. Refunds are handled by Apple or Google.</p>`;
    }
    body.innerHTML = `${this.coinsLine()}${inner}`;

    const signin = $('coins-signin'); if (signin) signin.addEventListener('click', () => { this.tap(); this.closeModal(); this.showAuth(); });
    body.querySelectorAll('[data-pack]').forEach((b) => b.addEventListener('click', () => { this.tap(); Store.sel = b.dataset.pack; Store.newGate(); this.panel_coins(body); const f = $('gate-in'); if (f) f.focus(); }));
    const no = $('gate-no'); if (no) no.addEventListener('click', () => { this.tap(); Store.sel = null; Store.gate = null; this.panel_coins(body); });
    const ok = $('gate-ok');
    if (ok) {
      const go = () => {
        if (Store.gatePassed($('gate-in').value)) { const id = Store.sel; Store.sel = null; Store.gate = null; this.panel_coins(body); Store.buy(id); return; }
        Store.newGate(); this.panel_coins(body); $('gate-msg').textContent = 'Not quite. Here are some new numbers.';
      };
      ok.addEventListener('click', () => { this.tap(); go(); });
      $('gate-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }
  },

  panel_crates(body) {
    $('modal-title').textContent = 'CRATES';
    const cards = CRATES.map((c) => {
      const odds = CRATE_RARITIES.filter((r) => (c.odds[r] || 0) > 0)
        .map((r) => `<i style="--r:${RARITIES[r].color}"><b>${RARITIES[r].name}</b><em>${c.odds[r]}%</em></i>`).join('');
      const left = Crates.left(c);
      return `<button class="crate-card ${Save.data.coins < c.price ? 'poor' : ''} ${left ? '' : 'spent'}" data-crate="${c.id}" style="--c:${c.color}">
        <canvas width="150" height="120" data-crateart="${c.id}"></canvas>
        <strong>${c.name}</strong>
        <span class="crate-odds">${odds}</span>
        <span class="crate-left">${left ? left + ' LEFT INSIDE' : 'EMPTY'}</span>
        <span class="crate-price"><span class="coin"></span>${fmtCoins(c.price)}</span>
      </button>`;
    }).join('');
    const left = Crates.anyMissing();
    body.innerHTML = `<div class="crate-head">${this.coinsLine()}<span class="crate-btns">${Store.canShow() ? '<button class="mid-btn gold" id="to-coins">GET COINS</button>' : ''}<button class="mid-btn" id="to-collection">COLLECTION</button></span></div>
      <p class="note">${left ? 'Every crate gives you something you have not got yet. The dearer the crate, the better the chances.' : 'You own everything. There is nothing left in any crate.'}</p>
      <div class="crate-grid">${cards}</div>`;
    $('to-collection').addEventListener('click', () => { this.tap(); this.openModal('collection'); });
    const toCoins = $('to-coins'); if (toCoins) toCoins.addEventListener('click', () => { this.tap(); this.openModal('coins'); });
    body.querySelectorAll('canvas[data-crateart]').forEach((cv) => this.crateArt(cv, Crates.get(cv.dataset.crateart)));
    body.querySelectorAll('.crate-card').forEach((el) => el.addEventListener('click', () => {
      const crate = Crates.get(el.dataset.crate);
      if (Save.data.coins < crate.price) {
        Sound.steal(); el.classList.add('nope'); Pop.shake(el, 1.4);
        setTimeout(() => el.classList.remove('nope'), 400);
        return;
      }
      if (!Crates.left(crate)) { Sound.steal(); this.toast('THAT CRATE IS EMPTY — TRY A BIGGER ONE'); return; }
      this.tap();
      // you can see what you paid: the coins come off the counter and go into the crate
      const at = Pop.at(el);
      Pop.spend(el, crate.price >= 100000 ? 18 : crate.price >= 20000 ? 12 : 8);
      Pop.ring(at.x, at.y, crate.color, 190, 420);
      Pop.shake(el, 0.8);
      this.openCrate(body, crate);
    }));
  },

  // A crate, drawn. Four builds up the ladder — a nailed wooden crate, a banded treasure chest, a
  // sealed case and a vault — each in its own colours, with the lid lifted just enough to show
  // there is something in there.
  crateArt(cv, crate) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const build = crate.build || 'wood';
    const base = crate.color, metal = crate.metal || '#c8a24a', gem = crate.gem || '#ffffff';
    const dark = shadeHex(base, -0.3), darker = shadeHex(base, -0.5), light = shadeHex(base, 0.2);
    const ink = OUTLINE;
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = ink;
    const u = W / 150;                       // everything is drawn against a 150-wide crate
    const lw = 3.4 * u;
    const cx = W / 2, floor = H * 0.9;
    const bw = W * 0.66, bh = H * 0.42, bx = cx - bw / 2, by = floor - bh;
    const lidH = H * 0.2, lidY = by - lidH * 0.72;
    const fill = (col) => { g.fillStyle = col; g.fill(); g.lineWidth = lw; g.stroke(); };
    const box = (x, y, w, h, r, col) => { Sprites.rr(g, x, y, w, h, r); fill(col); };
    const rivet = (x, y, r2, col) => { g.beginPath(); g.arc(x, y, r2, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 1.6 * u; g.stroke(); };

    // the shadow it stands in
    g.fillStyle = 'rgba(22, 26, 51, 0.22)';
    g.beginPath(); g.ellipse(cx, floor + 3 * u, bw * 0.56, 5.5 * u, 0, 0, Math.PI * 2); g.fill();

    // what is inside, showing through the gap under the lid
    g.fillStyle = gem;
    g.beginPath(); g.moveTo(bx + 4 * u, by + 2 * u); g.lineTo(bx + bw - 4 * u, by + 2 * u); g.lineTo(bx + bw - 10 * u, by - 7 * u); g.lineTo(bx + 10 * u, by - 7 * u); g.closePath(); g.fill();
    for (let i = 0; i < 3; i++) {
      const sx = bx + bw * (0.3 + i * 0.2), sy = by - 4 * u - (i % 2) * 3 * u;
      Sprites.star ? Sprites.star(g, sx, sy, 3.4 * u, '#ffffff') : 0;
    }

    // ---- the body
    box(bx, by, bw, bh, build === 'tech' ? 5 * u : 3 * u, base);
    // its shaded right-hand side
    g.beginPath(); g.moveTo(bx + bw * 0.74, by); g.lineTo(bx + bw, by + 3 * u); g.lineTo(bx + bw, by + bh - 3 * u); g.lineTo(bx + bw * 0.74, bh + by); g.closePath();
    g.fillStyle = dark; g.fill();

    if (build === 'wood') {
      // planks across the front, and a nail in each corner
      g.strokeStyle = darker; g.lineWidth = 2 * u;
      for (let i = 1; i < 3; i++) { const y = by + (bh / 3) * i; g.beginPath(); g.moveTo(bx + 2 * u, y); g.lineTo(bx + bw - 2 * u, y); g.stroke(); }
      g.strokeStyle = ink;
      // the diagonal brace
      g.lineWidth = 3 * u; g.strokeStyle = shadeHex(base, -0.18);
      g.beginPath(); g.moveTo(bx + 5 * u, by + bh - 5 * u); g.lineTo(bx + bw - 5 * u, by + 5 * u); g.stroke();
      g.strokeStyle = ink;
      for (const [rx, ry] of [[bx + 6 * u, by + 6 * u], [bx + bw - 6 * u, by + 6 * u], [bx + 6 * u, by + bh - 6 * u], [bx + bw - 6 * u, by + bh - 6 * u]]) rivet(rx, ry, 2.4 * u, metal);
    } else if (build === 'chest') {
      // two bands round the body with studs on them
      for (const fx of [0.22, 0.78]) {
        g.fillStyle = metal; g.fillRect(bx + bw * fx - 4 * u, by, 8 * u, bh);
        g.lineWidth = 2.2 * u; g.strokeRect(bx + bw * fx - 4 * u, by, 8 * u, bh);
        for (let i = 0; i < 3; i++) rivet(bx + bw * fx, by + bh * (0.2 + i * 0.3), 1.8 * u, shadeHex(metal, 0.3));
      }
    } else if (build === 'tech') {
      // vents and a little readout
      box(bx + 6 * u, by + 5 * u, bw * 0.4, bh * 0.42, 2.5 * u, '#12162c');
      g.fillStyle = gem;
      for (let i = 0; i < 4; i++) g.fillRect(bx + 10 * u + i * 5 * u, by + 9 * u + ((i * 5) % 7) * u, 3 * u, bh * 0.2 - ((i * 5) % 7) * u);
      g.fillStyle = darker;
      for (let i = 0; i < 3; i++) { Sprites.rr(g, bx + bw * 0.56, by + 6 * u + i * 7 * u, bw * 0.34, 3.4 * u, 1.7 * u); g.fill(); }
      g.strokeStyle = metal; g.lineWidth = 2.4 * u;
      g.beginPath(); g.moveTo(bx + 4 * u, by + bh * 0.62); g.lineTo(bx + bw - 4 * u, by + bh * 0.62); g.stroke();
      g.strokeStyle = ink;
    } else {
      // a vault: a thick rim, a wheel, and gems in the corners
      box(bx + 5 * u, by + 4 * u, bw - 10 * u, bh - 8 * u, 3 * u, dark);
      g.beginPath(); g.arc(cx, by + bh * 0.52, bh * 0.26, 0, Math.PI * 2); fill(metal);
      g.strokeStyle = ink; g.lineWidth = 2.4 * u;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4 + 0.4;
        g.beginPath(); g.moveTo(cx - Math.cos(a) * bh * 0.3, by + bh * 0.52 - Math.sin(a) * bh * 0.3);
        g.lineTo(cx + Math.cos(a) * bh * 0.3, by + bh * 0.52 + Math.sin(a) * bh * 0.3); g.stroke();
      }
      g.beginPath(); g.arc(cx, by + bh * 0.52, bh * 0.1, 0, Math.PI * 2); fill(shadeHex(metal, 0.35));
      for (const [gx, gy] of [[bx + 9 * u, by + 9 * u], [bx + bw - 9 * u, by + 9 * u], [bx + 9 * u, by + bh - 9 * u], [bx + bw - 9 * u, by + bh - 9 * u]]) {
        g.beginPath(); g.moveTo(gx, gy - 4 * u); g.lineTo(gx + 3.4 * u, gy); g.lineTo(gx, gy + 4 * u); g.lineTo(gx - 3.4 * u, gy); g.closePath(); fill(gem);
      }
    }

    // ---- the lid, tipped back a little
    const lw2 = bw + 6 * u, lx = cx - lw2 / 2;
    if (build === 'chest' || build === 'vault') {
      // a curved lid
      g.beginPath();
      g.moveTo(lx, by - 2 * u);
      g.quadraticCurveTo(cx, lidY - lidH * 0.5, lx + lw2, by - 2 * u);
      g.lineTo(lx + lw2, by + 2 * u); g.lineTo(lx, by + 2 * u); g.closePath();
      fill(light);
      g.beginPath();
      g.moveTo(cx - lw2 * 0.16, by - 2 * u);
      g.quadraticCurveTo(cx, lidY - lidH * 0.42, cx + lw2 * 0.16, by - 2 * u);
      g.closePath(); g.fillStyle = metal; g.fill(); g.lineWidth = 2.2 * u; g.stroke();
    } else {
      // a flat lid with a rim
      g.beginPath();
      g.moveTo(lx, by + 2 * u); g.lineTo(lx + 8 * u, lidY); g.lineTo(lx + lw2 - 8 * u, lidY); g.lineTo(lx + lw2, by + 2 * u);
      g.closePath(); fill(light);
      g.fillStyle = dark; g.fillRect(lx + 2 * u, by - 1 * u, lw2 - 4 * u, 4 * u);
      g.lineWidth = 2 * u; g.strokeRect(lx + 2 * u, by - 1 * u, lw2 - 4 * u, 4 * u);
    }

    // ---- the lock, right at the front
    const kx = cx, ky = by + bh * (build === 'tech' ? 0.84 : build === 'chest' ? 0.55 : 0.46);
    if (build === 'tech') {
      // a latch instead of a padlock: a bar with a light on it
      box(kx - 15 * u, ky - 5 * u, 30 * u, 10 * u, 3 * u, metal);
      rivet(kx - 9 * u, ky, 2 * u, gem);
      g.fillStyle = ink; g.fillRect(kx - 2 * u, ky - 2.4 * u, 12 * u, 2 * u); g.fillRect(kx - 2 * u, ky + 0.6 * u, 8 * u, 2 * u);
    } else if (build !== 'vault') {
      box(kx - 9 * u, ky - 8 * u, 18 * u, 16 * u, 3 * u, metal);
      g.fillStyle = ink;
      g.beginPath(); g.arc(kx, ky - 1.5 * u, 2.8 * u, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(kx - 2.2 * u, ky + 5 * u); g.lineTo(kx + 2.2 * u, ky + 5 * u); g.lineTo(kx + 1.1 * u, ky - 0.5 * u); g.lineTo(kx - 1.1 * u, ky - 0.5 * u); g.closePath(); g.fill();
      g.fillStyle = shadeHex(metal, 0.35); g.fillRect(kx - 6 * u, ky - 6 * u, 3 * u, 3 * u);
    }

    // ---- a crown for the top of the ladder, sparks for the rest
    if (build === 'vault') {
      const cyy = lidY - lidH * 0.26;
      g.beginPath();
      g.moveTo(cx - 13 * u, cyy + 6 * u); g.lineTo(cx - 15 * u, cyy - 7 * u); g.lineTo(cx - 6 * u, cyy - 1 * u);
      g.lineTo(cx, cyy - 11 * u); g.lineTo(cx + 6 * u, cyy - 1 * u); g.lineTo(cx + 15 * u, cyy - 7 * u); g.lineTo(cx + 13 * u, cyy + 6 * u);
      g.closePath(); fill(metal);
      for (const dx of [-7, 0, 7]) rivet(cx + dx * u, cyy + 1 * u, 2 * u, gem);
    }
    g.fillStyle = gem;
    for (const [sx, sy, s] of [[bx - 7 * u, by - 4 * u, 3.4], [bx + bw + 7 * u, by + 6 * u, 2.6], [bx + bw + 4 * u, by - 10 * u, 2]]) {
      g.beginPath();
      g.moveTo(sx, sy - s * u); g.lineTo(sx + s * 0.42 * u, sy); g.lineTo(sx, sy + s * u); g.lineTo(sx - s * 0.42 * u, sy);
      g.closePath(); g.fill();
    }
  },

  // Opening one: a reel of things it could hand over, running down to the one it does.
  openCrate(body, crate) {
    const win = Crates.open(crate.id);
    if (!win || win.poor || win.empty) { this.toast(win && win.empty ? 'THAT CRATE CAME UP EMPTY — NOTHING SPENT' : 'NOT ENOUGH COINS'); this.panel_crates(body); return; }
    const { cells, at } = Crates.reel(crate, win);
    const cell = (c, i) => `<span class="reel-cell rar-${Crates.rarity(c.kind, c.id)}" style="--r:${RARITIES[Crates.rarity(c.kind, c.id)].color}">
      <canvas width="120" height="120" data-cell="${i}"></canvas><b>${Crates.name(c.kind, c.id)}</b></span>`;
    body.innerHTML = `<div class="crate-open">
      <h3 style="--c:${crate.color}">${crate.name}</h3>
      <div class="reel-window"><div class="reel" id="crate-reel">${cells.map(cell).join('')}</div><span class="reel-mark"></span></div>
      <div class="crate-result" id="crate-result" hidden></div>
      <div class="crate-buttons" id="crate-buttons" hidden>
        <button class="big-btn" id="crate-back">BACK</button>
        <button class="big-btn green" id="crate-again">OPEN ANOTHER</button>
      </div>
    </div>`;
    // every cell draws whatever it is holding
    body.querySelectorAll('canvas[data-cell]').forEach((cv) => this.itemSwatch(cv, cells[+cv.dataset.cell]));
    const reel = $('crate-reel');
    const first = reel.querySelector('.reel-cell');
    const cellW = (first ? first.getBoundingClientRect().width : 100) + 8; // card + the gap beside it
    const win0 = reel.parentElement.getBoundingClientRect().width;
    const land = win0 / 2 - (at * cellW + cellW / 2) + (Math.random() * 40 - 20);
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(' + (win0 / 2 - cellW / 2) + 'px)';
    void reel.offsetWidth;
    reel.style.transition = 'transform 4.4s cubic-bezier(.08,.72,.16,1)';
    reel.style.transform = 'translateX(' + land + 'px)';
    Sound.tap();
    clearTimeout(this._crateT);
    this._crateT = setTimeout(() => {
      if (!$('crate-result')) return;
      const rar = Crates.rarity(win.kind, win.id);
      const kindName = { character: 'PLAYER', ball: 'BALL', trail: 'POWER TRAIL', celebration: 'CELEBRATION', accessory: 'ACCESSORY', skill: 'SKILL MOVE' }[win.kind] || 'ITEM';
      $('crate-result').innerHTML = `<span class="got" style="--r:${RARITIES[rar].color}">${RARITIES[rar].name}</span>
        <b>${Crates.name(win.kind, win.id)}</b><em>${kindName} · NEW</em>`;
      $('crate-result').hidden = false;
      $('crate-result').classList.remove('landed'); void $('crate-result').offsetWidth;
      $('crate-buttons').hidden = false;
      $('crate-again').textContent = Save.data.coins >= crate.price ? 'OPEN ANOTHER' : 'NOT ENOUGH COINS';
      $('crate-again').classList.toggle('off', Save.data.coins < crate.price);
      Sound.powerReady();
      // the fuss is made over the card itself, and scaled to what came out of the crate
      Pop.prize($('crate-result'), rar);
      if (rar === 'legendary' || rar === 'mythic') {
        Sound.cheer(true);
        // No floating word for the grade: the card already says it, and there is nowhere to put
        // one that is not on top of the reel or the name. The card makes the entrance instead.
        $('crate-result').classList.add('landed');
      }
      $('crate-back').addEventListener('click', () => { this.tap(); this.panel_crates(body); });
      $('crate-again').addEventListener('click', () => {
        if (Save.data.coins < crate.price) { Sound.steal(); return; }
        this.tap(); this.openCrate(body, crate);
      });
      this.refreshHome();
    }, 4500);
  },

  // An accessory card: a portrait for anything worn on the head or face, and the whole player for
  // anything worn anywhere else — a cape or a pair of boots is not in a portrait.
  accSwatch(cv, id) {
    const def = ACCESSORIES.find((a) => a.id === id);
    const look = { ...Save.look(), acc: id === 'none' ? null : id };
    if (!def || def.slot === 'face') { this.portrait(cv, look); return; }
    if (def.slot === 'head') { this.portrait(cv, look, 'blue', false, 10, 0.16); return; }
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = TEAMS.blue.board;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.clip();
    const p2 = this.fakePlayer(look);
    if (def.slot === 'back') { p2.fy = -1; p2.faceX = 0.001; } // turn round so the back shows
    p2.vx = 0; p2.vy = 0;
    Sprites.player(g, p2, w / 2, h * 0.94, w / 86, 0.4);
    g.restore();
    g.lineWidth = 3; g.strokeStyle = OUTLINE;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.stroke();
  },

  // one small picture of any item, whatever kind it is
  itemSwatch(cv, item) {
    if (item.kind === 'character') this.portrait(cv, CHARACTERS.find((c) => c.id === item.id));
    else if (item.kind === 'accessory') this.accSwatch(cv, item.id);
    else if (item.kind === 'ball') this.ballSwatch(cv, item.id);
    else if (item.kind === 'trail') this.trailSwatch(cv, item.id);
    else this.celebSwatch(cv, item.id, 1.2);
  },

  // every player card, in both the characters panel and the customize screen
  // worst to best, by rating — the order you would rank them in yourself
  charList() {
    return CHARACTERS.filter(charOk).sort((a, b) => charOvr(a) - charOvr(b) || Shop.price('character', a.id) - Shop.price('character', b.id));
  },
  charCard(c) {
    const statRow = (label, v) => `<div class="bar"><i>${label}</i><span><b style="width:${Math.round(((v - 40) / 60) * 100)}%;background:${v >= 85 ? '#ffb400' : v >= 75 ? '#3fcf4a' : v >= 65 ? '#2f7bff' : '#8a90b8'}"></b></span><em>${v}</em></div>`;
    return `<button class="char-card-sm rar-${c.rarity} ${c.id === Save.character().id ? 'sel' : ''} ${Shop.owns('character', c.id) ? '' : 'locked'}" data-id="${c.id}" style="--rar:${RARITIES[c.rarity].color}">
        <span class="rar-tag">${RARITIES[c.rarity].name}</span>
        <span class="ovr"><b>${charOvr(c)}</b><small>OVR</small></span>
        <canvas width="96" height="96" data-portrait="${c.id}"></canvas>
        <strong>${c.name}</strong>
        <span class="sig-tag">${sigName(c)}</span>
        ${this.priceTag('character', c.id)}
        <div class="bars ${charStats(c).some(([label]) => label.length > 4) ? 'long' : ''}">${charStats(c).map(([label, v]) => statRow(label, v)).join('')}</div>
      </button>`;
  },

  // ---- customize: your player on the left, everything you can put on them on the right ----
  CUST_TABS: [['character', 'PLAYER'], ['skill', 'SKILL MOVE'], ['ball', 'BALL'], ['accessory', 'ACCESSORY'], ['celebration', 'CELEBRATION'], ['trail', 'POWER TRAIL']],
  CUST_NOTES: {
    character: 'Who you play as. Better players are faster, shoot harder and keep the ball.',
    skill: 'What your SKILL button does. Carry one and it is that move every time, aimed wherever you are pointing.',
    ball: 'The match ball in every game you play.',
    accessory: 'Worn by your player in every match — online, everyone sees it.',
    celebration: 'Score and the camera zooms in on you doing this. Everyone in the match sees it.',
    trail: 'Shown on power shots. Fill the meter around SHOOT, then fully charge.',
  },

  panel_customize(body) {
    $('modal-title').textContent = 'CUSTOMIZE';
    const tab = this.CUST_TABS.some(([id]) => id === this._custTab) ? this._custTab : 'character';
    this._custTab = tab;
    let grid = '', gridClass = '';
    if (tab === 'character') {
      gridClass = 'char-grid';
      grid = this.charList().map((c) => this.charCard(c)).join('');
    } else if (tab === 'trail') {
      grid = TRAILS.map((t) => `<button class="trail-opt ${t.id === Save.trail().id ? 'sel' : ''} ${Shop.owns('trail', t.id) ? '' : 'locked'}" data-id="${t.id}">
        <canvas width="200" height="70" data-trail="${t.id}"></canvas><strong>${t.name}</strong>${this.priceTag('trail', t.id)}</button>`).join('');
    } else if (tab === 'celebration') {
      gridClass = 'celeb-grid';
      grid = CELEBRATIONS.map((c) => `<button class="trail-opt celeb-opt ${c.id === Save.celebration() ? 'sel' : ''} ${Shop.owns('celebration', c.id) ? '' : 'locked'}" data-id="${c.id}">
        <canvas width="160" height="150" data-celeb="${c.id}"></canvas><strong>${c.name}</strong>${this.priceTag('celebration', c.id)}</button>`).join('');
    } else if (tab === 'skill') {
      gridClass = 'skill-grid';
      grid = SKILLS.map((k) => `<button class="trail-opt skill-opt ${k.id === Save.skill() ? 'sel' : ''} ${Shop.owns('skill', k.id) ? '' : 'locked'}" data-id="${k.id}">
        <canvas width="150" height="92" data-skillart="${k.id}"></canvas><strong>${k.name}</strong>
        <small class="skill-blurb">${k.blurb}</small>${this.priceTag('skill', k.id)}</button>`).join('');
    } else if (tab === 'accessory') {
      const on = Save.accessory();
      grid = [{ id: 'none', name: 'Nothing' }, ...ACCESSORIES].map((a) => `<button class="trail-opt acc-opt ${(a.id === 'none' ? !on : a.id === on) ? 'sel' : ''} ${a.id === 'none' || Shop.owns('accessory', a.id) ? '' : 'locked'}" data-id="${a.id}">
        <canvas width="120" height="120" data-acc="${a.id}"></canvas><strong>${a.name}</strong>${a.id === 'none' ? '' : this.priceTag('accessory', a.id)}</button>`).join('');
    } else {
      grid = BALLS.map((b) => `<button class="trail-opt ${b.id === Save.ball().id ? 'sel' : ''} ${Shop.owns('ball', b.id) ? '' : 'locked'}" data-id="${b.id}">
        <canvas width="200" height="90" data-ball="${b.id}"></canvas><strong>${b.name}</strong>${this.priceTag('ball', b.id)}</button>`).join('');
    }
    const ground = typeof stadiumFor === 'function' ? stadiumFor(Clubs.mine()) : Save.stadium();
    body.innerHTML = `<div class="cust">
      <div class="cust-left">
        <canvas id="cust-view" class="cust-view"></canvas>
        <div class="cust-ground"><canvas id="cust-ground" width="200" height="90"></canvas><b>HOME · ${ground.name}</b></div>
      </div>
      <div class="cust-side">
        <div class="cust-top">${this.coinsLine()}<div class="tabs">${this.CUST_TABS.map(([id, label]) => `<button data-tab="${id}" class="${id === tab ? 'sel' : ''}">${label}</button>`).join('')}</div></div>
        <p class="note">${this.CUST_NOTES[tab]}</p>
        <div class="trail-grid ${gridClass}">${grid}</div>
      </div>
    </div>`;
    body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.tap(); this._custTab = b.dataset.tab; this.panel_customize(body); }));
    body.querySelectorAll('canvas[data-trail]').forEach((cv) => this.trailSwatch(cv, cv.dataset.trail));
    body.querySelectorAll('canvas[data-ball]').forEach((cv) => this.ballSwatch(cv, cv.dataset.ball));
    body.querySelectorAll('canvas[data-portrait]').forEach((cv) => this.portrait(cv, CHARACTERS.find((c) => c.id === cv.dataset.portrait)));
    body.querySelectorAll('canvas[data-acc]').forEach((cv) => this.accSwatch(cv, cv.dataset.acc));
    body.querySelectorAll('canvas[data-skillart]').forEach((cv) => this.skillSwatch(cv, cv.dataset.skillart));
    if (tab === 'celebration') this.animateCelebs(body);
    const groundCv = $('cust-ground');
    if (groundCv) { const g = groundCv.getContext('2d'); g.drawImage(Render.stadiumThumb(ground), 0, 0, groundCv.width, groundCv.height); }
    body.querySelectorAll('.trail-opt, .char-card-sm').forEach((el) => this.shopCard(el, tab, el.dataset.id, () => {
      if (tab === 'character') Save.data.character = el.dataset.id;
      if (tab === 'trail') Save.data.trail = el.dataset.id;
      if (tab === 'celebration') Save.data.celebration = el.dataset.id;
      if (tab === 'skill') Save.data.skill = el.dataset.id;
      if (tab === 'ball') Save.data.ball = el.dataset.id;
      if (tab === 'accessory') Save.data.accessory = el.dataset.id === 'none' ? null : el.dataset.id;
      Save.write();
      // a small nod that it took
      const card = el.getBoundingClientRect ? el : null;
      if (card) { const at = Pop.at(card); Pop.ring(at.x, at.y, '#ffffff', 140, 360); Pop.confetti(at.x, at.y, ['#ffffff', '#ffc21a'], 10, 0.6); }
      this.redraw(body, () => this.panel_customize(body));
      this.refreshHome();
    }));
    this.custStage();
  },

  // The player on the left plays a little loop: stands there, strikes the ball away with your
  // trail behind it, then does your celebration. Everything equipped, all at once.
  custStage() {
    const cv = $('cust-view');
    if (!cv) return;
    if (this._stage) this._stage.dead = true;
    const state = this._stage = { dead: false, d: 1 };
    this._stageT0 = this._stageT0 || performance.now();
    const fit = () => {
      const r = cv.getBoundingClientRect();
      state.d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(60, Math.round(r.width * state.d));
      cv.height = Math.max(60, Math.round(r.height * state.d));
    };
    fit();
    let last = 0;
    const frame = (now) => {
      if (state.dead || $('modal').hidden || !cv.isConnected) return;
      requestAnimationFrame(frame);
      if (now - last < 33) return;
      last = now;
      const r = cv.getBoundingClientRect();
      if (Math.abs(r.width * state.d - cv.width) > 2 || Math.abs(r.height * state.d - cv.height) > 2) fit();
      this.drawStage(cv, (now - this._stageT0) / 1000);
    };
    requestAnimationFrame(frame);
  },

  STAGE_SKILL: 1.15,
  STAGE_IDLE: 1.5, STAGE_KICK: 0.22, STAGE_FLY: 0.95,
  drawStage(cv, t) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const st = Save.stadium();
    // the home ground's own grass, mown in bands
    const bands = 7;
    for (let i = 0; i < bands; i++) { g.fillStyle = st.grass[i % 2][0]; g.fillRect(0, (H / bands) * i, W, H / bands + 1); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, H * 0.1);
    const k = Math.min(H / 108, W / 72);
    const ground = H * 0.84, px = W * 0.4;
    // the move comes first, then the shot, then the celebration
    const sk = skillDef(Save.skill());
    const skillShow = sk.read ? 0 : this.STAGE_SKILL;
    const move = this.STAGE_IDLE, kick = move + skillShow, fly = kick + this.STAGE_KICK, cele = fly + this.STAGE_FLY;
    const cycle = cele + CELE_TIME + 0.4;
    const e = t % cycle;
    const inMove = skillShow && e >= move && e < kick;
    const mu = inMove ? (e - move) / skillShow : 0;   // 0 to 1 through the move
    const p = this.fakePlayer(Save.look());
    p.faceX = 1; p.fx = 1; p.fy = 0.22; p.vx = 0; p.vy = 0; p.runPhase = 0;
    p.kickT = 0; p.celebrateT = 0; p.celebKind = null;
    if (inMove) {
      // what the move does to the player, read off the same numbers the match uses
      const self = sk.self || {};
      if (self.hop) p.hopT = Math.sin(mu * Math.PI) * 0.4;
      if (self.spin) { p.fx = Math.cos(mu * Math.PI * 2 * self.spin); p.fy = 0.22; p.faceX = p.fx >= 0 ? 1 : -1; }
      else if (self.turn === 'reverse') { const back = mu > 0.45; p.fx = back ? -1 : 1; p.faceX = back ? -1 : 1; }
      if (self.burst || self.dash) p.runPhase = mu * 14;
      p.vx = (self.burst || 0) * 40 * Math.sin(mu * Math.PI);
    }
    if (e > kick && e < fly + 0.1) { p.kickT = Math.max(0, this.STAGE_KICK - (e - kick)); p.kickDur = this.STAGE_KICK; }
    if (e > cele) { p.celebrateT = Math.max(0, CELE_TIME - (e - cele)); p.celebKind = Save.celebration(); }
    // the ball: at his feet, then away to the right with the trail behind it
    const ballR = 3.1 * k;
    let bx = px + 13 * k, by = ground - ballR * 0.9, pts = null;
    if (e > fly) {
      const u = Math.min(1, (e - fly) / this.STAGE_FLY);
      bx = px + 13 * k + u * (W - px - 10 * k);
      by = ground - ballR * 0.9 - Math.sin(u * Math.PI) * H * 0.22;
      pts = [];
      for (let i = 1; i <= 11; i++) {
        const uu = Math.max(0, u - i * 0.035);
        pts.push({ x: px + 13 * k + uu * (W - px - 10 * k), y: ground - ballR * 0.9 - Math.sin(uu * Math.PI) * H * 0.22, z: -CFG.BALL_R });
      }
    }
    if (e > cele) { bx = -999; }
    // shadows first
    g.fillStyle = 'rgba(20, 60, 20, 0.3)';
    g.beginPath(); g.ellipse(px, ground + 2, 15 * k, 5.5 * k, 0, 0, Math.PI * 2); g.fill();
    if (bx > 0) { g.beginPath(); g.ellipse(bx, ground + 2, ballR * 1.1, ballR * 0.4, 0, 0, Math.PI * 2); g.fill(); }
    // the power trail off the shot, then the ball
    const prev = Game.headless; Game.headless = true;
    if (pts) {
      const R = { S: k * 0.9, sx: (x) => x, sy: (y) => y };
      Sprites.trail(g, { trailType: Save.trail().id, trail: pts, x: bx, y: by, z: -CFG.BALL_R }, R, t);
    }
    const pose = p.celebrateT > 0 && CELE_POSES[p.celebKind] ? CELE_POSES[p.celebKind](CELE_TIME - p.celebrateT, t, p) : null;
    if (pose && CELE_MOVES[p.celebKind]) p.vx = CELE_MOVES[p.celebKind](CELE_TIME - p.celebrateT);
    if (inMove) this.drawSkillShow(g, sk, px, ground, k, mu, W, H, 'behind');
    Sprites.player(g, p, px, ground, k, t);
    if (bx > 0) Sprites.ball(g, { x: 0, y: 0, z: 0, vx: 1, vy: 0, roll: t * 5, shot: null, owner: null, skin: Save.ball() }, bx, by, k * 1.1, t);
    if (inMove) this.drawSkillShow(g, sk, px, ground, k, mu, W, H, 'front');
    Game.headless = prev;
  },

  // A move's picture, drawn from what the move actually does: its colour, and the shape of what
  // it throws out. CLASSIC gets the four little arrows of the old read-the-stick skills.
  skillSwatch(cv, id) {
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const def = skillDef(id);
    const col = def.color || '#8a90b8';
    g.clearRect(0, 0, W, H);
    // the pitch it happens on
    g.fillStyle = '#3fae5f'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 4; i++) g.fillRect((W / 4) * i, 0, W / 8, H);
    const cx = W / 2, cy = H / 2 + 4;
    g.lineJoin = 'round'; g.lineCap = 'round';

    if (def.read) {
      // classic: a stick pointing four ways
      g.strokeStyle = OUTLINE; g.lineWidth = 7;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(cx + dx * 8, cy + dy * 8); g.lineTo(cx + dx * 24, cy + dy * 24); g.stroke(); }
      g.strokeStyle = '#ffffff'; g.lineWidth = 4;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(cx + dx * 8, cy + dy * 8); g.lineTo(cx + dx * 24, cy + dy * 24); g.stroke(); }
    } else {
      const fx = def.fx || {};
      if (fx.kind === 'sparks') {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2, r0 = 10, r1 = 26 + (i % 3) * 5;
          g.strokeStyle = OUTLINE; g.lineWidth = 7;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
          g.strokeStyle = col; g.lineWidth = 4;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
        }
      } else if (fx.kind === 'stars') {
        for (const [ox, oy, sc] of [[-20, -8, 1], [0, -16, 1.35], [20, -6, 1], [-10, 10, 0.8], [13, 12, 0.9]]) this.star(g, cx + ox, cy + oy, 9 * sc, col);
      } else if (fx.kind === 'burst') {
        g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fillStyle = OUTLINE; g.fill();
        g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fillStyle = col; g.fill();
        g.beginPath(); g.arc(cx - 5, cy - 5, 8, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill();
      } else {
        // rings, which most of them are
        for (const [r, w] of [[27, 8], [17, 6]]) { g.strokeStyle = OUTLINE; g.lineWidth = w + 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
      }
      // the ball it all happens around
      g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = OUTLINE; g.stroke();
    }
    // the grade, as a band along the bottom
    const rar = RARITIES[def.rarity] || RARITIES.common;
    g.fillStyle = OUTLINE; g.fillRect(0, H - 14, W, 14);
    g.fillStyle = rar.color; g.fillRect(0, H - 12, W, 10);
  },

  star(g, x, y, r, color) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    g.fillStyle = color; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = OUTLINE; g.stroke();
  },

  // What a signature move looks like on the customize stage. Behind the player: the ring or
  // shockwave it throws out. In front: the sparks, the stars, and its name.
  drawSkillShow(g, def, px, ground, k, u, W, H, layer) {
    const fx = def.fx || {};
    const col = def.color || '#ffffff';
    const cy = ground - 26 * k;
    const ease = u < 0.5 ? u * 2 : 1 - (u - 0.5) * 2;   // in and back out
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (layer === 'behind') {
      if (fx.kind === 'ring' || !fx.kind) {
        // a ring opening out from the feet, flattened the way the pitch is
        const r = (fx.r0 || 8) + ((fx.r1 || 40) - (fx.r0 || 8)) * u;
        g.globalAlpha = Math.max(0, 1 - u);
        g.strokeStyle = OUTLINE; g.lineWidth = ((fx.width || 3) + 2.5) * k * 0.8;
        g.beginPath(); g.ellipse(px, ground - 2 * k, r * k * 0.85, r * k * 0.34, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = col; g.lineWidth = (fx.width || 3) * k * 0.8;
        g.beginPath(); g.ellipse(px, ground - 2 * k, r * k * 0.85, r * k * 0.34, 0, 0, Math.PI * 2); g.stroke();
      } else if (fx.kind === 'burst') {
        g.globalAlpha = Math.max(0, 1 - u) * 0.9;
        const r = (fx.size || 24) * k * (0.5 + u);
        g.beginPath(); g.arc(px, cy, r, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
      return;
    }
    // ---- front layer
    if (fx.kind === 'sparks') {
      const n = Math.min(16, fx.n || 12);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + u * 2;
        const r = (10 + u * 46) * k;
        g.globalAlpha = Math.max(0, 1 - u);
        g.strokeStyle = OUTLINE; g.lineWidth = 5 * k * 0.7;
        g.beginPath(); g.moveTo(px + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.45); g.lineTo(px + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7); g.stroke();
        g.strokeStyle = col; g.lineWidth = 2.8 * k * 0.7;
        g.beginPath(); g.moveTo(px + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.45); g.lineTo(px + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7); g.stroke();
      }
    } else if (fx.kind === 'stars') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + u * 1.4;
        const r = (14 + u * 40) * k;
        g.globalAlpha = Math.max(0, 1 - u);
        this.star(g, px + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 6 * k * (1 - u * 0.4), col);
      }
    }
    g.globalAlpha = 1;
    // the shout
    if (def.say) {
      g.save();
      g.translate(px, ground - 86 * k - ease * 8 * k);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `400 ${Math.round(15 * k)}px "Lilita One", system-ui, sans-serif`;
      g.globalAlpha = Math.min(1, ease * 2.2);
      g.lineWidth = 6 * k * 0.6; g.strokeStyle = OUTLINE; g.lineJoin = 'round';
      g.strokeText(def.say, 0, 0);
      g.fillStyle = col; g.fillText(def.say, 0, 0);
      g.restore();
    }
    g.restore();
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
      <div class="set"><span>COMMENTARY</span>${seg('commentary', [[true, 'ON'], [false, 'OFF']])}</div>
      <div class="set"><span>DIFFICULTY</span>${seg('difficulty', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']])}</div>
      <div class="set"><span>MATCH</span>${seg('minutes', [[2, '2 MIN'], [3, '3 MIN'], [4, '4 MIN']])}</div>
      <div class="set"><span>MINIMAP</span>${seg('minimap', [[true, 'ON'], [false, 'OFF']])}</div>
      <div class="set"><span>REPLAYS</span>${seg('replays', [[true, 'ON'], [false, 'OFF']])}</div>
      <div class="set"><span>GRAPHICS</span>${seg('graphics', [['auto', 'AUTO'], ['high', 'HIGH'], ['low', 'LOW']])}</div>
      <div class="set"><span>CONTROLS</span>${seg('controls', [['auto', 'AUTO'], ['touch', 'TOUCH'], ['keyboard', 'KEYBOARD']])}</div>
      ${this.controlsRef()}
      <div class="set account"><span>ACCOUNT</span><em>${Save.account || 'GUEST'} · ${Clubs.mine().name}</em><button id="logout" class="mini-danger">LOG OUT</button></div>
      ${Net.user ? `<div class="set"><span>PASSWORD</span><em>Only you can change it, and only from here</em><button id="chpw" class="mid-btn">CHANGE</button></div>
      <form id="pw-form" class="pw-form" hidden autocomplete="off">
        <input type="password" id="pw-old" placeholder="CURRENT PASSWORD" autocomplete="current-password" maxlength="200">
        <input type="password" id="pw-new" placeholder="NEW PASSWORD" autocomplete="new-password" maxlength="200">
        <input type="password" id="pw-new2" placeholder="NEW PASSWORD AGAIN" autocomplete="new-password" maxlength="200">
        <button type="submit" class="mid-btn green">SAVE IT</button>
        <p id="pw-msg" class="note"></p>
      </form>` : ''}
      <div class="set"><span>PRIVACY</span><em>What the game keeps, and what it does not</em><a class="mid-btn set-link" href="privacy.html" target="_blank" rel="noopener">READ IT</a></div>
      <div class="set danger"><span>PROGRESS</span><em>Start again from zero.${Net.user ? ' Your account stays.' : ''}</em><button id="reset-progress" class="mini-danger">RESET SAVE</button></div>
      ${Net.user ? `<div class="set danger"><span>DELETE ACCOUNT</span><em>Your coins, everything you have won, and your record. Gone for good, everywhere.</em><button id="del-acct" class="mini-danger">DELETE</button></div>
      <form id="del-form" class="pw-form" hidden autocomplete="off">
        <input type="password" id="del-pw" placeholder="YOUR PASSWORD" autocomplete="current-password" maxlength="200">
        <button type="submit" class="mini-danger">DELETE IT FOR GOOD</button>
        <p id="del-msg" class="note"></p>
      </form>` : ''}`;
    $('logout').addEventListener('click', async () => { this.tap(); await Net.logout(); UI.showAuth('Logged out.'); $('auth-msg').classList.remove('bad'); });
    if ($('chpw')) {
      $('chpw').addEventListener('click', () => { this.tap(); const f = $('pw-form'); f.hidden = !f.hidden; $('pw-msg').textContent = ''; if (!f.hidden) $('pw-old').focus(); });
      $('pw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('pw-msg'), save = $('pw-form').querySelector('button[type=submit]');
        msg.classList.remove('bad');
        if ($('pw-new').value !== $('pw-new2').value) { msg.classList.add('bad'); msg.textContent = 'The two new ones do not match.'; return; }
        save.disabled = true; msg.textContent = 'Changing it…';
        const r = await Net.changePassword($('pw-old').value, $('pw-new').value);
        save.disabled = false;
        if (!r || !r.ok) { msg.classList.add('bad'); msg.textContent = (r && r.msg) || 'Something went wrong'; return; }
        $('pw-old').value = ''; $('pw-new').value = ''; $('pw-new2').value = '';
        $('pw-form').hidden = true;
        this.toast('PASSWORD CHANGED');
      });
    }
    body.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
      s[inp.dataset.key] = parseFloat(inp.value); Save.write(); Sound.applyVolumes();
    }));
    body.querySelectorAll('.seg').forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const key = g.dataset.key;
      let v = b.dataset.v;
      if (key === 'vibration' || key === 'minimap' || key === 'replays' || key === 'commentary') v = v === 'true';
      if (key === 'minutes') v = parseInt(v, 10);
      s[key] = v; Save.write(); this.tap();
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      if (key === 'graphics') { Render.quality = 0; Render.resize(); }
      if (key === 'controls') this.applyControls();
      if (key === 'vibration' && v) vibrate(20);
    })));
    // Deleting the account. The form is hidden until you ask for it, and asks for the password
    // — the server wants it, and a button that erases everything should take more than one tap.
    const del = $('del-acct');
    if (del) {
      del.addEventListener('click', () => {
        this.tap();
        const f = $('del-form');
        f.hidden = !f.hidden;
        if (!f.hidden) $('del-pw').focus();
      });
      $('del-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('del-msg'), pw = $('del-pw').value;
        if (!pw) { msg.textContent = 'Type your password first.'; return; }
        msg.textContent = 'Deleting\u2026';
        let r = null;
        try { r = await Net.api('/api/account/delete', { password: pw }); } catch (err) { r = null; }
        if (!r || !r.ok) { msg.textContent = (r && r.msg) || 'That did not work. Try again.'; return; }
        // gone from the server; now gone from this device too, so nothing of it is left behind
        Net.forget();
        Save.data = Save.defaults();
        Save.write();
        UI.closeModal();
        UI.showAuth('Your account has been deleted.');
      });
    }

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
      <p class="note">${r.table.length} countries, one ladder. Every online win moves your country up a place, every loss moves it down one. You're playing for <b>${Clubs.mine().name}</b>${pos ? ` — ${ordinal(pos)} in the table` : ''}.</p>
      <div class="league-wrap">
        <div class="lg-table-wrap"><table class="lg-table">
          <thead><tr><th>#</th><th class="lg-club">COUNTRY</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th title="Last move">±</th><th title="Players">👥</th></tr></thead>
          <tbody>${r.table.map((row, i) => { const c = Clubs.get(row.club); return `<tr class="${row.club === mine ? 'mine' : ''} ${i < 4 ? 'top' : ''}"><td>${i + 1}</td><td class="lg-club"><span class="lg-name"><canvas width="42" height="28" data-club="${c.id}"></canvas><b>${c.name}</b></span></td><td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td><td class="mv ${row.move > 0 ? 'up' : row.move < 0 ? 'down' : ''}">${row.move > 0 ? '▲' : row.move < 0 ? '▼' : '–'}</td><td>${row.players}</td></tr>`; }).join('')}</tbody>
        </table></div>
        <div class="lg-side">
          <button class="mid-btn lg-board" data-board>PLAYER LEADERBOARD</button>
          <h3>TOP SCORERS</h3>
          ${r.scorers.length ? `<ol class="lg-scorers">${r.scorers.map((s) => `<li><canvas width="42" height="28" data-club="${s.club}"></canvas><b>${s.name}</b><em>${s.goals}</em></li>`).join('')}</ol>` : '<p class="note">No online goals yet. Be the first.</p>'}
        </div>
      </div>`;
    body.querySelectorAll('canvas[data-club]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.club)));
    const lb = body.querySelector('[data-board]');
    if (lb) lb.addEventListener('click', () => { this.tap(); this.openModal('leaderboard'); });
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
          <small>${Save.account || 'GUEST'} · ${Clubs.mine().name} · LEVEL ${lv.level} ${rankFor(lv.level)} · <em style="color:${RARITIES[ch.rarity].color}">${RARITIES[ch.rarity].name}</em> · OVR ${charOvr(ch)}</small>
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
      const at = Pop.at(btn);
      Pop.coins(btn, coins >= 500 ? 16 : 10);
      Pop.ring(at.x, at.y, '#ffc21a', 200, 440);
      Pop.shout(at.x, at.y - 26, '+' + fmtCoins(coins), '#ffc21a', 900);
      Pop.confetti(at.x, at.y, ['#ffc21a', '#ffffff', '#6fd3ff'], 26);
      this.toast(`+${coins} COINS`);
      this.redraw(body, () => this.panel_profile(body));
      this.refreshHome();
    }));
  },

  // ---- little canvases ----
  fakePlayer(look, team = 'blue', keeper = false, number = 10) {
    return { team, isKeeper: keeper, number, look, vx: 0, vy: 0, fx: 1, fy: 0.3, faceX: 1, kickT: 0, kickDur: 0.2, celebrateT: 0, diveT: 0, stunT: 0, recoverT: 0, seed: 0, runPhase: 0, sad: false, slideT: 0, fallT: 0, hopT: 0 };
  },

  portrait(cv, look, team = 'blue', keeper = false, number = 10, drop = 0) {
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = TEAMS[team].board;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); g.clip();
    const k = w / 50;
    Sprites.player(g, this.fakePlayer(look, team, keeper, number), w / 2 - 2 * k, h * (0.46 + drop) + 56 * k, k, 0);
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

  // Every celebration card plays its animation on a loop while the tab is open — but only the
  // cards you can actually see, and at 30 a second. Eighty full player drawings a frame was most
  // of a frame's budget on its own, for sixty cards scrolled off the screen.
  animateCelebs(body) {
    const cards = [...body.querySelectorAll('canvas[data-celeb]')];
    if (!cards.length) return;
    if (this._celebIO) this._celebIO.disconnect();
    const live = new Set();
    const io = this._celebIO = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { live.add(en.target); this.celebSwatch(en.target, en.target.dataset.celeb, 1.2); }
        else live.delete(en.target);
      }
    }, { rootMargin: '60px' });
    for (const cv of cards) { this.celebSwatch(cv, cv.dataset.celeb, 1.2); io.observe(cv); }
    const start = performance.now();
    let last = 0;
    const frame = (now) => {
      if ($('modal').hidden || !cards[0].isConnected) { io.disconnect(); if (this._celebIO === io) this._celebIO = null; return; }
      requestAnimationFrame(frame);
      if (now - last < 33) return;
      last = now;
      const e = ((now - start) / 1000) % (CELE_TIME + 0.5);
      for (const cv of live) this.celebSwatch(cv, cv.dataset.celeb, Math.min(e, CELE_TIME - 0.02));
    };
    requestAnimationFrame(frame);
  },

  // How big a celebration may be drawn so what the player is wearing stays inside its card.
  // Wide wings on a flat body run out sideways, and a tall head item on a flipping body goes over
  // the top - both clipped, measured by tools/bugscan.js. Poses that fling the player at the edge
  // on purpose (a rocket launching, an archer drawing a bow) are left alone: shrinking them would
  // only make the animation smaller. The scan calls this too, so it tests what the game does.
  // The neon halo cannot be shrunk out of trouble: mid-flip it hangs below the head at a size that
  // does not scale with the sprite, and touched the bottom edge at every scale tried. So it is
  // lifted instead, and the other tall head items are drawn a little smaller.
  TALL_HEAD: { neonhalo: { k: 1, up: 10 }, antlers: { k: 0.85, up: 0 }, firecrown: { k: 0.85, up: 0 }, stormcloud: { k: 0.85, up: 0 } },
  celebFit(scale, pose, acc) {
    if (pose && pose.lie && /wings/.test(acc || '')) return { s: Math.min(scale, 0.65), up: 0 };
    const moving = pose && (pose.jump > 25 || Math.abs(pose.rot || 0) > 1);
    const t = moving && this.TALL_HEAD[acc];
    if (t) return { s: scale * t.k, up: t.up };
    return { s: scale, up: 0 };
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
    const ground = h - 14 - (lying ? 10 : pose && pose.kneel ? 12 : 0), scale = pose && (pose.jump > 25 || id === 'snowangel') ? 0.72 : pose && Math.abs(pose.rot || 0) > 1 ? 0.82 : 0.9;
    const fit = this.celebFit(scale, pose, p.look && p.look.acc);
    g.fillStyle = 'rgba(20,60,20,0.28)'; g.beginPath(); g.ellipse(w / 2, ground, lying ? 38 : 25, 8, 0, 0, Math.PI * 2); g.fill();
    // Wider framing keeps every flip, floor pose, prop and equipped accessory inside its card.
    Sprites.player(g, p, w / 2 + (lying === 'back' ? 23 : lying === 'front' ? -20 : 0), ground - fit.up, fit.s, e);
  },

  ballSwatch(cv, id) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#4fbd3b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#55c541'; for (let i = 0; i < 8; i += 2) g.fillRect(i * 25, 0, 25, h);
    const skin = BALLS.find((b) => b.id === id);
    g.fillStyle = 'rgba(20,60,20,0.28)'; g.beginPath(); g.ellipse(w / 2, h - 16, 26, 8, 0, 0, Math.PI * 2); g.fill();
    Sprites.ball(g, { x: 0, y: 0, z: 0, vx: 1, vy: 0.3, roll: 0.9, shot: null, owner: null, skin }, w / 2, h / 2 - 4, 3.2, Game.t);
  },

});
