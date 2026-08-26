import {
  CALENDAR_TASK_FONT_CLASS,
  CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS,
  CALENDAR_TASK_TITLE_TEXT_CLASS,
} from "@/lib/calendar-layout";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";

export const CALENDAR_TIME_SLOT_MINUTES = 15;

export const CALENDAR_NEW_TASK_PREVIEW_EXTRA_HEIGHT_PX = 4;
export const CALENDAR_NEW_TASK_PREVIEW_BASE_MIN_HEIGHT_PX = 16;

export function getCalendarNewTaskPreviewHeight(hourHeightPx: number) {
  const baseHeight = Math.max(
    CALENDAR_NEW_TASK_PREVIEW_BASE_MIN_HEIGHT_PX,
    (CALENDAR_TIME_SLOT_MINUTES / 60) * hourHeightPx,
  );

  return baseHeight + CALENDAR_NEW_TASK_PREVIEW_EXTRA_HEIGHT_PX;
}

export function getCalendarNewTaskPreviewTop(slotTop: number) {
  return slotTop - CALENDAR_NEW_TASK_PREVIEW_EXTRA_HEIGHT_PX / 2;
}

export function getCalendarTaskPreviewHeight(
  durationMinutes: number,
  hourHeightPx: number,
  minHeightPx = 24,
) {
  return Math.max(minHeightPx, (durationMinutes / 60) * hourHeightPx);
}

export const CALENDAR_NEW_TASK_PREVIEW_CLASS =
  `pointer-events-none absolute ${CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS} z-10 flex items-center overflow-hidden rounded border border-[#aaaaaa] bg-[#aaaaaa] px-1.5 text-left leading-none ${CALENDAR_TASK_TITLE_TEXT_CLASS} ${CALENDAR_TASK_FONT_CLASS}`;

export const CALENDAR_NEW_TASK_MARKER_LINE_CLASS = "relative h-px bg-[#aaaaaa]";

export const CALENDAR_NEW_TASK_MARKER_LABEL_CLASS =
  "absolute -left-14 -top-2.5 text-[10px] font-semibold text-[#4f4f4f]";

export const CALENDAR_NEW_TASK_MARKER_DOT_CLASS =
  "absolute -right-1 -top-1 size-2 rounded-full bg-[#aaaaaa]";

/** First labeled hour in day/week timed grids (inclusive). */
export const CALENDAR_HOUR_START = 0;
/** Last labeled hour in day/week timed grids (inclusive). Grid ends at this hour + 1. */
export const CALENDAR_HOUR_END = 23;

/** Collapse early-morning hours up to (but not including) this hour when empty. */
export const CALENDAR_COLLAPSE_EARLY_END_HOUR = 6;
export const CALENDAR_COLLAPSE_EARLY_START_MINUTES = 1;
export const CALENDAR_COLLAPSE_EARLY_END_MINUTES =
  CALENDAR_COLLAPSE_EARLY_END_HOUR * 60;
export const CALENDAR_COLLAPSED_EARLY_HOURS_ROW_HEIGHT_PX = 24;

const DEFAULT_TIMED_TASK_DURATION_MINUTES = 60;

export type CalendarTimedTaskSlice = {
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
};

export function getCalendarTimedGridHourStart(earlyHoursCollapsed: boolean) {
  return earlyHoursCollapsed
    ? CALENDAR_COLLAPSE_EARLY_END_HOUR
    : CALENDAR_HOUR_START;
}

export function getCalendarDisplayHours(
  earlyHoursCollapsed: boolean,
  hourEnd = CALENDAR_HOUR_END,
) {
  const hourStart = getCalendarTimedGridHourStart(earlyHoursCollapsed);
  return Array.from(
    { length: hourEnd - hourStart + 1 },
    (_, index) => hourStart + index,
  );
}

export function getCalendarTimedGridTopOffset(
  gridTopOffsetPx: number,
  earlyHoursCollapsed: boolean,
) {
  return (
    gridTopOffsetPx +
    (earlyHoursCollapsed ? CALENDAR_COLLAPSED_EARLY_HOURS_ROW_HEIGHT_PX : 0)
  );
}

function timedTaskOverlapsEarlyCollapseWindow(task: CalendarTimedTaskSlice) {
  const startMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  if (startMinutes === null) return false;

  const durationMinutes =
    task.dueDurationMinutes && task.dueDurationMinutes > 0
      ? task.dueDurationMinutes
      : DEFAULT_TIMED_TASK_DURATION_MINUTES;
  const endMinutes = startMinutes + durationMinutes;

  return (
    startMinutes < CALENDAR_COLLAPSE_EARLY_END_MINUTES &&
    endMinutes > CALENDAR_COLLAPSE_EARLY_START_MINUTES
  );
}

export function shouldCollapseCalendarEarlyHours({
  timedTasks,
  visibleDateKeys,
  nowMinutesOnVisibleToday,
}: {
  timedTasks: CalendarTimedTaskSlice[];
  visibleDateKeys: ReadonlySet<string>;
  nowMinutesOnVisibleToday: number | null;
}) {
  if (
    nowMinutesOnVisibleToday !== null &&
    nowMinutesOnVisibleToday >= CALENDAR_COLLAPSE_EARLY_START_MINUTES &&
    nowMinutesOnVisibleToday < CALENDAR_COLLAPSE_EARLY_END_MINUTES
  ) {
    return false;
  }

  for (const task of timedTasks) {
    if (!task.dueDate) continue;

    const dateKey = task.dueDate.slice(0, 10);
    if (!visibleDateKeys.has(dateKey)) continue;
    if (timedTaskOverlapsEarlyCollapseWindow(task)) {
      return false;
    }
  }

  return true;
}

