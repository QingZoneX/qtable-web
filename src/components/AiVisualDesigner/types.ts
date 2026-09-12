export type AiVisualTargetType = "view" | "dashboard";

export type AiVisualEditableView = {
  tableId: string;
  name: string;
  type: "grid" | "board" | "gantt" | "calendar" | "gallery";
  filters: Array<{
    fieldId: string;
    operator: string;
    value?: unknown;
    logic: "where" | "and" | "or";
  }>;
  sorts: Array<{ fieldId: string; order: "asc" | "desc" }>;
  groupConfig: { fieldId?: string | null; order: "asc" | "desc" };
  visibleFieldIds: string[];
  ganttConfig?: Record<string, unknown> | null;
  calendarConfig?: Record<string, unknown> | null;
  galleryConfig?: Record<string, unknown> | null;
};

export type AiVisualEditableWidget = {
  key: string;
  type:
    | "bar"
    | "line"
    | "pie"
    | "horizontalBar"
    | "table"
    | "metric"
    | "progress";
  title: string;
  tableId: string;
  dimensionFieldId?: string | null;
  metric: { aggregation: string; fieldId?: string | null };
  filters: Array<Record<string, unknown>>;
  sort: Record<string, unknown>;
  limit: number;
  layout: Record<string, unknown>;
  targetValue?: number | null;
  purpose?: string;
};

export type AiVisualEditableProposal =
  | {
      kind: "view";
      rationale?: string;
      view: AiVisualEditableView;
      dashboard?: null;
    }
  | {
      kind: "dashboard";
      rationale?: string;
      view?: null;
      dashboard: {
        name: string;
        description?: string;
        widgets: AiVisualEditableWidget[];
      };
    };

export type AiVisualNormalizedView = {
  tableId: string;
  name: string;
  type: string;
  config: {
    filters?: Array<Record<string, unknown>>;
    sorts?: Array<Record<string, unknown>>;
    groupConfig?: Record<string, unknown>;
    hiddenFieldIds?: string[];
    [key: string]: unknown;
  };
  explanation?: {
    filters?: Array<Record<string, unknown>>;
    sorts?: Array<Record<string, unknown>>;
    groupFieldName?: string | null;
    visibleFieldCount?: number;
  };
};

export type AiVisualNormalizedWidget = {
  key: string;
  type: string;
  title: string;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  purpose?: string;
  source?: {
    tableId?: string;
    tableName?: string;
    dimensionFieldName?: string | null;
    metricFieldName?: string | null;
    aggregation?: string;
  };
};

export type AiVisualPreview = {
  planId: string;
  traceId: string;
  generationMode: "ai" | "deterministic-fallback" | string;
  provider?: string;
  model?: string | null;
  warnings?: string[];
  proposal: {
    kind: AiVisualTargetType;
    rationale?: string;
    view?: AiVisualNormalizedView | null;
    dashboard?: {
      name: string;
      description?: string;
      widgets: AiVisualNormalizedWidget[];
      mode?: string;
    } | null;
  };
  editableProposal: AiVisualEditableProposal;
  performance: {
    schemaOnly: boolean;
    recordRowsScanned: number;
    sourceTableCount: number;
    dashboardWidgetsUseServerAggregation?: boolean;
    relationFieldsAvoided?: boolean;
  };
  target: {
    type: AiVisualTargetType;
    tableId?: string | null;
    dashboardId?: string | null;
    parentId?: string | null;
  };
};

export type AiVisualApplyResult = {
  planId: string;
  traceId: string;
  status: string;
  targetType: AiVisualTargetType;
  view?: {
    id: string;
    tableId: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
  } | null;
  dashboard?: {
    id: string;
    name: string;
    description?: string;
    mode?: string;
    widgets?: Array<Record<string, unknown>>;
  } | null;
  idempotent?: boolean;
};
