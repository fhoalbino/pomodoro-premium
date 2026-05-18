/* ==========================================================================
   service-worker.js — Pomodoro Premium
   Strategy:
     · install   → precache shell
     · activate  → drop stale caches, claim clients
     · fetch (same-origin only):
         · HTML/navigation → network-first (fresh updates), cache fallback
         · static assets   → stale-while-revalidate
   Bump CACHE_VERSION on any shell change.
   ========================================================================== */

const CACHE_VERSION = 'pomodoro-premium-v4';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/css/themes.css',
  './src/css/base.css',
  './src/css/components.css',
  './src/css/responsive.css',
  './src/js/app.js',
  './src/js/timer.js',
  './src/js/storage.js',
  './src/js/audio.js',
  './src/js/notifications.js',
  './src/js/pwa.js',
  './src/js/settings.js',
  './public/icons/favicon.svg',
  './public/icons/icon-192.svg',
  './public/icons/icon-512.svg',
  './public/icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  event.respondWith(isHTML ? networkFirst(req) : staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    return cached || cache.match('./index.html');
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
