/* KRSHI service worker — offline support.
   Strategy:
   - /_next/static/* and icons: cache-first (content-hashed, immutable).
   - App pages (/app/*) incl. React Server Component payloads: network-first with a short timeout, falling back
     to the last cached copy. Pages show the time they were rendered, so stale data is never presented as current.
   - API calls are never cached here (writes are queued in IndexedDB by the app; reads need fresh data).
   - Caches are cleared on sign-out (message "clear-caches") so another user of the device cannot see records. */
const VERSION = "krishi-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icon.svg", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") event.waitUntil(caches.delete(PAGES));
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([fetch(request), timeout(NETWORK_TIMEOUT_MS)]);
    if (res.ok && res.type === "basic" && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // The network may just be slow: keep waiting for it rather than failing immediately.
    try {
      return await fetch(request);
    } catch {
      if (request.mode === "navigate") return (await caches.match(OFFLINE_URL)) || Response.error();
      return Response.error();
    }
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(STATIC)).put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.pathname.startsWith("/app") || req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  }
});
