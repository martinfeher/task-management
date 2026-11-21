"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getCalendarModalNavigableTaskIds,
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
import { useCalendarHoveredTaskId } from "./calendar-task-hover-preview";
import { CalendarModalNavigationTaskPreview } from "./calendar-modal-navigation-task-preview";
import { CALENDAR_SIDEBAR_HOVER_PREVIEW_CLEAR_MS } from "@/lib/calendar-sidebar-hover-preview";
import { rememberCalendarTaskOpenOrigin } from "@/lib/calendar-task-modal-position";
import type { ToggleTaskOptions } from "@/lib/toggle-task-options";
import { useListCalendarOverlapLayout } from "./list-calendar-overlap-shell";
import type { CalendarDateNavigationSnapshot } from "@/lib/calendar-date-navigation-undo";
import type { CalendarViewTab } from "@/lib/calendar-view-settings";
import {
  CALENDAR_SIDEBAR_SEARCH_HIGHLIGHT_CLASS,
  highlightSearchMatch,
} from "@/lib/highlight-search-match";

const CALENDAR_SIDEBAR_COMPLETE_UNDO_MS = 9000;

/** Month view keeps the task sidebar closed by default below this width (list calendar). */
export const CALENDAR_MONTH_SIDEBAR_DEFAULT_MIN_VIEWPORT_PX = 1700;

export type CalendarSidebarDefaultOptions = {
  activeView: CalendarViewTab;
  viewportWidth: number;
  /** `/calendar/*` full-page calendar — sidebar open by default in month view. */
  standaloneCalendar?: boolean;
};

export function shouldDefaultCalendarSidebarOpen(
  options: CalendarSidebarDefaultOptions,
): boolean;
export function shouldDefaultCalendarSidebarOpen(
  activeView: CalendarViewTab,
  viewportWidth: number,
  standaloneCalendar?: boolean,
): boolean;
export function shouldDefaultCalendarSidebarOpen(
  activeViewOrOptions: CalendarViewTab | CalendarSidebarDefaultOptions,
  viewportWidth?: number,
  standaloneCalendar = false,
) {
  const resolved: CalendarSidebarDefaultOptions =
    typeof activeViewOrOptions === "object"
      ? activeViewOrOptions
      : {
          activeView: activeViewOrOptions,
          viewportWidth: viewportWidth ?? 0,
          standaloneCalendar,
        };

  if (resolved.standaloneCalendar) {
    return true;
  }

  if (
    resolved.activeView === "month" &&
    resolved.viewportWidth < CALENDAR_MONTH_SIDEBAR_DEFAULT_MIN_VIEWPORT_PX
  ) {
    return false;
  }

  return true;
}

export function getInitialCalendarSidebarOpen(
  activeView: CalendarViewTab,
  options?: { standaloneCalendar?: boolean },
) {
  if (typeof window === "undefined") {
    return true;
  }

  return shouldDefaultCalendarSidebarOpen({
    activeView,
    viewportWidth: window.innerWidth,
    standaloneCalendar: options?.standaloneCalendar,
  });
}

const CALENDAR_SIDEBAR_TASK_ROW_BUTTON_CLASS =
  "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

export type CalendarSidebarSyncProps = {
  sidebarFocusDate?: Date;
  sidebarJumpRequestId?: number;
  onSidebarFocusDateChange?: (date: Date) => void;
  dateNavigationRestoreRequestId?: number;
  dateNavigationRestoreSnapshot?: CalendarDateNavigationSnapshot | null;
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
  onToggleTask?: (taskId: string, options?: ToggleTaskOptions) => void;
  checkAnimatingTaskIds?: Set<string>;
  searchQuery?: string;
  searchTasks?: SearchTask[];
  onSelectSearchTask?: (task: SearchTask) => void;
  sidebarPosition?: "left" | "right";
  sidebarMinViewportWidth?: number;
  sidebarOpen?: boolean;
  /** Centered modal from the grid when the sidebar layout modal is closed. */
  centerModalTaskId?: string | null;
  centerModalIsNewTaskDraft?: boolean;
  onCenterModalNewTaskDraftComplete?: () => void;
  onCloseCenterModal?: () => void;
  centerModalNavigableTaskIds?: string[];
  onCenterModalNavigateTask?: (taskId: string) => void;
  onExpandCenterModalToTaskPanel?: (taskId: string) => void | Promise<void>;
  children: React.ReactNode;
} & CalendarTaskEditorCallbacks;

