/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, pictureOutlinedSvg } from "../icons";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
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

export const renderImage = (args: CellLayoutArgs) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = args.value;
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);
  // Normalize to array of strings
  const urls: string[] = Array.isArray(value)
    ? value
    : value
      ? [String(value)]
      : [];

  if (urls.length > 0) {
    const thumbSize = 24;
    const gap = 4;

    // We can use flex layout for images
    // However, VTable's flex might not automatically wrap images if we want to limit count or overflow.
    // Let's just render them in a row.

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
          {urls.map((url) => (
            <Image
              attribute={{
                width: thumbSize,
                height: thumbSize,
                image: url,
                shape: "circle",
                marginRight: gap,
              }}
            />
          ))}
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
            image: svgToDataUrl(pictureOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
