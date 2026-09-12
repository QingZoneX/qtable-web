import {
  Alert,
  Button,
  Empty,
  Modal,
  Select,
  message,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { t } from "../../../lib/i18nRuntime";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  permissionAllows,
  useSmartTableStore,
  type Field,
  type TableRecord,
} from "../../../store/useSmartTableStore";
import { useTableRecords } from "../hooks/useTableRecords";
import { RowDetailDrawer } from "../RowDetailDrawer";
import {
  calendarRangeDays,
  layoutWeekRanges,
  moveRangeToDay,
  parseCalendarDate,
  resizeRangeEndToDay,
  resizeRangeStartToDay,
  resolveRecordRange,
  type CalendarRecordRange,
  type CalendarWeekSegment,
} from "./calendarRangeUtils";

const { Text } = Typography;
const DAY_ID_PREFIX = "calendar-day:";
const RECORD_ID_PREFIX = "calendar-record:";
const UNSCHEDULED_ID = "calendar-unscheduled";

type CalendarDragMode = "move" | "resize-start" | "resize-end";

type CalendarDragPayload = {
  recordId: string;
  mode: CalendarDragMode;
};

const buildDragId = (
  recordId: string,
  mode: CalendarDragMode,
  segmentKey: string,
) => `${RECORD_ID_PREFIX}${recordId}::${mode}::${segmentKey}`;

const parseDragPayload = (dragId: string): CalendarDragPayload | null => {
  if (!dragId.startsWith(RECORD_ID_PREFIX)) return null;
  const payload = dragId.slice(RECORD_ID_PREFIX.length);
  const [recordId, mode] = payload.split("::");
  if (!recordId) return null;
  if (
    mode !== "move" &&
    mode !== "resize-start" &&
    mode !== "resize-end"
  ) {
    return null;
  }
  return { recordId, mode };
};
const WEEKDAY_MIN_WIDTH = 132;
const EVENT_HEIGHT = 24;
const EVENT_GAP = 4;

type CalendarViewProps = {
  configModalOpen: boolean;
  onConfigModalOpen: () => void;
  onConfigModalClose: () => void;
};

const formatRecordValue = (
  field: Field | undefined,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => formatRecordValue(field, item))
      .filter(Boolean)
      .join(", ");
  }
  if (field?.type === "date") {
    const parsed = parseCalendarDate(value);
    if (parsed) return parsed.format(field.property?.format || "YYYY-MM-DD");
  }
  if (field?.options?.length) {
    const raw =
      typeof value === "object" && value !== null
        ? String(
            (value as { id?: string; label?: string }).id ||
              (value as { id?: string; label?: string }).label ||
              "",
          )
        : String(value);
    const option = field.options.find(
      (item) => item.id === raw || item.label === raw,
    );
    if (option) return option.label;
  }
  if (typeof value === "object") {
    const candidate = value as {
      label?: string;
      name?: string;
      title?: string;
      id?: string;
    };
    return String(
      candidate.label ||
        candidate.name ||
        candidate.title ||
        candidate.id ||
        "",
    );
  }
  return String(value);
};

const eventAccent = (
  secondaryField: Field | undefined,
  record: TableRecord,
): string => {
  if (!secondaryField?.options?.length) return "#2563EB";
  const value = record[secondaryField.id];
  const raw =
    typeof value === "object" && value !== null
      ? String(
          (value as { id?: string; label?: string }).id ||
            (value as { id?: string; label?: string }).label ||
            "",
        )
      : String(value ?? "");
  return (
    secondaryField.options.find(
      (option) => option.id === raw || option.label === raw,
    )?.color || "#2563EB"
  );
};

const eventTitle = (
  record: TableRecord,
  titleField?: Field,
): string =>
  formatRecordValue(
    titleField,
    titleField ? record[titleField.id] : record.id,
  ) || "未命名记录";

const eventSecondary = (
  record: TableRecord,
  secondaryField?: Field,
): string | undefined => {
  if (!secondaryField) return undefined;
  return (
    formatRecordValue(secondaryField, record[secondaryField.id]) || undefined
  );
};

