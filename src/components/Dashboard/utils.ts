import type { ISpec } from "@visactor/vchart";
import { createXlsxBuffer } from "../../lib/xlsxExport";
import type {
  DashboardWidgetType,
  WidgetDisplayConfig,
  WidgetLayout,
  WorkspaceNode,
} from "./types";
import { MIN_H, MIN_W, PALETTES } from "./constants";

/** 解析配色方案为颜色数组 */
export function resolvePalette(colorScheme: unknown): string[] | null {
  if (!colorScheme) return null;
  if (typeof colorScheme === "string") {
    return PALETTES.find((p) => p.id === colorScheme)?.colors ?? null;
  }
  if (typeof colorScheme === "object") {
    const paletteId = (colorScheme as { paletteId?: unknown }).paletteId;
    if (typeof paletteId === "string") {
      return PALETTES.find((p) => p.id === paletteId)?.colors ?? null;
    }
  }
  return null;
}

/** 遍历工作区树节点，提取所有 table 节点 */
export function walkTables(root: WorkspaceNode | null | undefined): { id: string; name: string }[] {
  if (!root) return [];
  const out: { id: string; name: string }[] = [];
  const stack: WorkspaceNode[] = [...(root.children || [])];
  while (stack.length) {
    const node = stack.shift();
    if (!node) continue;
    if (node.type === "table") out.push({ id: node.id, name: node.name });
    if (node.children) stack.push(...node.children);
  }
  return out;
}

/** 触发浏览器下载 */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 将数据行导出为 XLSX */
export function exportRowsToXlsx(filename: string, rows: Record<string, unknown>[]) {
  const buf = createXlsxBuffer(rows);
  downloadBlob(
    filename,
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

/** 限幅函数 */
export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

/** 安全转换为有限数字 */
export function toFiniteNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "bigint") return Number(v);
  return 0;
}

export function formatDisplayNumber(value: unknown, display?: WidgetDisplayConfig) {
  const numeric = toFiniteNumber(value);
  const decimals = clamp(Math.round(Number(display?.decimals ?? 0)), 0, 6);
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numeric);
  return `${display?.prefix || ""}${formatted}${display?.suffix || ""}`;
}

export function truncateDashboardLabel(value: unknown, maxLength = 24) {
  const label = String(value ?? "—");
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

/** 标准化布局（兜底 & 限幅） */
export function normalizeLayout(
  layout: Partial<WidgetLayout> | null | undefined,
  cols: number,
): WidgetLayout {
  const w = clamp(Math.round(Number(layout?.w ?? 6)), Math.min(MIN_W, cols), cols);
  const x = clamp(Math.round(Number(layout?.x ?? 0)), 0, Math.max(0, cols - w));
  return {
    x,
    y: clamp(Math.round(Number(layout?.y ?? 0)), 0, 999),
    w,
    h: clamp(Math.round(Number(layout?.h ?? 10)), MIN_H, 100),
  };
}

/** 按列数等比例缩放布局 */
export function scaleLayout(base: WidgetLayout, cols: number): WidgetLayout {
  if (cols === 12) return normalizeLayout(base, 12);
  const ratio = cols / 12;
  const w = clamp(Math.round(base.w * ratio), Math.min(MIN_W, cols), cols);
  const x = clamp(Math.round(base.x * ratio), 0, Math.max(0, cols - w));
  return { x, y: base.y, w, h: base.h };
}

/**
 * 构建统一 VChart 图表配置：tooltip 始终可用，legend / label 由 display
 * 控制，长维度标签在轴上截断但原值保留在 fullDimension 中供 tooltip 使用。
 */
export function buildChartSpec(
  type: DashboardWidgetType,
  title: string,
  rows: { dimension?: unknown; value?: unknown }[],
  palette: string[] | null,
  display?: WidgetDisplayConfig,
): ISpec {
  const values = rows.map((row) => {
    const fullDimension = String(row.dimension ?? "—");
    return {
      dimension: truncateDashboardLabel(fullDimension),
      fullDimension,
      value: toFiniteNumber(row.value),
    };
  });
  const color = palette?.length ? palette : undefined;
  const primaryColor = palette?.[0];
  const showLabels = display?.showLabels ?? (type === "bar" || type === "horizontalBar");
  const showLegend = display?.showLegend ?? type === "pie";
  const common = {
    autoFit: true,
    data: [{ values }],
    title: { visible: false, text: title },
    color,
    tooltip: { visible: true },
  };

  if (type === "pie") {
    return {
      ...common,
      type: "pie" as const,
      valueField: "value",
      categoryField: "dimension",
      outerRadius: 0.82,
      legends: { visible: showLegend, orient: "left" as const },
      label: { visible: showLabels },
    } as unknown as ISpec;
  }
  if (type === "line") {
    return {
      ...common,
      type: "line" as const,
      xField: "dimension",
      yField: "value",
      legends: { visible: showLegend },
      label: { visible: showLabels },
      line: primaryColor ? { style: { stroke: primaryColor } } : undefined,
      point: primaryColor
        ? { visible: true, style: { fill: primaryColor } }
        : { visible: true },
      axes: [{ orient: "bottom", label: { autoRotate: true, autoLimit: true } }],
    } as unknown as ISpec;
  }
  if (type === "horizontalBar") {
    return {
      ...common,
      type: "bar" as const,
      direction: "horizontal",
      xField: "value",
      yField: "dimension",
      legends: { visible: showLegend },
      label: { visible: showLabels },
      bar: primaryColor
        ? { style: { fill: primaryColor, fillOpacity: 1 } }
        : { style: { fillOpacity: 1 } },
      axes: [{ orient: "left", label: { autoLimit: true } }],
    } as unknown as ISpec;
  }
  return {
    ...common,
    type: "bar" as const,
    xField: "dimension",
    yField: "value",
    legends: { visible: showLegend },
    label: { visible: showLabels },
    bar: primaryColor
      ? { style: { fill: primaryColor, fillOpacity: 1 } }
      : { style: { fillOpacity: 1 } },
    axes: [{ orient: "bottom", label: { autoRotate: true, autoLimit: true } }],
  } as unknown as ISpec;
}
