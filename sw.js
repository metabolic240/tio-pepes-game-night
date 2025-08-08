// Auto-update service worker: network-first for fresh code, cache for offline

const CACHE_NAME = "tio-pepes-runtime";

self.addEventListener("install", (event) => {
  // Activate this SW immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean old caches and take control of open pages
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : Promise.resolve())))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) HTML navigations: network-first, fallback to cached index.html
  if (sameOrigin && req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 2) Static assets (JS, CSS, images, manifest): network-first, fallback to cache
  if (sameOrigin && ["script", "style", "image", "manifest"].includes(req.destination)) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 3) Default: try network, else cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
