import {
  fromDateKey,
  startOfDay,
} from "@/app/components/calendar-mini-month";
import type { TaskListItem } from "@/app/components/todo-app";
import type { CalendarDefaultViewPreference } from "@/lib/calendar-default-view-settings";
import {
  buildTasksByDateForRange,
  filterCalendarDisplayTasks,
  getCalendarRangeFromDays,
} from "@/lib/calendar-recurring-tasks";
import type { CalendarViewSession, CalendarViewTab } from "@/lib/calendar-view-settings";

export function hasEnabledTasksInDaysCalendar(
  tasks: TaskListItem[],
  multiDayCount: number,
  rangeStart: Date,
) {
  const start = startOfDay(rangeStart);
  const days: Date[] = [];

  for (let index = 0; index < multiDayCount; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    days.push(startOfDay(day));
  }

  const range = getCalendarRangeFromDays(days);
  if (!range) return false;

  const tasksByDate = buildTasksByDateForRange(
    filterCalendarDisplayTasks(tasks),
    range,
  );

  return tasksByDate.size > 0;
}

export function resolveAdaptiveCalendarEntryView(
  tasks: TaskListItem[],
  session: CalendarViewSession,
): Extract<CalendarViewTab, "days" | "month"> {
  const rangeStart =
    (session.daysRangeStartKey
      ? fromDateKey(session.daysRangeStartKey)
      : null) ??
    (session.focusDateKey ? fromDateKey(session.focusDateKey) : null) ??
    startOfDay(new Date());

  return hasEnabledTasksInDaysCalendar(tasks, session.multiDayCount, rangeStart)
    ? "days"
    : "month";
}

export function resolveCalendarEntryActiveView(
  preference: CalendarDefaultViewPreference,
  tasks: TaskListItem[],
  session: CalendarViewSession,
): CalendarViewTab {
  if (preference === "adaptive") {
    return resolveAdaptiveCalendarEntryView(tasks, session);
  }

  return preference;
}
