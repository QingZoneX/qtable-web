import type {
  DueSectionData,
  KpiSectionData,
  MyWorkTask,
  ProjectSummary,
  ProjectsSectionData,
} from "./types";

export type HomeRiskInsight =
  | {
      id: "overdue";
      kind: "overdue";
      count: number;
      task: MyWorkTask;
      deepLink: string;
    }
  | {
      id: "project-risk";
      kind: "project-risk";
      project: ProjectSummary;
      overdueCount: number;
      blockedCount: number;
      deepLink: string;
    }
  | {
      id: "due-soon";
      kind: "due-soon";
      count: number;
      task: MyWorkTask;
      deepLink: string;
    };

export type HomeRiskInsightModel = {
  items: HomeRiskInsight[];
  reportedRiskCount: number;
  hasUnlocatedRisk: boolean;
};

type HomeRiskInsightInput = {
  due: DueSectionData | null;
  projects: ProjectsSectionData | null;
  kpi: KpiSectionData | null;
};

const firstOpenTask = (items: MyWorkTask[] | undefined) =>
  (items || []).find((item) => !item.isCompleted && Boolean(item.deepLink));

const riskScore = (project: ProjectSummary) =>
  Math.max(0, project.overdueCount) + Math.max(0, project.blockedCount);

export function buildHomeRiskInsights({
  due,
  projects,
  kpi,
}: HomeRiskInsightInput): HomeRiskInsightModel {
  const items: HomeRiskInsight[] = [];

  const overdueTask = firstOpenTask(due?.overdue?.items);
  if (overdueTask) {
    items.push({
      id: "overdue",
      kind: "overdue",
      count: Math.max(1, due?.overdue?.totalCount || 0),
      task: overdueTask,
      deepLink: overdueTask.deepLink,
    });
  }

  const riskyProject = [...(projects?.items || [])]
    .filter((project) => Boolean(project.deepLink) && riskScore(project) > 0)
    .sort((left, right) => riskScore(right) - riskScore(left))[0];
  if (riskyProject) {
    items.push({
      id: "project-risk",
      kind: "project-risk",
      project: riskyProject,
      overdueCount: Math.max(0, riskyProject.overdueCount),
      blockedCount: Math.max(0, riskyProject.blockedCount),
      deepLink: riskyProject.deepLink,
    });
  }

  if (!overdueTask) {
    const dueSoonTask =
      firstOpenTask(due?.today?.items) || firstOpenTask(due?.next24h?.items);
    if (dueSoonTask) {
      const todayCount = due?.today?.totalCount || 0;
      const next24Count = due?.next24h?.totalCount || 0;
      items.push({
        id: "due-soon",
        kind: "due-soon",
        count: Math.max(1, todayCount || next24Count),
        task: dueSoonTask,
        deepLink: dueSoonTask.deepLink,
      });
    }
  }

  const reportedRiskCount = Math.max(0, kpi?.overdueOrRiskCount || 0);

  return {
    items: items.slice(0, 3),
    reportedRiskCount,
    hasUnlocatedRisk: reportedRiskCount > 0 && items.length === 0,
  };
}
