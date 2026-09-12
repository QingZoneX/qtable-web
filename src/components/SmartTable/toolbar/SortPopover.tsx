import { useState } from "react";
import { Popover, Button, List, Space, Typography } from "antd";
import {
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { useSmartTableStore } from "../../../store/useSmartTableStore";
import type { Field } from "../../../store/useSmartTableStore";

const { Text } = Typography;

export function SortPopover() {
  const { sorts, fields, setSorts } = useSmartTableStore();
  const [visible, setVisible] = useState(false);

  const handleToggleSort = (fieldId: string) => {
    const existingSort = sorts.find((s) => s.fieldId === fieldId);
    let newSorts = [...sorts];

    if (!existingSort) {
      // Add new sort (asc)
      newSorts.push({ fieldId, order: "asc" });
    } else if (existingSort.order === "asc") {
      // Toggle to desc
      newSorts = newSorts.map((s) =>
        s.fieldId === fieldId ? { ...s, order: "desc" } : s,
      );
    } else {
      // Remove sort
      newSorts = newSorts.filter((s) => s.fieldId !== fieldId);
    }

    console.log("Setting sorts:", newSorts);
    setSorts(newSorts);
  };

  const content = (
    <div style={{ width: 180 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          Sort By
        </Text>
      </div>

      <List
        size="small"
        dataSource={fields}
        renderItem={(field: Field) => {
          const sort = sorts.find((s) => s.fieldId === field.id);
          return (
            <List.Item
              onClick={() => handleToggleSort(field.id)}
              style={{
                cursor: "pointer",
                background: sort ? "#e6f7ff" : "transparent",
                padding: "6px 8px",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 12 }}>{field.name}</Text>
                <Space size={2}>
                  <ArrowUpOutlined
                    style={{
                      color: sort?.order === "asc" ? "#1890ff" : "#ccc",
                      fontSize: 10,
                    }}
                  />
                  <ArrowDownOutlined
                    style={{
                      color: sort?.order === "desc" ? "#1890ff" : "#ccc",
                      fontSize: 10,
                    }}
                  />
                </Space>
              </div>
            </List.Item>
          );
        }}
      />
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
        type={sorts.length > 0 ? "primary" : "text"}
        size="small"
        icon={<SwapOutlined rotate={90} />}
        style={{ fontSize: 12, height: 28 }}
      >
        Sort {sorts.length > 0 && `(${sorts.length})`}
      </Button>
    </Popover>
  );
}
