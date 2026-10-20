# Publishing Mini Strikers: what is done, what is left

## Done (live in build 90)
- The game, the server, accounts, online play, and a privacy page at `/privacy.html`.
- Account deletion inside the game (Settings → Delete Account), which both stores require.
- Coin packs (in-app purchases): built and tested, switched off until the stores are set up.
- The game now works from inside an app: it can be bundled on the phone and still reach the server
  (`API_BASE` in `js/net.js`, CORS in `server.js`, no service worker or "get the app" button inside
  the app). `node tools/appscan.js` tests the server side of that.

## Not done
1. The two app wrappers (Android, iPhone). Nothing has been built or run on a phone yet.
2. The store accounts, and the listing (screenshots, descriptions, age rating).
3. Store credentials for purchases (see README, "Selling coins").

## How long it really takes
- **Google Play:** a *new personal* developer account must first run a closed test with at least 12
  testers who stay opted in for 14 days in a row before it can publish
  ([Google's rule](https://support.google.com/googleplay/android-developer/answer/14151465)). So
  Android cannot go live this weekend on a new personal account. Start the test as early as possible.
  (Organisation accounts are said to be exempt; check Google's page.)
- **Apple:** an iPhone build needs a Mac with Xcode. Review usually takes a day or two.
- This weekend is realistic for: accounts created, apps built, test builds on real phones, and the
  listings filled in. Not for being live.

## Steps, in order
1. **An adult makes the accounts.** Apple Developer Program (about $99 a year) and Google Play Console
   (about $25 once). The adult is the account holder and signs the agreements.
2. **Move the server off the free plan before review.** The free instance sleeps and takes up to a
   minute to wake. A reviewer opening the app to a "waking up" screen can reject it as unresponsive.
   Render's paid plan stays awake.
3. **Wrap the game with Capacitor** (needs downloads: Node packages, a JDK and the Android SDK on the
   PC; Xcode on a Mac for iPhone):
   - `npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios capacitor-plugin-cdv-purchase`
   - the app's files are `index.html`, `style.css`, `js/`, the icons, `manifest.webmanifest` and
     `privacy.html`. Not `server.js`, `server/`, `tools/` or `data.json`.
   - Android scheme `https` (the server allows `https://localhost` and `capacitor://localhost`),
     landscape only, fullscreen, app icon and splash.
   - `npx cap sync`, then build and run on a real phone.
4. **Listing:** name, short and long description, screenshots (landscape phone; iPad if supported),
   1024px icon, Google's 1024x500 feature graphic, the age-rating questionnaire, the privacy page
   `https://mini-strikers.onrender.com/privacy.html`, and the data forms (Google "Data safety", Apple
   "App Privacy"): collected = username, password (hashed), game progress, purchase references; not
   shared; not used for tracking; deletable in the app.
5. **Kids.** The game is for children. The adult decides whether to list it as made for kids (Apple
   Kids Category, Google Families). That means no ads or third-party tracking (there are none), a
   parental gate before purchases (built) and before any link that leaves the game (the privacy link
   and the contact address do not have one yet). Read both stores' rules for it first.
6. **Purchases:** create five consumables with the ids in `js/products.js`, finish the tax and banking
   forms, set the server's credentials, and test with a sandbox account (Apple) and a licence tester
   (Google). Apple reviews the in-app purchases together with the first version of the app.
7. **A reviewer account.** Reviewers need to try the online parts. The adult makes a demo account on
   the live game and puts its username and password in the review notes.
8. **After it is out**, an old app version keeps talking to the server for months. Keep the server
   compatible with it, and keep the server's pass-through for sandbox purchases until review is over
   (then set `IAP_REJECT_TEST=1`).
