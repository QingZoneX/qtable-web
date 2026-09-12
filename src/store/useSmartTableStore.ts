import { create } from 'zustand';
import { client } from "../lib/apollo";
import {
  INSERT_ROW,
  INSERT_ROWS,
  INSERT_ROWS_WITH_DATA,
  ADD_FIELD,
  UPDATE_FIELD,
  UPDATE_RECORD,
  UPDATE_CALENDAR_RANGE,
  DELETE_FIELD,
  DELETE_RECORD,
  REORDER_FIELDS,
  UPDATE_VIEW_CONFIG,
  CREATE_VIEW,
  RENAME_VIEW,
  COPY_VIEW,
  DELETE_VIEW,
  GET_TABLE_DATA,
  RECORD_BY_ID,
} from "../lib/graphql";
import { emitWriteFeedback } from "./writeFeedback";
import {
  writeErrorMessage,
  writeFail,
  writeOk,
  type WriteResult,
} from "./writeResult";

const VIEW_STORAGE_KEY = "qtable.tableView";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "qtable.sidebarCollapsed";
const SIDEBAR_WIDTH_STORAGE_KEY = "qtable.sidebarWidth";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_COLLAPSE_THRESHOLD = 100;

function loadViewMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveViewMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function clampSidebarWidth(width: number): number {
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
}

function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function loadSidebarWidth(): number {
  try {
    const raw = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw > 0) {
      return clampSidebarWidth(raw);
    }
    return SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // ignore storage errors
  }
}

function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(clampSidebarWidth(width)),
    );
  } catch {
    // ignore storage errors
  }
}

export function getTableLastViewId(tableId: string): string | null {
  return loadViewMap()[tableId] ?? null;
}

export function setTableLastViewId(tableId: string, viewId: string): void {
  try {
    const map = loadViewMap();
    map[tableId] = viewId;
    saveViewMap(map);
  } catch {
    // ignore storage errors
  }
}

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multiSelect"
  | "member"
  | "date"
  | "progress"
  | "url"
  | "image"
  | "rating"
  | "email"
  | "phone"
  | "attachment"
  | "autoNumber";

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  options?: SelectOption[];
  property?: {
    unit?: string;
    format?: string;
    max?: number;
    currency?: string;
    precision?: number;
    thousandsSeparator?: boolean;
    prefix?: string;
    suffix?: string;
    digits?: number;
    start?: number;
    nextNumber?: number;
    multiple?: boolean;
  };
}

export interface TableRecord {
  id: string;
  [key: string]: unknown;
}

const normalizeFieldValueForWrite = (
  fields: Field[],
  fieldId: string,
  value: unknown,
): unknown => {
  const field = fields.find((item) => item.id === fieldId);
  if (field?.type === "text" && typeof value === "string") {
    return value.trim();
  }
  return value;
};

const isReadOnlyField = (field?: Field) =>
  field?.type === "autoNumber" || String(field?.type || "") === "formula";

const normalizeRecordDataForWrite = (
  fields: Field[],
  data: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([fieldId]) => {
        const field = fields.find((item) => item.id === fieldId);
        return !isReadOnlyField(field);
      })
      .map(([fieldId, value]) => [
        fieldId,
        normalizeFieldValueForWrite(fields, fieldId, value),
      ]),
  );

export type ViewType =
  | "grid"
  | "dashboard"
  | "board"
  | "gantt"
  | "calendar"
  | "gallery";

export type ToolbarItem =
  | "insertRow"
  | "fields"
  | "filter"
  | "group"
  | "sort"
  | "automations"
  | "share"
  | "viewSettings";

export interface ViewConfig {
  toolbar?: {
    items: ToolbarItem[];
  };
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  groupConfig?: GroupConfig;
  hiddenFieldIds?: string[];
  ganttConfig?: {
    startFieldId?: string | null;
    endFieldId?: string | null;
    progressFieldId?: string | null;
  };
  calendarConfig?: {
    /** @deprecated legacy single-date calendar config */
    dateFieldId?: string | null;
    startFieldId?: string | null;
    endFieldId?: string | null;
    weekStartsOn?: 0 | 1;
  };
  galleryConfig?: {
    coverFieldId?: string | null;
    titleFieldId?: string | null;
    cardSize?: "small" | "medium" | "large";
    imageFit?: "cover" | "contain";
    showFieldNames?: boolean;
  };
}

export interface View {
  id: string;
  name: string;
  type: ViewType;
  config?: ViewConfig;
}

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: string;
  value: unknown;
  logic: "and" | "or" | "where";
}

export interface SortCondition {
  fieldId: string;
  order: "asc" | "desc";
}

export interface GroupConfig {
  fieldId: string | null;
  order: "asc" | "desc";
}

export interface RecordPatch {
  recordId: string;
  fieldId: string;
  value: unknown;
}

export interface TablePresenceViewer {
  userId?: number | null;
  name: string;
  email?: string | null;
}

export type PermissionLevel = "read" | "update" | "edit" | "manage";

export const permissionOrder: Record<PermissionLevel, number> = {
  read: 0,
  update: 1,
  edit: 2,
  manage: 3,
};

export const permissionAllows = (
  current: PermissionLevel | null | undefined,
  required: PermissionLevel,
) => permissionOrder[current ?? "read"] >= permissionOrder[required];

const defaultToolbarItems: Record<ViewType, ToolbarItem[]> = {
  grid: [
    "insertRow",
    "fields",
    "filter",
    "group",
    "sort",
    "automations",
    "share",
  ],
  board: ["group", "filter", "sort", "share"],
  dashboard: ["share"],
  gantt: ["insertRow", "viewSettings", "fields", "filter", "group", "sort", "automations", "share"],
  calendar: ["insertRow", "viewSettings", "fields", "filter", "sort", "share"],
  gallery: ["insertRow", "viewSettings", "fields", "filter", "sort", "share"],
};

const buildDefaultViewConfig = (
  viewType: ViewType,
  overrides?: Partial<ViewConfig>,
): ViewConfig => ({
  toolbar: { items: [...defaultToolbarItems[viewType]] },
  filters: [],
  sorts: [],
  groupConfig: { fieldId: null, order: "asc" },
  hiddenFieldIds: [],
  ...overrides,
});

type TableMetadata = {
  fields: Field[];
  views: View[];
  hiddenFieldIds: string[];
  filters: FilterCondition[];
  sorts: SortCondition[];
  groupConfig: GroupConfig;
};

interface SmartTableState {
  fields: Field[];
  records: TableRecord[];
  views: View[];
  currentViewId: string;
  currentTableId?: string | null;
  currentTableName: string | null;
  currentPermission: PermissionLevel | null;
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  filters: FilterCondition[];
  sorts: SortCondition[];
  groupConfig: GroupConfig;
  hiddenFieldIds: string[];
  pendingRecordPatches: RecordPatch[];
  activeViewers: TablePresenceViewer[];
  selectedRecordIds: string[];
  deletedRecordIds: Map<string, number>;

