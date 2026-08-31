"use client";

import { useCallback, useRef } from "react";
import { resolveCalendarSlotFromPoint } from "@/lib/calendar-drag";
import type { CalendarExternalDragTarget } from "@/lib/calendar-time-grid";
import type { TaskDueTime } from "@/lib/task-due-time";

const DRAG_THRESHOLD_PX = 6;

function getCalendarDropTargetKey(
  target: CalendarExternalDragTarget | null,
): string | null {
  if (!target) return null;

  return `${target.dateKey}:${target.dueTimeMinutes ?? "allday"}:${target.taskId}`;
}

type DragState = {
  sourceRow: HTMLElement;
  pointerId: number;
  taskId: string;
  taskName: string;
  lastPointerX: number;
  lastPointerY: number;
  lastCalendarDropTargetKey: string | null;
};

type UseCalendarSidebarTaskDragOptions = {
  onCalendarDropTargetChange?: (
    target: CalendarExternalDragTarget | null,
  ) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
};

export function useCalendarSidebarTaskDrag({
  onCalendarDropTargetChange,
  onSetTaskDueDate,
  onSetTaskDueTime,
}: UseCalendarSidebarTaskDragOptions) {
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const onDropTargetChangeRef = useRef(onCalendarDropTargetChange);
  onDropTargetChangeRef.current = onCalendarDropTargetChange;
  const onSetTaskDueDateRef = useRef(onSetTaskDueDate);
  onSetTaskDueDateRef.current = onSetTaskDueDate;
  const onSetTaskDueTimeRef = useRef(onSetTaskDueTime);
  onSetTaskDueTimeRef.current = onSetTaskDueTime;

  const handleDragMove = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    dragState.lastPointerX = event.clientX;
    dragState.lastPointerY = event.clientY;

    const dropSlot = resolveCalendarSlotFromPoint(
      event.clientX,
      event.clientY,
    );

    if (dropSlot) {
      const nextDropTargetKey = getCalendarDropTargetKey({
        ...dropSlot,
        taskId: dragState.taskId,
        taskName: dragState.taskName,
      });

      if (nextDropTargetKey !== dragState.lastCalendarDropTargetKey) {
        dragState.lastCalendarDropTargetKey = nextDropTargetKey;
        onDropTargetChangeRef.current?.({
          ...dropSlot,
          taskId: dragState.taskId,
          taskName: dragState.taskName,
        });
      }

      dragState.sourceRow.classList.add("task-row-calendar-drag-source");
    } else if (dragState.lastCalendarDropTargetKey !== null) {
      dragState.lastCalendarDropTargetKey = null;
      onDropTargetChangeRef.current?.(null);
      dragState.sourceRow.classList.remove("task-row-calendar-drag-source");
    }
  }, []);

  const handleDragEnd = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.removeEventListener("pointercancel", handleDragEnd);
    document.body.style.cursor = "";

    dragState.sourceRow.classList.remove(
      "calendar-sidebar-task-dragging",
      "task-row-calendar-drag-source",
    );
    dragState.sourceRow.style.cursor = "";

    if (dragState.lastCalendarDropTargetKey !== null) {
      dragState.lastCalendarDropTargetKey = null;
      onDropTargetChangeRef.current?.(null);
    }

    const dropSlot = resolveCalendarSlotFromPoint(
      dragState.lastPointerX,
      dragState.lastPointerY,
    );

    if (dropSlot && onSetTaskDueDateRef.current) {
      onSetTaskDueDateRef.current(dragState.taskId, dropSlot.dateKey);

      if (dropSlot.dueTimeMinutes !== null && onSetTaskDueTimeRef.current) {
        onSetTaskDueTimeRef.current(dragState.taskId, {
          dueTimeMinutes: dropSlot.dueTimeMinutes,
          dueDurationMinutes: null,
          dueTimeZone: "floating",
        });
      }

      suppressClickRef.current = true;
    }

    dragStateRef.current = null;
  }, [handleDragMove]);

  const beginDrag = useCallback(
    (
      event: React.PointerEvent,
      taskId: string,
      taskName: string,
      sourceRow: HTMLElement,
    ) => {
      if (!onSetTaskDueDateRef.current || event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragStarted = false;

      function clearPendingListeners() {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
      }

      function onPointerMove(moveEvent: PointerEvent) {
        if (moveEvent.pointerId !== pointerId || dragStarted) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

        dragStarted = true;
        clearPendingListeners();

        dragStateRef.current = {
          sourceRow,
          pointerId,
          taskId,
          taskName,
          lastPointerX: moveEvent.clientX,
          lastPointerY: moveEvent.clientY,
          lastCalendarDropTargetKey: null,
        };

        sourceRow.classList.add("calendar-sidebar-task-dragging");
        sourceRow.style.cursor = "grabbing";
        document.body.style.cursor = "grabbing";

        if (sourceRow.setPointerCapture) {
          try {
            sourceRow.setPointerCapture(pointerId);
          } catch {
            // Ignore capture failures on unsupported elements.
          }
        }

        document.addEventListener("pointermove", handleDragMove);
        document.addEventListener("pointerup", handleDragEnd);
        document.addEventListener("pointercancel", handleDragEnd);
      }

      function onPointerUp(upEvent: PointerEvent) {
        if (upEvent.pointerId !== pointerId) return;
        clearPendingListeners();
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    },
    [handleDragEnd, handleDragMove],
  );

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false;

    suppressClickRef.current = false;
    return true;
  }, []);

  return { beginDrag, shouldSuppressClick };
}
