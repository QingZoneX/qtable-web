import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error("[source-inbox-contract] " + message);
  process.exit(1);
};

const graphql = read("src/components/SourceInbox/sourceInboxGraphql.ts");
const modal = read("src/components/SourceInbox/SourceInboxModal.tsx");
const launcher = read("src/components/SourceInbox/SourceInboxLauncher.tsx");
const primaryRail = read("src/components/AppShell/PrimaryRail.tsx");
const sourceContext = read("src/components/SourceInbox/SourceContextSection.tsx");
const backlink = read("src/components/SourceInbox/sourceBacklink.ts");
const sourceContextCss = read("src/components/SourceInbox/sourceContext.css");
const recordWorkspace = read("src/components/SmartTable/RowDetailDrawer.tsx");
const app = read("src/App.tsx");

for (const token of [
  "sourceInboxItems(",
  "previewSourceInboxItem(",
  "convertSourceInboxItem(",
  "updateSourceInboxStatus(",
]) {
  if (!graphql.includes(token)) fail(token + " GraphQL operation is missing");
}

if (!modal.includes("AI 生成任务建议") || !modal.includes("确认并转为任务")) {
  fail("preview then explicit confirmation flow is missing");
}
if (!modal.includes("只生成预览，不会创建任务")) {
  fail("preview no-write boundary is not visible to users");
}
if (!modal.includes("疑似重复") || !modal.includes("duplicateOfId")) {
  fail("duplicate warning UX is missing");
}
if (!modal.includes("批量归档") || !modal.includes("批量忽略")) {
  fail("batch inbox processing is missing");
}
if (!modal.includes("preview.members") || !modal.includes("assigneeUserId")) {
  fail("workspace-member assignee selection is missing");
}
if (!modal.includes("similarTasks") || !modal.includes("deepLink")) {
  fail("similar task warning/deep links are missing");
}
if (!modal.includes("打开原文") || !modal.includes("current.url")) {
  fail("source backlink UX is missing");
}
for (const forbidden of ["UPDATE_RECORD", "ADD_FIELD", "CREATE_RECORD", "INSERT_ROW"]) {
  if (modal.includes(forbidden)) fail("Inbox UI must not bypass atomic convert mutation: " + forbidden);
}

for (const token of [
  "SourceInboxModal",
  "subscribeSourceInboxOpen",
  "useWorkspaceNavigationStore",
]) {
  if (!launcher.includes(token)) fail(`Source Inbox modal host is missing: ${token}`);
}
for (const forbidden of [
  'position: "fixed"',
  "sidebarWidth",
  "sidebarCollapsed",
  "localStorage.getItem",
]) {
  if (launcher.includes(forbidden)) {
    fail(`Source Inbox launcher must not return to floating/sidebar-offset positioning: ${forbidden}`);
  }
}
for (const token of [
  "InboxOutlined",
  "openSourceInbox",
  'aria-label="来源收件箱"',
  'aria-haspopup="dialog"',
  "qtable-primary-rail-utilities",
]) {
  if (!primaryRail.includes(token)) fail(`Primary utility rail Inbox entry is missing: ${token}`);
}
const utilityRailIndex = primaryRail.indexOf("qtable-primary-rail-utilities");
const inboxActionIndex = primaryRail.indexOf('aria-label="来源收件箱"');
const utilityItemsIndex = primaryRail.indexOf("{utilityItems.map(renderItem)}");
if (
  utilityRailIndex < 0 ||
  inboxActionIndex < utilityRailIndex ||
  utilityItemsIndex < inboxActionIndex
) {
  fail("Source Inbox must stay at the top of the bottom utility rail, before the other utility items");
}
if (!primaryRail.includes("workspaceId ? (")) {
  fail("Source Inbox utility entry must only render when a workspace is available");
}
if (!app.includes("<SourceInboxLauncher />")) {
  fail("authenticated app does not mount the Inbox modal host");
}

if (!recordWorkspace.includes("<SourceContextSection") || !recordWorkspace.includes("sourceItems")) {
  fail("record workspace does not render the dedicated source context section");
}
for (const token of ["在 QNote 中打开", "打开网页来源", "qtable-record-source-actions"]) {
  if (!sourceContext.includes(token)) fail(`record backlink action is missing: ${token}`);
}
for (const token of ["qnote://annotation/", "isQNoteAnnotationUrl", "resolveRecordBacklinks"]) {
  if (!backlink.includes(token)) fail(`QNote deep-link safety contract is missing: ${token}`);
}
if (backlink.includes("javascript:") || backlink.includes("window.open(")) {
  fail("QNote backlink resolver must not execute arbitrary URLs");
}
for (const token of ["@media (max-width: 620px)", "@media (max-width: 420px)", "flex-wrap: wrap"]) {
  if (!sourceContextCss.includes(token)) fail(`responsive source-card styling is missing: ${token}`);
}

console.log("[source-inbox-contract] OK");
