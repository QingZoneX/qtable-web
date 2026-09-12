import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardRecentMap,
  dashboardSearchMatches,
  flattenDashboards,
} from "../src/components/DashboardCenter/dashboardCenterModel.ts";

const workspace = {
  type: "folder",
  id: "root",
  name: "Workspace Root",
  children: [
    { type: "dashboard", id: "dsb-root", name: "Root Dashboard" },
    { type: "table", id: "tbl-1", name: "Tasks" },
    {
      type: "folder",
      id: "folder-sales",
      name: "Sales",
      children: [
        { type: "dashboard", id: "dsb-sales", name: "Pipeline" },
        {
          type: "folder",
          id: "folder-quarter",
          name: "Q3",
          children: [
            { type: "dashboard", id: "dsb-q3", name: "Quarter Review" },
          ],
        },
      ],
    },
  ],
};

test("flattenDashboards returns dashboards only and preserves folder path", () => {
  const result = flattenDashboards(workspace);
  assert.deepEqual(result, [
    { id: "dsb-root", name: "Root Dashboard", parentId: "root", folderPath: [] },
    { id: "dsb-sales", name: "Pipeline", parentId: "folder-sales", folderPath: ["Sales"] },
    {
      id: "dsb-q3",
      name: "Quarter Review",
      parentId: "folder-quarter",
      folderPath: ["Sales", "Q3"],
    },
  ]);
});

test("dashboardRecentMap ignores non-dashboard targets and keeps newest visit", () => {
  const result = dashboardRecentMap([
    { entityType: "table", entityId: "dsb-sales", visitedAt: "2026-09-07T01:00:00Z" },
    { entityType: "dashboard", entityId: "dsb-sales", visitedAt: "2026-09-07T02:00:00Z" },
    { entityType: "dashboard", entityId: "dsb-sales", visitedAt: "2026-09-07T03:00:00Z" },
    { entityType: "dashboard", entityId: "dsb-q3", visitedAt: null },
  ]);
  assert.equal(result.get("dsb-sales"), "2026-09-07T03:00:00Z");
  assert.equal(result.has("dsb-q3"), false);
});

test("dashboard search covers dashboard name and folder hierarchy", () => {
  const [rootDashboard, salesDashboard] = flattenDashboards(workspace);
  assert.equal(dashboardSearchMatches(rootDashboard, "root dash"), true);
  assert.equal(dashboardSearchMatches(salesDashboard, "sales"), true);
  assert.equal(dashboardSearchMatches(salesDashboard, "finance"), false);
});
