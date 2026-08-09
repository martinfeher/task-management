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
import { resolveCalendarDayFromPoint } from "@/lib/calendar-drag";
import { getCalendarShellClassName } from "@/lib/calendar-layout";
import type { CalendarSidebarSyncProps } from "./calendar-view-sidebar-layout";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_TASK_DRAG_THRESHOLD_PX = 5;

type CalendarMultiWeekViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  weekCount: number;
  onSelectTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
} & CalendarTaskEditorCallbacks & {
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
  }) => void | Promise<void>;
  defaultListId?: string | null;
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
  onPeriodLabelChange?: (label: string) => void;
} & CalendarSidebarSyncProps;

type CalendarTaskDragState = {
  taskId: string;
  sourceDateKey: string;
  pointerId: number;
  captureTarget: HTMLElement;
};

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
  const normalized = startOfDay(date);
  const dayIndex = normalized.getDay();
  return startOfDay(
    new Date(
      normalized.getFullYear(),
      normalized.getMonth(),
      normalized.getDate() - dayIndex,
    ),
  );
}

function getMultiWeekDays(rangeStart: Date, weekCount: number) {
  const totalDays = weekCount * 7;
  return Array.from({ length: totalDays }, (_, index) =>
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

  if (
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear()
  ) {
    return monthYear.format(first);
  }

  const monthOnly = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${monthOnly.format(first)} – ${monthYear.format(last)}`;
}

function getRowMinHeightPx(weekCount: number) {
  return Math.max(96, Math.min(180, Math.round(720 / weekCount)));
}

export function CalendarMultiWeekView({
  tasks,
  lists,
  selectedTaskId,
  weekCount,
  onSelectTask,
  onSetTaskDueDate,
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
}: CalendarMultiWeekViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const lastSidebarJumpRequestIdRef = useRef(0);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [addTaskPopover, setAddTaskPopover] = useState<{
    date: Date;
    x: number;
    y: number;
  } | null>(null);
  const [draftTaskName, setDraftTaskName] = useState("");
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(
    null,
  );
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const suppressTaskClickRef = useRef(false);

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setRangeStart(getWeekStart(current));
  }, []);

  const visibleDays = useMemo(
    () => (rangeStart ? getMultiWeekDays(rangeStart, weekCount) : []),
    [rangeStart, weekCount],
  );
  const rowMinHeightPx = getRowMinHeightPx(weekCount);

  useEffect(() => {
    if (visibleDays.length === 0) return;
    onPeriodLabelChange?.(formatRangeHeading(visibleDays));
  }, [onPeriodLabelChange, visibleDays]);

  useEffect(() => {
    if (!rangeStart || !today || !onSidebarFocusDateChange) return;

    const days = getMultiWeekDays(rangeStart, weekCount);
    const focusDate = days.some((day) => isSameDay(day, today))
      ? today
      : rangeStart;
    onSidebarFocusDateChange(focusDate);
  }, [onSidebarFocusDateChange, rangeStart, today, weekCount]);

  useEffect(() => {
    if (
      sidebarJumpRequestId === undefined ||
      sidebarFocusDate === undefined ||
      sidebarJumpRequestId === lastSidebarJumpRequestIdRef.current
    ) {
      return;
    }

    lastSidebarJumpRequestIdRef.current = sidebarJumpRequestId;
    setRangeStart(getWeekStart(sidebarFocusDate));
  }, [sidebarFocusDate, sidebarJumpRequestId]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const date = fromDateKey(task.dueDate.slice(0, 10));
      if (!date) continue;

      const key = toDateKey(date);
      const existing = map.get(key) ?? [];
      existing.push(task);
      map.set(key, existing);
    }

    return map;
  }, [tasks]);

  const modalTaskSnapshot = useMemo(
    () => (modalTaskId ? getCalendarTaskSnapshot(modalTaskId, tasks) : null),
    [modalTaskId, tasks],
  );

  function goToPreviousRange() {
    if (!rangeStart) return;
    setRangeStart(
      startOfDay(
        new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate() - weekCount * 7,
        ),
      ),
    );
  }

  function goToNextRange() {
    if (!rangeStart) return;
    setRangeStart(
      startOfDay(
        new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate() + weekCount * 7,
        ),
      ),
    );
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setRangeStart(getWeekStart(current));
  }

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleDayClick(
    event:
      | React.MouseEvent<HTMLDivElement>
      | React.KeyboardEvent<HTMLDivElement>,
    day: Date,
  ) {
    setModalTaskId(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    let x: number;
    let y: number;

    if ("clientX" in event) {
      x = event.clientX;
      y = event.clientY;
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x,
      y,
    });
  }

  function handleCalendarTaskClick(
    event: React.MouseEvent<HTMLButtonElement>,
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
    if (event.button !== 0 || !onSetTaskDueDate) return;

    const sourceDateKey = toDateKey(day);
    const taskButton = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function finishDrag(upEvent: PointerEvent) {
      document.body.style.cursor = "";
      taskButton.classList.remove("opacity-50");

      if (taskButton.hasPointerCapture(pointerId)) {
        taskButton.releasePointerCapture(pointerId);
      }

      const dragState = dragStateRef.current;
      const targetDateKey = resolveCalendarDayFromPoint(
        upEvent.clientX,
        upEvent.clientY,
      );

      if (
        dragState &&
        onSetTaskDueDate &&
        targetDateKey &&
        targetDateKey !== dragState.sourceDateKey
      ) {
        onSetTaskDueDate(dragState.taskId, targetDateKey);
      }

      dragStateRef.current = null;
      setDropTargetDateKey(null);
      suppressTaskClickRef.current = true;
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;

      if (!dragStarted) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < CALENDAR_TASK_DRAG_THRESHOLD_PX) return;

        dragStarted = true;
        clearPendingListeners();
        setModalTaskId(null);
        dragStateRef.current = {
          taskId: task.id,
          sourceDateKey,
          pointerId,
          captureTarget: taskButton,
        };
        taskButton.setPointerCapture(pointerId);
        taskButton.classList.add("opacity-50");
        document.body.style.cursor = "grabbing";
        document.addEventListener("pointermove", onActivePointerMove);
        document.addEventListener("pointerup", onActivePointerUp);
        document.addEventListener("pointercancel", onActivePointerUp);
      }
    }

    function onActivePointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      setDropTargetDateKey(
        resolveCalendarDayFromPoint(moveEvent.clientX, moveEvent.clientY),
      );
    }

    function onActivePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onActivePointerMove);
      document.removeEventListener("pointerup", onActivePointerUp);
      document.removeEventListener("pointercancel", onActivePointerUp);
      finishDrag(upEvent);
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  useEffect(() => {
    if (!rangeStart) return;
    setModalTaskId(null);
    closeAddTaskPopover();
  }, [rangeStart, weekCount]);

  if (!rangeStart || !today) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-end px-1 py-2">
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
                aria-label={`Previous ${weekCount} weeks`}
                onClick={goToPreviousRange}
                className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BiChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label={`Next ${weekCount} weeks`}
                onClick={goToNextRange}
                className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BiChevronRight className="size-5" />
              </button>
            </div>
          </div>

        <div className="grid shrink-0 grid-cols-7 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="grid h-full min-h-full grid-cols-7 border-l border-t border-zinc-200 dark:border-zinc-800"
            style={{
              gridTemplateRows: `repeat(${weekCount}, minmax(${rowMinHeightPx}px, 1fr))`,
            }}
          >
            {visibleDays.map((day) => {
              const dateKey = toDateKey(day);
              const dayTasks = tasksByDate.get(dateKey) ?? [];
              const isToday = isSameDay(day, today);
              const isDropTarget =
                dropTargetDateKey === dateKey ||
                externalDropTargetDateKey === dateKey;
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);
              const maxVisibleTasks = 3;

              return (
                <div
                  key={dateKey}
                  data-calendar-day={dateKey}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => handleDayClick(event, day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDayClick(event, day);
                    }
                  }}
                  className={`h-full cursor-pointer border-r border-b border-zinc-200 p-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${
                    isDropTarget
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30 dark:ring-blue-500"
                      : isActiveDay
                        ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30 dark:ring-[#7da2ff]"
                        : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-[#4873c7] font-semibold text-white"
                        : "font-medium text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, maxVisibleTasks).map((task) => (
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
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors touch-none ${
                          onSetTaskDueDate
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                        } ${
                          task.id === selectedTaskId
                            ? "bg-[#4873c7] text-white"
                            : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe] dark:bg-blue-950/50 dark:text-blue-100 dark:hover:bg-blue-950/70"
                        }`}
                      >
                        {task.name}
                      </button>
                    ))}
                    {dayTasks.length > maxVisibleTasks && (
                      <span className="block px-1 text-[11px] text-zinc-400">
                        +{dayTasks.length - maxVisibleTasks} more
                      </span>
                    )}
                  </div>
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
