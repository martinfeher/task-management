"use client";

import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import {
  bindCalendarTaskDrag,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import {
  CALENDAR_TIME_SLOT_MINUTES,
  formatCalendarSlotTimeLabel,
  getMinutesFromCalendarGridY,
} from "@/lib/calendar-time-grid";
import {
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import type { TaskListItem } from "./todo-app";

export const CALENDAR_MIN_DURATION_MINUTES = 15;
const RESIZE_HANDLE_PX = 6;

export type CalendarTaskResizePreview = {
  taskId: string;
  dueTimeMinutes: number;
  dueDurationMinutes: number;
};

export function getDefaultTaskDurationMinutes(task: TaskListItem) {
  return task.dueDurationMinutes && task.dueDurationMinutes > 0
    ? task.dueDurationMinutes
    : 60;
}

export function getTaskTiming(
  task: TaskListItem,
  resizePreview: CalendarTaskResizePreview | null,
) {
  if (resizePreview?.taskId === task.id) {
    return resizePreview;
  }

  return {
    dueTimeMinutes: normalizeDueTimeMinutes(task.dueTimeMinutes) ?? 0,
    dueDurationMinutes: getDefaultTaskDurationMinutes(task),
  };
}

export function formatCalendarTaskTimeRange(
  startMinutes: number,
  durationMinutes: number,
) {
  const endMinutes = startMinutes + durationMinutes;
  return `${formatCalendarSlotTimeLabel(startMinutes)}-${formatCalendarSlotTimeLabel(endMinutes)}`;
}

function snapDuration(minutes: number) {
  return Math.max(
    CALENDAR_MIN_DURATION_MINUTES,
    Math.round(minutes / CALENDAR_TIME_SLOT_MINUTES) *
      CALENDAR_TIME_SLOT_MINUTES,
  );
}

function getMinutesFromPointerOnGrid(clientY: number, grid: HTMLElement) {
  const hourStart = Number(grid.getAttribute("data-hour-start") ?? "8");
  const hourHeightPx = Number(grid.getAttribute("data-hour-height") ?? "52");
  const rect = grid.getBoundingClientRect();
  const y = clientY - rect.top;
  return getMinutesFromCalendarGridY(y, hourStart, hourHeightPx);
}

function findTimeGrid(element: HTMLElement) {
  return element.closest("[data-calendar-time-grid]");
}

type ResizeOptions = {
  task: TaskListItem;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  setResizePreview: (preview: CalendarTaskResizePreview | null) => void;
  suppressTaskClickRef: MutableRefObject<boolean>;
};

function bindCalendarTaskResizeBottom(
  event: ReactPointerEvent<HTMLElement>,
  { task, onSetTaskDueTime, setResizePreview, suppressTaskClickRef }: ResizeOptions,
) {
  event.stopPropagation();
  if (event.button !== 0 || !onSetTaskDueTime) return;

  const timeGrid = findTimeGrid(event.currentTarget);
  if (!(timeGrid instanceof HTMLElement)) return;

  const startMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  if (startMinutes === null || !onSetTaskDueTime) return;

  const setDueTime = onSetTaskDueTime;
  const grid = timeGrid;
  const dueStart = startMinutes;
  const initialDuration = getDefaultTaskDurationMinutes(task);
  const handle = event.currentTarget;
  const pointerId = event.pointerId;

  function finish(clientY: number) {
    document.body.style.cursor = "";
    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);

    const duration = snapDuration(
      getMinutesFromPointerOnGrid(clientY, grid) - dueStart,
    );

    if (duration !== initialDuration) {
      setDueTime(task.id, {
        dueTimeMinutes: dueStart,
        dueDurationMinutes: duration,
        dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
      });
    }

    setResizePreview(null);
    suppressTaskClickRef.current = true;
  }

  function onPointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    const duration = snapDuration(
      getMinutesFromPointerOnGrid(moveEvent.clientY, grid) - dueStart,
    );
    setResizePreview({
      taskId: task.id,
      dueTimeMinutes: dueStart,
      dueDurationMinutes: duration,
    });
  }

  function onPointerUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    finish(upEvent.clientY);
  }

  handle.setPointerCapture(pointerId);
  document.body.style.cursor = "ns-resize";
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

