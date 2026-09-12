import type { Field } from "../../../store/useSmartTableStore";

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

export const compareSmartValues = (
  valueA: unknown,
  valueB: unknown,
  field?: Field,
): number => {
  if (valueA === valueB) return 0;
  if (isEmpty(valueA)) return 1;
  if (isEmpty(valueB)) return -1;

  const fieldType = String(field?.type || "text");
  if (
    fieldType === "number" ||
    fieldType === "progress" ||
    fieldType === "autoNumber" ||
    (fieldType === "formula" && typeof valueA === "number" && typeof valueB === "number")
  ) {
    const left = Number(valueA);
    const right = Number(valueB);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  }

  if (fieldType === "date") {
    const left = new Date(String(valueA)).getTime();
    const right = new Date(String(valueB)).getTime();
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  }

  if (typeof valueA === "boolean" && typeof valueB === "boolean") {
    return Number(valueA) - Number(valueB);
  }

  return String(valueA).localeCompare(String(valueB), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};
