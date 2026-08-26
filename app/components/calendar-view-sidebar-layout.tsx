"use client";

import { useMemo } from "react";
import type { TaskListItem } from "./todo-app";
import {
  CalendarMiniMonth,
  buildTasksByDate,
  formatSelectedDay,
  getMonthCalendarRange,
  startOfDay,
  toDateKey,
} from "./calendar-mini-month";
import {
  getCalendarTaskKey,
} from "@/lib/calendar-recurring-tasks";
import {
  TaskCompletionCheckbox,
} from "./task-completion-checkbox";
import {
  formatDueTimeLabel,
  normalizeDueTimeMinutes,
} from "@/lib/task-due-time";

export type CalendarSidebarSyncProps = {
  sidebarFocusDate?: Date;
  sidebarJumpRequestId?: number;
  onSidebarFocusDateChange?: (date: Date) => void;
};

type CalendarViewSidebarLayoutProps = {
  tasks: TaskListItem[];
  focusDate: Date;
  monthDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onSelectDate: (date: Date) => void;
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onToggleTask?: (taskId: string) => void;
  checkAnimatingTaskIds?: Set<string>;
  sidebarPosition?: "left" | "right";
  sidebarMinViewportWidth?: number;
  children: React.ReactNode;
};

function getSidebarVisibilityClass(minViewportWidth: number) {
  if (minViewportWidth >= 1950) {
    return "hidden min-[1951px]:flex";
  }

  return "hidden min-[1801px]:flex";
}

function CalendarSidebarDayTasks({
  focusDate,
  dayTasks,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  checkAnimatingTaskIds,
}: {
  focusDate: Date;
  dayTasks: TaskListItem[];
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onToggleTask?: (taskId: string) => void;
  checkAnimatingTaskIds?: Set<string>;
}) {
  const sortedDayTasks = useMemo(
    () =>
      [...dayTasks].sort((a, b) => {
        const aMinutes = normalizeDueTimeMinutes(a.dueTimeMinutes);
        const bMinutes = normalizeDueTimeMinutes(b.dueTimeMinutes);

        if (aMinutes === null && bMinutes === null) {
          return a.name.localeCompare(b.name);
        }
        if (aMinutes === null) return -1;
        if (bMinutes === null) return 1;

        return aMinutes - bMinutes || a.name.localeCompare(b.name);
      }),
    [dayTasks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h4 className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {formatSelectedDay(focusDate)}
        </h4>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sortedDayTasks.length === 0 ? (
          <p className="px-1 py-2 text-sm text-zinc-400 dark:text-zinc-500">
            No tasks scheduled
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sortedDayTasks.map((task) => {
              const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
              const isSelected = task.id === selectedTaskId;

              return (
                <li key={getCalendarTaskKey(task)}>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    className={`flex w-full gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                      isSelected ? "bg-zinc-100 dark:bg-zinc-900" : ""
                    }`}
                  >
                    {onToggleTask ? (
                      <div className="flex h-5 shrink-0 items-center">
                        <TaskCompletionCheckbox
                          variant="box"
                          checkKey={task.id}
                          checked={task.completed}
                          onChange={() => onToggleTask(task.id)}
                          onClick={(event) => event.stopPropagation()}
                          animateCheck={checkAnimatingTaskIds?.has(task.id)}
                          aria-label={`Mark ${task.name} complete`}
                        />
                      </div>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-5 text-zinc-800 dark:text-zinc-100">
                        {task.name}
                      </span>
                      {dueTimeLabel ? (
                        <span className="mt-0.5 block text-[11px] leading-none tabular-nums text-zinc-400 dark:text-zinc-500">
                          {dueTimeLabel}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CalendarViewSidebarLayout({
  tasks,
  focusDate,
  monthDate,
  onPreviousMonth,
  onNextMonth,
  onGoToToday,
  onSelectDate,
  selectedTaskId = null,
  onSelectTask,
  onToggleTask,
  checkAnimatingTaskIds,
  sidebarPosition = "right",
  sidebarMinViewportWidth = 1800,
  children,
}: CalendarViewSidebarLayoutProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const calendarRange = useMemo(
    () => getMonthCalendarRange(monthDate),
    [monthDate],
  );
  const tasksByDate = useMemo(
    () => buildTasksByDate(tasks, calendarRange),
    [tasks, calendarRange],
  );
  const focusDateKey = toDateKey(focusDate);
  const focusDayTasks = tasksByDate.get(focusDateKey) ?? [];

  const sidebarVisibilityClass = getSidebarVisibilityClass(
    sidebarMinViewportWidth,
  );

  const sidebar = (
    <aside
      className={`${sidebarVisibilityClass} min-h-0 w-[260px] shrink-0 flex-col bg-white dark:bg-zinc-950 ${
        sidebarPosition === "left"
          ? "border-r border-zinc-200 dark:border-zinc-800"
          : "border-l border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <CalendarMiniMonth
        monthDate={monthDate}
        selectedDate={focusDate}
        today={today}
        tasksByDate={tasksByDate}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onGoToToday={onGoToToday}
        onSelectDate={onSelectDate}
      />
      <CalendarSidebarDayTasks
        focusDate={focusDate}
        dayTasks={focusDayTasks}
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
        onToggleTask={onToggleTask}
        checkAnimatingTaskIds={checkAnimatingTaskIds}
      />
    </aside>
  );

  const main = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {sidebarPosition === "left" ? (
        <>
          {sidebar}
          {main}
        </>
      ) : (
        <>
          {main}
          {sidebar}
        </>
      )}
    </div>
  );
}
