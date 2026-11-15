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

## Selling coins (in-app purchases)

Coin packs are sold **only inside the store apps** (App Store, Google Play). The plain web game
never shows a shop. The five packs live in `js/products.js`; that one file is read by the game
(to draw the shop) and by the server (to decide what a verified purchase is worth), so a player
cannot change a pack's value.

How a purchase goes: the game asks a grown-up to pass a small number check, starts the store's
purchase sheet, and sends the store's record of the purchase to `POST /api/iap/redeem`. The server
asks Apple or Google whether it is real, paid, for this app and this pack, credits the coins once
(a store transaction can be cashed in once, by one account), writes the account to the database,
and only then does the game tell the store the purchase was delivered. Anything the server could
not confirm is never marked finished, so the store offers it again at the next launch. Buying needs
a signed-in account.

**Nothing is sold until the server is given the store credentials.** With none set, every purchase
is refused and the shop stays hidden. They are set as environment variables in the Render dashboard
(never put the values in the repo):

| Store | Variables |
| --- | --- |
| Apple | `APPLE_BUNDLE_ID`, `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (the `.p8` file's text; write newlines as `\n`) |
| Google | `GOOGLE_PACKAGE_NAME`, `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole key file, on one line) |

Create the five products in each store as **consumables** with exactly the ids in
`js/products.js` (`coins_pack_1` … `coins_pack_5`). The prices there are only a fallback: the
store's own price is what the player sees. Apple's key needs the App Store Connect "In-App
Purchase" role; Google's service account needs "View financial data" and "Manage orders" in Play
Console. Both stores hand out free test purchases (Apple sandbox, Google licence testers), and App
Review uses them, so they are accepted; set `IAP_REJECT_TEST=1` once the game is out to turn them away.

The app wrapper must include `cordova-plugin-purchase` (Capacitor: `capacitor-plugin-cdv-purchase`),
which provides `window.CdvPurchase`; `js/store.js` does the rest when it finds it.

To try the shop on a computer with no store at all: `IAP_TEST_MODE=1 node server.js` (only works when
the server is **not** using the real database, so it can never be on for the live game).
`node tools/iapscan.js` tests the whole thing against a fake Apple and a fake Google.

## Online lag: what it is made of, and how to measure it

Lag in an online match is three different things, and only some of them can be fixed in code.

1. **Distance.** Every action goes to the server and back. From Miami to the live server a ping takes
   about 125 ms (`node tools/wsping.js`), very steady. A server in the same part of the country would
   be about 40-50 ms. Nothing in the game can shorten this: the server has to move. A Render service's
   region is chosen when it is created (Oregon is the default) and cannot be changed afterwards, so it
   means creating the service again in the nearest region (Virginia or Ohio for players in the eastern
   US) with the same environment variables. To keep the address the apps use
   (`https://mini-strikers.onrender.com`), delete the old service first and give the new one the same name.
   Do this before the Android app goes to Google Play, because the address is built into the app.
   Run `node tools/wsping.js` again afterwards to see the difference.
   **Done 2026-10-23:** the service now runs in Virginia, made by hand in the dashboard (New > Web Service,
   region Virginia, `npm install`, `node server.js`, health check `/api/health`, the same `DATABASE_URL`). From
   Miami the round trip went from 120 ms (Oregon) to 69 ms (`wsping`, 40 of 40). The address did not change, so the
   website and the Android app are untouched. The Blueprint was disconnected first (a Blueprint recreates a deleted
   service in the region written in `render.yaml`, which has none, so Oregon): `render.yaml` still has no `region`,
   so do not create this service from it again without adding `region: virginia`.

## Starting up while the free server sleeps (build 97)

The free Render instance sleeps after ~15 idle minutes and takes up to a minute to wake. The game copes:

- The splash says LOADING until the game's files have arrived and a tap works (it used to say TAP TO
  START while a tap did nothing); a tap made while loading is remembered. If a file fails, it says so
  and the next tap reloads. The game starts on DOMContentLoaded, not `load`.
- After the tap the splash stays up saying what is going on until there is something to show. Every
  question to the server has a deadline (`Net.RESUME_WAIT`, per-knock timeouts in `Net.wake`). Someone
  who has played on the device before is let in from the copy kept there after ~5 s and comes online by
  itself when the server answers (`Net.watchForConnection`, poked when the game comes to the front or
  the socket opens). A new device gets the sign-in page at once, saying the server is waking and
  offering PLAY AS A GUEST, which needs no server at all (back in build 98).
