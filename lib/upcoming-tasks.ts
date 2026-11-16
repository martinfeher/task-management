import type { TaskListItem } from "@/app/components/todo-app";
import { addDays, startOfLocalDay, toDateKey } from "@/lib/task-due-date";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import {
  getRecurringOccurrenceDateKeys,
  parseRecurrenceRule,
} from "@/lib/task-recurrence";

export const UPCOMING_DAY_COUNT_OPTIONS = [3, 5, 7, 14] as const;
export const UPCOMING_DAY_COUNT_DEFAULT = 7;

export type UpcomingTaskOccurrence = TaskListItem & {
  upcomingDateKey: string;
  /** False for projected repeats of a recurring task (not its stored due date). */
  isAnchorOccurrence: boolean;
};

export type UpcomingDayColumn = {
  dateKey: string;
  date: Date;
  tasks: UpcomingTaskOccurrence[];
};

/**
 * Optimistic due dates are local midnight and persisted ones are local noon,
 * so the date key must come from the local calendar date, not the ISO prefix.
 */
export function getTaskLocalDateKey(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
}

export function clampUpcomingDayCount(value: number | string | null | undefined) {
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) : value ?? NaN;
  return UPCOMING_DAY_COUNT_OPTIONS.includes(
    parsed as (typeof UPCOMING_DAY_COUNT_OPTIONS)[number],
  )
    ? parsed
    : UPCOMING_DAY_COUNT_DEFAULT;
}

function compareUpcomingTasks(a: TaskListItem, b: TaskListItem) {
  const aTime = normalizeDueTimeMinutes(a.dueTimeMinutes);
  const bTime = normalizeDueTimeMinutes(b.dueTimeMinutes);
  if (aTime === bTime) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime;
}

export function buildUpcomingColumns(
  tasks: TaskListItem[],
  startDate: Date,
  dayCount: number,
  today: Date = new Date(),
): { overdue: UpcomingTaskOccurrence[]; days: UpcomingDayColumn[] } {
  const rangeStart = startOfLocalDay(startDate);
  const rangeEnd = addDays(rangeStart, dayCount - 1);
  const todayKey = toDateKey(startOfLocalDay(today));

  const days: UpcomingDayColumn[] = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(rangeStart, index);
    return { dateKey: toDateKey(date), date, tasks: [] };
  });
  const dayByKey = new Map(days.map((day) => [day.dateKey, day]));
  const overdue: UpcomingTaskOccurrence[] = [];

  for (const task of tasks) {
    if (task.completed) continue;
    const anchorKey = getTaskLocalDateKey(task.dueDate);
    if (!anchorKey) continue;

    if (anchorKey < todayKey) {
      overdue.push({ ...task, upcomingDateKey: anchorKey, isAnchorOccurrence: true });
    }

    const rule = parseRecurrenceRule(task.recurrenceRule);
    const occurrenceKeys = rule
      ? getRecurringOccurrenceDateKeys(anchorKey, rule, rangeStart, rangeEnd)
      : [anchorKey];

    for (const dateKey of occurrenceKeys) {
      dayByKey.get(dateKey)?.tasks.push({
        ...task,
        upcomingDateKey: dateKey,
        isAnchorOccurrence: dateKey === anchorKey,
      });
    }
  }

  overdue.sort(
    (a, b) =>
      a.upcomingDateKey.localeCompare(b.upcomingDateKey) ||
      compareUpcomingTasks(a, b),
  );
  for (const day of days) {
    day.tasks.sort(compareUpcomingTasks);
  }

  return { overdue, days };
}
