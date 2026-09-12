import { Input, InputNumber, Select } from "antd";
import type { WorkspaceMember } from "../../hooks/useWorkspaceAccess";
import { useLanguage } from "../../lib/useLanguage";
import { automationPageT } from "./automationPageI18n";
import type { AutomationField } from "./automationTypes";
import { isDateField, isMemberField, isNumericField } from "./automationUtils";

export type FieldValueInputProps = {
  field?: AutomationField;
  value: unknown;
  multiple?: boolean;
  members?: WorkspaceMember[];
  placeholder?: string;
  onChange: (value: unknown) => void;
};

export function FieldValueInput({
  field,
  value,
  multiple = false,
  members = [],
  placeholder,
  onChange,
}: FieldValueInputProps) {
  useLanguage();
  const resolvedPlaceholder = placeholder || automationPageT("input.value");

  if (isMemberField(field)) {
    const memberOptions = members.map((member) => ({
      label: member.name || member.email,
      value: member.userId,
    }));
    if (multiple) {
      const values = Array.isArray(value)
        ? value.map((item) => Number(item)).filter(Number.isFinite)
        : [];
      return (
        <Select
          mode="multiple"
          allowClear
          value={values}
          options={memberOptions}
          placeholder={automationPageT("input.selectMember")}
          onChange={onChange}
        />
      );
    }
    const numericValue = value === "" || value == null ? undefined : Number(value);
    return (
      <Select
        allowClear
        value={Number.isFinite(numericValue) ? numericValue : undefined}
        options={memberOptions}
        placeholder={automationPageT("input.selectMember")}
        onChange={onChange}
      />
    );
  }

  if (isNumericField(field)) {
    if (multiple) {
      const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return (
        <Input
          value={text}
          placeholder={automationPageT("input.multipleNumbers")}
          onChange={(event) => {
            const next = event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .map(Number)
              .filter(Number.isFinite);
            onChange(next);
          }}
        />
      );
    }
    return (
      <InputNumber
        value={typeof value === "number" ? value : value === "" || value == null ? null : Number(value)}
        placeholder={resolvedPlaceholder}
        onChange={onChange}
      />
    );
  }

  if (isDateField(field)) {
    if (multiple) {
      const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return (
        <Input
          value={text}
          placeholder={automationPageT("input.multipleDates")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      );
    }
    return (
      <Input
        type="datetime-local"
        value={typeof value === "string" ? value.slice(0, 16) : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (multiple) {
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return (
      <Input
        value={text}
        placeholder={automationPageT("input.multipleValues")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }

  return (
    <Input
      value={value == null ? "" : String(value)}
      placeholder={resolvedPlaceholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
