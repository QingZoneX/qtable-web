import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error(`[ui-quality] ${message}`);
  process.exit(1);
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const runtime = read("src/lib/i18nRuntime.ts");
const app = read("src/App.tsx");
const shell = read("src/components/AppShell/AppShell.tsx");
const primaryRail = read("src/components/AppShell/PrimaryRail.tsx");
const topBar = read("src/components/AppShell/TopAppBar.tsx");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const globalCss = read("src/index.css");
const shellQualityCss = read("src/components/AppShell/accessibilityResponsive.css");
const kanban = read("src/components/SmartTable/views/KanbanView.tsx");
const kanbanCell = read("src/components/SmartTable/views/kanban/KanbanCell.tsx");
const kanbanCard = read("src/components/SmartTable/views/kanban/KanbanCard.tsx");
const kanbanSettings = read("src/components/SmartTable/views/kanban/BoardSettingsDrawer.tsx");
const kanbanCss = read("src/components/SmartTable/views/kanban/kanban.css");

expect(
  runtime.includes('SUPPORTED_LANGUAGES: readonly Language[] = ["zh-CN", "en-US"]'),
  "locale runtime must explicitly support zh-CN and en-US",
);
expect(
  runtime.includes('LANGUAGE_STORAGE_KEY = "qtable.language"') &&
    runtime.includes("window.localStorage.getItem") &&
    runtime.includes("window.localStorage.setItem"),
  "manual locale selection must persist in localStorage",
);
expect(
  runtime.includes("navigator.languages") && runtime.includes("navigator.language"),
  "locale runtime must fall back to browser language preferences",
);
expect(
  runtime.includes("document.documentElement.lang = language") &&
    runtime.includes("subscribeLanguage") &&
    runtime.includes("setCoreLanguage"),
  "locale changes must update document semantics and notify React subscribers",
);
expect(
  runtime.includes("Intl.NumberFormat") && runtime.includes("Intl.DateTimeFormat"),
  "locale runtime must expose locale-aware number/date formatting",
);

const zhStart = runtime.indexOf('"zh-CN": {');
const enStart = runtime.indexOf('"en-US": {');
const translationEnd = runtime.indexOf("\n  },\n};", enStart);
expect(zhStart >= 0 && enStart > zhStart && translationEnd > enStart, "cannot locate supplemental translation tables");
const zhBlock = runtime.slice(zhStart, enStart);
const enBlock = runtime.slice(enStart, translationEnd);
const keyPattern = /^\s*"([^"]+)"\s*:/gm;
const keys = (block) => {
  const found = new Set();
  for (const match of block.matchAll(keyPattern)) {
    if (match[1] !== "zh-CN" && match[1] !== "en-US") found.add(match[1]);
  }
  return found;
};
const zhKeys = keys(zhBlock);
const enKeys = keys(enBlock);
const missingEnglish = [...zhKeys].filter((key) => !enKeys.has(key));
const missingChinese = [...enKeys].filter((key) => !zhKeys.has(key));
expect(
  missingEnglish.length === 0 && missingChinese.length === 0,
  `supplemental locale keys drifted: missingEnglish=${missingEnglish.join(",")}, missingChinese=${missingChinese.join(",")}`,
);

expect(
  app.includes('import enUS from "antd/locale/en_US"') &&
    app.includes('import zhCN from "antd/locale/zh_CN"') &&
    app.includes("dayjs.locale") &&
    app.includes("locale={language === \"zh-CN\" ? zhCN : enUS}"),
  "Ant Design and dayjs must follow the active QTable locale",
);
expect(
  topBar.includes("setLanguage(key as Language)") &&
    topBar.includes('aria-label={t("shell.language")}'),
  "the app bar must expose an accessible manual language switcher",
);
expect(
  primaryRail.includes('aria-current={active ? "page" : undefined}') &&
    primaryRail.includes('aria-label={t("shell.nav.main")}'),
  "primary navigation must expose localized navigation semantics",
);

expect(
  shell.includes('href="#qtable-main-content"') &&
    shell.includes('id="qtable-main-content"') &&
    shell.includes("tabIndex={-1}"),
  "shell must provide a keyboard skip link to the focusable main landmark",
);
expect(
  shellPages.includes('role="status"') && shellPages.includes('aria-live="polite"'),
  "async route fallback must expose a polite status to assistive technology",
);
expect(
  globalCss.includes(":focus-visible") &&
    globalCss.includes("outline: 2px solid") &&
    globalCss.includes("@media (prefers-reduced-motion: reduce)"),
  "global CSS must preserve keyboard focus indication and reduced-motion behavior",
);

expect(
  shellQualityCss.includes("@media (max-width: 720px)") &&
    shellQualityCss.includes("min-width: 0") &&
    shellQualityCss.includes(".qtable-global-search-label") &&
    shellQualityCss.includes("display: none"),
  "compact shell must have an explicit <=720px overflow-safe layout",
);
expect(
  kanbanCss.includes("overflow-x: auto") || kanbanCss.includes("overflow: auto"),
  "Kanban viewport must retain horizontal overflow instead of squeezing columns",
);

for (const [source, token] of [
  [kanban, "看板需要显式业务语义"],
  [kanban, "看板服务端配置尚不可用"],
  [kanban, "泳道已折叠，点击左侧展开"],
  [kanbanCard, "更多操作"],
  [kanbanCard, "移动到 ${column.label}"],
  [kanbanCell, "暂无记录"],
]) {
  expect(!source.includes(token), `audited Kanban surface still contains legacy hardcoded copy: ${token}`);
}
for (const source of [kanbanCard, kanbanCell, kanbanSettings]) {
  expect(
    !source.includes('language === "zh-CN"'),
    "audited Kanban surfaces must use centralized translation keys instead of inline locale branches",
  );
}
expect(
  kanban.includes('t("kanban.profileMissing")') &&
    kanban.includes('t("kanban.settings")') &&
    kanbanCard.includes('t("kanban.moreActions")') &&
    kanbanCard.includes('t("kanban.unnamedRecord")') &&
    kanbanCell.includes('t("kanban.cellLabel"') &&
    kanbanSettings.includes('t("kanban.noLaneGrouping")'),
  "Kanban primary states/actions/accessibility copy must use the locale runtime",
);
expect(
  kanbanSettings.includes('aria-label={t("kanban.hideCompleted")}'),
  "Kanban settings switches must have accessible labels",
);
expect(
  kanbanCard.includes('tabIndex={0}') &&
    kanbanCard.includes('role="button"') &&
    kanbanCard.includes('event.key === "Enter"') &&
    kanbanCard.includes('event.key === " "'),
  "Kanban cards must remain keyboard-operable without pointer drag/drop",
);
expect(
  kanbanCell.includes('role="alert"') &&
    kanbanCell.includes('role="status"'),
  "Kanban async/error states must expose live assistive semantics",
);

console.log(
  `[ui-quality] OK - ${zhKeys.size} supplemental bilingual keys; shell/Kanban i18n, keyboard focus, reduced motion and compact responsive contracts verified`,
);
