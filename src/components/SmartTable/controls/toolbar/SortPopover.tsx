import { useMemo, useState } from "react";
import { Popover, Button, Select, Space, Typography, Empty } from "antd";
import {
  SwapOutlined,
  HolderOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSmartTableStore } from "../../../../store/useSmartTableStore";
import type {
  Field,
  SortCondition,
} from "../../../../store/useSmartTableStore";
import { t } from "../../../../lib/i18n";

const { Text } = Typography;

interface SortRuleProps {
  sort: SortCondition;
  index: number;
  fields: Field[];
  sorts: SortCondition[];
  disabled?: boolean;
  onFieldChange: (oldFieldId: string, newFieldId: string) => void;
  onOrderChange: (fieldId: string, order: "asc" | "desc") => void;
  onRemove: (fieldId: string) => void;
}

function SortRule({
  sort,
  index,
  fields,
  sorts,
  disabled,
  onFieldChange,
  onOrderChange,
  onRemove,
}: SortRuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sort.fieldId, disabled });

  const usedFieldIds = new Set(sorts.map((item) => item.fieldId));
  const fieldOptions = fields
    .filter((field) => field.id === sort.fieldId || !usedFieldIds.has(field.id))
    .map((field) => ({ label: field.name, value: field.id }));

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 8px",
        border: "1px solid #f0f0f0",
        borderRadius: 6,
        background: isDragging ? "#f0f7ff" : "#fafafa",
        boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.08)" : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<HolderOutlined />}
        disabled={disabled}
        {...attributes}
        {...listeners}
        style={{
          cursor: disabled ? "default" : "grab",
          color: "#8c8c8c",
          padding: "0 2px",
          width: 22,
          minWidth: 22,
        }}
      />

      <span
        style={{
          width: 18,
          textAlign: "center",
          fontSize: 11,
          color: "#8c8c8c",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {index + 1}
      </span>

      <Select
        size="small"
        value={sort.fieldId}
        options={fieldOptions}
        disabled={disabled}
        showSearch
        optionFilterProp="label"
        placeholder={t("sort.sortBy")}
        popupMatchSelectWidth={false}
        onChange={(fieldId: string) => onFieldChange(sort.fieldId, fieldId)}
        style={{ flex: 1, minWidth: 150 }}
      />

      <Select
        size="small"
        value={sort.order}
        disabled={disabled}
        popupMatchSelectWidth={false}
        options={[
          { label: "↑ ASC", value: "asc" },
          { label: "↓ DESC", value: "desc" },
        ]}
        onChange={(order: "asc" | "desc") =>
          onOrderChange(sort.fieldId, order)
        }
        style={{ width: 92 }}
      />

      <Button
        type="text"
        size="small"
        danger
        disabled={disabled}
        icon={<DeleteOutlined />}
        onClick={() => onRemove(sort.fieldId)}
        style={{ minWidth: 28, padding: "0 4px" }}
      />
    </div>
  );
}

export function SortPopover({ disabled }: { disabled?: boolean }) {
  const { sorts, fields, setSorts } = useSmartTableStore();
  const [visible, setVisible] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const availableFields = useMemo(() => {
    const used = new Set(sorts.map((sort) => sort.fieldId));
    return fields.filter((field) => !used.has(field.id));
  }, [fields, sorts]);

  const handleAddSort = () => {
    if (disabled || availableFields.length === 0) return;
    setSorts([
      ...sorts,
      { fieldId: availableFields[0].id, order: "asc" },
    ]);
  };

  const handleFieldChange = (oldFieldId: string, newFieldId: string) => {
    if (disabled || oldFieldId === newFieldId) return;
    setSorts(
      sorts.map((sort) =>
        sort.fieldId === oldFieldId ? { ...sort, fieldId: newFieldId } : sort,
      ),
    );
  };

  const handleOrderChange = (
    fieldId: string,
    order: "asc" | "desc",
  ) => {
    if (disabled) return;
    setSorts(
      sorts.map((sort) =>
        sort.fieldId === fieldId ? { ...sort, order } : sort,
      ),
    );
  };

  const handleRemoveSort = (fieldId: string) => {
    if (disabled) return;
    setSorts(sorts.filter((sort) => sort.fieldId !== fieldId));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (disabled || !over || active.id === over.id) return;
    const oldIndex = sorts.findIndex((sort) => sort.fieldId === active.id);
    const newIndex = sorts.findIndex((sort) => sort.fieldId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setSorts(arrayMove(sorts, oldIndex, newIndex));
  };

  const content = (
    <div style={{ width: 410 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {t('sort.sortBy')}
          </Text>
          <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
            拖拽调整排序优先级，序号越小优先级越高
          </Text>
        </div>
        <Button
          type="link"
          size="small"
          disabled={disabled || sorts.length === 0}
          onClick={() => setSorts([])}
          style={{ padding: 0, height: 20, fontSize: 12 }}
        >
          {t('filter.clear')}
        </Button>
      </div>

      {sorts.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无排序规则"
          styles={{ image: { height: 32 } }}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sorts.map((sort) => sort.fieldId)}
            strategy={verticalListSortingStrategy}
          >
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              {sorts.map((sort, index) => (
                <SortRule
                  key={sort.fieldId}
                  sort={sort}
                  index={index}
                  fields={fields}
                  sorts={sorts}
                  disabled={disabled}
                  onFieldChange={handleFieldChange}
                  onOrderChange={handleOrderChange}
                  onRemove={handleRemoveSort}
                />
              ))}
            </Space>
          </SortableContext>
        </DndContext>
      )}

      <Button
        type="dashed"
        block
        size="small"
        icon={<PlusOutlined />}
        onClick={handleAddSort}
        disabled={disabled || availableFields.length === 0}
        style={{ marginTop: 10, height: 30, fontSize: 12 }}
      >
        添加排序条件
      </Button>
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
        type={sorts.length > 0 ? "primary" : "text"}
        size="small"
        icon={<SwapOutlined rotate={90} />}
        disabled={disabled}
        style={{ fontSize: 12, height: 28 }}
      >
        {t('toolbar.sort')} {sorts.length > 0 && `(${sorts.length})`}
      </Button>
    </Popover>
  );
}
