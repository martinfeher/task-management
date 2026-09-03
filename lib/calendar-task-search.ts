import {
  fromDateKey,
  formatSelectedDay,
  MINI_CALENDAR_LOCALE,
  startOfDay,
  toDateKey,
} from "@/app/components/calendar-mini-month";
import type { SearchTask, TaskListItem } from "@/app/components/todo-app";
import {
  getRecurringOccurrenceDateKeys,
  parseRecurrenceRule,
} from "@/lib/task-recurrence";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";

const RESULT_LIMIT = 50;
const SIDEBAR_OCCURRENCE_LOOKAHEAD_DAYS = 365;

type SchedulableTask = {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  dueTimeMinutes?: number | null;
  recurrenceRule?: string | null;
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getTaskDateKey(task: SchedulableTask) {
  return task.dueDate?.slice(0, 10) ?? null;
}

export function formatCalendarTaskDueDateLabel(value: string) {
  const date = fromDateKey(value);
  if (!date) return value;

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";

  return new Intl.DateTimeFormat(MINI_CALENDAR_LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatCalendarSidebarDateHeading(value: string) {
  const date = fromDateKey(value);
  if (!date) return value;

  return formatSelectedDay(date);
}

function collectCalendarTasksFromDate<T extends SchedulableTask>(
  tasks: T[],
  fromDate: Date,
  lookaheadDays = SIDEBAR_OCCURRENCE_LOOKAHEAD_DAYS,
): T[] {
  const fromKey = toDateKey(startOfDay(fromDate));
  const rangeEnd = startOfDay(fromDate);
  rangeEnd.setDate(rangeEnd.getDate() + lookaheadDays);
  const collected: T[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const anchorKey = task.dueDate.slice(0, 10);
    const rule = parseRecurrenceRule(task.recurrenceRule);

    if (!rule) {
      if (anchorKey >= fromKey) {
        collected.push(task);
      }
      continue;
    }

    const occurrenceKeys = getRecurringOccurrenceDateKeys(
      anchorKey,
      rule,
      startOfDay(fromDate),
      rangeEnd,
    );
    const nextKey = occurrenceKeys.find((key) => key >= fromKey);
    if (!nextKey) continue;

    collected.push({
      ...task,
      dueDate: `${nextKey}T12:00:00.000Z`,
    });
  }

  return collected;
}

export function expandCalendarSearchTasksFromDate(
  tasks: SearchTask[],
  fromDate: Date,
  lookaheadDays = SIDEBAR_OCCURRENCE_LOOKAHEAD_DAYS,
): SearchTask[] {
  return collectCalendarTasksFromDate(tasks, fromDate, lookaheadDays);
}

export function compareCalendarTaskSchedule(a: SchedulableTask, b: SchedulableTask) {
  const aDate = getTaskDateKey(a) ?? "";
  const bDate = getTaskDateKey(b) ?? "";

  if (aDate !== bDate) {
    return aDate.localeCompare(bDate);
  }

  const aTime = normalizeDueTimeMinutes(a.dueTimeMinutes);
  const bTime = normalizeDueTimeMinutes(b.dueTimeMinutes);

  if (aTime === null && bTime === null) {
    return a.name.localeCompare(b.name);
  }
  if (aTime === null) return 1;
  if (bTime === null) return -1;

  return aTime - bTime || a.name.localeCompare(b.name);
}

export function compareCalendarSearchTasks(a: SearchTask, b: SearchTask) {
  return compareCalendarTaskSchedule(a, b);
}

export function getCalendarSidebarUpcomingTasks(
  tasks: TaskListItem[],
  fromDate: Date,
) {
  const upcoming = collectCalendarTasksFromDate(tasks, fromDate);
  return [...upcoming].sort(compareCalendarTaskSchedule);
}

export type CalendarSidebarTaskGroup = {
  dateKey: string;
  label: string;
  tasks: TaskListItem[];
};

export function groupCalendarSidebarTasksByDate(tasks: TaskListItem[]) {
  const groups: CalendarSidebarTaskGroup[] = [];

  for (const task of tasks) {
    const dateKey = getTaskDateKey(task);
    if (!dateKey) continue;

    const lastGroup = groups.at(-1);
    if (lastGroup?.dateKey === dateKey) {
      lastGroup.tasks.push(task);
      continue;
    }

    groups.push({
      dateKey,
      label: formatCalendarSidebarDateHeading(dateKey),
      tasks: [task],
    });
  }

  return groups;
}

export function filterCalendarSearchTasks(
  tasks: SearchTask[],
  query: string,
  fromDate?: Date,
) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const fromKey = fromDate ? toDateKey(startOfDay(fromDate)) : null;
  const openMatches: SearchTask[] = [];
  const completedMatches: SearchTask[] = [];

  for (const task of tasks) {
    const dateKey = getTaskDateKey(task);
    if (!dateKey) continue;
    if (fromKey && dateKey < fromKey) continue;
    if (!task.name.toLowerCase().includes(trimmed)) continue;

    if (task.completed) {
      completedMatches.push(task);
    } else {
      openMatches.push(task);
    }
  }

  return [...openMatches, ...completedMatches].slice(0, RESULT_LIMIT);
}

export function getCalendarSidebarSearchResults(
  tasks: SearchTask[],
  query: string,
  focusDate: Date,
) {
  const expanded = expandCalendarSearchTasksFromDate(tasks, focusDate);
  const filtered = filterCalendarSearchTasks(expanded, query, focusDate);
  return [...filtered].sort(compareCalendarSearchTasks);
}

export function getCalendarSearchResultKey(task: SchedulableTask) {
  const dateKey = getTaskDateKey(task);
  return dateKey ? `${task.id}:${dateKey}` : task.id;
}