const ResizeHandle = ({
  dragId,
  side,
  disabled,
  emphasized,
}: {
  dragId: string;
  side: "start" | "end";
  disabled: boolean;
  emphasized: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragId,
      disabled,
    });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(event) => event.stopPropagation()}
      title={side === "start" ? "拖动调整开始时间" : "拖动调整结束时间"}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side === "start" ? "left" : "right"]: 0,
        width: 10,
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "ew-resize",
        opacity: isDragging ? 1 : emphasized ? 0.95 : 0.28,
        background: isDragging
          ? "rgba(37, 99, 235, 0.14)"
          : emphasized
            ? "rgba(37, 99, 235, 0.06)"
            : "transparent",
        transform: CSS.Translate.toString(transform),
        transition: "opacity 120ms ease, background 120ms ease",
        touchAction: "none",
      }}
    >
      <span
        style={{
          width: 2,
          height: 14,
          borderRadius: 1,
          background: "#5B8DEF",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.72)",
        }}
      />
    </div>
  );
};

const RangeBar = ({
  segment,
  titleField,
  secondaryField,
  disabled,
  onOpen,
  segmentKey,
  canResize,
}: {
  segment: CalendarWeekSegment;
  titleField?: Field;
  secondaryField?: Field;
  disabled: boolean;
  onOpen: (record: TableRecord) => void;
  segmentKey: string;
  canResize: boolean;
}) => {
  const [hovered, setHovered] = useState(false);
  const record = segment.range.record;
  const moveDragId = buildDragId(record.id, "move", segmentKey);
  const startDragId = buildDragId(record.id, "resize-start", segmentKey);
  const endDragId = buildDragId(record.id, "resize-end", segmentKey);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: moveDragId,
      disabled,
    });
  const title = eventTitle(record, titleField);
  const secondary = eventSecondary(record, secondaryField);
  const accent = eventAccent(secondaryField, record);
  const spanDays = calendarRangeDays(segment.range.start, segment.range.end);
  const showStartHandle =
    canResize && segment.isRangeStart && !segment.range.invalidEnd;
  const showEndHandle =
    canResize && segment.isRangeEnd && !segment.range.invalidEnd;

  return (
    <Tooltip
      placement="top"
      title={
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div style={{ marginTop: 3, opacity: 0.82 }}>
            {segment.range.start.format("M月D日")}
            {spanDays > 1 ? ` → ${segment.range.end.format("M月D日")}` : ""}
            {secondary ? ` · ${secondary}` : ""}
          </div>
          {canResize ? (
            <div style={{ marginTop: 5, opacity: 0.72 }}>
              拖中间移动任务 · 拖左右边缘调整开始/结束
            </div>
          ) : null}
          {segment.range.invalidEnd ? (
            <div style={{ marginTop: 3, color: "#FEC84B" }}>
              结束时间早于开始时间，请先在详情中修正时间范围
            </div>
          ) : null}
        </div>
      }
    >
      <div
        ref={setNodeRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          height: EVENT_HEIGHT,
          borderRadius: `${segment.isRangeStart ? 6 : 2}px ${segment.isRangeEnd ? 6 : 2}px ${segment.isRangeEnd ? 6 : 2}px ${segment.isRangeStart ? 6 : 2}px`,
          border: "1px solid #DCE7FE",
          background: isDragging ? "#DBEAFE" : "#EFF6FF",
          boxShadow: isDragging
            ? "0 8px 22px rgba(37, 99, 235, 0.18)"
            : hovered
              ? "0 2px 7px rgba(37, 99, 235, 0.10)"
              : "0 1px 1px rgba(15, 23, 42, 0.03)",
          transform: CSS.Translate.toString(transform),
          opacity: isDragging ? 0.6 : 1,
          overflow: "hidden",
          userSelect: "none",
          transition: "box-shadow 120ms ease, background 120ms ease",
        }}
      >
        {showStartHandle ? (
          <ResizeHandle
            dragId={startDragId}
            side="start"
            disabled={disabled}
            emphasized={hovered}
          />
        ) : null}

        <div
          {...attributes}
          {...listeners}
          onClick={() => {
            if (!isDragging) onOpen(record);
          }}
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingLeft: showStartHandle ? 12 : 8,
            paddingRight: showEndHandle ? 12 : 8,
            cursor: disabled ? "pointer" : "grab",
            color: "#1D4ED8",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            touchAction: "none",
          }}
        >
          {segment.isRangeStart ? (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: accent,
                flex: "0 0 6px",
              }}
            />
          ) : null}
          {!segment.isRangeStart ? (
            <span style={{ color: "#93B4F8", flexShrink: 0 }}>‹</span>
          ) : null}
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>
          {segment.range.invalidEnd ? (
            <WarningOutlined style={{ color: "#F79009", flexShrink: 0 }} />
          ) : null}
          {!segment.isRangeEnd ? (
            <span style={{ color: "#93B4F8", marginLeft: "auto" }}>›</span>
          ) : null}
        </div>

        {showEndHandle ? (
          <ResizeHandle
            dragId={endDragId}
            side="end"
            disabled={disabled}
            emphasized={hovered}
          />
        ) : null}
      </div>
    </Tooltip>
  );
};

