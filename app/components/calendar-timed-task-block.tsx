"use client";

import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  bindCalendarTaskDrag,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import {
  CALENDAR_HOUR_START,
  CALENDAR_TIME_SLOT_MINUTES,
  formatCalendarSlotTimeLabel,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
} from "@/lib/calendar-time-grid";
import {
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import { calendarTaskItemClassName, calendarTaskSecondaryTextClassName, CALENDAR_TASK_FONT_CLASS, CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS, getCalendarTaskItemStyle } from "@/lib/calendar-layout";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import { useCalendarTaskDragPreview, useCalendarTaskHoverPreview } from "./calendar-task-hover-preview";
import { useCalendarTaskColorMenu } from "./calendar-task-color-menu";
import { CalendarTaskPriorityFlag } from "./calendar-task-title";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";
import type { TaskListItem } from "./todo-app";

export const CALENDAR_MIN_DURATION_MINUTES = 15;
export const CALENDAR_TASK_CONTENT_PADDING_PX = 5;
export const CALENDAR_TASK_HORIZONTAL_PADDING_START_PX = 7;
export const CALENDAR_TASK_HORIZONTAL_PADDING_END_PX = 6;
export const CALENDAR_TASK_INNER_RADIUS_PX = 5;
export const CALENDAR_TASK_TIME_ROW_HEIGHT_PX = 14;
export const CALENDAR_TASK_TITLE_LINE_HEIGHT_PX = 16;
export const CALENDAR_TASK_MIN_HEIGHT_FOR_TIME_PX = 27;
export const CALENDAR_TASK_TWO_LINE_MIN_HEIGHT_PX =
  CALENDAR_TASK_TITLE_LINE_HEIGHT_PX + CALENDAR_TASK_TIME_ROW_HEIGHT_PX;
const RESIZE_HANDLE_PX = CALENDAR_TASK_CONTENT_PADDING_PX;

export function getCalendarTaskContentLayout(availableHeight: number) {
  const lineCapacity = Math.max(
    0,
    Math.floor(availableHeight / CALENDAR_TASK_TITLE_LINE_HEIGHT_PX),
  );
  const showTime = lineCapacity >= 2;
  const expandedLayout = lineCapacity > 3;

  let titleMaxLines = 1;
  if (expandedLayout) {
    titleMaxLines = showTime ? lineCapacity - 1 : lineCapacity;
  } else if (showTime) {
    titleMaxLines = lineCapacity - 1;
  } else {
    titleMaxLines = Math.min(2, Math.max(1, lineCapacity));
  }

  return {
    lineCapacity,
    showTime,
    expandedLayout,
    titleMaxLines: Math.max(1, titleMaxLines),
  };
}

export function getCalendarTaskDragPreviewTop({
  baseTop,
  isDraggingTask,
  sourceTimeMinutes,
  dropDateKey,
  dropTimeMinutes,
  dayDateKey,
  hourStart,
  hourHeightPx,
  gridTopOffsetPx = 0,
}: {
  baseTop: number;
  isDraggingTask: boolean;
  sourceTimeMinutes: number | null;
  dropDateKey: string | null | undefined;
  dropTimeMinutes: number | null | undefined;
  dayDateKey: string;
  hourStart: number;
  hourHeightPx: number;
  gridTopOffsetPx?: number;
}) {
  if (
    !isDraggingTask ||
    dropDateKey !== dayDateKey ||
    dropTimeMinutes == null
  ) {
    return baseTop;
  }

  if (sourceTimeMinutes !== null && dropTimeMinutes === sourceTimeMinutes) {
    return baseTop;
  }

  return getTopForCalendarMinutes(
    dropTimeMinutes,
    hourStart,
    hourHeightPx,
    gridTopOffsetPx,
  );
}

function getCalendarTaskTitleClampStyle(titleMaxLines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: titleMaxLines,
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
  };
}

function getCalendarTaskTitleClassName(titleMaxLines: number) {
  const isSingleLine = titleMaxLines === 1;
  return `calendar-task-title min-w-0 font-medium leading-tight${
    isSingleLine
      ? " calendar-task-title--single-line block w-full truncate"
      : ""
  }`;
}

function getCalendarTaskTitleStyle(
  titleMaxLines: number,
): CSSProperties | undefined {
  if (titleMaxLines === 1) return undefined;
  return getCalendarTaskTitleClampStyle(titleMaxLines);
}

