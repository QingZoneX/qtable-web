/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, linkOutlinedSvg } from "../icons";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;

type CellLayoutArgs = {
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
};

export const renderUrl = (args: CellLayoutArgs) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = args.value;
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  if (value) {
    const textValue = typeof value === "string" ? value : String(value);
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
          <Group
            attribute={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <Image
              attribute={{
                width: 14,
                height: 14,
                image: svgToDataUrl(linkOutlinedSvg),
                marginRight: 4,
              }}
            />
            <Text
              attribute={{
                text: textValue.replace(/^https?:\/\//, ""),
                fontSize: 13,
                fontFamily: "sans-serif",
                fill: "#2563EB", // Blue-600
                underline: 0,
                maxLineWidth: innerWidth - 18,
                ellipsis: true,
              }}
            />
          </Group>
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
            image: svgToDataUrl(linkOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
