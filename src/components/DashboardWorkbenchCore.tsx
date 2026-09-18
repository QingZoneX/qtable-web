import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreAddOutlined,
  CopyOutlined,
  DashboardOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { FieldTypeIcon } from "./SmartTable/FieldTypeIcon";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout, Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useAuthStore } from "../store/authStore";
import { t } from "../lib/i18nRuntime";
import { useLanguage } from "../lib/useLanguage";
import {
  DELETE_DASHBOARD_WIDGET,
  ENSURE_DASHBOARD_PUBLIC_TOKEN,
  GET_DASHBOARD,
  GET_WORKSPACE,
  ITEM_ACCESS,
  UPDATE_DASHBOARD_META,
  UPDATE_DASHBOARD_WIDGET,
  CREATE_DASHBOARD_WIDGET,
  GET_TABLE_DATA,
  DASHBOARD_WIDGET_DATA,
} from "../lib/graphql";
import {
  permissionAllows,
  type PermissionLevel,
  useSmartTableStore,
} from "../store/useSmartTableStore";

import {
  GRID_COLS,
  GRID_BREAKPOINTS,
  GRID_ROW_HEIGHT,
  MIN_H,
  MIN_W,
  PALETTES,
  walkTables,
  downloadBlob,
  exportRowsToXlsx,
  normalizeLayout,
  scaleLayout,
} from "./Dashboard";

import type {
  DashboardWidget,
  DashboardPayload,
  WidgetDataPayload,
  WidgetFilter,
  WidgetLayout,
  WorkspaceNode,
} from "./Dashboard";

import { WidgetDataSubscriber, DashboardWidgetCard } from "./Dashboard";
import { dashboardOperatorLabel, dashboardT } from "./Dashboard/dashboardI18n";
import {
  dashboardPaletteLabel,
  dashboardWorkbenchExtraT,
} from "./Dashboard/dashboardWorkbenchExtraI18n";
import { AiVisualDesignerModal } from "./AiVisualDesigner/AiVisualDesignerModal";

const { Title, Text } = Typography;
const ResponsiveGridLayout = WidthProvider(Responsive);

const NUMERIC_FIELD_TYPES = new Set([
  "number",
  "progress",
  "rating",
  "autoNumber",
]);
const DIMENSION_WIDGET_TYPES = new Set([
  "bar",
  "line",
  "pie",
  "horizontalBar",
  "table",
]);

