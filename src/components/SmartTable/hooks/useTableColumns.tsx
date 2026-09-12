/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { useMemo, type MutableRefObject } from "react";
import { CustomLayout } from "@visactor/vtable";
import { useSmartTableStore } from "../../../store/useSmartTableStore";
import type {
  Field,
  SortCondition,
  GroupConfig,
} from "../../../store/useSmartTableStore";
import { renderHeader, renderAddColumnHeader } from "../renderers/renderHeader";
import { renderMember } from "../renderers/renderMember";
import { renderSelect } from "../renderers/renderSelect";
import { renderMultiSelect } from "../renderers/renderMultiSelect";
import { renderDate } from "../renderers/renderDate";
import { renderText } from "../renderers/renderText";
import { renderNumber } from "../renderers/renderNumber";
import { renderUrl } from "../renderers/renderUrl";
import { renderImage } from "../renderers/renderImage";
import { renderRating } from "../renderers/renderRating";
import { renderProgress } from "../renderers/renderProgress";
import { renderAttachment } from "../renderers/renderAttachment";
import { renderFormula } from "../renderers/renderFormula";
import { renderRelation } from "../renderers/renderRelation";
import { renderAutoNumber } from "../renderers/renderAutoNumber";
import {
  getRelationProperty,
  type RelationLabelMap,
} from "../relation/relationTypes";
import { useRelationLabels } from "../relation/useRelationLabels";
import {
  svgToDataUrl,
  squareOutlinedSvg,
  minusSquareOutlinedSvg,
  checkSquareFilledSvg,
  gripDotsOutlinedSvg,
  expandDiagonalOutlinedSvg,
} from "../icons";

void jsx;

const RowIndexGroup = CustomLayout.Group as unknown as LayoutComponent;
const RowIndexText = CustomLayout.Text as unknown as LayoutComponent;
const RowIndexImage = CustomLayout.Image as unknown as LayoutComponent;

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

