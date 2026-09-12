import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import {
  Badge,
  Button,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { GET_TABLE_DATA } from "../../lib/graphql";
import { t } from "../../lib/i18nRuntime";
import { useLanguage } from "../../lib/useLanguage";
import { AUTOMATION_EXECUTIONS } from "./automationGraphql";
import { automationPageT } from "./automationPageI18n";
import type {
  AutomationExecutionPage,
  AutomationField,
  AutomationRule,
} from "./automationTypes";
import {
  actionSummary,
  conditionSummary,
  executionStatusMeta,
  formatDateTime,
  triggerSummary,
} from "./automationUtils";

export type AutomationRuleCardProps = {
  rule: AutomationRule;
  tableName: string;
  canEdit: boolean;
  toggling: boolean;
  deleting: boolean;
  onToggle: (rule: AutomationRule, enabled: boolean) => void;
  onEdit: (rule: AutomationRule) => void;
  onHistory: (rule: AutomationRule) => void;
  onRun: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
};

export function AutomationRuleCard({
  rule,
  tableName,
  canEdit,
  toggling,
  deleting,
  onToggle,
  onEdit,
  onHistory,
  onRun,
  onDelete,
}: AutomationRuleCardProps) {
  useLanguage();
  const { data: tableData } = useQuery<{ fields: AutomationField[] }>(
    GET_TABLE_DATA,
    {
      variables: { tableId: rule.tableId },
      fetchPolicy: "cache-first",
    },
  );
  const { data: executionData } = useQuery<{
    automationExecutions: AutomationExecutionPage;
  }>(AUTOMATION_EXECUTIONS, {
    variables: {
      automationId: rule.id,
      status: null,
      offset: 0,
      limit: 1,
    },
    fetchPolicy: "network-only",
    pollInterval: rule.enabled ? 12_000 : 0,
  });
  const fields = tableData?.fields || [];
  const latest = executionData?.automationExecutions?.items?.[0];
  const status = executionStatusMeta(latest?.status);

  return (
    <article className="qtable-automation-rule-card">
      <div className="qtable-automation-rule-card-main">
        <div className="qtable-automation-rule-title-row">
          <div className="qtable-automation-rule-title">
            <div className="qtable-automation-rule-title-copy">
              <Typography.Text strong>{rule.name}</Typography.Text>
              <Space size={6} wrap>
                <Tag>{tableName}</Tag>
                <Tag>{rule.requiredPermission === "update" ? automationPageT("rule.permissionEdit") : automationPageT("rule.permissionRead")}</Tag>
                <Tag>v{rule.version}</Tag>
              </Space>
            </div>
            <Tooltip title={canEdit ? (rule.enabled ? automationPageT("rule.disableTooltip") : automationPageT("rule.enableTooltip")) : automationPageT("rule.permissionEdit")}>
              <Switch
                checked={rule.enabled}
                loading={toggling}
                disabled={!canEdit}
                checkedChildren={automationPageT("rule.enabled")}
                unCheckedChildren={automationPageT("rule.disabled")}
                onChange={(checked) => onToggle(rule, checked)}
                aria-label={automationPageT("rule.toggleAria", { name: rule.name })}
              />
            </Tooltip>
          </div>
          {rule.description ? (
            <Typography.Paragraph className="qtable-automation-rule-description" ellipsis={{ rows: 2 }}>
              {rule.description}
            </Typography.Paragraph>
          ) : null}
        </div>

        <div className="qtable-automation-rule-flow" aria-label={automationPageT("rule.flowAria")}>
          <div className="qtable-automation-flow-step">
            <span>WHEN</span>
            <strong>{triggerSummary(rule.trigger, fields)}</strong>
          </div>
          <div className="qtable-automation-flow-arrow" aria-hidden="true">→</div>
          <div className="qtable-automation-flow-step">
            <span>IF</span>
            <strong>{conditionSummary(rule.conditions, fields)}</strong>
          </div>
          <div className="qtable-automation-flow-arrow" aria-hidden="true">→</div>
          <div className="qtable-automation-flow-step qtable-automation-flow-action">
            <span>THEN</span>
            <strong>{actionSummary(rule.actions, fields)}</strong>
          </div>
        </div>
      </div>

      <div className="qtable-automation-rule-meta">
        <div className="qtable-automation-rule-health">
          <span className="qtable-automation-muted">{automationPageT("rule.latestExecution")}</span>
          <Badge status={status.tone as "default" | "processing" | "success" | "error" | "warning"} text={status.label} />
          <span className="qtable-automation-muted">
            {formatDateTime(latest?.updatedAt || latest?.createdAt)}
          </span>
        </div>
        <span className="qtable-automation-muted">
          {automationPageT("rule.updatedAt", { time: formatDateTime(rule.updatedAt) })}
        </span>
        <Space size={4} wrap className="qtable-automation-rule-actions">
          <Tooltip title={automationPageT("rule.historyTooltip")}>
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => onHistory(rule)}
            >
              {automationPageT("rule.history")}
            </Button>
          </Tooltip>
          <Tooltip title={canEdit ? automationPageT("rule.runTooltip") : automationPageT("rule.permissionEdit")}>
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              disabled={!canEdit}
              onClick={() => onRun(rule)}
            >
              {automationPageT("rule.run")}
            </Button>
          </Tooltip>
          <Button
            type="text"
            icon={<EditOutlined />}
            disabled={!canEdit}
            onClick={() => onEdit(rule)}
          >
            {automationPageT("rule.edit")}
          </Button>
          <Popconfirm
            title={automationPageT("rule.deleteTitle")}
            description={automationPageT("rule.deleteDescription")}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true, loading: deleting }}
            disabled={!canEdit}
            onConfirm={() => onDelete(rule)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!canEdit}
              loading={deleting}
            >
              {automationPageT("rule.delete")}
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </article>
  );
}
