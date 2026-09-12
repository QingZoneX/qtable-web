import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { WorkspaceMember } from "../../hooks/useWorkspaceAccess";
import { FieldValueInput } from "./FieldValueInput";
import { automationT } from "./automationI18n";
import type {
  AutomationAction,
  AutomationConditionLeaf,
  AutomationConditions,
  AutomationField,
  AutomationTrigger,
} from "./automationTypes";
import {
  fieldById,
  isDateField,
  isMemberField,
  isWritableField,
  operatorsForField,
} from "./automationUtils";

const triggerOptions = () => [
  { label: automationT("trigger.recordCreated"), value: "record.created" },
  { label: automationT("trigger.recordUpdated"), value: "record.updated" },
  { label: automationT("trigger.scheduled"), value: "scheduled" },
  { label: automationT("trigger.dueDateShort"), value: "due_date" },
  { label: automationT("trigger.manual"), value: "manual" },
];

const actionOptions = () => [
  { label: automationT("action.updateCurrentRecord"), value: "update_record" },
  { label: automationT("action.createNewRecord"), value: "create_record" },
  { label: automationT("action.notify"), value: "notify" },
];

const notificationTypes = () => [
  { label: automationT("notification.automation"), value: "automation" },
  { label: automationT("notification.due3d"), value: "due_3d" },
  { label: automationT("notification.due24h"), value: "due_24h" },
  { label: automationT("notification.taskAssigned"), value: "task_assigned" },
  { label: automationT("notification.aiActionRequired"), value: "ai_action_required" },
  { label: automationT("notification.automationFailed"), value: "automation_failed" },
];

function triggerForType(
  type: AutomationTrigger["type"],
  fields: AutomationField[],
): AutomationTrigger {
  const dateField = fields.find(isDateField);
  if (type === "scheduled") return { type, intervalMinutes: 60 };
  if (type === "due_date") {
    return {
      type,
      fieldId: dateField?.id || "",
      offsetMinutes: 1440,
      scanIntervalMinutes: 15,
    };
  }
  if (type === "record.updated") return { type, fieldIds: [] };
  return { type };
}

function defaultAutomationAction(
  type: AutomationAction["type"],
  fields: AutomationField[],
): AutomationAction {
  const writable = fields.find(isWritableField);
  const member = fields.find(isMemberField);
  if (type === "notify") {
    return {
      type,
      recipientFieldId: member?.id,
      recipientUserIds: member ? undefined : [],
      notificationType: "automation",
      message: automationT("editor.notification.default"),
    };
  }
  return {
    type,
    fields: writable ? { [writable.id]: "" } : {},
  };
}