  setData: (payload: {
    fields: Field[];
    records: TableRecord[];
    views: View[];
    hiddenFieldIds?: string[];
    filters?: FilterCondition[];
    sorts?: SortCondition[];
    groupConfig?: GroupConfig;
  }) => void;
  addField: (field: Field, index?: number) => Promise<WriteResult<Field>>;
  updateField: (
    fieldId: string,
    updates: Partial<Field>,
  ) => Promise<WriteResult<Field>>;
  deleteField: (fieldId: string) => Promise<WriteResult<boolean>>;
  addRecord: (record: TableRecord) => void;
  insertRow: (preset?: Record<string, unknown>) => Promise<TableRecord | null>;
  insertRows: (count: number) => Promise<TableRecord[]>;
  insertRowsWithData: (recordsData: Record<string, unknown>[]) => Promise<TableRecord[]>;
  updateRecord: (
    recordId: string,
    fieldId: string,
    value: unknown,
  ) => Promise<WriteResult<TableRecord>>;
  updateCalendarRange: (
    recordId: string,
    startFieldId: string,
    startValue: unknown,
    endFieldId?: string | null,
    endValue?: unknown,
  ) => Promise<boolean>;
  getRecordPatches: () => RecordPatch[];
  clearRecordPatches: () => void;
  deleteRecord: (recordId: string) => Promise<WriteResult<boolean>>;
  setCurrentView: (viewId: string) => void;
  updateViewConfig: (viewId: string, config: ViewConfig) => void;
  createView: (
    viewType: Extract<
      ViewType,
      "grid" | "board" | "gantt" | "calendar" | "gallery"
    >,
    name?: string,
  ) => Promise<View | null>;
  renameView: (viewId: string, name: string) => Promise<boolean>;
  copyView: (viewId: string, newName?: string) => Promise<View | null>;
  deleteView: (viewId: string) => Promise<boolean>;
  setCurrentTableName: (name: string | null) => void;
  setCurrentPermission: (permission: PermissionLevel | null) => void;
  setActiveViewers: (viewers: TablePresenceViewer[]) => void;
  setSelectedRecordIds: (recordIds: string[]) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarWidth: (width: number) => void;

  setFilters: (filters: FilterCondition[]) => void;
  setSorts: (sorts: SortCondition[]) => void;
  setGroupConfig: (config: GroupConfig) => void;
  setHiddenFieldIds: (ids: string[]) => void;
  toggleFieldVisibility: (fieldId: string) => void;
  reorderFields: (fields: Field[]) => Promise<WriteResult<boolean>>;
  setCurrentTable: (tableId: string | null) => void;
  cleanupDeletedRecordIds: () => void;
}

const normalizeViewConfig = (
  viewType: ViewType,
  config: ViewConfig | undefined,
  legacyDefaults: Partial<ViewConfig>,
): ViewConfig => {
  const isActuallyGantt =
    viewType === "gantt" ||
    config?.ganttConfig !== undefined ||
    (legacyDefaults && 'ganttConfig' in legacyDefaults && legacyDefaults.ganttConfig !== undefined);

  const effectiveViewType = isActuallyGantt ? "gantt" : viewType;
  const baseDefaults = buildDefaultViewConfig(effectiveViewType, legacyDefaults);
  const defaultItems = defaultToolbarItems[effectiveViewType] || [];
  const savedItems = config?.toolbar?.items || [];
  const savedSet = new Set(savedItems);
  const missingDefaults = defaultItems.filter(item => !savedSet.has(item));
  const mergedItems = [...savedItems, ...missingDefaults];
  const toolbar = { items: mergedItems };

  return {
    toolbar,
    filters: Array.isArray(config?.filters)
      ? config?.filters
      : baseDefaults.filters,
    sorts: Array.isArray(config?.sorts) ? config?.sorts : baseDefaults.sorts,
    groupConfig: config?.groupConfig ?? baseDefaults.groupConfig,
    hiddenFieldIds: Array.isArray(config?.hiddenFieldIds)
      ? config?.hiddenFieldIds
      : baseDefaults.hiddenFieldIds,
    ganttConfig: config?.ganttConfig ?? baseDefaults.ganttConfig,
    calendarConfig:
      effectiveViewType === "calendar"
        ? {
            startFieldId:
              config?.calendarConfig?.startFieldId ??
              config?.calendarConfig?.dateFieldId ??
              null,
            endFieldId: config?.calendarConfig?.endFieldId ?? null,
            weekStartsOn:
              config?.calendarConfig?.weekStartsOn === 0 ? 0 : 1,
          }
        : config?.calendarConfig ?? baseDefaults.calendarConfig,
    galleryConfig:
      config?.galleryConfig ??
      (effectiveViewType === "gallery"
        ? {
            coverFieldId: null,
            titleFieldId: null,
            cardSize: "medium",
            imageFit: "cover",
            showFieldNames: true,
          }
        : baseDefaults.galleryConfig),
  };
};

const needsConfigUpdate = (viewType: ViewType, config: ViewConfig | undefined) => {
  if (!config) return true;
  if (!config.toolbar || !Array.isArray(config.toolbar.items)) return true;
  if (!Array.isArray(config.filters)) return true;
  if (!Array.isArray(config.sorts)) return true;
  if (!config.groupConfig) return true;
  if (!Array.isArray(config.hiddenFieldIds)) return true;

  const isActuallyGantt =
    viewType === "gantt" ||
    config?.ganttConfig !== undefined;

  if (isActuallyGantt && !config.ganttConfig) return true;
  if (viewType === "calendar") {
    if (!config.calendarConfig) return true;
    const calendarConfig = config.calendarConfig;
    const hasStartFieldKey = Object.prototype.hasOwnProperty.call(
      calendarConfig,
      "startFieldId",
    );
    const hasEndFieldKey = Object.prototype.hasOwnProperty.call(
      calendarConfig,
      "endFieldId",
    );
    if (!hasStartFieldKey || !hasEndFieldKey) return true;
  }
  if (viewType === "gallery" && !config.galleryConfig) return true;

  const effectiveViewType = isActuallyGantt ? "gantt" : viewType;
  const defaultItems = defaultToolbarItems[effectiveViewType] || [];
  const savedItems = config.toolbar.items;
  const savedSet = new Set(savedItems);
  const hasAllDefaults = defaultItems.every(item => savedSet.has(item));
  if (!hasAllDefaults) return true;

  return false;
};

type ViewConfigSyncKey = keyof Pick<
  ViewConfig,
  | "toolbar"
  | "filters"
  | "sorts"
  | "groupConfig"
  | "hiddenFieldIds"
  | "ganttConfig"
  | "calendarConfig"
  | "galleryConfig"
>;

const VIEW_CONFIG_SYNC_KEYS: ViewConfigSyncKey[] = [
  "toolbar",
  "filters",
  "sorts",
  "groupConfig",
  "hiddenFieldIds",
  "ganttConfig",
  "calendarConfig",
  "galleryConfig",
];

const pendingViewConfigPatches = new Map<string, Partial<ViewConfig>>();
const pendingFieldOrders = new Map<string, string[]>();
const writeRevisions = new Map<string, number>();

