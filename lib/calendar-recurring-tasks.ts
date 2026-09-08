import type { TaskListItem } from "@/app/components/todo-app";
import { startOfLocalDay } from "@/lib/task-due-date";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import {
  getRecurringOccurrenceDateKeys,
  parseRecurrenceRule,
} from "@/lib/task-recurrence";

export type CalendarDateRange = {
  start: Date;
  end: Date;
};

export type CalendarTaskOccurrence = TaskListItem & {
  calendarOccurrenceDateKey: string;
};

export type CalendarTimedTasksByDate = {
  allDay: CalendarTaskOccurrence[];
  timed: CalendarTaskOccurrence[];
};

function createOccurrenceTask(
  task: TaskListItem,
  dateKey: string,
): CalendarTaskOccurrence {
  return {
    ...task,
    dueDate: `${dateKey}T12:00:00.000Z`,
    calendarOccurrenceDateKey: dateKey,
  };
}

export function getCalendarTaskKey(task: TaskListItem): string {
  if (
    "calendarOccurrenceDateKey" in task &&
    typeof (task as CalendarTaskOccurrence).calendarOccurrenceDateKey ===
      "string"
  ) {
    return `${task.id}:${(task as CalendarTaskOccurrence).calendarOccurrenceDateKey}`;
  }

  return task.id;
}

export function getCalendarRangeFromDays(days: Date[]): CalendarDateRange | null {
  if (days.length === 0) return null;

  return {
    start: days[0],
    end: days[days.length - 1],
  };
}

export function filterCalendarDisplayTasks(
  tasks: TaskListItem[],
): TaskListItem[] {
  return tasks.filter((task) => !task.completed && task.dueDate);
}

export function expandTaskForCalendarRange(
  task: TaskListItem,
  range: CalendarDateRange,
): CalendarTaskOccurrence[] {
  if (!task.dueDate) return [];

  const anchorDateKey = task.dueDate.slice(0, 10);
  const rule = parseRecurrenceRule(task.recurrenceRule);
  const rangeStart = startOfLocalDay(range.start);
  const rangeEnd = startOfLocalDay(range.end);

  if (!rule) {
    const dueDate = startOfLocalDay(new Date(task.dueDate));
    if (dueDate < rangeStart || dueDate > rangeEnd) {
      return [];
    }

    return [createOccurrenceTask(task, anchorDateKey)];
  }

  return getRecurringOccurrenceDateKeys(
    anchorDateKey,
    rule,
    rangeStart,
    rangeEnd,
  ).map((dateKey) => createOccurrenceTask(task, dateKey));
}

export function buildTasksByDateForRange(
  tasks: TaskListItem[],
  range: CalendarDateRange,
): Map<string, CalendarTaskOccurrence[]> {
  const map = new Map<string, CalendarTaskOccurrence[]>();

  for (const task of tasks) {
    for (const occurrence of expandTaskForCalendarRange(task, range)) {
      const key = occurrence.calendarOccurrenceDateKey;
      const existing = map.get(key) ?? [];
      existing.push(occurrence);
      map.set(key, existing);
    }
  }

  return map;
}

export function buildTimedTasksByDateForRange(
  tasks: TaskListItem[],
  range: CalendarDateRange,
): Map<string, CalendarTimedTasksByDate> {
  const map = new Map<string, CalendarTimedTasksByDate>();

  for (const task of tasks) {
    for (const occurrence of expandTaskForCalendarRange(task, range)) {
      const key = occurrence.calendarOccurrenceDateKey;
      const bucket = map.get(key) ?? { allDay: [], timed: [] };
      const dueTimeMinutes = normalizeDueTimeMinutes(occurrence.dueTimeMinutes);

      if (dueTimeMinutes === null) {
        bucket.allDay.push(occurrence);
      } else {
        bucket.timed.push(occurrence);
      }

      map.set(key, bucket);
    }
  }

  for (const bucket of map.values()) {
    bucket.timed.sort(
      (a, b) =>
        (normalizeDueTimeMinutes(a.dueTimeMinutes) ?? 0) -
        (normalizeDueTimeMinutes(b.dueTimeMinutes) ?? 0),
    );
  }

  return map;
}

export function getCalendarDayTasksFromRange(
  tasks: TaskListItem[],
  dateKey: string,
  range: CalendarDateRange,
): CalendarTaskOccurrence[] {
  const tasksByDate = buildTasksByDateForRange(tasks, range);
  return tasksByDate.get(dateKey) ?? [];
}
