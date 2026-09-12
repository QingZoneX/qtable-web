import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const page = read("src/components/ProjectsCenter/ProjectsCenterPage.tsx");
const model = read("src/components/ProjectsCenter/projectsCenterModel.ts");

assert.ok(
  shellPages.includes("export const ProjectsShellPage = ProjectsCenterPage;"),
  "/projects must route to the real ProjectsCenterPage",
);
assert.ok(
  !shellPages.includes("项目入口已纳入统一导航，后续将基于项目型数据表与任务语义提供聚合视图。"),
  "project placeholder copy must not remain user-visible",
);

for (const contract of [
  "MY_WORK_QUERY",
  'sections: ["projects", "activity", "tasks", "due"]',
  "GET_WORKSPACES",
  "ProjectStewardModal",
  "navigate(project.deepLink)",
  "completionKnown",
]) {
  assert.ok(page.includes(contract), `Projects Center must reuse real product contract: ${contract}`);
}

for (const state of ["<Skeleton", "<Empty", "type=\"error\"", "sectionErrorText"]) {
  assert.ok(page.includes(state), `Projects Center must expose state contract: ${state}`);
}

assert.ok(
  page.includes("collectProjectRiskTasks"),
  "risk drilldown must use real My Work task records",
);
assert.ok(
  page.includes("navigate(task.deepLink)"),
  "risk task drilldown must preserve server deep links",
);
assert.ok(
  page.includes("pageInfo?.hasMore"),
  "Projects Center must disclose incomplete server windows instead of pretending completeness",
);
assert.ok(
  !page.includes("project.updatedAt"),
  "Projects Center must not invent table-level updatedAt absent from ProjectSummary",
);
assert.ok(!page.includes("Math.random"), "Projects Center must not generate mock projects");
assert.ok(
  model.includes("project.completionKnown"),
  "Task Profile completeness must come from the server project summary",
);
assert.ok(
  !model.includes("titleField") && !model.includes("statusField"),
  "Projects Center model must not guess task semantics from field names",
);

console.log("projects center contract: OK");
