/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, numberOutlinedSvg } from "../icons";
import type { Field } from "../../../store/useSmartTableStore";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;

type CellLayoutArgs = {
  table: {
    getCellRect: (col: number, row: number) => { height: number; width: number };
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
};

export const renderNumber = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = args.value;
  
  // New formatting options with backward compatibility
  const precision = field.property?.precision ?? 2;
  const useThousandsSeparator = field.property?.thousandsSeparator ?? true;
  const prefixText = field.property?.prefix || field.property?.currency || "";
  const suffixText = field.property?.suffix || field.property?.unit || "";
  
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  if (value !== null && value !== undefined && value !== "") {
    // Format the number based on settings
    const numericValue = Number(value);
    const formattedNumber = useThousandsSeparator
      ? numericValue.toLocaleString("en-US", {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })
      : numericValue.toFixed(precision);
    
    const displayText = `${prefixText}${formattedNumber}${suffixText}`;
    
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
              text: displayText,
              fontSize: 13,
              fontFamily: "sans-serif",
              fontWeight: "bold",
              fill: "#111827",
            }}
          />
        </Group>
      ),
      renderDefault: false,
    };
  }

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
        <Image
          attribute={{
            width: 16,
            height: 16,
            image: svgToDataUrl(numberOutlinedSvg),
            opacity: 0.5,
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
