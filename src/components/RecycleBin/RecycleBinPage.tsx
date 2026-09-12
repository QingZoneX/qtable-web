import {
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../../lib/apollo";
import { t } from "../../lib/i18nRuntime";
import { productDateTime, productLocaleCompare } from "../../lib/productI18n";
import { useLanguage } from "../../lib/useLanguage";
import { GET_WORKSPACE, GET_WORKSPACES } from "../../lib/graphql";
import { useAuthStore } from "../../store/authStore";
import {
  PURGE_RECORD,
  RECYCLE_BIN_FIELDS_QUERY,
  RECYCLE_BIN_QUERY,
  RESTORE_RECORD,
} from "./recycleBinGraphql";
import {
  buildSnapshotEntries,
  collectWorkspaceTables,
  isRecyclePermissionError,
  recycleEntryMatchesSearch,
  type RecycleBinEntry,
  type RecycleField,
  type WorkspaceNode,
} from "./recycleBinModel";
import { recycleBinT } from "./recycleBinI18n";
import "./recycleBin.css";

const { Paragraph, Text, Title } = Typography;
const RECYCLE_PAGE_SIZE = 200;
const RECYCLE_WORKSPACE_STORAGE_KEY = "qtable.recycleBin.workspaceId";
const RECYCLE_TABLE_STORAGE_KEY = "qtable.recycleBin.tableId";

type WorkspaceSummary = {
  id: string;
  name: string;
};

type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

type WorkspacePayload = {
  root: WorkspaceNode;
};

type RecycleBinPagePayload = {
  items: RecycleBinEntry[];
  totalCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

const errorMessage = (reason: unknown, fallback: string) => {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason) {
    const text = String((reason as { message?: unknown }).message || "");
    if (text) return text;
  }
  return fallback;
};

const readStorage = (key: string) => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
};

