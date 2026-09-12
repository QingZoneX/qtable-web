import test from "node:test";
import assert from "node:assert/strict";
import {
  collectProjectRiskTasks,
  latestActivityByTable,
  projectHealth,
  projectMatchesHealth,
  projectSearchMatches,
} from "../src/components/ProjectsCenter/projectsCenterModel.ts";

const baseProject = {
  tableId: "tbl-1",
  tableName: "Launch",
  workspaceId: "ws-1",
  totalTasks: 10,
  completedTasks: 5,
  incompleteTasks: 5,
  progress: 50,
  overdueCount: 0,
  blockedCount: 0,
  completionKnown: true,
  deepLink: "/workbench/tbl-1",
};

test("project health uses server completionKnown and risk counts only", () => {
  assert.equal(projectHealth(baseProject), "healthy");
  assert.equal(projectHealth({ ...baseProject, overdueCount: 1 }), "risk");
  assert.equal(projectHealth({ ...baseProject, completionKnown: false }), "configuration");
  assert.equal(projectMatchesHealth(baseProject, "healthy"), true);
  assert.equal(projectMatchesHealth({ ...baseProject, blockedCount: 2 }, "attention"), true);
  assert.equal(projectMatchesHealth({ ...baseProject, completionKnown: false }, "attention"), true);
});

test("project search matches real project/workspace values without semantic guessing", () => {
  assert.equal(projectSearchMatches(baseProject, "launch", "Product"), true);
  assert.equal(projectSearchMatches(baseProject, "product", "Product"), true);
  assert.equal(projectSearchMatches(baseProject, "finance", "Product"), false);
});

test("latest activity keeps the newest server activity per table", () => {
  const result = latestActivityByTable([
    { changeSetId: "1", time: "2026-09-07T01:00:00Z", entity: { type: "record", id: "r1", title: "A", tableId: "tbl-1", tableName: "Launch", workspaceId: "ws-1" }, kinds: [], deepLink: "/a" },
    { changeSetId: "2", time: "2026-09-07T03:00:00Z", entity: { type: "record", id: "r2", title: "B", tableId: "tbl-1", tableName: "Launch", workspaceId: "ws-1" }, kinds: [], deepLink: "/b" },
    { changeSetId: "3", time: "2026-09-07T02:00:00Z", entity: { type: "record", id: "r3", title: "C", tableId: "tbl-2", tableName: "Ops", workspaceId: "ws-1" }, kinds: [], deepLink: "/c" },
  ]);
  assert.equal(result.get("tbl-1"), "2026-09-07T03:00:00Z");
  assert.equal(result.get("tbl-2"), "2026-09-07T02:00:00Z");
});

test("risk task collection uses real overdue/blocked tasks and deduplicates records", () => {
  const overdue = {
    recordId: "r1",
    tableId: "tbl-1",
    tableName: "Launch",
    workspaceId: "ws-1",
    title: "Ship docs",
    isCompleted: false,
    deepLink: "/workbench/tbl-1?recordId=r1",
  };
  const blocked = {
    recordId: "r1",
    tableId: "tbl-1",
    tableName: "Launch",
    workspaceId: "ws-1",
    title: "Ship docs",
    isCompleted: false,
    isBlocked: true,
    deepLink: "/workbench/tbl-1?recordId=r1",
  };
  const other = { ...blocked, recordId: "r2", tableId: "tbl-2" };
  const result = collectProjectRiskTasks(
    "tbl-1",
    [blocked, other],
    {
      overdue: { items: [overdue], totalCount: 1 },
      today: { items: [], totalCount: 0 },
      next24h: { items: [], totalCount: 0 },
      next3d: { items: [], totalCount: 0 },
      next7d: { items: [], totalCount: 0 },
    },
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].riskKinds.sort(), ["blocked", "overdue"]);
  assert.equal(result[0].deepLink, overdue.deepLink);
});
