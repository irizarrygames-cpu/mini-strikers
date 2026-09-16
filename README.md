# Mini Strikers

Arcade soccer for phones and computers. Pick one of the top 20 countries when you sign
up, play the bots (quick match, the cup, training) or play real people online. Every
online win is 3 league points for your country.

## Running it

Needs Node. No install step.

```bash
node server.js 8450
```

Then open <http://localhost:8450>. `server.js` serves the game **and** runs accounts,
progress saving, the league table and online matches. The old static `serve.py` can't
run any of that.

## Playing online

- **PLAY ONLINE** puts you in a queue for the chosen format (1v1–4v4). It waits about
  12 seconds for real players, then fills the empty spots with bots.
- **CREATE ROOM** makes a 5-letter code. Friends type it into **JOIN**, pick a side,
  and the host presses **START**. Empty spots get bots.
- The server runs every online match (the real game engine, 120 steps a second) and
  streams it to the players over a WebSocket. Your own player is predicted on your
  device so the controls answer instantly.
- Walking out of a match counts as a loss. If your connection drops you have 20
  seconds to come back (just reopen the game) before a bot takes your place.

Friends on the same Wi-Fi can use `http://YOUR-PC-IP:8450` (not `localhost`). Anyone
further away needs it hosted, below.

## Putting it online

`render.yaml` is a Render blueprint, so **New > Blueprint** in the Render dashboard, pick
this repo, and the service builds itself (free plan, `npm install`, `node server.js`,
health check on `/api/health`). Any other Node host that supports WebSockets works too —
the server reads `PORT`.

One thing has to be typed in by hand: **`DATABASE_URL`**, a Postgres connection string
(Neon's free plan works). It is deliberately not in the repo. Without it accounts go in
`data.json`, which a free instance wipes whenever it restarts. The table
(`strikers_users`) is created on first boot, so it can share the same Neon database as
War Prize.

After a deploy, `/api/health` reports `build` (bump `BUILD` in `server.js` when you
deploy) and `storage` (`postgres` or `data.json`), so you can confirm from outside which
code and which store went live.

Two things to know about the free plan: the instance sleeps after ~15 minutes idle, so the
first visitor waits ~50s, and going to sleep drops any online match in progress.

## Installing it like an app

It is a PWA: `manifest.webmanifest`, real PNG icons (`node tools/make-icons.js` draws them,
no image library) and `sw.js`, a service worker that caches **nothing** on purpose — every
screen needs the server, and a stale cache is how players get stuck on an old version.

**GET THE APP** on the home screen does the install. Chrome, Edge and Android hand over a
`beforeinstallprompt` event, so that is one tap; Safari has no such API, so on an iPhone the
button shows the Share > Add to Home Screen steps instead. The button hides itself when the
game is already running installed, or when neither route is available.

## Tools

- `node tools/netscan.js 40` — fuzzed online matches on the server engine, invariant checks.
- In the browser console: `tools/bugscan.js` (`BS.sim()`, `BS.render()`, `await BS.ui()`),
  `tools/balance.js` (`HT.report()`), `tools/nettest.js` (`await NT.drive(10)` during an online match).
