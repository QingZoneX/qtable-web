import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [sw, authStore, cleanupHelper, nginx] = await Promise.all([
  readFile("public/sw.js", "utf8"),
  readFile("src/store/authStore.ts", "utf8"),
  readFile("src/lib/serviceWorkerCache.ts", "utf8"),
  readFile("nginx.conf.template", "utf8"),
]);

assert.match(sw, /const STATIC_CACHE = "qtable-static-v2"/);
assert.equal(sw.includes("const API_CACHE"), false, "API cache must not exist");
assert.equal(sw.includes("cache.addAll"), false, "HTML/app shell must not be precached");

for (const path of ["/api", "/graphql", "/auth", "/oauth", "/ws"]) {
  assert.ok(sw.includes(`"${path}"`), `network-only business prefix missing: ${path}`);
}

const businessBranch = sw.indexOf("isBusinessPath(url.pathname)");
const networkOnly = sw.indexOf("event.respondWith(fetch(request));", businessBranch);
const staticClassifier = sw.indexOf("isCacheableStaticRequest(request, url)");
const cachePut = sw.indexOf("cache.put(request, response.clone())");
assert.ok(businessBranch >= 0, "business route branch missing");
assert.ok(networkOnly > businessBranch, "business requests must be explicit network-only");
assert.ok(staticClassifier > networkOnly, "static classifier must run after business network-only branch");
assert.ok(cachePut > staticClassifier, "cache.put must be reachable only from static branch");
assert.equal(
  [...sw.matchAll(/\.put\s*\(/g)].length,
  1,
  "Service Worker must have exactly one Cache.put site",
);
assert.match(sw, /url\.pathname\.startsWith\("\/assets\/"\)/);
assert.match(sw, /STATIC_DESTINATIONS\.has\(request\.destination\)/);
assert.match(sw, /request\.mode === "navigate"/);
assert.match(sw, /request\.destination === "document"/);

for (const legacyName of ["api-v1", "static-v1", "qtable-cache-v1"]) {
  assert.ok(sw.includes(`"${legacyName}"`), `legacy cache cleanup missing: ${legacyName}`);
  assert.ok(cleanupHelper.includes(`"${legacyName}"`), `client cleanup missing: ${legacyName}`);
}
assert.match(sw, /deleteOwnedCaches\(\{ keepCurrentStatic: true \}\)/);
assert.match(sw, /CLEAR_PRIVATE_CACHES/);
assert.match(cleanupHelper, /CLEAR_PRIVATE_CACHES/);
assert.match(cleanupHelper, /globalThis\.caches\.keys\(\)/);
assert.match(cleanupHelper, /navigator\.serviceWorker\.getRegistrations\(\)/);

assert.match(authStore, /import \{ clearPrivateBusinessCaches \}/);
assert.match(authStore, /logout:[\s\S]*?void clearPrivateBusinessCaches\(\)/);
assert.match(authStore, /login: async[\s\S]*?await clearPrivateBusinessCaches\(\)/);
assert.match(authStore, /register: async[\s\S]*?await clearPrivateBusinessCaches\(\)/);
assert.match(authStore, /res\.status === 401 \|\| res\.status === 403[\s\S]*?await clearPrivateBusinessCaches\(\)/);
assert.match(authStore, /handleAuthExpired[\s\S]*?await clearPrivateBusinessCaches\(\)/);

const swLocationStart = nginx.indexOf("location = /sw.js");
const staticLocationStart = nginx.indexOf("location ~* \\\\.(js|css", swLocationStart);
assert.ok(swLocationStart >= 0, "nginx must have an exact /sw.js location");
assert.ok(staticLocationStart > swLocationStart, "/sw.js exact location must precede immutable JS rule");
const swLocation = nginx.slice(swLocationStart, staticLocationStart);
assert.match(swLocation, /Cache-Control "no-store, no-cache, must-revalidate"/);
assert.match(swLocation, /Service-Worker-Allowed "\/"/);
assert.equal(swLocation.includes("immutable"), false, "/sw.js must never be immutable cached");

assert.equal(
  /public[-_ ]?dashboard[\s\S]{0,200}cache\.put/i.test(sw),
  false,
  "public dashboard data must not inherit a generic offline cache model",
);

console.log("[service-worker-contract] private business cache safety verified");
