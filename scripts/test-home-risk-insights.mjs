import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeRiskInsights } from "../src/components/Home/homeInsights.ts";

const task = (overrides = {}) => ({
  recordId: "r1",
  tableId: "t1",
  tableName: "Roadmap",
  workspaceId: "w1",
  title: "Ship alpha",
  isCompleted: false,
  deepLink: "/workbench/t1/v1?record=r1",
  ...overrides,
});

const project = (overrides = {}) => ({
  tableId: "t1",
  tableName: "Roadmap",
  workspaceId: "w1",
  totalTasks: 10,
  completedTasks: 4,
  incompleteTasks: 6,
  progress: 40,
  overdueCount: 2,
  blockedCount: 1,
  completionKnown: true,
  deepLink: "/workbench/t1/v1",
  ...overrides,
});

const emptyDue = () => ({
  overdue: { items: [], totalCount: 0 },
  today: { items: [], totalCount: 0 },
  next24h: { items: [], totalCount: 0 },
  next3d: { items: [], totalCount: 0 },
  next7d: { items: [], totalCount: 0 },
});

test("uses a concrete overdue record as deterministic evidence", () => {
  const overdue = task();
  const model = buildHomeRiskInsights({
    due: {
      ...emptyDue(),
      overdue: { items: [overdue], totalCount: 3 },
    },
    projects: { items: [], totalCount: 0 },
    kpi: { myIncompleteCount: 4, completedThisWeekCount: 1, activeProjectCount: 1, overdueOrRiskCount: 3 },
  });

  assert.equal(model.items[0]?.kind, "overdue");
  assert.equal(model.items[0]?.deepLink, overdue.deepLink);
  assert.equal(model.items[0]?.count, 3);
  assert.equal(model.hasUnlocatedRisk, false);
});

test("surfaces the riskiest project with server aggregated counts", () => {
  const model = buildHomeRiskInsights({
    due: emptyDue(),
    projects: {
      items: [
        project({ tableId: "p1", tableName: "Low risk", overdueCount: 1, blockedCount: 0, deepLink: "/workbench/p1/v1" }),
        project({ tableId: "p2", tableName: "High risk", overdueCount: 2, blockedCount: 4, deepLink: "/workbench/p2/v1" }),
      ],
      totalCount: 2,
    },
    kpi: { myIncompleteCount: 10, completedThisWeekCount: 2, activeProjectCount: 2, overdueOrRiskCount: 6 },
  });

  const insight = model.items.find((item) => item.kind === "project-risk");
  assert.equal(insight?.project.tableName, "High risk");
  assert.equal(insight?.overdueCount, 2);
  assert.equal(insight?.blockedCount, 4);
  assert.equal(insight?.deepLink, "/workbench/p2/v1");
});

test("uses due-soon evidence when there is no overdue item", () => {
  const dueSoon = task({ recordId: "r2", title: "Review release notes", deepLink: "/workbench/t1/v1?record=r2" });
  const model = buildHomeRiskInsights({
    due: {
      ...emptyDue(),
      today: { items: [dueSoon], totalCount: 2 },
    },
    projects: { items: [], totalCount: 0 },
    kpi: { myIncompleteCount: 2, completedThisWeekCount: 0, activeProjectCount: 0, overdueOrRiskCount: 0 },
  });

  assert.equal(model.items[0]?.kind, "due-soon");
  assert.equal(model.items[0]?.deepLink, dueSoon.deepLink);
  assert.equal(model.items[0]?.count, 2);
});

test("does not invent a record when KPI reports risk without locatable evidence", () => {
  const model = buildHomeRiskInsights({
    due: emptyDue(),
    projects: { items: [], totalCount: 0 },
    kpi: { myIncompleteCount: 5, completedThisWeekCount: 0, activeProjectCount: 1, overdueOrRiskCount: 4 },
  });

  assert.deepEqual(model.items, []);
  assert.equal(model.reportedRiskCount, 4);
  assert.equal(model.hasUnlocatedRisk, true);
});

test("healthy data produces an explicit empty model without fake recommendations", () => {
  const model = buildHomeRiskInsights({
    due: emptyDue(),
    projects: { items: [project({ overdueCount: 0, blockedCount: 0 })], totalCount: 1 },
    kpi: { myIncompleteCount: 2, completedThisWeekCount: 3, activeProjectCount: 1, overdueOrRiskCount: 0 },
  });

  assert.deepEqual(model.items, []);
  assert.equal(model.reportedRiskCount, 0);
  assert.equal(model.hasUnlocatedRisk, false);
});
