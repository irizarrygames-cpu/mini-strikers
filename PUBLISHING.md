# Publishing Mini Strikers: what is done, what is left

## Done (live in build 100)
- The game, the server, accounts, online play, and a privacy page at `/privacy.html`.
- Play as a guest (no account needed; back since build 98), and account deletion inside the game
  (Settings → Delete Account), which both stores require. Online play needs an account, so Google Play's
  "App access" form still wants the reviewer account in step 7 below.
- Coin packs (in-app purchases): built and tested, switched off until the stores are set up.
- The game runs from inside an app (`API_BASE` in `js/net.js`, CORS in `server.js`) and carries its own
  copy of its font, so it makes no request to anyone but its own server.
- **The Android app: `Desktop\Mini Strikers - Play Store\mini-strikers-1.1.0-code11.aab`**, signed with
  the upload key, ready to upload to Google Play. Built from `app/`.

## Not done
1. The iPhone app (needs a Mac with Xcode).
2. The store accounts. (The listing graphics are done: `Desktop/Mini Strikers - Play Store/Store pictures/`.)
   The listing words are written: `app/store-listing.md`.
3. Store credentials for purchases (see README, "Selling coins").
4. The Android app has been built and checked (signature, contents, manifest, and the bundled game
   run in a browser against a test server) but **never run on a real phone or emulator**. Install it on
   a real Android phone (Play Console "Internal testing" is the easy way) before anyone else does.

## The signing key. Read this.
The `.aab` is signed with an *upload key*, kept in `C:\Users\NoahL\AndroidBuild\signing\`
(`mini-strikers-upload.jks` and `keystore.properties`, which holds its password). It is outside
OneDrive and outside the project on purpose, and it is never committed.
- **Back that folder up** somewhere safe (a USB stick, not email). Every update you upload must be
  signed with the same key.
- If it is ever lost, Google can reset the upload key for an account that uses Play App Signing (the
  default), but it takes a few days.
- Whoever holds the key still needs the Play Console login to publish, so it is not a master key.

## Building the Android file again
Tools live in `C:\Users\NoahL\AndroidBuild` (JDK 21, the Android SDK, the work folder). To make a new
`.aab` after changing the game:
1. Raise `versionCode` (and `versionName`) in `app/version.json`. Google refuses a versionCode it has
   already seen.
2. `powershell -ExecutionPolicy Bypass -File app\build-android.ps1`
3. The new file appears in `Desktop\Mini Strikers - Play Store`.
The app id is `com.irizarrygames.ministrikers`. **It cannot be changed after the first upload**, and the
in-app purchase products are tied to it. Change it in `app/capacitor.config.json` before the first upload
if the account holder wants a different one.

## How long it really takes
- **Google Play:** a *new personal* developer account must first run a closed test with at least 12
  testers who stay opted in for 14 days in a row before it can publish
  ([Google's rule](https://support.google.com/googleplay/android-developer/answer/14151465)). So
  Android cannot go live this weekend on a new personal account. Start the test as early as possible.
  (Organisation accounts are said to be exempt; check Google's page.)
- **Apple:** an iPhone build needs a Mac with Xcode. Review usually takes a day or two.
- This weekend is realistic for: accounts created, the file uploaded to a closed test, listing filled in.
  Not for being live.

## Steps, in order
1. **An adult makes the accounts.** Apple Developer Program (about $99 a year) and Google Play Console
   (about $25 once). The adult is the account holder and signs the agreements.
2. **The region is DONE (2026-10-23: Virginia, about 70 ms from Miami); the plan is still to choose.** Older note: pings to the live server were about 125 ms from
   Miami (`node tools/wsping.js`); a server in Virginia or Ohio would be about 45 ms. A Render service's region
   cannot be changed, so it means a new service in the right region, created after deleting the old one and
   given the same name so the address the app uses does not change (see README, "Online lag"). Do this BEFORE
   uploading the app. **Also move off the free plan.** The free instance sleeps and takes up to a
   minute to wake. A reviewer opening the app to a "waking up" screen can reject it as unresponsive.
   Render's paid plan stays awake.
3. **Upload the `.aab`** to a Closed testing track, add 12 or more testers (their Google accounts),
   and keep them opted in for 14 days. Then apply for production access.
4. **Listing:** use `app/store-listing.md`. The 1024x500 feature graphic and two landscape phone screenshots
   are in `Desktop/Mini Strikers - Play Store/Store pictures/` (made by `tools/storeart.js`). Fill in the age-rating questionnaire and the Data safety form (answers
   are in the listing file).
5. **Kids.** The game is for children. The adult decides whether to list it as made for kids (Apple
   Kids Category, Google Families). That means no ads or third-party tracking (there are none), a
   parental gate before purchases and before any link that leaves the game (both built: the grown-up
   check, numbers written out in words). Read both stores' rules for it first.
6. **Purchases:** create five consumables with the ids in `js/products.js`, finish the tax and banking
   forms, set the server's credentials, and test with a licence tester (Google) or sandbox account
   (Apple). Apple reviews the in-app purchases together with the first version of the app.
7. **A reviewer account.** Reviewers need to try the online parts. The adult makes a demo account on
   the live game and puts its username and password in the review notes.
8. **After it is out**, an old app version keeps talking to the server for months. Keep the server
   compatible with it, and set `IAP_REJECT_TEST=1` once review is over.
