import assert from "node:assert/strict";
import test from "node:test";
import {
  writeErrorMessage,
  writeFail,
  writeOk,
} from "../src/store/writeResult.ts";

test("writeOk keeps canonical data", () => {
  const result = writeOk({ id: "r1", value: 3 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { id: "r1", value: 3 });
});

test("writeFail preserves concrete server/network message", () => {
  const result = writeFail(new Error("permission denied"), "fallback");
  assert.equal(result.ok, false);
  assert.equal(result.error, "permission denied");
});

test("writeErrorMessage falls back for unknown failures", () => {
  assert.equal(writeErrorMessage({}, "保存失败"), "保存失败");
  assert.equal(writeErrorMessage("  timeout  ", "保存失败"), "timeout");
});
