import test from "node:test";
import assert from "node:assert/strict";
import { copyTextToClipboard } from "../src/components/SmartTable/utils/clipboard.ts";

test("clipboard success is reported only after writer resolves", async () => {
  const writes = [];
  const result = await copyTextToClipboard("hello", {
    writeText: async (text) => {
      writes.push(text);
    },
  });

  assert.deepEqual(writes, ["hello"]);
  assert.deepEqual(result, { ok: true });
});

test("clipboard permission failure remains a failure", async () => {
  const result = await copyTextToClipboard("secret", {
    writeText: async () => {
      throw new Error("permission denied");
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /permission denied/);
});

test("clipboard unavailable is explicit and does not fake success", async () => {
  const result = await copyTextToClipboard("hello", null);
  assert.equal(result.ok, false);
  assert.match(result.error, /无法访问剪贴板/);
});
