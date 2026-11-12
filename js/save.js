// Profile + settings. Signed in, progress belongs to the account: it is kept on the
// server and cached per account on this device. The guest save is what you have before
// making an account, and it comes along when you sign up.
const Save = {
  data: null,
  account: null, // username when signed in
  defaults() {
    return {
      club: DEFAULT_CLUB,
      coins: 0,
      xp: 0,
      character: 'street',
      trail: 'electric',
      celebration: 'jump',
      skill: 'classic',
      accessory: null,
      // your one player: how they look, the accessories on (as many as you like) and the five stats
      look: { ...DEFAULT_LOOK },
      accessories: [],
      stats: { spd: 0, sht: 0, pas: 0, ctl: 0, def: 0 },
      // which side of the game you are on: 'intl' (your country) or 'club' (Club Career)
      arena: 'intl',
      cc: null,
      charRefund: 1, // a save made after characters went has nothing to give back
      seenCC: 1,     // 0 = show what Club Career changed (an older save, once)
      stadium: 'day',
      ball: 'classic',
      format: '4v4',
      owned: { character: [], trail: [], celebration: [], stadium: [], ball: [], accessory: [], skill: [] },
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals: 0,
      trophies: 0,
      cup: null,
      tutorialSeen: false,
      career: { assists: 0, tackles: 0, skills: 0, dodges: 0, passes: 0, shots: 0, powerGoals: 0, hattricks: 0, cleanSheets: 0, streak: 0, bestStreak: 0, formats: {}, online: 0, onlineWins: 0 },
      achievements: {},
      daily: { last: null, streak: 0 },
      challenges: {},
      settings: { music: 0.5, sfx: 0.85, vibration: true, difficulty: 'normal', graphics: 'auto', controls: 'auto', lefty: false, minimap: true, replays: true, chatMute: false, commentary: true },
    };
  },
  key() { return this.account ? STORAGE_KEY + '.' + this.account.toLowerCase() : STORAGE_KEY; },
  // fill in anything an older or partial save is missing
  merge(o) {
    const d = this.defaults();
    if (o && typeof o === 'object') {
      Object.assign(d, o);
      d.settings = Object.assign(this.defaults().settings, o.settings || {});
      d.owned = Object.assign(this.defaults().owned, o.owned || {});
      d.career = Object.assign(this.defaults().career, o.career || {});
      d.achievements = Object.assign({}, o.achievements || {});
      d.daily = Object.assign(this.defaults().daily, o.daily || {});
      // a part of the save that is not the shape it should be gets thrown away rather than
      // breaking the screen that reads it
      const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
      if (!obj(d.missions)) d.missions = null;
      else {
        if (!Array.isArray(d.missions.daily)) d.missions.day = null;
        if (!obj(d.missions.weekly)) d.missions.week = null;
      }
      if (!obj(d.challenges)) d.challenges = {};
      d.coins = Math.max(0, Math.floor(Number(d.coins) || 0));
      d.xp = Math.max(0, Math.floor(Number(d.xp) || 0));
    }
    d.club = countryFor(d.club);
    this.migrate(d, o);
    if (d.cup && d.cup.opponents && !d.cup.opponents.every((id) => CLUBS.some((c) => c.id === id))) d.cup = null;
    // older saves defaulted to HIGH; move them to AUTO once so slow screens get the safety net
    if (!d.gfxAuto) { if (d.settings.graphics === 'high') d.settings.graphics = 'auto'; d.gfxAuto = true; }
    return d;
  },
  load() {
    let o = null;
    try { const raw = localStorage.getItem(this.key()); if (raw) o = JSON.parse(raw); } catch (e) { /* private mode or blocked storage */ }
    this.migrated = false;
    this.data = this.merge(o);
    if (this.migrated) this.write();
    return this.data;
  },
  write() {
    // when this was written, so the newer of two copies can be told from the older
    this.data.savedAt = Date.now();
    try { localStorage.setItem(this.key(), JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    if (this.account && typeof Net !== 'undefined') Net.queueSave();
  },
  // signed in: the server copy wins; a brand-new account starts from what was sent up
  useAccount(name, serverSave, club, fresh) {
    const keepSettings = this.data && this.data.settings;
    this.account = name;
    // What this device has for this account. If it was written after the server's copy, it is
    // the one to keep: that is someone who has been playing with no connection, and the server
    // is the one that is out of date.
    let mine = null;
    try { const raw = localStorage.getItem(STORAGE_KEY + '.' + String(name).toLowerCase()); if (raw) mine = JSON.parse(raw); } catch (e) {}
    const ahead = mine && Number(mine.savedAt || 0) > Number((serverSave && serverSave.savedAt) || 0);
    this.migrated = false;
    this.data = this.merge(ahead ? mine : serverSave);
    this.playedOffline = !!ahead; // net.js pushes it up once it can
    // (the coins for old characters go up to the account straight away)
    if (this.migrated) { this.data.savedAt = Date.now(); this.playedOffline = true; }
    if (!serverSave && keepSettings) this.data.settings = keepSettings;
    this.data.club = club;
    if (fresh) { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} } // the guest save moved into the account
    try { localStorage.setItem(this.key(), JSON.stringify(this.data)); } catch (e) {}
    if (!serverSave || this.migrated) Net.queueSave();
  },
  // a guest (or logged out): the save kept on this device under no account
  useGuest() {
    this.account = null;
    this.load();
  },
  // Build 111: there are no characters to buy any more, just your own player. A save from before
  // gets its characters' coins back (once — `charRefund` says it is done), keeps the look of the
  // one it had on, and keeps the accessory it was wearing.
  migrate(d, o) {
    const old = o && typeof o === 'object' ? o : null;
    if (old && !old.charRefund) {
      const owned = Array.isArray(d.owned.character) ? d.owned.character : [];
      let refund = 0;
      if (typeof PRICES !== 'undefined') for (const id of new Set(owned)) refund += Math.max(0, Number(PRICES.character[id]) || 0);
      const ch = CHARACTERS.find((c) => c.id === old.character);
      if (!old.look && ch) d.look = { hair: LOOK_HAIRS.includes(ch.hair) ? ch.hair : DEFAULT_LOOK.hair, hairColor: LOOK_HAIR_COLORS.includes(ch.hairColor) ? ch.hairColor : DEFAULT_LOOK.hairColor, skin: ch.skin, cap: LOOK_CAPS.includes(ch.cap) ? ch.cap : DEFAULT_LOOK.cap, build: ch.buff ? 'buff' : ch.thin ? 'slim' : 'normal' };
      if (!Array.isArray(old.accessories) && old.accessory) d.accessories = [old.accessory];
      d.coins += refund;
      d.owned.character = [];
      d.charRefund = 1;
      if (refund) d.refundNote = refund;
      d.seenCC = 0;
      this.migrated = true;
    }
    d.look = cleanLook(d.look);
    d.accessories = cleanAccessories(d.accessories);
    d.stats = statLevels(d.stats);
    if (d.arena !== 'club') d.arena = 'intl';
    const cc = d.cc && typeof d.cc === 'object' && !Array.isArray(d.cc) ? d.cc : null;
    d.cc = cc;
    if (cc) {
      if (!EURO_IDS.has(cc.club)) cc.club = null;
      for (const k of ['goal', 'assist', 'since', 'until', 'goals', 'assists', 'earned', 'titles', 'signed']) cc[k] = Math.max(0, Math.floor(Number(cc[k]) || 0));
      if (cc.cup && !(cc.cup.opponents && cc.cup.opponents.every((id) => EURO_IDS.has(id)))) cc.cup = null;
      if (!Array.isArray(cc.run)) cc.run = [];
    }
    if (d.arena === 'club' && !(cc && cc.club)) d.arena = 'intl';
  },
  // Your player, in the shape everything that used to read a character still reads: ratings
  // from your stat levels, a grade from how good they are, and your look.
  character() {
    const r = statRatings(this.data.stats), ovr = overall(r), look = this.look();
    return { id: 'you', name: tl('YOUR PLAYER'), rarity: ovrGrade(ovr), r, ovr, hair: look.hair, hairColor: look.hairColor, skin: look.skin, cap: look.cap, buff: look.buff, thin: look.thin, anime: look.anime };
  },
  stats() { return statLevels(this.data.stats); },
  // one more level on a stat, if you can pay for it: the new level, or 0
  upgrade(key) {
    if (!STAT_KEYS.includes(key)) return 0;
    const L = statLevel(this.data.stats[key]), cost = statCost(L);
    if (L >= STAT_LEVEL_CAP || this.data.coins < cost) return 0;
    this.data.coins -= cost;
    this.data.stats[key] = L + 1;
    this.write();
    return L + 1;
  },
  trail() {
    const t = TRAILS.find((x) => x.id === this.data.trail);
    return t && Shop.owns('trail', t.id) ? t : TRAILS[0];
  },
  // You do not buy a ground any more: you play at the home of the country you play for.
  stadium() {
    return typeof homeStadium === 'function' ? homeStadium() : FALLBACK_STADIUM;
  },
  ball() {
    const b = BALLS.find((x) => x.id === this.data.ball);
    return b && Shop.owns('ball', b.id) ? b : BALLS[0];
  },
  // the signature move on your skill button, or Classic if you have not got one on
  skill() {
    const id = this.data.skill;
    return (typeof SKILL_IDS !== 'undefined' && SKILL_IDS.has(id)) && Shop.owns('skill', id) ? id : 'classic';
  },
  celebration() {
    const id = this.data.celebration;
    const real = typeof CELE_IDS !== 'undefined' ? CELE_IDS.includes(id) : CELEBRATIONS.some((c) => c.id === id);
    return real && Shop.owns('celebration', id) ? id : 'jump';
  },
  // every accessory you have on (only ones you own), in a fixed order
  accessories() { return cleanAccessories(this.data.accessories, (id) => Shop.owns('accessory', id)); },
  // the first of them (older code reads one)
  accessory() { return this.accessories()[0] || null; },
  wearing(id) { return this.accessories().includes(id); },
  // put one on or take it off
  toggleAccessory(id) {
    if (!ACCESSORY_IDS.has(id) || !Shop.owns('accessory', id)) return false;
    const on = this.accessories();
    this.data.accessories = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    this.data.accessory = this.data.accessories[0] || null;
    this.write();
    return this.data.accessories.includes(id);
  },
  // your player as drawn: your look plus everything you have on
  look() { return lookFromCustom(this.data.look, this.accessories()); },
};
