"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import { CalendarTaskTitle } from "./calendar-task-title";
import { CalendarPeriodNavigation } from "./calendar-period-navigation";
import { CalendarCurrentTimeLine } from "./calendar-current-time-line";
import { CalendarNewTaskSlotPreview } from "./calendar-new-task-slot-preview";
import {
  CalendarTaskModal,
  getCalendarTaskSnapshot,
  type CalendarTaskEditorCallbacks,
} from "./calendar-task-modal";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import {
  buildTimedTasksByDateForRange,
  getCalendarRangeFromDays,
  getCalendarTaskKey,
} from "@/lib/calendar-recurring-tasks";
import {
  calendarAllDayLabelCellClassName,
  calendarAllDayCellClassName,
  calendarAllDayTaskClassName,
  getCalendarAllDayRowHeightPx,
  getCalendarShellClassName,
  CALENDAR_VIEW_SURFACE_CLASS,
  CALENDAR_VIEW_WRAPPER_CLASS,
  CALENDAR_HOUR_COLUMN_DIVIDER_CLASS,
  getCalendarDayColumnDividerClass,
  getCalendarTaskItemStyle,
  getCalendarWeekdayLabel,
  CALENDAR_TODAY_DATE_CIRCLE_CLASS,
} from "@/lib/calendar-layout";
import {
  bindCalendarTaskDrag,
  getActiveCalendarDropSlot,
  getCalendarTaskDragPreviewDuration,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  CALENDAR_TIME_SLOT_MINUTES,
  getCalendarTaskPreviewHeight,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
  type CalendarDropSlot,
} from "@/lib/calendar-time-grid";
import type { CalendarSidebarSyncProps } from "./calendar-view-sidebar-layout";
import {
  CalendarTimedTaskBlock,
  CalendarTaskCompletionCheckbox,
  CalendarTaskDropPreview,
  CalendarTaskDragSourcePlaceholder,
  getCalendarTaskDragPreviewTop,
  getTaskTiming,
  type CalendarTaskResizePreview,
} from "./calendar-timed-task-block";
import {
  CalendarTaskHoverButton,
  useCalendarTaskDragPreview,
} from "./calendar-task-hover-preview";

const HOUR_START = CALENDAR_HOUR_START;
const HOUR_END = CALENDAR_HOUR_END;
const HOUR_HEIGHT_PX = 52;
const GRID_TOP_OFFSET_PX = 0;
type CalendarMultiDayViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  dayCount: number;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  completingTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
} & CalendarTaskEditorCallbacks & {
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
    dueTimeMinutes?: number | null;
  }) => void | Promise<void>;
  defaultListId?: string | null;
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
  onPeriodLabelChange?: (label: string) => void;
} & CalendarSidebarSyncProps;

function isSlotWithinTimedGrid(
  dueTimeMinutes: number | null,
  hourCount: number,
) {
  if (dueTimeMinutes === null) return false;

  const top = getTopForCalendarMinutes(
    dueTimeMinutes,
    HOUR_START,
    HOUR_HEIGHT_PX,
    GRID_TOP_OFFSET_PX,
  );
  return (
    top >= GRID_TOP_OFFSET_PX &&
    top <= GRID_TOP_OFFSET_PX + hourCount * HOUR_HEIGHT_PX
  );
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function getVisibleDays(rangeStart: Date, dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) =>
    startOfDay(
      new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + index,
      ),
    ),
  );
}

