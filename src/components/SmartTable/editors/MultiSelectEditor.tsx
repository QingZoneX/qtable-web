import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import type { KeyboardEvent, ReactNode } from "react";
import { ReactEditor } from "./ReactEditor";
import { getTextColor } from "../utils/colorUtils";
import type { EditContext } from "@visactor/vtable-editors";

// Helper to generate avatar color based on name (same as renderer)
function generateAvatarColor(name: string) {
  if (!name) return "#0084ff";
  const colors = [
    "#0084ff",
    "#44d7b6",
    "#ffb82f",
    "#ff8a65",
    "#ba68c8",
    "#4fc3f7",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

type OptionItem = DefaultOptionType & {
  value: string;
  label: string;
  color?: string;
};
type OptionSource = { id: string; label: string; color?: string };
type TagRenderProps = {
  label: ReactNode;
  value: string;
  closable: boolean;
  onClose: (event?: React.MouseEvent<HTMLElement>) => void;
};

const MultiSelectEditorComponent = ({
  initialValue,
  options,
  onChange,
  onExit,
  onHeightChange,
  minHeight,
  maxHeight,
}: {
  initialValue: string[] | string | null | undefined;
  options: OptionItem[];
  onChange: (val: string[]) => void;
  onExit: () => void;
  onHeightChange: (h: number) => void;
  minHeight: number;
  maxHeight: number;
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Normalize initial values to option values
  const normalizedValue = useMemo(() => {
    if (!Array.isArray(initialValue)) return [] as string[];
    return initialValue.map((val) => {
      const byValue = options.find((o) => o.value === val);
      if (byValue) return byValue.value;
      const byLabel = options.find((o) => o.label === val);
      return byLabel ? byLabel.value : val;
    });
  }, [initialValue, options]);

  const [current, setCurrent] = useState<string[]>(normalizedValue);

  // Measure and adjust editor container height according to tag lines
  useEffect(() => {
    const measure = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const natural = el.scrollHeight;
      const h = Math.min(maxHeight, Math.max(minHeight, natural));
      onHeightChange(h);
    };
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [current, minHeight, maxHeight, onHeightChange]);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
    >
      <Select<string[], OptionItem>
        mode="multiple"
        autoFocus
        defaultOpen
        value={current}
        className="vtable-editor-select"
        style={{
          width: "100%",
          minHeight: "40px",
          display: "flex",
          alignItems: "center",
        }}
        popupClassName="vtable-editor-popup"
        options={options}
        onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            onExit();
          }
        }}
        onChange={(val) => {
          const next = Array.isArray(val) ? val : [];
          setCurrent(next);
          onChange(next);
        }}
        variant="borderless"
        optionRender={(option) => {
          const { label, color } = option.data as OptionItem;
          // Check if we should render as member (avatar)
          // If color is empty string, likely a member or needs default color
          const isMember = !color;
          const displayColor = color || generateAvatarColor(label);

          if (isMember) {
            return (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: displayColor,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    marginRight: 8,
                  }}
                >
                  {label.charAt(0).toUpperCase()}
                </div>
                <span>{label}</span>
              </div>
            );
          }

          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  backgroundColor: displayColor,
                  color: getTextColor(displayColor),
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                {label}
              </span>
            </div>
          );
        }}
        tagRender={(props: TagRenderProps) => {
          const { label, value, closable, onClose } = props;
          const option = options.find((o) => o.value === value);
          const color = option?.color;
          const isMember = !color;
          const displayColor =
            color ||
            generateAvatarColor(typeof label === "string" ? label : "");

          if (isMember) {
            return (
              <span
                style={{
                  backgroundColor: "#f4f6f8", // Light gray background for member tag
                  color: "#222329",
                  borderRadius: "12px", // Pill shape
                  padding: "2px 8px 2px 2px",
                  margin: "2px 4px 2px 0",
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid #e0e0e0",
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: displayColor,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    marginRight: 4,
                  }}
                >
                  {typeof label === "string"
                    ? label.charAt(0).toUpperCase()
                    : ""}
                </div>
                {label}
                {closable && (
                  <span
                    onClick={onClose}
                    style={{
                      marginLeft: "4px",
                      cursor: "pointer",
                      opacity: 0.6,
                      fontWeight: "bold",
                    }}
                  >
                    ×
                  </span>
                )}
              </span>
            );
          }

          return (
            <span
              style={{
                backgroundColor: displayColor,
                color: getTextColor(displayColor),
                borderRadius: "4px",
                padding: "2px 8px",
                margin: "2px 4px 2px 0",
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {label}
              {closable && (
                <span
                  onClick={onClose}
                  style={{
                    marginLeft: "4px",
                    cursor: "pointer",
                    opacity: 0.8,
                  }}
                >
                  ×
                </span>
              )}
            </span>
          );
        }}
      />
    </div>
  );
};

export class MultiSelectEditor extends ReactEditor {
  options: OptionItem[] = [];

  onStart(context: EditContext<unknown, unknown>) {
    const providedOptions = (context as { options?: OptionSource[] }).options;
    if (providedOptions) {
      this.options = providedOptions.map((opt) => ({
        label: opt.label,
        value: opt.id,
        color: opt.color,
      }));
    } else {
      const table = (
        context as {
          table?: {
            getBodyColumnDefine: (
              col: number,
              row: number,
            ) => { options?: OptionSource[] } | undefined;
          };
        }
      ).table;
      if (table && context.col !== undefined) {
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
    const normalizedValue = Array.isArray(this.value)
      ? this.value.map((val) => String(val))
      : this.value == null
        ? []
        : [String(this.value)];
    this.root.render(
      <MultiSelectEditorComponent
        initialValue={normalizedValue}
        options={this.options}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
        onHeightChange={(h) => this.setHeight(h)}
        minHeight={this.baseHeight || 40}
        maxHeight={200}
      />,
    );
  }
}
