import { useMemo } from "react";
import type {
  Field,
  FilterCondition,
  SortCondition,
  GroupConfig,
  TableRecord,
} from "../../../store/useSmartTableStore";
import {
  createFieldLookup,
  matchesFiltersWithLookup,
} from "../utils/filterUtils";
import { compareSmartValues } from "../utils/sortUtils";
import { formatAutoNumber } from "../utils/autoNumber";

const DateCategory = {
  EXPIRED: "Expired",
  TODAY: "Today",
  TOMORROW: "Tomorrow",
  NEXT_SEVEN_DAYS: "Next 7 Days",
  LATER: "Later",
  UNSCHEDULED: "Uncategorized",
} as const;

const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const classifyDate = (date: Date): string => {
  const today = getTodayStart();
  if (isNaN(date.getTime())) return DateCategory.UNSCHEDULED;

  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  if (dateStart < today) return DateCategory.EXPIRED;
  if (dateStart.getTime() === today.getTime()) return DateCategory.TODAY;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStart.getTime() === tomorrow.getTime()) return DateCategory.TOMORROW;

  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  if (dateStart > tomorrow && dateStart <= sevenDaysLater) {
    return DateCategory.NEXT_SEVEN_DAYS;
  }
  return DateCategory.LATER;
};

const normalizeSelectValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const candidate = value as {
      label?: string;
      name?: string;
      title?: string;
      id?: string;
    };
    const label = candidate.label || candidate.name || candidate.title || candidate.id;
    return label ? String(label) : null;
  }
  return null;
};

const toDateIfValid = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const next = new Date(value);
    return isNaN(next.getTime()) ? null : next;
  }
  return null;
};

const getFieldGroupingKey = (value: unknown, fieldType?: string): string => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "UNDEFINED"
  ) {
    return "Uncategorized";
  }

  if (fieldType === "date") {
    const date = toDateIfValid(value);
    return date ? classifyDate(date) : DateCategory.UNSCHEDULED;
  }

  if (fieldType === "member") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "Uncategorized";
      const sorted = [...value].sort((a, b) => {
        const nameA =
          typeof a === "object" && a !== null
            ? (a as { name?: string; userName?: string }).name ||
              (a as { name?: string; userName?: string }).userName ||
              ""
            : String(a);
        const nameB =
          typeof b === "object" && b !== null
            ? (b as { name?: string; userName?: string }).name ||
              (b as { name?: string; userName?: string }).userName ||
              ""
            : String(b);
        return nameA.localeCompare(nameB);
      });
      return sorted
        .map((item) =>
          typeof item === "object" && item !== null
            ? (item as { name?: string; userName?: string }).name ||
              (item as { name?: string; userName?: string }).userName ||
              ""
            : String(item),
        )
        .join(", ");
    }
    if (typeof value === "object") {
      const candidate = value as {
        name?: string;
        userName?: string;
        title?: string;
      };
      const name = candidate.name || candidate.userName || candidate.title || "";
      return name ? String(name) : "Uncategorized";
    }
    return String(value);
  }

  if (fieldType === "select" || fieldType === "multiSelect") {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => normalizeSelectValue(item))
        .filter((item): item is string => Boolean(item))
        .sort();
      if (normalized.length === 0) return "Uncategorized";
      return normalized.join(", ");
    }
    return normalizeSelectValue(value) ?? "Uncategorized";
  }

  return String(value);
};

