export type WorkspaceNode = {
  id: string;
  name: string;
  type?: string;
  children?: WorkspaceNode[];
};

export type RecycleBinEntry = {
  recycleId: string;
  tableId: string;
  recordId: string;
  data: Record<string, unknown>;
  orderIndex?: number | null;
  createdByUserId?: number | null;
  recordVersion?: number | null;
  deletedByUserId?: number | null;
  deletedAt?: string | null;
  changeSetId?: string | null;
};

export type RecycleField = {
  id: string;
  name: string;
};

export type SnapshotEntry = {
  fieldId: string;
  label: string;
  value: string;
};

export const collectWorkspaceTables = (root?: WorkspaceNode | null): WorkspaceNode[] => {
  if (!root) return [];
  if (root.type === "table") return [root];
  return (root.children || []).flatMap((child) => collectWorkspaceTables(child));
};

export const formatSnapshotValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((item) => formatSnapshotValue(item))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const candidate = value as {
      label?: unknown;
      name?: unknown;
      title?: unknown;
      id?: unknown;
    };
    for (const key of ["label", "name", "title", "id"] as const) {
      const picked = candidate[key];
      if (picked !== null && picked !== undefined && picked !== "") {
        return String(picked);
      }
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export const buildSnapshotEntries = (
  entry: RecycleBinEntry,
  fields: RecycleField[],
): SnapshotEntry[] => {
  const fieldMap = new Map(fields.map((field) => [field.id, field.name]));
  const fieldOrder = new Map(fields.map((field, index) => [field.id, index]));
  return Object.entries(entry.data || {})
    .map(([fieldId, raw]) => ({
      fieldId,
      label: fieldMap.get(fieldId) || `已删除字段 ${fieldId}`,
      value: formatSnapshotValue(raw),
      order: fieldOrder.get(fieldId) ?? Number.MAX_SAFE_INTEGER,
    }))
    .filter((item) => item.value !== "")
    .sort((left, right) => left.order - right.order || left.fieldId.localeCompare(right.fieldId))
    .map(({ fieldId, label, value }) => ({ fieldId, label, value }));
};

export const recycleEntryMatchesSearch = (
  entry: RecycleBinEntry,
  fields: RecycleField[],
  query: string,
): boolean => {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return true;
  const snapshot = buildSnapshotEntries(entry, fields);
  const haystack = [
    entry.recordId,
    entry.recycleId,
    ...snapshot.flatMap((item) => [item.fieldId, item.label, item.value]),
  ]
    .join("\n")
    .toLocaleLowerCase();
  return haystack.includes(keyword);
};

export const isRecyclePermissionError = (message: string): boolean => {
  const text = message.toLocaleLowerCase();
  return (
    text.includes("permission") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("manage") ||
    text.includes("no access")
  );
};
