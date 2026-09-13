import {
  CALENDAR_TASK_COLOR_OPTIONS,
  normalizeCalendarTaskColor,
  type CalendarTaskColor,
} from "@/lib/calendar-task-colors";

export const DEFAULT_CALENDAR_TASK_DEFAULT_COLOR: CalendarTaskColor =
  "#6366f1";

export const CALENDAR_TASK_DEFAULT_COLOR_CSS_VAR =
  "--calendar-task-default-color";

export const CALENDAR_TASK_DEFAULT_COLOR_STORAGE_KEY =
  "todolist.calendarTaskDefaultColor";

export const CALENDAR_TASK_DEFAULT_COLOR_CHANGE_EVENT =
  "todolist:calendar-task-default-color-change";

export function readCalendarTaskDefaultColorFromStorage(): CalendarTaskColor {
  if (typeof window === "undefined") {
    return DEFAULT_CALENDAR_TASK_DEFAULT_COLOR;
  }

  const stored = window.localStorage.getItem(
    CALENDAR_TASK_DEFAULT_COLOR_STORAGE_KEY,
  );
  if (stored === null) {
    return DEFAULT_CALENDAR_TASK_DEFAULT_COLOR;
  }

  return (
    normalizeCalendarTaskColor(stored) ?? DEFAULT_CALENDAR_TASK_DEFAULT_COLOR
  );
}

export function applyCalendarTaskDefaultColor(color: CalendarTaskColor) {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty(
    CALENDAR_TASK_DEFAULT_COLOR_CSS_VAR,
    color,
  );
}

export function getCalendarTaskDefaultColor(): CalendarTaskColor {
  if (typeof document !== "undefined") {
    const cssValue = document.documentElement.style
      .getPropertyValue(CALENDAR_TASK_DEFAULT_COLOR_CSS_VAR)
      .trim();

    const normalized = normalizeCalendarTaskColor(cssValue);
    if (normalized) {
      return normalized;
    }
  }

  return readCalendarTaskDefaultColorFromStorage();
}

export function setCalendarTaskDefaultColor(color: string) {
  if (typeof window === "undefined") return;

  const normalized =
    normalizeCalendarTaskColor(color) ?? DEFAULT_CALENDAR_TASK_DEFAULT_COLOR;

  window.localStorage.setItem(
    CALENDAR_TASK_DEFAULT_COLOR_STORAGE_KEY,
    normalized,
  );
  applyCalendarTaskDefaultColor(normalized);
  window.dispatchEvent(
    new CustomEvent<CalendarTaskColor>(
      CALENDAR_TASK_DEFAULT_COLOR_CHANGE_EVENT,
      { detail: normalized },
    ),
  );
}

export { CALENDAR_TASK_COLOR_OPTIONS };
