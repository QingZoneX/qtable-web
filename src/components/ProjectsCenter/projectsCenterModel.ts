import type {
  ActivityItem,
  DueSectionData,
  MyWorkTask,
  ProjectSummary,
} from "../Home/types";

export type ProjectHealth = "healthy" | "risk" | "configuration";
export type ProjectHealthFilter = "all" | "healthy" | "attention";

export const projectHealth = (project: ProjectSummary): ProjectHealth => {
  if (!project.completionKnown) return "configuration";
  if (project.overdueCount > 0 || project.blockedCount > 0) return "risk";
  return "healthy";
};

export const projectMatchesHealth = (
  project: ProjectSummary,
  filter: ProjectHealthFilter,
) => {
  if (filter === "all") return true;
  const health = projectHealth(project);
  if (filter === "healthy") return health === "healthy";
  return health !== "healthy";
};

export const projectSearchMatches = (
  project: ProjectSummary,
  query: string,
  workspaceName?: string,
) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [project.tableName, project.tableId, workspaceName || project.workspaceId]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalized);
};

export const latestActivityByTable = (items: ActivityItem[]) => {
  const latest = new Map<string, string>();
  for (const item of items) {
    const tableId = item.entity?.tableId;
    const time = item.time;
    if (!tableId || !time) continue;
    const current = latest.get(tableId);
    if (!current || time.localeCompare(current) > 0) latest.set(tableId, time);
  }
  return latest;
};

export type ProjectRiskTask = MyWorkTask & {
  riskKinds: Array<"overdue" | "blocked">;
};

export const collectProjectRiskTasks = (
  tableId: string,
  tasks: MyWorkTask[],
  due?: DueSectionData | null,
): ProjectRiskTask[] => {
  const byRecord = new Map<string, ProjectRiskTask>();
  const upsert = (task: MyWorkTask, kind: "overdue" | "blocked") => {
    if (task.tableId !== tableId || task.isCompleted) return;
    const key = `${task.tableId}:${task.recordId}`;
    const current = byRecord.get(key);
    if (current) {
      if (!current.riskKinds.includes(kind)) current.riskKinds.push(kind);
      return;
    }
    byRecord.set(key, { ...task, riskKinds: [kind] });
  };

  for (const task of due?.overdue?.items || []) upsert(task, "overdue");
  for (const task of tasks) {
    if (task.isBlocked) upsert(task, "blocked");
    if (task.timingBucket === "overdue") upsert(task, "overdue");
  }

  return [...byRecord.values()].sort((left, right) => {
    const leftSeverity = left.riskKinds.length;
    const rightSeverity = right.riskKinds.length;
    if (leftSeverity !== rightSeverity) return rightSeverity - leftSeverity;
    return left.title.localeCompare(right.title, "zh-CN");
  });
};