const CalendarDayCell = ({
  day,
  currentMonth,
  today,
  canUpdate,
  onAddRecord,
}: {
  day: Dayjs;
  currentMonth: Dayjs;
  today: Dayjs;
  canUpdate: boolean;
  onAddRecord: (day: Dayjs) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const dayKey = day.format("YYYY-MM-DD");
  const { isOver, setNodeRef } = useDroppable({
    id: `${DAY_ID_PREFIX}${dayKey}`,
    disabled: !canUpdate,
  });
  const isCurrentMonth = day.month() === currentMonth.month();
  const isToday = day.isSame(today, "day");
  const isWeekend = day.day() === 0 || day.day() === 6;

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        height: "100%",
        minWidth: 0,
        padding: "8px 8px 6px",
        borderRight: "1px solid #EEF0F3",
        background: isOver
          ? "#EEF6FF"
          : !isCurrentMonth
            ? "#FAFBFC"
            : isWeekend
              ? "#FCFDFE"
              : "#FFFFFF",
        transition: "background 120ms ease",
      }}
    >
      <div
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            minWidth: 24,
            height: 24,
            padding: isToday ? "0 7px" : 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            background: isToday ? "#2563EB" : "transparent",
            color: isToday
              ? "#FFFFFF"
              : isCurrentMonth
                ? "#475467"
                : "#B4BBC6",
            fontSize: 11,
            fontWeight: isToday ? 700 : 500,
          }}
        >
          {day.date()}
          {day.date() === 1 ? (
            <span style={{ marginLeft: 3, fontSize: 9 }}>
              {day.month() + 1}月
            </span>
          ) : null}
        </span>

        {canUpdate ? (
          <Tooltip title="在这一天新增任务">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: 10 }} />}
              onClick={(event) => {
                event.stopPropagation();
                onAddRecord(day);
              }}
              style={{
                width: 22,
                minWidth: 22,
                height: 22,
                padding: 0,
                color: "#667085",
                opacity: hovered ? 1 : 0.2,
                transition: "opacity 120ms ease",
              }}
            />
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
};

const CalendarWeek = ({
  weekStart,
  ranges,
  currentMonth,
  today,
  titleField,
  secondaryField,
  canUpdate,
  canResizeRange,
  onOpenRecord,
  onAddRecord,
}: {
  weekStart: Dayjs;
  ranges: CalendarRecordRange[];
  currentMonth: Dayjs;
  today: Dayjs;
  titleField?: Field;
  secondaryField?: Field;
  canUpdate: boolean;
  canResizeRange: boolean;
  onOpenRecord: (record: TableRecord) => void;
  onAddRecord: (day: Dayjs) => void;
}) => {
  const layout = useMemo(
    () => layoutWeekRanges(ranges, weekStart),
    [ranges, weekStart],
  );
  const weekHeight = Math.max(
    126,
    50 + layout.laneCount * (EVENT_HEIGHT + EVENT_GAP) + 18,
  );
  const columnWidth = 100 / 7;

  return (
    <div
      style={{
        position: "relative",
        height: weekHeight,
        borderBottom: "1px solid #EEF0F3",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          height: "100%",
        }}
      >
        {Array.from({ length: 7 }, (_, index) => {
          const day = weekStart.add(index, "day");
          return (
            <CalendarDayCell
              key={day.format("YYYY-MM-DD")}
              day={day}
              currentMonth={currentMonth}
              today={today}
              canUpdate={canUpdate}
              onAddRecord={onAddRecord}
            />
          );
        })}
      </div>

      {layout.segments.map((segment) => {
        const spanColumns = segment.endCol - segment.startCol + 1;
        return (
          <div
            key={`${segment.range.record.id}-${weekStart.format("YYYY-MM-DD")}`}
            style={{
              position: "absolute",
              top:
                42 +
                segment.lane * (EVENT_HEIGHT + EVENT_GAP),
              left: `calc(${segment.startCol * columnWidth}% + 4px)`,
              width: `calc(${spanColumns * columnWidth}% - 8px)`,
              zIndex: 2,
            }}
          >
            <RangeBar
              segment={segment}
              segmentKey={weekStart.format("YYYY-MM-DD")}
              titleField={titleField}
              secondaryField={secondaryField}
              disabled={!canUpdate}
              canResize={canResizeRange}
              onOpen={onOpenRecord}
            />
          </div>
        );
      })}
    </div>
  );
};

