import { CustomLayout } from "@visactor/vtable";
import {
  svgToDataUrl,
  triangleUpFilledSvg,
  triangleDownFilledSvg,
  ellipsisOutlinedSvg,
  plusOutlinedSvg,
} from "../icons";
import type { Field } from "../../../store/useSmartTableStore";

type HeaderLayoutArgs = {
  table: {
    getCellRect: (
      col: number,
      row: number,
    ) => { height: number; width: number };
  };
  col: number;
  rect?: { height: number; width: number };
  value?: string;
};

type RoleTarget = {
  role?: string;
  fieldId?: string;
};
type LayoutContainer = {
  add: (node: unknown) => void;
};

export const renderHeader = (
  args: HeaderLayoutArgs,
  field: Field,
  sortState: { fieldId: string; order: "asc" | "desc" } | null,
) => {
  const { table, col, rect, value } = args;
  const fallbackRect = () => {
    try {
      return table.getCellRect(col, -1);
    } catch {
      try {
        return table.getCellRect(col, 0);
      } catch {
        return { width: 120, height: 44 };
      }
    }
  };
  const { height, width } = rect ?? fallbackRect();

  const container = new CustomLayout.Group({
    height,
    width: width - 16,
    x: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }) as unknown as LayoutContainer;

  // Title with left margin simulation
  const titleContainer = new CustomLayout.Group({
    height,
    width: width - 66,
    display: "flex",
    alignItems: "center",
  }) as unknown as LayoutContainer;

  const title = new CustomLayout.Text({
    text: value || field.name || "",
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    fill: "rgba(0, 0, 0, 0.88)",
    fontWeight: 600,
    textBaseline: "middle",
    ellipsis: true,
    maxLineWidth: width - 66,
  });
  titleContainer.add(title as unknown);

  // Right container for icons
  const rightContainer = new CustomLayout.Group({
    height: 20,
    width: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  }) as unknown as LayoutContainer;

  // Sort Icon
  let sortIconSvg = triangleUpFilledSvg;
  let sortOpacity = 0.3;

  if (sortState && sortState.fieldId === field.id) {
    sortOpacity = 1;
    sortIconSvg =
      sortState.order === "asc" ? triangleUpFilledSvg : triangleDownFilledSvg;
  }

  const sortIcon = new CustomLayout.Image({
    width: 16,
    height: 16,
    image: svgToDataUrl(sortIconSvg),
    cursor: "pointer",
    opacity: sortOpacity,
    marginLeft: 4,
  });
  const sortRoleTarget = sortIcon as unknown as RoleTarget;
  sortRoleTarget.role = "sort-icon";
  sortRoleTarget.fieldId = field.id;

  // More Icon
  const moreIcon = new CustomLayout.Image({
    width: 16,
    height: 16,
    image: svgToDataUrl(ellipsisOutlinedSvg),
    marginLeft: 4,
    cursor: "pointer",
  });
  const moreRoleTarget = moreIcon as unknown as RoleTarget;
  moreRoleTarget.role = "more-icon";
  moreRoleTarget.fieldId = field.id;

  rightContainer.add(sortIcon as unknown);
  rightContainer.add(moreIcon as unknown);

  container.add(titleContainer as unknown);
  container.add(rightContainer as unknown);

  return {
    rootContainer: container,
    renderDefault: false,
  };
};

export const renderAddColumnHeader = (args: HeaderLayoutArgs) => {
  const { table, col, rect } = args;
  const fallbackRect = () => {
    try {
      return table.getCellRect(col, -1);
    } catch {
      try {
        return table.getCellRect(col, 0);
      } catch {
        return { width: 60, height: 44 };
      }
    }
  };
  const { height, width } = rect ?? fallbackRect();

  const container = new CustomLayout.Group({
    height,
    width,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fill: "transparent", // Make clickable
  }) as unknown as LayoutContainer;

  const icon = new CustomLayout.Image({
    width: 20,
    height: 20,
    image: svgToDataUrl(plusOutlinedSvg),
    cursor: "pointer",
  });

  const containerRoleTarget = container as unknown as RoleTarget;
  containerRoleTarget.role = "add-column";
  const iconRoleTarget = icon as unknown as RoleTarget;
  iconRoleTarget.role = "add-column";

  container.add(icon as unknown);

  return {
    rootContainer: container,
    renderDefault: false,
  };
};
