import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const header = read("src/components/SmartTable/Header.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");
const events = read("src/components/SmartTable/tableWorkspaceEvents.ts");
const copy = read("src/components/SmartTable/tableWorkspaceI18n.ts");
const css = read("src/components/SmartTable/tableWorkspace.css");
const store = read("src/store/useSmartTableStore.ts");

const checks = [
  [header.includes('className="qtable-table-page-header"'), "Table workbench must have a dedicated page header"],
  [header.includes('className="qtable-table-view-row"'), "View tabs must live in a separate row"],
  [header.includes('aria-current={isActive ? "page" : undefined}'), "Active view must expose current-page semantics"],
  [header.includes('className={`qtable-table-view-tab${isActive ? " is-active" : ""}`}'), "Active view must have a distinct selected class"],
  [css.includes(".qtable-table-view-tab.is-active::after"), "Active view must have a visible underline"],
  [header.includes("computeViewSetByCount") && header.includes("currentViewId"), "View overflow must preserve the active view"],
  [header.includes("currentViewMenu") && header.includes("currentViewActions"), "Rename/copy/delete must be consolidated into current-view actions"],
  [!header.includes("viewMenuById"), "Every tab must not own a permanent ellipsis menu"],
  [header.includes("Dropdown.Button") && header.includes('tableWorkspaceT("newRecord")'), "New record must be the fixed page-header primary action"],
  [header.includes('dispatchTableWorkspaceAction("import_csv")'), "Primary action must bridge to batch CSV import"],
  [header.includes('dispatchTableWorkspaceAction("ai_generate")'), "Primary action must bridge to AI task generation"],
  [header.includes('tableWorkspaceT("sharedView")') && header.includes('tableWorkspaceT("autoSave")'), "Editable views must explain shared auto-save behavior"],
  [header.includes('tableWorkspaceT("readOnlyView")') && header.includes('tableWorkspaceT("readOnlyHint")'), "Read-only view behavior must be explicit"],
  [events.includes("qtable:table-workspace-action"), "Header-to-toolbar actions must use a scoped event bridge"],
  [toolbar.includes("subscribeTableWorkspaceAction"), "Toolbar must consume page-header import/AI actions"],
  [toolbar.includes("visibleFilterChips") && toolbar.includes("extraFilterCount"), "Active filters must render as bounded chips with overflow"],
  [toolbar.includes('filter.logic === "or"') && toolbar.includes('tableWorkspaceT("and")'), "Filter chips must expose AND/OR semantics"],
  [toolbar.includes("removeFilter") && toolbar.includes("setFilters([])"), "Filters must support remove-one and clear-all"],
  [toolbar.includes("visibleSortChips") && toolbar.includes('tableWorkspaceT("ascending")'), "Active sort must show field and direction"],
  [toolbar.includes("groupField") && toolbar.includes('tableWorkspaceT("group")'), "Active group field must be visible without opening a popover"],
  [toolbar.includes("hiddenFieldIds.length") && toolbar.includes('tableWorkspaceT("hiddenFields"'), "Hidden-field count must be visible"],
  [toolbar.includes("aiMenuItems") && toolbar.includes("handleAiMenuClick"), "AI actions must be consolidated into one menu"],
  [!toolbar.includes(">AI 拆任务<") && !toolbar.includes(">AI 估工期<") && !toolbar.includes(">AI 项目管家<") && !toolbar.includes(">AI 视图<"), "Flat AI action buttons must not return"],
  [toolbar.includes('const LEGACY_MORE_ITEM = "automations"'), "Legacy serialized More key must be documented for compatibility"],
  [toolbar.includes('tableWorkspaceT("more")'), "Legacy More configuration must be presented as More, never Automation"],
  [toolbar.includes('type: "group"') && toolbar.includes('tableWorkspaceT("importGroup")') && toolbar.includes('tableWorkspaceT("exportGroup")') && toolbar.includes('tableWorkspaceT("permissionGroup")'), "More menu must group import/export/permission actions"],
  [toolbar.includes("RowPermissionModal") && toolbar.includes('key: "row_permissions"'), "Row permissions must remain reachable from More"],
  [toolbar.includes("FilterPopover") && toolbar.includes("SortPopover") && toolbar.includes("GroupPopover") && toolbar.includes("FieldsPopover"), "Existing filter/sort/group/fields behavior must be reused"],
  [toolbar.includes("matchesFilters") && toolbar.includes("compareSmartValues"), "Export must preserve active filter/sort semantics"],
  [toolbar.includes("disabled={!canEditView}") || toolbar.includes("disabled: !canEditView"), "Shared view controls must enforce edit permission"],
  [css.includes("@media (max-width: 1280px)"), "Table workspace must define 1280px responsive behavior"],
  [css.includes("qtable-table-state-strip") && css.includes("qtable-table-state-chip"), "Visible view-state strip styling must exist"],
  [copy.includes("共享视图") && copy.includes("Read-only view"), "Commercial shared/read-only copy must be localized"],
  [store.includes('"automations"'), "Existing saved ViewConfig compatibility key must remain readable during migration"],
  [!copy.includes("自动化菜单"), "Commercial More copy must not mislabel import/export as Automation"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error(`[table-workspace] FAIL: ${message}`);
  process.exit(1);
}
console.log(`[table-workspace] OK (${checks.length} checks)`);
