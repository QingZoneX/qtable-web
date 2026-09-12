import { useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import * as VTableGantt from "@visactor/vtable-gantt";
import { Modal, Button, Typography, Select } from "antd";
import {
  permissionAllows,
  type SortCondition,
  useSmartTableStore,
  type Field,
  type TableRecord,
} from "../../../store/useSmartTableStore";
import { useTableRecords } from "../hooks/useTableRecords";
import { vtableTheme } from "../config/theme";
import { createRenderers } from "../renderers/createRenderers";
import { renderProgress } from "../renderers/renderProgress";
import { renderAttachment } from "../renderers/renderAttachment";
import type { CustomLayoutLike } from "../utils/vtable-jsx";
import { registerCustomEditors } from "../registerEditors";
import { InputEditor } from "@visactor/vtable-editors";
import {
  TextEditor,
  SelectEditor,
  DateEditor,
  MultiSelectEditor,
  MemberSelectEditor,
  TaskTitleEditor,
  NumberEditor,
  UrlEditor,
  ImageEditor,
  RatingEditor,
  ProgressEditor,
} from "../editors";
import { t } from "../../../lib/i18n";
import { ensureVisActorBrowserEnv } from "../../../lib/visactorEnv";

// Extend dayjs with isoWeek plugin
dayjs.extend(isoWeek);

// Initialize VisActor browser environment early
let vrenderInitialized = false;
const initVisActorEnv = () => {
  if (vrenderInitialized) return;
  ensureVisActorBrowserEnv();
  vrenderInitialized = true;
};

// ---------------------------------------------------------------------------
// Gantt package provides its own VTable & CustomLayout.  We must use *that*
// copy when building custom-layout primitives so the internal ListTable can
// recognise them (instanceof checks fail across different bundle copies).
// The same isolation applies to the editor registry — editors registered via
// @visactor/vtable's register are invisible to gantt's internal ListTable.
// ---------------------------------------------------------------------------
type GanttVTable = {
  CustomLayout: CustomLayoutLike;
  register: {
    editor: (key: string, instance: unknown) => void;
  };
};

type GanttExports = {
  VTable: GanttVTable;
};

const ganttExports = VTableGantt as unknown as GanttExports;
const ganttCL = ganttExports.VTable.CustomLayout;
const ganttRegister = ganttExports.VTable.register;

// Register editors with the gantt bundle's own registry
const registerGanttEditors = () => {
  ganttRegister.editor("input-editor", new InputEditor());
  ganttRegister.editor("text-editor", new TextEditor());
  ganttRegister.editor("select-editor", new SelectEditor());
  ganttRegister.editor("multi-select-editor", new MultiSelectEditor());
  ganttRegister.editor("member-editor", new MemberSelectEditor());
  ganttRegister.editor("date-editor", new DateEditor());
  ganttRegister.editor("task-title-editor", new TaskTitleEditor());
  ganttRegister.editor("number-editor", new NumberEditor());
  ganttRegister.editor("url-editor", new UrlEditor());
  ganttRegister.editor("image-editor", new ImageEditor());
  ganttRegister.editor("rating-editor", new RatingEditor());
  ganttRegister.editor("progress-editor", new ProgressEditor());
};

// Register with gantt's isolated registry so its internal ListTable can
// find the editor instances.  Editors are also registered with the
// @visactor/vtable registry via GridView.tsx → registerCustomEditors().
registerGanttEditors();

const {
  renderText,
  renderNumber,
  renderDate,
  renderSelect,
  renderMultiSelect,
  renderMember,
  renderUrl,
  renderImage,
  renderRating,
} = createRenderers(ganttCL);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GanttViewProps = {
  configModalOpen?: boolean;
  onConfigModalOpen?: () => void;
  onConfigModalClose?: () => void;
};

type GanttInstance = {
  release?: () => void;
  resize?: () => void;
};

type GanttConstructor = {
  Gantt: new (container: HTMLElement, option: unknown) => GanttInstance;
};

type GanttTaskRecord = TableRecord & {
  __gantt_title: string;
  __gantt_developer: string;
  __gantt_priority: string;
  __gantt_start: string;
  __gantt_end: string;
  __gantt_progress: number;
  type: "task";
};

type HeaderLayoutArgs = {
  table: {
    getCellRect: (
      col: number,
      row: number
    ) => { height: number; width: number };
  };
  col: number;
  rect?: { height: number; width: number };
  value?: string;
};

type GanttDateRangeEvent = {
  record?: { id?: string };
  startDate: Date | string | number;
  endDate: Date | string | number;
};

type GanttProgressEvent = {
  record?: { id?: string };
  progress: number;
};

type CellLayoutArgs = {
  table: {
    getCellRect: (
      col: number,
      row: number
    ) => { height: number; width: number };
    getRecordByRowCol: (
      col: number,
      row: number
    ) => Record<string, unknown> | null;
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

type RawCustomLayoutArgs = {
  table: {
    getCellRect: (
      col: number,
      row: number
    ) => { height: number; width: number };
    getRecordByRowCol?: (
      col: number,
      row: number
    ) => Record<string, unknown> | null;
    getRecordByCell?: (
      col: number,
      row: number
    ) => Record<string, unknown> | null;
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

registerCustomEditors();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLayoutRecord = (
  table: RawCustomLayoutArgs["table"],
  col: number,
  row: number
) => {
  try {
    if (table.getRecordByRowCol) {
      return table.getRecordByRowCol.call(table, col, row);
    }
  } catch {
    void 0;
  }
  try {
    if (table.getRecordByCell) {
      return table.getRecordByCell.call(table, col, row);
    }
  } catch {
    void 0;
  }
  return null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" || typeof value === "string") {
    const candidate = dayjs(value);
    if (candidate.isValid()) return candidate.toDate();
  }
  return null;
};

const formatDate = (value: Date) => dayjs(value).format("YYYY-MM-DD");

const resolveTextField = (field: Field, value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (field.type === "select") {
    const option =
      field.options?.find((item) => item.id === value) ||
      field.options?.find((item) => item.label === value);
    return option?.label ?? String(value);
  }
  if (field.type === "multiSelect" || field.type === "member") {
    const values = Array.isArray(value) ? value : [value];
    return values
      .map((item) => {
        const option =
          field.options?.find((opt) => opt.id === item) ||
          field.options?.find((opt) => opt.label === item);
        return option?.label ?? String(item);
      })
      .filter(Boolean)
      .join(", ");
  }
  if (field.type === "date") {
    const date = toDate(value);
    return date ? formatDate(date) : "";
  }
  if (field.type === "image") {
    return Array.isArray(value) ? `${value.length}` : value ? "1" : "0";
  }
  return String(value);
};

const getColumnWidth = (field: Field) => {
  if (field.type === "progress" || field.type === "rating") return 90;
  if (field.type === "date") return 120;
  if (field.type === "member" || field.type === "multiSelect") return 130;
  return 120;
};

const toTimestamp = (value: unknown) => {
  const date = toDate(value);
  return date ? date.getTime() : null;
};

const parseEditedValue = (field: Field, value: unknown) => {
  if (field.type === "date") {
    return toTimestamp(value);
  }
  if (
    field.type === "number" ||
    field.type === "progress" ||
    field.type === "rating"
  ) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return value;
};

const resolveRect = (
  table: RawCustomLayoutArgs["table"] | HeaderLayoutArgs["table"],
  col: number,
  row: number,
  rect?: { height: number; width: number }
) => {
  if (rect && rect.width > 1 && rect.height > 1) return rect;
  const getCellRect = (targetRow: number) => {
    try {
      const cellRect = table.getCellRect.call(table, col, targetRow);
      if (cellRect.width > 1 && cellRect.height > 1) {
        return cellRect;
      }
    } catch {
      void 0;
    }
    return null;
  };
  return getCellRect(row) ?? getCellRect(0) ?? { width: 120, height: 44 };
};

const normalizeLayoutArgs = (
  args: RawCustomLayoutArgs,
  fieldId: string
): CellLayoutArgs => {
  const table = args.table;
  const getCellRect = (col: number, row: number) => {
    try {
      return table.getCellRect.call(table, col, row);
    } catch {
      return args.rect ?? { width: 120, height: 44 };
    }
  };
  const getRecordByRowCol = (col: number, row: number) =>
    getLayoutRecord(table, col, row);
  let resolvedValue = args.value;
  if (resolvedValue === undefined) {
    const record = getRecordByRowCol(args.col, args.row);
    if (record) {
      resolvedValue = record[fieldId];
    }
  }
  const rect = resolveRect(table, args.col, args.row, args.rect);
  return {
    ...args,
    rect,
    value: resolvedValue,
    table: {
      getCellRect,
      getRecordByRowCol,
    },
  };
};

const safeHeaderLayout = (
  args: HeaderLayoutArgs,
  field: Field,
  sort: SortCondition | null
) => {
  void args;
  void field;
  void sort;
  return { renderDefault: true };
};

const safeCellLayout = (
  args: RawCustomLayoutArgs,
  fieldId: string,
  render: (normalized: CellLayoutArgs) => unknown
) => {
  try {
    return render(normalizeLayoutArgs(args, fieldId));
  } catch {
    void 0;
  }
  return { renderDefault: true };
};

// ---------------------------------------------------------------------------
// Column builder
// ---------------------------------------------------------------------------

const buildTaskListColumn = (
  field: Field,
  index: number,
  sort: SortCondition | null
) => {
  const column: Record<string, unknown> = {
    field: field.id,
    title: field.name,
    width: getColumnWidth(field),
    sort: true,
    tree: index === 0,
    headerCustomLayout: (args: HeaderLayoutArgs) =>
      safeHeaderLayout(args, field, sort),
    headerStyle: {
      bgColor: vtableTheme.headerStyle.bgColor,
      color: vtableTheme.headerStyle.color,
      fontSize: vtableTheme.headerStyle.fontSize,
      fontWeight: vtableTheme.headerStyle.fontWeight,
      borderColor: vtableTheme.headerStyle.borderColor,
      borderLineWidth: 1,
    },
    style: {
      bgColor: vtableTheme.bodyStyle.bgColor,
      color: vtableTheme.bodyStyle.color,
      fontSize: vtableTheme.bodyStyle.fontSize,
      borderColor: vtableTheme.bodyStyle.borderColor,
      borderLineWidth: 1,
    },
  };

  if (field.type === "progress") {
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderProgress(normalized, field)
      );
    column.editor = "progress-editor";
    column.max = field.property?.max || 100;
  } else if (field.type === "select") {
    column.editor = "select-editor";
    column.options = field.options || [];
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderSelect(normalized, field)
      );
  } else if (field.type === "multiSelect") {
    column.editor = "multi-select-editor";
    column.options = field.options || [];
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderMultiSelect(normalized, field)
      );
  } else if (field.type === "member") {
    column.editor = "member-editor";
    column.options = field.options || [];
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderMember(normalized, field)
      );
  } else if (field.type === "date") {
    column.editor = "date-editor";
    column.format = field.property?.format;
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderDate(normalized, field)
      );
  } else if (field.type === "number") {
    column.editor = "number-editor";
    column.unit = field.property?.unit;
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderNumber(normalized, field)
      );
  } else if (field.type === "url") {
    column.editor = "url-editor";
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) => renderUrl(normalized));
  } else if (field.type === "image") {
    column.editor = "image-editor";
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) => renderImage(normalized));
  } else if (field.type === "rating") {
    column.editor = "rating-editor";
    column.max = field.property?.max;
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) =>
        renderRating(normalized, field)
      );
  } else if (field.type === "attachment") {
    column.editor = "attachment-editor";
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) => renderAttachment(normalized));
  } else {
    column.editor = index === 0 ? "task-title-editor" : "text-editor";
    column.customLayout = (args: RawCustomLayoutArgs) =>
      safeCellLayout(args, field.id, (normalized) => renderText(normalized));
  }

  if (index === 0) {
    column.style = {
      ...(column.style as Record<string, unknown>),
      borderColor: "#EAECF0",
      borderLineWidth: [1, 1, 1, 0],
    };
    column.headerStyle = {
      ...(column.headerStyle as Record<string, unknown>),
      borderColor: "#EAECF0",
      borderLineWidth: [1, 1, 1, 0],
    };
    column.disableColumnResize = true;
    column.disableHover = true;
    column.disableHeaderHover = true;
  }

  return column;
};

