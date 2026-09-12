import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const page = read("src/components/RecycleBin/RecycleBinPage.tsx");
const graphql = read("src/components/RecycleBin/recycleBinGraphql.ts");
const model = read("src/components/RecycleBin/recycleBinModel.ts");

assert.ok(
  shellPages.includes("export const RecycleBinShellPage = RecycleBinPage;"),
  "/recycle-bin must route to the real RecycleBinPage",
);
assert.ok(
  !shellPages.includes("后续将在这里整合可恢复的记录与变更历史"),
  "recycle-bin planned surface copy must not remain user-visible",
);

for (const contract of ["recycleBin", "restoreRecord", "purgeRecord", "confirmRecordId"]) {
  assert.ok(graphql.includes(contract), `Recycle Bin must bind backend contract: ${contract}`);
}

assert.ok(
  page.includes("while (hasMore)"),
  "Recycle Bin search must load the complete server pagination window before filtering",
);
assert.ok(
  page.includes("RECYCLE_PAGE_SIZE = 200"),
  "Recycle Bin must use the backend maximum page size for bounded pagination",
);
assert.ok(
  page.includes("confirmRecordId: purgeConfirmValue"),
  "purge must send the user-typed confirmation value to the backend",
);
assert.ok(
  page.includes("purgeConfirmValue !== target.recordId"),
  "purge UI must require an exact record-id confirmation",
);
assert.ok(
  page.includes("navigate(") &&
    page.includes("/workbench/${entry.tableId}?recordId=${encodeURIComponent(entry.recordId)}"),
  "restore-and-open must deep link back to a server-read record",
);
assert.ok(
  page.includes("isRecyclePermissionError"),
  "Recycle Bin must expose an explicit permission state",
);
assert.ok(
  page.includes("buildSnapshotEntries"),
  "Recycle Bin must render the immutable deleted data snapshot",
);
assert.ok(
  page.includes("永久删除会清除该记录在回收站与变更历史中的可恢复数据快照"),
  "purge UI must disclose irreversible history redaction",
);
assert.ok(
  model.includes("已删除字段"),
  "schema drift must not erase deleted snapshot values",
);
assert.ok(
  !page.includes("Math.random"),
  "Recycle Bin must not use mock recycle records",
);

console.log("recycle bin contract: OK");