type CellLayoutArgs = {
  table: {
    getCellRect: (
      col: number,
      row: number,
    ) => { height: number; width: number };
    getRecordByRowCol: (
      col: number,
      row: number,
    ) => Record<string, unknown> | null;
    getCellCheckboxState?: (col: number, row: number) => boolean;
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

type ColumnOption = { id: string; label: string; color?: string };

type ColumnDef = {
  field: string;
  title?: string;
  width?: number;
  headerType?: string;
  cellType?: string;
  tree?: boolean;
  headerCustomLayout?: (args: HeaderLayoutArgs) => unknown;
  customLayout?: (args: CellLayoutArgs) => unknown;
  editor?: string;
  options?: ColumnOption[];
  format?: string;
  unit?: string;
  max?: number;
  memberMultiple?: boolean;
  style?: Record<string, unknown>;
  [key: string]: unknown;
};

const renderRowIndex = (
  args: CellLayoutArgs,
  hoveredRowRef: MutableRefObject<number | null>,
  selectedRowIdsRef: MutableRefObject<Set<string>>,
  groupConfig: GroupConfig,
) => {
  const { table, row, col, rect, data } = args;
  if (
    data?.isGroup ||
    data?.vtableMerge ||
    data?.id === "__add_row__" ||
    data?.id === "__spacer__"
  ) {
    return { renderDefault: true };
  }
  const record = table.getRecordByRowCol(col, row);
  const rowId =
    typeof record?.id === "string"
      ? record.id
      : typeof data?.id === "string"
        ? data.id
        : null;
  const isChecked = rowId ? selectedRowIdsRef.current.has(rowId) : false;
  const isHovered = hoveredRowRef.current === row;
  const shouldShowCheckbox = isHovered || isChecked;
  const { height, width } = rect ?? table.getCellRect(col, row);
  if (shouldShowCheckbox) {
    const icon = isChecked ? checkSquareFilledSvg : squareOutlinedSvg;
    const checkboxImage = (
      <RowIndexImage
        attribute={{
          width: 18,
          height: 18,
          image: svgToDataUrl(icon),
          cursor: "pointer",
          marginRight: isHovered ? 8 : 0,
        }}
      />
    );
    (checkboxImage as { role?: string }).role = "selection-toggle-row";
    if (isHovered) {
      const dragImage = (
        <RowIndexImage
          attribute={{
            width: 14,
            height: 14,
            image: svgToDataUrl(gripDotsOutlinedSvg),
            cursor: "grab",
            marginRight: 8,
          }}
        />
      );
      (dragImage as { role?: string }).role = "row-drag-handle";
      const expandImage = (
        <RowIndexImage
          attribute={{
            width: 16,
            height: 16,
            image: svgToDataUrl(expandDiagonalOutlinedSvg),
            cursor: "pointer",
          }}
        />
      );
      (expandImage as { role?: string }).role = "row-expand-toggle";
      const container = (
        <RowIndexGroup
          attribute={{
            width,
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {dragImage}
          {checkboxImage}
          {expandImage}
        </RowIndexGroup>
      );
      return { rootContainer: container, renderDefault: false };
    }
    const container = (
      <RowIndexGroup
        attribute={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checkboxImage}
      </RowIndexGroup>
    );
    return { rootContainer: container, renderDefault: false };
  }
  const computeGroupedIndex = () => {
    let count = 0;
    for (let i = row; i >= 0; i -= 1) {
      const rec = table.getRecordByRowCol(col, i) as {
        id?: string;
        isGroup?: boolean;
        vtableMerge?: boolean;
      } | null;
      if (rec?.isGroup || rec?.vtableMerge) break;
      if (rec?.id && rec.id !== "__add_row__" && rec.id !== "__spacer__") {
        count += 1;
      }
    }
    return count;
  };
  const indexText = groupConfig.fieldId
    ? String(computeGroupedIndex())
    : String(row);
  return {
    rootContainer: (
      <RowIndexGroup
        attribute={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RowIndexText
          attribute={{
            text: indexText,
            fontSize: 12,
            fill: "#667085",
          }}
        />
      </RowIndexGroup>
    ),
    renderDefault: false,
  };
};

const renderSelectionHeader = (
  args: HeaderLayoutArgs,
  selectionSummaryRef: MutableRefObject<{
    selectedCount: number;
    totalCount: number;
  }>,
) => {
  const rect = args.rect ?? args.table.getCellRect(args.col, 0);
  const { selectedCount, totalCount } = selectionSummaryRef.current;
  const icon =
    totalCount > 0 && selectedCount === totalCount
      ? checkSquareFilledSvg
      : selectedCount > 0
        ? minusSquareOutlinedSvg
        : squareOutlinedSvg;
  const image = (
    <RowIndexImage
      attribute={{
        width: 18,
        height: 18,
        image: svgToDataUrl(icon),
        cursor: "pointer",
      }}
    />
  );
  (image as { role?: string }).role = "selection-toggle-all";
  const container = (
    <RowIndexGroup
      attribute={{
        width: rect.width,
        height: rect.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {image}
    </RowIndexGroup>
  );
  return { rootContainer: container, renderDefault: false };
};

const buildFieldColumn = (
  field: Field,
  index: number,
  sort: SortCondition | null,
  relationLabels: RelationLabelMap,
) => {
  const baseCol: ColumnDef = {
    field: field.id,
    title: field.name,
    width: 150,
    headerCustomLayout: (args: HeaderLayoutArgs) =>
      renderHeader(args, field, sort),
  };

  if (String(field.type) === "relation") {
    const relation = getRelationProperty(field);
    baseCol.customLayout = (args: CellLayoutArgs) =>
      renderRelation(args, relationLabels[field.id] || {});
    baseCol.editor = "relation-editor";
    baseCol.relationFieldId = field.id;
    baseCol.relationMultiple = relation.multiple !== false;
    baseCol.width = 190;
  } else if (String(field.type) === "formula") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderFormula(args);
    baseCol.width = 170;
    baseCol.style = {
      ...(baseCol.style || {}),
      bgColor: "#FCFCFD",
    };
  } else if (field.type === "autoNumber") {
    baseCol.customLayout = (args: CellLayoutArgs) =>
      renderAutoNumber(args, field);
    baseCol.width = 160;
    baseCol.style = {
      ...(baseCol.style || {}),
      bgColor: "#FCFCFD",
    };
  } else if (field.type === "progress") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderProgress(args, field);
    baseCol.editor = "progress-editor";
    baseCol.max = field.property?.max || 100;
    baseCol.width = 180;
  } else if (field.type === "member") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderMember(args, field);
    baseCol.editor = "member-editor";
    baseCol.options = field.options || [];
    baseCol.memberMultiple = field.property?.multiple !== false;
  } else if (field.type === "select") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderSelect(args, field);
    baseCol.editor = "select-editor";
    baseCol.options = field.options || [];
  } else if (field.type === "multiSelect") {
    baseCol.customLayout = (args: CellLayoutArgs) =>
      renderMultiSelect(args, field);
    baseCol.editor = "multi-select-editor";
    baseCol.options = field.options || [];
  } else if (field.type === "date") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderDate(args, field);
    baseCol.editor = "date-editor";
    baseCol.format = field.property?.format;
  } else if (field.type === "number") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderNumber(args, field);
    baseCol.editor = "number-editor";
    baseCol.unit = field.property?.unit;
  } else if (field.type === "url") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderUrl(args);
    baseCol.editor = "url-editor";
  } else if (field.type === "image") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderImage(args);
    baseCol.editor = "image-editor";
  } else if (field.type === "rating") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderRating(args, field);
    baseCol.editor = "rating-editor";
    baseCol.max = field.property?.max;
  } else if (field.type === "attachment") {
    baseCol.customLayout = (args: CellLayoutArgs) => renderAttachment(args);
    baseCol.editor = "attachment-editor";
  } else {
    if (index === 0) {
      baseCol.editor = "task-title-editor";
      baseCol.customLayout = renderText;
    } else {
      baseCol.editor = "text-editor";
      baseCol.customLayout = renderText;
    }
  }

  if (index === 0) {
    baseCol.style = {
      ...(baseCol.style || {}),
      borderColor: "#EAECF0",
      borderLineWidth: [1, 1, 1, 0],
    };
    baseCol.headerStyle = {
      borderColor: "#EAECF0",
      borderLineWidth: [1, 1, 1, 0],
    };
  }

  return baseCol;
};

