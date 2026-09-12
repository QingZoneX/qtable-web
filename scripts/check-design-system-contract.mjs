import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[design-system] ${message}`);
  process.exitCode = 1;
};

const tokens = read("src/styles/tokens.ts");
const app = read("src/App.tsx");
const appCss = read("src/App.css");
const indexCss = read("src/index.css");
const vtableTheme = read("src/components/SmartTable/config/theme.ts");

for (const required of [
  "qtableTokens",
  "qtableTheme",
  "qtableCssVariables",
  "installQTableCssVariables",
]) {
  if (!tokens.includes(required)) fail(`tokens.ts is missing ${required}`);
}

const tsxFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
    } else if (entry.name.endsWith(".tsx")) {
      tsxFiles.push(absolute);
    }
  }
};
walk(path.join(root, "src"));

const configProviderOwners = tsxFiles
  .filter((file) => fs.readFileSync(file, "utf8").includes("<ConfigProvider"))
  .map((file) => path.relative(root, file));

if (configProviderOwners.length !== 1 || configProviderOwners[0] !== "src/App.tsx") {
  fail(
    `ConfigProvider must be owned only by src/App.tsx; found: ${configProviderOwners.join(", ") || "none"}`,
  );
}

if (!app.includes("theme={qtableTheme}")) {
  fail("src/App.tsx must use the shared qtableTheme");
}

if (!vtableTheme.includes('from "../../../styles/tokens"')) {
  fail("VTable theme must derive from src/styles/tokens.ts");
}

if (!indexCss.includes("--color-qtable-primary: var(--qtable-color-primary)")) {
  fail("Tailwind @theme must map to QTable semantic CSS variables");
}

if (!indexCss.includes("@media (prefers-reduced-motion: reduce)")) {
  fail("Reduced-motion support is required");
}

const forbiddenCorePrimary = /#(?:1677ff|2f80ed|4f46e5|6366f1)/gi;
for (const [name, content] of [
  ["src/App.css", appCss],
  ["src/index.css", indexCss],
  ["src/components/SmartTable/config/theme.ts", vtableTheme],
]) {
  if (forbiddenCorePrimary.test(content)) {
    fail(`${name} still contains a legacy competing primary color`);
  }
  forbiddenCorePrimary.lastIndex = 0;
}

const destructiveFocusRule =
  /\.ant-btn:focus-visible\s*\{[^}]*outline:\s*none[^}]*\}/s;
if (destructiveFocusRule.test(appCss)) {
  fail("App.css must not remove the visible keyboard focus indicator");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[design-system] contract checks passed");
