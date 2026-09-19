// Profile + settings. Signed in, progress belongs to the account: it is kept on the
// server and cached per account on this device. The guest save is what you had before
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
      accessory: null,
      stadium: 'day',
      ball: 'classic',
      format: '4v4',
      owned: { character: [], trail: [], celebration: [], stadium: [], ball: [], accessory: [] },
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
      settings: { music: 0.5, sfx: 0.85, vibration: true, difficulty: 'normal', minutes: 3, graphics: 'auto', controls: 'auto', minimap: true, replays: true, chatMute: false },
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
    }
    d.club = countryFor(d.club);
    if (d.cup && d.cup.opponents && !d.cup.opponents.every((id) => CLUBS.some((c) => c.id === id))) d.cup = null;
    // older saves defaulted to HIGH; move them to AUTO once so slow screens get the safety net
    if (!d.gfxAuto) { if (d.settings.graphics === 'high') d.settings.graphics = 'auto'; d.gfxAuto = true; }
    return d;
  },
  load() {
    let o = null;
    try { const raw = localStorage.getItem(this.key()); if (raw) o = JSON.parse(raw); } catch (e) { /* private mode or blocked storage */ }
    this.data = this.merge(o);
    return this.data;
  },
  write() {
    try { localStorage.setItem(this.key(), JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    if (this.account && typeof Net !== 'undefined') Net.queueSave();
  },
  // signed in: the server copy wins; a brand-new account starts from what was sent up
  useAccount(name, serverSave, club, fresh) {
    const keepSettings = this.data && this.data.settings;
    this.account = name;
    this.data = this.merge(serverSave);
    if (!serverSave && keepSettings) this.data.settings = keepSettings;
    this.data.club = club;
    if (fresh) { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} } // the guest save moved into the account
    try { localStorage.setItem(this.key(), JSON.stringify(this.data)); } catch (e) {}
    if (!serverSave) Net.queueSave();
  },
  useGuest() {
    this.account = null;
    this.load();
  },
  // equipped items fall back to a free one if they are somehow not owned
  character() {
    const c = CHARACTERS.find((x) => x.id === this.data.character);
    return c && Shop.owns('character', c.id) ? c : CHARACTERS[0];
  },
  trail() {
    const t = TRAILS.find((x) => x.id === this.data.trail);
    return t && Shop.owns('trail', t.id) ? t : TRAILS[0];
  },
  stadium() {
    const s = STADIUMS.find((x) => x.id === this.data.stadium);
    return s && Shop.owns('stadium', s.id) ? s : STADIUMS[0];
  },
  ball() {
    const b = BALLS.find((x) => x.id === this.data.ball);
    return b && Shop.owns('ball', b.id) ? b : BALLS[0];
  },
  celebration() {
    return Shop.owns('celebration', this.data.celebration) ? this.data.celebration : 'jump';
  },
  // the equipped accessory id, or null if none (or not owned)
  accessory() {
    const id = this.data.accessory;
    return id && ACCESSORY_IDS.has(id) && Shop.owns('accessory', id) ? id : null;
  },
  // your player as drawn: the character plus whatever accessory you have on
  look() {
    const ch = this.character();
    return { hair: ch.hair, hairColor: ch.hairColor, skin: ch.skin, cap: ch.cap, band: ch.band, acc: this.accessory() };
  },
};
