import { CustomLayout } from "@visactor/vtable";
import { renderMember } from "./renderers/renderMember";
import { renderSelect } from "./renderers/renderSelect";
import { renderMultiSelect } from "./renderers/renderMultiSelect";
import { renderDate } from "./renderers/renderDate";
import { renderText } from "./renderers/renderText";
import { renderNumber } from "./renderers/renderNumber";
import { renderUrl } from "./renderers/renderUrl";
import { renderImage } from "./renderers/renderImage";
import { renderRating } from "./renderers/renderRating";
import {
  svgToDataUrl,
  plusOutlinedSvg,
  caretRightFilledSvg,
  caretDownFilledSvg,
} from "./icons";
import type { Field, TableRecord } from "../../store/useSmartTableStore";

export type GroupTitleLayoutArgs = {
  table: {
    getRecordByCell: (col: number, row: number) => TableRecord | null;
    getHierarchyState: (col: number, row: number) => string;
    getCellRect: (
      col: number,
      row: number,
    ) => { width: number; height: number };
  };
  row: number;
  col: number;
  rect?: { width: number; height: number };
};

type GroupRecord = TableRecord & {
  id?: string;
  isGroup?: boolean;
  vtableMerge?: boolean;
  vtableMergeName?: string;
  children?: unknown[];
};

type VTableNode = Parameters<CustomLayout.Group["add"]>[0];

export type LayoutRoleTarget = {
  role?: string;
  fieldId?: string;
  groupTitle?: string;
};

const parseGroupTitle = (mergeName?: string) => {
  if (!mergeName) return "";
  const parts = String(mergeName).split("###");
  return parts.length > 1 ? parts[1] : String(mergeName);
};

const getGroupDisplayTitle = (mergeName?: string) => {
  const raw = parseGroupTitle(mergeName);
  if (!raw || raw === "Uncategorized" || raw === "No Grouping") {
    return "未分组";
  }
  return raw;
};

const splitGroupValues = (title: string) =>
  title
    .split(",")
    .map((val) => val.trim())
    .filter(Boolean);

const mapOptionValue = (value: string, field?: Field) => {
  const options = field?.options || [];
  const option = options.find((opt) => opt.id === value || opt.label === value);
  return option?.id ?? value;
};

const mapOptionValues = (values: string[], field?: Field) =>
  values.map((value) => mapOptionValue(value, field));

