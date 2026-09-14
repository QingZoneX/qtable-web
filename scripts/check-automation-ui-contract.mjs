import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const shell = read("src/components/AppShell/ShellPages.tsx");
const page = read("src/components/Automations/AutomationCenterPage.tsx");
const card = read("src/components/Automations/AutomationRuleCard.tsx");
const editor = read("src/components/Automations/AutomationRuleEditor.tsx");
const editorSections = read("src/components/Automations/AutomationEditorSections.tsx");
const history = read("src/components/Automations/ExecutionHistoryDrawer.tsx");
const graphql = read("src/components/Automations/automationGraphql.ts");
const pageI18n = read("src/components/Automations/automationPageI18n.ts");
const templates = read("src/components/Automations/automationTemplates.ts");
const utils = read("src/components/Automations/automationUtils.ts");
const css = read("src/components/Automations/automationCenter.css");
const shellLayout = read("src/components/Automations/automationShellLayout.css");

const checks = [
  [shell.includes("AutomationCenterPage") && shell.includes("AutomationsShellPage = AutomationCenterPage"), "/automations must route to the real Automation Center"],
  [!shell.includes("规则管理、执行历史与流程编辑将在自动化规则引擎完成后接入"), "Automation route must not retain the planned placeholder copy"],
  [graphql.includes("automations(workspaceId:") && graphql.includes("automationExecutions(") && graphql.includes("automationPreview("), "Automation UI must consume real list/history/preview queries"],
  [graphql.includes("validateAutomation(") && graphql.includes("createAutomation(") && graphql.includes("updateAutomation("), "Automation editor must use backend validate/create/update mutations"],
  [graphql.includes("setAutomationEnabled(") && graphql.includes("deleteAutomation(") && graphql.includes("runAutomation(") && graphql.includes("retryAutomationExecution("), "Automation operational mutations must be wired"],
  [page.includes("GET_WORKSPACES") && page.includes("GET_WORKSPACE") && page.includes("workspaceId") && page.includes("tableFilter") && page.includes("statusFilter") && page.includes("search"), "Automation Center must provide workspace/table/status/search filtering"],
  [page.includes("Skeleton") && page.includes("Empty") && page.includes("accessDenied") && page.includes("automationsError"), "Automation Center must expose loading/empty/error/permission states"],
  [card.includes("SET_AUTOMATION_ENABLED") === false && card.includes("onToggle") && page.includes("SET_AUTOMATION_ENABLED"), "Enable/disable must persist through the page mutation instead of local-only state"],
  [
    card.includes("checked={rule.enabled}") &&
      page.includes("refetchAutomations") &&
      page.includes('automationPageT("center.togglePermissionError")') &&
      pageI18n.includes('"center.togglePermissionError": "权限不足：服务器拒绝了启停操作，规则状态未改变"') &&
      pageI18n.includes("the rule state was not modified"),
    "Failed enable/disable must preserve server state and expose rollback feedback",
  ],
  [editorSections.includes('"record.created"') && editorSections.includes('"record.updated"') && editorSections.includes('"scheduled"') && editorSections.includes('"due_date"') && editorSections.includes('"manual"'), "Editor must expose exactly the supported v1 trigger families"],
  [editorSections.includes('"update_record"') && editorSections.includes('"create_record"') && editorSections.includes('"notify"'), "Editor must expose supported backend action families"],
  [utils.includes('"equals"') && utils.includes('"not_equals"') && utils.includes('"contains"') && utils.includes('"gt"') && utils.includes('"empty"'), "Condition operators must be driven by backend-compatible field families"],
  [editorSections.includes("FieldValueInput") && editorSections.includes("operatorsForField"), "Condition/action values must use field-aware inputs"],
  [
    editor.includes("validateDraft") &&
      editor.includes("VALIDATE_AUTOMATION") &&
      editor.includes("query: AUTOMATION") &&
      editor.includes('fetchPolicy: "network-only"') &&
      editor.includes('automationPageT("editor.persistenceFailed")') &&
      pageI18n.includes('"editor.footerHint": "保存前会调用后端 validate；保存后会重新读取服务器规则确认持久化。"'),
    "Save must validate first and verify persisted state from the server",
  ],
  [
    editor.includes("AUTOMATION_PREVIEW") &&
      editor.includes("previewSavedRule") &&
      pageI18n.includes('"editor.previewCurrent": "预览当前版本"') &&
      pageI18n.includes('"editor.previewCurrent": "Preview saved version"'),
    "Existing rules must expose the backend preview capability",
  ],
  [
    page.includes("runAutomation") &&
      page.includes('automationPageT("center.notPreview")') &&
      page.includes('automationPageT("center.runDescription")') &&
      pageI18n.includes('"center.notPreview": "这不是模拟预览"') &&
      pageI18n.includes("Update/create actions will write real data"),
    "Manual run must clearly disclose real write semantics",
  ],
  [history.includes("pollInterval: open ? 5_000 : 0") && history.includes("RETRY_AUTOMATION_EXECUTION") && history.includes("canRetry"), "Execution history must poll and expose backend-permitted retry"],
  [history.includes("traceId") && history.includes("changeSetIds") && history.includes("recordId"), "Execution history must surface trace, ChangeSet and record references"],
  [templates.includes('id: "due-reminder"') && templates.includes('id: "status-notification"') && templates.includes('id: "new-record-action"'), "Automation Center must ship three backend-supported templates"],
  [css.includes("@media (max-width: 1080px)") && css.includes("@media (max-width: 900px)") && css.includes("@media (max-width: 640px)"), "Automation surfaces must define desktop, compact and narrow responsive states"],
  [css.includes("var(--qtable-color-") && css.includes("var(--qtable-radius-"), "Automation UI must reuse Design System tokens"],
  [css.includes("minmax(0, 1fr)") && css.includes("min-width: 0"), "Responsive layouts must protect against horizontal squeeze"],
  [shell.includes('import "../Automations/automationShellLayout.css"') && shellLayout.includes(".qtable-shell-content .qtable-automation-center > *") && shellLayout.includes("width: 100%") && shellLayout.includes("margin-left: 0") && shellLayout.includes("margin-right: 0") && shellLayout.includes("padding: 24px"), "Automation shell must use the full available content width with standard product gutters"],
  [shellLayout.includes("@media (max-width: 900px)") && shellLayout.includes("@media (max-width: 640px)") && shellLayout.includes("padding: 18px") && shellLayout.includes("padding: 12px"), "Automation shell width treatment must preserve compact and mobile gutters"],
  [
    page.includes("canEdit") &&
      card.includes("disabled={!canEdit}") &&
      editor.includes("disabled={!canEdit}") &&
      history.includes("disabled={!canEdit}") &&
      pageI18n.includes('"editor.readonlyTitle": "当前工作区为只读权限"') &&
      pageI18n.includes('"history.permissionRequired": "需要编辑权限"'),
    "Write paths must be permission-aware and explain read-only behavior",
  ],
  [editor.includes("window.setTimeout") && !editor.includes("setDraft(rule ? ruleDraft(rule) : emptyDraft(nextTable));\n    setValidation"), "Editor lifecycle resets must not synchronously cascade state from effects"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) {
    console.error(`[automation-ui] FAIL: ${message}`);
  }
  process.exit(1);
}

console.log(`[automation-ui] OK (${checks.length} checks)`);
