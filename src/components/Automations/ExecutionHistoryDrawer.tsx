import {
  CopyOutlined,
  LinkOutlined,
  ReloadOutlined,
  RetweetOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Empty,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../lib/useLanguage";
import {
  AUTOMATION_EXECUTIONS,
  RETRY_AUTOMATION_EXECUTION,
} from "./automationGraphql";
import { automationPageT } from "./automationPageI18n";
import type {
  AutomationExecution,
  AutomationExecutionPage,
  AutomationRule,
} from "./automationTypes";
import {
  errorMessage,
  executionDuration,
  executionStatusMeta,
  formatDateTime,
} from "./automationUtils";

const PAGE_SIZE = 30;

const statusOptions = () => [
  { label: automationPageT("history.allStatuses"), value: "" },
  { label: executionStatusMeta("succeeded").label, value: "succeeded" },
  { label: executionStatusMeta("failed").label, value: "failed" },
  { label: executionStatusMeta("partially_failed").label, value: "partially_failed" },
  { label: executionStatusMeta("retry_scheduled").label, value: "retry_scheduled" },
  { label: executionStatusMeta("running").label, value: "running" },
  { label: executionStatusMeta("skipped").label, value: "skipped" },
];

export type ExecutionHistoryDrawerProps = {
  open: boolean;
  rule: AutomationRule | null;
  canEdit: boolean;
  onClose: () => void;
};

const canRetry = (status: string) =>
  status === "failed" || status === "partially_failed";

export function ExecutionHistoryDrawer({
  open,
  rule,
  canEdit,
  onClose,
}: ExecutionHistoryDrawerProps) {
  useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const variables = useMemo(
    () => ({
      automationId: rule?.id || "",
      status: status || null,
      offset: 0,
      limit: visibleLimit,
    }),
    [rule?.id, status, visibleLimit],
  );
  const { data, loading, error, refetch } = useQuery<{
    automationExecutions: AutomationExecutionPage;
  }>(AUTOMATION_EXECUTIONS, {
    variables,
    skip: !open || !rule,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    pollInterval: open ? 5_000 : 0,
  });
  const [retryExecution] = useMutation(RETRY_AUTOMATION_EXECUTION);
  const page = data?.automationExecutions;
  const items = page?.items || [];

  const retry = async (execution: AutomationExecution) => {
    setRetryingId(execution.id);
    try {
      await retryExecution({ variables: { executionId: execution.id } });
      message.success(automationPageT("history.retryScheduled"));
      await refetch(variables);
    } catch (cause) {
      message.error(errorMessage(cause, automationPageT("history.retryFailed")));
    } finally {
      setRetryingId(null);
    }
  };

  const copy = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      message.success(automationPageT("history.copied"));
    } catch {
      message.warning(automationPageT("history.copyFailed"));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      className="qtable-automation-history-drawer"
      title={
        <div>
          <Typography.Text strong>{automationPageT("history.title")}</Typography.Text>
          <Typography.Text type="secondary" className="qtable-automation-drawer-subtitle">
            {rule?.name || automationPageT("history.ruleFallback")}
          </Typography.Text>
        </div>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          disabled={!rule}
          onClick={() => void refetch(variables)}
        >
          {automationPageT("history.refresh")}
        </Button>
      }
    >
      <div className="qtable-automation-history-toolbar">
        <Select
          value={status}
          options={statusOptions()}
          onChange={(value) => {
            setStatus(value);
            setVisibleLimit(PAGE_SIZE);
          }}
          aria-label={automationPageT("history.filterAria")}
        />
        <Typography.Text type="secondary">
          {automationPageT("history.pollingHint")}
        </Typography.Text>
      </div>

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 9 }} />
      ) : error ? (
        <Alert
          showIcon
          type="error"
          message={automationPageT("history.loadFailed")}
          description={error.message}
          action={
            <Button size="small" onClick={() => void refetch(variables)}>
              {automationPageT("history.retry")}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <Empty
          description={automationPageT("history.empty")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div className="qtable-automation-execution-list">
          {items.map((execution) => {
            const meta = executionStatusMeta(execution.status);
            return (
              <article key={execution.id} className="qtable-automation-execution-card">
                <div className="qtable-automation-execution-head">
                  <div>
                    <Space size={8} wrap>
                      <Badge
                        status={meta.tone as "default" | "processing" | "success" | "error" | "warning"}
                        text={meta.label}
                      />
                      <Tag>{automationPageT("history.attempt", { count: execution.attempt || 1 })}</Tag>
                      <Tag>v{execution.automationVersion}</Tag>
                    </Space>
                    <div className="qtable-automation-execution-time">
                      {formatDateTime(execution.startedAt || execution.createdAt)} · {executionDuration(execution)}
                    </div>
                  </div>
                  {canRetry(execution.status) ? (
                    <Tooltip title={canEdit ? automationPageT("history.retryTooltip") : automationPageT("history.permissionRequired")}>
                      <Button
                        icon={<RetweetOutlined />}
                        disabled={!canEdit}
                        loading={retryingId === execution.id}
                        onClick={() => void retry(execution)}
                      >
                        {automationPageT("history.retry")}
                      </Button>
                    </Tooltip>
                  ) : null}
                </div>

                {execution.errorMessage ? (
                  <Alert
                    type={execution.status === "partially_failed" ? "warning" : "error"}
                    showIcon
                    message={execution.errorCode || automationPageT("history.executionFailed")}
                    description={execution.errorMessage}
                  />
                ) : null}

                <div className="qtable-automation-execution-actions">
                  {(execution.actionResults || []).map((result, index) => {
                    const resultStatus = String(result.status || "unknown");
                    const resultMeta = executionStatusMeta(resultStatus);
                    return (
                      <div key={`${execution.id}-${index}`} className="qtable-automation-action-result">
                        <Badge
                          status={resultMeta.tone as "default" | "processing" | "success" | "error" | "warning"}
                        />
                        <div>
                          <strong>
                            {index + 1}. {String(result.type || "action")}
                          </strong>
                          {result.errorMessage ? (
                            <span>{String(result.errorMessage)}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="qtable-automation-execution-links">
                  {execution.recordId ? (
                    <Button
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => navigate(`/workbench/${rule?.tableId || ""}`)}
                    >
                      {automationPageT("history.openRecord", { id: execution.recordId })}
                    </Button>
                  ) : null}
                  {execution.traceId ? (
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => void copy(execution.traceId)}
                    >
                      Trace · {execution.traceId.slice(0, 12)}…
                    </Button>
                  ) : null}
                  {(execution.changeSetIds || []).map((id) => (
                    <Button
                      key={id}
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => void copy(id)}
                    >
                      ChangeSet · {id.slice(0, 12)}…
                    </Button>
                  ))}
                </div>
              </article>
            );
          })}
          {page?.hasMore ? (
            <Button
              block
              onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}
              loading={loading}
            >
              {automationPageT("history.loadMore")}
            </Button>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
