"use client";

import { useCallback, useMemo, useState } from "react";
import type { SearchTask, TaskListItem } from "./todo-app";
import {
  CalendarTaskModal,
  getCalendarTaskSnapshot,
  type CalendarTaskEditorCallbacks,
} from "./calendar-task-modal";
import {
  CalendarMiniMonth,
  buildTasksByDate,
  formatSelectedDay,
  getMonthCalendarRange,
  startOfDay,
} from "./calendar-mini-month";
import {
  formatCalendarTaskDueDateLabel,
  getCalendarSearchResultKey,
  getCalendarSidebarSearchResults,
  getCalendarSidebarUpcomingTasks,
  groupCalendarSidebarTasksByDate,
} from "@/lib/calendar-task-search";
import {
  TaskCompletionCheckbox,
} from "./task-completion-checkbox";
import {
  formatDueTimeLabel,
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
  searchQuery?: string;
  searchTasks?: SearchTask[];
  onSelectSearchTask?: (task: SearchTask) => void;
  sidebarPosition?: "left" | "right";
  sidebarMinViewportWidth?: number;
  sidebarOpen?: boolean;
  children: React.ReactNode;
} & CalendarTaskEditorCallbacks;

function getSidebarVisibilityClass(minViewportWidth: number) {
  if (minViewportWidth >= 1950) {
    return "hidden min-[1951px]:flex";
  }

  return "hidden min-[1801px]:flex";
}

