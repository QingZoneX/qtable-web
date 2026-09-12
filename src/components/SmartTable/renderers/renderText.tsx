/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, alignLeftOutlinedSvg } from "../icons";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;

export const renderText = (args: {
  table: {
    getCellRect: (
      col: number,
      row: number,
    ) => { height: number; width: number };
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
}) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = args.value;
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  if (value !== null && value !== undefined && value !== "") {
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
              text: String(value),
              fontSize: 13,
              fontFamily: "sans-serif",
              fill: "#111827",
              maxLineWidth: innerWidth,
              ellipsis: true,
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
            image: svgToDataUrl(alignLeftOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
