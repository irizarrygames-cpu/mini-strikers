// Friends, parties and quick chat on this side of the wire. The server keeps the friends lists
// and the parties; this shows them and sends what you tap.
//   Friends: add by username, accept or say no, see who's online, invite them to your party.
//   Party:   the leader presses PLAY ONLINE (or the online World Cup) and everyone in it goes
//            into the same match, on the same side.
//   Quick chat: preset lines only (QUICK_CHAT), a bubble over whoever said it.
const CHAT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const FRIEND_STATUS = {
  online: ['ONLINE', 'on'], queue: ['FINDING A MATCH', 'busy'], room: ['IN A ROOM', 'busy'],
  busy: ['PLAYING', 'busy'], match: ['IN A MATCH', 'busy'], offline: ['OFFLINE', 'off'],
};

const Social = {
  friends: [], incoming: [], outgoing: [], loaded: false,
  party: null,          // { id, leader, lead, members: [{ name, club, status, leader, you }], invited }
  invites: [],          // party invites waiting for an answer: { id, from, club, until }
  challenges: [],
  cup: null,            // the friend cup you're in, as the server sees it
  cupInvites: [],       // cups you've been asked to join: { id, from, club, size, until }
  cupAt: 0,             // when the next round of it starts (on this clock)
  busy: false,
  chatOn: false, chatSent: [], feed: [], _armed: null,

  init() {
    // (a refresh in the middle of a cup: ask the server which one you are in)
    Net.on('hello', () => { this.busy = null; this.syncBusy(); Net.send({ t: 'cup.view' }); });
    Net.on('friends', (m) => { this.friends = m.friends || []; this.incoming = m.incoming || []; this.outgoing = m.outgoing || []; this.loaded = true; this.changed(); });
    Net.on('party', (m) => { this.party = m.id ? m : null; this.changed(); });
    Net.on('party.invite', (m) => {
      this.invites = this.invites.filter((i) => i.from !== m.from);
      this.invites.push({ id: m.id, from: m.from, club: m.club, until: performance.now() + 58000 });
      Sound.tap();
      this.changed();
    });
    Net.on('challenge.invite', (m) => { this.challenges = this.challenges.filter((i) => i.from !== m.from); this.challenges.push({ id: m.id, from: m.from, club: m.club, until: performance.now() + 58000 }); Sound.tap(); this.changed(); });
    Net.on('challenge.info', (m) => UI.toast(String(m.msg || '').toUpperCase()));
    Net.on('party.info', (m) => UI.toast(String(m.msg || '').toUpperCase()));
    Net.on('friend.req', (m) => UI.toast(`${m.name} WANTS TO BE FRIENDS`));
    Net.on('friend.new', (m) => UI.toast(`YOU AND ${m.name} ARE FRIENDS`));
    Net.on('social', (m) => { if (m.msg) UI.toast(String(m.msg).toUpperCase()); });
    // friend cups
    Net.on('cup', (m) => {
      const was = this.cup && this.cup.state;
      this.cup = m && m.state ? m : null;
      this.cupAt = this.cup && this.cup.nextIn ? performance.now() + this.cup.nextIn : 0;
      // the draw being made is worth looking at
      if (this.cup && this.cup.state === 'playing' && was === 'lobby' && Game.state === 'home') UI.openModal('cup');
      this.changed();
    });
    Net.on('cup.invite', (m) => {
      this.cupInvites = this.cupInvites.filter((i) => i.id !== m.id);
      this.cupInvites.push({ id: m.id, from: m.from, club: m.club, size: m.size, until: performance.now() + 118000 });
      Sound.tap(); this.changed();
    });
    Net.on('cup.gone', (m) => { this.cupInvites = this.cupInvites.filter((i) => i.id !== m.id); this.changed(); });
    Net.on('cup.end', (m) => { this.cup = null; this.cupAt = 0; if (m && m.msg) UI.toast(String(m.msg).toUpperCase()); this.changed(); });
    Net.on('cup.bye', (m) => UI.toast(String((m && m.msg) || 'YOU GO THROUGH').toUpperCase()));
    Net.on('cup.won', () => { if (Game.state !== 'match' && Game.state !== 'results') { Sound.powerReady(); UI.toast('YOU WON THE FRIEND CUP!'); } });
    Net.on('chat', (m) => this.onChat(m));

    $('btn-friends').addEventListener('click', () => { UI.tap(); UI.openModal('friends'); });
    $('party-bar').addEventListener('click', () => { UI.tap(); UI.openModal('friends'); });
    $('cup-bar').addEventListener('click', () => { UI.tap(); UI.openModal('cup'); });
    this.buildChat();
    // PC: T opens quick chat, then a number picks the line (Esc closes it without pausing)
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.chatAllowed()) return;
      const k = e.key.toLowerCase();
      if (k === 't' && !e.repeat) { e.preventDefault(); this.toggleChat(); return; }
      if (!this.chatOn) return;
      if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); this.toggleChat(false); return; }
      const i = CHAT_KEYS.indexOf(k);
      if (i >= 0 && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); this.say(i); }
    }, true);
  },

  signedIn: () => !!(Net.user && Net.token),
  // signed out: nothing of the last account's lists stays on screen
  reset() { this.friends = []; this.incoming = []; this.outgoing = []; this.loaded = false; this.party = null; this.invites = []; this.challenges = []; this.cup = null; this.cupInvites = []; this.cupAt = 0; this.busy = false; this.refreshHome(); },

  // something changed: redraw whatever is showing it
  changed() {
    this.refreshHome();
    if (!$('modal').hidden && $('modal').dataset.kind === 'friends') UI.panel_friends($('modal-body'), true);
    if (!$('modal').hidden && $('modal').dataset.kind === 'cup') UI.panel_cup($('modal-body'));
  },

  refreshHome() {
    const on = this.friends.filter((f) => f.status !== 'offline').length;
    const ask = this.incoming.length + this.liveInvites().length + this.liveChallenges().length + this.liveCups().length;
    $('friends-badge').hidden = !ask;
    $('friends-badge').textContent = ask;
    $('friends-on').hidden = !on;
    $('friends-on').textContent = on;
    const bar = $('party-bar'), p = this.party;
    bar.hidden = !p || p.members.length < 2;
    if (!bar.hidden) {
      bar.innerHTML = `<small>PARTY</small>${p.members.map((m) => `<span class="${m.you ? 'me' : ''}"><canvas width="36" height="24" data-club="${m.club}"></canvas>${m.leader ? '<i class="crown"></i>' : ''}${esc(m.you ? 'YOU' : m.name)}</span>`).join('')}<em>${p.lead ? 'YOU START THE MATCH' : `${esc(p.leader)} STARTS THE MATCH`}</em>`;
      bar.querySelectorAll('canvas[data-club]').forEach((cv) => UI.flagBadge(cv, Clubs.get(cv.dataset.club)));
    }
    const cupBar = $('cup-bar'), c = this.cup;
    cupBar.hidden = !c;
    if (c) {
      const left = this.cupAt ? Math.max(0, Math.ceil((this.cupAt - performance.now()) / 1000)) : 0;
      const where = c.state === 'done' ? (c.champion ? `${esc(c.champion)} WON IT` : 'OVER')
        : c.state === 'lobby' ? `${c.players.length}/${c.size} PLAYERS`
          : left ? `${CUP_ROUNDS[c.of - 1 - c.round] || 'NEXT ROUND'} IN ${left}`
            : CUP_ROUNDS[c.of - 1 - c.round] || 'PLAYING';
      cupBar.innerHTML = `<small>FRIEND CUP</small><span>${where}</span><em>SEE THE BOARD</em>`;
    }
    this.showInvite();
  },

  liveInvites() {
    const now = performance.now();
    this.invites = this.invites.filter((i) => i.until > now && !(this.party && this.party.id === i.id));
    return this.invites;
  },

  liveChallenges() { this.challenges = this.challenges.filter((i) => i.until > performance.now()); return this.challenges; },

  liveCups() { this.cupInvites = this.cupInvites.filter((i) => i.until > performance.now() && !(this.cup && this.cup.id === i.id)); return this.cupInvites; },

  // the invite card waits until you're not in the middle of a match
  showInvite() {
    const card = $('party-invite');
    const challenge = this.liveChallenges()[0], cupAsk = this.liveCups()[0];
    const inv = challenge || cupAsk || this.liveInvites()[0];
    const kind = challenge ? 'c' : cupAsk ? 'u' : 'p';
    const free = !['match', 'intro', 'paused'].includes(Game.state);
    // the FRIENDS panel lists it already; over any other menu it sits at the bottom, clear of the title
    const friendsOpen = !$('modal').hidden && $('modal').dataset.kind === 'friends';
    if (!inv || !free || friendsOpen) { card.hidden = true; card.dataset.id = ''; return; }
    card.classList.toggle('low', !$('modal').hidden || !$('results').hidden || !$('queue').hidden || !$('lobby').hidden);
    if (card.dataset.id === kind + String(inv.id) + inv.from && !card.hidden) return;
    card.dataset.id = kind + String(inv.id) + inv.from;
    const what = challenge ? 'challenged you to a 1v1' : cupAsk ? `invited you to a ${inv.size}-player cup` : 'invited you to their party';
    card.innerHTML = `<canvas width="48" height="32"></canvas><p><b>${esc(inv.from)}</b> ${what}</p><button class="mid-btn green" data-a="join">${challenge ? 'PLAY' : 'JOIN'}</button><button class="mid-btn red" data-a="no">NO</button>`;
    UI.flagBadge(card.querySelector('canvas'), Clubs.get(inv.club));
    card.hidden = false;
    const answer = (yes) => { UI.tap(); if (challenge) this.answerChallenge(inv, yes); else if (cupAsk) this.answerCup(inv, yes); else this.answerInvite(inv, yes); };
    card.querySelector('[data-a="join"]').addEventListener('click', () => answer(true));
    card.querySelector('[data-a="no"]').addEventListener('click', () => answer(false));
  },
  answerInvite(inv, yes) {
    this.invites = this.invites.filter((i) => i !== inv);
    $('party-invite').hidden = true; $('party-invite').dataset.id = '';
    Net.send({ t: yes ? 'party.accept' : 'party.decline', id: inv.id });
    this.changed();
  },

  answerCup(inv, yes) { this.cupInvites = this.cupInvites.filter((i) => i !== inv); $('party-invite').hidden = true; $('party-invite').dataset.id = ''; Net.send({ t: yes ? 'cup.accept' : 'cup.decline', id: inv.id }); this.changed(); },

  answerChallenge(inv, yes) { this.challenges = this.challenges.filter((i) => i !== inv); $('party-invite').hidden = true; $('party-invite').dataset.id = ''; Net.send({ t: yes ? 'challenge.accept' : 'challenge.decline', id: inv.id }); this.changed(); },

  // the server needs to know when you're busy playing against bots here, so your party waits for you
  syncBusy() {
    const m = Game.match;
    const busy = !!(m && !m.net && ['intro', 'match', 'paused'].includes(Game.state));
    if (busy !== this.busy && Net.wsReady) { this.busy = busy; Net.send({ t: 'busy', on: busy }); }
  },

  tick(dt) {
    this.syncBusy();
    this.botChat(dt);
    // the chat button is only there in an online match
    const on = this.chatAllowed();
    if ($('btn-chat').hidden === on) { $('btn-chat').hidden = !on; $('kl-chat').hidden = !on; if (!on) { this.toggleChat(false); this.feed = []; this.drawFeed(); } }
    if (this.chatOn) $('chat-menu').classList.toggle('cool', !this.canSay());
    if (this.feed.length && this.feed[0].until < performance.now()) { this.feed = this.feed.filter((f) => f.until > performance.now()); this.drawFeed(); }
    if (!$('party-invite').hidden || (this.invites.length || this.challenges.length || this.cupInvites.length)) this.showInvite();
    // the countdown to the next round ticks on the bar and on the board, once a second
    if (this.cup && this.cupAt) {
      const left = Math.max(0, Math.ceil((this.cupAt - performance.now()) / 1000));
      if (left !== this._cupLeft) {
        this._cupLeft = left;
        if (Game.state === 'home') this.refreshHome();
        if (!$('modal').hidden && $('modal').dataset.kind === 'cup') UI.panel_cup($('modal-body'));
      }
    }
  },

  // Offline the bots are all on this machine, so their chat happens here. Same habits as the
  // fill-ins online: a word after a goal, hello at kick-off, GG at the end, and the odd reply.
  botChat(dt) {
    const m = Game.match;
    if (!m || m.net || Game.state !== 'match' || Save.data.settings.chatMute) { this.botSays = null; return; }
    if (this.botMatch !== m) { this.botMatch = m; this.botSays = null; this.botSeen = 0; this.botQuiet = 2.5; this.botHi = false; this.botGG = false; }
    this.botQuiet = Math.max(0, this.botQuiet - (dt || 0));
    if (this.botSays) {
      this.botSays.t -= dt || 0;
      if (this.botSays.t <= 0) { const s = this.botSays; this.botSays = null; if (s.p && m.players.includes(s.p)) this.bubble(s.p, s.line, false); }
      return;
    }
    const mates = m.players.filter((p) => !p.isKeeper && !p.isHuman);
    if (!mates.length) return;
    const say = (pool, who, delay) => {
      if (this.botQuiet > 0 || !who) return;
      this.botQuiet = 5;
      this.botSays = { p: who, line: QUICK_CHAT.indexOf(pool[Math.floor(Math.random() * pool.length)]), t: delay };
    };
    if (!this.botHi && m.phase === 'play' && m.clock > 1) {
      this.botHi = true;
      if (Math.random() < 0.25) say(['HI!'], mates[Math.floor(Math.random() * mates.length)], 0.6 + Math.random() * 2);
    }
    if (m.goals.length > this.botSeen) {
      this.botSeen = m.goals.length;
      const g = m.goals[m.goals.length - 1];
      if (Math.random() < 0.45) {
        const scored = mates.filter((p) => p.team === g.team), conceded = mates.filter((p) => p.team !== g.team);
        if (g.scorer && !g.scorer.isHuman && scored.includes(g.scorer) && Math.random() < 0.5) say(["LET'S GO!", 'WOW!'], g.scorer, 0.9 + Math.random() * 1.4);
        else if (scored.length && Math.random() < 0.75) say(g.scorer && g.scorer.isHuman ? ['NICE ONE!', 'WHAT A GOAL!', 'WOW!'] : ['NICE ONE!', "LET'S GO!"], scored[Math.floor(Math.random() * scored.length)], 1 + Math.random() * 1.6);
        else if (conceded.length) say(['UNLUCKY', 'DEFEND!', 'WOW!'], conceded[Math.floor(Math.random() * conceded.length)], 1.2 + Math.random() * 1.6);
      }
    }
    if (!this.botGG && !m.overtime && m.time < 4 && m.phase === 'play') {
      this.botGG = true; this.botQuiet = 0;
      if (Math.random() < 0.3) say(['GG'], mates[Math.floor(Math.random() * mates.length)], Math.random() * 1.5);
    }
  },

  // your own line can get one back
  botReply(line) {
    const m = Game.match;
    if (!m || m.net || this.botSays) return;
    const said = QUICK_CHAT[line];
    const mates = m.players.filter((p) => !p.isKeeper && !p.isHuman);
    if (!mates.length || this.botQuiet > 0) return;
    const who = mates[Math.floor(Math.random() * mates.length)];
    const delay = 0.8 + Math.random() * 1.4;
    if ((said === 'HI!' || said === 'GG') && Math.random() < 0.45) { this.botQuiet = 5; this.botSays = { p: who, line, t: delay }; }
    else if (said === 'SORRY!' && Math.random() < 0.35) { this.botQuiet = 5; this.botSays = { p: who, line: QUICK_CHAT.indexOf('UNLUCKY'), t: delay }; }
    else if ((said === 'NICE ONE!' || said === 'WHAT A GOAL!') && Math.random() < 0.5) {
      const g = m.goals[m.goals.length - 1];
      if (g && g.scorer && mates.includes(g.scorer)) { this.botQuiet = 5; this.botSays = { p: g.scorer, line: QUICK_CHAT.indexOf('THANKS!'), t: delay }; }
    }
  },

  /* ---------------- quick chat ---------------- */
  chatAllowed() {
    const m = Game.match;
    if (!m || (m.net && Online.status !== 'match') || m.mode === 'pens' || Online.watching) return false;
    return Game.state === 'match' || Game.state === 'intro';
  },

  buildChat() {
    const menu = $('chat-menu');
    menu.innerHTML = QUICK_CHAT.map((line, i) => `<button data-i="${i}"><kbd>${CHAT_KEYS[i]}</kbd>${esc(line)}</button>`).join('') + '<button class="mute" data-mute="1"></button>';
    menu.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.say(Number(b.dataset.i)); }));
    const mute = menu.querySelector('[data-mute]');
    const label = () => { mute.textContent = Save.data.settings.chatMute ? 'CHAT OFF · TAP FOR ON' : 'HIDE OTHERS’ CHAT'; };
    mute.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); UI.tap(); Save.data.settings.chatMute = !Save.data.settings.chatMute; Save.write(); label(); });
    this._muteLabel = label;
    $('btn-chat').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.toggleChat(); });
    // touching anything else (the stick, a button, the pitch) closes the lines and still does its thing
    window.addEventListener('pointerdown', (e) => {
      if (this.chatOn && !menu.contains(e.target) && !$('btn-chat').contains(e.target)) this.toggleChat(false);
    }, true);
  },

  toggleChat(on = !this.chatOn) {
    if (on && !this.chatAllowed()) on = false;
    this.chatOn = on;
    $('chat-menu').hidden = !on;
    $('btn-chat').classList.toggle('on', on);
    if (on) { this._muteLabel(); $('chat-menu').classList.toggle('cool', !this.canSay()); }
  },

  // the same limits the server keeps: one line every 1.2s, five in any 10s
  canSay() {
    const now = performance.now();
    this.chatSent = this.chatSent.filter((t) => now - t < 10000);
    return this.chatSent.length < 5 && !(this.chatSent.length && now - this.chatSent[this.chatSent.length - 1] < 1200);
  },

  say(i) {
    const m = Game.match;
    if (!this.chatAllowed() || !QUICK_CHAT[i]) return;
    if (!this.canSay()) { Sound.tap(); return; }
    this.chatSent.push(performance.now());
    if (m.net) Net.send({ t: 'chat', m: i }); else this.botReply(i);
    this.bubble(m.human, i, true);
    this.toggleChat(false);
    Sound.tap();
  },

  onChat(msg) {
    const m = Online.m;
    if (!m || Online.status !== 'match' || Save.data.settings.chatMute) return;
    const p = m.players[msg.p];
    if (!p || !QUICK_CHAT[msg.m]) return;
    this.bubble(p, msg.m, false);
    Sound.chat();
  },

  bubble(p, i, mine) {
    if (!p) return;
    p.chat = { text: QUICK_CHAT[i], at: performance.now() };
    this.feed.push({ who: mine ? 'YOU' : p.name || '', mine, team: p.team, text: QUICK_CHAT[i], until: performance.now() + 4500 });
    while (this.feed.length > 3) this.feed.shift();
    this.drawFeed();
  },

  drawFeed() {
    $('chat-feed').innerHTML = this.feed.map((f) => `<div class="${f.mine ? 'me' : f.team === 'blue' ? 'mate' : 'them'}"><b>${esc(f.who)}</b> ${esc(f.text)}</div>`).join('');
  },
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- the FRIENDS panel ---------------- */
Object.assign(UI, {
  panel_friends(body, redraw = false) {
    $('modal-title').textContent = 'FRIENDS';
    const S = Social;
    // keep what you were typing when the list updates under you
    const typed = redraw && body.querySelector('#fr-name') ? body.querySelector('#fr-name').value : '';
    const focused = redraw && document.activeElement && document.activeElement.id === 'fr-name';
    if (!S.signedIn()) {
      body.innerHTML = '<p class="note fr-empty">Log in to add friends and team up with them.</p>';
      return;
    }
    if (!Net.wsReady) Net.openSocket();
    const p = S.party, lead = !p || p.lead, inParty = (name) => !!p && p.members.some((m) => m.name === name);
    const flag = (club) => `<canvas width="42" height="28" data-club="${club}"></canvas>`;
    const status = (st) => { const s = FRIEND_STATUS[st] || FRIEND_STATUS.offline; return `<em class="fr-st ${s[1]}">${s[0]}</em>`; };
    const partyHtml = p && (p.members.length > 1 || p.invited.length) ? `
      <section class="fr-party">
        <header><strong>YOUR PARTY</strong><small>${p.lead ? 'You start the match from PLAY. Everyone plays on your side.' : `${esc(p.leader)} starts the match. You all play on the same side.`}</small></header>
        <div class="fr-members">${p.members.map((m) => `<div class="fr-member ${m.you ? 'me' : ''}">${flag(m.club)}${m.leader ? '<i class="crown"></i>' : ''}<b>${esc(m.you ? 'YOU' : m.name)}</b>${p.lead && !m.you ? `<button class="fr-x" data-kick="${esc(m.name)}" aria-label="Take out">×</button>` : ''}</div>`).join('')}
          ${p.invited.map((n) => `<div class="fr-member invited"><b>${esc(n)}</b><small>INVITED…</small>${p.lead ? `<button class="fr-x" data-kick="${esc(n)}" aria-label="Cancel invite">×</button>` : ''}</div>`).join('')}</div>
        <button class="mid-btn red fr-leave" data-leave="1">LEAVE PARTY</button>
      </section>` : '';
    const challenges = S.liveChallenges().map((i) => `<div class="fr-row ask">${flag(i.club)}<b>${esc(i.from)}</b><small>CHALLENGED YOU TO A 1V1</small><button class="mid-btn green" data-accept-challenge="${i.id}">PLAY</button><button class="mid-btn red" data-decline-challenge="${i.id}">NO</button></div>`).join('');
    const invites = S.liveInvites().map((i) => `<div class="fr-row ask">${flag(i.club)}<b>${esc(i.from)}</b><small>INVITED YOU TO THEIR PARTY</small><button class="mid-btn green" data-join="${i.id}">JOIN</button><button class="mid-btn red" data-nojoin="${i.id}">NO</button></div>`).join('');
    const cupBtn = `<div class="fr-row cup-row"><b>FRIEND CUP</b><small>${S.cup ? 'YOU ARE IN ONE' : '4 OR 8 FRIENDS, KNOCKOUT'}</small><button class="mid-btn gold" data-cup="1">${S.cup ? 'SEE THE BOARD' : 'START ONE'}</button></div>`;
    const asks = S.incoming.map((f) => `<div class="fr-row ask">${flag(f.club)}<b>${esc(f.name)}</b><small>WANTS TO BE FRIENDS</small><button class="mid-btn green" data-accept="${esc(f.name)}">ACCEPT</button><button class="mid-btn red" data-decline="${esc(f.name)}">NO</button></div>`).join('');
    const partyFull = p && p.members.length + p.invited.length >= 4;
    const rows = S.friends.map((f) => {
      let act = '';
      if (inParty(f.name)) act = '<span class="fr-tag">IN YOUR PARTY</span>';
      else if (p && p.invited.includes(f.name)) act = '<span class="fr-tag">INVITED</span>';
      else if (lead && f.status !== 'offline' && !partyFull) act = `<button class="mid-btn blue" data-invite="${esc(f.name)}">INVITE</button>`;
      if (f.status === 'online') act += `<button class="mid-btn green" data-challenge="${esc(f.name)}">1V1</button>`;
      if (f.status === 'match') act += `<button class="mid-btn gold" data-watch="${esc(f.name)}">WATCH</button>`;
      const armed = S._armed === f.name;
      return `<div class="fr-row">${flag(f.club)}<b>${esc(f.name)}</b>${status(f.status)}${act}<button class="fr-x ${armed ? 'armed' : ''}" data-remove="${esc(f.name)}" aria-label="Remove friend">${armed ? 'REMOVE?' : '×'}</button></div>`;
    }).join('');
    const sent = S.outgoing.map((f) => `<div class="fr-row sent"><b>${esc(f.name)}</b><small>REQUEST SENT</small><button class="fr-x" data-cancel="${esc(f.name)}" aria-label="Cancel request">×</button></div>`).join('');
    body.innerHTML = `
      <form class="fr-add" autocomplete="off"><input id="fr-name" maxlength="14" placeholder="THEIR USERNAME" autocapitalize="off" spellcheck="false"><button class="mid-btn green" type="submit">ADD FRIEND</button></form>
      ${partyHtml}
      ${challenges || invites || asks ? `<h3 class="fr-h">WAITING FOR YOU</h3>${challenges}${invites}${asks}` : ''}
      ${cupBtn}
      <h3 class="fr-h">FRIENDS${S.friends.length ? ` · ${S.friends.length}` : ''}</h3>
      ${rows || `<p class="note fr-empty">${S.loaded ? 'No friends yet. Ask your mates for their username and add them here.' : 'Connecting…'}</p>`}
      ${sent ? `<h3 class="fr-h">SENT</h3>${sent}` : ''}
      <p class="note fr-foot">Challenge an online friend to a 1v1, invite them to your party to play on the same team, or run a cup between the lot of you. Only the quick chat lines can be sent in a match.</p>`;
    body.querySelectorAll('canvas[data-club]').forEach((cv) => this.flagBadge(cv, Clubs.get(cv.dataset.club)));
    const input = body.querySelector('#fr-name');
    input.value = typed;
    if (focused) { input.focus(); input.setSelectionRange(typed.length, typed.length); }
    const go = (obj) => { this.tap(); if (!Net.send(obj)) { Net.whenReady(obj); } };
    body.querySelector('.fr-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (name.length < 3) { this.toast('TYPE THEIR USERNAME'); return; }
      go({ t: 'friend.add', name });
      input.value = '';
    });
    const on = (sel, fn) => body.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); fn(b); }));
    on('[data-accept]', (b) => go({ t: 'friend.accept', name: b.dataset.accept }));
    on('[data-decline]', (b) => go({ t: 'friend.decline', name: b.dataset.decline }));
    on('[data-cancel]', (b) => go({ t: 'friend.remove', name: b.dataset.cancel }));
    on('[data-remove]', (b) => {
      // two taps: × then REMOVE?
      if (S._armed !== b.dataset.remove) { this.tap(); S._armed = b.dataset.remove; this.panel_friends(body, true); return; }
      S._armed = null;
      go({ t: 'friend.remove', name: b.dataset.remove });
    });
    on('[data-invite]', (b) => go({ t: 'party.invite', name: b.dataset.invite }));
    on('[data-watch]', (b) => { this.tap(); this.closeAll(); Online.watch(b.dataset.watch); });
    on('[data-cup]', () => { this.tap(); this.openModal('cup'); });
    on('[data-challenge]', (b) => go({ t: 'challenge.send', name: b.dataset.challenge }));
    on('[data-accept-challenge]', (b) => { const inv = S.challenges.find((i) => String(i.id) === b.dataset.acceptChallenge); if (inv) S.answerChallenge(inv, true); });
    on('[data-decline-challenge]', (b) => { const inv = S.challenges.find((i) => String(i.id) === b.dataset.declineChallenge); if (inv) S.answerChallenge(inv, false); });
    on('[data-kick]', (b) => go({ t: 'party.kick', name: b.dataset.kick }));
    on('[data-leave]', () => go({ t: 'party.leave' }));
    on('[data-join]', (b) => { const inv = S.invites.find((i) => String(i.id) === b.dataset.join); if (inv) S.answerInvite(inv, true); });
    on('[data-nojoin]', (b) => { const inv = S.invites.find((i) => String(i.id) === b.dataset.nojoin); if (inv) S.answerInvite(inv, false); });
    if (!redraw) { S._armed = null; if (Net.wsReady) Net.send({ t: 'friends' }); else Net.whenReady({ t: 'friends' }); }
  },
});
