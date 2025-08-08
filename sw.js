self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('tio-pepes-v1').then(cache => cache.addAll([
      './',
      './index.html',
      './style.css',
      './app.js',
      './manifest.json',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './icons/icon-180.png'
    ])).catch(()=>{})
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