function CalendarSidebarDayTasks({
  focusDate,
  tasks,
  selectedTaskId,
  onOpenTask,
  onToggleTask,
  checkAnimatingTaskIds,
}: {
  focusDate: Date;
  tasks: TaskListItem[];
  selectedTaskId?: string | null;
  onOpenTask?: (taskId: string) => void;
  onToggleTask?: (taskId: string) => void;
  checkAnimatingTaskIds?: Set<string>;
}) {
  const taskGroups = useMemo(() => {
    const upcomingTasks = getCalendarSidebarUpcomingTasks(tasks, focusDate);
    return groupCalendarSidebarTasksByDate(upcomingTasks);
  }, [focusDate, tasks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {taskGroups.length === 0 ? (
          <p className="px-1 py-2 text-sm text-zinc-400 dark:text-zinc-500">
            No tasks scheduled
          </p>
        ) : (
          <div className="flex flex-col">
            {taskGroups.map((group, groupIndex) => (
              <section
                key={group.dateKey}
                aria-label={group.label}
                className={groupIndex > 0 ? "mt-2 border-t border-[#f0f0f0] pt-2" : ""}
              >
                <h4 className="sticky top-0 z-10 bg-white px-1 py-1 text-[11px] font-medium text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
                  {group.label}
                </h4>
                <ul className="flex flex-col gap-1">
                  {group.tasks.map((task) => {
                    const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
                    const isSelected = task.id === selectedTaskId;

                    return (
                      <li key={getCalendarSearchResultKey(task)}>
                        <button
                          type="button"
                          onClick={() => onOpenTask?.(task.id)}
                          className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer ${
                            isSelected ? "bg-zinc-100 dark:bg-zinc-900" : ""
                          }`}
                        >
                          {onToggleTask ? (
                            <div className="flex shrink-0 items-center">
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
                            <span className="block truncate text-sm leading-5 text-zinc-700 dark:text-zinc-100">
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarSidebarSearchResults({
  query,
  searchTasks,
  focusDate,
  selectedTaskId,
  onOpenTask,
  onToggleTask,
  checkAnimatingTaskIds,
  onSelectSearchTask,
}: {
  query: string;
  searchTasks: SearchTask[];
  focusDate: Date;
  selectedTaskId?: string | null;
  onOpenTask?: (taskId: string) => void;
  onToggleTask?: (taskId: string) => void;
  checkAnimatingTaskIds?: Set<string>;
  onSelectSearchTask?: (task: SearchTask) => void;
}) {
  const trimmedQuery = query.trim();

  const results = useMemo(
    () => getCalendarSidebarSearchResults(searchTasks, query, focusDate),
    [focusDate, query, searchTasks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {trimmedQuery ? (
          <>
            <h4 className="truncate text-[12px] font-medium text-zinc-600 dark:text-zinc-200">
              “{trimmedQuery}”
            </h4>
            <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">
              From {formatSelectedDay(focusDate)}
            </p>
          </>
        ) : (
          <h4 className="truncate text-[12px] font-medium text-zinc-600 dark:text-zinc-200">
            Search results
          </h4>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {!trimmedQuery ? (
          <p className="px-1 py-2 text-sm text-zinc-400 dark:text-zinc-500">
            Type in the search field to find scheduled tasks.
          </p>
        ) : results.length === 0 ? (
          <p className="px-1 py-2 text-sm text-zinc-400 dark:text-zinc-500">
            No scheduled tasks match your search from this date onward.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {results.map((task) => {
              const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
              const dueDateLabel = task.dueDate
                ? formatCalendarTaskDueDateLabel(task.dueDate)
                : null;
              const scheduleLabel = dueTimeLabel
                ? `${dueDateLabel ?? "Scheduled"} · ${dueTimeLabel}`
                : dueDateLabel;
              const isSelected = task.id === selectedTaskId;

              return (
                <li key={getCalendarSearchResultKey(task)}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSearchTask?.(task);
                      onOpenTask?.(task.id);
                    }}
                    className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer ${
                      isSelected ? "bg-zinc-100 dark:bg-zinc-900" : ""
                    }`}
                  >
                    {onToggleTask ? (
                      <div className="flex shrink-0 items-center">
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
                      <span className="block truncate text-sm leading-5 text-zinc-700 dark:text-zinc-100">
                        {task.name}
                      </span>
                      {scheduleLabel ? (
                        <span className="mt-0.5 block truncate text-[11px] leading-none tabular-nums text-zinc-400 dark:text-zinc-500">
                          {scheduleLabel}
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
  searchQuery = "",
  searchTasks = [],
  onSelectSearchTask,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  sidebarPosition = "right",
  sidebarMinViewportWidth = 1800,
  sidebarOpen = true,
  children,
}: CalendarViewSidebarLayoutProps) {
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);

  const handleOpenSidebarTask = useCallback(
    (taskId: string) => {
      onSelectTask?.(taskId);
      setModalTaskId(taskId);
    },
    [onSelectTask],
  );

  const modalTaskSnapshot = useMemo(
    () => (modalTaskId ? getCalendarTaskSnapshot(modalTaskId, tasks) : null),
    [modalTaskId, tasks],
  );

  const today = useMemo(() => startOfDay(new Date()), []);
  const calendarRange = useMemo(
    () => getMonthCalendarRange(monthDate),
    [monthDate],
  );
  const tasksByDate = useMemo(
    () => buildTasksByDate(tasks, calendarRange),
    [tasks, calendarRange],
  );
  const isSearching = searchQuery.trim().length > 0;

  const sidebarVisibilityClass = sidebarOpen
    ? getSidebarVisibilityClass(sidebarMinViewportWidth)
    : "hidden";

  const sidebar = sidebarOpen ? (
    <aside
      className={`${sidebarVisibilityClass} flex min-h-0 w-[260px] shrink-0 flex-col bg-white dark:bg-zinc-950 ${
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
      {isSearching ? (
        <CalendarSidebarSearchResults
          query={searchQuery}
          searchTasks={searchTasks}
          focusDate={focusDate}
          selectedTaskId={selectedTaskId}
          onOpenTask={handleOpenSidebarTask}
          onToggleTask={onToggleTask}
          checkAnimatingTaskIds={checkAnimatingTaskIds}
          onSelectSearchTask={onSelectSearchTask}
        />
      ) : (
        <CalendarSidebarDayTasks
          focusDate={focusDate}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onOpenTask={handleOpenSidebarTask}
          onToggleTask={onToggleTask}
          checkAnimatingTaskIds={checkAnimatingTaskIds}
        />
      )}
    </aside>
  ) : null;

  const main = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );

  return (
    <>
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

      {modalTaskId ? (
        <CalendarTaskModal
          taskId={modalTaskId}
          taskSnapshot={modalTaskSnapshot}
          onClose={() => setModalTaskId(null)}
          onDetailsSaved={onDetailsSaved}
          onTaskHasDetailsKnown={onTaskHasDetailsKnown}
          onTaskRenamed={onTaskRenamed}
          onDueDateUpdated={onDueDateUpdated}
          onRecurrenceUpdated={onRecurrenceUpdated}
          onSaveTaskRecurrence={onSaveTaskRecurrence}
          onToggleTask={onToggleTask}
        />
      ) : null}
    </>
  );
}
