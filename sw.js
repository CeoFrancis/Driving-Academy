/* ═══════════════════════════════════════════════════════════
   NTSA DRIVE READY — Service Worker v3
   Strategy: Cache-first + stale-while-revalidate
   Works 100% offline after first load
═══════════════════════════════════════════════════════════ */

const CACHE  = 'ntsa-drive-ready-v3';
const SHELL  = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './map.png',
];

/* Pre-cache shell on install */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url =>
        cache.add(url).catch(() => {}) /* skip missing optional files */
      ))
    ).then(() => self.skipWaiting())
  );
});

/* Delete old caches on activate */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Cache-first with background revalidation */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (!url.protocol.startsWith('http')) return;

  /* Let Google Fonts & CDNs handle themselves */
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('fonts.gstatic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {

      /* Revalidate in background */
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => null);

      /* Return cache immediately, fall back to network */
      return cached || network || new Response('', { status: 408 });
    })
  );
});

/* Receive skip-waiting message from page */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
