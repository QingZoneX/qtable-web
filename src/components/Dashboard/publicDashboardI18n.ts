import { getLanguage } from "../../lib/i18nRuntime";

const zhCN = {
  loading: "正在加载公开仪表盘...",
  unavailableTitle: "公开仪表盘不可用",
  unavailableSubtitle: "链接可能已关闭、已失效，或发布者当前已无权访问相关数据。",
  reload: "重新加载",
  widgetFilename: "组件",
  exportDataFailed: "导出失败，数据源当前不可用",
  exportImageFailed: "导出图片失败",
  publicDashboard: "公开仪表盘",
  refreshData: "刷新数据",
  emptyDashboard: "当前仪表盘暂无已发布组件",
  widgetDetails: "组件详情",
  untitledWidget: "未命名组件",
  exitFullscreen: "退出全屏",
  fullscreen: "全屏查看",
  exportImage: "导出图片",
  exportExcel: "导出 Excel",
  dataUnavailable: "数据暂不可用",
  dataUnavailableSubtitle: "发布者权限或数据源可能已发生变化。",
  retry: "重试",
  noData: "暂无符合条件的数据",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  loading: "Loading public dashboard...",
  unavailableTitle: "Public dashboard unavailable",
  unavailableSubtitle: "The link may have been disabled or expired, or the publisher may no longer have access to the related data.",
  reload: "Reload",
  widgetFilename: "widget",
  exportDataFailed: "Export failed because the data source is currently unavailable",
  exportImageFailed: "Failed to export image",
  publicDashboard: "Public dashboard",
  refreshData: "Refresh data",
  emptyDashboard: "This dashboard has no published widgets",
  widgetDetails: "Widget details",
  untitledWidget: "Untitled widget",
  exitFullscreen: "Exit fullscreen",
  fullscreen: "View fullscreen",
  exportImage: "Export image",
  exportExcel: "Export Excel",
  dataUnavailable: "Data unavailable",
  dataUnavailableSubtitle: "The publisher's permissions or the data source may have changed.",
  retry: "Retry",
  noData: "No matching data",
};

export type PublicDashboardMessageKey = keyof typeof zhCN;

export function publicDashboardT(key: PublicDashboardMessageKey): string {
  return getLanguage() === "en-US" ? enUS[key] : zhCN[key];
}
