// The service worker is what makes the game installable, and what makes it open when the server
// is asleep.
//
// The host runs this on a free instance that spins down after about a quarter of an hour with
// nobody on it. Waking it takes the best part of a minute, and until this worker kept a copy of
// the game, that whole minute was a blank screen for whoever opened the link first — the page
// itself was waiting on a sleeping server. A friend of Noah's hit exactly that and gave up.
//
// So: every file the game is made of is kept here, and every request tries the network first and
// falls back to the copy. Network-first means a deploy is picked up the moment the server answers
// — nobody can get stuck on an old version, which is why this used to cache nothing at all — and
// the fallback means the game still opens while the server is getting out of bed. Only the game's
// own files are kept. Accounts, matches and the league (/api/, the socket) are never cached: they
// are the live parts, and a stale copy of those would be a lie.
// The server replaces this with the build number as it serves the file. Keeping the build in
// the name is what stops a player ending up with some files from one build and some from the
// next: a new name means a new box, and the old one is thrown away whole on activate.
const BUILD = '__BUILD__';
const CACHE = 'mini-strikers-' + BUILD;
const NET_TIMEOUT = 3500; // past this the server is asleep, so show the game and let it catch up

const SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/i18n.js', './js/lang-es.js', './js/lang-pt.js', './js/lang-fr.js', './js/lang-de.js', './js/lang-it.js',
  './js/lang-nl.js', './js/lang-tr.js', './js/lang-pl.js', './js/lang-id.js', './js/lang-sv.js', './js/lang-ro.js',
  './js/config.js', './js/products.js', './js/store.js', './js/clubs.js', './js/stadiums.js', './js/celebs.js', './js/save.js', './js/meta.js', './js/crates.js', './js/missions.js', './js/audio.js',
  './js/input.js', './js/fx.js', './js/commentary.js', './js/entities.js', './js/ai.js', './js/match.js',
  './privacy.html',
  './js/pop.js', './js/replay.js', './js/net.js', './js/online.js', './js/sprites.js', './js/render.js', './js/ui.js',
  './js/panels.js', './js/social.js', './js/trophy.js', './js/penalty.js', './js/challenges.js',
  './js/ultcut.js', './js/tutorial.js', './js/main.js',
  './fonts/LilitaOne-latin.woff2', './fonts/LilitaOne-latin-ext.woff2', './fonts/TitanOne-latin-ext.woff2',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // one missing file must not stop the rest being kept
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const live = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws');
// When the page itself had to come out of the copy (the server did not answer in time), the files it
// then asks for come out of the same copy at once, without waiting on the network one by one. A kept
// page with fresh files, or the other way round, right after a deploy, is a page made of two builds.
let keptAt = 0;
const KEPT_FOR = 60000;
// The lettering the game is set in comes from Google. It is not ours, so it is kept separately
// and taken from the copy first: a font does not change, and without it the game falls back to
// whatever the device has and stops looking like itself.
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || live(url)) return; // straight to the network
  if (url.origin !== self.location.origin) {
    if (!FONT_HOSTS.test(url.origin)) return;   // anything else from elsewhere: not our business
    // the font: the copy first, and refresh it behind you
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const kept = await cache.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {}); return res; });
      if (kept) { net.catch(() => {}); return kept; }
      try { return await net; } catch (err) { return new Response('', { status: 504 }); }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const nav = req.mode === 'navigate';
    if (!nav && Date.now() - keptAt < KEPT_FOR) {
      const kept = await cache.match(req, { ignoreSearch: true });
      if (kept) return kept;
    }
    // The request keeps going even if we stop waiting for it. Its answer only fills a gap in the
    // copy: what was kept at install is one whole build, and a file from a newer build written over
    // it is how the copy stops matching itself.
    const net = fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone(); // now, before the page reads the body
        cache.match(req).then((had) => { if (!had) cache.put(req, copy).catch(() => {}); }).catch(() => {});
      }
      return res;
    });
    try {
      const fresh = await Promise.race([
        net,
        new Promise((_, no) => setTimeout(() => no(new Error('slow')), NET_TIMEOUT)),
      ]);
      if (nav) keptAt = 0;
      return fresh;
    } catch (err) {
      const kept = await cache.match(req, { ignoreSearch: true })
        || (nav ? await cache.match('./index.html') : null);
      if (kept) { if (nav) keptAt = Date.now(); return kept; }
      // nothing kept and nothing answering: let the request finish however it finishes
      return fetch(req);
    }
  })());
});
