import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const app = read("src/App.tsx");
const primaryRail = read("src/components/AppShell/PrimaryRail.tsx");
const topBar = read("src/components/AppShell/TopAppBar.tsx");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const shellCss = read("src/components/AppShell/appShell.css");
const palette = read("src/components/GlobalCommandPalette.tsx");

const visibleRailRoutes = [
  "home",
  "tables",
  "dashboards",
  "projects",
  "automations",
  "ai",
  "notifications",
  "recycle-bin",
  "settings",
];

for (const route of visibleRailRoutes) {
  assert.ok(
    primaryRail.includes(`route: "/${route}"`),
    `PrimaryRail must expose the expected /${route} route`,
  );
  assert.ok(
    app.includes(`path="${route}"`),
    `App router must resolve the visible /${route} route`,
  );
}

assert.ok(
  topBar.includes('key: "help"') && topBar.includes('navigate("/help")'),
  "TopAppBar must expose the Help entry",
);
assert.ok(app.includes('path="help"'), "App router must resolve the visible /help route");
assert.ok(
  palette.includes("navigate(item.deepLink)"),
  "Global Command Palette results must continue to navigate through real deep links",
);

const shellMappings = [
  "HomeShellPage = HomeExperiencePage",
  "DashboardsShellPage = DashboardCenterPage",
  "ProjectsShellPage = ProjectsCenterPage",
  "AutomationsShellPage = AutomationCenterPage",
  "AiShellPage = AiCenterPage",
  "NotificationsShellPage = NotificationCenterPage",
  "RecycleBinShellPage = RecycleBinPage",
  "SettingsShellPage = SettingsCenterPage",
  "HelpShellPage = HelpCenterPage",
];
for (const mapping of shellMappings) {
  assert.ok(
    shellPages.includes(mapping),
    `Shell page must be backed by a real surface: ${mapping}`,
  );
}

const collectSourceFiles = (directory) => {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...collectSourceFiles(path));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(name)) files.push(path);
  }
  return files;
};

for (const path of collectSourceFiles(join(root, "src"))) {
  const source = readFileSync(path, "utf8");
  assert.ok(
    !source.includes("PlannedSurfacePage"),
    `release-visible source must not contain PlannedSurfacePage: ${path.slice(root.length)}`,
  );
}

assert.ok(
  !shellCss.includes("qtable-shell-planned"),
  "obsolete planned-surface styles must not remain reusable in the AppShell",
);

for (const forbidden of [
  "Coming Soon",
  "coming soon",
  "后续逐步收口",
  "这里将承载",
]) {
  assert.ok(
    !shellPages.includes(forbidden),
    `ShellPages must not use planned placeholder copy: ${forbidden}`,
  );
}

console.log("navigation release gate: OK");