- A new build never reloads the page in the middle of something (`UI.calm`, `Install.whenCalm`), and
  someone already past the splash carries straight on after the reload.
- Saves the server turns down (or that never arrive) are tried again with backoff, and leaving the page
  sends unsaved progress in a `keepalive` request (`Net.flushSave`).
- The service worker serves a page that came out of its copy with files from the same copy, and only
  fills gaps in it, so one page load never mixes two builds.

Test it in the Browser pane with `tools/startscan.js` (one scenario per fresh load; see its header).
What code cannot fix: the very first visit on a device while the server sleeps waits on Render's
"Application loading" page. Only a paid instance that does not sleep removes that.
2. **A connection that cannot keep up.** On a slow or choppy link (weak signal, shared Wi-Fi) the
   server used to keep sending 30 pictures a second into a queue that grew without limit, so the screen
   fell seconds behind and stayed there: a median 4.6 s behind after 25 s on a 14 KB/s link, still
   growing. Since build 93 the game tells the server what it has received and the server stops piling
   pictures up (`server/game.js`, "Flow control"): the same link is a median 0.1 s behind. `node tools/flowscan.js`
   tests it, and `tools/netproxy.js` + `tools/snapprobe.js` build and time a bad connection by hand.
3. **The server running out of CPU.** It does not: one match costs about 1% of a CPU core
   (`node tools/cpubench.js`), so the free plan's small slice holds several matches. What does grow
   with the number of accounts is the periodic check of every account for changes in `server.js`
   (`flushDB`): about 5 ms at 1,000 accounts and 53 ms at 10,000. It is worth making incremental before
   the game has thousands of players.

4. **Your own actions waiting for the server.** The game already moved you, passed, shot and used skills
   the instant you pressed, by running the server's own code on a scratch copy of you. Two things still waited a
   full round trip: the tackle itself (a median 172 ms from press to lunge on a 110 ms round trip, 284 ms on a
   200 ms one) and the sound of a pass, shot, skill or tackle (172-189 ms). Since build 94 the tackle is
   predicted the same way and those four sounds play on the press, with the server's copy of the sound dropped
   when it arrives so nothing sounds twice: 16 ms, one frame, for all of them
   (`node tools/slidescan.js`, which also checks that a tackle the server turns down stops cleanly and never
   makes you jump). What still takes a round trip is the other player: seeing what an opponent does, and the
   outcome of a tackle or a pickup the server has to decide. That part is the distance in (1).

The free plan also sleeps after 15 minutes without a visitor and takes up to a minute to wake. That is
not lag in a match but it is the first thing a new player feels. A paid instance stays awake.

## Safety, recovery and ranked (build 104)

- **Recovery codes.** Accounts have no email, so a forgotten password used to be the end of an account.
  Signing up now shows a code (`XXXX-XXXX-XXXX`) to write down; it is kept only scrambled, like the
  password. FORGOT IT? on the sign-in page takes the username, the code and a new password: the code is
  used up, a new one is shown, and every other device is signed out. Five wrong codes lock that account's
  codes for half an hour. Older accounts make one in Settings → RECOVERY CODE (it asks for the password).
- **Blocking.** Tap a name in Friends or on the leaderboard. A block takes them off your friends and
  requests both ways, stops requests either way, keeps their quick chat away from you (and yours from
  them), keeps you out of each other's rooms, and matchmaking never puts you in the same match.
- **Reports and bans, with no admins.** REPORT NAME on a player's card. Three different players (with
  accounts an hour old or more) reporting a name bans the account; a name the username filter turns down is
  banned on the first report, and the filter looks over every existing name each time the server starts
  (they show in the server log as `banned NAME (username)`). A banned account can't sign in or play online,
  drops off every list and board, and keeps its name so nobody can take it.
