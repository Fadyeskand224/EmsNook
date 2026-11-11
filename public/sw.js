// EmsNook cache: the built app files and the photographs (plants, chandelier, icons) are kept on the device, so
// opening the page does not download them again. Nothing from /api is ever stored here (accounts, books, settings).
const CACHE = 'emsnook-static-v1';
const STATIC = /^\/(assets\/|plants\/|library\/|room\/|icon|apple-touch-icon|manifest)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !STATIC.test(url.pathname)) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      // Built files have hashed names, so they never change: serve straight from the cache.
      // Photos and icons are refreshed quietly in the background.
      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit && url.pathname.startsWith('/assets/') ? hit : hit || fresh;
    })
  );
});