const UnscheduledArea = ({
  records,
  titleField,
  secondaryField,
  canUpdate,
  onOpenRecord,
  onAddRecord,
}: {
  records: TableRecord[];
  titleField?: Field;
  secondaryField?: Field;
  canUpdate: boolean;
  onOpenRecord: (record: TableRecord) => void;
  onAddRecord: () => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: UNSCHEDULED_ID,
    disabled: !canUpdate,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 52,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid #EEF0F3",
        background: isOver ? "#FFF7E8" : "#FBFCFE",
        transition: "background 120ms ease",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexShrink: 0,
        }}
      >
        <ClockCircleOutlined style={{ color: "#667085" }} />
        <Text strong style={{ fontSize: 12, color: "#344054" }}>
          待安排
        </Text>
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: records.length ? "#EAF0FF" : "#F2F4F7",
            color: records.length ? "#3157C8" : "#98A2B3",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {records.length}
        </span>
        {canUpdate ? (
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={onAddRecord}
            style={{ height: 24, fontSize: 11, padding: "0 6px" }}
          >
            新增
          </Button>
        ) : null}
      </div>

      {records.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          没有开始时间的记录会显示在这里，也可以把任务拖回这里取消排期
        </Text>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            minWidth: 0,
            flex: 1,
            padding: "1px 0",
          }}
        >
          {records.map((record) => (
            <UnscheduledChip
              key={record.id}
              record={record}
              titleField={titleField}
              secondaryField={secondaryField}
              disabled={!canUpdate}
              onOpen={() => onOpenRecord(record)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const UnscheduledChip = ({
  record,
  titleField,
  secondaryField,
  disabled,
  onOpen,
}: {
  record: TableRecord;
  titleField?: Field;
  secondaryField?: Field;
  disabled: boolean;
  onOpen: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: buildDragId(record.id, "move", "unscheduled"),
      disabled,
    });
  const secondary = eventSecondary(record, secondaryField);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onOpen();
      }}
      style={{
        width: 188,
        flex: "0 0 188px",
        height: 30,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 9px",
        border: "1px solid #E4E7EC",
        borderRadius: 7,
        background: isDragging ? "#EEF2FF" : "#FFFFFF",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.03)",
        transform: CSS.Translate.toString(transform),
        cursor: disabled ? "pointer" : "grab",
        opacity: isDragging ? 0.55 : 1,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: eventAccent(secondaryField, record),
          flexShrink: 0,
        }}
      />
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "#344054",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {eventTitle(record, titleField)}
      </span>
      {secondary ? (
        <span
          style={{
            marginLeft: "auto",
            maxWidth: 62,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "#98A2B3",
            fontSize: 10,
          }}
        >
          {secondary}
        </span>
      ) : null}
    </div>
  );
};

