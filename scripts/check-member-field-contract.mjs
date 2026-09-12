import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error("[member-field-contract] " + message);
  process.exit(1);
};

const config = read("src/components/SmartTable/FieldConfigPopover.tsx");
const editor = read("src/components/SmartTable/editors/MemberSelectEditor.tsx");
const columns = read("src/components/SmartTable/hooks/useTableColumns.tsx");
const renderer = read("src/components/SmartTable/renderers/renderMember.tsx");
const store = read("src/store/useSmartTableStore.ts");

if (config.includes("buildDefaultMembers") || config.includes('"成员 1"')) {
  fail("member fields must not create fake/stale option snapshots");
}
if (
  !config.includes("WORKSPACE_MEMBERS") ||
  !config.includes("成员来自当前工作空间") ||
  !config.includes("memberMultiple")
) {
  fail("workspace-member source or single/multiple configuration is missing");
}
if (
  !editor.includes('mode="multiple"') ||
  !editor.includes("multiple={this.multiple}") ||
  !editor.includes("memberMultiple")
) {
  fail("member editor does not support field-driven single/multiple selection");
}
if (
  !columns.includes("field.property?.multiple !== false") ||
  !columns.includes("baseCol.memberMultiple")
) {
  fail("member cardinality is not propagated to the VTable editor");
}
if (
  !renderer.includes("candidate.userId") ||
  !renderer.includes("extractUserId")
) {
  fail("legacy member object values are not render-compatible");
}
if (!store.includes("multiple?: boolean")) {
  fail("member field property typing is missing");
}

console.log("[member-field-contract] OK");
