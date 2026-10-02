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
const CACHE = 'mini-strikers-shell';
const NET_TIMEOUT = 3500; // past this the server is asleep, so show the game and let it catch up

const SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/config.js', './js/clubs.js', './js/celebs.js', './js/save.js', './js/meta.js', './js/audio.js',
  './js/input.js', './js/fx.js', './js/commentary.js', './js/entities.js', './js/ai.js', './js/match.js',
  './js/replay.js', './js/net.js', './js/online.js', './js/sprites.js', './js/render.js', './js/ui.js',
  './js/panels.js', './js/social.js', './js/trophy.js', './js/penalty.js', './js/challenges.js',
  './js/ultcut.js', './js/tutorial.js', './js/main.js',
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || live(url)) return; // straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // the request keeps going even if we stop waiting for it, so a slow answer still refreshes
    // the copy for next time
    const net = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    });
    try {
      const fresh = await Promise.race([
        net,
        new Promise((_, no) => setTimeout(() => no(new Error('slow')), NET_TIMEOUT)),
      ]);
      return fresh;
    } catch (err) {
      const kept = await cache.match(req, { ignoreSearch: true })
        || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
      if (kept) return kept;
      // nothing kept and nothing answering: let the request finish however it finishes
      return fetch(req);
    }
  })());
});
