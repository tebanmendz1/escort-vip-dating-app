const CACHE_NAME = 'escort-vip-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Network first strategy for fresh content
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});