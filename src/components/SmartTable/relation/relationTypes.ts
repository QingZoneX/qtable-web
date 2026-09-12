import type { Field } from "../../../store/useSmartTableStore";

export type RelationProperty = {
  targetTableId?: string;
  displayFieldId?: string;
  multiple?: boolean;
};

export type RelationOption = {
  id: string;
  title: string;
};

export type RelationOptionsPayload = {
  targetTableId: string;
  displayFieldId?: string | null;
  multiple: boolean;
  total: number;
  hasMore: boolean;
  items: RelationOption[];
};

export type RelationLabelMap = Record<string, Record<string, string>>;

export const isRelationField = (field: Field | null | undefined) =>
  String(field?.type || "") === "relation";

export const getRelationProperty = (
  field: Field | null | undefined,
): RelationProperty =>
  ((field?.property || {}) as Field["property"] & RelationProperty) || {};

export const normalizeRelationIds = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];
  const result: string[] = [];
  const seen = new Set<string>();
  raw.forEach((item) => {
    if (typeof item !== "string") return;
    const id = item.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
};

export const relationValueFromIds = (ids: string[], multiple: boolean) =>
  multiple ? ids : ids[0] ?? null;
