import { Avatar, Button, Dropdown, Tooltip, type MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import dayjs from "dayjs";
import type { ReactNode, SyntheticEvent } from "react";
import { t } from "../../../../lib/i18nRuntime";
import type { Field } from "../../../../store/useSmartTableStore";
import type { TaskProfileConfig } from "../../../TaskProfile/taskProfile";
import { getTextColor } from "../../utils/colorUtils";
import { formatNumberValue } from "../../utils/formatNumber";
import type { BoardCard, BoardDescriptor, BoardMoveTarget } from "./types";

type Props = {
  card: BoardCard;
  fields: Field[];
  profile: TaskProfileConfig;
  cardFieldIds: string[];
  columnKey: string;
  laneKey: string | null;
  columns: BoardDescriptor[];
  canUpdate: boolean;
  onOpen: (recordId: string) => void;
  onMove: (recordId: string, target: BoardMoveTarget) => void;
};

const fieldById = (fields: Field[], id?: string | null) =>
  id ? fields.find((field) => field.id === id) : undefined;

const primitive = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(primitive).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const data = value as Record<string, unknown>;
    return primitive(data.label ?? data.name ?? data.id ?? data.value);
  }
  return String(value);
};

const optionFor = (field: Field | undefined, value: unknown) => {
  const raw = primitive(value);
  return field?.options?.find(
    (option) => option.id === raw || option.label === raw,
  );
};

const displayValue = (field: Field, value: unknown): ReactNode => {
  if (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }
  if (field.type === "date") {
    const date = dayjs(value as string | number | Date);
    return date.isValid()
      ? date.format(field.property?.format || "YYYY-MM-DD")
      : null;
  }
  if (field.type === "select") {
    const option = optionFor(field, value);
    return option ? (
      <span
        className="q-kanban-tag"
        style={{
          backgroundColor: option.color,
          color: getTextColor(option.color),
        }}
      >
        {option.label}
      </span>
    ) : (
      primitive(value)
    );
  }
  if (field.type === "multiSelect") {
    const values = Array.isArray(value) ? value : [value];
    return (
      <span className="q-kanban-tags">
        {values.slice(0, 3).map((item, index) => {
          const option = optionFor(field, item);
          return (
            <span
              key={`${primitive(item)}:${index}`}
              className="q-kanban-tag"
              style={
                option
                  ? {
                      backgroundColor: option.color,
                      color: getTextColor(option.color),
                    }
                  : undefined
              }
            >
              {option?.label || primitive(item)}
            </span>
          );
        })}
      </span>
    );
  }
  if (field.type === "number") return formatNumberValue(value, field);
  return primitive(value);
};

const memberLabels = (field: Field | undefined, value: unknown) => {
  const values = value == null ? [] : Array.isArray(value) ? value : [value];
  return values
    .map((item) => {
      const raw = primitive(item);
      const option = field?.options?.find(
        (candidate) => candidate.id === raw || candidate.label === raw,
      );
      return option?.label || raw;
    })
    .filter(Boolean);
};

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();

const statusMatches = (value: unknown, configured: string[], field?: Field) => {
  if (!configured.length) return false;
  const raw = primitive(value);
  const option = optionFor(field, raw);
  const candidates = new Set([raw, option?.id || "", option?.label || ""]);
  return configured.some((item) => candidates.has(String(item)));
};

