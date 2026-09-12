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
  if (!value) return "时间未知";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : value;
};

export function RecycleBinPage() {
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
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
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
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
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
        if (!page) throw new Error("回收站服务没有返回有效数据");
        totalCount = Math.max(totalCount, Number(page.totalCount || 0));
        for (const item of page.items || []) {
          if (seen.has(item.recycleId)) continue;
          seen.add(item.recycleId);
          items.push(item);
        }
        hasMore = Boolean(page.hasMore);
        if (!hasMore) break;
        if (!page.items?.length) {
          throw new Error("回收站分页返回异常：仍有更多数据但当前页为空");
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
      setTrashError(errorMessage(reason, "读取回收站失败"));
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
    "当前工作区";
  const selectedTableName =
    tableOptions.find((table) => table.value === selectedTableId)?.label ||
    "当前数据表";

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
          throw new Error("该记录已不在回收站中，可能已被恢复或永久删除");
        }
        await loadRecycleBin();
        message.success("记录已从服务端恢复");
        if (openAfterRestore) {
          navigate(
            `/workbench/${entry.tableId}?recordId=${encodeURIComponent(entry.recordId)}`,
          );
        }
      } catch (reason) {
        message.error(errorMessage(reason, "恢复记录失败"));
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
        throw new Error("永久删除没有完成，该记录可能已经不在回收站中");
      }
      setPurgeTarget(null);
      setPurgeConfirmValue("");
      await loadRecycleBin();
      message.success("记录已永久删除，历史数据快照也已清除");
    } catch (reason) {
      message.error(errorMessage(reason, "永久删除失败"));
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
        aria-label="回收站加载中"
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
          message="无法读取工作区"
          description={workspacesError.message}
          action={<Button onClick={() => void refetchWorkspaces()}>重试</Button>}
        />
      </div>
    );
  }

  return (
    <div className="qtable-recycle-bin">
      <header className="qtable-recycle-bin-header">
        <div>
          <Space size={8} align="center">
            <Title level={2}>回收站</Title>
            <Tag color="blue">仅表管理者可访问</Tag>
          </Space>
          <Paragraph type="secondary">
            数据库记录删除后会从活动表中移除，并保留删除时快照。你可以恢复，或经过二次确认永久删除。
          </Paragraph>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void refreshAll()}
          loading={trashLoading}
        >
          刷新
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        message="删除安全语义"
        description="回收项会保留到被恢复、被永久删除或其数据表被删除；本页面不承诺固定保留天数。永久删除会清除该记录在回收站与变更历史中的可恢复数据快照，无法撤销。"
      />

      <div className="qtable-recycle-bin-toolbar">
        <Select
          value={selectedWorkspaceId || undefined}
          placeholder="选择工作区"
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
          aria-label="选择工作区"
        />
        <Select
          value={selectedTableId || undefined}
          placeholder={workspaceLoading ? "正在加载数据表" : "选择数据表"}
          loading={workspaceLoading}
          options={tableOptions}
          onChange={(value) => {
            setTablePreference(value);
            setSearch("");
          }}
          className="qtable-recycle-bin-table"
          aria-label="选择数据表"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined />}
          allowClear
          placeholder="搜索记录 ID、字段名或删除快照内容"
          className="qtable-recycle-bin-search"
          disabled={!selectedTableId || trashLoading}
        />
      </div>

      {workspaceError ? (
        <Alert
          type="error"
          showIcon
          message="无法读取当前工作区的数据表"
          description={workspaceError.message}
          action={<Button onClick={() => void refetchWorkspace()}>重试</Button>}
        />
      ) : null}

      {fieldsError ? (
        <Alert
          type="warning"
          showIcon
          message="当前字段元数据读取失败"
          description="删除快照仍可恢复和永久删除，但字段将暂时以保存时的字段 ID 显示。"
        />
      ) : null}

      {!allWorkspaces.length ? (
        <Empty description="当前账号没有可访问的工作区" />
      ) : !workspaceLoading && selectedWorkspaceId && !tableOptions.length ? (
        <Empty description={`${selectedWorkspaceName} 中没有可用的数据表`} />
      ) : !selectedTableId ? (
        <Empty description="请选择一个数据表查看回收站" />
      ) : trashLoading ? (
        <div
          className="qtable-recycle-bin-grid"
          role="status"
          aria-label="正在读取完整回收站"
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
              ? "需要数据表管理权限"
              : "回收站读取失败"
          }
          description={
            isRecyclePermissionError(trashError)
              ? `回收站可能包含完整的已删除记录快照。只有 ${selectedTableName} 的 manage 权限用户可以读取、恢复或永久删除。`
              : trashError
          }
          action={<Button onClick={() => void loadRecycleBin()}>重试</Button>}
        />
      ) : visibleItems.length === 0 ? (
        <Empty
          description={
            search
              ? `没有匹配“${search}”的已删除记录`
              : `${selectedTableName} 的回收站为空`
          }
        />
      ) : (
        <>
          <div className="qtable-recycle-bin-summary">
            <Text type="secondary">
              {selectedWorkspaceName} / {selectedTableName} · 服务端共 {trashTotalCount}
              条已删除记录
              {search ? ` · 当前搜索命中 ${visibleItems.length} 条` : ""}
            </Text>
            <Text type="secondary">搜索基于已自动拉取完成的全部回收站分页</Text>
          </div>
          <div className="qtable-recycle-bin-grid">
            {visibleItems.map((entry) => {
              const snapshot = buildSnapshotEntries(entry, fields);
              const shownSnapshot = snapshot.slice(0, 4);
              const restoreKey = `${entry.recycleId}:restore`;
              const openKey = `${entry.recycleId}:open`;
              const purgeKey = `${entry.recycleId}:purge`;
              return (
                <article className="qtable-recycle-bin-card" key={entry.recycleId}>
                  <div className="qtable-recycle-bin-card-heading">
                    <div>
                      <Text strong>记录 {entry.recordId}</Text>
                      <Text
                        type="secondary"
                        className="qtable-recycle-bin-card-id"
                      >
                        recycle: {entry.recycleId}
                      </Text>
                    </div>
                    <Tag color="warning">已删除</Tag>
                  </div>

                  <div className="qtable-recycle-bin-meta">
                    <span>删除时间：{formatDeletedAt(entry.deletedAt)}</span>
                    <span>
                      删除者：
                      {entry.deletedByUserId == null
                        ? "未知"
                        : `用户 ID ${entry.deletedByUserId}`}
                    </span>
                    <span>记录版本：{entry.recordVersion ?? "未知"}</span>
                  </div>

                  <div className="qtable-recycle-bin-snapshot">
                    <Text type="secondary">删除时数据快照</Text>
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
                      <Text type="secondary">
                        该记录的删除快照没有非空字段值。
                      </Text>
                    )}
                    {snapshot.length > shownSnapshot.length ? (
                      <Text type="secondary">
                        另有 {snapshot.length - shownSnapshot.length} 个非空字段
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
                      恢复
                    </Button>
                    <Button
                      type="primary"
                      icon={<UndoOutlined />}
                      loading={actionKey === openKey}
                      disabled={Boolean(actionKey && actionKey !== openKey)}
                      onClick={() => void handleRestore(entry, true)}
                    >
                      恢复并打开
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
                      永久删除
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
        title="永久删除记录"
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
            message="此操作不可撤销"
            description="永久删除会移除回收站快照，并清除该记录在变更历史中的可恢复 before/after 数据。普通 Undo 无法恢复。"
          />
          <Text>
            请输入完整记录 ID <Text code>{purgeTarget?.recordId}</Text> 以确认。
          </Text>
          <Input
            value={purgeConfirmValue}
            onChange={(event) => setPurgeConfirmValue(event.target.value)}
            placeholder={purgeTarget?.recordId || "记录 ID"}
            autoComplete="off"
          />
        </Space>
      </Modal>
    </div>
  );
}
