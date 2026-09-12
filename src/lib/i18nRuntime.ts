import {
  getLanguage as getCoreLanguage,
  setLanguage as setCoreLanguage,
  t as coreTranslate,
} from "./i18n";

export type Language = ReturnType<typeof getCoreLanguage>;

export const SUPPORTED_LANGUAGES: readonly Language[] = ["zh-CN", "en-US"];
export const LANGUAGE_STORAGE_KEY = "qtable.language";

const supplementalTranslations: Record<Language, Record<string, string>> = {
  "zh-CN": {
    "filter.where": "条件",
    "filter.and": "且",
    "shell.skipToMain": "跳转到主要内容",
    "shell.nav.main": "主导航",
    "shell.nav.product": "产品导航",
    "shell.nav.utility": "工具导航",
    "shell.home": "工作台",
    "shell.tables": "数据表",
    "shell.dashboards": "仪表盘",
    "shell.projects": "项目",
    "shell.automations": "自动化",
    "shell.ai": "AI 助手",
    "shell.notifications": "通知",
    "shell.recycleBin": "回收站",
    "shell.settings": "设置",
    "shell.help": "帮助中心",
    "shell.members": "成员与权限",
    "shell.sourceInbox": "来源收件箱",
    "shell.workbench": "QTable 工作台",
    "shell.currentLocation": "当前位置",
    "shell.workspace": "工作区",
    "shell.workspaceLoading": "正在加载工作区…",
    "shell.ownedWorkspaces": "我的工作区",
    "shell.invitedWorkspaces": "受邀工作区",
    "shell.loading": "正在加载…",
    "shell.pageLoading": "页面加载中",
    "shell.workspaceLoadFailed": "工作区加载失败",
    "shell.workspaceManage": "管理工作区",
    "shell.workspaceSwitch": "切换工作区",
    "shell.workspaceSelect": "选择工作区",
    "shell.dashboard": "仪表盘",
    "shell.table": "数据表",
    "shell.expandDataNav": "展开数据导航",
    "shell.collapseDataNav": "收起数据导航",
    "shell.globalSearch": "全局搜索",
    "shell.searchPlaceholder": "搜索项目、数据表、任务或记录",
    "shell.helpAndShortcuts": "帮助与快捷操作",
    "shell.user": "用户",
    "shell.userMenu": "用户菜单",
    "shell.logout": "退出登录",
    "shell.language": "语言",
    "shell.languageZhCN": "简体中文",
    "shell.languageEnUS": "English",
    "shell.offline": "网络连接已断开。已加载的内容仍可浏览，写入操作可能需要在恢复连接后重试。",
    "shell.selectTable": "请选择左侧工作区中的数据表或仪表盘",
    "shell.forbiddenTitle": "没有权限访问",
    "shell.forbiddenSubtitle": "请确认当前账号已加入该工作区，并具备访问此内容所需的权限。",
    "shell.notFoundTitle": "页面不存在",
    "shell.notFoundSubtitle": "该页面可能已移动、删除，或链接地址不完整。",
    "error.title": "页面出错了",
    "error.subtitle": "当前视图渲染失败，请重试；若反复出现可刷新页面。",
    "error.reload": "刷新页面",
    "error.retry": "重试",
    "error.details": "错误详情",
    "smartTable.viewLoading": "正在加载视图…",
    "smartTable.tableSubtitle": "数据表",
    "smartTable.recordLoadFailed": "数据加载失败，请稍后重试",
    "smartTable.noDisplayData": "暂无可显示的数据",
    "smartTable.recordDetail": "记录详情",
    "grid.fieldAdded": "字段已新增",
    "grid.fieldUpdated": "字段已更新",
    "grid.insertRowFailed": "新增记录失败，请稍后重试",
    "grid.insertedRows": "已新增 {count} 行",
    "grid.cellCopied": "单元格内容已复制",
    "grid.rowUrlCopied": "行链接已复制",
    "grid.rowCopied": "行数据已复制",
    "grid.confirmDeleteRow": "确认删除该行？",
    "grid.delete": "删除",
    "grid.cancel": "取消",
    "grid.rowDeleted": "记录已删除",
    "grid.noFields": "当前数据表没有字段",
    "grid.noFieldsHint": "请先添加一个字段，再开始新增记录。",
    "grid.addField": "添加字段",
    "grid.rowDetail": "行详情",
    "common.ok": "确定",
    "common.cancel": "取消",
    "common.save": "保存",
    "common.delete": "删除",
    "common.clear": "清除",
    "common.close": "关闭",
    "common.create": "创建",
    "common.send": "发送",
    "common.retry": "重试",
    "common.search": "搜索",
    "common.edit": "编辑",
    "common.inputPlaceholder": "请输入内容",
    "common.selectPlaceholder": "请选择",
    "common.searchPlaceholder": "输入关键字搜索",
    "common.optionalPlaceholder": "可选，留空表示不设置",
    "common.createAndOpen": "创建并打开",
    "common.confirmRun": "确认真实执行",
    "common.sendInvite": "发送邀请",
    "common.deletePermanently": "永久删除",
    "common.leave": "退出",
    "fields.namePlaceholder": "输入字段名",
    "fields.valuePlaceholder": "输入数值",
    "fields.optionPlaceholder": "输入选项名称",
    "fields.formulaPlaceholder": "输入公式表达式",
    "dashboard.deleteTitle": "删除“{name}”？",
    "dashboard.deleteContent": "该操作使用当前服务端删除语义。删除后将无法从仪表盘中心打开此项。",
    "dashboard.deleteWidgetTitle": "删除组件",
    "dashboard.deleteWidgetContent": "确认删除该组件？",
    "workspace.leaveTitle": "确认退出工作区？",
    "workspace.leaveContent": "退出后将失去该工作区访问权限。",
    "workspace.left": "已退出工作区",
    "grid.deleteColumnTitle": "删除列",
    "grid.deleteColumnContent": "确定删除「{name}」列吗？",
    "grid.columnDeleted": "列已删除",
    "kanban.semanticRepair": "业务语义配置需要修复",
    "kanban.semanticRequired": "看板需要显式业务语义",
    "kanban.configureSemantic": "配置业务语义",
    "kanban.moveRollbackDetail": "{message}。看板已恢复到服务端确认前的顺序。",
    "kanban.moveRollback": "移动失败，看板已回滚",
    "kanban.collapseSaveFailed": "列折叠状态保存失败",
    "kanban.configInitialized": "看板服务端配置已初始化",
    "kanban.configInitFailed": "初始化看板失败",
    "kanban.profileMissing": "当前表没有保存 Task Profile。QTable 不会通过字段名称猜测标题、状态、负责人或日期。",
    "kanban.profileInvalid": "已保存的 Task Profile 当前无效，请修复失效字段后再使用看板。",
    "kanban.statusMissing": "看板必须在 Task Profile 中显式映射一个状态字段。",
    "kanban.serverConfigUnavailable": "看板服务端配置尚不可用",
    "kanban.initializeFromProfile": "使用 Task Profile 初始化",
    "kanban.title": "看板",
    "kanban.laneCount": "{count} 个泳道",
    "kanban.columnCount": "{count} 个状态列",
    "kanban.serverPaged": "服务端分页",
    "kanban.refresh": "刷新",
    "kanban.settings": "看板设置",
    "kanban.semantic": "业务语义",
    "kanban.configMismatch": "当前看板分组字段与 Task Profile 的状态字段不一致。保存一次看板设置即可统一业务语义。",
    "kanban.fixConfig": "修复配置",
    "kanban.laneCollapsed": "泳道已折叠，点击左侧展开",
    "kanban.addRecord": "添加记录",
    "kanban.loadMore": "加载更多",
    "kanban.loading": "加载中…",
    "kanban.noRecords": "暂无记录",
    "kanban.moreActions": "更多操作",
    "kanban.moveToColumn": "移动到 {column}",
    "kanban.none": "未分配",
    "kanban.openRecord": "打开记录 {title}",
    "kanban.duePrefix": "到期：",
    "kanban.drawerTitle": "看板设置",
    "kanban.readonlyDrawer": "当前权限只能查看看板设置，不能修改。",
    "kanban.groupField": "状态分组字段",
    "kanban.groupFieldHelp": "列来自这个单选状态字段。建议与 Task Profile 的状态字段保持一致。",
    "kanban.laneField": "泳道字段",
    "kanban.laneFieldHelp": "可选。设置后会按第二维字段拆成泳道。",
    "kanban.cardFields": "卡片补充字段",
    "kanban.cardFieldsHelp": "标题和状态由 Task Profile 提供，这里只选择卡片上额外展示的字段。",
    "kanban.hideCompleted": "隐藏已完成列",
    "kanban.hideCompletedHelp": "已完成状态来自 Task Profile 的 completedStatusValues。",
    "kanban.cardOrder": "卡片排序",
    "kanban.manual": "手动排序",
    "kanban.auto": "按服务端排序",
    "kanban.cancel": "取消",
    "kanban.save": "保存",
    "kanban.saved": "看板设置已保存",
    "kanban.saveFailed": "看板设置保存失败",
    "kanban.noLaneGrouping": "不使用泳道",
    "kanban.laneByAssignee": "按负责人分泳道",
    "kanban.memberField": "成员",
    "kanban.singleSelectField": "单选",
    "kanban.unnamedRecord": "未命名记录",
    "kanban.assignee": "负责人",
    "kanban.overduePrefix": "已逾期 · ",
    "kanban.todayPrefix": "今天 · ",
    "kanban.progressLabel": "进度",
    "kanban.cellLabel": "{column}，{count} 条记录",
    "kanban.retry": "重试",
    "kanban.remaining": "还剩 {count} 条",
    "kanban.addToColumn": "在 {column} 新增记录",
    "kanban.expandColumn": "展开 {column}",
    "kanban.collapseColumn": "折叠 {column}",
  },
  "en-US": {
    "filter.where": "Where",
    "filter.and": "And",
    "shell.skipToMain": "Skip to main content",
    "shell.nav.main": "Main navigation",
    "shell.nav.product": "Product navigation",
    "shell.nav.utility": "Utility navigation",
    "shell.home": "Home",
    "shell.tables": "Tables",
    "shell.dashboards": "Dashboards",
    "shell.projects": "Projects",
    "shell.automations": "Automations",
    "shell.ai": "AI Assistant",
    "shell.notifications": "Notifications",
    "shell.recycleBin": "Recycle Bin",
    "shell.settings": "Settings",
    "shell.help": "Help Center",
    "shell.members": "Members & Permissions",
    "shell.sourceInbox": "Source Inbox",
    "shell.workbench": "QTable Workspace",
    "shell.currentLocation": "Current location",
    "shell.workspace": "Workspace",
    "shell.workspaceLoading": "Loading workspace…",
    "shell.ownedWorkspaces": "My Workspaces",
    "shell.invitedWorkspaces": "Invited Workspaces",
    "shell.loading": "Loading…",
    "shell.pageLoading": "Page loading",
    "shell.workspaceLoadFailed": "Failed to load workspaces",
    "shell.workspaceManage": "Manage Workspaces",
    "shell.workspaceSwitch": "Switch workspace",
    "shell.workspaceSelect": "Select workspace",
    "shell.dashboard": "Dashboard",
    "shell.table": "Table",
    "shell.expandDataNav": "Expand data navigation",
    "shell.collapseDataNav": "Collapse data navigation",
    "shell.globalSearch": "Global search",
    "shell.searchPlaceholder": "Search projects, tables, tasks, or records",
    "shell.helpAndShortcuts": "Help & shortcuts",
    "shell.user": "User",
    "shell.userMenu": "User menu",
    "shell.logout": "Log out",
    "shell.language": "Language",
    "shell.languageZhCN": "简体中文",
    "shell.languageEnUS": "English",
    "shell.offline": "The network connection is offline. Loaded content remains available, but writes may need to be retried after reconnecting.",
    "shell.selectTable": "Select a table or dashboard from the workspace navigation on the left",
    "shell.forbiddenTitle": "Access denied",
    "shell.forbiddenSubtitle": "Confirm that this account belongs to the workspace and has permission to access this content.",
    "shell.notFoundTitle": "Page not found",
    "shell.notFoundSubtitle": "The page may have moved, been deleted, or the link may be incomplete.",
    "error.title": "Something went wrong",
    "error.subtitle": "This view failed to render. Try again, or reload the page if it keeps happening.",
    "error.reload": "Reload Page",
    "error.retry": "Try Again",
    "error.details": "Error Details",
    "smartTable.viewLoading": "Loading view…",
    "smartTable.tableSubtitle": "Table",
    "smartTable.recordLoadFailed": "Failed to load data. Please retry.",
    "smartTable.noDisplayData": "No data to display",
    "smartTable.recordDetail": "Record details",
    "grid.fieldAdded": "Field added",
    "grid.fieldUpdated": "Field updated",
    "grid.insertRowFailed": "Failed to add record. Please retry.",
    "grid.insertedRows": "Added {count} rows",
    "grid.cellCopied": "Cell content copied",
    "grid.rowUrlCopied": "Row link copied",
    "grid.rowCopied": "Row data copied",
    "grid.confirmDeleteRow": "Delete this row?",
    "grid.delete": "Delete",
    "grid.cancel": "Cancel",
    "grid.rowDeleted": "Record deleted",
    "grid.noFields": "This table has no fields",
    "grid.noFieldsHint": "Add a field before creating records.",
    "grid.addField": "Add field",
    "grid.rowDetail": "Row details",
    "common.ok": "OK",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.clear": "Clear",
    "common.close": "Close",
    "common.create": "Create",
    "common.send": "Send",
    "common.retry": "Retry",
    "common.search": "Search",
    "common.edit": "Edit",
    "common.inputPlaceholder": "Enter a value",
    "common.selectPlaceholder": "Select an option",
    "common.searchPlaceholder": "Type to search",
    "common.optionalPlaceholder": "Optional — leave empty to unset",
    "common.createAndOpen": "Create and open",
    "common.confirmRun": "Confirm real run",
    "common.sendInvite": "Send invitation",
    "common.deletePermanently": "Delete permanently",
    "common.leave": "Leave",
    "fields.namePlaceholder": "Enter field name",
    "fields.valuePlaceholder": "Enter a number",
    "fields.optionPlaceholder": "Enter option label",
    "fields.formulaPlaceholder": "Enter a formula",
    "dashboard.deleteTitle": "Delete \"{name}\"?",
    "dashboard.deleteContent": "This uses the current server-side delete semantics. Once deleted, it can no longer be opened from Dashboard Center.",
    "dashboard.deleteWidgetTitle": "Delete widget",
    "dashboard.deleteWidgetContent": "Delete this widget?",
    "workspace.leaveTitle": "Leave this workspace?",
    "workspace.leaveContent": "You will lose access to this workspace after leaving.",
    "workspace.left": "You have left the workspace",
    "grid.deleteColumnTitle": "Delete column",
    "grid.deleteColumnContent": "Delete the \"{name}\" column?",
    "grid.columnDeleted": "Column deleted",
    "kanban.semanticRepair": "Business semantics need attention",
    "kanban.semanticRequired": "Kanban requires explicit business semantics",
    "kanban.configureSemantic": "Configure business semantics",
    "kanban.moveRollbackDetail": "{message}. The board has been restored to the last server-confirmed order.",
    "kanban.moveRollback": "Move failed. The board has been rolled back.",
    "kanban.collapseSaveFailed": "Failed to save column collapse state",
    "kanban.configInitialized": "Server-side Kanban configuration initialized",
    "kanban.configInitFailed": "Failed to initialize Kanban",
    "kanban.profileMissing": "This table has no saved Task Profile. QTable does not infer title, status, assignee, or date semantics from field names.",
    "kanban.profileInvalid": "The saved Task Profile is currently invalid. Repair missing fields before using Kanban.",
    "kanban.statusMissing": "Kanban requires an explicitly mapped status field in Task Profile.",
    "kanban.serverConfigUnavailable": "Server-side Kanban configuration is unavailable",
    "kanban.initializeFromProfile": "Initialize from Task Profile",
    "kanban.title": "Kanban",
    "kanban.laneCount": "{count} lanes",
    "kanban.columnCount": "{count} status columns",
    "kanban.serverPaged": "Server paged",
    "kanban.refresh": "Refresh",
    "kanban.settings": "Kanban settings",
    "kanban.semantic": "Business semantics",
    "kanban.configMismatch": "The Kanban grouping field differs from the Task Profile status field. Save Kanban settings once to align the semantics.",
    "kanban.fixConfig": "Fix configuration",
    "kanban.laneCollapsed": "Lane collapsed. Select the label on the left to expand it.",
    "kanban.addRecord": "Add record",
    "kanban.loadMore": "Load more",
    "kanban.loading": "Loading…",
    "kanban.noRecords": "No records",
    "kanban.moreActions": "More actions",
    "kanban.moveToColumn": "Move to {column}",
    "kanban.none": "Unassigned",
    "kanban.openRecord": "Open record {title}",
    "kanban.duePrefix": "Due: ",
    "kanban.drawerTitle": "Kanban settings",
    "kanban.readonlyDrawer": "Your current permission can view Kanban settings but cannot change them.",
    "kanban.groupField": "Status grouping field",
    "kanban.groupFieldHelp": "Columns come from this single-select status field. Keep it aligned with the Task Profile status field.",
    "kanban.laneField": "Lane field",
    "kanban.laneFieldHelp": "Optional. When set, the board is split into lanes using a second dimension.",
    "kanban.cardFields": "Additional card fields",
    "kanban.cardFieldsHelp": "Title and status come from Task Profile. Select only additional fields to show on each card.",
    "kanban.hideCompleted": "Hide completed columns",
    "kanban.hideCompletedHelp": "Completed statuses come from Task Profile completedStatusValues.",
    "kanban.cardOrder": "Card ordering",
    "kanban.manual": "Manual ordering",
    "kanban.auto": "Server ordering",
    "kanban.cancel": "Cancel",
    "kanban.save": "Save",
    "kanban.saved": "Kanban settings saved",
    "kanban.saveFailed": "Failed to save Kanban settings",
    "kanban.noLaneGrouping": "No lane grouping",
    "kanban.laneByAssignee": "Lane by assignee",
    "kanban.memberField": "Member",
    "kanban.singleSelectField": "Single select",
    "kanban.unnamedRecord": "Untitled record",
    "kanban.assignee": "Assignee",
    "kanban.overduePrefix": "Overdue · ",
    "kanban.todayPrefix": "Today · ",
    "kanban.progressLabel": "Progress",
    "kanban.cellLabel": "{column}, {count} records",
    "kanban.retry": "Retry",
    "kanban.remaining": "{count} remaining",
    "kanban.addToColumn": "Add record to {column}",
    "kanban.expandColumn": "Expand {column}",
    "kanban.collapseColumn": "Collapse {column}",
  },
};

