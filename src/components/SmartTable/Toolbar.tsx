import { Button, Space } from "antd";
import {
  PlusCircleOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { FilterPopover } from "./toolbar/FilterPopover";
import { SortPopover } from "./toolbar/SortPopover";
import { GroupPopover } from "./toolbar/GroupPopover";
import { FieldsPopover } from "./toolbar/FieldsPopover";

export function Toolbar() {
  const { insertRow } = useSmartTableStore();
  // const { token } = theme.useToken();

  const handleAddRecord = () => {
    insertRow();
  };

  const buttonStyle = {
    color: "#5F6B7C",
    fontSize: 13,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    height: 28,
  };

  return (
    <div
      style={{
        padding: "0 24px",
        borderBottom: `1px solid #EAECF0`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "white",
        height: 40,
      }}
    >
      <Space size={8}>
        <Button
          type="text"
          icon={<PlusCircleOutlined style={{ fontSize: 16 }} />}
          onClick={handleAddRecord}
          style={buttonStyle}
        >
          Insert Row
        </Button>

        <FieldsPopover />

        <FilterPopover />

        <GroupPopover />

        <SortPopover />

        <Button
          type="text"
          icon={<ThunderboltOutlined style={{ fontSize: 16 }} />}
          style={buttonStyle}
        >
          Automations
        </Button>
      </Space>

      <Space size={12}>
        <Button
          type="primary"
          icon={<ShareAltOutlined />}
          style={{
            backgroundColor: "#111827",
            color: "white",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            height: 28,
            display: "flex",
            alignItems: "center",
            boxShadow: "none",
            padding: "0 10px",
          }}
        >
          Share View
        </Button>
      </Space>
    </div>
  );
}
