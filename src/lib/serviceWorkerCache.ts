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

export const isQTableOwnedCacheName = (name: string) =>
  LEGACY_QTABLE_CACHE_NAMES.has(name) ||
  QTABLE_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));

const notifyServiceWorkers = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const workers = new Set<ServiceWorker>();
  if (navigator.serviceWorker.controller) {
    workers.add(navigator.serviceWorker.controller);
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.active) workers.add(registration.active);
      if (registration.waiting) workers.add(registration.waiting);
      if (registration.installing) workers.add(registration.installing);
    }
  } catch {
    // Direct Cache Storage cleanup below remains the primary fail-safe.
  }

  for (const worker of workers) {
    worker.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
  }
};

const deleteOwnedBrowserCaches = async () => {
  if (typeof globalThis === "undefined" || !("caches" in globalThis)) return;

  const cacheNames = await globalThis.caches.keys();
  await Promise.all(
    cacheNames
      .filter(isQTableOwnedCacheName)
      .map((name) => globalThis.caches.delete(name)),
  );
};

export const clearPrivateBusinessCaches = async (): Promise<void> => {
  // Do both paths. Direct Cache Storage deletion works even when there is no
  // current controller; the message also asks active/waiting workers to delete
  // their owned caches so logout/session-expiry remains safe across SW upgrades.
  const results = await Promise.allSettled([
    deleteOwnedBrowserCaches(),
    notifyServiceWorkers(),
  ]);

  // Cache cleanup is defense-in-depth and must not make logout impossible. The
  // Service Worker itself is network-only for business data, so a browser API
  // failure here cannot re-enable private offline replay.
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[SW] QTable cache cleanup failed", result.reason);
    }
  }
};
