/* Retire the legacy RustFlow worker: it cached Next.js development chunks by
 * path, so a newer page could execute an incompatible old layout bundle. */
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("rustflow-")).map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(clients.map(client => client.navigate(client.url).catch(() => undefined)));
  })());
});
