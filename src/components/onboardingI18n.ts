import { getLanguage, type Language } from "../lib/i18nRuntime";

const zhCN = {
  // 重新打开引导的悬浮入口
  reopenGuide: "重新打开新手引导",

  // 引导弹窗
  welcomeTitle: "欢迎使用 QTable",
  welcomeSubtitle: "不需要先学习“多维表格怎么配置”，先选择你想完成的事情。",
  goalAlert: "目标：3 分钟内得到一个可以真正编辑和继续工作的项目",
  skip: "暂时跳过",
  demoDataTip:
    "Demo 创建的是正常 QTable 数据，不是截图；你可以直接改、删、复制或继续添加真实任务。",

  goalCardTitle: "描述我的目标",
  goalCardBody:
    "例如“我要做一个 3 人参与的博客改版项目”，后续由 AI 自动设计工作结构。",
  goalCardAction: "立即生成项目蓝图",

  demoCardTitle: "体验 Demo 项目",
  demoCardBody:
    "一键创建“个人博客改版项目”，包含 10 条任务和项目管理多视图。",
  demoCardAction: "立即创建",

  templateCardTitle: "从模板 / 数据开始",
  templateCardBody: "已经知道自己要做什么？直接使用现有模板，或继续导入已有数据。",
  templateCardAction: "使用现有能力",

  // 创建过程中的进度文案
  progressPreparingDemo: "正在准备体验空间…",
  progressInitializingWorkspace: "正在初始化工作区…",
  progressCreatingTable: "正在创建项目管理表…",
  progressWritingRows: "正在写入示例任务…",

  // 创建结果提示
  goalPrepareFailed: "无法准备目标驱动创建所需的工作空间，请稍后重试。",
  templateHint: "请点击左侧“+”，选择“从模板创建”开始。",
  demoOpened: "已打开你的 QTable Demo 项目",
  demoCreated: "Demo 已创建：你现在看到的是真实可编辑的 QTable 项目",
  demoRowsFailed:
    "Demo 表已经创建，但示例任务写入失败。表本身仍可正常编辑，不会重复创建。",
  demoFailed: "Demo 创建失败，请稍后重试。不会覆盖你已有的数据。",

  // 引导创建出来的真实数据名称
  workspaceName: "我的 QTable 空间",
  demoWorkspaceName: "QTable 体验空间",
  demoTableName: "个人博客改版项目",
  initialGoal: "我要管理一个 3 人完成的个人博客改版项目，预计 3 周完成。",

  // Demo 表里写入的 10 条示例任务标题
  demoRowGoals: "确认改版目标与成功指标",
  demoRowContentAudit: "梳理现有内容与信息架构",
  demoRowVisualDirection: "确定首页视觉方向",
  demoRowHeroNav: "重构首页 Hero 与导航",
  demoRowArticleList: "优化文章列表与标签筛选",
  demoRowArticleDetail: "补齐文章详情响应式样式",
  demoRowPerformance: "优化图片与首屏加载性能",
  demoRowSeo: "增加 SEO 与分享元信息",
  demoRowRegression: "完成多端回归测试",
  demoRowLaunchReview: "上线并复盘改版效果",

  // Demo 项目创建后的分步引导
  tourStep1Title: "1. 一个项目，多种工作视角",
  tourStep1Body:
    "同一批任务可以在表格、看板、甘特和日历之间切换，不需要维护多份数据。",
  tourStep2Title: "2. 每一行都是可执行任务",
  tourStep2Body:
    "状态、优先级、进度和日期都可以直接编辑。先把真实工作放进来，再逐步增加高级配置。",
  tourStep3Title: "3. AI 应该理解项目，而不是只生成文字",
  tourStep3Body:
    "后续可以从任务拆解、工作量估算到项目诊断，逐步把 AI 变成项目助手。",
  tourStep4Title: "4. 现在就动手改一条",
  tourStep4Body:
    "建议先把一条示例任务改成你自己的真实任务，或者切换到看板看看同一份数据的不同视角。",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  reopenGuide: "Reopen the onboarding tour",

  welcomeTitle: "Welcome to QTable",
  welcomeSubtitle:
    "You do not have to learn how a multi-dimensional table is configured first. Start by choosing what you want to accomplish.",
  goalAlert: "Goal: have a project you can genuinely edit and keep building on within 3 minutes",
  skip: "Skip for now",
  demoDataTip:
    "The demo creates regular QTable data, not screenshots. Edit, delete, copy, or keep adding real tasks.",

  goalCardTitle: "Describe my goal",
  goalCardBody:
    "For example “I want to run a blog redesign with 3 people” — AI then designs the work structure.",
  goalCardAction: "Generate the project blueprint",

  demoCardTitle: "Try a demo project",
  demoCardBody:
    "Create “Personal blog redesign” in one click, with 10 tasks and project-management views.",
  demoCardAction: "Create now",

  templateCardTitle: "Start from a template or data",
  templateCardBody:
    "Already know what you need? Use an existing template, or keep importing your own data.",
  templateCardAction: "Use existing capabilities",

  progressPreparingDemo: "Preparing the demo workspace…",
  progressInitializingWorkspace: "Initializing the workspace…",
  progressCreatingTable: "Creating the project management table…",
  progressWritingRows: "Writing sample tasks…",

  goalPrepareFailed:
    "Could not prepare the workspace required for goal-driven creation. Please try again later.",
  templateHint: "Select “+” on the left and choose “Create from template” to start.",
  demoOpened: "Your QTable demo project is open",
  demoCreated: "Demo created: what you see is a real, editable QTable project",
  demoRowsFailed:
    "The demo table was created, but writing sample tasks failed. The table is still editable and will not be created twice.",
  demoFailed:
    "Failed to create the demo. Please try again later. Your existing data is not overwritten.",

  workspaceName: "My QTable workspace",
  demoWorkspaceName: "QTable demo workspace",
  demoTableName: "Personal blog redesign",
  initialGoal:
    "I need to manage a personal blog redesign delivered by 3 people in about 3 weeks.",

  demoRowGoals: "Confirm redesign goals and success metrics",
  demoRowContentAudit: "Audit existing content and information architecture",
  demoRowVisualDirection: "Decide the homepage visual direction",
  demoRowHeroNav: "Rebuild the homepage hero and navigation",
  demoRowArticleList: "Improve the article list and tag filtering",
  demoRowArticleDetail: "Complete responsive styles for article detail",
  demoRowPerformance: "Optimize images and first-paint performance",
  demoRowSeo: "Add SEO and share metadata",
  demoRowRegression: "Finish cross-device regression testing",
  demoRowLaunchReview: "Launch and review the redesign results",

  tourStep1Title: "1. One project, many working views",
  tourStep1Body:
    "The same tasks switch between grid, kanban, gantt and calendar without maintaining multiple copies of the data.",
  tourStep2Title: "2. Every row is an actionable task",
  tourStep2Body:
    "Status, priority, progress and dates are directly editable. Put real work in first, then layer on advanced configuration.",
  tourStep3Title: "3. AI should understand the project, not just generate text",
  tourStep3Body:
    "From task breakdown and effort estimation to project diagnosis, AI gradually becomes a project assistant.",
  tourStep4Title: "4. Edit one row right now",
  tourStep4Body:
    "Turn one sample task into your own real task, or switch to Kanban to see the same data from another angle.",
};

export type OnboardingMessageKey = keyof typeof zhCN;

/** 取当前（或指定）语言的完整词表；需要在 memo 中按语言重算时可直接用它。 */
export function onboardingCatalog(
  language: Language = getLanguage(),
): Record<OnboardingMessageKey, string> {
  return language === "en-US" ? enUS : zhCN;
}

export function onboardingT(
  key: OnboardingMessageKey,
  variables?: Record<string, string | number>,
): string {
  let value = onboardingCatalog()[key];
  if (variables) {
    for (const [name, replacement] of Object.entries(variables)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

/**
 * Demo 表以名称作为幂等键。名称会跟随界面语言，所以查找必须同时接受两种语言，
 * 否则用户切换语言后再次点击「体验 Demo 项目」会重复创建一张表。
 */
export const ONBOARDING_DEMO_TABLE_NAMES: readonly string[] = [
  zhCN.demoTableName,
  enUS.demoTableName,
];
