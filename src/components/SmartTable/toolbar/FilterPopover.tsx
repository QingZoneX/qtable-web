import React, { useState } from "react";
import { Popover, Button, Select, Input, Typography, DatePicker } from "antd";
import { FilterOutlined, DeleteOutlined } from "@ant-design/icons";
import { useSmartTableStore } from "../../../store/useSmartTableStore";
import { CLEAR_FILTERS } from "../../../lib/graphql";
import { client } from "../../../lib/apollo";
import type { FilterCondition } from "../../../store/useSmartTableStore";

const { Text } = Typography;

export function FilterPopover() {
  const { filters, fields, setFilters } = useSmartTableStore();
  const [visible, setVisible] = useState(false);

  const handleAddFilter = () => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      fieldId: fields[0].id,
      operator: "contains",
      value: "",
      logic: filters.length > 0 ? "and" : "where",
    };
    setFilters([...filters, newFilter]);
  };

  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const handleUpdateFilter = (
    id: string,
    updates: Partial<FilterCondition>,
  ) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleClear = () => {
    client
      .mutate({
        mutation: CLEAR_FILTERS,
      })
      .catch(() => {});
    setFilters([]);
  };

  const getOperators = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return [];

    switch (field.type) {
      case "text":
        return [
          { label: "Contains", value: "contains" },
          { label: "Equals", value: "equals" },
          { label: "Is Empty", value: "is_empty" },
          { label: "Is Not Empty", value: "is_not_empty" },
        ];
      case "number":
      case "progress":
        return [
          { label: "=", value: "equals" },
          { label: ">", value: "gt" },
          { label: "<", value: "lt" },
          { label: ">=", value: "gte" },
          { label: "<=", value: "lte" },
        ];
      case "select":
      case "member":
        return [
          { label: "Is", value: "is" },
          { label: "Is Not", value: "is_not" },
          { label: "Is Empty", value: "is_empty" },
          { label: "Is Not Empty", value: "is_not_empty" },
        ];
      case "date":
        return [
          { label: "Is", value: "is" },
          { label: "Before", value: "before" },
          { label: "After", value: "after" },
        ];
      default:
        return [{ label: "Contains", value: "contains" }];
    }
  };

  const renderValueInput = (filter: FilterCondition) => {
    const field = fields.find((f) => f.id === filter.fieldId);
    if (!field) return null;

    if (["is_empty", "is_not_empty"].includes(filter.operator)) return null;

    if (field.type === "select") {
      const selectValue =
        typeof filter.value === "string" ? filter.value : undefined;
      return (
        <Select
          size="small"
          style={{ width: 100 }}
          value={selectValue}
          onChange={(val: string) =>
            handleUpdateFilter(filter.id, { value: val })
          }
          options={field.options?.map((opt) => ({
            label: opt.label,
            value: opt.label,
          }))}
          popupMatchSelectWidth={false}
        />
      );
    }

    if (field.type === "date") {
      return (
        <DatePicker
          size="small"
          style={{ width: 100 }}
          onChange={(_date: unknown, dateString: string | null) =>
            handleUpdateFilter(filter.id, { value: dateString ?? "" })
          }
        />
      );
    }

    return (
      <Input
        size="small"
        style={{ width: 100 }}
        value={filter.value == null ? "" : String(filter.value)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          handleUpdateFilter(filter.id, { value: e.target.value })
        }
      />
    );
  };

  const content = (
    <div style={{ width: 380 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          Filters
        </Text>
        <Button
          type="link"
          size="small"
          onClick={handleClear}
          style={{ fontSize: 12, padding: 0, height: 20 }}
        >
          Clear
        </Button>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {filters.map((filter, index) => (
          <div
            key={filter.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              padding: "4px 6px",
              background: "#fafafa",
              borderRadius: 4,
            }}
          >
            <span
              style={{
                width: 36,
                textAlign: "center",
                color: "#999",
                fontSize: 12,
              }}
            >
              {index === 0 ? "Where" : "And"}
            </span>

            <Select
              size="small"
              style={{ width: 100 }}
              value={filter.fieldId}
              onChange={(val: string) =>
                handleUpdateFilter(filter.id, {
                  fieldId: val,
                  operator: getOperators(val)[0].value,
                  value: "",
                })
              }
              options={fields.map((f) => ({ label: f.name, value: f.id }))}
              popupMatchSelectWidth={false}
            />

            <Select
              size="small"
              style={{ width: "90px" }}
              value={filter.operator}
              onChange={(val: string) =>
                handleUpdateFilter(filter.id, { operator: val })
              }
              options={getOperators(filter.fieldId)}
              popupMatchSelectWidth={false}
            />

            {renderValueInput(filter)}

            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              danger
              onClick={() => handleRemoveFilter(filter.id)}
              style={{ padding: "0 4px", height: 24, minWidth: 24 }}
            />
          </div>
        ))}
      </div>

      <Button
        type="dashed"
        block
        size="small"
        onClick={handleAddFilter}
        icon={<FilterOutlined />}
        style={{ fontSize: 12, height: 28 }}
      >
        Add Filter
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      open={visible}
      onOpenChange={setVisible}
    >
      <Button
        type={filters.length > 0 ? "primary" : "text"}
        size="small"
        icon={<FilterOutlined />}
        style={{ fontSize: 12, height: 28 }}
      >
        Filter {filters.length > 0 && `(${filters.length})`}
      </Button>
    </Popover>
  );
}
