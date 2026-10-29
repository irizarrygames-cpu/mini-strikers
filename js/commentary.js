// Live match commentary: a caption for every important moment. Text only — nothing is ever
// spoken out loud. Lines are assembled from contextual banks, so matches do not sound
// scripted and pass moves build from "one" into a full dramatic sequence.
const Commentary = {
  m: null, cd: 0, idle: 0, lastMinorAt: 0, passChain: 0, passTeam: null, lastOwner: null, lastShot: false,
  score: { blue: 0, red: 0 }, saves: { blue: 0, red: 0 }, tackles: { blue: 0, red: 0 }, skills: { blue: 0, red: 0 },
  kickCount: 0, recent: [], usedLines: new Set(), serial: 0, nextLineAt: 0, paused: false, captionToken: 0,
  banks: {
    kickoff: [tl('And we are UNDERWAY!'), tl('The whistle goes—let the chaos begin!'), tl('Here we go! Two minutes of tiny-football madness!'), tl('Strap in. This could get ridiculous.')],
    shot: [tl('HE HITS IT!'), tl('SHOT ON!'), tl('That has been absolutely launched!'), tl('He has put his entire postcode through that!'), tl('From there?! Audacious!'), tl('The net is looking nervous!'), tl('Someone check the ball—it has been THUMPED!'), tl('HE HAS HIT THAT LIKE IT INSULTED HIS FAMILY!'), tl('The keeper has seen it coming and immediately started negotiating!'), tl('That shot had absolutely no chill!'), tl('He shoots from a different postal code!')],
    power: [tl('POWER SHOT! EVERYBODY DUCK!'), tl('That ball has family plans and it is leaving early!'), tl('THUNDERBOLT INCOMING!'), tl('He has tried to remove the net from the stadium!'), tl('THE BALL HAS ACHIEVED ESCAPE VELOCITY!'), tl('Someone alert air traffic control!'), tl('He pressed shoot and accidentally launched a satellite!'), tl('That ball is travelling through time!')],
    save: [tl('WHAT A SAVE!'), tl('DENIED! The keeper says absolutely not!'), tl('A magnificent stop!'), tl('The gloves have entered the conversation!'), tl('Saved! That keeper has springs in the boots!'), tl('How has that stayed out?!'), tl('CALL THE AUTHORITIES! THAT SAVE IS ABSURD!'), tl('The keeper has just committed daylight robbery!'), tl('That was heading in until the goalkeeper cancelled the appointment!'), tl('Hands like frying pans! Nothing gets through!')],
    tackle: [tl('CRUNCHING TACKLE—but perfectly clean!'), tl('Pocket picked! Check for missing valuables!'), tl('He read that like tomorrow’s newspaper!'), tl('Ball won. Dignity possibly not.'), tl('That tackle came with a receipt!'), tl('No invitation needed—he just took the ball!'), tl('That tackle rearranged the furniture!'), tl('He took the ball, the space, and possibly the defender’s lunch!'), tl('Clean as a whistle and twice as loud!'), tl('The defender arrived like an unexpected tax bill!')],
    skill: [tl('Oh, that is FILTHY!'), tl('Sent the defender for snacks!'), tl('Ankles have officially left the building!'), tl('That move needs a warning label!'), tl('He has turned the pitch into a dance floor!'), tl('Somebody find that defender a map!'), tl('The defender has been sent into another dimension!'), tl('Oh dear! That defender is buffering!'), tl('He twisted him into a pretzel!'), tl('That skill move should require a license!'), tl('The defender has left the chat!')],
    turnover: [tl('Possession stolen—danger!'), tl('They have coughed it up!'), tl('A gift, wrapped and delivered!'), tl('The ball changes hands and suddenly it is panic stations!'), tl('They gave the ball away like it was a suspicious package!'), tl('Possession donated to charity!'), tl('That pass was addressed to absolutely nobody!'), tl('A catastrophic oopsie in midfield!')],
    miss: [tl('WIDE! The corner flag felt that one!'), tl('That shot needs directions!'), tl('Into row Z—someone keep the souvenir!'), tl('The goal was over there, my friend!'), tl('Close… if the target was the advertising board!'), tl('The keeper can unpack the sandwiches; no save required.'), tl('That shot is now applying for citizenship in another country!'), tl('The corner flag was in more danger than the goal!'), tl('That effort needs a sat-nav and a sincere apology!'), tl('Somewhere, a window is about to have a very bad afternoon!'), tl('He aimed for glory and found the parking lot!')],
    quiet: [tl('A tense little spell here.'), tl('Both teams plotting. Neither team sharing the plan.'), tl('The crowd senses something coming.'), tl('This match is simmering nicely.'), tl('One pass could open the whole thing up.'), tl('Everyone is running. Some even know where.')],
    flow: [tl('{team} have the ball and they are looking for an opening.'), tl('{player} takes possession. What can they create here?'), tl('{team} move forward with real purpose.'), tl('The pressure is building. {team} are asking questions now.'), tl('{player} slows it down, looks up, and picks the next move.'), tl('{team} keep it moving. The defenders are being pulled everywhere.'), tl('Plenty of space ahead of {player}. This could become dangerous.'), tl('{team} recycle possession and start again.'), tl('{player} carries it into midfield with options left and right.'), tl('Listen to the crowd. They sense a chance for {team}.'), tl('{team} are trying to turn possession into something spectacular.'), tl('{player} is dictating the tempo right now.'), tl('A patient spell from {team}, but one sharp pass could change everything.'), tl('{team} come again. The opposition cannot switch off for a second.'), tl('{player} wants the ball, gets the ball, and drives the play forward.'), tl('End-to-end football here. Nobody is interested in slowing down.'), tl('The shape is opening up, and {team} are ready to attack it.'), tl('{player} checks over the shoulder. There is room to work with.'), tl('Good control from {player}; now the next pass has to be right.'), tl('{team} are camped in the attacking half and looking hungry.')],
    chaos: [tl('I have no idea what is happening anymore, but I absolutely love it!'), tl('This match needs seatbelts!'), tl('My notes are useless. The football has become pure chaos!'), tl('Somebody check on the tactical board. It just burst into flames!'), tl('I was promised a football match, not an action movie!'), tl('The ball is moving faster than my ability to form sentences!'), tl('This is less of a match and more of a very polite riot!'), tl('I need a replay, a calculator, and a lie down!'), tl('Both managers have thrown the game plan directly into the bin!'), tl('There are players everywhere! This pitch has become a pinball machine!'), tl('I blinked once and missed three tactical revolutions!'), tl('The crowd is roaring, the players are flying, and my tea is now on the floor!'), tl('This game has the emotional stability of a shopping cart with one bad wheel!'), tl('Nobody knows what comes next. Especially the defenders!'), tl('The tactics are gone. We are operating entirely on vibes now!'), tl('I have seen calmer scenes at a squirrel convention!'), tl('This is football served with extra chaos and absolutely no receipt!'), tl('The match has gone completely bananas, and the bananas are winning!'), tl('If this gets any wilder, the referee will need a parachute!'), tl('My voice may not survive this match, but what a way to go!'), tl('The laws of football are currently hiding behind the sofa!'), tl('Someone tell the players this is not a speed-running competition!'), tl('This match is bouncing around like popcorn in a washing machine!'), tl('I cannot keep up! Even the scoreboard looks nervous!')],
    joke: [tl('{loser} are defending like the ball owes them money.'), tl('{loser} have brought traffic cones to a football match.'), tl('{winner} are cooking; {loser} forgot the recipe.'), tl('{loser} need a timeout, a whiteboard, and possibly a compass.'), tl('{winner} are moving the ball like it is remote-controlled.'), tl('The {loser} defense is socially distancing from the ball.'), tl('{loser} are marking imaginary players with incredible dedication.'), tl('{loser} have lost the plot, the sequel, and the director’s commentary.'), tl('{winner} are serving five-star football; {loser} brought a packed lunch.'), tl('The {loser} defense has more holes than a block of cheese.'), tl('{loser} look like their controllers have disconnected.'), tl('{winner} are playing chess while {loser} are eating the pieces.'), tl('{loser} are chasing shadows, and the shadows are winning.'), tl('{loser} have parked the bus, but somebody forgot to bring the bus.'), tl('{winner} are putting on a masterclass; {loser} are still looking for the classroom.'), tl('{loser} are defending with the confidence of penguins on roller skates.'), tl('{winner} have turned this match into their personal highlight reel.'), tl('{loser} need a new plan, because the current plan has requested a transfer.'), tl('The {loser} back line is held together with hope and imaginary tape.'), tl('{winner} are passing so smoothly the ball should be paying rent.'), tl('{loser} are one more mistake away from asking the referee for directions.'), tl('The {loser} defense just opened the door, held it politely, and waved them through.'), tl('{winner} are playing football; {loser} appear to be assembling furniture without instructions.'), tl('{loser} have been spun around so often they now qualify as a washing machine.'), tl('{winner} are cooking at maximum heat and {loser} have become the smoke alarm.'), tl('The tactical plan from {loser} appears to be: panic, but enthusiastically.'), tl('{loser} are giving away space like free samples at the supermarket.'), tl('{winner} are moving like a sports car; {loser} are stuck looking for the keys.'), tl('The {loser} midfield has vanished. Please check under the sofa.'), tl('{loser} are having the kind of day that requires turning the console off and on again.')],
    goal: [tl('GOOOOOOOAL!'), tl('OH MY WORD! WHAT A GOAL!'), tl('THE NET HAS EXPLODED!'), tl('ABSOLUTE SCENES!'), tl('YOU CANNOT WRITE THIS!'), tl('BEDLAM IN THE STANDS!'), tl('That is outrageous! Simply OUTRAGEOUS!'), tl('Stop it! That is football from another planet!'), tl('GOAL! THE STADIUM HAS COMPLETELY LOST ITS MIND!'), tl('SOMEBODY HOLD ME! THAT IS ABSOLUTELY RIDICULOUS!'), tl('WHAT HAVE WE JUST WITNESSED?! FRAME IT AND PUT IT IN A MUSEUM!'), tl('THE CROWD ERUPTS! I CAN BARELY HEAR MYSELF THINK!'), tl('That is not a goal. That is a public service announcement!'), tl('Football has peaked! Everybody can go home now!')],
    comeback: [tl('THE COMEBACK IS COMPLETE!'), tl('FROM THE DEAD—THEY HAVE TURNED IT AROUND!'), tl('They were buried, and now they lead! Incredible!'), tl('THEY HAVE RISEN FROM THE FOOTBALL GRAVE!'), tl('Plot twist! The comeback nobody saw coming!'), tl('They looked finished. Apparently nobody told them!')],
    equalizer: [tl('EQUALIZER! We are level and nobody can breathe!'), tl('ALL SQUARE! Throw the script away!'), tl('They have dragged it back! What a game!'), tl('LEVEL AGAIN! THIS MATCH HAS COMPLETELY LOST CONTROL!'), tl('Back from the brink! The scriptwriter deserves a raise!'), tl('Nobody blink! This game is officially bananas!')],
    late: [tl('AT THE DEATH! UNBELIEVABLE!'), tl('LAST-GASP DRAMA!'), tl('There is no time left—except time for THAT!'), tl('RIGHT AT THE BUZZER! ABSOLUTE CINEMA!'), tl('They have stolen it with the final breath of the match!'), tl('That is heartbreak on one side and total mayhem on the other!')],
    own: [tl('OH NO! OWN GOAL! Look away now!'), tl('Wrong net! That is a defender’s nightmare!'), tl('Disaster at the back—they have scored for the other team!'), tl('Oh no! That is going straight into the blooper reel!'), tl('The striker did not even need to help!'), tl('A beautiful finish, unfortunately in completely the wrong goal!')],
    penaltyGoal: [tl('BURIES IT!'), tl('Sends the keeper the wrong way!'), tl('Ice in the veins!'), tl('Top bins! No chance!'), tl('Cooler than the other side of the pillow!'), tl('The keeper guessed correctly and still needed a taxi!'), tl('That penalty was delivered with ice-cold confidence!')],
    penaltySave: [tl('SAVED! HEROIC GOALKEEPING!'), tl('The keeper guesses right!'), tl('DENIED FROM THE SPOT!'), tl('Huge hands, huge moment!'), tl('THE KEEPER IS A WALL WITH GLOVES!'), tl('Read like an open book and slammed shut!'), tl('The goalkeeper has just become the main character!')],
  },
  pick(lines) {
    if (!lines || !lines.length) return '';
    const isJoke = lines === this.banks.joke;
    if (isJoke) {
      const seen = Save.data.commentaryJokes || (Save.data.commentaryJokes = []);
      const unseen = lines.filter((x) => !seen.includes(x));
      if (!unseen.length) return this.pick(this.banks.chaos);
      const joke = unseen[Math.floor(Math.random() * unseen.length)];
      seen.push(joke); Save.write(); this.usedLines.add(joke); this.recent.push(joke); return joke;
    }
    let pool = lines.filter((x) => !this.usedLines.has(x));
    if (!pool.length) { lines.forEach((x) => this.usedLines.delete(x)); pool = lines.filter((x) => !this.recent.includes(x)); }
    if (!pool.length) pool = lines;
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.usedLines.add(line); this.recent.push(line); if (this.recent.length > 12) this.recent.shift(); return line;
  },
  name(p) { return p ? (p.isHuman ? tl('YOU') : p.name || tl('{0} NUMBER {1}', [TEAMS[p.team].name, p.number])) : tl('THE PLAYER'); },
  team(t) { return (TEAMS[t] && TEAMS[t].name) || String(t || '').toUpperCase(); },
  init() {},
  unlock() {},
  flowLine(m) {
    const p = m.ball && m.ball.owner, team = p ? p.team : (m.score.blue >= m.score.red ? 'red' : 'blue');
    const bank = Math.random() < 0.3 ? this.banks.chaos : this.banks.flow;
    return this.pick(bank).replaceAll('{team}', this.team(team)).replaceAll('{player}', this.name(p));
  },
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.hide();
  },
  resume() { this.paused = false; this.nextLineAt = Date.now() + 350; this.idle = 0; },
  stop() { this.pause(); this.m = null; },
  reset(m) {
    this.m = m; this.cd = 0; this.idle = 0; this.passChain = 0; this.passTeam = null; this.lastOwner = m.ball && m.ball.owner;
    this.lastShot = !!(m.ball && m.ball.shot); this.score = { ...m.score }; this.kickCount = 0; this.penKicks = { blue: 0, red: 0 }; this.serial++;
    for (const k of ['saves','tackles','skills']) this[k] = { blue: (m.stats.blue[k] || 0), red: (m.stats.red[k] || 0) };
    this._quiet = !!m.pens;
    if (m.pens) this.hide(); // the shootout speaks for itself: clear anything still on screen
    else this.say(this.pick(this.banks.kickoff), 1, false);
  },
  hide() {
    // taking the caption away kills the typer, so let go of the line it was typing too — else
    // every small line after this is held back for a caption that will never finish
    clearInterval(this.typeTimer); clearTimeout(this.hideTimer); this.captionToken++; this.typing = null;
    const el = typeof $ === 'function' ? $('commentary') : null; if (el) el.classList.remove('show','big');
  },
  showCaption(text, priority, typed = true) {
    const el = $('commentary'), line = $('commentary-line'); if (!el || !line) return 0;
    this.typing = typed ? text : null;
    clearInterval(this.typeTimer); clearTimeout(this.hideTimer);
    const token = ++this.captionToken;
    if (typeof UI !== 'undefined' && UI.placeCommentary) UI.placeCommentary(); // along the bottom if there is room
    el.classList.toggle('big', priority >= 3); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    if (!typed) line.textContent = text;
    else {
      let i = 0; line.textContent = '';
      this.typeTimer = setInterval(() => {
        if (token !== this.captionToken) return clearInterval(this.typeTimer);
        i = Math.min(text.length, i + 1); line.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(this.typeTimer); this.typing = null; }
      }, 28);
    }
    const visibleMs = Math.max(priority >= 3 ? 4200 : 2600, text.length * 28 + 1100);
    this.hideTimer = setTimeout(() => { if (token === this.captionToken) el.classList.remove('show','big'); }, visibleMs);
    return token;
  },
  // gate: hold the small talk back if something was just said (big calls always show)
  say(text, priority = 1, gate = true) {
    if (!text || Save.data.settings.commentary === false) return;
    if (gate && priority === 1) {
      if (Date.now() - this.lastMinorAt < 5000) return;
      this.lastMinorAt = Date.now();
    }
    if (priority === 1 && this.typing) return; // never chop a line that is still being typed
    this.cd = priority >= 3 ? 2.2 : priority === 2 ? 1.15 : 0.62;
    this.idle = 0;
    this.showCaption(text, priority, true);
    this.nextLineAt = Date.now() + (priority >= 3 ? 2400 : 1500) + Math.random() * 900;
  },

  passLine(team, p) {
    const n = this.passChain, who = this.name(p);
    if (n === 1) return tl('{0}. PASS ONE.', [who]);
    if (n === 2) return tl('PASS TWO—THE MOVE IS BUILDING!');
    if (n === 3) return tl('PASS THREE! OH, THIS IS LOVELY!');
    if (n === 4) return tl('FOUR PASSES! THEY ARE PLAYING KEEP-AWAY!');
    if (n === 5) return tl('FIVE! THIS IS FOOTBALL WITH A CHEAT CODE!');
    const open = this.pick([tl('ONE TOUCH!'), tl('TIKI-TAKA!'), tl('ROUND AND ROUND THEY GO!'), tl('THE BALL IS ON A STRING!')]);
    const finish = this.pick([tl('The opposition cannot get near it!'), tl('This is dizzying!'), tl('{0} are putting on a clinic!', [this.team(team)]), tl('Somebody stop them!')]);
    return tl('{0} {1} PASSES! {2}', [open, n, finish]);
  },
  goal(m, team) {
    const g = m.goals && m.goals[m.goals.length - 1], other = team === 'blue' ? 'red' : 'blue';
    let call = g && g.own ? this.pick(this.banks.own) : this.pick(this.banks.goal);
    if (m.time < 12) call += ' ' + this.pick(this.banks.late);
    else if (m.score[team] === m.score[other]) call += ' ' + this.pick(this.banks.equalizer);
    else if (m.trailed && m.trailed[team] && m.score[team] > m.score[other]) call += ' ' + this.pick(this.banks.comeback);
    if (g && g.scorer) call += g.scorer.isHuman ? tl(' YOU HAVE DONE IT!') : tl(' {0} HAS DONE IT!', [this.name(g.scorer)]);
    if (g && g.assist) call += tl(' Brilliant work from {0} in the build-up!', [this.name(g.assist)]);
    if (g && g.scorer && g.scorer.stats.goals >= 3) call += tl(' HAT-TRICK HERO!');
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
    // the shootout's own GOAL! / SAVED! / YOUR KICK fill the goal: a bubble on top of them covered
    // the one thing you are looking at
    if (m.pens) { if (!this._quiet) { this._quiet = true; this.hide(); } return; }
    this._quiet = false;
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
    if(m.phase==='play' && this.idle>3 && Date.now()>=this.nextLineAt) this.say(this.flowLine(m),1,true);
  },
};