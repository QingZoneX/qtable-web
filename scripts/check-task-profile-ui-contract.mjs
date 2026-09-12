import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[task-profile-ui] ${message}`);
  process.exitCode = 1;
};

const semantic = read("src/components/TaskProfile/taskProfile.ts");
const drawer = read("src/components/TaskProfile/TaskProfileDrawer.tsx");
const header = read("src/components/SmartTable/Header.tsx");
const kanbanView = read("src/components/SmartTable/views/KanbanView.tsx");
const kanbanCard = read("src/components/SmartTable/views/kanban/KanbanCard.tsx");
const kanban = `${kanbanView}\n${kanbanCard}`;

for (const operation of [
  "taskProfile(tableId: $tableId)",
  "suggestTaskProfile(tableId: $tableId)",
  "updateTaskProfile(tableId: $tableId, profile: $profile)",
  "clearTaskProfile(tableId: $tableId)",
]) {
  if (!semantic.includes(operation)) {
    fail(`GraphQL contract is missing: ${operation}`);
  }
}

for (const key of [
  "titleFieldId",
  "statusFieldId",
  "assigneeFieldId",
  "priorityFieldId",
  "startDateFieldId",
  "dueDateFieldId",
  "progressFieldId",
  "parentFieldId",
  "dependencyFieldId",
  "workloadFieldId",
  "completedStatusValues",
  "blockedStatusValues",
  "notStartedStatusValues",
]) {
  if (!semantic.includes(key)) {
    fail(`semantic source is missing Task Profile key: ${key}`);
  }
}

for (const metaConsumer of ["TASK_PROFILE_FIELD_META.map", "TASK_PROFILE_STATUS_META.map"]) {
  if (!drawer.includes(metaConsumer)) {
    fail(`settings drawer must render the complete semantic meta source: ${metaConsumer}`);
  }
}

for (const requirement of [
  "permissionAllows(currentPermission, \"edit\")",
  "智能建议仅应用到了本地草稿",
  "当前业务语义需要修复",
  "创建推荐字段",
  "refetchQueries",
]) {
  if (!drawer.includes(requirement)) {
    fail(`settings drawer requirement is missing: ${requirement}`);
  }
}

if (!header.includes("<TaskProfileHeaderAction tableId={tableId} />")) {
  fail("table header must expose a stable Business Semantics entry");
}

for (const requirement of [
  "useTaskProfile(currentTableId)",
  "profile.valid",
  "statusFieldId",
  "titleFieldId",
  "assigneeFieldId",
  "dueDateFieldId",
  "startDateFieldId",
  "看板需要显式业务语义",
]) {
  if (!kanban.includes(requirement)) {
    fail(`Kanban is not consuming the saved profile correctly: ${requirement}`);
  }
}

const forbiddenKanbanHeuristics = [
  "/task|title/i",
  "/owner|assignee/i",
  "/timeline|due|date/i",
  "/status/i",
  "resolveTitleFieldId",
  "resolveMemberField",
  "resolveDateField",
];
for (const heuristic of forbiddenKanbanHeuristics) {
  if (kanban.includes(heuristic)) {
    fail(`runtime field-name guessing is forbidden in Kanban: ${heuristic}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("[task-profile-ui] contract checks passed");
