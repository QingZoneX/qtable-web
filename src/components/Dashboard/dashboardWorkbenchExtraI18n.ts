import { getLanguage } from "../../lib/i18nRuntime";

const zhCN = {
  "palette.default": "默认",
  "palette.blue": "蓝色",
  "palette.green": "绿色",
  "palette.warm": "暖色",
  "palette.mono": "灰度",
  "filter.selectValue": "选择值",
  "sort.label": "排序",
  "sort.value": "按值",
  "sort.dimension": "按维度",
  "sort.order": "顺序",
  "sort.desc": "降序",
  "sort.asc": "升序",
  "limit.label": "展示条数",
  "target.label": "目标值",
  "target.tooltip": "进度 = 当前聚合值 / 目标值",
  "target.required": "请设置大于 0 的目标值",
  "target.placeholder": "输入目标值",
  "share.title": "分享与公开访问",
  "share.description": "描述",
  "share.saveDescription": "保存描述",
  "share.publicAccess": "公开访问",
  "share.public": "已公开",
  "share.private": "未公开",
  "share.hint": "开启后可通过链接访问",
  "share.copyLink": "复制链接",
  "fullscreen.title": "全屏查看",
  "ai.defaultPrompt": "优化当前仪表盘，让项目风险、进展和负责人负载更容易理解",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  "palette.default": "Default",
  "palette.blue": "Blue",
  "palette.green": "Green",
  "palette.warm": "Warm",
  "palette.mono": "Grayscale",
  "filter.selectValue": "Select value",
  "sort.label": "Sort by",
  "sort.value": "Value",
  "sort.dimension": "Dimension",
  "sort.order": "Order",
  "sort.desc": "Descending",
  "sort.asc": "Ascending",
  "limit.label": "Items to show",
  "target.label": "Target value",
  "target.tooltip": "Progress = current aggregate / target value",
  "target.required": "Enter a target value greater than 0",
  "target.placeholder": "Enter target value",
  "share.title": "Sharing and public access",
  "share.description": "Description",
  "share.saveDescription": "Save description",
  "share.publicAccess": "Public access",
  "share.public": "Public",
  "share.private": "Not public",
  "share.hint": "When enabled, this dashboard can be accessed through a link",
  "share.copyLink": "Copy link",
  "fullscreen.title": "Fullscreen view",
  "ai.defaultPrompt": "Improve this dashboard so project risks, progress, and owner workload are easier to understand",
};

export type DashboardWorkbenchExtraKey = keyof typeof zhCN;

export function dashboardWorkbenchExtraT(key: DashboardWorkbenchExtraKey): string {
  return getLanguage() === "en-US" ? enUS[key] : zhCN[key];
}

export function dashboardPaletteLabel(id: string, fallback: string): string {
  const key = `palette.${id}` as DashboardWorkbenchExtraKey;
  return key in zhCN ? dashboardWorkbenchExtraT(key) : fallback;
}
