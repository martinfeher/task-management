import type { PointerEvent as ReactPointerEvent } from "react";
import { CALENDAR_TASK_DRAGGING_CLASS, CALENDAR_TASK_DRAG_CURSOR } from "@/lib/calendar-task-drag";
import {
  CALENDAR_TIME_SLOT_MINUTES,
  getMinutesFromCalendarGridY,
} from "@/lib/calendar-time-grid";

const DRAG_THRESHOLD_PX = 3;

type BindCalendarNewTaskSlotDragOptions = {
  grid: HTMLElement;
  hourStart: number;
  hourHeightPx: number;
  gridTopOffsetPx?: number;
  minMinutes: number;
  maxMinutes: number;
  onTimeChange: (minutes: number) => void;
};

export function bindCalendarNewTaskSlotDrag(
  event: ReactPointerEvent<HTMLElement>,
  {
    grid,
    hourStart,
    hourHeightPx,
    gridTopOffsetPx,
    minMinutes,
    maxMinutes,
    onTimeChange,
  }: BindCalendarNewTaskSlotDragOptions,
) {
  event.stopPropagation();
  if (event.button !== 0) return;

  const handle = event.currentTarget;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let dragStarted = false;

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    // Pointer capture is optional; document listeners still handle the drag.
  }

  function clampMinutes(minutes: number) {
    return Math.max(minMinutes, Math.min(maxMinutes, minutes));
  }

  function minutesFromClientY(clientY: number) {
    const rect = grid.getBoundingClientRect();
    const y = clientY - rect.top;
    return clampMinutes(
      getMinutesFromCalendarGridY(
        y,
        hourStart,
        hourHeightPx,
        CALENDAR_TIME_SLOT_MINUTES,
        gridTopOffsetPx,
      ),
    );
  }

  function cleanup() {
    document.body.style.cursor = "";
    handle.classList.remove(CALENDAR_TASK_DRAGGING_CLASS);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;

    if (!dragStarted) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      handle.classList.add(CALENDAR_TASK_DRAGGING_CLASS);
      document.body.style.cursor = CALENDAR_TASK_DRAG_CURSOR;
    }

    onTimeChange(minutesFromClientY(moveEvent.clientY));
  }

  function onPointerUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;

    if (handle.hasPointerCapture(pointerId)) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        // Ignore if the element was already released or disconnected.
      }
    }

    cleanup();
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}
