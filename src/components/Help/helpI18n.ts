import { getLanguage } from "../../lib/i18nRuntime";

const zhCN = {
  scopeGlobal: "全局",
  scopeSearch: "搜索内",
  title: "帮助中心",
  lead: "这里仅列出当前版本已经存在的快捷键、产品入口、开源文档和反馈渠道。",
  openSearch: "打开全局搜索",
  shortcutsTitle: "快捷操作",
  shortcutsSubtitle: "只展示当前代码真实支持的键盘行为。",
  guidesTitle: "产品使用指南",
  guidesSubtitle: "外部文档不可用时，这些本地说明仍可直接阅读。",
  open: "打开",
  docs: "文档",
  reopenOnboarding: "重新打开引导",
  resourcesTitle: "开源文档",
  resourcesSubtitle: "仅链接 QingZoneX/QTable 与 QingZoneX/QTableUI 的公开发布资料，不包含内部地址。",
  openResource: "打开 {title}",
  feedbackTitle: "反馈与支持",
  feedbackSubtitle: "反馈模板只预填当前前端版本，不读取浏览器信息，也不附带任何工作区或业务数据。",
  bugTitle: "报告问题",
  bugDescription: "请提供版本、浏览器、复现步骤、预期结果与实际结果。",
  newBug: "新建 Bug Issue",
  featureTitle: "功能建议",
  featureDescription: "请描述要解决的问题、期望体验与可接受的替代方案。",
  newFeature: "新建 Feature Issue",
  beforeSubmitting: "提交前请检查",
  privacy: "不要粘贴 access token、API Key、密码、私有 workspace/table/record 内容或包含敏感信息的截图。",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  scopeGlobal: "Global",
  scopeSearch: "In search",
  title: "Help Center",
  lead: "This page only documents shortcuts, product surfaces, open-source resources, and support paths available in the current build.",
  openSearch: "Open global search",
  shortcutsTitle: "Shortcuts",
  shortcutsSubtitle: "Only keyboard behavior implemented by the current codebase is shown.",
  guidesTitle: "Product guides",
  guidesSubtitle: "These local instructions remain available even when external documentation cannot be reached.",
  open: "Open",
  docs: "Docs",
  reopenOnboarding: "Reopen the tour",
  resourcesTitle: "Open-source resources",
  resourcesSubtitle: "Links are limited to public release-facing resources for QingZoneX/QTable and QingZoneX/QTableUI. Internal addresses are not included.",
  openResource: "Open {title}",
  feedbackTitle: "Feedback & support",
  feedbackSubtitle: "Templates prefill only the frontend version and never collect browser, workspace, or business data automatically.",
  bugTitle: "Report a bug",
  bugDescription: "Include the version, browser, reproduction steps, expected result, and actual result.",
  newBug: "Create Bug Issue",
  featureTitle: "Feature request",
  featureDescription: "Describe the problem, desired experience, and acceptable alternatives.",
  newFeature: "Create Feature Issue",
  beforeSubmitting: "Before submitting",
  privacy: "Do not paste access tokens, API keys, passwords, private workspace/table/record content, or screenshots containing sensitive information.",
};

export type HelpMessageKey = keyof typeof zhCN;

export function helpT(
  key: HelpMessageKey,
  variables?: Record<string, string | number>,
): string {
  let value = getLanguage() === "en-US" ? enUS[key] : zhCN[key];
  if (variables) {
    for (const [name, replacement] of Object.entries(variables)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}