export function CalendarTaskDropPreview({
  top,
  height,
  taskName,
  startMinutes,
  durationMinutes,
  priority = null,
  calendarColor = null,
  variant = "drop",
}: {
  top: number;
  height: number;
  taskName: string;
  startMinutes?: number;
  durationMinutes?: number;
  priority?: number | null;
  calendarColor?: string | null;
  variant?: "drop" | "source";
}) {
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();
  const availableHeight =
    height - CALENDAR_TASK_CONTENT_PADDING_PX * 2;
  const { showTime, titleMaxLines } =
    getCalendarTaskContentLayout(availableHeight);
  const showTimeRange =
    startMinutes !== undefined &&
    durationMinutes !== undefined &&
    showTime;
  const previewClassName =
    variant === "source"
      ? "calendar-task-drag-source-placeholder"
      : "calendar-task-drop-preview";
  const horizontalInsetClass = CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS;

  return (
    <div
      aria-hidden="true"
      style={{
        top,
        height,
        ...getCalendarTaskItemStyle(
          priority,
          calendarColor,
          calendarTaskDefaultColor,
        ),
      }}
      className={`${previewClassName} pointer-events-none absolute ${horizontalInsetClass} overflow-hidden rounded-[5px] select-none ${calendarTaskItemClassName()}`}
    >
      <div
        className={`flex h-full flex-col py-0.5 text-left leading-tight ${CALENDAR_TASK_FONT_CLASS}`}
        style={{
          paddingTop: CALENDAR_TASK_CONTENT_PADDING_PX,
          paddingBottom: CALENDAR_TASK_CONTENT_PADDING_PX,
          paddingLeft: CALENDAR_TASK_HORIZONTAL_PADDING_START_PX,
          paddingRight: CALENDAR_TASK_HORIZONTAL_PADDING_END_PX,
        }}
      >
        <span
          className={`flex min-w-0 gap-0.5 ${
            titleMaxLines === 1 ? "items-center" : "items-start"
          }`}
        >
          <span
            className={`${getCalendarTaskTitleClassName(titleMaxLines)} min-w-0 flex-1`}
            style={getCalendarTaskTitleStyle(titleMaxLines)}
          >
            {taskName}
          </span>
          <CalendarTaskPriorityFlag priority={priority} />
        </span>
        {showTimeRange ? (
          <span
            className={`mt-0.5 shrink-0 truncate text-[10px] ${calendarTaskSecondaryTextClassName()}`}
          >
            {formatCalendarTaskTimeRange(startMinutes, durationMinutes)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CalendarTaskDragSourcePlaceholder({
  top,
  height,
  taskName,
  startMinutes,
  durationMinutes,
  priority = null,
  calendarColor = null,
}: {
  top: number;
  height: number;
  taskName: string;
  startMinutes: number;
  durationMinutes: number;
  priority?: number | null;
  calendarColor?: string | null;
}) {
  return (
    <CalendarTaskDropPreview
      variant="source"
      top={top}
      height={height}
      taskName={taskName}
      startMinutes={startMinutes}
      durationMinutes={durationMinutes}
      priority={priority}
      calendarColor={calendarColor}
    />
  );
}

export function CalendarTaskCompletionCheckbox({
  task,
  onToggleTask,
  isCompleting = false,
  isCheckAnimating = false,
  className = "calendar-task-checkbox mt-px",
}: {
  task: TaskListItem;
  onToggleTask?: (taskId: string) => void;
  isCompleting?: boolean;
  isCheckAnimating?: boolean;
  className?: string;
}) {
  if (!onToggleTask) return null;

  return (
    <div
      className="shrink-0"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TaskCompletionCheckbox
        variant="box"
        checkKey={task.id}
        animateCheck={isCheckAnimating}
        checked={task.completed || isCheckAnimating || isCompleting}
        className={className}
        onChange={isCompleting ? () => {} : () => onToggleTask(task.id)}
        onClick={(event) => event.stopPropagation()}
        aria-label={
          isCompleting
            ? `${task.name} completed`
            : `Mark ${task.name} complete`
        }
      />
    </div>
  );
}

type CalendarTimedTaskContentProps = {
  task: TaskListItem;
  startMinutes: number;
  durationMinutes: number;
  height: number;
  contentPaddingTop: number;
  contentPaddingBottom: number;
  onToggleTask?: (taskId: string) => void;
  isCompleting?: boolean;
  isCheckAnimating?: boolean;
};

export function CalendarTimedTaskContent({
  task,
  startMinutes,
  durationMinutes,
  height,
  contentPaddingTop,
  contentPaddingBottom,
  onToggleTask,
  isCompleting = false,
  isCheckAnimating = false,
}: CalendarTimedTaskContentProps) {
  const availableHeight = height - contentPaddingTop - contentPaddingBottom;
  const { showTime, titleMaxLines } =
    getCalendarTaskContentLayout(availableHeight);
  const isSingleLineOnly = !showTime && titleMaxLines === 1;
  const timeLabel = formatCalendarTaskTimeRange(startMinutes, durationMinutes);
  const timeClassName = `shrink-0 text-[11px] leading-none ${calendarTaskSecondaryTextClassName()}`;

  return (
    <div
      className={`flex min-h-0 w-full gap-1 ${
        isSingleLineOnly
          ? "calendar-task-row--single-line shrink-0 items-center"
          : "min-w-0 flex-1 items-start"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-start overflow-hidden">
        <span
          className={`flex min-w-0 gap-0.5 ${
            isSingleLineOnly ? "items-center" : "items-start"
          }`}
        >
          <span
            className={`${getCalendarTaskTitleClassName(titleMaxLines)} min-w-0 flex-1`}
            style={getCalendarTaskTitleStyle(titleMaxLines)}
          >
            {task.name}
          </span>
          <CalendarTaskPriorityFlag priority={task.priority} />
        </span>
        {showTime ? (
          <span className={`mt-[3px] truncate ${timeClassName}`}>{timeLabel}</span>
        ) : null}
      </div>
      <CalendarTaskCompletionCheckbox
        task={task}
        onToggleTask={onToggleTask}
        isCompleting={isCompleting}
        isCheckAnimating={isCheckAnimating}
        className={
          isSingleLineOnly
            ? "calendar-task-checkbox"
            : "calendar-task-checkbox mt-px"
        }
      />
    </div>
  );
}

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
  const hourStart = Number(
    grid.getAttribute("data-hour-start") ?? String(CALENDAR_HOUR_START),
  );
  const hourHeightPx = Number(grid.getAttribute("data-hour-height") ?? "52");
  const gridTopOffsetPx = Number(
    grid.getAttribute("data-grid-top-offset") ?? String(hourHeightPx),
  );
  const rect = grid.getBoundingClientRect();
  const y = clientY - rect.top;
  return getMinutesFromCalendarGridY(
    y,
    hourStart,
    hourHeightPx,
    CALENDAR_TIME_SLOT_MINUTES,
    gridTopOffsetPx,
  );
}

function findTimeGrid(element: HTMLElement) {
  return element.closest("[data-calendar-time-grid]");
}

type ResizeOptions = {
  task: TaskListItem;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  setResizePreview: (preview: CalendarTaskResizePreview | null) => void;
  suppressTaskClickRef: MutableRefObject<boolean>;
  resizingTaskIdRef: MutableRefObject<string | null>;
  onResizeStart?: (taskId: string) => void;
  onResizeEnd?: () => void;
};

function getCalendarTaskBlock(element: HTMLElement) {
  return element.closest<HTMLElement>("[data-calendar-timed-task-block]");
}

function capturePointer(target: HTMLElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Pointer capture is optional; document listeners still handle the resize.
  }
}

function releasePointerCapture(target: HTMLElement, pointerId: number) {
  if (target.hasPointerCapture(pointerId)) {
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // Ignore if the element was already released or disconnected.
    }
  }
}

function bindCalendarTaskResizeBottom(
  event: ReactPointerEvent<HTMLElement>,
  {
    task,
    onSetTaskDueTime,
    setResizePreview,
    suppressTaskClickRef,
    resizingTaskIdRef,
    onResizeStart,
    onResizeEnd,
  }: ResizeOptions,
) {
  event.stopPropagation();
  event.preventDefault();
  if (event.button !== 0 || !onSetTaskDueTime) return;

  const timeGrid = findTimeGrid(event.currentTarget);
  if (!(timeGrid instanceof HTMLElement)) return;

  const block = getCalendarTaskBlock(event.currentTarget);
  if (!block) return;
  const captureTarget = block;

  const startMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  if (startMinutes === null || !onSetTaskDueTime) return;

  const setDueTime = onSetTaskDueTime;
  const grid = timeGrid;
  const dueStart = startMinutes;
  const initialDuration = getDefaultTaskDurationMinutes(task);
  const pointerId = event.pointerId;

  resizingTaskIdRef.current = task.id;
  onResizeStart?.(task.id);
  setResizePreview({
    taskId: task.id,
    dueTimeMinutes: dueStart,
    dueDurationMinutes: initialDuration,
  });

  function finish(clientY: number) {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    releasePointerCapture(captureTarget, pointerId);
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

    resizingTaskIdRef.current = null;
    suppressTaskClickRef.current = true;
    onResizeEnd?.();

    requestAnimationFrame(() => {
      setResizePreview(null);
    });
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
    upEvent.preventDefault();
    finish(upEvent.clientY);
  }

  capturePointer(captureTarget, pointerId);
  document.body.style.cursor = "ns-resize";
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

function bindCalendarTaskResizeTop(
  event: ReactPointerEvent<HTMLElement>,
  {
    task,
    onSetTaskDueTime,
    setResizePreview,
    suppressTaskClickRef,
    resizingTaskIdRef,
    onResizeStart,
    onResizeEnd,
  }: ResizeOptions,
) {
  event.stopPropagation();
  event.preventDefault();
  if (event.button !== 0 || !onSetTaskDueTime) return;

  const timeGrid = findTimeGrid(event.currentTarget);
  if (!(timeGrid instanceof HTMLElement)) return;

  const block = getCalendarTaskBlock(event.currentTarget);
  if (!block) return;
  const captureTarget = block;

  const startMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
  if (startMinutes === null || !onSetTaskDueTime) return;

  const setDueTime = onSetTaskDueTime;
  const grid = timeGrid;
  const dueStart = startMinutes;
  const initialDuration = getDefaultTaskDurationMinutes(task);
  const endMinutes = dueStart + initialDuration;
  const pointerId = event.pointerId;

  resizingTaskIdRef.current = task.id;
  onResizeStart?.(task.id);
  setResizePreview({
    taskId: task.id,
    dueTimeMinutes: dueStart,
    dueDurationMinutes: initialDuration,
  });

  function finish(clientY: number) {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    releasePointerCapture(captureTarget, pointerId);
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

    resizingTaskIdRef.current = null;
    suppressTaskClickRef.current = true;
    onResizeEnd?.();

    requestAnimationFrame(() => {
      setResizePreview(null);
    });
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
    upEvent.preventDefault();
    finish(upEvent.clientY);
  }

  capturePointer(captureTarget, pointerId);
  document.body.style.cursor = "ns-resize";
  document.body.style.userSelect = "none";
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
  onSetTaskDueDateAndTime?: (
    taskId: string,
    dateValue: string | null,
    dueTime: TaskDueTime,
  ) => void;
  dragStateRef: MutableRefObject<CalendarTaskDragState | null>;
  suppressTaskClickRef: MutableRefObject<boolean>;
  setDropTargetSlot: (slot: CalendarDropSlot | null) => void;
  setResizePreview: (preview: CalendarTaskResizePreview | null) => void;
  resizingTaskIdRef: MutableRefObject<string | null>;
  onResizeStart?: (taskId: string) => void;
  onResizeEnd?: () => void;
  onDragStart?: () => void;
  onDropped?: (taskId: string) => void;
  isMaskedForDrop?: boolean;
  onToggleTask?: (taskId: string) => void;
  isCompleting?: boolean;
  isCheckAnimating?: boolean;
  isPast?: boolean;
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
  onSetTaskDueDateAndTime,
  dragStateRef,
  suppressTaskClickRef,
  setDropTargetSlot,
  setResizePreview,
  resizingTaskIdRef,
  onResizeStart,
  onResizeEnd,
  onDragStart,
  onDropped,
  isMaskedForDrop = false,
  onToggleTask,
  isCompleting = false,
  isCheckAnimating = false,
  isPast = false,
  toDateKey,
}: CalendarTimedTaskBlockProps) {
  const canResize = canInteract && Boolean(onSetTaskDueTime);
  const contentPaddingTop = canResize ? RESIZE_HANDLE_PX : CALENDAR_TASK_CONTENT_PADDING_PX;
  const contentPaddingBottom = canResize ? RESIZE_HANDLE_PX : CALENDAR_TASK_CONTENT_PADDING_PX;
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();
  const hoverHandlers = useCalendarTaskHoverPreview(task);
  const colorMenuHandlers = useCalendarTaskColorMenu(task);
  const {
    startDragPreview,
    updateDragPreview,
    endDragPreview,
  } = useCalendarTaskDragPreview();

  return (
    <div
      {...hoverHandlers}
      data-calendar-timed-task-block="true"
      className={`calendar-timed-task-block absolute ${CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS} z-10 rounded-[10px] ${calendarTaskItemClassName(selected)}`}
      style={{
        top,
        height,
        ...getCalendarTaskItemStyle(
          task.priority,
          task.calendarColor,
          calendarTaskDefaultColor,
          { past: isPast },
        ),
        opacity: isMaskedForDrop ? 0 : undefined,
      }}
      onContextMenu={(event) => {
        hoverHandlers.onMouseLeave?.();
        colorMenuHandlers.onContextMenu?.(event);
      }}
    >
      {canResize ? (
        <div
          aria-hidden="true"
          data-calendar-resize-handle="top"
          className="absolute inset-x-0 top-0 z-20 cursor-ns-resize touch-none"
          style={{ height: RESIZE_HANDLE_PX }}
          onPointerDown={(event) =>
            bindCalendarTaskResizeTop(event, {
              task,
              onSetTaskDueTime,
              setResizePreview,
              suppressTaskClickRef,
              resizingTaskIdRef,
              onResizeStart,
              onResizeEnd,
            })
          }
        />
      ) : null}

      <div
        className="relative h-full overflow-hidden"
        style={{ borderRadius: CALENDAR_TASK_INNER_RADIUS_PX }}
      >
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
            if (!canInteract || resizingTaskIdRef.current) return;
            bindCalendarTaskDrag(
              event as unknown as ReactPointerEvent<HTMLElement>,
              {
                task,
                sourceDateKey: toDateKey(day),
                hourStart,
                hourHeightPx,
                onSetTaskDueDate,
                onSetTaskDueTime,
                onSetTaskDueDateAndTime,
                dragStateRef,
                suppressTaskClickRef,
                setDropTargetSlot,
                resizingTaskIdRef,
                onDragStart: (point) => {
                  onDragStart?.();
                  startDragPreview?.(task, point.clientX, point.clientY);
                },
                onDragMove: (point, slot) => {
                  updateDragPreview?.(point.clientX, point.clientY, slot);
                },
                onDragEnd: (didMove) => {
                  endDragPreview?.();
                  if (didMove) {
                    onDropped?.(task.id);
                  }
                },
              },
            );
          }}
          className={`flex h-full flex-col justify-start overflow-hidden py-0.5 text-left leading-tight ${CALENDAR_TASK_FONT_CLASS} ${
            canInteract ? "cursor-move touch-none" : ""
          }`}
          style={{
            paddingTop: contentPaddingTop,
            paddingBottom: contentPaddingBottom,
            paddingLeft: CALENDAR_TASK_HORIZONTAL_PADDING_START_PX,
            paddingRight: CALENDAR_TASK_HORIZONTAL_PADDING_END_PX,
          }}
        >
          <CalendarTimedTaskContent
            task={task}
            startMinutes={startMinutes}
            durationMinutes={durationMinutes}
            height={height}
            contentPaddingTop={contentPaddingTop}
            contentPaddingBottom={contentPaddingBottom}
            onToggleTask={onToggleTask}
            isCompleting={isCompleting}
            isCheckAnimating={isCheckAnimating}
          />
        </div>
      </div>

      {canResize ? (
        <div
          aria-hidden="true"
          data-calendar-resize-handle="bottom"
          className="absolute inset-x-0 bottom-0 z-20 cursor-ns-resize touch-none"
          style={{ height: RESIZE_HANDLE_PX }}
          onPointerDown={(event) =>
            bindCalendarTaskResizeBottom(event, {
              task,
              onSetTaskDueTime,
              setResizePreview,
              suppressTaskClickRef,
              resizingTaskIdRef,
              onResizeStart,
              onResizeEnd,
            })
          }
        />
      ) : null}
    </div>
  );
}
