import { useEffect, useRef } from "react";
import { InputNumber } from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  ExpandOutlined,
  LinkOutlined,
  PlusOutlined,
} from "@ant-design/icons";

type RowContextMenuProps = {
  position: { x: number; y: number } | null;
  canUpdate: boolean;
  isCellCopyable: boolean;
  insertCount: number;
  onInsertCountChange: (value: number) => void;
  onClose: () => void;
  onCopyCell: () => void | Promise<void>;
  onInsertRows: () => void | Promise<void>;
  onCopyRowUrl: () => void | Promise<void>;
  onCopyRow: () => void | Promise<void>;
  onExpandRow: () => void;
  onDeleteRow: () => void;
};

export function RowContextMenu({
  position,
  canUpdate,
  isCellCopyable,
  insertCount,
  onInsertCountChange,
  onClose,
  onCopyCell,
  onInsertRows,
  onCopyRowUrl,
  onCopyRow,
  onExpandRow,
  onDeleteRow,
}: RowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!position) return;
    const handlePointer = (event: PointerEvent) => {
      if (event.button === 2) return;
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.metaKey && event.key.toLowerCase() === "c") {
        if (isCellCopyable) {
          event.preventDefault();
          void onCopyCell();
        }
        return;
      }
      if (event.key === "Enter" && event.shiftKey) {
        if (canUpdate) {
          event.preventDefault();
          void onInsertRows();
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        onExpandRow();
      }
    };
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [
    canUpdate,
    isCellCopyable,
    onClose,
    onCopyCell,
    onExpandRow,
    onInsertRows,
    position,
  ]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="smarttable-row-menu"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className={`smarttable-row-menu-item${
          isCellCopyable ? "" : " smarttable-row-menu-item-disabled"
        }`}
        onClick={isCellCopyable ? () => void onCopyCell() : undefined}
      >
        <CopyOutlined />
        <span>复制该单元格</span>
        <span className="smarttable-row-menu-shortcut">⌘ C</span>
      </div>
      <div className="smarttable-row-menu-divider" />
      <div
        className={`smarttable-row-menu-item${
          canUpdate ? "" : " smarttable-row-menu-item-disabled"
        }`}
        onClick={canUpdate ? () => void onInsertRows() : undefined}
      >
        <PlusOutlined />
        <span>新增</span>
        <InputNumber
          className="smarttable-row-menu-count-input"
          size="small"
          controls={false}
          min={1}
          max={999}
          value={insertCount}
          onChange={(value) => {
            const next =
              typeof value === "number" && Number.isFinite(value) ? value : 1;
            onInsertCountChange(next);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
        <span>行</span>
        <span className="smarttable-row-menu-shortcut">⇧ Enter</span>
      </div>
      <div className="smarttable-row-menu-note">
        新记录按服务端顺序创建；排序或分组视图会按当前规则展示。
      </div>
      <div className="smarttable-row-menu-divider" />
      <div className="smarttable-row-menu-item" onClick={() => void onCopyRowUrl()}>
        <LinkOutlined />
        <span>复制该行 URL</span>
      </div>
      <div className="smarttable-row-menu-item" onClick={() => void onCopyRow()}>
        <CopyOutlined />
        <span>复制行</span>
      </div>
      <div className="smarttable-row-menu-item" onClick={onExpandRow}>
        <ExpandOutlined />
        <span>展开行</span>
        <span className="smarttable-row-menu-shortcut">Space</span>
      </div>
      <div className="smarttable-row-menu-divider" />
      <div
        className={`smarttable-row-menu-item smarttable-row-menu-item-danger${
          canUpdate ? "" : " smarttable-row-menu-item-disabled"
        }`}
        onClick={canUpdate ? onDeleteRow : undefined}
      >
        <DeleteOutlined />
        <span>删除行</span>
      </div>
    </div>
  );
}
