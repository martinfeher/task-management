"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import {
  CalendarTaskModal,
  getCalendarTaskSnapshot,
  type CalendarTaskEditorCallbacks,
} from "./calendar-task-modal";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import { getCalendarShellClassName } from "@/lib/calendar-layout";
import type { CalendarSidebarSyncProps } from "./calendar-view-sidebar-layout";
import {
  CALENDAR_TIME_SLOT_MINUTES,
  formatCalendarSlotTimeLabel,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
  type CalendarDropSlot,
} from "@/lib/calendar-time-grid";
import {
  CalendarTimedTaskBlock,
  getTaskTiming,
  type CalendarTaskResizePreview,
} from "./calendar-timed-task-block";
import {
  bindCalendarTaskDrag,
  calendarTaskDragClassName,
  getActiveCalendarDropSlot,
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT_PX = 52;

type CalendarWeekViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
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
  );
  return top >= 0 && top <= hourCount * HOUR_HEIGHT_PX;
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
  const day = date.getDay();
  return startOfDay(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - day),
  );
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

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrentTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function CalendarWeekView({
  tasks,
  lists,
  selectedTaskId,
  onSelectTask,
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
  const [resizePreview, setResizePreview] =
    useState<CalendarTaskResizePreview | null>(null);
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const suppressTaskClickRef = useRef(false);
  const canDragTasks = Boolean(onSetTaskDueDate || onSetTaskDueTime);

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
    onPeriodLabelChange?.(formatMonthYear(weekStart));
  }, [onPeriodLabelChange, weekStart]);

  useEffect(() => {
    if (!weekStart || !today || !onSidebarFocusDateChange) return;

    const weekDays = getWeekDays(weekStart);
    const focusDate = weekDays.some((day) => isSameDay(day, today))
      ? today
      : weekStart;
    onSidebarFocusDateChange(focusDate);
  }, [onSidebarFocusDateChange, today, weekStart]);

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

  const weekDays = useMemo(
    () => (weekStart ? getWeekDays(weekStart) : []),
    [weekStart],
  );

  const hours = useMemo(
    () =>
      Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, index) => HOUR_START + index,
      ),
    [],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<
      string,
      { allDay: TaskListItem[]; timed: TaskListItem[] }
    >();

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const date = fromDateKey(task.dueDate.slice(0, 10));
      if (!date) continue;

      const key = toDateKey(date);
      const bucket = map.get(key) ?? { allDay: [], timed: [] };
      const dueTimeMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);

      if (dueTimeMinutes === null) {
        bucket.allDay.push(task);
      } else {
        bucket.timed.push(task);
      }

      map.set(key, bucket);
    }

    for (const bucket of map.values()) {
      bucket.timed.sort(
        (a, b) =>
          (normalizeDueTimeMinutes(a.dueTimeMinutes) ?? 0) -
          (normalizeDueTimeMinutes(b.dueTimeMinutes) ?? 0),
      );
    }

    return map;
  }, [tasks]);

  const modalTaskSnapshot = useMemo(
    () => (modalTaskId ? getCalendarTaskSnapshot(modalTaskId, tasks) : null),
    [modalTaskId, tasks],
  );

  const currentTimeTop =
    now === null
      ? null
      : (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT_PX;

  function goToPreviousWeek() {
    if (!weekStart) return;
    setWeekStart(
      startOfDay(
        new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() - 7,
        ),
      ),
    );
  }

  function goToNextWeek() {
    if (!weekStart) return;
    setWeekStart(
      startOfDay(
        new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + 7,
        ),
      ),
    );
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setWeekStart(getWeekStart(current));
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
    event.stopPropagation();
    setModalTaskId(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const dueTimeMinutes = getMinutesFromCalendarGridY(
      y,
      HOUR_START,
      HOUR_HEIGHT_PX,
    );
    const top = getTopForCalendarMinutes(
      dueTimeMinutes,
      HOUR_START,
      HOUR_HEIGHT_PX,
    );

    if (top < 0 || top > (hours.length + 1) * HOUR_HEIGHT_PX) {
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
      setDropTargetSlot,
      onDragStart: () => setModalTaskId(null),
    });
  }

  useEffect(() => {
    if (!weekStart) return;
    setModalTaskId(null);
    closeAddTaskPopover();
  }, [weekStart]);

  if (!weekStart || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 items-center justify-start border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToToday}
                className="mr-1 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Previous week"
                onClick={goToPreviousWeek}
                className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BiChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next week"
                onClick={goToNextWeek}
                className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BiChevronRight className="size-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid min-w-[760px] grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={`head-${toDateKey(day)}`}
                  className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {WEEKDAY_LABELS[day.getDay()]}
                  </div>
                  <div
                    className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-[#4873c7] font-semibold text-white"
                        : "font-medium text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}

            <div className="border-b border-r border-zinc-200 px-2 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
              All day
            </div>
            {weekDays.map((day) => {
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

              return (
                <div
                  key={`allday-${dateKey}`}
                  data-calendar-day={dateKey}
                  onClick={(event) => handleAllDayClick(event, day)}
                  className={`min-h-[72px] cursor-pointer border-b border-r border-zinc-200 p-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${
                    isDropTarget
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30"
                      : isActiveDay
                        ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30"
                        : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <div className="space-y-1">
                    {dayTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskClick(event, task);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskPointerDown(event, task, day);
                        }}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors ${calendarTaskDragClassName(
                          canDragTasks,
                          task.id === selectedTaskId,
                        )}`}
                      >
                        {task.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="relative border-r border-zinc-200 dark:border-zinc-800">
              <div
                className="border-b border-zinc-200 px-2 py-3 text-[11px] text-zinc-400 dark:border-zinc-800"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                00:00 - 07:00
              </div>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="relative border-b border-zinc-200 px-2 py-2 text-[11px] text-zinc-400 dark:border-zinc-800"
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  {String(hour).padStart(2, "0")}:00
                  <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                  <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dateKey = toDateKey(day);
              const timedTasks = tasksByDate.get(dateKey)?.timed ?? [];
              const activeDropSlot = getActiveCalendarDropSlot(
                dropTargetSlot,
                externalDropTargetDateKey,
                externalDropTargetTimeMinutes,
              );
              const isTimedDropTarget =
                activeDropSlot?.dateKey === dateKey &&
                isSlotWithinTimedGrid(activeDropSlot.dueTimeMinutes, hours.length);
              const isActiveTimedDay =
                addTaskPopover !== null &&
                isSameDay(day, addTaskPopover.date) &&
                addTaskPopover.dueTimeMinutes !== null;
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
                      HOUR_START,
                      HOUR_HEIGHT_PX,
                    );
              const showSelectedSlotMarker =
                selectedSlotTop !== null &&
                selectedSlotTop >= 0 &&
                selectedSlotTop <= (hours.length + 1) * HOUR_HEIGHT_PX;
              const isToday = isSameDay(day, today);
              const showNowLine =
                isToday &&
                currentTimeTop !== null &&
                currentTimeTop >= 0 &&
                currentTimeTop <= (HOUR_END - HOUR_START + 1) * HOUR_HEIGHT_PX;

              return (
                <div
                  key={`time-${dateKey}`}
                  data-calendar-day={dateKey}
                  data-calendar-time-grid="true"
                  data-hour-start={HOUR_START}
                  data-hour-height={HOUR_HEIGHT_PX}
                  className={`relative border-r border-zinc-200 dark:border-zinc-800 ${
                    isTimedDropTarget ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={(event) => handleTimeGridClick(event, day)}
                >
                  <div
                    className="cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                    style={{ height: HOUR_HEIGHT_PX }}
                  />
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
                    const top =
                      HOUR_HEIGHT_PX +
                      (timing.dueTimeMinutes / 60 - HOUR_START) * HOUR_HEIGHT_PX;
                    const height = Math.max(
                      24,
                      (timing.dueDurationMinutes / 60) * HOUR_HEIGHT_PX,
                    );

                    if (top < HOUR_HEIGHT_PX || top > (hours.length + 1) * HOUR_HEIGHT_PX) {
                      return null;
                    }

                    return (
                      <CalendarTimedTaskBlock
                        key={task.id}
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
                        setDropTargetSlot={setDropTargetSlot}
                        setResizePreview={setResizePreview}
                        onDragStart={() => setModalTaskId(null)}
                        toDateKey={toDateKey}
                      />
                    );
                  })}

                  {showSelectedSlotMarker &&
                  selectedSlotTop !== null &&
                  selectedSlotMinutes !== null ? (
                    <>
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20"
                        style={{ top: selectedSlotTop }}
                      >
                        <div className="relative h-px bg-[#4873c7]">
                          <span className="absolute -left-14 -top-2.5 text-[10px] font-semibold text-[#4873c7]">
                            {formatCalendarSlotTimeLabel(selectedSlotMinutes)}
                          </span>
                          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#4873c7]" />
                        </div>
                      </div>
                      {isActiveTimedDay ? (
                        <div
                          aria-hidden="true"
                          style={{
                            top: selectedSlotTop,
                            height: Math.max(
                              16,
                              (CALENDAR_TIME_SLOT_MINUTES / 60) *
                                HOUR_HEIGHT_PX,
                            ),
                          }}
                          className="pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded border border-[#4873c7]/40 bg-[#4873c7]/10 px-1.5 py-0.5 text-left text-[11px] text-[#4873c7]"
                        >
                          {draftTaskName.trim() ||
                            formatCalendarSlotTimeLabel(selectedSlotMinutes)}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {showNowLine ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: HOUR_HEIGHT_PX + currentTimeTop }}
                    >
                      <div className="relative h-px bg-red-500">
                        <span className="absolute -left-14 -top-2.5 text-[10px] font-medium text-red-500">
                          {formatCurrentTimeLabel(now)}
                        </span>
                        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
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
          x={addTaskPopover.x}
          y={addTaskPopover.y}
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
        />
      ) : null}
    </div>
  );
}
