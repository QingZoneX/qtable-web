import { Alert, Button, Empty, Space, Spin, Typography, message } from "antd";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { t } from "../../../lib/i18nRuntime";
import { useLanguage } from "../../../lib/useLanguage";
import {
  permissionAllows,
  useSmartTableStore,
  type Field,
} from "../../../store/useSmartTableStore";
import {
  openTaskProfileSettings,
  type TaskProfileConfig,
} from "../../TaskProfile/taskProfile";
import { TaskProfileDrawer } from "../../TaskProfile/TaskProfileDrawer";
import { useTaskProfile } from "../../TaskProfile/useTaskProfile";
import { BoardSettingsDrawer } from "./kanban/BoardSettingsDrawer";
import { KanbanCell, KanbanColumnHeader } from "./kanban/KanbanCell";
import { useServerBoard } from "./kanban/useServerBoard";
import type {
  BoardConfig,
  BoardDescriptor,
  BoardMoveTarget,
} from "./kanban/types";
import { boardCellKey } from "./kanban/types";
import "./kanban/kanban.css";

const { Text, Title } = Typography;

const fieldById = (fields: Field[], id?: string | null) =>
  id ? fields.find((field) => field.id === id) : undefined;

function TaskProfileSetupState({
  message: description,
  issues,
}: {
  message: string;
  issues?: string[];
}) {
  return (
    <div className="q-kanban__empty">
      <div style={{ width: "min(560px, 100%)" }}>
        {issues?.length ? (
          <Alert
            type="warning"
            showIcon
            message={t("kanban.semanticRepair")}
            description={
              <ul style={{ margin: "8px 0 0", paddingInlineStart: 18 }}>
                {issues.map((issue, index) => (
                  <li key={`${index}:${issue}`}>{issue}</li>
                ))}
              </ul>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={8}>
              <Title level={5} style={{ margin: 0 }}>
                {t("kanban.semanticRequired")}
              </Title>
              <Text type="secondary">{description}</Text>
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={openTaskProfileSettings}
              >
                {t("kanban.configureSemantic")}
              </Button>
            </Space>
          }
        />
      </div>
    </div>
  );
}

const buildCompletedValues = (profile: TaskProfileConfig, statusField?: Field) => {
  const values = new Set(profile.completedStatusValues.map(String));
  for (const configured of profile.completedStatusValues) {
    const option = statusField?.options?.find(
      (item) => item.id === String(configured) || item.label === String(configured),
    );
    if (option) {
      values.add(option.id);
      values.add(option.label);
    }
  }
  return values;
};

const laneTotal = (lane: BoardDescriptor) => lane.count;

export function BoardView() {
  useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    fields,
    filters,
    sorts,
    currentPermission,
    currentTableId,
    currentViewId,
    insertRow,
  } = useSmartTableStore();
  const canUpdate = permissionAllows(currentPermission, "update");
  const canEditConfig = permissionAllows(currentPermission, "edit");
  const { profile, loading: profileLoading } = useTaskProfile(currentTableId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());

  const profileConfig = profile?.config;
  const statusField = profileConfig
    ? fieldById(fields, profileConfig.statusFieldId)
    : undefined;
  const boardEnabled = Boolean(
    currentTableId && currentViewId && profile?.valid && statusField,
  );

  const board = useServerBoard({
    tableId: boardEnabled ? currentTableId : null,
    viewId: boardEnabled ? currentViewId : null,
    filters,
    sorts,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const completedValues = useMemo(
    () =>
      profileConfig
        ? buildCompletedValues(profileConfig, statusField)
        : new Set<string>(),
    [profileConfig, statusField],
  );

  const visibleColumns = useMemo(() => {
    const columns = board.metadata?.columns || [];
    if (!board.metadata?.boardConfig.hideCompleted) return columns;
    return columns.filter(
      (column) => !completedValues.has(String(column.value ?? "")),
    );
  }, [board.metadata, completedValues]);

  const boardConfig = board.metadata?.boardConfig;
  const collapsedColumns = useMemo(
    () => new Set(boardConfig?.collapsedColumns || []),
    [boardConfig?.collapsedColumns],
  );
  const lanes = board.metadata?.lanes || [];
  const hasLanes = Boolean(boardConfig?.laneFieldId && lanes.length);

  const gridTemplate = useMemo(() => {
    const columnTracks = visibleColumns.map((column) =>
      collapsedColumns.has(column.key)
        ? "52px"
        : "var(--q-kanban-column-width)",
    );
    return [hasLanes ? "var(--q-kanban-lane-width)" : null, ...columnTracks]
      .filter(Boolean)
      .join(" ");
  }, [collapsedColumns, hasLanes, visibleColumns]);

  const gridStyle = {
    "--q-kanban-grid-template": gridTemplate,
  } as CSSProperties;

  const cellCount = (columnKey: string, laneKey: string | null) =>
    board.metadata?.cells.find(
      (cell) =>
        cell.columnKey === columnKey && (cell.laneKey || null) === laneKey,
    )?.count || 0;

  const handleOpenRecord = (recordId: string) => {
    const params = new URLSearchParams(location.search);
    params.set("recordId", recordId);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` });
  };

  const move = async (recordId: string, target: BoardMoveTarget) => {
    try {
      await board.moveCard(recordId, target);
    } catch (error) {
      message.error(
        error instanceof Error
          ? t("kanban.moveRollbackDetail", { message: error.message })
          : t("kanban.moveRollback"),
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canUpdate || !event.over) return;
    const recordId = String(event.active.data.current?.recordId || event.active.id);
    const overData = event.over.data.current;
    if (!overData) return;
    if (overData.kind === "card" && String(overData.recordId) === recordId) return;

    const target: BoardMoveTarget = {
      columnKey: String(overData.columnKey),
      laneKey: overData.laneKey ? String(overData.laneKey) : null,
      // Dropping on a card means "insert before this card". The backend
      // represents that card as the next/after anchor when calculating rank.
      afterRecordId:
        overData.kind === "card" ? String(overData.recordId) : null,
    };
    void move(recordId, target);
  };

  const addRecord = async (
    columnKey: string,
    laneKey: string | null = null,
  ) => {
    if (!canUpdate || !profileConfig || !statusField) return;
    const column = board.metadata?.columns.find((item) => item.key === columnKey);
    if (!column) return;
    const preset: Record<string, unknown> = {
      [statusField.id]: column.value ?? "",
    };
    if (boardConfig?.laneFieldId && laneKey) {
      const lane = lanes.find((item) => item.key === laneKey);
      preset[boardConfig.laneFieldId] = lane?.value ?? "";
    }
    const inserted = await insertRow(preset);
    if (inserted) {
      await board.refreshAll();
      handleOpenRecord(inserted.id);
    }
  };

  const saveConfig = async (nextConfig: BoardConfig) =>
    board.saveConfig(nextConfig);

  const toggleColumn = async (columnKey: string) => {
    if (!boardConfig || !canEditConfig) return;
    const next = new Set(boardConfig.collapsedColumns || []);
    if (next.has(columnKey)) next.delete(columnKey);
    else next.add(columnKey);
    try {
      await saveConfig({ ...boardConfig, collapsedColumns: [...next] });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t("kanban.collapseSaveFailed"),
      );
    }
  };

  const toggleLane = (laneKey: string) => {
    setCollapsedLanes((current) => {
      const next = new Set(current);
      if (next.has(laneKey)) next.delete(laneKey);
      else next.add(laneKey);
      return next;
    });
  };

  const initializeBoard = async () => {
    if (!profileConfig?.statusFieldId) return;
    try {
      await saveConfig({
        groupFieldId: profileConfig.statusFieldId,
        laneFieldId: null,
        cardFieldIds: [],
        cardOrder: "manual",
        hideCompleted: false,
        collapsedColumns: [],
      });
      message.success(t("kanban.configInitialized"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("kanban.configInitFailed"));
    }
  };

  if (profileLoading && !profile) {
    return (
      <div className="q-kanban__loading" role="status" aria-label={t("kanban.loading")}>
        <Spin />
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <TaskProfileSetupState message={t("kanban.profileMissing")} />
        <TaskProfileDrawer tableId={currentTableId || undefined} />
      </>
    );
  }

  if (!profile.valid) {
    return (
      <>
        <TaskProfileSetupState
          message={t("kanban.profileInvalid")}
          issues={(profile.issues || []).map((issue) => issue.message)}
        />
        <TaskProfileDrawer tableId={currentTableId || undefined} />
      </>
    );
  }

  if (!statusField || !profileConfig) {
    return (
      <>
        <TaskProfileSetupState message={t("kanban.statusMissing")} />
        <TaskProfileDrawer tableId={currentTableId || undefined} />
      </>
    );
  }

  if (board.loading && !board.metadata) {
    return (
      <div className="q-kanban__loading" role="status" aria-label={t("kanban.loading")}>
        <Spin />
      </div>
    );
  }

  if (board.error && !board.metadata) {
    return (
      <div className="q-kanban__error">
        <Alert
          type="error"
          showIcon
          message={t("kanban.serverConfigUnavailable")}
          description={board.error}
          action={
            canEditConfig ? (
              <Button type="primary" onClick={() => void initializeBoard()}>
                {t("kanban.initializeFromProfile")}
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  if (!board.metadata || !boardConfig) return null;

  const configMisaligned = boardConfig.groupFieldId !== statusField.id;

  return (
    <div className="q-kanban">
      <div className="q-kanban__toolbar">
        <div className="q-kanban__toolbar-main">
          <span className="q-kanban__toolbar-title">{t("kanban.title")}</span>
          <span className="q-kanban__toolbar-hint">
            {hasLanes ? `${t("kanban.laneCount", { count: lanes.length })} · ` : ""}
            {t("kanban.columnCount", { count: visibleColumns.length })} · {t("kanban.serverPaged")}
          </span>
        </div>
        <div className="q-kanban__toolbar-actions">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => void board.refreshAll()}
          >
            {t("kanban.refresh")}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
          >
            {t("kanban.settings")}
          </Button>
          <Button type="text" size="small" onClick={openTaskProfileSettings}>
            {t("kanban.semantic")}
          </Button>
        </div>
      </div>

      {configMisaligned ? (
        <Alert
          banner
          type="warning"
          message={t("kanban.configMismatch")}
          action={
            canEditConfig ? (
              <Button size="small" onClick={() => setSettingsOpen(true)}>
                {t("kanban.fixConfig")}
              </Button>
            ) : null
          }
        />
      ) : null}

      <DndContext
        sensors={canUpdate ? sensors : []}
        onDragEnd={handleDragEnd}
      >
        <div className="q-kanban__viewport">
          <div className="q-kanban__matrix">
            <div className="q-kanban__header-row" style={gridStyle}>
              {hasLanes ? <div className="q-kanban__lane-spacer" /> : null}
              {visibleColumns.map((column) => (
                <KanbanColumnHeader
                  key={column.key}
                  column={column}
                  count={column.count}
                  collapsed={collapsedColumns.has(column.key)}
                  canEditConfig={canEditConfig}
                  canUpdate={canUpdate}
                  onToggle={(key) => void toggleColumn(key)}
                  onAdd={(key) => void addRecord(key)}
                />
              ))}
            </div>

            {hasLanes ? (
              lanes.map((lane) => {
                const laneCollapsed = collapsedLanes.has(lane.key);
                return (
                  <div
                    className="q-kanban__lane-row"
                    style={gridStyle}
                    key={lane.key}
                  >
                    <button
                      type="button"
                      className={`q-kanban__lane-label ${
                        laneCollapsed ? "is-collapsed" : ""
                      }`}
                      onClick={() => toggleLane(lane.key)}
                      aria-expanded={!laneCollapsed}
                    >
                      <span className="q-kanban__lane-label-main">
                        {laneCollapsed ? (
                          <CaretRightOutlined />
                        ) : (
                          <CaretDownOutlined />
                        )}
                        <span className="q-kanban__lane-label-title">
                          {lane.label}
                        </span>
                        <span className="q-kanban__lane-label-count">
                          {laneTotal(lane)}
                        </span>
                      </span>
                    </button>
                    {laneCollapsed ? (
                      <div className="q-kanban__lane-collapsed-row">
                        {t("kanban.laneCollapsed")}
                      </div>
                    ) : (
                      visibleColumns.map((column) => {
                        const count = cellCount(column.key, lane.key);
                        return (
                          <KanbanCell
                            key={`${lane.key}:${column.key}`}
                            column={column}
                            laneKey={lane.key}
                            count={count}
                            state={
                              board.cells[boardCellKey(column.key, lane.key)]
                            }
                            fields={fields}
                            profile={profileConfig}
                            cardFieldIds={boardConfig.cardFieldIds}
                            columns={visibleColumns}
                            canUpdate={canUpdate}
                            collapsed={collapsedColumns.has(column.key)}
                            onEnsure={(columnKey, nextLaneKey) =>
                              void board.ensureCell(columnKey, nextLaneKey)
                            }
                            onLoadMore={(columnKey, nextLaneKey) =>
                              void board.loadMore(columnKey, nextLaneKey)
                            }
                            onOpen={handleOpenRecord}
                            onMove={(recordId, target) =>
                              void move(recordId, target)
                            }
                          />
                        );
                      })
                    )}
                  </div>
                );
              })
            ) : (
              <div className="q-kanban__lane-row" style={gridStyle}>
                {visibleColumns.map((column) => {
                  const count = cellCount(column.key, null);
                  return (
                    <KanbanCell
                      key={column.key}
                      column={column}
                      laneKey={null}
                      count={count}
                      state={board.cells[boardCellKey(column.key, null)]}
                      fields={fields}
                      profile={profileConfig}
                      cardFieldIds={boardConfig.cardFieldIds}
                      columns={visibleColumns}
                      canUpdate={canUpdate}
                      collapsed={collapsedColumns.has(column.key)}
                      onEnsure={(columnKey, nextLaneKey) =>
                        void board.ensureCell(columnKey, nextLaneKey)
                      }
                      onLoadMore={(columnKey, nextLaneKey) =>
                        void board.loadMore(columnKey, nextLaneKey)
                      }
                      onOpen={handleOpenRecord}
                      onMove={(recordId, target) => void move(recordId, target)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DndContext>

      <BoardSettingsDrawer
        open={settingsOpen}
        fields={fields}
        profile={profileConfig}
        config={boardConfig}
        canEdit={canEditConfig}
        onClose={() => setSettingsOpen(false)}
        onSave={saveConfig}
      />
      <TaskProfileDrawer tableId={currentTableId || undefined} />
    </div>
  );
}
