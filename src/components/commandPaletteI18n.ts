import { getLanguage } from "../lib/i18nRuntime";

const zhCN = {
  "group.record": "记录与任务",
  "group.table": "数据表",
  "group.dashboard": "仪表盘",
  "group.folder": "文件夹",
  "group.workspace": "工作空间",
  "group.recent": "最近访问",
  unavailable: "全局搜索暂时不可用",
  loadMoreFailed: "加载更多失败",
  placeholder: "搜索项目、数据表、任务或记录…",
  searchFailed: "搜索失败",
  truncated: "匹配内容较多，结果已达到安全扫描上限。请增加关键词缩小范围。",
  noMatches: "没有找到可访问的匹配内容",
  noRecent: "还没有最近访问记录，开始打开一张表后这里会自动出现",
  loadMore: "加载更多",
  keyboardSelect: "↑↓ 选择",
  keyboardOpen: "Enter 打开",
  keyboardClose: "Esc 关闭",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  "group.record": "Records & tasks",
  "group.table": "Tables",
  "group.dashboard": "Dashboards",
  "group.folder": "Folders",
  "group.workspace": "Workspaces",
  "group.recent": "Recently visited",
  unavailable: "Global search is temporarily unavailable",
  loadMoreFailed: "Failed to load more results",
  placeholder: "Search projects, tables, tasks, or records…",
  searchFailed: "Search failed",
  truncated: "There are many matches and the safe scan limit has been reached. Add more keywords to narrow the results.",
  noMatches: "No accessible matches found",
  noRecent: "No recent visits yet. Open a table and it will appear here automatically.",
  loadMore: "Load more",
  keyboardSelect: "↑↓ Select",
  keyboardOpen: "Enter Open",
  keyboardClose: "Esc Close",
};

export type CommandPaletteMessageKey = keyof typeof zhCN;

export function commandPaletteT(key: CommandPaletteMessageKey): string {
  return getLanguage() === "en-US" ? enUS[key] : zhCN[key];
}
