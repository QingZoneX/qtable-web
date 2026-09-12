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
import type { DashboardWidget, WidgetDataPayload } from "./types";
import { WidgetContent, WidgetContentSkeleton } from "./WidgetContent";
import {
  runtimeFiltersForTable,
  useDashboardExperience,
} from "./DashboardExperienceContext";
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
    return "当前服务端版本尚未支持仪表盘全局筛选。请先清除筛选，或完成服务端升级后重试。";
  }
  if (/source table not found|widget not found/.test(normalized)) {
    return "组件引用的数据源已经不存在。请进入编辑模式重新选择有效的数据表并保存组件配置。";
  }
  if (/source table is not available|permission|forbidden|not authorized/.test(normalized)) {
    return "当前账号已无法读取该组件的数据源。请检查工作区/数据表权限，或改用当前可访问的数据表。";
  }
  if (/missing field|requires a .*field|unsupported dashboard filter|widget .*invalid/.test(normalized)) {
    return "组件配置引用了已删除或不再兼容的字段。请进入编辑模式重新选择维度、指标或筛选字段。";
  }
  if (options.hasRuntimeFilters) {
    return "当前全局筛选可能引用了失效字段，或数据源权限发生变化。请移除筛选、检查配置后重试。";
  }
  return "数据源存在运行时异常，或组件配置已失效。请重试；管理员可进入配置检查数据表、维度与指标字段。";
}

/**
 * 仪表盘小组件卡片 —— 含标题栏、骨架屏加载态、操作菜单、内容区域。
 * Dashboard Experience Shell 注入的 runtime filter 只作为服务端查询变量，
 * 不会改写 widget.config。
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

  const title = widget.title?.trim() ? widget.title.trim() : "未命名组件";
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
      ? [{ key: "duplicate", icon: <CopyOutlined />, label: "复制组件" }]
      : []),
    { key: "fullscreen", icon: <ExpandOutlined />, label: "全屏查看" },
    { key: "export-image", icon: <DownloadOutlined />, label: "导出图片" },
    { key: "export-excel", icon: <DownloadOutlined />, label: "导出 Excel" },
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
              筛选 {scopedRuntimeFilters.length}
            </Tag>
          ) : null}
        </div>
        {effectiveCanEdit ? (
          <Tooltip title="配置组件">
            <Button
              type="text"
              size="small"
              aria-label={`配置 ${title}`}
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
          <Tooltip title="更多组件操作">
            <Button
              type="text"
              size="small"
              aria-label={`${title} 更多操作`}
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
            aria-label={`${title} 正在加载`}
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
              title="组件数据加载失败"
              description={errorDescription}
              action={
                <Space size={6}>
                  {effectiveCanEdit && !runtimeFilterUnsupported ? (
                    <Button size="small" onClick={() => onOpenConfig(widget.id)}>
                      检查配置
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => void refetch()}>
                    重试
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
                  ? "当前全局筛选下暂无数据"
                  : "暂无符合条件的数据"
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
