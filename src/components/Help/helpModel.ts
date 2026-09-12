export type HelpShortcut = {
  id: string;
  keys: string[];
  titleZh: string;
  titleEn: string;
  detailZh: string;
  detailEn: string;
  scope: "global" | "search";
};

export type HelpResource = {
  id: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  url: string;
};

export type HelpGuide = {
  id: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  route?: string;
  resourceUrl?: string;
};

export const HELP_SHORTCUTS: HelpShortcut[] = [
  {
    id: "global-search",
    keys: ["Ctrl/⌘", "K"],
    titleZh: "打开或关闭全局搜索",
    titleEn: "Toggle global search",
    detailZh: "从任意已登录页面搜索可访问的工作区、数据表、仪表盘、任务与记录。",
    detailEn: "Search accessible workspaces, tables, dashboards, tasks and records from any authenticated page.",
    scope: "global",
  },
  {
    id: "search-move",
    keys: ["↑", "↓"],
    titleZh: "移动搜索结果选择",
    titleEn: "Move through search results",
    detailZh: "仅在全局搜索弹窗中生效。",
    detailEn: "Available while the global search dialog is open.",
    scope: "search",
  },
  {
    id: "search-open",
    keys: ["Enter"],
    titleZh: "打开当前搜索结果",
    titleEn: "Open the selected result",
    detailZh: "使用结果自带的真实 deep link 导航。",
    detailEn: "Navigates using the result's real deep link.",
    scope: "search",
  },
  {
    id: "search-close",
    keys: ["Esc"],
    titleZh: "关闭全局搜索",
    titleEn: "Close global search",
    detailZh: "关闭搜索弹窗，不修改任何业务数据。",
    detailEn: "Closes the search dialog without changing business data.",
    scope: "search",
  },
];

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "tables",
    titleZh: "数据表与多视图",
    titleEn: "Tables and views",
    descriptionZh: "从数据表入口选择工作区内容。Grid、Kanban、Gantt、Calendar 与 Gallery 都建立在同一张表的服务端数据之上。",
    descriptionEn: "Open workspace content from Tables. Grid, Kanban, Gantt, Calendar and Gallery share the same server-backed table data.",
    route: "/tables",
    resourceUrl: "https://github.com/QingZoneX/QTableUI#readme",
  },
  {
    id: "task-profile",
    titleZh: "Task Profile / 业务语义",
    titleEn: "Task Profile semantics",
    descriptionZh: "在数据表 Header 的“业务语义”中配置标题、状态、负责人、日期等字段映射；建议只进入草稿，显式确认后才会保存。",
    descriptionEn: "Configure title, status, assignee and date mappings from the table header. Suggestions stay in a draft until explicitly confirmed.",
    route: "/tables",
    resourceUrl: "https://github.com/QingZoneX/QTableUI/blob/main/docs/task-profile-ui.md",
  },
  {
    id: "ai",
    titleZh: "AI 助手",
    titleEn: "AI Assistant",
    descriptionZh: "AI 能力使用当前可见数据与权限边界；涉及业务写入时继续遵循 Preview → Confirm → Apply，不把建议伪装成已执行结果。",
    descriptionEn: "AI respects visible data and permission boundaries. Business writes keep the Preview → Confirm → Apply flow instead of presenting suggestions as applied results.",
    route: "/ai",
    resourceUrl: "https://github.com/QingZoneX/QTable#ai-configuration",
  },
  {
    id: "automation",
    titleZh: "自动化",
    titleEn: "Automation",
    descriptionZh: "自动化中心使用真实规则、启停状态、测试执行与历史记录；配置或执行失败会保留错误状态，不以本地假成功替代服务端结果。",
    descriptionEn: "Automation Center uses real rules, enablement state, test runs and execution history. Failures remain visible instead of being replaced by local success state.",
    route: "/automations",
    resourceUrl: "https://github.com/QingZoneX/QTableUI/blob/main/docs/help-center.md#automation--自动化",
  },
];

