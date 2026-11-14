"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { IoIosSearch } from "react-icons/io";
import {
  MdKeyboardDoubleArrowLeft,
  MdKeyboardDoubleArrowRight,
} from "react-icons/md";
import {
  type CalendarStartTaskOptions,
  type StartCalendarTaskRequest,
  toCalendarDueDateKey,
} from "@/lib/calendar-start-task";
import {
  type CalendarTaskEditorCallbacks,
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
import { getCalendarModalNavigableTaskIds } from "@/lib/calendar-task-search";
import { CalendarMultiWeekView } from "./calendar-weeks-view";
import {
  CALENDAR_MONTH_SIDEBAR_DEFAULT_MIN_VIEWPORT_PX,
  CALENDAR_SIDEBAR_WIDTH_CLASS,
  CalendarViewSidebarLayout,
  getCalendarSidebarVisibilityClass,
  getCalendarSidebarWidthClass,
  getInitialCalendarSidebarOpen,
  shouldDefaultCalendarSidebarOpen,
  type CalendarSidebarSyncProps,
} from "./calendar-view-sidebar-layout";
import { useListCalendarOverlapLayout } from "./list-calendar-overlap-shell";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarMonthCellCurrentTimeLine } from "./calendar-current-time-line";
import { CalendarTaskMoveUndoProvider } from "./calendar-task-move-undo";
import {
  CalendarDateNavigationUndoProvider,
  parseCalendarDateNavigationAnchor,
  useApplyCalendarDateNavigationRestore,
  useRecordCalendarDateNavigation,
  useSyncCalendarDateNavigationAnchor,
} from "./calendar-date-navigation-undo";
import type {
  CalendarDateNavigationPanelState,
  CalendarDateNavigationSnapshot,
} from "@/lib/calendar-date-navigation-undo";
import { buildCalendarAllDayTaskMoveSnapshot } from "@/lib/calendar-task-move-undo";
import { useRecordCalendarTaskMove } from "./calendar-task-move-undo";
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
  type CalendarTaskDragState,
} from "@/lib/calendar-task-drag";
import { getCalendarShellClassName, calendarAllDayTaskClassName, getCalendarTaskItemStyle, isCalendarTaskPast, CALENDAR_WEEKDAY_LABELS, getCalendarMonthDayColumnDividerClass, CALENDAR_MONTH_CELL_BORDER_CLASS, CALENDAR_MONTH_SELECTED_CELL_CLASS, CALENDAR_TODAY_DATE_CIRCLE_CLASS, CALENDAR_CURRENT_MONTH_DAY_NUMBER_CLASS, CALENDAR_FOLLOWING_MONTH_DAY_NUMBER_CLASS, getCalendarTimedGridScrollClassName, CALENDAR_MONTH_CELL_TASKS_SCROLL_CLASS } from "@/lib/calendar-layout";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import {
  patchCalendarViewSession,
  readCalendarViewSession,
  type CalendarViewTab,
} from "@/lib/calendar-view-settings";
import {
  LIST_CALENDAR_MULTI_DAY_DEFAULT,
  LIST_CALENDAR_MULTI_WEEK_DEFAULT,
} from "@/lib/todo-routes";

export type { CalendarViewTab };

function readStoredCalendarFocusDate(): Date {
  const stored = readCalendarViewSession();
  if (stored?.focusDateKey) {
    const parsed = fromDateKey(stored.focusDateKey);
    if (parsed) return startOfDay(parsed);
  }

  return startOfDay(new Date());
}

function readStoredCalendarDaysRangeStart(): Date | null {
  const stored = readCalendarViewSession();
  if (!stored?.daysRangeStartKey) return null;

  const parsed = fromDateKey(stored.daysRangeStartKey);
  return parsed ? startOfDay(parsed) : null;
}

