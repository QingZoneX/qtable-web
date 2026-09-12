import { useEffect, useLayoutEffect, useRef, useMemo, useState, useCallback } from "react";
import { Button, Empty, message, Modal } from "antd";
import { ListTable } from "@visactor/vtable";
import {
  permissionAllows,
  useSmartTableStore,
} from "../../../store/useSmartTableStore";
import { t } from "../../../lib/i18nRuntime";
import { HeaderMenu } from "../HeaderMenu";
import { useTableColumns } from "../hooks/useTableColumns";
import { useTableRecords } from "../hooks/useTableRecords";
import { vtableTheme } from "../config/theme";
import { registerCustomEditors } from "../registerEditors";
import { ensureVisActorBrowserEnv } from "../../../lib/visactorEnv";
import { RowContextMenu } from "../RowContextMenu";
import { copyTextToClipboard } from "../utils/clipboard";
import {
  renderGroupTitleLayout,
  handleGroupTitleAction,
  type GroupTitleLayoutArgs,
  type LayoutRoleTarget,
} from "../groupTitle";
import { RowDetailDrawer } from "../RowDetailDrawer";
import {
  FieldConfigPopover,
  type FieldConfigDraft,
} from "../FieldConfigPopover";
import type {
  SortCondition,
  TableRecord,
} from "../../../store/useSmartTableStore";

registerCustomEditors();

const initializeVTableBrowserEnv = () => {
  ensureVisActorBrowserEnv();
};

type VTableOptions = ConstructorParameters<typeof ListTable>[1];
type VTableGroupConfig = NonNullable<VTableOptions["groupConfig"]>;

type VTableClickEvent = {
  col: number;
  row: number;
  target?: LayoutRoleTarget;
  event?: {
    clientX?: number;
    clientY?: number;
    x?: number;
    y?: number;
    preventDefault?: () => void;
  };
};

type VTableCellValueChangeEvent = {
  col: number;
  row: number;
  changedValue?: unknown;
};

type VTableCellHoverEvent = {
  col: number;
  row: number;
};

