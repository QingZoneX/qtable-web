/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import type { Field } from "../../../store/useSmartTableStore";
import { getTextColor } from "../utils/colorUtils";
import { svgToDataUrl, radioOutlinedSvg } from "../icons";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;
const Tag = CustomLayout.Tag as unknown as LayoutComponent;

type CellLayoutArgs = {
  table: { getCellRect: (col: number, row: number) => { height: number; width: number } };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
};

export const renderSelect = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const value = args.value;
  const options = field.options || [];
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);

  if (value) {
    const selectedOption =
      options.find((opt) => opt.id === value) ||
      options.find((opt) => opt.label === value);

    if (selectedOption) {
      const { label, color } = selectedOption;

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
            <Tag
              attribute={{
                text: label.toUpperCase(),
                padding: [4, 8, 4, 8],
                textStyle: {
                  fontSize: 10,
                  fontWeight: "bold",
                  fill: getTextColor(color),
                  fontFamily: "sans-serif",
                },
                panel: {
                  visible: true,
                  fill: color,
                  cornerRadius: 4,
                },
              }}
            />
          </Group>
        ),
        renderDefault: false,
      };
    } else {
      // Fallback text
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
                text: value,
                fontSize: 14,
                fill: "#222329",
              }}
            />
          </Group>
        ),
        renderDefault: false,
      };
    }
  }

  // Empty state
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
            image: svgToDataUrl(radioOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
