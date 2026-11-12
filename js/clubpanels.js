// Club Career and your own player, on screen: the club bar on the home screen, the offers, the
// moment you sign, the switch between International and Clubs, and your player's stats.
Object.assign(UI, {
  // ---- the switch at the top of PLAY: your country, or your club ----
  arenaSwitch() {
    const club = Clubs.clubMode();
    return `<div class="arena-switch" role="tablist">
      <button data-arena="intl" class="${club ? '' : 'sel'}" role="tab" aria-selected="${!club}"><span class="ar-ico flag"></span>${tl('INTERNATIONAL')}</button>
      <button data-arena="club" class="${club ? 'sel' : ''}" role="tab" aria-selected="${club}"><span class="ar-ico crest"></span>${tl('CLUBS')}</button>
    </div>`;
  },
  bindArenaSwitch(body) {
    body.querySelectorAll('[data-arena]').forEach((b) => b.addEventListener('click', () => {
      this.tap();
      const want = b.dataset.arena;
      if ((want === 'club') === Clubs.clubMode()) return;
      // no club yet: the offers come first
      if (want === 'club' && !Career.club()) { this.openModal('offers'); return; }
      Career.setArena(want);
      this.closeModal();
      this.arenaArrive();
    }));
  },
  // you have just switched sides: say so, in the colours of who you are now
  arenaArrive() {
    const club = Clubs.mine(), kit = club.home;
    this.refreshHome();
    this.toast(Clubs.clubMode() ? tl('CLUB CAREER · {0}', [I18N.upper(club.name)]) : tl('INTERNATIONAL · {0}', [club.name]));
    const logo = $('logo');
    if (logo && typeof Pop !== 'undefined') { const at = Pop.at(logo); Pop.confetti(at.x, at.y, [kit.jersey, kit.accent, '#ffffff'], 30, 0.9); }
    Sound.goalJingle(true);
  },

  // ---- the bar above PLAY while you play for a club ----
  refreshClubBar() {
    const bar = $('club-bar');
    if (!bar) return;
    const on = Clubs.clubMode();
    $('home').classList.toggle('club-mode', on);
    bar.hidden = !on;
    if (!on) return;
    const club = Career.club(), s = Career.state(), live = Career.active(), fresh = Career.fresh();
    bar.style.setProperty('--c', clubUi(club));
    bar.innerHTML = `<canvas width="60" height="60"></canvas>
      <span class="cb-mid"><small>${tl('CLUB CAREER')}</small><b>${club.name}</b>
        <em>${live ? tl('{0} PER GOAL · {1} PER ASSIST · {2} LEFT', [s.goal, s.assist, Career.timeLeft(s.until - Date.now())]) : tl('CONTRACT OVER · SIGN A NEW ONE')}</em></span>
      <span class="cb-offers">${tl('OFFERS')}${fresh || !live ? `<i class="badge">${fresh ? tl('NEW') : '!'}</i>` : ''}</span>`;
    this.crestBadge(bar.querySelector('canvas'), club);
    if (!bar._wired) { bar._wired = true; bar.addEventListener('click', () => { this.tap(); this.openModal('offers'); }); }
  },

  // ---- CLUB OFFERS: your contract, and the four clubs that want you ----
  panel_offers(body) {
    $('modal-title').textContent = tl('CLUB OFFERS');
    const s = Career.state(), now = Date.now(), club = Career.club(), live = Career.active(now);
    const offers = Career.offers(), signed = Career.signedThisWindow();
    if (s.seen !== Career.period()) { s.seen = Career.period(); Save.write(); }
    const stars = (n) => `<span class="cc-stars" aria-label="${tl('{0} STARS', [n])}">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
    const contract = club ? `
      <div class="cc-contract ${live ? '' : 'over'}" style="--c:${clubUi(club)}">
        <canvas width="96" height="96" data-crest="${club.id}"></canvas>
        <div class="cc-c-mid">
          <small>${live ? tl('YOUR CLUB') : tl('CONTRACT OVER')}</small>
          <strong>${club.name}</strong>
          <span>${tl('{0} PER GOAL · {1} PER ASSIST', [s.goal, s.assist])}</span>
          <em>${live ? tl('{0} LEFT ON YOUR CONTRACT', [Career.timeLeft(s.until - now)]) : tl('Sign a new offer to get paid again.')}</em>
        </div>
        <div class="cc-c-tot"><b><span class="coin"></span>${fmtCoins(s.earned)}</b><small>${tl('EARNED')}</small><span>${tlN(s.goals, '{0} GOAL', '{0} GOALS')} · ${tlN(s.assists, '{0} ASSIST', '{0} ASSISTS')}</span></div>
      </div>` : `<p class="note big-note">${tl('No club yet. Four clubs want you: pick one and you play for them.')}</p>`;
    const next = Career.periodEnds() - now;
    const cards = offers.map((o) => {
      const c = Clubs.get(o.club), mine = signed && s.club === o.club;
      return `<div class="cc-offer ${mine ? 'mine' : signed ? 'gone' : ''}" style="--c:${clubUi(c)}">
        <canvas width="96" height="96" data-crest="${c.id}"></canvas>
        <strong>${c.name}</strong>
        ${stars(c.stars)}
        <div class="cc-pay"><span><b>+${o.goal}</b><small>${tl('PER GOAL')}</small></span><span><b>+${o.assist}</b><small>${tl('PER ASSIST')}</small></span></div>
        <button class="mid-btn ${mine ? '' : 'green'}" data-sign="${c.id}" ${signed ? 'disabled' : ''}>${mine ? tl('SIGNED') : signed ? tl('GONE') : tl('SIGN')}</button>
      </div>`;
    }).join('');
    body.innerHTML = `${contract}
      <h3 class="fr-h">${signed ? tl('NEW OFFERS IN {0}', [Career.timeLeft(next)]) : tl('PICK ONE · NEW OFFERS IN {0}', [Career.timeLeft(next)])}</h3>
      <div class="cc-offers">${cards}</div>
      <p class="note">${tl('Every goal and every assist for your club pays you coins until the contract runs out (three days). You can sign one offer every three days. Bigger clubs pay more, and better stats bring better offers.')}</p>
      ${club ? `<div class="cup-foot"><button class="mid-btn" data-arena-go="${Clubs.clubMode() ? 'intl' : 'club'}">${Clubs.clubMode() ? tl('PLAY INTERNATIONAL') : tl('PLAY FOR {0}', [I18N.upper(club.name)])}</button></div>` : ''}`;
    body.querySelectorAll('canvas[data-crest]').forEach((cv) => this.crestBadge(cv, Clubs.get(cv.dataset.crest)));
    body.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      // two taps: SIGN, then TAP AGAIN (so a stray tap never signs you away from a club)
      if (!b.classList.contains('armed')) {
        body.querySelectorAll('[data-sign].armed').forEach((x) => { x.classList.remove('armed'); x.textContent = tl('SIGN'); });
        this.tap(); b.classList.add('armed'); b.textContent = tl('TAP AGAIN'); return;
      }
      if (!Career.sign(b.dataset.sign)) { Sound.steal(); this.toast(tl('YOU HAVE SIGNED FOR A CLUB ALREADY THIS TIME')); this.panel_offers(body); return; }
      this.closeModal();
      this.signedFor(Clubs.get(b.dataset.sign));
    }));
    const go = body.querySelector('[data-arena-go]');
    if (go) go.addEventListener('click', () => { this.tap(); Career.setArena(go.dataset.arenaGo); this.closeModal(); this.arenaArrive(); });
  },

  // ---- you signed: the club's colours, its badge, what it pays ----
  signedFor(club) {
    const s = Career.state(), kit = club.home;
    this.refreshHome();
    const el = document.createElement('div');
    el.className = 'overlay grownup sheet cc-signed';
    el.style.zIndex = 30;
    el.innerHTML = `<div class="panel small" style="--c:${clubUi(club)}"><div class="gate">
      <small class="cc-sig-kick">${tl('SIGNED!')}</small>
      <canvas width="180" height="180"></canvas>
      <strong>${tl('WELCOME TO {0}!', [I18N.upper(club.name)])}</strong>
      <p>${tl('You wear their kit and play at their ground in every mode, and the World Cup is the Champions Cup now.')}</p>
      <div class="cc-pay big"><span><b>+${s.goal}</b><small>${tl('PER GOAL')}</small></span><span><b>+${s.assist}</b><small>${tl('PER ASSIST')}</small></span></div>
      <div class="gate-btns"><button class="big-btn green" data-go>${tl("LET'S GO")}</button></div>
    </div></div>`;
    document.body.appendChild(el);
    this.crestBadge(el.querySelector('canvas'), club);
    const at = Pop.at(el.querySelector('canvas'));
    Pop.ring(at.x, at.y, kit.jersey, 260, 600);
    Pop.confetti(at.x, at.y, [kit.jersey, kit.accent, '#ffffff', '#ffc21a'], 60, 1.1);
    Sound.goalJingle(true); Sound.cheer(true); vibrate([30, 40, 60]);
    el.querySelector('[data-go]').addEventListener('click', () => { this.tap(); el.remove(); this.refreshHome(); });
  },

  // ---- your player: the five stats, and what the next level of each costs ----
  panel_stats(body) {
    $('modal-title').textContent = tl('YOUR PLAYER');
    const d = Save.data, L = Save.stats(), r = statRatings(L), ovr = overall(r), grade = ovrGrade(ovr);
    const rows = STAT_KEYS.map((k) => {
      const lv = L[k], now = r[k], gain = statRating(lv + 1) - now, cost = statCost(lv), can = d.coins >= cost;
      const pct = clamp((now - 40) / 60, 0, 1);
      return `<div class="st-row">
        <span class="st-name"><b>${STAT_NAMES[k]}</b><small>${tl('LEVEL {0}', [lv])}</small></span>
        <span class="st-bar"><i style="width:${Math.round(pct * 100)}%"></i></span>
        <span class="st-val"><b>${now.toFixed(1)}</b><small>+${gain.toFixed(2)}</small></span>
        <button class="mid-btn green st-up" data-up="${k}" ${can ? '' : 'disabled'} aria-label="${tl('UPGRADE {0}', [STAT_NAMES[k]])}"><span class="coin"></span>${fmtCoins(cost)}</button>
      </div>`;
    }).join('');
    body.innerHTML = `
      <div class="st-head">
        <canvas id="st-canvas" width="120" height="120"></canvas>
        <div class="st-ovr" style="--rar:${RARITIES[grade].color}"><b>${ovr}</b><small>${tl('OVR')}</small><em>${RARITIES[grade].name}</em></div>
        <div class="st-side">${this.coinsLine()}<button class="mid-btn" data-look>${tl('CHANGE LOOK')}</button></div>
      </div>
      <div class="st-list">${rows}</div>
      <p class="note">${tl('Spend coins to make your player better. Every level costs more than the one before and adds a little less, and there is no top level. Online, better players are matched against better players.')}</p>`;
    this.portrait($('st-canvas'), Save.look());
    body.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.up, before = statRating(Save.stats()[k]);
      if (!Save.upgrade(k)) { Sound.steal(); this.toast(tl('NOT ENOUGH COINS')); return; }
      const gain = statRating(Save.stats()[k]) - before;
      Sound.powerReady(); vibrate(15);
      const at = Pop.at(b);
      Pop.ring(at.x, at.y, '#3fcf4a', 120, 360);
      Pop.shout(at.x, at.y - 24, '+' + gain.toFixed(2), '#3fcf4a', 700);
      this.redraw(body, () => this.panel_stats(body));
      this.refreshHome();
    }));
    body.querySelector('[data-look]').addEventListener('click', () => { this.tap(); this._custTab = 'character'; this.openModal('customize'); });
  },
  // (the old characters window is your player now)
  panel_characters(body) { this.panel_stats(body); },

  // ---- customize: the PLAYER tab is your look ----
  LOOK_BUILD_NAMES: { normal: tl('NORMAL'), buff: tl('STRONG'), slim: tl('SLIM') },
  lookEditor() {
    const l = cleanLook(Save.data.look);
    const capped = ['cap', 'headband', 'beanie', 'bandana'].includes(l.hair);
    const sw = (key, list) => list.map((c) => `<button class="look-sw ${l[key] === c ? 'sel' : ''}" data-look="${key}" data-v="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('');
    return `
      <div class="look-sec"><h4>${tl('HAIR')}</h4><div class="look-row">${LOOK_HAIRS.map((h) => `<button class="look-opt ${l.hair === h ? 'sel' : ''}" data-look="hair" data-v="${h}" aria-label="${h}"><canvas width="72" height="72" data-hair="${h}"></canvas></button>`).join('')}</div></div>
      <div class="look-sec"><h4>${tl('HAIR COLOUR')}</h4><div class="look-row">${sw('hairColor', LOOK_HAIR_COLORS)}</div></div>
      <div class="look-sec"><h4>${tl('SKIN')}</h4><div class="look-row">${sw('skin', SKINS)}</div></div>
      ${capped ? `<div class="look-sec"><h4>${tl('HAT COLOUR')}</h4><div class="look-row">${sw('cap', LOOK_CAPS)}</div></div>` : ''}
      <div class="look-sec"><h4>${tl('BUILD')}</h4><div class="look-row">${LOOK_BUILDS.map((b) => `<button class="look-chip ${l.build === b ? 'sel' : ''}" data-look="build" data-v="${b}">${this.LOOK_BUILD_NAMES[b]}</button>`).join('')}</div></div>
      <div class="look-sec"><button class="mid-btn green" data-stats>${tl('STATS & UPGRADES')}</button></div>`;
  },
  bindLookEditor(body) {
    body.querySelectorAll('canvas[data-hair]').forEach((cv) => this.portrait(cv, lookFromCustom({ ...Save.data.look, hair: cv.dataset.hair }, [])));
    body.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => {
      this.tap();
      Save.data.look = cleanLook({ ...Save.data.look, [b.dataset.look]: b.dataset.v });
      Save.write();
      this.redraw(body, () => this.panel_customize(body));
      this.refreshHome();
    }));
    const st = body.querySelector('[data-stats]');
    if (st) st.addEventListener('click', () => { this.tap(); this.openModal('stats'); });
  },

  // ---- once, after the update: what changed, and the coins for the old characters ----
  maybeWhatsNew() {
    const d = Save.data;
    // only on the home screen itself: not over the sign-in page, the splash or another window
    const onHome = Game.state === 'home' && !$('home').hidden && $('auth').hidden && $('splash').classList.contains('gone') && $('modal').hidden && $('daily').hidden && $('howto').hidden && !document.querySelector('.overlay.sheet, #trophy:not([hidden])');
    if (!d || d.seenCC !== 0 || !onHome) return false;
    d.seenCC = 1; Save.write();
    const refund = d.refundNote || 0;
    delete d.refundNote;
    const el = document.createElement('div');
    el.className = 'overlay grownup sheet cc-new';
    el.style.zIndex = 30;
    el.innerHTML = `<div class="panel small"><div class="gate">
      <strong>${tl('NEW: CLUB CAREER!')}</strong>
      <ul class="cc-new-list">
        <li>${tl('Press PLAY, then CLUBS: four clubs make you an offer every three days. Every goal and assist pays you coins.')}</li>
        <li>${tl('Every mode works for your club, and the World Cup is the Champions Cup.')}</li>
        <li>${tl('One player, all yours: change the look, and spend coins on stats.')}</li>
        <li>${tl('Wear as many accessories as you like, all at once.')}</li>
        <li>${tl('Your ULT is a different kick every time, in flames: volley, bicycle kick, backflip kick or scorpion kick.')}</li>
      </ul>
      ${refund ? `<p class="cc-refund">${tl('There are no characters to buy any more, so every coin you spent on them is back: +{0} COINS', [fmtCoins(refund)])}</p>` : ''}
      <div class="gate-btns"><button class="mid-btn" data-later>${tl('LATER')}</button><button class="mid-btn green" data-go>${tl('SEE THE OFFERS')}</button></div>
    </div></div>`;
    document.body.appendChild(el);
    el.querySelector('[data-later]').addEventListener('click', () => { this.tap(); el.remove(); });
    el.querySelector('[data-go]').addEventListener('click', () => { this.tap(); el.remove(); this.openModal('offers'); });
    return true;
  },
});
