import { useEffect, useRef, useState } from "react";
import { Input } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { ReactEditor } from "./ReactEditor";

// .vtable-editor-wrapper 上下各 2px 边框：内容高度要把这 4px 让出来，
// 否则底部（含 Shift+Enter 提示行）会被外框裁掉。
const EDITOR_FRAME_BORDER = 4;

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
    onHeightChange(40 + EDITOR_FRAME_BORDER);
  }, [onHeightChange]);

  useEffect(() => {
    const measure = () => {
      const ta = inputRef.current?.resizableTextArea?.textArea;
      if (!ta) return;
      ta.style.height = "auto";
      const natural = ta.scrollHeight;
      const h = Math.min(maxHeight, Math.max(minHeight, natural));
      setBoxHeight(h);
      onHeightChange(h + EDITOR_FRAME_BORDER);
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
        height: boxHeight,
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
          padding: "8px 6px",
          lineHeight: "1.5",
          backgroundColor: "#fff",
          overflowY: boxHeight >= maxHeight ? "auto" : "hidden",
        }}
        variant="borderless"
        // placeholder="输入标题，Shift+Enter 换行"
        autoSize={false}
      />
      <div
        style={{
          position: "absolute",
          right: 6,
          bottom: 2,
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
