// Live match commentary: captions every important moment and uses the browser's built-in
// voice for the biggest calls. Lines are assembled from contextual banks, so matches do not
// sound scripted and pass moves build from "one" into a full dramatic sequence.
const Commentary = {
  m: null, cd: 0, idle: 0, passChain: 0, passTeam: null, lastOwner: null, lastShot: false,
  score: { blue: 0, red: 0 }, saves: { blue: 0, red: 0 }, tackles: { blue: 0, red: 0 }, skills: { blue: 0, red: 0 },
  kickCount: 0, recent: [], serial: 0,
  banks: {
    kickoff: ['And we are UNDERWAY!', 'The whistle goes—let the chaos begin!', 'Here we go! Ninety seconds of tiny-football madness!', 'Strap in. This could get ridiculous.'],
    shot: ['HE HITS IT!', 'SHOT ON!', 'That has been absolutely launched!', 'He has put his entire postcode through that!', 'From there?! Audacious!', 'The net is looking nervous!', 'Someone check the ball—it has been THUMPED!'],
    power: ['POWER SHOT! EVERYBODY DUCK!', 'That ball has family plans and it is leaving early!', 'THUNDERBOLT INCOMING!', 'He has tried to remove the net from the stadium!'],
    save: ['WHAT A SAVE!', 'DENIED! The keeper says absolutely not!', 'A magnificent stop!', 'The gloves have entered the conversation!', 'Saved! That keeper has springs in the boots!', 'How has that stayed out?!'],
    tackle: ['CRUNCHING TACKLE—but perfectly clean!', 'Pocket picked! Check for missing valuables!', 'He read that like tomorrow’s newspaper!', 'Ball won. Dignity possibly not.', 'That tackle came with a receipt!', 'No invitation needed—he just took the ball!'],
    skill: ['Oh, that is FILTHY!', 'Sent the defender for snacks!', 'Ankles have officially left the building!', 'That move needs a warning label!', 'He has turned the pitch into a dance floor!', 'Somebody find that defender a map!'],
    turnover: ['Possession stolen—danger!', 'They have coughed it up!', 'A gift, wrapped and delivered!', 'The ball changes hands and suddenly it is panic stations!'],
    miss: ['WIDE! The corner flag felt that one!', 'That shot needs directions!', 'Into row Z—someone keep the souvenir!', 'The goal was over there, my friend!', 'Close… if the target was the advertising board!', 'The keeper can unpack the sandwiches; no save required.'],
    quiet: ['A tense little spell here.', 'Both teams plotting. Neither team sharing the plan.', 'The crowd senses something coming.', 'This match is simmering nicely.', 'One pass could open the whole thing up.', 'Everyone is running. Some even know where.'],
    joke: ['{loser} are defending like the ball owes them money.', '{loser} have brought traffic cones to a football match.', '{winner} are cooking; {loser} forgot the recipe.', '{loser} need a timeout, a whiteboard, and possibly a compass.', '{winner} are moving the ball like it is remote-controlled.', 'The {loser} defense is socially distancing from the ball.'],
    goal: ['GOOOOOOOAL!', 'OH MY WORD! WHAT A GOAL!', 'THE NET HAS EXPLODED!', 'ABSOLUTE SCENES!', 'YOU CANNOT WRITE THIS!', 'BEDLAM IN THE STANDS!', 'That is outrageous! Simply OUTRAGEOUS!', 'Stop it! That is football from another planet!'],
    comeback: ['THE COMEBACK IS COMPLETE!', 'FROM THE DEAD—THEY HAVE TURNED IT AROUND!', 'They were buried, and now they lead! Incredible!'],
    equalizer: ['EQUALIZER! We are level and nobody can breathe!', 'ALL SQUARE! Throw the script away!', 'They have dragged it back! What a game!'],
    late: ['AT THE DEATH! UNBELIEVABLE!', 'LAST-GASP DRAMA!', 'There is no time left—except time for THAT!'],
    own: ['OH NO! OWN GOAL! Look away now!', 'Wrong net! That is a defender’s nightmare!', 'Disaster at the back—they have scored for the other team!'],
    penaltyGoal: ['BURIES IT!', 'Sends the keeper the wrong way!', 'Ice in the veins!', 'Top bins! No chance!'],
    penaltySave: ['SAVED! HEROIC GOALKEEPING!', 'The keeper guesses right!', 'DENIED FROM THE SPOT!', 'Huge hands, huge moment!'],
  },
  pick(lines) {
    if (!lines || !lines.length) return '';
    const pool = lines.filter((x) => !this.recent.includes(x));
    const line = (pool.length ? pool : lines)[Math.floor(Math.random() * (pool.length ? pool.length : lines.length))];
    this.recent.push(line); if (this.recent.length > 8) this.recent.shift(); return line;
  },
  name(p) { return p ? (p.isHuman ? 'YOU' : p.name || `${TEAMS[p.team].name} NUMBER ${p.number}`) : 'THE PLAYER'; },
  team(t) { return (TEAMS[t] && TEAMS[t].name) || String(t || '').toUpperCase(); },
  reset(m) {
    this.m = m; this.cd = 0; this.idle = 0; this.passChain = 0; this.passTeam = null; this.lastOwner = m.ball && m.ball.owner;
    this.lastShot = !!(m.ball && m.ball.shot); this.score = { ...m.score }; this.kickCount = 0; this.penKicks = { blue: 0, red: 0 }; this.serial++;
    for (const k of ['saves','tackles','skills']) this[k] = { blue: (m.stats.blue[k] || 0), red: (m.stats.red[k] || 0) };
    this.say(this.pick(this.banks.kickoff), 1, false);
  },
  hide() { const el = typeof $ === 'function' ? $('commentary') : null; if (el) el.classList.remove('show','big'); },
  say(text, priority = 1, voice = true) {
    if (!text || Save.data.settings.commentary === false) return;
    const el = $('commentary'), line = $('commentary-line'); if (!el || !line) return;
    line.textContent = text; el.classList.toggle('big', priority >= 3); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.hideTimer); this.hideTimer = setTimeout(() => el.classList.remove('show','big'), priority >= 3 ? 4200 : 2600);
    this.cd = priority >= 3 ? 2.2 : priority === 2 ? 1.15 : 0.62; this.idle = 0;
    if (!voice || Save.data.settings.commentary === false || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (priority >= 3) window.speechSynthesis.cancel();
    if (window.speechSynthesis.pending && priority < 2) return;
    const u = new SpeechSynthesisUtterance(text.replace(/GOOOOOOOAL/g, 'GOAL'));
    u.rate = priority >= 3 ? 1.16 : 1.28; u.pitch = priority >= 3 ? 1.1 : 1.04; u.volume = Math.min(1, 0.5 + (Save.data.settings.sfx || 0) * 0.45);
    const voices = window.speechSynthesis.getVoices(); u.voice = voices.find((v) => /en-(GB|AU|IE)/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
    window.speechSynthesis.speak(u);
  },
  passLine(team, p) {
    const n = this.passChain, who = this.name(p);
    if (n === 1) return `${who}. PASS ONE.`;
    if (n === 2) return 'PASS TWO—THE MOVE IS BUILDING!';
    if (n === 3) return 'PASS THREE! OH, THIS IS LOVELY!';
    if (n === 4) return 'FOUR PASSES! THEY ARE PLAYING KEEP-AWAY!';
    if (n === 5) return 'FIVE! THIS IS FOOTBALL WITH A CHEAT CODE!';
    const open = this.pick(['ONE TOUCH!', 'TIKI-TAKA!', 'ROUND AND ROUND THEY GO!', 'THE BALL IS ON A STRING!']);
    const finish = this.pick(['The opposition cannot get near it!', 'This is dizzying!', `${this.team(team)} are putting on a clinic!`, 'Somebody stop them!']);
    return `${open} ${n} PASSES! ${finish}`;
  },
  goal(m, team) {
    const g = m.goals && m.goals[m.goals.length - 1], other = team === 'blue' ? 'red' : 'blue';
    let call = g && g.own ? this.pick(this.banks.own) : this.pick(this.banks.goal);
    if (m.time < 12) call += ' ' + this.pick(this.banks.late);
    else if (m.score[team] === m.score[other]) call += ' ' + this.pick(this.banks.equalizer);
    else if (m.trailed && m.trailed[team] && m.score[team] > m.score[other]) call += ' ' + this.pick(this.banks.comeback);
    if (g && g.scorer) call += g.scorer.isHuman ? ' YOU HAVE DONE IT!' : ` ${this.name(g.scorer)} HAS DONE IT!`;
    if (g && g.assist) call += ` Brilliant work from ${this.name(g.assist)} in the build-up!`;
    if (g && g.scorer && g.scorer.stats.goals >= 3) call += ' HAT-TRICK HERO!';
    this.say(call, 3, true);
    if (Math.abs(m.score.blue - m.score.red) >= 3 && Math.random() < 0.55) setTimeout(() => { if (this.m === m) this.say(this.pick(this.banks.joke).replaceAll('{winner}', this.team(team)).replaceAll('{loser}', this.team(other)), 1, true); }, 4300);
  },
  updatePens(m) {
    const blue = (m.pens.kicks.blue || []).length, red = (m.pens.kicks.red || []).length, k = blue + red;
    if (k <= this.kickCount) return;
    const team = blue > this.penKicks.blue ? 'blue' : 'red', arr = m.pens.kicks[team] || [], scored = arr[arr.length - 1];
    this.kickCount = k; this.penKicks = { blue, red };
    this.say(this.pick(scored ? this.banks.penaltyGoal : this.banks.penaltySave), scored ? 2 : 3, true);
  },
  update(m, dt) {
    if (!m || !m.ball) return; if (this.m !== m) this.reset(m);
    this.cd = Math.max(0, this.cd - dt); this.idle += dt;
    if (m.pens) { this.updatePens(m); return; }
    for (const team of ['blue','red']) if (m.score[team] > this.score[team]) { this.score = { ...m.score }; this.goal(m, team); return; }
    const shot = !!m.ball.shot;
    if (shot && !this.lastShot) { const s=m.ball.shot; this.say(this.pick(s.power ? this.banks.power : this.banks.shot), s.power ? 2 : 1, true); }
    if (!shot && this.lastShot && !m.ball.owner && this.cd <= 0) this.say(this.pick(this.banks.miss), 1, true);
    this.lastShot = shot;
    for (const team of ['blue','red']) {
      const sv=m.stats[team].saves||0, tk=m.stats[team].tackles||0, sk=m.stats[team].skills||0;
      if (sv>this.saves[team]) this.say(this.pick(this.banks.save),2,true);
      else if(tk>this.tackles[team] && this.cd<=0) this.say(this.pick(this.banks.tackle),1,true);
      else if(sk>this.skills[team] && this.cd<=0) this.say(this.pick(this.banks.skill),1,true);
      this.saves[team]=sv; this.tackles[team]=tk; this.skills[team]=sk;
    }
    const owner=m.ball.owner, prev=this.lastOwner;
    if(owner && prev && owner!==prev) {
      if(owner.team===prev.team) { this.passChain=this.passTeam===owner.team?this.passChain+1:1; this.passTeam=owner.team; if(this.cd<=0 || this.passChain>=3) this.say(this.passLine(owner.team,owner),this.passChain>=4?2:1,true); }
      else { this.passChain=0; this.passTeam=null; if(this.cd<=0) this.say(this.pick(this.banks.turnover),1,true); }
    }
    if(!owner && prev && !shot) this.passChain=Math.max(0,this.passChain-1);
    this.lastOwner=owner;
    if(this.idle>11+Math.random()*7 && this.cd<=0 && m.phase==='play') this.say(this.pick(this.banks.quiet),1,true);
  },
};