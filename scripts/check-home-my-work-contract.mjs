import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const home = read("src/components/Home/HomePage.tsx");
const homeInsights = read("src/components/Home/homeInsights.ts");
const homeExperience = read("src/components/Home/HomeExperiencePage.tsx");
const graphql = read("src/components/Home/homeGraphql.ts");
const tracker = read("src/components/Home/RecentTargetTracker.tsx");
const preferences = read("src/components/Home/homePreferences.ts");
const i18n = read("src/components/Home/homeI18n.ts");
const css = read("src/components/Home/home.css");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const appShell = read("src/components/AppShell/AppShell.tsx");
const app = read("src/App.tsx");

const checks = [
  [graphql.includes("myWork("), "Home must consume the server My Work aggregate"],
  [graphql.includes("upsertRecentTarget"), "Recent workbench navigation must persist server recents"],
  [graphql.includes("importRecentTargets"), "Legacy local recent targets must have a migration path"],
  [graphql.includes("removeRecentTarget"), "Recent items must support server-side removal"],
  [home.includes("ALL_SECTIONS"), "Home must request the aggregate sections"],
  [home.includes("sectionOverrides"), "Section-level retry must not blank unrelated Home sections"],
  [home.includes('loadSection("tasks"'), "Task state changes must support targeted refresh"],
  [home.includes("CLIENT_SECTION_FAILED"), "Client-side section request failures must become visible section errors"],
  [home.includes("project.progress"), "Project progress must use server aggregation"],
  [home.includes("project.overdueCount"), "Project risk must use server aggregation"],
  [home.includes("project.completionKnown"), "Project health must distinguish incomplete semantics from healthy state"],
  [home.includes("navigate(task.deepLink)"), "Tasks must preserve backend permission-safe deep links"],
  [home.includes("navigate(item.deepLink)"), "Activity/due items must preserve backend deep links"],
  [home.includes("skippedTables"), "Incomplete Task Profile semantics must be disclosed instead of guessed"],
  [home.includes("buildHomeRiskInsights"), "Home risk insights must use the deterministic insight model"],
  [home.includes("navigate(insight.deepLink)"), "Every located insight CTA must open its real evidence deep link"],
  [home.includes('navigate("/ai")'), "AI must remain an explicit optional next-step CTA"],
  [home.includes("insightsUnlocatedTitle") && home.includes("handleRefreshAll"), "Unlocated KPI risk must be disclosed and recoverable instead of guessed"],
  [home.includes("insightSourceError") && home.includes("insightsPartial"), "Partial insight source failure must be visible"],
  [!home.includes("RobotOutlined"), "Rule-based Home insights must not be branded with an AI robot icon"],
  [!i18n.includes('insights: "AI 建议"') && !i18n.includes('insights: "AI suggestions"'), "Home insight heading must match the rule-based data source"],
  [!i18n.includes("当前没有经过服务端 AI 评估的可信建议") && !i18n.includes("There are no trustworthy server-evaluated AI suggestions right now"), "Permanent no-server-AI placeholder copy must be removed"],
  [i18n.includes("实时 My Work / Task Profile 规则聚合") && i18n.includes("not AI-generated output"), "Insight provenance must explicitly describe the deterministic source"],
  [i18n.includes("Provider 未配置或暂不可用") && i18n.includes("Provider is not configured or is temporarily unavailable"), "Provider unavailability must not invalidate deterministic Home insights"],
  [homeInsights.includes("hasUnlocatedRisk") && homeInsights.includes("reportedRiskCount"), "KPI risk without evidence must remain explicit instead of fabricating a record"],
  [homeInsights.includes("riskyProject") && homeInsights.includes("riskScore"), "Project insight must select from real server aggregate risk"],
  [!home.includes('className="qtable-home-recent-card" onClick={onOpen}'), "Recent cards must not bubble one click into duplicate navigation"],
  [home.includes('message.error(homeT("recentRemoveFailed"))'), "Recent removal failure must be visible to the user"],
  [i18n.includes("projectNeedsAttention") && i18n.includes("activityStatusChanged"), "Home collaboration and project status copy must be localized"],
  [tracker.includes("qtable.recentTargets"), "Legacy recentTargets key must be recognized"],
  [tracker.includes("rememberWorkbenchRoute"), "Last workbench landing route must be recorded"],
  [tracker.includes('entityType: "record"'), "Record deep links must be persisted as recent targets"],
  [preferences.includes("last_workbench"), "Landing preference must support last visited workbench"],
  [app.includes("resolveLandingRoute"), "Root route must honor landing preference"],
  [shellPages.includes("HomeExperiencePage") && homeExperience.includes("<HomePage />"), "App Shell Home must still render the real My Work page through progressive disclosure"],
  [appShell.includes("RecentTargetTracker"), "Recent tracking must live at authenticated shell scope"],
  [css.includes("@media (max-width: 1280px)"), "Home must define 1280px responsive behavior"],
  [css.includes(":focus-visible"), "Home must preserve visible keyboard focus"],
  [!home.toLowerCase().includes("mock"), "Production Home must not contain mock data"],
  [!home.includes("fields[0]"), "Home must not infer task semantics from first field"],
  [!home.includes("getFullStore"), "Home must not download full tables to calculate aggregates"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error(`[home-my-work] FAIL: ${message}`);
  process.exit(1);
}
console.log(`[home-my-work] OK (${checks.length} checks)`);
