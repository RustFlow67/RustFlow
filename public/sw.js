// RustFlow PWA Service Worker (cache-first for static assets, network-first for pages)
const CACHE_NAME = "rustflow-v23";
const PRECACHE = [
  "/",
  "/benchmark",
  "/tweaker",
  "/presets",
  "/faq",
  "/guide",
  "/drivers",
  "/tweaker?tab=windows",
  "/icon.svg",
  "/manifest.json",
  "/icons/rustflow-192.png",
  "/icons/rustflow-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("rustflow-") && k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Also exclude same-origin API prefixes such as /backend/api/.
  if (/\/api(?:\/|$)/.test(url.pathname)) return;

  // Static immutable assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Never serve HTML as a fallback to a Next.js flight request.
  if (req.mode !== "navigate" || !PRECACHE.includes(url.pathname)) return;

  // HTML navigations: network-first with offline cache fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match(url.pathname).then((page) => page || Response.error()))),
  );
});