const getFieldSortKey = (
  value: unknown,
  fieldType?: string,
  options?: string[],
): string | number => {
  if (value === null || value === undefined) return "999999";

  if (fieldType === "date") {
    const date = toDateIfValid(value);
    if (!date) return 999999;

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const today = getTodayStart();
    if (dateStart < today) return 0;
    if (dateStart.getTime() === today.getTime()) return 1;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStart.getTime() === tomorrow.getTime()) return 2;

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    if (dateStart > tomorrow && dateStart <= sevenDaysLater) return 3;
    return 4;
  }

  if (fieldType === "member") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "zzzzzz";
      const sorted = [...value].sort((a, b) => {
        const nameA =
          typeof a === "object" && a !== null
            ? (a as { name?: string; userName?: string }).name ||
              (a as { name?: string; userName?: string }).userName ||
              ""
            : String(a);
        const nameB =
          typeof b === "object" && b !== null
            ? (b as { name?: string; userName?: string }).name ||
              (b as { name?: string; userName?: string }).userName ||
              ""
            : String(b);
        return nameA.localeCompare(nameB);
      });
      return sorted
        .map((item) =>
          typeof item === "object" && item !== null
            ? (item as { name?: string; userName?: string }).name ||
              (item as { name?: string; userName?: string }).userName ||
              ""
            : String(item),
        )
        .join(", ");
    }
    return String(value);
  }

  if (fieldType === "select" || fieldType === "multiSelect") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "zzzzzz";
      return value
        .map((item) => {
          const normalized = normalizeSelectValue(item);
          if (!normalized) return "zzzzzz";
          const index = options?.indexOf(normalized) ?? -1;
          return index === -1 ? "zzzzzz" : String(index).padStart(6, "0");
        })
        .sort()
        .join(",");
    }
    const normalized = normalizeSelectValue(value);
    if (!normalized) return "zzzzzz";
    const index = options?.indexOf(normalized) ?? -1;
    return index === -1 ? "zzzzzz" : String(index).padStart(6, "0");
  }

  if (
    fieldType === "number" ||
    fieldType === "progress" ||
    fieldType === "autoNumber" ||
    (fieldType === "formula" && typeof value === "number")
  ) {
    return Number(value);
  }

  return String(value);
};

export const useTableRecords = (
  records: TableRecord[],
  fields: Field[],
  filters: FilterCondition[],
  sorts: SortCondition[],
  groupConfig: GroupConfig,
): TableRecord[] => {
  const fieldLookup = useMemo(() => createFieldLookup(fields), [fields]);

  const filteredRecords = useMemo(() => {
    if (filters.length === 0) return records;
    return records.filter((record) =>
      matchesFiltersWithLookup(record, filters, fieldLookup),
    );
  }, [records, filters, fieldLookup]);

  const processedRecords = useMemo(() => {
    if (sorts.length === 0) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      for (const sort of sorts) {
        const field = fieldLookup.get(sort.fieldId);
        let comparison = compareSmartValues(a[sort.fieldId], b[sort.fieldId], field);
        if (sort.order === "desc") comparison = -comparison;
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  }, [filteredRecords, sorts, fieldLookup]);

  const groupedRecords = useMemo(() => {
    if (!groupConfig.fieldId) return processedRecords;

    const groupField = fieldLookup.get(groupConfig.fieldId);
    const options = groupField?.options?.map((option) => option.id) || [];
    const fieldType = groupField ? String(groupField.type) : undefined;

    const decorated = processedRecords.map((record, index) => {
      const value = record[groupConfig.fieldId!];
      return {
        record,
        index,
        sortKey: getFieldSortKey(value, fieldType, options),
        displayTitle:
          fieldType === "autoNumber"
            ? formatAutoNumber(groupField, value)
            : getFieldGroupingKey(value, fieldType),
      };
    });

    const compareGroupKeys = (
      left: string | number,
      right: string | number,
    ) => {
      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }
      return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    };

    const uniqueGroups = new Map<
      string,
      { token: string; sortKey: string | number; displayTitle: string }
    >();
    decorated.forEach(({ sortKey, displayTitle }) => {
      const token = `${typeof sortKey}:${String(sortKey)}###${displayTitle}`;
      if (!uniqueGroups.has(token)) {
        uniqueGroups.set(token, { token, sortKey, displayTitle });
      }
    });

    const orderedGroups = [...uniqueGroups.values()].sort((a, b) => {
      const comparison = compareGroupKeys(a.sortKey, b.sortKey);
      return groupConfig.order === "desc" ? -comparison : comparison;
    });
    const groupRank = new Map(
      orderedGroups.map((group, index) => [group.token, index]),
    );

    return decorated
      .sort((a, b) => {
        const aToken = `${typeof a.sortKey}:${String(a.sortKey)}###${a.displayTitle}`;
        const bToken = `${typeof b.sortKey}:${String(b.sortKey)}###${b.displayTitle}`;
        const rankDifference =
          (groupRank.get(aToken) ?? 0) - (groupRank.get(bToken) ?? 0);
        return rankDifference || a.index - b.index;
      })
      .map(({ record, sortKey, displayTitle }) => {
        const token = `${typeof sortKey}:${String(sortKey)}###${displayTitle}`;
        const rank = groupRank.get(token) ?? 0;
        return {
          ...record,
          __group_key__: `${String(rank).padStart(9, "0")}###${displayTitle}`,
          __group_title__: displayTitle,
        };
      });
  }, [processedRecords, groupConfig, fieldLookup]);

  return groupedRecords;
};