const getDateValueForGroupTitle = (title: string) => {
  if (!title || title === "Uncategorized" || title === "No Grouping")
    return null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (title === "Today") return base.getTime();
  if (title === "Tomorrow") {
    base.setDate(base.getDate() + 1);
    return base.getTime();
  }
  if (title === "Next 7 Days") {
    base.setDate(base.getDate() + 2);
    return base.getTime();
  }
  if (title === "Later") {
    base.setDate(base.getDate() + 14);
    return base.getTime();
  }
  if (title === "Expired" || title === "Past") {
    base.setDate(base.getDate() - 1);
    return base.getTime();
  }
  if (title === "Unscheduled") return null;
  const parsed = new Date(title);
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const getGroupValueForField = (title: string, field?: Field) => {
  if (!field) return null;
  if (!title || title === "Uncategorized" || title === "No Grouping") {
    return null;
  }
  if (field.type === "select") {
    return mapOptionValue(title, field);
  }
  if (field.type === "multiSelect") {
    const values = splitGroupValues(title);
    return mapOptionValues(values, field);
  }
  if (field.type === "member") {
    const values = splitGroupValues(title);
    return mapOptionValues(values, field);
  }
  if (field.type === "date") {
    return getDateValueForGroupTitle(title);
  }
  if (field.type === "number" || field.type === "progress") {
    const num = Number(title);
    return isNaN(num) ? null : num;
  }
  if (field.type === "rating") {
    const num = Number(title);
    return isNaN(num) ? null : num;
  }
  return title;
};

const createGroupValueLayout = (
  args: GroupTitleLayoutArgs & { value?: unknown },
  field?: Field,
  rawTitle?: string,
) => {
  if (!field) return null;
  if (rawTitle === "Uncategorized") return null;
  const { table } = args;
  if (field.type === "member") {
    const fakeTable = {
      getRecordByRowCol: () => ({
        [field.id]: args.value,
      }),
      getCellRect: (c: number, r: number) => table.getCellRect(c, r),
    };
    return renderMember({ ...args, table: fakeTable }, field)
      .rootContainer as VTableNode;
  }
  if (field.type === "select") {
    return renderSelect(args, field).rootContainer as VTableNode;
  }
  if (field.type === "multiSelect") {
    return renderMultiSelect(args, field).rootContainer as VTableNode;
  }
  if (field.type === "date") {
    return renderDate(args, field).rootContainer as VTableNode;
  }
  if (field.type === "number" || field.type === "progress") {
    return renderNumber(args, field).rootContainer as VTableNode;
  }
  if (field.type === "url") {
    return renderUrl(args).rootContainer as VTableNode;
  }
  if (field.type === "image") {
    return renderImage(args).rootContainer as VTableNode;
  }
  if (field.type === "rating") {
    return renderRating(args, field).rootContainer as VTableNode;
  }
  return renderText(args).rootContainer as VTableNode;
};

export const renderGroupTitleLayout = (
  args: GroupTitleLayoutArgs,
  fields: Field[],
  groupFieldId: string | null,
  hoveredRow: number | null,
  allowInsert: boolean,
) => {
  const { table, row, col, rect } = args;
  const record = table.getRecordByCell(col, row);
  const data = record as GroupRecord | null;
  if (data?.id === "__add_row__" || data?.id === "__spacer__") {
    return { renderDefault: true };
  }
  const width = rect?.width ?? 0;
  const height = rect?.height ?? 0;
  const container = new CustomLayout.Group({
    x: 0,
    y: 0,
    width,
    height,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  });
  if (data?.isGroup || data?.vtableMerge) {
    const groupField = fields.find((f) => f.id === groupFieldId);
    const mergeName =
      typeof data?.vtableMergeName === "string" ? data.vtableMergeName : undefined;
    const rawTitle = parseGroupTitle(mergeName);
    const title = getGroupDisplayTitle(mergeName);
    const count = data?.children?.length ?? 0;

    const hierarchyState = table.getHierarchyState(col, row);
    const iconSvg =
      hierarchyState === "expand" ? caretDownFilledSvg : caretRightFilledSvg;
    const icon = new CustomLayout.Image({
      width: 16,
      height: 16,
      image: svgToDataUrl(iconSvg),
      cursor: "pointer",
      marginLeft: 8,
      marginRight: 6,
    });
    (icon as unknown as LayoutRoleTarget).role = "group-toggle";
    container.add(icon as VTableNode);

    const groupValue = getGroupValueForField(rawTitle, groupField);
    const valueLayout = createGroupValueLayout(
      {
        ...args,
        value: groupValue,
        rect: undefined,
      },
      groupField,
      rawTitle,
    );

    if (valueLayout) {
      container.add(valueLayout);
    } else {
      const titleText = new CustomLayout.Text({
        text: title,
        fontSize: 14,
        fontWeight: "bold",
        fill: "#111827",
        textBaseline: "middle",
        marginRight: 6,
      });
      container.add(titleText as VTableNode);
    }
    const countText = new CustomLayout.Text({
      text: `(${count})`,
      fontSize: 12,
      fill: "#6b7280",
      textBaseline: "middle",
      marginLeft: 6,
    });
    container.add(countText as unknown as VTableNode);

    if (hoveredRow === row && allowInsert) {
      const addIcon = new CustomLayout.Image({
        width: 16,
        height: 16,
        image: svgToDataUrl(plusOutlinedSvg),
        cursor: "pointer",
        marginLeft: 8,
      });
      const addTarget = addIcon as unknown as LayoutRoleTarget;
      addTarget.role = "group-add-row";
      addTarget.groupTitle = rawTitle;
      container.add(addIcon as unknown as VTableNode);
    }

    return {
      rootContainer: container,
      renderDefault: false,
    };
  }
  const text = new CustomLayout.Text({
    text: data?.vtableMergeName || data?.id,
    marginLeft: 12,
    fontSize: 14,
    fill: "#111827",
  });
  container.add(text as unknown as VTableNode);
  return {
    rootContainer: container,
    renderDefault: false,
  };
};

export const handleGroupTitleAction = ({
  target,
  table,
  col,
  row,
  fields,
  groupFieldId,
  insertRow,
  allowInsert,
}: {
  target?: LayoutRoleTarget;
  table: { toggleHierarchyState: (col: number, row: number) => void };
  col: number;
  row: number;
  fields: Field[];
  groupFieldId: string | null;
  insertRow: (preset?: Record<string, unknown>) => void;
  allowInsert: boolean;
}) => {
  if (!target) return false;
  if (target.role === "group-add-row") {
    if (!allowInsert) return false;
    const groupField = fields.find((f) => f.id === groupFieldId);
    const title = target.groupTitle;
    if (!title) {
      insertRow();
      return true;
    }
    if (groupField?.type === "autoNumber") {
      // Auto-number values are server assigned and read-only. Creating a row
      // from an auto-number group must not attempt to preset that field.
      insertRow();
      return true;
    }
    const presetValue = getGroupValueForField(title, groupField);
    if (groupField && presetValue !== null && presetValue !== undefined) {
      insertRow({ [groupField.id]: presetValue });
    } else {
      insertRow();
    }
    return true;
  }
  if (target.role === "group-toggle") {
    table.toggleHierarchyState(col, row);
    return true;
  }
  return false;
};
