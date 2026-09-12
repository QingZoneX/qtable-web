import type {
  AutomationField,
  AutomationTemplate,
  AutomationTemplateId,
  RuleDraft,
} from "./automationTypes";
import { automationT } from "./automationI18n";
import { isDateField, isMemberField, isWritableField } from "./automationUtils";

export const getAutomationTemplates = (): AutomationTemplate[] => [
  {
    id: "due-reminder",
    title: automationT("template.due.title"),
    description: automationT("template.due.description"),
    badge: automationT("template.due.badge"),
  },
  {
    id: "status-notification",
    title: automationT("template.status.title"),
    description: automationT("template.status.description"),
    badge: automationT("template.status.badge"),
  },
  {
    id: "new-record-action",
    title: automationT("template.created.title"),
    description: automationT("template.created.description"),
    badge: automationT("template.created.badge"),
  },
];

// Backward-compatible export for existing callers. New UI code should call
// getAutomationTemplates() during render so language changes are reflected.
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = getAutomationTemplates();

const writableValue = (field: AutomationField) => {
  if (["number", "progress", "rating"].includes(field.type)) return 0;
  if (["checkbox", "boolean"].includes(field.type)) return false;
  return automationT("template.defaultStatus");
};

export const applyAutomationTemplate = (
  templateId: AutomationTemplateId,
  tableId: string,
  fields: AutomationField[],
): Partial<RuleDraft> => {
  const dateField = fields.find(isDateField);
  const memberField = fields.find(isMemberField);
  const writable = fields.filter(isWritableField);
  const statusField =
    writable.find((field) => /status|状态|阶段/i.test(field.name)) || writable[0];

  if (templateId === "due-reminder") {
    return {
      name: automationT("template.due.name"),
      description: automationT("template.due.ruleDescription"),
      tableId,
      trigger: {
        type: "due_date",
        fieldId: dateField?.id || "",
        offsetMinutes: 1440,
        scanIntervalMinutes: 15,
      },
      conditions: { op: "and", items: [] },
      actions: [
        {
          type: "notify",
          recipientFieldId: memberField?.id,
          recipientUserIds: memberField ? undefined : [],
          notificationType: "automation",
          message: automationT("template.due.message"),
        },
      ],
      enabled: false,
    };
  }

  if (templateId === "status-notification") {
    return {
      name: automationT("template.status.title"),
      description: automationT("template.status.ruleDescription"),
      tableId,
      trigger: {
        type: "record.updated",
        fieldIds: statusField ? [statusField.id] : [],
      },
      conditions: { op: "and", items: [] },
      actions: [
        {
          type: "notify",
          recipientFieldId: memberField?.id,
          recipientUserIds: memberField ? undefined : [],
          notificationType: "automation",
          message: automationT("template.status.message"),
        },
      ],
      enabled: false,
    };
  }

  const targetField = statusField || writable[0];
  return {
    name: automationT("template.created.name"),
    description: automationT("template.created.ruleDescription"),
    tableId,
    trigger: { type: "record.created" },
    conditions: { op: "and", items: [] },
    actions: [
      {
        type: "update_record",
        fields: targetField ? { [targetField.id]: writableValue(targetField) } : {},
      },
    ],
    enabled: false,
  };
};
