// Offline navigation for production; never cache development or flight requests.
const CACHE = "shift-offline-v5";
const PAGES = ["/"];
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(PAGES.map(url => cache.add(url)));
  await self.skipWaiting();
})()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => (name.startsWith("shift-offline-") && name !== CACHE) || name.startsWith("rustflow-")).map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || /\/api(?:\/|$)/.test(url.pathname)) return;
  if (req.mode === "navigate" && PAGES.includes(url.pathname)) {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, response.clone())));
      return response;
    }).catch(async () => (await caches.open(CACHE)).match(url.pathname).then(response => response || Response.error())));
  } else if ((url.pathname.startsWith("/_next/static/") && !url.pathname.startsWith("/_next/static/chunks/app/")) || /^\/(fonts|images|icons)\//.test(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const response = await fetch(req);
      if (response.ok) event.waitUntil(cache.put(req, response.clone()));
      return response;
    }));
  }
});
