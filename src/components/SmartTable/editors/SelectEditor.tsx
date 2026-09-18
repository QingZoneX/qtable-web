import { useState } from "react";
import { Select } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import type { KeyboardEvent } from "react";
import { ReactEditor } from "./ReactEditor";
import type { EditContext } from "@visactor/vtable-editors";

type OptionItem = DefaultOptionType & {
  value: string;
  label: string;
  color?: string;
};
type OptionSource = { id: string; label: string; color?: string };

const SelectEditorComponent = ({
  initialValue,
  options,
  onChange,
  onExit,
}: {
  initialValue: string | null | undefined;
  options: OptionItem[];
  onChange: (val: string | null | undefined) => void;
  onExit: () => void;
}) => {
  const [open, setOpen] = useState(true);

  const normalizedValue = (() => {
    if (options.some((opt) => opt.value === initialValue)) return initialValue;
    const byLabel = options.find((opt) => opt.label === initialValue);
    return byLabel ? byLabel.value : initialValue;
  })();

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
    >
      <Select<string, OptionItem>
        autoFocus
        showSearch
        allowClear
        open={open}
        value={normalizedValue}
        className="vtable-editor-select"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
        popupClassName="vtable-editor-popup"
        placeholder="Search priority..."
        options={options}
        onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            setTimeout(() => onExit(), 100);
          }
        }}
        onChange={(val) => {
          onChange(val);
          setOpen(false);
          onExit();
        }}
        variant="borderless"
        optionLabelProp="label"
        optionRender={(option) => {
          const { label, color } = option.data as OptionItem;
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: color,
                }}
              />
              <span style={{ fontSize: "13px", color: "#111827" }}>
                {label}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
};


export class SelectEditor extends ReactEditor {
  options: OptionItem[] = [];

  onStart(context: EditContext<unknown, unknown>) {
    const providedOptions = (context as { options?: OptionSource[] }).options;
    if (providedOptions) {
      this.options = providedOptions.map((opt) => ({
        label: opt.label,
        value: opt.id,
        color: opt.color,
      }));
    } else if (context.table && context.col !== undefined) {
      const table = (
        context as {
          table?: {
            getBodyColumnDefine: (
              col: number,
              row: number,
            ) =>
              | {
                  options?: Array<{
                    id: string;
                    label: string;
                    color?: string;
                  }>;
                }
              | undefined;
          };
        }
      ).table;
      if (table) {
        const colDef = table.getBodyColumnDefine(context.col, context.row);
        if (colDef && colDef.options) {
          this.options = colDef.options.map((opt) => ({
            label: opt.label,
            value: opt.id,
            color: opt.color,
          }));
        }
      }
    }
    super.onStart(context);
  }

  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "string"
        ? this.value
        : this.value == null
          ? undefined
          : String(this.value);
    this.root.render(
      <SelectEditorComponent
        initialValue={normalizedValue}
        options={this.options}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />,
    );
  }
}
