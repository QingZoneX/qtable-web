import { DatePicker } from "antd";
import dayjs from "dayjs";
import { ReactEditor } from "./ReactEditor";
import type { EditContext } from "@visactor/vtable-editors";

const DateEditorComponent = ({
  initialValue,
  format,
  onChange,
  onExit,
}: {
  initialValue: number | string | null | undefined;
  format: string;
  onChange: (val: number | null) => void;
  onExit: () => void;
}) => {
  const normalizedValue =
    initialValue == null || initialValue === "" ? undefined : dayjs(initialValue);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          setTimeout(() => onExit(), 100);
        }
      }}
    >
      <DatePicker
        autoFocus
        defaultOpen
        allowClear
        defaultValue={normalizedValue}
        format={format}
        style={{
          width: "100%",
          height: "100%",
          padding: "0 6px",
        }}
        popupClassName="vtable-editor-popup"
        onChange={(date) => {
          const val = date ? date.valueOf() : null;
          onChange(val);
          onExit();
        }}
        variant="borderless"
      />
    </div>
  );
};

export class DateEditor extends ReactEditor {
  format: string = "MMM DD, YYYY";

  onStart(context: EditContext<unknown, unknown>) {
    // Expect format to be passed in context (if column definition has it)
    const maybeFormat = (context as { format?: string }).format;
    if (maybeFormat) {
      this.format = maybeFormat;
    } else {
      const table = (context as {
        table?: {
          getBodyColumnDefine: (
            col: number,
            row: number,
          ) => { format?: string } | undefined;
        };
      }).table;
      if (table && context.col !== undefined) {
        const colDef = table.getBodyColumnDefine(context.col, context.row);
      if (colDef && colDef.format) {
        this.format = colDef.format;
      }
      }
    }
    // Fallback to MMM DD, YYYY if nothing specified, to match render
    if (!this.format || this.format === "YYYY/MM/DD") {
        this.format = "MMM DD, YYYY";
    }
    super.onStart(context);
  }

  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "number" || typeof this.value === "string"
        ? this.value
        : this.value == null
        ? undefined
        : String(this.value);
    this.root.render(
      <DateEditorComponent
        initialValue={normalizedValue}
        format={this.format}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />,
    );
  }
}