type VTableRowHeightArgs = {
  row: number;
  table: { getRecordByCell: (col: number, row: number) => TableRecord | null };
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => formatCellValue(item)).join(", ");
  }
  if (typeof value === "object") {
    const candidate = value as {
      label?: string;
      name?: string;
      title?: string;
      id?: string;
    };
    const label =
      candidate.label || candidate.name || candidate.title || candidate.id;
    if (label) return String(label);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export function GridView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableInstanceRef = useRef<ListTable | null>(null);
  const appliedRecordsRef = useRef<TableRecord[] | null>(null);
  const appliedColumnsRef = useRef<unknown>(null);
  const appliedGroupConfigRef = useRef<unknown>(null);
  const hoveredGroupRowRef = useRef<number | null>(null);
  const hoveredRowRef = useRef<number | null>(null);
  const hoveredRowTimeoutRef = useRef<number | null>(null);
  const selectedRowIdsRef = useRef<Set<string>>(new Set());
  const selectionSummaryRef = useRef({ selectedCount: 0, totalCount: 0 });
  const previousRecordsLengthRef = useRef(0);
  const {
    fields,
    records,
    filters,
    sorts,
    hiddenFieldIds,
    groupConfig,
    setSorts,
    addField,
    updateField,
    insertRow,
    insertRows,
    updateRecord,
    deleteRecord,
    currentPermission,
    deletedRecordIds,
    cleanupDeletedRecordIds,
    selectedRecordIds,
    setSelectedRecordIds,
  } = useSmartTableStore();
  const [headerMenu, setHeaderMenu] = useState<{
    fieldId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [rowMenu, setRowMenu] = useState<{
    recordId: string;
    record: TableRecord;
    fieldId: string | null;
    position: { x: number; y: number };
  } | null>(null);
  const [fieldEditor, setFieldEditor] = useState<{
    mode: "add" | "edit";
    fieldId?: string;
    insertIndex?: number;
    position: { x: number; y: number };
    key: string;
  } | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [insertCount, setInsertCount] = useState(1);
  const closeRowMenu = useCallback(() => {
    setRowMenu(null);
    setInsertCount(1);
  }, []);

  const openAddFieldEditor = useCallback(
    (position: { x: number; y: number }, insertIndex?: number) => {
      setFieldEditor({
        mode: "add",
        insertIndex,
        position,
        key: `add_${Date.now()}`,
      });
    },
    [],
  );

  const openEditFieldEditor = useCallback(
    (fieldId: string, position: { x: number; y: number }) => {
      setFieldEditor({
        mode: "edit",
        fieldId,
        position,
        key: `edit_${fieldId}_${Date.now()}`,
      });
    },
    [],
  );

  const handleSubmitField = useCallback(
    async (draft: FieldConfigDraft) => {
      if (!fieldEditor) return;
      if (fieldEditor.mode === "add") {
        const newField = {
          id: `f_${Date.now()}`,
          name: draft.name,
          type: draft.type,
          options: draft.options,
          property: draft.property,
        };
        const result = await addField(newField, fieldEditor.insertIndex);
        if (!result.ok) return;
        message.success(t("grid.fieldAdded"));
        setFieldEditor(null);
        return;
      }
      if (fieldEditor.mode === "edit" && fieldEditor.fieldId) {
        const updates = {
          name: draft.name,
          type: draft.type,
          options: draft.options,
          property: draft.property,
        };
        const result = await updateField(fieldEditor.fieldId, updates);
        if (!result.ok) return;
        message.success(t("grid.fieldUpdated"));
        setFieldEditor(null);
      }
    },
    [addField, fieldEditor, updateField],
  );

  const groupedRecords = useTableRecords(
    records,
    fields,
    filters,
    sorts,
    groupConfig,
  );

  const recordsWithAddRow = useMemo(() => {
    if (groupConfig.fieldId) {
      return groupedRecords;
    }
    const addRowRecord: TableRecord = {
      id: "__add_row__",
    };
    return groupedRecords.concat(addRowRecord);
  }, [groupConfig.fieldId, groupedRecords]);

  const visibleFields = useMemo(() => {
    return fields.filter((f) => !hiddenFieldIds.includes(f.id));
  }, [fields, hiddenFieldIds]);

  const columns = useTableColumns(
    visibleFields,
    sorts,
    groupConfig,
    hoveredRowRef,
    selectedRowIdsRef,
    selectionSummaryRef,
  );
  const canUpdate = permissionAllows(currentPermission, "update");
  const canEdit = permissionAllows(currentPermission, "edit");
  const hasFields = fields.length > 0;
  const expandedRecord = expandedRecordId
    ? records.find((record) => record.id === expandedRecordId) || null
    : null;

  const vtableGroupConfig = useMemo<VTableGroupConfig | undefined>(() => {
    if (!groupConfig.fieldId) return undefined;
    return {
      groupBy: ["__group_key__"],
      enableTreeStickCell: true,
      titleCheckbox: false,
      titleCustomLayout: (args: GroupTitleLayoutArgs) =>
        renderGroupTitleLayout(
          args,
          fields,
          groupConfig.fieldId,
          hoveredGroupRowRef.current,
          permissionAllows(currentPermission, "update"),
        ),
    } as unknown as VTableGroupConfig;
  }, [currentPermission, fields, groupConfig.fieldId]);

  const groupConfigRef = useRef(groupConfig);
  const fieldsRef = useRef(fields);
  const sortsRef = useRef(sorts);
  const vtableGroupConfigRef = useRef(vtableGroupConfig);
  const recordsRef = useRef(recordsWithAddRow);
  const columnsRef = useRef(columns);
  const setSortsRef = useRef(setSorts);
  const openAddFieldEditorRef = useRef(openAddFieldEditor);
  const insertRowRef = useRef(insertRow);
  const insertRowsRef = useRef(insertRows);
  const updateRecordRef = useRef(updateRecord);
  const deleteRecordRef = useRef(deleteRecord);
  const canUpdateRef = useRef(permissionAllows(currentPermission, "update"));
  const canEditRef = useRef(permissionAllows(currentPermission, "edit"));

  const isSelectableRecord = useCallback((record: TableRecord | null) => {
    const data = record as {
      id?: string;
      isGroup?: boolean;
      vtableMerge?: boolean;
    } | null;
    if (!data?.id) return false;
    if (data.isGroup || data.vtableMerge) return false;
    if (data.id === "__add_row__" || data.id === "__spacer__") return false;
    return true;
  }, []);

  const copyText = useCallback(async (text: string, success: string) => {
    const result = await copyTextToClipboard(text);
    if (result.ok) {
      message.success(success);
      return true;
    }
    message.error(result.error);
    return false;
  }, []);

  const insertRowsFromMenu = useCallback(async (count: number) => {
    if (!canUpdateRef.current) return false;
    const amount = Math.max(1, Math.min(999, Math.floor(count)));
    const insertedRecords = await insertRowsRef.current(amount);
    if (insertedRecords.length === 0) {
      message.error(t("grid.insertRowFailed"));
      return false;
    }
    message.success(t("grid.insertedRows", { count: insertedRecords.length }));
    return true;
  }, []);

  const handleCopyCell = useCallback(async () => {
    if (!rowMenu?.fieldId) return;
    if (rowMenu.fieldId === "selection" || rowMenu.fieldId === "add-column")
      return;
    const value = rowMenu.record[rowMenu.fieldId];
    if (await copyText(formatCellValue(value), t("grid.cellCopied"))) {
      closeRowMenu();
    }
  }, [closeRowMenu, copyText, rowMenu]);

  const handleInsertRows = useCallback(async () => {
    if (await insertRowsFromMenu(insertCount)) {
      closeRowMenu();
    }
  }, [closeRowMenu, insertCount, insertRowsFromMenu]);

  const handleCopyRowUrl = useCallback(async () => {
    if (!rowMenu) return;
    const url = new URL(window.location.href);
    url.searchParams.set("recordId", rowMenu.recordId);
    if (await copyText(url.toString(), t("grid.rowUrlCopied"))) {
      closeRowMenu();
    }
  }, [closeRowMenu, copyText, rowMenu]);

  const handleCopyRow = useCallback(async () => {
    if (!rowMenu) return;
    const rowText = visibleFields
      .map((field) => formatCellValue(rowMenu.record[field.id]))
      .join("\t");
    if (await copyText(rowText, t("grid.rowCopied"))) {
      closeRowMenu();
    }
  }, [closeRowMenu, copyText, rowMenu, visibleFields]);

  const handleExpandRow = useCallback(() => {
    if (!rowMenu) return;
    setExpandedRecordId(rowMenu.recordId);
    closeRowMenu();
  }, [closeRowMenu, rowMenu]);

  const handleDeleteRow = useCallback(() => {
    if (!rowMenu) return;
    const recordId = rowMenu.recordId;
    closeRowMenu();
    Modal.confirm({
      title: t("grid.confirmDeleteRow"),
      okText: t("grid.delete"),
      cancelText: t("grid.cancel"),
      centered: true,
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await deleteRecordRef.current(recordId);
        if (!result.ok) {
          throw new Error(result.error);
        }
        message.success(t("grid.rowDeleted"));
      },
    });
  }, [closeRowMenu, rowMenu]);

  const recalcSelectionSummary = useCallback(() => {
    const selectableIds = new Set<string>();
    recordsRef.current.forEach((record) => {
      if (isSelectableRecord(record)) {
        selectableIds.add((record as TableRecord).id);
      }
    });
    for (const id of selectedRowIdsRef.current) {
      if (!selectableIds.has(id)) {
        selectedRowIdsRef.current.delete(id);
      }
    }
    selectionSummaryRef.current = {
      totalCount: selectableIds.size,
      selectedCount: selectedRowIdsRef.current.size,
    };
    setSelectedRecordIds(Array.from(selectedRowIdsRef.current));
  }, [isSelectableRecord, setSelectedRecordIds]);

  useEffect(() => {
    if (selectedRecordIds.length !== 0 || selectedRowIdsRef.current.size === 0) {
      return;
    }
    selectedRowIdsRef.current = new Set();
    recalcSelectionSummary();
    tableInstanceRef.current?.renderWithRecreateCells();
  }, [recalcSelectionSummary, selectedRecordIds.length]);

  useLayoutEffect(() => {
    groupConfigRef.current = groupConfig;
  }, [groupConfig]);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    sortsRef.current = sorts;
  }, [sorts]);

  useLayoutEffect(() => {
    vtableGroupConfigRef.current = vtableGroupConfig;
  }, [vtableGroupConfig]);

  useEffect(() => {
    recordsRef.current = recordsWithAddRow;

    const countChanged = recordsWithAddRow.length !== previousRecordsLengthRef.current;
    if (countChanged) {
      console.log(
        `%c[DATA_FLOW:REACT] %crecords changed %c| ${previousRecordsLengthRef.current}→${recordsWithAddRow.length} records %c| deletedIds=${deletedRecordIds.size}`,
        'color:#9b59b6;font-weight:bold',
        'color:#9b59b6',
        'color:#888',
        'color:#888'
      );
      previousRecordsLengthRef.current = recordsWithAddRow.length;
      recalcSelectionSummary();
    }

    cleanupDeletedRecordIds();
  }, [recordsWithAddRow, recalcSelectionSummary, cleanupDeletedRecordIds]);

  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    setSortsRef.current = setSorts;
  }, [setSorts]);

  useEffect(() => {
    openAddFieldEditorRef.current = openAddFieldEditor;
  }, [openAddFieldEditor]);

  useEffect(() => {
    insertRowRef.current = insertRow;
  }, [insertRow]);

  useEffect(() => {
    insertRowsRef.current = insertRows;
  }, [insertRows]);

  useEffect(() => {
    updateRecordRef.current = updateRecord;
  }, [updateRecord]);

  useEffect(() => {
    deleteRecordRef.current = deleteRecord;
  }, [deleteRecord]);

  useEffect(() => {
    canUpdateRef.current = permissionAllows(currentPermission, "update");
    canEditRef.current = permissionAllows(currentPermission, "edit");
  }, [currentPermission]);

  useEffect(() => {
    if (!containerRef.current || !hasFields) return;

    initializeVTableBrowserEnv();

    const options: VTableOptions & {
      editCellRule?: (col: number, row: number) => boolean;
    } = {
      records: recordsRef.current,
      columns: columnsRef.current as unknown as VTableOptions["columns"],
      widthMode: "standard",
      hover: { highlightMode: "cross" },
      defaultRowHeight: 44,
      defaultHeaderRowHeight: 44,
      bottomFrozenRowCount: 0,
      customMergeCell: (col: number, row: number, table: unknown) => {
        const api = table as {
          getRecordByCell: (c: number, r: number) => TableRecord | null;
          colCount: number;
          rowCount: number;
        };
        const record = api.getRecordByCell(col, row);
        const currentGroupConfig = groupConfigRef.current;
        if (record && record.isGroup) {
          return {
            range: {
              start: { col: 0, row },
              end: { col: api.colCount - 1, row },
            },
            style: {
              bgColor: "#ffffff",
              color: "#111827",
              fontSize: 14,
              fontWeight: "bold",
              textAlign: "left",
              borderColor: "#f6f6f8",
              borderLineWidth: [0, 0, 1, 0],
            },
            disableEdit: true,
          };
        } else if (
          !currentGroupConfig.fieldId &&
          record?.id === "__add_row__"
        ) {
          return {
            text: `+  ${t('toolbar.addRecord')}`,
            range: {
              start: { col: 0, row },
              end: { col: api.colCount - 1, row },
            },
            style: {
              bgColor: "#ffffff",
              color: "#5F6B7C",
              fontSize: 13,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
              textAlign: "left",
              padding: [0, 12, 0, 60],
              borderLineWidth: [1, 0, 0, 0],
              borderColor: ["#EAECF0"],
            },
            disableEdit: true,
          };
        }
        return undefined;
      },
      editCellRule: () => canUpdateRef.current,
      editCellTrigger: canUpdateRef.current ? "click" : "api",
      customComputeRowHeight: (args: VTableRowHeightArgs) => {
        const { row, table } = args;
        const record = table.getRecordByCell(0, row);
        if (record && record.id === "__add_row__") {
          if (groupConfigRef.current?.fieldId) {
            return 0;
          }
          return 44;
        }
        return 44;
      },
      hierarchyExpandLevel: Infinity,
      keyboardOptions: {
        copySelected: true,
        pasteValueToCell: true,
        selectAllOnCtrlA: true,
      },
      enableCheckboxCascade: true,
      enableHeaderCheckboxCascade: true,
      theme: {
        ...vtableTheme,
        groupTitleStyle: {
          bgColor: "#ffffff",
          color: "#111827",
          fontSize: 14,
          fontWeight: "bold",
          textAlign: "left",
          borderColor: "#f6f6f8",
          borderLineWidth: [0, 0, 1, 0],
        },
      },
    };

    if (vtableGroupConfigRef.current) {
      options.groupConfig = vtableGroupConfigRef.current;
    }

    const container = containerRef.current;
    if (!container) return;
    const table = new ListTable(container, options);
    appliedRecordsRef.current = recordsRef.current;
    appliedColumnsRef.current = columnsRef.current;
    appliedGroupConfigRef.current = vtableGroupConfigRef.current;

    table.on("click_cell", (args) => {
      setRowMenu(null);
      const { target, event } = args as VTableClickEvent;
      const selectionApi = table as unknown as {
        clearSelected?: () => void;
        clearSelection?: () => void;
        clearSelectedCell?: () => void;
        clearSelectedCells?: () => void;
      };

      const record = table.getRecordByCell(args.col, args.row);
      const field = table.getBodyField(args.col, args.row);

      if (
        args.col === 0 ||
        field === "add-column" ||
        target?.role === "add-column"
      ) {
        selectionApi.clearSelected?.();
        selectionApi.clearSelection?.();
        selectionApi.clearSelectedCell?.();
        selectionApi.clearSelectedCells?.();
      }

      if (target?.role === "selection-toggle-all") {
        recalcSelectionSummary();
        if (
          selectionSummaryRef.current.totalCount > 0 &&
          selectionSummaryRef.current.selectedCount ===
            selectionSummaryRef.current.totalCount
        ) {
          selectedRowIdsRef.current = new Set();
        } else {
          const next = new Set<string>();
          recordsRef.current.forEach((rec) => {
            if (isSelectableRecord(rec)) {
              next.add(rec.id);
            }
          });
          selectedRowIdsRef.current = next;
        }
        recalcSelectionSummary();
        table.renderWithRecreateCells();
        return;
      }

      if (field === "selection") {
        if (target?.role === "row-expand-toggle") {
          if (isSelectableRecord(record)) {
            const id = record?.id;
            if (typeof id === "string") {
              setExpandedRecordId((prev) => (prev === id ? null : id));
            }
          }
          return;
        }
        if (target?.role === "row-drag-handle") return;
        if (target?.role !== "selection-toggle-row") return;
        if (isSelectableRecord(record)) {
          const id = record?.id;
          if (typeof id === "string") {
            if (selectedRowIdsRef.current.has(id)) {
              selectedRowIdsRef.current.delete(id);
            } else {
              selectedRowIdsRef.current.add(id);
            }
            recalcSelectionSummary();
            table.renderWithRecreateCells();
          }
        }
        return;
      }

      if (
        record &&
        record.isGroup &&
        record.vtableMergeName === "~~~~~New Record"
      ) {
        if (canUpdateRef.current) {
          insertRowRef.current();
        }
        return;
      }

      if (typeof args?.row === "number") {
        const rec = table.getRecordByCell(args.col, args.row);
        if (rec?.id === "__add_row__") {
          if (canUpdateRef.current) {
            void insertRowRef.current().then((created) => {
              if (!created) {
                message.error(t("grid.insertRowFailed"));
              }
            });
          }
          return;
        }
      }
      if (!target) return;
      if (
        handleGroupTitleAction({
          target,
          table,
          col: args.col,
          row: args.row,
          fields: fieldsRef.current,
          groupFieldId: groupConfigRef.current.fieldId,
          insertRow: insertRowRef.current,
          allowInsert: canUpdateRef.current,
        })
      ) {
        return;
      }
      if (target.role === "sort-icon") {
        const fieldId = target.fieldId;
        if (!fieldId) return;
        const currentSort = sortsRef.current.find((s) => s.fieldId === fieldId);
        let newSorts: SortCondition[];
        if (currentSort) {
          newSorts =
            currentSort.order === "asc" ? [{ fieldId, order: "desc" }] : [];
        } else {
          newSorts = [{ fieldId, order: "asc" }];
        }
        setSortsRef.current(newSorts);
      } else if (target.role === "more-icon") {
        if (!canEditRef.current) return;
        const fieldId = target.fieldId;
        if (!fieldId) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const eventX =
            event?.clientX ??
            (event?.x !== undefined ? event.x + rect.left : rect.left);
          const eventY =
            event?.clientY ??
            (event?.y !== undefined ? event.y + rect.top : rect.top);
          setHeaderMenu({
            fieldId,
            position: {
              x: eventX + 10,
              y: eventY + 10,
            },
          });
        }
      } else if (target.role === "add-column") {
        if (!canEditRef.current) return;
        event?.preventDefault?.();
        selectionApi.clearSelected?.();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const eventX =
            event?.clientX ??
            (event?.x !== undefined ? event.x + rect.left : rect.left);
          const eventY =
            event?.clientY ??
            (event?.y !== undefined ? event.y + rect.top : rect.top);
          openAddFieldEditorRef.current(
            { x: eventX + 10, y: eventY + 10 },
            fieldsRef.current.length,
          );
        }
        selectionApi.clearSelection?.();
        selectionApi.clearSelectedCell?.();
        selectionApi.clearSelectedCells?.();
      }
      if (record && (record.isGroup || record.vtableMerge)) {
        table.toggleHierarchyState(args.col, args.row);
        return;
      }
    });

    const { CONTEXTMENU_CELL } = ListTable.EVENT_TYPE;
    table.on(CONTEXTMENU_CELL, (args) => {
      const { event } = args as VTableClickEvent;
      const record = table.getRecordByCell(args.col, args.row);
      if (!isSelectableRecord(record)) return;
      event?.preventDefault?.();
      const rect = containerRef.current?.getBoundingClientRect();
      const rawX =
        event?.clientX ??
        (event?.x !== undefined
          ? event.x + (rect?.left ?? 0)
          : (rect?.left ?? 0));
      const rawY =
        event?.clientY ??
        (event?.y !== undefined
          ? event.y + (rect?.top ?? 0)
          : (rect?.top ?? 0));
      const menuWidth = 240;
      const menuHeight = 280;
      const padding = 8;
      const x = Math.max(
        padding,
        Math.min(rawX, window.innerWidth - menuWidth - padding),
      );
      const y = Math.max(
        padding,
        Math.min(rawY, window.innerHeight - menuHeight - padding),
      );
      setHeaderMenu(null);
      setRowMenu({
        recordId: record.id,
        record,
        fieldId: (table.getBodyField(args.col, args.row) as string) || null,
        position: { x, y },
      });
    });

    const persist = (args: VTableCellValueChangeEvent) => {
      if (!canUpdateRef.current) return;
      try {
        const rec = table.getRecordByCell(args.col, args.row);
        const fieldId = table.getBodyField(args.col, args.row);
        let newValue = args?.changedValue;
        if (newValue === undefined) {
          newValue = null;
        }
        if (rec?.id === "__add_row__" || rec?.isGroup || rec?.vtableMerge)
          return;
        if (rec && rec.id && fieldId !== undefined) {
          void updateRecordRef.current(rec.id, fieldId as string, newValue);
        }
      } catch {
        return;
      }
    };
    table.on("change_cell_value", persist);
    const { MOUSEMOVE_CELL, MOUSELEAVE_TABLE } = ListTable.EVENT_TYPE;
    const debouncedRender = () => {
      if (hoveredRowTimeoutRef.current) {
        clearTimeout(hoveredRowTimeoutRef.current);
      }
      hoveredRowTimeoutRef.current = window.setTimeout(() => {
        table.renderWithRecreateCells();
        hoveredRowTimeoutRef.current = null;
      }, 16);
    };

    table.on(MOUSEMOVE_CELL, (args: VTableCellHoverEvent) => {
      const rec = table.getRecordByCell(args.col, args.row);
      const nextHoveredGroup =
        rec && (rec.isGroup || rec.vtableMerge) ? args.row : null;
      const nextHoveredRow =
        rec &&
        !rec.isGroup &&
        !rec.vtableMerge &&
        rec.id !== "__add_row__" &&
        rec.id !== "__spacer__"
          ? args.row
          : null;
      let shouldRender = false;
      if (hoveredGroupRowRef.current !== nextHoveredGroup) {
        hoveredGroupRowRef.current = nextHoveredGroup;
        shouldRender = true;
      }
      if (hoveredRowRef.current !== nextHoveredRow) {
        hoveredRowRef.current = nextHoveredRow;
        shouldRender = true;
      }
      if (shouldRender) {
        debouncedRender();
      }
    });
    table.on(MOUSELEAVE_TABLE, () => {
      let shouldRender = false;
      if (hoveredRowRef.current !== null) {
        hoveredRowRef.current = null;
        shouldRender = true;
      }
      if (hoveredGroupRowRef.current !== null) {
        hoveredGroupRowRef.current = null;
        shouldRender = true;
      }
      if (shouldRender) {
        debouncedRender();
      }
    });
    tableInstanceRef.current = table;
    return () => {
      if (hoveredRowTimeoutRef.current) {
        clearTimeout(hoveredRowTimeoutRef.current);
      }
      tableInstanceRef.current?.release();
      tableInstanceRef.current = null;
      appliedRecordsRef.current = null;
      appliedColumnsRef.current = null;
      appliedGroupConfigRef.current = null;
    };
  }, [hasFields, isSelectableRecord, recalcSelectionSummary]);

  useLayoutEffect(() => {
    const table = tableInstanceRef.current;
    if (!table) return;

    const renderRecords = recordsWithAddRow
      .filter((record) => record.id !== "__spacer__")
      .map((record) => ({ ...record }));

    const recordsChanged = appliedRecordsRef.current !== recordsWithAddRow;
    const columnsChanged = appliedColumnsRef.current !== columns;
    const groupChanged =
      appliedGroupConfigRef.current !== vtableGroupConfig;

    if (!recordsChanged && !columnsChanged && !groupChanged) {
      return;
    }

    if (columnsChanged || groupChanged) {
      const extendedTheme = {
        ...vtableTheme,
        groupTitleStyle: {
          bgColor: "#ffffff",
          color: "#111827",
          fontSize: 14,
          fontWeight: "bold",
          textAlign: "left",
          borderColor: "#f6f6f8",
          borderLineWidth: 1,
        },
      };

      const next = {
        ...table.options,
        records: renderRecords,
        columns: columns as unknown as VTableOptions["columns"],
        theme: extendedTheme,
        editCellTrigger: canUpdateRef.current ? "click" : "api",
        editCellRule: () => canUpdateRef.current,
      } as VTableOptions & { dataSource?: unknown };

      delete next.dataSource;

      if (vtableGroupConfig) {
        next.groupConfig = vtableGroupConfig;
      } else {
        delete next.groupConfig;
      }

      void table.updateOption(next, {
        clearColWidthCache: columnsChanged,
        clearRowHeightCache: false,
      });

      console.log(
        `%c[DATA_FLOW:RENDER] %cVTable atomic updateOption %c| records=${renderRecords.length} %c| columnsChanged=${columnsChanged} groupChanged=${groupChanged}`,
        "color:#2ecc71;font-weight:bold",
        "color:#2ecc71",
        "color:#2ecc71",
        "color:#888",
      );
    } else {
      table.setRecords(renderRecords);
      console.log(
        `%c[DATA_FLOW:RENDER] %cVTable setRecords(latest) %c| ${renderRecords.length} records`,
        "color:#2ecc71;font-weight:bold",
        "color:#2ecc71",
        "color:#2ecc71",
      );
    }

    appliedRecordsRef.current = recordsWithAddRow;
    appliedColumnsRef.current = columns;
    appliedGroupConfigRef.current = vtableGroupConfig;
  }, [columns, recordsWithAddRow, vtableGroupConfig]);

  const isCellCopyable =
    !!rowMenu?.fieldId &&
    rowMenu.fieldId !== "selection" &&
    rowMenu.fieldId !== "add-column";
  const expandedTitle = expandedRecord
    ? visibleFields.length > 0
      ? formatCellValue(expandedRecord[visibleFields[0].id])
      : expandedRecord.id
    : "";
  const handleUpdateRecord = useCallback(
    (recordId: string, fieldId: string, nextValue: unknown) => {
      if (!canUpdate) return;
      void updateRecord(recordId, fieldId, nextValue);
    },
    [canUpdate, updateRecord],
  );

  if (!hasFields) {
    return (
      <>
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div style={{ color: "#344054", fontWeight: 500 }}>
                  {t("grid.noFields")}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: "#98A2B3",
                    fontSize: 12,
                  }}
                >
                  {t("grid.noFieldsHint")}
                </div>
              </div>
            }
          >
            {canEdit ? (
              <Button
                type="primary"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  openAddFieldEditor(
                    { x: rect.left, y: rect.bottom + 6 },
                    0,
                  );
                }}
              >
                {t("grid.addField")}
              </Button>
            ) : null}
          </Empty>
        </div>
        {fieldEditor && (
          <FieldConfigPopover
            key={fieldEditor.key}
            open={Boolean(fieldEditor)}
            mode={fieldEditor.mode}
            position={fieldEditor.position}
            field={null}
            onClose={() => setFieldEditor(null)}
            onSubmit={handleSubmitField}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "200px",
        }}
      />
      {headerMenu && (
        <HeaderMenu
          fieldId={headerMenu.fieldId}
          position={headerMenu.position}
          onClose={() => setHeaderMenu(null)}
          onEditField={(fieldId) =>
            openEditFieldEditor(fieldId, headerMenu.position)
          }
          onInsertField={(index) =>
            openAddFieldEditor(headerMenu.position, index)
          }
        />
      )}
      {fieldEditor && (
        <FieldConfigPopover
          key={fieldEditor.key}
          open={Boolean(fieldEditor)}
          mode={fieldEditor.mode}
          position={fieldEditor.position}
          field={
            fieldEditor.fieldId
              ? fields.find((item) => item.id === fieldEditor.fieldId) || null
              : null
          }
          onClose={() => setFieldEditor(null)}
          onSubmit={handleSubmitField}
        />
      )}
      <RowContextMenu
        position={rowMenu?.position ?? null}
        canUpdate={canUpdate}
        isCellCopyable={isCellCopyable}
        insertCount={insertCount}
        onInsertCountChange={setInsertCount}
        onClose={closeRowMenu}
        onCopyCell={handleCopyCell}
        onInsertRows={handleInsertRows}
        onCopyRowUrl={handleCopyRowUrl}
        onCopyRow={handleCopyRow}
        onExpandRow={handleExpandRow}
        onDeleteRow={handleDeleteRow}
      />
      <RowDetailDrawer
        open={Boolean(expandedRecord)}
        title={expandedTitle || t("grid.rowDetail")}
        record={expandedRecord}
        fields={visibleFields}
        canUpdate={canUpdate}
        onClose={() => setExpandedRecordId(null)}
        onUpdateRecord={handleUpdateRecord}
      />
    </>
  );
}
