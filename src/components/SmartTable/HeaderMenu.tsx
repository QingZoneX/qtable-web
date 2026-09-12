import { Dropdown, Modal, message } from "antd";
import type { MenuProps } from "antd";
import {
  EditOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  permissionAllows,
  useSmartTableStore,
} from "../../store/useSmartTableStore";
import { t } from "../../lib/i18nRuntime";

interface HeaderMenuProps {
  fieldId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onEditField: (fieldId: string) => void;
  onInsertField: (index: number) => void;
}

export function HeaderMenu({
  fieldId,
  position,
  onClose,
  onEditField,
  onInsertField,
}: HeaderMenuProps) {
  const { fields, deleteField, toggleFieldVisibility } =
    useSmartTableStore();
  const currentPermission = useSmartTableStore((state) => state.currentPermission);

  const field = fields.find((f) => f.id === fieldId);

  if (!fieldId || !position || !field) return null;
  if (!permissionAllows(currentPermission, "edit")) return null;

  const handleMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case "rename":
        onEditField(fieldId);
        onClose();
        return;
      case "insertLeft":
        handleInsertField("left");
        break;
      case "insertRight":
        handleInsertField("right");
        break;
      case "hide":
        toggleFieldVisibility(fieldId);
        break;
      case "delete":
        Modal.confirm({
          title: t("grid.deleteColumnTitle"),
          content: t("grid.deleteColumnContent", { name: field.name }),
          okText: t("common.delete"),
          cancelText: t("common.cancel"),
          onOk: async () => {
            const result = await deleteField(fieldId);
            if (!result.ok) {
              throw new Error(result.error);
            }
            message.success(t("grid.columnDeleted"));
          },
        });
        break;
    }
    onClose();
  };

  const handleInsertField = (direction: "left" | "right") => {
    const currentIndex = fields.findIndex((f) => f.id === fieldId);
    const newIndex = direction === "left" ? currentIndex : currentIndex + 1;
    onInsertField(newIndex);
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "rename",
      label: "修改列名称/列类型",
      icon: <EditOutlined />,
    },
    {
      key: "insertLeft",
      label: "向左插入列",
      icon: <ArrowLeftOutlined />,
    },
    {
      key: "insertRight",
      label: "向右插入列",
      icon: <ArrowRightOutlined />,
    },
    {
      key: "hide",
      label: "隐藏列",
      icon: <EyeInvisibleOutlined />,
    },
    {
      type: "divider",
    },
    {
      key: "delete",
      label: "删除列",
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: 1,
        height: 1,
        zIndex: 1000,
      }}
    >
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenuClick }}
        open={true}
        trigger={["click"]}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <div />
      </Dropdown>
    </div>
  );
}
