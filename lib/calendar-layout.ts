import type { CSSProperties } from "react";
import { getCalendarTaskColorItemStyle } from "@/lib/calendar-task-colors";
import { getCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color";
import { mixHexWithWhite } from "@/lib/sidebar-background-types";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";

export const CALENDAR_TASK_FONT_CLASS = "text-[12.5px]";
export const CALENDAR_TASK_ITEM_CLASS = "calendar-task-item";
export const CALENDAR_TASK_BACKGROUND_CLASS = "calendar-task-item-background";
export const CALENDAR_TASK_TITLE_TEXT_CLASS = "calendar-task-item-text";
export const CALENDAR_TASK_TIME_TEXT_CLASS = "calendar-task-time-text";

export const CALENDAR_WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export function getCalendarMondayFirstDayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function getCalendarWeekStart(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  const mondayOffset = getCalendarMondayFirstDayIndex(normalized);

  return new Date(
    normalized.getFullYear(),
    normalized.getMonth(),
    normalized.getDate() - mondayOffset,
  );
}

export function getCalendarWeekdayLabel(
  date: Date,
  labels: readonly string[] = CALENDAR_WEEKDAY_LABELS,
) {
  return labels[getCalendarMondayFirstDayIndex(date)];
}

export const CALENDAR_ALL_DAY_ROW_HEIGHT_PX = 47;
export const CALENDAR_ALL_DAY_ROW_MIN_HEIGHT_PX = CALENDAR_ALL_DAY_ROW_HEIGHT_PX;
export const CALENDAR_ALL_DAY_ROW_MAX_HEIGHT_PX = CALENDAR_ALL_DAY_ROW_HEIGHT_PX;
export const CALENDAR_HOUR_COLUMN_WIDTH_PX = 49;
export const CALENDAR_ALL_DAY_CELL_PADDING_CLASS = "p-1.5";
export const CALENDAR_ALL_DAY_TASK_HEIGHT_PX = 19;

export function getCalendarAllDayRowHeightPx(_maxStackedItemCount = 1) {
  return CALENDAR_ALL_DAY_ROW_HEIGHT_PX;
}

export function calendarAllDayLabelCellClassName(extra = "") {
  return `flex items-center justify-center text-center ${CALENDAR_ALL_DAY_CELL_PADDING_CLASS} text-[11px] text-zinc-400 ${extra}`.trim();
}

export function calendarAllDayCellClassName(extra = "") {
  return `flex flex-col items-stretch gap-1 overflow-x-hidden overflow-y-auto ${CALENDAR_ALL_DAY_CELL_PADDING_CLASS} ${extra}`.trim();
}

export function calendarAllDayTaskClassName(
  selected = false,
  draggable = false,
) {
  return `flex h-[24px] w-full shrink-0 items-center truncate rounded-[8px] px-[5px] text-left leading-none transition-colors ${
    draggable ? "cursor-move touch-none" : ""
  } ${calendarTaskItemClassName(selected)}`;
}

export function calendarAllDayDraftClassName() {
  return "flex h-[24px] w-full shrink-0 items-center truncate rounded-[8px] bg-zinc-200/50 px-[5px] text-[11px] text-zinc-400 dark:bg-zinc-700";
}

export function calendarTaskItemClassName(selected = false) {
  const base = `${CALENDAR_TASK_ITEM_CLASS} ${CALENDAR_TASK_BACKGROUND_CLASS} ${CALENDAR_TASK_TITLE_TEXT_CLASS} ${CALENDAR_TASK_FONT_CLASS} hover:brightness-95`;
  return selected ? `${base} font-medium` : base;
}

const CALENDAR_PAST_TASK_BACKGROUND_BRIGHTNESS_INCREASE = 0.18;
const DEFAULT_CALENDAR_TASK_DURATION_MINUTES = 60;

function startOfCalendarDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function withPastCalendarTaskBackgroundBrightness(background: string): string {
  return mixHexWithWhite(background, CALENDAR_PAST_TASK_BACKGROUND_BRIGHTNESS_INCREASE);
}

export function isCalendarTimedTaskPast(
  day: Date,
  endMinutes: number,
  now: Date,
): boolean {
  const taskDay = startOfCalendarDay(day);
  const today = startOfCalendarDay(now);
  if (taskDay.getTime() < today.getTime()) return true;
  if (taskDay.getTime() > today.getTime()) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return endMinutes <= currentMinutes;
}

export function isCalendarAllDayTaskPast(day: Date, now: Date): boolean {
  const taskDay = startOfCalendarDay(day);
  const today = startOfCalendarDay(now);
  return taskDay.getTime() < today.getTime();
}

export function isCalendarTaskPast(
  day: Date,
  now: Date,
  task: {
    dueTimeMinutes?: number | null;
    dueDurationMinutes?: number | null;
  },
): boolean {
  const normalizedStart = normalizeDueTimeMinutes(task.dueTimeMinutes);
  if (normalizedStart != null) {
    const duration =
      task.dueDurationMinutes && task.dueDurationMinutes > 0
        ? task.dueDurationMinutes
        : DEFAULT_CALENDAR_TASK_DURATION_MINUTES;
    return isCalendarTimedTaskPast(day, normalizedStart + duration, now);
  }

  return isCalendarAllDayTaskPast(day, now);
}

export function getCalendarTaskItemStyle(
  _priority: number | null | undefined,
  calendarColor?: string | null,
  defaultCalendarColor?: string | null,
  options?: { past?: boolean },
): CSSProperties | undefined {
  const style =
    getCalendarTaskColorItemStyle(calendarColor) ??
    getCalendarTaskColorItemStyle(
      defaultCalendarColor ?? getCalendarTaskDefaultColor(),
    );
  if (!style || !options?.past) return style;

  const background =
    typeof style.backgroundColor === "string"
      ? style.backgroundColor
      : undefined;
  if (!background) return style;

  const pastBackground = withPastCalendarTaskBackgroundBrightness(background);
  return {
    ...style,
    backgroundColor: pastBackground,
    ["--calendar-task-item-background" as string]: pastBackground,
  };
}

export function calendarTaskSecondaryTextClassName() {
  return CALENDAR_TASK_TIME_TEXT_CLASS;
}

export function getCalendarShellClassName(
  _fullWidth = true,
  _maxWidthClass?: string,
) {
  return "flex h-full w-full min-h-0 flex-col";
}

export const CALENDAR_VIEW_WRAPPER_CLASS = "flex min-h-0 flex-1 flex-col";
export const CALENDAR_VIEW_SURFACE_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950 ml-1";
/** Sticky offset for all-day rows sitting below day headers in week view. */
export const CALENDAR_WEEK_HEADER_HEIGHT_PX = 62;
export const CALENDAR_WEEK_HEADER_STICKY_CLASS = "sticky top-0 z-30 bg-white dark:bg-zinc-950";
export const CALENDAR_WEEK_ALLDAY_STICKY_CLASS =
  "sticky z-20 bg-white dark:bg-zinc-950";
/** Sticky offset for all-day rows sitting below day headers in multi-day view. */
export const CALENDAR_DAYS_HEADER_HEIGHT_PX = 60;
export const CALENDAR_DAYS_HEADER_STICKY_CLASS =
  "sticky top-0 z-30 bg-white dark:bg-zinc-950 mt-4";
export const CALENDAR_DAYS_ALLDAY_STICKY_CLASS =
  "sticky z-20 bg-white dark:bg-zinc-950";
export const CALENDAR_GRID_SCROLL_CLASS =
  "calendar-grid-scroll min-h-0 flex-1 overflow-auto mb-[40px]";
export const CALENDAR_TIMED_GRID_SCROLL_CLASS = CALENDAR_GRID_SCROLL_CLASS;

export const CALENDAR_DAY_COLUMN_DIVIDER_CLASS =
  "border-r border-zinc-200 dark:border-zinc-800";

export const CALENDAR_HOUR_COLUMN_DIVIDER_CLASS =
  "border-r border-zinc-200 dark:border-zinc-800";

export function formatCalendarHourLabel(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized >= 12 ? "pm" : "am";
  const hours12 = normalized % 12 || 12;

  return `${hours12}${period}`;
}

export function shouldShowCalendarHourLabel(hour: number) {
  return hour !== 0;
}

export function getCalendarTimedGridTemplateColumns(dayCount: number) {
  return `${CALENDAR_HOUR_COLUMN_WIDTH_PX}px repeat(${dayCount}, minmax(0, 1fr))`;
}

export function getCalendarSingleDayGridTemplateColumns() {
  return `${CALENDAR_HOUR_COLUMN_WIDTH_PX}px minmax(0, 1fr)`;
}

export function calendarHourLabelCellClassName(extra = "") {
  return `relative text-[11px] leading-none tabular-nums text-zinc-400 dark:text-zinc-500 ${extra}`.trim();
}

export function calendarHourLabelClassName(extra = "") {
  return `absolute w-[32px] flex justify-end items-center right-[11px] top-0 -translate-y-1/2 bg-white px-0 dark:bg-zinc-950 ${extra}`.trim();
}

export function getCalendarDayColumnDividerClass(
  dayIndex: number,
  dayCount: number,
) {
  return dayIndex < dayCount - 1 ? CALENDAR_DAY_COLUMN_DIVIDER_CLASS : "";
}

export const CALENDAR_TODAY_DATE_CIRCLE_CLASS =
  "bg-[#5363b5] text-white";

/** Horizontal placement for timed tasks inside a day column. */
export const CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS = "left-px right-[2%]";
