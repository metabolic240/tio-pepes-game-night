const CACHE_NAME = 'game-night-v1';
const OFFLINE_URLS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'images/splash.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      const networked = fetch(evt.request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(evt.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});
