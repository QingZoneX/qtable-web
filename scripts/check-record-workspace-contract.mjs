import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[record-workspace] ${message}`);
  process.exitCode = 1;
};

const drawer = read("src/components/SmartTable/RowDetailDrawer.tsx");
const css = read("src/components/SmartTable/recordWorkspace.css");
const taskProfile = read("src/components/TaskProfile/taskProfile.ts");

for (const required of [
  "useTaskProfile",
  "titleFieldId",
  "statusFieldId",
  "priorityFieldId",
  "parentFieldId",
  "SOURCE_INBOX_ITEMS",
  "verifyPersistedValue",
  "sourceItems",
  "subtasks",
  "attachmentFields",
  "RecordActivity",
  "RecordComments",
  "commentId",
  "navigator.clipboard",
  "navigator.share",
]) {
  if (!drawer.includes(required)) fail(`drawer contract missing: ${required}`);
}

for (const forbidden of [
  "协作评论服务尚未启用",
  "RECORD_HISTORY",
  "recordHistory.items",
]) {
  if (drawer.includes(forbidden)) {
    fail(`legacy collaboration path must not return: ${forbidden}`);
  }
}

if (drawer.includes("const titleField = fields[0]")) {
  fail("record title must never fall back to fields[0]");
}

if (!drawer.includes('width="min(700px, calc(100vw - 24px))"')) {
  fail("commercial record workspace width / small-screen guard is missing");
}

if (!drawer.includes("useSmartTableStore.setState") || !drawer.includes("setSaveState(\"error\")")) {
  fail("record edits must provide explicit rollback and failure state");
}

for (const selector of [
  ".qtable-record-property-grid",
  ".qtable-record-source-card",
  ".qtable-record-attachment",
  ".qtable-record-activity-item",
  ".qtable-comment-composer",
  ".qtable-comment.is-highlighted",
  "@media (max-width: 860px)",
  "@media (max-width: 560px)",
]) {
  if (!css.includes(selector)) fail(`workspace style contract missing: ${selector}`);
}

for (const semantic of ["titleFieldId", "statusFieldId", "parentFieldId"]) {
  if (!taskProfile.includes(semantic)) fail(`Task Profile semantic missing: ${semantic}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log("[record-workspace] contract checks passed");
