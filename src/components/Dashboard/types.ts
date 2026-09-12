/** 仪表盘小组件类型 */
export type DashboardWidgetType =
  | "bar"
  | "line"
  | "pie"
  | "horizontalBar"
  | "table"
  | "metric"
  | "progress";

/** 网格布局位置/尺寸 */
export type WidgetLayout = { x: number; y: number; w: number; h: number };

/** 数据筛选条件 */
export type WidgetFilter = {
  fieldId: string;
  operator: string;
  value?: unknown;
};

/** 小组件展示配置；服务端会持久化，并对公开 payload 做白名单透出。 */
export type WidgetDisplayConfig = {
  showLegend?: boolean;
  showLabels?: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

/** 小组件数据配置 */
export type WidgetConfig = {
  tableId?: string | null;
  dimensionFieldId?: string | null;
  metric?: { aggregation?: string; fieldId?: string | null };
  filters?: WidgetFilter[];
  sort?: { by?: string; order?: string };
  limit?: number;
  /** 进度条目标值 */
  targetValue?: number;
  display?: WidgetDisplayConfig;
};

/** 仪表盘小组件 */
export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title?: string;
  colorScheme?: unknown;
  layout: WidgetLayout;
  config?: WidgetConfig;
};

/** 仪表盘数据 */
export type DashboardPayload = {
  id: string;
  name: string;
  description?: string;
  isPublic?: boolean;
  publicToken?: string | null;
  widgets: DashboardWidget[];
};

/** 单个小组件的查询数据 */
export type WidgetDataPayload = {
  rows: { dimension?: unknown; value?: unknown }[];
  metric?: { fieldId?: string | null; aggregation?: string };
  dimensionFieldId?: string | null;
};

/** 工作区树节点 */
export type WorkspaceNode = {
  type: "folder" | "table" | "dashboard";
  id: string;
  name: string;
  defaultViewId?: string;
  children?: WorkspaceNode[];
};
