import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const page = read("src/components/Settings/SettingsCenterPage.tsx");
const preferences = read("src/components/Home/homePreferences.ts");
const members = read("src/components/WorkspaceMembersPage.tsx");
const vite = read("vite.config.ts");
const packageJson = JSON.parse(read("package.json"));

assert.ok(
  shellPages.includes("export const SettingsShellPage = SettingsCenterPage;"),
  "/settings must route to the real SettingsCenterPage",
);
assert.ok(
  !shellPages.includes("设置入口已统一；工作区、个人偏好与产品级配置将在后续设置页面中逐步收口"),
  "settings planned-surface copy must not remain user-visible",
);

for (const realCapability of [
  "getLandingPreference",
  "setLandingPreference",
  "useWorkspaceExperienceMode",
  "useWorkspaceAccess",
  "GET_WORKSPACES",
  "GET_AI_CONFIGS",
  "AiConfigModal",
]) {
  assert.ok(page.includes(realCapability), `Settings Center must reuse ${realCapability}`);
}

assert.ok(
  page.includes("仅保存在此浏览器"),
  "browser-only landing preference scope must be explicit",
);
assert.ok(
  page.includes("API Key 不会从服务端回显"),
  "AI secret non-disclosure must be explicit",
);
assert.ok(
  page.includes("__QTABLE_UI_VERSION__"),
  "About must show the build-injected QTableUI version",
);
assert.ok(
  vite.includes("readFileSync(new URL('./package.json', import.meta.url)"),
  "build version must come from package.json instead of a duplicated literal",
);
assert.ok(
  vite.includes("'__QTABLE_UI_VERSION__': JSON.stringify(qtableUiVersion)"),
  "Vite must inject the package-derived version constant",
);
assert.equal(packageJson.version, "0.1.0-alpha", "release package version must remain expected");

assert.ok(
  preferences.includes("export const setLandingPreference = (value: LandingPreference): boolean"),
  "landing preference write must return an acknowledgement",
);
assert.ok(
  preferences.includes("if (!storage) return false") && preferences.includes("return false;"),
  "landing preference write must expose unavailable/storage failure",
);

assert.ok(
  members.includes("copyTextToClipboard(link)"),
  "Workspace share must use the verified clipboard helper",
);
assert.ok(
  members.includes("message.error(result.error)"),
  "Workspace share failure must show a real error",
);
assert.ok(
  !members.includes('catch {\n      message.success("分享链接已复制")'),
  "Workspace share must never report clipboard failure as success",
);

assert.ok(!page.includes("Math.random"), "Settings Center must not use mock settings");
assert.ok(!page.includes("Connector 即将推出"), "Settings Center must not advertise fake future connectors");

console.log("settings center contract: OK");
