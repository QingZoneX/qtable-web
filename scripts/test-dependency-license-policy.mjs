import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { checkedLicense } from "./dependency-license-policy.mjs";

const policy = { allowed: ["MIT"], missingMetadata: {} };
test("reject unreviewed licenses even when stale lock metadata says MIT", () => {
  assert.throws(() => checkedLicense("example", { version: "1", license: "MIT" }, { version: "1", license: "GPL-3.0" }, ".", policy), /requires review/);
});
test("reject missing metadata and installed/locked version drift", () => {
  assert.throws(() => checkedLicense("example", { version: "1" }, { version: "1" }, ".", policy), /missing license/);
  assert.throws(() => checkedLicense("example", { version: "1", license: "MIT" }, { version: "2", license: "MIT" }, ".", policy), /differs from lockfile/);
});
test("accept legacy licenses metadata and absent optional platform package metadata", () => {
  assert.equal(checkedLicense("example", { version: "1" }, { version: "1", licenses: [{ type: "MIT" }] }, ".", policy), "MIT");
  assert.equal(checkedLicense("example", { version: "1", license: "MIT" }, undefined, ".", policy), "MIT");
});
test("missing metadata evidence is pinned to exact version and license bytes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "qtable-license-"));
  try {
    fs.writeFileSync(path.join(directory, "license"), "reviewed license text");
    const exception = { ...policy, missingMetadata: {
      "example@1": { license: "MIT", file: "license", sha256: createHash("sha256").update("reviewed license text").digest("hex") },
    } };
    assert.equal(checkedLicense("example", { version: "1" }, { version: "1" }, directory, exception), "MIT");
    assert.throws(() => checkedLicense("example", { version: "2" }, { version: "2" }, directory, exception), /missing license/);
    fs.writeFileSync(path.join(directory, "license"), "different terms");
    assert.throws(() => checkedLicense("example", { version: "1" }, { version: "1" }, directory, exception), /evidence changed/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