function bindCalendarTaskResizeTop(
  event: ReactPointerEvent<HTMLElement>,
  { task, onSetTaskDueTime, setResizePreview, suppressTaskClickRef }: ResizeOptions,
) {
  event.stopPropagation();
  if (event.button !== 0 || !onSetTaskDueTime) return;

  const timeGrid = findTimeGrid(event.currentTarget);
  if (!(timeGrid instanceof HTMLElement)) return;

  const startMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  if (startMinutes === null || !onSetTaskDueTime) return;

  const setDueTime = onSetTaskDueTime;
  const grid = timeGrid;
  const dueStart = startMinutes;
  const initialDuration = getDefaultTaskDurationMinutes(task);
  const endMinutes = dueStart + initialDuration;
  const handle = event.currentTarget;
  const pointerId = event.pointerId;

  function finish(clientY: number) {
    document.body.style.cursor = "";
    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);

    const rawStart = getMinutesFromPointerOnGrid(clientY, grid);
    const clampedStart = Math.min(
      rawStart,
      endMinutes - CALENDAR_MIN_DURATION_MINUTES,
    );
    const newDuration = snapDuration(endMinutes - clampedStart);

    if (clampedStart !== dueStart || newDuration !== initialDuration) {
      setDueTime(task.id, {
        dueTimeMinutes: clampedStart,
        dueDurationMinutes: newDuration,
        dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
      });
    }

    setResizePreview(null);
    suppressTaskClickRef.current = true;
  }

  function onPointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    const rawStart = getMinutesFromPointerOnGrid(moveEvent.clientY, grid);
    const clampedStart = Math.min(
      rawStart,
      endMinutes - CALENDAR_MIN_DURATION_MINUTES,
    );
    setResizePreview({
      taskId: task.id,
      dueTimeMinutes: clampedStart,
      dueDurationMinutes: snapDuration(endMinutes - clampedStart),
    });
  }

  function onPointerUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    finish(upEvent.clientY);
  }

  handle.setPointerCapture(pointerId);
  document.body.style.cursor = "ns-resize";
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

type CalendarTimedTaskBlockProps = {
  task: TaskListItem;
  day: Date;
  top: number;
  height: number;
  startMinutes: number;
  durationMinutes: number;
  hourStart: number;
  hourHeightPx: number;
  selected: boolean;
  canInteract: boolean;
  onTaskClick: (
    event: React.MouseEvent<HTMLDivElement>,
    task: TaskListItem,
  ) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  dragStateRef: MutableRefObject<CalendarTaskDragState | null>;
  suppressTaskClickRef: MutableRefObject<boolean>;
  setDropTargetSlot: (slot: CalendarDropSlot | null) => void;
  setResizePreview: (preview: CalendarTaskResizePreview | null) => void;
  onDragStart?: () => void;
  toDateKey: (date: Date) => string;
};

export function CalendarTimedTaskBlock({
  task,
  day,
  top,
  height,
  startMinutes,
  durationMinutes,
  hourStart,
  hourHeightPx,
  selected,
  canInteract,
  onTaskClick,
  onSetTaskDueDate,
  onSetTaskDueTime,
  dragStateRef,
  suppressTaskClickRef,
  setDropTargetSlot,
  setResizePreview,
  onDragStart,
  toDateKey,
}: CalendarTimedTaskBlockProps) {
  const canResize = canInteract && Boolean(onSetTaskDueTime);
  const showTimeRange = height >= 36;

  return (
    <div
      className={`absolute inset-x-1 z-10 overflow-hidden rounded ${
        selected
          ? "bg-[#4873c7] text-white"
          : "bg-[#dbeafe] text-[#1e3a8a] dark:bg-blue-950/50 dark:text-blue-100"
      }`}
      style={{ top, height }}
    >
      {canResize ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-20 cursor-ns-resize touch-none"
          style={{ height: RESIZE_HANDLE_PX }}
          onPointerDown={(event) =>
            bindCalendarTaskResizeTop(event, {
              task,
              onSetTaskDueTime,
              setResizePreview,
              suppressTaskClickRef,
            })
          }
        />
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onTaskClick(event, task);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onTaskClick(
              event as unknown as React.MouseEvent<HTMLDivElement>,
              task,
            );
          }
        }}
        onPointerDown={(event) => {
          if (!canInteract) return;
          bindCalendarTaskDrag(
            event as unknown as ReactPointerEvent<HTMLElement>,
            {
              task,
              sourceDateKey: toDateKey(day),
              hourStart,
              hourHeightPx,
              onSetTaskDueDate,
              onSetTaskDueTime,
              dragStateRef,
              suppressTaskClickRef,
              setDropTargetSlot,
              onDragStart,
            },
          );
        }}
        className={`flex h-full flex-col px-1.5 py-0.5 text-left text-[11px] leading-tight ${
          canInteract ? "cursor-grab touch-none active:cursor-grabbing" : ""
        }`}
        style={{
          paddingTop: canResize ? RESIZE_HANDLE_PX : undefined,
          paddingBottom: canResize ? RESIZE_HANDLE_PX : undefined,
        }}
      >
        <span className="line-clamp-2 font-medium">{task.name}</span>
        {showTimeRange ? (
          <span
            className={`mt-0.5 truncate text-[10px] ${
              selected ? "text-white/80" : "text-[#1e3a8a]/70 dark:text-blue-200/80"
            }`}
          >
            {formatCalendarTaskTimeRange(startMinutes, durationMinutes)}
          </span>
        ) : null}
      </div>

      {canResize ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-20 cursor-ns-resize touch-none"
          style={{ height: RESIZE_HANDLE_PX }}
          onPointerDown={(event) =>
            bindCalendarTaskResizeBottom(event, {
              task,
              onSetTaskDueTime,
              setResizePreview,
              suppressTaskClickRef,
            })
          }
        />
      ) : null}
    </div>
  );
}
