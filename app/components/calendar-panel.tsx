"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { IoIosSearch } from "react-icons/io";
import {
  TbLayoutSidebarRightCollapseFilled,
  TbLayoutSidebarRightExpandFilled,
} from "react-icons/tb";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import {
  CalendarTaskModal,
  getCalendarTaskClickAnchorRect,
  getCalendarTaskSnapshot,
  type CalendarTaskEditorCallbacks,
  type CalendarTaskModalAnchorRect,
} from "./calendar-task-modal";
import { CalendarTaskModalActionsProvider } from "./calendar-task-modal-actions";
import { CalendarDayView } from "./calendar-day-view";
import { CalendarPeriodNavigation } from "./calendar-period-navigation";
import { CalendarMultiDayView } from "./calendar-days-view";
import {
  buildTasksByDate,
  formatMonthYear,
  fromDateKey,
  getFullMonthDays,
  getMonthCalendarRange,
  isSameDay,
  startOfDay,
  toDateKey,
} from "./calendar-mini-month";
import { getCalendarTaskKey } from "@/lib/calendar-recurring-tasks";
import { CalendarMultiWeekView } from "./calendar-weeks-view";
import {
  CalendarViewSidebarLayout,
  type CalendarSidebarSyncProps,
} from "./calendar-view-sidebar-layout";
import { CalendarWeekView } from "./calendar-week-view";
import {
  CalendarTaskHoverButton,
  CalendarTaskHoverPreviewProvider,
  useCalendarTaskDragPreview,
} from "./calendar-task-hover-preview";
import { CalendarTaskColorMenuProvider } from "./calendar-task-color-menu";
import { CalendarTaskTitle } from "./calendar-task-title";
import { CalendarTaskCompletionCheckbox } from "./calendar-timed-task-block";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";
import type { SearchTask, TaskLabel, TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { resolveCalendarDayFromPoint } from "@/lib/calendar-drag";
import {
  CALENDAR_TASK_DRAGGING_CLASS,
  CALENDAR_TASK_DRAG_CURSOR,
  CALENDAR_TASK_DRAG_THRESHOLD_PX,
  getCalendarTaskDragSurface,
} from "@/lib/calendar-task-drag";
import { getCalendarShellClassName, calendarAllDayTaskClassName, getCalendarTaskItemStyle, isCalendarTaskPast, CALENDAR_WEEKDAY_LABELS, getCalendarDayColumnDividerClass, CALENDAR_TODAY_DATE_CIRCLE_CLASS, CALENDAR_GRID_SCROLL_CLASS } from "@/lib/calendar-layout";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import {
  readCalendarViewSession,
  saveCalendarViewSession,
  type CalendarViewTab,
} from "@/lib/calendar-view-settings";

export type { CalendarViewTab };

const PRIMARY_CALENDAR_VIEW_TABS: Array<{
  id: CalendarViewTab;
  label: string;
}> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  // { id: "year", label: "Year" },
];

const MULTI_CALENDAR_VIEW_OPTIONS: Array<{
  id: Extract<CalendarViewTab, "days" | "weeks">;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}> = [
  { id: "days", label: "Days", min: 2, max: 30, defaultValue: 3 },
  { id: "weeks", label: "Weeks", min: 2, max: 12, defaultValue: 2 },
];

const CALENDAR_VIEW_TABS = [
  ...PRIMARY_CALENDAR_VIEW_TABS,
  ...MULTI_CALENDAR_VIEW_OPTIONS.map(({ id, label }) => ({ id, label })),
];

type CalendarPanelProps = {
  tasks: TaskListItem[];
  searchTasks?: SearchTask[];
  lists: TodoList[];
  completingTaskIds: Set<string>;
  completingWithoutBackgroundTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, name: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskDueDateAndTime?: (
    taskId: string,
    dateValue: string | null,
    dueTime: TaskDueTime,
  ) => void;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onSetTaskCalendarColor?: (taskId: string, color: string | null) => void;
  onToggleTaskLabel?: (
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) => Promise<{ id: string; label: string }[]>;
  onLabelsChanged?: () => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
  labels?: TaskLabel[];
  onDeleteTask?: (taskId: string) => void | Promise<void>;
} & CalendarTaskEditorCallbacks & {
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
  }) => void | Promise<void>;
  defaultListId?: string | null;
  defaultView?: CalendarViewTab;
  view?: CalendarViewTab;
  onViewChange?: (view: CalendarViewTab) => void;
  multiDayCount?: number;
  multiWeekCount?: number;
  onMultiDayCountChange?: (count: number) => void;
  onMultiWeekCountChange?: (count: number) => void;
  persistViewSession?: boolean;
  periodLabelAction?: ReactNode;
  headerTrailingAction?: ReactNode;
};

type CalendarTaskDragState = {
  taskId: string;
  sourceDateKey: string;
  pointerId: number;
  captureTarget: HTMLElement;
};

