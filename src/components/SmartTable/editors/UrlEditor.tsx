import { Input } from "antd";
import { ReactEditor } from "./ReactEditor";

const UrlEditorComponent = ({
  initialValue,
  onChange,
  onExit,
}: {
  initialValue: string | null | undefined;
  onChange: (val: string) => void;
  onExit: () => void;
}) => {
  const normalizedValue =
    typeof initialValue === "string"
      ? initialValue
      : initialValue == null
      ? ""
      : String(initialValue);
  return (
    <Input
      autoFocus
      defaultValue={normalizedValue}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          onExit();
        }
      }}
      onBlur={onExit}
      variant="borderless"
      placeholder="https://"
    />
  );
};

export class UrlEditor extends ReactEditor {
  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "string"
        ? this.value
        : this.value == null
        ? ""
        : String(this.value);
    this.root.render(
      <UrlEditorComponent
        initialValue={normalizedValue}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />
    );
  }
}