const listeners = new Set<() => void>();

export function normalizeLanguage(value?: string | null): Language | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized === "zh-cn" || normalized.startsWith("zh-hans") || normalized === "zh") {
    return "zh-CN";
  }
  if (normalized === "en-us" || normalized.startsWith("en-") || normalized === "en") {
    return "en-US";
  }
  return null;
}

function readStoredLanguage(): Language | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readBrowserLanguage(): Language | null {
  if (typeof navigator === "undefined") return null;
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const candidate of candidates) {
    const resolved = normalizeLanguage(candidate);
    if (resolved) return resolved;
  }
  return null;
}

let currentLanguage: Language =
  readStoredLanguage() ?? readBrowserLanguage() ?? "zh-CN";

function syncDocumentLanguage(language: Language) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

setCoreLanguage(currentLanguage);
syncDocumentLanguage(currentLanguage);

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(
  language: Language,
  options: { persist?: boolean } = {},
) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return;
  const changed = currentLanguage !== language;
  currentLanguage = language;
  setCoreLanguage(language);
  syncDocumentLanguage(language);

  if (options.persist !== false && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable in privacy/sandboxed contexts; locale still applies in-memory.
    }
  }

  if (changed) {
    listeners.forEach((listener) => listener());
  }
}

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function interpolate(template: string, variables?: Record<string, string | number>) {
  if (!variables) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = variables[name];
    return value === undefined ? match : String(value);
  });
}

export function t(
  key: string,
  variables?: Record<string, string | number>,
): string {
  const supplemental =
    supplementalTranslations[currentLanguage]?.[key] ??
    supplementalTranslations["zh-CN"]?.[key];
  return interpolate(supplemental ?? coreTranslate(key), variables);
}

export function getSupplementalTranslationKeys(language: Language): string[] {
  return Object.keys(supplementalTranslations[language]).sort();
}

export function formatLocaleNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(currentLanguage, options).format(value);
}

export function formatLocaleDate(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(currentLanguage, options).format(date);
}