/** Task sidebar is shown at all viewport widths when `sidebarOpen` is true. */
export function getCalendarSidebarVisibilityClass(_minViewportWidth?: number) {
  return "flex";
}

/** Width constraints shared by the calendar task sidebar and header search. */
export const CALENDAR_SIDEBAR_WIDTH_CLASS =
  "w-[min(220px,32vw)] min-w-[168px] max-w-[260px] shrink-0 -mt-[4px]";

/** Docked calendar-over-list layout: fixed width so the sidebar stays on-screen. */
export const CALENDAR_SIDEBAR_OVERLAP_WIDTH_PX = 200;

export const CALENDAR_SIDEBAR_OVERLAP_WIDTH_CLASS =
  "w-[200px] min-w-[168px] max-w-[200px] shrink-0";

export function getCalendarSidebarWidthClass(isOverlapLayout = false) {
  return isOverlapLayout
    ? CALENDAR_SIDEBAR_OVERLAP_WIDTH_CLASS
    : CALENDAR_SIDEBAR_WIDTH_CLASS;
}

function getCalendarSidebarTaskRowClassName({
  isActiveInModal,
  isSelected,
  isHighlightedFromCalendar,
}: {
  isActiveInModal: boolean;
  isSelected: boolean;
  isHighlightedFromCalendar: boolean;
}) {
  if (isActiveInModal || isSelected) {
    return "bg-[#f3f3f6] dark:bg-zinc-900";
  }

  if (isHighlightedFromCalendar) {
    return "bg-zinc-100 dark:bg-zinc-900";
  }

  return "";
}

