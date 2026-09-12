import type { Field } from "../../../store/useSmartTableStore";

export type AutoNumberProperty = {
  prefix?: string;
  digits?: number;
  start?: number;
  nextNumber?: number;
};

export const getAutoNumberProperty = (
  field?: Field | null,
): Required<Pick<AutoNumberProperty, "prefix" | "digits" | "start">> &
  Pick<AutoNumberProperty, "nextNumber"> => {
  const property = (field?.property || {}) as Field["property"] &
    AutoNumberProperty;
  const digits = Number(property.digits);
  const start = Number(property.start);
  const nextNumber = Number(property.nextNumber);
  return {
    prefix: typeof property.prefix === "string" ? property.prefix : "",
    digits:
      Number.isInteger(digits) && digits >= 1 && digits <= 12 ? digits : 3,
    start: Number.isInteger(start) && start >= 1 ? start : 1,
    nextNumber:
      Number.isInteger(nextNumber) && nextNumber >= 1
        ? nextNumber
        : undefined,
  };
};

export const formatAutoNumber = (
  field: Field | null | undefined,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === "") return "";
  const property = getAutoNumberProperty(field);
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${property.prefix}${String(Math.trunc(number)).padStart(
    property.digits,
    "0",
  )}`;
};
