// Online shootout, the game's side (build 125) — not loaded by the game. In the browser, on the
// home screen (any tab, shown or not):
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/pens-client-scan.js'; s.onload = r; document.head.appendChild(s); });
//   await PCS.run()
//
// It plays the server: an online shootout is started and fed the messages the server sends
// (pen.turn, pen.runup, pen.kick, pen.result) at the moments it sends them, while SHOOT is pressed
// the way the keyboard presses it. What it checks is what was wrong before build 125: your player
// still celebrating the last goal while taking the next kick, standing frozen at the ball until the
// keeper chose, the keeper lying in last kick's dive; and that a dive shows from the moment it is made.
// The game runs on frames this scan makes itself, 1/60 s each (a hidden tab gets no frames of its
// own, and a throttled timer would make game time run slow), so the timings are exact.
window.PCS = {
  async run() {
    const out = { checks: [], fails: 0 };
    const check = (name, ok, detail) => { out.checks.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : '  ' + JSON.stringify(detail)}`); if (!ok) out.fails++; };
    // the game's own loop, on frames made here
    // (a real frame that comes meanwhile, in a shown tab, ends the game's own chain of frames: it is
    // started again at the end, but only then, or a hidden tab would have two chains when shown)
    const realRaf = window.requestAnimationFrame;
    let ours = false, chainEnded = false;
    window.requestAnimationFrame = () => { if (!ours) chainEnded = true; return 0; };
    let ts = performance.now();
    const sleep = async (ms) => { ours = true; try { for (let i = 0; i < Math.round(ms / 16.667); i++) { ts += 16.667; Game.loop(ts); } } finally { ours = false; } };
    const deliver = (msg) => Net.handlers[msg.t](msg);
    const sent = [], realSend = Net.send;
    Net.send = (o) => { sent.push(o); return true; };
    const press = async (ms) => { Input._keyHold.shoot = true; Input._syncHold('shoot'); await sleep(ms); Input._keyHold.shoot = false; Input._syncHold('shoot'); };
    const turn = (team, n, kicks, score) => ({ t: 'pen.turn', team, n, deadline: Date.now() + 10000, in: 10000, score, kicks, wall: null });
    try {
      Online.startPens({ t: 'pen.start', room: 999, code: null, format: 'pens', kind: 'pens', side: 'blue', clubs: { blue: 'spain', red: 'brazil' }, wc: null, startsIn: 0,
        players: [{ team: 'blue', name: 'YOU', character: 'street' }, { team: 'red', name: 'THEM', character: 'street' }], state: null, opponent: 'THEM' });
      const m = Game.match, P = m.pens;
      check('an online shootout is on', !!m && m.net && P.net && Online.status === 'match');

      // ---- 1. your kick: scored, so your player celebrates
      deliver(turn('blue', 0, { blue: [], red: [] }, { blue: 0, red: 0 }));
      await sleep(800);
      check('your turn: aiming', P.phase === 'aim', P.phase);
      await press(400);
      await sleep(40);
      const shot = sent.filter((x) => x.t === 'pen.shot').pop();
      check('let go: the shot goes to the server', !!shot && shot.power > 0.3, shot);
      check('and your run-up starts at once', P.phase === 'strike', P.phase);
      const k1 = PEN.kick(shot.ax, shot.az, shot.power, 0.65);
      await sleep(120);
      deliver({ t: 'pen.runup', team: 'blue', n: 0, ms: 300 });
      deliver({ t: 'pen.kick', team: 'blue', n: 0, shot: k1, dive: null });
      check('the strike came before your run-up finished: you finish it first', P.phase === 'strike', P.phase);
      await sleep(260);
      check('then the ball goes', P.phase === 'flight' && P.you.kickT > 0, { phase: P.phase });
      deliver({ t: 'pen.result', team: 'blue', n: 1, shot: k1, dive: { dx: -1, dz: 0.2, td: 0.15 }, result: 'goal', scored: true, score: { blue: 1, red: 0 }, kicks: { blue: [true], red: [] }, winner: null, next: 'red' });
      check('their keeper\'s dive (made in the air) shows on your screen', !!P.dive && P.dive.dx === -1 && P.dive.v === PEN.PLAYER_DIVE);
      await sleep(PEN.flightT(k1) * 1000 + 150);
      check('when the ball gets there, the goal', P.phase === 'after' && P.result === 'goal' && m.score.blue === 1, { phase: P.phase, result: P.result });
      check('you celebrate', P.you.celebrateT > 0);
      await sleep(900);
      const mid = P.you.celebrateT;
      check('and the celebration runs down (it used to stay on for good online)', mid < CELE_TIME - 0.8, mid);

      // ---- 2. their kick: you dive early and save it
      deliver(turn('red', 1, { blue: [true], red: [] }, { blue: 1, red: 0 }));
      check('their turn: nobody still in last kick\'s dive', P.keeper.red.diveT === 0 && P.keeper.blue.diveT === 0 && !P.dive);
      await sleep(800);
      check('in goal while they line it up: their taker waits behind the ball', P.phase === 'idle' && P.them.run === 0, { phase: P.phase, run: P.them.run });
      const nDive = sent.length;
      await press(60);
      await sleep(40);
      const dv = sent.slice(nDive).find((x) => x.t === 'pen.dive');
      check('you dive early: it goes to the server, as before the kick', !!dv && dv.lt === -1, dv);
      check('and shows on your screen straight away', P.ownDive && P.diveClock > 0 && P.keeper.blue.diveT === 1, { clock: P.diveClock });
      deliver({ t: 'pen.runup', team: 'red', n: 1, ms: 900 });
      check('they run at it', P.phase === 'runup');
      await sleep(450);
      check('half way there', P.them.run > 0.3 && P.them.run < 0.8, P.them.run);
      const k2 = PEN.kick(0.7, 0.3, 0.6, 0.55);
      const clockBefore = P.diveClock;
      deliver({ t: 'pen.kick', team: 'red', n: 1, shot: k2, dive: { dx: dv.dx, dz: dv.dz, td: -0.9 } });
      check('struck: the ball flies', P.phase === 'flight');
      check('your dive carries on from where it was (not started again)', P.diveClock >= clockBefore && P.ownDive, { before: clockBefore, now: P.diveClock });
      deliver({ t: 'pen.result', team: 'red', n: 2, shot: k2, dive: { dx: dv.dx, dz: dv.dz, td: -0.9 }, result: 'save', scored: false, score: { blue: 1, red: 0 }, kicks: { blue: [true], red: [false] }, winner: null, next: 'blue' });
      await sleep(PEN.flightT(k2) * 1000 + 150);
      check('the save', P.phase === 'after' && P.result === 'save', { phase: P.phase, result: P.result });
      await sleep(400);

      // ---- 3. your next kick: you are not still celebrating, sulking or mid-kick
      deliver(turn('blue', 2, { blue: [true], red: [false] }, { blue: 1, red: 0 }));
      check('your next kick: not celebrating any more', P.you.celebrateT === 0 && !P.you.celebKind, { celebrateT: P.you.celebrateT });
      check('not mid-kick, not sad, facing the goal', P.you.kickT === 0 && !P.you.sad && P.you.fy === -1);
      check('the keepers are back on their line', P.keeper.red.diveT === 0 && P.keeper.blue.diveT === 0 && P.keeper.blue.celebrateT === 0);
      await sleep(800);
      check('aiming again', P.phase === 'aim', P.phase);
      // the clock runs out before you let go: the server takes it for you
      const nShot = sent.length;
      deliver({ t: 'pen.runup', team: 'blue', n: 2, ms: 300 });
      check('the clock ran out: into your run-up, nothing sent twice', P.phase === 'strike' && P.netSent, P.phase);
      await sleep(320);
      check('at the ball, waiting for the strike (a moment, not for the keeper)', P.phase === 'strike' && P.you.run === 1);
      const k3 = PEN.kick(0, 0.42, 0.58, 0.65);
      deliver({ t: 'pen.kick', team: 'blue', n: 2, shot: k3, dive: null });
      check('struck the moment it comes', P.phase === 'flight');
      await press(60);
      check('pressing SHOOT now sends nothing', !sent.slice(nShot).some((x) => x.t === 'pen.shot'));

      // ---- 4. the result for a kick this screen never saw start (back after a dropped connection)
      deliver({ t: 'pen.result', team: 'blue', n: 3, shot: k3, dive: null, result: 'goal', scored: true, score: { blue: 2, red: 0 }, kicks: { blue: [true, true], red: [false] }, winner: null, next: 'red' });
      await sleep(PEN.flightT(k3) * 1000 + 150);
      check('it lands', P.phase === 'after' && m.score.blue === 2, { phase: P.phase, score: m.score });
      deliver(turn('red', 3, { blue: [true, true], red: [false] }, { blue: 2, red: 0 }));
      await sleep(100);
      const k4 = PEN.kick(-0.6, 0.6, 0.7, 0.55);
      deliver({ t: 'pen.result', team: 'red', n: 4, shot: k4, dive: { dx: 1, dz: 0, td: 0.2 }, result: 'goal', scored: true, score: { blue: 2, red: 1 }, kicks: { blue: [true, true], red: [false, true] }, winner: null, next: 'blue' });
      check('a result with no strike seen: played from the strike', P.phase === 'flight' && P.shot === k4 && !!P.dive, P.phase);
      await sleep(PEN.flightT(k4) * 1000 + 150);
      check('and it lands', P.phase === 'after' && m.score.red === 1, { phase: P.phase, score: m.score });
      Online.abandon();

      // ---- 5. arriving part-way through a kick (no turn seen): whose kick it is comes from the server
      Online.startPens({ t: 'pen.start', room: 998, code: null, format: 'pens', kind: 'pens', side: 'blue', clubs: { blue: 'spain', red: 'brazil' }, wc: null, startsIn: 0,
        players: [{ team: 'blue', name: 'YOU', character: 'street' }, { team: 'red', name: 'THEM', character: 'street' }], state: { phase: 'runup', n: 0, team: 'red', kicks: { blue: [], red: [] }, score: { blue: 0, red: 0 } }, opponent: 'THEM' });
      const m2 = Game.match, P2 = m2.pens;
      P2.them = null;   // as if this screen had never made their taker
      deliver({ t: 'pen.kick', team: 'red', n: 0, shot: k4, dive: null });
      check('arriving as they strike it: their kick, their taker, the ball flying', P2.team === 'red' && !!P2.them && P2.phase === 'flight' && P2.them.kickT > 0, { team: P2.team, phase: P2.phase });
      deliver({ t: 'pen.result', team: 'red', n: 1, shot: k4, dive: null, result: 'goal', scored: true, score: { blue: 0, red: 1 }, kicks: { blue: [], red: [true] }, winner: null, next: 'blue' });
      await sleep(PEN.flightT(k4) * 1000 + 150);
      check('and it lands', P2.phase === 'after' && m2.score.red === 1, { phase: P2.phase, score: m2.score });
    } catch (e) {
      check('no error', false, String(e && e.stack || e));
    } finally {
      Net.send = realSend;
      Input._keyHold.shoot = false; Input._syncHold('shoot');
      Online.abandon();
      window.requestAnimationFrame = realRaf;
      Game.last = performance.now();
      if (chainEnded) requestAnimationFrame((t) => Game.loop(t));
    }
    return out;
  },
};
