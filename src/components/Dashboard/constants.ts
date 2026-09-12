/** 响应式网格列数断点 */
export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;

/** 响应式网格像素断点 */
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;

/** 网格行高 */
export const GRID_ROW_HEIGHT = 26;

/** 最小宽度（网格单位） */
export const MIN_W = 2;

/** 最小高度（网格单位） */
export const MIN_H = 4;

/** 配色方案列表 */
export const PALETTES: { id: string; name: string; colors: string[] | null }[] = [
  { id: "default", name: "默认", colors: null },
  { id: "blue", name: "蓝色", colors: ["#2563EB", "#60A5FA", "#93C5FD", "#1D4ED8", "#0EA5E9"] },
  { id: "green", name: "绿色", colors: ["#16A34A", "#4ADE80", "#86EFAC", "#15803D", "#22C55E"] },
  { id: "warm", name: "暖色", colors: ["#F97316", "#FB7185", "#F59E0B", "#EF4444", "#EAB308"] },
  { id: "mono", name: "灰度", colors: ["#111827", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB"] },
];
