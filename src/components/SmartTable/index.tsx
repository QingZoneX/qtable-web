import { Button, Space, Typography, message } from "antd";
import {
  useSmartTableStore,
  getTableLastViewId,
  permissionAllows,
  type PermissionLevel,
} from "../../store/useSmartTableStore";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./controls/Toolbar";
import AiAssistant from "../AiAssistant";
import "./sidebar.css";
import { ErrorBoundary } from "./ErrorBoundary";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import {
  CLEAR_TABLE_PRESENCE,
  GET_TABLE_DATA,
  GET_WORKSPACE,
  ITEM_ACCESS,
  QUERY_RECORDS,
  RECORD_BY_ID,
  PUBLISH_YJS_UPDATE,
  TABLE_PRESENCE_UPDATES,
  TABLE_UPDATES,
  UPSERT_TABLE_PRESENCE,
  YJS_UPDATES,
} from "../../lib/graphql";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import * as Y from "yjs";
import { useAuthStore } from "../../store/authStore";
import type {
  Field,
  TableRecord,
  View,
  FilterCondition,
  SortCondition,
  GroupConfig,
  TablePresenceViewer,
} from "../../store/useSmartTableStore";
import { t } from "../../lib/i18nRuntime";
import { client } from "../../lib/apollo";
import { rememberRecentTarget } from "../../lib/recentTargets";
import { RowDetailDrawer } from "./RowDetailDrawer";

const { Text } = Typography;
const GridView = lazy(() =>
  import("./views/GridView").then((mod) => ({ default: mod.GridView })),
);
const DashboardView = lazy(() =>
  import("./views/DashboardView").then((mod) => ({
    default: mod.DashboardView,
  })),
);
const BoardView = lazy(() =>
  import("./views/KanbanView").then((mod) => ({ default: mod.BoardView })),
);
const GanttView = lazy(() =>
  import("./views/GanttView").then((mod) => ({ default: mod.GanttView })),
);
const CalendarView = lazy(() =>
  import("./views/CalendarView").then((mod) => ({ default: mod.CalendarView })),
);
const GalleryView = lazy(() =>
  import("./views/GalleryView").then((mod) => ({ default: mod.GalleryView })),
);

type WorkspaceNode = {
  id: string;
  name: string;
  type?: string;
  children?: WorkspaceNode[];
  defaultViewId?: string | null;
};

type ItemAccessEntry = {
  userId: number;
  name: string;
  email: string;
  role: string;
  permission: PermissionLevel;
  inherited: boolean;
};

type RealtimeRecordPatch = {
  recordId: string;
  fieldId: string;
  value: unknown;
};

type RecordPageResult = {
  records: TableRecord[];
  totalCount: number;
  offset: number;
  limit: number;
  hasMore?: boolean;
  nextOffset?: number | null;
};

const RECORD_PAGE_SIZE = 500;
const SMALL_TABLE_EAGER_LIMIT = 2000;
const MAX_RECORD_QUERY_LIMIT = 1000;

const ViewLoadingFallback = () => (
  <div
    style={{
      height: "100%",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#6B7280",
      fontSize: 13,
      backgroundColor: "#fff",
    }}
  >
    {t("smartTable.viewLoading")}
  </div>
);

const findInWorkspace = (
  root: WorkspaceNode,
  id: string,
): WorkspaceNode | null => {
  if (root.id === id) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const match = findInWorkspace(child, id);
    if (match) return match;
  }
  return null;
};

const findFirstTable = (node: WorkspaceNode): WorkspaceNode | null => {
  if (node.type === "table") return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const match = findFirstTable(child);
    if (match) return match;
  }
  return null;
};

