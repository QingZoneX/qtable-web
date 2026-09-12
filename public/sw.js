const STATIC_CACHE = "qtable-static-v2";

const LEGACY_QTABLE_CACHE_NAMES = new Set([
  "qtable-cache-v1",
  "static-v1",
  "api-v1",
]);

const QTABLE_CACHE_PREFIXES = [
  "qtable-static-",
  "qtable-cache-",
  "qtable-api-",
  "qtable-business-",
  "qtable-private-",
];

const BUSINESS_PATH_PREFIXES = ["/api", "/graphql", "/auth", "/oauth", "/ws"];
const STATIC_DESTINATIONS = new Set(["script", "style", "font", "image"]);

const matchesPathPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const isBusinessPath = (pathname) =>
  BUSINESS_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));

const isCacheableStaticRequest = (request, url) =>
  request.method === "GET" &&
  url.origin === self.location.origin &&
  url.pathname.startsWith("/assets/") &&
  STATIC_DESTINATIONS.has(request.destination);

const isQTableOwnedCache = (name) =>
  LEGACY_QTABLE_CACHE_NAMES.has(name) ||
  QTABLE_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));

const deleteOwnedCaches = async ({ keepCurrentStatic = false } = {}) => {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (name) =>
          isQTableOwnedCache(name) &&
          (!keepCurrentStatic || name !== STATIC_CACHE),
      )
      .map((name) => caches.delete(name)),
  );
};

self.addEventListener("install", () => {
  // There is intentionally no HTML/app-shell precache. QTable v0.1 alpha does
  // not provide offline business access; only immutable build assets are cached
  // lazily after a successful network response.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove the historical api-v1 cache and every superseded QTable-owned
      // cache. This is an upgrade migration from releases that cached private
      // API/GraphQL responses.
      await deleteOwnedCaches({ keepCurrentStatic: true });
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith("http")) return;

  // Authenticated/business surfaces are always network-only. A failed network
  // request must fail rather than replay an older response whose permission or
  // user identity may no longer be valid.
  if (url.origin === self.location.origin && isBusinessPath(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigations and every non-static request stay network-only. In
  // particular, public-dashboard token URLs are not implicitly granted an
  // offline/cache security model by this generic Service Worker.
  if (
    request.method !== "GET" ||
    request.mode === "navigate" ||
    request.destination === "document" ||
    !isCacheableStaticRequest(request, url)
  ) {
    return;
  }

  // Vite build assets under /assets/ are content-versioned and carry no QTable
  // permission semantics. Cache only these explicitly classified resources.
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response && response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (
    event.data?.type === "CLEAR_PRIVATE_CACHES" ||
    event.data?.type === "CLEAR_CACHE"
  ) {
    // CLEAR_CACHE is retained only as a backwards-compatible message name. Do
    // not delete unrelated Cache Storage owned by another application on the
    // same origin; delete every QTable-owned cache, including current static,
    // so logout/session expiry remains fail-safe if a future regression ever
    // writes business data into a QTable cache.
    event.waitUntil(deleteOwnedCaches());
  }
});