function formatRangeHeading(days: Date[]) {
  if (days.length === 0) return "";

  const first = days[0];
  const last = days[days.length - 1];
  const monthYear = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });

  if (first.getMonth() === last.getMonth()) {
    return monthYear.format(first);
  }

  const monthOnly = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${monthOnly.format(first)} – ${monthYear.format(last)}`;
}


function getMinutesFromGridY(y: number) {
  return getMinutesFromCalendarGridY(
    y,
    HOUR_START,
    HOUR_HEIGHT_PX,
    CALENDAR_TIME_SLOT_MINUTES,
    GRID_TOP_OFFSET_PX,
  );
}

function getTopForMinutes(minutes: number) {
  return getTopForCalendarMinutes(
    minutes,
    HOUR_START,
    HOUR_HEIGHT_PX,
    GRID_TOP_OFFSET_PX,
  );
}

export function CalendarMultiDayView({
  tasks,
  lists,
  selectedTaskId,
  dayCount,
  onSelectTask,
  onToggleTask,
  completingTaskIds,
  checkAnimatingTaskIds,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onAddCalendarTask,
  defaultListId = null,
  fullWidth = false,
  externalDropTargetDateKey = null,
  onPeriodLabelChange,
  sidebarFocusDate,
  sidebarJumpRequestId,
  onSidebarFocusDateChange,
}: CalendarMultiDayViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const lastSidebarJumpRequestIdRef = useRef(0);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [addTaskPopover, setAddTaskPopover] = useState<{
    date: Date;
    x: number;
    y: number;
    dueTimeMinutes: number | null;
  } | null>(null);
  const [draftTaskName, setDraftTaskName] = useState("");
  const [dropTargetSlot, setDropTargetSlot] = useState<CalendarDropSlot | null>(
    null,
  );
  const [draggingTaskPreview, setDraggingTaskPreview] = useState<{
    taskId: string;
    sourceDateKey: string;
    sourceTimeMinutes: number | null;
  } | null>(null);
  const [resizePreview, setResizePreview] =
    useState<CalendarTaskResizePreview | null>(null);
  const [resizingTaskId, setResizingTaskId] = useState<string | null>(null);
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const resizingTaskIdRef = useRef<string | null>(null);
  const suppressTaskClickRef = useRef(false);
  const {
    startDragPreview,
    updateDragPreview,
    endDragPreview,
  } = useCalendarTaskDragPreview();
  const canDragTasks = Boolean(onSetTaskDueDate || onSetTaskDueTime);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const newTaskPreviewRef = useRef<HTMLDivElement>(null);
  const hourColumnRef = useRef<HTMLDivElement>(null);
  const [nowLineTop, setNowLineTop] = useState<number | null>(null);

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setRangeStart(current);
    setNow(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleDays = useMemo(
    () => (rangeStart ? getVisibleDays(rangeStart, dayCount) : []),
    [rangeStart, dayCount],
  );

  useEffect(() => {
    if (visibleDays.length === 0) return;
    onPeriodLabelChange?.(formatRangeHeading(visibleDays));
  }, [onPeriodLabelChange, visibleDays]);

  useEffect(() => {
    if (
      sidebarJumpRequestId === undefined ||
      sidebarFocusDate === undefined ||
      sidebarJumpRequestId === lastSidebarJumpRequestIdRef.current
    ) {
      return;
    }

    lastSidebarJumpRequestIdRef.current = sidebarJumpRequestId;
    setRangeStart(startOfDay(sidebarFocusDate));
  }, [sidebarFocusDate, sidebarJumpRequestId]);

  const hours = useMemo(
    () =>
      Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, index) => HOUR_START + index,
      ),
    [],
  );

  const calendarRange = useMemo(
    () => getCalendarRangeFromDays(visibleDays),
    [visibleDays],
  );

  const tasksByDate = useMemo(() => {
    if (!calendarRange) {
      return new Map<
        string,
        { allDay: TaskListItem[]; timed: TaskListItem[] }
      >();
    }

    return buildTimedTasksByDateForRange(tasks, calendarRange);
  }, [tasks, calendarRange]);

  const modalTaskSnapshot = useMemo(
    () => (modalTaskId ? getCalendarTaskSnapshot(modalTaskId, tasks) : null),
    [modalTaskId, tasks],
  );

  const currentTimeTop =
    now === null
      ? null
      : (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT_PX;

  const todayIndex = useMemo(
    () =>
      today === null
        ? -1
        : visibleDays.findIndex((day) => isSameDay(day, today)),
    [today, visibleDays],
  );

  const showGlobalNowLine =
    todayIndex >= 0 &&
    currentTimeTop !== null &&
    currentTimeTop >= 0 &&
    currentTimeTop <= (HOUR_END - HOUR_START + 1) * HOUR_HEIGHT_PX;

  const gridTemplateColumns = `56px repeat(${dayCount}, minmax(0, 1fr))`;
  const minGridWidth = 56 + dayCount * 120;

  function syncSidebarFocusToVisibleRange(start: Date) {
    if (!today || !onSidebarFocusDateChange) return;

    const days = getVisibleDays(start, dayCount);
    const focusDate = days.some((day) => isSameDay(day, today)) ? today : start;
    onSidebarFocusDateChange(focusDate);
  }

  function goToPreviousRange() {
    if (!rangeStart) return;
    const nextRangeStart = startOfDay(
      new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() - 1,
      ),
    );
    setRangeStart(nextRangeStart);
    syncSidebarFocusToVisibleRange(nextRangeStart);
  }

  function goToNextRange() {
    if (!rangeStart) return;
    const nextRangeStart = startOfDay(
      new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + 1,
      ),
    );
    setRangeStart(nextRangeStart);
    syncSidebarFocusToVisibleRange(nextRangeStart);
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setRangeStart(current);
    onSidebarFocusDateChange?.(current);
  }

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleNewTaskTimeChange(minutes: number) {
    setAddTaskPopover((current) =>
      current ? { ...current, dueTimeMinutes: minutes } : null,
    );
  }

  function handleAllDayClick(
    event: React.MouseEvent<HTMLElement>,
    day: Date,
  ) {
    setModalTaskId(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x: event.clientX,
      y: event.clientY,
      dueTimeMinutes: null,
    });
  }

  function handleTimeGridClick(
    event: React.MouseEvent<HTMLDivElement>,
    day: Date,
  ) {
    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

    event.stopPropagation();
    setModalTaskId(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const dueTimeMinutes = getMinutesFromGridY(y);
    const top = getTopForMinutes(dueTimeMinutes);

    if (
      top < GRID_TOP_OFFSET_PX ||
      top > GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX
    ) {
      return;
    }

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x: event.clientX,
      y: event.clientY,
      dueTimeMinutes,
    });
  }

  function handleCalendarTaskClick(
    event: React.MouseEvent<HTMLElement>,
    task: TaskListItem,
  ) {
    event.stopPropagation();

    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

    onSelectTask(task.id);
    closeAddTaskPopover();
    setModalTaskId(task.id);
  }

  function handleSetDropTargetSlot(slot: CalendarDropSlot | null) {
    setDropTargetSlot(slot);
    if (!slot) {
      setDraggingTaskPreview(null);
    }
  }

  function handleCalendarTaskPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    task: TaskListItem,
    day: Date,
  ) {
    event.stopPropagation();
    bindCalendarTaskDrag(event, {
      task,
      sourceDateKey: toDateKey(day),
      hourStart: HOUR_START,
      hourHeightPx: HOUR_HEIGHT_PX,
      onSetTaskDueDate,
      onSetTaskDueTime,
      dragStateRef,
      suppressTaskClickRef,
      setDropTargetSlot: handleSetDropTargetSlot,
      resizingTaskIdRef,
      onDragStart: (point) => {
        setModalTaskId(null);
        setDraggingTaskPreview({
          taskId: task.id,
          sourceDateKey: toDateKey(day),
          sourceTimeMinutes: normalizeDueTimeMinutes(task.dueTimeMinutes),
        });
        startDragPreview?.(task, point.clientX, point.clientY);
      },
      onDragMove: (point, slot) => {
        updateDragPreview?.(point.clientX, point.clientY, slot);
      },
      onDragEnd: () => {
        endDragPreview?.();
      },
    });
  }

  useEffect(() => {
    if (!rangeStart) return;
    setModalTaskId(null);
    closeAddTaskPopover();
  }, [rangeStart, dayCount]);

  useLayoutEffect(() => {
    if (!showGlobalNowLine || !hourColumnRef.current || currentTimeTop === null) {
      setNowLineTop(null);
      return;
    }

    setNowLineTop(
      hourColumnRef.current.offsetTop + GRID_TOP_OFFSET_PX + currentTimeTop,
    );
  }, [showGlobalNowLine, currentTimeTop, hours.length, rangeStart, dayCount]);

  if (!rangeStart || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  const timedGridMinMinutes = getMinutesFromGridY(GRID_TOP_OFFSET_PX);
  const timedGridMaxMinutes = getMinutesFromGridY(
    GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX,
  );
  const allDayRowHeightPx = getCalendarAllDayRowHeightPx(
    Math.max(
      0,
      ...visibleDays.map((day) => {
        const dateKey = toDateKey(day);
        let count = tasksByDate.get(dateKey)?.allDay.length ?? 0;
        if (
          addTaskPopover !== null &&
          isSameDay(day, addTaskPopover.date) &&
          addTaskPopover.dueTimeMinutes === null
        ) {
          count += 1;
        }
        return count;
      }),
    ),
  );
  const draggingTask =
    draggingTaskPreview === null
      ? null
      : tasks.find((task) => task.id === draggingTaskPreview.taskId) ?? null;
  const dragPreviewDuration =
    draggingTask && draggingTaskPreview
      ? getCalendarTaskDragPreviewDuration(
          draggingTask,
          draggingTaskPreview.sourceTimeMinutes,
        )
      : null;

  return (
    <div className={CALENDAR_VIEW_WRAPPER_CLASS}>
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className={CALENDAR_VIEW_SURFACE_CLASS}>
          <div className="flex shrink-0 items-center justify-start px-3 py-2">
            <CalendarPeriodNavigation
              onToday={goToToday}
              onPrevious={goToPreviousRange}
              onNext={goToNextRange}
              enableArrowKeyNavigation
              previousLabel="Previous day"
              nextLabel="Next day"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
          <div
            className="relative grid"
            style={{ gridTemplateColumns, minWidth: minGridWidth }}
          >
            <div
              className={`sticky top-0 z-20 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`}
            />
            {visibleDays.map((day, dayIndex) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={`head-${toDateKey(day)}`}
                  className={`sticky top-0 z-20 border-b border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950 ${getCalendarDayColumnDividerClass(dayIndex, visibleDays.length)}`}
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {getCalendarWeekdayLabel(day)}
                  </div>
                  <div
                    className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? CALENDAR_TODAY_DATE_CIRCLE_CLASS
                        : "font-medium text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}

            <div
              className={calendarAllDayLabelCellClassName(
                `border-b border-zinc-200 dark:border-zinc-800 ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`,
              )}
              style={{ height: allDayRowHeightPx }}
            >
              All day
            </div>
            {visibleDays.map((day, dayIndex) => {
              const dateKey = toDateKey(day);
              const dayTasks = tasksByDate.get(dateKey)?.allDay ?? [];
              const activeDropSlot = getActiveCalendarDropSlot(
                dropTargetSlot,
                externalDropTargetDateKey,
                null,
              );
              const isDropTarget =
                activeDropSlot?.dateKey === dateKey &&
                activeDropSlot.dueTimeMinutes === null;
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);
              const isActiveAllDay =
                isActiveDay && addTaskPopover?.dueTimeMinutes === null;

              return (
                <div
                  key={`allday-${dateKey}`}
                  data-calendar-day={dateKey}
                  onClick={(event) => handleAllDayClick(event, day)}
                  className={`${calendarAllDayCellClassName(
                    `cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${getCalendarDayColumnDividerClass(dayIndex, visibleDays.length)} ${
                    isDropTarget
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30"
                      : isActiveAllDay
                        ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30"
                        : "bg-white dark:bg-zinc-950"
                  }`,
                  )}`}
                  style={{ height: allDayRowHeightPx }}
                >
                  <div className="space-y-1">
                    {dayTasks.map((task) => (
                      <CalendarTaskHoverButton
                        key={getCalendarTaskKey(task)}
                        task={task}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskClick(event, task);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskPointerDown(event, task, day);
                        }}
                        className={`${calendarAllDayTaskClassName(
                          task.id === selectedTaskId,
                          canDragTasks,
                        )} calendar-task-row--single-line gap-1 overflow-hidden`}
                        style={getCalendarTaskItemStyle(task.priority, task.calendarColor)}
                      >
                        <CalendarTaskTitle
                          name={task.name}
                          recurrenceRule={task.recurrenceRule}
                        />
                        <CalendarTaskCompletionCheckbox
                          task={task}
                          onToggleTask={onToggleTask}
                          isCompleting={completingTaskIds?.has(task.id)}
                          isCheckAnimating={checkAnimatingTaskIds?.has(task.id)}
                          className="calendar-task-checkbox"
                        />
                      </CalendarTaskHoverButton>
                    ))}
                    {isActiveAllDay ? (
                      <div
                        aria-hidden="true"
                        className="block h-4 truncate rounded bg-zinc-200/50 px-1.5 text-[11px] text-zinc-400 dark:bg-zinc-700"
                      >
                        {draftTaskName.trim() || ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div
              ref={hourColumnRef}
              className={`relative ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="relative px-2 py-2 text-[11px] text-zinc-400 dark:text-zinc-500"
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {visibleDays.map((day, dayIndex) => {
              const dateKey = toDateKey(day);
              const timedTasks = tasksByDate.get(dateKey)?.timed ?? [];
              const activeDropSlot = getActiveCalendarDropSlot(
                dropTargetSlot,
                externalDropTargetDateKey,
                null,
              );
              const isTimedDropTarget =
                activeDropSlot?.dateKey === dateKey &&
                isSlotWithinTimedGrid(activeDropSlot.dueTimeMinutes, hours.length);
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);
              const isActiveTimedDay =
                isActiveDay && addTaskPopover?.dueTimeMinutes !== null;
              const showDragSlotMarker =
                resizingTaskId === null &&
                resizePreview === null &&
                isTimedDropTarget &&
                !isActiveTimedDay &&
                (activeDropSlot?.dueTimeMinutes ?? null) !== null;
              const selectedSlotMinutes = isActiveTimedDay
                ? (addTaskPopover?.dueTimeMinutes ?? null)
                : isTimedDropTarget
                  ? (activeDropSlot?.dueTimeMinutes ?? null)
                  : null;
              const selectedSlotTop =
                selectedSlotMinutes === null
                  ? null
                  : getTopForMinutes(selectedSlotMinutes);
              const showSelectedSlotMarker =
                resizingTaskId === null &&
                selectedSlotTop !== null &&
                selectedSlotTop >= GRID_TOP_OFFSET_PX &&
                selectedSlotTop <=
                  GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX &&
                (isActiveTimedDay || showDragSlotMarker);

              return (
                <div
                  key={`time-${dateKey}`}
                  ref={isActiveTimedDay ? timeGridRef : undefined}
                  data-calendar-day={dateKey}
                  data-calendar-time-grid="true"
                  data-hour-start={HOUR_START}
                  data-hour-height={HOUR_HEIGHT_PX}
                  data-grid-top-offset={GRID_TOP_OFFSET_PX}
                  className={`relative ${getCalendarDayColumnDividerClass(dayIndex, visibleDays.length)} ${
                    isTimedDropTarget ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={(event) => handleTimeGridClick(event, day)}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="relative cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                      style={{ height: HOUR_HEIGHT_PX }}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                    </div>
                  ))}

                  {timedTasks.map((task) => {
                    const timing = getTaskTiming(task, resizePreview);
                    const baseTop = getTopForMinutes(timing.dueTimeMinutes);
                    const height = Math.max(
                      24,
                      (timing.dueDurationMinutes / 60) * HOUR_HEIGHT_PX,
                    );
                    const isDraggingTask =
                      draggingTaskPreview?.taskId === task.id;
                    const isSourceColumn =
                      draggingTaskPreview?.sourceDateKey === dateKey;
                    const hideDraggedBlock =
                      isDraggingTask &&
                      activeDropSlot?.dateKey &&
                      activeDropSlot.dateKey !== dateKey;
                    const sourcePlaceholder =
                      isDraggingTask && isSourceColumn ? (
                        <CalendarTaskDragSourcePlaceholder
                          top={baseTop}
                          height={height}
                          taskName={task.name}
                          startMinutes={timing.dueTimeMinutes}
                          durationMinutes={timing.dueDurationMinutes}
                        />
                      ) : null;

                    if (hideDraggedBlock) {
                      return (
                        <Fragment key={getCalendarTaskKey(task)}>{sourcePlaceholder}</Fragment>
                      );
                    }

                    const top = getCalendarTaskDragPreviewTop({
                      baseTop,
                      isDraggingTask,
                      sourceTimeMinutes: timing.dueTimeMinutes,
                      dropDateKey: activeDropSlot?.dateKey,
                      dropTimeMinutes: activeDropSlot?.dueTimeMinutes,
                      dayDateKey: dateKey,
                      hourStart: HOUR_START,
                      hourHeightPx: HOUR_HEIGHT_PX,
                      gridTopOffsetPx: GRID_TOP_OFFSET_PX,
                    });

                    if (
                      top < GRID_TOP_OFFSET_PX ||
                      top > GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX
                    ) {
                      return null;
                    }

                    return (
                      <Fragment key={getCalendarTaskKey(task)}>
                        {sourcePlaceholder}
                        <CalendarTimedTaskBlock
                          task={task}
                          day={day}
                          top={top}
                          height={height}
                          startMinutes={timing.dueTimeMinutes}
                          durationMinutes={timing.dueDurationMinutes}
                          hourStart={HOUR_START}
                          hourHeightPx={HOUR_HEIGHT_PX}
                          selected={task.id === selectedTaskId}
                          canInteract={canDragTasks}
                          onTaskClick={handleCalendarTaskClick}
                          onSetTaskDueDate={onSetTaskDueDate}
                          onSetTaskDueTime={onSetTaskDueTime}
                          dragStateRef={dragStateRef}
                          suppressTaskClickRef={suppressTaskClickRef}
                          setDropTargetSlot={handleSetDropTargetSlot}
                          setResizePreview={setResizePreview}
                          resizingTaskIdRef={resizingTaskIdRef}
                          onResizeStart={setResizingTaskId}
                          onResizeEnd={() => setResizingTaskId(null)}
                          onToggleTask={onToggleTask}
                          isCompleting={completingTaskIds?.has(task.id)}
                          isCheckAnimating={checkAnimatingTaskIds?.has(task.id)}
                          onDragStart={() => {
                            setModalTaskId(null);
                            setDraggingTaskPreview({
                              taskId: task.id,
                              sourceDateKey: dateKey,
                              sourceTimeMinutes: normalizeDueTimeMinutes(
                                task.dueTimeMinutes,
                              ),
                            });
                          }}
                          toDateKey={toDateKey}
                        />
                      </Fragment>
                    );
                  })}

                  {showSelectedSlotMarker &&
                  selectedSlotTop !== null &&
                  selectedSlotMinutes !== null ? (
                    <>
                      {showDragSlotMarker &&
                      draggingTask &&
                      dragPreviewDuration !== null &&
                      !timedTasks.some((task) => task.id === draggingTask.id) ? (
                        <CalendarTaskDropPreview
                          top={selectedSlotTop}
                          height={getCalendarTaskPreviewHeight(
                            dragPreviewDuration,
                            HOUR_HEIGHT_PX,
                          )}
                          taskName={draggingTask.name}
                          startMinutes={selectedSlotMinutes}
                          durationMinutes={dragPreviewDuration}
                        />
                      ) : isActiveTimedDay ? (
                        <CalendarNewTaskSlotPreview
                          previewRef={newTaskPreviewRef}
                          slotTop={selectedSlotTop}
                          timeMinutes={selectedSlotMinutes}
                          hourHeightPx={HOUR_HEIGHT_PX}
                          hourStart={HOUR_START}
                          gridTopOffsetPx={GRID_TOP_OFFSET_PX}
                          gridRef={timeGridRef}
                          minMinutes={timedGridMinMinutes}
                          maxMinutes={timedGridMaxMinutes}
                          label={draftTaskName}
                          onTimeChange={handleNewTaskTimeChange}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}

            {showGlobalNowLine && nowLineTop !== null ? (
              <CalendarCurrentTimeLine
                now={now}
                top={nowLineTop}
                variant="accent"
                todayColumnIndex={todayIndex}
                columnCount={dayCount}
                className="absolute inset-x-0 z-20"
              />
            ) : null}
          </div>
          </div>
        </div>
      </div>

      {addTaskPopover && onAddCalendarTask ? (
        <CalendarAddTaskPopover
          date={addTaskPopover.date}
          dueTimeMinutes={addTaskPopover.dueTimeMinutes}
          lists={lists}
          defaultListId={defaultListId}
          anchorRef={
            addTaskPopover.dueTimeMinutes !== null
              ? newTaskPreviewRef
              : undefined
          }
          x={
            addTaskPopover.dueTimeMinutes === null
              ? addTaskPopover.x
              : undefined
          }
          y={
            addTaskPopover.dueTimeMinutes === null
              ? addTaskPopover.y
              : undefined
          }
          name={draftTaskName}
          onNameChange={setDraftTaskName}
          onClose={closeAddTaskPopover}
          onAddTask={onAddCalendarTask}
        />
      ) : null}

      {modalTaskId ? (
        <CalendarTaskModal
          taskId={modalTaskId}
          taskSnapshot={modalTaskSnapshot}
          onClose={() => setModalTaskId(null)}
          onDetailsSaved={onDetailsSaved}
          onTaskHasDetailsKnown={onTaskHasDetailsKnown}
          onTaskRenamed={onTaskRenamed}
          onDueDateUpdated={onDueDateUpdated}
          onToggleTask={onToggleTask}
        />
      ) : null}
    </div>
  );
}