// ---------------------------------------------------------------------------
// Field resolvers
// ---------------------------------------------------------------------------

const resolveTitleField = (fields: Field[]) =>
  fields.find((field) => /task|title|name/i.test(field.name)) ||
  fields.find((field) => field.type === "text") ||
  fields[0];

const resolveDeveloperField = (fields: Field[]) =>
  fields.find(
    (field) =>
      field.type === "member" &&
      /owner|assignee|developer|负责人|成员/i.test(field.name)
  ) || fields.find((field) => field.type === "member");

const resolvePriorityField = (fields: Field[]) =>
  fields.find((field) => /priority|优先级/i.test(field.name)) ||
  fields.find((field) => field.type === "select");

// ---------------------------------------------------------------------------
// Gantt field validation
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GanttView({ configModalOpen, onConfigModalOpen, onConfigModalClose }: GanttViewProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<GanttInstance | null>(null);
  // Don't use local state for field selection - read directly from view config
  const {
    fields,
    records,
    filters,
    sorts,
    groupConfig,
    hiddenFieldIds,
    currentViewId,
    views,
    currentPermission,
    updateRecord,
    addField,
    updateViewConfig,
  } = useSmartTableStore();
  const canUpdate = permissionAllows(currentPermission, "update");
  
  // Read gantt config directly from current view
  const currentView = useMemo(() => {
    return views.find(v => v.id === currentViewId);
  }, [views, currentViewId]);
  
  const ganttConfig = currentView?.config?.ganttConfig;
  
  const selectedStartField = ganttConfig?.startFieldId || null;
  const selectedEndField = ganttConfig?.endFieldId || null;
  const selectedProgressField = ganttConfig?.progressFieldId || null;
  
  // Check if config is incomplete - don't auto-show modal
  useEffect(() => {
    if (!ganttConfig) {
      console.log('[GanttView] No gantt config');
      return;
    }
    
    const { startFieldId, endFieldId, progressFieldId } = ganttConfig;
    const hasAllFields = !!(startFieldId && endFieldId && progressFieldId);
    
    console.log('[GanttView] Config check:', {
      hasAllFields,
      startFieldId,
      endFieldId,
      progressFieldId,
    });
    // Don't auto-show modal, let user click the button
  }, [ganttConfig]);
  
  // Use refs to track latest values without triggering re-renders
  const fieldsRef = useRef(fields);
  const recordsRef = useRef(records);
  const canUpdateRef = useRef(canUpdate);
  
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);
  
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);
  
  useEffect(() => {
    canUpdateRef.current = canUpdate;
  }, [canUpdate]);
  const processedRecords = useTableRecords(
    records,
    fields,
    filters,
    sorts,
    groupConfig
  );
  const visibleFields = useMemo(
    () => fields.filter((field) => !hiddenFieldIds.includes(field.id)),
    [fields, hiddenFieldIds]
  );

  const titleField = useMemo(() => resolveTitleField(fields), [fields]);
  const startField = useMemo(
    () => fields.find((f) => f.id === selectedStartField),
    [fields, selectedStartField]
  );
  const endField = useMemo(
    () => fields.find((f) => f.id === selectedEndField),
    [fields, selectedEndField]
  );
  const progressField = useMemo(
    () => fields.find((f) => f.id === selectedProgressField),
    [fields, selectedProgressField]
  );
  const developerField = useMemo(() => resolveDeveloperField(fields), [fields]);
  const priorityField = useMemo(() => resolvePriorityField(fields), [fields]);

  const ganttColumns = useMemo(
    () =>
      visibleFields.map((field, index) =>
        buildTaskListColumn(
          field,
          index,
          sorts.find((item) => item.fieldId === field.id) || null
        )
      ),
    [sorts, visibleFields]
  );

  const ganttRecords = useMemo<GanttTaskRecord[]>(
    () =>
      processedRecords.map((record, index) => {
        const titleValue = titleField ? record[titleField.id] : undefined;
        const title = titleValue ? String(titleValue) : `任务 ${index + 1}`;

        let startDate = startField ? toDate(record[startField.id]) : null;
        let endDate = endField ? toDate(record[endField.id]) : null;

        if (!startDate && endDate) {
          startDate = dayjs(endDate).subtract(7, "day").toDate();
        }
        if (startDate && !endDate) {
          endDate = dayjs(startDate).add(7, "day").toDate();
        }
        if (!startDate && !endDate) {
          startDate = dayjs()
            .add(index * 2, "day")
            .toDate();
          endDate = dayjs(startDate).add(3, "day").toDate();
        }
        if (startDate && endDate && dayjs(startDate).isAfter(endDate)) {
          const temp = startDate;
          startDate = endDate;
          endDate = temp;
        }
        const normalizedStart =
          startDate ??
          dayjs()
            .add(index * 2, "day")
            .toDate();
        const normalizedEnd =
          endDate ?? dayjs(normalizedStart).add(3, "day").toDate();

        const progressRaw = progressField
          ? Number(record[progressField.id] ?? 0)
          : 0;
        const progressMax = progressField?.property?.max || 100;
        const progress =
          progressField?.type === "progress"
            ? clamp((progressRaw / progressMax) * 100, 0, 100)
            : clamp(progressRaw, 0, 100);

        const developer = developerField
          ? resolveTextField(developerField, record[developerField.id])
          : "";
        const priority = priorityField
          ? resolveTextField(priorityField, record[priorityField.id])
          : "";

        return {
          ...record,
          __gantt_title: title,
          __gantt_developer: developer,
          __gantt_priority: priority,
          __gantt_start: formatDate(normalizedStart),
          __gantt_end: formatDate(normalizedEnd),
          __gantt_progress: Number(progress.toFixed(1)),
          type: "task",
        } as GanttTaskRecord;
      }),
    [
      developerField,
      endField,
      priorityField,
      processedRecords,
      progressField,
      startField,
      titleField,
    ]
  );

  const { minDate, maxDate } = useMemo(() => {
    if (!ganttRecords.length) {
      return {
        minDate: dayjs().subtract(7, "day").format("YYYY-MM-DD"),
        maxDate: dayjs().add(21, "day").format("YYYY-MM-DD"),
      };
    }
    const starts = ganttRecords.map((record) => dayjs(record.__gantt_start));
    const ends = ganttRecords.map((record) => dayjs(record.__gantt_end));
    const min = starts.reduce((acc, next) => (next.isBefore(acc) ? next : acc));
    const max = ends.reduce((acc, next) => (next.isAfter(acc) ? next : acc));
    return {
      minDate: min.subtract(7, "day").format("YYYY-MM-DD"),
      maxDate: max.add(14, "day").format("YYYY-MM-DD"),
    };
  }, [ganttRecords]);

  const ganttOption = useMemo(
    () => ({
      records: ganttRecords,
      taskListTable: {
        columns: ganttColumns,
        tableWidth: 520,
        minTableWidth: 320,
        maxTableWidth: 880,
        editCellRule: () => canUpdate,
        editCellTrigger: canUpdate ? "click" : "api",
        hover: { highlightMode: "cross" },
        theme: vtableTheme,
      },
      tasksShowMode: "tasks_separate",
      frame: {
        verticalSplitLineMoveable: true,
        outerFrameStyle: {
          borderLineWidth: [0, 0, 1, 0],
          borderColor: vtableTheme.frameStyle.borderColor,
          cornerRadius: vtableTheme.frameStyle.radius,
        },
        verticalSplitLine: {
          lineWidth: 2,
          lineColor: vtableTheme.bodyStyle.borderColor,
        },
        verticalSplitLineHighlight: {
          lineColor: vtableTheme.columnResize.lineColor,
          lineWidth: 2,
        },
      },
      grid: {
        verticalLine: {
          lineWidth: 1,
          lineColor: vtableTheme.bodyStyle.borderColor,
        },
        horizontalLine: {
          lineWidth: 1,
          lineColor: vtableTheme.bodyStyle.borderColor,
        },
      },
      headerRowHeight: 44,
      rowHeight: 44,
      taskBar: {
        selectable: true,
        startDateField: "__gantt_start",
        endDateField: "__gantt_end",
        progressField: "__gantt_progress",
        labelText: "{__gantt_title} ({__gantt_progress}%)",
        labelTextStyle: {
          fontFamily: vtableTheme.bodyStyle.fontFamily,
          fontSize: 13,
          fontWeight: 500,
          textAlign: "left",
          color: "#FFFFFF",
          textOverflow: "ellipsis",
          padding: [0, 8, 0, 8],
        },
        barStyle: {
          width: 28,
          barColor: "#9CA3AF",
          completedBarColor: "#3B82F6",
          cornerRadius: 6,
          borderWidth: 0,
          borderColor: "transparent",
          completedBarBorderWidth: 0,
          shadow: {
            x: 0,
            y: 2,
            blur: 4,
            color: "rgba(59, 130, 246, 0.15)",
          },
        },
        hoverBarStyle: {
          barColor: "#6B7280",
          completedBarColor: "#2563EB",
          opacity: 0.9,
          shadow: {
            x: 0,
            y: 3,
            blur: 6,
            color: "rgba(37, 99, 235, 0.3)",
          },
        },
        selectedBarStyle: {
          barColor: "#4B5563",
          completedBarColor: "#1D4ED8",
          borderWidth: 2,
          borderColor: "#2563EB",
          shadow: {
            x: 0,
            y: 4,
            blur: 8,
            color: "rgba(29, 78, 216, 0.35)",
          },
        },
        progressAdjustable: canUpdate,
      },
      timelineHeader: {
        verticalLine: {
          lineWidth: 1,
          lineColor: vtableTheme.headerStyle.borderColor,
        },
        horizontalLine: {
          lineWidth: 1,
          lineColor: vtableTheme.headerStyle.borderColor,
        },
        backgroundColor: vtableTheme.headerStyle.bgColor,
        colWidth: 40,
        scales: [
          {
            unit: "week",
            step: 1,
            startOfWeek: "monday",
            format(date: { dateIndex: number; startDate?: Date }) {
              // Calculate the actual ISO week number from the startDate
              if (date.startDate) {
                const day = dayjs(date.startDate);
                // ISO week: get the week number in the year (1-53)
                const week = day.isoWeek();
                return `第 ${week} 周`;
              }
              // Fallback to dateIndex if startDate is not available
              return `第 ${date.dateIndex} 周`;
            },
            style: {
              fontSize: 11,
              fontWeight: 600,
              color: vtableTheme.headerStyle.color,
              textAlign: "center",
              backgroundColor: vtableTheme.headerStyle.bgColor,
            },
          },
          {
            unit: "day",
            step: 1,
            format(date: { dateIndex: number }) {
              return String(date.dateIndex);
            },
            style: {
              fontSize: 11,
              color: vtableTheme.headerStyle.color,
              textAlign: "center",
              backgroundColor: vtableTheme.headerStyle.bgColor,
            },
          },
        ],
      },
      minDate,
      maxDate,
      rowSeriesNumber: {
        title: "#",
        width: 50,
        disableColumnResize: true,
        disableHover: true,
        disableHeaderHover: true,
        headerStyle: {
          bgColor: vtableTheme.headerStyle.bgColor,
          color: vtableTheme.headerStyle.color,
          borderColor: vtableTheme.headerStyle.borderColor,
          borderLineWidth: [1, 0, 1, 1],
        },
        style: {
          bgColor: vtableTheme.bodyStyle.bgColor,
          color: vtableTheme.bodyStyle.color,
          borderColor: vtableTheme.bodyStyle.borderColor,
          borderLineWidth: [1, 0, 1, 1],
        },
      },
      scrollStyle: {
        visible: "scrolling",
        width: 8,
        scrollRailColor: "#F3F4F6",
        scrollSliderColor: "#D1D5DB",
      },
      overscrollBehavior: "none",
    }),
    [canUpdate, ganttColumns, ganttRecords, maxDate, minDate]
  );

  const ganttOptionRef = useRef(ganttOption);
  const ganttRecordsRef = useRef(ganttRecords);
  const ganttColumnsRef = useRef(ganttColumns);
  
  useEffect(() => {
    ganttOptionRef.current = ganttOption;
  }, [ganttOption]);
  
  useEffect(() => {
    ganttRecordsRef.current = ganttRecords;
  }, [ganttRecords]);
  
  useEffect(() => {
    ganttColumnsRef.current = ganttColumns;
  }, [ganttColumns]);

  // Initialize Gantt instance when data is available
  useEffect(() => {
    // Initialize VisActor environment first
    initVisActorEnv();
    
    if (!containerRef.current) {
      console.log('[GanttView] Container not ready');
      return;
    }
    
    // Check if we're in a browser environment with canvas support
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.log('[GanttView] Not in browser environment');
      return;
    }
    
    // Defer initialization to next frame to avoid blocking paint
    const initId = requestAnimationFrame(() => {
      // Double-check container still exists
      if (!containerRef.current) {
        console.log('[GanttView] Container removed before initialization');
        return;
      }
      
      // If gantt instance already exists, update it
      if (ganttRef.current) {
        console.log('[GanttView] Instance exists, updating with', ganttRecords.length, 'records');
        const gantt = ganttRef.current as unknown as {
          setRecords?: (records: GanttTaskRecord[]) => void;
          updateOption?: (options: Record<string, unknown>) => void;
          renderWithRecreateCells?: () => void;
        };
        
        try {
          if (gantt.setRecords) {
            gantt.setRecords(ganttRecords);
          } else if (gantt.updateOption) {
            gantt.updateOption(ganttOption);
          }
          if (gantt.renderWithRecreateCells) {
            gantt.renderWithRecreateCells();
          }
        } catch (e) {
          console.error('[GanttView] Failed to update:', e);
        }
        return;
      }
      
      console.log('[GanttView] Creating new Gantt instance with', ganttRecords.length, 'records');
      
      try {
        const { Gantt } = VTableGantt as unknown as GanttConstructor;
        const gantt = new Gantt(containerRef.current!, ganttOption);
        ganttRef.current = gantt;
        
        console.log('[GanttView] Gantt instance created successfully');
      } catch (error) {
        console.error('[GanttView] Failed to create Gantt instance:', error);
        return;
      }
      
      // Setup event listeners (use ganttRef.current to avoid scope issues)
      const currentGantt = ganttRef.current;
      if (!currentGantt) {
        console.error('[GanttView] Gantt instance is null after creation');
        return;
      }
      
      const taskListTable = (
        currentGantt as unknown as {
          taskListTableInstance?: {
            on?: (event: string, handler: (args: unknown) => void) => void;
            getRecordByCell?: (col: number, row: number) => TableRecord | null;
            getBodyField?: (col: number, row: number) => string | null;
            clearSelected?: () => void;
            clearSelection?: () => void;
            clearSelectedCell?: () => void;
            clearSelectedCells?: () => void;
            renderWithRecreateCells?: () => void;
            EVENT_TYPE?: {
              MOUSEMOVE_CELL?: string;
              MOUSELEAVE_TABLE?: string;
            };
          };
        }
      ).taskListTableInstance;
      
      // Use refs to avoid stale closures
      const updateFieldValue = (
        recordId: string,
        fieldId: string,
        value: unknown
      ) => {
        const field = fieldsRef.current.find((item) => item.id === fieldId);
        if (!field) return;
        updateRecord(recordId, fieldId, parseEditedValue(field, value));
      };
      
      taskListTable?.on?.("change_cell_value", (args: unknown) => {
        if (!canUpdateRef.current) return;
        const payload = args as {
          col: number;
          row: number;
          changedValue?: unknown;
        };
        const record = taskListTable.getRecordByCell?.(payload.col, payload.row);
        const fieldId = taskListTable.getBodyField?.(payload.col, payload.row);
        if (!record?.id || !fieldId) return;
        updateFieldValue(record.id, fieldId, payload.changedValue ?? null);
      });

      taskListTable?.on?.("click_cell", (args: unknown) => {
        const payload = args as { col: number; row: number };
        if (payload.col === 0) {
          taskListTable.clearSelected?.();
          taskListTable.clearSelection?.();
          taskListTable.clearSelectedCell?.();
          taskListTable.clearSelectedCells?.();
        }
      });

      const eventTypes = taskListTable?.EVENT_TYPE;
      if (eventTypes?.MOUSEMOVE_CELL) {
        taskListTable?.on?.(eventTypes.MOUSEMOVE_CELL, () => {});
      }
      if (eventTypes?.MOUSELEAVE_TABLE) {
        taskListTable?.on?.(eventTypes.MOUSELEAVE_TABLE, () => {
          taskListTable?.renderWithRecreateCells?.();
        });
      }
      
      const ganttEventApi = currentGantt as unknown as {
        on?: (event: string, handler: (args: unknown) => void) => void;
      };
      
      ganttEventApi.on?.("change_date_range", (args: unknown) => {
        if (!canUpdateRef.current) return;
        const payload = args as GanttDateRangeEvent;
        const recordId = payload.record?.id;
        if (!recordId) return;
        const currentFields = fieldsRef.current;
        const startField = currentFields.find(f => f.id === selectedStartField);
        const endField = currentFields.find(f => f.id === selectedEndField);
        if (!startField || !endField) return;
        updateRecord(
          recordId,
          startField.id,
          dayjs(payload.startDate).valueOf()
        );
        updateRecord(recordId, endField.id, dayjs(payload.endDate).valueOf());
      });
      
      ganttEventApi.on?.("progress_update", (args: unknown) => {
        if (!canUpdateRef.current) return;
        const payload = args as GanttProgressEvent;
        const recordId = payload.record?.id;
        if (!recordId) return;
        const currentFields = fieldsRef.current;
        const progressField = currentFields.find(f => f.id === selectedProgressField);
        if (!progressField) return;
        const max = progressField.property?.max || 100;
        const rawProgress =
          progressField.type === "progress"
            ? (Number(payload.progress) / 100) * max
            : Number(payload.progress);
        updateRecord(recordId, progressField.id, rawProgress);
      });
      
      const observer = new ResizeObserver(() => {
        // Check if gantt instance still exists before calling resize
        if (ganttRef.current) {
          ganttRef.current.resize?.();
        }
      });
      observer.observe(containerRef.current!);
      
      return () => {
        observer.disconnect();
        if (ganttRef.current) {
          ganttRef.current.release?.();
          ganttRef.current = null;
        }
      };
    });
    
    return () => {
      cancelAnimationFrame(initId);
    };
  }, [ganttOption, ganttRecords, selectedEndField, selectedProgressField, selectedStartField, updateRecord]); // Re-run when dependencies change

  const dateFields = useMemo(
    () => fields.filter((field) => field.type === "date"),
    [fields]
  );
  const progressFields = useMemo(
    () =>
      fields.filter(
        (field) => field.type === "progress" || field.type === "number"
      ),
    [fields]
  );

  const handleCreateMissingField = async () => {
    if (!currentViewId) return;
    
    const baseId = Date.now();
    const newFields: Field[] = [];
    let newStartFieldId = selectedStartField;
    let newEndFieldId = selectedEndField;
    let newProgressFieldId = selectedProgressField;

    if (!selectedStartField) {
      const field: Field = {
        id: `f_start_${baseId}`,
        name: "开始时间",
        type: "date",
        property: { format: "YYYY-MM-DD" },
      };
      newFields.push(field);
      newStartFieldId = field.id;
    }

    if (!selectedEndField) {
      const field: Field = {
        id: `f_end_${baseId + 1}`,
        name: "结束时间",
        type: "date",
        property: { format: "YYYY-MM-DD" },
      };
      newFields.push(field);
      newEndFieldId = field.id;
    }

    if (!selectedProgressField) {
      const field: Field = {
        id: `f_progress_${baseId + 2}`,
        name: "进展",
        type: "progress",
        property: { max: 100 },
      };
      newFields.push(field);
      newProgressFieldId = field.id;
    }

    // Add all missing fields
    newFields.forEach((field) => addField(field));

    // Update view config with new field IDs
    const config = {
      ...(currentView?.config || {}),
      ganttConfig: {
        startFieldId: newStartFieldId,
        endFieldId: newEndFieldId,
        progressFieldId: newProgressFieldId,
      },
    };
    updateViewConfig(currentViewId, config);
    onConfigModalClose?.();
  };

  const handleFieldSelectionChange = (
    type: "start" | "end" | "progress",
    fieldId: string | null
  ) => {
    if (!currentViewId) return;
    
    // Update the view config directly
    const newConfig = {
      ...(currentView?.config || {}),
      ganttConfig: {
        startFieldId: type === "start" ? fieldId : ganttConfig?.startFieldId,
        endFieldId: type === "end" ? fieldId : ganttConfig?.endFieldId,
        progressFieldId: type === "progress" ? fieldId : ganttConfig?.progressFieldId,
      },
    };
    updateViewConfig(currentViewId, newConfig);
  };

  const handleConfirmSelection = () => {
    if (selectedStartField && selectedEndField && selectedProgressField) {
      onConfigModalClose?.();
    }
  };

  const handleSkipValidation = () => {
    onConfigModalClose?.();
  };

  const hasRequiredFields = useMemo(() => {
    const result = !!(selectedStartField && selectedEndField && selectedProgressField);
    return result;
  }, [selectedEndField, selectedProgressField, selectedStartField]);

  return (
    <>
      {/* Warning view when required fields are missing */}
      {!hasRequiredFields ? (
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 16,
          }}
        >
          <Typography.Text type="warning" style={{ fontSize: 16 }}>
            {t('gantt.missingRequiredFields')}
          </Typography.Text>
          <Button
            type="primary"
            onClick={() => onConfigModalOpen?.()}
          >
            {t('gantt.configureRequiredFields')}
          </Button>
        </div>
      ) : (
        <div
          style={{
            height: "100%",
            width: "100%",
            backgroundColor: "#fff",
          }}
        >
          <div
            ref={containerRef}
            style={{ height: "100%", width: "100%", minHeight: 200 }}
          />
        </div>
      )}

      <Modal
        title={t('gantt.configureFields')}
        open={configModalOpen ?? false}
        onCancel={handleSkipValidation}
        footer={[
          <Button key="skip" onClick={handleSkipValidation}>
            {t('gantt.configureLater')}
          </Button>,
          <Button
            key="create"
            onClick={handleCreateMissingField}
            disabled={!canUpdate}
          >
            {t('gantt.autoCreateFields')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirmSelection}
            disabled={
              !selectedStartField || !selectedEndField || !selectedProgressField
            }
          >
            {t('gantt.confirmConfig')}
          </Button>,
        ]}
        closable={true}
        maskClosable={true}
        width={600}
      >
        <div style={{ padding: "16px 0" }}>
          <Typography.Paragraph>
            {t('gantt.configRequired')}
          </Typography.Paragraph>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Typography.Text strong>{t('gantt.startField')}</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                placeholder={t('gantt.selectStartDateField')}
                value={selectedStartField}
                onChange={(value) => handleFieldSelectionChange("start", value)}
                options={dateFields.map((field) => ({
                  label: field.name,
                  value: field.id,
                }))}
                allowClear
              />
            </div>
            <div>
              <Typography.Text strong>{t('gantt.endField')}</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                placeholder={t('gantt.selectEndDateField')}
                value={selectedEndField}
                onChange={(value) => handleFieldSelectionChange("end", value)}
                options={dateFields.map((field) => ({
                  label: field.name,
                  value: field.id,
                }))}
                allowClear
              />
            </div>
            <div>
              <Typography.Text strong>{t('gantt.progressField')}</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                placeholder={t('gantt.selectProgressField')}
                value={selectedProgressField}
                onChange={(value) =>
                  handleFieldSelectionChange("progress", value)
                }
                options={progressFields.map((field) => ({
                  label: `${field.name} (${field.type === "progress" ? t('gantt.progressField') : t('toolbar.fields')})`,
                  value: field.id,
                }))}
                allowClear
              />
            </div>
          </div>
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            {t('gantt.configHint')}
          </Typography.Paragraph>
        </div>
      </Modal>
    </>
  );
}
