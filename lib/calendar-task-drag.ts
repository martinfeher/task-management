import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { resolveCalendarSlotFromPoint } from "@/lib/calendar-drag";
import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import {
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import type { TaskListItem } from "@/app/components/todo-app";

export const CALENDAR_TASK_DRAG_THRESHOLD_PX = 5;

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
      onSetTaskDueTime(dragState.taskId, {
        dueTimeMinutes: targetSlot.dueTimeMinutes,
        dueDurationMinutes: task.dueDurationMinutes,
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
  onDragStart?: () => void;
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
    onDragStart,
  }: BindCalendarTaskDragOptions,
) {
  if (event.button !== 0 || (!onSetTaskDueDate && !onSetTaskDueTime)) {
    return;
  }

  const sourceTimeMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  const taskButton = event.currentTarget;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let dragStarted = false;

  function clearPendingListeners() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }

  function finishDrag(upEvent: PointerEvent) {
    document.body.style.cursor = "";
    taskButton.classList.remove("opacity-50");

    if (taskButton.hasPointerCapture(pointerId)) {
      taskButton.releasePointerCapture(pointerId);
    }

    const dragState = dragStateRef.current;
    const targetSlot = resolveCalendarSlotFromPoint(
      upEvent.clientX,
      upEvent.clientY,
      hourStart,
      hourHeightPx,
    );

    if (dragState && targetSlot) {
      applyCalendarTaskDrop(
        dragState,
        targetSlot,
        task,
        onSetTaskDueDate,
        onSetTaskDueTime,
      );
    }

    dragStateRef.current = null;
    setDropTargetSlot(null);
    suppressTaskClickRef.current = true;
  }

  function onPointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;

    if (!dragStarted) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < CALENDAR_TASK_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      onDragStart?.();
      dragStateRef.current = {
        taskId: task.id,
        sourceDateKey,
        sourceTimeMinutes,
        pointerId,
        captureTarget: taskButton,
      };
      taskButton.setPointerCapture(pointerId);
      taskButton.classList.add("opacity-50");
      document.body.style.cursor = "grabbing";
      document.addEventListener("pointermove", onActivePointerMove);
      document.addEventListener("pointerup", onActivePointerUp);
      document.addEventListener("pointercancel", onActivePointerUp);
    }
  }

  function onActivePointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    setDropTargetSlot(
      resolveCalendarSlotFromPoint(
        moveEvent.clientX,
        moveEvent.clientY,
        hourStart,
        hourHeightPx,
      ),
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
  return `${draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${
    selected
      ? "bg-[#4873c7] text-white"
      : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe] dark:bg-blue-950/50 dark:text-blue-100"
  }`;
}
