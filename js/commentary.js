// Live match commentary: captions every important moment and uses the browser's built-in
// voice for the biggest calls. Lines are assembled from contextual banks, so matches do not
// sound scripted and pass moves build from "one" into a full dramatic sequence.
const Commentary = {
  m: null, cd: 0, idle: 0, passChain: 0, passTeam: null, lastOwner: null, lastShot: false,
  score: { blue: 0, red: 0 }, saves: { blue: 0, red: 0 }, tackles: { blue: 0, red: 0 }, skills: { blue: 0, red: 0 },
  kickCount: 0, recent: [], serial: 0, voices: [], voice: null, speaking: false, voiceQueue: [], voiceToken: 0, nextVoiceAt: 0, unlocked: false, paused: false,
  banks: {
    kickoff: ['And we are UNDERWAY!', 'The whistle goes—let the chaos begin!', 'Here we go! Ninety seconds of tiny-football madness!', 'Strap in. This could get ridiculous.'],
    shot: ['HE HITS IT!', 'SHOT ON!', 'That has been absolutely launched!', 'He has put his entire postcode through that!', 'From there?! Audacious!', 'The net is looking nervous!', 'Someone check the ball—it has been THUMPED!', 'HE HAS HIT THAT LIKE IT INSULTED HIS FAMILY!', 'The keeper has seen it coming and immediately started negotiating!', 'That shot had absolutely no chill!', 'He shoots from a different postal code!'],
    power: ['POWER SHOT! EVERYBODY DUCK!', 'That ball has family plans and it is leaving early!', 'THUNDERBOLT INCOMING!', 'He has tried to remove the net from the stadium!', 'THE BALL HAS ACHIEVED ESCAPE VELOCITY!', 'Someone alert air traffic control!', 'He pressed shoot and accidentally launched a satellite!', 'That ball is travelling through time!'],
    save: ['WHAT A SAVE!', 'DENIED! The keeper says absolutely not!', 'A magnificent stop!', 'The gloves have entered the conversation!', 'Saved! That keeper has springs in the boots!', 'How has that stayed out?!', 'CALL THE AUTHORITIES! THAT SAVE IS ABSURD!', 'The keeper has just committed daylight robbery!', 'That was heading in until the goalkeeper cancelled the appointment!', 'Hands like frying pans! Nothing gets through!'],
    tackle: ['CRUNCHING TACKLE—but perfectly clean!', 'Pocket picked! Check for missing valuables!', 'He read that like tomorrow’s newspaper!', 'Ball won. Dignity possibly not.', 'That tackle came with a receipt!', 'No invitation needed—he just took the ball!', 'That tackle rearranged the furniture!', 'He took the ball, the space, and possibly the defender’s lunch!', 'Clean as a whistle and twice as loud!', 'The defender arrived like an unexpected tax bill!'],
    skill: ['Oh, that is FILTHY!', 'Sent the defender for snacks!', 'Ankles have officially left the building!', 'That move needs a warning label!', 'He has turned the pitch into a dance floor!', 'Somebody find that defender a map!', 'The defender has been sent into another dimension!', 'Oh dear! That defender is buffering!', 'He twisted him into a pretzel!', 'That skill move should require a license!', 'The defender has left the chat!'],
    turnover: ['Possession stolen—danger!', 'They have coughed it up!', 'A gift, wrapped and delivered!', 'The ball changes hands and suddenly it is panic stations!', 'They gave the ball away like it was a suspicious package!', 'Possession donated to charity!', 'That pass was addressed to absolutely nobody!', 'A catastrophic oopsie in midfield!'],
    miss: ['WIDE! The corner flag felt that one!', 'That shot needs directions!', 'Into row Z—someone keep the souvenir!', 'The goal was over there, my friend!', 'Close… if the target was the advertising board!', 'The keeper can unpack the sandwiches; no save required.', 'That shot is now applying for citizenship in another country!', 'The corner flag was in more danger than the goal!', 'That effort needs a sat-nav and a sincere apology!', 'Somewhere, a window is about to have a very bad afternoon!', 'He aimed for glory and found the parking lot!'],
    quiet: ['A tense little spell here.', 'Both teams plotting. Neither team sharing the plan.', 'The crowd senses something coming.', 'This match is simmering nicely.', 'One pass could open the whole thing up.', 'Everyone is running. Some even know where.'],
    flow: ['{team} have the ball and they are looking for an opening.', '{player} takes possession. What can they create here?', '{team} move forward with real purpose.', 'The pressure is building. {team} are asking questions now.', '{player} slows it down, looks up, and picks the next move.', '{team} keep it moving. The defenders are being pulled everywhere.', 'Plenty of space ahead of {player}. This could become dangerous.', '{team} recycle possession and start again.', '{player} carries it into midfield with options left and right.', 'Listen to the crowd. They sense a chance for {team}.', '{team} are trying to turn possession into something spectacular.', '{player} is dictating the tempo right now.', 'A patient spell from {team}, but one sharp pass could change everything.', '{team} come again. The opposition cannot switch off for a second.', '{player} wants the ball, gets the ball, and drives the play forward.', 'End-to-end football here. Nobody is interested in slowing down.', 'The shape is opening up, and {team} are ready to attack it.', '{player} checks over the shoulder. There is room to work with.', 'Good control from {player}; now the next pass has to be right.', '{team} are camped in the attacking half and looking hungry.'],
    chaos: ['I have no idea what is happening anymore, but I absolutely love it!', 'This match needs seatbelts!', 'My notes are useless. The football has become pure chaos!', 'Somebody check on the tactical board. It just burst into flames!', 'I was promised a football match, not an action movie!', 'The ball is moving faster than my ability to form sentences!', 'This is less of a match and more of a very polite riot!', 'I need a replay, a calculator, and a lie down!', 'Both managers have thrown the game plan directly into the bin!', 'There are players everywhere! This pitch has become a pinball machine!', 'I blinked once and missed three tactical revolutions!', 'The crowd is roaring, the players are flying, and my tea is now on the floor!', 'This game has the emotional stability of a shopping cart with one bad wheel!', 'Nobody knows what comes next. Especially the defenders!', 'The tactics are gone. We are operating entirely on vibes now!', 'I have seen calmer scenes at a squirrel convention!', 'This is football served with extra chaos and absolutely no receipt!', 'The match has gone completely bananas, and the bananas are winning!', 'If this gets any wilder, the referee will need a parachute!', 'My voice may not survive this match, but what a way to go!', 'The laws of football are currently hiding behind the sofa!', 'Someone tell the players this is not a speed-running competition!', 'This match is bouncing around like popcorn in a washing machine!', 'I cannot keep up! Even the scoreboard looks nervous!'],
    joke: ['{loser} are defending like the ball owes them money.', '{loser} have brought traffic cones to a football match.', '{winner} are cooking; {loser} forgot the recipe.', '{loser} need a timeout, a whiteboard, and possibly a compass.', '{winner} are moving the ball like it is remote-controlled.', 'The {loser} defense is socially distancing from the ball.', '{loser} are marking imaginary players with incredible dedication.', '{loser} have lost the plot, the sequel, and the director’s commentary.', '{winner} are serving five-star football; {loser} brought a packed lunch.', 'The {loser} defense has more holes than a block of cheese.', '{loser} look like their controllers have disconnected.', '{winner} are playing chess while {loser} are eating the pieces.'],
    goal: ['GOOOOOOOAL!', 'OH MY WORD! WHAT A GOAL!', 'THE NET HAS EXPLODED!', 'ABSOLUTE SCENES!', 'YOU CANNOT WRITE THIS!', 'BEDLAM IN THE STANDS!', 'That is outrageous! Simply OUTRAGEOUS!', 'Stop it! That is football from another planet!', 'GOAL! THE STADIUM HAS COMPLETELY LOST ITS MIND!', 'SOMEBODY HOLD ME! THAT IS ABSOLUTELY RIDICULOUS!', 'WHAT HAVE WE JUST WITNESSED?! FRAME IT AND PUT IT IN A MUSEUM!', 'THE CROWD ERUPTS! I CAN BARELY HEAR MYSELF THINK!', 'That is not a goal. That is a public service announcement!', 'Football has peaked! Everybody can go home now!'],
    comeback: ['THE COMEBACK IS COMPLETE!', 'FROM THE DEAD—THEY HAVE TURNED IT AROUND!', 'They were buried, and now they lead! Incredible!', 'THEY HAVE RISEN FROM THE FOOTBALL GRAVE!', 'Plot twist! The comeback nobody saw coming!', 'They looked finished. Apparently nobody told them!'],
    equalizer: ['EQUALIZER! We are level and nobody can breathe!', 'ALL SQUARE! Throw the script away!', 'They have dragged it back! What a game!', 'LEVEL AGAIN! THIS MATCH HAS COMPLETELY LOST CONTROL!', 'Back from the brink! The scriptwriter deserves a raise!', 'Nobody blink! This game is officially bananas!'],
    late: ['AT THE DEATH! UNBELIEVABLE!', 'LAST-GASP DRAMA!', 'There is no time left—except time for THAT!', 'RIGHT AT THE BUZZER! ABSOLUTE CINEMA!', 'They have stolen it with the final breath of the match!', 'That is heartbreak on one side and total mayhem on the other!'],
    own: ['OH NO! OWN GOAL! Look away now!', 'Wrong net! That is a defender’s nightmare!', 'Disaster at the back—they have scored for the other team!', 'Oh no! That is going straight into the blooper reel!', 'The striker did not even need to help!', 'A beautiful finish, unfortunately in completely the wrong goal!'],
    penaltyGoal: ['BURIES IT!', 'Sends the keeper the wrong way!', 'Ice in the veins!', 'Top bins! No chance!', 'Cooler than the other side of the pillow!', 'The keeper guessed correctly and still needed a taxi!', 'That penalty was delivered with ice-cold confidence!'],
    penaltySave: ['SAVED! HEROIC GOALKEEPING!', 'The keeper guesses right!', 'DENIED FROM THE SPOT!', 'Huge hands, huge moment!', 'THE KEEPER IS A WALL WITH GLOVES!', 'Read like an open book and slammed shut!', 'The goalkeeper has just become the main character!'],
  },
  pick(lines) {
    if (!lines || !lines.length) return '';
    const pool = lines.filter((x) => !this.recent.includes(x));
    const line = (pool.length ? pool : lines)[Math.floor(Math.random() * (pool.length ? pool.length : lines.length))];
    this.recent.push(line); if (this.recent.length > 8) this.recent.shift(); return line;
  },
  name(p) { return p ? (p.isHuman ? 'YOU' : p.name || `${TEAMS[p.team].name} NUMBER ${p.number}`) : 'THE PLAYER'; },
  team(t) { return (TEAMS[t] && TEAMS[t].name) || String(t || '').toUpperCase(); },
  init() {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
    this.refreshVoices();
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices());
  },
  refreshVoices() {
    this.voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const score = (v) => {
      const n = `${v.name} ${v.voiceURI}`.toLowerCase(); let x = /^en/i.test(v.lang) ? 20 : -100;
      if (/natural|neural|premium|enhanced|online/.test(n)) x += 100;
      if (/ryan|guy|daniel|george|aaron|arthur|oliver|liam/.test(n)) x += 35;
      if (/google uk english male|microsoft.*english.*united kingdom/.test(n)) x += 30;
      if (/en-(gb|ie|au)/i.test(v.lang)) x += 18;
      if (v.localService) x += 4;
      return x;
    };
    this.voice = this.voices.filter((v) => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a))[0] || null;
  },
  unlock() {
    if (this.unlocked || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
    this.unlocked = true; this.refreshVoices();
    const u = new SpeechSynthesisUtterance(''); u.volume = 0; window.speechSynthesis.speak(u);
  },
  flowLine(m) {
    const p = m.ball && m.ball.owner, team = p ? p.team : (m.score.blue >= m.score.red ? 'red' : 'blue');
    const bank = Math.random() < 0.3 ? this.banks.chaos : this.banks.flow;
    return this.pick(bank).replaceAll('{team}', this.team(team)).replaceAll('{player}', this.name(p));
  },
  pause() {
    if (this.paused) return;
    this.paused = true; this.voiceToken++; this.speaking = false; this.voiceQueue.length = 0;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.hide();
  },
  resume() { this.paused = false; this.nextVoiceAt = Date.now() + 350; this.idle = 0; },
  stop() { this.pause(); this.m = null; },
  reset(m) {
    this.m = m; this.cd = 0; this.idle = 0; this.passChain = 0; this.passTeam = null; this.lastOwner = m.ball && m.ball.owner;
    this.lastShot = !!(m.ball && m.ball.shot); this.score = { ...m.score }; this.kickCount = 0; this.penKicks = { blue: 0, red: 0 }; this.serial++;
    for (const k of ['saves','tackles','skills']) this[k] = { blue: (m.stats.blue[k] || 0), red: (m.stats.red[k] || 0) };
    this.say(this.pick(this.banks.kickoff), 1, false);
  },
  hide() { const el = typeof $ === 'function' ? $('commentary') : null; if (el) el.classList.remove('show','big'); },
  speakVoice(item) {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (!this.voice) this.refreshVoices();
    const spoken = item.text.replace(/GOOOOOOOAL/g, 'Gooooal').replace(/—/g, ', ');
    const u = new SpeechSynthesisUtterance(spoken), token = ++this.voiceToken;
    u.voice = this.voice; u.lang = (this.voice && this.voice.lang) || 'en-GB';
    const baseRate = item.priority >= 3 ? 1.15 : item.priority === 2 ? 1.22 : 1.28;
    u.rate = baseRate + (Math.random() - 0.5) * 0.07;
    u.pitch = (item.priority >= 3 ? 0.92 : 0.96) + (Math.random() - 0.5) * 0.035;
    u.volume = Math.min(1, 0.58 + (Save.data.settings.sfx || 0) * 0.42);
    this.speaking = true;
    const finished = () => {
      if (token !== this.voiceToken) return;
      this.speaking = false;
      if (this.voiceQueue.length) { this.speakVoice(this.voiceQueue.shift()); return; }
      const rareBreath = Math.random() < 0.22;
      this.nextVoiceAt = Date.now() + (rareBreath ? 1400 + Math.random() * 1600 : 100 + Math.random() * 360);
    };
    u.onend = finished; u.onerror = finished; synth.speak(u);
  },
  say(text, priority = 1, voice = true) {
    if (!text || Save.data.settings.commentary === false) return;
    const el = $('commentary'), line = $('commentary-line'); if (!el || !line) return;
    line.textContent = text; el.classList.toggle('big', priority >= 3); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.hideTimer); this.hideTimer = setTimeout(() => el.classList.remove('show','big'), priority >= 3 ? 4200 : 2600);
    this.cd = priority >= 3 ? 2.2 : priority === 2 ? 1.15 : 0.62; this.idle = 0;
    if (!voice || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
    const item = { text, priority }, synth = window.speechSynthesis;
    if (priority >= 2) {
      this.voiceToken++; this.speaking = false; synth.cancel(); this.speakVoice(item); return;
    }
    if (synth.speaking || synth.pending || this.speaking) { this.voiceQueue.push(item); return; }
    this.speakVoice(item);
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
    if (!m || !m.ball) return; if (this.paused) this.resume(); if (this.m !== m) this.reset(m);
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
    const synth=window.speechSynthesis;
    if(m.phase==='play' && this.idle>1.25 && Date.now()>=this.nextVoiceAt && !this.speaking && !(synth && (synth.speaking||synth.pending))) this.say(this.flowLine(m),1,true);
  },
};