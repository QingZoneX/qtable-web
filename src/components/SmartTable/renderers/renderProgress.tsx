/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import type { Field } from "../../../store/useSmartTableStore";

void jsx;

type CellLayoutArgs = {
  table: {
    getCellRect: (col: number, row: number) => { height: number; width: number };
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
  data?: {
    id?: string;
    isGroup?: boolean;
    vtableMerge?: boolean;
    [key: string]: unknown;
  };
};

const CELL_PADDING_X = 16;
const PROGRESS_BAR_HEIGHT = 8;
const PROGRESS_BAR_RADIUS = 4;

export const renderProgress = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const rawValue = args.value;
  const x = CELL_PADDING_X;
  const innerWidth = Math.max(0, width - x * 2);
  const max = field.property?.max || 100;
  
  // Calculate percentage
  const numericValue = Number(rawValue);
  const percentage = Number.isFinite(numericValue) && max > 0 
    ? Math.min(100, Math.max(0, (numericValue / max) * 100)) 
    : 0;
  const clampedPercentage = Math.round(percentage);
  
  const barWidth = Math.max(0, innerWidth - 50); // Reserve 50px for percentage text
  const filledWidth = (barWidth * clampedPercentage) / 100;
  const centerY = height / 2;
  const barTopY = centerY - PROGRESS_BAR_HEIGHT / 2;

  // Use VTable primitives
  const Group = CustomLayout.Group as unknown as LayoutComponent;
  const Text = CustomLayout.Text as unknown as LayoutComponent;
  const Rect = CustomLayout.Rect as unknown as LayoutComponent;

  // Empty state or 0% - show only empty bar without text
  if (rawValue === null || rawValue === undefined || rawValue === "" || clampedPercentage === 0) {
    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height }}>
          {/* Background bar */}
          <Rect
            attribute={{
              x: 0,
              y: barTopY,
              width: barWidth,
              height: PROGRESS_BAR_HEIGHT,
              cornerRadius: PROGRESS_BAR_RADIUS,
              fill: "#F3F4F6",
            }}
          />
        </Group>
      ),
      renderDefault: false,
    };
  }

  // Determine color based on percentage
  let barColor: string;
  if (clampedPercentage === 100) {
    barColor = "#3B82F6";
  } else if (clampedPercentage >= 70) {
    barColor = "#60A5FA";
  } else if (clampedPercentage >= 30) {
    barColor = "#93C5FD";
  } else {
    barColor = "#BFDBFE";
  }

  return {
    rootContainer: (
      <Group attribute={{ x, width: innerWidth, height }}>
        {/* Background bar */}
        <Rect
          attribute={{
            x: 0,
            y: barTopY,
            width: barWidth,
            height: PROGRESS_BAR_HEIGHT,
            cornerRadius: PROGRESS_BAR_RADIUS,
            fill: "#F3F4F6",
          }}
        />
        {/* Filled bar - absolutely positioned on top */}
        <Rect
          attribute={{
            x: 0,
            y: barTopY,
            width: filledWidth,
            height: PROGRESS_BAR_HEIGHT,
            cornerRadius: PROGRESS_BAR_RADIUS,
            fill: barColor,
          }}
        />
        {/* Percentage text */}
        <Text
          attribute={{
            x: barWidth + 8,
            y: centerY - 7,
            text: `${clampedPercentage}%`,
            fontSize: 13,
            fill: "#111827",
            fontWeight: 500,
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
