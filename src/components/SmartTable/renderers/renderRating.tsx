/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, starFilledSvg, starOutlinedSvg } from "../icons";
import type { Field } from "../../../store/useSmartTableStore";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;

type CellLayoutArgs = {
  table: { getCellRect: (col: number, row: number) => { height: number; width: number } };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
};

export const renderRating = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = Number(args.value) || 0;
  const max = field.property?.max || 5;
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  const iconSize = 16;
  const gap = 2;

  const stars = [];
  for (let i = 1; i <= max; i++) {
    const isFilled = i <= value;
    stars.push(
      <Image
        attribute={{
          width: iconSize,
          height: iconSize,
          image: svgToDataUrl(isFilled ? starFilledSvg : starOutlinedSvg),
          marginRight: gap,
        }}
      />
    );
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
        {stars}
      </Group>
    ),
    renderDefault: false,
  };
};
