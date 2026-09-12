export type WorkspaceNode = {
  type: "folder" | "table" | "dashboard";
  id: string;
  name: string;
  defaultViewId?: string;
  children?: WorkspaceNode[];
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  rootId?: string;
};

export type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

export type AutomationTable = {
  id: string;
  name: string;
};

export type AutomationField = {
  id: string;
  name: string;
  type: string;
  options?: unknown;
  property?: Record<string, unknown> | null;
};

export type AutomationTrigger = {
  type: "record.created" | "record.updated" | "scheduled" | "due_date" | "manual";
  fieldIds?: string[];
  fieldId?: string;
  from?: unknown;
  to?: unknown;
  intervalMinutes?: number;
  offsetMinutes?: number;
  scanIntervalMinutes?: number;
};

export type AutomationConditionLeaf = {
  fieldId: string;
  operator: string;
  value?: unknown;
};

export type AutomationConditions = {
  op: "and" | "or";
  items: AutomationConditionLeaf[];
};

export type AutomationAction = {
  type: "update_record" | "create_record" | "notify";
  fields?: Record<string, unknown>;
  recipientUserIds?: number[];
  recipientFieldId?: string;
  notificationType?: string;
  message?: string;
};

export type AutomationRule = {
  id: string;
  workspaceId: string;
  tableId: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  timezone: string;
  maxRetries: number;
  version: number;
  runAsUserId?: number | null;
  requiredPermission: string;
  nextRunAt?: string | null;
  createdByUserId?: number | null;
  updatedByUserId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AutomationExecution = {
  id: string;
  automationId: string;
  automationVersion: number;
  triggerEventId?: string | null;
  rootEventId?: string | null;
  parentExecutionId?: string | null;
  recordId?: string | null;
  depth: number;
  status: string;
  traceId?: string | null;
  attempt: number;
  actionResults: Array<Record<string, unknown>>;
  changeSetIds: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
  nextRetryAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AutomationExecutionPage = {
  items: AutomationExecution[];
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type AutomationValidationResult = {
  valid: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  timezone: string;
  maxRetries: number;
};

export type AutomationPreview = {
  automationId: string;
  automationVersion: number;
  recordId?: string | null;
  conditionMatch: boolean;
  willExecute: boolean;
  requiredPermission: string;
  actionSummaries: Array<Record<string, unknown>>;
};

export type AutomationTemplateId =
  | "due-reminder"
  | "status-notification"
  | "new-record-action";

export type AutomationTemplate = {
  id: AutomationTemplateId;
  title: string;
  description: string;
  badge: string;
};

export type RuleDraft = {
  name: string;
  description: string;
  tableId: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  timezone: string;
  maxRetries: number;
};