export function CalendarView({
  configModalOpen,
  onConfigModalOpen,
  onConfigModalClose,
}: CalendarViewProps) {
  const {
    fields,
    records,
    filters,
    sorts,
    hiddenFieldIds,
    views,
    currentViewId,
    currentPermission,
    updateRecord,
    updateCalendarRange,
    insertRow,
    updateViewConfig,
  } = useSmartTableStore();

  const currentView = views.find((view) => view.id === currentViewId);
  const config = currentView?.config?.calendarConfig;
  const dateFields = useMemo(
    () => fields.filter((field) => field.type === "date"),
    [fields],
  );

  const configuredStartFieldId =
    config?.startFieldId ?? config?.dateFieldId ?? null;
  const startField = useMemo(() => {
    const configured = configuredStartFieldId
      ? dateFields.find((field) => field.id === configuredStartFieldId)
      : undefined;
    return configured || dateFields[0] || null;
  }, [configuredStartFieldId, dateFields]);

  const endField = useMemo(() => {
    if (!config?.endFieldId) return null;
    return (
      dateFields.find(
        (field) =>
          field.id === config.endFieldId &&
          field.id !== startField?.id,
      ) || null
    );
  }, [config?.endFieldId, dateFields, startField?.id]);

  const weekStartsOn = config?.weekStartsOn === 0 ? 0 : 1;
  const visibleFields = useMemo(
    () => fields.filter((field) => !hiddenFieldIds.includes(field.id)),
    [fields, hiddenFieldIds],
  );
  const titleField = useMemo(
    () =>
      visibleFields.find(
        (field) =>
          field.id !== startField?.id &&
          field.id !== endField?.id &&
          field.type === "text",
      ) ||
      visibleFields.find(
        (field) =>
          field.id !== startField?.id &&
          field.id !== endField?.id,
      ) ||
      startField ||
      undefined,
    [endField?.id, startField, visibleFields],
  );
  const secondaryField = useMemo(
    () =>
      visibleFields.find(
        (field) =>
          field.id !== startField?.id &&
          field.id !== endField?.id &&
          field.id !== titleField?.id &&
          (field.type === "select" || field.type === "member"),
      ),
    [endField?.id, startField?.id, titleField?.id, visibleFields],
  );

  const processedRecords = useTableRecords(
    records,
    fields,
    filters,
    sorts,
    { fieldId: null, order: "asc" },
  );
  const canUpdate = permissionAllows(currentPermission, "update");
  const canEdit = permissionAllows(currentPermission, "edit");
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<CalendarDragPayload | null>(null);
  const [draftStartFieldId, setDraftStartFieldId] = useState<string | null>(
    configuredStartFieldId || dateFields[0]?.id || null,
  );
  const [draftEndFieldId, setDraftEndFieldId] = useState<string | null>(
    config?.endFieldId || null,
  );
  const [draftWeekStartsOn, setDraftWeekStartsOn] = useState<0 | 1>(
    weekStartsOn,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!configModalOpen) return;
    const nextStartId =
      config?.startFieldId ??
      config?.dateFieldId ??
      dateFields[0]?.id ??
      null;
    setDraftStartFieldId(nextStartId);
    setDraftEndFieldId(
      config?.endFieldId && config.endFieldId !== nextStartId
        ? config.endFieldId
        : null,
    );
    setDraftWeekStartsOn(config?.weekStartsOn === 0 ? 0 : 1);
  }, [
    config?.dateFieldId,
    config?.endFieldId,
    config?.startFieldId,
    config?.weekStartsOn,
    configModalOpen,
    dateFields,
  ]);

  useEffect(() => {
    if (
      expandedRecordId &&
      !records.some((record) => record.id === expandedRecordId)
    ) {
      setExpandedRecordId(null);
    }
  }, [expandedRecordId, records]);

  const ranges = useMemo(() => {
    if (!startField) return [];
    return processedRecords
      .map((record) =>
        resolveRecordRange(record, startField.id, endField?.id),
      )
      .filter((range): range is CalendarRecordRange => Boolean(range));
  }, [endField?.id, processedRecords, startField]);

  const unscheduledRecords = useMemo(() => {
    if (!startField) return processedRecords;
    return processedRecords.filter(
      (record) => !parseCalendarDate(record[startField.id]),
    );
  }, [processedRecords, startField]);

  const expandedRecord = expandedRecordId
    ? records.find((record) => record.id === expandedRecordId) || null
    : null;
  const activeRecord = activeDrag
    ? records.find((record) => record.id === activeDrag.recordId) || null
    : null;

  const gridStart = useMemo(() => {
    const monthStart = month.startOf("month");
    const offset = (monthStart.day() - weekStartsOn + 7) % 7;
    return monthStart.subtract(offset, "day").startOf("day");
  }, [month, weekStartsOn]);
  const weekStarts = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) =>
        gridStart.add(index * 7, "day"),
      ),
    [gridStart],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const payload = parseDragPayload(String(event.active.id));
    if (!payload) return;
    setActiveDrag(payload);
  };

  const persistCalendarRange = async (
    recordId: string,
    startValue: unknown,
    endValue: unknown,
  ) => {
    if (!startField) return false;
    const success = await updateCalendarRange(
      recordId,
      startField.id,
      startValue,
      endField?.id ?? null,
      endField ? endValue : undefined,
    );
    if (!success) {
      message.error("时间范围更新失败，已恢复原来的排期");
    }
    return success;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const payload = parseDragPayload(String(event.active.id));
    setActiveDrag(null);
    if (!canUpdate || !startField || !payload) return;

    const targetId = event.over ? String(event.over.id) : "";
    if (!targetId) return;

    const record = records.find((item) => item.id === payload.recordId);
    if (!record) return;

    const originalStart = parseCalendarDate(record[startField.id]);
    const rawEnd = endField
      ? parseCalendarDate(record[endField.id])
      : null;

    if (targetId === UNSCHEDULED_ID) {
      if (payload.mode !== "move") return;
      await persistCalendarRange(payload.recordId, null, null);
      return;
    }

    if (!targetId.startsWith(DAY_ID_PREFIX)) return;
    const targetDay = dayjs(targetId.slice(DAY_ID_PREFIX.length));
    if (!targetDay.isValid()) return;

    if (!originalStart) {
      if (payload.mode !== "move") return;
      const target = targetDay.startOf("day");
      await persistCalendarRange(
        payload.recordId,
        target.valueOf(),
        endField ? target.valueOf() : undefined,
      );
      return;
    }

    const validEnd =
      rawEnd && !rawEnd.isBefore(originalStart)
        ? rawEnd
        : null;

    if (payload.mode === "move") {
      const moved = moveRangeToDay(originalStart, validEnd, targetDay);
      if (
        moved.start.isSame(originalStart) &&
        ((!validEnd && !moved.end) ||
          (validEnd && moved.end?.isSame(validEnd)))
      ) {
        return;
      }
      await persistCalendarRange(
        payload.recordId,
        moved.start.valueOf(),
        endField ? moved.end?.valueOf() ?? null : undefined,
      );
      return;
    }

    if (!endField) return;

    // A task with no explicit end value behaves as a one-day range when the
    // user first grabs either resize handle.
    const effectiveEnd =
      validEnd ?? originalStart;

    if (payload.mode === "resize-start") {
      const nextStart = resizeRangeStartToDay(
        originalStart,
        effectiveEnd,
        targetDay,
      );
      if (nextStart.isSame(originalStart)) return;
      await persistCalendarRange(
        payload.recordId,
        nextStart.valueOf(),
        effectiveEnd.valueOf(),
      );
      return;
    }

    if (payload.mode === "resize-end") {
      const nextEnd = resizeRangeEndToDay(
        originalStart,
        effectiveEnd,
        targetDay,
      );
      if (rawEnd && nextEnd.isSame(rawEnd)) return;
      await persistCalendarRange(
        payload.recordId,
        originalStart.valueOf(),
        nextEnd.valueOf(),
      );
    }
  };

  const handleSaveConfig = () => {
    if (!currentView || !draftStartFieldId) return;
    updateViewConfig(currentViewId, {
      ...(currentView.config || {}),
      calendarConfig: {
        startFieldId: draftStartFieldId,
        endFieldId:
          draftEndFieldId === draftStartFieldId
            ? null
            : draftEndFieldId,
        weekStartsOn: draftWeekStartsOn,
      },
    });
    onConfigModalClose();
  };

  const handleAddRecord = async (day?: Dayjs) => {
    if (!canUpdate) return;
    const preset: Record<string, unknown> = {};
    if (day && startField) {
      const dateValue = day.startOf("day").valueOf();
      preset[startField.id] = dateValue;
      if (endField) preset[endField.id] = dateValue;
    }
    const created = await insertRow(
      Object.keys(preset).length ? preset : undefined,
    );
    if (created) setExpandedRecordId(created.id);
  };

  const weekdayLabels =
    weekStartsOn === 1
      ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
      : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const today = dayjs();

  const settingsModal = (
    <Modal
      open={configModalOpen}
      title="日历视图设置"
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      okButtonProps={{ disabled: !draftStartFieldId || !canEdit }}
      onOk={handleSaveConfig}
      onCancel={onConfigModalClose}
      destroyOnHidden
    >
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        {dateFields.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="当前数据表没有日期字段"
            description="请先在表格视图中新增日期字段，再配置任务的开始和结束时间。"
          />
        ) : (
          <>
            <div>
              <Text strong>开始时间字段</Text>
              <Text
                type="secondary"
                style={{ display: "block", margin: "4px 0 8px", fontSize: 12 }}
              >
                必填。任务会从这个日期开始显示。
              </Text>
              <Select
                value={draftStartFieldId || undefined}
                placeholder="选择开始时间字段"
                style={{ width: "100%" }}
                onChange={(value) => {
                  setDraftStartFieldId(value);
                  if (draftEndFieldId === value) setDraftEndFieldId(null);
                }}
                options={dateFields.map((field) => ({
                  value: field.id,
                  label: field.name,
                }))}
              />
            </div>

            <div>
              <Text strong>结束时间字段</Text>
              <Text
                type="secondary"
                style={{ display: "block", margin: "4px 0 8px", fontSize: 12 }}
              >
                可选。配置后任务会以连续条形跨越开始和结束日期；留空则按单日任务显示。
              </Text>
              <Select
                allowClear
                value={draftEndFieldId || undefined}
                placeholder="不设置结束时间"
                style={{ width: "100%" }}
                onChange={(value) => setDraftEndFieldId(value || null)}
                options={dateFields.map((field) => ({
                  value: field.id,
                  label: field.name,
                  disabled: field.id === draftStartFieldId,
                }))}
              />
            </div>

            <div>
              <Text strong>每周起始日</Text>
              <Select
                value={draftWeekStartsOn}
                style={{ width: "100%", marginTop: 8 }}
                onChange={(value: 0 | 1) => setDraftWeekStartsOn(value)}
                options={[
                  { value: 1, label: "星期一" },
                  { value: 0, label: "星期日" },
                ]}
              />
            </div>

            <Alert
              type="info"
              showIcon
              message="拖动任务会整体移动时间范围"
              description="例如 8 月 4 日至 8 月 8 日的任务拖到 8 月 11 日后，会自动变为 8 月 11 日至 8 月 15 日，持续天数保持不变。"
            />
          </>
        )}
      </Space>
    </Modal>
  );

  if (!startField) {
    return (
      <>
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F7F8FA",
          }}
        >
          <div
            style={{
              width: 420,
              padding: "44px 36px",
              background: "#FFFFFF",
              border: "1px solid #E4E7EC",
              borderRadius: 12,
              boxShadow: "0 8px 28px rgba(16, 24, 40, 0.05)",
              textAlign: "center",
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <div style={{ color: "#344054", fontWeight: 600 }}>
                    日历视图需要开始时间字段
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "#98A2B3",
                      fontSize: 12,
                    }}
                  >
                    添加日期字段后，可以进一步配置结束时间来展示任务跨度。
                  </div>
                </div>
              }
            />
            <Button
              type="primary"
              icon={<SettingOutlined />}
              disabled={!canEdit}
              onClick={onConfigModalOpen}
            >
              配置日历
            </Button>
          </div>
        </div>
        {settingsModal}
      </>
    );
  }

  return (
    <>
      <DndContext
        sensors={canUpdate ? sensors : []}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div
          style={{
            height: "100%",
            padding: "14px 16px 16px",
            background: "#F6F7F9",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#FFFFFF",
              border: "1px solid #E4E7EC",
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(16, 24, 40, 0.035)",
            }}
          >
            <div
              style={{
                minHeight: 62,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                borderBottom: "1px solid #EEF0F3",
                flexShrink: 0,
              }}
            >
              <Space size={10}>
                <Space.Compact>
                  <Button
                    icon={<LeftOutlined />}
                    onClick={() =>
                      setMonth((value) => value.subtract(1, "month"))
                    }
                  />
                  <Button
                    onClick={() => setMonth(dayjs().startOf("month"))}
                    style={{ minWidth: 56 }}
                  >
                    今天
                  </Button>
                  <Button
                    icon={<RightOutlined />}
                    onClick={() =>
                      setMonth((value) => value.add(1, "month"))
                    }
                  />
                </Space.Compact>

                <div style={{ marginLeft: 4 }}>
                  <div
                    style={{
                      color: "#101828",
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {month.format("YYYY 年 M 月")}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      color: "#98A2B3",
                      fontSize: 10,
                    }}
                  >
                    {ranges.length} 个已排期任务 · {unscheduledRecords.length} 个待安排
                  </div>
                </div>
              </Space>

              <Space size={8} wrap>
                <Tag
                  icon={<CalendarOutlined />}
                  style={{
                    margin: 0,
                    padding: "3px 8px",
                    borderColor: "#DCE4F5",
                    background: "#F8FAFF",
                  }}
                >
                  {startField.name}
                </Tag>
                {endField ? (
                  <>
                    <ArrowRightOutlined style={{ color: "#98A2B3" }} />
                    <Tag
                      style={{
                        margin: 0,
                        padding: "3px 8px",
                        borderColor: "#DCE4F5",
                        background: "#F8FAFF",
                      }}
                    >
                      {endField.name}
                    </Tag>
                  </>
                ) : (
                  <Tag
                    style={{
                      margin: 0,
                      padding: "3px 8px",
                      color: "#B54708",
                      borderColor: "#FDE6C3",
                      background: "#FFFAEB",
                    }}
                  >
                    未设置结束时间
                  </Tag>
                )}
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  disabled={!canEdit}
                  onClick={onConfigModalOpen}
                >
                  设置
                </Button>
              </Space>
            </div>

            <UnscheduledArea
              records={unscheduledRecords}
              titleField={titleField}
              secondaryField={secondaryField}
              canUpdate={canUpdate}
              onOpenRecord={(record) => setExpandedRecordId(record.id)}
              onAddRecord={() => void handleAddRecord()}
            />

            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <div
                style={{
                  minWidth: WEEKDAY_MIN_WIDTH * 7,
                  borderTop: 0,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    height: 34,
                    borderBottom: "1px solid #EEF0F3",
                    background: "#FAFBFC",
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                  }}
                >
                  {weekdayLabels.map((label, index) => {
                    const weekend =
                      weekStartsOn === 1 ? index >= 5 : index === 0 || index === 6;
                    return (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRight: "1px solid #EEF0F3",
                          color: weekend ? "#98A2B3" : "#667085",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.03em",
                        }}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>

                {weekStarts.map((weekStart) => (
                  <CalendarWeek
                    key={weekStart.format("YYYY-MM-DD")}
                    weekStart={weekStart}
                    ranges={ranges}
                    currentMonth={month}
                    today={today}
                    titleField={titleField}
                    secondaryField={secondaryField}
                    canUpdate={canUpdate}
                    canResizeRange={Boolean(endField)}
                    onOpenRecord={(record) =>
                      setExpandedRecordId(record.id)
                    }
                    onAddRecord={(day) => void handleAddRecord(day)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeRecord && activeDrag ? (
            <div
              style={{
                width: 260,
                minHeight: 36,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                background: "#FFFFFF",
                border: "1px solid #C7D7FE",
                boxShadow: "0 12px 34px rgba(15, 23, 42, 0.16)",
                color: "#344054",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: eventAccent(secondaryField, activeRecord),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {eventTitle(activeRecord, titleField)}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  padding: "2px 6px",
                  borderRadius: 10,
                  background:
                    activeDrag.mode === "move" ? "#EEF4FF" : "#FFF4E5",
                  color:
                    activeDrag.mode === "move" ? "#3157C8" : "#B54708",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {activeDrag.mode === "move"
                  ? "移动任务"
                  : activeDrag.mode === "resize-start"
                    ? "调整开始"
                    : "调整结束"}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {settingsModal}

      <RowDetailDrawer
        open={Boolean(expandedRecord)}
        title={
          expandedRecord
            ? eventTitle(expandedRecord, titleField)
            : "行详情"
        }
        record={expandedRecord}
        fields={visibleFields}
        canUpdate={canUpdate}
        onClose={() => setExpandedRecordId(null)}
        onUpdateRecord={updateRecord}
      />
    </>
  );
}
