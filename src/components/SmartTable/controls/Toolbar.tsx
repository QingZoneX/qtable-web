import { Avatar, Button, Dropdown, Tooltip, message } from "antd";
import {
  BarChartOutlined,
  BranchesOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  ControlOutlined,
  DownOutlined,
  EllipsisOutlined,
  ImportOutlined,
  InboxOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import type { MenuProps } from "antd";
import {
  permissionAllows,
  useSmartTableStore,
} from "../../../store/useSmartTableStore";
import { useAuthStore } from "../../../store/authStore";
import { t } from "../../../lib/i18n";
import { client } from "../../../lib/apollo";
import { EXPORT_XLSX } from "../../../lib/graphql";
import { FilterPopover } from "./toolbar/FilterPopover";
import { SortPopover } from "./toolbar/SortPopover";
import { GroupPopover } from "./toolbar/GroupPopover";
import { FieldsPopover } from "./toolbar/FieldsPopover";
import { matchesFilters } from "../utils/filterUtils";
import { compareSmartValues } from "../utils/sortUtils";
import { CsvImportModal } from "./CsvImportModal";
import { RowPermissionModal } from "./RowPermissionModal";
import {
  FieldConfigPopover,
  type FieldConfigDraft,
} from "../FieldConfigPopover";
import { TaskPlanningModal } from "../../TaskPlanning/TaskPlanningModal";
import type { TaskPlanningApplyResult } from "../../TaskPlanning/taskPlanningTypes";
import { WorkloadPlanningModal } from "../../WorkloadPlanning/WorkloadPlanningModal";
import type { WorkloadPlanningApplyResult } from "../../WorkloadPlanning/workloadPlanningTypes";
import { ProjectStewardModal } from "../../ProjectSteward/ProjectStewardModal";
import { AiVisualDesignerModal } from "../../AiVisualDesigner/AiVisualDesignerModal";
import type { AiVisualApplyResult } from "../../AiVisualDesigner/types";
import { useWorkspaceExperienceMode } from "../../ExperienceMode/useWorkspaceExperienceMode";
import { openSourceInbox } from "../../SourceInbox/sourceInboxEvents";
import { subscribeTableWorkspaceAction } from "../tableWorkspaceEvents";
import { tableWorkspaceT } from "../tableWorkspaceI18n";
import "./toolbarExperience.css";

// Persisted ViewConfig values from older versions use the key "automations"
// for the import/export overflow menu. Keep reading that serialized key for
// compatibility, but never expose it as Automation in the product UI.
const LEGACY_MORE_ITEM = "automations" as const;

const toExportText = (
  value: unknown,
  optionsMap?: Map<string, string>,
  dateFormat?: string,
): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => toExportText(item, optionsMap, dateFormat))
      .filter((item) => item !== "")
      .join(", ");
  }
  if (value instanceof Date) return dayjs(value).format(dateFormat || "YYYY-MM-DD");
  if (typeof value === "string" || typeof value === "number") {
    if (optionsMap) {
      const label = optionsMap.get(String(value));
      if (label) return label;
    }
    if (dateFormat) {
      const parsed = dayjs(value);
      if (parsed.isValid()) return parsed.format(dateFormat);
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    const candidate = value as {
      label?: string;
      name?: string;
      title?: string;
      id?: string;
    };
    const label =
      candidate.label ||
      candidate.name ||
      candidate.title ||
      (candidate.id ? optionsMap?.get(candidate.id) || candidate.id : "");
    if (label) return String(label);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const triggerDownload = (
  content: string,
  filename: string,
  mimeType: string,
  withBom = false,
) => {
  const payload = withBom ? `\uFEFF${content}` : content;
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const base64ToBlob = (contentBase64: string, mimeType: string): Blob => {
  const binary = window.atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

const sanitizeDownloadName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "table";

type FieldEditorState = {
  position: { x: number; y: number };
  key: string;
};

export function Toolbar({
  onViewSettingsClick,
  onTaskPlanningApplied,
  onWorkloadPlanningApplied,
  onAiVisualDesignApplied,
}: {
  onViewSettingsClick?: () => void;
  onTaskPlanningApplied?: (
    result: TaskPlanningApplyResult,
  ) => void | Promise<void>;
  onWorkloadPlanningApplied?: (
    result: WorkloadPlanningApplyResult,
  ) => void | Promise<void>;
  onAiVisualDesignApplied?: (
    result: AiVisualApplyResult,
  ) => void | Promise<void>;
}) {
  const {
    views,
    currentViewId,
    fields,
    records,
    filters,
    sorts,
    hiddenFieldIds,
    currentTableId,
    currentTableName,
    groupConfig,
    currentPermission,
    activeViewers,
    selectedRecordIds,
    setFilters,
    insertRow,
    addField,
  } = useSmartTableStore();
  const { user } = useAuthStore();
  const { isSimpleMode } = useWorkspaceExperienceMode();
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [rowPermissionOpen, setRowPermissionOpen] = useState(false);
  const [xlsxExporting, setXlsxExporting] = useState(false);
  const [taskPlanningOpen, setTaskPlanningOpen] = useState(false);
  const [workloadPlanningOpen, setWorkloadPlanningOpen] = useState(false);
  const [projectStewardOpen, setProjectStewardOpen] = useState(false);
  const [aiVisualDesignerOpen, setAiVisualDesignerOpen] = useState(false);
  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(false);
  const [firstRowCreating, setFirstRowCreating] = useState(false);
  const [fieldEditor, setFieldEditor] = useState<FieldEditorState | null>(null);

  const currentView = views.find((view) => view.id === currentViewId);
  const toolbarItems = currentView?.config?.toolbar?.items ?? [];
  const isBoardView = currentView?.type === "board";
  const canUpdate = permissionAllows(currentPermission, "update");
  const canEditView = permissionAllows(currentPermission, "edit");
  const canManage = permissionAllows(currentPermission, "manage");
  const hasLegacyMoreConfig = toolbarItems.includes(LEGACY_MORE_ITEM);
  const workspaceId = localStorage.getItem("qtable.workspaceId") || "";

  useEffect(() => {
    return subscribeTableWorkspaceAction((action) => {
      if (action === "import_csv" && canUpdate) setCsvImportOpen(true);
      if (action === "ai_generate" && canEditView) setTaskPlanningOpen(true);
    });
  }, [canEditView, canUpdate]);

  const visibleFields = useMemo(
    () => fields.filter((field) => !hiddenFieldIds.includes(field.id)),
    [fields, hiddenFieldIds],
  );

  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );

  const filteredRecords = useMemo(() => {
    if (!filters.length) return [...records];
    return records.filter((record) => matchesFilters(record, filters, fields));
  }, [fields, filters, records]);

  const sortedFilteredRecords = useMemo(() => {
    if (!sorts.length) return filteredRecords;
    return [...filteredRecords].sort((a, b) => {
      for (const sort of sorts) {
        const field = fields.find((item) => item.id === sort.fieldId);
        let compareResult = compareSmartValues(
          a[sort.fieldId],
          b[sort.fieldId],
          field,
        );
        if (sort.order === "desc") compareResult = -compareResult;
        if (compareResult !== 0) return compareResult;
      }
      return 0;
    });
  }, [fields, filteredRecords, sorts]);

  const buildExportRows = (sourceRecords: typeof records) =>
    sourceRecords.map((record) =>
      visibleFields.map((field) => {
        const optionsMap = new Map(
          (field.options || []).map((option) => [option.id, option.label]),
        );
        const rawValue = record[field.id];
        const dateFormat = field.type === "date" ? field.property?.format : undefined;
        return toExportText(rawValue, optionsMap, dateFormat);
      }),
    );

  const exportCsv = (scope: "all" | "filtered") => {
    const sourceRecords = scope === "all" ? records : sortedFilteredRecords;
    const headers = visibleFields.map((field) => field.name);
    const rows = buildExportRows(sourceRecords);
    const csvRows = [
      headers.map((item) => escapeCsv(item)).join(","),
      ...rows.map((row) => row.map((item) => escapeCsv(item)).join(",")),
    ];
    const tableName = currentTableName || "table";
    const suffix = scope === "all" ? "all" : "filtered";
    triggerDownload(
      csvRows.join("\n"),
      `${tableName}-${suffix}.csv`,
      "text/csv;charset=utf-8;",
      true,
    );
    message.success(
      scope === "all" ? "已导出全部数据 CSV" : "已导出当前结果 CSV",
    );
  };

  const exportXlsx = async (scope: "all" | "filtered") => {
    if (xlsxExporting) return;
    const sourceRecords = scope === "all" ? records : sortedFilteredRecords;
    setXlsxExporting(true);
    try {
      const response = await client.mutate({
        mutation: EXPORT_XLSX,
        variables: {
          tableId: currentTableId ?? undefined,
          fieldIds: visibleFields.map((field) => field.id),
          recordIds: sourceRecords.map((record) => String(record.id)),
        },
      });
      const payload = (
        response as {
          data?: {
            exportXlsx?: {
              contentBase64?: string;
              mimeType?: string;
              rowCount?: number;
              fieldCount?: number;
            };
          };
        }
      ).data?.exportXlsx;
      if (!payload?.contentBase64) {
        throw new Error("XLSX export returned no file content");
      }

      const mimeType =
        payload.mimeType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = base64ToBlob(payload.contentBase64, mimeType);
      const suffix = scope === "all" ? "all" : "filtered";
      const tableName = sanitizeDownloadName(currentTableName || "table");
      triggerBlobDownload(blob, `${tableName}-${suffix}.xlsx`);
      message.success(
        scope === "all"
          ? `已导出全部数据 XLSX（${payload.rowCount ?? sourceRecords.length} 行）`
          : `已导出当前结果 XLSX（${payload.rowCount ?? sourceRecords.length} 行）`,
      );
    } catch (error) {
      const messageText =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
      message.error(messageText || "XLSX 导出失败，请稍后重试");
    } finally {
      setXlsxExporting(false);
    }
  };

  const openAddFieldEditor = (position: { x: number; y: number }) => {
    setFieldEditor({ position, key: `toolbar_add_${Date.now()}` });
  };

  const handleSubmitField = async (draft: FieldConfigDraft) => {
    const result = await addField({
      id: `f_${Date.now()}`,
      name: draft.name,
      type: draft.type,
      options: draft.options,
      property: draft.property,
    });
    if (!result.ok) return;
    message.success("字段已新增");
    setFieldEditor(null);
  };

  const handleCreateFirstRow = async () => {
    if (!canUpdate || firstRowCreating) return;
    setFirstRowCreating(true);
    try {
      const created = await insertRow();
      if (!created) {
        message.error("新增第一条记录失败，请稍后重试");
        return;
      }
      message.success("第一条记录已创建，可以直接开始填写");
    } finally {
      setFirstRowCreating(false);
    }
  };

  const moreMenuItems: MenuProps["items"] = [
    {
      type: "group",
      label: tableWorkspaceT("importGroup"),
      children: [
        {
          key: "import_csv",
          icon: <ImportOutlined />,
          label: tableWorkspaceT("importCsv"),
          disabled: !canUpdate,
        },
      ],
    },
    { type: "divider" },
    {
      type: "group",
      label: tableWorkspaceT("exportGroup"),
      children: [
        {
          key: "export_all_excel",
          label: tableWorkspaceT("exportAllXlsx"),
          disabled: xlsxExporting,
        },
        { key: "export_all_csv", label: tableWorkspaceT("exportAllCsv") },
        {
          key: "export_filtered_excel",
          label: tableWorkspaceT("exportFilteredXlsx"),
          disabled: xlsxExporting,
        },
        {
          key: "export_filtered_csv",
          label: tableWorkspaceT("exportFilteredCsv"),
        },
      ],
    },
    { type: "divider" },
    {
      type: "group",
      label: tableWorkspaceT("permissionGroup"),
      children: [
        {
          key: "row_permissions",
          icon: <SafetyCertificateOutlined />,
          label: tableWorkspaceT("rowPermission"),
          disabled: !currentTableId,
        },
      ],
    },
  ];

  const handleMoreMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "import_csv") {
      if (canUpdate) setCsvImportOpen(true);
      return;
    }
    if (key === "export_all_excel") {
      void exportXlsx("all");
      return;
    }
    if (key === "export_all_csv") {
      exportCsv("all");
      return;
    }
    if (key === "export_filtered_excel") {
      void exportXlsx("filtered");
      return;
    }
    if (key === "export_filtered_csv") {
      exportCsv("filtered");
      return;
    }
    if (key === "row_permissions") setRowPermissionOpen(true);
  };

  const aiMenuItems: MenuProps["items"] = [
    {
      key: "task_planning",
      icon: <BranchesOutlined />,
      label: `${tableWorkspaceT("aiTaskPlanning")}${
        selectedRecordIds.length > 0 ? ` (${selectedRecordIds.length})` : ""
      }`,
      disabled: !currentTableId || !canEditView,
    },
    {
      key: "workload",
      icon: <ClockCircleOutlined />,
      label: tableWorkspaceT("aiWorkload"),
      disabled: !currentTableId || !permissionAllows(currentPermission, "read"),
    },
    {
      key: "steward",
      icon: <BulbOutlined />,
      label: tableWorkspaceT("aiSteward"),
      disabled: !currentTableId || !permissionAllows(currentPermission, "read"),
    },
    {
      key: "visual",
      icon: <BarChartOutlined />,
      label: tableWorkspaceT("aiVisual"),
      disabled: !currentTableId || !canEditView,
    },
  ];

  const handleAiMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "task_planning" && canEditView) setTaskPlanningOpen(true);
    if (key === "workload") setWorkloadPlanningOpen(true);
    if (key === "steward") setProjectStewardOpen(true);
    if (key === "visual" && canEditView) setAiVisualDesignerOpen(true);
  };

  const otherViewers = useMemo(() => {
    const selfEmail = user?.email?.toLowerCase();
    const selfId = user?.id;
    return activeViewers.filter((viewer) => {
      if (selfId && viewer.userId && viewer.userId === selfId) return false;
      if (selfEmail && viewer.email?.toLowerCase() === selfEmail) return false;
      return true;
    });
  }, [activeViewers, user?.email, user?.id]);

  const renderViewerText = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?";

  const formatFilterValue = (fieldId: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return tableWorkspaceT("filterValueEmpty");
    }
    const field = fieldMap.get(fieldId);
    const optionEntries: Array<readonly [string, string]> = (field?.options || []).flatMap(
      (option) => [
        [option.id, option.label] as const,
        [option.label, option.label] as const,
      ],
    );
    const optionLabels = new Map<string, string>(optionEntries);
    const values = Array.isArray(value) ? value : [value];
    const rendered = values
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const candidate = item as { name?: string; label?: string; id?: string };
          return (
            candidate.name ||
            candidate.label ||
            optionLabels.get(candidate.id || "") ||
            candidate.id ||
            ""
          );
        }
        return optionLabels.get(String(item)) || String(item);
      })
      .filter(Boolean)
      .join(", ");
    return rendered || tableWorkspaceT("filterValueAny");
  };

  const operatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      contains: "∋",
      equals: "=",
      is: "=",
      is_not: "≠",
      gt: ">",
      gte: "≥",
      lt: "<",
      lte: "≤",
      before: "<",
      after: ">",
      is_empty: "∅",
      is_not_empty: "≠∅",
    };
    return labels[operator] || operator;
  };

  const removeFilter = (filterId: string) => {
    if (!canEditView) return;
    const next = filters
      .filter((filter) => filter.id !== filterId)
      .map((filter, index) =>
        index === 0 ? { ...filter, logic: "where" as const } : filter,
      );
    setFilters(next);
  };

  const visibleFilterChips = filters.slice(0, 3);
  const extraFilterCount = Math.max(0, filters.length - visibleFilterChips.length);
  const visibleSortChips = sorts.slice(0, 2);
  const extraSortCount = Math.max(0, sorts.length - visibleSortChips.length);
  const groupField = groupConfig.fieldId ? fieldMap.get(groupConfig.fieldId) : null;
  const hasStateStrip =
    filters.length > 0 ||
    sorts.length > 0 ||
    Boolean(groupField) ||
    hiddenFieldIds.length > 0;

  // Progressive disclosure only changes what is rendered. It deliberately
  // never persists the disclosure state to the shared view configuration.
  const showAdvancedControls = !isSimpleMode || advancedControlsOpen;
  const showFields =
    (toolbarItems.includes("fields") && showAdvancedControls) ||
    (isSimpleMode && fields.length === 0 && advancedControlsOpen);
  const showFilter = toolbarItems.includes("filter") || isSimpleMode;
  const showSort = toolbarItems.includes("sort") && showAdvancedControls;
  const showGroup = toolbarItems.includes("group") && showAdvancedControls;
  const showViewSettings =
    toolbarItems.includes("viewSettings") &&
    Boolean(onViewSettingsClick) &&
    showAdvancedControls;
  const showEmptyGuidance =
    Boolean(currentTableId) && records.length === 0 && filters.length === 0;

  return (
    <>
      <div
        className={`qtable-table-toolbar${isSimpleMode ? " is-simple" : " is-advanced"}`}
        aria-label={t("header.table")}
        data-experience-mode={isSimpleMode ? "simple" : "advanced"}
        data-shared-view-config="unchanged"
      >
        <div className="qtable-table-toolbar-main">
          {showFilter ? <FilterPopover disabled={!canEditView} /> : null}
          {showSort ? <SortPopover disabled={!canEditView} /> : null}
          {showGroup ? (
            <GroupPopover
              allowedTypes={isBoardView ? ["select"] : undefined}
              disabled={!canEditView}
            />
          ) : null}
          {showFields ? (
            <FieldsPopover
              disabled={!canEditView}
              onAddField={openAddFieldEditor}
            />
          ) : null}
          {showViewSettings ? (
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={onViewSettingsClick}
              disabled={!canEditView}
            >
              {tableWorkspaceT("settings")}
            </Button>
          ) : null}
          {isSimpleMode ? (
            <Button
              type={advancedControlsOpen ? "default" : "text"}
              size="small"
              icon={<ControlOutlined />}
              className="qtable-table-advanced-toggle"
              aria-expanded={advancedControlsOpen}
              onClick={() => setAdvancedControlsOpen((current) => !current)}
            >
              {advancedControlsOpen ? "收起高级" : "高级"}
            </Button>
          ) : null}
          {!canEditView ? (
            <Tooltip title={tableWorkspaceT("readOnlyHint")}>
              <span className="qtable-table-readonly-note">
                {tableWorkspaceT("readOnlyView")}
              </span>
            </Tooltip>
          ) : null}
        </div>

        <div className="qtable-table-toolbar-side">
          {otherViewers.length > 0 ? (
            <Tooltip title={tableWorkspaceT("collaborators")}>
              <span className="qtable-table-collaborators">
                <Avatar.Group max={{ count: 4 }}>
                  {otherViewers.map((viewer) => (
                    <Tooltip
                      key={`${viewer.userId ?? viewer.email ?? viewer.name}`}
                      title={viewer.name}
                    >
                      <Avatar
                        style={{
                          backgroundColor: "var(--qtable-color-primary-soft)",
                          color: "var(--qtable-color-primary)",
                          fontWeight: 600,
                        }}
                        size={28}
                      >
                        {renderViewerText(viewer.name)}
                      </Avatar>
                    </Tooltip>
                  ))}
                </Avatar.Group>
              </span>
            </Tooltip>
          ) : null}

          <Dropdown
            menu={{ items: aiMenuItems, onClick: handleAiMenuClick }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button type="text" icon={<RobotOutlined />} disabled={!currentTableId}>
              {isSimpleMode ? "AI 建议" : tableWorkspaceT("ai")}
              <DownOutlined />
            </Button>
          </Dropdown>

          <Dropdown
            menu={{ items: moreMenuItems, onClick: handleMoreMenuClick }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<EllipsisOutlined />}
              data-legacy-more-config={hasLegacyMoreConfig ? "true" : "false"}
            >
              {tableWorkspaceT("more")}
              <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </div>

      <div
        className={`qtable-table-state-strip${hasStateStrip ? "" : " is-empty"}`}
        aria-label={tableWorkspaceT("filtersActive")}
      >
        {visibleFilterChips.map((filter, index) => {
          const field = fieldMap.get(filter.fieldId);
          const logic =
            index === 0
              ? ""
              : filter.logic === "or"
                ? tableWorkspaceT("or")
                : tableWorkspaceT("and");
          return (
            <span key={filter.id} className="qtable-table-state-chip is-filter">
              {logic ? <span>{logic}</span> : null}
              <strong>
                {field?.name || filter.fieldId} {operatorLabel(filter.operator)}{" "}
                {formatFilterValue(filter.fieldId, filter.value)}
              </strong>
              {canEditView ? (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label={`${tableWorkspaceT("clearFilters")} · ${field?.name || filter.fieldId}`}
                  onClick={() => removeFilter(filter.id)}
                />
              ) : null}
            </span>
          );
        })}
        {extraFilterCount > 0 ? (
          <span className="qtable-table-state-overflow">
            {tableWorkspaceT("moreConditions", { count: extraFilterCount })}
          </span>
        ) : null}
        {filters.length > 0 && canEditView ? (
          <Button type="link" size="small" onClick={() => setFilters([])}>
            {tableWorkspaceT("clearFilters")}
          </Button>
        ) : null}

        {visibleSortChips.map((sort) => (
          <span
            key={`${sort.fieldId}:${sort.order}`}
            className="qtable-table-state-chip is-sort"
          >
            <span>{tableWorkspaceT("sort")}</span>
            <strong>{fieldMap.get(sort.fieldId)?.name || sort.fieldId}</strong>
            <span>
              {sort.order === "asc"
                ? tableWorkspaceT("ascending")
                : tableWorkspaceT("descending")}
            </span>
          </span>
        ))}
        {extraSortCount > 0 ? (
          <span className="qtable-table-state-overflow">
            {tableWorkspaceT("moreConditions", { count: extraSortCount })}
          </span>
        ) : null}

        {groupField ? (
          <span className="qtable-table-state-chip is-group">
            <span>{tableWorkspaceT("group")}</span>
            <strong>{groupField.name}</strong>
            <span>
              {groupConfig.order === "asc"
                ? tableWorkspaceT("ascending")
                : tableWorkspaceT("descending")}
            </span>
          </span>
        ) : null}

        {hiddenFieldIds.length > 0 ? (
          <span className="qtable-table-state-chip">
            <strong>
              {tableWorkspaceT("hiddenFields", { count: hiddenFieldIds.length })}
            </strong>
          </span>
        ) : null}
      </div>

      {showEmptyGuidance ? (
        <section
          className="qtable-table-empty-guidance"
          aria-label="空表下一步"
          data-empty-actions="ai,csv,qnote,manual"
        >
          <div className="qtable-table-empty-copy">
            <span className="qtable-table-empty-icon" aria-hidden="true">
              <RobotOutlined />
            </span>
            <div>
              <strong>这张表还没有记录，直接选择下一步</strong>
              <span>
                AI 不是唯一入口；导入、QNote / Clipper 和传统手工创建都可以直接开始。
              </span>
            </div>
          </div>
          <div className="qtable-table-empty-actions">
            <Button
              type="primary"
              icon={<RobotOutlined />}
              disabled={!canEditView || fields.length === 0}
              onClick={() => setTaskPlanningOpen(true)}
            >
              帮我生成任务
            </Button>
            <Button
              icon={<ImportOutlined />}
              disabled={!canUpdate || fields.length === 0}
              onClick={() => setCsvImportOpen(true)}
            >
              导入 CSV
            </Button>
            <Button
              icon={<InboxOutlined />}
              disabled={!workspaceId || fields.length === 0}
              onClick={openSourceInbox}
            >
              从 QNote 导入
            </Button>
            {fields.length > 0 ? (
              <Button
                icon={<PlusOutlined />}
                loading={firstRowCreating}
                disabled={!canUpdate}
                onClick={() => void handleCreateFirstRow()}
              >
                添加第一条记录
              </Button>
            ) : (
              <Button
                icon={<ControlOutlined />}
                disabled={!canEditView}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setAdvancedControlsOpen(true);
                  openAddFieldEditor({ x: rect.left, y: rect.bottom + 6 });
                }}
              >
                配置第一个字段
              </Button>
            )}
          </div>
        </section>
      ) : null}

      <CsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
      />
      <TaskPlanningModal
        open={taskPlanningOpen}
        workspaceId={workspaceId}
        targetTableId={currentTableId || ""}
        onClose={() => setTaskPlanningOpen(false)}
        onApplied={onTaskPlanningApplied}
      />
      <WorkloadPlanningModal
        open={workloadPlanningOpen}
        workspaceId={workspaceId}
        tableId={currentTableId || ""}
        onClose={() => setWorkloadPlanningOpen(false)}
        onApplied={onWorkloadPlanningApplied}
        canApply={canEditView}
      />
      <ProjectStewardModal
        open={projectStewardOpen}
        workspaceId={workspaceId}
        tableId={currentTableId || ""}
        onClose={() => setProjectStewardOpen(false)}
      />
      <AiVisualDesignerModal
        open={aiVisualDesignerOpen}
        workspaceId={workspaceId}
        tableId={currentTableId || ""}
        defaultTargetType="view"
        onClose={() => setAiVisualDesignerOpen(false)}
        onApplied={onAiVisualDesignApplied}
      />
      <RowPermissionModal
        open={rowPermissionOpen}
        onClose={() => setRowPermissionOpen(false)}
        tableId={currentTableId}
        fields={fields}
        canManage={canManage}
      />
      {fieldEditor ? (
        <FieldConfigPopover
          key={fieldEditor.key}
          open
          mode="add"
          position={fieldEditor.position}
          field={null}
          onClose={() => setFieldEditor(null)}
          onSubmit={handleSubmitField}
        />
      ) : null}
    </>
  );
}
