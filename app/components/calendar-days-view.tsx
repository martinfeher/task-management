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
  calendarAllDayLabelCellClassName,
  calendarAllDayCellClassName,
  calendarAllDayTaskClassName,
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
  getCalendarTaskItemStyle,
  isCalendarTaskPast,
  getCalendarWeekdayLabel,
  CALENDAR_TODAY_DATE_CIRCLE_CLASS,
  CALENDAR_HOUR_COLUMN_WIDTH_PX,
  getCalendarTimedGridTemplateColumns,
  CALENDAR_DAYS_HEADER_HEIGHT_PX,
  CALENDAR_DAYS_HEADER_STICKY_CLASS,
  CALENDAR_DAYS_ALLDAY_STICKY_CLASS,
} from "@/lib/calendar-layout";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import { useRecordCalendarTaskMove } from "./calendar-task-move-undo";
import {
  bindCalendarTaskDrag,
  CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
  getActiveCalendarDropSlot,
  getCalendarTaskDragPreviewDuration,
  isCalendarTaskAtDragSource,
  shouldShowCalendarInternalDragSlotMarker,
  useCalendarTaskDropRevealMask,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
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
  useCalendarDaysQuarterHourGridLines,
  useCalendarViewportHourHeight,
} from "@/lib/use-calendar-viewport-hour-height";
import { useCalendarTimedGridScrollSession } from "@/lib/use-calendar-timed-grid-scroll-session";
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
import { useCalendarTaskColorMenuCaptureHandler } from "./calendar-task-color-menu";
import {
  buildCalendarNowLineDimmedColumns,
  getCalendarTimedBlockBounds,
} from "@/lib/calendar-now-line-overlap";

const GRID_HOUR_START = CALENDAR_COLLAPSE_EARLY_END_HOUR;
const GRID_TOP_OFFSET_PX = 0;
const SELECTED_DAY_COLUMN_CLASS = "bg-[#f6f6f9]";
const SELECTED_DAY_ROW_BORDER_CLASS =
  "border-b border-zinc-200 dark:border-zinc-800";

function getSelectedDayColumnDividerClass(
  dayIndex: number,
  days: Date[],
  isSelectedDay: (day: Date) => boolean,
) {
  if (dayIndex >= days.length - 1) return "";

  if (isSelectedDay(days[dayIndex]) || isSelectedDay(days[dayIndex + 1])) {
    return "";
  }

  return getCalendarDayColumnDividerClass(dayIndex, days.length);
}
type CalendarMultiDayViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  dayCount: number;
  onSelectTask: (taskId: string) => void;
  onCloseTaskEditor?: () => void;
  onToggleTask: (taskId: string) => void;
  completingTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
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
  embeddedInCalendarModal?: boolean;
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
  externalDropTargetTimeMinutes?: number | null;
  externalDraggingTaskId?: string | null;
  externalDraggingTaskName?: string | null;
  onPeriodLabelChange?: (label: string) => void;
  visibleRangeStart?: Date | null;
  onVisibleRangeStartChange?: (date: Date) => void;
} & CalendarSidebarSyncProps;

