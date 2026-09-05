import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { calendarTaskItemClassName } from "@/lib/calendar-layout";
import { resolveCalendarSlotFromPoint } from "@/lib/calendar-drag";
import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import { getDefaultTaskDurationMinutes } from "@/app/components/calendar-timed-task-block";
import {
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import type { TaskListItem } from "@/app/components/todo-app";

export const CALENDAR_TASK_DRAG_THRESHOLD_PX = 2;
export const CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES = 30;
export const CALENDAR_TASK_DRAGGING_CLASS = "calendar-task-dragging";
export const CALENDAR_TASK_DRAG_CURSOR = "move";

export function getCalendarTaskDragPreviewDuration(
  task: TaskListItem,
  sourceTimeMinutes: number | null,
) {
  if (sourceTimeMinutes === null) {
    return CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES;
  }

  return getDefaultTaskDurationMinutes(task);
}

export function getCalendarTaskDragSurface(taskButton: HTMLElement) {
  return (
    taskButton.closest<HTMLElement>("[data-calendar-timed-task-block]") ??
    taskButton
  );
}

export type CalendarTaskDragState = {
  taskId: string;
  sourceDateKey: string;
  sourceTimeMinutes: number | null;
  pointerId: number;
  captureTarget: HTMLElement;
};

export function getActiveCalendarDropSlot(
  internalSlot: CalendarDropSlot | null,
  externalDateKey: string | null,
  externalTimeMinutes: number | null,
): CalendarDropSlot | null {
  if (internalSlot) return internalSlot;

  if (!externalDateKey) return null;

  return {
    dateKey: externalDateKey,
    dueTimeMinutes: externalTimeMinutes,
  };
}

export function applyCalendarTaskDrop(
  dragState: CalendarTaskDragState,
  targetSlot: CalendarDropSlot,
  task: TaskListItem,
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void,
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void,
) {
  if (
    onSetTaskDueDate &&
    targetSlot.dateKey !== dragState.sourceDateKey
  ) {
    onSetTaskDueDate(dragState.taskId, targetSlot.dateKey);
  }

  if (!onSetTaskDueTime) return;

  if (targetSlot.dueTimeMinutes !== null) {
    const timeChanged =
      targetSlot.dateKey !== dragState.sourceDateKey ||
      targetSlot.dueTimeMinutes !== dragState.sourceTimeMinutes;

    if (timeChanged) {
      const dueDurationMinutes =
        dragState.sourceTimeMinutes === null
          ? normalizeDueDurationMinutes(task.dueDurationMinutes) ??
            CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES
          : task.dueDurationMinutes;

      onSetTaskDueTime(dragState.taskId, {
        dueTimeMinutes: targetSlot.dueTimeMinutes,
        dueDurationMinutes,
        dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
      });
    }
  } else if (dragState.sourceTimeMinutes !== null) {
    onSetTaskDueTime(dragState.taskId, {
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    });
  }
}

type BindCalendarTaskDragOptions = {
  task: TaskListItem;
  sourceDateKey: string;
  hourStart: number;
  hourHeightPx: number;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  dragStateRef: MutableRefObject<CalendarTaskDragState | null>;
  suppressTaskClickRef: MutableRefObject<boolean>;
  setDropTargetSlot: (slot: CalendarDropSlot | null) => void;
  resizingTaskIdRef?: MutableRefObject<string | null>;
  onDragStart?: (point: { clientX: number; clientY: number }) => void;
  onDragMove?: (
    point: { clientX: number; clientY: number },
    slot: CalendarDropSlot | null,
  ) => void;
  onDragEnd?: () => void;
};

export function bindCalendarTaskDrag(
  event: ReactPointerEvent<HTMLElement>,
  {
    task,
    sourceDateKey,
    hourStart,
    hourHeightPx,
    onSetTaskDueDate,
    onSetTaskDueTime,
    dragStateRef,
    suppressTaskClickRef,
    setDropTargetSlot,
    resizingTaskIdRef,
    onDragStart,
    onDragMove,
    onDragEnd,
  }: BindCalendarTaskDragOptions,
) {
  if (event.button !== 0 || (!onSetTaskDueDate && !onSetTaskDueTime)) {
    return;
  }

  if (resizingTaskIdRef?.current) {
    return;
  }

  const sourceTimeMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  const taskButton = event.currentTarget;
  const dragSurface = getCalendarTaskDragSurface(taskButton);
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const grabOffsetY = startY - dragSurface.getBoundingClientRect().top;
  let dragStarted = false;

  function resolveSlotFromDragPoint(clientX: number, clientY: number) {
    return resolveCalendarSlotFromPoint(
      clientX,
      clientY,
      hourStart,
      hourHeightPx,
      clientY - grabOffsetY,
    );
  }

  try {
    taskButton.setPointerCapture(pointerId);
  } catch {
    // Pointer capture is optional; document listeners still handle the drag.
  }

  function clearPendingListeners() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }

  function finishDrag(upEvent: PointerEvent) {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (taskButton.hasPointerCapture(pointerId)) {
      try {
        taskButton.releasePointerCapture(pointerId);
      } catch {
        // Ignore if the element was already released or disconnected.
      }
    }

    const dragState = dragStateRef.current;
    const targetSlot = resolveSlotFromDragPoint(
      upEvent.clientX,
      upEvent.clientY,
    );

    if (dragState && targetSlot) {
      const movedToDifferentSlot =
        targetSlot.dateKey !== dragState.sourceDateKey ||
        targetSlot.dueTimeMinutes !== dragState.sourceTimeMinutes;

      if (movedToDifferentSlot) {
        applyCalendarTaskDrop(
          dragState,
          targetSlot,
          task,
          onSetTaskDueDate,
          onSetTaskDueTime,
        );
      }
    }

    dragStateRef.current = null;
    suppressTaskClickRef.current = true;
    onDragEnd?.();

    requestAnimationFrame(() => {
      dragSurface.classList.remove(CALENDAR_TASK_DRAGGING_CLASS);
      setDropTargetSlot(null);
    });
  }

  function onPointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;

    if (!dragStarted) {
      if (resizingTaskIdRef?.current) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < CALENDAR_TASK_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      onDragStart?.({
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
      });
      dragStateRef.current = {
        taskId: task.id,
        sourceDateKey,
        sourceTimeMinutes,
        pointerId,
        captureTarget: taskButton,
      };
      dragSurface.classList.add(CALENDAR_TASK_DRAGGING_CLASS);
      document.body.style.cursor = CALENDAR_TASK_DRAG_CURSOR;
      document.body.style.userSelect = "none";
      const slot = resolveSlotFromDragPoint(
        moveEvent.clientX,
        moveEvent.clientY,
      );
      setDropTargetSlot(slot);
      onDragMove?.(
        { clientX: moveEvent.clientX, clientY: moveEvent.clientY },
        slot,
      );
      document.addEventListener("pointermove", onActivePointerMove);
      document.addEventListener("pointerup", onActivePointerUp);
      document.addEventListener("pointercancel", onActivePointerUp);
    }
  }

  function onActivePointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    const slot = resolveSlotFromDragPoint(
      moveEvent.clientX,
      moveEvent.clientY,
    );
    setDropTargetSlot(slot);
    onDragMove?.(
      { clientX: moveEvent.clientX, clientY: moveEvent.clientY },
      slot,
    );
  }

  function onActivePointerUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    document.removeEventListener("pointermove", onActivePointerMove);
    document.removeEventListener("pointerup", onActivePointerUp);
    document.removeEventListener("pointercancel", onActivePointerUp);
    finishDrag(upEvent);
  }

  function onPointerUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    if (taskButton.hasPointerCapture(pointerId)) {
      try {
        taskButton.releasePointerCapture(pointerId);
      } catch {
        // Ignore if the element was already released or disconnected.
      }
    }
    clearPendingListeners();
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

export function calendarTaskDragClassName(
  draggable: boolean,
  selected: boolean,
) {
  return `${draggable ? "cursor-move touch-none" : ""} ${calendarTaskItemClassName(selected)}`;
}
