import test from "node:test";
import assert from "node:assert/strict";
import { verifyAmbiguousWrite } from "../src/store/writeVerification.ts";

const noSleep = async () => {};

test("network disconnect can recover to a committed server value without rollback", async () => {
  const reads = [
    { reachable: false, value: null },
    { reachable: false, value: null },
    { reachable: true, value: { id: "rec1", status: "done" } },
  ];
  let index = 0;
  const result = await verifyAmbiguousWrite(
    async () => reads[Math.min(index++, reads.length - 1)],
    (record) => record?.status === "done",
    { attempts: 5, delayMs: 1, sleep: noSleep },
  );

  assert.equal(result.matched, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.value?.status, "done");
});

test("reachable stale reads are retried until delayed consistency catches up", async () => {
  const reads = ["old", "old", "new"];
  let index = 0;
  const result = await verifyAmbiguousWrite(
    async () => ({ reachable: true, value: reads[Math.min(index++, 2)] }),
    (value) => value === "new",
    { attempts: 4, delayMs: 1, sleep: noSleep },
  );

  assert.equal(result.matched, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.value, "new");
});

test("verification exhaustion returns the last authoritative reachable value", async () => {
  const result = await verifyAmbiguousWrite(
    async () => ({ reachable: true, value: "server-old" }),
    (value) => value === "client-new",
    { attempts: 3, delayMs: 1, sleep: noSleep },
  );

  assert.equal(result.matched, false);
  assert.equal(result.reachable, true);
  assert.equal(result.value, "server-old");
  assert.equal(result.attempts, 3);
});

test("verification handles thrown reader errors as unreachable samples", async () => {
  let calls = 0;
  const result = await verifyAmbiguousWrite(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error("offline");
      return { reachable: true, value: false };
    },
    (value) => value === false,
    { attempts: 3, delayMs: 1, sleep: noSleep },
  );

  assert.equal(result.matched, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.value, false);
});
