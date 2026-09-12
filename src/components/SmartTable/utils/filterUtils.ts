import type { Field, FilterCondition } from "../../../store/useSmartTableStore";
import { formatAutoNumber } from "./autoNumber";

export type FieldLookup = ReadonlyMap<string, Field>;

export const createFieldLookup = (fields: Field[]): FieldLookup =>
  new Map(fields.map((field) => [field.id, field]));

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const normalizeComparableValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (typeof value === "object") {
    const candidate = value as {
      label?: string;
      name?: string;
      title?: string;
      id?: string;
      userName?: string;
    };
    return String(
      candidate.label ||
        candidate.name ||
        candidate.userName ||
        candidate.title ||
        candidate.id ||
        "",
    );
  }
  return String(value);
};

const normalizeFieldValue = (value: unknown, field: Field): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFieldValue(item, field));
  }

  if (field.type === "select" || field.type === "multiSelect") {
    const primitive = normalizeComparableValue(value);
    const matchedOption = field.options?.find(
      (option) => option.id === primitive || option.label === primitive,
    );
    return matchedOption?.label ?? primitive;
  }

  if (field.type === "member") {
    return normalizeComparableValue(value);
  }

  if (field.type === "autoNumber") {
    return formatAutoNumber(field, value);
  }

  return value;
};

const equalsFilterValue = (value: unknown, filterValue: unknown) => {
  const expected = normalizeComparableValue(filterValue).toLowerCase();
  if (Array.isArray(value)) {
    return value.some(
      (item) => normalizeComparableValue(item).toLowerCase() === expected,
    );
  }
  return normalizeComparableValue(value).toLowerCase() === expected;
};

export const checkFilterWithLookup = (
  record: Record<string, unknown>,
  filter: FilterCondition,
  fieldLookup: FieldLookup,
) => {
  const field = fieldLookup.get(filter.fieldId);
  if (!field) return true;

  const displayValue = normalizeFieldValue(record[filter.fieldId], field);
  const displayFilterValue = filter.value;

  switch (filter.operator) {
    case "contains": {
      const expected = normalizeComparableValue(displayFilterValue).toLowerCase();
      if (Array.isArray(displayValue)) {
        return displayValue.some((item) =>
          normalizeComparableValue(item).toLowerCase().includes(expected),
        );
      }
      return normalizeComparableValue(displayValue)
        .toLowerCase()
        .includes(expected);
    }
    case "equals":
    case "is":
      return equalsFilterValue(displayValue, displayFilterValue);
    case "is_not":
      return !equalsFilterValue(displayValue, displayFilterValue);
    case "is_empty":
      return isEmptyValue(displayValue);
    case "is_not_empty":
      return !isEmptyValue(displayValue);
    case "gt":
      return Number(displayValue) > Number(displayFilterValue);
    case "lt":
      return Number(displayValue) < Number(displayFilterValue);
    case "gte":
      return Number(displayValue) >= Number(displayFilterValue);
    case "lte":
      return Number(displayValue) <= Number(displayFilterValue);
    case "before":
      return (
        new Date(String(displayValue ?? "")) <
        new Date(String(displayFilterValue ?? ""))
      );
    case "after":
      return (
        new Date(String(displayValue ?? "")) >
        new Date(String(displayFilterValue ?? ""))
      );
    default:
      return true;
  }
};

export const checkFilter = (
  record: Record<string, unknown>,
  filter: FilterCondition,
  fields: Field[],
) => checkFilterWithLookup(record, filter, createFieldLookup(fields));

/**
 * Evaluate a flat list of filter conditions from left to right.
 * The first condition is the WHERE clause; every later condition uses its
 * own connector (`and` / `or`). This keeps the persisted ViewConfig schema
 * backward compatible while making the existing `logic` field functional.
 */
export const matchesFiltersWithLookup = (
  record: Record<string, unknown>,
  filters: FilterCondition[],
  fieldLookup: FieldLookup,
) => {
  if (filters.length === 0) return true;

  let matched = checkFilterWithLookup(record, filters[0], fieldLookup);
  for (let index = 1; index < filters.length; index += 1) {
    const filter = filters[index];
    const current = checkFilterWithLookup(record, filter, fieldLookup);
    matched = filter.logic === "or" ? matched || current : matched && current;
  }
  return matched;
};

export const matchesFilters = (
  record: Record<string, unknown>,
  filters: FilterCondition[],
  fields: Field[],
) => matchesFiltersWithLookup(record, filters, createFieldLookup(fields));
