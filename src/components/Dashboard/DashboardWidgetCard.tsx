import { useEffect, useMemo, useRef } from "react";
import { Alert, Button, Dropdown, Empty, Space, Tag, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  ExpandOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { DASHBOARD_WIDGET_DATA } from "../../lib/graphql";
import { useLanguage } from "../../lib/useLanguage";
import type { DashboardWidget, WidgetDataPayload } from "./types";
import { WidgetContent, WidgetContentSkeleton } from "./WidgetContent";
import {
  runtimeFiltersForTable,
  useDashboardExperience,
} from "./DashboardExperienceContext";
import { dashboardT } from "./dashboardI18n";
import { exportRowsToXlsx } from "./utils";

const { Text } = Typography;

const DASHBOARD_WIDGET_DATA_WITH_RUNTIME_FILTERS = gql`
  query DashboardWidgetDataWithRuntimeFilters(
    $widgetId: String!
    $dashboardId: String
    $runtimeFilters: JSON
  ) {
    dashboardWidgetData(
      widgetId: $widgetId
      dashboardId: $dashboardId
      runtimeFilters: $runtimeFilters
    )
  }
`;

function safeFilename(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "dashboard-widget";
}

function widgetErrorDescription(
  message: string | undefined,
  options: {
    runtimeFilterUnsupported: boolean;
    hasRuntimeFilters: boolean;
  },
) {
  const normalized = String(message || "").toLowerCase();
  if (options.runtimeFilterUnsupported) {
    return dashboardT("widget.error.runtimeFilterUnsupported");
  }
  if (/source table not found|widget not found/.test(normalized)) {
    return dashboardT("widget.error.sourceMissing");
  }
  if (/source table is not available|permission|forbidden|not authorized/.test(normalized)) {
    return dashboardT("widget.error.permission");
  }
  if (/missing field|requires a .*field|unsupported dashboard filter|widget .*invalid/.test(normalized)) {
    return dashboardT("widget.error.fieldInvalid");
  }
  if (options.hasRuntimeFilters) {
    return dashboardT("widget.error.runtimeFilterInvalid");
  }
  return dashboardT("widget.error.generic");
}

/**
 * Dashboard widget card with title, loading state, action menu, and content.
 * Runtime filters from Dashboard Experience Shell are passed only as server query variables
 * and never rewrite widget.config.
 */
export function DashboardWidgetCard({
  widget,
  dashboardId,
  canEdit,
  refreshSignal,
  selected,
  onSelect,
  onOpenConfig,
  onExportExcel,
  onExportImage,
  onFullscreen,
  onDuplicate,
  style,
}: {
  widget: DashboardWidget;
  dashboardId?: string;
  canEdit: boolean;
  refreshSignal: number;
  onSelect: (id: string) => void;
  onOpenConfig: (id: string) => void;
  selected: boolean;
  onExportExcel: (id: string) => void;
  onExportImage: (id: string, node: HTMLDivElement) => void;
  onFullscreen: (id: string) => void;
  onDuplicate: (id: string) => void;
  style?: React.CSSProperties;
}) {
  useLanguage();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { mode, runtimeFilters, reportDataLoaded } = useDashboardExperience();
  const effectiveCanEdit = canEdit && mode === "edit";
  const scopedRuntimeFilters = useMemo(
    () => runtimeFiltersForTable(runtimeFilters, widget.config?.tableId),
    [runtimeFilters, widget.config?.tableId],
  );
  const hasRuntimeFilters = scopedRuntimeFilters.length > 0;

  const { data, loading, error, refetch } = useQuery<{
    dashboardWidgetData: WidgetDataPayload;
  }>(hasRuntimeFilters ? DASHBOARD_WIDGET_DATA_WITH_RUNTIME_FILTERS : DASHBOARD_WIDGET_DATA, {
    variables: hasRuntimeFilters
      ? {
          widgetId: widget.id,
          dashboardId,
          runtimeFilters: scopedRuntimeFilters,
        }
      : {
          widgetId: widget.id,
          dashboardId,
        },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (refreshSignal > 0) void refetch();
  }, [refreshSignal, refetch]);

  useEffect(() => {
    if (!loading && !error && data?.dashboardWidgetData) reportDataLoaded();
  }, [data?.dashboardWidgetData, error, loading, reportDataLoaded]);

  const title = widget.title?.trim() ? widget.title.trim() : dashboardT("widget.unnamed");
  const rows = data?.dashboardWidgetData?.rows ?? [];
  const runtimeFilterUnsupported = Boolean(
    hasRuntimeFilters &&
      error?.message &&
      /runtimeFilters|unknown argument|unknown field/i.test(error.message),
  );
  const errorDescription = widgetErrorDescription(error?.message, {
    runtimeFilterUnsupported,
    hasRuntimeFilters,
  });

  const menuItems: MenuProps["items"] = [
    ...(effectiveCanEdit
      ? [{ key: "duplicate", icon: <CopyOutlined />, label: dashboardT("widget.duplicate") }]
      : []),
    { key: "fullscreen", icon: <ExpandOutlined />, label: dashboardT("widget.fullscreen") },
    { key: "export-image", icon: <DownloadOutlined />, label: dashboardT("widget.exportImage") },
    { key: "export-excel", icon: <DownloadOutlined />, label: dashboardT("widget.exportExcel") },
  ];

  const exportCurrentRows = () => {
    if (!scopedRuntimeFilters.length) {
      onExportExcel(widget.id);
      return;
    }
    exportRowsToXlsx(
      `${safeFilename(title)}.xlsx`,
      rows.map((row) => ({ dimension: row.dimension, value: row.value })),
    );
  };

  return (
    <div
      ref={cardRef}
      style={{
        width: "100%",
        height: "100%",
        border: "1px solid var(--qtable-color-border)",
        borderRadius: "var(--qtable-radius-lg)",
        background: "var(--qtable-color-background)",
        overflow: "hidden",
        boxShadow: selected
          ? "var(--qtable-shadow-focus), var(--qtable-shadow-card)"
          : "var(--qtable-shadow-card)",
        userSelect: "none",
        position: "relative",
        ...style,
      }}
      onClick={() => onSelect(widget.id)}
    >
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          borderBottom: "1px solid var(--qtable-color-border)",
          gap: 8,
        }}
      >
        <div
          className={effectiveCanEdit ? "dashboard-widget-drag-handle" : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            cursor: effectiveCanEdit ? "move" : "default",
            gap: 6,
          }}
        >
          <Text strong ellipsis style={{ fontSize: "var(--qtable-font-size-label)" }}>
            {title}
          </Text>
          {scopedRuntimeFilters.length ? (
            <Tag color="blue" variant="filled">
              {dashboardT("widget.filterCount", { count: scopedRuntimeFilters.length })}
            </Tag>
          ) : null}
        </div>
        {effectiveCanEdit ? (
          <Tooltip title={dashboardT("widget.configure")}>
            <Button
              type="text"
              size="small"
              aria-label={dashboardT("widget.configureAria", { title })}
              icon={<SettingOutlined />}
              className="dashboard-widget-drag-cancel"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onOpenConfig(widget.id);
              }}
            />
          </Tooltip>
        ) : null}
        <Dropdown
          trigger={["click"]}
          menu={{
            items: menuItems,
            onClick: async ({ key }) => {
              const node = cardRef.current;
              if (!node) return;
              if (key === "duplicate") onDuplicate(widget.id);
              if (key === "fullscreen") onFullscreen(widget.id);
              if (key === "export-image") onExportImage(widget.id, node);
              if (key === "export-excel") exportCurrentRows();
            },
          }}
        >
          <Tooltip title={dashboardT("widget.moreActions")}>
            <Button
              type="text"
              size="small"
              aria-label={dashboardT("widget.moreActionsAria", { title })}
              icon={<EllipsisOutlined />}
              className="dashboard-widget-drag-cancel"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          </Tooltip>
        </Dropdown>
      </div>

      <div style={{ height: "calc(100% - 36px)", padding: 10, position: "relative" }}>
        {loading ? (
          <div
            role="status"
            aria-label={dashboardT("widget.loadingAria", { title })}
            style={{
              position: "absolute",
              inset: 10,
              background: "rgba(255,255,255,0.82)",
              borderRadius: "var(--qtable-radius-md)",
              pointerEvents: "none",
              zIndex: 2,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              className="qtable-skeleton qtable-skeleton-rounded"
              style={{ width: "42%", height: 12 }}
            />
            <WidgetContentSkeleton type={widget.type} />
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
            }}
          >
            <Alert
              type="error"
              showIcon
              title={dashboardT("widget.loadFailed")}
              description={errorDescription}
              action={
                <Space size={6}>
                  {effectiveCanEdit && !runtimeFilterUnsupported ? (
                    <Button size="small" onClick={() => onOpenConfig(widget.id)}>
                      {dashboardT("widget.checkConfig")}
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => void refetch()}>
                    {dashboardT("widget.retry")}
                  </Button>
                </Space>
              }
            />
          </div>
        ) : !loading && rows.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                scopedRuntimeFilters.length
                  ? dashboardT("widget.noDataFiltered")
                  : dashboardT("widget.noData")
              }
            />
          </div>
        ) : (
          <WidgetContent
            widget={widget}
            data={data?.dashboardWidgetData ?? undefined}
          />
        )}
      </div>
    </div>
  );
}