export function AutomationTriggerSection({
  trigger,
  fields,
  members,
  onChange,
}: {
  trigger: AutomationTrigger;
  fields: AutomationField[];
  members: WorkspaceMember[];
  onChange: (trigger: AutomationTrigger) => void;
}) {
  const dateFields = fields.filter(isDateField);
  const patch = (next: Partial<AutomationTrigger>) =>
    onChange({ ...trigger, ...next } as AutomationTrigger);

  return (
    <>
      <Select
        className="qtable-automation-trigger-select"
        value={trigger.type}
        options={triggerOptions()}
        onChange={(value) =>
          onChange(triggerForType(value as AutomationTrigger["type"], fields))
        }
      />

      {trigger.type === "record.updated" ? (
        <div className="qtable-automation-trigger-config">
          <label>
            <span>{automationT("editor.trigger.watchFields")}</span>
            <Select
              mode="multiple"
              value={trigger.fieldIds || []}
              options={fields.map((field) => ({ label: field.name, value: field.id }))}
              placeholder={automationT("editor.trigger.watchAny")}
              onChange={(fieldIds) =>
                patch(
                  fieldIds.length === 1
                    ? { fieldIds }
                    : { fieldIds, from: undefined, to: undefined },
                )
              }
            />
          </label>
          {(trigger.fieldIds || []).length === 1 ? (
            <div className="qtable-automation-transition-grid">
              <label>
                <span>{automationT("editor.trigger.fromOptional")}</span>
                <FieldValueInput
                  field={fieldById(fields, trigger.fieldIds?.[0])}
                  value={trigger.from ?? ""}
                  members={members}
                  placeholder={automationT("editor.trigger.anyFrom")}
                  onChange={(value) => patch({ from: value === "" ? undefined : value })}
                />
              </label>
              <label>
                <span>{automationT("editor.trigger.toOptional")}</span>
                <FieldValueInput
                  field={fieldById(fields, trigger.fieldIds?.[0])}
                  value={trigger.to ?? ""}
                  members={members}
                  placeholder={automationT("editor.trigger.anyTo")}
                  onChange={(value) => patch({ to: value === "" ? undefined : value })}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {trigger.type === "scheduled" ? (
        <div className="qtable-automation-trigger-config">
          <label>
            <span>{automationT("editor.trigger.interval")}</span>
            <InputNumber
              min={1}
              max={43_200}
              value={trigger.intervalMinutes || 60}
              onChange={(value) => patch({ intervalMinutes: Number(value || 1) })}
            />
          </label>
        </div>
      ) : null}

      {trigger.type === "due_date" ? (
        <div className="qtable-automation-trigger-config qtable-automation-form-grid">
          <label>
            <span>{automationT("editor.trigger.dateField")}</span>
            <Select
              value={trigger.fieldId || undefined}
              options={dateFields.map((field) => ({ label: field.name, value: field.id }))}
              placeholder={dateFields.length ? automationT("editor.trigger.selectDateField") : automationT("editor.trigger.noDateField")}
              onChange={(fieldId) => patch({ fieldId })}
            />
          </label>
          <label>
            <span>{automationT("editor.trigger.offset")}</span>
            <InputNumber
              min={0}
              max={525_600}
              value={trigger.offsetMinutes || 0}
              onChange={(value) => patch({ offsetMinutes: Number(value || 0) })}
            />
          </label>
          <label>
            <span>{automationT("editor.trigger.scanInterval")}</span>
            <InputNumber
              min={1}
              max={1_440}
              value={trigger.scanIntervalMinutes || 5}
              onChange={(value) => patch({ scanIntervalMinutes: Number(value || 1) })}
            />
          </label>
        </div>
      ) : null}
    </>
  );
}

export function AutomationConditionsSection({
  conditions,
  fields,
  members,
  onChange,
}: {
  conditions: AutomationConditions;
  fields: AutomationField[];
  members: WorkspaceMember[];
  onChange: (conditions: AutomationConditions) => void;
}) {
  const update = (index: number, patch: Partial<AutomationConditionLeaf>) =>
    onChange({
      ...conditions,
      items: conditions.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });

  const add = () => {
    const field = fields[0];
    if (!field) {
      message.warning(automationT("editor.conditions.noFields"));
      return;
    }
    onChange({
      ...conditions,
      items: [...conditions.items, { fieldId: field.id, operator: "equals", value: "" }],
    });
  };

  return (
    <>
      <div className="qtable-automation-section-heading qtable-automation-heading-with-action">
        <span className="qtable-automation-step-index">03</span>
        <div>
          <Typography.Title level={4}>{automationT("editor.conditions.title")}</Typography.Title>
          <Typography.Text type="secondary">
            {automationT("editor.conditions.description")}
          </Typography.Text>
        </div>
        <Button icon={<PlusOutlined />} onClick={add}>{automationT("editor.conditions.add")}</Button>
      </div>

      {conditions.items.length ? (
        <>
          <Segmented
            value={conditions.op}
            options={[
              { label: automationT("editor.conditions.all"), value: "and" },
              { label: automationT("editor.conditions.any"), value: "or" },
            ]}
            onChange={(value) => onChange({ ...conditions, op: value as "and" | "or" })}
          />
          <div className="qtable-automation-condition-list">
            {conditions.items.map((condition, index) => {
              const field = fieldById(fields, condition.fieldId);
              const withoutValue = ["empty", "not_empty"].includes(condition.operator);
              const multiple = ["in", "not_in"].includes(condition.operator);
              return (
                <div key={`${condition.fieldId}-${index}`} className="qtable-automation-condition-row">
                  <span className="qtable-automation-row-number">{index + 1}</span>
                  <Select
                    value={condition.fieldId}
                    options={fields.map((item) => ({ label: item.name, value: item.id }))}
                    onChange={(fieldId) =>
                      update(index, { fieldId, operator: "equals", value: "" })
                    }
                  />
                  <Select
                    value={condition.operator}
                    options={operatorsForField(field)}
                    onChange={(operator) =>
                      update(index, {
                        operator,
                        value: ["empty", "not_empty"].includes(operator)
                          ? undefined
                          : ["in", "not_in"].includes(operator)
                            ? []
                            : "",
                      })
                    }
                  />
                  <div className="qtable-automation-condition-value">
                    {withoutValue ? (
                      <Typography.Text type="secondary">{automationT("editor.conditions.noValue")}</Typography.Text>
                    ) : (
                      <FieldValueInput
                        field={field}
                        value={condition.value ?? (multiple ? [] : "")}
                        multiple={multiple}
                        members={members}
                        onChange={(value) => update(index, { value })}
                      />
                    )}
                  </div>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={automationT("editor.conditions.deleteAria", { index: index + 1 })}
                    onClick={() =>
                      onChange({
                        ...conditions,
                        items: conditions.items.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="qtable-automation-empty-builder-row">
          {automationT("editor.conditions.empty")}
        </div>
      )}
    </>
  );
}

export function AutomationActionsSection({
  actions,
  fields,
  members,
  onChange,
}: {
  actions: AutomationAction[];
  fields: AutomationField[];
  members: WorkspaceMember[];
  onChange: (actions: AutomationAction[]) => void;
}) {
  const writableFields = fields.filter(isWritableField);
  const memberFields = fields.filter(isMemberField);
  const update = (index: number, patch: Partial<AutomationAction>) =>
    onChange(actions.map((action, actionIndex) =>
      actionIndex === index ? { ...action, ...patch } : action,
    ));

  const updateField = (
    actionIndex: number,
    oldFieldId: string,
    newFieldId: string,
    value: unknown,
  ) => {
    const nextFields = { ...(actions[actionIndex].fields || {}) };
    if (oldFieldId && oldFieldId !== newFieldId) delete nextFields[oldFieldId];
    nextFields[newFieldId] = value;
    update(actionIndex, { fields: nextFields });
  };

  const addField = (actionIndex: number) => {
    const action = actions[actionIndex];
    const assigned = new Set(Object.keys(action.fields || {}));
    const candidate = writableFields.find((field) => !assigned.has(field.id));
    if (!candidate) {
      message.info(automationT("editor.actions.noMoreFields"));
      return;
    }
    update(actionIndex, { fields: { ...(action.fields || {}), [candidate.id]: "" } });
  };

  const options = actionOptions();

  return (
    <>
      <div className="qtable-automation-section-heading">
        <span className="qtable-automation-step-index">04</span>
        <div>
          <Typography.Title level={4}>{automationT("editor.actions.title")}</Typography.Title>
          <Typography.Text type="secondary">
            {automationT("editor.actions.description")}
          </Typography.Text>
        </div>
      </div>
      <Space wrap className="qtable-automation-add-action-bar">
        {options.map((option) => (
          <Button
            key={option.value}
            icon={<PlusOutlined />}
            onClick={() =>
              onChange([
                ...actions,
                defaultAutomationAction(option.value as AutomationAction["type"], fields),
              ])
            }
          >
            {option.label}
          </Button>
        ))}
      </Space>

      <div className="qtable-automation-action-list">
        {actions.map((action, actionIndex) => (
          <article key={`${action.type}-${actionIndex}`} className="qtable-automation-action-card">
            <header>
              <div>
                <Tag color="blue">Action {actionIndex + 1}</Tag>
                <Select
                  value={action.type}
                  options={options}
                  onChange={(value) =>
                    onChange(actions.map((current, index) =>
                      index === actionIndex
                        ? defaultAutomationAction(value as AutomationAction["type"], fields)
                        : current,
                    ))
                  }
                />
              </div>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onChange(actions.filter((_, index) => index !== actionIndex))}
              >
                {automationT("editor.actions.remove")}
              </Button>
            </header>

            {action.type === "notify" ? (
              <div className="qtable-automation-form-grid">
                <label>
                  <span>{automationT("editor.actions.memberField")}</span>
                  <Select
                    allowClear
                    value={action.recipientFieldId || undefined}
                    options={memberFields.map((field) => ({ label: field.name, value: field.id }))}
                    placeholder={memberFields.length ? automationT("editor.actions.selectMemberField") : automationT("editor.actions.noMemberField")}
                    onChange={(recipientFieldId) => update(actionIndex, { recipientFieldId })}
                  />
                </label>
                <label>
                  <span>{automationT("editor.actions.members")}</span>
                  <Select
                    mode="multiple"
                    allowClear
                    value={action.recipientUserIds || []}
                    options={members.map((member) => ({
                      label: member.name || member.email,
                      value: member.userId,
                    }))}
                    placeholder={automationT("editor.actions.selectMembers")}
                    onChange={(recipientUserIds) => update(actionIndex, { recipientUserIds })}
                  />
                </label>
                <label>
                  <span>{automationT("editor.actions.notificationType")}</span>
                  <Select
                    value={action.notificationType || "automation"}
                    options={notificationTypes()}
                    onChange={(notificationType) => update(actionIndex, { notificationType })}
                  />
                </label>
                <label className="qtable-automation-form-wide">
                  <span>{automationT("editor.actions.message")}</span>
                  <Input.TextArea
                    value={action.message || ""}
                    maxLength={500}
                    showCount
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    onChange={(event) => update(actionIndex, { message: event.target.value })}
                  />
                </label>
              </div>
            ) : (
              <div className="qtable-automation-field-assignment-list">
                {Object.entries(action.fields || {}).map(([fieldId, value]) => (
                  <div key={fieldId} className="qtable-automation-field-assignment">
                    <Select
                      value={fieldId}
                      options={writableFields.map((item) => ({ label: item.name, value: item.id }))}
                      onChange={(newFieldId) =>
                        updateField(actionIndex, fieldId, newFieldId, value)
                      }
                    />
                    <FieldValueInput
                      field={fieldById(fields, fieldId)}
                      value={value}
                      multiple={fieldById(fields, fieldId)?.type === "member"}
                      members={members}
                      onChange={(nextValue) =>
                        updateField(actionIndex, fieldId, fieldId, nextValue)
                      }
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const nextFields = { ...(action.fields || {}) };
                        delete nextFields[fieldId];
                        update(actionIndex, { fields: nextFields });
                      }}
                    />
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => addField(actionIndex)}>
                  {automationT("editor.actions.addField")}
                </Button>
              </div>
            )}
          </article>
        ))}
        {!actions.length ? (
          <div className="qtable-automation-empty-builder-row">
            {automationT("editor.actions.empty")}
          </div>
        ) : null}
      </div>
    </>
  );
}
