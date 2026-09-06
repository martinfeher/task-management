"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import { CalendarTaskTitle } from "./calendar-task-title";
import { CalendarCurrentTimeLine } from "./calendar-current-time-line";
import { CalendarNewTaskSlotPreview } from "./calendar-new-task-slot-preview";
import { CalendarPeriodNavigation } from "./calendar-period-navigation";
import { formatDayMonthYear } from "./calendar-mini-month";
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
  getCalendarTaskKey,
} from "@/lib/calendar-recurring-tasks";
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
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  CALENDAR_TIME_SLOT_MINUTES,
  getCalendarTimedGridHeightPx,
  getCalendarTimedGridScrollTop,
  getCalendarTaskPreviewHeight,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
  isCalendarSlotWithinTimedGrid,
  type CalendarDropSlot,
} from "@/lib/calendar-time-grid";
import {
  bindCalendarTaskDrag,
  getActiveCalendarDropSlot,
  CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
  getCalendarTaskDragPreviewDuration,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import {
  calendarAllDayCellClassName,
  calendarAllDayDraftClassName,
  calendarAllDayLabelCellClassName,
  calendarAllDayTaskClassName,
  getCalendarTaskItemStyle,
  CALENDAR_VIEW_SURFACE_CLASS,
  CALENDAR_VIEW_WRAPPER_CLASS,
  getCalendarAllDayRowHeightPx,
  getCalendarShellClassName,
  formatCalendarHourLabel,
  calendarHourLabelCellClassName,
  calendarHourLabelClassName,
  shouldShowCalendarHourLabel,
  getCalendarSingleDayGridTemplateColumns,
  CALENDAR_TIMED_GRID_SCROLL_CLASS,
} from "@/lib/calendar-layout";
import type { CalendarSidebarSyncProps } from "./calendar-view-sidebar-layout";

const HOUR_START = CALENDAR_HOUR_START;
const HOUR_END = CALENDAR_HOUR_END;
const HOUR_HEIGHT_PX = Math.round(52 * 1.2);
const GRID_TOP_OFFSET_PX = 0;

export type CalendarDayNavigation = {
  goToToday: () => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
};

type CalendarDayViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
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
  externalDropTargetDateKey?: string | null;
  externalDropTargetTimeMinutes?: number | null;
  externalDraggingTaskId?: string | null;
  externalDraggingTaskName?: string | null;
  onPeriodLabelChange?: (label: string) => void;
} & CalendarSidebarSyncProps;

