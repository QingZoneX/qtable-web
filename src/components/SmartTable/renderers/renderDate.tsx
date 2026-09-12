/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, calendarOutlinedSvg } from "../icons";
import dayjs from "dayjs";
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

export const renderDate = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = args.value;
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  if (value) {
    const format = field.property?.format || "MMM DD, YYYY";
    const dateValue =
      typeof value === "string" || typeof value === "number" || value instanceof Date
        ? value
        : null;
    const dateStr = dayjs(dateValue).format(format);

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
              text: dateStr,
              fontSize: 13,
              fontFamily: "sans-serif",
              fill: "#4B5563",
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
            image: svgToDataUrl(calendarOutlinedSvg),
            opacity: 0.5,
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
