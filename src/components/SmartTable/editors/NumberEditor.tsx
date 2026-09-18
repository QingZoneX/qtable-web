import { InputNumber } from "antd";
import { ReactEditor } from "./ReactEditor";

const NumberEditorComponent = ({
  initialValue,
  onChange,
  onExit,
}: {
  initialValue: number | string | null | undefined;
  onChange: (val: number | null) => void;
  onExit: () => void;
}) => {
  const normalizedValue =
    typeof initialValue === "number"
      ? initialValue
      : initialValue == null || initialValue === ""
      ? undefined
      : Number(initialValue);
  return (
    <InputNumber<number>
      autoFocus
      defaultValue={normalizedValue}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "44px",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
      }}
      controls={false}
      onChange={(val) => {
        onChange(val ?? null);
      }}
      onBlur={() => {
        // Delay to allow other events
        setTimeout(onExit, 100);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          onExit();
        }
      }}
      variant="borderless"
    />
  );
};

export class NumberEditor extends ReactEditor {
  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "number"
        ? this.value
        : this.value == null || this.value === ""
        ? undefined
        : Number(this.value);
    this.root.render(
      <NumberEditorComponent
        initialValue={normalizedValue}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />
    );
  }
}