function formatWeekdayLong(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
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

export function CalendarDayView({
  tasks,
  lists,
  completingTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
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
  externalDropTargetDateKey = null,
  externalDropTargetTimeMinutes = null,
  externalDraggingTaskId = null,
  externalDraggingTaskName = null,
  onPeriodLabelChange,
  sidebarFocusDate,
  sidebarJumpRequestId,
  onSidebarFocusDateChange,
}: CalendarDayViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const lastSidebarJumpRequestIdRef = useRef(0);
  const lastSyncedSidebarDateKeyRef = useRef<string | null>(null);
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
  const timeScrollRef = useRef<HTMLDivElement>(null);
  const newTaskPreviewRef = useRef<HTMLDivElement>(null);
  const {
    startDragPreview,
    updateDragPreview,
    endDragPreview,
  } = useCalendarTaskDragPreview();
  const canDragTasks = Boolean(onSetTaskDueDate || onSetTaskDueTime);

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setSelectedDay(current);
    setNow(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = useMemo(
    () =>
      Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, index) => HOUR_START + index,
      ),
    [],
  );

  const dayTasks = useMemo(() => {
    if (!selectedDay) return { allDay: [], timed: [] };

    const key = toDateKey(selectedDay);
    const map = buildTimedTasksByDateForRange(tasks, {
      start: selectedDay,
      end: selectedDay,
    });

    return map.get(key) ?? { allDay: [], timed: [] };
  }, [tasks, selectedDay]);

  const modalTaskSnapshot = useMemo(
    () => (modalTaskId ? getCalendarTaskSnapshot(modalTaskId, tasks) : null),
    [modalTaskId, tasks],
  );

  const currentTimeTop =
    now === null
      ? null
      : (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT_PX;

  const goToPreviousDay = useCallback(() => {
    setSelectedDay((current) => {
      if (!current) return current;
      return startOfDay(
        new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() - 1,
        ),
      );
    });
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDay((current) => {
      if (!current) return current;
      return startOfDay(
        new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() + 1,
        ),
      );
    });
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDay(startOfDay(new Date()));
  }, []);

  useEffect(() => {
    if (!selectedDay) return;
    onPeriodLabelChange?.(formatDayMonthYear(selectedDay));
  }, [onPeriodLabelChange, selectedDay]);

  useEffect(() => {
    if (!selectedDay || !onSidebarFocusDateChange) return;

    const dateKey = toDateKey(selectedDay);
    if (lastSyncedSidebarDateKeyRef.current === dateKey) return;

    lastSyncedSidebarDateKeyRef.current = dateKey;
    onSidebarFocusDateChange(selectedDay);
  }, [onSidebarFocusDateChange, selectedDay]);

  useEffect(() => {
    if (
      sidebarJumpRequestId === undefined ||
      sidebarFocusDate === undefined ||
      sidebarJumpRequestId === lastSidebarJumpRequestIdRef.current
    ) {
      return;
    }

    lastSidebarJumpRequestIdRef.current = sidebarJumpRequestId;
    setSelectedDay(startOfDay(sidebarFocusDate));
  }, [sidebarFocusDate, sidebarJumpRequestId]);

  useEffect(() => {
    if (!selectedDay) return;
    setModalTaskId(null);
    closeAddTaskPopover();
  }, [selectedDay]);

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleAllDayClick(event: React.MouseEvent<HTMLElement>) {
    if (!selectedDay) return;

    setModalTaskId(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    setDraftTaskName("");
    setAddTaskPopover({
      date: selectedDay,
      x: event.clientX,
      y: event.clientY,
      dueTimeMinutes: null,
    });
  }

  function handleTimeGridClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedDay) return;

    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

    event.stopPropagation();
    setModalTaskId(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const dueTimeMinutes = getMinutesFromCalendarGridY(
      y,
      HOUR_START,
      HOUR_HEIGHT_PX,
      CALENDAR_TIME_SLOT_MINUTES,
      GRID_TOP_OFFSET_PX,
    );
    const top = getTopForCalendarMinutes(
      dueTimeMinutes,
      HOUR_START,
      HOUR_HEIGHT_PX,
      GRID_TOP_OFFSET_PX,
    );

    if (top < GRID_TOP_OFFSET_PX || top > GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX) {
      return;
    }

    setDraftTaskName("");
    setAddTaskPopover({
      date: selectedDay,
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
      hourStart: HOUR_START,
      hourHeightPx: HOUR_HEIGHT_PX,
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

  const firstTimedTaskTopPx = useMemo(() => {
    if (!selectedDay || dayTasks.timed.length === 0) return null;

    const timing = getTaskTiming(dayTasks.timed[0], null);
    return getTopForCalendarMinutes(
      timing.dueTimeMinutes,
      HOUR_START,
      HOUR_HEIGHT_PX,
      GRID_TOP_OFFSET_PX,
    );
  }, [dayTasks.timed, selectedDay]);

  useLayoutEffect(() => {
    const scrollEl = timeScrollRef.current;
    if (!scrollEl || !selectedDay || !today || !now) return;

    const isSelectedToday = isSameDay(selectedDay, today);
    const currentTimeTop =
      (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT_PX;
    const gridHeightPx = getCalendarTimedGridHeightPx(
      hours.length,
      HOUR_HEIGHT_PX,
      GRID_TOP_OFFSET_PX,
    );
    const targetScrollTop = getCalendarTimedGridScrollTop({
      scrollContainerHeightPx: scrollEl.clientHeight,
      gridHeightPx,
      firstTaskTopPx: firstTimedTaskTopPx,
      currentTimeTopPx: currentTimeTop,
      preferCurrentTime: isSelectedToday,
    });
    const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);

    scrollEl.scrollTop = Math.min(targetScrollTop, maxScrollTop);
  }, [firstTimedTaskTopPx, hours.length, now, selectedDay, today]);

  if (!selectedDay || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  const dateKey = toDateKey(selectedDay);
  const isToday = isSameDay(selectedDay, today);
  const externalDraggingTask =
    externalDraggingTaskId === null
      ? null
      : tasks.find((task) => task.id === externalDraggingTaskId) ?? null;
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
  const isActiveDay =
    addTaskPopover !== null && isSameDay(selectedDay, addTaskPopover.date);
  const activeDropSlot = getActiveCalendarDropSlot(
    dropTargetSlot,
    externalDropTargetDateKey,
    externalDropTargetTimeMinutes,
  );
  const isAllDayDropTarget =
    activeDropSlot?.dateKey === dateKey &&
    activeDropSlot.dueTimeMinutes === null;
  const isTimedDropTarget =
    activeDropSlot?.dateKey === dateKey &&
    isCalendarSlotWithinTimedGrid(
      activeDropSlot.dueTimeMinutes,
      HOUR_START,
      HOUR_HEIGHT_PX,
      hours.length,
      GRID_TOP_OFFSET_PX,
    );
  const externalDropSlotMinutes = isTimedDropTarget
    ? (activeDropSlot?.dueTimeMinutes ?? null)
    : null;
  const selectedSlotMinutes =
    addTaskPopover?.dueTimeMinutes ??
    externalDropSlotMinutes ??
    null;
  const selectedSlotTop =
    selectedSlotMinutes === null
      ? null
      : getTopForCalendarMinutes(
          selectedSlotMinutes,
          HOUR_START,
          HOUR_HEIGHT_PX,
          GRID_TOP_OFFSET_PX,
        );
  const showDragSlotMarker =
    resizingTaskId === null &&
    resizePreview === null &&
    isTimedDropTarget &&
    !isActiveDay &&
    externalDropSlotMinutes !== null;
  const showSelectedSlotMarker =
    resizingTaskId === null &&
    selectedSlotTop !== null &&
    selectedSlotTop >= GRID_TOP_OFFSET_PX &&
    selectedSlotTop <= GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX &&
    ((isActiveDay && addTaskPopover?.dueTimeMinutes !== null) ||
      showDragSlotMarker);
  const showNowLine =
    isToday &&
    currentTimeTop !== null &&
    currentTimeTop >= 0 &&
    currentTimeTop <= hours.length * HOUR_HEIGHT_PX;
  const timedGridMinMinutes = getMinutesFromCalendarGridY(
    GRID_TOP_OFFSET_PX,
    HOUR_START,
    HOUR_HEIGHT_PX,
    CALENDAR_TIME_SLOT_MINUTES,
    GRID_TOP_OFFSET_PX,
  );
  const timedGridMaxMinutes = getMinutesFromCalendarGridY(
    GRID_TOP_OFFSET_PX + hours.length * HOUR_HEIGHT_PX,
    HOUR_START,
    HOUR_HEIGHT_PX,
    CALENDAR_TIME_SLOT_MINUTES,
    GRID_TOP_OFFSET_PX,
  );
  const allDayStackCount =
    dayTasks.allDay.length +
    (isActiveDay && addTaskPopover?.dueTimeMinutes === null ? 1 : 0);
  const allDayRowHeightPx = getCalendarAllDayRowHeightPx(allDayStackCount);

  return (
    <div className={CALENDAR_VIEW_WRAPPER_CLASS}>
      <div className={getCalendarShellClassName()}>
        <div className={CALENDAR_VIEW_SURFACE_CLASS}>
          <div className="relative z-20 flex shrink-0 items-center justify-start overflow-visible px-3 pt-1 pb-2">
            <CalendarPeriodNavigation
              centerLabel={formatWeekdayLong(selectedDay)}
              isViewingToday={isToday}
              onToday={goToToday}
              onPrevious={goToPreviousDay}
              onNext={goToNextDay}
              previousLabel="Previous day"
              nextLabel="Next day"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="grid w-full shrink-0"
          style={{ gridTemplateColumns: getCalendarSingleDayGridTemplateColumns() }}
        >
          <div
            className={calendarAllDayLabelCellClassName(
              "shrink-0 bg-white dark:bg-zinc-950 pr-0",
            )}
            style={{ height: allDayRowHeightPx }}
          >
            All day
          </div>
          <div
            data-calendar-day={dateKey}
            onClick={handleAllDayClick}
            className={calendarAllDayCellClassName(
              `shrink-0 cursor-pointer border-b border-zinc-200 bg-white transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900/60 ${
                isActiveDay && addTaskPopover?.dueTimeMinutes === null
                  ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30"
                  : isAllDayDropTarget
                    ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30"
                    : ""
              }`,
            )}
            style={{ height: allDayRowHeightPx }}
          >
            {dayTasks.allDay.map((task) => (
              <CalendarTaskHoverButton
                key={getCalendarTaskKey(task)}
                task={task}
                onClick={(event) => {
                  event.stopPropagation();
                  handleCalendarTaskClick(event, task);
                }}
                onPointerDown={(event) => {
                  handleCalendarTaskPointerDown(event, task, selectedDay);
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
            {isActiveDay && addTaskPopover?.dueTimeMinutes === null ? (
              <div aria-hidden="true" className={calendarAllDayDraftClassName()}>
                {draftTaskName.trim() || ""}
              </div>
            ) : null}
          </div>
        </div>

        <div ref={timeScrollRef} className={CALENDAR_TIMED_GRID_SCROLL_CLASS}>

          <div
            className="relative grid w-full min-w-[420px]"
            style={{ gridTemplateColumns: getCalendarSingleDayGridTemplateColumns() }}
          >
            <div className="relative">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={calendarHourLabelCellClassName()}
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  {shouldShowCalendarHourLabel(hour) ? (
                    <div className={calendarHourLabelClassName()}>
                      {formatCalendarHourLabel(hour)}
                    </div>
                  ) : null}
                </div>
              ))}

            </div>

            <div
              ref={timeGridRef}
              data-calendar-day={dateKey}
              data-calendar-time-grid="true"
              data-hour-start={HOUR_START}
              data-hour-height={HOUR_HEIGHT_PX}
              data-grid-top-offset={GRID_TOP_OFFSET_PX}
              className="relative"
              onClick={handleTimeGridClick}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                  style={{ height: HOUR_HEIGHT_PX }}
                />
              ))}

              {dayTasks.timed.map((task) => {
                const timing = getTaskTiming(task, resizePreview);
                const baseTop = getTopForCalendarMinutes(
                  timing.dueTimeMinutes,
                  HOUR_START,
                  HOUR_HEIGHT_PX,
                  GRID_TOP_OFFSET_PX,
                );
                const isDraggingTask = draggingTaskPreview?.taskId === task.id;
                const height = Math.max(
                  24,
                  (timing.dueDurationMinutes / 60) * HOUR_HEIGHT_PX,
                );

                if (isDraggingTask) {
                  return (
                    <Fragment key={getCalendarTaskKey(task)}>
                      <CalendarTaskDragSourcePlaceholder
                        top={baseTop}
                        height={height}
                        taskName={task.name}
                        startMinutes={timing.dueTimeMinutes}
                        durationMinutes={timing.dueDurationMinutes}
                        priority={task.priority}
                        calendarColor={task.calendarColor}
                      />
                    </Fragment>
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
                    <CalendarTimedTaskBlock
                      task={task}
                      day={selectedDay}
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
                  {isActiveDay && addTaskPopover?.dueTimeMinutes !== null ? (
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
                  ) : showDragSlotMarker &&
                    draggingTask &&
                    dragPreviewDuration !== null ? (
                    <CalendarTaskDropPreview
                      top={selectedSlotTop}
                      height={getCalendarTaskPreviewHeight(
                        dragPreviewDuration,
                        HOUR_HEIGHT_PX,
                      )}
                      taskName={draggingTask.name}
                      startMinutes={selectedSlotMinutes}
                      durationMinutes={dragPreviewDuration}
                      priority={draggingTask.priority}
                      calendarColor={draggingTask.calendarColor}
                    />
                  ) : showDragSlotMarker &&
                    externalDraggingTaskId &&
                    externalDraggingTaskName ? (
                    <CalendarTaskDropPreview
                      top={selectedSlotTop}
                      height={getCalendarTaskPreviewHeight(
                        CALENDAR_ALL_DAY_TO_TIMED_DEFAULT_DURATION_MINUTES,
                        HOUR_HEIGHT_PX,
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

            {showNowLine ? (
              <CalendarCurrentTimeLine
                now={now}
                top={currentTimeTop ?? 0}
                className="absolute inset-x-0 z-20"
              />
            ) : null}
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
