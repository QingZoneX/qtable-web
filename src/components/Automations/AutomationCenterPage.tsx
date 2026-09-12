import {
  AppstoreOutlined,
  BellOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";
import { GET_WORKSPACE, GET_WORKSPACES } from "../../lib/graphql";
import { useLanguage } from "../../lib/useLanguage";
import { useAuthStore } from "../../store/authStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import { AutomationRuleCard } from "./AutomationRuleCard";
import { AutomationRuleEditor } from "./AutomationRuleEditor";
import { ExecutionHistoryDrawer } from "./ExecutionHistoryDrawer";
import {
  AUTOMATIONS,
  DELETE_AUTOMATION,
  RUN_AUTOMATION,
  SET_AUTOMATION_ENABLED,
} from "./automationGraphql";
import { automationPageT } from "./automationPageI18n";
import { getAutomationTemplates } from "./automationTemplates";
import type {
  AutomationExecution,
  AutomationRule,
  AutomationTable,
  AutomationTemplateId,
  WorkspacesPayload,
  WorkspaceNode,
} from "./automationTypes";
import {
  actionSummary,
  errorMessage,
  flattenTables,
  isPermissionError,
  triggerLabel,
} from "./automationUtils";
import "./automationCenter.css";

const roleCanEdit = (role?: string | null) => role === "owner" || role === "editor";

export function AutomationCenterPage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const storedWorkspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const setWorkspaceId = useWorkspaceNavigationStore((state) => state.setWorkspaceId);
  const [tableFilter, setTableFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [templateId, setTemplateId] = useState<AutomationTemplateId | null>(null);
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);
  const [runRule, setRunRule] = useState<AutomationRule | null>(null);
  const [runRecordId, setRunRecordId] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: workspaceListData,
    loading: workspaceListLoading,
    error: workspaceListError,
    refetch: refetchWorkspaces,
  } = useQuery<{ workspaces: WorkspacesPayload }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "network-only",
  });
  const workspaceBuckets = workspaceListData?.workspaces || { owned: [], invited: [] };
  const workspaces = useMemo(
    () => [...(workspaceBuckets.owned || []), ...(workspaceBuckets.invited || [])],
    [workspaceBuckets.invited, workspaceBuckets.owned],
  );
  const resolvedWorkspaceId =
    workspaces.find((workspace) => workspace.id === storedWorkspaceId)?.id ||
    workspaces[0]?.id ||
    storedWorkspaceId ||
    "";

  useEffect(() => {
    if (resolvedWorkspaceId && resolvedWorkspaceId !== storedWorkspaceId) {
      setWorkspaceId(resolvedWorkspaceId);
    }
  }, [resolvedWorkspaceId, setWorkspaceId, storedWorkspaceId]);

  const {
    data: workspaceData,
    loading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useQuery<{ workspace: { root: WorkspaceNode } }>(GET_WORKSPACE, {
    variables: { workspaceId: resolvedWorkspaceId || undefined },
    skip: !token || !resolvedWorkspaceId,
    fetchPolicy: "network-only",
  });
  const root = workspaceData?.workspace?.root;
  const tables = useMemo(() => flattenTables(root), [root]);

  const {
    members,
    loading: membersLoading,
    error: membersError,
    accessDenied,
    refetch: refetchMembers,
  } = useWorkspaceAccess(resolvedWorkspaceId || undefined);
  const workspaceRole = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return members.find((member) => member.email?.toLowerCase() === email)?.role || null;
  }, [members, user?.email]);
  const canEdit = !membersLoading && roleCanEdit(workspaceRole);

  const {
    data: automationData,
    loading: automationsLoading,
    error: automationsError,
    refetch: refetchAutomations,
  } = useQuery<{ automations: AutomationRule[] }>(AUTOMATIONS, {
    variables: { workspaceId: resolvedWorkspaceId || null, tableId: null },
    skip: !token || !resolvedWorkspaceId,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const rules = automationData?.automations || [];
  const templates = getAutomationTemplates();
  const [setEnabled] = useMutation(SET_AUTOMATION_ENABLED);
  const [deleteAutomation] = useMutation(DELETE_AUTOMATION);
  const [runAutomation, { loading: runningAutomation }] = useMutation(RUN_AUTOMATION);

  const tableMap = useMemo(
    () => new Map(tables.map((table) => [table.id, table.name])),
    [tables],
  );
  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rules.filter((rule) => {
      if (tableFilter && rule.tableId !== tableFilter) return false;
      if (statusFilter === "enabled" && !rule.enabled) return false;
      if (statusFilter === "disabled" && rule.enabled) return false;
      if (!query) return true;
      const haystack = [
        rule.name,
        rule.description || "",
        tableMap.get(rule.tableId) || rule.tableId,
        triggerLabel(rule.trigger),
        actionSummary(rule.actions),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [language, rules, search, statusFilter, tableFilter, tableMap]);

  const refresh = async () => {
    const jobs: Promise<unknown>[] = [];
    jobs.push(refetchWorkspaces());
    if (resolvedWorkspaceId) {
      jobs.push(refetchWorkspace({ workspaceId: resolvedWorkspaceId }));
      jobs.push(refetchMembers());
      jobs.push(refetchAutomations({ workspaceId: resolvedWorkspaceId, tableId: null }));
    }
    await Promise.all(jobs);
  };

  const openCreate = (nextTemplateId: AutomationTemplateId | null = null) => {
    if (!canEdit) {
      message.warning(automationPageT("center.readonlyCreate"));
      return;
    }
    setEditingRule(null);
    setTemplateId(nextTemplateId);
    setEditorOpen(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setTemplateId(null);
    setEditorOpen(true);
  };

  const toggle = async (rule: AutomationRule, enabled: boolean) => {
    setTogglingId(rule.id);
    try {
      await setEnabled({ variables: { automationId: rule.id, enabled } });
      await refetchAutomations({ workspaceId: resolvedWorkspaceId, tableId: null });
      message.success(enabled ? automationPageT("center.enabledSuccess") : automationPageT("center.disabledSuccess"));
    } catch (cause) {
      message.error(
        isPermissionError(cause)
          ? automationPageT("center.togglePermissionError")
          : automationPageT(enabled ? "center.enableFailed" : "center.disableFailed", { message: errorMessage(cause) }),
      );
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async (rule: AutomationRule) => {
    setDeletingId(rule.id);
    try {
      const response = await deleteAutomation({ variables: { automationId: rule.id } });
      if (!response.data?.deleteAutomation) throw new Error(automationPageT("center.deleteNotConfirmed"));
      await refetchAutomations({ workspaceId: resolvedWorkspaceId, tableId: null });
      message.success(automationPageT("center.deleted"));
    } catch (cause) {
      message.error(
        isPermissionError(cause)
          ? automationPageT("center.deletePermissionError")
          : errorMessage(cause, automationPageT("center.deleteFailed")),
      );
    } finally {
      setDeletingId(null);
    }
  };

  const openRun = (rule: AutomationRule) => {
    setRunRecordId("");
    setRunRule(rule);
  };

  const confirmRun = async () => {
    if (!runRule) return;
    const needsRecord =
      runRule.actions.some((action) => action.type === "update_record") ||
      Boolean(runRule.conditions?.items?.length);
    if (needsRecord && !runRecordId.trim()) {
      message.warning(automationPageT("center.recordRequired"));
      return;
    }
    try {
      const response = await runAutomation({
        variables: {
          automationId: runRule.id,
          recordId: runRecordId.trim() || null,
        },
      });
      const execution = response.data?.runAutomation as AutomationExecution | undefined;
      if (!execution?.id) throw new Error(automationPageT("center.runNoExecution"));
      message.success(automationPageT("center.runSubmitted", { status: execution.status }));
      const completedRule = runRule;
      setRunRule(null);
      setHistoryRule(completedRule);
    } catch (cause) {
      message.error(
        isPermissionError(cause)
          ? automationPageT("center.runPermissionError")
          : errorMessage(cause, automationPageT("center.runFailed")),
      );
    }
  };

  const workspaceName =
    workspaces.find((workspace) => workspace.id === resolvedWorkspaceId)?.name ||
    automationPageT("center.currentWorkspace");
  const loadingInitial = workspaceListLoading || workspaceLoading || membersLoading;
  const pageError = workspaceListError || workspaceError || membersError;

  return (
    <main className="qtable-automation-center">
      <header className="qtable-automation-hero">
        <div className="qtable-automation-hero-copy">
          <div className="qtable-automation-kicker">
            <ThunderboltOutlined /> AUTOMATION CENTER
          </div>
          <Typography.Title level={1}>{automationPageT("center.title")}</Typography.Title>
          <Typography.Paragraph>{automationPageT("center.description")}</Typography.Paragraph>
        </div>
        <Space wrap className="qtable-automation-hero-actions">
          <Button
            icon={<ReloadOutlined />}
            loading={automationsLoading}
            onClick={() => void refresh()}
          >
            {automationPageT("center.refresh")}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canEdit || !tables.length}
            onClick={() => openCreate()}
          >
            {automationPageT("center.create")}
          </Button>
        </Space>
      </header>

      <section className="qtable-automation-summary" aria-label={automationPageT("center.summaryAria")}>
        <div className="qtable-automation-summary-main">
          <Statistic title={automationPageT("center.totalRules")} value={rules.length} />
          <Statistic title={automationPageT("center.runningRules")} value={rules.filter((rule) => rule.enabled).length} />
          <Statistic title={automationPageT("center.disabledRules")} value={rules.filter((rule) => !rule.enabled).length} />
        </div>
        <div className="qtable-automation-summary-context">
          <span>{automationPageT("center.currentSpace")}</span>
          <strong>{workspaceName}</strong>
          <Tag color={canEdit ? "green" : "default"}>
            {membersLoading ? automationPageT("center.checkingPermission") : canEdit ? automationPageT("center.editable") : automationPageT("center.readonly")}
          </Tag>
        </div>
      </section>

      {accessDenied ? (
        <Alert
          type="error"
          showIcon
          message={automationPageT("center.accessDenied")}
          description={automationPageT("center.accessDeniedDescription")}
        />
      ) : pageError ? (
        <Alert
          type="error"
          showIcon
          message={automationPageT("center.contextLoadFailed")}
          description={pageError.message}
          action={<Button size="small" onClick={() => void refresh()}>{automationPageT("center.retry")}</Button>}
        />
      ) : null}

      <section className="qtable-automation-toolbar" aria-label={automationPageT("center.filterAria")}>
        <div className="qtable-automation-toolbar-primary">
          <Select
            className="qtable-automation-workspace-filter"
            value={resolvedWorkspaceId || undefined}
            loading={workspaceListLoading}
            options={workspaces.map((workspace) => ({
              label: workspace.name,
              value: workspace.id,
            }))}
            placeholder={automationPageT("center.selectWorkspace")}
            onChange={(workspaceId) => {
              setWorkspaceId(workspaceId);
              setTableFilter("");
            }}
          />
          <Select
            allowClear
            className="qtable-automation-table-filter"
            value={tableFilter || undefined}
            options={tables.map((table) => ({ label: table.name, value: table.id }))}
            placeholder={automationPageT("center.allTables")}
            onChange={(value) => setTableFilter(value || "")}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={search}
            placeholder={automationPageT("center.searchPlaceholder")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Segmented
          value={statusFilter}
          options={[
            { label: automationPageT("center.all"), value: "all" },
            { label: automationPageT("center.enabled"), value: "enabled" },
            { label: automationPageT("center.disabled"), value: "disabled" },
          ]}
          onChange={(value) => setStatusFilter(value as typeof statusFilter)}
        />
      </section>

      {loadingInitial || (automationsLoading && !automationData) ? (
        <section className="qtable-automation-loading">
          <Skeleton active paragraph={{ rows: 10 }} />
        </section>
      ) : automationsError ? (
        <Alert
          type="error"
          showIcon
          message={isPermissionError(automationsError) ? automationPageT("center.readPermissionDenied") : automationPageT("center.rulesLoadFailed")}
          description={automationsError.message}
          action={
            <Button
              size="small"
              onClick={() => void refetchAutomations({ workspaceId: resolvedWorkspaceId, tableId: null })}
            >
              {automationPageT("center.retry")}
            </Button>
          }
        />
      ) : rules.length === 0 ? (
        <section className="qtable-automation-empty-state">
          <div className="qtable-automation-empty-copy">
            <div className="qtable-automation-empty-icon"><ThunderboltOutlined /></div>
            <Typography.Title level={2}>{automationPageT("center.emptyTitle")}</Typography.Title>
            <Typography.Paragraph>{automationPageT("center.emptyDescription")}</Typography.Paragraph>
          </div>
          <div className="qtable-automation-template-grid">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="qtable-automation-template-card"
                disabled={!canEdit || !tables.length}
                onClick={() => openCreate(template.id)}
              >
                <span className="qtable-automation-template-icon">
                  {template.id === "due-reminder" ? <BellOutlined /> : <AppstoreOutlined />}
                </span>
                <span>
                  <Tag>{template.badge}</Tag>
                  <strong>{template.title}</strong>
                  <small>{template.description}</small>
                </span>
              </button>
            ))}
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            disabled={!canEdit || !tables.length}
            onClick={() => openCreate()}
          >
            {automationPageT("center.createBlank")}
          </Button>
          {!tables.length ? (
            <Alert
              type="info"
              showIcon
              message={automationPageT("center.noTableTitle")}
              description={automationPageT("center.noTableDescription")}
            />
          ) : null}
        </section>
      ) : filteredRules.length === 0 ? (
        <Empty
          className="qtable-automation-filter-empty"
          description={automationPageT("center.filterEmpty")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <section className="qtable-automation-rule-list" aria-live="polite">
          {filteredRules.map((rule) => (
            <AutomationRuleCard
              key={rule.id}
              rule={rule}
              tableName={tableMap.get(rule.tableId) || rule.tableId}
              canEdit={canEdit}
              toggling={togglingId === rule.id}
              deleting={deletingId === rule.id}
              onToggle={(nextRule, enabled) => void toggle(nextRule, enabled)}
              onEdit={openEdit}
              onHistory={setHistoryRule}
              onRun={openRun}
              onDelete={(nextRule) => void remove(nextRule)}
            />
          ))}
        </section>
      )}

      <AutomationRuleEditor
        open={editorOpen}
        rule={editingRule}
        tables={tables as AutomationTable[]}
        members={members}
        templateId={templateId}
        initialTableId={tableFilter || tables[0]?.id}
        canEdit={canEdit}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          await refetchAutomations({ workspaceId: resolvedWorkspaceId, tableId: null });
        }}
      />

      <ExecutionHistoryDrawer
        open={Boolean(historyRule)}
        rule={historyRule}
        canEdit={canEdit}
        onClose={() => setHistoryRule(null)}
      />

      <Modal
        open={Boolean(runRule)}
        title={automationPageT("center.runTitle")}
        okText={automationPageT("center.confirmRun")}
        cancelText={automationPageT("center.cancel")}
        confirmLoading={runningAutomation}
        okButtonProps={{ danger: true }}
        onCancel={() => setRunRule(null)}
        onOk={() => void confirmRun()}
      >
        <Alert
          type="warning"
          showIcon
          message={automationPageT("center.notPreview")}
          description={automationPageT("center.runDescription")}
        />
        <div className="qtable-automation-run-record">
          <Typography.Text strong>{automationPageT("center.recordId")}</Typography.Text>
          <Input
            value={runRecordId}
            placeholder={automationPageT("center.recordPlaceholder")}
            onChange={(event) => setRunRecordId(event.target.value)}
          />
          <Space wrap>
            <Typography.Text type="secondary">
              {runRule?.actions.some((action) => action.type === "update_record") || runRule?.conditions.items.length
                ? automationPageT("center.recordNeeded")
                : automationPageT("center.recordOptional")}
            </Typography.Text>
            {runRule ? (
              <Button type="link" onClick={() => navigate(`/workbench/${runRule.tableId}`)}>
                {automationPageT("center.openTable")}
              </Button>
            ) : null}
          </Space>
        </div>
      </Modal>
    </main>
  );
}
