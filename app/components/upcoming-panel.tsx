"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import { LuCalendarDays, LuChevronDown, LuMenu } from "react-icons/lu";
import { buildTasksByDateForRange } from "@/lib/calendar-recurring-tasks";
import { getTaskDueDateKey } from "@/lib/calendar-task-drag";
import { addDays, startOfLocalDay, toDateKey } from "@/lib/task-due-date";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
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
const UPCOMING_DAY_COUNT_STORAGE_KEY = "upcoming-day-count";
const UPCOMING_DAY_COUNT_OPTIONS = [1, 3, 5, 7, 14] as const;
const UPCOMING_DAY_COUNT_DEFAULT = 7;

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
> & {
  onAddTask: (dateKey: string, name: string) => Promise<void> | void;
  onMoveTaskToDate: (taskId: string, dateKey: string) => Promise<void> | void;
  showSidebarMenu?: boolean;
  onOpenSidebar?: () => void;
};

const dayCountListeners = new Set<() => void>();

function subscribeToDayCount(listener: () => void) {
  dayCountListeners.add(listener);
  return () => {
    dayCountListeners.delete(listener);
  };
}

function readStoredDayCount() {
  try {
    const stored = Number.parseInt(
      window.localStorage.getItem(UPCOMING_DAY_COUNT_STORAGE_KEY) ?? "",
      10,
    );
    return UPCOMING_DAY_COUNT_OPTIONS.some((option) => option === stored)
      ? stored
      : UPCOMING_DAY_COUNT_DEFAULT;
  } catch {
    return UPCOMING_DAY_COUNT_DEFAULT;
  }
}

function writeStoredDayCount(count: number) {
  try {
    window.localStorage.setItem(UPCOMING_DAY_COUNT_STORAGE_KEY, String(count));
  } catch {
    return;
  }
  dayCountListeners.forEach((listener) => listener());
}

function formatDayColumnName(day: Date, today: Date) {
  const offset = Math.round(
    (startOfLocalDay(day).getTime() - today.getTime()) / 86_400_000,
  );
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
  const dayCount = useSyncExternalStore(
    subscribeToDayCount,
    readStoredDayCount,
    () => UPCOMING_DAY_COUNT_DEFAULT,
  );
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
      Array.from({ length: dayCount }, (_, index) => addDays(startDate, index)),
    [dayCount, startDate],
  );

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

    for (const day of days) {
      const dateKey = toDateKey(day);
      nextColumns.push({ id: dateKey, name: formatDayColumnName(day, today) });
      grouped.set(
        dateKey,
        [...(byDate.get(dateKey) ?? [])].sort(compareByDueTime),
      );
    }

    return { columns: nextColumns, tasksByColumnId: grouped };
  }, [days, isViewingToday, tasks, today, todayKey]);

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
    },
    [today],
  );

  const goToPreviousPeriod = useCallback(() => {
    goToDate(addDays(startDate, -dayCount));
  }, [dayCount, goToDate, startDate]);

  const goToNextPeriod = useCallback(() => {
    goToDate(addDays(startDate, dayCount));
  }, [dayCount, goToDate, startDate]);

  const goToToday = useCallback(() => {
    goToDate(new Date());
  }, [goToDate]);

  function toggleMonthPicker() {
    setMonthPickerDate(startDate);
    setIsMonthPickerOpen((open) => !open);
  }

  const header = (
    <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 px-4 pt-3 pb-2 dark:border-zinc-800">
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
        <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Days
          <select
            value={dayCount}
            onChange={(event) =>
              writeStoredDayCount(Number.parseInt(event.target.value, 10))
            }
            className="cursor-pointer rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {UPCOMING_DAY_COUNT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
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
          previousLabel="Previous days"
          nextLabel="Next days"
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
      showTaskListName
      canAddTaskToColumn={(columnId) => columnId !== OVERDUE_COLUMN_ID}
      onAddTask={onAddTask}
      onMoveTask={(taskId, targetColumnId, _targetIndex, sourceColumnId) => {
        if (
          targetColumnId === OVERDUE_COLUMN_ID ||
          targetColumnId === sourceColumnId
        ) {
          return;
        }
        return onMoveTaskToDate(taskId, targetColumnId);
      }}
    />
  );
}
