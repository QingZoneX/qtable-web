import { useEffect, useRef, useState } from "react";
import { Input } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { ReactEditor } from "./ReactEditor";

const TaskTitleEditorComponent = ({
  initialValue,
  onChange,
  onExit,
  onHeightChange,
  minHeight,
  maxHeight,
}: {
  initialValue: string | null | undefined;
  onChange: (val: string) => void;
  onExit: () => void;
  onHeightChange: (h: number) => void;
  minHeight: number;
  maxHeight: number;
}) => {
  const inputRef = useRef<TextAreaRef | null>(null);
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [boxHeight, setBoxHeight] = useState(40);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus({ cursor: "end" });
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    onHeightChange(40);
  }, [onHeightChange]);

  useEffect(() => {
    const measure = () => {
      const ta = inputRef.current?.resizableTextArea?.textArea;
      if (!ta) return;
      ta.style.height = "auto";
      const natural = ta.scrollHeight;
      const h = Math.min(maxHeight, Math.max(minHeight, natural));
      setBoxHeight(h);
      onHeightChange(h);
      ta.style.height = `${h}px`;
      ta.scrollTop = h === maxHeight ? ta.scrollHeight : 0;
    };
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [value, minHeight, maxHeight, onHeightChange]);

  return (
    <div
      style={{
        width: "100%",
        height: boxHeight - 2,
        position: "relative",
      }}
    >
      <Input.TextArea
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onExit();
          }
        }}
        // onBlur={onExit}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "4px",
          resize: "none",
          padding: "8px 16px",
          lineHeight: "1.5",
          backgroundColor: "#fff",
          border: "2px solid #2563EB",
          boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.1)",
          overflowY: boxHeight >= maxHeight ? "auto" : "hidden",
        }}
        variant="borderless"
        // placeholder="输入标题，Shift+Enter 换行"
        autoSize={false}
      />
      <div
        style={{
          position: "absolute",
          right: 3,
          bottom: 0,
          fontSize: "8px",
          color: "#c9c9c9",
          pointerEvents: "none",
        }}
      >
        Shift+Enter 换行， Enter 结束
      </div>
    </div>
  );
};

export class TaskTitleEditor extends ReactEditor {
  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "string"
        ? this.value
        : this.value == null
        ? undefined
        : String(this.value);
    this.root.render(
      <TaskTitleEditorComponent
        initialValue={normalizedValue}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
        onHeightChange={(h) => this.setHeight(h)}
        minHeight={40}
        maxHeight={200}
      />,
    );
  }
}
