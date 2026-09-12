import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_RESET_FALLBACK_MESSAGE,
  sanitizePasswordResetResponse,
} from "../src/store/passwordResetResponse.ts";

test("forgot-password response exposes only the generic message", () => {
  const result = sanitizePasswordResetResponse({
    message: "If the account exists, password reset instructions will be sent.",
    reset_token: "legacy-secret",
    debug_reset_token: "development-secret",
    token: "unexpected-secret",
  });

  assert.deepEqual(result, {
    message: "If the account exists, password reset instructions will be sent.",
  });
  assert.equal(Object.hasOwn(result, "reset_token"), false);
  assert.equal(Object.hasOwn(result, "debug_reset_token"), false);
  assert.equal(Object.hasOwn(result, "token"), false);
});

test("malformed responses fall back to the same non-enumerating message", () => {
  for (const value of [null, undefined, {}, { message: "" }, { message: 42 }]) {
    assert.deepEqual(sanitizePasswordResetResponse(value), {
      message: PASSWORD_RESET_FALLBACK_MESSAGE,
    });
  }
});
