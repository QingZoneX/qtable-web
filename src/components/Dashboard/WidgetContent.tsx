import { useMemo } from "react";
import { VChart } from "@visactor/react-vchart";
import { Tag } from "antd";
import type { DashboardWidget, WidgetDataPayload } from "./types";
import { dashboardChartRenderRevision } from "./chartRenderModel";
import {
  buildChartSpec,
  formatDisplayNumber,
  resolvePalette,
  toFiniteNumber,
  truncateDashboardLabel,
} from "./utils";

function formatDimension(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    const labels = value.map(formatDimension).filter((item) => item !== "—");
    return labels.length ? labels.join(", ") : "—";
  }
  if (typeof value === "object") {
    const candidate = value as {
      name?: unknown;
      label?: unknown;
      title?: unknown;
      id?: unknown;
    };
    const label =
      candidate.name ?? candidate.label ?? candidate.title ?? candidate.id;
    return label == null || label === "" ? "—" : String(label);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        return formatDimension(JSON.parse(trimmed) as unknown);
      } catch {
        return value;
      }
    }
  }
  return String(value);
}

function aggregationLabel(value?: string) {
  const labels: Record<string, string> = {
    count: "计数",
    sum: "求和",
    avg: "平均值",
    max: "最大值",
    min: "最小值",
  };
  return labels[value || "count"] || String(value || "计数").toUpperCase();
}

/** 小组件内容区域 —— 根据类型渲染图表/表格/指标卡/进度条。 */
export function WidgetContent({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data?: WidgetDataPayload;
}) {
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const displayRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        dimension: formatDimension(row.dimension),
      })),
    [rows],
  );
  const hasMetricValue = rows.length > 0 && rows[0]?.value !== undefined;
  const valueOnly = toFiniteNumber(rows[0]?.value);
  const title = widget.title?.trim() ? widget.title.trim() : "未命名组件";
  const palette = resolvePalette(widget.colorScheme);
  const primaryColor = palette?.[0] || "var(--qtable-color-primary)";
  const display = widget.config?.display;
  const chartRenderRevision = useMemo(
    () => dashboardChartRenderRevision(widget.type, displayRows, palette, display),
    [display, displayRows, palette, widget.type],
  );
  const chartSpec = useMemo(
    () => ({
      ...buildChartSpec(widget.type, title, displayRows, palette, display),
      // Dashboard data may refresh from subscription/manual refresh in rapid
      // succession. Keeping VChart animation timelines disabled avoids stale
      // animation state while preserving the exact server-backed data result.
      animation: false,
    }),
    [display, displayRows, palette, title, widget.type],
  );

  if (widget.type === "progress") {
    const targetValue = Number(widget.config?.targetValue) || 0;
    const currentValue = valueOnly;
    const percentage = targetValue > 0 ? Math.round((currentValue / targetValue) * 100) : 0;
    const clampedPct = Math.min(Math.max(percentage, 0), 100);
    const complete = targetValue > 0 && currentValue >= targetValue;

    return (
      <div
        role="img"
        aria-label={`${title}：${targetValue > 0 ? `${clampedPct}%` : "未配置目标值"}`}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
          padding: "0 8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 34, color: "var(--qtable-color-text)", lineHeight: 1.1 }}>
            {targetValue > 0 ? `${clampedPct}%` : "—"}
          </strong>
          <Tag color={complete ? "success" : "blue"}>{complete ? "已达成" : "进行中"}</Tag>
        </div>
        <div
          style={{
            height: 12,
            background: "var(--qtable-color-background-layout)",
            borderRadius: "var(--qtable-radius-pill)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${clampedPct}%`,
              background: primaryColor,
              borderRadius: "var(--qtable-radius-pill)",
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div style={{ color: "var(--qtable-color-text-secondary)", fontSize: "var(--qtable-font-size-label)" }}>
          当前 {formatDisplayNumber(currentValue, display)} / 目标 {targetValue > 0 ? formatDisplayNumber(targetValue, display) : "未配置"}
        </div>
      </div>
    );
  }

  if (widget.type === "metric") {
    return (
      <div
        role="status"
        aria-label={`${title}：${hasMetricValue ? formatDisplayNumber(valueOnly, display) : "暂无数据"}`}
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "var(--qtable-color-text)",
              lineHeight: 1.15,
            }}
          >
            {hasMetricValue ? formatDisplayNumber(valueOnly, display) : "—"}
          </div>
          <div
            style={{
              marginTop: 6,
              color: "var(--qtable-color-text-secondary)",
              fontSize: "var(--qtable-font-size-label)",
            }}
          >
            {aggregationLabel(data?.metric?.aggregation)} · 实时聚合
          </div>
        </div>
        <Tag variant="filled">KPI</Tag>
      </div>
    );
  }

  if (widget.type === "table") {
    return (
      <div style={{ height: "100%", overflow: "auto", userSelect: "text" }}>
        <div
          style={{
            marginBottom: 6,
            color: "var(--qtable-color-text-secondary)",
            fontSize: "var(--qtable-font-size-micro)",
          }}
        >
          当前结果 {displayRows.length} 行
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", borderBottom: "1px solid var(--qtable-color-border)", padding: "6px 4px" }}>
                维度
              </th>
              <th scope="col" style={{ textAlign: "right", borderBottom: "1px solid var(--qtable-color-border)", padding: "6px 4px" }}>
                {aggregationLabel(data?.metric?.aggregation)}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => {
              const fullDimension = String(row.dimension ?? "—");
              return (
                <tr key={`${fullDimension}:${index}`}>
                  <td
                    title={fullDimension}
                    style={{
                      padding: "6px 4px",
                      borderBottom: "1px solid var(--qtable-color-border)",
                      maxWidth: 220,
                    }}
                  >
                    {truncateDashboardLabel(fullDimension, 36)}
                  </td>
                  <td style={{ padding: "6px 4px", borderBottom: "1px solid var(--qtable-color-border)", textAlign: "right" }}>
                    {formatDisplayNumber(row.value, display)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${title} 图表，共 ${displayRows.length} 个数据点`}
      style={{ height: "100%", width: "100%" }}
    >
      <VChart
        key={`${widget.id}:${chartRenderRevision}`}
        spec={chartSpec}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}

/** 小组件内容区的加载骨架屏 */
export function WidgetContentSkeleton({ type }: { type: string }) {
  if (type === "progress") {
    return (
      <>
        <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: "42%", height: 12, marginBottom: 16 }} />
        <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: "28%", height: 36, marginBottom: 16 }} />
        <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: "100%", height: 14, marginBottom: 10 }} />
        <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: "32%", height: 12 }} />
      </>
    );
  }

  if (type === "metric") {
    return (
      <>
        <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: "64%", height: 44 }} />
        <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: "28%", height: 12 }} />
      </>
    );
  }

  if (type === "pie") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="qtable-skeleton" style={{ width: 180, height: 180, borderRadius: 999 }} />
      </div>
    );
  }

  if (type === "table") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} style={{ display: "flex", gap: 10, height: 12 }}>
            <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: `${22 + (index % 3) * 8}%` }} />
            <div className="qtable-skeleton qtable-skeleton-rounded" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "horizontalBar") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="qtable-skeleton qtable-skeleton-rounded" style={{ width: 54, height: 10 }} />
            <div className="qtable-skeleton qtable-skeleton-rounded" style={{ height: 12, width: `${30 + ((index * 19) % 60)}%` }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 10 }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="qtable-skeleton qtable-skeleton-rounded"
          style={{ flex: 1, height: `${28 + ((index * 23) % 66)}%` }}
        />
      ))}
    </div>
  );
}
