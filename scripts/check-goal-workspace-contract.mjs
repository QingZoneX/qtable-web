import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error("[goal-workspace-contract] " + message);
  process.exit(1);
};

const graphql = read("src/lib/graphql.ts");
const modal = read("src/components/GoalWorkspace/GoalWorkspaceModal.tsx");
const onboarding = read("src/components/OnboardingExperience.tsx");
const sidebar = read("src/components/SmartTable/Sidebar.tsx");

if (
  !graphql.includes("PREVIEW_GOAL_WORKSPACE") ||
  !graphql.includes("previewGoalWorkspace(")
) {
  fail("previewGoalWorkspace GraphQL contract is missing");
}

if (
  !graphql.includes("APPLY_GOAL_WORKSPACE_BLUEPRINT") ||
  !graphql.includes("applyGoalWorkspaceBlueprint(")
) {
  fail("applyGoalWorkspaceBlueprint GraphQL contract is missing");
}

if (
  !modal.includes("PREVIEW_GOAL_WORKSPACE") ||
  !modal.includes("APPLY_GOAL_WORKSPACE_BLUEPRINT")
) {
  fail("GoalWorkspaceModal must use preview + apply contracts");
}

if (
  modal.includes("CREATE_TABLE") ||
  modal.includes("CREATE_FOLDER") ||
  modal.includes("CREATE_DASHBOARD")
) {
  fail("GoalWorkspaceModal must not bypass atomic Blueprint apply");
}

if (
  !modal.includes("currentBlueprint") ||
  !modal.includes("instruction") ||
  !modal.includes("handleRefine")
) {
  fail("natural-language Blueprint refinement is not wired");
}

if (
  !modal.includes("removeTable") ||
  !modal.includes("removeField") ||
  !modal.includes("removeView")
) {
  fail("Blueprint table/field/view removal controls are missing");
}

if (!modal.includes("traceId") || !modal.includes("idempotent")) {
  fail("trace/idempotency handling is missing");
}

if (
  !onboarding.includes("GoalWorkspaceModal") ||
  !onboarding.includes("handleGoalStart")
) {
  fail("Onboarding goal-driven entry is missing");
}

if (
  !sidebar.includes("GoalWorkspaceModal") ||
  !sidebar.includes("sidebar.goalProject")
) {
  fail("Sidebar goal-driven entry is missing");
}

console.log("[goal-workspace-contract] OK");
