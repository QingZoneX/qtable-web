import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const graphql = read("src/components/ExperienceMode/experienceModeGraphql.ts");
const hook = read("src/components/ExperienceMode/useWorkspaceExperienceMode.ts");
const control = read("src/components/ExperienceMode/ExperienceModeControl.tsx");
const controlI18n = read("src/components/ExperienceMode/experienceModeI18n.ts");
const controlCss = read("src/components/ExperienceMode/experienceMode.css");
const homeExperience = read("src/components/Home/HomeExperiencePage.tsx");
const homeStart = read("src/components/Home/HomeSimpleStart.tsx");
const homeCss = read("src/components/Home/homeExperience.css");
const homeSimpleCss = read("src/components/Home/homeSimple.css");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");
const fieldsPopover = read("src/components/SmartTable/controls/toolbar/FieldsPopover.tsx");
const toolbarCss = read("src/components/SmartTable/controls/toolbarExperience.css");
const sourceEvents = read("src/components/SourceInbox/sourceInboxEvents.ts");
const sourceLauncher = read("src/components/SourceInbox/SourceInboxLauncher.tsx");

const checks = [
  [graphql.includes("workspaceExperiencePreference") && graphql.includes("setMyWorkspaceExperienceMode") && graphql.includes("setWorkspaceDefaultExperienceMode"), "Experience mode must use the persisted backend preference contract"],
  [hook.includes('export type ExperienceMode = "simple" | "advanced"'), "Experience mode must have a constrained simple/advanced type"],
  [hook.includes("effectiveMode") && hook.includes("followsWorkspaceDefault"), "Client must consume effective mode and workspace inheritance"],
  [!hook.includes("localStorage.setItem") && !hook.includes("sessionStorage.setItem"), "Experience preference must not create a second browser persistence source"],
  [control.includes("canManageWorkspaceDefault"), "Workspace-default controls must respect backend manage capability"],
  [control.includes('"switchedPersonal"') && control.includes('"workspaceDefault"') && controlI18n.includes("仅影响你的界面") && controlI18n.includes("工作区默认"), "Mode changes must explain personal versus workspace scope through the i18n contract"],
  [control.includes("message.success") && control.includes("message.error"), "Mode changes must expose success and error feedback"],
  [controlCss.includes("@media (max-width: 1099px)"), "Top-bar mode control must compact at narrow desktop widths"],
  [homeExperience.includes("<HomePage />") && homeExperience.includes("isSimpleMode ?"), "Home must keep one page tree and progressively disclose simple-mode content"],
  [shellPages.includes("HomeExperiencePage") && shellPages.includes("HomeShellPage = HomeExperiencePage"), "App Shell must route Home through the experience-mode boundary"],
  [homeStart.includes("描述你想管理的事情") && homeStart.includes("从模板开始") && homeStart.includes("导入已有数据") && homeStart.includes("空白数据表"), "Simple Home must expose goal, template, import and blank creation paths"],
  [homeStart.includes("GoalWorkspaceModal"), "Goal-driven creation must reuse the existing preview/confirm workflow"],
  [!homeStart.includes("CSV / Excel") && homeStart.includes("CSV 数据"), "Simple Home import copy must not claim unsupported Excel import"],
  [homeSimpleCss.includes("@media (max-width: 1180px)") && homeSimpleCss.includes("@media (max-width: 640px)"), "Simple Home actions must adapt across desktop and narrow layouts"],
  [homeCss.includes("@media (max-width: 1280px)") && homeCss.includes("@media (max-width: 720px)"), "Home experience boundary must preserve responsive page spacing"],
  [toolbar.includes("useWorkspaceExperienceMode") && toolbar.includes("showAdvancedControls"), "Table toolbar must consume the same experience-mode source"],
  [toolbar.includes("advancedControlsOpen") && toolbar.includes("收起高级") && toolbar.includes("高级"), "Advanced table controls must remain one-click reachable in simple mode"],
  [toolbar.includes('data-shared-view-config="unchanged"') && !/\bupdateViewConfig\s*\(/.test(toolbar), "Simple-mode disclosure must not mutate shared ViewConfig"],
  [toolbar.includes('toolbarItems.includes("filter") || isSimpleMode'), "Simple mode must keep common filtering immediately available"],
  [toolbar.includes("records.length === 0 && filters.length === 0"), "Filtered zero-result views must not be mislabeled as empty tables"],
  [toolbar.includes('data-empty-actions="ai,csv,qnote,manual"'), "Empty table must expose at least three distinct executable paths"],
  [toolbar.includes("setTaskPlanningOpen(true)") && toolbar.includes("setCsvImportOpen(true)") && toolbar.includes("openSourceInbox") && toolbar.includes("insertRow"), "Empty actions must connect to real AI, import, QNote and manual workflows"],
  [toolbar.includes("firstRowCreating") && toolbar.includes("新增第一条记录失败") && toolbar.includes("第一条记录已创建"), "Manual empty-state creation must expose loading/error/success feedback"],
  [toolbar.includes("FieldConfigPopover") && toolbar.includes("openAddFieldEditor") && fieldsPopover.includes("onAddField"), "No-field empty state and Fields popover must reuse the real field editor"],
  [sourceEvents.includes("qtable:source-inbox-open") && sourceLauncher.includes("subscribeSourceInboxOpen"), "QNote empty action must reuse the global Source Inbox launcher"],
  [toolbarCss.includes("@media (max-width: 1180px)") && toolbarCss.includes("@media (max-width: 900px)") && toolbarCss.includes("@media (max-width: 640px)"), "Table disclosure and empty guidance must define responsive breakpoints"],
  [toolbarCss.includes("var(--qtable-color-") && homeSimpleCss.includes("var(--qtable-color-"), "New surfaces must reuse Design System color tokens"],
  [toolbar.includes("FilterPopover") && toolbar.includes("SortPopover") && toolbar.includes("GroupPopover") && toolbar.includes("FieldsPopover"), "Progressive disclosure must reuse existing table controls rather than fork them"],
  [toolbar.includes("aiMenuItems") && toolbar.includes("moreMenuItems"), "AI and traditional More actions must remain available together"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) {
    console.error(`[experience-mode] FAIL: ${message}`);
  }
  process.exit(1);
}

console.log(`[experience-mode] OK (${checks.length} checks)`);
