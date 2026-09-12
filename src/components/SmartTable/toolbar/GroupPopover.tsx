import { useState } from "react";
import { Popover, Button, Select, Space, Typography } from "antd";
import {
  AppstoreOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { useSmartTableStore } from "../../../store/useSmartTableStore";

const { Text } = Typography;

export function GroupPopover() {
  const { groupConfig, fields, setGroupConfig } = useSmartTableStore();
  const [visible, setVisible] = useState(false);

  const content = (
    <div style={{ width: 220 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          Group By
        </Text>
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        <Select
          size="small"
          style={{ width: "100%" }}
          placeholder="Select a field to group by"
          allowClear
          value={groupConfig.fieldId}
          onChange={(val: string) =>
            setGroupConfig({ ...groupConfig, fieldId: val })
          }
          options={fields.map((f) => ({ label: f.name, value: f.id }))}
          popupMatchSelectWidth={false}
        />

        {groupConfig.fieldId && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Order
            </Text>
            <Space size={4}>
              <Button
                size="small"
                type={groupConfig.order === "asc" ? "primary" : "default"}
                icon={<ArrowUpOutlined />}
                onClick={() => setGroupConfig({ ...groupConfig, order: "asc" })}
                style={{ padding: "0 8px", height: 24, minWidth: 24 }}
              />
              <Button
                size="small"
                type={groupConfig.order === "desc" ? "primary" : "default"}
                icon={<ArrowDownOutlined />}
                onClick={() =>
                  setGroupConfig({ ...groupConfig, order: "desc" })
                }
                style={{ padding: "0 8px", height: 24, minWidth: 24 }}
              />
            </Space>
          </div>
        )}
      </Space>
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
        type={groupConfig.fieldId ? "primary" : "text"}
        size="small"
        icon={<AppstoreOutlined />}
        style={{ fontSize: 12, height: 28 }}
      >
        Group {groupConfig.fieldId && `(1)`}
      </Button>
    </Popover>
  );
}
