export type GoalWorkspaceOption = {
  id: string;
  label: string;
  color?: string;
};

export type GoalWorkspaceField = {
  key: string;
  name: string;
  type: string;
  options?: GoalWorkspaceOption[];
  property?: Record<string, unknown>;
};

export type GoalWorkspaceView = {
  key: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
};

export type GoalWorkspaceTable = {
  key: string;
  name: string;
  description?: string;
  fields: GoalWorkspaceField[];
  views: GoalWorkspaceView[];
};

export type GoalWorkspaceWidget = {
  key: string;
  type: string;
  title: string;
  tableKey: string;
  dimensionFieldKey?: string;
  metric?: {
    aggregation?: string;
    fieldKey?: string;
    [key: string]: unknown;
  };
  layout?: Record<string, unknown>;
};

export type GoalWorkspaceDashboard = {
  key: string;
  name: string;
  description?: string;
  widgets: GoalWorkspaceWidget[];
};

export type GoalWorkspaceNextAction = {
  id: string;
  label: string;
  action: string;
};

export type GoalWorkspaceBlueprint = {
  version: number;
  projectName: string;
  rationale?: string;
  contextSummary?: string;
  folder?: {
    create?: boolean;
    name?: string;
  };
  tables: GoalWorkspaceTable[];
  dashboards: GoalWorkspaceDashboard[];
  nextActions: GoalWorkspaceNextAction[];
};

export type GoalWorkspacePreview = {
  traceId: string;
  generationMode: "ai" | "fallback" | string;
  warnings: string[];
  blueprint: GoalWorkspaceBlueprint;
};

export type GoalWorkspaceCreatedTable = {
  key: string;
  id: string;
  name: string;
  defaultViewId?: string | null;
};

export type GoalWorkspaceApplyResult = {
  traceId: string;
  status: string;
  idempotent?: boolean;
  created: {
    folder?: { id: string; name: string } | null;
    tables: GoalWorkspaceCreatedTable[];
    dashboards: Array<{ key: string; id: string; name: string }>;
    nextActions: GoalWorkspaceNextAction[];
  };
};
