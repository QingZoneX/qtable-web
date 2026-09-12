import { useState } from "react";
import { Popover, Button, Typography, Space } from "antd";
import {
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent } from "@dnd-kit/core";
import { useSmartTableStore } from "../../../store/useSmartTableStore";
import type { Field } from "../../../store/useSmartTableStore";

const { Text } = Typography;

type ToggleVisibilityHandler = (fieldId: string) => void;

interface SortableItemProps {
  id: string;
  field: Field;
  isHidden: boolean;
  onToggleVisibility: ToggleVisibilityHandler;
}

function SortableItem({
  id,
  field,
  isHidden,
  onToggleVisibility,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: 4,
    padding: "6px 8px",
    backgroundColor: "#fff",
    border: "1px solid #f0f0f0",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Space size={4}>
        <span
          {...listeners}
          style={{ cursor: "grab", color: "#999", fontSize: 12 }}
        >
          <HolderOutlined />
        </span>
        <Text style={{ fontSize: 12 }}>{field.name}</Text>
      </Space>
      <Button
        type="text"
        size="small"
        icon={isHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={() => onToggleVisibility(field.id)}
        style={{
          color: isHidden ? "#999" : "inherit",
          padding: "0 4px",
          height: 24,
          minWidth: 24,
        }}
      />
    </div>
  );
}

export function FieldsPopover() {
  const { fields, hiddenFieldIds, toggleFieldVisibility, reorderFields } =
    useSmartTableStore();
  const [visible, setVisible] = useState(false);

  // Dnd Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    reorderFields(arrayMove(fields, oldIndex, newIndex));
  };

  const content = (
    <div style={{ width: 260 }}>
      <div
        style={{
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          Field Configuration
        </Text>
      </div>

      <Button
        type="dashed"
        block
        size="small"
        icon={<PlusOutlined />}
        style={{ marginBottom: 8, fontSize: 12, height: 28 }}
      >
        Add Custom Field
      </Button>

      <div style={{ maxHeight: 480, overflowY: "auto", padding: "0 4px" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {fields.map((field) => (
              <SortableItem
                key={field.id}
                id={field.id}
                field={field}
                isHidden={hiddenFieldIds.includes(field.id)}
                onToggleVisibility={toggleFieldVisibility}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
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
        type="text"
        size="small"
        icon={<SettingOutlined />}
        style={{ fontSize: 12, height: 28 }}
      >
        Fields
      </Button>
    </Popover>
  );
}
