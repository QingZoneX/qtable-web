import { useState } from "react";
import { Popover, Button, Select, Space, Typography } from "antd";
import {
  AppstoreOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { useSmartTableStore } from "../../../../store/useSmartTableStore";
import type { FieldType } from "../../../../store/useSmartTableStore";
import { t } from "../../../../lib/i18n";

const { Text } = Typography;

export function GroupPopover({
  allowedTypes,
  disabled,
}: {
  allowedTypes?: FieldType[];
  disabled?: boolean;
}) {
  const { groupConfig, fields, setGroupConfig } = useSmartTableStore();
  const [visible, setVisible] = useState(false);
  const options = (
    allowedTypes && allowedTypes.length
      ? fields.filter((field) => allowedTypes.includes(field.type))
      : fields
  ).map((field) => ({ label: field.name, value: field.id }));

  const content = (
    <div style={{ width: 220 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('group.groupBy')}
        </Text>
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        <Select
          size="small"
          style={{ width: "100%" }}
          placeholder={t('group.selectField')}
          allowClear
          value={groupConfig.fieldId}
          disabled={disabled}
          onChange={(val) =>
            setGroupConfig({ ...groupConfig, fieldId: val || null })
          }
          options={options}
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
              {t('group.order')}
            </Text>
            <Space size={4}>
              <Button
                size="small"
                type={groupConfig.order === "asc" ? "primary" : "default"}
                icon={<ArrowUpOutlined />}
                disabled={disabled}
                onClick={() => setGroupConfig({ ...groupConfig, order: "asc" })}
                style={{ padding: "0 8px", height: 24, minWidth: 24 }}
              />
              <Button
                size="small"
                type={groupConfig.order === "desc" ? "primary" : "default"}
                icon={<ArrowDownOutlined />}
                disabled={disabled}
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
      open={Boolean(!disabled && visible)}
      onOpenChange={(open) => {
        if (disabled) return;
        setVisible(open);
      }}
    >
      <Button
        type={groupConfig.fieldId ? "primary" : "text"}
        size="small"
        icon={<AppstoreOutlined />}
        disabled={disabled}
        style={{ fontSize: 12, height: 28 }}
      >
        {t('toolbar.group')} {groupConfig.fieldId && `(1)`}
      </Button>
    </Popover>
  );
}