function isSlotWithinTimedGrid(
  dueTimeMinutes: number | null,
  hourCount: number,
  hourHeightPx: number,
  hourStart: number,
) {
  if (dueTimeMinutes === null) return false;

  const top = getTopForCalendarMinutes(
    dueTimeMinutes,
    hourStart,
    hourHeightPx,
    GRID_TOP_OFFSET_PX,
  );
  return (
    top >= GRID_TOP_OFFSET_PX &&
    top <= GRID_TOP_OFFSET_PX + hourCount * hourHeightPx
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


export function CalendarMultiDayView({
  tasks,
  lists,
  selectedTaskId,
  dayCount,
  onSelectTask,
  onCloseTaskEditor,
  onToggleTask,
  completingTaskIds,
  checkAnimatingTaskIds,
  onSetTaskDueDateAndTime,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onStartCalendarTask,
  defaultListId = null,
  embeddedInCalendarModal = false,
  fullWidth = false,
  externalDropTargetDateKey = null,
  externalDropTargetTimeMinutes = null,
  externalDraggingTaskId = null,
  externalDraggingTaskName = null,
  onPeriodLabelChange,
  visibleRangeStart: controlledVisibleRangeStart,
  onVisibleRangeStartChange,
  sidebarFocusDate,
  sidebarJumpRequestId,
  onSidebarFocusDateChange,
}: CalendarMultiDayViewProps) {
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();
  const [today, setToday] = useState<Date | null>(null);
  const [internalRangeStart, setInternalRangeStart] = useState<Date | null>(
    null,
  );
  const [now, setNow] = useState<Date | null>(null);
  const lastSidebarJumpRequestIdRef = useRef(0);
  const isRangeControlled = controlledVisibleRangeStart !== undefined;
  const rangeStart = isRangeControlled
    ? controlledVisibleRangeStart
    : internalRangeStart;

  const setVisibleRangeStart = useCallback(
    (date: Date) => {
      const normalized = startOfDay(date);
      onVisibleRangeStartChange?.(normalized);
      if (!isRangeControlled) {
        setInternalRangeStart(normalized);
      }
    },
    [isRangeControlled, onVisibleRangeStartChange],
  );
  function closeTaskModal() {
    onCloseTaskEditor?.();
  }
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
  const {
    startDragPreview,
    updateDragPreview,
    endDragPreview,
  } = useCalendarTaskDragPreview();
  const recordCalendarTaskMove = useRecordCalendarTaskMove();
  const handleCalendarTaskContextMenuCapture =
    useCalendarTaskColorMenuCaptureHandler(tasks);
  const canDragTasks = Boolean(onSetTaskDueDate || onSetTaskDueTime);
  const hourColumnRef = useRef<HTMLDivElement>(null);
  const timeScrollRef = useRef<HTMLDivElement>(null);
  const isTimedGridReady = Boolean(rangeStart && today && now);
  const hourHeightPx = useCalendarViewportHourHeight(
    timeScrollRef,
    hourColumnRef,
    isTimedGridReady,
  );
  useCalendarTimedGridScrollSession(timeScrollRef, "days", isTimedGridReady);
  const showQuarterHourGridLines = useCalendarDaysQuarterHourGridLines();
  const [nowLineTop, setNowLineTop] = useState<number | null>(null);

  function getMinutesFromGridY(y: number) {
    return getMinutesFromCalendarGridY(
      y,
      GRID_HOUR_START,
      hourHeightPx,
      CALENDAR_TIME_SLOT_MINUTES,
      GRID_TOP_OFFSET_PX,
    );
  }

  function getTopForMinutes(minutes: number) {
    return getTopForCalendarMinutes(
      minutes,
      GRID_HOUR_START,
      hourHeightPx,
      GRID_TOP_OFFSET_PX,
    );
  }

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setNow(new Date());
    if (!isRangeControlled && internalRangeStart === null) {
      setInternalRangeStart(current);
    }
  }, [internalRangeStart, isRangeControlled]);

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
    setVisibleRangeStart(startOfDay(sidebarFocusDate));
  }, [sidebarFocusDate, sidebarJumpRequestId, setVisibleRangeStart]);

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
      : (now.getHours() + now.getMinutes() / 60 - GRID_HOUR_START) * hourHeightPx;

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
    currentTimeTop <= hours.length * hourHeightPx;

  const gridTemplateColumns = getCalendarTimedGridTemplateColumns(dayCount);
  const minGridWidth = CALENDAR_HOUR_COLUMN_WIDTH_PX + dayCount * 120;

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
    setVisibleRangeStart(nextRangeStart);
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
    setVisibleRangeStart(nextRangeStart);
    syncSidebarFocusToVisibleRange(nextRangeStart);
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setVisibleRangeStart(current);
    onSidebarFocusDateChange?.(current);
  }

  function handleDaySelect(day: Date) {
    onSidebarFocusDateChange?.(startOfDay(day));
  }

  function isSelectedDay(day: Date) {
    return sidebarFocusDate !== undefined && isSameDay(day, sidebarFocusDate);
  }

  function handleAllDayClick(
    _event: React.MouseEvent<HTMLElement>,
    day: Date,
  ) {
    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

    handleDaySelect(day);
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
    handleDaySelect(day);
    closeTaskModal();

    if (!onStartCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const dueTimeMinutes = getMinutesFromGridY(y);
    const top = getTopForMinutes(dueTimeMinutes);

    if (
      top < GRID_TOP_OFFSET_PX ||
      top > GRID_TOP_OFFSET_PX + hours.length * hourHeightPx
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
      hourStart: GRID_HOUR_START,
      hourHeightPx,
      onSetTaskDueDate,
      onSetTaskDueTime,
      onSetTaskDueDateAndTime,
      dragStateRef,
      suppressTaskClickRef,
      setDropTargetSlot: handleSetDropTargetSlot,
      resizingTaskIdRef,
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
    if (!rangeStart) return;
    closeTaskModal();
  }, [rangeStart, dayCount]);

  useLayoutEffect(() => {
    if (!showGlobalNowLine || currentTimeTop === null) {
      setNowLineTop(null);
      return;
    }

    setNowLineTop(GRID_TOP_OFFSET_PX + currentTimeTop);
  }, [showGlobalNowLine, currentTimeTop]);

  const nowLineDimmedColumns = useMemo(() => {
    const blocksPerColumn = visibleDays.map((day) => {
      const dateKey = toDateKey(day);
      return (tasksByDate.get(dateKey)?.timed ?? [])
        .filter((task) => {
          if (
            draggingTaskPreview?.taskId === task.id &&
            draggingTaskPreview?.sourceDateKey === dateKey &&
            draggingTaskPreview !== null &&
            isCalendarTaskAtDragSource(task, draggingTaskPreview)
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
            GRID_HOUR_START,
            hourHeightPx,
            GRID_TOP_OFFSET_PX,
          );
        });
    });

    return buildCalendarNowLineDimmedColumns(nowLineTop, blocksPerColumn);
  }, [
    visibleDays,
    tasksByDate,
    nowLineTop,
    draggingTaskPreview,
    resizePreview,
    hourHeightPx,
  ]);

  if (!rangeStart || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  const allDayRowHeightPx = getCalendarAllDayRowHeightPx(
    Math.max(
      0,
      ...visibleDays.map((day) => {
        const dateKey = toDateKey(day);
        return tasksByDate.get(dateKey)?.allDay.length ?? 0;
      }),
    ),
  );
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

  return (
    <div
      className={CALENDAR_VIEW_WRAPPER_CLASS}
      onContextMenuCapture={handleCalendarTaskContextMenuCapture}
    >
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className={getCalendarViewSurfaceClassName(fullWidth)}>
          <div
            className={
              embeddedInCalendarModal
                ? "relative z-20 flex shrink-0 items-center justify-start overflow-visible pl-1 pr-3 pt-1 pb-2"
                : `flex shrink-0 items-center justify-start mb-[10px] ${
                    fullWidth ? "px-2" : "pr-3 pl-1"
                  }`
            }
          >
            <CalendarPeriodNavigation
              onToday={goToToday}
              onPrevious={goToPreviousRange}
              onNext={goToNextRange}
              enableArrowKeyNavigation
              previousLabel="Previous day"
              nextLabel="Next day"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={timeScrollRef}
            className={getCalendarTimedGridScrollClassName(fullWidth)}
          >
            <div className="w-full" style={{ minWidth: minGridWidth }}>
              <div className={CALENDAR_DAYS_HEADER_STICKY_CLASS}>
                <div
                  className="grid w-full bg-white dark:bg-zinc-950"
                  style={{ gridTemplateColumns, minWidth: minGridWidth }}
                >
                  <div className="bg-white dark:bg-zinc-950" />
                  {visibleDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, today);
                    const isDaySelected = isSelectedDay(day);

                    return (
                      <button
                        key={`head-${toDateKey(day)}`}
                        type="button"
                        onClick={() => handleDaySelect(day)}
                        className={`pt-1 pb-[5px] py-2 text-center transition-colors cursor-pointer ${getSelectedDayColumnDividerClass(dayIndex, visibleDays, isSelectedDay)} ${
                          isDaySelected
                            ? `${SELECTED_DAY_COLUMN_CLASS} rounded-t-[8px] ${SELECTED_DAY_ROW_BORDER_CLASS}`
                            : `${SELECTED_DAY_ROW_BORDER_CLASS} bg-white dark:bg-zinc-950`
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
                className={CALENDAR_DAYS_ALLDAY_STICKY_CLASS}
                style={{ top: CALENDAR_DAYS_HEADER_HEIGHT_PX }}
              >
                <div
                  className="grid w-full"
                  style={{ gridTemplateColumns, minWidth: minGridWidth }}
                >
                  <div
                    className={calendarAllDayLabelCellClassName(
                      `bg-white dark:bg-zinc-950 ${CALENDAR_HOUR_COLUMN_DIVIDER_CLASS}`,
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
                      externalDropTargetTimeMinutes,
                    );
                    const isDropTarget =
                      activeDropSlot?.dateKey === dateKey &&
                      activeDropSlot.dueTimeMinutes === null;
                    const isDaySelected = isSelectedDay(day);

                    return (
                      <div
                        key={`allday-${dateKey}`}
                        data-calendar-day={dateKey}
                        onClick={(event) => handleAllDayClick(event, day)}
                        className={`${calendarAllDayCellClassName(
                          `cursor-pointer transition-colors ${getSelectedDayColumnDividerClass(dayIndex, visibleDays, isSelectedDay)} ${
                          isDropTarget
                            ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30"
                            : isDaySelected
                                ? `${SELECTED_DAY_COLUMN_CLASS} ${SELECTED_DAY_ROW_BORDER_CLASS}`
                                : `${SELECTED_DAY_ROW_BORDER_CLASS} bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/60`
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
                                opacity: isTaskMaskedForDrop(task.id) ? 0 : undefined,
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
                                isCompleting={completingTaskIds?.has(task.id)}
                                isCheckAnimating={checkAnimatingTaskIds?.has(task.id)}
                                className="calendar-task-checkbox"
                              />
                            </CalendarTaskHoverButton>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div
                className="relative grid w-full"
                style={{ gridTemplateColumns, minWidth: minGridWidth }}
              >
            <div
              ref={hourColumnRef}
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

            {visibleDays.map((day, dayIndex) => {
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
                  GRID_HOUR_START,
                );
              const isDaySelected = isSelectedDay(day);
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
                  : getTopForMinutes(selectedSlotMinutes);
              const showSelectedSlotMarker =
                resizingTaskId === null &&
                selectedSlotTop !== null &&
                selectedSlotTop >= GRID_TOP_OFFSET_PX &&
                selectedSlotTop <=
                  GRID_TOP_OFFSET_PX + hours.length * hourHeightPx &&
                showDragSlotMarker;

              return (
                <div
                  key={`time-${dateKey}`}
                  data-calendar-day={dateKey}
                  data-calendar-time-grid="true"
                  data-hour-start={GRID_HOUR_START}
                  data-hour-height={hourHeightPx}
                  data-grid-top-offset={GRID_TOP_OFFSET_PX}
                  className={`relative ${getSelectedDayColumnDividerClass(dayIndex, visibleDays, isSelectedDay)} ${
                    isTimedDropTarget
                      ? "bg-blue-50/40 dark:bg-blue-950/20"
                      : isDaySelected
                        ? SELECTED_DAY_COLUMN_CLASS
                        : ""
                  }`}
                  onClick={(event) => handleTimeGridClick(event, day)}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="relative cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                      style={{ height: hourHeightPx }}
                    >
                      {showQuarterHourGridLines ? (
                        <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      ) : null}
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      {showQuarterHourGridLines ? (
                        <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      ) : null}
                    </div>
                  ))}

                  {timedTasks.map((task) => {
                    const timing = getTaskTiming(task, resizePreview);
                    const baseTop = getTopForMinutes(timing.dueTimeMinutes);
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
                        : getTopForMinutes(
                            draggingTaskPreview.sourceTimeMinutes,
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
                      hourStart: GRID_HOUR_START,
                      hourHeightPx: hourHeightPx,
                      gridTopOffsetPx: GRID_TOP_OFFSET_PX,
                    });

                    if (
                      top < GRID_TOP_OFFSET_PX ||
                      top > GRID_TOP_OFFSET_PX + hours.length * hourHeightPx
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
                          hourStart={GRID_HOUR_START}
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
                dimmedColumns={nowLineDimmedColumns}
              />
            ) : null}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
