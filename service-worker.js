const OFFLINE_CACHE = "ffo-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("ffo-offline-") && key !== OFFLINE_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (error) {
      const cache = await caches.open(OFFLINE_CACHE);
      const offline = await cache.match(OFFLINE_URL);
      // Pages redirects .html URLs; navigation cannot reuse a redirected response.
      if (offline) return new Response(offline.body, { status: offline.status, headers: offline.headers });
      return new Response("Offline. Connect to the internet and reopen Fantasy Front Office.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.postMessage({ type: "ffo:open-tab", tab: "tab-intel" });
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
