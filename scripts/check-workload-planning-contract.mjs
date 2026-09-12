import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error("[workload-planning-contract] " + message);
  process.exit(1);
};

const graphql = read("src/lib/graphql.ts");
const modal = read("src/components/WorkloadPlanning/WorkloadPlanningModal.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");
const smartTable = read("src/components/SmartTable/index.tsx");

for (const operation of [
  "PREVIEW_WORKLOAD_PLANNING",
  "APPLY_WORKLOAD_PLANNING",
  "WORKLOAD_PLANNING_WHAT_IF",
  "SUBMIT_WORKLOAD_PLANNING_FEEDBACK",
  "WORKLOAD_PLANNING_BATCH",
]) {
  if (!graphql.includes(operation)) {
    fail(operation + " GraphQL operation is missing");
  }
}

if (
  !graphql.includes("previewWorkloadPlanning(") ||
  !graphql.includes("applyWorkloadPlanning(") ||
  !graphql.includes("workloadPlanningWhatIf(") ||
  !graphql.includes("submitWorkloadPlanningFeedback(")
) {
  fail("workload planning GraphQL calls are incomplete");
}

if (
  !modal.includes("totalWorkP50Hours") ||
  !modal.includes("calendarP50Days") ||
  !modal.includes("criticalPathRecordIds")
) {
  fail("total workload, calendar duration, or critical path presentation is missing");
}

if (
  !modal.includes("WORKLOAD_PLANNING_WHAT_IF") ||
  !modal.includes("scenarioTeamSize") ||
  !modal.includes("scenarioDeadline")
) {
  fail("what-if controls are missing");
}

if (
  !modal.includes("schemaAdditions") ||
  !modal.includes("selectedForApply")
) {
  fail("writeback preview or partial selection is missing");
}

if (
  !modal.includes("SUBMIT_WORKLOAD_PLANNING_FEEDBACK") ||
  !modal.includes("actualHours") ||
  !modal.includes("actualStoryPoints")
) {
  fail("actual outcome feedback flow is missing");
}

if (
  !modal.includes("canApply") ||
  !toolbar.includes("canApply={canEditView}") ||
  !toolbar.includes('permissionAllows(currentPermission, "read")')
) {
  fail("read-only preview vs writeback permission wiring is missing");
}

if (
  !modal.includes("估算\\s*trace") ||
  !modal.includes("estimate\\s*trace")
) {
  fail("applied estimate trace field detection is not whitespace-safe");
}

if (
  modal.includes("UPDATE_RECORD") ||
  modal.includes("ADD_FIELD") ||
  modal.includes("UPDATE_FIELD")
) {
  fail("WorkloadPlanningModal must not bypass atomic applyWorkloadPlanning");
}

if (
  !toolbar.includes("WorkloadPlanningModal") ||
  !toolbar.includes('key: "workload"') ||
  !toolbar.includes("setWorkloadPlanningOpen(true)")
) {
  fail("workload planning action is missing from the unified AI menu");
}

if (
  !smartTable.includes("onWorkloadPlanningApplied") ||
  !smartTable.includes("refetchTableData") ||
  !smartTable.includes("refreshRecordWindow")
) {
  fail("post-apply schema/record refresh is missing");
}

console.log("[workload-planning-contract] OK");
