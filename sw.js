// A service worker is what makes the game installable. It deliberately caches nothing:
// every screen needs the server (accounts, the league, and online matches all live
// there), so an offline copy could only show a broken game — and a stale cache is how
// players end up stuck on an old version with no way to force a refresh. Every request
// goes straight to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
