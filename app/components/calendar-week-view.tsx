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
  calendarAllDayCellClassName,
  calendarAllDayLabelCellClassName,
  calendarAllDayTaskClassName,
  getCalendarTaskItemStyle,
  getCalendarAllDayRowHeightPx,
  getCalendarShellClassName,
  CALENDAR_VIEW_SURFACE_CLASS,
  CALENDAR_VIEW_WRAPPER_CLASS,
  CALENDAR_HOUR_COLUMN_DIVIDER_CLASS,
  getCalendarDayColumnDividerClass,
  getCalendarWeekStart,
  getCalendarWeekdayLabel,
  CALENDAR_TODAY_DATE_CIRCLE_CLASS,
} from "@/lib/calendar-layout";
import type { CalendarSidebarSyncProps } from "./calendar-view-sidebar-layout";
import {
  CALENDAR_COLLAPSE_EARLY_END_HOUR,
  CALENDAR_COLLAPSED_EARLY_HOURS_ROW_HEIGHT_PX,
  CALENDAR_TIME_SLOT_MINUTES,
  formatCalendarCollapsedEarlyHoursLabel,
  getCalendarDisplayHours,
  getCalendarTaskPreviewHeight,
  getCalendarTimedGridHourStart,
  getCalendarTimedGridTopOffset,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
  isCalendarGridYInCollapsedEarlyBand,
  shouldCollapseCalendarEarlyHours,
  type CalendarDropSlot,
} from "@/lib/calendar-time-grid";
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
import {
  bindCalendarTaskDrag,
  getActiveCalendarDropSlot,
  CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
  getCalendarTaskDragPreviewDuration,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";

const BASE_HOUR_HEIGHT_PX = 52;
const TWO_WEEK_HOUR_HEIGHT_PX = Math.round(BASE_HOUR_HEIGHT_PX * 0.6);
const GRID_TOP_OFFSET_PX = 0;
const SELECTED_WEEK_DAY_COLUMN_CLASS = "bg-[#f6f6f9]";
const SELECTED_WEEK_DAY_ROW_BORDER_CLASS =
  "border-b border-zinc-200 dark:border-zinc-800";

function getWeekDayColumnDividerClass(
  dayIndex: number,
  weekDays: Date[],
  isSelectedWeekDay: (day: Date) => boolean,
) {
  if (dayIndex >= weekDays.length - 1) return "";

  if (
    isSelectedWeekDay(weekDays[dayIndex]) ||
    isSelectedWeekDay(weekDays[dayIndex + 1])
  ) {
    return "";
  }

  return getCalendarDayColumnDividerClass(dayIndex, weekDays.length);
}

type CalendarWeekViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  weekCount?: number;
  onSelectTask: (taskId: string) => void;
  onToggleTask?: (taskId: string) => void;
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
  externalDropTargetTimeMinutes?: number | null;
  externalDraggingTaskId?: string | null;
  externalDraggingTaskName?: string | null;
  onPeriodLabelChange?: (label: string) => void;
} & CalendarSidebarSyncProps;

function isSlotWithinTimedGrid(
  dueTimeMinutes: number | null,
  hourCount: number,
  hourHeightPx: number,
  hourStart: number,
  gridTopOffsetPx: number,
) {
  if (dueTimeMinutes === null) return false;

  const top = getTopForCalendarMinutes(
    dueTimeMinutes,
    hourStart,
    hourHeightPx,
    gridTopOffsetPx,
  );
  return (
    top >= gridTopOffsetPx &&
    top <= gridTopOffsetPx + hourCount * hourHeightPx
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

function getWeekStart(date: Date) {
  return startOfDay(getCalendarWeekStart(date));
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) =>
    startOfDay(
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + index,
      ),
    ),
  );
}

