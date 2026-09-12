import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const rail = read("src/components/AppShell/PrimaryRail.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");
const center = read("src/components/AiCenter/AiCenterPage.tsx");
const context = read("src/components/AiCenter/AiContextSummary.tsx");
const css = read("src/components/AiCenter/aiCenter.css");
const workspace = read("src/components/AiWorkspace/index.tsx");
const chat = read("src/components/AiAssistant/ChatAreaEnhanced.tsx");

const checks = [
  [rail.includes('route: "/ai"') && rail.includes('label: "AI 助手"'), "App Shell must keep one stable global AI route"],
  [shellPages.includes('export const AiShellPage = AiCenterPage'), "/ai must render the real AI Center instead of a planned placeholder"],
  [center.includes("<AiAssistant />"), "AI Center must reuse the existing conversation workspace"],
  [center.includes("TaskPlanningModal") && center.includes("WorkloadPlanningModal") && center.includes("ProjectStewardModal") && center.includes("AiVisualDesignerModal"), "AI Center must reuse the shipped specialist AI workflows"],
  [center.includes('title="人员分配建议"') && center.includes('setMode("agent")'), "Personnel assignment must remain an advisory Agent entry instead of an unconfirmed direct write"],
  [center.includes("useWorkspaceNavigationStore") && !center.includes('localStorage.getItem("qtable.workspaceId")'), "AI Center must use the shared workspace context store instead of reading localStorage directly"],
  [center.includes("selectedRecordIds") && center.includes("currentTableId") && center.includes("currentPermission"), "AI actions must share table, selection and permission context"],
  [context.includes("currentViewId") && context.includes("filters") && context.includes("sorts") && context.includes("selectedRecordIds"), "Visible AI context must include view, filters, sorts and selected records"],
  [context.includes("当前账号可见数据") && center.includes("permissionAllows"), "AI context must make permission scope visible and enforce permissions in launchers"],
  [center.includes("Proposal → Preview → Confirm → Execute") && center.includes("Preview / Confirm / ChangeSet"), "AI Center must explain preview/confirm execution semantics"],
  [toolbar.includes("aiMenuItems") && toolbar.includes("handleAiMenuClick"), "Table toolbar must retain one consolidated contextual AI menu"],
  [toolbar.includes("selectedRecordIds.length") && toolbar.includes('tableWorkspaceT("ai")'), "Toolbar AI entry must preserve selected-record context"],
  [!toolbar.includes(">AI 拆任务<") && !toolbar.includes(">AI 估工期<") && !toolbar.includes(">AI 项目管家<") && !toolbar.includes(">AI 视图<"), "Four flat AI buttons must not return"],
  [workspace.includes("PreviewLayer") && workspace.includes("ApprovalLayer") && workspace.includes("ExecutionLayer"), "Existing AI Workspace preview/approval/execution layers must be reused"],
  [chat.includes("selectedTableIds") && chat.includes("TableSelector"), "Global assistant must retain explicit multi-table context selection"],
  [!center.includes("UPDATE_RECORD") && !center.includes("INSERT_ROWS") && !center.includes("CREATE_RECORD"), "AI Center must not bypass specialist preview/confirm flows with direct record mutations"],
  [css.includes("@media (max-width: 1180px)") && css.includes("@media (max-width: 900px)") && css.includes("@media (max-width: 640px)"), "AI Center must define desktop, compact and narrow responsive behavior"],
  [css.includes('aside[aria-hidden="false"]') && css.includes("width: 100% !important"), "Open AI assistant must become full-width on compact layouts"],
  [css.includes("prefers-reduced-motion"), "AI Center motion must respect reduced-motion preferences"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error(`[ai-ux] FAIL: ${message}`);
  process.exit(1);
}

console.log(`[ai-ux] OK (${checks.length} checks)`);
