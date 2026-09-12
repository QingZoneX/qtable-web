import {
  CheckCircleOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceMember } from "../../hooks/useWorkspaceAccess";
import { client } from "../../lib/apollo";
import { GET_TABLE_DATA } from "../../lib/graphql";
import { useLanguage } from "../../lib/useLanguage";
import {
  AutomationActionsSection,
  AutomationConditionsSection,
  AutomationTriggerSection,
} from "./AutomationEditorSections";
import {
  AUTOMATION,
  AUTOMATION_PREVIEW,
  CREATE_AUTOMATION,
  SET_AUTOMATION_ENABLED,
  UPDATE_AUTOMATION,
  VALIDATE_AUTOMATION,
} from "./automationGraphql";
import { automationPageT } from "./automationPageI18n";
import { applyAutomationTemplate } from "./automationTemplates";
import type {
  AutomationField,
  AutomationPreview,
  AutomationRule,
  AutomationTable,
  AutomationTemplateId,
  AutomationValidationResult,
  RuleDraft,
} from "./automationTypes";
import { errorMessage, isPermissionError } from "./automationUtils";

const emptyDraft = (tableId: string): RuleDraft => ({
  name: "",
  description: "",
  tableId,
  enabled: false,
  trigger: { type: "record.created" },
  conditions: { op: "and", items: [] },
  actions: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  maxRetries: 3,
});

const ruleDraft = (rule: AutomationRule): RuleDraft => ({
  name: rule.name,
  description: rule.description || "",
  tableId: rule.tableId,
  enabled: rule.enabled,
  trigger: { ...rule.trigger },
  conditions: {
    op: rule.conditions?.op || "and",
    items: (rule.conditions?.items || []).map((item) => ({ ...item })),
  },
  actions: (rule.actions || []).map((action) => ({
    ...action,
    fields: action.fields ? { ...action.fields } : undefined,
    recipientUserIds: action.recipientUserIds
      ? [...action.recipientUserIds]
      : undefined,
  })),
  timezone: rule.timezone || "UTC",
  maxRetries: rule.maxRetries ?? 3,
});

export type AutomationRuleEditorProps = {
  open: boolean;
  rule: AutomationRule | null;
  tables: AutomationTable[];
  members: WorkspaceMember[];
  templateId: AutomationTemplateId | null;
  initialTableId?: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (rule: AutomationRule) => Promise<void> | void;
};