export function KanbanCard({
  card,
  fields,
  profile,
  cardFieldIds,
  columnKey,
  laneKey,
  columns,
  canUpdate,
  onOpen,
  onMove,
}: Props) {
  const record = card.record;
  const titleField = fieldById(fields, profile.titleFieldId);
  const statusField = fieldById(fields, profile.statusFieldId);
  const memberField = fieldById(fields, profile.assigneeFieldId);
  const priorityField = fieldById(fields, profile.priorityFieldId);
  const dueField = fieldById(
    fields,
    profile.dueDateFieldId || profile.startDateFieldId,
  );
  const progressField = fieldById(fields, profile.progressFieldId);
  const title = titleField ? primitive(record[titleField.id]) : "";
  const members = memberLabels(
    memberField,
    memberField ? record[memberField.id] : null,
  );
  const priority = priorityField
    ? optionFor(priorityField, record[priorityField.id])
    : undefined;
  const statusValue = statusField ? record[statusField.id] : null;
  const blocked = statusMatches(
    statusValue,
    profile.blockedStatusValues,
    statusField,
  );
  const completed = statusMatches(
    statusValue,
    profile.completedStatusValues,
    statusField,
  );

  let dueState: "normal" | "today" | "overdue" = "normal";
  let dueLabel = "";
  if (dueField && record[dueField.id]) {
    const due = dayjs(record[dueField.id] as string | number | Date);
    if (due.isValid()) {
      dueLabel = due.format(dueField.property?.format || "YYYY-MM-DD");
      if (!completed && due.isBefore(dayjs().startOf("day"))) {
        dueState = "overdue";
      } else if (!completed && due.isSame(dayjs(), "day")) {
        dueState = "today";
      }
    }
  }

  const progressValue = progressField ? Number(record[progressField.id]) : NaN;
  const progressMax = progressField?.property?.max || 100;
  const progress = Number.isFinite(progressValue)
    ? Math.max(0, Math.min(100, (progressValue / progressMax) * 100))
    : null;

  const extraFields = cardFieldIds
    .map((id) => fieldById(fields, id))
    .filter((field): field is Field => Boolean(field))
    .filter(
      (field) =>
        ![
          profile.titleFieldId,
          profile.statusFieldId,
          profile.assigneeFieldId,
          profile.priorityFieldId,
          profile.dueDateFieldId,
          profile.progressFieldId,
        ].includes(field.id),
    )
    .slice(0, 4);

  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: card.record.id,
    disabled: !canUpdate,
    data: { kind: "card", recordId: card.record.id, columnKey, laneKey },
  });
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `card:${card.record.id}`,
    data: { kind: "card", recordId: card.record.id, columnKey, laneKey },
  });
  const setNodeRef = (node: HTMLElement | null) => {
    setDragNodeRef(node);
    setDropNodeRef(node);
  };

  const moveItems: MenuProps["items"] = columns
    .filter((column) => column.key !== columnKey)
    .map((column) => ({
      key: column.key,
      label: t("kanban.moveToColumn", { column: column.label }),
    }));

  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const displayTitle = title || t("kanban.unnamedRecord");

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...(canUpdate ? listeners : {})}
      className={[
        "q-kanban-card",
        isDragging ? "is-dragging" : "",
        isOver ? "is-over" : "",
        blocked ? "is-blocked" : "",
        !canUpdate ? "is-readonly" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ transform: CSS.Translate.toString(transform) }}
      tabIndex={0}
      role="button"
      aria-label={t("kanban.openRecord", { title: displayTitle })}
      onClick={() => onOpen(card.record.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(card.record.id);
        }
      }}
    >
      <div className="q-kanban-card__topline">
        {priority ? (
          <span
            className="q-kanban-priority"
            style={{
              backgroundColor: priority.color,
              color: getTextColor(priority.color),
            }}
          >
            {priority.label}
          </span>
        ) : (
          <span />
        )}
        <Dropdown
          trigger={["click"]}
          menu={{
            items: moveItems,
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              onMove(card.record.id, { columnKey: key, laneKey });
            },
          }}
          disabled={!canUpdate || moveItems.length === 0}
        >
          <Button
            type="text"
            size="small"
            className="q-kanban-card__more"
            icon={<MoreOutlined />}
            aria-label={t("kanban.moreActions")}
            onClick={stop}
            onPointerDown={stop}
          />
        </Dropdown>
      </div>

      <div className="q-kanban-card__title">{displayTitle}</div>

      {(members.length > 0 || dueLabel) && (
        <div className="q-kanban-card__meta">
          {members.length > 0 && (
            <div
              className="q-kanban-card__people"
              aria-label={`${t("kanban.assignee")} ${members.join(", ")}`}
            >
              <Avatar.Group size={22} max={{ count: 3 }}>
                {members.slice(0, 4).map((name) => (
                  <Tooltip key={name} title={name}>
                    <Avatar size={22}>{initials(name)}</Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
              <span className="q-kanban-card__person-name">{members[0]}</span>
            </div>
          )}
          {dueLabel && (
            <span className={`q-kanban-due is-${dueState}`}>
              {dueState === "overdue"
                ? t("kanban.overduePrefix")
                : dueState === "today"
                  ? t("kanban.todayPrefix")
                  : ""}
              {dueLabel}
            </span>
          )}
        </div>
      )}

      {progress !== null && (
        <div
          className="q-kanban-progress"
          aria-label={`${t("kanban.progressLabel")} ${Math.round(progress)}%`}
        >
          <div className="q-kanban-progress__track">
            <span
              className="q-kanban-progress__value"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{Math.round(progress)}%</span>
        </div>
      )}

      {extraFields.length > 0 && (
        <div className="q-kanban-card__fields">
          {extraFields.map((field) => {
            const value = displayValue(field, record[field.id]);
            if (!value) return null;
            return (
              <div className="q-kanban-card__field" key={field.id}>
                <span className="q-kanban-card__field-label">{field.name}</span>
                <span className="q-kanban-card__field-value">{value}</span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
