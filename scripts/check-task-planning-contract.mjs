import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error("[task-planning-contract] " + message);
  process.exit(1);
};

const graphql = read("src/lib/graphql.ts");
const modal = read("src/components/TaskPlanning/TaskPlanningModal.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");
const header = read("src/components/SmartTable/Header.tsx");
const events = read("src/components/SmartTable/tableWorkspaceEvents.ts");
const grid = read("src/components/SmartTable/views/GridView.tsx");
const store = read("src/store/useSmartTableStore.ts");
const smartTable = read("src/components/SmartTable/index.tsx");

for (const operation of [
  "PREVIEW_TASK_PLANNING",
  "APPLY_TASK_PLANNING",
  "TASK_PLANNING_PLAN",
]) {
  if (!graphql.includes(operation)) {
    fail(operation + " GraphQL operation is missing");
  }
}

if (
  !graphql.includes("previewTaskPlanning(") ||
  !graphql.includes("applyTaskPlanning(") ||
  !graphql.includes("taskPlanningPlan(")
) {
  fail("task planning GraphQL schema calls are incomplete");
}

if (
  !modal.includes("PREVIEW_TASK_PLANNING") ||
  !modal.includes("APPLY_TASK_PLANNING")
) {
  fail("TaskPlanningModal must preview before apply");
}

for (const action of ['"create"', '"reuse"', '"merge"', '"skip"']) {
  if (!modal.includes(action)) {
    fail("task decision action missing: " + action);
  }
}

if (
  !modal.includes("selectedRecordIds") ||
  !modal.includes("parentTaskId") ||
  !modal.includes("sourceReference") ||
  !modal.includes("allowRepeat")
) {
  fail("selected context, parent split, source trace, or idempotency control is missing");
}

if (
  modal.includes("CREATE_RECORD") ||
  modal.includes("INSERT_ROWS") ||
  modal.includes("CREATE_TABLE")
) {
  fail("TaskPlanningModal must not bypass atomic applyTaskPlanning");
}

if (
  !store.includes("selectedRecordIds: string[]") ||
  !store.includes("setSelectedRecordIds")
) {
  fail("shared selected-record state is missing");
}

if (
  !grid.includes("selectedRowIdsRef") ||
  !grid.includes("setSelectedRecordIds(Array.from(selectedRowIdsRef.current))")
) {
  fail("Grid selection is not synchronized into the shared store");
}

if (
  !toolbar.includes("TaskPlanningModal") ||
  !toolbar.includes('key: "task_planning"') ||
  !toolbar.includes("setTaskPlanningOpen(true)")
) {
  fail("task planning action is missing from the unified AI menu");
}

if (
  !header.includes('dispatchTableWorkspaceAction("ai_generate")') ||
  !events.includes('"ai_generate"') ||
  !toolbar.includes('action === "ai_generate"')
) {
  fail("page-header AI generation must open the same task planning capability");
}

if (
  !smartTable.includes("onTaskPlanningApplied") ||
  !smartTable.includes("refetchTableData") ||
  !smartTable.includes("refreshRecordWindow")
) {
  fail("post-apply field/record refresh is missing");
}

console.log("[task-planning-contract] OK");
