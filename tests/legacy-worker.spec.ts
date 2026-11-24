import { test, expect } from '@playwright/test';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';

test('old cached development layout is not reused and the legacy worker is retired', async ({ page }) => {
  let legacy = true;
  const proxy = createServer((req, res) => {
    if (req.url === '/worker-seed') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>Seed</title>'); return; }
    if (req.url === '/sw.js' && legacy) {
      res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' });
      res.end(`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).pathname.startsWith('/_next/static/'))e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request)))})`);
      return;
    }
    const upstream = request({ host: '127.0.0.1', port: 3000, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3000' } }, response => { res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res); });
    upstream.on('error', () => { res.statusCode = 502; res.end(); });
    req.pipe(upstream);
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
  try {
    await page.goto(`${origin}/worker-seed`);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
    await page.reload();
    await page.evaluate(async () => {
      const cache = await caches.open('rustflow-v23');
      await cache.put('/_next/static/chunks/app/layout.js', new Response('throw new Error("STALE LAYOUT EXECUTED")', { headers: { 'Content-Type': 'application/javascript' } }));
    });
    legacy = false;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${origin}/`);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('shift:legacy-worker-reloaded'))).toBe('1');
    await expect(page.locator('#shift-home-title')).toBeVisible();
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    expect(await page.evaluate(() => caches.keys())).not.toContain('rustflow-v23');
    expect(errors).toEqual([]);
  } finally { await page.goto('about:blank'); proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); }
});
