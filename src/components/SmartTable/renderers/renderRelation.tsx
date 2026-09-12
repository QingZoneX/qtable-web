/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { measureTextWidth } from "../utils/textUtils";
import { normalizeRelationIds } from "../relation/relationTypes";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Tag = CustomLayout.Tag as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;

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

const CELL_PADDING_X = 8;
const TAG_GAP = 6;
const TAG_PADDING = 16;

export const renderRelation = (
  args: CellLayoutArgs,
  labels: Record<string, string> = {},
) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const ids = normalizeRelationIds(args.value);
  const innerWidth = Math.max(0, width - CELL_PADDING_X * 2);

  if (ids.length === 0) {
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
          <Text
            attribute={{
              text: "↗",
              fontSize: 13,
              fill: "#94A3B8",
              fontFamily: "sans-serif",
            }}
          />
        </Group>
      ),
      renderDefault: false,
    };
  }

  const items = ids.map((id) => ({ id, title: labels[id] || id }));
  let usedWidth = 0;
  let showCount = 0;
  for (let index = 0; index < items.length; index += 1) {
    const title = items[index].title;
    const tagWidth = measureTextWidth(title, 12) + TAG_PADDING;
    const nextWidth = usedWidth + (showCount > 0 ? TAG_GAP : 0) + tagWidth;
    const remaining = items.length - index - 1;
    const reserve =
      remaining > 0
        ? TAG_GAP + measureTextWidth(`+${remaining}`, 12) + TAG_PADDING
        : 0;
    if (nextWidth + reserve > innerWidth) {
      if (showCount === 0) showCount = 1;
      break;
    }
    usedWidth = nextWidth;
    showCount += 1;
  }

  const visibleItems = items.slice(0, showCount);
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
        {visibleItems.map((item, index) => (
          <Tag
            attribute={{
              text: item.title,
              padding: [4, 8, 4, 8],
              textStyle: {
                fontSize: 12,
                fill: "#1D4ED8",
                fontFamily: "sans-serif",
              },
              panel: {
                visible: true,
                fill: "#EFF6FF",
                cornerRadius: 5,
                stroke: "#BFDBFE",
                lineWidth: 1,
              },
              marginRight: index < visibleItems.length - 1 ? TAG_GAP : 0,
            }}
          />
        ))}
        {showCount < items.length ? (
          <Tag
            attribute={{
              text: `+${items.length - showCount}`,
              padding: [4, 8, 4, 8],
              textStyle: {
                fontSize: 12,
                fill: "#475569",
                fontFamily: "sans-serif",
              },
              panel: {
                visible: true,
                fill: "#F1F5F9",
                cornerRadius: 5,
              },
              marginLeft: TAG_GAP,
            }}
          />
        ) : null}
      </Group>
    ),
    renderDefault: false,
  };
};
