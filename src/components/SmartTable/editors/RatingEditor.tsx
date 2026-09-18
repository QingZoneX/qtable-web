import { useRef } from "react";
import { Rate } from "antd";
import { ReactEditor } from "./ReactEditor";
import type { EditContext } from "@visactor/vtable-editors";

const RatingEditorComponent = ({
  initialValue,
  max,
  onChange,
  onExit,
}: {
  initialValue: number | string | null | undefined;
  max: number;
  onChange: (val: number) => void;
  onExit: () => void;
}) => {
  const isChanging = useRef(false);
  const tooltips = Array.from({ length: max }, (_, i) => String(i + 1));
  return (
    <div
      style={{
        padding: "0 10px",
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          onExit();
        }
      }}
    >
      <Rate
        autoFocus
        count={max}
        tooltips={tooltips}
        defaultValue={
          typeof initialValue === "number"
            ? initialValue
            : initialValue == null || initialValue === ""
            ? 0
            : Number(initialValue) || 0
        }
        onChange={(val) => {
          isChanging.current = true;
          onChange(val);
          onExit();
        }}
        onBlur={() => {
          setTimeout(() => {
            if (!isChanging.current) {
              onExit();
            }
          }, 100);
        }}
        size="small"
      />
    </div>
  );
};

export class RatingEditor extends ReactEditor {
  max: number = 5;

  onStart(context: EditContext<unknown, unknown>) {
    const table = (context as {
      table?: {
        getBodyColumnDefine: (
          col: number,
          row: number,
        ) => { max?: number } | undefined;
      };
    }).table;
    if (table && context.col !== undefined) {
      // Try to get max from property
      // Note: VTable might not expose property easily here unless we pass it specifically
      // But assuming we might have it or default to 5
      // Ideally we should pass it via context or similar mechanism as SelectEditor
      const colDef = table.getBodyColumnDefine(context.col, context.row);
      if (colDef && colDef.max) {
        this.max = colDef.max;
      }
    }
    super.onStart(context);
  }

  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "number" || typeof this.value === "string"
        ? this.value
        : this.value == null
        ? 0
        : Number(this.value) || 0;
    this.root.render(
      <RatingEditorComponent
        initialValue={normalizedValue}
        max={this.max}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />,
    );
  }
}
