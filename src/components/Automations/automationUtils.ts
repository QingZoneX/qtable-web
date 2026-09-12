import type {
  AutomationAction,
  AutomationConditionLeaf,
  AutomationExecution,
  AutomationField,
  AutomationTable,
  AutomationTrigger,
  WorkspaceNode,
} from "./automationTypes";
import { automationLocale, automationT } from "./automationI18n";

const DATE_FIELD_TYPES = new Set([
  "date",
  "datetime",
  "createdTime",
  "modifiedTime",
]);
const NUMERIC_FIELD_TYPES = new Set([
  "number",
  "progress",
  "rating",
  "autoNumber",
  "auto_number",
]);
const READ_ONLY_FIELD_TYPES = new Set([
  "formula",
  "autoNumber",
  "auto_number",
  "createdTime",
  "modifiedTime",
  "createdBy",
  "modifiedBy",
]);

export const flattenTables = (root?: WorkspaceNode | null): AutomationTable[] => {
  if (!root) return [];
  const result: AutomationTable[] = [];
  const walk = (node: WorkspaceNode) => {
    if (node.type === "table") result.push({ id: node.id, name: node.name });
    node.children?.forEach(walk);
  };
  walk(root);
  return result;
};

export const fieldById = (fields: AutomationField[], fieldId?: string) =>
  fields.find((field) => field.id === fieldId);

export const isDateField = (field?: AutomationField) =>
  Boolean(field && DATE_FIELD_TYPES.has(field.type));

export const isNumericField = (field?: AutomationField) =>
  Boolean(field && NUMERIC_FIELD_TYPES.has(field.type));

export const isWritableField = (field: AutomationField) =>
  !READ_ONLY_FIELD_TYPES.has(field.type);

export const isMemberField = (field?: AutomationField) => field?.type === "member";

export const operatorsForField = (field?: AutomationField) => {
  const base = [
    { label: automationT("operator.equals"), value: "equals" },
    { label: automationT("operator.notEquals"), value: "not_equals" },
    { label: automationT("operator.in"), value: "in" },
    { label: automationT("operator.notIn"), value: "not_in" },
    { label: automationT("operator.empty"), value: "empty" },
    { label: automationT("operator.notEmpty"), value: "not_empty" },
  ];
  if (!field) return base;
  if (isDateField(field) || isNumericField(field)) {
    return [
      ...base,
      { label: automationT("operator.gt"), value: "gt" },
      { label: automationT("operator.gte"), value: "gte" },
      { label: automationT("operator.lt"), value: "lt" },
      { label: automationT("operator.lte"), value: "lte" },
    ];
  }
  return [
    ...base,
    { label: automationT("operator.contains"), value: "contains" },
    { label: automationT("operator.notContains"), value: "not_contains" },
  ];
};

export const triggerLabel = (trigger: AutomationTrigger) => {
  const labels: Record<AutomationTrigger["type"], string> = {
    "record.created": automationT("trigger.recordCreated"),
    "record.updated": automationT("trigger.recordUpdated"),
    scheduled: automationT("trigger.scheduled"),
    due_date: automationT("trigger.dueDate"),
    manual: automationT("trigger.manual"),
  };
  return labels[trigger.type] || trigger.type;
};

const listSeparator = () => automationLocale() === "zh-CN" ? "、" : ", ";