type DashboardField = {
  id: string;
  name: string;
  type: string;
  options?: Array<{
    id?: string;
    value?: string;
    label?: string;
  }> | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function safeFilename(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "dashboard-widget";
}

function filterOperatorOptions(field?: DashboardField) {
  if (!field) {
    return [
      { value: "eq", label: dashboardOperatorLabel("eq") },
      { value: "neq", label: dashboardOperatorLabel("neq") },
    ];
  }
  if (NUMERIC_FIELD_TYPES.has(field.type)) {
    return [
      { value: "eq", label: dashboardOperatorLabel("eq") },
      { value: "neq", label: dashboardOperatorLabel("neq") },
      { value: "gt", label: dashboardOperatorLabel("gt") },
      { value: "gte", label: dashboardOperatorLabel("gte") },
      { value: "lt", label: dashboardOperatorLabel("lt") },
      { value: "lte", label: dashboardOperatorLabel("lte") },
      { value: "in", label: dashboardOperatorLabel("in") },
    ];
  }
  if (field.type === "date") {
    return [
      { value: "eq", label: dashboardOperatorLabel("eq") },
      { value: "neq", label: dashboardOperatorLabel("neq") },
      { value: "before", label: dashboardOperatorLabel("before") },
      { value: "after", label: dashboardOperatorLabel("after") },
    ];
  }
  if (field.type === "text" || field.type === "url" || field.type === "email") {
    return [
      { value: "eq", label: dashboardOperatorLabel("eq") },
      { value: "neq", label: dashboardOperatorLabel("neq") },
      { value: "contains", label: dashboardOperatorLabel("contains") },
      { value: "in", label: dashboardOperatorLabel("in") },
    ];
  }
  return [
    { value: "eq", label: dashboardOperatorLabel("eq") },
    { value: "neq", label: dashboardOperatorLabel("neq") },
    { value: "in", label: dashboardOperatorLabel("in") },
  ];
}

export function DashboardWorkbench({ embedded }: { embedded?: boolean }) {
  useLanguage();
  const { dashboardId: routeDashboardId, tableId } = useParams();
  const dashboardId = routeDashboardId || tableId;
  const apollo = useApolloClient();
  const { token } = useAuthStore();
  const workspaceId = localStorage.getItem("qtable.workspaceId") || "";
  const setCurrentPermission = useSmartTableStore((s) => s.setCurrentPermission);
  const setCurrentTableName = useSmartTableStore((s) => s.setCurrentTableName);
  const currentPermission = useSmartTableStore((s) => s.currentPermission);
  const canEdit = permissionAllows(currentPermission, "edit");
  const canManage = permissionAllows(currentPermission, "manage");

  const { data: accessData } = useQuery<
    { itemAccess: { permission: PermissionLevel }[] },
    { itemId: string; workspaceId?: string }
  >(ITEM_ACCESS, {
    variables: { itemId: dashboardId || "", workspaceId: workspaceId || undefined },
    skip: !token || !dashboardId,
    fetchPolicy: "network-only",
  });
  useEffect(() => {
    const perm = accessData?.itemAccess?.[0]?.permission ?? "read";
    setCurrentPermission(perm);
  }, [accessData?.itemAccess, setCurrentPermission]);

  const { data: wsData } = useQuery<{ workspace: { root: WorkspaceNode } }>(GET_WORKSPACE, {
    variables: { workspaceId: workspaceId || undefined },
    skip: !token,
    fetchPolicy: "network-only",
  });
  const tables = useMemo(() => walkTables(wsData?.workspace?.root), [wsData?.workspace?.root]);

  const { data, loading, error, refetch } = useQuery<{ dashboard: unknown }>(GET_DASHBOARD, {
    variables: { dashboardId: dashboardId || "", workspaceId: workspaceId || undefined },
    skip: !token || !dashboardId,
    fetchPolicy: "network-only",
  });
  const dashboard = data?.dashboard as DashboardPayload | undefined;
  const canEditWidgets = dashboard?.isPublic ? canManage : canEdit;
  useEffect(() => {
    if (dashboard?.name) setCurrentTableName(dashboard.name);
  }, [dashboard?.name, setCurrentTableName]);

  const [updateMeta] = useMutation(UPDATE_DASHBOARD_META);
  const [ensurePublicToken] = useMutation(ENSURE_DASHBOARD_PUBLIC_TOKEN);
  const [createWidget] = useMutation(CREATE_DASHBOARD_WIDGET);
  const [updateWidget] = useMutation(UPDATE_DASHBOARD_WIDGET);
  const [saveWidget, { loading: saveWidgetLoading }] = useMutation(UPDATE_DASHBOARD_WIDGET);
  const [deleteWidget] = useMutation(DELETE_DASHBOARD_WIDGET);

  const [selectedWidgetId, setSelectedWidgetId] = useState<string>("");
  const selectedWidget = useMemo(
    () => dashboard?.widgets?.find((w) => w.id === selectedWidgetId) || null,
    [dashboard?.widgets, selectedWidgetId],
  );

  const [configOpen, setConfigOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenWidgetId, setFullscreenWidgetId] = useState<string>("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareSaving, setShareSaving] = useState(false);
  const [aiVisualDesignerOpen, setAiVisualDesignerOpen] = useState(false);

  const [refreshSignal, setRefreshSignal] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const bumpRefresh = useCallback(() => {
    setRefreshSignal((value) => value + 1);
    setLastRefreshAt(new Date());
  }, []);
  const lastRefreshLabel = useMemo(
    () =>
      lastRefreshAt
        ? lastRefreshAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : dashboardT("workbench.waitingRefresh"),
    [lastRefreshAt],
  );

  const referencedTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of dashboard?.widgets ?? []) {
      const tId = (w.config?.tableId as string | undefined) || "";
      if (tId) ids.add(tId);
    }
    return Array.from(ids);
  }, [dashboard?.widgets]);
  const [activeCols, setActiveCols] = useState<number>(GRID_COLS.lg);

  const persistLayout = useCallback(
    async (widgetId: string, layout: WidgetLayout) => {
      const widget = dashboard?.widgets?.find((w) => w.id === widgetId);
      if (!widget) return;
      await updateWidget({
        variables: {
          widgetId,
          updates: { layout },
        },
      });
    },
    [dashboard?.widgets, updateWidget],
  );

  const pendingLayoutRef = useRef<Map<string, WidgetLayout>>(new Map());
  const flushTimerRef = useRef<number | null>(null);
  const scheduleFlush = useCallback(
    (widgetId: string, layout: WidgetLayout) => {
      pendingLayoutRef.current.set(widgetId, layout);
      if (flushTimerRef.current !== null) return;
      flushTimerRef.current = window.setTimeout(async () => {
        flushTimerRef.current = null;
        const items = Array.from(pendingLayoutRef.current.entries());
        pendingLayoutRef.current.clear();
        for (const [id, nextLayout] of items) {
          await persistLayout(id, nextLayout);
        }
        void refetch();
      }, 400);
    },
    [persistLayout, refetch],
  );

  const updateLayoutLocal = useCallback(
    (widgetId: string, layout: WidgetLayout) => {
      if (!dashboard) return;
      const nextWidgets = (dashboard.widgets || []).map((w) =>
        w.id === widgetId ? { ...w, layout } : w,
      );
      apollo.cache.writeQuery({
        query: GET_DASHBOARD,
        variables: { dashboardId: dashboardId || "", workspaceId: workspaceId || undefined },
        data: { dashboard: { ...dashboard, widgets: nextWidgets } },
      });
      scheduleFlush(widgetId, layout);
    },
    [apollo.cache, dashboard, dashboardId, scheduleFlush, workspaceId],
  );

  const layouts = useMemo<Layouts>(() => {
    const widgets = dashboard?.widgets ?? [];
    const toItem = (w: DashboardWidget, cols: number): Layout => {
      const base = normalizeLayout(w.layout, 12);
      const scaled = scaleLayout(base, cols);
      return {
        i: w.id,
        x: scaled.x,
        y: scaled.y,
        w: scaled.w,
        h: scaled.h,
        minW: Math.min(MIN_W, cols),
        minH: MIN_H,
      };
    };
    return {
      lg: widgets.map((w) => toItem(w, GRID_COLS.lg)),
      md: widgets.map((w) => toItem(w, GRID_COLS.md)),
      sm: widgets.map((w) => toItem(w, GRID_COLS.sm)),
      xs: widgets.map((w) => toItem(w, GRID_COLS.xs)),
      xxs: widgets.map((w) => toItem(w, GRID_COLS.xxs)),
    };
  }, [dashboard?.widgets]);

  const commitGridLayout = useCallback(
    (gridLayout: Layout[]) => {
      if (!dashboard) return;
      const currentById = new Map<string, WidgetLayout>(
        (dashboard.widgets || []).map((w) => [w.id, normalizeLayout(w.layout, 12)]),
      );
      const safeCols = activeCols > 0 ? activeCols : 12;
      const ratio = 12 / safeCols;
      for (const item of gridLayout) {
        const id = String(item.i);
        const next = normalizeLayout(
          {
            x: Math.round(item.x * ratio),
            y: item.y,
            w: Math.round(item.w * ratio),
            h: item.h,
          },
          12,
        );
        const prev = currentById.get(id);
        if (
          prev &&
          prev.x === next.x &&
          prev.y === next.y &&
          prev.w === next.w &&
          prev.h === next.h
        ) {
          continue;
        }
        updateLayoutLocal(id, next);
      }
    },
    [activeCols, dashboard, updateLayoutLocal],
  );

  const openWidgetConfig = useCallback(
    (id: string) => {
      if (!canEditWidgets) return;
      setSelectedWidgetId(id);
      setConfigOpen(true);
    },
    [canEditWidgets],
  );

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target.closest(".react-grid-item")) return;
    setSelectedWidgetId("");
    setConfigOpen(false);
  }, []);

  const createWidgetMenuItems: MenuProps["items"] = [
    {
      key: "comparison",
      type: "group",
      label: dashboardT("workbench.group.comparison"),
      children: [
        { key: "bar", icon: <AppstoreAddOutlined />, label: dashboardT("workbench.type.bar") },
        {
          key: "horizontalBar",
          icon: <AppstoreAddOutlined />,
          label: dashboardT("workbench.type.horizontalBar"),
        },
        { key: "table", icon: <AppstoreAddOutlined />, label: dashboardT("workbench.type.table") },
      ],
    },
    {
      key: "trend",
      type: "group",
      label: dashboardT("workbench.group.trend"),
      children: [
        { key: "line", icon: <AppstoreAddOutlined />, label: dashboardT("workbench.type.line") },
      ],
    },
    {
      key: "composition",
      type: "group",
      label: dashboardT("workbench.group.composition"),
      children: [
        { key: "pie", icon: <AppstoreAddOutlined />, label: dashboardT("workbench.type.pie") },
      ],
    },
    {
      key: "indicator",
      type: "group",
      label: dashboardT("workbench.group.indicator"),
      children: [
        { key: "metric", icon: <AppstoreAddOutlined />, label: dashboardT("workbench.type.metric") },
        { key: "progress", icon: <AppstoreAddOutlined />, label: dashboardT("workbench.type.progress") },
      ],
    },
  ];

  const handleCreateWidget: MenuProps["onClick"] = async ({ key }) => {
    if (!dashboardId) return;
    if (!canEditWidgets) {
      message.error(
        dashboard?.isPublic
          ? dashboardT("workbench.publicAdminOnly")
          : dashboardT("workbench.noEditPermission"),
      );
      return;
    }
    try {
      const next = await createWidget({
        variables: {
          dashboardId,
          widget: {
            type: key,
            title: "",
            layout: { x: 0, y: 0, w: 6, h: 12 },
            config: { tableId: tables[0]?.id || null, dimensionFieldId: null, metric: { aggregation: "count", fieldId: null } },
          },
        },
      });
      const created = (next as unknown as { data?: { createDashboardWidget?: DashboardWidget } })
        .data?.createDashboardWidget;
      await refetch();
      if (created?.id) {
        setSelectedWidgetId(created.id);
        setConfigOpen(true);
      }
    } catch (error) {
      message.error(getErrorMessage(error, dashboardT("workbench.createFailed")));
    }
  };

  const handleDuplicateWidget = useCallback(
    async (id: string) => {
      if (!dashboardId || !canEditWidgets) return;
      const source = dashboard?.widgets?.find((widget) => widget.id === id);
      if (!source) return;
      const layout = normalizeLayout(source.layout, 12);
      try {
        const response = await createWidget({
          variables: {
            dashboardId,
            widget: {
              type: source.type,
              title: dashboardT("workbench.copySuffix", {
                title: source.title || dashboardT("widget.unnamed"),
              }),
              colorScheme: source.colorScheme,
              layout: {
                ...layout,
                x: Math.min(12 - layout.w, layout.x + 1),
                y: layout.y + 1,
              },
              config: JSON.parse(
                JSON.stringify(source.config || {}),
              ),
            },
          },
        });
        const created = (
          response as unknown as {
            data?: { createDashboardWidget?: DashboardWidget };
          }
        ).data?.createDashboardWidget;
        await refetch();
        if (created?.id) {
          setSelectedWidgetId(created.id);
          setConfigOpen(true);
        }
        message.success(dashboardT("workbench.copied"));
      } catch (error) {
        message.error(getErrorMessage(error, dashboardT("workbench.copyFailed")));
      }
    },
    [
      canEditWidgets,
      createWidget,
      dashboard?.widgets,
      dashboardId,
      refetch,
    ],
  );

  const handleExportImage = useCallback(async (id: string, node: HTMLDivElement) => {
    try {
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const widget = dashboard?.widgets?.find((item) => item.id === id);
      downloadBlob(
        `${safeFilename(dashboard?.name || dashboardT("workbench.dashboardFilename"))}-${safeFilename(
          widget?.title || dashboardT("workbench.widgetFilename"),
        )}.png`,
        blob,
      );
    } catch {
      message.error(dashboardT("workbench.exportImageFailed"));
    }
  }, [dashboard?.name, dashboard?.widgets]);

  const handleExportExcel = useCallback(
    async (id: string) => {
      try {
        const res = await apollo.query<{ dashboardWidgetData: WidgetDataPayload }>({
          query: DASHBOARD_WIDGET_DATA,
          variables: { widgetId: id, dashboardId: dashboardId || undefined },
          fetchPolicy: "network-only",
        });
        const rows = (res.data?.dashboardWidgetData?.rows ?? []) as Record<string, unknown>[];
        const widget = dashboard?.widgets?.find((item) => item.id === id);
        exportRowsToXlsx(
          `${safeFilename(dashboard?.name || dashboardT("workbench.dashboardFilename"))}-${safeFilename(
            widget?.title || dashboardT("workbench.widgetFilename"),
          )}.xlsx`,
          rows,
        );
      } catch {
        message.error(dashboardT("workbench.exportExcelFailed"));
      }
    },
    [apollo, dashboard?.name, dashboard?.widgets, dashboardId],
  );

  const handleFullscreen = useCallback((id: string) => {
    setFullscreenWidgetId(id);
    setFullscreenOpen(true);
  }, []);

  const handleCopyShareLink = async () => {
    if (!dashboardId) return;
    if (!dashboard?.isPublic) {
      message.warning(dashboardT("workbench.enablePublicFirst"));
      return;
    }
    try {
      const tokenRes = await ensurePublicToken({ variables: { dashboardId } });
      const publicToken = (
        tokenRes as unknown as { data?: { ensureDashboardPublicToken?: string } }
      ).data?.ensureDashboardPublicToken;
      const token = publicToken || dashboard?.publicToken || "";
      if (!token) {
        message.error(dashboardT("workbench.publicLinkFailed"));
        return;
      }
      const url = `${window.location.origin}/share/dashboard/${token}`;
      await navigator.clipboard.writeText(url);
      message.success(dashboardT("workbench.linkCopied"));
    } catch {
      message.error(dashboardT("workbench.linkCopyFailed"));
    }
  };

  const applyMetaUpdates = async (
    updates: Record<string, unknown>,
  ): Promise<boolean> => {
    if (!dashboardId) return false;
    setShareSaving(true);
    try {
      await updateMeta({ variables: { dashboardId, updates } });
      await refetch();
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, dashboardT("workbench.updateFailed")));
      return false;
    } finally {
      setShareSaving(false);
    }
  };

  useEffect(() => {
    if (!shareOpen) return;
    setShareDescription(dashboard?.description || "");
  }, [dashboard?.description, shareOpen]);

  const handleSaveDescription = async () => {
    const ok = await applyMetaUpdates({
      description: shareDescription.trim(),
    });
    if (ok) message.success(dashboardT("workbench.descriptionSaved"));
  };

  const handleTogglePublic = async (checked: boolean) => {
    const ok = await applyMetaUpdates({ isPublic: checked });
    if (ok) {
      message.success(
        checked
          ? dashboardT("workbench.publicEnabled")
          : dashboardT("workbench.publicDisabled"),
      );
    }
  };

  const [form] = Form.useForm();
  useEffect(() => {
    if (!selectedWidget) return;
    const cfg = selectedWidget.config || {};
    form.setFieldsValue({
      title: selectedWidget.title || "",
      type: selectedWidget.type,
      paletteId: (() => {
        const cs = selectedWidget.colorScheme;
        if (typeof cs === "string") return cs;
        if (cs && typeof cs === "object") {
          const pid = (cs as { paletteId?: unknown }).paletteId;
          if (typeof pid === "string") return pid;
        }
        return "default";
      })(),
      tableId: typeof cfg.tableId === "string" ? cfg.tableId : undefined,
      dimensionFieldId:
        typeof cfg.dimensionFieldId === "string" ? cfg.dimensionFieldId : undefined,
      metricAggregation: cfg.metric?.aggregation || "count",
      metricFieldId: typeof cfg.metric?.fieldId === "string" ? cfg.metric?.fieldId : undefined,
      filters: Array.isArray(cfg.filters)
        ? cfg.filters.map((f) => ({
            fieldId: f.fieldId,
            operator: f.operator,
            value: f.value ?? undefined,
          }))
        : [],
      limit: typeof cfg.limit === "number" ? cfg.limit : 50,
      sortBy: cfg.sort?.by || "value",
      sortOrder: cfg.sort?.order || "desc",
      targetValue: typeof cfg.targetValue === "number" ? cfg.targetValue : undefined,
    });
  }, [form, selectedWidget]);

  const selectedTableId = Form.useWatch("tableId", form) as
    | string
    | undefined;
  const selectedWidgetType = Form.useWatch("type", form) as
    | string
    | undefined;
  const selectedAggregation = Form.useWatch(
    "metricAggregation",
    form,
  ) as string | undefined;
  const watchedFilters = Form.useWatch("filters", form) as
    | Array<{
        fieldId?: string;
        operator?: string;
        value?: unknown;
      }>
    | undefined;
  const { data: tableData } = useQuery<{ fields: DashboardField[] }>(
    GET_TABLE_DATA,
    {
      variables: { tableId: selectedTableId || undefined },
      skip: !token || !selectedTableId,
      fetchPolicy: "network-only",
    },
  );
  const availableFields = tableData?.fields ?? [];
  // label 带字段类型图标；optionFilterProp 用 title 以保持按原字符串搜索
  const fieldOptions = availableFields.map((field) => ({
    value: field.id,
    title: `${field.name} · ${field.type}`,
    label: (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FieldTypeIcon type={field.type} />
        {`${field.name} · ${field.type}`}
      </span>
    ),
  }));
  const numericFieldOptions = availableFields
    .filter((field) => NUMERIC_FIELD_TYPES.has(field.type))
    .map((field) => ({
      value: field.id,
      title: `${field.name} · ${field.type}`,
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FieldTypeIcon type={field.type} />
          {`${field.name} · ${field.type}`}
        </span>
      ),
    }));
  const needsDimension = DIMENSION_WIDGET_TYPES.has(
    selectedWidgetType || "bar",
  );

  const saveWidgetConfig = async () => {
    if (!selectedWidget) return;
    const values = await form.validateFields();
    const filters: WidgetFilter[] = Array.isArray(values.filters)
      ? (values.filters as { fieldId?: string; operator?: string; value?: unknown }[])
          .filter((f) => typeof f.fieldId === "string" && typeof f.operator === "string")
          .map((filter) => {
            const field = availableFields.find(
              (item) => item.id === filter.fieldId,
            );
            if (filter.operator === "in") {
              const parts = Array.isArray(filter.value)
                ? filter.value
                : String(filter.value ?? "")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean);
              return {
                fieldId: filter.fieldId as string,
                operator: "in",
                value: parts,
              };
            }
            const shouldBeNumber =
              field && NUMERIC_FIELD_TYPES.has(field.type);
            const value =
              shouldBeNumber &&
              filter.value !== "" &&
              filter.value != null
                ? Number(filter.value)
                : filter.value;
            return {
              fieldId: filter.fieldId as string,
              operator: filter.operator as string,
              value,
            };
          })
      : [];
    const config = {
      ...(selectedWidget.config || {}),
      tableId: values.tableId || null,
      dimensionFieldId: needsDimension
        ? values.dimensionFieldId || null
        : null,
      metric: {
        aggregation: values.metricAggregation || "count",
        fieldId:
          values.metricAggregation === "count"
            ? null
            : values.metricFieldId || null,
      },
      filters,
      limit: Number(values.limit || 50),
      sort: { by: values.sortBy || "value", order: values.sortOrder || "desc" },
      targetValue:
        values.type === "progress" && values.targetValue != null
          ? Number(values.targetValue)
          : undefined,
    };
    const updates = {
      title: values.title || "",
      type: values.type,
      colorScheme: { paletteId: values.paletteId || "default" },
      config,
    };
    try {
      await saveWidget({ variables: { widgetId: selectedWidget.id, updates } });
      await refetch();
      bumpRefresh();
      message.success(dashboardT("workbench.saved"));
      setConfigOpen(false);
    } catch (error) {
      message.error(getErrorMessage(error, dashboardT("workbench.saveFailed")));
    }
  };

  const removeWidget = async () => {
    if (!selectedWidget) return;
    Modal.confirm({
      title: t("dashboard.deleteWidgetTitle"),
      content: t("dashboard.deleteWidgetContent"),
      okText: t("common.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await deleteWidget({ variables: { widgetId: selectedWidget.id } });
          setSelectedWidgetId("");
          setConfigOpen(false);
          await refetch();
        } catch {
          message.error(dashboardT("workbench.deleteFailed"));
        }
      },
    });
  };

  const fullscreenWidget = useMemo(() => {
    return dashboard?.widgets?.find((w) => w.id === fullscreenWidgetId) || null;
  }, [dashboard?.widgets, fullscreenWidgetId]);

  if (!token) {
    return null;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">{dashboardT("workbench.loadFailed")}</Text>
      </div>
    );
  }

  if (loading || !dashboard) {
    if (embedded) return <div style={{ padding: 24 }}>{dashboardT("workbench.loading")}</div>;
    return (
      <div style={{ height: "100vh", display: "flex" }}>
        <div style={{ padding: 24, color: "var(--qtable-color-text-secondary)" }}>
          {dashboardT("workbench.loading")}
        </div>
      </div>
    );
  }

  const addMenu: MenuProps = {
    items: createWidgetMenuItems,
    onClick: handleCreateWidget,
  };

  const content = (
    <>
      {referencedTableIds.map((tId) => (
        <WidgetDataSubscriber key={tId} tableId={tId} onUpdate={bumpRefresh} />
      ))}
      <div style={{ flex: 1, minWidth: 0, display: "flex", backgroundColor: "white" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            style={{
              height: 56,
              padding: "0 16px",
              borderBottom: "1px solid #EAECF0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <DashboardOutlined />
            <div style={{ minWidth: 0 }}>
              <Title level={5} style={{ margin: 0, lineHeight: "20px" }} ellipsis>
                {dashboard.name}
              </Title>
              <Text style={{ fontSize: 12, color: "#6B7280" }} ellipsis>
                {dashboard.description?.trim() ? dashboard.description : dashboardT("workbench.noDescription")}
              </Text>
            </div>
            <div style={{ flex: 1 }} />
            {dashboard.isPublic && canEdit && !canManage ? (
              <Alert
                type="info"
                showIcon
                message={dashboardT("workbench.publicAdminOnly")}
                style={{ padding: "4px 10px" }}
              />
            ) : null}
            <Text style={{ fontSize: 11, color: "#98A2B3" }}>
              {dashboardT("workbench.lastRefresh", { time: lastRefreshLabel })}
            </Text>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={bumpRefresh}>
                {dashboardT("workbench.refresh")}
              </Button>
              <Button
                icon={<RobotOutlined />}
                onClick={() => setAiVisualDesignerOpen(true)}
                disabled={!canEditWidgets}
              >
                {dashboardT("workbench.aiDesign")}
              </Button>
              <Dropdown menu={addMenu} trigger={["click"]}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!canEditWidgets}
                >
                  {dashboardT("workbench.addWidget")}
                </Button>
              </Dropdown>
              <Button
                icon={<LinkOutlined />}
                onClick={() => setShareOpen(true)}
                disabled={!canManage}
              >
                {dashboardT("workbench.share")}
              </Button>
            </Space>
          </div>

          <div style={{ flex: 1, overflow: "auto", background: "#F9FAFB" }}>
            <div style={{ padding: 16 }} onMouseDown={handleCanvasMouseDown}>
              {(dashboard.widgets || []).length === 0 ? (
                <div
                  style={{
                    minHeight: 420,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Empty
                    description={
                      canEditWidgets
                        ? dashboardT("workbench.emptyEditable")
                        : dashboardT("workbench.emptyReadonly")
                    }
                  >
                    {canEditWidgets ? (
                      <Dropdown menu={addMenu} trigger={["click"]}>
                        <Button type="primary" icon={<PlusOutlined />}>
                          {dashboardT("workbench.addWidget")}
                        </Button>
                      </Dropdown>
                    ) : null}
                  </Empty>
                </div>
              ) : (
                <ResponsiveGridLayout
                  className="dashboard-workbench-grid"
                  layouts={layouts}
                  breakpoints={GRID_BREAKPOINTS}
                  cols={GRID_COLS}
                  rowHeight={GRID_ROW_HEIGHT}
                  margin={[12, 12]}
                  containerPadding={[0, 0]}
                  isDraggable={canEditWidgets}
                  isResizable={canEditWidgets}
                  draggableHandle=".dashboard-widget-drag-handle"
                  draggableCancel=".dashboard-widget-drag-cancel"
                  compactType="vertical"
                  preventCollision={false}
                  onBreakpointChange={(_breakpoint: string, cols: number) => setActiveCols(cols)}
                  onDragStop={(layout: Layout[]) => commitGridLayout(layout)}
                  onResizeStop={(layout: Layout[]) => commitGridLayout(layout)}
                >
                  {(dashboard.widgets || []).map((w) => (
                    <div
                      key={w.id}
                      className={
                        w.id === selectedWidgetId
                          ? "dashboard-workbench-item is-selected"
                          : "dashboard-workbench-item"
                      }
                    >
                      <DashboardWidgetCard
                        widget={w}
                        dashboardId={dashboardId || undefined}
                        canEdit={canEditWidgets}
                        refreshSignal={refreshSignal}
                        selected={w.id === selectedWidgetId}
                        onSelect={(id) => {
                          setSelectedWidgetId(id);
                          setConfigOpen(false);
                        }}
                        onOpenConfig={openWidgetConfig}
                        onExportExcel={handleExportExcel}
                        onExportImage={handleExportImage}
                        onFullscreen={handleFullscreen}
                        onDuplicate={handleDuplicateWidget}
                      />
                    </div>
                  ))}
                </ResponsiveGridLayout>
              )}
            </div>
          </div>

          <Drawer
            title={dashboardT("workbench.configTitle")}
            open={configOpen && Boolean(selectedWidget)}
            onClose={() => setConfigOpen(false)}
            width={420}
            destroyOnClose={false}
            extra={
              <Space>
                <Button danger onClick={removeWidget} disabled={!canEditWidgets}>
                  {dashboardT("workbench.delete")}
                </Button>
                <Button
                  type="primary"
                  onClick={saveWidgetConfig}
                  disabled={!canEditWidgets}
                  loading={saveWidgetLoading}
                >
                  {dashboardT("workbench.save")}
                </Button>
              </Space>
            }
          >
            {!selectedWidget ? null : (
              <Form form={form} layout="vertical">
                <Form.Item name="title" label={dashboardT("workbench.title")}>
                  <Input placeholder={dashboardT("workbench.titlePlaceholder")} />
                </Form.Item>
                <Form.Item name="type" label={dashboardT("workbench.type")} rules={[{ required: true }]}>
                  <Select
                    onChange={(nextType) => {
                      if (!DIMENSION_WIDGET_TYPES.has(nextType)) {
                        form.setFieldValue("dimensionFieldId", undefined);
                        form.setFieldValue("sortBy", "value");
                      }
                    }}
                    options={[
                      {
                        label: dashboardT("workbench.group.comparison"),
                        options: [
                          { value: "bar", label: dashboardT("workbench.type.bar") },
                          { value: "horizontalBar", label: dashboardT("workbench.type.horizontalBar") },
                          { value: "table", label: dashboardT("workbench.type.table") },
                        ],
                      },
                      {
                        label: dashboardT("workbench.group.trend"),
                        options: [{ value: "line", label: dashboardT("workbench.type.line") }],
                      },
                      {
                        label: dashboardT("workbench.group.composition"),
                        options: [{ value: "pie", label: dashboardT("workbench.type.pie") }],
                      },
                      {
                        label: dashboardT("workbench.group.indicator"),
                        options: [
                          { value: "metric", label: dashboardT("workbench.type.metric") },
                          { value: "progress", label: dashboardT("workbench.type.progress") },
                        ],
                      },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="paletteId" label={dashboardT("workbench.palette")} initialValue="default">
                  <Select
                    options={PALETTES.map((p) => ({
                      value: p.id,
                      label: dashboardPaletteLabel(p.id, p.name),
                    }))}
                  />
                </Form.Item>
                <Divider />
                <Form.Item
                  name="tableId"
                  label={dashboardT("workbench.table")}
                  rules={[{ required: true, message: dashboardT("workbench.selectTableRequired") }]}
                >
                  <Select
                    showSearch
                    onChange={() => {
                      form.setFieldsValue({
                        dimensionFieldId: undefined,
                        metricFieldId: undefined,
                        filters: [],
                        sortBy: "value",
                      });
                    }}
                    optionFilterProp="label"
                    placeholder={dashboardT("workbench.selectTable")}
                    options={tables.map((t) => ({ value: t.id, label: t.name }))}
                  />
                </Form.Item>
                {needsDimension ? (
                  <Form.Item
                    name="dimensionFieldId"
                    label={dashboardT("workbench.dimensionField")}
                    rules={[
                      {
                        required: true,
                        message: dashboardT("workbench.dimensionRequired"),
                      },
                    ]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="title"
                      placeholder={dashboardT("workbench.dimensionPlaceholder")}
                      options={fieldOptions}
                    />
                  </Form.Item>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message={dashboardT("workbench.noDimensionNeeded")}
                    style={{ marginBottom: 16 }}
                  />
                )}
                <Form.Item name="metricAggregation" label={dashboardT("workbench.aggregation")} initialValue="count">
                  <Select
                    options={[
                      { value: "count", label: dashboardT("aggregation.count") },
                      { value: "sum", label: dashboardT("aggregation.sum") },
                      { value: "avg", label: dashboardT("aggregation.avg") },
                      { value: "max", label: dashboardT("aggregation.max") },
                      { value: "min", label: dashboardT("aggregation.min") },
                    ]}
                  />
                </Form.Item>
                {selectedAggregation === "count" ? (
                  <Alert
                    type="success"
                    showIcon
                    message={dashboardT("workbench.countHelp")}
                    style={{ marginBottom: 16 }}
                  />
                ) : (
                  <Form.Item
                    name="metricFieldId"
                    label={dashboardT("workbench.metricField")}
                    rules={[
                      {
                        required: true,
                        message: dashboardT("workbench.metricFieldRequired"),
                      },
                    ]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="title"
                      placeholder={dashboardT("workbench.metricFieldPlaceholder")}
                      options={numericFieldOptions}
                      notFoundContent={dashboardT("workbench.noNumericFields")}
                    />
                  </Form.Item>
                )}
                <Divider />
                <Form.List name="filters">
                  {(items, { add, remove }) => (
                    <Space direction="vertical" style={{ width: "100%" }} size={8}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <Text style={{ fontWeight: 700 }}>{dashboardT("workbench.filterConditions")}</Text>
                        <div style={{ flex: 1 }} />
                        <Button
                          size="small"
                          type="dashed"
                          onClick={() => add({ operator: "eq", value: "" })}
                        >
                          {dashboardT("workbench.add")}
                        </Button>
                      </div>
                      {items.map((field) => {
                        const filter = watchedFilters?.[field.name];
                        const fieldDefinition = availableFields.find(
                          (item) => item.id === filter?.fieldId,
                        );
                        const operator = filter?.operator || "eq";
                        const selectOptions = (
                          fieldDefinition?.options || []
                        ).map((option) => ({
                          value:
                            option.id ||
                            option.value ||
                            option.label ||
                            "",
                          label:
                            option.label ||
                            option.value ||
                            option.id ||
                            "",
                        }));
                        const useSelectValue =
                          fieldDefinition?.type === "select" &&
                          selectOptions.length > 0;
                        return (
                          <Space
                            key={field.key}
                            style={{ width: "100%" }}
                            size={8}
                            align="start"
                          >
                            <Form.Item
                              name={[field.name, "fieldId"]}
                              rules={[{ required: true }]}
                              style={{ flex: 1, marginBottom: 0 }}
                            >
                              <Select
                                placeholder={dashboardT("workbench.field")}
                                options={fieldOptions}
                                style={{ minWidth: 130 }}
                                onChange={() => {
                                  form.setFieldValue(
                                    ["filters", field.name, "operator"],
                                    "eq",
                                  );
                                  form.setFieldValue(
                                    ["filters", field.name, "value"],
                                    undefined,
                                  );
                                }}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, "operator"]}
                              rules={[{ required: true }]}
                              style={{ width: 116, marginBottom: 0 }}
                            >
                              <Select
                                options={filterOperatorOptions(
                                  fieldDefinition,
                                )}
                                onChange={() =>
                                  form.setFieldValue(
                                    ["filters", field.name, "value"],
                                    undefined,
                                  )
                                }
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, "value"]}
                              style={{ flex: 1, marginBottom: 0 }}
                            >
                              {useSelectValue ? (
                                <Select
                                  mode={
                                    operator === "in"
                                      ? "multiple"
                                      : undefined
                                  }
                                  allowClear
                                  placeholder={dashboardWorkbenchExtraT("filter.selectValue")}
                                  options={selectOptions}
                                  style={{ minWidth: 130 }}
                                />
                              ) : (
                                <Input
                                  type={
                                    fieldDefinition &&
                                    NUMERIC_FIELD_TYPES.has(
                                      fieldDefinition.type,
                                    )
                                      ? "number"
                                      : fieldDefinition?.type === "date"
                                        ? "date"
                                        : "text"
                                  }
                                  placeholder={
                                    operator === "in"
                                      ? dashboardT("filters.multiValue")
                                      : dashboardT("filters.value")
                                  }
                                />
                              )}
                            </Form.Item>
                            <Button
                              danger
                              type="text"
                              onClick={() => remove(field.name)}
                            >
                              {dashboardT("workbench.delete")}
                            </Button>
                          </Space>
                        );
                      })}
                    </Space>
                  )}
                </Form.List>
                <Divider />
                <Space style={{ width: "100%" }} size={12}>
                  <Form.Item name="sortBy" label={dashboardWorkbenchExtraT("sort.label")} style={{ flex: 1 }}>
                    <Select
                      options={[
                        { value: "value", label: dashboardWorkbenchExtraT("sort.value") },
                        ...(needsDimension
                          ? [{ value: "dimension", label: dashboardWorkbenchExtraT("sort.dimension") }]
                          : []),
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="sortOrder" label={dashboardWorkbenchExtraT("sort.order")} style={{ flex: 1 }}>
                    <Select
                      options={[
                        { value: "desc", label: dashboardWorkbenchExtraT("sort.desc") },
                        { value: "asc", label: dashboardWorkbenchExtraT("sort.asc") },
                      ]}
                    />
                  </Form.Item>
                </Space>
                <Form.Item name="limit" label={dashboardWorkbenchExtraT("limit.label")}>
                  <Input type="number" min={1} max={1000} />
                </Form.Item>
                {selectedWidgetType === "progress" ? (
                  <Form.Item
                    name="targetValue"
                    label={dashboardWorkbenchExtraT("target.label")}
                    tooltip={dashboardWorkbenchExtraT("target.tooltip")}
                    rules={[
                      {
                        required: true,
                        message: dashboardWorkbenchExtraT("target.required"),
                      },
                    ]}
                  >
                    <Input
                      type="number"
                      min={0.000001}
                      placeholder={dashboardWorkbenchExtraT("target.placeholder")}
                    />
                  </Form.Item>
                ) : null}
              </Form>
            )}
          </Drawer>

          <Modal
            title={dashboardWorkbenchExtraT("share.title")}
            open={shareOpen}
            onCancel={() => setShareOpen(false)}
            footer={null}
            destroyOnClose
          >
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                  {dashboardWorkbenchExtraT("share.description")}
                </div>
                <Input.TextArea
                  value={shareDescription}
                  onChange={(event) =>
                    setShareDescription(event.target.value)
                  }
                  rows={3}
                  maxLength={1000}
                  showCount
                  disabled={!canManage}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <Button
                    size="small"
                    onClick={handleSaveDescription}
                    loading={shareSaving}
                    disabled={!canManage}
                  >
                    {dashboardWorkbenchExtraT("share.saveDescription")}
                  </Button>
                </div>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Switch
                  checked={Boolean(dashboard.isPublic)}
                  onChange={handleTogglePublic}
                  loading={shareSaving}
                  disabled={!canManage || shareSaving}
                />
                <div style={{ flex: 1 }}>
                  <Space size={6}>
                    <div style={{ fontWeight: 600 }}>
                      {dashboardWorkbenchExtraT("share.publicAccess")}
                    </div>
                    <Tag color={dashboard.isPublic ? "green" : "default"}>
                      {dashboard.isPublic
                        ? dashboardWorkbenchExtraT("share.public")
                        : dashboardWorkbenchExtraT("share.private")}
                    </Tag>
                  </Space>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    {dashboardWorkbenchExtraT("share.hint")}
                  </div>
                </div>
                <Button
                  icon={<CopyOutlined />}
                  onClick={handleCopyShareLink}
                  disabled={!canManage || !dashboard.isPublic || shareSaving}
                >
                  {dashboardWorkbenchExtraT("share.copyLink")}
                </Button>
              </div>
            </Space>
          </Modal>

          <Modal
            title={dashboardWorkbenchExtraT("fullscreen.title")}
            open={fullscreenOpen}
            onCancel={() => setFullscreenOpen(false)}
            footer={null}
            width="95vw"
            style={{ top: 24 }}
            destroyOnClose
          >
            {fullscreenWidget ? (
              <div style={{ height: "78vh", border: "1px solid #EAECF0", borderRadius: 10, overflow: "hidden" }}>
                <DashboardWidgetCard
                  widget={fullscreenWidget}
                  dashboardId={dashboardId || undefined}
                  canEdit={false}
                  refreshSignal={refreshSignal}
                  selected={false}
                  onSelect={() => {}}
                  onOpenConfig={() => {}}
                  onExportExcel={handleExportExcel}
                  onExportImage={handleExportImage}
                  onFullscreen={() => {}}
                  onDuplicate={() => {}}
                  style={{ height: "100%" }}
                />
              </div>
            ) : null}
          </Modal>
        </div>
      </div>
      <AiVisualDesignerModal
        open={aiVisualDesignerOpen}
        workspaceId={workspaceId}
        dashboardId={dashboardId || null}
        defaultTargetType="dashboard"
        lockTargetType
        initialPrompt={dashboardWorkbenchExtraT("ai.defaultPrompt")}
        onClose={() => setAiVisualDesignerOpen(false)}
        onApplied={async () => {
          await refetch();
          bumpRefresh();
        }}
      />
    </>
  );

  if (embedded) return content;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        background: "var(--qtable-color-background)",
      }}
    >
      {content}
    </div>
  );
}
