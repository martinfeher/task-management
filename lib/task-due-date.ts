import { formatShortDayMonth } from "@/lib/date-format";

export function startOfLocalDay(date: Date = new Date()) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

export function getTodayDateKey(from: Date = new Date()) {
  return toDateKey(startOfLocalDay(from));
}

export function getTomorrowDateKey(from: Date = new Date()) {
  return toDateKey(addDays(startOfLocalDay(from), 1));
}

export function getNextWeekendSaturdayDate(from: Date = new Date()) {
  const today = startOfLocalDay(from);
  const dayOfWeek = today.getDay();

  if (dayOfWeek === 6) {
    return addDays(today, 7);
  }

  return addDays(today, (6 - dayOfWeek + 7) % 7);
}

export function getNextWeekendSaturdayDateKey(from: Date = new Date()) {
  return toDateKey(getNextWeekendSaturdayDate(from));
}

export function isDueDateToday(dueDate: string | null | undefined) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  return toDateKey(startOfLocalDay(date)) === getTodayDateKey();
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTaskDueDateLabel(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);
  const dueDay = startOfLocalDay(date);

  if (isSameLocalDay(dueDay, today)) return "Today";
  if (isSameLocalDay(dueDay, tomorrow)) return "Tomorrow";

  return formatShortDayMonth(date);
}

function formatTaskDueWeekdayLabel(dueDate: string) {
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
}

export function formatTaskListScheduleSubline(
  dueDate: string | null,
  dueTimeLabel: string | null,
  dueDateLabel: string | null,
) {
  if (dueTimeLabel) {
    if (!dueDate || isDueDateToday(dueDate)) {
      return dueTimeLabel;
    }

    const weekdayLabel = formatTaskDueWeekdayLabel(dueDate);
    return weekdayLabel ? `${weekdayLabel} ${dueTimeLabel}` : dueTimeLabel;
  }

  return dueDateLabel;
}