export function isCalendarGridYInCollapsedEarlyBand(
  y: number,
  gridTopOffsetPx: number,
  earlyHoursCollapsed: boolean,
) {
  if (!earlyHoursCollapsed) return false;

  return (
    y >= gridTopOffsetPx &&
    y <
      gridTopOffsetPx + CALENDAR_COLLAPSED_EARLY_HOURS_ROW_HEIGHT_PX
  );
}

export function formatCalendarCollapsedEarlyHoursLabel(
  hourStart = CALENDAR_HOUR_START,
) {
  return `00:00 - ${String(hourStart).padStart(2, "0")}:00`;
}

export function formatCalendarCollapsedLateHoursLabel(
  hourEnd = CALENDAR_HOUR_END,
) {
  return `${String(hourEnd + 1).padStart(2, "0")}:00 - 00:00`;
}

export type CalendarDropSlot = {
  dateKey: string;
  dueTimeMinutes: number | null;
};

export type CalendarExternalDragTarget = CalendarDropSlot & {
  taskId: string;
  taskName: string;
};

export function snapToCalendarTimeSlot(
  minutes: number,
  timeSlotMinutes = CALENDAR_TIME_SLOT_MINUTES,
) {
  const snapped = Math.round(minutes / timeSlotMinutes) * timeSlotMinutes;
  return Math.max(0, Math.min(24 * 60 - timeSlotMinutes, snapped));
}

export function getMinutesFromCalendarGridY(
  y: number,
  hourStart: number,
  hourHeightPx: number,
  timeSlotMinutes = CALENDAR_TIME_SLOT_MINUTES,
  gridTopOffsetPx?: number,
) {
  const offset = gridTopOffsetPx ?? hourHeightPx;
  const rawMinutes = ((y - offset) / hourHeightPx + hourStart) * 60;
  return snapToCalendarTimeSlot(rawMinutes, timeSlotMinutes);
}

export function getTopForCalendarMinutes(
  minutes: number,
  hourStart: number,
  hourHeightPx: number,
  gridTopOffsetPx?: number,
) {
  const offset = gridTopOffsetPx ?? hourHeightPx;
  return offset + (minutes / 60 - hourStart) * hourHeightPx;
}

export function getCalendarTimedGridHeightPx(
  hourCount: number,
  hourHeightPx: number,
  gridTopOffsetPx = 0,
) {
  return gridTopOffsetPx + hourCount * hourHeightPx;
}

export function getCalendarTimedGridScrollTop({
  scrollContainerHeightPx,
  gridHeightPx,
  firstTaskTopPx,
  currentTimeTopPx,
  preferCurrentTime = false,
  topPaddingPx = 8,
}: {
  scrollContainerHeightPx: number;
  gridHeightPx: number;
  firstTaskTopPx: number | null;
  currentTimeTopPx: number | null;
  preferCurrentTime?: boolean;
  topPaddingPx?: number;
}) {
  let targetScrollTop = 0;

  if (firstTaskTopPx !== null) {
    targetScrollTop = Math.max(0, firstTaskTopPx - topPaddingPx);
  } else if (
    preferCurrentTime &&
    currentTimeTopPx !== null &&
    currentTimeTopPx >= 0 &&
    currentTimeTopPx <= gridHeightPx
  ) {
    targetScrollTop = Math.max(
      0,
      currentTimeTopPx - scrollContainerHeightPx / 3,
    );
  }

  const maxScrollTop = Math.max(0, gridHeightPx - scrollContainerHeightPx);
  return Math.min(targetScrollTop, maxScrollTop);
}

export function formatCalendarSlotTimeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function isCalendarSlotWithinTimedGrid(
  dueTimeMinutes: number | null,
  hourStart: number,
  hourHeightPx: number,
  hourCount: number,
  gridTopOffsetPx?: number,
) {
  if (dueTimeMinutes === null) return false;

  const offset = gridTopOffsetPx ?? hourHeightPx;
  const top = getTopForCalendarMinutes(
    dueTimeMinutes,
    hourStart,
    hourHeightPx,
    gridTopOffsetPx,
  );
  return top >= offset && top <= offset + hourCount * hourHeightPx;
}

export function resolveCalendarSlotFromPoint(
  clientX: number,
  clientY: number,
  hourStart = CALENDAR_HOUR_START,
  hourHeightPx = 52,
): CalendarDropSlot | null {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) return null;

  const dayCell = element.closest("[data-calendar-day]");
  if (!(dayCell instanceof HTMLElement)) return null;

  const dateKey = dayCell.getAttribute("data-calendar-day");
  if (!dateKey) return null;

  if (!dayCell.hasAttribute("data-calendar-time-grid")) {
    return { dateKey, dueTimeMinutes: null };
  }

  const resolvedHourStart = Number(
    dayCell.getAttribute("data-hour-start") ?? String(hourStart),
  );
  const resolvedHourHeightPx = Number(
    dayCell.getAttribute("data-hour-height") ?? String(hourHeightPx),
  );
  const gridTopOffsetPx = Number(
    dayCell.getAttribute("data-grid-top-offset") ?? String(resolvedHourHeightPx),
  );

  const rect = dayCell.getBoundingClientRect();
  const y = clientY - rect.top;

  return {
    dateKey,
    dueTimeMinutes: getMinutesFromCalendarGridY(
      y,
      resolvedHourStart,
      resolvedHourHeightPx,
      CALENDAR_TIME_SLOT_MINUTES,
      gridTopOffsetPx,
    ),
  };
}
