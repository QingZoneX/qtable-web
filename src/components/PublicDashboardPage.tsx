import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dropdown,
  Empty,
  Modal,
  Result,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  DownloadOutlined,
  EllipsisOutlined,
  ExpandOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useApolloClient, useQuery } from "@apollo/client/react";
import { useParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout, Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  DASHBOARD_PUBLIC_WIDGET_DATA,
  GET_DASHBOARD_PUBLIC,
} from "../lib/graphql";
import { useLanguage } from "../lib/useLanguage";
import type {
  DashboardPayload,
  DashboardWidget,
  WidgetDataPayload,
} from "./Dashboard";
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  MIN_H,
  MIN_W,
  downloadBlob,
  exportRowsToXlsx,
  normalizeLayout,
  scaleLayout,
} from "./Dashboard";
import {
  WidgetContent,
  WidgetContentSkeleton,
} from "./Dashboard/WidgetContent";
import { publicDashboardT } from "./Dashboard/publicDashboardI18n";

const { Title, Text } = Typography;
const ResponsiveGridLayout = WidthProvider(Responsive);

function safeFilename(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "dashboard-widget";
}

export function PublicDashboardPage() {
  useLanguage();
  const { token } = useParams();
  const apollo = useApolloClient();
  const { data, loading, error, refetch } = useQuery<{
    dashboardPublic: DashboardPayload;
  }>(GET_DASHBOARD_PUBLIC, {
    variables: { token: token || "" },
    skip: !token,
    fetchPolicy: "network-only",
  });
  const dashboard = data?.dashboardPublic;
  const [fullscreenWidgetId, setFullscreenWidgetId] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);
  const fullscreenWidget = useMemo(
    () =>
      dashboard?.widgets?.find(
        (widget) => widget.id === fullscreenWidgetId,
      ) || null,
    [dashboard?.widgets, fullscreenWidgetId],
  );

  const layouts = useMemo<Layouts>(() => {
    const widgets = dashboard?.widgets || [];
    const toLayout = (widget: DashboardWidget, cols: number): Layout => {
      const base = normalizeLayout(widget.layout, 12);
      const scaled = scaleLayout(base, cols);
      return {
        i: widget.id,
        x: scaled.x,
        y: scaled.y,
        w: scaled.w,
        h: scaled.h,
        minW: Math.min(MIN_W, cols),
        minH: MIN_H,
        static: true,
      };
    };
    return {
      lg: widgets.map((widget) => toLayout(widget, GRID_COLS.lg)),
      md: widgets.map((widget) => toLayout(widget, GRID_COLS.md)),
      sm: widgets.map((widget) => toLayout(widget, GRID_COLS.sm)),
      xs: widgets.map((widget) => toLayout(widget, GRID_COLS.xs)),
      xxs: widgets.map((widget) => toLayout(widget, GRID_COLS.xxs)),
    };
  }, [dashboard?.widgets]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7280",
        }}
      >
        {publicDashboardT("loading")}
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <Result
        status="404"
        title={publicDashboardT("unavailableTitle")}
        subTitle={publicDashboardT("unavailableSubtitle")}
        extra={
          <Button onClick={() => void refetch()}>
            {publicDashboardT("reload")}
          </Button>
        }
      />
    );
  }

  const handleExportExcel = async (
    widget: DashboardWidget,
  ) => {
    if (!token) return;
    try {
      const response = await apollo.query<{
        dashboardPublicWidgetData: WidgetDataPayload;
      }>({
        query: DASHBOARD_PUBLIC_WIDGET_DATA,
        variables: { token, widgetId: widget.id },
        fetchPolicy: "network-only",
      });
      const rows = (
        response.data?.dashboardPublicWidgetData?.rows || []
      ) as Record<string, unknown>[];
      exportRowsToXlsx(
        `${safeFilename(dashboard.name)}-${safeFilename(
          widget.title || publicDashboardT("widgetFilename"),
        )}.xlsx`,
        rows,
      );
    } catch {
      message.error(publicDashboardT("exportDataFailed"));
    }
  };

  const handleExportImage = async (
    node: HTMLDivElement,
    widget: DashboardWidget,
  ) => {
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      downloadBlob(
        `${safeFilename(dashboard.name)}-${safeFilename(
          widget.title || publicDashboardT("widgetFilename"),
        )}.png`,
        blob,
      );
    } catch {
      message.error(publicDashboardT("exportImageFailed"));
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#F8FAFC",
      }}
    >
      <div
        style={{
          minHeight: 68,
          padding: "12px 20px",
          borderBottom: "1px solid #EAECF0",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Title level={4} style={{ margin: 0 }} ellipsis>
            {dashboard.name}
          </Title>
          <Text
            style={{ color: "#6B7280", fontSize: 12 }}
            ellipsis
          >
            {dashboard.description || publicDashboardT("publicDashboard")}
          </Text>
        </div>
        <div style={{ flex: 1 }} />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => setRefreshSignal((value) => value + 1)}
        >
          {publicDashboardT("refreshData")}
        </Button>
      </div>

      <div style={{ padding: 16 }}>
        {(dashboard.widgets || []).length === 0 ? (
          <div
            style={{
              minHeight: 420,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Empty description={publicDashboardT("emptyDashboard")} />
          </div>
        ) : (
          <ResponsiveGridLayout
            className="dashboard-public-grid"
            layouts={layouts}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            isDraggable={false}
            isResizable={false}
            compactType="vertical"
            useCSSTransforms
          >
            {(dashboard.widgets || []).map((widget) => (
              <div key={widget.id}>
                <PublicWidget
                  widget={widget}
                  token={token || ""}
                  refreshSignal={refreshSignal}
                  onFullscreen={() =>
                    setFullscreenWidgetId(widget.id)
                  }
                  onExportExcel={() =>
                    void handleExportExcel(widget)
                  }
                  onExportImage={(node) =>
                    void handleExportImage(node, widget)
                  }
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      <Modal
        open={Boolean(fullscreenWidget)}
        title={fullscreenWidget?.title || publicDashboardT("widgetDetails")}
        onCancel={() => setFullscreenWidgetId("")}
        footer={null}
        width="94vw"
        style={{ top: 24 }}
        destroyOnClose
      >
        {fullscreenWidget ? (
          <div style={{ height: "78vh" }}>
            <PublicWidget
              widget={fullscreenWidget}
              token={token || ""}
              refreshSignal={refreshSignal}
              compactHeader
              onFullscreen={() => setFullscreenWidgetId("")}
              onExportExcel={() =>
                void handleExportExcel(fullscreenWidget)
              }
              onExportImage={(node) =>
                void handleExportImage(node, fullscreenWidget)
              }
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function PublicWidget({
  widget,
  token,
  refreshSignal,
  compactHeader,
  onFullscreen,
  onExportExcel,
  onExportImage,
}: {
  widget: DashboardWidget;
  token: string;
  refreshSignal: number;
  compactHeader?: boolean;
  onFullscreen: () => void;
  onExportExcel: () => void;
  onExportImage: (node: HTMLDivElement) => void;
}) {
  useLanguage();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error, refetch } = useQuery<{
    dashboardPublicWidgetData: WidgetDataPayload;
  }>(DASHBOARD_PUBLIC_WIDGET_DATA, {
    variables: { token, widgetId: widget.id },
    skip: !token,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    pollInterval: 30_000,
  });

  useEffect(() => {
    if (refreshSignal > 0) void refetch();
  }, [refreshSignal, refetch]);

  const title = widget.title?.trim()
    ? widget.title.trim()
    : publicDashboardT("untitledWidget");

  const items: MenuProps["items"] = [
    {
      key: "fullscreen",
      icon: <ExpandOutlined />,
      label: compactHeader
        ? publicDashboardT("exitFullscreen")
        : publicDashboardT("fullscreen"),
    },
    {
      key: "export-image",
      icon: <DownloadOutlined />,
      label: publicDashboardT("exportImage"),
    },
    {
      key: "export-excel",
      icon: <DownloadOutlined />,
      label: publicDashboardT("exportExcel"),
    },
  ];

  return (
    <div
      ref={cardRef}
      style={{
        border: "1px solid #EAECF0",
        borderRadius: 10,
        background: "#fff",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        position: "relative",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      {loading ? (
        <div
          style={{
            position: "absolute",
            inset: 10,
            background: "rgba(255,255,255,0.88)",
            borderRadius: 8,
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

      <div
        style={{
          height: compactHeader ? 0 : 36,
          display: compactHeader ? "none" : "flex",
          alignItems: "center",
          padding: "0 10px",
          borderBottom: compactHeader
            ? "none"
            : "1px solid #F2F4F7",
        }}
      >
        <Text style={{ fontWeight: 700, fontSize: 12 }} ellipsis>
          {title}
        </Text>
        <div style={{ flex: 1 }} />
        <Dropdown
          trigger={["click"]}
          menu={{
            items,
            onClick: ({ key }) => {
              if (key === "fullscreen") onFullscreen();
              if (key === "export-excel") onExportExcel();
              if (key === "export-image" && cardRef.current) {
                onExportImage(cardRef.current);
              }
            },
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<EllipsisOutlined />}
          />
        </Dropdown>
      </div>

      <div
        style={{
          padding: 10,
          height: compactHeader
            ? "100%"
            : "calc(100% - 36px)",
        }}
      >
        {error ? (
          <Result
            status="warning"
            title={publicDashboardT("dataUnavailable")}
            subTitle={publicDashboardT("dataUnavailableSubtitle")}
            extra={
              <Button size="small" onClick={() => void refetch()}>
                {publicDashboardT("retry")}
              </Button>
            }
            style={{ padding: "18px 8px" }}
          />
        ) : !loading &&
          (data?.dashboardPublicWidgetData?.rows?.length ?? 0) ===
            0 ? (
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
              description={publicDashboardT("noData")}
            />
          </div>
        ) : (
          <WidgetContent
            widget={widget}
            data={data?.dashboardPublicWidgetData}
          />
        )}
      </div>
    </div>
  );
}
