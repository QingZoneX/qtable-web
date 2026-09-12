import type { Field } from "../../../store/useSmartTableStore";

/**
 * Format a number value based on field configuration
 * Supports both new format (precision, thousandsSeparator, prefix, suffix)
 * and legacy format (unit, currency) for backward compatibility
 */
export const formatNumberValue = (
  value: unknown,
  field: Field
): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  // New formatting options
  const precision = field.property?.precision ?? 2;
  const useThousandsSeparator = field.property?.thousandsSeparator ?? true;
  const prefixText = field.property?.prefix || field.property?.currency || "";
  const suffixText = field.property?.suffix || field.property?.unit || "";

  // Format the number
  const formattedNumber = useThousandsSeparator
    ? numericValue.toLocaleString("en-US", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })
    : numericValue.toFixed(precision);

  return `${prefixText}${formattedNumber}${suffixText}`;
};