const viewConfigSyncKey = (
  tableId: string | null | undefined,
  viewId: string,
) => `${tableId || "__default__"}::${viewId}`;

const sameSyncValue = (left: unknown, right: unknown) => {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const beginWrite = (key: string) => {
  const revision = (writeRevisions.get(key) || 0) + 1;
  writeRevisions.set(key, revision);
  return revision;
};

const isCurrentWrite = (key: string, revision: number) =>
  writeRevisions.get(key) === revision;

const finishWrite = (key: string, revision: number) => {
  if (isCurrentWrite(key, revision)) {
    writeRevisions.delete(key);
  }
};

const markPendingViewConfig = (
  tableId: string | null | undefined,
  viewId: string,
  patch: Partial<ViewConfig>,
) => {
  const key = viewConfigSyncKey(tableId, viewId);
  pendingViewConfigPatches.set(key, {
    ...(pendingViewConfigPatches.get(key) || {}),
    ...patch,
  });
};

const clearFailedPendingViewConfig = (
  tableId: string | null | undefined,
  viewId: string,
  patch: Partial<ViewConfig>,
) => {
  const key = viewConfigSyncKey(tableId, viewId);
  const pending = pendingViewConfigPatches.get(key);
  if (!pending) return;
  const next = { ...pending };
  for (const configKey of VIEW_CONFIG_SYNC_KEYS) {
    if (
      Object.prototype.hasOwnProperty.call(patch, configKey) &&
      sameSyncValue(next[configKey], patch[configKey])
    ) {
      delete next[configKey];
    }
  }
  if (Object.keys(next).length > 0) {
    pendingViewConfigPatches.set(key, next);
  } else {
    pendingViewConfigPatches.delete(key);
  }
};

const reconcilePendingViewConfig = (
  tableId: string | null | undefined,
  viewId: string,
  incoming: ViewConfig,
): ViewConfig => {
  const key = viewConfigSyncKey(tableId, viewId);
  const pending = pendingViewConfigPatches.get(key);
  if (!pending) return incoming;

  const merged: ViewConfig = { ...incoming };
  const remaining: Partial<ViewConfig> = {};

  for (const configKey of VIEW_CONFIG_SYNC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(pending, configKey)) continue;
    const localValue = pending[configKey];
    if (sameSyncValue(incoming[configKey], localValue)) {
      continue;
    }
    (merged as Record<string, unknown>)[configKey] = localValue;
    (remaining as Record<string, unknown>)[configKey] = localValue;
  }

  if (Object.keys(remaining).length > 0) {
    pendingViewConfigPatches.set(key, remaining);
  } else {
    pendingViewConfigPatches.delete(key);
  }
  return merged;
};

const reconcilePendingFieldOrder = (
  tableId: string | null | undefined,
  fields: Field[],
): Field[] => {
  if (!tableId) return fields;
  const pendingOrder = pendingFieldOrders.get(tableId);
  if (!pendingOrder) return fields;

  const incomingIds = fields.map((field) => field.id);
  const incomingSet = new Set(incomingIds);
  const effectivePendingOrder = pendingOrder.filter((id) => incomingSet.has(id));
  const pendingSet = new Set(effectivePendingOrder);
  const desiredOrder = [
    ...effectivePendingOrder,
    ...incomingIds.filter((id) => !pendingSet.has(id)),
  ];

  if (sameSyncValue(incomingIds, desiredOrder)) {
    pendingFieldOrders.delete(tableId);
    return fields;
  }

  const rank = new Map(desiredOrder.map((id, index) => [id, index]));
  return [...fields].sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
};

type ViewConfigPersistJob = {
  config: ViewConfig;
  patch?: Partial<ViewConfig>;
};

type ViewConfigPersistQueue = {
  inFlight: boolean;
  latest: ViewConfigPersistJob | null;
};

const viewConfigPersistQueues = new Map<string, ViewConfigPersistQueue>();

const queueViewConfigPersist = (
  tableId: string | null | undefined,
  viewId: string,
  config: ViewConfig,
  patch?: Partial<ViewConfig>,
) => {
  const key = viewConfigSyncKey(tableId, viewId);
  let queue = viewConfigPersistQueues.get(key);
  if (!queue) {
    queue = { inFlight: false, latest: null };
    viewConfigPersistQueues.set(key, queue);
  }

  queue.latest = { config, patch };
  if (queue.inFlight) return;

  const drain = async () => {
    const currentQueue = viewConfigPersistQueues.get(key);
    if (!currentQueue || currentQueue.inFlight) return;

    const job = currentQueue.latest;
    if (!job) {
      viewConfigPersistQueues.delete(key);
      return;
    }

    currentQueue.latest = null;
    currentQueue.inFlight = true;
    try {
      await client.mutate({
        mutation: UPDATE_VIEW_CONFIG,
        variables: {
          viewId,
          config: job.config,
          tableId: tableId ?? undefined,
        },
      });
    } catch {
      if (job.patch) {
        clearFailedPendingViewConfig(tableId, viewId, job.patch);
      }
      emitWriteFeedback({
        level: "error",
        operation: "updateViewConfig",
        key,
        message: "视图配置保存失败，服务器状态将在下次刷新时恢复。",
      });
    } finally {
      const latestQueue = viewConfigPersistQueues.get(key);
      if (!latestQueue) return;
      latestQueue.inFlight = false;
      if (latestQueue.latest) {
        void drain();
      } else {
        viewConfigPersistQueues.delete(key);
      }
    }
  };

  void drain();
};

const applyServerMetadata = (metadata: TableMetadata) => {
  const state = useSmartTableStore.getState();
  state.setData({
    fields: metadata.fields || [],
    records: state.records,
    views: metadata.views || [],
    hiddenFieldIds: metadata.hiddenFieldIds || [],
    filters: metadata.filters || [],
    sorts: metadata.sorts || [],
    groupConfig: metadata.groupConfig || { fieldId: null, order: "asc" },
  });
};

const fetchServerMetadata = async (
  tableId: string | null | undefined,
): Promise<TableMetadata | null> => {
  try {
    const response = await client.query<TableMetadata>({
      query: GET_TABLE_DATA,
      variables: { tableId: tableId ?? undefined },
      fetchPolicy: "network-only",
    });
    if (!response.data) return null;
    return response.data;
  } catch {
    return null;
  }
};

type ServerRecordVerification =
  | { status: "found"; record: TableRecord }
  | { status: "missing_or_denied"; record: null }
  | { status: "unreachable"; record: null };

const isRecordUnavailableError = (error: unknown) => {
  const text = writeErrorMessage(error, "").toLowerCase();
  return (
    text.includes("record not found or no access") ||
    text.includes("permission denied") ||
    text.includes("forbidden") ||
    text.includes("unauthorized")
  );
};

