"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { CalendarTaskTitle } from "./calendar-task-title";
import { CalendarPeriodNavigation } from "./calendar-period-navigation";
import { CalendarCurrentTimeLine } from "./calendar-current-time-line";
import type { CalendarStartTaskOptions } from "@/lib/calendar-start-task";
import { type CalendarTaskEditorCallbacks } from "./calendar-task-modal";
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
  isCalendarTaskPast,
  getCalendarAllDayRowHeightPx,
  getCalendarShellClassName,
  getCalendarViewSurfaceClassName,
  getCalendarTimedGridScrollClassName,
  CALENDAR_VIEW_WRAPPER_CLASS,
  CALENDAR_HOUR_COLUMN_DIVIDER_CLASS,
  formatCalendarHourLabel,
  calendarHourLabelCellClassName,
  calendarHourLabelClassName,
  shouldShowCalendarHourLabel,
  getCalendarDayColumnDividerClass,
  getCalendarWeekStart,
  getCalendarWeekdayLabel,
  CALENDAR_TODAY_DATE_CIRCLE_CLASS,
  getCalendarTimedGridTemplateColumns,
  CALENDAR_WEEK_HEADER_HEIGHT_PX,
  CALENDAR_WEEK_HEADER_STICKY_CLASS,
  CALENDAR_WEEK_ALLDAY_STICKY_CLASS,
} from "@/lib/calendar-layout";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import type { CalendarSidebarSyncProps } from "./calendar-view-sidebar-layout";
import {
  CALENDAR_COLLAPSE_EARLY_END_HOUR,
  CALENDAR_TIME_SLOT_MINUTES,
  getCalendarTaskPreviewHeight,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
  type CalendarDropSlot,
} from "@/lib/calendar-time-grid";
import {
  getCalendarDesktopDisplayHours,
  useCalendarViewportHourHeight,
} from "@/lib/use-calendar-viewport-hour-height";
import { useCalendarTimedGridScrollSession } from "@/lib/use-calendar-timed-grid-scroll-session";
import {
  CalendarTimedTaskBlock,
  CalendarTaskCompletionCheckbox,
  CalendarTaskDropPreview,
  CalendarTaskDragSourcePlaceholder,
  getCalendarTaskDragPreviewTop,
  getTaskTiming,
  CALENDAR_TASK_GRID_EXTRA_PADDING_START_PX,
  CALENDAR_TASK_HORIZONTAL_PADDING_START_PX,
  type CalendarTaskResizePreview,
} from "./calendar-timed-task-block";
import {
  CalendarTaskHoverButton,
  useCalendarTaskDragPreview,
} from "./calendar-task-hover-preview";
import { useRecordCalendarTaskMove } from "./calendar-task-move-undo";
import {
  parseCalendarDateNavigationAnchor,
  useApplyCalendarDateNavigationRestore,
  useRecordCalendarDateNavigation,
  useSyncCalendarDateNavigationAnchor,
} from "./calendar-date-navigation-undo";
import type { CalendarDateNavigationSnapshot } from "@/lib/calendar-date-navigation-undo";
import {
  bindCalendarTaskDrag,
  getActiveCalendarDropSlot,
  CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
  getCalendarTaskDragPreviewDuration,
  isCalendarTaskAtDragSource,
  shouldHideCalendarAllDayTaskDuringInternalDrag,
  shouldShowCalendarAllDayExternalDropPreview,
  shouldShowCalendarAllDayInternalDropPreview,
  shouldShowCalendarAllDaySourcePlaceholderDuringInternalDrag,
  shouldShowCalendarInternalDragSlotMarker,
  useCalendarTaskDropRevealMask,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import { CalendarAllDayTaskPreview } from "./calendar-all-day-task-preview";
import {
  buildCalendarNowLineDimmedColumns,
  getCalendarTimedBlockBounds,
} from "@/lib/calendar-now-line-overlap";

const GRID_HOUR_START = CALENDAR_COLLAPSE_EARLY_END_HOUR;
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
  onCloseTaskEditor?: () => void;
  onToggleTask?: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskDueDateAndTime?: (
    taskId: string,
    dateValue: string | null,
    dueTime: TaskDueTime,
  ) => void;
} & CalendarTaskEditorCallbacks & {
  onStartCalendarTask?: (
    options: CalendarStartTaskOptions,
  ) => void | Promise<void>;
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
  onCloseTaskEditor,
  onToggleTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskDueDateAndTime,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onStartCalendarTask,
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
  dateNavigationRestoreRequestId,
  dateNavigationRestoreSnapshot,
}: CalendarWeekViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const lastSidebarJumpRequestIdRef = useRef(0);
  function closeTaskModal() {
    onCloseTaskEditor?.();
  }
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();
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
  const { markTaskJustDropped, isTaskMaskedForDrop } =
    useCalendarTaskDropRevealMask();
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const resizingTaskIdRef = useRef<string | null>(null);
  const suppressTaskClickRef = useRef(false);
  const hourColumnRef = useRef<HTMLDivElement>(null);
  const timeScrollRef = useRef<HTMLDivElement>(null);
  const visibleWeekCount = Math.max(1, weekCount);
  const isTimedGridReady = Boolean(weekStart && today && now);
  const hourHeightPx = useCalendarViewportHourHeight(
    timeScrollRef,
    hourColumnRef,
    isTimedGridReady,
  );
  const timedGridScrollView = visibleWeekCount > 1 ? "weeks" : "week";
  useCalendarTimedGridScrollSession(
    timeScrollRef,
    timedGridScrollView,
    isTimedGridReady,
  );
  const [nowLineTop, setNowLineTop] = useState<number | null>(null);

  const {
    startDragPreview,
    updateDragPreview,
    endDragPreview,
  } = useCalendarTaskDragPreview();
  const recordCalendarTaskMove = useRecordCalendarTaskMove();
  const recordCalendarDateNavigation = useRecordCalendarDateNavigation();
  const canDragTasks = Boolean(onSetTaskDueDate || onSetTaskDueTime);

  useSyncCalendarDateNavigationAnchor(weekStart);

  const applyDateNavigationRestore = useCallback(
    (snapshot: CalendarDateNavigationSnapshot) => {
      const anchor = parseCalendarDateNavigationAnchor(snapshot);
      if (anchor) {
        setWeekStart(anchor);
      }
    },
    [],
  );

  useApplyCalendarDateNavigationRestore(
    dateNavigationRestoreSnapshot,
    dateNavigationRestoreRequestId,
    applyDateNavigationRestore,
  );

  useEffect(() => {
    const current = startOfDay(new Date());
    const focusDay =
      sidebarFocusDate !== undefined
        ? startOfDay(sidebarFocusDate)
        : current;
    setToday(current);
    setWeekStart(getWeekStart(focusDay));
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

  const gridHourStart = GRID_HOUR_START;
  const effectiveGridTopOffset = GRID_TOP_OFFSET_PX;

  const hours = useMemo(() => getCalendarDesktopDisplayHours(), []);

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
    recordCalendarDateNavigation?.();
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
    recordCalendarDateNavigation?.();
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
    recordCalendarDateNavigation?.();
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

  function handleAllDayClick(
    _event: React.MouseEvent<HTMLElement>,
    day: Date,
  ) {
    closeTaskModal();

    if (!onStartCalendarTask || lists.length === 0) return;

    void onStartCalendarTask({ date: day, dueTimeMinutes: null });
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
    closeTaskModal();

    if (!onStartCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;

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

    void onStartCalendarTask({ date: day, dueTimeMinutes });
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
      onSetTaskDueDateAndTime,
      dragStateRef,
      suppressTaskClickRef,
      setDropTargetSlot: handleSetDropTargetSlot,
      onDragStart: (point) => {
        closeTaskModal();
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
      onDragEnd: (didMove) => {
        endDragPreview?.();
        if (didMove) {
          markTaskJustDropped(task.id);
        }
      },
      onCalendarTaskMoved: recordCalendarTaskMove ?? undefined,
    });
  }

  useEffect(() => {
    if (!weekStart) return;
    closeTaskModal();
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
  const externalDraggingTask =
    externalDraggingTaskId === null
      ? null
      : tasks.find((task) => task.id === externalDraggingTaskId) ?? null;
  const dragPreviewDuration =
    draggingTask && draggingTaskPreview
      ? getCalendarTaskDragPreviewDuration(
          draggingTask,
          draggingTaskPreview.sourceTimeMinutes,
        )
      : null;
  const internalDragStillAtSource = shouldShowCalendarInternalDragSlotMarker(
    draggingTask,
    draggingTaskPreview,
  );
  function getAllDayRowHeightPx(days: Date[]) {
    return getCalendarAllDayRowHeightPx(
      Math.max(
        0,
        ...days.map((day) => {
          const dateKey = toDateKey(day);
          return tasksByDate.get(dateKey)?.allDay.length ?? 0;
        }),
      ),
    );
  }

  const calendarGridTaskPaddingStartPx =
    CALENDAR_TASK_HORIZONTAL_PADDING_START_PX +
    CALENDAR_TASK_GRID_EXTRA_PADDING_START_PX;

  return (
    <div
      className={CALENDAR_VIEW_WRAPPER_CLASS}
      data-calendar-grid-view="week"
      style={{
        ["--calendar-task-content-padding-start" as string]: `${calendarGridTaskPaddingStartPx}px`,
      }}
    >
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className={getCalendarViewSurfaceClassName(fullWidth)}>
          <div
            className={`flex shrink-0 items-center justify-start mb-[10px] ${
              fullWidth ? "pr-2 pl-0" : "pr-3"
            }`}
          >
            <CalendarPeriodNavigation
              onToday={goToToday}
              onPrevious={goToPreviousWeek}
              onNext={goToNextWeek}
              previousLabel="Previous week"
              nextLabel="Next week"
            />
          </div>
          <div
            ref={timeScrollRef}
            className={getCalendarTimedGridScrollClassName(fullWidth)}
          >
            <div className="w-full min-w-[753px]">
              {visibleWeeks.map((weekDays, weekIndex) => {
                const allDayRowHeightPx = getAllDayRowHeightPx(weekDays);
                const todayColumnIndex = weekDays.findIndex((day) =>
                  isSameDay(day, today),
                );
                const showThisWeekNowLine =
                  showWeekNowLine && todayColumnIndex >= 0;
                const weekNowLineDimmedColumns =
                  showThisWeekNowLine && nowLineTop !== null
                    ? buildCalendarNowLineDimmedColumns(
                        nowLineTop,
                        weekDays.map((day) => {
                          const dayDateKey = toDateKey(day);
                          return (tasksByDate.get(dayDateKey)?.timed ?? [])
                            .filter((task) => {
                              if (
                                draggingTaskPreview?.taskId === task.id &&
                                draggingTaskPreview?.sourceDateKey ===
                                  dayDateKey &&
                                draggingTaskPreview !== null &&
                                isCalendarTaskAtDragSource(
                                  task,
                                  draggingTaskPreview,
                                )
                              ) {
                                return false;
                              }
                              return true;
                            })
                            .map((task) => {
                              const timing = getTaskTiming(task, resizePreview);
                              return getCalendarTimedBlockBounds(
                                timing.dueTimeMinutes,
                                timing.dueDurationMinutes,
                                gridHourStart,
                                hourHeightPx,
                                effectiveGridTopOffset,
                              );
                            });
                        }),
                      )
                    : undefined;

                return (
                  <div
                    key={weekDays[0] ? toDateKey(weekDays[0]) : `week-${weekIndex}`}
                    className={
                      weekIndex > 0
                        ? "border-t border-zinc-200 dark:border-zinc-800"
                        : undefined
                    }
                  >
                    <div className={CALENDAR_WEEK_HEADER_STICKY_CLASS}>
                      <div
                        className="grid w-full bg-white dark:bg-zinc-950"
                        style={{
                          gridTemplateColumns: getCalendarTimedGridTemplateColumns(7),
                        }}
                      >
                        <div className="bg-white dark:bg-zinc-950" />
                        {weekDays.map((day, dayIndex) => {
                          const isToday = isSameDay(day, today);
                          const isSelectedDay = isSelectedWeekDay(day);
                          return (
                            <button
                              key={`head-${toDateKey(day)}`}
                              type="button"
                              onClick={() => handleDayHeaderSelect(day)}
                              className={`pt-1 pb-[5px] py-2 text-center transition-colors cursor-pointer ${getWeekDayColumnDividerClass(dayIndex, weekDays, isSelectedWeekDay)} ${
                                isSelectedDay
                                  ? `${SELECTED_WEEK_DAY_COLUMN_CLASS} rounded-t-[8px] ${SELECTED_WEEK_DAY_ROW_BORDER_CLASS}`
                                  : `${SELECTED_WEEK_DAY_ROW_BORDER_CLASS} bg-white dark:bg-zinc-950`
                              }`}
                            >
                              <div className="text-[14px] font-medium uppercase tracking-wide text-[#393939] dark:text-zinc-200">
                                {getCalendarWeekdayLabel(day)}
                              </div>
                              <div
                                className={`mt-px inline-flex size-7 items-center justify-center rounded-full text-sm ${
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
                      </div>
                    </div>
                    <div
                      className={CALENDAR_WEEK_ALLDAY_STICKY_CLASS}
                      style={{ top: CALENDAR_WEEK_HEADER_HEIGHT_PX }}
                    >
                      <div
                        className="grid w-full bg-white dark:bg-zinc-950"
                        style={{
                          gridTemplateColumns: getCalendarTimedGridTemplateColumns(7),
                        }}
                      >
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
                          const showAllDayInternalDropPreview =
                            shouldShowCalendarAllDayInternalDropPreview(
                              activeDropSlot,
                              dateKey,
                              draggingTask,
                              draggingTaskPreview,
                            );
                          const showAllDayExternalDropPreview =
                            shouldShowCalendarAllDayExternalDropPreview(
                              activeDropSlot,
                              dateKey,
                              externalDraggingTaskId,
                              draggingTaskPreview,
                            );
                          const isSelectedDay = isSelectedWeekDay(day);

                          return (
                            <div
                              key={`allday-${dateKey}`}
                              data-calendar-day={dateKey}
                              onClick={(event) => handleAllDayClick(event, day)}
                              className={calendarAllDayCellClassName(
                                `cursor-pointer transition-colors ${getWeekDayColumnDividerClass(dayIndex, weekDays, isSelectedWeekDay)} ${
                                  isSelectedDay
                                    ? `${SELECTED_WEEK_DAY_COLUMN_CLASS} ${SELECTED_WEEK_DAY_ROW_BORDER_CLASS}`
                                    : `${SELECTED_WEEK_DAY_ROW_BORDER_CLASS} bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/60`
                                }`,
                              )}
                              style={{ height: allDayRowHeightPx }}
                            >
                              {dayTasks.map((task) => {
                                const hideDuringDrag =
                                  shouldHideCalendarAllDayTaskDuringInternalDrag(
                                    task,
                                    dateKey,
                                    draggingTaskPreview,
                                    activeDropSlot,
                                  );
                                const showSourcePlaceholder =
                                  shouldShowCalendarAllDaySourcePlaceholderDuringInternalDrag(
                                    task,
                                    dateKey,
                                    draggingTaskPreview,
                                    activeDropSlot,
                                  );

                                if (hideDuringDrag && showSourcePlaceholder) {
                                  return (
                                    <CalendarAllDayTaskPreview
                                      key={getCalendarTaskKey(task)}
                                      variant="source"
                                      taskName={task.name}
                                      priority={task.priority}
                                      calendarColor={task.calendarColor}
                                      recurrenceRule={task.recurrenceRule}
                                    />
                                  );
                                }

                                if (hideDuringDrag) {
                                  return null;
                                }

                                return (
                                  <CalendarTaskHoverButton
                                    key={getCalendarTaskKey(task)}
                                    task={task}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCalendarTaskClick(event, task);
                                    }}
                                    onPointerDown={(event) => {
                                      event.stopPropagation();
                                      handleCalendarTaskPointerDown(
                                        event,
                                        task,
                                        day,
                                      );
                                    }}
                                    className={`${calendarAllDayTaskClassName(
                                      task.id === selectedTaskId,
                                      canDragTasks,
                                    )} calendar-task-row--single-line gap-1 overflow-hidden`}
                                    style={{
                                      ...getCalendarTaskItemStyle(
                                        task.priority,
                                        task.calendarColor,
                                        calendarTaskDefaultColor,
                                        {
                                          past:
                                            now !== null &&
                                            isCalendarTaskPast(day, now, task),
                                        },
                                      ),
                                      opacity: isTaskMaskedForDrop(task.id)
                                        ? 0
                                        : undefined,
                                    }}
                                  >
                                    <CalendarTaskTitle
                                      name={task.name}
                                      recurrenceRule={task.recurrenceRule}
                                      priority={task.priority}
                                    />
                                    <CalendarTaskCompletionCheckbox
                                      task={task}
                                      onToggleTask={onToggleTask}
                                      isCompleting={completingTaskIds?.has(
                                        task.id,
                                      )}
                                      isCheckAnimating={checkAnimatingTaskIds?.has(
                                        task.id,
                                      )}
                                      className="calendar-task-checkbox"
                                    />
                                  </CalendarTaskHoverButton>
                                );
                              })}
                              {showAllDayInternalDropPreview && draggingTask ? (
                                <CalendarAllDayTaskPreview
                                  taskName={draggingTask.name}
                                  priority={draggingTask.priority}
                                  calendarColor={draggingTask.calendarColor}
                                  recurrenceRule={draggingTask.recurrenceRule}
                                />
                              ) : null}
                              {showAllDayExternalDropPreview &&
                              externalDraggingTaskName ? (
                                <CalendarAllDayTaskPreview
                                  taskName={externalDraggingTaskName}
                                  priority={externalDraggingTask?.priority}
                                  calendarColor={
                                    externalDraggingTask?.calendarColor
                                  }
                                  recurrenceRule={
                                    externalDraggingTask?.recurrenceRule
                                  }
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                <div
                  className="relative grid w-full"
                  style={{
                    gridTemplateColumns: getCalendarTimedGridTemplateColumns(7),
                  }}
                  data-calendar-today-timed-grid={
                    weekDays.some((day) => isSameDay(day, today)) ? "true" : undefined
                  }
                >
                  <div
                    ref={weekIndex === 0 ? hourColumnRef : undefined}
                    className={`relative ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`}
                  >
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className={calendarHourLabelCellClassName()}
                        style={{ height: hourHeightPx }}
                      >
                        {shouldShowCalendarHourLabel(hour) ? (
                          <div className={calendarHourLabelClassName()}>
                            {formatCalendarHourLabel(hour)}
                          </div>
                        ) : null}
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
              const externalDropSlotMinutes = isTimedDropTarget
                ? (activeDropSlot?.dueTimeMinutes ?? null)
                : null;
              const selectedSlotMinutes = externalDropSlotMinutes;
              const showDragSlotMarker =
                resizingTaskId === null &&
                resizePreview === null &&
                isTimedDropTarget &&
                externalDropSlotMinutes !== null &&
                internalDragStillAtSource;
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
                showDragSlotMarker;
              const isSelectedDay = isSelectedWeekDay(day);

              return (
                <div
                  key={`time-${dateKey}`}
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
                      draggingTaskPreview !== null &&
                      isCalendarTaskAtDragSource(task, draggingTaskPreview);
                    const sourcePlaceholderTop =
                      draggingTaskPreview?.sourceTimeMinutes == null
                        ? baseTop
                        : getTopForCalendarMinutes(
                            draggingTaskPreview.sourceTimeMinutes,
                            gridHourStart,
                            hourHeightPx,
                            effectiveGridTopOffset,
                          );
                    const sourcePlaceholderDuration =
                      draggingTaskPreview?.sourceTimeMinutes == null
                        ? timing.dueDurationMinutes
                        : getCalendarTaskDragPreviewDuration(
                            task,
                            draggingTaskPreview.sourceTimeMinutes,
                          );
                    const sourcePlaceholder =
                      hideDraggedBlock && isSourceColumn ? (
                        <CalendarTaskDragSourcePlaceholder
                          top={sourcePlaceholderTop}
                          height={Math.max(
                            24,
                            (sourcePlaceholderDuration / 60) * hourHeightPx,
                          )}
                          taskName={task.name}
                          startMinutes={
                            draggingTaskPreview?.sourceTimeMinutes ??
                            timing.dueTimeMinutes
                          }
                          durationMinutes={sourcePlaceholderDuration}
                          priority={task.priority}
                          calendarColor={task.calendarColor}
                          completed={task.completed}
                          taskId={task.id}
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
                          onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
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
                          isMaskedForDrop={isTaskMaskedForDrop(task.id)}
                          isPast={
                            now !== null &&
                            isCalendarTaskPast(day, now, {
                              dueTimeMinutes: timing.dueTimeMinutes,
                              dueDurationMinutes: timing.dueDurationMinutes,
                            })
                          }
                          onDropped={markTaskJustDropped}
                          onDragStart={() => {
                            closeTaskModal();
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
                      dragPreviewDuration !== null ? (
                        <CalendarTaskDropPreview
                          top={selectedSlotTop}
                          height={getCalendarTaskPreviewHeight(
                            dragPreviewDuration,
                            hourHeightPx,
                          )}
                          taskName={draggingTask.name}
                          startMinutes={selectedSlotMinutes}
                          durationMinutes={dragPreviewDuration}
                          priority={draggingTask.priority}
                          calendarColor={draggingTask.calendarColor}
                          completed={draggingTask.completed}
                          taskId={draggingTask.id}
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
                          priority={externalDraggingTask?.priority ?? null}
                          calendarColor={externalDraggingTask?.calendarColor ?? null}
                          completed={externalDraggingTask?.completed ?? false}
                          taskId={externalDraggingTaskId}
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
                dimmedColumns={weekNowLineDimmedColumns}
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
  );
}
