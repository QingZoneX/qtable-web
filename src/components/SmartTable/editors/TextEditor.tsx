import { useEffect, useRef, useState } from "react";
import { Input } from "antd";
import type { InputRef } from "antd";
import { ReactEditor } from "./ReactEditor";
import { t } from "../../../lib/i18nRuntime";

const TextEditorComponent = ({
  initialValue,
  onChange,
  onExit,
}: {
  initialValue: string | null | undefined;
  onChange: (val: string) => void;
  onExit: () => void;
}) => {
  const inputRef = useRef<InputRef>(null);
  const [value, setValue] = useState<string>(initialValue ?? "");

  useEffect(() => {
    // Force focus with a small delay to ensure mounting is complete
    const timer = setTimeout(() => {
      inputRef.current?.focus({ cursor: "end" });
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "2px solid #2563EB",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            onExit();
          }
        }}
        onBlur={onExit}
        placeholder={t("common.inputPlaceholder")}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 0,
          padding: "0 16px",
          fontSize: 13,
        }}
        variant="borderless"
      />
    </div>
  );
};

export class TextEditor extends ReactEditor {
  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "string"
        ? this.value
        : this.value == null
        ? ""
        : String(this.value);
    this.root.render(
      <TextEditorComponent
        initialValue={normalizedValue}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />
    );
  }
}
