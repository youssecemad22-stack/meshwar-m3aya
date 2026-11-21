/* Increment VERSION for every app-shell release. Never store API, auth, or user data here. */
const VERSION = 'meshwar-pwa-20261121-places-3';
const BASE = new URL('./', self.location).pathname;
const SHELL = [BASE, BASE + 'index.html', BASE + 'ui.js', BASE + 'app.js', BASE + 'pwa.js', BASE + 'manifest.webmanifest', BASE + 'icon-192.png', BASE + 'icon-512.png', BASE + 'icon-maskable-512.png', BASE + 'apple-touch-icon.png'];
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map(url => new Request(url, {cache: 'reload'})));
    // The public SDK makes the shell usable offline. No Supabase endpoint is cached.
    try { const response = await fetch(SDK); if (response.ok) await cache.put(SDK, response); } catch (_) {}
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('meshwar-pwa-') && key !== VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Explicit allowlist: all API/auth requests, POSTs, maps and external resources use the network.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && url.href !== SDK) return;
  if (request.mode === 'navigate' && url.origin === self.location.origin && url.pathname.startsWith(BASE)) {
    event.respondWith((async () => {
      try {
        // Do not replace a versioned shell with a partially deployed newer index.
        return await fetch(request);
      } catch (_) {
        return (await caches.match(BASE + 'index.html')) || Response.error();
      }
    })());
    return;
  }
  const isShell = url.origin === self.location.origin && SHELL.includes(url.pathname);
  if (!isShell && url.href !== SDK) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(isShell ? url.pathname : SDK);
    return cached || fetch(request);
  })());
});