- **Ranked.** A loss costs 5 RP (walking out counts as a loss); points never go below 0.
- **The Android Back button** (app only, through Capacitor's App plugin) closes whatever is on top, pauses
  a match, and on the home screen asks before leaving the game.

Tests: `node tools/safetyscan.js` (recovery codes, reports, bans, against a real server) and
`node tools/blockscan.js` (blocking, against the real game code).

## Free kicks and left-handed controls (build 105)

- **Free kicks** (PLAY → FREE KICKS, offline against a country or online against a real player) are a
  penalty shootout with a wall: five each, then sudden death, 22 m out. Four of the defending side stand
  9.15 m from the ball across one side of the goal, and the keeper stands on the other. A shot to the
  covered side that is still lower than the wall when it gets there hits it (OFF THE WALL!). A soft shot
  loops higher (`PEN.fkArc`), so soft and high goes over; hard goes round. Sometimes the wall jumps
  (`wall.jump`), and a ball over the wall is seen late by the keeper (`FK.SCREEN`). The numbers live in
  `PEN.FK` (js/penalty.js) and again in `server/pens.js`, which runs the online ones (format `fk`, also
  in private rooms) and picks a new wall for every kick. Bots aim and dive knowing where the wall is.
- **Left-handed** (Settings → HANDED): the stick goes on the right and the buttons on the left.
  `UI.applyHands` reads where the stylesheet put each control at this screen size and mirrors it, so
  there is no second copy of every size's rules; the stick only wakes on the right half.

Test: `node tools/fkscan.js` (how often each kind of free kick goes in, offline and online agreeing,
3000 online shootouts finishing, and an online free-kick match on the real server).

## A smaller scoreboard, commentary along the bottom (build 106)

On phones and iPads the scoreboard, with the commentary hanging under it, covered the top middle of
the pitch. The scoreboard is now about two-thirds of its old size (`#scoreboard` at the end of
style.css), and so are the shootout's tally card (`dot` in `Pens.drawOverlay`) and the skill
challenge boards. The commentary goes along the bottom, in the gap between the stick and the
buttons: `UI.placeCommentary` measures that gap each time a line is shown (so it follows left-handed
controls, a replay's REPLAY / TAP TO SKIP words, and every screen size) and adds `.low`. Where the gap
is under 180px (an upright phone) or something sits across the middle of it (the key legend on a
small computer screen, the WATCHING bar) the caption stays under the scoreboard as before. Checked
with `BS.fitSweep` (touch and keyboard) at phone, iPad and computer sizes.

## The camera pulls back when you are far from the ball (build 107)

The camera used to lean towards the ball and never zoomed out, so running away from the ball took
your own player off the screen (over half the time once you were 300+ apart). Now `Render.updateCamera`
pulls back to keep you and the ball both on screen: the further apart, the wider the view, down to
`PULL.MIN` (55%), and it closes in again as you come back. `PULL.YOU` keeps you in from the edges and
further from the bottom (the stick and the buttons), `Render.youRoomX` measures where the controls
really are (a small phone's reach further in), and the ball is allowed nearer the edges
(`PULL.BALL`). Past what the zoom can show, the ball goes off the edge and you stay in view. Near a
touchline the stands stop the camera (`Render.arena`), so it picks the zoom that keeps you clear of
the controls. `Render.pullMin` keeps the view inside the pre-drawn stands; the home screen's demo match
is never zoomed. Upright phones barely zoom (the view is already as tall as the stands).

Test (browser): `tools/camscan.js`, `CS.run()` at a window size, or `CS.run(otherCamera)` to compare:
you and the ball at hundreds of distances apart all over the pitch. With the old camera you were off
the screen 47-70% of the time at every size; with this one, 0%.

## Two-minute matches, and controls that do what you pressed (build 108)

- **Every match is two minutes**, offline and online: `CFG.MATCH_MINUTES` (js/config.js) and
  `MATCH_MINUTES` (server/game.js). Settings no longer offers 2 / 3 / 4; an old save's choice is ignored.
- **SPRINT on a touch screen: tap it to keep sprinting** (`Input.sprintLock`), so the thumb is free for
  SHOOT and PASS (it used to be a hold, on the same thumb as them). Holding it is still the ordinary
  sprint; another tap, letting go of the stick, or a long hold ends the lock. Locked, the button stays
  pressed in with a yellow ring.
- **A press a moment early still counts.** PASS pressed while the ball is on its way to you goes as
  soon as it is yours (it used to do nothing; SHOOT already worked this way). SKILL pressed while your
  own side's pass is on its way does the skill when it arrives instead of slide-tackling at it
  (`passComing` in js/entities.js), and the button says SKILL, not TACKLE, while the pass comes.

Test: `node tools/controlscan.js` (on the real engine; it fails on the code before this build).

## Bonus coins, 200 more missions, stadium seasons, more to collect (build 121)

- **Bonus coins** (`Bonus` in js/meta.js): a win streak puts +25% on a match's own coins at 2 in a row, +50% at
  3 or 4, double at 5+; at the weekend (Friday to Sunday on the player's clock) every match pays double. Only
  the bigger of the two counts. It replaces the old +10 a win (up to +50). Shown as a flame and the streak on
  the home card, a DOUBLE COINS WEEKEND sticker on PLAY, a line on the VS card, the orange box at full time
  (one line, shrunk to fit: `#r-streak` is in `UI.FIT_WORDS`) and an ON FIRE ×N! shout. Measured on the
  match coin formula: weekdays +9..24% a match, weekends about +85%, a whole week about +45%.
- **Missions** (js/missions.js): 184 daily and 35 weekly (200 new). Each day is dealt from a fixed epoch
  (`MISSION_EPOCH`, Mon 5 Oct 2026) by taking the jobs that have waited longest, give or take a few days
  (`JITTER`), so everybody gets the same three: never two of a kind (`MISSION_GROUP`), at most one
  online-only (`MISSION_ONLINE`), and a daily one comes back after about 61 days (never under 54), a weekly one
  after about 34 weeks. The weekly one is never online-only (`w-online6` is retired, still readable). Jobs can
  be limited to a format, PRO MATCH, a club, your country, cups, HARD or online (`where`). A match is read once
  into a summary (`Missions.fromMatch` / `fromOnline`); crates, stat upgrades, emotes in a match and skill
  challenges count through `Missions.bump`. **Online matches now count** (before, only matches on the device
  and online shootouts did). Pay comes from how many average matches a job takes: daily 250..900 (mean 525,
  the old 14 averaged 519), weekly 9,500..15,000.
- **Stadium seasons** (`Seasons` and `seasonal()` in js/stadiums.js): Dec-Feb winter, Mar-May spring, Jun-Aug
  summer, Sep-Nov autumn, by the device's month, the same for every country. Grass, apron, tufts and sky are
  mixed toward the season; winter snows (rain turns to snow, snow drifts and roof snow via `st.snowy`, bobble
  hats), spring blows petals and puts flowers round the touchlines, summer has sun, butterflies (fireflies at
  night grounds) and sun hats, autumn blows leaves and drops them round the edge. Drawn by
  `Render.drawWeather` (`st.extra`, also over shootouts with `seasonOnly`). Looks only.
  `Seasons.force = 'winter'` shows one season (for checking).
- **More to collect**: 15 trails (new sparks `flake`, `leaf`, `note`, and `seasons`), 5 balls (new `stripes`,
  `tiles`, `flake`, `leaf`, `noPanels`), 5 celebrations (penguin, jumpingjacks, snowball, djscratch, skijump;
  new props `snowball`, `turntable`, `skis`), 5 skill moves inside the numbers of their grade, 3 emotes (157).
  All appended at the end of their lists, so the online index lists (`NET_TRAILS`, `NET_CELEBS`) keep their
  old numbers; an older app shows nothing for an id it does not know.

Tests: `missionscan` (new: the list, five years of dealing, counting real matches, a save, the bumps);
`emotescan` now expects 157. App 1.2.2 (code 23).

## Emotes, a daily emote shop, tougher bots offline (build 120)

- **154 emotes** (`js/emotes.js`): four everyone starts with (Thumbs Up, Ha Ha!, Boo Hoo, Grrr!) and 150 to
  collect — 50 common, 40 rare, 30 epic, 20 legendary, 10 mythic. Each is one of eight made-up characters (a
  football, a striker, a keeper, the ref, the coach, a fan, a goat, a golden ball), a face, something it holds
  or wears, an effect and a way of moving, all drawn in code in the game's flat style; legendary and mythic
  ones have rays behind them. `tools/emotesheet.js` draws them all big in the browser (`ES.page(0)`,
  `ES.check()`).
- **Crates** give them by grade like everything else (`CRATE_KINDS` has `emote`), but an emote counts half in a
  crate's draw (`EMOTE_CRATE_WEIGHT`): counted in full there were so many that they were half of what a Gold
  crate gave. Now about 37% of a Gold crate, 13% of a Cosmic, 9% of an Infinity; most of a Copper (the
  commons left are mostly emotes).
- **The daily emote shop**, at the top of CRATES: three a day, 1,000 coins each, picked for you (your account,
  or the device for a guest) from the ones you have not got, with each slot rolled on common 52 / rare 28 /
  epic 13 / legendary 5.5 / mythic 1.5. They change at midnight on your device; the CRATES button shows how
  many are new until you look. Bought or won, an emote goes straight into your match menu if it has room.
- **In a match**: CUSTOMIZE · EMOTES picks up to eight; they sit along the top of the quick chat menu and show
  in a bubble over your head (`Render.drawEmoteChat`). Online the server passes them on like a chat line
  (`{t:'emote', e}` -> `{t:'emote', p, e}`): only the game's own emote names, the same spam limit as lines
  (one per 1.2s, five in ten), never to someone who blocked you, and to friends watching. Bots use them too,
  a third of the time instead of a line, offline and online.
- **Offline bots a step harder** (`DIFFICULTY`): a scripted average player won 76% of NORMAL matches before
  and 63% after (87% -> 76% as a new player, 64% -> 50% at level 25); EASY 99% -> 96%, HARD 62% -> 52%.
  Online fill-ins are untouched.
- Fixed on the way: the quick chat menu ran 35px off a 320px phone held upright (now two columns, never past
  the edge); the live commentary sat on top of it; the profile's coin count spilled out of a narrow panel.

Tests: `emotescan` (new: the emotes, the shop and its odds, the menu, crates, the save's size, and the server
with fake sockets). App 1.2.1 (code 22).

## A 10 trillion coin gift (build 119)

`GIFTS` in server.js gives IRIZARRY and LILOTTER 10,000,000,000,000 coins each, delivered the next time
that account's game syncs (no new app needed: the server adds them). The highest a save may hold went from 2 billion to a quadrillion (`LIMITS.coins.max`) so it fits.
A gift can now carry `madeBefore`: only an account made before then gets it, so if the name were free,
whoever signed up with it later would not. `fmtCoins` shows trillions as T (10T, not 10000B).

## Season rewards seven times bigger (build 118)

Every ranked season reward is seven times what it was (`RANK_TIERS` in js/config.js): BRONZE 1,400,
SILVER 3,500, GOLD 8,400, PLATINUM 17,500, DIAMOND 35,000, LEGEND 70,000, MASTER 105,000, GRANDMASTER
140,000, CHAMPION 192,500, TITAN 262,500, IMMORTAL 350,000 coins. The server pays them (its sandbox reads
the same list), so every app gets the new amounts at the end of the season; the RANKED screen shows them
with commas. App 1.2.0 (code 21).

The RANKED screen on a narrow phone: the bigger amounts and the long rank names (GRANDMASTER,
GROSSMEISTER, NIEŚMIERTELNY) no longer hang out of their rows. A rank name too long to sit beside the
points takes the top line and the points go under it; `UI.fitWords` shrinks what still doesn't fit,
and now measures to the fraction of a pixel, so a word that only just fits is left alone.

## Your throw-ins, five more ranks, agreeing to the policy (build 117)

- **Who takes a throw-in or a corner in PRO MATCH**: offline, always you (your side's; the keeper still
  takes a goal kick, and PASS asks him for it). Online, one of the side's real players at random, never
  one who has dropped out (`p.away`, set while their connection is gone); a side of fill-ins, its nearest.
  If the one taking it leaves or drops out while it is set up, a bot takes it at once.
- **Five more ranks above LEGEND** (`RANK_TIERS`): MASTER 1,100 RP, GRANDMASTER 1,450, CHAMPION 1,850,
  TITAN 2,300 and IMMORTAL 2,800, paying 15,000 to 50,000 coins at the end of a season. Older apps don't
  know the new ones and show them as BRONZE until they update; the points and the payouts are the server's.
- **Signing up**: a box to tick, "I agree to the Privacy Policy", with the policy linked (inside the app the
  link is behind the grown-up check, which now shows over the sign-in page). Nothing new is stored.
- A full guide to the game was written for Noah (an artifact, outside this repository).

Tests: `rulesscan` (offline your side's throw-ins are always yours), `proscan` (online: a random real
player, never a fill-in, never one who has dropped out), `rankscan` (the new ranks). App 1.1.9 (code 20).

## PRO MATCH online, bots that put it out, 50 more clubs, challenge modes (build 116)

- **PRO MATCH online, just like ordinary matches.** PRO MATCH opens a choice: OFFLINE or ONLINE, and the
  format (2v2 to 4v4). Online it has queues of its own (`pro/2v2`, `pro/3v3`, `pro/4v4`, filled with
  fill-ins after the usual wait), parties, a PRO MATCH switch in private rooms (host, 2v2 and up), watching
  and rejoining. The server plays PRO rooms in a second sandbox that is always on the big pitch
  (`createSim({ pitch: 'pro' })`, `simOf(room)`): the world is one set of globals, so the two pitches can't
  share one. Snapshots carry phase `restart` and `rs` (kind, side, taker, spot, aim, time) and the thrower's
  pose (flag 32); your own restart's arrow follows your stick on your screen at once, and you can still run
  about (predicted) during one you are not taking. A game too old for the big pitch says nothing about it,
  so the server keeps it out of PRO queues, rooms, parties and watching (`canPro`, from the `pro` flag in
  the `arena` message), and fills its matches only with the first fifty clubs.
- **Bots put the ball out** (PRO MATCH only, `BOT_OUT` in js/ai.js): on the wing they run it over the
  touchline, in their own half under pressure they clear it into touch or behind, they go down the wings,
  and a keeper tips half his parries round the post for a corner (`KEEPER_TIP`; only when the ball is
  clearly in front of the line, so it can never go in). Bot matches went from 1.2 restarts to 6.7 a match
  (about 4 throw-ins, 2 corners, 1 goal kick), with the same goals: `node tools/outscan.js`.
- **As little lag as possible.** A PRO match costs the server what an ordinary one does (0.73% of a core
  against 0.67%) and sends the same snapshots; the stadium is drawn only where it is on screen
  (`Render.drawLayer`: 1.32 ms to 0.80 ms a frame on the big pitch, 0.64 to 0.58 on the normal one).
- **Your restart, on a phone**: the camera stays at full zoom and moves (out into the stands PRO MATCH
  draws round its pitch, `camOut`) so you are never under the scoreboard, the stick or the buttons.
- **Fifty more clubs** (the best in the world right now that were not in yet, from Brighton to Flamengo,
  Boca to Al Hilal). Real names and badges belong to the clubs, so like the first fifty they are the city,
  the nickname fans use, the colours and the symbol everyone knows. Six new badge symbols (a tree, a bat, a
  horse, a stag, a fish, a cross) and two new shirt patterns (a band across the chest, a sash).
- **Challenging a friend**: 1V1 opens a choice: a 1v1 match, penalties, free kicks, or a PRO MATCH (2v2,
  a fill-in each). Never a cup. The invite says which; REMATCH at the end challenges them to the same again.
- The private room fits a phone on its side (and an upright one) without scrolling.

Tests: `node tools/proscan.js` (PRO MATCH online on fake sockets), `node tools/challengescan.js` (now every
mode, older games, rematch), `node tools/outscan.js` (how often it goes out). App 1.1.8 (code 19).

## PRO MATCH: a bigger pitch with the real rules (build 115)

PLAY → PRO MATCH, in International and in Club Career. The same game on a pitch a quarter bigger
each way (3000 × 1750; the boxes, goals and centre circle grow with it), and the ball can go out:

- **over a touchline**: a THROW-IN to the side that did not touch it last. The thrower stands outside
  the line, ball over their head. Nobody scores straight from a throw-in (off a defender it counts).
- **over a goal line, wide of the posts**: a CORNER if the defenders touched it last, otherwise a
  GOAL KICK, which their keeper takes from inside the six-yard box.
- The nearest player takes it, so often you: aim with the stick (it never points back out of the
  pitch), PASS to play it (tap, or hold for a lofted one), SHOOT for a long one. At a corner SHOOT is
  a go at goal that curls in (about 1 in 8 go in; the keeper reads the rest). What to press stays on
  screen until you take it, and after 8 s it is taken for you. Bots take theirs within 1.5 s.
- When a teammate takes it, PASS asks for it, and you get it.
- The other side stands 190 back (and out of the box for a goal kick), the clock stops, and while it
  is yours the camera may go out into the stands so you are never under the buttons.
- 2v2 to 4v4 only: with 1v1 picked, PRO MATCH plays 2v2 (and says so).
- Offline only: online matches are always on the normal pitch. Leaving goes back to it, whichever way.

How: `PITCHES` and `Pitch.use()` in js/config.js swap the pitch (CFG, the goals, the walls, the painted
stadium); the rules are js/rules.js, hooked into Match.step (`m.rules`, phase `'restart'`).

Test: `node tools/rulesscan.js` (about 1,500 restarts and corner shots in bot matches and with a scripted you: the right
restart from the right spot every time, all taken, the other side back, the clock stopped, nothing
out of the arena, no throw-in goals, the 2v2 rule, the corner shot's rate). App 1.1.7 (code 18).

## The keeper's dive line in free kicks (build 114)

In goal, the blue line from the keeper shows the way you will dive whatever you aim with: the stick or
keys, or the mouse (it points from the keeper towards the mouse). Build 112 had drawn a circle where
the mouse was instead, which looked wrong. App 1.1.6 (code 17).

## Badges, names and a bug sweep (build 113)

- **Club names as obvious as the law allows** and **detailed badges** (js/crests.js, `Crests.badge`):
  each badge is a shape, a rim, the field split in the club's colours (stripes, hoops, halves, sash,
  the Bavarian diamonds, a top band…), the city round the ring or on a ribbon, sometimes a crown or
  stars on top, and a flat cartoon emblem (lion, eagle, wolf, bear and tree, bull, serpent, dragon,
  canary, cockerel on a ball, castle, ship, cannon, lily, trident, submarine, Vesuvius, hammers,
  shamrock, anchor, three crosses…). The club ids did not change, so careers carry on.
- A badge always gets a square canvas (the home pill stretched it 3:2).
- **Free kicks:** the keeper's dive line (and the mouse dive) start from where the keeper stands,
  off to one side, not the middle of the goal.
- **Weather moving at a steady speed:** birds, rain, snow, dust and the sparkles moved at
  time x speed x camera zoom, so every zoom change (the camera pulls back to keep you and the ball in)
  made them jump; they use the unzoomed scale (`Render.motionS`). The power-shot ring's dashes too.
- **Lighter windows:** inside a window, names, small print and typing are in the phone's own font,
  and button outlines are thinner (Friends was the worst).
- The wages line after a free-kick shootout says FREE KICKS, not PENALTIES.

## Shootouts with a mouse (build 112)

In penalties and free kicks the mouse now works whatever Controls is set to: point at the goal to
aim and hold the left button for power, and in goal point where you want to dive and click (a blue
ring shows where). With touch controls showing (a touchscreen laptop, or Controls set to touch) the
joystick's half of the screen used to catch the mouse, so half the goal could not be aimed at and
the click never charged. Both now listen on the whole window (`Pens.mouseAim`, and a capture
listener in `Input.init` that only acts during a shootout).

## Club Career, one player of your own (build 111)

PLAY now opens with two tabs: INTERNATIONAL (your country, as before) and CLUBS. Clubs is a second
side of the game with its own home screen: every mode is there, in your club's kit and at its ground,
and the World Cup becomes the Champions Cup (bots and online, with its own trophy lift).

- **The clubs** (js/clubs.js, `EURO_CLUBS`): a hundred clubs (fifty European, and since build 116 fifty more from England, Spain, Germany, Italy, France, the rest of Europe, Brazil, Argentina, Saudi Arabia, the USA, Mexico and Egypt), made up on purpose. Real club names
  and badges are the clubs' trademarks, so each one is named after its city with a colour or nickname in
  the local language (Madrid Blanco, Merseyside Red, München Rot…) and wears similar colours. Badges are
  drawn from shapes (`UI.crestBadge`: a shape, a split, three colours, an emblem) and copy nobody's.
  The Champions Cup trophy is our own design too (`Sprites.championsCup`). `Clubs.get` takes a
  country or a club; `Clubs.mine()`/`Clubs.pool()` follow the side you are on (`Save.data.arena`).
- **Offers and wages** (js/career.js): every three days four clubs make an offer, each paying a
  different number of coins per goal and per assist; bigger clubs pay more and better stats bring
  bigger clubs. You sign one per three days; the contract runs three days and pays on the results
  screen (shootouts at half rate, training nothing). Kept in `Save.data.cc`.
- **One player** (js/config.js `STAT_*`, js/clubpanels.js): the characters are gone. Your player has
  a look you pick for free (hair, colours, skin, build) and five stats you buy levels of: each level
  costs more than the last and adds less (rating = 60 + 12·ln(1 + level/6)), with no top level.
  Old saves get back every coin they spent on characters, once (`charRefund`; the server lets that
  one save add the refund on top of its usual limit, and never again: tools/refundscan.js).
- **Accessories**: as many at once as you like (`Save.data.accessories`), drawn in slot order.
- **The ULT** is a random kick each time — volley, bicycle kick, backflip kick or the new scorpion
  kick — struck as a fireball, with flames on the cutscene.
- **Online**: the game tells the server which club's kit it wears (`{ t: 'arena' }`); a side with
  nobody on it is then a club too, and a club seat moves no country in the league. Your look, stats
  and owned accessories come from the save the server keeps. Stats count in matchmaking (5 points per
  OVR over 60) and sharpen the fill-ins. The online Champions Cup is its own run (`u.cc`, queue key
  `cc/<format>/<round>`). Test: `node tools/clubscan.js`.

## Twelve languages (builds 109 and 110)

English, Spanish, Portuguese (Brazil), French, German and Italian (build 109); Dutch, Turkish, Polish,
Indonesian, Swedish and Romanian (build 110). Until a player picks one, the phone's own language is
used. SIGN UP asks first thing (before anything is typed, as picking another reloads the game), the
sign-up form has a LANGUAGE link back to it, and Settings → LANGUAGE changes it any time. The list is
plain light rows: each language in its own words, its name in the language in use under it.

- Every word the game shows goes through `tl('THE ENGLISH')` (js/i18n.js; `tl`, not `t`, because `t`
  is the time in the drawing code). Holes are `{0}`, `{1}` or `{name}`; `tlN(n, one, many)` for counts.
  `js/lang-<id>.js` holds each language, with the English as the key; anything missing stays English.
- Only the chosen language's file loads, written into the page by i18n.js before the rest of the game.
  Changing language therefore reloads, and the game carries on where it was (a guest stays a guest).
- The server still speaks English: its messages are matched to a line (holes and all) on the phone
  (`I18N.server`), and online popups piece by piece (`I18N.parts`). index.html is translated in place
  (`I18N.apply`).
- Names stay as they are: the game's name, players' names, stadium cities and chants, country codes.
  The quick chat is sent in English and shown in each player's own language.
- A few buttons whose word is long in some language shrink their letters to fit (`UI.fitWords`), and
  big outlined text drawn on the pitch (`Render.chunkyText`, the KICK OFF banner) shrinks to stay on screen.
- Lilita One has no Ş Ğ İ Ł Ą Ę Ś Ź Ż Ń Ć Ă Ș Ț. Most come from Titan One (fonts/TitanOne-latin-ext.woff2,
  free, same chunky style), declared as part of the same font family for just those letters; İ Ș Ț
  come from the heaviest font the phone has. Polish and Romanian lines are worded so plurals read right
  with any number (`Gole: {n}`), and Turkish capitals go through `I18N.upper` (i → İ).

Tests: `node tools/i18nscan.js` (every line in every language, the same holes, letters the font has,
nothing left in English by mistake); `tools/uiscan.js` in the browser now also reports any English
still showing on a screen in another language; `tools/startscan.js` has a `language` scenario.

## Tools

- `node tools/proscan.js` — PRO MATCH online: its queues, rooms and snapshots, against the real server code on fake sockets (about 20 seconds).
- `node tools/outscan.js [matches]` — how often bots put the ball out in PRO MATCH, and the goals.
- `node tools/rulesscan.js` — PRO MATCH: the bigger pitch, throw-ins, corners and goal kicks, played out by bots and a scripted you (about 1 minute).
- `node tools/slidescan.js` — your own tackle, pass, shot and skill answer within a frame online (about 1 minute).
- `node tools/flowscan.js` — online flow control: a player who falls behind is not buried in stale pictures (about 2 minutes).
- `node tools/wsping.js [url]` — the real round trip to a server, over a WebSocket. `node tools/cpubench.js` — CPU cost of one match.
- `node tools/appscan.js` — the server as seen from inside a store app (CORS: the app's origins in, everyone else out).
- `node tools/iapscan.js` — in-app purchases against a fake App Store and Google Play.
- `node tools/netscan.js 40` — fuzzed online matches on the server engine, invariant checks.
- In the browser console: `tools/bugscan.js` (`BS.sim()`, `BS.render()`, `await BS.ui()`),
  `tools/balance.js` (`HT.report()`), `tools/nettest.js` (`await NT.drive(10)` during an online match).