export const HELP_RESOURCES: HelpResource[] = [
  {
    id: "getting-started",
    titleZh: "README / Getting Started",
    titleEn: "README / Getting Started",
    descriptionZh: "本地开发、前端架构、质量门禁与运行要求。",
    descriptionEn: "Local development, frontend architecture, quality gates and runtime requirements.",
    url: "https://github.com/QingZoneX/QTableUI#readme",
  },
  {
    id: "self-hosting",
    titleZh: "一键自托管",
    titleEn: "One-command self-hosting",
    descriptionZh: "QTable API + QTableUI + PostgreSQL + Redis 的 Docker Compose 部署说明。",
    descriptionEn: "Docker Compose guidance for QTable API, QTableUI, PostgreSQL and Redis.",
    url: "https://github.com/QingZoneX/QTable#one-command-self-hosted-stack",
  },
  {
    id: "help-reference",
    titleZh: "产品帮助参考",
    titleEn: "Product help reference",
    descriptionZh: "快捷键、数据表、Task Profile、AI、Automation 与反馈隐私说明。",
    descriptionEn: "Shortcuts, tables, Task Profile, AI, Automation and feedback privacy guidance.",
    url: "https://github.com/QingZoneX/QTableUI/blob/main/docs/help-center.md",
  },
  {
    id: "security",
    titleZh: "安全策略",
    titleEn: "Security policy",
    descriptionZh: "漏洞报告、安全边界与敏感信息处理要求。",
    descriptionEn: "Vulnerability reporting, security boundaries and sensitive-data handling.",
    url: "https://github.com/QingZoneX/QTableUI/blob/main/SECURITY.md",
  },
  {
    id: "contributing",
    titleZh: "参与贡献",
    titleEn: "Contributing",
    descriptionZh: "开发流程、质量要求与提交 Pull Request 的约定。",
    descriptionEn: "Development workflow, quality requirements and pull-request conventions.",
    url: "https://github.com/QingZoneX/QTableUI/blob/main/CONTRIBUTING.md",
  },
  {
    id: "license",
    titleZh: "Apache-2.0 License",
    titleEn: "Apache-2.0 License",
    descriptionZh: "QTableUI 的开源许可证全文。",
    descriptionEn: "The full open-source license for QTableUI.",
    url: "https://github.com/QingZoneX/QTableUI/blob/main/LICENSE",
  },
  {
    id: "release-notes",
    titleZh: "v0.1.0-alpha Release Notes",
    titleEn: "v0.1.0-alpha Release Notes",
    descriptionZh: "当前 Alpha / Open Source Preview 的版本说明。",
    descriptionEn: "Release notes for the current Alpha / Open Source Preview.",
    url: "https://github.com/QingZoneX/QTableUI/blob/main/docs/releases/v0.1.0-alpha.md",
  },
];

const feedbackVersion = (version: string) => {
  const normalized = version.trim().replace(/[^A-Za-z0-9._+-]/g, "").slice(0, 64);
  return normalized || "unknown";
};

export const buildFeedbackUrl = (
  kind: "bug" | "feature",
  version: string,
): string => {
  const url = new URL("https://github.com/QingZoneX/QTableUI/issues/new");
  const currentVersion = feedbackVersion(version);

  if (kind === "bug") {
    url.searchParams.set("title", "[Bug] ");
    url.searchParams.set(
      "body",
      [
        "### QTableUI version / 版本",
        currentVersion,
        "",
        "### Browser / 浏览器",
        "<!-- Example: Chrome 140 / macOS. Please fill this manually. -->",
        "",
        "### Steps to reproduce / 复现步骤",
        "1. ",
        "2. ",
        "3. ",
        "",
        "### Expected behavior / 预期结果",
        "",
        "### Actual behavior / 实际结果",
        "",
        "### Additional context / 补充信息",
        "<!-- Do not include access tokens, API keys, passwords, or private workspace/table/record data. -->",
      ].join("\n"),
    );
  } else {
    url.searchParams.set("title", "[Feature] ");
    url.searchParams.set(
      "body",
      [
        "### QTableUI version / 版本",
        currentVersion,
        "",
        "### Problem / 要解决的问题",
        "",
        "### Proposed experience / 期望体验",
        "",
        "### Alternatives / 可选方案",
        "",
        "### Additional context / 补充信息",
        "<!-- Do not include access tokens, API keys, passwords, or private workspace/table/record data. -->",
      ].join("\n"),
    );
  }

  return url.toString();
};
