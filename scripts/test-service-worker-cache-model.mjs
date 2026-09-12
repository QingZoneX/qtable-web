import assert from "node:assert/strict";
import test from "node:test";

import { isQTableOwnedCacheName } from "../src/lib/serviceWorkerCache.ts";

test("historical and current QTable caches are owned for cleanup", () => {
  for (const name of [
    "api-v1",
    "static-v1",
    "qtable-cache-v1",
    "qtable-static-v2",
    "qtable-static-v99",
    "qtable-api-v3",
    "qtable-business-user-a",
    "qtable-private-v1",
  ]) {
    assert.equal(isQTableOwnedCacheName(name), true, name);
  }
});

test("cache cleanup does not claim unrelated same-origin application caches", () => {
  for (const name of ["workbox-precache-v1", "other-app-v1", "images", "api-cache"]) {
    assert.equal(isQTableOwnedCacheName(name), false, name);
  }
});
