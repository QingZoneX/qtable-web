import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error("[ai-visual-design-contract] " + message);
  process.exit(1);
};

const graphql = read("src/lib/graphql.ts");
const modal = read("src/components/AiVisualDesigner/AiVisualDesignerModal.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");
const smartTable = read("src/components/SmartTable/index.tsx");
const dashboardEntry = read("src/components/DashboardWorkbench.tsx");
const dashboardCore = read("src/components/DashboardWorkbenchCore.tsx");
const widgetContent = read("src/components/Dashboard/WidgetContent.tsx");

for (const operation of [
  "PREVIEW_AI_VISUAL_DESIGN",
  "APPLY_AI_VISUAL_DESIGN",
  "previewAiVisualDesign(",
  "applyAiVisualDesign(",
]) {
  if (!graphql.includes(operation)) {
    fail(operation + " GraphQL contract is missing");
  }
}

if (
  !modal.includes("生成预览") ||
  !modal.includes("确认并保存") ||
  !modal.includes("currentProposal") ||
  !modal.includes("继续用自然语言调整")
) {
  fail("preview / refine / confirm UX is incomplete");
}

if (
  !modal.includes("recordRowsScanned") ||
  !modal.includes("仅结构分析") ||
  modal.includes("QUERY_RECORDS") ||
  modal.includes("GET_TABLE_DATA")
) {
  fail("schema-only preview performance boundary regressed");
}

if (
  !toolbar.includes('key: "visual"') ||
  !toolbar.includes("setAiVisualDesignerOpen(true)") ||
  !toolbar.includes("AiVisualDesignerModal") ||
  !dashboardEntry.includes("DashboardExperienceShell") ||
  !dashboardCore.includes("AI 设计")
) {
  fail("table/dashboard entry points are incomplete");
}

if (
  !smartTable.includes("onAiVisualDesignApplied") ||
  !smartTable.includes("refetchTableData") ||
  !smartTable.includes("refetchWorkspace") ||
  !smartTable.includes('navigate("/workbench/" + result.dashboard.id)')
) {
  fail("post-apply navigation / metadata refresh is incomplete");
}

if (
  !dashboardCore.includes('{ value: "before", label: "早于" }') ||
  !dashboardCore.includes('{ value: "after", label: "晚于" }')
) {
  fail("AI date filters are not editable in the normal dashboard editor");
}

if (
  !widgetContent.includes("formatDimension") ||
  !widgetContent.includes("JSON.parse(trimmed)")
) {
  fail("structured/member dimensions are not rendered readably");
}

console.log("[ai-visual-design-contract] OK");
