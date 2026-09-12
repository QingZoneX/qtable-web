import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const graphql = read("src/lib/graphql.ts");
const modal = read("src/components/ProjectSteward/ProjectStewardModal.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");

const required = [
  ["GraphQL ask contract", graphql.includes("projectStewardAsk(")],
  ["GraphQL freshness contract", graphql.includes("projectStewardDiagnosis(")],
  ["facts section", modal.includes("事实") && modal.includes("result.facts")],
  ["inference section", modal.includes("推断") && modal.includes("result.inferences")],
  ["suggestion section", modal.includes("建议") && modal.includes("result.suggestions")],
  ["snapshot timestamp", modal.includes("snapshot.capturedAt")],
  ["stale handling", modal.includes("isStale") && modal.includes("setResult(null)")],
  ["evidence deep links", modal.includes("evidence.deepLink")],
  ["read-only marker", modal.includes("只读分析")],
  [
    "unified AI menu entry",
    toolbar.includes('key: "steward"') &&
      toolbar.includes("setProjectStewardOpen(true)") &&
      toolbar.includes("ProjectStewardModal"),
  ],
  [
    "multi-table project context",
    modal.includes("selectedTableIds") &&
      modal.includes("GET_WORKSPACE") &&
      modal.includes("项目上下文表"),
  ],
];

const forbidden = [
  "UPDATE_RECORD",
  "ADD_FIELD",
  "UPDATE_FIELD",
  "APPLY_TASK_PLANNING",
  "APPLY_WORKLOAD_PLANNING",
];

for (const token of forbidden) {
  required.push([
    `project steward must not import mutation ${token}`,
    !modal.includes(token),
  ]);
}

const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [label] of failed) {
    console.error(`[project-steward-contract] FAIL: ${label}`);
  }
  process.exit(1);
}

console.log("[project-steward-contract] all checks passed");
