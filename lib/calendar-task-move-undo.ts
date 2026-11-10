import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import {
  CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import {
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import type { TaskListItem } from "@/app/components/todo-app";

export type CalendarTaskMovePlacement = {
  dateKey: string;
  dueTime: TaskDueTime;
};

export type CalendarTaskMoveSnapshot = {
  taskId: string;
  before: CalendarTaskMovePlacement;
  after: CalendarTaskMovePlacement;
};

export type CalendarTaskMoveHandlers = {
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskDueDateAndTime?: (
    taskId: string,
    dateValue: string | null,
    dueTime: TaskDueTime,
  ) => void;
};

function taskDueTimeFromTask(task: TaskListItem): TaskDueTime {
  return {
    dueTimeMinutes: normalizeDueTimeMinutes(task.dueTimeMinutes),
    dueDurationMinutes: normalizeDueDurationMinutes(task.dueDurationMinutes),
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

function placementsEqual(
  a: CalendarTaskMovePlacement,
  b: CalendarTaskMovePlacement,
) {
  return (
    a.dateKey === b.dateKey &&
    a.dueTime.dueTimeMinutes === b.dueTime.dueTimeMinutes &&
    a.dueTime.dueDurationMinutes === b.dueTime.dueDurationMinutes &&
    a.dueTime.dueTimeZone === b.dueTime.dueTimeZone
  );
}

export function buildCalendarTaskMoveSnapshot(
  dragState: CalendarTaskDragState,
  targetSlot: CalendarDropSlot,
  task: TaskListItem,
): CalendarTaskMoveSnapshot | null {
  const before: CalendarTaskMovePlacement = {
    dateKey: dragState.sourceDateKey,
    dueTime: taskDueTimeFromTask(task),
  };

  const dateChanged = targetSlot.dateKey !== dragState.sourceDateKey;
  let afterDueTime = { ...before.dueTime };

  if (targetSlot.dueTimeMinutes !== null) {
    const timeChanged =
      dateChanged ||
      targetSlot.dueTimeMinutes !== dragState.sourceTimeMinutes;

    if (timeChanged) {
      const dueDurationMinutes =
        dragState.sourceTimeMinutes === null
          ? normalizeDueDurationMinutes(task.dueDurationMinutes) ??
            CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES
          : task.dueDurationMinutes;

      afterDueTime = {
        dueTimeMinutes: targetSlot.dueTimeMinutes,
        dueDurationMinutes: normalizeDueDurationMinutes(dueDurationMinutes),
        dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
      };
    }
  } else if (dragState.sourceTimeMinutes !== null) {
    afterDueTime = {
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    };
  }

  const after: CalendarTaskMovePlacement = {
    dateKey: targetSlot.dateKey,
    dueTime: afterDueTime,
  };

  if (placementsEqual(before, after)) {
    return null;
  }

  return {
    taskId: dragState.taskId,
    before,
    after,
  };
}

export function buildCalendarAllDayTaskMoveSnapshot(
  task: TaskListItem,
  sourceDateKey: string,
  targetDateKey: string,
): CalendarTaskMoveSnapshot | null {
  if (sourceDateKey === targetDateKey) return null;

  const dueTime = taskDueTimeFromTask(task);

  return {
    taskId: task.id,
    before: { dateKey: sourceDateKey, dueTime },
    after: { dateKey: targetDateKey, dueTime },
  };
}

export function applyCalendarTaskMovePlacement(
  taskId: string,
  placement: CalendarTaskMovePlacement,
  handlers: CalendarTaskMoveHandlers,
) {
  const { onSetTaskDueDate, onSetTaskDueTime, onSetTaskDueDateAndTime } =
    handlers;

  if (onSetTaskDueDateAndTime) {
    onSetTaskDueDateAndTime(taskId, placement.dateKey, placement.dueTime);
    return;
  }

  onSetTaskDueDate?.(taskId, placement.dateKey);
  onSetTaskDueTime?.(taskId, placement.dueTime);
}

export function shouldIgnoreCalendarMoveUndoShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  if (target.closest("[data-task-details-panel]")) {
    const editor = target.closest(".task-details-editor");
    if (editor) return true;
    const input = target.closest("input, textarea, select");
    if (input) return true;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}