const formatDeletedAt = (value?: string | null) => {
  if (!value) return recycleBinT("timeUnknown");
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return productDateTime(parsed.toDate(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export function RecycleBinPage() {
  useLanguage();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const [workspacePreference, setWorkspacePreference] = useState(
    () =>
      readStorage(RECYCLE_WORKSPACE_STORAGE_KEY) ||
      readStorage("qtable.workspaceId"),
  );
  const [tablePreference, setTablePreference] = useState(() =>
    readStorage(RECYCLE_TABLE_STORAGE_KEY),
  );
  const [search, setSearch] = useState("");
  const [trashItems, setTrashItems] = useState<RecycleBinEntry[]>([]);
  const [trashTotalCount, setTrashTotalCount] = useState(0);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<RecycleBinEntry | null>(null);
  const [purgeConfirmValue, setPurgeConfirmValue] = useState("");
  const recycleRequestIdRef = useRef(0);

  const {
    data: workspacesData,
    loading: workspacesLoading,
    error: workspacesError,
    refetch: refetchWorkspaces,
  } = useQuery<{ workspaces: WorkspacesPayload }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });

  const allWorkspaces = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...(workspacesData?.workspaces?.owned || []),
      ...(workspacesData?.workspaces?.invited || []),
    ]
      .filter((workspace) => {
        if (!workspace.id || seen.has(workspace.id)) return false;
        seen.add(workspace.id);
        return true;
      })
      .sort((left, right) => productLocaleCompare(left.name, right.name));
  }, [workspacesData?.workspaces?.invited, workspacesData?.workspaces?.owned]);

  const selectedWorkspaceId = useMemo(() => {
    if (!allWorkspaces.length) return "";
    if (allWorkspaces.some((workspace) => workspace.id === workspacePreference)) {
      return workspacePreference;
    }
    return allWorkspaces[0].id;
  }, [allWorkspaces, workspacePreference]);

  useEffect(() => {
    if (!selectedWorkspaceId || typeof window === "undefined") return;
    window.localStorage.setItem(
      RECYCLE_WORKSPACE_STORAGE_KEY,
      selectedWorkspaceId,
    );
  }, [selectedWorkspaceId]);

  const {
    data: workspaceData,
    loading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useQuery<{ workspace: WorkspacePayload }>(GET_WORKSPACE, {
    variables: { workspaceId: selectedWorkspaceId || undefined },
    skip: !token || !selectedWorkspaceId,
    fetchPolicy: "network-only",
  });

  const tableOptions = useMemo(() => {
    if (workspaceLoading) return [];
    return collectWorkspaceTables(workspaceData?.workspace?.root)
      .map((table) => ({ value: table.id, label: table.name }))
      .sort((left, right) => productLocaleCompare(left.label, right.label));
  }, [workspaceData?.workspace?.root, workspaceLoading]);

  const selectedTableId = useMemo(() => {
    if (!tableOptions.length) return "";
    if (tableOptions.some((table) => table.value === tablePreference)) {
      return tablePreference;
    }
    return tableOptions[0].value;
  }, [tableOptions, tablePreference]);

  useEffect(() => {
    if (!selectedTableId || typeof window === "undefined") return;
    window.localStorage.setItem(RECYCLE_TABLE_STORAGE_KEY, selectedTableId);
  }, [selectedTableId]);

  const {
    data: fieldsData,
    loading: fieldsLoading,
    error: fieldsError,
    refetch: refetchFields,
  } = useQuery<{ fields: RecycleField[] }>(RECYCLE_BIN_FIELDS_QUERY, {
    variables: { tableId: selectedTableId || undefined },
    skip: !token || !selectedTableId,
    fetchPolicy: "network-only",
  });
  const fields = useMemo(
    () => (fieldsLoading ? [] : fieldsData?.fields || []),
    [fieldsData?.fields, fieldsLoading],
  );

  const [restoreRecord] = useMutation<{
    restoreRecord: { affectedTableIds?: string[] } | null;
  }>(RESTORE_RECORD);
  const [purgeRecord] = useMutation<{ purgeRecord: boolean }>(PURGE_RECORD);

  const loadRecycleBin = useCallback(async () => {
    const tableId = selectedTableId;
    const requestId = ++recycleRequestIdRef.current;

    if (!tableId || !token) {
      setTrashItems([]);
      setTrashTotalCount(0);
      setTrashError(null);
      setTrashLoading(false);
      return;
    }

    setTrashLoading(true);
    setTrashError(null);
    try {
      const items: RecycleBinEntry[] = [];
      const seen = new Set<string>();
      let offset = 0;
      let totalCount = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await client.query<{ recycleBin: RecycleBinPagePayload }>({
          query: RECYCLE_BIN_QUERY,
          variables: { tableId, offset, limit: RECYCLE_PAGE_SIZE },
          fetchPolicy: "network-only",
        });
        if (requestId !== recycleRequestIdRef.current) return;
        const page = response.data?.recycleBin;
        if (!page) throw new Error(recycleBinT("invalidPage"));
        totalCount = Math.max(totalCount, Number(page.totalCount || 0));
        for (const item of page.items || []) {
          if (seen.has(item.recycleId)) continue;
          seen.add(item.recycleId);
          items.push(item);
        }
        hasMore = Boolean(page.hasMore);
        if (!hasMore) break;
        if (!page.items?.length) {
          throw new Error(recycleBinT("emptyPageWithMore"));
        }
        offset = Number(page.offset || offset) + page.items.length;
      }

      if (requestId !== recycleRequestIdRef.current) return;
      setTrashItems(items);
      setTrashTotalCount(totalCount);
    } catch (reason) {
      if (requestId !== recycleRequestIdRef.current) return;
      setTrashItems([]);
      setTrashTotalCount(0);
      setTrashError(errorMessage(reason, recycleBinT("readFailed")));
    } finally {
      if (requestId === recycleRequestIdRef.current) setTrashLoading(false);
    }
  }, [selectedTableId, token]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadRecycleBin();
    });
    return () => {
      cancelled = true;
      recycleRequestIdRef.current += 1;
    };
  }, [loadRecycleBin]);

  const selectedWorkspaceName =
    allWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ||
    recycleBinT("currentWorkspace");
  const selectedTableName =
    tableOptions.find((table) => table.value === selectedTableId)?.label ||
    recycleBinT("currentTable");

  const visibleItems = useMemo(
    () =>
      trashItems.filter((entry) =>
        recycleEntryMatchesSearch(entry, fields, search),
      ),
    [fields, search, trashItems],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refetchWorkspaces(),
      selectedWorkspaceId ? refetchWorkspace() : Promise.resolve(),
      selectedTableId ? refetchFields() : Promise.resolve(),
    ]);
    await loadRecycleBin();
  }, [
    loadRecycleBin,
    refetchFields,
    refetchWorkspace,
    refetchWorkspaces,
    selectedTableId,
    selectedWorkspaceId,
  ]);

  const handleRestore = useCallback(
    async (entry: RecycleBinEntry, openAfterRestore: boolean) => {
      const key = `${entry.recycleId}:${openAfterRestore ? "open" : "restore"}`;
      setActionKey(key);
      try {
        const response = await restoreRecord({
          variables: { tableId: entry.tableId, recordId: entry.recordId },
        });
        if (!response.data?.restoreRecord) {
          throw new Error(recycleBinT("restoreMissing"));
        }
        await loadRecycleBin();
        message.success(recycleBinT("restored"));
        if (openAfterRestore) {
          navigate(
            `/workbench/${entry.tableId}?recordId=${encodeURIComponent(entry.recordId)}`,
          );
        }
      } catch (reason) {
        message.error(errorMessage(reason, recycleBinT("restoreFailed")));
      } finally {
        setActionKey(null);
      }
    },
    [loadRecycleBin, navigate, restoreRecord],
  );

  const handlePurge = useCallback(async () => {
    const target = purgeTarget;
    if (!target || purgeConfirmValue !== target.recordId) return;
    setActionKey(`${target.recycleId}:purge`);
    try {
      const response = await purgeRecord({
        variables: {
          tableId: target.tableId,
          recordId: target.recordId,
          confirmRecordId: purgeConfirmValue,
        },
      });
      if (response.data?.purgeRecord !== true) {
        throw new Error(recycleBinT("purgeIncomplete"));
      }
      setPurgeTarget(null);
      setPurgeConfirmValue("");
      await loadRecycleBin();
      message.success(recycleBinT("purged"));
    } catch (reason) {
      message.error(errorMessage(reason, recycleBinT("purgeFailed")));
      throw reason;
    } finally {
      setActionKey(null);
    }
  }, [loadRecycleBin, purgeConfirmValue, purgeRecord, purgeTarget]);

  if (workspacesLoading && !workspacesData) {
    return (
      <div
        className="qtable-recycle-bin qtable-recycle-bin-state"
        role="status"
        aria-label={recycleBinT("loadingAria")}
      >
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (workspacesError) {
    return (
      <div className="qtable-recycle-bin qtable-recycle-bin-state">
        <Alert
          type="error"
          showIcon
          message={recycleBinT("workspaceLoadFailed")}
          description={workspacesError.message}
          action={<Button onClick={() => void refetchWorkspaces()}>{recycleBinT("retry")}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="qtable-recycle-bin">
      <header className="qtable-recycle-bin-header">
        <div>
          <Space size={8} align="center">
            <Title level={2}>{recycleBinT("title")}</Title>
            <Tag color="blue">{recycleBinT("manageOnly")}</Tag>
          </Space>
          <Paragraph type="secondary">{recycleBinT("description")}</Paragraph>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void refreshAll()}
          loading={trashLoading}
        >
          {recycleBinT("refresh")}
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        message={recycleBinT("deletionSemantics")}
        description={recycleBinT("deletionSemanticsHelp")}
      />

      <div className="qtable-recycle-bin-toolbar">
        <Select
          value={selectedWorkspaceId || undefined}
          placeholder={recycleBinT("selectWorkspace")}
          options={allWorkspaces.map((workspace) => ({
            value: workspace.id,
            label: workspace.name,
          }))}
          onChange={(value) => {
            setWorkspacePreference(value);
            setTablePreference("");
            setSearch("");
          }}
          className="qtable-recycle-bin-workspace"
          aria-label={recycleBinT("selectWorkspace")}
        />
        <Select
          value={selectedTableId || undefined}
          placeholder={workspaceLoading ? recycleBinT("loadingTables") : recycleBinT("selectTable")}
          loading={workspaceLoading}
          options={tableOptions}
          onChange={(value) => {
            setTablePreference(value);
            setSearch("");
          }}
          className="qtable-recycle-bin-table"
          aria-label={recycleBinT("selectTable")}
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined />}
          allowClear
          placeholder={recycleBinT("searchPlaceholder")}
          className="qtable-recycle-bin-search"
          disabled={!selectedTableId || trashLoading}
        />
      </div>

      {workspaceError ? (
        <Alert
          type="error"
          showIcon
          message={recycleBinT("workspaceTablesFailed")}
          description={workspaceError.message}
          action={<Button onClick={() => void refetchWorkspace()}>{recycleBinT("retry")}</Button>}
        />
      ) : null}

      {fieldsError ? (
        <Alert
          type="warning"
          showIcon
          message={recycleBinT("fieldsFailed")}
          description={recycleBinT("fieldsFailedHelp")}
        />
      ) : null}

      {!allWorkspaces.length ? (
        <Empty description={recycleBinT("noWorkspaces")} />
      ) : !workspaceLoading && selectedWorkspaceId && !tableOptions.length ? (
        <Empty description={recycleBinT("noTables", { workspace: selectedWorkspaceName })} />
      ) : !selectedTableId ? (
        <Empty description={recycleBinT("chooseTable")} />
      ) : trashLoading ? (
        <div
          className="qtable-recycle-bin-grid"
          role="status"
          aria-label={recycleBinT("loadingFullAria")}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="qtable-recycle-bin-card qtable-recycle-bin-card-skeleton"
              key={index}
            >
              <Skeleton active title paragraph={{ rows: 4 }} />
            </div>
          ))}
        </div>
      ) : trashError ? (
        <Alert
          type="error"
          showIcon
          message={
            isRecyclePermissionError(trashError)
              ? recycleBinT("manageRequired")
              : recycleBinT("recycleReadFailed")
          }
          description={
            isRecyclePermissionError(trashError)
              ? recycleBinT("manageRequiredHelp", { table: selectedTableName })
              : trashError
          }
          action={<Button onClick={() => void loadRecycleBin()}>{recycleBinT("retry")}</Button>}
        />
      ) : visibleItems.length === 0 ? (
        <Empty
          description={
            search
              ? recycleBinT("noSearchMatch", { query: search })
              : recycleBinT("emptyTable", { table: selectedTableName })
          }
        />
      ) : (
        <>
          <div className="qtable-recycle-bin-summary">
            <Text type="secondary">
              {recycleBinT("summary", {
                workspace: selectedWorkspaceName,
                table: selectedTableName,
                count: trashTotalCount,
              })}
              {search ? recycleBinT("searchHits", { count: visibleItems.length }) : ""}
            </Text>
            <Text type="secondary">{recycleBinT("searchCompleteHint")}</Text>
          </div>
          <div className="qtable-recycle-bin-grid">
            {visibleItems.map((entry) => {
              const snapshot = buildSnapshotEntries(entry, fields);
              const shownSnapshot = snapshot.slice(0, 4);
              const restoreKey = `${entry.recycleId}:restore`;
              const openKey = `${entry.recycleId}:open`;
              const purgeKey = `${entry.recycleId}:purge`;
              const deletedBy = entry.deletedByUserId == null
                ? recycleBinT("unknown")
                : recycleBinT("userId", { id: entry.deletedByUserId });
              return (
                <article className="qtable-recycle-bin-card" key={entry.recycleId}>
                  <div className="qtable-recycle-bin-card-heading">
                    <div>
                      <Text strong>{recycleBinT("record", { id: entry.recordId })}</Text>
                      <Text
                        type="secondary"
                        className="qtable-recycle-bin-card-id"
                      >
                        recycle: {entry.recycleId}
                      </Text>
                    </div>
                    <Tag color="warning">{recycleBinT("deleted")}</Tag>
                  </div>

                  <div className="qtable-recycle-bin-meta">
                    <span>{recycleBinT("deletedAt", { time: formatDeletedAt(entry.deletedAt) })}</span>
                    <span>{recycleBinT("deletedBy", { value: deletedBy })}</span>
                    <span>
                      {recycleBinT("recordVersion", {
                        version: entry.recordVersion ?? recycleBinT("unknown"),
                      })}
                    </span>
                  </div>

                  <div className="qtable-recycle-bin-snapshot">
                    <Text type="secondary">{recycleBinT("snapshotTitle")}</Text>
                    {shownSnapshot.length ? (
                      <dl>
                        {shownSnapshot.map((item) => (
                          <div key={item.fieldId}>
                            <dt>{item.label}</dt>
                            <dd title={item.value}>{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <Text type="secondary">{recycleBinT("snapshotEmpty")}</Text>
                    )}
                    {snapshot.length > shownSnapshot.length ? (
                      <Text type="secondary">
                        {recycleBinT("extraFields", { count: snapshot.length - shownSnapshot.length })}
                      </Text>
                    ) : null}
                  </div>

                  <div className="qtable-recycle-bin-card-actions">
                    <Button
                      icon={<UndoOutlined />}
                      loading={actionKey === restoreKey}
                      disabled={Boolean(actionKey && actionKey !== restoreKey)}
                      onClick={() => void handleRestore(entry, false)}
                    >
                      {recycleBinT("restore")}
                    </Button>
                    <Button
                      type="primary"
                      icon={<UndoOutlined />}
                      loading={actionKey === openKey}
                      disabled={Boolean(actionKey && actionKey !== openKey)}
                      onClick={() => void handleRestore(entry, true)}
                    >
                      {recycleBinT("restoreAndOpen")}
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      loading={actionKey === purgeKey}
                      disabled={Boolean(actionKey)}
                      onClick={() => {
                        setPurgeTarget(entry);
                        setPurgeConfirmValue("");
                      }}
                    >
                      {recycleBinT("deletePermanently")}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={Boolean(purgeTarget)}
        title={recycleBinT("purgeTitle")}
        okText={t("common.deletePermanently")}
        cancelText={t("common.cancel")}
        centered
        okButtonProps={{
          danger: true,
          disabled: !purgeTarget || purgeConfirmValue !== purgeTarget.recordId,
        }}
        confirmLoading={Boolean(
          purgeTarget && actionKey === `${purgeTarget.recycleId}:purge`,
        )}
        onCancel={() => {
          if (actionKey) return;
          setPurgeTarget(null);
          setPurgeConfirmValue("");
        }}
        onOk={handlePurge}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            message={recycleBinT("irreversible")}
            description={recycleBinT("irreversibleHelp")}
          />
          <Text>
            {recycleBinT("confirmRecordId", { id: purgeTarget?.recordId || "" })}
          </Text>
          <Input
            value={purgeConfirmValue}
            onChange={(event) => setPurgeConfirmValue(event.target.value)}
            placeholder={purgeTarget?.recordId || recycleBinT("recordIdPlaceholder")}
            autoComplete="off"
          />
        </Space>
      </Modal>
    </div>
  );
}
