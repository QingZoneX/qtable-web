import type {
  DashboardWidgetType,
  WidgetDisplayConfig,
} from "./types";

type DashboardChartRow = {
  dimension?: unknown;
  value?: unknown;
};

function stableUnknown(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(stableUnknown);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableUnknown(item)]),
    );
  }
  return String(value);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * React-VChart 2.0.x updates an existing chart through updateSpec. Dashboard
 * widgets can move from an empty/loading payload to real data, or between
 * chart types, and those transitions have historically left cartesian marks
 * stale even when axes/tooltips already reflect the new rows.
 *
 * This revision deliberately changes whenever a render-relevant chart input
 * changes so the React key recreates a complete chart instance instead of
 * relying on a stale mark update path.
 */
export function dashboardChartRenderRevision(
  type: DashboardWidgetType,
  rows: DashboardChartRow[],
  palette: string[] | null,
  display?: WidgetDisplayConfig,
): string {
  const payload = JSON.stringify({
    type,
    rows: rows.map((row) => [stableUnknown(row.dimension), stableUnknown(row.value)]),
    palette: palette ?? null,
    display: {
      showLegend: display?.showLegend ?? null,
      showLabels: display?.showLabels ?? null,
      decimals: display?.decimals ?? null,
      prefix: display?.prefix ?? null,
      suffix: display?.suffix ?? null,
    },
  });
  return `${type}:${fnv1a32(payload)}`;
}
