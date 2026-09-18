import { useState } from "react";
import { Select } from "antd";
import { ReactEditor } from "./ReactEditor";

// Simple Image Editor: Just allows adding/removing URLs via a Select with tags mode (created tags)
const ImageEditorComponent = ({
  initialValue,
  onChange,
  onExit,
}: {
  initialValue: string[] | string | null | undefined;
  onChange: (val: string[]) => void;
  onExit: () => void;
}) => {
  const normalizedValue = Array.isArray(initialValue)
    ? initialValue
    : initialValue
    ? [String(initialValue)]
    : [];

  const [value, setValue] = useState<string[]>(normalizedValue);

  return (
    <Select<string[]>
      mode="tags"
      autoFocus
      value={value}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
      placeholder="Enter Image URLs..."
      tokenSeparators={[","]}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          // Prevent default to avoid Antd Select from doing weird things with empty options
          // But we need to ensure the tag is added.
          // Actually, without defaultOpen, Enter should work fine to add tag.
          setTimeout(() => onExit(), 100);
        }
      }}
      onChange={(val) => {
        const next = Array.isArray(val) ? val : [];
        setValue(next);
        onChange(next);
      }}
      onBlur={() => {
        // Delay exit slightly
        setTimeout(onExit, 100);
      }}
      variant="borderless"
      dropdownStyle={{ display: "none" }} // Hide dropdown as we only want input
    />
  );
};

export class ImageEditor extends ReactEditor {
  render() {
    if (!this.root) return;
    const normalizedValue = Array.isArray(this.value)
      ? this.value.map((val) => String(val))
      : this.value == null
      ? []
      : [String(this.value)];
    this.root.render(
      <ImageEditorComponent
        initialValue={normalizedValue}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />
    );
  }
}