function CalendarViewCounter({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <span
      data-calendar-view-counter
      className="flex items-center gap-1 text-sm tabular-nums text-[#8b8b95] dark:text-zinc-300 cursor-pointer"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-[15px] cursor-pointer items-center justify-center rounded-full bg-[#f5f5f8] pb-[1px] text-[13px] leading-none text-[#b3b3c0] transition-colors hover:bg-[#F1F5F9] hover:text-zinc-900 disabled:cursor-not-allowed dark:hover:text-zinc-50"
      >
        −
      </button>
      <div className="min-w-[1ch] mt-[1.5px] text-center text-xs">{value}</div>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-[15px] cursor-pointer items-center justify-center rounded-full bg-[#f5f5f8] pb-px text-[13px] leading-none text-[#b3b3c0] transition-colors hover:bg-[#F1F5F9] hover:text-zinc-900 disabled:cursor-not-allowed dark:hover:text-zinc-50"
      >
        +
      </button>
    </span>
  );
}

type CalendarMonthNavigation = {
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
};

function CalendarViewTabs({
  activeView,
  multiDayCount,
  multiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  onChange,
  periodLabel,
  periodLabelSuffix,
  periodSubLabel,
  monthNavigation,
  searchQuery,
  onSearchQueryChange,
  periodLabelAction,
  headerTrailingAction,
  sidebarOpen,
  onSidebarOpenChange,
}: {
  activeView: CalendarViewTab;
  multiDayCount: number;
  multiWeekCount: number;
  onMultiDayCountChange: (count: number) => void;
  onMultiWeekCountChange: (count: number) => void;
  onChange: (view: CalendarViewTab) => void;
  periodLabel?: string | null;
  periodLabelSuffix?: string | null;
  periodSubLabel?: string | null;
  monthNavigation?: CalendarMonthNavigation | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  periodLabelAction?: ReactNode;
  headerTrailingAction?: ReactNode;
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
}) {
  const tabButtonClassName = (isActive: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[14px] transition-colors hover:bg-[#F2F5F7] cursor-pointer ${
      isActive
        ? "bg-[#e8F2F6] text-zinc-750 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  return (
    <div className={`relative z-40 ${activeView === "month" ? "mb-[26px]" : "mb-2"} grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 pl-4 pt-3`}>
      {periodLabel ? (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg text-zinc-700 dark:text-zinc-50 text-[25px]">
              <span className="font-semibold">{periodLabel}</span>
              {periodLabelSuffix ? (
                <span className="font-normal"> {periodLabelSuffix}</span>
              ) : null}
            </h2>
            {periodLabelAction ? (
              <div className="ml-[10px] shrink-0">{periodLabelAction}</div>
            ) : null}
            {activeView === "month" && monthNavigation ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={monthNavigation.goToPreviousMonth}
                  className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <BiChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={monthNavigation.goToNextMonth}
                  className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <BiChevronRight className="size-5" />
                </button>
              </div>
            ) : null}
          </div>
          {periodSubLabel ? (
            <p className="truncate text-sm font-normal text-zinc-600 dark:text-zinc-400">
              {periodSubLabel}
            </p>
          ) : null}
        </div>
      ) : (
        <div />
      )}
      <div className="calendar-view-tabs inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-900">
        {PRIMARY_CALENDAR_VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={activeView === tab.id}
            className={tabButtonClassName(activeView === tab.id)}
          >
            {tab.label}
          </button>
        ))}

        <span
          aria-hidden="true"
          className="mx-1 h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700"
        />

        {MULTI_CALENDAR_VIEW_OPTIONS.map((option) => {
          const isActive = activeView === option.id;
          const count =
            option.id === "days" ? multiDayCount : multiWeekCount;
          const onCountChange =
            option.id === "days"
              ? onMultiDayCountChange
              : onMultiWeekCountChange;

          return (
            <div
              key={option.id}
              className={`inline-flex items-center rounded-full transition-colors cursor-pointer hover:bg-[#F1F5F9] ${
                isActive ? "bg-[#e8F2F6] dark:bg-zinc-800" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onChange(option.id)}
                aria-pressed={isActive}
                className={`rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "text-zinc-700 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {option.label}
              </button>
              <div className="-ml-[7px] flex items-center pr-1 cursor-pointer">
                <CalendarViewCounter
                  value={count}
                  min={option.min}
                  max={option.max}
                  onChange={(nextValue) => {
                    onCountChange(nextValue);
                    onChange(option.id);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex w-full items-center justify-end gap-2">
        {activeView !== "month" && sidebarOpen ? (
          <label className="relative flex h-9 w-full max-w-[210px] items-center rounded-full border border-zinc-200 bg-[#fafafd] px-3 dark:border-zinc-700 dark:bg-zinc-900">
            <IoIosSearch
              className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search"
              aria-label="Search calendar tasks"
              className="h-9 min-w-0 flex-1 appearance-none bg-transparent py-0 pl-2 text-sm leading-9 text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            />
          </label>
        ) : null}
        <button
          type="button"
          aria-label={sidebarOpen ? "Close calendar sidebar" : "Open calendar sidebar"}
          onClick={() => onSidebarOpenChange(!sidebarOpen)}
          className="group hidden size-9 min-[1801px]:flex shrink-0 cursor-pointer items-center mb-2 justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {sidebarOpen ? (
            <TbLayoutSidebarRightCollapseFilled 
            className="size-5 text-zinc-350"
            style={{ strokeWidth: 0.1 }}
             />
          ) : (
            <TbLayoutSidebarRightExpandFilled className="size-5 text-zinc-350 group-text-zinc-450 " />
          )}
        </button>
        {headerTrailingAction}
      </div>
    </div>
  );
}

function CalendarViewPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        {label} view coming soon
      </p>
    </div>
  );
}

export function CalendarMonthView({
  tasks,
  lists,
  completingTaskIds,
  completingWithoutBackgroundTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onMoveTaskToList,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onAddCalendarTask,
  defaultListId = null,
  fullWidth = false,
  externalDropTargetDateKey = null,
  onPeriodLabelChange,
  onMonthNavigationChange,
  sidebarFocusDate,
  sidebarJumpRequestId,
  onSidebarFocusDateChange,
}: {
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds?: Set<string>;
  completingWithoutBackgroundTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
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
  onMonthNavigationChange?: (navigation: CalendarMonthNavigation | null) => void;
} & CalendarSidebarSyncProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [monthDate, setMonthDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [modalAnchorRect, setModalAnchorRect] =
    useState<CalendarTaskModalAnchorRect | null>(null);

  function closeTaskModal() {
    setModalTaskId(null);
    setModalAnchorRect(null);
  }
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
  const lastSidebarJumpRequestIdRef = useRef<number | undefined>(undefined);
  const { beginTaskDrag, endDragPreview } = useCalendarTaskDragPreview();
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();

  useEffect(() => {
    const currentDay = startOfDay(new Date());
    setToday(currentDay);
    setMonthDate(currentDay);
    setSelectedDate(currentDay);
    setNow(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      sidebarJumpRequestId === undefined ||
      sidebarFocusDate === undefined ||
      sidebarJumpRequestId === lastSidebarJumpRequestIdRef.current
    ) {
      return;
    }

    lastSidebarJumpRequestIdRef.current = sidebarJumpRequestId;
    const normalized = startOfDay(sidebarFocusDate);
    setMonthDate(
      startOfDay(new Date(normalized.getFullYear(), normalized.getMonth(), 1)),
    );
    setSelectedDate(normalized);
  }, [sidebarFocusDate, sidebarJumpRequestId]);

  const calendarRange = useMemo(
    () => (monthDate ? getMonthCalendarRange(monthDate) : undefined),
    [monthDate],
  );

  const tasksByDate = useMemo(
    () => buildTasksByDate(tasks, calendarRange),
    [tasks, calendarRange],
  );

  const monthDays = useMemo(() => {
    if (!monthDate) return [];
    return getFullMonthDays(monthDate.getFullYear(), monthDate.getMonth());
  }, [monthDate]);
  const monthRowCount = Math.max(1, Math.ceil(monthDays.length / 7));

  const modalTaskSnapshot = useMemo(
    () => (modalTaskId ? getCalendarTaskSnapshot(modalTaskId, tasks) : null),
    [modalTaskId, tasks],
  );

  function syncSidebarFocusForMonth(nextMonthDate: Date) {
    if (!onSidebarFocusDateChange) return;

    const focusDate =
      selectedDate &&
      selectedDate.getFullYear() === nextMonthDate.getFullYear() &&
      selectedDate.getMonth() === nextMonthDate.getMonth()
        ? selectedDate
        : nextMonthDate;

    onSidebarFocusDateChange(focusDate);
  }

  const handleGoToPreviousMonth = useCallback(() => {
    if (!monthDate) return;
    const nextMonthDate = startOfDay(
      new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
    );
    setMonthDate(nextMonthDate);
    syncSidebarFocusForMonth(nextMonthDate);
  }, [monthDate, onSidebarFocusDateChange, selectedDate]);

  const handleGoToNextMonth = useCallback(() => {
    if (!monthDate) return;
    const nextMonthDate = startOfDay(
      new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
    );
    setMonthDate(nextMonthDate);
    syncSidebarFocusForMonth(nextMonthDate);
  }, [monthDate, onSidebarFocusDateChange, selectedDate]);

  useEffect(() => {
    if (!onMonthNavigationChange || !monthDate) return;
    onMonthNavigationChange({
      goToPreviousMonth: handleGoToPreviousMonth,
      goToNextMonth: handleGoToNextMonth,
    });
    return () => onMonthNavigationChange(null);
  }, [
    handleGoToNextMonth,
    handleGoToPreviousMonth,
    monthDate,
    onMonthNavigationChange,
  ]);

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleDaySelect(day: Date) {
    const normalized = startOfDay(day);
    setSelectedDate(normalized);
    onSidebarFocusDateChange?.(normalized);
    closeTaskModal();
    closeAddTaskPopover();
  }

  function isFocusedMonthDay(day: Date) {
    const focusDate = sidebarFocusDate ?? selectedDate;
    return focusDate !== null && isSameDay(day, focusDate);
  }

  function handleDayDoubleClick(
    event: React.MouseEvent<HTMLDivElement>,
    day: Date,
  ) {
    setSelectedDate(day);
    closeTaskModal();

    if (!onAddCalendarTask || lists.length === 0) return;

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleCalendarTaskClick(
    event: React.MouseEvent<HTMLButtonElement>,
    task: TaskListItem,
    day: Date,
  ) {
    event.stopPropagation();

    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

    setSelectedDate(day);
    onSelectTask(task.id);
    closeAddTaskPopover();
    setModalAnchorRect(getCalendarTaskClickAnchorRect(event.currentTarget));
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
    const dragSurface = getCalendarTaskDragSurface(taskButton);
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
      dragSurface.classList.remove(CALENDAR_TASK_DRAGGING_CLASS);

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
        const targetDate = fromDateKey(targetDateKey);
        if (targetDate) {
          setSelectedDate(targetDate);
        }
      }

      dragStateRef.current = null;
      setDropTargetDateKey(null);
      suppressTaskClickRef.current = true;
      endDragPreview?.();
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;

      if (!dragStarted) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < CALENDAR_TASK_DRAG_THRESHOLD_PX) return;

        dragStarted = true;
        clearPendingListeners();
        beginTaskDrag?.();
        closeTaskModal();
        dragStateRef.current = {
          taskId: task.id,
          sourceDateKey,
          pointerId,
          captureTarget: taskButton,
        };
        taskButton.setPointerCapture(pointerId);
        dragSurface.classList.add(CALENDAR_TASK_DRAGGING_CLASS);
        document.body.style.cursor = CALENDAR_TASK_DRAG_CURSOR;
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
    if (!monthDate) return;
    closeTaskModal();
    closeAddTaskPopover();
  }, [monthDate]);

  useEffect(() => {
    if (!monthDate) return;
    onPeriodLabelChange?.(formatMonthYear(monthDate));
  }, [monthDate, onPeriodLabelChange]);

  if (!monthDate || !selectedDate || !today) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-7 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <div className="col-span-7 h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="min-h-0 flex-1 animate-pulse bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-7 border-b border-zinc-200 bg-white pb-2 dark:border-zinc-800 dark:bg-zinc-950">
        {CALENDAR_WEEKDAY_LABELS.map((label, dayIndex) => (
          <div
            key={label}
            className={`px-2 text-center text-[14px] font-medium uppercase tracking-wide text-zinc-700 ${getCalendarDayColumnDividerClass(dayIndex, CALENDAR_WEEKDAY_LABELS.length)}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className={getCalendarShellClassName(fullWidth)}>
        <div className={CALENDAR_GRID_SCROLL_CLASS}>
            <div
              className="grid h-full min-h-full grid-cols-7"
              style={{
                gridTemplateRows: `repeat(${monthRowCount}, minmax(96px, 140px))`,
              }}
            >
            {monthDays.map((day, index) => {
              const dateKey = toDateKey(day);
              const dayTasks = tasksByDate.get(dateKey) ?? [];
              const isSelected = isFocusedMonthDay(day);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === monthDate.getMonth();

              const isDropTarget =
                dropTargetDateKey === dateKey ||
                externalDropTargetDateKey === dateKey;
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);

              return (
                <div
                  key={dateKey}
                  data-calendar-day={dateKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleDaySelect(day)}
                  onDoubleClick={(event) => handleDayDoubleClick(event, day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDaySelect(day);
                    }
                  }}
                  className={`h-full cursor-pointer border-b border-zinc-200 p-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${getCalendarDayColumnDividerClass(index % 7, 7)} ${
                    isDropTarget
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30 dark:ring-blue-500"
                      : isActiveDay
                        ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30 dark:ring-[#7da2ff]"
                        : isSelected
                          ? "bg-zinc-100 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-600"
                          : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? CALENDAR_TODAY_DATE_CIRCLE_CLASS
                        : isCurrentMonth
                          ? "font-medium text-[#b2b6bf] dark:text-zinc-100"
                          : "text-zinc-400"
                    }`}
                  >
                    {!isCurrentMonth && day.getDate() === 1 ? (
                      <>
                        {day.getDate()}{" "}
                        {new Intl.DateTimeFormat(undefined, {
                          month: "short",
                        }).format(day)}
                      </>
                    ) : (
                      day.getDate()
                    )}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, isActiveDay ? 2 : 3).map((task) => (
                      <CalendarTaskHoverButton
                        key={getCalendarTaskKey(task)}
                        task={task}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskClick(event, task, day);
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskPointerDown(event, task, day);
                        }}
                        className={`${calendarAllDayTaskClassName(
                          task.id === selectedTaskId,
                          Boolean(onSetTaskDueDate),
                        )} calendar-task-row--single-line gap-1 overflow-hidden`}
                        style={getCalendarTaskItemStyle(
                          task.priority,
                          task.calendarColor,
                          calendarTaskDefaultColor,
                          {
                            past:
                              now !== null &&
                              isCalendarTaskPast(day, now, task),
                          },
                        )}
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
                    {isActiveDay ? (
                      <div
                        aria-hidden="true"
                        className="block w-full truncate h-[16px] rounded-[6px] bg-zinc-200/50 px-2 py-0.5 text-left text-[11px] text-zinc-400 dark:bg-zinc-700 dark:text-zinc-100"
                      >
                        {draftTaskName.trim() || ""}
                      </div>
                    ) : null}
                    {!isActiveDay && dayTasks.length > 3 && (
                      <span className="block px-1 text-[11px] text-zinc-400">
                        +{dayTasks.length - 3} more
                      </span>
                    )}
                    {isActiveDay && dayTasks.length > 2 && (
                      <span className="block px-1 text-[11px] text-zinc-400">
                        +{dayTasks.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
          anchorRect={modalAnchorRect}
          onClose={closeTaskModal}
          onDetailsSaved={onDetailsSaved}
          onTaskHasDetailsKnown={onTaskHasDetailsKnown}
          onTaskRenamed={onTaskRenamed}
          onDueDateUpdated={onDueDateUpdated}
          onRecurrenceUpdated={onRecurrenceUpdated}
          onSaveTaskRecurrence={onSaveTaskRecurrence}
          onToggleTask={onToggleTask}
        />
      ) : null}
    </div>
  );
}

type CalendarViewsPanelProps = {
  tasks: TaskListItem[];
  searchTasks?: SearchTask[];
  lists: TodoList[];
  completingTaskIds?: Set<string>;
  completingWithoutBackgroundTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskDueDateAndTime?: (
    taskId: string,
    dateValue: string | null,
    dueTime: TaskDueTime,
  ) => void;
  onSetTaskCalendarColor?: (taskId: string, color: string | null) => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onToggleTaskLabel?: (
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) => Promise<{ id: string; label: string }[]>;
  onLabelsChanged?: () => void;
  labels?: TaskLabel[];
  onDeleteTask?: (taskId: string) => void | Promise<void>;
} & CalendarTaskEditorCallbacks & {
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
    dueTimeMinutes?: number | null;
  }) => void | Promise<void>;
  defaultListId?: string | null;
  defaultView?: CalendarViewTab;
  view?: CalendarViewTab;
  onViewChange?: (view: CalendarViewTab) => void;
  multiDayCount?: number;
  multiWeekCount?: number;
  onMultiDayCountChange?: (count: number) => void;
  onMultiWeekCountChange?: (count: number) => void;
  persistViewSession?: boolean;
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
  externalDropTargetTimeMinutes?: number | null;
  externalDraggingTaskId?: string | null;
  externalDraggingTaskName?: string | null;
  periodLabelAction?: ReactNode;
  headerTrailingAction?: ReactNode;
};

export function CalendarViewsPanel({
  tasks,
  searchTasks,
  lists,
  completingTaskIds,
  completingWithoutBackgroundTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskDueDateAndTime,
  onSetTaskCalendarColor,
  onMoveTaskToList,
  onSetTaskPriority,
  onToggleTaskLabel,
  onLabelsChanged,
  labels = [],
  onDeleteTask,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onAddCalendarTask,
  defaultListId = null,
  defaultView = "week",
  view,
  onViewChange,
  multiDayCount: controlledMultiDayCount,
  multiWeekCount: controlledMultiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  persistViewSession = true,
  fullWidth = false,
  externalDropTargetDateKey = null,
  externalDropTargetTimeMinutes = null,
  externalDraggingTaskId = null,
  externalDraggingTaskName = null,
  periodLabelAction,
  headerTrailingAction,
}: CalendarViewsPanelProps) {
  const [internalActiveView, setInternalActiveView] =
    useState<CalendarViewTab>(defaultView);
  const activeView = view ?? internalActiveView;
  const handleActiveViewChange = useCallback(
    (nextView: CalendarViewTab) => {
      if (view === undefined) {
        setInternalActiveView(nextView);
      }
      onViewChange?.(nextView);
    },
    [onViewChange, view],
  );
  const [internalMultiDayCount, setInternalMultiDayCount] = useState(
    MULTI_CALENDAR_VIEW_OPTIONS.find((option) => option.id === "days")
      ?.defaultValue ?? 3,
  );
  const [internalMultiWeekCount, setInternalMultiWeekCount] = useState(
    MULTI_CALENDAR_VIEW_OPTIONS.find((option) => option.id === "weeks")
      ?.defaultValue ?? 2,
  );
  const multiDayCount = controlledMultiDayCount ?? internalMultiDayCount;
  const multiWeekCount = controlledMultiWeekCount ?? internalMultiWeekCount;
  const handleMultiDayCountChange = useCallback(
    (count: number) => {
      if (controlledMultiDayCount === undefined) {
        setInternalMultiDayCount(count);
      }
      onMultiDayCountChange?.(count);
    },
    [controlledMultiDayCount, onMultiDayCountChange],
  );
  const handleMultiWeekCountChange = useCallback(
    (count: number) => {
      if (controlledMultiWeekCount === undefined) {
        setInternalMultiWeekCount(count);
      }
      onMultiWeekCountChange?.(count);
    },
    [controlledMultiWeekCount, onMultiWeekCountChange],
  );
  const [calendarViewSessionReady, setCalendarViewSessionReady] =
    useState(false);
  const [periodLabel, setPeriodLabel] = useState(() =>
    formatMonthYear(new Date()),
  );
  const [periodLabelSuffix, setPeriodLabelSuffix] = useState<string | null>(
    null,
  );
  const [periodSubLabel, setPeriodSubLabel] = useState<string | null>(null);
  const [monthNavigation, setMonthNavigation] =
    useState<CalendarMonthNavigation | null>(null);

  const handlePeriodLabelChange = useCallback(
    (
      label: string,
      meta?: { suffix?: string; subLabel?: string },
    ) => {
      setPeriodLabel(label);
      setPeriodLabelSuffix(meta?.suffix ?? null);
      setPeriodSubLabel(meta?.subLabel ?? null);
    },
    [],
  );
  const [sidebarMonthDate, setSidebarMonthDate] = useState(() => {
    const now = new Date();
    return startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [sidebarFocusDate, setSidebarFocusDate] = useState(() =>
    startOfDay(new Date()),
  );
  const [sidebarJumpRequestId, setSidebarJumpRequestId] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const calendarTaskModalActions = useMemo(
    () => ({
      tasks,
      lists,
      labels,
      onSetTaskPriority,
      onToggleTaskLabel,
      onLabelsChanged,
      onMoveTaskToList,
      onDeleteTask,
    }),
    [
      tasks,
      lists,
      labels,
      onSetTaskPriority,
      onToggleTaskLabel,
      onLabelsChanged,
      onMoveTaskToList,
      onDeleteTask,
    ],
  );

  const calendarSearchTasks = useMemo(() => {
    if (searchTasks) return searchTasks;

    return tasks.flatMap((task) =>
      task.listId
        ? [
            {
              ...task,
              listId: task.listId,
              listName: task.listName ?? "",
            },
          ]
        : [],
    );
  }, [searchTasks, tasks]);

  useEffect(() => {
    if (!persistViewSession) {
      setCalendarViewSessionReady(true);
      return;
    }

    const stored = readCalendarViewSession();
    if (stored) {
      handleActiveViewChange(stored.activeView);
      handleMultiDayCountChange(stored.multiDayCount);
      handleMultiWeekCountChange(stored.multiWeekCount);
    }
    setCalendarViewSessionReady(true);
  }, [
    handleActiveViewChange,
    handleMultiDayCountChange,
    handleMultiWeekCountChange,
    persistViewSession,
  ]);

  useEffect(() => {
    if (!calendarViewSessionReady || !persistViewSession) return;

    saveCalendarViewSession({
      activeView,
      multiDayCount,
      multiWeekCount,
    });
  }, [
    activeView,
    calendarViewSessionReady,
    multiDayCount,
    multiWeekCount,
  ]);

  const activeViewLabel =
    activeView === "days"
      ? `days (${multiDayCount} days)`
      : activeView === "weeks"
        ? `Weeks (${multiWeekCount} weeks)`
        : (CALENDAR_VIEW_TABS.find((tab) => tab.id === activeView)?.label ??
          activeView);

  const handleSidebarFocusDateChange = useCallback((date: Date) => {
    const normalized = startOfDay(date);
    setSidebarFocusDate((previous) =>
      isSameDay(previous, normalized) ? previous : normalized,
    );
    setSidebarMonthDate((previous) => {
      if (
        normalized.getMonth() === previous.getMonth() &&
        normalized.getFullYear() === previous.getFullYear()
      ) {
        return previous;
      }

      return startOfDay(
        new Date(normalized.getFullYear(), normalized.getMonth(), 1),
      );
    });
  }, []);

  const handleCalendarSearchSelect = useCallback(
    (task: SearchTask) => {
      if (task.dueDate) {
        const focusDate = fromDateKey(task.dueDate);
        if (focusDate) {
          handleSidebarFocusDateChange(focusDate);
          setSidebarJumpRequestId((requestId) => requestId + 1);
        }
      }

      onSelectTask(task.id);
    },
    [handleSidebarFocusDateChange, onSelectTask],
  );

  function handleSidebarSelectDate(date: Date) {
    handleSidebarFocusDateChange(date);
    setSidebarJumpRequestId((requestId) => requestId + 1);
  }

  const handleSidebarGoToToday = useCallback(() => {
    const today = startOfDay(new Date());
    handleSidebarFocusDateChange(today);
    setSidebarJumpRequestId((requestId) => requestId + 1);
  }, [handleSidebarFocusDateChange]);

  function goToPreviousSidebarMonth() {
    setSidebarMonthDate((previous) =>
      startOfDay(new Date(previous.getFullYear(), previous.getMonth() - 1, 1)),
    );
  }

  function goToNextSidebarMonth() {
    setSidebarMonthDate((previous) =>
      startOfDay(new Date(previous.getFullYear(), previous.getMonth() + 1, 1)),
    );
  }

  const sidebarSyncProps = {
    sidebarFocusDate,
    sidebarJumpRequestId,
    onSidebarFocusDateChange: handleSidebarFocusDateChange,
  };

  function wrapViewWithSidebar(
    view: ReactNode,
    options: {
      sidebarPosition?: "left" | "right";
      sidebarMinViewportWidth?: number;
    } = {},
  ) {
    const { sidebarPosition = "right", sidebarMinViewportWidth = 1800 } =
      options;

    return (
      <CalendarViewSidebarLayout
        tasks={tasks}
        focusDate={sidebarFocusDate}
        monthDate={sidebarMonthDate}
        onPreviousMonth={goToPreviousSidebarMonth}
        onNextMonth={goToNextSidebarMonth}
        onGoToToday={handleSidebarGoToToday}
        onSelectDate={handleSidebarSelectDate}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onToggleTask={onToggleTask}
        checkAnimatingTaskIds={checkAnimatingTaskIds}
        searchQuery={searchQuery}
        searchTasks={calendarSearchTasks}
        onSelectSearchTask={handleCalendarSearchSelect}
        onDetailsSaved={onDetailsSaved}
        onTaskHasDetailsKnown={onTaskHasDetailsKnown}
        onTaskRenamed={onTaskRenamed}
        onDueDateUpdated={onDueDateUpdated}
        onRecurrenceUpdated={onRecurrenceUpdated}
        onSaveTaskRecurrence={onSaveTaskRecurrence}
        sidebarPosition={sidebarPosition}
        sidebarMinViewportWidth={sidebarMinViewportWidth}
        sidebarOpen={sidebarOpen}
      >
        {view}
      </CalendarViewSidebarLayout>
    );
  }

  return (
    <CalendarTaskColorMenuProvider
      onSetTaskCalendarColor={onSetTaskCalendarColor}
    >
    <CalendarTaskHoverPreviewProvider
      positionFromCursor={activeView === "day"}
      cursorOffsetPx={50}
    >
    <CalendarTaskModalActionsProvider value={calendarTaskModalActions}>
    <div className="calendar-panel flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <CalendarViewTabs
        activeView={activeView}
        multiDayCount={multiDayCount}
        multiWeekCount={multiWeekCount}
        onMultiDayCountChange={handleMultiDayCountChange}
        onMultiWeekCountChange={handleMultiWeekCountChange}
        onChange={handleActiveViewChange}
        periodLabel={periodLabel}
        periodLabelSuffix={periodLabelSuffix}
        periodSubLabel={periodSubLabel}
        monthNavigation={monthNavigation}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        periodLabelAction={periodLabelAction}
        headerTrailingAction={headerTrailingAction}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {activeView === "month" ? (
        wrapViewWithSidebar(
          <CalendarMonthView
            tasks={tasks}
            lists={lists}
            completingTaskIds={completingTaskIds}
            completingWithoutBackgroundTaskIds={
              completingWithoutBackgroundTaskIds
            }
            checkAnimatingTaskIds={checkAnimatingTaskIds}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onToggleTask={onToggleTask}
            onSetTaskDueDate={onSetTaskDueDate}
            onSetTaskDueTime={onSetTaskDueTime}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
            onRecurrenceUpdated={onRecurrenceUpdated}
            onSaveTaskRecurrence={onSaveTaskRecurrence}
            onAddCalendarTask={onAddCalendarTask}
            defaultListId={defaultListId}
            fullWidth={fullWidth}
            externalDropTargetDateKey={externalDropTargetDateKey}
            onPeriodLabelChange={handlePeriodLabelChange}
            onMonthNavigationChange={setMonthNavigation}
            {...sidebarSyncProps}
          />,
        )
      ) : activeView === "week" ? (
        wrapViewWithSidebar(
          <CalendarWeekView
            tasks={tasks}
            lists={lists}
            completingTaskIds={completingTaskIds}
            checkAnimatingTaskIds={checkAnimatingTaskIds}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onToggleTask={onToggleTask}
            onSetTaskDueDate={onSetTaskDueDate}
            onSetTaskDueTime={onSetTaskDueTime}
            onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
            onRecurrenceUpdated={onRecurrenceUpdated}
            onSaveTaskRecurrence={onSaveTaskRecurrence}
            onAddCalendarTask={onAddCalendarTask}
            defaultListId={defaultListId}
            fullWidth={fullWidth}
            externalDropTargetDateKey={externalDropTargetDateKey}
            externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
            externalDraggingTaskId={externalDraggingTaskId}
            externalDraggingTaskName={externalDraggingTaskName}
            onPeriodLabelChange={handlePeriodLabelChange}
            {...sidebarSyncProps}
          />,
          { sidebarMinViewportWidth: 1950 },
        )
      ) : activeView === "day" ? (
        wrapViewWithSidebar(
          <CalendarDayView
            tasks={tasks}
            lists={lists}
            completingTaskIds={completingTaskIds}
            checkAnimatingTaskIds={checkAnimatingTaskIds}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onToggleTask={onToggleTask}
            onSetTaskDueDate={onSetTaskDueDate}
            onSetTaskDueTime={onSetTaskDueTime}
            onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
            onRecurrenceUpdated={onRecurrenceUpdated}
            onSaveTaskRecurrence={onSaveTaskRecurrence}
            onAddCalendarTask={onAddCalendarTask}
            defaultListId={defaultListId}
            externalDropTargetDateKey={externalDropTargetDateKey}
            externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
            externalDraggingTaskId={externalDraggingTaskId}
            externalDraggingTaskName={externalDraggingTaskName}
            onPeriodLabelChange={handlePeriodLabelChange}
            {...sidebarSyncProps}
          />,
        )
      ) : activeView === "days" ? (
        wrapViewWithSidebar(
          <CalendarMultiDayView
            tasks={tasks}
            lists={lists}
            selectedTaskId={selectedTaskId}
            dayCount={multiDayCount}
            onSelectTask={onSelectTask}
            onToggleTask={onToggleTask}
            completingTaskIds={completingTaskIds}
            checkAnimatingTaskIds={checkAnimatingTaskIds}
            onSetTaskDueDate={onSetTaskDueDate}
            onSetTaskDueTime={onSetTaskDueTime}
            onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
            onRecurrenceUpdated={onRecurrenceUpdated}
            onSaveTaskRecurrence={onSaveTaskRecurrence}
            onAddCalendarTask={onAddCalendarTask}
            defaultListId={defaultListId}
            fullWidth={fullWidth}
            externalDropTargetDateKey={externalDropTargetDateKey}
            externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
            externalDraggingTaskId={externalDraggingTaskId}
            externalDraggingTaskName={externalDraggingTaskName}
            onPeriodLabelChange={handlePeriodLabelChange}
            {...sidebarSyncProps}
          />,
        )
      ) : activeView === "weeks" ? (
        wrapViewWithSidebar(
          multiWeekCount === 2 ? (
            <CalendarWeekView
              tasks={tasks}
              lists={lists}
              completingTaskIds={completingTaskIds}
              checkAnimatingTaskIds={checkAnimatingTaskIds}
              selectedTaskId={selectedTaskId}
              weekCount={2}
              onSelectTask={onSelectTask}
              onToggleTask={onToggleTask}
              onSetTaskDueDate={onSetTaskDueDate}
              onSetTaskDueTime={onSetTaskDueTime}
              onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
              onDetailsSaved={onDetailsSaved}
              onTaskHasDetailsKnown={onTaskHasDetailsKnown}
              onTaskRenamed={onTaskRenamed}
              onDueDateUpdated={onDueDateUpdated}
              onRecurrenceUpdated={onRecurrenceUpdated}
              onSaveTaskRecurrence={onSaveTaskRecurrence}
              onAddCalendarTask={onAddCalendarTask}
              defaultListId={defaultListId}
              fullWidth={fullWidth}
              externalDropTargetDateKey={externalDropTargetDateKey}
              externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
              externalDraggingTaskId={externalDraggingTaskId}
              externalDraggingTaskName={externalDraggingTaskName}
              onPeriodLabelChange={handlePeriodLabelChange}
              {...sidebarSyncProps}
            />
          ) : (
            <CalendarMultiWeekView
              tasks={tasks}
              lists={lists}
              selectedTaskId={selectedTaskId}
              weekCount={multiWeekCount}
              onSelectTask={onSelectTask}
              onToggleTask={onToggleTask}
              onSetTaskDueDate={onSetTaskDueDate}
              onSetTaskDueTime={onSetTaskDueTime}
              onDetailsSaved={onDetailsSaved}
              onTaskHasDetailsKnown={onTaskHasDetailsKnown}
              onTaskRenamed={onTaskRenamed}
              onDueDateUpdated={onDueDateUpdated}
              onRecurrenceUpdated={onRecurrenceUpdated}
              onSaveTaskRecurrence={onSaveTaskRecurrence}
              onAddCalendarTask={onAddCalendarTask}
              defaultListId={defaultListId}
              fullWidth={fullWidth}
              externalDropTargetDateKey={externalDropTargetDateKey}
              onPeriodLabelChange={handlePeriodLabelChange}
              {...sidebarSyncProps}
            />
          ),
        )
      ) : (
        <CalendarViewPlaceholder label={activeViewLabel} />
      )}
      </div>
    </div>
    </CalendarTaskModalActionsProvider>
    </CalendarTaskHoverPreviewProvider>
    </CalendarTaskColorMenuProvider>
  );
}

export function CalendarPanel({
  tasks,
  searchTasks,
  lists,
  completingTaskIds,
  completingWithoutBackgroundTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
  onToggleTask,
  onSelectTask,
  onRenameTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskDueDateAndTime,
  onSetTaskPriority,
  onSetTaskCalendarColor,
  onToggleTaskLabel,
  onLabelsChanged,
  onMoveTaskToList,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onAddCalendarTask,
  defaultListId,
  defaultView = "week",
  view,
  onViewChange,
  multiDayCount,
  multiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  persistViewSession = true,
  periodLabelAction,
  headerTrailingAction,
  labels = [],
  onDeleteTask,
}: CalendarPanelProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950 calendar-panel">
      <CalendarViewsPanel
        tasks={tasks}
        searchTasks={searchTasks}
        lists={lists}
        completingTaskIds={completingTaskIds}
        completingWithoutBackgroundTaskIds={
          completingWithoutBackgroundTaskIds
        }
        checkAnimatingTaskIds={checkAnimatingTaskIds}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onToggleTask={onToggleTask}
        onSetTaskDueDate={onSetTaskDueDate}
        onSetTaskDueTime={onSetTaskDueTime}
        onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
        onSetTaskCalendarColor={onSetTaskCalendarColor}
        onSetTaskPriority={onSetTaskPriority}
        onToggleTaskLabel={onToggleTaskLabel}
        onLabelsChanged={onLabelsChanged}
        onMoveTaskToList={onMoveTaskToList}
        labels={labels}
        onDeleteTask={onDeleteTask}
        onDetailsSaved={onDetailsSaved}
        onTaskHasDetailsKnown={onTaskHasDetailsKnown}
        onTaskRenamed={onTaskRenamed}
        onDueDateUpdated={onDueDateUpdated}
        onRecurrenceUpdated={onRecurrenceUpdated}
        onSaveTaskRecurrence={onSaveTaskRecurrence}
        onAddCalendarTask={onAddCalendarTask}
        defaultListId={defaultListId}
        defaultView={defaultView}
        view={view}
        onViewChange={onViewChange}
        multiDayCount={multiDayCount}
        multiWeekCount={multiWeekCount}
        onMultiDayCountChange={onMultiDayCountChange}
        onMultiWeekCountChange={onMultiWeekCountChange}
        persistViewSession={persistViewSession}
        periodLabelAction={periodLabelAction}
        headerTrailingAction={headerTrailingAction}
      />
    </section>
  );
}
