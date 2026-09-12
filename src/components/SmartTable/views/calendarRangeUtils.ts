import dayjs, { type Dayjs } from "dayjs";
import type { TableRecord } from "../../../store/useSmartTableStore";

export const parseCalendarDate = (value: unknown): Dayjs | null => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value !== "string" &&
      typeof value !== "number" &&
      !(value instanceof Date))
  ) {
    return null;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

export type CalendarRecordRange = {
  record: TableRecord;
  start: Dayjs;
  end: Dayjs;
  hasExplicitEnd: boolean;
  invalidEnd: boolean;
};

export const resolveRecordRange = (
  record: TableRecord,
  startFieldId: string,
  endFieldId?: string | null,
): CalendarRecordRange | null => {
  const start = parseCalendarDate(record[startFieldId]);
  if (!start) return null;

  const rawEnd = endFieldId ? parseCalendarDate(record[endFieldId]) : null;
  const invalidEnd = Boolean(rawEnd && rawEnd.isBefore(start, "day"));
  const end = !rawEnd || invalidEnd ? start : rawEnd;

  return {
    record,
    start,
    end,
    hasExplicitEnd: Boolean(rawEnd),
    invalidEnd,
  };
};

export type CalendarWeekSegment = {
  range: CalendarRecordRange;
  startCol: number;
  endCol: number;
  lane: number;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

export type CalendarWeekLayout = {
  segments: CalendarWeekSegment[];
  laneCount: number;
};

export const layoutWeekRanges = (
  ranges: CalendarRecordRange[],
  weekStart: Dayjs,
): CalendarWeekLayout => {
  const normalizedWeekStart = weekStart.startOf("day");
  const weekEnd = normalizedWeekStart.add(6, "day").endOf("day");

  const candidates = ranges
    .filter(
      (range) =>
        !range.end.isBefore(normalizedWeekStart, "day") &&
        !range.start.isAfter(weekEnd, "day"),
    )
    .map((range) => {
      const segmentStart = range.start.isBefore(normalizedWeekStart, "day")
        ? normalizedWeekStart
        : range.start.startOf("day");
      const segmentEnd = range.end.isAfter(weekEnd, "day")
        ? weekEnd.startOf("day")
        : range.end.startOf("day");
      return {
        range,
        startCol: Math.max(
          0,
          segmentStart.diff(normalizedWeekStart, "day"),
        ),
        endCol: Math.min(
          6,
          segmentEnd.diff(normalizedWeekStart, "day"),
        ),
        isRangeStart: range.start.isSame(segmentStart, "day"),
        isRangeEnd: range.end.isSame(segmentEnd, "day"),
      };
    })
    .sort((left, right) => {
      if (left.startCol !== right.startCol) {
        return left.startCol - right.startCol;
      }
      const leftSpan = left.endCol - left.startCol;
      const rightSpan = right.endCol - right.startCol;
      if (leftSpan !== rightSpan) return rightSpan - leftSpan;
      return String(left.range.record.id).localeCompare(
        String(right.range.record.id),
      );
    });

  const laneEndColumns: number[] = [];
  const segments: CalendarWeekSegment[] = candidates.map((candidate) => {
    let lane = laneEndColumns.findIndex(
      (endColumn) => candidate.startCol > endColumn,
    );
    if (lane === -1) {
      lane = laneEndColumns.length;
      laneEndColumns.push(candidate.endCol);
    } else {
      laneEndColumns[lane] = candidate.endCol;
    }
    return { ...candidate, lane };
  });

  return {
    segments,
    laneCount: laneEndColumns.length,
  };
};

export const moveRangeToDay = (
  start: Dayjs,
  end: Dayjs | null,
  targetDay: Dayjs,
): { start: Dayjs; end: Dayjs | null } => {
  const deltaDays = targetDay
    .startOf("day")
    .diff(start.startOf("day"), "day");

  return {
    start: start.add(deltaDays, "day"),
    end: end ? end.add(deltaDays, "day") : null,
  };
};

export const calendarRangeDays = (start: Dayjs, end: Dayjs): number =>
  Math.max(1, end.startOf("day").diff(start.startOf("day"), "day") + 1);

export const mergeCalendarDayWithTime = (
  targetDay: Dayjs,
  source: Dayjs,
): Dayjs =>
  targetDay
    .startOf("day")
    .hour(source.hour())
    .minute(source.minute())
    .second(source.second())
    .millisecond(source.millisecond());

export const resizeRangeStartToDay = (
  start: Dayjs,
  end: Dayjs,
  targetDay: Dayjs,
): Dayjs => {
  const candidate = mergeCalendarDayWithTime(targetDay, start);
  return candidate.isAfter(end) ? end : candidate;
};

export const resizeRangeEndToDay = (
  start: Dayjs,
  end: Dayjs,
  targetDay: Dayjs,
): Dayjs => {
  const candidate = mergeCalendarDayWithTime(targetDay, end);
  return candidate.isBefore(start) ? start : candidate;
};