export function AutomationRuleEditor({
  open,
  rule,
  tables,
  members,
  templateId,
  initialTableId,
  canEdit,
  onClose,
  onSaved,
}: AutomationRuleEditorProps) {
  useLanguage();
  const firstTableId = initialTableId || tables[0]?.id || "";
  const [draft, setDraft] = useState<RuleDraft>(() =>
    rule ? ruleDraft(rule) : emptyDraft(firstTableId),
  );
  const [validation, setValidation] =
    useState<AutomationValidationResult | null>(null);
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [previewRecordId, setPreviewRecordId] = useState("");
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const templateAppliedRef = useRef(false);

  const { data: tableData, loading: fieldsLoading } = useQuery<{
    fields: AutomationField[];
  }>(GET_TABLE_DATA, {
    variables: { tableId: draft.tableId || "" },
    skip: !open || !draft.tableId,
    fetchPolicy: "network-only",
  });
  const fields = useMemo(() => tableData?.fields || [], [tableData?.fields]);

  const [validateAutomation] = useMutation<{
    validateAutomation: AutomationValidationResult;
  }>(VALIDATE_AUTOMATION);
  const [createAutomation] = useMutation<{
    createAutomation: AutomationRule;
  }>(CREATE_AUTOMATION);
  const [updateAutomation] = useMutation<{
    updateAutomation: AutomationRule;
  }>(UPDATE_AUTOMATION);
  const [setAutomationEnabled] = useMutation<{
    setAutomationEnabled: AutomationRule;
  }>(SET_AUTOMATION_ENABLED);

  useEffect(() => {
    if (!open) return undefined;
    const nextTable = rule?.tableId || initialTableId || tables[0]?.id || "";
    const timer = window.setTimeout(() => {
      setDraft(rule ? ruleDraft(rule) : emptyDraft(nextTable));
      setValidation(null);
      setPreview(null);
      setPreviewRecordId("");
      setOperationError(null);
      templateAppliedRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialTableId, open, rule, tables]);

  useEffect(() => {
    if (
      !open ||
      rule ||
      !templateId ||
      templateAppliedRef.current ||
      !draft.tableId ||
      fieldsLoading ||
      !fields.length
    ) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (templateAppliedRef.current) return;
      templateAppliedRef.current = true;
      const seeded = applyAutomationTemplate(templateId, draft.tableId, fields);
      setDraft((current) => ({ ...current, ...seeded }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft.tableId, fields, fieldsLoading, open, rule, templateId]);

  const markDirty = () => {
    setValidation(null);
    setPreview(null);
    setOperationError(null);
  };

  const updateDraft = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) => {
    markDirty();
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const validationVariables = () => ({
    tableId: draft.tableId,
    trigger: draft.trigger,
    conditions: draft.conditions,
    actions: draft.actions,
    timezone: draft.timezone || "UTC",
    maxRetries: Number(draft.maxRetries || 0),
  });

  const validateDraft = async () => {
    if (!draft.name.trim()) throw new Error(automationPageT("editor.nameRequired"));
    if (!draft.tableId) throw new Error(automationPageT("editor.tableRequired"));
    if (!draft.actions.length) throw new Error(automationPageT("editor.actionRequired"));
    setValidating(true);
    setOperationError(null);
    try {
      const response = await validateAutomation({ variables: validationVariables() });
      const result = response.data?.validateAutomation;
      if (!result?.valid) throw new Error(automationPageT("editor.validationNotConfirmed"));
      setValidation(result);
      return result;
    } catch (cause) {
      setOperationError(errorMessage(cause, automationPageT("editor.validationFailed")));
      throw cause;
    } finally {
      setValidating(false);
    }
  };

  const previewSavedRule = async () => {
    if (!rule) return;
    setPreviewing(true);
    setOperationError(null);
    try {
      const response = await client.query<{ automationPreview: AutomationPreview }>({
        query: AUTOMATION_PREVIEW,
        variables: {
          automationId: rule.id,
          recordId: previewRecordId.trim() || null,
        },
        fetchPolicy: "network-only",
      });
      const previewPayload = response.data?.automationPreview;
      if (!previewPayload) throw new Error(automationPageT("editor.previewMissing"));
      setPreview(previewPayload);
    } catch (cause) {
      setOperationError(errorMessage(cause, automationPageT("editor.previewFailed")));
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (!canEdit) {
      setOperationError(automationPageT("editor.readonlyError"));
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      const normalized = await validateDraft();
      let saved: AutomationRule | undefined;
      if (rule) {
        const response = await updateAutomation({
          variables: {
            automationId: rule.id,
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            trigger: normalized.trigger,
            conditions: normalized.conditions,
            actions: normalized.actions,
            timezone: normalized.timezone,
            maxRetries: normalized.maxRetries,
          },
        });
        saved = response.data?.updateAutomation;
        if (draft.enabled !== rule.enabled) {
          const toggleResponse = await setAutomationEnabled({
            variables: { automationId: rule.id, enabled: draft.enabled },
          });
          saved = toggleResponse.data?.setAutomationEnabled;
        }
      } else {
        const response = await createAutomation({
          variables: {
            tableId: draft.tableId,
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            trigger: normalized.trigger,
            conditions: normalized.conditions,
            actions: normalized.actions,
            timezone: normalized.timezone,
            maxRetries: normalized.maxRetries,
            enabled: draft.enabled,
          },
        });
        saved = response.data?.createAutomation;
      }
      if (!saved?.id) throw new Error(automationPageT("editor.saveMissingId"));

      const verification = await client.query<{ automation: AutomationRule }>({
        query: AUTOMATION,
        variables: { automationId: saved.id },
        fetchPolicy: "network-only",
      });
      const persisted = verification.data?.automation;
      if (!persisted || persisted.id !== saved.id || persisted.tableId !== draft.tableId) {
        throw new Error(automationPageT("editor.persistenceFailed"));
      }
      message.success(rule ? automationPageT("editor.saved") : automationPageT("editor.created"));
      await onSaved(persisted);
      onClose();
    } catch (cause) {
      const text = errorMessage(cause, automationPageT("editor.saveFailed"));
      setOperationError(text);
      if (isPermissionError(cause)) {
        message.error(automationPageT("editor.writePermissionError"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(920px, 100vw)"
      className="qtable-automation-editor-drawer"
      title={
        <div>
          <Typography.Text strong>{rule ? automationPageT("editor.editTitle") : automationPageT("editor.createTitle")}</Typography.Text>
          <Typography.Text type="secondary" className="qtable-automation-drawer-subtitle">
            Trigger → Condition → Action
          </Typography.Text>
        </div>
      }
      footer={
        <div className="qtable-automation-editor-footer">
          <Typography.Text type="secondary">
            {automationPageT("editor.footerHint")}
          </Typography.Text>
          <Space wrap>
            <Button onClick={onClose}>{automationPageT("editor.cancel")}</Button>
            <Button
              icon={<SafetyCertificateOutlined />}
              loading={validating}
              onClick={() =>
                void validateDraft()
                  .then(() => message.success(automationPageT("editor.validationPassedToast")))
                  .catch(() => undefined)
              }
            >
              {automationPageT("editor.validate")}
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!canEdit}
              onClick={() => void save()}
            >
              {rule ? automationPageT("editor.saveChanges") : automationPageT("editor.createRule")}
            </Button>
          </Space>
        </div>
      }
    >
      {!canEdit ? (
        <Alert
          type="warning"
          showIcon
          message={automationPageT("editor.readonlyTitle")}
          description={automationPageT("editor.readonlyDescription")}
        />
      ) : null}
      {operationError ? (
        <Alert
          className="qtable-automation-editor-alert"
          type={isPermissionError(operationError) ? "warning" : "error"}
          showIcon
          closable
          message={isPermissionError(operationError) ? automationPageT("editor.permissionInsufficient") : automationPageT("editor.operationIncomplete")}
          description={operationError}
          onClose={() => setOperationError(null)}
        />
      ) : null}
      {validation ? (
        <Alert
          className="qtable-automation-editor-alert"
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message={automationPageT("editor.backendValidated")}
          description={automationPageT("editor.validationDescription", { timezone: validation.timezone, count: validation.maxRetries })}
        />
      ) : null}

      <section className="qtable-automation-editor-section">
        <div className="qtable-automation-section-heading">
          <span className="qtable-automation-step-index">01</span>
          <div>
            <Typography.Title level={4}>{automationPageT("editor.basicTitle")}</Typography.Title>
            <Typography.Text type="secondary">
              {automationPageT("editor.basicDescription")}
            </Typography.Text>
          </div>
        </div>
        <div className="qtable-automation-form-grid">
          <label>
            <span>{automationPageT("editor.ruleName")}</span>
            <Input
              value={draft.name}
              maxLength={191}
              showCount
              placeholder={automationPageT("editor.ruleNamePlaceholder")}
              onChange={(event) => updateDraft("name", event.target.value)}
            />
          </label>
          <label>
            <span>{automationPageT("editor.targetTable")}</span>
            <Select
              value={draft.tableId || undefined}
              options={tables.map((table) => ({ label: table.name, value: table.id }))}
              placeholder={automationPageT("editor.selectTable")}
              disabled={Boolean(rule)}
              onChange={(tableId) => {
                templateAppliedRef.current = false;
                markDirty();
                setDraft(emptyDraft(tableId));
              }}
            />
          </label>
          <label className="qtable-automation-form-wide">
            <span>{automationPageT("editor.description")}</span>
            <Input.TextArea
              value={draft.description}
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder={automationPageT("editor.descriptionPlaceholder")}
              onChange={(event) => updateDraft("description", event.target.value)}
            />
          </label>
          <label>
            <span>{automationPageT("editor.timezone")}</span>
            <Input
              value={draft.timezone}
              placeholder="Asia/Shanghai"
              onChange={(event) => updateDraft("timezone", event.target.value)}
            />
          </label>
          <label>
            <span>{automationPageT("editor.retryCount")}</span>
            <InputNumber
              min={0}
              max={10}
              value={draft.maxRetries}
              onChange={(value) => updateDraft("maxRetries", Number(value || 0))}
            />
          </label>
          <label className="qtable-automation-switch-field">
            <span>{automationPageT("editor.afterSave")}</span>
            <Space>
              <Switch
                checked={draft.enabled}
                onChange={(checked) => updateDraft("enabled", checked)}
              />
              <Typography.Text>{draft.enabled ? automationPageT("editor.enable") : automationPageT("editor.keepDisabled")}</Typography.Text>
            </Space>
          </label>
        </div>
      </section>

      <Divider />

      <section className="qtable-automation-editor-section">
        <div className="qtable-automation-section-heading">
          <span className="qtable-automation-step-index">02</span>
          <div>
            <Typography.Title level={4}>{automationPageT("editor.triggerTitle")}</Typography.Title>
            <Typography.Text type="secondary">
              {automationPageT("editor.triggerDescription")}
            </Typography.Text>
          </div>
        </div>
        <AutomationTriggerSection
          trigger={draft.trigger}
          fields={fields}
          members={members}
          onChange={(trigger) => updateDraft("trigger", trigger)}
        />
      </section>

      <Divider />

      <section className="qtable-automation-editor-section">
        <AutomationConditionsSection
          conditions={draft.conditions}
          fields={fields}
          members={members}
          onChange={(conditions) => updateDraft("conditions", conditions)}
        />
      </section>

      <Divider />

      <section className="qtable-automation-editor-section">
        <AutomationActionsSection
          actions={draft.actions}
          fields={fields}
          members={members}
          onChange={(actions) => updateDraft("actions", actions)}
        />
      </section>

      {rule ? (
        <>
          <Divider />
          <section className="qtable-automation-editor-section">
            <div className="qtable-automation-section-heading">
              <span className="qtable-automation-step-index">05</span>
              <div>
                <Typography.Title level={4}>{automationPageT("editor.previewTitle")}</Typography.Title>
                <Typography.Text type="secondary">
                  {automationPageT("editor.previewDescription")}
                </Typography.Text>
              </div>
            </div>
            <Space.Compact className="qtable-automation-preview-input">
              <Input
                value={previewRecordId}
                placeholder={automationPageT("editor.previewRecordPlaceholder")}
                onChange={(event) => setPreviewRecordId(event.target.value)}
              />
              <Button loading={previewing} onClick={() => void previewSavedRule()}>
                {automationPageT("editor.previewCurrent")}
              </Button>
            </Space.Compact>
            {preview ? (
              <div className="qtable-automation-preview-card">
                <Space wrap>
                  <Tag color={preview.willExecute ? "green" : "default"}>
                    {preview.willExecute ? automationPageT("editor.executable") : automationPageT("editor.notExecutable")}
                  </Tag>
                  <Tag>{preview.conditionMatch ? automationPageT("editor.conditionMatched") : automationPageT("editor.conditionNotMatched")}</Tag>
                  <Tag>{automationPageT("editor.requiredPermission", { permission: preview.requiredPermission })}</Tag>
                </Space>
                <Typography.Text type="secondary">
                  {automationPageT("editor.previewSummary", { count: preview.actionSummaries?.length || 0 })}
                </Typography.Text>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </Drawer>
  );
}