export const useTableColumns = (
  visibleFields: Field[],
  sorts: SortCondition[],
  groupConfig: GroupConfig,
  hoveredRowRef: MutableRefObject<number | null>,
  selectedRowIdsRef: MutableRefObject<Set<string>>,
  selectionSummaryRef: MutableRefObject<{
    selectedCount: number;
    totalCount: number;
  }>,
) => {
  const currentTableId = useSmartTableStore((state) => state.currentTableId);
  const records = useSmartTableStore((state) => state.records);
  const relationLabels = useRelationLabels(currentTableId, visibleFields, records);

  return useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [];
    const hasGroup = !!groupConfig.fieldId;

    const checkboxCol: ColumnDef = {
      cellType: "text",
      width: 80,
      minWidth: 80,
      maxWidth: 80,
      disableColumnResize: true,
      disableHeaderSelect: true,
      disableHover: true,
      disableHeaderHover: true,
      field: "selection",
      style: {
        borderColor: "#EAECF0",
        borderLineWidth: [1, 0, 1, 1],
      },
      headerStyle: {
        borderColor: "#EAECF0",
        borderLineWidth: [1, 0, 1, 1],
      },
      headerCustomLayout: (args: HeaderLayoutArgs) =>
        renderSelectionHeader(args, selectionSummaryRef),
      customLayout: (args: CellLayoutArgs) =>
        renderRowIndex(args, hoveredRowRef, selectedRowIdsRef, groupConfig),
    };

    if (hasGroup) {
      checkboxCol.tree = true;
    }

    cols.push(checkboxCol);

    const fieldCols: ColumnDef[] = visibleFields.map(
      (field: Field, index: number) =>
        buildFieldColumn(
          field,
          index,
          sorts.find((s) => s.fieldId === field.id) || null,
          relationLabels,
        ),
    );

    cols.push(...fieldCols);

    cols.push({
      headerCustomLayout: renderAddColumnHeader,
      width: 60,
      field: "add-column",
      disableColumnResize: true,
      disableHeaderSelect: true,
    });

    return cols;
  }, [
    visibleFields,
    sorts,
    groupConfig,
    hoveredRowRef,
    selectedRowIdsRef,
    selectionSummaryRef,
    relationLabels,
  ]);
};