export const triggerSummary = (
  trigger: AutomationTrigger,
  fields: AutomationField[] = [],
) => {
  const label = triggerLabel(trigger);
  if (trigger.type === "record.updated" && trigger.fieldIds?.length) {
    const names = trigger.fieldIds
      .map((id) => fieldById(fields, id)?.name || id)
      .join(listSeparator());
    if (Object.prototype.hasOwnProperty.call(trigger, "from") || Object.prototype.hasOwnProperty.call(trigger, "to")) {
      return `${label} · ${names} · ${String(trigger.from ?? automationT("trigger.any"))} → ${String(trigger.to ?? automationT("trigger.any"))}`;
    }
    return `${label} · ${names}`;
  }
  if (trigger.type === "scheduled") {
    return `${label} · ${automationT("trigger.everyMinutes", { count: trigger.intervalMinutes || 1 })}`;
  }
  if (trigger.type === "due_date") {
    const field = fieldById(fields, trigger.fieldId)?.name || trigger.fieldId || automationT("trigger.dateField");
    const minutes = Number(trigger.offsetMinutes || 0);
    const timing = minutes >= 1440
      ? automationT("trigger.daysBefore", { count: Math.round(minutes / 1440) })
      : minutes >= 60
        ? automationT("trigger.hoursBefore", { count: Math.round(minutes / 60) })
        : automationT("trigger.minutesBefore", { count: minutes });
    return `${label} · ${field} · ${timing}`;
  }
  return label;
};

export const actionSummary = (
  actions: AutomationAction[],
  fields: AutomationField[] = [],
) => actions
  .map((action) => {
    if (action.type === "update_record") {
      const names = Object.keys(action.fields || {})
        .map((id) => fieldById(fields, id)?.name || id)
        .join(listSeparator());
      return names
        ? `${automationT("action.updateRecord")}: ${names}`
        : automationT("action.updateRecord");
    }
    if (action.type === "create_record") {
      return automationT("action.createRecord");
    }
    const recipient = action.recipientFieldId
      ? fieldById(fields, action.recipientFieldId)?.name || action.recipientFieldId
      : automationT("action.members", { count: action.recipientUserIds?.length || 0 });
    return `${automationT("action.notify")} · ${recipient}`;
  })
  .join(" → ");

export const conditionSummary = (
  conditions: { op: "and" | "or"; items: AutomationConditionLeaf[] },
  fields: AutomationField[] = [],
) => {
  if (!conditions.items.length) return automationT("condition.none");
  const connector = conditions.op === "and" ? automationT("condition.and") : automationT("condition.or");
  return conditions.items
    .map((item) => {
      const field = fieldById(fields, item.fieldId)?.name || item.fieldId;
      const operator = operatorsForField(fieldById(fields, item.fieldId))
        .find((option) => option.value === item.operator)?.label || item.operator;
      if (["empty", "not_empty"].includes(item.operator)) return `${field} ${operator}`;
      const value = Array.isArray(item.value) ? item.value.join(" / ") : String(item.value ?? "");
      return `${field} ${operator} ${value}`;
    })
    .join(connector);
};

export const executionStatusMeta = (status?: string) => {
  const map: Record<string, { label: string; tone: string }> = {
    queued: { label: automationT("execution.queued"), tone: "default" },
    running: { label: automationT("execution.running"), tone: "processing" },
    succeeded: { label: automationT("execution.succeeded"), tone: "success" },
    skipped: { label: automationT("execution.skipped"), tone: "default" },
    failed: { label: automationT("execution.failed"), tone: "error" },
    partially_failed: { label: automationT("execution.partiallyFailed"), tone: "warning" },
    retry_scheduled: { label: automationT("execution.retryScheduled"), tone: "processing" },
  };
  return map[status || ""] || { label: status || automationT("execution.none"), tone: "default" };
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(automationLocale(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const executionDuration = (execution: AutomationExecution) => {
  if (!execution.startedAt) return "—";
  const start = new Date(execution.startedAt).getTime();
  const end = execution.finishedAt
    ? new Date(execution.finishedAt).getTime()
    : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const milliseconds = Math.max(0, end - start);
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.floor(milliseconds / 60_000)}m ${Math.round((milliseconds % 60_000) / 1000)}s`;
};

export const errorMessage = (error: unknown, fallback = automationT("error.operationFailed")) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
};

export const isPermissionError = (error: unknown) =>
  /permission|no access|unauthorized|forbidden|not found or no access/i.test(
    errorMessage(error, ""),
  );
