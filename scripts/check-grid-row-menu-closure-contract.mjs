import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const menu = read("src/components/SmartTable/RowContextMenu.tsx");
const grid = read("src/components/SmartTable/views/GridView.tsx");
const clipboard = read("src/components/SmartTable/utils/clipboard.ts");

for (const forbidden of [
  "关注行数据的更新",
  "取消关注行数据的更新",
  "isWatched",
  "onToggleWatch",
  "向上插入",
  "向下插入",
]) {
  assert.ok(!menu.includes(forbidden), `row menu still exposes unsupported semantics: ${forbidden}`);
}

for (const forbidden of [
  "watchedRowIds",
  "setWatchedRowIds",
  "insertRowRelative",
  "useSmartTableStore.setState({ records: next })",
]) {
  assert.ok(!grid.includes(forbidden), `GridView still contains local-only behavior: ${forbidden}`);
}

assert.ok(menu.includes("新增"), "row menu must expose truthful generic row creation");
assert.ok(menu.includes("服务端顺序"), "row menu must explain server-controlled ordering");
assert.ok(grid.includes("insertRowsFromMenu"), "GridView must use server insertion without local reordering");
assert.ok(grid.includes("copyTextToClipboard"), "all row-menu copy actions must use truthful clipboard helper");
assert.ok(grid.includes("message.error(result.error)"), "clipboard failure must be user-visible");
assert.ok(!grid.includes("catch {\n      message.success(success);"), "clipboard failure must never report success");
assert.ok(clipboard.includes("await writer.writeText(text)"), "clipboard success must await browser write acknowledgement");

console.log("grid row menu closure contract: OK");
