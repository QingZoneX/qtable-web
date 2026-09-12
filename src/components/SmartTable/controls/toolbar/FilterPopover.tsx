import React, { useState } from "react";
import { Popover, Button, Select, Input, Typography, DatePicker, Empty } from "antd";
import { FilterOutlined, DeleteOutlined } from "@ant-design/icons";
import { useSmartTableStore } from "../../../../store/useSmartTableStore";
import type { FilterCondition } from "../../../../store/useSmartTableStore";
import { t } from "../../../../lib/i18n";

const { Text } = Typography;

export function FilterPopover({ disabled }: { disabled?: boolean }) {
  const { filters, fields, setFilters } = useSmartTableStore();
  const [visible, setVisible] = useState(false);

  const handleAddFilter = () => {
    if (disabled || fields.length === 0) return;
    const firstField = fields[0];
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      fieldId: firstField.id,
      operator: getOperators(firstField.id)[0]?.value || "contains",
      value: "",
      logic: filters.length > 0 ? "and" : "where",
    };
    setFilters([...filters, newFilter]);
  };

  const handleRemoveFilter = (id: string) => {
    if (disabled) return;
    const nextFilters = filters.filter((f) => f.id !== id).map((filter, index) =>
      index === 0 ? { ...filter, logic: "where" as const } : filter,
    );
    setFilters(nextFilters);
  };

  const handleUpdateFilter = (
    id: string,
    updates: Partial<FilterCondition>,
  ) => {
    if (disabled) return;
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleClear = () => {
    if (disabled) return;
    setFilters([]);
  };

  function getOperators(fieldId: string) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return [];
    const fieldType = String(field.type);

    switch (fieldType) {
      case "text":
      case "url":
      case "email":
      case "phone":
      case "autoNumber":
        return [
          { label: t("filter.contains"), value: "contains" },
          { label: t("filter.equals"), value: "equals" },
          { label: t("filter.isEmpty"), value: "is_empty" },
          { label: t("filter.isNotEmpty"), value: "is_not_empty" },
        ];
      case "number":
      case "progress":
      case "rating":
        return [
          { label: "=", value: "equals" },
          { label: ">", value: "gt" },
          { label: "<", value: "lt" },
          { label: ">=", value: "gte" },
          { label: "<=", value: "lte" },
          { label: t("filter.isEmpty"), value: "is_empty" },
          { label: t("filter.isNotEmpty"), value: "is_not_empty" },
        ];
      case "formula":
        return [
          { label: t("filter.contains"), value: "contains" },
          { label: t("filter.equals"), value: "equals" },
          { label: ">", value: "gt" },
          { label: "<", value: "lt" },
          { label: ">=", value: "gte" },
          { label: "<=", value: "lte" },
          { label: t("filter.isEmpty"), value: "is_empty" },
          { label: t("filter.isNotEmpty"), value: "is_not_empty" },
        ];
      case "select":
      case "multiSelect":
      case "member":
        return [
          { label: t("filter.is"), value: "is" },
          { label: t("filter.isNot"), value: "is_not" },
          { label: t("filter.isEmpty"), value: "is_empty" },
          { label: t("filter.isNotEmpty"), value: "is_not_empty" },
        ];
      case "date":
        return [
          { label: t("filter.is"), value: "is" },
          { label: t("filter.before"), value: "before" },
          { label: t("filter.after"), value: "after" },
          { label: t("filter.isEmpty"), value: "is_empty" },
          { label: t("filter.isNotEmpty"), value: "is_not_empty" },
        ];
      default:
        return [
          { label: t("filter.contains"), value: "contains" },
          { label: t("filter.isEmpty"), value: "is_empty" },
          { label: t("filter.isNotEmpty"), value: "is_not_empty" },
        ];
    }
  }

  const renderValueInput = (filter: FilterCondition) => {
    const field = fields.find((f) => f.id === filter.fieldId);
    if (!field) return null;

    if (["is_empty", "is_not_empty"].includes(filter.operator)) return null;

    if (field.type === "select" || field.type === "multiSelect") {
      const selectValue =
        typeof filter.value === "string" ? filter.value : undefined;
      return (
        <Select
          size="small"
          style={{ width: 118 }}
          value={selectValue}
          disabled={disabled}
          placeholder={t("common.selectPlaceholder")}
          onChange={(val: string) =>
            handleUpdateFilter(filter.id, { value: val })
          }
          options={field.options?.map((opt) => ({
            label: opt.label,
            value: opt.label,
          }))}
          popupMatchSelectWidth={false}
          allowClear
        />
      );
    }

    if (field.type === "date") {
      return (
        <DatePicker
          size="small"
          style={{ width: 118 }}
          disabled={disabled}
          onChange={(_date: unknown, dateString: string | null) =>
            handleUpdateFilter(filter.id, { value: dateString || "" })
          }
        />
      );
    }

    return (
      <Input
        size="small"
        style={{ width: 118 }}
        value={filter.value == null ? "" : String(filter.value)}
        disabled={disabled}
        placeholder={t("common.inputPlaceholder")}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          handleUpdateFilter(filter.id, { value: e.target.value })
        }
      />
    );
  };

  const content = (
    <div style={{ width: 470 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {t("filter.filters")}
          </Text>
          <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
            条件按从上到下顺序计算，可组合 AND / OR
          </Text>
        </div>
        <Button
          type="link"
          size="small"
          onClick={handleClear}
          disabled={disabled || filters.length === 0}
          style={{ fontSize: 12, padding: 0, height: 20 }}
        >
          {t("filter.clear")}
        </Button>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {filters.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无筛选条件"
            styles={{ image: { height: 32 } }}
          />
        ) : (
          filters.map((filter, index) => (
            <div
              key={filter.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                padding: "6px 6px",
                background: "#fafafa",
                border: "1px solid #f0f0f0",
                borderRadius: 6,
              }}
            >
              {index === 0 ? (
                <span
                  style={{
                    width: 58,
                    textAlign: "center",
                    color: "#8c8c8c",
                    fontSize: 12,
                  }}
                >
                  {t("filter.where")}
                </span>
              ) : (
                <Select
                  size="small"
                  style={{ width: 58 }}
                  value={filter.logic === "or" ? "or" : "and"}
                  disabled={disabled}
                  onChange={(logic: "and" | "or") =>
                    handleUpdateFilter(filter.id, { logic })
                  }
                  options={[
                    { label: "AND", value: "and" },
                    { label: "OR", value: "or" },
                  ]}
                  popupMatchSelectWidth={false}
                />
              )}

              <Select
                size="small"
                style={{ width: 120 }}
                value={filter.fieldId}
                disabled={disabled}
                showSearch
                optionFilterProp="label"
                onChange={(val: string) =>
                  handleUpdateFilter(filter.id, {
                    fieldId: val,
                    operator: getOperators(val)[0]?.value || "contains",
                    value: "",
                  })
                }
                options={fields.map((f) => ({ label: f.name, value: f.id }))}
                popupMatchSelectWidth={false}
              />

              <Select
                size="small"
                style={{ width: 100 }}
                value={filter.operator}
                disabled={disabled}
                onChange={(val: string) =>
                  handleUpdateFilter(filter.id, {
                    operator: val,
                    value: ["is_empty", "is_not_empty"].includes(val)
                      ? ""
                      : filter.value,
                  })
                }
                options={getOperators(filter.fieldId)}
                popupMatchSelectWidth={false}
              />

              <div style={{ flex: 1 }}>{renderValueInput(filter)}</div>

              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                disabled={disabled}
                onClick={() => handleRemoveFilter(filter.id)}
                style={{ padding: "0 4px", height: 24, minWidth: 24 }}
              />
            </div>
          ))
        )}
      </div>

      <Button
        type="dashed"
        block
        size="small"
        onClick={handleAddFilter}
        icon={<FilterOutlined />}
        disabled={disabled || fields.length === 0}
        style={{ fontSize: 12, height: 30, marginTop: filters.length ? 4 : 8 }}
      >
        {t("filter.addFilter")}
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      open={Boolean(!disabled && visible)}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
        setVisible(nextOpen);
      }}
    >
      <Button
        type={filters.length > 0 ? "primary" : "text"}
        size="small"
        icon={<FilterOutlined />}
        disabled={disabled}
        style={{ fontSize: 12, height: 28 }}
      >
        {t("toolbar.filter")} {filters.length > 0 && `(${filters.length})`}
      </Button>
    </Popover>
  );
}
