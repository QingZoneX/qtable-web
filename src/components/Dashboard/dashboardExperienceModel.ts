export type RuntimeDashboardFilter = {
  tableId: string;
  fieldId: string;
  operator: string;
  value: unknown;
};

export function runtimeFiltersForWidget(
  filters: RuntimeDashboardFilter[],
  tableId: string | null | undefined,
) {
  if (!tableId) return [];
  return filters
    .filter((filter) => filter.tableId === tableId)
    .map(({ fieldId, operator, value }) => ({ fieldId, operator, value }));
}

export function normalizeDashboardFilterValue(
  fieldType: string,
  operator: string,
  value: unknown,
) {
  if (operator === "in") {
    if (Array.isArray(value)) return value.filter((part) => String(part).trim());
    return String(value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (["number", "progress", "rating", "autoNumber"].includes(fieldType)) {
    if (value === "" || value == null) return value;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : value;
  }
  return value;
}