export function SmartTable({ embedded }: { embedded?: boolean }) {
  const {
    currentViewId,
    views,
    records,
    fields,
    filters,
    sorts,
    setData,
    setCurrentView,
    setCurrentPermission,
    setCurrentTableName,
    updateRecord,
    setActiveViewers,
  } = useSmartTableStore();
  const { viewId, tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuthStore();
  const [ganttConfigModalOpen, setGanttConfigModalOpen] = useState(false);
  const [calendarConfigModalOpen, setCalendarConfigModalOpen] =
    useState(false);
  const [galleryConfigModalOpen, setGalleryConfigModalOpen] = useState(false);
  const [recordTotalCount, setRecordTotalCount] = useState(0);
  const [recordLoadedCount, setRecordLoadedCount] = useState(0);
  const [recordPageLoading, setRecordPageLoading] = useState(false);
  const clearDeepLinkedRecord = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete("recordId");
    const search = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);
  const serverRecordIdsRef = useRef<Set<string>>(new Set());
  const recordRequestIdRef = useRef(0);
  const lastRecordQuerySignatureRef = useRef("");
  const workspaceId = localStorage.getItem("qtable.workspaceId") || "";
  const { data: workspaceData, refetch: refetchWorkspace } = useQuery<{
    workspace: { root: WorkspaceNode; workspaceId?: string; workspace_id?: string };
  }>(GET_WORKSPACE, {
    variables: { workspaceId: workspaceId || undefined },
    skip: !token,
    fetchPolicy: "network-only",
  });
  const resolvedWorkspaceId =
    workspaceData?.workspace?.workspace_id || workspaceId || undefined;
  const firstTable = useMemo(() => {
    const root = workspaceData?.workspace?.root;
    if (!root) return null;
    return findFirstTable(root);
  }, [workspaceData?.workspace?.root]);
  const resolvedTableId = tableId || firstTable?.id || null;
  const deepLinkedRecordId = useMemo(
    () => new URLSearchParams(location.search).get("recordId"),
    [location.search],
  );
  const {
    data: deepLinkedRecordData,
    loading: deepLinkedRecordLoading,
    error: deepLinkedRecordError,
    refetch: refetchDeepLinkedRecord,
  } = useQuery<{ recordById: TableRecord }>(RECORD_BY_ID, {
    variables: {
      tableId: resolvedTableId || "",
      recordId: deepLinkedRecordId || "",
    },
    skip: !token || !resolvedTableId || !deepLinkedRecordId,
    fetchPolicy: "network-only",
  });
  const [deepLinkedRecord, setDeepLinkedRecord] =
    useState<TableRecord | null>(null);
  const { data: accessData } = useQuery<
    { itemAccess: ItemAccessEntry[] },
    { itemId: string; workspaceId?: string }
  >(ITEM_ACCESS, {
    variables: {
      itemId: resolvedTableId || "",
      workspaceId: resolvedWorkspaceId,
    },
    skip: !token || !resolvedWorkspaceId || !resolvedTableId,
    fetchPolicy: "network-only",
  });
  const [publishYjsUpdate] = useMutation(PUBLISH_YJS_UPDATE);
  const [upsertTablePresence] = useMutation(UPSERT_TABLE_PRESENCE);
  const [clearTablePresence] = useMutation(CLEAR_TABLE_PRESENCE);
  const docId = resolvedTableId || "";
  const clientIdRef = useRef("");
  const presenceSessionIdRef = useRef("");
  const ydocRef = useRef<Y.Doc | null>(null);
  const applyingRemoteRef = useRef(false);
  
  // CRITICAL FIX: Refs for tracking previous state in store subscription (MUST be at component level)
  const prevFieldsRef = useRef<Field[]>([]);
  const prevRecordsRef = useRef<TableRecord[]>([]);
  const prevViewsRef = useRef<View[]>([]);
  const prevHiddenFieldIdsRef = useRef<string[]>([]);
  const prevFiltersRef = useRef<FilterCondition[]>([]);
  const prevSortsRef = useRef<SortCondition[]>([]);
  const prevGroupConfigRef = useRef<GroupConfig | null>(null);
  const prevTableIdRef = useRef<string | null>(null);
  const lastTableUpdateAtRef = useRef("");
  const { data: yjsUpdateData } = useSubscription<{
    yjsUpdates: {
      docId: string;
      update: string;
      clientId?: string | null;
      recordPatches?: RealtimeRecordPatch[] | null;
    };
  }>(YJS_UPDATES, { variables: { docId }, skip: !resolvedTableId });
  const { data: tableUpdateData } = useSubscription<{
    tableUpdates: {
      tableId: string;
      updatedAt: string;
      snapshotIncluded?: boolean;
      data?: null;
    };
  }>(TABLE_UPDATES, {
    variables: {
      tableId: resolvedTableId || undefined,
      includeSnapshot: false,
    },
    skip: !token || !resolvedTableId,
  });
  const { data: tablePresenceData } = useSubscription<{
    tablePresenceUpdates: {
      tableId: string;
      updatedAt: string;
      viewers: TablePresenceViewer[];
    };
  }>(TABLE_PRESENCE_UPDATES, {
    variables: { tableId: resolvedTableId || "" },
    skip: !token || !resolvedTableId,
  });
  const errorNoticeRef = useRef("");
  const emptyNoticeRef = useRef("");
  const missingTableRef = useRef("");

  const clone = useCallback(
    <T,>(value: T): T => JSON.parse(JSON.stringify(value)),
    [],
  );
  const buildSnapshot = useCallback(
    (snapshot: {
      fields: Field[];
      records: TableRecord[];
      views: View[];
      hiddenFieldIds: string[];
      filters: FilterCondition[];
      sorts: SortCondition[];
      groupConfig: GroupConfig;
    }) => ({
      fields: clone(snapshot.fields ?? []),
      records: clone(snapshot.records ?? []),
      views: clone(snapshot.views ?? []),
      hiddenFieldIds: clone(snapshot.hiddenFieldIds ?? []),
      filters: clone(snapshot.filters ?? []),
      sorts: clone(snapshot.sorts ?? []),
      groupConfig: clone(
        snapshot.groupConfig ?? {
          fieldId: null,
          order: "asc",
        },
      ),
    }),
    [clone],
  );

  const bytesToBase64 = useCallback((bytes: Uint8Array) => {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }, []);

  const base64ToBytes = useCallback(
    (base64: string) =>
      Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)),
    [],
  );

  const currentPermission = useMemo<PermissionLevel>(() => {
    const accessList = accessData?.itemAccess ?? [];
    if (!accessList.length) return "read";
    const email = user?.email?.toLowerCase();
    const match = email
      ? accessList.find((entry) => entry.email?.toLowerCase() === email)
      : undefined;
    return match?.permission ?? "read";
  }, [accessData?.itemAccess, user?.email]);

  const tableName = useMemo(() => {
    const root = workspaceData?.workspace?.root;
    if (!root || !resolvedTableId) return null;
    const node = findInWorkspace(root, resolvedTableId);
    return node?.name ?? null;
  }, [resolvedTableId, workspaceData?.workspace?.root]);
  const {
    data: tableData,
    loading: tableLoading,
    error: tableError,
    refetch: refetchTableData,
  } = useQuery<{
    fields: Field[];
    views: View[];
    hiddenFieldIds: string[];
    filters: FilterCondition[];
    sorts: SortCondition[];
    groupConfig: GroupConfig;
  }>(GET_TABLE_DATA, {
    variables: { tableId: resolvedTableId || undefined },
    skip: !token || !resolvedTableId,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  });

  const queryRecordPage = useCallback(
    async (offset: number, limit: number): Promise<RecordPageResult> => {
      if (!resolvedTableId) {
        return { records: [], totalCount: 0, offset, limit, hasMore: false };
      }
      const response = await client.query<{ queryRecords: RecordPageResult }>({
        query: QUERY_RECORDS,
        variables: {
          tableId: resolvedTableId,
          filters,
          sorts,
          offset,
          limit: Math.max(1, Math.min(MAX_RECORD_QUERY_LIMIT, limit)),
        },
        fetchPolicy: "network-only",
      });
      return (
        response.data?.queryRecords ?? {
          records: [],
          totalCount: 0,
          offset,
          limit,
          hasMore: false,
          nextOffset: null,
        }
      );
    },
    [filters, resolvedTableId, sorts],
  );

  const refreshRecordWindow = useCallback(
    async (
      targetCount = RECORD_PAGE_SIZE,
      preserveLocalExtras = false,
      eagerSmallTable = true,
    ) => {
      if (!token || !resolvedTableId) return;
      const requestId = ++recordRequestIdRef.current;
      setRecordPageLoading(true);
      try {
        const first = await queryRecordPage(0, RECORD_PAGE_SIZE);
        if (requestId !== recordRequestIdRef.current) return;

        const totalCount = Math.max(0, Number(first.totalCount || 0));
        const desiredCount =
          eagerSmallTable && totalCount <= SMALL_TABLE_EAGER_LIMIT
            ? totalCount
            : Math.min(totalCount, Math.max(RECORD_PAGE_SIZE, targetCount));

        const fetched = [...(first.records || [])];
        let nextOffset = fetched.length;
        while (nextOffset < desiredCount) {
          const page = await queryRecordPage(
            nextOffset,
            Math.min(MAX_RECORD_QUERY_LIMIT, desiredCount - nextOffset),
          );
          if (requestId !== recordRequestIdRef.current) return;
          if (!page.records?.length) break;
          fetched.push(...page.records);
          nextOffset += page.records.length;
        }

        const previousRecords = useSmartTableStore.getState().records;
        const previousServerIds = serverRecordIdsRef.current;
        const localExtras = preserveLocalExtras
          ? previousRecords.filter(
              (record) => !previousServerIds.has(String(record.id)),
            )
          : [];

        const seen = new Set<string>();
        const nextRecords = [...fetched, ...localExtras].filter((record) => {
          const id = String(record.id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        serverRecordIdsRef.current = new Set(
          fetched.map((record) => String(record.id)),
        );
        useSmartTableStore.setState({ records: nextRecords });
        setRecordLoadedCount(fetched.length);
        setRecordTotalCount(totalCount);
      } catch (error) {
        console.error("[SmartTable] Failed to load record page", error);
        message.error(t("largeTable.loadFailed"));
      } finally {
        if (requestId === recordRequestIdRef.current) {
          setRecordPageLoading(false);
        }
      }
    },
    [queryRecordPage, resolvedTableId, token],
  );

  const loadMoreRecords = useCallback(async () => {
    if (
      recordPageLoading ||
      !resolvedTableId ||
      recordLoadedCount >= recordTotalCount
    ) {
      return;
    }
    const requestId = ++recordRequestIdRef.current;
    setRecordPageLoading(true);
    try {
      const page = await queryRecordPage(
        recordLoadedCount,
        Math.min(RECORD_PAGE_SIZE, recordTotalCount - recordLoadedCount),
      );
      if (requestId !== recordRequestIdRef.current) return;

      const currentRecords = useSmartTableStore.getState().records;
      const currentServerIds = serverRecordIdsRef.current;
      const serverRecords = currentRecords.filter((record) =>
        currentServerIds.has(String(record.id)),
      );
      const localExtras = currentRecords.filter(
        (record) => !currentServerIds.has(String(record.id)),
      );
      const appended = [...serverRecords, ...(page.records || [])];
      const seen = new Set<string>();
      const nextRecords = [...appended, ...localExtras].filter((record) => {
        const id = String(record.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      serverRecordIdsRef.current = new Set(
        appended.map((record) => String(record.id)),
      );
      useSmartTableStore.setState({ records: nextRecords });
      setRecordLoadedCount(appended.length);
      setRecordTotalCount(Math.max(0, Number(page.totalCount || 0)));
    } catch (error) {
      console.error("[SmartTable] Failed to load more records", error);
      message.error(t("largeTable.loadFailed"));
    } finally {
      if (requestId === recordRequestIdRef.current) {
        setRecordPageLoading(false);
      }
    }
  }, [
    queryRecordPage,
    recordLoadedCount,
    recordPageLoading,
    recordTotalCount,
    resolvedTableId,
  ]);

  const recordQuerySignature = useMemo(
    () => JSON.stringify({ tableId: resolvedTableId, filters, sorts }),
    [filters, resolvedTableId, sorts],
  );

  useEffect(() => {
    setCurrentPermission(currentPermission);
  }, [currentPermission, setCurrentPermission]);

  useEffect(() => {
    setCurrentTableName(tableName);
  }, [setCurrentTableName, tableName]);

  useEffect(() => {
    setDeepLinkedRecord(deepLinkedRecordData?.recordById ?? null);
  }, [deepLinkedRecordData?.recordById, deepLinkedRecordId]);

  useEffect(() => {
    if (!resolvedTableId || !tableName || !user) return;
    rememberRecentTarget(
      String(user.id ?? user.email ?? "anonymous"),
      {
        entityType: "table",
        entityId: resolvedTableId,
        title: tableName,
        subtitle: "数据表",
        deepLink: `/workbench/${resolvedTableId}/${currentViewId || "v1"}`,
        workspace: null,
        table: {
          id: resolvedTableId,
          name: tableName,
          defaultViewId: currentViewId || null,
        },
      },
    );
  }, [
    currentViewId,
    resolvedTableId,
    resolvedWorkspaceId,
    tableName,
    user,
  ]);

  useEffect(() => {
    if (!resolvedTableId) return;

    const isTableChanged = prevTableIdRef.current !== resolvedTableId;
    if (isTableChanged) {
      prevTableIdRef.current = resolvedTableId;
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
      prevFieldsRef.current = [];
      prevRecordsRef.current = [];
      prevViewsRef.current = [];
      prevHiddenFieldIdsRef.current = [];
      prevFiltersRef.current = [];
      prevSortsRef.current = [];
      prevGroupConfigRef.current = null;
      lastTableUpdateAtRef.current = "";
      lastRecordQuerySignatureRef.current = "";
      serverRecordIdsRef.current = new Set();
      recordRequestIdRef.current += 1;
      setRecordLoadedCount(0);
      setRecordTotalCount(0);
      useSmartTableStore.setState({
        fields: [],
        records: [],
        views: [],
        hiddenFieldIds: [],
        filters: [],
        sorts: [],
        groupConfig: { fieldId: null, order: "asc" },
        currentTableId: resolvedTableId,
      });
    }

    if (tableData && prevTableIdRef.current === resolvedTableId) {
      const currentRecords = useSmartTableStore.getState().records;
      const nextSnapshot = buildSnapshot({
        ...tableData,
        records: currentRecords,
      });
      applyingRemoteRef.current = true;
      setData(nextSnapshot);

      let doc = ydocRef.current;
      if (!doc) {
        doc = new Y.Doc();
        ydocRef.current = doc;
      }
      const map = doc.getMap("table");
      doc.transact(() => {
        map.set("data", nextSnapshot);
      }, "remote");
      applyingRemoteRef.current = false;
    }
  }, [buildSnapshot, resolvedTableId, setData, tableData]);

  useEffect(() => {
    if (!tableData || !resolvedTableId) return;
    if (lastRecordQuerySignatureRef.current === recordQuerySignature) return;
    lastRecordQuerySignatureRef.current = recordQuerySignature;
    serverRecordIdsRef.current = new Set();
    setRecordLoadedCount(0);
    setRecordTotalCount(0);
    void refreshRecordWindow(RECORD_PAGE_SIZE, false, true);
  }, [
    recordQuerySignature,
    refreshRecordWindow,
    resolvedTableId,
    tableData,
  ]);

  useEffect(() => {
    if (tableId || !firstTable) return;
    const savedView = getTableLastViewId(firstTable.id);
    navigate(
      `/workbench/${firstTable.id}/${savedView || firstTable.defaultViewId || "v1"}`,
      { replace: true },
    );
  }, [firstTable, navigate, tableId]);

  useEffect(() => {
    if (!tableError) return;
    const graphQLErrors =
      (tableError as { graphQLErrors?: { message: string }[] } | undefined)
        ?.graphQLErrors ?? [];
    const errorMessages = graphQLErrors.map((err) => err.message || "");
    const accessDenied = errorMessages.some((message) =>
      /unauthorized|no access/i.test(message),
    );
    const workspaceMissing = errorMessages.some((message) =>
      /workspace not found/i.test(message),
    );
    if (accessDenied) {
      if (firstTable && firstTable.id !== resolvedTableId) {
        const savedView = getTableLastViewId(firstTable.id);
        const nextViewId =
          savedView || firstTable.defaultViewId || "v1";
        const key = `table-fallback-${resolvedTableId}`;
        if (missingTableRef.current !== key) {
          missingTableRef.current = key;
          navigate(`/workbench/${firstTable.id}/${nextViewId}`, {
            replace: true,
          });
          return;
        }
      }
      navigate("/unauthorized", { replace: true });
      return;
    }
    if (workspaceMissing && firstTable && firstTable.id !== resolvedTableId) {
      const savedView = getTableLastViewId(firstTable.id);
      const nextViewId = savedView || firstTable.defaultViewId || "v1";
      const key = `workspace-fallback-${resolvedTableId}`;
      if (missingTableRef.current !== key) {
        missingTableRef.current = key;
        navigate(`/workbench/${firstTable.id}/${nextViewId}`, {
          replace: true,
        });
        return;
      }
    }
    const nextKey = `table-error-${tableId ?? "dstDefault"}`;
    if (errorNoticeRef.current !== nextKey) {
      message.error(t("smartTable.recordLoadFailed"));
      errorNoticeRef.current = nextKey;
    }
  }, [firstTable, navigate, resolvedTableId, tableError, tableId]);

  useEffect(() => {
    if (!resolvedTableId || tableLoading || tableError || !tableData) return;
    const hasData =
      (tableData.fields?.length ?? 0) > 0 ||
      (tableData.views?.length ?? 0) > 0;
    if (hasData) return;
    const nextKey = `table-empty-${tableId ?? "dstDefault"}`;
    if (emptyNoticeRef.current !== nextKey) {
      message.warning(t("smartTable.noDisplayData"));
      emptyNoticeRef.current = nextKey;
    }
  }, [resolvedTableId, tableData, tableError, tableLoading, tableId]);

  useEffect(() => {
    if (!tableId) return;
    const root = workspaceData?.workspace?.root;
    if (!root) return;
    if (findInWorkspace(root, tableId)) return;
    const fallback = firstTable;
    if (!fallback || fallback.id === tableId) return;
    const savedView = getTableLastViewId(fallback.id);
    const nextViewId = savedView || fallback.defaultViewId || "v1";
    const key = `missing-table-${tableId}`;
    if (missingTableRef.current !== key) {
      missingTableRef.current = key;
      navigate(`/workbench/${fallback.id}/${nextViewId}`, { replace: true });
    }
  }, [
    firstTable,
    navigate,
    resolvedTableId,
    tableId,
    workspaceData?.workspace?.root,
  ]);

  useEffect(() => {
    if (!docId) return;
    if (!clientIdRef.current) {
      clientIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    
    // Ensure we have a fresh Yjs document
    let doc = ydocRef.current;
    if (!doc) {
      doc = new Y.Doc();
      ydocRef.current = doc;
    }
    
    const map = doc.getMap("table");
    
    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote" || applyingRemoteRef.current) {
        return;
      }
      console.log(
        `%c[DATA_FLOW:SYNC] %cYjs→Publish %c| origin=${String(origin)} %c| updateSize=${update.length}bytes`,
        'color:#e056a0;font-weight:bold',
        'color:#e056a0',
        'color:#888',
        'color:#888'
      );
      const { getRecordPatches, clearRecordPatches } =
        useSmartTableStore.getState();
      const recordPatches = getRecordPatches();
      publishYjsUpdate({
        variables: {
          docId,
          update: bytesToBase64(update),
          clientId: clientIdRef.current,
          recordPatches: recordPatches.length > 0 ? recordPatches : undefined,
        },
      })
        .then(() => {
          if (recordPatches.length > 0) {
            clearRecordPatches();
          }
        })
        .catch(() => {});
    };
    doc.on("update", handleUpdate);
    
    // Use refs to track previous state (refs already declared at component level)
    let isSyncingFromStore = false;
    
    // OPTIMIZED: Use selective subscription with reference equality checks
    // This avoids expensive JSON.stringify on every store change
    const unsubscribe = useSmartTableStore.subscribe((state) => {
      // Skip if we're currently applying remote updates
      if (applyingRemoteRef.current || isSyncingFromStore) {
        return;
      }
      
      // OPTIMIZATION: Use shallow reference equality checks first
      // Only sync if references actually changed
      const prevFields = prevFieldsRef.current;
      const prevRecords = prevRecordsRef.current;
      const prevViews = prevViewsRef.current;
      const prevHiddenFieldIds = prevHiddenFieldIdsRef.current;
      const prevFilters = prevFiltersRef.current;
      const prevSorts = prevSortsRef.current;
      const prevGroupConfig = prevGroupConfigRef.current;
      
      const hasChanged = 
        state.fields !== prevFields ||
        state.records !== prevRecords ||
        state.views !== prevViews ||
        state.hiddenFieldIds !== prevHiddenFieldIds ||
        state.filters !== prevFilters ||
        state.sorts !== prevSorts ||
        state.groupConfig !== prevGroupConfig;
      
      // If nothing changed (same references), skip expensive sync
      if (!hasChanged) {
        return;
      }

      const recordsChanged = state.records !== prevRecords;
      if (recordsChanged) {
        console.log(
          `%c[DATA_FLOW:SYNC] %cStore→Yjs %c| records: ${prevRecords.length}→${state.records.length} %c| applyingRemote=${applyingRemoteRef.current}`,
          'color:#e056a0;font-weight:bold',
          'color:#e056a0',
          'color:#888',
          'color:#888'
        );
      }
      
      const snapshot = {
        fields: state.fields,
        records: state.records,
        views: state.views,
        hiddenFieldIds: state.hiddenFieldIds,
        filters: state.filters,
        sorts: state.sorts,
        groupConfig: state.groupConfig,
      };
      
      // Update refs to current values
      prevFieldsRef.current = state.fields;
      prevRecordsRef.current = state.records;
      prevViewsRef.current = state.views;
      prevHiddenFieldIdsRef.current = state.hiddenFieldIds;
      prevFiltersRef.current = state.filters;
      prevSortsRef.current = state.sorts;
      prevGroupConfigRef.current = state.groupConfig;
      
      // Sync to Yjs
      isSyncingFromStore = true;
      try {
        doc.transact(() => {
          map.set("data", snapshot);
        });
      } finally {
        isSyncingFromStore = false;
      }
    });
    
    return () => {
      unsubscribe();
      doc.off("update", handleUpdate);
      // Don't destroy doc here - let the table change effect handle it
    };
  }, [bytesToBase64, docId, publishYjsUpdate]);

  useEffect(() => {
    const payload = yjsUpdateData?.yjsUpdates;
    if (!payload || payload.docId !== docId) {
      return;
    }
    if (payload.clientId && payload.clientId === clientIdRef.current) {
      console.log(
        `%c[DATA_FLOW:WS] %cyjsUpdates SKIPPED (own clientId) %c| clientId=${payload.clientId}`,
        'color:#a29bfe;font-weight:bold',
        'color:#a29bfe',
        'color:#888'
      );
      return;
    }
    console.log(
      `%c[DATA_FLOW:WS] %cyjsUpdates RECEIVED %c| clientId=${payload.clientId || 'none'} %c| patches=${(payload.recordPatches || []).length}`,
      'color:#a29bfe;font-weight:bold',
      'color:#a29bfe',
      'color:#888',
      'color:#888'
    );
    const doc = ydocRef.current;
    if (!doc) {
      return;
    }
    const remotePatches = payload.recordPatches || [];
    if (remotePatches.length > 0) {
      applyingRemoteRef.current = true;
      useSmartTableStore.setState((state) => ({
        records: state.records.map((record) => {
          const updates = remotePatches.filter(
            (patch) => patch.recordId === record.id,
          );
          if (updates.length === 0) {
            return record;
          }
          const nextRecord = { ...record };
          updates.forEach((patch) => {
            nextRecord[patch.fieldId] = patch.value;
          });
          return nextRecord;
        }),
      }));
      applyingRemoteRef.current = false;
    }
    // Keep Yjs doc in sync with remote updates, but do NOT use the merged
    // Yjs snapshot to overwrite the store. The Yjs CRDT merge does not
    // understand "delete" semantics — it may restore deleted records by
    // merging an older snapshot that still contains them. Instead, rely on
    // lightweight `tableUpdates` invalidation + paged server refresh as the
    // authoritative server-side data source.
    if (payload.update) {
      const update = base64ToBytes(payload.update);
      if (update.byteLength > 0) {
        Y.applyUpdate(doc, update, "remote");
      }
    }
  }, [
    base64ToBytes,
    docId,
    yjsUpdateData,
  ]);

  useEffect(() => {
    const payload = tableUpdateData?.tableUpdates;
    if (!payload || payload.tableId !== resolvedTableId) {
      return;
    }

    const updateAt = payload.updatedAt || "";
    if (
      updateAt &&
      lastTableUpdateAtRef.current &&
      updateAt <= lastTableUpdateAtRef.current
    ) {
      return;
    }
    if (updateAt) {
      lastTableUpdateAtRef.current = updateAt;
    }

    // Lightweight invalidation: metadata and only the currently loaded record
    // window are refreshed. Local just-created rows outside the server window
    // are preserved until the next filter/sort reset.
    void refetchTableData();
    void refreshRecordWindow(
      Math.max(recordLoadedCount, RECORD_PAGE_SIZE),
      true,
      true,
    );
  }, [
    recordLoadedCount,
    refetchTableData,
    refreshRecordWindow,
    resolvedTableId,
    tableUpdateData,
  ]);

  useEffect(() => {
    if (!resolvedTableId) {
      setActiveViewers([]);
      return;
    }
    const payload = tablePresenceData?.tablePresenceUpdates;
    if (!payload || payload.tableId !== resolvedTableId) {
      return;
    }
    setActiveViewers(payload.viewers || []);
  }, [resolvedTableId, setActiveViewers, tablePresenceData]);

  useEffect(() => {
    if (!token || !resolvedTableId) {
      return;
    }
    if (!presenceSessionIdRef.current) {
      presenceSessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const sessionId = presenceSessionIdRef.current;
    let stopped = false;
    const minSyncIntervalMs = 15000;
    let lastSyncAt = 0;
    const syncPresence = (force = false) => {
      if (stopped) return;
      if (!force && document.hidden) return;
      const now = Date.now();
      if (!force && now - lastSyncAt < minSyncIntervalMs) return;
      lastSyncAt = now;
      upsertTablePresence({
        variables: {
          tableId: resolvedTableId,
          sessionId,
        },
      })
        .then((result) => {
          if (stopped) {
            return;
          }
          const viewers = (
            result.data as { upsertTablePresence?: TablePresenceViewer[] } | undefined
          )?.upsertTablePresence;
          if (Array.isArray(viewers)) {
            setActiveViewers(viewers);
          }
        })
        .catch(() => {});
    };
    const handleUserActivity = () => {
      syncPresence(false);
    };
    const handleVisible = () => {
      if (document.hidden) {
        clearTablePresence({
          variables: {
            tableId: resolvedTableId,
            sessionId,
          },
        }).catch(() => {});
        return;
      }
      syncPresence(true);
    };
    const handleLeave = () => {
      clearTablePresence({
        variables: {
          tableId: resolvedTableId,
          sessionId,
        },
      }).catch(() => {});
    };
    syncPresence(true);
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleUserActivity);
    window.addEventListener("pointerdown", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("pagehide", handleLeave);
    window.addEventListener("beforeunload", handleLeave);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleUserActivity);
      window.removeEventListener("pointerdown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("pagehide", handleLeave);
      window.removeEventListener("beforeunload", handleLeave);
      handleLeave();
      setActiveViewers([]);
    };
  }, [
    clearTablePresence,
    resolvedTableId,
    setActiveViewers,
    token,
    upsertTablePresence,
  ]);

  // CRITICAL: Cleanup Yjs document on component unmount
  useEffect(() => {
    return () => {
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    };
  }, []);

  // Sync URL viewId → store (single source of truth = URL).
  // When URL viewId is valid for the current table's views, follow it.
  // When missing/invalid, consult localStorage then fall back to views[0].
  useEffect(() => {
    if (!views.length || !resolvedTableId) return;

    if (viewId && views.some((view) => view.id === viewId)) {
      if (currentViewId !== viewId) {
        setCurrentView(viewId);
      }
      return;
    }

    // viewId is missing or not in current table's views — resolve the target
    const savedViewId = getTableLastViewId(resolvedTableId);
    const targetView = savedViewId
      ? views.find((v) => v.id === savedViewId)
      : null;
    const fallback = targetView || views[0];

    if (fallback) {
      if (currentViewId !== fallback.id) {
        setCurrentView(fallback.id);
      }
      if (tableId) {
        navigate(`/workbench/${tableId}/${fallback.id}`, {
          replace: true,
        });
      }
    }
  }, [currentViewId, navigate, resolvedTableId, setCurrentView, tableId, viewId, views]);

  const currentView = views.find((v) => v.id === currentViewId);
  const isGanttView =
    currentView?.type === "gantt" ||
    currentView?.id === "v2" ||
    /gantt/i.test(currentView?.name || "");
  const isCalendarView = currentView?.type === "calendar";
  const isGalleryView = currentView?.type === "gallery";

  const totalBudget = useMemo(() => {
    const budgetField = fields.find((f) => f.name === "BUDGET");
    if (!budgetField) return 0;
    return records.reduce((sum, r) => sum + Number(r[budgetField.id] ?? 0), 0);
  }, [fields, records]);

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", backgroundColor: "white" }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <Header />
        {(currentView?.type === "grid" ||
          currentView?.type === "board" ||
          currentView?.type === "gantt" ||
          currentView?.type === "calendar" ||
          currentView?.type === "gallery") && (
          <Toolbar
            onTaskPlanningApplied={async () => {
              useSmartTableStore.getState().setSelectedRecordIds([]);
              await refetchTableData();
              await refreshRecordWindow(
                Math.max(recordLoadedCount + RECORD_PAGE_SIZE, RECORD_PAGE_SIZE),
                false,
                true,
              );
            }}
            onWorkloadPlanningApplied={async () => {
              await refetchTableData();
              await refreshRecordWindow(
                Math.max(recordLoadedCount + RECORD_PAGE_SIZE, RECORD_PAGE_SIZE),
                false,
                true,
              );
            }}
            onAiVisualDesignApplied={async (result) => {
              if (result.targetType === "view" && result.view) {
                const refreshed = await refetchTableData();
                const nextViews = refreshed.data?.views ?? [];
                useSmartTableStore.setState({ views: nextViews });
                setCurrentView(result.view.id);
                navigate(
                  "/workbench/" +
                    result.view.tableId +
                    "/" +
                    result.view.id,
                );
                return;
              }
              if (result.targetType === "dashboard" && result.dashboard) {
                await refetchWorkspace();
                navigate("/workbench/" + result.dashboard.id);
              }
            }}
            onViewSettingsClick={
              isGanttView
                ? () => setGanttConfigModalOpen(true)
                : isCalendarView
                  ? () => setCalendarConfigModalOpen(true)
                  : isGalleryView
                    ? () => setGalleryConfigModalOpen(true)
                    : undefined
            }
          />
        )}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <ErrorBoundary>
            <Suspense fallback={<ViewLoadingFallback />}>
              {currentView?.type === "grid" && !isGanttView && <GridView />}
              {isGanttView && (
                <GanttView
                  configModalOpen={ganttConfigModalOpen}
                  onConfigModalOpen={() => setGanttConfigModalOpen(true)}
                  onConfigModalClose={() => setGanttConfigModalOpen(false)}
                />
              )}
              {currentView?.type === "dashboard" && <DashboardView />}
              {currentView?.type === "board" && <BoardView />}
              {isCalendarView && (
                <CalendarView
                  configModalOpen={calendarConfigModalOpen}
                  onConfigModalOpen={() => setCalendarConfigModalOpen(true)}
                  onConfigModalClose={() => setCalendarConfigModalOpen(false)}
                />
              )}
              {isGalleryView && (
                <GalleryView
                  configModalOpen={galleryConfigModalOpen}
                  onConfigModalClose={() => setGalleryConfigModalOpen(false)}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
        <div
          style={{
            height: 42,
            borderTop: "1px solid #EAECF0",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            backgroundColor: "white",
          }}
        >
          <Space size={24}>
            <Text
              style={{
                color: "#5F6B7C",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              {recordLoadedCount < recordTotalCount
                ? t("footer.loadedBudget")
                : t("footer.totalBudget")}: $
              {totalBudget.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
            <Text
              style={{
                color: "#5F6B7C",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              {recordLoadedCount} / {recordTotalCount} {t("footer.recordsFound")}
            </Text>
            {recordLoadedCount < recordTotalCount ? (
              <Button
                type="link"
                size="small"
                loading={recordPageLoading}
                onClick={() => void loadMoreRecords()}
                style={{ padding: 0, height: 24, fontSize: 12 }}
              >
                {t("largeTable.loadMore")}
              </Button>
            ) : null}
          </Space>
        </div>
      </div>
      <RowDetailDrawer
        open={Boolean(deepLinkedRecordId)}
        title={
          deepLinkedRecord && fields[0]
            ? String(deepLinkedRecord[fields[0].id] ?? t("smartTable.recordDetail"))
            : t("smartTable.recordDetail")
        }
        record={deepLinkedRecord}
        fields={fields}
        canUpdate={permissionAllows(currentPermission, "update")}
        loading={deepLinkedRecordLoading}
        error={deepLinkedRecordError?.message || null}
        onRetry={() => {
          void refetchDeepLinkedRecord();
        }}
        onClose={clearDeepLinkedRecord}
        onUpdateRecord={(recordId, fieldId, value) => {
          setDeepLinkedRecord((current) =>
            current && String(current.id) === String(recordId)
              ? { ...current, [fieldId]: value }
              : current,
          );
          updateRecord(recordId, fieldId, value);
        }}
      />
      <AiAssistant />
    </div>
  );

  if (embedded) return content;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        backgroundColor: "var(--qtable-color-background)",
      }}
    >
      <Sidebar />
      {content}
    </div>
  );
}
