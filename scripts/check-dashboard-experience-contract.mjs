import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const entry = read("src/components/DashboardWorkbench.tsx");
const core = read("src/components/DashboardWorkbenchCore.tsx");
const shell = read("src/components/Dashboard/DashboardExperienceShell.tsx");
const card = read("src/components/Dashboard/DashboardWidgetCard.tsx");
const content = read("src/components/Dashboard/WidgetContent.tsx");
const dashboardI18n = read("src/components/Dashboard/dashboardI18n.ts");
const chartRenderModel = read("src/components/Dashboard/chartRenderModel.ts");
const utils = read("src/components/Dashboard/utils.ts");
const css = read("src/components/Dashboard/dashboardExperience.css");
const homeExperienceCss = read("src/components/Home/homeExperience.css");

const checks = [
  [entry.includes("DashboardExperienceShell"), "Dashboard route must render the experience shell"],
  [core.includes("CREATE_DASHBOARD_WIDGET") && core.includes("ENSURE_DASHBOARD_PUBLIC_TOKEN"), "Existing widget CRUD/share core must be preserved"],
  [core.includes("ResponsiveGridLayout") && core.includes("onResizeStop"), "Existing responsive layout persistence must be preserved"],
  [shell.includes('useState<DashboardExperienceMode>("view")'), "Dashboard must default to stable view mode"],
  [shell.includes("permissionAllows") && shell.includes('value: "edit"'), "Edit mode must be permission-gated"],
  [shell.includes("GET_TABLE_DATA") && shell.includes("filterTableId") && shell.includes("filterFieldId"), "Global filters must use real table field metadata"],
  [
    shell.includes("runtimeFilters") &&
      shell.includes('dashboardT("filters.help")') &&
      dashboardI18n.includes('"filters.help": "服务端运行时筛选') &&
      dashboardI18n.includes("Server-side runtime filters"),
    "Global filter bar must disclose server runtime semantics",
  ],
  [shell.includes("setRuntimeFilters([])"), "Global filters must support explicit reset"],
  [card.includes("DashboardWidgetDataWithRuntimeFilters") && card.includes("runtimeFilters: $runtimeFilters"), "Widget data query must send runtime filters to the server"],
  [card.includes("DASHBOARD_WIDGET_DATA") && card.includes("hasRuntimeFilters ? DASHBOARD_WIDGET_DATA_WITH_RUNTIME_FILTERS : DASHBOARD_WIDGET_DATA"), "Unfiltered widgets must stay compatible with the legacy widget-data query during rolling upgrades"],
  [
    card.includes("runtimeFilterUnsupported") &&
      card.includes('dashboardT("widget.error.runtimeFilterUnsupported")') &&
      dashboardI18n.includes('"widget.error.runtimeFilterUnsupported": "当前服务端版本尚未支持仪表盘全局筛选') &&
      dashboardI18n.includes("does not support dashboard global filters yet"),
    "Runtime-filter schema mismatch must be explained instead of presenting a generic chart failure",
  ],
  [card.includes("widgetErrorDescription") && !card.includes("description={error?.message}"), "Widget errors must be classified instead of rendering raw backend exception text"],
  [
    card.includes('dashboardT("widget.error.sourceMissing")') &&
      card.includes('dashboardT("widget.checkConfig")') &&
      dashboardI18n.includes('"widget.error.sourceMissing": "组件引用的数据源已经不存在') &&
      dashboardI18n.includes('"widget.checkConfig": "检查配置"'),
    "Missing-source/config errors must give editors an actionable repair path",
  ],
  [
    card.includes('title={dashboardT("widget.loadFailed")}') &&
      !card.includes('message={dashboardT("widget.loadFailed")}'),
    "Dashboard Alert must use the current AntD title API",
  ],
  [card.includes("runtimeFiltersForTable") && card.includes("widget.config?.tableId"), "Filters must only project onto widgets using the same source table"],
  [card.includes('mode === "edit"') && card.includes("effectiveCanEdit"), "Widget configuration must be disabled in view mode"],
  [card.includes("exportCurrentRows") && card.includes("rows.map"), "Filtered Excel export must use the rows currently rendered"],
  [
    card.includes('aria-label={dashboardT("widget.configureAria", { title })}') &&
      card.includes('aria-label={dashboardT("widget.moreActionsAria", { title })}') &&
      dashboardI18n.includes('"widget.configureAria": "配置 {title}"') &&
      dashboardI18n.includes('"widget.moreActionsAria": "{title} 更多操作"'),
    "Icon-only widget actions must have accessible names",
  ],
  [
    content.includes("aggregationLabel") &&
      content.includes('dashboardT("content.realtimeAggregation"') &&
      dashboardI18n.includes('"content.realtimeAggregation": "{aggregation} · 实时聚合"') &&
      dashboardI18n.includes("{aggregation} · live aggregation"),
    "KPI cards must state their real aggregation semantics",
  ],
  [
    content.includes('dashboardT("content.achieved")') &&
      content.includes('dashboardT("content.inProgress")') &&
      dashboardI18n.includes('"content.achieved": "已达成"') &&
      dashboardI18n.includes('"content.inProgress": "进行中"'),
    "Progress state must not rely on color alone",
  ],
  [
    content.includes('dashboardT("content.resultRows", { count: displayRows.length })') &&
      dashboardI18n.includes('"content.resultRows": "当前结果 {count} 行"') &&
      dashboardI18n.includes('"content.resultRows": "{count} result rows"'),
    "Table widgets must expose result row count",
  ],
  [content.includes("animation: false"), "Live Dashboard charts must disable stale animation timelines during rapid refreshes"],
  [content.includes("dashboardChartRenderRevision") && content.includes("key={`${widget.id}:${chartRenderRevision}`}"), "Chart data/type changes must recreate the VChart instance instead of relying on stale updateSpec marks"],
  [chartRenderModel.includes("rows.map") && chartRenderModel.includes("type") && chartRenderModel.includes("palette") && chartRenderModel.includes("showLabels"), "Chart render revision must cover data, chart type, palette, and display inputs"],
  [utils.includes('direction: "horizontal"') && utils.includes('xField: "value"') && utils.includes('yField: "dimension"'), "Horizontal bar charts must retain numeric-x/category-y field mapping"],
  [utils.includes('xField: "dimension"') && utils.includes('yField: "value"'), "Vertical bar charts must retain category-x/numeric-y field mapping"],
  [!card.includes("bordered={false}") && !content.includes("bordered={false}"), "Touched Dashboard surfaces must not use deprecated AntD Tag bordered API"],
  [utils.includes("tooltip: { visible: true }") && utils.includes("showLegend") && utils.includes("showLabels"), "Charts must share tooltip/legend/label behavior"],
  [utils.includes("truncateDashboardLabel"), "Long chart/table labels must have a bounded presentation"],
  [css.includes("flex: 1 1 0%") && css.includes("width: 100%") && css.includes("max-width: 100%"), "Dashboard experience must fill the workbench flex viewport on wide screens"],
  [css.includes(".qtable-dashboard-core-wrap") && css.includes("overflow: hidden"), "Dashboard core must not shrink to intrinsic content width"],
  [css.includes('data-dashboard-mode="view"') && css.includes("react-resizable-handle"), "View mode must disable resize affordances"],
  [css.includes("@media (max-width: 1024px)"), "Dashboard analysis controls must have 1024px responsive behavior"],
  [homeExperienceCss.includes(".qtable-home-experience .qtable-home-page") && homeExperienceCss.includes("max-width: none") && homeExperienceCss.includes("width: 100%"), "Home must use the available AppShell width instead of a centered 1480px cap"],
  [!homeExperienceCss.includes("width: min(1480px, 100%)"), "Home onboarding must not reintroduce the 1480px wide-screen cap"],
  [!shell.toLowerCase().includes("mock"), "Dashboard experience must not contain mock data"],
  [!content.includes("环比") && !content.includes("同比"), "KPI UI must not invent period comparisons without a server contract"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error(`[dashboard-experience] FAIL: ${message}`);
  process.exit(1);
}
console.log(`[dashboard-experience] OK (${checks.length} checks)`);