function getVisibleWeeks(weekStart: Date, weekCount: number) {
  return Array.from({ length: weekCount }, (_, weekIndex) =>
    getWeekDays(
      startOfDay(
        new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + weekIndex * 7,
        ),
      ),
    ),
  );
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatRangeHeading(days: Date[]) {
  if (days.length === 0) return "";

  const first = days[0];
  const last = days[days.length - 1];
  const monthYear = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });

  if (
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear()
  ) {
    return monthYear.format(first);
  }

  const monthOnly = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${monthOnly.format(first)} – ${monthYear.format(last)}`;
}


export function CalendarWeekView({
  tasks,
  lists,
  completingTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
  weekCount = 1,
  onSelectTask,
  onToggleTask,
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
  externalDropTargetTimeMinutes = null,
  externalDraggingTaskId = null,
  externalDraggingTaskName = null,
  onPeriodLabelChange,
  sidebarFocusDate,
  sidebarJumpRequestId,
  onSidebarFocusDateChange,
}: CalendarWeekViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
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
  const timeGridRef = useRef<HTMLDivElement>(null);
  const newTaskPreviewRef = useRef<HTMLDivElement>(null);
  const hourColumnRef = useRef<HTMLDivElement>(null);
  const [nowLineTop, setNowLineTop] = useState<number | null>(null);
  const [earlyHoursExpanded, setEarlyHoursExpanded] = useState(false);
  const {
    startDragPreview,
    updateDragPreview,
    endDragPreview,
  } = useCalendarTaskDragPreview();
  const canDragTasks = Boolean(onSetTaskDueDate || onSetTaskDueTime);
  const visibleWeekCount = Math.max(1, weekCount);
  const hourHeightPx =
    visibleWeekCount === 2 ? TWO_WEEK_HOUR_HEIGHT_PX : BASE_HOUR_HEIGHT_PX;

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setWeekStart(getWeekStart(current));
    setNow(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    const days = getVisibleWeeks(weekStart, visibleWeekCount).flat();
    onPeriodLabelChange?.(
      visibleWeekCount > 1 ? formatRangeHeading(days) : formatMonthYear(weekStart),
    );
  }, [onPeriodLabelChange, visibleWeekCount, weekStart]);

  useEffect(() => {
    if (
      sidebarJumpRequestId === undefined ||
      sidebarFocusDate === undefined ||
      sidebarJumpRequestId === lastSidebarJumpRequestIdRef.current
    ) {
      return;
    }

    lastSidebarJumpRequestIdRef.current = sidebarJumpRequestId;
    setWeekStart(getWeekStart(sidebarFocusDate));
  }, [sidebarFocusDate, sidebarJumpRequestId]);

  const visibleWeeks = useMemo(
    () => (weekStart ? getVisibleWeeks(weekStart, visibleWeekCount) : []),
    [visibleWeekCount, weekStart],
  );
  const visibleDays = useMemo(() => visibleWeeks.flat(), [visibleWeeks]);

  const visibleDateKeys = useMemo(
    () => new Set(visibleDays.map((day) => toDateKey(day))),
    [visibleDays],
  );

  const nowMinutesOnVisibleToday = useMemo(() => {
    if (!today || !now || !visibleDays.some((day) => isSameDay(day, today))) {
      return null;
    }

    return now.getHours() * 60 + now.getMinutes();
  }, [now, today, visibleDays]);

  const shouldAutoCollapseEarlyHours = useMemo(
    () =>
      shouldCollapseCalendarEarlyHours({
        timedTasks: tasks,
        visibleDateKeys,
        nowMinutesOnVisibleToday,
      }),
    [nowMinutesOnVisibleToday, tasks, visibleDateKeys],
  );

  const earlyHoursCollapsed =
    shouldAutoCollapseEarlyHours && !earlyHoursExpanded;
  const gridHourStart = getCalendarTimedGridHourStart(earlyHoursCollapsed);
  const effectiveGridTopOffset = getCalendarTimedGridTopOffset(
    GRID_TOP_OFFSET_PX,
    earlyHoursCollapsed,
  );

  const hours = useMemo(
    () => getCalendarDisplayHours(earlyHoursCollapsed),
    [earlyHoursCollapsed],
  );

  useEffect(() => {
    setEarlyHoursExpanded(false);
  }, [weekStart]);

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
      : (now.getHours() + now.getMinutes() / 60 - gridHourStart) * hourHeightPx;

  function syncSidebarFocusToVisibleWeek(start: Date) {
    if (!today || !onSidebarFocusDateChange) return;

    const days = getVisibleWeeks(start, visibleWeekCount).flat();
    const focusDate = days.some((day) => isSameDay(day, today)) ? today : start;
    onSidebarFocusDateChange(focusDate);
  }

  function goToPreviousWeek() {
    if (!weekStart) return;
    const nextWeekStart = startOfDay(
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() - 7,
      ),
    );
    setWeekStart(nextWeekStart);
    syncSidebarFocusToVisibleWeek(nextWeekStart);
  }

  function goToNextWeek() {
    if (!weekStart) return;
    const nextWeekStart = startOfDay(
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + 7,
      ),
    );
    setWeekStart(nextWeekStart);
    syncSidebarFocusToVisibleWeek(nextWeekStart);
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setWeekStart(getWeekStart(current));
    onSidebarFocusDateChange?.(current);
  }

  function handleDayHeaderSelect(day: Date) {
    onSidebarFocusDateChange?.(startOfDay(day));
  }

  function isSelectedWeekDay(day: Date) {
    return sidebarFocusDate !== undefined && isSameDay(day, sidebarFocusDate);
  }

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
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

    if (isCalendarGridYInCollapsedEarlyBand(y, GRID_TOP_OFFSET_PX, earlyHoursCollapsed)) {
      setEarlyHoursExpanded(true);
      return;
    }

    const dueTimeMinutes = getMinutesFromCalendarGridY(
      y,
      gridHourStart,
      hourHeightPx,
      CALENDAR_TIME_SLOT_MINUTES,
      effectiveGridTopOffset,
    );
    const top = getTopForCalendarMinutes(
      dueTimeMinutes,
      gridHourStart,
      hourHeightPx,
      effectiveGridTopOffset,
    );

    if (
      top < effectiveGridTopOffset ||
      top > effectiveGridTopOffset + hours.length * hourHeightPx
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

  function handleNewTaskTimeChange(minutes: number) {
    setAddTaskPopover((current) =>
      current ? { ...current, dueTimeMinutes: minutes } : null,
    );
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
      hourStart: gridHourStart,
      hourHeightPx: hourHeightPx,
      onSetTaskDueDate,
      onSetTaskDueTime,
      dragStateRef,
      suppressTaskClickRef,
      setDropTargetSlot: handleSetDropTargetSlot,
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
    if (!weekStart) return;
    setModalTaskId(null);
    closeAddTaskPopover();
  }, [weekStart]);

  const showWeekNowLine =
    weekStart !== null &&
    today !== null &&
    visibleDays.some((day) => isSameDay(day, today)) &&
    currentTimeTop !== null &&
    currentTimeTop >= 0 &&
    currentTimeTop <= hours.length * hourHeightPx;

  useLayoutEffect(() => {
    if (!showWeekNowLine || currentTimeTop === null) {
      setNowLineTop(null);
      return;
    }

    setNowLineTop(effectiveGridTopOffset + currentTimeTop);
  }, [
    effectiveGridTopOffset,
    showWeekNowLine,
    currentTimeTop,
    hours.length,
    weekStart,
  ]);

  if (!weekStart || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

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
  const timedGridMinMinutes = getMinutesFromCalendarGridY(
    effectiveGridTopOffset,
    gridHourStart,
    hourHeightPx,
    CALENDAR_TIME_SLOT_MINUTES,
    effectiveGridTopOffset,
  );
  const timedGridMaxMinutes = getMinutesFromCalendarGridY(
    effectiveGridTopOffset + hours.length * hourHeightPx,
    gridHourStart,
    hourHeightPx,
    CALENDAR_TIME_SLOT_MINUTES,
    effectiveGridTopOffset,
  );

  function getAllDayRowHeightPx(days: Date[]) {
    return getCalendarAllDayRowHeightPx(
      Math.max(
        0,
        ...days.map((day) => {
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
  }

  return (
    <div className={CALENDAR_VIEW_WRAPPER_CLASS}>
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className={CALENDAR_VIEW_SURFACE_CLASS}>
          <div className="flex shrink-0 items-center justify-start px-3 pt-1 pb-2">
            <CalendarPeriodNavigation
              onToday={goToToday}
              onPrevious={goToPreviousWeek}
              onNext={goToNextWeek}
              previousLabel="Previous week"
              nextLabel="Next week"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-[760px]">
                {visibleWeeks.map((weekDays, weekIndex) => {
                  const allDayRowHeightPx = getAllDayRowHeightPx(weekDays);
                  const todayColumnIndex = weekDays.findIndex((day) =>
                    isSameDay(day, today),
                  );
                  const showThisWeekNowLine =
                    showWeekNowLine && todayColumnIndex >= 0;

                  return (
                    <div
                      key={
                        weekDays[0]
                          ? toDateKey(weekDays[0])
                          : `week-${weekIndex}`
                      }
                      className={
                        weekIndex > 0
                          ? "border-t border-zinc-200 dark:border-zinc-800"
                          : undefined
                      }
                    >
                <div className="sticky top-0 z-20 bg-white dark:bg-zinc-950">
                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                  <div
                    className={`bg-white dark:bg-zinc-950 ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`}
                  />
                  {weekDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, today);
                    const isSelectedDay = isSelectedWeekDay(day);
                    return (
                      <button
                        key={`head-${toDateKey(day)}`}
                        type="button"
                        onClick={() => handleDayHeaderSelect(day)}
                        className={`px-2 py-2 text-center transition-colors cursor-pointer ${getWeekDayColumnDividerClass(dayIndex, weekDays, isSelectedWeekDay)} ${
                          isSelectedDay
                            ? `${SELECTED_WEEK_DAY_COLUMN_CLASS} rounded-t-[8px] ${SELECTED_WEEK_DAY_ROW_BORDER_CLASS}`
                            : `${SELECTED_WEEK_DAY_ROW_BORDER_CLASS} bg-white dark:bg-zinc-950`
                        }`}
                      >
                        <div className="text-[14px] font-medium uppercase tracking-wide text-[#222222] dark:text-zinc-200">
                          {getCalendarWeekdayLabel(day)}
                        </div>
                        <div
                          className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm ${
                            isToday
                              ? CALENDAR_TODAY_DATE_CIRCLE_CLASS
                              : " text-[#999999] dark:text-zinc-400"
                          }`}
                        >
                          {day.getDate()}
                        </div>
                      </button>
                    );
                  })}

                  <div
                    className={calendarAllDayLabelCellClassName(
                      `bg-white dark:bg-zinc-950 ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`,
                    )}
                    style={{ height: allDayRowHeightPx }}
                  >
                    All day
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const dateKey = toDateKey(day);
                    const dayTasks = tasksByDate.get(dateKey)?.allDay ?? [];
                    const activeDropSlot = getActiveCalendarDropSlot(
                      dropTargetSlot,
                      externalDropTargetDateKey,
                      externalDropTargetTimeMinutes,
                    );
                    const isDropTarget =
                      activeDropSlot?.dateKey === dateKey &&
                      activeDropSlot.dueTimeMinutes === null;
                    const isActiveDay =
                      addTaskPopover !== null &&
                      isSameDay(day, addTaskPopover.date) &&
                      addTaskPopover.dueTimeMinutes === null;
                    const isSelectedDay = isSelectedWeekDay(day);

                    return (
                      <div
                        key={`allday-${dateKey}`}
                        data-calendar-day={dateKey}
                        onClick={(event) => handleAllDayClick(event, day)}
                        className={calendarAllDayCellClassName(
                          `cursor-pointer transition-colors ${getWeekDayColumnDividerClass(dayIndex, weekDays, isSelectedWeekDay)} ${
                            isDropTarget
                              ? "border-b border-zinc-200 bg-blue-50 ring-1 ring-inset ring-blue-400 dark:border-zinc-800 dark:bg-blue-950/30"
                              : isActiveDay
                                ? "border-b border-zinc-200 bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:border-zinc-800 dark:bg-blue-950/30"
                                : isSelectedDay
                                  ? `${SELECTED_WEEK_DAY_COLUMN_CLASS} ${SELECTED_WEEK_DAY_ROW_BORDER_CLASS}`
                                  : `${SELECTED_WEEK_DAY_ROW_BORDER_CLASS} bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/60`
                          }`,
                        )}
                        style={{ height: allDayRowHeightPx }}
                      >
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
                      </div>
                    );
                  })}
                  </div>
                </div>

                <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                  <div
                    ref={weekIndex === 0 ? hourColumnRef : undefined}
                    className={`relative ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`}
                  >
                    {earlyHoursCollapsed ? (
                      <button
                        type="button"
                        onClick={() => setEarlyHoursExpanded(true)}
                        aria-label="Show early morning hours"
                        className="relative flex w-full cursor-pointer items-center px-2 text-[10px] leading-tight text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                        style={{
                          height: CALENDAR_COLLAPSED_EARLY_HOURS_ROW_HEIGHT_PX,
                        }}
                      >
                        {formatCalendarCollapsedEarlyHoursLabel(
                          CALENDAR_COLLAPSE_EARLY_END_HOUR,
                        )}
                      </button>
                    ) : null}
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="relative px-2 py-2 text-[11px] text-zinc-400 dark:text-zinc-500"
                        style={{ height: hourHeightPx }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {weekDays.map((day, dayIndex) => {
              const dateKey = toDateKey(day);
              const timedTasks = tasksByDate.get(dateKey)?.timed ?? [];
              const activeDropSlot = getActiveCalendarDropSlot(
                dropTargetSlot,
                externalDropTargetDateKey,
                externalDropTargetTimeMinutes,
              );
              const isTimedDropTarget =
                activeDropSlot?.dateKey === dateKey &&
                isSlotWithinTimedGrid(
                  activeDropSlot.dueTimeMinutes,
                  hours.length,
                  hourHeightPx,
                  gridHourStart,
                  effectiveGridTopOffset,
                );
              const isActiveTimedDay =
                addTaskPopover !== null &&
                isSameDay(day, addTaskPopover.date) &&
                addTaskPopover.dueTimeMinutes !== null;
              const showDragSlotMarker =
                resizingTaskId === null &&
                resizePreview === null &&
                isTimedDropTarget &&
                !isActiveTimedDay &&
                (activeDropSlot?.dueTimeMinutes ?? null) !== null;
              const selectedSlotMinutes = isActiveTimedDay
                ? addTaskPopover.dueTimeMinutes
                : isTimedDropTarget
                  ? activeDropSlot?.dueTimeMinutes ?? null
                  : null;
              const selectedSlotTop =
                selectedSlotMinutes === null
                  ? null
                  : getTopForCalendarMinutes(
                      selectedSlotMinutes,
                      gridHourStart,
                      hourHeightPx,
                      effectiveGridTopOffset,
                    );
              const showSelectedSlotMarker =
                resizingTaskId === null &&
                selectedSlotTop !== null &&
                selectedSlotTop >= effectiveGridTopOffset &&
                selectedSlotTop <=
                  effectiveGridTopOffset + hours.length * hourHeightPx &&
                (isActiveTimedDay || showDragSlotMarker);
              const isSelectedDay = isSelectedWeekDay(day);

              return (
                <div
                  key={`time-${dateKey}`}
                  ref={isActiveTimedDay ? timeGridRef : undefined}
                  data-calendar-day={dateKey}
                  data-calendar-time-grid="true"
                  data-hour-start={gridHourStart}
                  data-hour-height={hourHeightPx}
                  data-grid-top-offset={effectiveGridTopOffset}
                  className={`relative ${getWeekDayColumnDividerClass(dayIndex, weekDays, isSelectedWeekDay)} ${
                    isSelectedDay ? SELECTED_WEEK_DAY_COLUMN_CLASS : ""
                  }`}
                  onClick={(event) => handleTimeGridClick(event, day)}
                >
                  {earlyHoursCollapsed ? (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Show early morning hours"
                      onClick={() => setEarlyHoursExpanded(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setEarlyHoursExpanded(true);
                        }
                      }}
                      className={`relative cursor-pointer border-b border-zinc-200 dark:border-zinc-800 ${
                        isSelectedDay
                          ? "bg-transparent"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                      }`}
                      style={{
                        height: CALENDAR_COLLAPSED_EARLY_HOURS_ROW_HEIGHT_PX,
                      }}
                    />
                  ) : null}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className={`relative cursor-pointer border-b border-zinc-200 dark:border-zinc-800 ${
                        isSelectedDay
                          ? "bg-transparent"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                      }`}
                      style={{ height: hourHeightPx }}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-1/4 hover:bg-[#aaaaaa]" />
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 hover:bg-[#aaaaaa]" />
                      <div className="pointer-events-none absolute inset-x-0 top-3/4 hover:bg-[#aaaaaa]" />
                      {/* <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" /> */}
                    </div>
                  ))}

                  {timedTasks.map((task) => {
                    const timing = getTaskTiming(task, resizePreview);
                    const baseTop = getTopForCalendarMinutes(
                      timing.dueTimeMinutes,
                      gridHourStart,
                      hourHeightPx,
                      effectiveGridTopOffset,
                    );
                    const height = Math.max(
                      24,
                      (timing.dueDurationMinutes / 60) * hourHeightPx,
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
                      hourStart: gridHourStart,
                      hourHeightPx: hourHeightPx,
                      gridTopOffsetPx: effectiveGridTopOffset,
                    });

                    if (
                      top < effectiveGridTopOffset ||
                      top > effectiveGridTopOffset + hours.length * hourHeightPx
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
                          hourStart={gridHourStart}
                          hourHeightPx={hourHeightPx}
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
                            hourHeightPx,
                          )}
                          taskName={draggingTask.name}
                          startMinutes={selectedSlotMinutes}
                          durationMinutes={dragPreviewDuration}
                        />
                      ) : showDragSlotMarker &&
                        externalDraggingTaskId &&
                        externalDraggingTaskName &&
                        selectedSlotMinutes !== null ? (
                        <CalendarTaskDropPreview
                          top={selectedSlotTop}
                          height={getCalendarTaskPreviewHeight(
                            CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
                            hourHeightPx,
                          )}
                          taskName={externalDraggingTaskName}
                          startMinutes={selectedSlotMinutes}
                          durationMinutes={
                            CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES
                          }
                        />
                      ) : isActiveTimedDay ? (
                        <CalendarNewTaskSlotPreview
                          previewRef={newTaskPreviewRef}
                          slotTop={selectedSlotTop}
                          timeMinutes={selectedSlotMinutes}
                          hourHeightPx={hourHeightPx}
                          hourStart={gridHourStart}
                          gridTopOffsetPx={effectiveGridTopOffset}
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

            {showThisWeekNowLine && nowLineTop !== null ? (
              <CalendarCurrentTimeLine
                now={now}
                top={nowLineTop}
                variant="accent"
                todayColumnIndex={todayColumnIndex}
                columnCount={weekDays.length}
                className="absolute inset-x-0 z-20"
              />
            ) : null}
                </div>
                    </div>
                  );
                })}
              </div>
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
