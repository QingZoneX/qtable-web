import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const shellPages = read("src/components/AppShell/ShellPages.tsx");
const page = read("src/components/Help/HelpCenterPage.tsx");
const model = read("src/components/Help/helpModel.ts");
const palette = read("src/components/GlobalCommandPalette.tsx");
const topBar = read("src/components/AppShell/TopAppBar.tsx");
const helpDoc = read("docs/help-center.md");

assert.ok(
  shellPages.includes("export const HelpShellPage = HelpCenterPage;"),
  "/help must route to the real HelpCenterPage",
);
assert.ok(
  !shellPages.includes("这里将承载快捷键、常见操作、产品文档与问题反馈入口"),
  "planned help copy must not remain user-visible",
);

assert.ok(page.includes("__QTABLE_UI_VERSION__"), "Help must display the build version");
assert.ok(
  page.includes("openGlobalCommandPalette") && page.includes("打开全局搜索 / Open search"),
  "Help must expose a real global-search CTA",
);
assert.ok(
  page.includes("反馈模板只预填当前前端版本") &&
    page.includes("不读取浏览器信息") &&
    page.includes("不附带任何工作区或业务数据"),
  "Help must state feedback privacy boundaries",
);

assert.ok(
  palette.includes('(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"'),
  "Global Search must still implement Ctrl/Cmd+K",
);
for (const key of ['"ArrowDown"', '"ArrowUp"', '"Enter"', '"Escape"']) {
  assert.ok(palette.includes(key), `Global Search must implement ${key}`);
}
for (const shortcut of ["Ctrl/⌘", "↑", "↓", "Enter", "Esc"]) {
  assert.ok(model.includes(shortcut), `Help shortcut model must document ${shortcut}`);
  assert.ok(helpDoc.includes(shortcut), `public help doc must document ${shortcut}`);
}

assert.ok(
  model.includes('new URL("https://github.com/QingZoneX/QTableUI/issues/new")'),
  "feedback must target the public-facing QTableUI GitHub Issues path",
);
assert.ok(!model.includes("navigator.userAgent"), "feedback must not collect browser UA automatically");
assert.ok(!model.includes("localStorage"), "feedback URL construction must not read local application state");
assert.ok(!model.includes("useAuthStore"), "feedback URL construction must not read auth state");

for (const forbidden of ["Coming Soon", "即将推出", "后续接入", "Math.random"]) {
  assert.ok(!page.includes(forbidden), `Help must not expose fake/planned content: ${forbidden}`);
}

for (const requiredFile of [
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "docs/task-profile-ui.md",
  "docs/help-center.md",
  "docs/releases/v0.1.0-alpha.md",
]) {
  assert.ok(
    existsSync(new URL(`../${requiredFile}`, import.meta.url)),
    `linked release resource must exist: ${requiredFile}`,
  );
}

assert.ok(
  topBar.includes('key: "help"') && topBar.includes('navigate("/help")'),
  "TopAppBar Help entry must navigate to /help",
);

console.log("help center contract: OK");
