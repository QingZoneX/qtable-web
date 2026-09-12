import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[app-shell] ${message}`);
  process.exitCode = 1;
};

const app = read("src/App.tsx");
const shell = read("src/components/AppShell/AppShell.tsx");
const shellCss = read("src/components/AppShell/appShell.css");
const contextSidebarCss = read("src/components/AppShell/contextSidebarLayout.css");
const sidebar = read("src/components/SmartTable/Sidebar.tsx");
const rail = read("src/components/AppShell/PrimaryRail.tsx");
const topbar = read("src/components/AppShell/TopAppBar.tsx");
const notificationBell = read("src/components/Notifications/NotificationBell.tsx");
const smartTable = read("src/components/SmartTable/index.tsx");
const dashboardEntry = read("src/components/DashboardWorkbench.tsx");
const dashboardExperience = read("src/components/Dashboard/DashboardExperienceShell.tsx");
const dashboardCore = read("src/components/DashboardWorkbenchCore.tsx");

for (const route of [
  "home",
  "tables",
  "dashboards",
  "projects",
  "automations",
  "ai",
  "notifications",
  "recycle-bin",
  "settings",
  "help",
]) {
  if (!app.includes(`path=\"${route}\"`)) {
    fail(`authenticated route /${route} is missing`);
  }
}

for (const landingContract of [
  'import { resolveLandingRoute } from "./components/Home/homePreferences"',
  'const LandingRedirect = () => <Navigate to={resolveLandingRoute()} replace />',
  '<Route index element={<LandingRedirect />} />',
]) {
  if (!app.includes(landingContract)) {
    fail(`authenticated landing route contract is missing: ${landingContract}`);
  }
}

for (const component of ["<PrimaryRail />", "<Sidebar />", "<TopAppBar"]) {
  if (!shell.includes(component)) fail(`AppShell is missing ${component}`);
}

if (!shell.includes('import "./contextSidebarLayout.css"')) {
  fail("AppShell must load the contextual-sidebar stretch contract");
}

for (const required of [
  ".qtable-context-sidebar-host",
  "display: flex",
  "align-items: stretch",
  "min-height: 0",
]) {
  if (!contextSidebarCss.includes(required)) {
    fail(`contextual sidebar layout contract is missing: ${required}`);
  }
}

if (!sidebar.includes('className="workspace-bottom-actions"')) {
  fail("workspace member/share actions must remain in the sidebar footer action group");
}

if (!shell.includes('<Suspense fallback={<RouteLoadingFallback />}>')) {
  fail("AppShell must keep its chrome mounted while lazy child routes load");
}

if (!shell.includes("navigator.onLine") || !shell.includes('window.addEventListener("offline"')) {
  fail("AppShell must expose non-blocking offline state");
}

for (const key of [
  "shell.workbench",
  "shell.home",
  "shell.tables",
  "shell.dashboards",
  "shell.projects",
  "shell.automations",
  "shell.ai",
  "shell.notifications",
  "shell.recycleBin",
  "shell.settings",
]) {
  if (!rail.includes(`t("${key}")`)) fail(`PrimaryRail is missing navigation i18n key: ${key}`);
}

if (!rail.includes('route: "/ai"')) {
  fail("AI entry must be a valid route on every authenticated surface");
}

for (const required of [
  "openGlobalCommandPalette",
  "NotificationBell",
  "QuestionCircleOutlined",
  "workspaceItems",
  'aria-label={t("shell.userMenu")}',
  'navigate("/help")',
]) {
  if (!topbar.includes(required)) fail(`TopAppBar contract is missing: ${required}`);
}

for (const required of [
  "BellOutlined",
  "Badge",
  "overflowCount={99}",
  "useNotificationRealtime",
  'navigate("/notifications")',
]) {
  if (!notificationBell.includes(required)) {
    fail(`NotificationBell contract is missing: ${required}`);
  }
}

if (!app.includes("<SmartTable embedded />") || !app.includes("<DashboardWorkbench embedded />")) {
  fail("workbench routes must render embedded surfaces inside the shared AppShell");
}

if (!app.includes('path="workbench/:tableId/:viewId"')) {
  fail("legacy table/view deep links must remain supported");
}

if (!app.includes('path="dashboard/:dashboardId"')) {
  fail("legacy dashboard deep links must remain supported");
}

if (!smartTable.includes("if (embedded) return content")) {
  fail("SmartTable must support embedded rendering inside AppShell");
}

const dashboardEntryPassesEmbedded =
  dashboardEntry.includes("DashboardExperienceShell") &&
  dashboardEntry.includes("embedded={embedded}");
const dashboardExperiencePassesEmbedded =
  dashboardExperience.includes("DashboardWorkbenchCore") &&
  dashboardExperience.includes("embedded={embedded}");
const dashboardCoreSupportsEmbedded = dashboardCore.includes("if (embedded) return content");
if (
  !dashboardEntryPassesEmbedded ||
  !dashboardExperiencePassesEmbedded ||
  !dashboardCoreSupportsEmbedded
) {
  fail("DashboardWorkbench must preserve the embedded render chain inside AppShell");
}

for (const responsiveRule of [
  "@media (max-width: 1279px)",
  "@media (max-width: 1099px)",
]) {
  if (!shellCss.includes(responsiveRule)) {
    fail(`responsive shell rule is missing: ${responsiveRule}`);
  }
}

if (!shellCss.includes("width: 64px") || !shellCss.includes("height: var(--qtable-size-app-bar)")) {
  fail("primary rail and top app bar must use stable shell dimensions");
}

if (process.exitCode) process.exit(process.exitCode);
console.log("[app-shell] contract checks passed");