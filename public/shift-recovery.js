/* Run before React so a previously cached, incompatible layout can recover.
   Only remove the retired same-origin /sw.js worker and its RustFlow caches. */
(() => {
  if (!("serviceWorker" in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (!controller || new URL(controller.scriptURL).pathname !== "/sw.js") return;
  let reloaded = false;
  try { reloaded = sessionStorage.getItem("shift:legacy-worker-reloaded") === "1"; } catch { /* storage may be disabled */ }
  if (reloaded) return;
  Promise.all([
    navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations
      .filter(reg => [reg.active, reg.waiting, reg.installing].some(worker => worker && new URL(worker.scriptURL).pathname === "/sw.js"))
      .map(reg => reg.unregister()))),
    "caches" in window ? caches.keys().then(names => Promise.all(names.filter(name => name.startsWith("rustflow-")).map(name => caches.delete(name)))) : Promise.resolve(),
  ]).then(() => {
    try { sessionStorage.setItem("shift:legacy-worker-reloaded", "1"); } catch { /* a controlled page still needs one reload */ }
    location.reload();
  }).catch(() => { /* do not trap users in a reload loop */ });
})();
