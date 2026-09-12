import { useMemo } from "react";
import { VChart } from "@visactor/react-vchart";
import { Tag } from "antd";
import { useLanguage } from "../../lib/useLanguage";
import type { DashboardWidget, WidgetDataPayload } from "./types";
import { dashboardChartRenderRevision } from "./chartRenderModel";
import { dashboardT } from "./dashboardI18n";
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
    count: dashboardT("aggregation.count"),
    sum: dashboardT("aggregation.sum"),
    avg: dashboardT("aggregation.avg"),
    max: dashboardT("aggregation.max"),
    min: dashboardT("aggregation.min"),
  };
  return labels[value || "count"] || String(value || dashboardT("aggregation.count")).toUpperCase();
}

export function WidgetContent({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data?: WidgetDataPayload;
}) {
  useLanguage();
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
  const title = widget.title?.trim() ? widget.title.trim() : dashboardT("widget.unnamed");
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
        aria-label={`${title}：${targetValue > 0 ? `${clampedPct}%` : dashboardT("content.noTarget")}`}
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
          <Tag color={complete ? "success" : "blue"}>
            {complete ? dashboardT("content.achieved") : dashboardT("content.inProgress")}
          </Tag>
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
          {dashboardT("content.currentTarget", {
            current: formatDisplayNumber(currentValue, display),
            target:
              targetValue > 0
                ? formatDisplayNumber(targetValue, display)
                : dashboardT("content.notConfigured"),
          })}
        </div>
      </div>
    );
  }

  if (widget.type === "metric") {
    return (
      <div
        role="status"
        aria-label={`${title}：${hasMetricValue ? formatDisplayNumber(valueOnly, display) : dashboardT("content.noData")}`}
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
            {dashboardT("content.realtimeAggregation", {
              aggregation: aggregationLabel(data?.metric?.aggregation),
            })}
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
          {dashboardT("content.resultRows", { count: displayRows.length })}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", borderBottom: "1px solid var(--qtable-color-border)", padding: "6px 4px" }}>
                {dashboardT("content.dimension")}
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
      aria-label={dashboardT("content.chartAria", { title, count: displayRows.length })}
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
