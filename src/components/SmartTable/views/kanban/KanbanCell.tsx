import { Button, Empty, Spin, Tooltip } from "antd";
import {
  CaretRightOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useDroppable } from "@dnd-kit/core";
import { useEffect } from "react";
import { t } from "../../../../lib/i18nRuntime";
import type { Field } from "../../../../store/useSmartTableStore";
import type { TaskProfileConfig } from "../../../TaskProfile/taskProfile";
import { KanbanCard } from "./KanbanCard";
import type {
  BoardCellState,
  BoardDescriptor,
  BoardMoveTarget,
} from "./types";

type CellProps = {
  column: BoardDescriptor;
  laneKey: string | null;
  count: number;
  state?: BoardCellState;
  fields: Field[];
  profile: TaskProfileConfig;
  cardFieldIds: string[];
  columns: BoardDescriptor[];
  canUpdate: boolean;
  collapsed: boolean;
  onEnsure: (columnKey: string, laneKey: string | null) => void;
  onLoadMore: (columnKey: string, laneKey: string | null) => void;
  onOpen: (recordId: string) => void;
  onMove: (recordId: string, target: BoardMoveTarget) => void;
};

export function KanbanCell({
  column,
  laneKey,
  count,
  state,
  fields,
  profile,
  cardFieldIds,
  columns,
  canUpdate,
  collapsed,
  onEnsure,
  onLoadMore,
  onOpen,
  onMove,
}: CellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${laneKey || "__default__"}:${column.key}`,
    data: { kind: "cell", columnKey: column.key, laneKey },
  });

  useEffect(() => {
    if (!collapsed && count > 0 && !state?.loaded && !state?.loading) {
      onEnsure(column.key, laneKey);
    }
  }, [collapsed, column.key, count, laneKey, onEnsure, state?.loaded, state?.loading]);

  if (collapsed) {
    return <div className="q-kanban-cell q-kanban-cell--collapsed" aria-hidden="true" />;
  }

  const remaining = state?.pageInfo
    ? Math.max(0, state.pageInfo.totalCount - (state?.cards.length ?? 0))
    : 0;

  return (
    <section
      ref={setNodeRef}
      className={`q-kanban-cell ${isOver ? "is-over" : ""}`}
      aria-label={t("kanban.cellLabel", { column: column.label, count })}
    >
      <div className="q-kanban-cell__cards">
        {state?.cards.map((card) => (
          <KanbanCard
            key={card.record.id}
            card={card}
            fields={fields}
            profile={profile}
            cardFieldIds={cardFieldIds}
            columnKey={column.key}
            laneKey={laneKey}
            columns={columns}
            canUpdate={canUpdate}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
      </div>

      {state?.loading && !state.cards.length ? (
        <div className="q-kanban-cell__status" role="status" aria-label={t("kanban.loading")}>
          <Spin size="small" />
        </div>
      ) : null}
      {state?.error ? (
        <div className="q-kanban-cell__status q-kanban-cell__status--error" role="alert">
          <span>{state.error}</span>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => onEnsure(column.key, laneKey)}
          >
            {t("kanban.retry")}
          </Button>
        </div>
      ) : null}
      {!state?.loading && state?.loaded && !state.cards.length && count === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("kanban.noRecords")} />
      ) : null}
      {state?.pageInfo?.hasMore ? (
        <Button
          className="q-kanban-cell__load-more"
          type="text"
          size="small"
          loading={state.loading}
          onClick={() => onLoadMore(column.key, laneKey)}
        >
          {t("kanban.loadMore")} · {t("kanban.remaining", { count: remaining })}
        </Button>
      ) : null}
    </section>
  );
}

export function KanbanColumnHeader({
  column,
  count,
  collapsed,
  canEditConfig,
  canUpdate,
  onToggle,
  onAdd,
}: {
  column: BoardDescriptor;
  count: number;
  collapsed: boolean;
  canEditConfig: boolean;
  canUpdate: boolean;
  onToggle: (columnKey: string) => void;
  onAdd: (columnKey: string) => void;
}) {
  const addLabel = t("kanban.addToColumn", { column: column.label });
  const toggleLabel = t(
    collapsed ? "kanban.expandColumn" : "kanban.collapseColumn",
    { column: column.label },
  );

  return (
    <header className={`q-kanban-column-header ${collapsed ? "is-collapsed" : ""}`}>
      <div className="q-kanban-column-header__main">
        <span className="q-kanban-column-header__dot" aria-hidden="true" />
        {!collapsed ? (
          <>
            <span className="q-kanban-column-header__title">{column.label}</span>
            <span className="q-kanban-column-header__count">{count}</span>
          </>
        ) : null}
      </div>
      <div className="q-kanban-column-header__actions">
        {canUpdate && !collapsed ? (
          <Tooltip title={addLabel}>
            <Button
              type="text"
              size="small"
              aria-label={addLabel}
              icon={<PlusOutlined />}
              onClick={() => onAdd(column.key)}
            />
          </Tooltip>
        ) : null}
        {canEditConfig ? (
          <Tooltip title={toggleLabel}>
            <Button
              type="text"
              size="small"
              aria-label={toggleLabel}
              icon={collapsed ? <CaretRightOutlined /> : <MinusOutlined />}
              onClick={() => onToggle(column.key)}
            />
          </Tooltip>
        ) : null}
      </div>
      {collapsed ? <span className="q-kanban-column-header__vertical-title">{column.label}</span> : null}
    </header>
  );
}
