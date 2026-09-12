import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, authI18n, store, responseModel, workspaceMembers, inviteDocument, workspaceAccess] =
  await Promise.all([
    readFile("src/components/AuthPage.tsx", "utf8"),
    readFile("src/components/authI18n.ts", "utf8"),
    readFile("src/store/authStore.ts", "utf8"),
    readFile("src/store/passwordResetResponse.ts", "utf8"),
    readFile("src/components/WorkspaceMembersPage.tsx", "utf8"),
    readFile("src/lib/workspaceInviteGraphql.ts", "utf8"),
    readFile("src/hooks/useWorkspaceAccess.ts", "utf8"),
  ]);

for (const forbidden of [
  "result.reset_token",
  "result.debug_reset_token",
  "setResetToken",
  "copyToClipboard",
  "navigator.clipboard",
  "encodeURIComponent(resetToken)",
  "获取重置密码的临时令牌",
  "获取重置令牌",
  "重置令牌：",
]) {
  assert.equal(
    page.includes(forbidden),
    false,
    `AuthPage must not expose legacy raw-token UX: ${forbidden}`,
  );
}

for (const key of ["reset.requested", "action.sendReset", "subtitle.reset"]) {
  assert.ok(page.includes(`authT("${key}")`), `AuthPage must render password reset copy through ${key}`);
}
assert.match(authI18n, /如果账号存在，我们会发送密码重置说明/);
assert.match(authI18n, /发送重置说明/);
assert.match(authI18n, /使用邮件中的重置链接更新密码/);
assert.match(page, /resetRequested/);

const forgotStart = store.indexOf("requestPasswordReset: async");
const resetStart = store.indexOf("resetPassword: async", forgotStart);
assert.ok(forgotStart >= 0 && resetStart > forgotStart, "forgot-password store action missing");
const forgotAction = store.slice(forgotStart, resetStart);
assert.match(forgotAction, /sanitizePasswordResetResponse\(await res\.json\(\)\)/);
for (const forbidden of ["reset_token", "debug_reset_token", "localStorage", "clipboard"]) {
  assert.equal(
    forgotAction.includes(forbidden),
    false,
    `forgot-password store action must not retain credential field: ${forbidden}`,
  );
}

assert.match(responseModel, /export type PasswordResetRequestResult = \{\s*message: string;\s*\}/s);
assert.match(responseModel, /PASSWORD_RESET_FALLBACK_MESSAGE/);
assert.match(responseModel, /return \{ message \};/);
assert.equal(responseModel.includes("reset_token"), false);
assert.equal(responseModel.includes("debug_reset_token"), false);

for (const [sourceName, source] of [
  ["WorkspaceMembersPage", workspaceMembers],
  ["workspace invite GraphQL document", inviteDocument],
  ["WorkspaceMember type", workspaceAccess],
]) {
  for (const forbidden of ["resetToken", "reset_token", "新用户重置令牌"]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${sourceName} must not expose workspace invitation reset credentials: ${forbidden}`,
    );
  }
}
assert.match(workspaceMembers, /INVITE_USER_TO_WORKSPACE_SAFE/);
assert.match(inviteDocument, /inviteUserToWorkspace/);
assert.match(inviteDocument, /userId\s+name\s+email\s+role/s);

console.log("[password-reset-contract] forgot-password and workspace-invite token UX are fail-closed");
