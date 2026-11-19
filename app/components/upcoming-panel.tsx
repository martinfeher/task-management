"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { LuCalendarDays, LuChevronDown, LuMenu } from "react-icons/lu";
import { buildTasksByDateForRange } from "@/lib/calendar-recurring-tasks";
import { getTaskDueDateKey } from "@/lib/calendar-task-drag";
import { addDays, startOfLocalDay, toDateKey } from "@/lib/task-due-date";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import { parseRecurrenceRule } from "@/lib/task-recurrence";
import {
  buildTasksByDate,
  CalendarMiniMonth,
  formatMonthYear,
  getMonthCalendarRange,
} from "./calendar-mini-month";
import { CalendarPeriodNavigation } from "./calendar-period-navigation";
import { ListKanbanPanel, type KanbanBoardColumn } from "./list-kanban-panel";
import type { TaskListItem } from "./todo-app";

const OVERDUE_COLUMN_ID = "overdue";
const GAP_COLUMN_ID_PREFIX = "gap:";
/** Days rendered when the page opens. */
const UPCOMING_INITIAL_DAY_COUNT = 20;
/** Days appended each time the user scrolls near the end of the board. */
const UPCOMING_LOAD_MORE_DAY_COUNT = 14;
/** Furthest point recurring tasks are projected to. */
const UPCOMING_MAX_DAYS_AHEAD = 365;
/** Days the previous/next buttons move the window by. */
const UPCOMING_NAVIGATION_STEP_DAYS = 7;
/** Consecutive empty days needed before they are merged into one column. */
const UPCOMING_MIN_GAP_DAY_COUNT = 2;
/** Most days revealed at once when a merged range is expanded. */
const UPCOMING_MAX_EXPANDED_GAP_DAYS = 31;
const MS_PER_DAY = 86_400_000;

const columnDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const columnWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

type UpcomingPanelProps = Omit<
  ComponentProps<typeof ListKanbanPanel>,
  | "list"
  | "header"
  | "columns"
  | "tasksByColumnId"
  | "showTaskListName"
  | "canAddTaskToColumn"
  | "onAddColumn"
  | "onRemoveColumn"
  | "onRenameColumn"
  | "onAddTask"
  | "onMoveTask"
  | "onOpenSidebar"
  | "showSidebarMenu"
  | "onBoardNearEnd"
  | "boardScrollResetToken"
> & {
  onAddTask: (dateKey: string, name: string) => Promise<void> | void;
  onMoveTaskToDate: (taskId: string, dateKey: string) => Promise<void> | void;
  showSidebarMenu?: boolean;
  onOpenSidebar?: () => void;
};

function daysBetween(from: Date, to: Date) {
  return Math.round(
    (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) /
      MS_PER_DAY,
  );
}

function formatGapRangeLabel(start: Date, end: Date) {
  const startLabel = columnDateFormatter.format(start);
  const endLabel =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
      ? String(end.getDate())
      : columnDateFormatter.format(end);

  return `${startLabel} – ${endLabel}`;
}

function formatDayColumnName(day: Date, today: Date) {
  const offset = daysBetween(today, day);
  const relative =
    offset === 0
      ? "Today"
      : offset === 1
        ? "Tomorrow"
        : columnWeekdayFormatter.format(day);

  return `${columnDateFormatter.format(day)} · ${relative}`;
}

function compareByDueTime(a: TaskListItem, b: TaskListItem) {
  const aTime = normalizeDueTimeMinutes(a.dueTimeMinutes);
  const bTime = normalizeDueTimeMinutes(b.dueTimeMinutes);
  if (aTime === bTime) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime;
}

