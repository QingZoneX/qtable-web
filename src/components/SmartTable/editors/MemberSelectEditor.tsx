import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import type { KeyboardEvent, ReactNode } from "react";
import { ReactEditor } from "./ReactEditor";
import type { EditContext } from "@visactor/vtable-editors";

type OptionItem = DefaultOptionType & {
  value: string;
  label: string;
};
type OptionSource = { id: string; label: string };
type TagRenderProps = {
  label: ReactNode;
  value: string;
  closable: boolean;
  onClose: (event?: React.MouseEvent<HTMLElement>) => void;
};

const getMemberInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const memberId = (value: unknown): string => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as {
      id?: unknown;
      userId?: unknown;
      user_id?: unknown;
      value?: unknown;
    };
    const raw =
      candidate.id ?? candidate.userId ?? candidate.user_id ?? candidate.value;
    return raw == null ? "" : String(raw);
  }
  return value == null ? "" : String(value);
};

const normalizeIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map(memberId).filter((item) => item.length > 0)),
    );
  }
  const id = memberId(value);
  return id ? [id] : [];
};

const MemberSelectEditorComponent = ({
  initialValue,
  options,
  multiple,
  onChange,
  onExit,
  onHeightChange,
  minHeight,
  maxHeight,
}: {
  initialValue: unknown;
  options: OptionItem[];
  multiple: boolean;
  onChange: (value: string[] | string | null) => void;
  onExit: () => void;
  onHeightChange: (height: number) => void;
  minHeight: number;
  maxHeight: number;
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const normalizedIds = useMemo(
    () =>
      normalizeIds(initialValue).map((raw) => {
        const byValue = options.find((option) => option.value === raw);
        if (byValue) return byValue.value;
        const byLabel = options.find((option) => option.label === raw);
        return byLabel ? byLabel.value : raw;
      }),
    [initialValue, options],
  );
  const [currentMulti, setCurrentMulti] = useState<string[]>(normalizedIds);
  const [currentSingle, setCurrentSingle] = useState<string | undefined>(
    normalizedIds[0],
  );

  useEffect(() => {
    const measure = () => {
      const element = wrapperRef.current;
      if (!element) return;
      const height = Math.min(
        maxHeight,
        Math.max(minHeight, element.scrollHeight),
      );
      onHeightChange(height);
    };
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [currentMulti, currentSingle, maxHeight, minHeight, onHeightChange]);

  const optionRender = (option: { data: unknown }) => {
    const data = option.data as OptionItem;
    const name = String(data.label ?? "");
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            color: "#5F6B7C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 600,
          }}
        >
          {getMemberInitials(name)}
        </div>
        <span style={{ fontSize: 13, color: "#111827" }}>{data.label}</span>
      </div>
    );
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: 4,
      }}
    >
      {multiple ? (
        <Select<string[], OptionItem>
          mode="multiple"
          autoFocus
          defaultOpen
          value={currentMulti}
          className="vtable-editor-select"
          style={{ width: "100%", minHeight: 40 }}
          popupClassName="vtable-editor-popup"
          options={options}
          onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            event.stopPropagation();
            if (event.key === "Enter") onExit();
          }}
          onChange={(value) => {
            const next = Array.isArray(value) ? value : [];
            setCurrentMulti(next);
            onChange(next);
          }}
          variant="borderless"
          optionRender={optionRender}
          tagRender={(props: TagRenderProps) => {
            const { label, closable, onClose } = props;
            const name =
              typeof label === "string" ? label : String(label ?? "");
            return (
              <span
                style={{
                  backgroundColor: "#F3F4F6",
                  color: "#111827",
                  borderRadius: 12,
                  padding: "2px 8px 2px 6px",
                  margin: "2px 4px 2px 0",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid #E5E7EB",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 600,
                    marginRight: 6,
                  }}
                >
                  {getMemberInitials(name)}
                </span>
                {label}
                {closable ? (
                  <span
                    onClick={onClose}
                    style={{ marginLeft: 6, cursor: "pointer", opacity: 0.6 }}
                  >
                    ×
                  </span>
                ) : null}
              </span>
            );
          }}
        />
      ) : (
        <Select<string, OptionItem>
          allowClear
          autoFocus
          defaultOpen
          value={currentSingle}
          className="vtable-editor-select"
          style={{ width: "100%", minHeight: 40 }}
          popupClassName="vtable-editor-popup"
          options={options}
          onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            event.stopPropagation();
            if (event.key === "Enter") onExit();
          }}
          onChange={(value) => {
            const next = value || undefined;
            setCurrentSingle(next);
            onChange(next ?? null);
          }}
          variant="borderless"
          optionRender={optionRender}
        />
      )}
    </div>
  );
};

export class MemberSelectEditor extends ReactEditor {
  options: OptionItem[] = [];
  multiple = true;

  onStart(context: EditContext<unknown, unknown>) {
    const typedContext = context as {
      options?: OptionSource[];
      memberMultiple?: boolean;
      table?: {
        getBodyColumnDefine: (
          col: number,
          row: number,
        ) =>
          | {
              options?: OptionSource[];
              memberMultiple?: boolean;
            }
          | undefined;
      };
    };
    const providedOptions = typedContext.options;
    if (providedOptions) {
      this.options = providedOptions.map((option) => ({
        label: option.label,
        value: option.id,
      }));
    }

    if (typeof typedContext.memberMultiple === "boolean") {
      this.multiple = typedContext.memberMultiple;
    }

    if (typedContext.table && context.col !== undefined) {
      const column = typedContext.table.getBodyColumnDefine(
        context.col,
        context.row,
      );
      if (column?.options) {
        this.options = column.options.map((option) => ({
          label: option.label,
          value: option.id,
        }));
      }
      if (typeof column?.memberMultiple === "boolean") {
        this.multiple = column.memberMultiple;
      }
    }
    super.onStart(context);
  }

  render() {
    if (!this.root) return;
    this.root.render(
      <MemberSelectEditorComponent
        initialValue={this.value}
        options={this.options}
        multiple={this.multiple}
        onChange={(value) => {
          this.value = value;
        }}
        onExit={() => this.onExit?.()}
        onHeightChange={(height) => this.setHeight(height)}
        minHeight={this.baseHeight || 40}
        maxHeight={1000}
      />,
    );
  }
}