function CalendarSidebarDayTasks({
  focusDate,
  tasks,
  selectedTaskId,
  onOpenTask,
  onToggleTask,
  checkAnimatingTaskIds,
  onHoverTaskStart,
  onHoverTaskEnd,
  activeModalTaskId,
}: {
  focusDate: Date;
  tasks: TaskListItem[];
  selectedTaskId?: string | null;
  onOpenTask?: (taskId: string) => void;
  onToggleTask?: (taskId: string, options?: ToggleTaskOptions) => void;
  checkAnimatingTaskIds?: Set<string>;
  onHoverTaskStart?: (taskId: string, anchor: HTMLElement) => void;
  onHoverTaskEnd?: () => void;
  activeModalTaskId?: string | null;
}) {
  const calendarHoveredTaskId = useCalendarHoveredTaskId();
  const taskGroups = useMemo(() => {
    const upcomingTasks = getCalendarSidebarUpcomingTasks(tasks, focusDate);
    return groupCalendarSidebarTasksByDate(upcomingTasks);
  }, [focusDate, tasks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {taskGroups.length === 0 ? (
          <div className="px-1 py-[5px]">
            <h4 className="pl-[3px] pr-1 pt-px pb-[1px] text-[12px] font-medium text-zinc-400 dark:text-zinc-500">
              {formatSelectedDay(focusDate)}
            </h4>
            <p className="mt-1 px-1 ml-[5px] text-[12.5px] text-zinc-350 dark:text-zinc-500">
              No tasks scheduled
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {taskGroups.map((group, groupIndex) => (
              <section
                key={group.dateKey}
                aria-label={group.label}
                className={groupIndex > 0 ? "mt-2 border-t border-[#f0f0f0] pt-1" : ""}
              >
                <h4 className="sticky top-0 mt-[4px] z-10 bg-white pl-[6px] pr-1 pt-[2px] pb-[3px] text-[11px] font-medium text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
                  {group.label}
                </h4>
                <ul className="flex flex-col gap-1">  
                  {group.tasks.map((task) => {
                    const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
                    const isSelected = task.id === selectedTaskId;
                    const isHighlightedFromCalendar =
                      task.id === calendarHoveredTaskId;
                    const isActiveInModal =
                      activeModalTaskId != null &&
                      task.id === activeModalTaskId;

                    return (
                      <li key={getCalendarSearchResultKey(task)}>
                        <button
                          type="button"
                          onClick={() => onOpenTask?.(task.id)}
                          onMouseEnter={(event) =>
                            onHoverTaskStart?.(task.id, event.currentTarget)
                          }
                          onMouseLeave={() => onHoverTaskEnd?.()}
                          className={`${CALENDAR_SIDEBAR_TASK_ROW_BUTTON_CLASS} flex w-full items-center gap-2 rounded-[18px] min-h-[40px] px-2.5 py-1 border border-[#f8f8fa] text-left transition-colors hover:bg-[#f4f4f8]! dark:hover:bg-zinc-900 cursor-pointer ${getCalendarSidebarTaskRowClassName(
                            {
                              isActiveInModal,
                              isSelected,
                              isHighlightedFromCalendar,
                            },
                          )}`}
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
                                className="calendar-sidebar-task-checkbox"
                                aria-label={`Mark ${task.name} complete`}
                              />
                            </div>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] leading-5 text-zinc-600 dark:text-zinc-100">
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
  onHoverTaskStart,
  onHoverTaskEnd,
  activeModalTaskId,
}: {
  query: string;
  searchTasks: SearchTask[];
  focusDate: Date;
  selectedTaskId?: string | null;
  onOpenTask?: (taskId: string) => void;
  onToggleTask?: (taskId: string, options?: ToggleTaskOptions) => void;
  checkAnimatingTaskIds?: Set<string>;
  onSelectSearchTask?: (task: SearchTask) => void;
  onHoverTaskStart?: (taskId: string, anchor: HTMLElement) => void;
  onHoverTaskEnd?: () => void;
  activeModalTaskId?: string | null;
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
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
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
              const isActiveInModal =
                activeModalTaskId != null && task.id === activeModalTaskId;

              return (
                <li key={getCalendarSearchResultKey(task)}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSearchTask?.(task);
                      onOpenTask?.(task.id);
                    }}
                    onMouseEnter={(event) =>
                      onHoverTaskStart?.(task.id, event.currentTarget)
                    }
                    onMouseLeave={() => onHoverTaskEnd?.()}
                    className={`${CALENDAR_SIDEBAR_TASK_ROW_BUTTON_CLASS} flex w-full items-center gap-2 rounded-[15px] min-h-[39px] px-2.5 py-1 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer ${getCalendarSidebarTaskRowClassName(
                      {
                        isActiveInModal,
                        isSelected,
                        isHighlightedFromCalendar: false,
                      },
                    )}`}
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
                          className="calendar-sidebar-task-checkbox"
                          aria-label={`Mark ${task.name} complete`}
                        />
                      </div>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-5 text-zinc-650 dark:text-zinc-100">
                        {highlightSearchMatch(
                          task.name,
                          trimmedQuery,
                          CALENDAR_SIDEBAR_SEARCH_HIGHLIGHT_CLASS,
                        )}
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
  centerModalTaskId = null,
  centerModalIsNewTaskDraft = false,
  onCenterModalNewTaskDraftComplete,
  onCloseCenterModal,
  centerModalNavigableTaskIds,
  onCenterModalNavigateTask,
  onExpandCenterModalToTaskPanel,
  children,
}: CalendarViewSidebarLayoutProps) {
  const listCalendarOverlap = useListCalendarOverlapLayout();
  const isListCalendarOverlapLayout =
    listCalendarOverlap?.isOverlapLayout ?? false;
  const sidebarWidthClass = getCalendarSidebarWidthClass(
    isListCalendarOverlapLayout,
  );

  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const sidebarTaskHoverPreviewClearTimerRef = useRef<number | null>(null);
  const [sidebarTaskHoverPreview, setSidebarTaskHoverPreview] = useState<{
    task: TaskListItem;
    anchorRect: DOMRect;
  } | null>(null);
  const calendarSidebarRef = useRef<HTMLElement | null>(null);

  // Remember which calendar item was activated so the task modal can animate
  // out of it. Capture phase: runs before the item's own click handler.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      rememberCalendarTaskOpenOrigin(event.target);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      rememberCalendarTaskOpenOrigin(event.target);
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarTaskHoverPreviewClearTimerRef.current !== null) {
        window.clearTimeout(sidebarTaskHoverPreviewClearTimerRef.current);
      }
    };
  }, []);

  const cancelSidebarTaskHoverPreviewClear = useCallback(() => {
    if (sidebarTaskHoverPreviewClearTimerRef.current !== null) {
      window.clearTimeout(sidebarTaskHoverPreviewClearTimerRef.current);
      sidebarTaskHoverPreviewClearTimerRef.current = null;
    }
  }, []);

  const clearSidebarTaskHoverPreview = useCallback(() => {
    cancelSidebarTaskHoverPreviewClear();
    setSidebarTaskHoverPreview(null);
  }, [cancelSidebarTaskHoverPreviewClear]);

  const scheduleSidebarTaskHoverPreviewClear = useCallback(() => {
    cancelSidebarTaskHoverPreviewClear();
    sidebarTaskHoverPreviewClearTimerRef.current = window.setTimeout(() => {
      sidebarTaskHoverPreviewClearTimerRef.current = null;
      setSidebarTaskHoverPreview(null);
    }, CALENDAR_SIDEBAR_HOVER_PREVIEW_CLEAR_MS);
  }, [cancelSidebarTaskHoverPreviewClear]);

  const isPinnedModal = Boolean(modalTaskId || centerModalTaskId);
  const activeSidebarModalTaskId = modalTaskId ?? centerModalTaskId ?? null;

  const handleSidebarTaskHoverStart = useCallback(
    (taskId: string, anchor: HTMLElement) => {
      if (isPinnedModal && taskId === activeSidebarModalTaskId) {
        scheduleSidebarTaskHoverPreviewClear();
        return;
      }

      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        clearSidebarTaskHoverPreview();
        return;
      }

      cancelSidebarTaskHoverPreviewClear();
      setSidebarTaskHoverPreview({
        task,
        anchorRect: DOMRect.fromRect(anchor.getBoundingClientRect()),
      });
    },
    [
      activeSidebarModalTaskId,
      cancelSidebarTaskHoverPreviewClear,
      clearSidebarTaskHoverPreview,
      isPinnedModal,
      scheduleSidebarTaskHoverPreviewClear,
      tasks,
    ],
  );

  const handleSidebarTaskHoverEnd = useCallback(() => {
    scheduleSidebarTaskHoverPreviewClear();
  }, [scheduleSidebarTaskHoverPreviewClear]);

  const handleSidebarTaskHoverPreviewPointerEnter = useCallback(() => {
    cancelSidebarTaskHoverPreviewClear();
  }, [cancelSidebarTaskHoverPreviewClear]);

  const handleSidebarTaskHoverPreviewPointerLeave = useCallback(() => {
    scheduleSidebarTaskHoverPreviewClear();
  }, [scheduleSidebarTaskHoverPreviewClear]);

  const handleOpenSidebarTask = useCallback(
    (taskId: string) => {
      cancelSidebarTaskHoverPreviewClear();
      clearSidebarTaskHoverPreview();
      onSelectTask?.(taskId);
      setModalTaskId(taskId);
    },
    [
      cancelSidebarTaskHoverPreviewClear,
      clearSidebarTaskHoverPreview,
      onSelectTask,
    ],
  );

  const visibleTaskId = modalTaskId ?? centerModalTaskId ?? null;

  const modalTaskSnapshot = useMemo(
    () =>
      visibleTaskId ? getCalendarTaskSnapshot(visibleTaskId, tasks) : null,
    [tasks, visibleTaskId],
  );

  const handleCloseTaskModal = useCallback(() => {
    cancelSidebarTaskHoverPreviewClear();
    clearSidebarTaskHoverPreview();
    if (modalTaskId) {
      setModalTaskId(null);
      return;
    }
    if (centerModalTaskId) {
      onCloseCenterModal?.();
    }
  }, [
    cancelSidebarTaskHoverPreviewClear,
    centerModalTaskId,
    clearSidebarTaskHoverPreview,
    modalTaskId,
    onCloseCenterModal,
  ]);

  const closeTaskEditorForTask = useCallback(
    (taskId: string) => {
      if (modalTaskId === taskId) {
        cancelSidebarTaskHoverPreviewClear();
        clearSidebarTaskHoverPreview();
        setModalTaskId(null);
        return;
      }

      if (centerModalTaskId === taskId) {
        cancelSidebarTaskHoverPreviewClear();
        clearSidebarTaskHoverPreview();
        onCloseCenterModal?.();
        return;
      }

      if (sidebarTaskHoverPreview?.task.id === taskId) {
        cancelSidebarTaskHoverPreviewClear();
        clearSidebarTaskHoverPreview();
      }
    },
    [
      cancelSidebarTaskHoverPreviewClear,
      centerModalTaskId,
      clearSidebarTaskHoverPreview,
      modalTaskId,
      onCloseCenterModal,
      sidebarTaskHoverPreview?.task.id,
    ],
  );

  const handleSidebarToggleTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (task && !task.completed) {
        closeTaskEditorForTask(taskId);
      }

      const toggleOptions: ToggleTaskOptions = {
        undoVisibleMs: CALENDAR_SIDEBAR_COMPLETE_UNDO_MS,
      };
      onToggleTask?.(taskId, toggleOptions);
    },
    [closeTaskEditorForTask, onToggleTask, tasks],
  );

  const isSearching = searchQuery.trim().length > 0;

  const navigableTaskIds = useMemo(() => {
    if (isSearching) {
      return getCalendarSidebarSearchResults(
        searchTasks,
        searchQuery,
        focusDate,
      ).map((task) => task.id);
    }

    return getCalendarModalNavigableTaskIds(tasks, focusDate);
  }, [focusDate, isSearching, searchQuery, searchTasks, tasks]);

  const modalNavigableTaskIds = useMemo(() => {
    if (centerModalTaskId && !modalTaskId) {
      return centerModalNavigableTaskIds ?? navigableTaskIds;
    }
    return navigableTaskIds;
  }, [
    centerModalNavigableTaskIds,
    centerModalTaskId,
    modalTaskId,
    navigableTaskIds,
  ]);

  const handleModalNavigateTask = useCallback(
    (taskId: string) => {
      cancelSidebarTaskHoverPreviewClear();
      clearSidebarTaskHoverPreview();
      if (modalTaskId) {
        onSelectTask?.(taskId);
        setModalTaskId(taskId);
        return;
      }
      if (centerModalTaskId) {
        onCenterModalNavigateTask?.(taskId);
        return;
      }
      onSelectTask?.(taskId);
      setModalTaskId(taskId);
    },
    [
      cancelSidebarTaskHoverPreviewClear,
      centerModalTaskId,
      clearSidebarTaskHoverPreview,
      modalTaskId,
      onCenterModalNavigateTask,
      onSelectTask,
    ],
  );

  const handleSidebarTaskHoverPreviewOpen = useCallback(
    (taskId: string) => {
      clearSidebarTaskHoverPreview();
      handleModalNavigateTask(taskId);
    },
    [clearSidebarTaskHoverPreview, handleModalNavigateTask],
  );

  const taskModalIsNewTaskDraft =
    Boolean(centerModalTaskId) &&
    visibleTaskId === centerModalTaskId &&
    centerModalIsNewTaskDraft;

  const today = useMemo(() => startOfDay(new Date()), []);
  const calendarRange = useMemo(
    () => getMonthCalendarRange(monthDate),
    [monthDate],
  );
  const tasksByDate = useMemo(
    () => buildTasksByDate(tasks, calendarRange),
    [tasks, calendarRange],
  );
  const sidebarVisibilityClass = sidebarOpen
    ? getCalendarSidebarVisibilityClass(sidebarMinViewportWidth)
    : "hidden";

  const sidebar = sidebarOpen ? (
    <aside
      ref={calendarSidebarRef}
      className={`${sidebarVisibilityClass} h-full min-h-0 ${sidebarWidthClass} flex-col overflow-hidden bg-white dark:bg-zinc-950 ${
        isListCalendarOverlapLayout ? "relative z-[1]" : ""
      } ${
        sidebarOpen && isPinnedModal ? "relative z-[10045]" : ""
      } ${
        sidebarPosition === "left"
          ? "border-r border-zinc-200 dark:border-zinc-800"
          : "border-l border-zinc-150 dark:border-zinc-800"
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
          onToggleTask={handleSidebarToggleTask}
          checkAnimatingTaskIds={checkAnimatingTaskIds}
          onSelectSearchTask={onSelectSearchTask}
          onHoverTaskStart={handleSidebarTaskHoverStart}
          onHoverTaskEnd={handleSidebarTaskHoverEnd}
          activeModalTaskId={activeSidebarModalTaskId}
        />
      ) : (
        <CalendarSidebarDayTasks
          focusDate={focusDate}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onOpenTask={handleOpenSidebarTask}
          onToggleTask={handleSidebarToggleTask}
          checkAnimatingTaskIds={checkAnimatingTaskIds}
          onHoverTaskStart={handleSidebarTaskHoverStart}
          onHoverTaskEnd={handleSidebarTaskHoverEnd}
          activeModalTaskId={activeSidebarModalTaskId}
        />
      )}
    </aside>
  ) : null;

  const overlapSidebarInsetPx =
    isListCalendarOverlapLayout && sidebarOpen
      ? CALENDAR_SIDEBAR_OVERLAP_WIDTH_PX
      : 0;

  const main = (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      style={
        overlapSidebarInsetPx > 0
          ? sidebarPosition === "right"
            ? { paddingRight: overlapSidebarInsetPx }
            : { paddingLeft: overlapSidebarInsetPx }
          : undefined
      }
    >
      {children}
    </div>
  );

  const layoutBody =
    isListCalendarOverlapLayout && sidebarOpen ? (
      <div className="relative min-h-0 min-w-0 w-full flex-1 overflow-hidden">
        {main}
        <div
          className={`absolute inset-y-0 z-[2] flex shrink-0 ${
            sidebarPosition === "right" ? "right-0" : "left-0"
          }`}
        >
          {sidebar}
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 min-w-0 w-full flex-1">
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

  return (
    <>
      {layoutBody}

      {visibleTaskId ? (
        <CalendarTaskModal
          taskId={visibleTaskId}
          taskSnapshot={modalTaskSnapshot}
          isNewTaskDraft={taskModalIsNewTaskDraft}
          onNewTaskDraftComplete={onCenterModalNewTaskDraftComplete}
          sidebarBackdropClip={
            sidebarOpen
              ? {
                  enabled: true,
                  sidebarRef: calendarSidebarRef,
                  sidebarPosition,
                }
              : undefined
          }
          onClose={handleCloseTaskModal}
          onDetailsSaved={onDetailsSaved}
          onTaskHasDetailsKnown={onTaskHasDetailsKnown}
          onTaskRenamed={onTaskRenamed}
          onDueDateUpdated={onDueDateUpdated}
          onRecurrenceUpdated={onRecurrenceUpdated}
          onSaveTaskRecurrence={onSaveTaskRecurrence}
          onToggleTask={onToggleTask}
          navigableTaskIds={modalNavigableTaskIds}
          onNavigateTask={handleModalNavigateTask}
          onExpandToTaskPanel={onExpandCenterModalToTaskPanel}
        />
      ) : null}

      {sidebarTaskHoverPreview ? (
        <CalendarModalNavigationTaskPreview
          task={sidebarTaskHoverPreview.task}
          anchorRect={sidebarTaskHoverPreview.anchorRect}
          placement="sidebar-task"
          sidebarPosition={sidebarPosition}
          onPointerEnter={handleSidebarTaskHoverPreviewPointerEnter}
          onPointerLeave={handleSidebarTaskHoverPreviewPointerLeave}
          onOpenTask={handleSidebarTaskHoverPreviewOpen}
        />
      ) : null}
    </>
  );
}
