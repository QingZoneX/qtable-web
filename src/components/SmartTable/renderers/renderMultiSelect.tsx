/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import type { Field } from "../../../store/useSmartTableStore";
import { getTextColor } from "../utils/colorUtils";
import { measureTextWidth } from "../utils/textUtils";
import { svgToDataUrl, checkSquareOutlinedSvg } from "../icons";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;
const Tag = CustomLayout.Tag as unknown as LayoutComponent;

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

const TAG_GAP = 8;
const TAG_PADDING = 16;
const CELL_PADDING_X = 8;

export const renderMultiSelect = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const values = args.value; // Expecting an array of IDs
  const options = field.options || [];
  const innerWidth = Math.max(0, width - CELL_PADDING_X * 2);

  if (Array.isArray(values) && values.length > 0) {
    const availableWidth = innerWidth;
    let usedWidth = 0;
    let showCount = 0;

    const selectedOptions = values.map((val) => {
      // Find by ID first, then label
      const opt =
        options.find((o) => o.id === val) ||
        options.find((o) => o.label === val);
      return opt
        ? { ...opt, label: opt.label }
        : { label: val, color: "#e0e0e0" };
    });

    // Calculate how many tags to show
    for (let i = 0; i < selectedOptions.length; i++) {
      const option = selectedOptions[i];
      const textWidth = measureTextWidth(option.label, 12);
      const tagWidth = textWidth + TAG_PADDING;
      const nextUsedWidth =
        usedWidth + tagWidth + (showCount > 0 ? TAG_GAP : 0);
      const remainingCount = selectedOptions.length - (i + 1);

      if (remainingCount > 0) {
        const moreText = `+${remainingCount}`;
        const moreWidth = measureTextWidth(moreText, 12) + TAG_PADDING;
        const requiredWidth = nextUsedWidth + TAG_GAP + moreWidth;
        if (requiredWidth > availableWidth) {
          if (showCount === 0) showCount = 1;
          break;
        }
      } else if (nextUsedWidth > availableWidth) {
        if (showCount === 0) showCount = 1;
        break;
      }

      usedWidth = nextUsedWidth;
      showCount += 1;
    }

    // Render visible tags
    const tags = [];

    for (let i = 0; i < showCount; i++) {
      const option = selectedOptions[i];
      const color = option.color || "#e0e0e0";

      tags.push(
        <Tag
          attribute={{
            text: option.label,
            padding: [4, 8, 4, 8],
            textStyle: {
              fontSize: 12,
              fill: getTextColor(color),
              fontFamily: "sans-serif",
            },
            panel: {
              visible: true,
              fill: color,
              cornerRadius: 4,
            },
            marginRight: i < showCount - 1 ? TAG_GAP : 0,
          }}
        />,
      );
    }

    // Render "+N" tag if needed
    if (showCount < selectedOptions.length) {
      const moreCount = selectedOptions.length - showCount;

      tags.push(
        <Tag
          attribute={{
            text: `+${moreCount}`,
            padding: [4, 8, 4, 8],
            textStyle: {
              fontSize: 12,
              fill: "#222329",
              fontFamily: "sans-serif",
            },
            panel: {
              visible: true,
              fill: "#f0f0f0",
              cornerRadius: 4,
            },
            marginLeft: TAG_GAP,
          }}
        />,
      );
    }

    return {
      rootContainer: (
        <Group
          attribute={{
            x: CELL_PADDING_X,
            width: innerWidth,
            height,
            display: "flex",
            alignItems: "center",
          }}
        >
          {tags}
        </Group>
      ),
      renderDefault: false,
    };
  }

  // Placeholder
  return {
    rootContainer: (
      <Group
        attribute={{
          x: CELL_PADDING_X,
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
            image: svgToDataUrl(checkSquareOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
