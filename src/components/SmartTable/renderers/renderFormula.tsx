/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;

const isFormulaError = (value: unknown) =>
  typeof value === "string" && /^#[A-Z0-9/]+!$/.test(value);

const formatFormulaValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "#NUM!";
  if (Array.isArray(value)) return value.map((item) => formatFormulaValue(item)).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export const renderFormula = (args: {
  table: {
    getCellRect: (col: number, row: number) => { height: number; width: number };
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
}) => {
  const { table, row, col, rect, value } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const text = formatFormulaValue(value);
  const error = isFormulaError(value);
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  return {
    rootContainer: (
      <Group
        attribute={{
          x,
          width: innerWidth,
          height,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Text
          attribute={{
            text: text || "fx",
            fontSize: 13,
            fontFamily: error
              ? "ui-monospace, SFMono-Regular, Menlo, monospace"
              : "sans-serif",
            fill: error ? "#D92D20" : text ? "#475467" : "#98A2B3",
            fontWeight: error ? 600 : 400,
            maxLineWidth: innerWidth,
            ellipsis: true,
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