const fetchServerRecord = async (
  tableId: string | null | undefined,
  recordId: string,
): Promise<ServerRecordVerification> => {
  if (!tableId) return { status: "unreachable", record: null };
  try {
    const response = await client.query<{ recordById?: TableRecord | null }>({
      query: RECORD_BY_ID,
      variables: { tableId, recordId },
      fetchPolicy: "network-only",
    });
    const record = response.data?.recordById || null;
    return record
      ? { status: "found", record }
      : { status: "missing_or_denied", record: null };
  } catch (error) {
    return isRecordUnavailableError(error)
      ? { status: "missing_or_denied", record: null }
      : { status: "unreachable", record: null };
  }
};

const removePendingRecordPatch = (
  patches: RecordPatch[],
  recordId: string,
  fieldId: string,
  value: unknown,
) =>
  patches.filter(
    (patch) =>
      !(
        patch.recordId === recordId &&
        patch.fieldId === fieldId &&
        sameSyncValue(patch.value, value)
      ),
  );

export const useSmartTableStore = create<SmartTableState>((set, get) => ({
  fields: [],
  records: [],
  views: [],
  currentViewId: "v1",
  currentTableId: null,
  currentTableName: null,
  currentPermission: "read",
  sidebarCollapsed: loadSidebarCollapsed(),
  sidebarWidth: loadSidebarWidth(),

  filters: [],
  sorts: [],
  groupConfig: { fieldId: null, order: "asc" },
  hiddenFieldIds: [],
  pendingRecordPatches: [],
  activeViewers: [],
  selectedRecordIds: [],
  deletedRecordIds: new Map<string, number>(),

  setData: ({
    fields,
    records,
    views,
    hiddenFieldIds,
    filters,
    sorts,
    groupConfig,
  }) =>
    set((state) => {
      const deletedIds = state.deletedRecordIds;
      const filtered = deletedIds.size > 0
        ? records.filter((r) => !deletedIds.has(r.id))
        : records;

      const tableId = get().currentTableId;
      const reconciledFields = reconcilePendingFieldOrder(tableId, fields);
      const legacyDefaults: Partial<ViewConfig> = {
        hiddenFieldIds: hiddenFieldIds || [],
        filters: filters || [],
        sorts: sorts || [],
        groupConfig: groupConfig || { fieldId: null, order: "asc" },
      };
      const normalizedViews = (views || []).map((view) => {
        const existingConfig =
          view.config && typeof view.config === "object"
            ? (view.config as ViewConfig)
            : undefined;
        const normalizedConfig = normalizeViewConfig(
          view.type,
          existingConfig,
          legacyDefaults,
        );
        const nextConfig = reconcilePendingViewConfig(
          tableId,
          view.id,
          normalizedConfig,
        );
        if (needsConfigUpdate(view.type, existingConfig)) {
          queueViewConfigPersist(tableId, view.id, nextConfig);
        }
        return {
          ...view,
          config: nextConfig,
        };
      });
      const currentViewId = get().currentViewId;
      const matchedView = normalizedViews.find(
        (view) => view.id === currentViewId,
      );
      const configView = matchedView || normalizedViews[0];
      return {
        fields: reconciledFields,
        records: filtered,
        views: normalizedViews,
        currentViewId: matchedView ? matchedView.id : currentViewId,
        hiddenFieldIds: configView?.config?.hiddenFieldIds || [],
        filters: configView?.config?.filters || [],
        sorts: configView?.config?.sorts || [],
        groupConfig: configView?.config?.groupConfig || {
          fieldId: null,
          order: "asc",
        },
      };
    }),

  addField: async (field, index) => {
    const tableId = get().currentTableId;
    const key = `field:add:${tableId || "default"}:${field.id}`;
    const revision = beginWrite(key);
    const insertionIndex =
      index === undefined ? get().fields.length : Math.max(0, index);

    set((state) => {
      if (state.fields.some((item) => item.id === field.id)) return {};
      const nextFields = [...state.fields];
      nextFields.splice(Math.min(insertionIndex, nextFields.length), 0, field);
      return { fields: nextFields };
    });

    try {
      const response = await client.mutate({
        mutation: ADD_FIELD,
        variables: {
          field,
          tableId: tableId ?? undefined,
          index: index !== undefined ? index : null,
        },
      });
      const created = (response as { data?: { addField?: Field | null } }).data
        ?.addField;
      if (!created) throw new Error("服务器未返回新增字段");
      if (isCurrentWrite(key, revision)) {
        set((state) => ({
          fields: state.fields.map((item) =>
            item.id === field.id ? { ...field, ...created } : item,
          ),
        }));
      }
      finishWrite(key, revision);
      return writeOk(created);
    } catch (error) {
      const metadata = await fetchServerMetadata(tableId);
      const serverField = metadata?.fields?.find((item) => item.id === field.id);
      if (metadata) applyServerMetadata(metadata);
      if (serverField) {
        finishWrite(key, revision);
        return writeOk(serverField);
      }
      if (!metadata && isCurrentWrite(key, revision)) {
        set((state) => ({
          fields: state.fields.filter((item) => item.id !== field.id),
        }));
      }
      const result = writeFail<Field>(error, "新增字段失败，请重试");
      if (isCurrentWrite(key, revision)) {
        emitWriteFeedback({
          level: "error",
          operation: "addField",
          key,
          message: result.error,
        });
      }
      finishWrite(key, revision);
      return result;
    }
  },

  updateField: async (fieldId, updates) => {
    const tableId = get().currentTableId;
    const previous = get().fields.find((item) => item.id === fieldId);
    if (!previous) {
      return writeFail(new Error("字段不存在"), "字段不存在");
    }
    const optimistic = { ...previous, ...updates };
    const key = `field:update:${tableId || "default"}:${fieldId}`;
    const revision = beginWrite(key);
    set((state) => ({
      fields: state.fields.map((item) =>
        item.id === fieldId ? optimistic : item,
      ),
    }));

    try {
      const response = await client.mutate({
        mutation: UPDATE_FIELD,
        variables: {
          fieldId,
          updates,
          tableId: tableId ?? undefined,
        },
      });
      const updated = (
        response as { data?: { updateField?: Field | null } }
      ).data?.updateField;
      if (!updated) throw new Error("服务器未返回更新后的字段");
      if (isCurrentWrite(key, revision)) {
        set((state) => ({
          fields: state.fields.map((item) =>
            item.id === fieldId ? updated : item,
          ),
        }));
      }
      finishWrite(key, revision);
      return writeOk(updated);
    } catch (error) {
      const metadata = await fetchServerMetadata(tableId);
      const serverField = metadata?.fields?.find((item) => item.id === fieldId);
      if (metadata) applyServerMetadata(metadata);
      const appliedDespiteError = Boolean(
        serverField &&
          Object.entries(updates).every(([name, value]) =>
            sameSyncValue(
              (serverField as unknown as Record<string, unknown>)[name],
              value,
            ),
          ),
      );
      if (appliedDespiteError && serverField) {
        finishWrite(key, revision);
        return writeOk(serverField);
      }
      if (!metadata && isCurrentWrite(key, revision)) {
        set((state) => ({
          fields: state.fields.map((item) =>
            item.id === fieldId && sameSyncValue(item, optimistic)
              ? previous
              : item,
          ),
        }));
      }
      const result = writeFail<Field>(error, "更新字段失败，已恢复服务器状态");
      if (isCurrentWrite(key, revision)) {
        emitWriteFeedback({
          level: "error",
          operation: "updateField",
          key,
          message: result.error,
        });
      }
      finishWrite(key, revision);
      return result;
    }
  },

  deleteField: async (fieldId) => {
    const tableId = get().currentTableId;
    const stateBefore = get();
    const target = stateBefore.fields.find((item) => item.id === fieldId);
    if (!target) {
      return writeFail(new Error("字段不存在"), "字段不存在");
    }
    const key = `field:delete:${tableId || "default"}:${fieldId}`;
    const revision = beginWrite(key);

    set((state) => ({
      fields: state.fields.filter((f) => f.id !== fieldId),
      filters: state.filters.filter((f) => f.fieldId !== fieldId),
      sorts: state.sorts.filter((s) => s.fieldId !== fieldId),
      groupConfig:
        state.groupConfig.fieldId === fieldId
          ? { fieldId: null, order: "asc" }
          : state.groupConfig,
      hiddenFieldIds: state.hiddenFieldIds.filter((id) => id !== fieldId),
      views: state.views.map((view) => {
        const config = view.config;
        if (!config) return view;
        return {
          ...view,
          config: {
            ...config,
            filters:
              config.filters?.filter((f) => f.fieldId !== fieldId) || [],
            sorts: config.sorts?.filter((s) => s.fieldId !== fieldId) || [],
            groupConfig:
              config.groupConfig?.fieldId === fieldId
                ? { fieldId: null, order: "asc" }
                : config.groupConfig,
            hiddenFieldIds:
              config.hiddenFieldIds?.filter((id) => id !== fieldId) || [],
          },
        };
      }),
    }));

    try {
      const response = await client.mutate({
        mutation: DELETE_FIELD,
        variables: { fieldId, tableId: tableId ?? undefined },
      });
      const deleted = (
        response as { data?: { deleteField?: boolean | null } }
      ).data?.deleteField;
      if (!deleted) throw new Error("服务器未确认字段删除");
      finishWrite(key, revision);
      return writeOk(true);
    } catch (error) {
      const metadata = await fetchServerMetadata(tableId);
      const stillExists = metadata?.fields?.some((item) => item.id === fieldId);
      if (metadata) applyServerMetadata(metadata);
      if (metadata && !stillExists) {
        finishWrite(key, revision);
        return writeOk(true);
      }
      if (!metadata && isCurrentWrite(key, revision)) {
        set({
          fields: stateBefore.fields,
          filters: stateBefore.filters,
          sorts: stateBefore.sorts,
          groupConfig: stateBefore.groupConfig,
          hiddenFieldIds: stateBefore.hiddenFieldIds,
          views: stateBefore.views,
        });
      }
      const result = writeFail<boolean>(error, "删除字段失败，已恢复服务器状态");
      if (isCurrentWrite(key, revision)) {
        emitWriteFeedback({
          level: "error",
          operation: "deleteField",
          key,
          message: result.error,
        });
      }
      finishWrite(key, revision);
      return result;
    }
  },

  addRecord: (record) =>
    set((state) => ({ records: [...state.records, record] })),

  insertRow: async (preset?: Record<string, unknown>) => {
    try {
      const normalizedPreset = preset
        ? normalizeRecordDataForWrite(get().fields, preset)
        : undefined;
      const res = await client.mutate({
        mutation: INSERT_ROW,
        variables: {
          tableId: get().currentTableId ?? undefined,
          data: normalizedPreset || undefined,
        },
      });
      const next = (res as { data?: { insertRow?: TableRecord } }).data
        ?.insertRow;
      if (next) {
        const cloned = JSON.parse(JSON.stringify(next)) as TableRecord;
        const merged = normalizedPreset
          ? { ...cloned, ...normalizedPreset }
          : cloned;
        set((prev) => {
          const alreadyExists = prev.records.some(r => r.id === merged.id);
          if (alreadyExists) {
            return {
              records: prev.records.map(r =>
                r.id === merged.id ? { ...r, ...(normalizedPreset || {}) } : r
              ),
            };
          }
          return { records: [...prev.records, merged] };
        });
        return merged;
      }
    } catch {
      return null;
    }
    return null;
  },

  insertRows: async (count: number) => {
    try {
      const amount = Math.max(1, Math.min(999, Math.floor(count)));
      const res = await client.mutate({
        mutation: INSERT_ROWS,
        variables: {
          count: amount,
          tableId: get().currentTableId ?? undefined,
        },
      });
      const next = (res as { data?: { insertRows?: TableRecord[] } }).data
        ?.insertRows;
      if (Array.isArray(next) && next.length > 0) {
        const cloned = JSON.parse(JSON.stringify(next)) as TableRecord[];
        set((prev) => {
          const existingIds = new Set(prev.records.map(r => r.id));
          const newRecords = cloned.filter(r => !existingIds.has(r.id));
          if (newRecords.length === 0) return {};
          return { records: [...prev.records, ...newRecords] };
        });
        return cloned;
      }
    } catch {
      return [];
    }
    return [];
  },

  insertRowsWithData: async (recordsData: Record<string, unknown>[]) => {
    try {
      if (!recordsData || recordsData.length === 0) return [];
      const normalizedRecordsData = recordsData.map((record) =>
        normalizeRecordDataForWrite(get().fields, record),
      );
      const res = await client.mutate({
        mutation: INSERT_ROWS_WITH_DATA,
        variables: {
          tableId: get().currentTableId ?? undefined,
          recordsData: normalizedRecordsData,
        },
      });
      const next = (
        res as { data?: { insertRowsWithData?: TableRecord[] } }
      ).data?.insertRowsWithData;
      if (Array.isArray(next) && next.length > 0) {
        const cloned = JSON.parse(JSON.stringify(next)) as TableRecord[];
        set((prev) => {
          const existingIds = new Set(prev.records.map(r => r.id));
          const newRecords = cloned.filter(r => !existingIds.has(r.id));
          if (newRecords.length === 0) return {};
          return { records: [...prev.records, ...newRecords] };
        });
        return cloned;
      }
    } catch {
      return [];
    }
    return [];
  },

  updateRecord: async (recordId, fieldId, value) => {
    const state = get();
    const field = state.fields.find((item) => item.id === fieldId);
    if (isReadOnlyField(field)) {
      return writeFail(new Error("只读字段不能修改"), "只读字段不能修改");
    }
    const record = state.records.find((item) => item.id === recordId);
    if (!record) {
      return writeFail(new Error("记录不存在"), "记录不存在");
    }
    const normalizedValue = normalizeFieldValueForWrite(
      state.fields,
      fieldId,
      value,
    );
    const previousValue = record[fieldId];
    if (sameSyncValue(previousValue, normalizedValue)) {
      return writeOk(record);
    }

    const tableId = state.currentTableId;
    const key = `record:update:${tableId || "default"}:${recordId}:${fieldId}`;
    const revision = beginWrite(key);
    set((current) => ({
      records: current.records.map((item) =>
        item.id === recordId
          ? { ...item, [fieldId]: normalizedValue }
          : item,
      ),
      pendingRecordPatches: [
        ...current.pendingRecordPatches,
        { recordId, fieldId, value: normalizedValue },
      ],
    }));

    try {
      const response = await client.mutate({
        mutation: UPDATE_RECORD,
        variables: {
          recordId,
          fieldId,
          value: normalizedValue,
          tableId: tableId ?? undefined,
        },
      });
      const updated = (
        response as { data?: { updateRecord?: TableRecord | null } }
      ).data?.updateRecord;
      if (!updated) throw new Error("服务器未返回更新后的记录");
      if (isCurrentWrite(key, revision)) {
        set((current) => ({
          records: current.records.map((item) =>
            item.id === recordId ? { ...item, ...updated } : item,
          ),
        }));
      }
      finishWrite(key, revision);
      return writeOk(updated);
    } catch (error) {
      const verification = await fetchServerRecord(tableId, recordId);
      const appliedDespiteError =
        verification.status === "found" &&
        sameSyncValue(verification.record[fieldId], normalizedValue);

      if (verification.status === "found") {
        set((current) => ({
          records: current.records.map((item) =>
            item.id === recordId ? verification.record : item,
          ),
          pendingRecordPatches: appliedDespiteError
            ? current.pendingRecordPatches
            : removePendingRecordPatch(
                current.pendingRecordPatches,
                recordId,
                fieldId,
                normalizedValue,
              ),
        }));
      } else if (verification.status === "missing_or_denied") {
        set((current) => ({
          records: current.records.filter((item) => item.id !== recordId),
          selectedRecordIds: current.selectedRecordIds.filter(
            (id) => id !== recordId,
          ),
          pendingRecordPatches: removePendingRecordPatch(
            current.pendingRecordPatches,
            recordId,
            fieldId,
            normalizedValue,
          ),
        }));
      } else if (isCurrentWrite(key, revision)) {
        set((current) => ({
          records: current.records.map((item) =>
            item.id === recordId &&
            sameSyncValue(item[fieldId], normalizedValue)
              ? { ...item, [fieldId]: previousValue }
              : item,
          ),
          pendingRecordPatches: removePendingRecordPatch(
            current.pendingRecordPatches,
            recordId,
            fieldId,
            normalizedValue,
          ),
        }));
      }

      if (appliedDespiteError && verification.status === "found") {
        finishWrite(key, revision);
        return writeOk(verification.record);
      }

      const result = writeFail<TableRecord>(
        error,
        verification.status === "missing_or_denied"
          ? "记录保存失败，且该记录当前已不可访问"
          : "记录保存失败，已恢复服务器中的值",
      );
      if (isCurrentWrite(key, revision)) {
        emitWriteFeedback({
          level: "error",
          operation: "updateRecord",
          key,
          message: result.error,
        });
      }
      finishWrite(key, revision);
      return result;
    }
  },

  updateCalendarRange: async (
    recordId,
    startFieldId,
    startValue,
    endFieldId,
    endValue,
  ) => {
    const state = get();
    const startField = state.fields.find((item) => item.id === startFieldId);
    const endField = endFieldId
      ? state.fields.find((item) => item.id === endFieldId)
      : undefined;
    if (
      startField?.type !== "date" ||
      (endFieldId && endField?.type !== "date") ||
      (endFieldId && endFieldId === startFieldId)
    ) {
      return false;
    }

    const currentRecord = state.records.find((item) => item.id === recordId);
    if (!currentRecord) return false;

    const previousStart = currentRecord[startFieldId];
    const previousEnd = endFieldId ? currentRecord[endFieldId] : undefined;
    const optimisticStart = startValue;
    const optimisticEnd = endFieldId ? endValue ?? null : undefined;

    set((current) => ({
      records: current.records.map((record) =>
        record.id === recordId
          ? {
              ...record,
              [startFieldId]: optimisticStart,
              ...(endFieldId ? { [endFieldId]: optimisticEnd } : {}),
            }
          : record,
      ),
    }));

    try {
      const response = await client.mutate({
        mutation: UPDATE_CALENDAR_RANGE,
        variables: {
          recordId,
          startFieldId,
          startValue: optimisticStart,
          endFieldId: endFieldId || undefined,
          endValue: endFieldId ? optimisticEnd : undefined,
          tableId: get().currentTableId ?? undefined,
        },
      });
      const updated = (
        response as { data?: { updateCalendarRange?: TableRecord | null } }
      ).data?.updateCalendarRange;
      if (!updated) throw new Error("Calendar range update returned no record");

      set((current) => ({
        records: current.records.map((record) =>
          record.id === recordId ? { ...record, ...updated } : record,
        ),
      }));
      return true;
    } catch {
      set((current) => ({
        records: current.records.map((record) => {
          if (record.id !== recordId) return record;
          const next = { ...record };
          if (Object.is(record[startFieldId], optimisticStart)) {
            next[startFieldId] = previousStart;
          }
          if (
            endFieldId &&
            Object.is(record[endFieldId], optimisticEnd)
          ) {
            next[endFieldId] = previousEnd;
          }
          return next;
        }),
      }));
      emitWriteFeedback({
        level: "error",
        operation: "updateCalendarRange",
        message: "日历日期保存失败，已恢复原值。",
      });
      return false;
    }
  },

  getRecordPatches: () => get().pendingRecordPatches,
  clearRecordPatches: () => set(() => ({ pendingRecordPatches: [] })),

  deleteRecord: async (recordId) => {
    const state = get();
    const tableId = state.currentTableId;
    const targetIndex = state.records.findIndex((item) => item.id === recordId);
    const target = targetIndex >= 0 ? state.records[targetIndex] : null;
    if (!target) {
      return writeFail(new Error("记录不存在"), "记录不存在");
    }
    const key = `record:delete:${tableId || "default"}:${recordId}`;
    const revision = beginWrite(key);
    set((current) => {
      const updatedDeletedIds = new Map(current.deletedRecordIds);
      updatedDeletedIds.set(recordId, Date.now());
      return {
        records: current.records.filter((item) => item.id !== recordId),
        deletedRecordIds: updatedDeletedIds,
        selectedRecordIds: current.selectedRecordIds.filter((id) => id !== recordId),
      };
    });

    try {
      const response = await client.mutate({
        mutation: DELETE_RECORD,
        variables: { recordId, tableId: tableId ?? undefined },
      });
      const deleted = (
        response as { data?: { deleteRecord?: boolean | null } }
      ).data?.deleteRecord;
      if (!deleted) throw new Error("服务器未确认记录删除");
      finishWrite(key, revision);
      return writeOk(true);
    } catch (error) {
      const verification = await fetchServerRecord(tableId, recordId);
      if (verification.status === "missing_or_denied") {
        finishWrite(key, revision);
        return writeOk(true);
      }
      if (isCurrentWrite(key, revision)) {
        set((current) => {
          const deletedIds = new Map(current.deletedRecordIds);
          deletedIds.delete(recordId);
          if (current.records.some((item) => item.id === recordId)) {
            return { deletedRecordIds: deletedIds };
          }
          const restored =
            verification.status === "found" ? verification.record : target;
          const records = [...current.records];
          records.splice(Math.min(targetIndex, records.length), 0, restored);
          return {
            records,
            deletedRecordIds: deletedIds,
          };
        });
      }
      const result = writeFail<boolean>(error, "删除记录失败，已恢复该记录");
      if (isCurrentWrite(key, revision)) {
        emitWriteFeedback({
          level: "error",
          operation: "deleteRecord",
          key,
          message: result.error,
        });
      }
      finishWrite(key, revision);
      return result;
    }
  },

  cleanupDeletedRecordIds: () =>
    set((state) => {
      if (state.deletedRecordIds.size === 0) return {};
      const now = Date.now();
      const TTL_MS = 30000;
      const cleanedDeletedIds = new Map<string, number>();
      const currentRecordIds = new Set(state.records.map(r => r.id));
      let removedCount = 0;

      for (const [id, timestamp] of state.deletedRecordIds) {
        if (currentRecordIds.has(id) || now - timestamp < TTL_MS) {
          cleanedDeletedIds.set(id, timestamp);
        } else {
          removedCount++;
        }
      }

      if (removedCount === 0) return {};
      return { deletedRecordIds: cleanedDeletedIds };
    }),

  setCurrentView: (viewId) =>
    set((state) => {
      const target = state.views.find((view) => view.id === viewId);
      if (state.currentTableId) {
        setTableLastViewId(state.currentTableId, viewId);
      }
      return {
        currentViewId: viewId,
        filters: target?.config?.filters || [],
        sorts: target?.config?.sorts || [],
        groupConfig: target?.config?.groupConfig || {
          fieldId: null,
          order: "asc",
        },
        hiddenFieldIds: target?.config?.hiddenFieldIds || [],
      };
    }),

  updateViewConfig: (viewId, config) =>
    set((state) => {
      const tableId = get().currentTableId;
      markPendingViewConfig(tableId, viewId, config);
      queueViewConfigPersist(tableId, viewId, config, config);
      return {
        views: state.views.map((view) =>
          view.id === viewId ? { ...view, config } : view,
        ),
      };
    }),

  createView: async (viewType, name) => {
    try {
      const res = await client.mutate({
        mutation: CREATE_VIEW,
        variables: {
          viewType,
          name: name?.trim() || undefined,
          tableId: get().currentTableId ?? undefined,
        },
      });
      const created = (res as { data?: { createView?: View } }).data?.createView;
      if (created) {
        const legacyDefaults: Partial<ViewConfig> = {
          hiddenFieldIds: get().hiddenFieldIds || [],
          filters: get().filters || [],
          sorts: get().sorts || [],
          groupConfig: get().groupConfig || { fieldId: null, order: "asc" },
        };
        const nextView: View = {
          ...created,
          config: normalizeViewConfig(
            created.type,
            created.config,
            legacyDefaults,
          ),
        };
        set((state) => {
          const viewExists = state.views.some((v) => v.id === nextView.id);
          if (viewExists) {
            return {
              views: state.views.map((v) =>
                v.id === nextView.id ? nextView : v
              ),
              currentViewId: nextView.id,
              filters: nextView.config?.filters || [],
              sorts: nextView.config?.sorts || [],
              groupConfig: nextView.config?.groupConfig || { fieldId: null, order: "asc" },
              hiddenFieldIds: nextView.config?.hiddenFieldIds || [],
            };
          }
          return {
            views: [...state.views, nextView],
            currentViewId: nextView.id,
            filters: nextView.config?.filters || [],
            sorts: nextView.config?.sorts || [],
            groupConfig: nextView.config?.groupConfig || { fieldId: null, order: "asc" },
            hiddenFieldIds: nextView.config?.hiddenFieldIds || [],
          };
        });
        if (get().currentTableId) {
          setTableLastViewId(get().currentTableId!, nextView.id);
        }
        return nextView;
      }
      return null;
    } catch {
      return null;
    }
  },

  renameView: async (viewId, name) => {
    const nextName = name.trim();
    if (!nextName) return false;
    try {
      const res = await client.mutate({
        mutation: RENAME_VIEW,
        variables: {
          viewId,
          name: nextName,
          tableId: get().currentTableId ?? undefined,
        },
      });
      const updated = (res as { data?: { renameView?: View } }).data?.renameView;
      if (!updated) return false;
      set((state) => ({
        views: state.views.map((view) =>
          view.id === viewId ? { ...view, name: updated.name } : view,
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },

  copyView: async (viewId, newName) => {
    try {
      const res = await client.mutate({
        mutation: COPY_VIEW,
        variables: {
          viewId,
          newName: newName?.trim() || undefined,
          tableId: get().currentTableId ?? undefined,
        },
      });
      const copied = (res as { data?: { copyView?: View } }).data?.copyView;
      if (!copied) return null;
      const legacyDefaults: Partial<ViewConfig> = {
        hiddenFieldIds: get().hiddenFieldIds || [],
        filters: get().filters || [],
        sorts: get().sorts || [],
        groupConfig: get().groupConfig || { fieldId: null, order: "asc" },
      };
      const nextView: View = {
        ...copied,
        config: normalizeViewConfig(
          copied.type,
          copied.config,
          legacyDefaults,
        ),
      };
      set((state) => {
        const viewExists = state.views.some((v) => v.id === nextView.id);
        if (viewExists) {
          return {
            views: state.views.map((v) =>
              v.id === nextView.id ? nextView : v
            ),
            currentViewId: nextView.id,
            filters: nextView.config?.filters || [],
            sorts: nextView.config?.sorts || [],
            groupConfig: nextView.config?.groupConfig || { fieldId: null, order: "asc" },
            hiddenFieldIds: nextView.config?.hiddenFieldIds || [],
          };
        }
        return {
          views: [...state.views, nextView],
          currentViewId: nextView.id,
          filters: nextView.config?.filters || [],
          sorts: nextView.config?.sorts || [],
          groupConfig: nextView.config?.groupConfig || { fieldId: null, order: "asc" },
          hiddenFieldIds: nextView.config?.hiddenFieldIds || [],
        };
      });
      if (get().currentTableId) {
        setTableLastViewId(get().currentTableId!, nextView.id);
      }
      return nextView;
    } catch {
      return null;
    }
  },

  deleteView: async (viewId) => {
    const state = get();
    const target = state.views.find((view) => view.id === viewId);
    if (!target || state.views.length <= 1) return false;
    try {
      const res = await client.mutate({
        mutation: DELETE_VIEW,
        variables: { viewId, tableId: state.currentTableId ?? undefined },
      });
      const deleted = (res as { data?: { deleteView?: boolean } }).data?.deleteView;
      if (!deleted) return false;
      set((prev) => {
        const nextViews = prev.views.filter((view) => view.id !== viewId);
        const fallback = nextViews[0];
        const shouldSwitch = prev.currentViewId === viewId;
        return {
          views: nextViews,
          currentViewId: shouldSwitch && fallback ? fallback.id : prev.currentViewId,
          filters:
            shouldSwitch && fallback
              ? fallback.config?.filters || []
              : prev.filters,
          sorts:
            shouldSwitch && fallback
              ? fallback.config?.sorts || []
              : prev.sorts,
          groupConfig:
            shouldSwitch && fallback
              ? fallback.config?.groupConfig || { fieldId: null, order: "asc" }
              : prev.groupConfig,
          hiddenFieldIds:
            shouldSwitch && fallback
              ? fallback.config?.hiddenFieldIds || []
              : prev.hiddenFieldIds,
        };
      });
      return true;
    } catch {
      return false;
    }
  },

  setCurrentTableName: (name) => set(() => ({ currentTableName: name })),
  setCurrentPermission: (permission) =>
    set(() => ({ currentPermission: permission })),
  setActiveViewers: (viewers) => set(() => ({ activeViewers: viewers })),
  setSelectedRecordIds: (recordIds) =>
    set(() => ({ selectedRecordIds: Array.from(new Set(recordIds)) })),
  setSidebarCollapsed: (collapsed) =>
    set(() => {
      saveSidebarCollapsed(collapsed);
      return { sidebarCollapsed: collapsed };
    }),
  toggleSidebarCollapsed: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      saveSidebarCollapsed(next);
      return { sidebarCollapsed: next };
    }),
  setSidebarWidth: (width) =>
    set(() => {
      const nextWidth = clampSidebarWidth(width);
      saveSidebarWidth(nextWidth);
      return { sidebarWidth: nextWidth };
    }),

  setFilters: (filters) =>
    set((state) => {
      const viewId = state.currentViewId;
      const view = state.views.find((v) => v.id === viewId);
      if (!view) return { filters };
      const config = { ...(view.config || {}), filters };
      const tableId = get().currentTableId;
      const patch: Partial<ViewConfig> = { filters };
      markPendingViewConfig(tableId, viewId, patch);
      queueViewConfigPersist(tableId, viewId, config, patch);
      return {
        filters,
        views: state.views.map((v) => (v.id === viewId ? { ...v, config } : v)),
      };
    }),

  setSorts: (sorts) =>
    set((state) => {
      const viewId = state.currentViewId;
      const view = state.views.find((v) => v.id === viewId);
      if (!view) return { sorts };
      const config = { ...(view.config || {}), sorts };
      const tableId = get().currentTableId;
      const patch: Partial<ViewConfig> = { sorts };
      markPendingViewConfig(tableId, viewId, patch);
      queueViewConfigPersist(tableId, viewId, config, patch);
      return {
        sorts,
        views: state.views.map((v) => (v.id === viewId ? { ...v, config } : v)),
      };
    }),

  setGroupConfig: (config) =>
    set((state) => {
      const viewId = state.currentViewId;
      const view = state.views.find((v) => v.id === viewId);
      if (!view) return { groupConfig: config };
      const nextConfig = { ...(view.config || {}), groupConfig: config };
      const tableId = get().currentTableId;
      const patch: Partial<ViewConfig> = { groupConfig: config };
      markPendingViewConfig(tableId, viewId, patch);
      queueViewConfigPersist(tableId, viewId, nextConfig, patch);
      return {
        groupConfig: config,
        views: state.views.map((v) =>
          v.id === viewId ? { ...v, config: nextConfig } : v,
        ),
      };
    }),

  setHiddenFieldIds: (ids) =>
    set((state) => {
      const viewId = state.currentViewId;
      const view = state.views.find((v) => v.id === viewId);
      if (!view) return { hiddenFieldIds: ids };
      const config = { ...(view.config || {}), hiddenFieldIds: ids };
      const tableId = get().currentTableId;
      const patch: Partial<ViewConfig> = { hiddenFieldIds: ids };
      markPendingViewConfig(tableId, viewId, patch);
      queueViewConfigPersist(tableId, viewId, config, patch);
      return {
        hiddenFieldIds: ids,
        views: state.views.map((v) => (v.id === viewId ? { ...v, config } : v)),
      };
    }),

  toggleFieldVisibility: (fieldId) =>
    set((state) => {
      const isHidden = state.hiddenFieldIds.includes(fieldId);
      const newHiddenIds = isHidden
        ? state.hiddenFieldIds.filter((id) => id !== fieldId)
        : [...state.hiddenFieldIds, fieldId];
      const viewId = state.currentViewId;
      const view = state.views.find((v) => v.id === viewId);
      const config = { ...(view?.config || {}), hiddenFieldIds: newHiddenIds };
      if (view) {
        const tableId = get().currentTableId;
        const patch: Partial<ViewConfig> = { hiddenFieldIds: newHiddenIds };
        markPendingViewConfig(tableId, viewId, patch);
        queueViewConfigPersist(tableId, viewId, config, patch);
      }
      return {
        hiddenFieldIds: newHiddenIds,
        views: state.views.map((v) => (v.id === viewId ? { ...v, config } : v)),
      };
    }),

  reorderFields: async (fields) => {
    const previousFields = get().fields;
    const fieldOrder = fields.map((f) => f.id);
    const tableId = get().currentTableId;
    const key = `field:reorder:${tableId || "default"}`;
    const revision = beginWrite(key);
    if (tableId) {
      pendingFieldOrders.set(tableId, fieldOrder);
    }
    set({ fields });

    try {
      const response = await client.mutate({
        mutation: REORDER_FIELDS,
        variables: { fieldOrder, tableId: tableId ?? undefined },
      });
      const reordered = (
        response as { data?: { reorderFields?: boolean | null } }
      ).data?.reorderFields;
      if (!reordered) throw new Error("服务器未确认字段顺序");
      finishWrite(key, revision);
      return writeOk(true);
    } catch (error) {
      const metadata = await fetchServerMetadata(tableId);
      const serverOrder = metadata?.fields?.map((field) => field.id) || [];
      if (metadata) applyServerMetadata(metadata);
      if (sameSyncValue(serverOrder, fieldOrder)) {
        finishWrite(key, revision);
        return writeOk(true);
      }
      if (tableId && sameSyncValue(pendingFieldOrders.get(tableId), fieldOrder)) {
        pendingFieldOrders.delete(tableId);
      }
      if (!metadata && isCurrentWrite(key, revision)) {
        set({ fields: previousFields });
      }
      const result = writeFail<boolean>(error, "字段排序保存失败，已恢复服务器顺序");
      if (isCurrentWrite(key, revision)) {
        emitWriteFeedback({
          level: "error",
          operation: "reorderFields",
          key,
          message: result.error,
        });
      }
      finishWrite(key, revision);
      return result;
    }
  },

  setCurrentTable: (tableId) =>
    set(() => ({ currentTableId: tableId, selectedRecordIds: [] })),
}));