function readStoredCalendarSidebarMonth(): Date {
  const stored = readCalendarViewSession();
  if (stored?.sidebarMonthKey) {
    const parsed = fromDateKey(stored.sidebarMonthKey);
    if (parsed) {
      return startOfDay(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }

  const focus = readStoredCalendarFocusDate();
  return startOfDay(new Date(focus.getFullYear(), focus.getMonth(), 1));
}

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
  {
    id: "days",
    label: "Days",
    min: 2,
    max: 30,
    defaultValue: LIST_CALENDAR_MULTI_DAY_DEFAULT,
  },
  {
    id: "weeks",
    label: "Weeks",
    min: 2,
    max: 12,
    defaultValue: LIST_CALENDAR_MULTI_WEEK_DEFAULT,
  },
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
  onStartCalendarTask?: (
    payload: StartCalendarTaskRequest,
  ) => Promise<string | null> | string | null;
  defaultListId?: string | null;
  defaultView?: CalendarViewTab;
  view?: CalendarViewTab;
  onViewChange?: (view: CalendarViewTab) => void;
  multiDayCount?: number;
  multiWeekCount?: number;
  onMultiDayCountChange?: (count: number) => void;
  onMultiWeekCountChange?: (count: number) => void;
  persistViewSession?: boolean;
  embeddedInCalendarModal?: boolean;
  /** Full-page `/calendar` route (not list-embedded calendar). */
  standaloneCalendar?: boolean;
  periodLabelAction?: ReactNode;
  headerTrailingAction?: ReactNode;
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
  sidebarMinViewportWidth,
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
  sidebarMinViewportWidth: number;
  onSidebarOpenChange: (open: boolean) => void;
}) {
  const listCalendarOverlap = useListCalendarOverlapLayout();
  const sidebarWidthClass = getCalendarSidebarWidthClass(
    listCalendarOverlap?.isOverlapLayout ?? false,
  );
  const sidebarSearchVisibilityClass = sidebarOpen
    ? getCalendarSidebarVisibilityClass(sidebarMinViewportWidth)
    : "hidden";
  const tabButtonClassName = (isActive: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[14px] transition-colors hover:bg-[#F2F5F7] cursor-pointer ${
      isActive
        ? "bg-[#e8F2F6] text-zinc-750 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  const listCalendarLayoutToggle =
    listCalendarOverlap?.canToggleLayout ? (
      <button
        type="button"
        aria-label={
          listCalendarOverlap.isOverlapLayout
            ? "Move calendar to default layout"
            : "Dock calendar over task list"
        }
        title={
          listCalendarOverlap.isOverlapLayout
            ? "Default calendar layout"
            : "Dock calendar over task list"
        }
        onClick={listCalendarOverlap.toggleLayout}
        className="flex size-6.5 -mt-[15px] -ml-2 shrink-0 cursor-pointer items-center justify-center self-center rounded-full bg-slate-100 text-zinc-600 transition-colors hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {listCalendarOverlap.isOverlapLayout ? (
          <BiChevronRight className="size-5" aria-hidden="true" />
        ) : (
          <BiChevronLeft className="size-5" aria-hidden="true" />
        )}
      </button>
    ) : null;

  return (
    <div className={`relative z-40 ${activeView === "month" ? "mb-[16px]" : "mb-[3px]"} grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 pl-2 pt-0`}>
      {periodLabel || listCalendarLayoutToggle ? (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {listCalendarLayoutToggle}
            {periodLabel ? (
              <>
                <h2 className="truncate text-lg text-zinc-700 dark:text-zinc-50 text-[23px]">
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
                      className="flex size-[27px] items-center justify-center cursor-pointer rounded-full bg-[#f7f7f9] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <BiChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={monthNavigation.goToNextMonth}
                      className="flex size-[27px] items-center justify-center cursor-pointer rounded-full bg-[#f7f7f9] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <BiChevronRight className="size-5" />
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          {periodSubLabel ? (
            <p
              className={`truncate text-sm font-normal text-zinc-600 dark:text-zinc-400 ${
                listCalendarLayoutToggle ? "pl-11" : ""
              }`}
            >
              {periodSubLabel}
            </p>
          ) : null}
        </div>
      ) : (
        <div />
      )}
      <div className="calendar-view-tabs inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full bg-white px-1 py-1 border border-slate-50 ">
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
      <div
        className={`ml-auto flex min-w-0 items-center justify-end gap-1.5 -mt-[2px] pl-[7px] ${
          sidebarOpen ? sidebarWidthClass : ""
        }`}
      >
        {sidebarOpen ? (
          <label
            className={`relative flex ${sidebarSearchVisibilityClass} h-[33px] min-w-0 flex-1 items-center rounded-full border border-zinc-200 bg-[#fafafd] px-3 dark:border-zinc-700 dark:bg-zinc-900`}
          >
            <IoIosSearch
              className="size-[15px] shrink-0 text-zinc-400 dark:text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search"
              aria-label="Search calendar tasks"
              className="h-[32px] min-w-0 flex-1 appearance-none bg-transparent py-0 pl-2 text-[14.5px] leading-9 text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            />
          </label>
        ) : null}
        <button
          type="button"
          aria-label={sidebarOpen ? "Close calendar sidebar" : "Open calendar sidebar"}
          onClick={() => onSidebarOpenChange(!sidebarOpen)}
          className="group flex size-7.5 shrink-0 cursor-pointer items-center -mt-4 justify-center rounded-full text-zinc-450 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {sidebarOpen ? (
            <MdKeyboardDoubleArrowRight className="size-4" aria-hidden="true" />
          ) : (
            <MdKeyboardDoubleArrowLeft className="size-4" aria-hidden="true" />
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
  onCloseTaskEditor,
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
  onStartCalendarTask,
  defaultListId = null,
  fullWidth = false,
  externalDropTargetDateKey = null,
  onPeriodLabelChange,
  onMonthNavigationChange,
  sidebarFocusDate,
  sidebarJumpRequestId,
  onSidebarFocusDateChange,
  dateNavigationRestoreRequestId,
  dateNavigationRestoreSnapshot,
}: {
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds?: Set<string>;
  completingWithoutBackgroundTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onCloseTaskEditor?: () => void;
  onToggleTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
} & CalendarTaskEditorCallbacks & {
  onStartCalendarTask?: (
    options: CalendarStartTaskOptions,
  ) => void | Promise<void>;
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

  function closeTaskModal() {
    onCloseTaskEditor?.();
  }
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(
    null,
  );
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const suppressTaskClickRef = useRef(false);
  const lastSidebarJumpRequestIdRef = useRef<number | undefined>(undefined);
  const { beginTaskDrag, endDragPreview } = useCalendarTaskDragPreview();
  const recordCalendarTaskMove = useRecordCalendarTaskMove();
  const recordCalendarDateNavigation = useRecordCalendarDateNavigation();
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();

  useSyncCalendarDateNavigationAnchor(monthDate);

  const applyDateNavigationRestore = useCallback(
    (snapshot: CalendarDateNavigationSnapshot) => {
      const anchor = parseCalendarDateNavigationAnchor(snapshot);
      const focus = fromDateKey(snapshot.focusDateKey);
      if (anchor) {
        setMonthDate(anchor);
      }
      if (focus) {
        setSelectedDate(startOfDay(focus));
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
    const currentDay = startOfDay(new Date());
    const focusDay =
      sidebarFocusDate !== undefined
        ? startOfDay(sidebarFocusDate)
        : currentDay;

    setToday(currentDay);
    setMonthDate(
      startOfDay(new Date(focusDay.getFullYear(), focusDay.getMonth(), 1)),
    );
    setSelectedDate(focusDay);
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
  const monthGridRef = useRef<HTMLDivElement>(null);
  const [monthNowLineLayout, setMonthNowLineLayout] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const monthTodayIndex = useMemo(() => {
    if (!today) return -1;
    return monthDays.findIndex((day) => isSameDay(day, today));
  }, [monthDays, today]);

  const updateMonthNowLineTop = useCallback(() => {
    const grid = monthGridRef.current;
    if (!grid || !now || monthTodayIndex < 0) {
      setMonthNowLineLayout(null);
      return;
    }

    const todayKey = toDateKey(today!);
    const cell = grid.querySelector<HTMLElement>(
      `[data-calendar-day="${todayKey}"]`,
    );
    if (!cell) {
      setMonthNowLineLayout(null);
      return;
    }

    const dayProgress =
      (now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60) /
      (24 * 60);
    const dateHeaderReservePx = 28;
    const contentHeight = Math.max(0, cell.offsetHeight - dateHeaderReservePx - 4);
    setMonthNowLineLayout({
      top: cell.offsetTop + dateHeaderReservePx + contentHeight * dayProgress,
      left: cell.offsetLeft,
      width: cell.offsetWidth,
    });
  }, [monthTodayIndex, now, today]);

  useLayoutEffect(() => {
    updateMonthNowLineTop();
  }, [monthDays, monthRowCount, updateMonthNowLineTop]);

  useEffect(() => {
    const grid = monthGridRef.current;
    if (!grid) return;

    const scrollParent = grid.closest<HTMLElement>(".calendar-grid-scroll");
    const handle = () => updateMonthNowLineTop();
    window.addEventListener("resize", handle);
    scrollParent?.addEventListener("scroll", handle, { passive: true });

    return () => {
      window.removeEventListener("resize", handle);
      scrollParent?.removeEventListener("scroll", handle);
    };
  }, [updateMonthNowLineTop]);

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
    recordCalendarDateNavigation?.();
    const nextMonthDate = startOfDay(
      new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
    );
    setMonthDate(nextMonthDate);
    syncSidebarFocusForMonth(nextMonthDate);
  }, [
    monthDate,
    onSidebarFocusDateChange,
    recordCalendarDateNavigation,
    selectedDate,
  ]);

  const handleGoToNextMonth = useCallback(() => {
    if (!monthDate) return;
    recordCalendarDateNavigation?.();
    const nextMonthDate = startOfDay(
      new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
    );
    setMonthDate(nextMonthDate);
    syncSidebarFocusForMonth(nextMonthDate);
  }, [
    monthDate,
    onSidebarFocusDateChange,
    recordCalendarDateNavigation,
    selectedDate,
  ]);

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

  function handleDaySelect(day: Date) {
    const normalized = startOfDay(day);
    const focusDate = sidebarFocusDate ?? selectedDate;
    if (!focusDate || !isSameDay(focusDate, normalized)) {
      recordCalendarDateNavigation?.();
    }
    setSelectedDate(normalized);
    onSidebarFocusDateChange?.(normalized);
    closeTaskModal();
  }

  function isFocusedMonthDay(day: Date) {
    const focusDate = sidebarFocusDate ?? selectedDate;
    return focusDate !== null && isSameDay(day, focusDate);
  }

  function handleDayDoubleClick(
    _event: React.MouseEvent<HTMLDivElement>,
    day: Date,
  ) {
    setSelectedDate(day);
    closeTaskModal();

    if (!onStartCalendarTask || lists.length === 0) return;

    void onStartCalendarTask({ date: day, dueTimeMinutes: null });
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
        const moveSnapshot = buildCalendarAllDayTaskMoveSnapshot(
          task,
          dragState.sourceDateKey,
          targetDateKey,
        );
        if (moveSnapshot) {
          recordCalendarTaskMove?.(moveSnapshot);
        }
        onSetTaskDueDate(dragState.taskId, targetDateKey);
        const targetDate = fromDateKey(targetDateKey);
        if (targetDate) {
          setSelectedDate(targetDate);
        }
      }

      dragStateRef.current = null;
      setDropTargetDateKey(null);
      if (dragStarted) {
        suppressTaskClickRef.current = true;
      }
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
          sourceTimeMinutes: null,
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
  }, [monthDate]);

  useEffect(() => {
    if (!monthDate) return;
    onPeriodLabelChange?.(formatMonthYear(monthDate));
  }, [monthDate, onPeriodLabelChange]);

  if (!monthDate || !selectedDate || !today) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`grid shrink-0 grid-cols-7 pb-2 ${CALENDAR_MONTH_CELL_BORDER_CLASS}`}>
          <div className="col-span-7 h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="min-h-0 flex-1 animate-pulse bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  const monthGridScrollClassName = getCalendarTimedGridScrollClassName(fullWidth);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className={monthGridScrollClassName}>
          <div className="relative min-h-full">
            <div
              className={`sticky top-0 z-10 grid shrink-0 grid-cols-7 bg-white pb-2 dark:bg-zinc-950 ${CALENDAR_MONTH_CELL_BORDER_CLASS} ${fullWidth ? "min-w-0" : ""}`}
            >
              {CALENDAR_WEEKDAY_LABELS.map((label, dayIndex) => (
                <div
                  key={label}
                  className={`min-w-0 px-2 text-center text-[14px] font-medium uppercase tracking-wide text-[#505c6e]! ${getCalendarMonthDayColumnDividerClass(dayIndex, CALENDAR_WEEKDAY_LABELS.length)}`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              ref={monthGridRef}
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
              const viewMonthKey =
                monthDate.getFullYear() * 12 + monthDate.getMonth();
              const dayMonthKey = day.getFullYear() * 12 + day.getMonth();
              const isCurrentMonth = dayMonthKey === viewMonthKey;
              const isFollowingMonth = dayMonthKey > viewMonthKey;

              const isDropTarget =
                dropTargetDateKey === dateKey ||
                externalDropTargetDateKey === dateKey;

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
                  className={`flex h-full min-h-0 cursor-pointer flex-col py-[5px] pl-[5px] pr-[5px] text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${CALENDAR_MONTH_CELL_BORDER_CLASS} ${getCalendarMonthDayColumnDividerClass(index % 7, 7)} ${
                    isDropTarget
                      ? "bg-blue-50 dark:bg-blue-950/30 dark:ring-blue-500"
                      : isSelected
                          ? CALENDAR_MONTH_SELECTED_CELL_CLASS
                          : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <span
                    className={`inline-flex w-6.5 h-6.5 shrink-0 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? CALENDAR_TODAY_DATE_CIRCLE_CLASS
                        : isCurrentMonth
                          ? CALENDAR_CURRENT_MONTH_DAY_NUMBER_CLASS
                          : isFollowingMonth
                            ? CALENDAR_FOLLOWING_MONTH_DAY_NUMBER_CLASS
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

                  <div
                    className={`mt-1 min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto ${CALENDAR_MONTH_CELL_TASKS_SCROLL_CLASS}`}
                  >
                    {dayTasks.map((task) => (
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
                  </div>
                </div>
              );
            })}
            </div>
            {monthTodayIndex >= 0 && monthNowLineLayout ? (
              <CalendarMonthCellCurrentTimeLine
                top={monthNowLineLayout.top}
                left={monthNowLineLayout.left}
                width={monthNowLineLayout.width}
              />
            ) : null}
          </div>
        </div>
        </div>

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
  onStartCalendarTask?: (
    payload: StartCalendarTaskRequest,
  ) => Promise<string | null> | string | null;
  defaultListId?: string | null;
  defaultView?: CalendarViewTab;
  view?: CalendarViewTab;
  onViewChange?: (view: CalendarViewTab) => void;
  multiDayCount?: number;
  multiWeekCount?: number;
  onMultiDayCountChange?: (count: number) => void;
  onMultiWeekCountChange?: (count: number) => void;
  persistViewSession?: boolean;
  embeddedInCalendarModal?: boolean;
  standaloneCalendar?: boolean;
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
  onStartCalendarTask,
  defaultListId = null,
  defaultView = "week",
  view,
  onViewChange,
  multiDayCount: controlledMultiDayCount,
  multiWeekCount: controlledMultiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  persistViewSession = true,
  embeddedInCalendarModal = false,
  standaloneCalendar = false,
  fullWidth = false,
  externalDropTargetDateKey = null,
  externalDropTargetTimeMinutes = null,
  externalDraggingTaskId = null,
  externalDraggingTaskName = null,
  periodLabelAction,
  headerTrailingAction,
}: CalendarViewsPanelProps) {
  const listCalendarOverlap = useListCalendarOverlapLayout();
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
      ?.defaultValue ?? LIST_CALENDAR_MULTI_DAY_DEFAULT,
  );
  const [internalMultiWeekCount, setInternalMultiWeekCount] = useState(
    MULTI_CALENDAR_VIEW_OPTIONS.find((option) => option.id === "weeks")
      ?.defaultValue ?? LIST_CALENDAR_MULTI_WEEK_DEFAULT,
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
  const [sidebarMonthDate, setSidebarMonthDate] = useState(
    readStoredCalendarSidebarMonth,
  );
  const [sidebarFocusDate, setSidebarFocusDate] = useState(
    readStoredCalendarFocusDate,
  );
  const [daysViewRangeStart, setDaysViewRangeStart] = useState<Date | null>(
    readStoredCalendarDaysRangeStart,
  );
  const [sidebarJumpRequestId, setSidebarJumpRequestId] = useState(0);
  const [dateNavigationRestoreRequestId, setDateNavigationRestoreRequestId] =
    useState(0);
  const [dateNavigationRestoreSnapshot, setDateNavigationRestoreSnapshot] =
    useState<CalendarDateNavigationSnapshot | null>(null);
  const recordCalendarDateNavigationRef = useRef<(() => void) | null>(null);
  const panelNavigationStateRef = useRef<CalendarDateNavigationPanelState>({
    focusDateKey: toDateKey(sidebarFocusDate),
    sidebarMonthKey: toDateKey(sidebarMonthDate),
    daysRangeStartKey: null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    getInitialCalendarSidebarOpen(
      view ??
        readCalendarViewSession()?.activeView ??
        defaultView,
      { standaloneCalendar },
    ),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const previousActiveViewRef = useRef<CalendarViewTab | null>(null);
  const sidebarMinViewportWidth =
    activeView === "week"
      ? 1950
      : activeView === "month"
        ? CALENDAR_MONTH_SIDEBAR_DEFAULT_MIN_VIEWPORT_PX
        : 1800;

  useEffect(() => {
    const previousView = previousActiveViewRef.current;
    previousActiveViewRef.current = activeView;

    if (previousView === null || previousView === activeView) {
      return;
    }

    if (
      activeView === "month" &&
      !shouldDefaultCalendarSidebarOpen({
        activeView: "month",
        viewportWidth: window.innerWidth,
        standaloneCalendar,
      })
    ) {
      setSidebarOpen(false);
    }
  }, [activeView, standaloneCalendar]);

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
  const [taskEditorModalId, setTaskEditorModalId] = useState<string | null>(
    null,
  );
  const [newCalendarTaskDraftId, setNewCalendarTaskDraftId] = useState<
    string | null
  >(null);
  const closeTaskEditorModal = useCallback(() => {
    setTaskEditorModalId(null);
    setNewCalendarTaskDraftId(null);
  }, []);
  const handleCalendarSelectTask = useCallback(
    (taskId: string) => {
      onSelectTask(taskId);
      setTaskEditorModalId(taskId);
    },
    [onSelectTask],
  );
  const handleStartCalendarTask = useCallback(
    async (options: CalendarStartTaskOptions) => {
      if (!onStartCalendarTask) return;

      const listId = defaultListId ?? lists[0]?.id ?? null;
      if (!listId) return;

      const taskId = await onStartCalendarTask({
        dueDate: toCalendarDueDateKey(options.date),
        listId,
        dueTimeMinutes: options.dueTimeMinutes ?? null,
      });

      if (taskId) {
        setNewCalendarTaskDraftId(taskId);
        handleCalendarSelectTask(taskId);
      }
    },
    [defaultListId, handleCalendarSelectTask, lists, onStartCalendarTask],
  );
  const calendarModalNavigableTaskIds = useMemo(
    () => getCalendarModalNavigableTaskIds(tasks, sidebarFocusDate),
    [sidebarFocusDate, tasks],
  );

  const handleCalendarModalNavigateTask = useCallback(
    (taskId: string) => {
      onSelectTask(taskId);
      setTaskEditorModalId(taskId);
    },
    [onSelectTask],
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
    const stored = readCalendarViewSession();
    if (persistViewSession && stored) {
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
    if (!calendarViewSessionReady) return;

    patchCalendarViewSession({
      ...(persistViewSession
        ? { activeView, multiDayCount, multiWeekCount }
        : {}),
      focusDateKey: toDateKey(sidebarFocusDate),
      daysRangeStartKey:
        daysViewRangeStart !== null ? toDateKey(daysViewRangeStart) : undefined,
      sidebarMonthKey: toDateKey(sidebarMonthDate),
    });
  }, [
    activeView,
    calendarViewSessionReady,
    daysViewRangeStart,
    multiDayCount,
    multiWeekCount,
    persistViewSession,
    sidebarFocusDate,
    sidebarMonthDate,
  ]);

  const activeViewLabel =
    activeView === "days"
      ? `days (${multiDayCount} days)`
      : activeView === "weeks"
        ? `Weeks (${multiWeekCount} weeks)`
        : (CALENDAR_VIEW_TABS.find((tab) => tab.id === activeView)?.label ??
          activeView);

  panelNavigationStateRef.current = {
    focusDateKey: toDateKey(sidebarFocusDate),
    sidebarMonthKey: toDateKey(sidebarMonthDate),
    daysRangeStartKey: daysViewRangeStart
      ? toDateKey(daysViewRangeStart)
      : null,
  };

  const handleRestoreCalendarDateNavigation = useCallback(
    (snapshot: CalendarDateNavigationSnapshot) => {
      const focus = fromDateKey(snapshot.focusDateKey);
      if (focus) {
        setSidebarFocusDate(startOfDay(focus));
      }

      const month = fromDateKey(snapshot.sidebarMonthKey);
      if (month) {
        setSidebarMonthDate(
          startOfDay(new Date(month.getFullYear(), month.getMonth(), 1)),
        );
      }

      if (snapshot.daysRangeStartKey) {
        const rangeStart = fromDateKey(snapshot.daysRangeStartKey);
        if (rangeStart) {
          setDaysViewRangeStart(startOfDay(rangeStart));
        }
      } else {
        setDaysViewRangeStart(null);
      }

      setDateNavigationRestoreSnapshot(snapshot);
      setDateNavigationRestoreRequestId((requestId) => requestId + 1);
    },
    [],
  );

  function recordCalendarDateNavigation() {
    recordCalendarDateNavigationRef.current?.();
  }

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
          recordCalendarDateNavigation();
          handleSidebarFocusDateChange(focusDate);
          setSidebarJumpRequestId((requestId) => requestId + 1);
        }
      }

      handleCalendarSelectTask(task.id);
    },
    [handleCalendarSelectTask, handleSidebarFocusDateChange],
  );

  function handleSidebarSelectDate(date: Date) {
    recordCalendarDateNavigation();
    handleSidebarFocusDateChange(date);
    setSidebarJumpRequestId((requestId) => requestId + 1);
  }

  const handleSidebarGoToToday = useCallback(() => {
    recordCalendarDateNavigation();
    const today = startOfDay(new Date());
    handleSidebarFocusDateChange(today);
    setSidebarJumpRequestId((requestId) => requestId + 1);
  }, [handleSidebarFocusDateChange]);

  useEffect(() => {
    if (activeView !== "days") return;
    setDaysViewRangeStart((current) => current ?? startOfDay(new Date()));
  }, [activeView]);

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
    dateNavigationRestoreRequestId,
    dateNavigationRestoreSnapshot,
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
        centerModalTaskId={taskEditorModalId}
        centerModalIsNewTaskDraft={taskEditorModalId === newCalendarTaskDraftId}
        onCenterModalNewTaskDraftComplete={() => setNewCalendarTaskDraftId(null)}
        onCloseCenterModal={closeTaskEditorModal}
        centerModalNavigableTaskIds={calendarModalNavigableTaskIds}
        onCenterModalNavigateTask={handleCalendarModalNavigateTask}
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
    <CalendarTaskMoveUndoProvider
      onSetTaskDueDate={onSetTaskDueDate}
      onSetTaskDueTime={onSetTaskDueTime}
      onSetTaskDueDateAndTime={onSetTaskDueDateAndTime}
    >
    <CalendarDateNavigationUndoProvider
      getPanelNavigationState={() => panelNavigationStateRef.current}
      onRestore={handleRestoreCalendarDateNavigation}
      recordRef={recordCalendarDateNavigationRef}
    >
    <div
      className={`calendar-panel flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden pt-1.5 pb-3 pl-2 z-50! ${
        fullWidth ? "pr-2" : ""
      } ${listCalendarOverlap?.isOverlapLayout ? "min-w-0" : ""}`}
    >
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
        sidebarMinViewportWidth={sidebarMinViewportWidth}
        onSidebarOpenChange={setSidebarOpen}
      />
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          listCalendarOverlap?.isOverlapLayout ? "w-full" : ""
        }`}
      >
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
            onSelectTask={handleCalendarSelectTask}
            onCloseTaskEditor={closeTaskEditorModal}
            onToggleTask={onToggleTask}
            onSetTaskDueDate={onSetTaskDueDate}
            onSetTaskDueTime={onSetTaskDueTime}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
            onRecurrenceUpdated={onRecurrenceUpdated}
            onSaveTaskRecurrence={onSaveTaskRecurrence}
            onStartCalendarTask={handleStartCalendarTask}
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
            onSelectTask={handleCalendarSelectTask}
            onCloseTaskEditor={closeTaskEditorModal}
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
            onStartCalendarTask={handleStartCalendarTask}
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
            onSelectTask={handleCalendarSelectTask}
            onCloseTaskEditor={closeTaskEditorModal}
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
            onStartCalendarTask={handleStartCalendarTask}
            defaultListId={defaultListId}
            embeddedInCalendarModal={embeddedInCalendarModal}
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
            onSelectTask={handleCalendarSelectTask}
            onCloseTaskEditor={closeTaskEditorModal}
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
            onStartCalendarTask={handleStartCalendarTask}
            defaultListId={defaultListId}
            embeddedInCalendarModal={embeddedInCalendarModal}
            fullWidth={fullWidth}
            externalDropTargetDateKey={externalDropTargetDateKey}
            externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
            externalDraggingTaskId={externalDraggingTaskId}
            externalDraggingTaskName={externalDraggingTaskName}
            onPeriodLabelChange={handlePeriodLabelChange}
            visibleRangeStart={daysViewRangeStart}
            onVisibleRangeStartChange={setDaysViewRangeStart}
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
              onSelectTask={handleCalendarSelectTask}
              onCloseTaskEditor={closeTaskEditorModal}
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
              onStartCalendarTask={handleStartCalendarTask}
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
              onSelectTask={handleCalendarSelectTask}
              onCloseTaskEditor={closeTaskEditorModal}
              onToggleTask={onToggleTask}
              onSetTaskDueDate={onSetTaskDueDate}
              onSetTaskDueTime={onSetTaskDueTime}
              onDetailsSaved={onDetailsSaved}
              onTaskHasDetailsKnown={onTaskHasDetailsKnown}
              onTaskRenamed={onTaskRenamed}
              onDueDateUpdated={onDueDateUpdated}
              onRecurrenceUpdated={onRecurrenceUpdated}
              onSaveTaskRecurrence={onSaveTaskRecurrence}
              onStartCalendarTask={handleStartCalendarTask}
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

    </CalendarDateNavigationUndoProvider>
    </CalendarTaskMoveUndoProvider>
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
  onStartCalendarTask,
  defaultListId,
  defaultView = "week",
  view,
  onViewChange,
  multiDayCount,
  multiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  persistViewSession = true,
  embeddedInCalendarModal = false,
  standaloneCalendar = true,
  periodLabelAction,
  headerTrailingAction,
  labels = [],
  onDeleteTask,
}: CalendarPanelProps) {
  return (
    <section className="relative z-[4000] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950 calendar-panel">
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
        onStartCalendarTask={onStartCalendarTask}
        defaultListId={defaultListId}
        defaultView={defaultView}
        view={view}
        onViewChange={onViewChange}
        multiDayCount={multiDayCount}
        multiWeekCount={multiWeekCount}
        onMultiDayCountChange={onMultiDayCountChange}
        onMultiWeekCountChange={onMultiWeekCountChange}
        persistViewSession={persistViewSession}
        embeddedInCalendarModal={embeddedInCalendarModal}
        standaloneCalendar={standaloneCalendar}
        periodLabelAction={periodLabelAction}
        headerTrailingAction={headerTrailingAction}
      />
    </section>
  );
}