export function UpcomingPanel({
  tasks,
  onAddTask,
  onMoveTaskToDate,
  showSidebarMenu = false,
  onOpenSidebar,
  ...kanbanProps
}: UpcomingPanelProps) {
  const todayKey = toDateKey(new Date());
  const today = useMemo(
    () => startOfLocalDay(new Date(`${todayKey}T12:00:00`)),
    [todayKey],
  );
  const [startDate, setStartDate] = useState(today);
  const [loadedDayCount, setLoadedDayCount] = useState(
    UPCOMING_INITIAL_DAY_COUNT,
  );
  const [expandedGapKeys, setExpandedGapKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [scrollResetToken, setScrollResetToken] = useState(0);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [monthPickerDate, setMonthPickerDate] = useState(today);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMonthPickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (monthPickerRef.current?.contains(event.target as Node)) return;
      setIsMonthPickerOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMonthPickerOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMonthPickerOpen]);

  const isViewingToday = toDateKey(startDate) === todayKey;

  const days = useMemo(
    () =>
      Array.from({ length: loadedDayCount }, (_, index) =>
        addDays(startDate, index),
      ),
    [loadedDayCount, startDate],
  );

  // Everything is already in memory, so "is there more?" is answered from the
  // tasks themselves: recurring tasks repeat up to a fixed horizon, one-off
  // tasks only count until their own due date.
  const { hasMoreDays, maxDayCount } = useMemo(() => {
    let hasRecurring = false;
    let lastOneOffKey: string | null = null;

    for (const task of tasks) {
      if (task.completed) continue;
      const dueKey = getTaskDueDateKey(task.dueDate);
      if (!dueKey) continue;

      if (parseRecurrenceRule(task.recurrenceRule)) {
        hasRecurring = true;
      } else if (!lastOneOffKey || dueKey > lastOneOffKey) {
        lastOneOffKey = dueKey;
      }
    }

    const horizonKey = toDateKey(addDays(today, UPCOMING_MAX_DAYS_AHEAD));
    const lastReachableKey =
      lastOneOffKey && lastOneOffKey > horizonKey ? lastOneOffKey : horizonKey;
    const lastLoadedKey = toDateKey(days[days.length - 1]);

    return {
      maxDayCount: Math.max(
        UPCOMING_INITIAL_DAY_COUNT,
        daysBetween(startDate, new Date(`${lastReachableKey}T12:00:00`)) + 1,
      ),
      hasMoreDays:
        lastLoadedKey < lastReachableKey &&
        (hasRecurring ||
          (lastOneOffKey !== null && lastOneOffKey > lastLoadedKey)),
    };
  }, [days, startDate, tasks, today]);

  const loadMoreDays = useCallback(() => {
    if (!hasMoreDays) return;
    setLoadedDayCount((current) =>
      Math.min(current + UPCOMING_LOAD_MORE_DAY_COUNT, maxDayCount),
    );
  }, [hasMoreDays, maxDayCount]);

  const { columns, tasksByColumnId } = useMemo(() => {
    const byDate = buildTasksByDateForRange(tasks, {
      start: days[0],
      end: days[days.length - 1],
    });
    const nextColumns: KanbanBoardColumn[] = [];
    const grouped = new Map<string, TaskListItem[]>();

    if (isViewingToday) {
      const overdue = tasks.filter((task) => {
        const dueKey = getTaskDueDateKey(task.dueDate);
        return dueKey !== null && dueKey < todayKey;
      });

      if (overdue.length > 0) {
        nextColumns.push({ id: OVERDUE_COLUMN_ID, name: "Overdue" });
        grouped.set(OVERDUE_COLUMN_ID, overdue);
      }
    }

    function pushDayColumn(day: Date) {
      const dateKey = toDateKey(day);
      nextColumns.push({ id: dateKey, name: formatDayColumnName(day, today) });
      grouped.set(
        dateKey,
        [...(byDate.get(dateKey) ?? [])].sort(compareByDueTime),
      );
    }

    function pushGapColumn(run: Date[]) {
      const first = run[0];
      const firstKey = toDateKey(first);
      nextColumns.push({
        id: `${GAP_COLUMN_ID_PREFIX}${firstKey}`,
        name: formatGapRangeLabel(first, run[run.length - 1]),
        gap: {
          dayCount: run.length,
          onExpand: () =>
            setExpandedGapKeys((current) => new Set(current).add(firstKey)),
        },
      });
    }

    function flushEmptyRun(run: Date[]) {
      if (run.length === 0) return;

      if (run.length < UPCOMING_MIN_GAP_DAY_COUNT) {
        run.forEach(pushDayColumn);
        return;
      }

      if (!expandedGapKeys.has(toDateKey(run[0]))) {
        pushGapColumn(run);
        return;
      }

      const revealed = run.slice(0, UPCOMING_MAX_EXPANDED_GAP_DAYS);
      const remaining = run.slice(UPCOMING_MAX_EXPANDED_GAP_DAYS);
      revealed.forEach(pushDayColumn);
      if (remaining.length >= UPCOMING_MIN_GAP_DAY_COUNT) {
        pushGapColumn(remaining);
      } else {
        remaining.forEach(pushDayColumn);
      }
    }

    // Days with tasks (and today) always get their own column; consecutive
    // empty days are merged into a single "no tasks" range.
    let emptyRun: Date[] = [];
    for (const day of days) {
      const dateKey = toDateKey(day);
      const isEmpty =
        dateKey !== todayKey && (byDate.get(dateKey)?.length ?? 0) === 0;

      if (isEmpty) {
        emptyRun.push(day);
        continue;
      }

      flushEmptyRun(emptyRun);
      emptyRun = [];
      pushDayColumn(day);
    }
    flushEmptyRun(emptyRun);

    return { columns: nextColumns, tasksByColumnId: grouped };
  }, [days, expandedGapKeys, isViewingToday, tasks, today, todayKey]);

  const monthPickerTasksByDate = useMemo(
    () =>
      isMonthPickerOpen
        ? buildTasksByDate(tasks, getMonthCalendarRange(monthPickerDate))
        : new Map<string, TaskListItem[]>(),
    [isMonthPickerOpen, monthPickerDate, tasks],
  );

  const goToDate = useCallback(
    (date: Date) => {
      const next = startOfLocalDay(date);
      setStartDate(next.getTime() < today.getTime() ? today : next);
      setLoadedDayCount(UPCOMING_INITIAL_DAY_COUNT);
      setExpandedGapKeys(new Set());
      setScrollResetToken((token) => token + 1);
    },
    [today],
  );

  const goToPreviousPeriod = useCallback(() => {
    goToDate(addDays(startDate, -UPCOMING_NAVIGATION_STEP_DAYS));
  }, [goToDate, startDate]);

  const goToNextPeriod = useCallback(() => {
    goToDate(addDays(startDate, UPCOMING_NAVIGATION_STEP_DAYS));
  }, [goToDate, startDate]);

  const goToToday = useCallback(() => {
    goToDate(new Date());
  }, [goToDate]);

  function toggleMonthPicker() {
    setMonthPickerDate(startDate);
    setIsMonthPickerOpen((open) => !open);
  }

  const header = (
    <header className="flex shrink-0 flex-col border-b border-zinc-200 px-4 pt-2 pb-1 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        {showSidebarMenu ? (
          <button
            type="button"
            aria-label="Open menu"
            className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            onClick={onOpenSidebar}
          >
            <LuMenu className="size-5" aria-hidden="true" />
          </button>
        ) : null}
        <LuCalendarDays
          className="size-[18px] shrink-0 ptxt-list-nav-today-icon"
          aria-hidden="true"
        />
        <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Upcoming
        </h1>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div ref={monthPickerRef} className="relative">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isMonthPickerOpen}
            onClick={toggleMonthPicker}
            className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {formatMonthYear(startDate)}
            <LuChevronDown className="size-3.5" aria-hidden="true" />
          </button>
          {isMonthPickerOpen ? (
            <div className="absolute top-full left-0 z-50 mt-1 w-[272px] rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <CalendarMiniMonth
                monthDate={monthPickerDate}
                selectedDate={startDate}
                today={today}
                tasksByDate={monthPickerTasksByDate}
                onPreviousMonth={() =>
                  setMonthPickerDate(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() - 1, 1, 12),
                  )
                }
                onNextMonth={() =>
                  setMonthPickerDate(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() + 1, 1, 12),
                  )
                }
                onGoToToday={() => {
                  goToToday();
                  setIsMonthPickerOpen(false);
                }}
                onSelectDate={(day) => {
                  goToDate(day);
                  setIsMonthPickerOpen(false);
                }}
              />
            </div>
          ) : null}
        </div>
        <CalendarPeriodNavigation
          onPrevious={goToPreviousPeriod}
          onNext={goToNextPeriod}
          onToday={goToToday}
          previousLabel="Previous week"
          nextLabel="Next week"
          enableArrowKeyNavigation
        />
      </div>
    </header>
  );

  return (
    <ListKanbanPanel
      {...kanbanProps}
      header={header}
      tasks={tasks}
      columns={columns}
      tasksByColumnId={tasksByColumnId}
      onBoardNearEnd={hasMoreDays ? loadMoreDays : undefined}
      boardScrollResetToken={scrollResetToken}
      showTaskListName
      canAddTaskToColumn={(columnId) =>
        columnId !== OVERDUE_COLUMN_ID &&
        !columnId.startsWith(GAP_COLUMN_ID_PREFIX)
      }
      onAddTask={onAddTask}
      onMoveTask={(taskId, targetColumnId, _targetIndex, sourceColumnId) => {
        if (
          targetColumnId === OVERDUE_COLUMN_ID ||
          targetColumnId.startsWith(GAP_COLUMN_ID_PREFIX) ||
          targetColumnId === sourceColumnId
        ) {
          return;
        }
        return onMoveTaskToDate(taskId, targetColumnId);
      }}
    />
  );
}
