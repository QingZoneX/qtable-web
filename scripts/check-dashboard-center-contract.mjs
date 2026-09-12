import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const page = read("src/components/DashboardCenter/DashboardCenterPage.tsx");
const model = read("src/components/DashboardCenter/dashboardCenterModel.ts");

assert.ok(
  shellPages.includes("export const DashboardsShellPage = DashboardCenterPage;"),
  "/dashboards must route to the real DashboardCenterPage",
);
assert.ok(
  !shellPages.includes("现有仪表盘仍可从左侧工作区打开；这里将作为统一的仪表盘浏览与管理入口。"),
  "dashboard placeholder copy must not remain user-visible",
);

for (const contract of [
  "GET_WORKSPACE",
  "GET_WORKSPACES",
  "MY_WORK_QUERY",
  "GET_DASHBOARD",
  "CREATE_DASHBOARD",
  "RENAME_ITEM",
  "DELETE_ITEM",
]) {
  assert.ok(page.includes(contract), `Dashboard Center must reuse real contract: ${contract}`);
}

for (const write of ["await createDashboard", "await renameItem", "await deleteItem"]) {
  assert.ok(page.includes(write), `Dashboard Center write must await server acknowledgement: ${write}`);
}

assert.ok(page.includes("navigate(`/workbench/${dashboardId}`)"), "Dashboard Center must deep-link into the existing workbench");
assert.ok(page.includes("workspaceError"), "Dashboard Center must expose workspace load errors");
assert.ok(page.includes("accessDenied"), "Dashboard Center must handle permission denial");
assert.ok(page.includes("<Empty"), "Dashboard Center must have an empty state");
assert.ok(page.includes("<Skeleton"), "Dashboard Center must have a loading state");
assert.ok(!page.includes("updatedAt"), "Dashboard Center must not invent an updatedAt field not present in the current backend contract");
assert.ok(!page.includes("Math.random"), "Dashboard Center must not generate mock dashboard data");
assert.ok(model.includes("flattenDashboards"), "Dashboard Center must derive its list from the workspace tree");

console.log("dashboard center contract: OK");
