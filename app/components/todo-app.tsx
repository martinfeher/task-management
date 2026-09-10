"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  convertTaskToNote as convertTaskToNoteInDb,
  convertNoteToTask as convertNoteToTaskInDb,
  createTask,
  createSubtask,
  createLabel as createLabelInDb,
  createTodoList,
  deleteTask as deleteTaskInDb,
  deleteLabel as deleteLabelInDb,
  deleteTodoList,
  getLabels,
  getTaskLabels,
  addTaskLabel as addTaskLabelInDb,
  renameLabel as renameLabelInDb,
  setTaskLabel as setTaskLabelInDb,
  updateLabelColor as updateLabelColorInDb,
  moveTaskToList as moveTaskToListInDb,
  renameTask as renameTaskInDb,
  renameTodoList,
  reorderLabels as reorderLabelsInDb,
  reorderTodoLists as reorderTodoListsInDb,
  reorderTasks as reorderTasksInDb,
  toggleTask as toggleTaskInDb,
  updateTaskDueDate as updateTaskDueDateInDb,
  updateTaskDueTime as updateTaskDueTimeInDb,
  updateTaskDueDateAndTime as updateTaskDueDateAndTimeInDb,
  updateTaskPriority as updateTaskPriorityInDb,
  updateTaskCalendarColor as updateTaskCalendarColorInDb,
  updateTaskPinned as updateTaskPinnedInDb,
  updateTaskImportant as updateTaskImportantInDb,
  updateTaskDetails as updateTaskDetailsInDb,
  updateTaskRecurrence as updateTaskRecurrenceInDb,
} from "@/app/actions/todo";
import type { TaskParentUpdate } from "@/app/actions/todo";
import type { TaskDueTime } from "@/lib/task-due-time";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  getRecurrenceUndoMessage,
  parseRecurrenceRule,
} from "@/lib/task-recurrence";
import {
  COMPACT_LAYOUT_MEDIA_QUERY,
  useMediaQuery,
} from "@/lib/use-media-query";
import type { CalendarExternalDragTarget } from "@/lib/calendar-time-grid";
import type { SidebarListDragTarget } from "@/lib/sidebar-list-drag";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { invalidateTaskDetailsFetchCache } from "@/lib/task-details-api";
import {
  buildTodoPath,
  clampListCalendarMultiDayCount,
  clampListCalendarMultiWeekCount,
  findListIdForTask,
  getRouteFromAppState,
  getTodoLocationKey,
  LIST_CALENDAR_MULTI_DAY_DEFAULT,
  LIST_CALENDAR_MULTI_WEEK_DEFAULT,
  parseTodoPath,
  routesEqual,
  type ListCalendarView,
  type TodoRoute,
} from "@/lib/todo-routes";
import { getInboxListId } from "@/lib/inbox-list";
import { useImportantEnabled } from "@/lib/important-settings";
import { useSubtasksEnabled } from "@/lib/subtasks-settings";
import type { CalendarViewTab } from "@/lib/calendar-view-settings";
import {
  readCalendarViewSession,
  resolveCalendarViewSession,
  saveCalendarViewSession,
} from "@/lib/calendar-view-settings";
import { Sidebar } from "./sidebar";
import { CalendarPanel, CalendarViewsPanel } from "./calendar-panel";
import { CalendarShortcutModal } from "./calendar-shortcut-modal";
import { plainTextToTaskDetails } from "./calendar-add-task-popover";
import { TaskDetailsPanel, type TaskDetailsSaveController } from "./task-details-panel";
import { PanelResizeHandle } from "./panel-resize-handle";
import { TaskListPanel, TASK_LIST_PANEL_AUTO_EXPAND_MAX_WIDTH, TASK_LIST_PANEL_DEFAULT_WIDTH, TASK_LIST_PANEL_MIN_WIDTH } from "./task-list-panel";
import {
  CHECKMARK_HIDE_FADE_MS,
  CHECKMARK_HIDE_MS,
  getCompletionAnimationMs,
  TASK_COMPLETE_ANIMATION_MS,
  clearCheckboxCheckStart,
} from "./task-completion-checkbox";
import { mergeReorderedPinnedTasks, mergeReorderedUnpinnedTasks } from "./task-reorder";
import { buildVisibleTasks } from "@/lib/task-subtasks";
import { AppFontSwitcher } from "./app-font-switcher";
import { TemplateOptionsDrawer } from "./template-options-drawer";
import { UndoButton } from "./undo-button";
import { LuMenu } from "react-icons/lu";

const MIN_PANEL_WIDTH = TASK_LIST_PANEL_MIN_WIDTH;
const RESIZE_HANDLE_WIDTH = 4;

export type TaskLabel = {
  id: string;
  label: string;
  color?: string | null;
};

export type Task = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  hasDetails: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  calendarColor: string | null;
  recurrenceRule: string | null;
  priority: number | null;
  pinned: boolean;
  important: boolean;
  isNote: boolean;
  parentId: string | null;
  labels: TaskLabel[];
};

export type TodoList = {
  id: string;
  name: string;
};

export type CompletedTask = Task & {
  listId: string;
  listName: string;
};

export type SearchTask = Task & {
  listId: string;
  listName: string;
};

type PendingUndo = {
  taskId: string;
  listId: string;
  taskName: string;
};

type PendingRecurrenceUndo = {
  taskId: string;
  listId: string;
  taskName: string;
  previousRecurrenceRule: string | null;
  message: string;
};

type ListTasksSnapshot = {
  listId: string;
  tasks: Task[];
};

function cloneListTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    labels: [...task.labels],
  }));
}

function collectParentUpdates(
  currentTasks: Task[],
  targetTasks: Task[],
): TaskParentUpdate[] {
  const targetById = new Map(
    targetTasks.map((task) => [task.id, task.parentId ?? null]),
  );
  const updates: TaskParentUpdate[] = [];
  const seen = new Set<string>();

  for (const task of currentTasks) {
    const targetParentId = targetById.get(task.id);
    if (targetParentId === undefined) continue;

    const currentParentId = task.parentId ?? null;
    if (currentParentId !== targetParentId && !seen.has(task.id)) {
      updates.push({ taskId: task.id, parentId: targetParentId });
      seen.add(task.id);
    }
  }

  return updates;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

const DOUBLE_ALT_CALENDAR_MAX_GAP_MS = 400;

type TodoAppProps = {
  initialLists: TodoList[];
  initialLabels: TaskLabel[];
  initialTasksByList: Record<string, Task[]>;
  initialRoute?: TodoRoute;
};

function withPinnedDefaults(tasksByList: Record<string, Task[]>) {
  return Object.fromEntries(
    Object.entries(tasksByList).map(([listId, tasks]) => [
      listId,
      tasks.map((task) => ({
        ...task,
        hasDetails: task.hasDetails ?? false,
        pinned: Boolean(task.pinned),
        important: Boolean(task.important),
        isNote: Boolean(task.isNote),
        parentId: task.parentId ?? null,
        labels: task.labels ?? [],
      })),
    ]),
  ) as Record<string, Task[]>;
}

const UNDO_VISIBLE_MS = 7000;
const CHECKBOX_COMPLETE_ANIMATION_MS = 280;
const COMPLETION_TEXT_REMOVE_EARLY_MS = 1500;
const COMPLETION_REMOVE_MS = Math.max(
  CHECKMARK_HIDE_MS + CHECKMARK_HIDE_FADE_MS,
  TASK_COMPLETE_ANIMATION_MS,
);
const COMPLETION_DISPLAY_MS = Math.max(
  0,
  COMPLETION_REMOVE_MS -
    CHECKBOX_COMPLETE_ANIMATION_MS -
    COMPLETION_TEXT_REMOVE_EARLY_MS,
);

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

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  return isSameDay(startOfDay(date), startOfDay(new Date()));
}

/*
function isDueInNext7Days(dueDate: string | null) {
  if (!dueDate) return false;

  const date = startOfDay(new Date(dueDate));
  if (Number.isNaN(date.getTime())) return false;

  const today = startOfDay(new Date());
  const end = startOfDay(new Date());
  end.setDate(end.getDate() + 7);

  return date.getTime() >= today.getTime() && date.getTime() < end.getTime();
}
*/

function getTasksByLabel(
  labelId: string,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
): TaskListItem[] {
  return lists.flatMap((list) =>
    (tasksByList[list.id] ?? [])
      .filter(
        (task) =>
          !task.completed && task.labels.some((item) => item.id === labelId),
      )
      .map((task) => ({
        ...task,
        listId: list.id,
        listName: list.name,
      })),
  );
}

type ActiveView =
  | "today"
  | "inbox"
  // | "next7days"
  | "important"
  | "calendar"
  | null;

export type TodoActiveView = ActiveView;

function getVisibleTasks(
  activeView: ActiveView,
  listId: string | null,
  selectedLabelId: string | null,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
): TaskListItem[] {
  if (selectedLabelId) {
    return getTasksByLabel(selectedLabelId, lists, tasksByList);
  }

  if (activeView === "today") {
    return lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && isDueToday(task.dueDate))
        .map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
    );
  }

  if (activeView === "inbox") {
    const inboxListId = getInboxListId(lists);
    if (!inboxListId) return [];

    return (tasksByList[inboxListId] ?? [])
      .filter((task) => !task.completed)
      .map((task) => ({
        ...task,
        listId: inboxListId,
        listName: lists.find((list) => list.id === inboxListId)?.name,
      }));
  }

  /*
  if (activeView === "next7days") {
    return lists
      .flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => !task.completed && isDueInNext7Days(task.dueDate))
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      )
      .sort((a, b) => {
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });
  }
  */

  if (activeView === "important") {
    return lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && task.important)
        .map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
    );
  }

  if (activeView === "calendar") {
    return lists
      .flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => !task.completed && task.dueDate)
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      )
      .sort((a, b) => {
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });
  }

  if (!listId) return [];

  return (tasksByList[listId] ?? [])
    .filter((task) => !task.completed)
    .map((task) => ({
      ...task,
      listId,
      listName: lists.find((list) => list.id === listId)?.name,
    }));
}

function getFirstVisibleTaskId(
  activeView: ActiveView,
  listId: string | null,
  selectedLabelId: string | null,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
) {
  if (listId && !selectedLabelId && activeView === null) {
    const listTasks = (tasksByList[listId] ?? []).filter((task) => !task.completed);
    const pinnedTasks = buildVisibleTasks(listTasks, true);
    if (pinnedTasks.length > 0) {
      return pinnedTasks[0].id;
    }

    return buildVisibleTasks(listTasks, false)[0]?.id ?? null;
  }

  if (activeView === "inbox") {
    const inboxListId = getInboxListId(lists);
    if (!inboxListId) return null;

    return getFirstVisibleTaskId(null, inboxListId, null, lists, tasksByList);
  }

  return getVisibleTasks(
    activeView,
    listId,
    selectedLabelId,
    lists,
    tasksByList,
  )[0]?.id ?? null;
}

function taskExistsInList(
  listId: string,
  taskId: string,
  tasksByList: Record<string, Task[]>,
) {
  return (tasksByList[listId] ?? []).some((task) => task.id === taskId);
}

function resolveStateFromRoute(
  route: TodoRoute,
  lists: TodoList[],
  labels: TaskLabel[],
  tasksByList: Record<string, Task[]>,
) {
  const firstListId = lists[0]?.id ?? null;
  const defaultGlobalCalendar = {
    calendarView: "week" as ListCalendarView,
    calendarMultiDayCount: LIST_CALENDAR_MULTI_DAY_DEFAULT,
    calendarMultiWeekCount: LIST_CALENDAR_MULTI_WEEK_DEFAULT,
  };
  const closedListCalendar = {
    isListCalendarOpen: false,
    listCalendarView: "week" as ListCalendarView,
    listCalendarMultiDayCount: LIST_CALENDAR_MULTI_DAY_DEFAULT,
    listCalendarMultiWeekCount: LIST_CALENDAR_MULTI_WEEK_DEFAULT,
  };
  const closedCalendar = {
    ...defaultGlobalCalendar,
    ...closedListCalendar,
  };

  switch (route.kind) {
    case "calendar":
      return {
        activeView: "calendar" as ActiveView,
        selectedListId: null,
        selectedTaskId: null,
        selectedLabelId: null,
        ...closedCalendar,
        calendarView: route.calendarView,
        calendarMultiDayCount: clampListCalendarMultiDayCount(
          route.multiDayCount,
        ),
        calendarMultiWeekCount: clampListCalendarMultiWeekCount(
          route.multiWeekCount,
        ),
      };
    case "today":
      return {
        activeView: "today" as ActiveView,
        selectedListId: null,
        selectedTaskId: getFirstVisibleTaskId(
          "today",
          null,
          null,
          lists,
          tasksByList,
        ),
        selectedLabelId: null,
        ...closedCalendar,
      };
    case "inbox":
      return {
        activeView: "inbox" as ActiveView,
        selectedListId: null,
        selectedTaskId: getFirstVisibleTaskId(
          "inbox",
          null,
          null,
          lists,
          tasksByList,
        ),
        selectedLabelId: null,
        ...closedCalendar,
      };
    case "important":
      return {
        activeView: "important" as ActiveView,
        selectedListId: null,
        selectedTaskId: getFirstVisibleTaskId(
          "important",
          null,
          null,
          lists,
          tasksByList,
        ),
        selectedLabelId: null,
        ...closedCalendar,
      };
    case "label": {
      const labelExists = labels.some((label) => label.id === route.labelId);
      const labelId = labelExists ? route.labelId : null;

      return {
        activeView: null,
        selectedListId: null,
        selectedLabelId: labelId,
        selectedTaskId: labelId
          ? getFirstVisibleTaskId(null, null, labelId, lists, tasksByList)
          : null,
        ...closedCalendar,
      };
    }
    case "listCalendar": {
      const listId = lists.some((list) => list.id === route.listId)
        ? route.listId
        : firstListId;

      return {
        activeView: null,
        selectedLabelId: null,
        selectedListId: listId,
        selectedTaskId: listId
          ? getFirstVisibleTaskId(null, listId, null, lists, tasksByList)
          : null,
        ...defaultGlobalCalendar,
        isListCalendarOpen: Boolean(listId),
        listCalendarView: route.calendarView,
        listCalendarMultiDayCount: clampListCalendarMultiDayCount(
          route.multiDayCount,
        ),
        listCalendarMultiWeekCount: clampListCalendarMultiWeekCount(
          route.multiWeekCount,
        ),
      };
    }
    case "list": {
      const listId = lists.some((list) => list.id === route.listId)
        ? route.listId
        : firstListId;

      return {
        activeView: null,
        selectedLabelId: null,
        selectedListId: listId,
        selectedTaskId: listId
          ? getFirstVisibleTaskId(null, listId, null, lists, tasksByList)
          : null,
        ...closedCalendar,
      };
    }
    case "task": {
      const listId =
        findListIdForTask(route.taskId, tasksByList) ?? firstListId;
      const taskId =
        listId && taskExistsInList(listId, route.taskId, tasksByList)
          ? route.taskId
          : listId
            ? getFirstVisibleTaskId(null, listId, null, lists, tasksByList)
            : null;

      return {
        activeView: null,
        selectedLabelId: null,
        selectedListId: listId,
        selectedTaskId: taskId,
        ...closedCalendar,
      };
    }
    case "home":
    default:
      return {
        activeView: "inbox" as ActiveView,
        selectedLabelId: null,
        selectedListId: null,
        selectedTaskId: getFirstVisibleTaskId(
          "inbox",
          null,
          null,
          lists,
          tasksByList,
        ),
        ...closedCalendar,
      };
  }
}

function getNextTaskIdAfterRemove(
  visibleTasks: Array<{ id: string }>,
  removedTaskId: string,
) {
  const index = visibleTasks.findIndex((task) => task.id === removedTaskId);
  if (index < 0) {
    return visibleTasks.find((task) => task.id !== removedTaskId)?.id ?? null;
  }

  if (index < visibleTasks.length - 1) {
    return visibleTasks[index + 1]?.id ?? null;
  }

  if (index > 0) {
    return visibleTasks[index - 1]?.id ?? null;
  }

  return null;
}

export type TaskListItem = Task & {
  listId?: string;
  listName?: string;
};

export type AddTaskOptions = {
  dueDate?: string | null;
  dueTime?: TaskDueTime | null;
  keepFormOpen?: boolean;
  priority?: number | null;
  label?: string | null;
  recurrenceRule?: TaskRecurrenceRule | null;
  listId?: string;
  subtasks?: string[];
};

export type SidebarHoverPreview =
  | { kind: "list"; listId: string }
  | { kind: "label"; labelId: string };

export function TodoApp({
  initialLists,
  initialLabels,
  initialTasksByList,
  initialRoute,
}: TodoAppProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const initialTasks = withPinnedDefaults(initialTasksByList);
  const bootRoute =
    initialRoute ??
    parseTodoPath(pathname, searchParams) ??
    ({ kind: "home" } as const);
  const bootState = resolveStateFromRoute(
    bootRoute,
    initialLists,
    initialLabels,
    initialTasks,
  );
  const [lists, setLists] = useState(initialLists);
  const [labels, setLabels] = useState(initialLabels);
  const [selectedListId, setSelectedListId] = useState<string | null>(
    bootState.selectedListId,
  );
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(
    bootState.selectedLabelId,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    bootState.selectedTaskId,
  );
  const [suppressListSelectionHighlightId, setSuppressListSelectionHighlightId] =
    useState<string | null>(null);
  const listSelectionHighlightTimerRef = useRef<number | null>(null);
  const [isCalendarShortcutModalOpen, setIsCalendarShortcutModalOpen] =
    useState(false);
  const [sidebarHoverPreview, setSidebarHoverPreview] =
    useState<SidebarHoverPreview | null>(null);
  const sidebarHoverPreviewRef = useRef<SidebarHoverPreview | null>(null);
  const clearSidebarHoverTimerRef = useRef<number | null>(null);
  const [focusNoteAtEndRequest, setFocusNoteAtEndRequest] = useState(0);
  const [focusTaskTitleRequest, setFocusTaskTitleRequest] = useState(0);
  const suppressDetailsTitleFocusRef = useRef(false);
  const handleListTitleEditStart = useCallback(() => {
    suppressDetailsTitleFocusRef.current = true;
  }, []);
  const handleListTitleEditEnd = useCallback(() => {
    suppressDetailsTitleFocusRef.current = false;
  }, []);
  const [activeView, setActiveView] = useState<ActiveView>(bootState.activeView);
  const { importantEnabled } = useImportantEnabled();
  const { subtasksEnabled } = useSubtasksEnabled();
  const [tasksByList, setTasksByList] = useState(() => initialTasks);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [pendingRecurrenceUndo, setPendingRecurrenceUndo] =
    useState<PendingRecurrenceUndo | null>(null);
  const [completingTasks, setCompletingTasks] = useState<{
    ids: Set<string>;
    withoutBackgroundIds: Set<string>;
  }>({
    ids: new Set(),
    withoutBackgroundIds: new Set(),
  });
  const sessionCompletionCountRef = useRef(0);
  const [checkAnimatingTaskIds, setCheckAnimatingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const undoTimerRef = useRef<number | null>(null);
  const recurrenceUndoTimerRef = useRef<number | null>(null);
  const pendingUndoRef = useRef<PendingUndo | null>(null);
  const pendingRecurrenceUndoRef = useRef<PendingRecurrenceUndo | null>(null);
  pendingUndoRef.current = pendingUndo;
  pendingRecurrenceUndoRef.current = pendingRecurrenceUndo;
  const reorderUndoStackRef = useRef<ListTasksSnapshot[]>([]);
  const reorderRedoStackRef = useRef<ListTasksSnapshot[]>([]);
  const lastAltPressAtRef = useRef(0);
  const tasksByListRef = useRef(tasksByList);
  const detailsSaveControllerRef = useRef<TaskDetailsSaveController | null>(null);
  const registerDetailsSaveController = useCallback(
    (controller: TaskDetailsSaveController | null) => {
      detailsSaveControllerRef.current = controller;
    },
    [],
  );
  const selectTask = useCallback(
    async (taskId: string | null) => {
      if (taskId !== selectedTaskId) {
        await detailsSaveControllerRef.current?.flushSave();
      }

      setSelectedTaskId(taskId);
    },
    [selectedTaskId],
  );
  const isApplyingReorderHistoryRef = useRef(false);
  tasksByListRef.current = tasksByList;
  sidebarHoverPreviewRef.current = sidebarHoverPreview;
  const completionTimerRef = useRef<Record<string, number>>({});
  const completingTaskIds = completingTasks.ids;
  const completingWithoutBackgroundTaskIds = completingTasks.withoutBackgroundIds;
  const [isListCalendarOpen, setIsListCalendarOpen] = useState(
    bootState.isListCalendarOpen,
  );
  const [listCalendarShowingDetails, setListCalendarShowingDetails] =
    useState(false);
  const isCompactLayout = useMediaQuery(COMPACT_LAYOUT_MEDIA_QUERY);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [listCalendarView, setListCalendarView] = useState<ListCalendarView>(
    bootState.listCalendarView,
  );
  const [listCalendarMultiDayCount, setListCalendarMultiDayCount] = useState(
    bootState.listCalendarMultiDayCount,
  );
  const [listCalendarMultiWeekCount, setListCalendarMultiWeekCount] = useState(
    bootState.listCalendarMultiWeekCount,
  );
  const [listCalendarPanelView, setListCalendarPanelView] =
    useState<CalendarViewTab>(bootState.listCalendarView);
  const [calendarView, setCalendarView] = useState<ListCalendarView>(
    bootState.calendarView,
  );
  const [calendarMultiDayCount, setCalendarMultiDayCount] = useState(
    bootState.calendarMultiDayCount,
  );
  const [calendarMultiWeekCount, setCalendarMultiWeekCount] = useState(
    bootState.calendarMultiWeekCount,
  );
  const [calendarPanelView, setCalendarPanelView] = useState<CalendarViewTab>(
    bootState.calendarView,
  );
  const [isListCalendarPreview, setIsListCalendarPreview] = useState(false);
  const [calendarExternalDropTarget, setCalendarExternalDropTarget] =
    useState<CalendarExternalDragTarget | null>(null);
  const [sidebarListDropTarget, setSidebarListDropTarget] =
    useState<SidebarListDragTarget | null>(null);
  const handleCalendarDropTargetChange = useCallback(
    (target: CalendarExternalDragTarget | null) => {
      setCalendarExternalDropTarget((current) => {
        if (current === null && target === null) return current;

        if (
          current &&
          target &&
          current.dateKey === target.dateKey &&
          current.dueTimeMinutes === target.dueTimeMinutes &&
          current.taskId === target.taskId &&
          current.taskName === target.taskName
        ) {
          return current;
        }

        return target;
      });
    },
    [],
  );
  const handleSidebarListDropTargetChange = useCallback(
    (target: SidebarListDragTarget | null) => {
      setSidebarListDropTarget((current) => {
        if (current === null && target === null) return current;

        if (
          current &&
          target &&
          current.taskId === target.taskId &&
          current.listId === target.listId &&
          current.taskName === target.taskName
        ) {
          return current;
        }

        return target;
      });
    },
    [],
  );
  const listCalendarButtonRef = useRef<HTMLButtonElement>(null);
  const listCalendarReturnTaskIdRef = useRef<string | null>(null);
  const listCalendarPreviewCloseTimerRef = useRef<number | null>(null);
  const [taskListWidth, setTaskListWidth] = useState(TASK_LIST_PANEL_DEFAULT_WIDTH);
  const [hasResizedTaskList, setHasResizedTaskList] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const taskListWidthRef = useRef(taskListWidth);
  const pendingPathRef = useRef<string | null>(null);
  const currentRouteRef = useRef<TodoRoute>(bootRoute);
  taskListWidthRef.current = taskListWidth;

  const selectTaskImmediate = useCallback(
    (taskId: string) => {
      if (taskId !== selectedTaskId) {
        void detailsSaveControllerRef.current?.flushSave();
      }

      const route = getRouteFromAppState({
        activeView,
        selectedListId,
        selectedTaskId: taskId,
        selectedLabelId,
        isListCalendarOpen,
        listCalendarView,
        listCalendarMultiDayCount,
        listCalendarMultiWeekCount,
        calendarView,
        calendarMultiDayCount,
        calendarMultiWeekCount,
      });
      pendingPathRef.current = buildTodoPath(route);
      currentRouteRef.current = route;

      setSelectedTaskId(taskId);
    },
    [
      activeView,
      calendarMultiDayCount,
      calendarMultiWeekCount,
      calendarView,
      isListCalendarOpen,
      listCalendarMultiDayCount,
      listCalendarMultiWeekCount,
      listCalendarView,
      selectedLabelId,
      selectedListId,
      selectedTaskId,
    ],
  );

  const clampTaskListWidth = useCallback((width: number) => {
    const container = splitContainerRef.current;
    if (!container) {
      return Math.max(MIN_PANEL_WIDTH, width);
    }

    const containerWidth = container.getBoundingClientRect().width;
    const maxWidth = containerWidth - MIN_PANEL_WIDTH - RESIZE_HANDLE_WIDTH;
    return Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, width));
  }, []);

  const handleTaskListResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = taskListWidthRef.current;
      const pointerId = event.pointerId;
      const handle = event.currentTarget;
      handle.setPointerCapture(pointerId);
      setHasResizedTaskList(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        setTaskListWidth(
          clampTaskListWidth(startWidth + (moveEvent.clientX - startX)),
        );
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        handle.releasePointerCapture(pointerId);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [clampTaskListWidth],
  );

  const handleTaskListAutoExpandWidth = useCallback(
    (width: number) => {
      if (hasResizedTaskList) return;

      setTaskListWidth((currentWidth) => {
        const nextWidth = clampTaskListWidth(
          Math.min(
            TASK_LIST_PANEL_AUTO_EXPAND_MAX_WIDTH,
            Math.max(TASK_LIST_PANEL_DEFAULT_WIDTH, width),
          ),
        );
        return nextWidth <= currentWidth ? currentWidth : nextWidth;
      });
    },
    [clampTaskListWidth, hasResizedTaskList],
  );

  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      setTaskListWidth((currentWidth) => clampTaskListWidth(currentWidth));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [clampTaskListWidth]);

  const previewListId =
    sidebarHoverPreview?.kind === "list" ? sidebarHoverPreview.listId : null;
  const previewList =
    previewListId !== null
      ? (lists.find((list) => list.id === previewListId) ?? null)
      : null;
  const previewLabelId =
    sidebarHoverPreview?.kind === "label"
      ? sidebarHoverPreview.labelId
      : null;
  const previewLabel =
    previewLabelId !== null
      ? (labels.find((item) => item.id === previewLabelId) ?? null)
      : null;

  const displayedListId =
    sidebarHoverPreview == null
      ? selectedListId
      : sidebarHoverPreview.kind === "list"
        ? sidebarHoverPreview.listId
        : null;
  const displayedActiveView: ActiveView =
    sidebarHoverPreview == null ? activeView : null;
  const displayedLabelId =
    sidebarHoverPreview == null
      ? selectedLabelId
      : sidebarHoverPreview.kind === "label"
        ? sidebarHoverPreview.labelId
        : null;
  const displayedLabel =
    displayedLabelId !== null
      ? (labels.find((item) => item.id === displayedLabelId) ?? null)
      : null;

  useEffect(() => {
    if (hasResizedTaskList) return;
    setTaskListWidth(TASK_LIST_PANEL_DEFAULT_WIDTH);
  }, [
    displayedListId,
    displayedLabelId,
    displayedActiveView,
    hasResizedTaskList,
  ]);

  const isSidebarHoverPreview = Boolean(
    sidebarHoverPreview &&
      (sidebarHoverPreview.kind === "list"
        ? sidebarHoverPreview.listId !== selectedListId ||
          activeView !== null ||
          selectedLabelId !== null
        : sidebarHoverPreview.labelId !== selectedLabelId ||
          activeView !== null ||
          selectedListId !== null),
  );

  const showingCalendarMonth = displayedActiveView === "calendar";

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const selectedLabel =
    labels.find((item) => item.id === selectedLabelId) ?? null;
  const inboxListId = useMemo(() => getInboxListId(lists), [lists]);
  const taskListPanelListId =
    displayedListId ??
    (displayedActiveView === "inbox" ? inboxListId : null);

  const calendarTasks: TaskListItem[] = getVisibleTasks(
    "calendar",
    null,
    null,
    lists,
    tasksByList,
  );

  const taskListTitle =
    previewList
      ? previewList.name
      : previewLabel
        ? previewLabel.label
        : selectedLabel
          ? selectedLabel.label
          : activeView === "today"
            ? "Today"
            : activeView === "inbox"
              ? "Inbox"
            : activeView === "important"
              ? "Important"
              : activeView === "calendar"
                ? "Calendar"
                : (selectedList?.name ?? null);

  const taskListViewResetKey = [
    displayedListId ?? "",
    displayedLabelId ?? "",
    displayedActiveView ?? "",
  ].join(":");

  const taskListItems: TaskListItem[] = useMemo(
    () =>
      getVisibleTasks(
        displayedActiveView,
        displayedListId,
        displayedLabelId,
        lists,
        tasksByList,
      ),
    [
      displayedActiveView,
      displayedListId,
      displayedLabelId,
      lists,
      tasksByList,
    ],
  );

  const listCompletedTasks: TaskListItem[] = useMemo(() => {
    if (!taskListPanelListId) return [];

    const list = lists.find((item) => item.id === taskListPanelListId);

    return (tasksByList[taskListPanelListId] ?? [])
      .filter((task) => task.completed)
      .map((task) => ({
        ...task,
        listId: taskListPanelListId,
        listName: list?.name,
      }));
  }, [taskListPanelListId, lists, tasksByList]);

  const completedTasks: CompletedTask[] = useMemo(
    () =>
      lists.flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => task.completed)
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      ),
    [lists, tasksByList],
  );

  const searchTasks: SearchTask[] = useMemo(
    () =>
      lists.flatMap((list) =>
        (tasksByList[list.id] ?? []).map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
      ),
    [lists, tasksByList],
  );

  const taskCountByListId = useMemo(
    () =>
      Object.fromEntries(
        lists.map((list) => [
          list.id,
          (tasksByList[list.id] ?? []).filter((task) => !task.completed).length,
        ]),
      ),
    [lists, tasksByList],
  );

  const taskCountByLabelId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const list of lists) {
      for (const task of tasksByList[list.id] ?? []) {
        if (task.completed) continue;

        for (const label of task.labels) {
          counts[label.id] = (counts[label.id] ?? 0) + 1;
        }
      }
    }

    return counts;
  }, [lists, tasksByList]);

  const sidebarLabels = useMemo(
    () =>
      [...labels].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    [labels],
  );

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const clearRecurrenceUndoTimer = useCallback(() => {
    if (recurrenceUndoTimerRef.current !== null) {
      window.clearTimeout(recurrenceUndoTimerRef.current);
      recurrenceUndoTimerRef.current = null;
    }
  }, []);

  const dismissRecurrenceUndo = useCallback(() => {
    clearRecurrenceUndoTimer();
    setPendingRecurrenceUndo(null);
  }, [clearRecurrenceUndoTimer]);

  const dismissUndo = useCallback(() => {
    clearUndoTimer();
    setPendingUndo(null);
  }, [clearUndoTimer]);

  const scheduleRecurrenceUndo = useCallback(
    (undo: PendingRecurrenceUndo) => {
      clearRecurrenceUndoTimer();
      dismissUndo();
      setPendingRecurrenceUndo(undo);

      recurrenceUndoTimerRef.current = window.setTimeout(() => {
        setPendingRecurrenceUndo(null);
        recurrenceUndoTimerRef.current = null;
      }, UNDO_VISIBLE_MS);
    },
    [clearRecurrenceUndoTimer, dismissUndo],
  );

  const scheduleUndo = useCallback(
    (undo: PendingUndo) => {
      clearUndoTimer();
      dismissRecurrenceUndo();
      setPendingUndo(undo);

      undoTimerRef.current = window.setTimeout(() => {
        setPendingUndo(null);
        undoTimerRef.current = null;
      }, UNDO_VISIBLE_MS);
    },
    [clearUndoTimer, dismissRecurrenceUndo],
  );

  const applyListSnapshot = useCallback(async (snapshot: ListTasksSnapshot) => {
    const { listId, tasks } = snapshot;
    const currentTasks = tasksByListRef.current[listId] ?? [];
    const parentUpdates = collectParentUpdates(currentTasks, tasks);
    const taskIds = tasks.map((task) => task.id);

    setTasksByList((current) => ({
      ...current,
      [listId]: cloneListTasks(tasks),
    }));

    await reorderTasksInDb(listId, taskIds, parentUpdates);
  }, []);

  const handleReorderUndo = useCallback(async () => {
    if (isApplyingReorderHistoryRef.current) return;

    const undoStack = reorderUndoStackRef.current;
    if (undoStack.length === 0) return;

    isApplyingReorderHistoryRef.current = true;

    try {
      const snapshot = undoStack[undoStack.length - 1];
      reorderUndoStackRef.current = undoStack.slice(0, -1);

      const currentTasks = tasksByListRef.current[snapshot.listId] ?? [];
      reorderRedoStackRef.current = [
        ...reorderRedoStackRef.current,
        {
          listId: snapshot.listId,
          tasks: cloneListTasks(currentTasks),
        },
      ];

      await applyListSnapshot(snapshot);
    } finally {
      isApplyingReorderHistoryRef.current = false;
    }
  }, [applyListSnapshot]);

  const handleReorderRedo = useCallback(async () => {
    if (isApplyingReorderHistoryRef.current) return;

    const redoStack = reorderRedoStackRef.current;
    if (redoStack.length === 0) return;

    isApplyingReorderHistoryRef.current = true;

    try {
      const snapshot = redoStack[redoStack.length - 1];
      reorderRedoStackRef.current = redoStack.slice(0, -1);

      const currentTasks = tasksByListRef.current[snapshot.listId] ?? [];
      reorderUndoStackRef.current = [
        ...reorderUndoStackRef.current,
        {
          listId: snapshot.listId,
          tasks: cloneListTasks(currentTasks),
        },
      ];

      await applyListSnapshot(snapshot);
    } finally {
      isApplyingReorderHistoryRef.current = false;
    }
  }, [applyListSnapshot]);

  useEffect(() => {
    return () => {
      clearUndoTimer();
      clearRecurrenceUndoTimer();
      for (const timer of Object.values(completionTimerRef.current)) {
        window.clearTimeout(timer);
      }
    };
  }, [clearRecurrenceUndoTimer, clearUndoTimer]);

  const clearCompletionTimer = useCallback((taskId: string) => {
    const timer = completionTimerRef.current[taskId];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete completionTimerRef.current[taskId];
    }
  }, []);

  const removeCompletingTask = useCallback((taskId: string) => {
    clearCheckboxCheckStart(taskId);
    setCompletingTasks((current) => {
      if (!current.ids.has(taskId)) return current;

      const ids = new Set(current.ids);
      ids.delete(taskId);

      if (!current.withoutBackgroundIds.has(taskId)) {
        return { ...current, ids };
      }

      const withoutBackgroundIds = new Set(current.withoutBackgroundIds);
      withoutBackgroundIds.delete(taskId);
      return { ids, withoutBackgroundIds };
    });
    setCheckAnimatingTaskIds((current) => {
      if (!current.has(taskId)) return current;

      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  const handleUndoCompletion = useCallback(async () => {
    const undo = pendingUndoRef.current;
    if (!undo) return;

    const { taskId, listId } = undo;
    const task = (tasksByListRef.current[listId] ?? []).find(
      (item) => item.id === taskId,
    );

    clearCompletionTimer(taskId);
    removeCompletingTask(taskId);

    if (task?.completed) {
      await toggleTaskInDb(taskId, false);

      setTasksByList((current) => ({
        ...current,
        [listId]: (current[listId] ?? []).map((item) =>
          item.id === taskId ? { ...item, completed: false } : item,
        ),
      }));
    }

    dismissUndo();
  }, [clearCompletionTimer, dismissUndo, removeCompletingTask]);

  const finalizeTaskCompletion = useCallback(
    async (taskId: string, listId: string) => {
      clearCompletionTimer(taskId);
      removeCompletingTask(taskId);

      const completedTask = (tasksByList[listId] ?? []).find(
        (item) => item.id === taskId,
      );
      const result = await toggleTaskInDb(taskId, true);

      setTasksByList((current) => {
        const listTasks = current[listId] ?? [];
        const updatedList = listTasks.map((item) =>
          item.id === taskId ? { ...item, completed: true } : item,
        );

        if (result.spawnedTask && completedTask) {
          const spawned: Task = {
            id: result.spawnedTask.id,
            name: result.spawnedTask.name,
            completed: false,
            details: completedTask.details,
            hasDetails: completedTask.hasDetails,
            dueDate: result.spawnedTask.dueDate,
            dueTimeMinutes: result.spawnedTask.dueTimeMinutes,
            dueDurationMinutes: result.spawnedTask.dueDurationMinutes,
            dueTimeZone: result.spawnedTask.dueTimeZone,
            calendarColor: result.spawnedTask.calendarColor,
            recurrenceRule: result.spawnedTask.recurrenceRule,
            priority: completedTask.priority,
            pinned: result.spawnedTask.pinned,
            important: result.spawnedTask.important,
            isNote: completedTask.isNote,
            parentId: result.spawnedTask.parentId,
            labels: [...completedTask.labels],
          };

          return {
            ...current,
            [listId]: [spawned, ...updatedList],
          };
        }

        return {
          ...current,
          [listId]: updatedList,
        };
      });
    },
    [clearCompletionTimer, removeCompletingTask, tasksByList],
  );

  const refreshLabels = useCallback(() => {
    void getLabels().then(setLabels);
  }, []);

  useEffect(() => {
    const currentLocation = getTodoLocationKey(pathname, searchParams);
    if (pendingPathRef.current === currentLocation) {
      pendingPathRef.current = null;
      return;
    }

    // Ignore stale URL reads while a client-side navigation is in flight.
    if (pendingPathRef.current) {
      return;
    }

    const route = parseTodoPath(pathname, searchParams);
    if (!route || routesEqual(route, currentRouteRef.current)) {
      return;
    }

    currentRouteRef.current = route;
    const nextState = resolveStateFromRoute(
      route,
      lists,
      labels,
      tasksByListRef.current,
    );
    setActiveView(nextState.activeView);
    setSelectedListId(nextState.selectedListId);
    setSelectedLabelId(nextState.selectedLabelId);
    setSelectedTaskId(nextState.selectedTaskId);
    setIsListCalendarOpen(nextState.isListCalendarOpen);
    setListCalendarView(nextState.listCalendarView);
    setListCalendarMultiDayCount(nextState.listCalendarMultiDayCount);
    setListCalendarMultiWeekCount(nextState.listCalendarMultiWeekCount);
    setListCalendarPanelView(nextState.listCalendarView);
    setCalendarView(nextState.calendarView);
    setCalendarMultiDayCount(nextState.calendarMultiDayCount);
    setCalendarMultiWeekCount(nextState.calendarMultiWeekCount);
    setCalendarPanelView(nextState.calendarView);
  }, [pathname, searchParamsKey, lists, labels]);

  useEffect(() => {
    const route = getRouteFromAppState({
      activeView,
      selectedListId,
      selectedTaskId,
      selectedLabelId,
      isListCalendarOpen,
      listCalendarView,
      listCalendarMultiDayCount,
      listCalendarMultiWeekCount,
      calendarView,
      calendarMultiDayCount,
      calendarMultiWeekCount,
    });
    const path = buildTodoPath(route);
    const currentLocation = getTodoLocationKey(pathname, searchParams);

    if (path === currentLocation) {
      currentRouteRef.current = route;
      return;
    }

    currentRouteRef.current = route;
    pendingPathRef.current = path;
    // Use the History API directly instead of router.push(). This route's
    // dynamic segments (e.g. /tasks/[taskId]) have no loading.tsx or
    // generateStaticParams, so router.push() triggers a full server
    // round-trip (re-running getTodoData()) on every task/list selection,
    // which is what caused the visible flicker/rerender on the first click
    // after switching tasks. pushState only updates the URL bar and syncs
    // usePathname()/useSearchParams(), with no server request.
    window.history.pushState(null, "", path);
  }, [
    activeView,
    selectedListId,
    selectedTaskId,
    selectedLabelId,
    isListCalendarOpen,
    listCalendarView,
    listCalendarMultiDayCount,
    listCalendarMultiWeekCount,
    calendarView,
    calendarMultiDayCount,
    calendarMultiWeekCount,
    pathname,
    searchParamsKey,
  ]);

  const handleListCalendarViewChange = useCallback((view: CalendarViewTab) => {
    setListCalendarPanelView(view);
    if (
      view === "day" ||
      view === "week" ||
      view === "month" ||
      view === "days" ||
      view === "weeks"
    ) {
      setListCalendarView(view);
    }
  }, []);

  const handleListCalendarMultiDayCountChange = useCallback((count: number) => {
    setListCalendarMultiDayCount(clampListCalendarMultiDayCount(count));
  }, []);

  const handleListCalendarMultiWeekCountChange = useCallback(
    (count: number) => {
      setListCalendarMultiWeekCount(clampListCalendarMultiWeekCount(count));
    },
    [],
  );

  const handleCalendarViewChange = useCallback((view: CalendarViewTab) => {
    setCalendarPanelView(view);
    if (
      view === "day" ||
      view === "week" ||
      view === "month" ||
      view === "days" ||
      view === "weeks"
    ) {
      setCalendarView(view);
    }
  }, []);

  const handleCalendarMultiDayCountChange = useCallback((count: number) => {
    setCalendarMultiDayCount(clampListCalendarMultiDayCount(count));
  }, []);

  const handleCalendarMultiWeekCountChange = useCallback(
    (count: number) => {
      setCalendarMultiWeekCount(clampListCalendarMultiWeekCount(count));
    },
    [],
  );

  const applyCalendarViewSession = useCallback((session: ReturnType<typeof resolveCalendarViewSession>) => {
    setCalendarView(session.activeView);
    setCalendarPanelView(session.activeView);
    setListCalendarView(session.activeView);
    setListCalendarPanelView(session.activeView);
    setCalendarMultiDayCount(session.multiDayCount);
    setListCalendarMultiDayCount(session.multiDayCount);
    setCalendarMultiWeekCount(session.multiWeekCount);
    setListCalendarMultiWeekCount(session.multiWeekCount);
  }, []);

  const openCalendarShortcutModal = useCallback(() => {
    setSidebarHoverPreview(null);
    setIsCalendarShortcutModalOpen(true);
  }, []);

  const closeCalendarShortcutModal = useCallback(() => {
    setIsCalendarShortcutModalOpen(false);
  }, []);

  const expandCalendarShortcutModal = useCallback(
    (session: ReturnType<typeof resolveCalendarViewSession>) => {
      applyCalendarViewSession(session);
      setIsCalendarShortcutModalOpen(false);
      setIsListCalendarOpen(false);
      setIsListCalendarPreview(false);
      setSidebarHoverPreview(null);
      setActiveView("calendar");
      setSelectedLabelId(null);
      setSelectedListId(null);
      setSelectedTaskId(null);
    },
    [applyCalendarViewSession],
  );

  const openCalendarWithLastView = useCallback(() => {
    setIsListCalendarOpen(false);
    setIsListCalendarPreview(false);
    setSidebarHoverPreview(null);
    applyCalendarViewSession(
      resolveCalendarViewSession(readCalendarViewSession()),
    );
    setActiveView("calendar");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(null);
  }, [applyCalendarViewSession]);

  useEffect(() => {
    const route = parseTodoPath(pathname, searchParams);
    if (route?.kind === "calendar" || route?.kind === "listCalendar") {
      return;
    }

    applyCalendarViewSession(
      resolveCalendarViewSession(readCalendarViewSession()),
    );
  }, [applyCalendarViewSession, pathname, searchParamsKey]);

  useEffect(() => {
    if (activeView === "calendar") {
      saveCalendarViewSession({
        activeView: calendarPanelView,
        multiDayCount: calendarMultiDayCount,
        multiWeekCount: calendarMultiWeekCount,
      });
      return;
    }

    if (isListCalendarOpen) {
      saveCalendarViewSession({
        activeView: listCalendarPanelView,
        multiDayCount: listCalendarMultiDayCount,
        multiWeekCount: listCalendarMultiWeekCount,
      });
    }
  }, [
    activeView,
    calendarMultiDayCount,
    calendarMultiWeekCount,
    calendarPanelView,
    isListCalendarOpen,
    listCalendarMultiDayCount,
    listCalendarMultiWeekCount,
    listCalendarPanelView,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Alt" && !event.repeat) {
        const now = Date.now();
        if (now - lastAltPressAtRef.current <= DOUBLE_ALT_CALENDAR_MAX_GAP_MS) {
          event.preventDefault();
          lastAltPressAtRef.current = 0;
          openCalendarShortcutModal();
          return;
        }

        lastAltPressAtRef.current = now;
        return;
      }

      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;

      const key = event.key.toLowerCase();

      if (key === "z" && event.shiftKey) {
        if (reorderRedoStackRef.current.length === 0) return;
        event.preventDefault();
        void handleReorderRedo();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        if (pendingUndoRef.current) {
          event.preventDefault();
          void handleUndoCompletion();
          return;
        }

        if (reorderUndoStackRef.current.length === 0) return;
        event.preventDefault();
        void handleReorderUndo();
        return;
      }

      if (key === "y" && event.ctrlKey && !event.metaKey) {
        if (reorderRedoStackRef.current.length === 0) return;
        event.preventDefault();
        void handleReorderRedo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleReorderRedo,
    handleReorderUndo,
    handleUndoCompletion,
    openCalendarShortcutModal,
  ]);

  function clearListSelectionHighlightDelay() {
    if (listSelectionHighlightTimerRef.current !== null) {
      window.clearTimeout(listSelectionHighlightTimerRef.current);
      listSelectionHighlightTimerRef.current = null;
    }
    setSuppressListSelectionHighlightId(null);
  }

  function selectList(listId: string) {
    clearListSelectionHighlightDelay();
    setIsListCalendarOpen(false);
    setIsListCalendarPreview(false);
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(listId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, listId, null, lists, tasksByList),
    );
  }

  const cancelSidebarHoverClear = useCallback(() => {
    if (clearSidebarHoverTimerRef.current !== null) {
      window.clearTimeout(clearSidebarHoverTimerRef.current);
      clearSidebarHoverTimerRef.current = null;
    }
  }, []);

  const handleSidebarHoverStart = useCallback(
    (preview: SidebarHoverPreview) => {
      if (
        activeView === "calendar" ||
        isListCalendarOpen ||
        isListCalendarPreview ||
        isCalendarShortcutModalOpen
      ) {
        return;
      }

      cancelSidebarHoverClear();
      setSidebarHoverPreview(preview);
    },
    [
      activeView,
      cancelSidebarHoverClear,
      isCalendarShortcutModalOpen,
      isListCalendarOpen,
      isListCalendarPreview,
    ],
  );

  const handleSidebarHoverEnd = useCallback(() => {
    cancelSidebarHoverClear();

    if (sidebarHoverPreviewRef.current?.kind === "list") {
      setSidebarHoverPreview(null);
      return;
    }

    clearSidebarHoverTimerRef.current = window.setTimeout(() => {
      clearSidebarHoverTimerRef.current = null;
      setSidebarHoverPreview(null);
    }, 400);
  }, [cancelSidebarHoverClear]);

  function commitSidebarHoverSelection() {
    cancelSidebarHoverClear();
    const preview = sidebarHoverPreviewRef.current;
    if (!preview) return;

    setSidebarHoverPreview(null);

    if (preview.kind === "list") {
      return;
    }

    if (preview.labelId === selectedLabelId) return;
    selectLabel(preview.labelId);
  }

  function selectToday() {
    setActiveView("today");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("today", null, null, lists, tasksByList),
    );
  }

  function selectInbox() {
    setActiveView("inbox");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("inbox", null, null, lists, tasksByList),
    );
  }

  /*
  function selectNext7Days() {
    setActiveView("next7days");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("next7days", null, null, lists, tasksByList),
    );
  }
  */

  function selectImportant() {
    setActiveView("important");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("important", null, null, lists, tasksByList),
    );
  }

  useEffect(() => {
    if (importantEnabled || activeView !== "important") return;

    setActiveView("inbox");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("inbox", null, null, lists, tasksByList),
    );
  }, [importantEnabled, activeView, lists, tasksByList]);

  function selectCalendar() {
    openCalendarWithLastView();
  }

  function selectLabel(labelId: string) {
    setActiveView(null);
    setSelectedListId(null);
    setSelectedLabelId(labelId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, null, labelId, lists, tasksByList),
    );
  }

  async function selectCompletedTask(taskId: string, listId: string) {
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(listId);
    await selectTask(taskId);
  }

  async function selectSearchTask(taskId: string, listId: string) {
    setFocusNoteAtEndRequest((current) => current + 1);
    await selectCompletedTask(taskId, listId);
  }

  async function convertTaskToNote(taskId: string) {
    const updated = await convertTaskToNoteInDb(taskId);
    invalidateTaskDetailsFetchCache(taskId);

    setTasksByList((current) => {
      let changed = false;
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) => {
          if (task.id !== taskId) return task;

          changed = true;
          return {
            ...task,
            isNote: updated.isNote,
            completed: updated.completed,
            details: updated.details,
            hasDetails: taskDetailsHasContent(updated.details),
          };
        });
      }

      return changed ? next : current;
    });

    await selectTask(taskId);
    setFocusNoteAtEndRequest((current) => current + 1);
  }

  async function convertNoteToTask(taskId: string) {
    const updated = await convertNoteToTaskInDb(taskId);
    invalidateTaskDetailsFetchCache(taskId);

    setTasksByList((current) => {
      let changed = false;
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) => {
          if (task.id !== taskId) return task;

          changed = true;
          return {
            ...task,
            isNote: updated.isNote,
            completed: updated.completed,
            details: updated.details,
            hasDetails: taskDetailsHasContent(updated.details),
          };
        });
      }

      return changed ? next : current;
    });

    await selectTask(taskId);
  }

  async function toggleTaskNoteType(taskId: string) {
    let isNote = false;

    for (const tasks of Object.values(tasksByListRef.current)) {
      const task = tasks.find((entry) => entry.id === taskId);
      if (task) {
        isNote = task.isNote;
        break;
      }
    }

    if (isNote) {
      await convertNoteToTask(taskId);
      return;
    }

    await convertTaskToNote(taskId);
  }

  async function selectNewTaskAndFocusDetails(taskId: string) {
    listCalendarReturnTaskIdRef.current = null;
    setIsListCalendarOpen(false);
    setIsListCalendarPreview(false);
    await selectTask(taskId);
    setFocusNoteAtEndRequest((current) => current + 1);
  }

  async function selectNewTaskInList(taskId: string) {
    listCalendarReturnTaskIdRef.current = null;
    setIsListCalendarOpen(false);
    setIsListCalendarPreview(false);
    await selectTask(taskId);
  }

  async function addList(name: string) {
    if (!name.trim()) return;

    const list = await createTodoList(name.trim());
    setLists((current) => [...current, { id: list.id, name: list.name }]);
    setTasksByList((current) => ({ ...current, [list.id]: [] }));
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(list.id);
    setSelectedTaskId(null);
    setSuppressListSelectionHighlightId(list.id);

    if (listSelectionHighlightTimerRef.current !== null) {
      window.clearTimeout(listSelectionHighlightTimerRef.current);
    }
    listSelectionHighlightTimerRef.current = window.setTimeout(() => {
      listSelectionHighlightTimerRef.current = null;
      setSuppressListSelectionHighlightId((current) =>
        current === list.id ? null : current,
      );
    }, 150);
  }

  async function renameList(listId: string, name: string) {
    const list = await renameTodoList(listId, name);
    setLists((current) =>
      current.map((item) =>
        item.id === listId ? { ...item, name: list.name } : item,
      ),
    );
  }

  async function reorderLists(listIds: string[]) {
    setLists((current) => {
      const listMap = new Map(current.map((list) => [list.id, list]));
      return listIds
        .map((id) => listMap.get(id))
        .filter((list): list is TodoList => list !== undefined);
    });

    await reorderTodoListsInDb(listIds);
  }

  async function reorderLabels(labelIds: string[]) {
    setLabels((current) => {
      const labelMap = new Map(current.map((label) => [label.id, label]));
      return labelIds
        .map((id) => labelMap.get(id))
        .filter((label): label is TaskLabel => label !== undefined);
    });

    await reorderLabelsInDb(labelIds);
  }

  async function removeList(listId: string) {
    const removedTasks = tasksByList[listId] ?? [];

    await deleteTodoList(listId);

    setLists((current) => current.filter((item) => item.id !== listId));
    setTasksByList((current) => {
      const next = { ...current };
      delete next[listId];
      return next;
    });

    if (selectedListId === listId) {
      setSelectedListId(null);
    }

    if (selectedTaskId && removedTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }

  function updateLabelInTasks(
    labelId: string,
    updater: (label: TaskLabel) => TaskLabel,
  ) {
    setTasksByList((current) =>
      Object.fromEntries(
        Object.entries(current).map(([listId, tasks]) => [
          listId,
          tasks.map((task) => ({
            ...task,
            labels: task.labels.map((item) =>
              item.id === labelId ? updater(item) : item,
            ),
          })),
        ]),
      ),
    );
  }

  function removeLabelFromTasks(labelId: string) {
    setTasksByList((current) =>
      Object.fromEntries(
        Object.entries(current).map(([listId, tasks]) => [
          listId,
          tasks.map((task) => ({
            ...task,
            labels: task.labels.filter((item) => item.id !== labelId),
          })),
        ]),
      ),
    );
  }

  async function renameLabel(labelId: string, name: string) {
    const label = await renameLabelInDb(labelId, name);
    setLabels((current) =>
      current.map((item) =>
        item.id === labelId
          ? { ...item, label: label.label, color: label.color }
          : item,
      ),
    );
    updateLabelInTasks(labelId, (item) => ({
      ...item,
      label: label.label,
      color: label.color,
    }));
  }

  async function addLabel(name: string, color: string) {
    const label = await createLabelInDb(name, color);
    setLabels((current) =>
      [...current, label].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    );
  }

  async function removeLabel(labelId: string) {
    await deleteLabelInDb(labelId);
    setLabels((current) => current.filter((item) => item.id !== labelId));
    removeLabelFromTasks(labelId);

    if (selectedLabelId === labelId) {
      setSelectedLabelId(null);
    }
  }

  async function updateLabelColor(labelId: string, color: string) {
    const label = await updateLabelColorInDb(labelId, color);
    setLabels((current) =>
      current.map((item) =>
        item.id === labelId
          ? { ...item, label: label.label, color: label.color }
          : item,
      ),
    );
    updateLabelInTasks(labelId, (item) => ({
      ...item,
      label: label.label,
      color: label.color,
    }));
  }

  async function addTask(name: string, options?: AddTaskOptions) {
    if (!name.trim()) return;

    const targetListId =
      options?.listId ??
      displayedListId ??
      (displayedActiveView === "inbox" ? inboxListId : null) ??
      (displayedLabelId ||
      displayedActiveView === "today" ||
      displayedActiveView === "important"
        ? inboxListId
        : null);
    if (!targetListId) return;

    const dueDateValue =
      options?.dueDate !== undefined
        ? options.dueDate
        : displayedListId || displayedLabelId || displayedActiveView !== "today"
          ? null
          : getTodayDateValue();
    const markImportant = displayedActiveView === "important";
    const task = await createTask(targetListId, name.trim(), dueDateValue);

    if (markImportant) {
      await updateTaskImportantInDb(task.id, true);
    }

    let resolvedDueTimeMinutes: number | null = null;
    let resolvedDueDurationMinutes: number | null = null;
    let resolvedDueTimeZone: TaskDueTime["dueTimeZone"] = "floating";

    if (options?.dueTime) {
      const updated = await updateTaskDueTimeInDb(task.id, options.dueTime);
      resolvedDueTimeMinutes = updated.dueTimeMinutes;
      resolvedDueDurationMinutes = updated.dueDurationMinutes;
      resolvedDueTimeZone = updated.dueTimeZone;
    }

    let resolvedPriority: number | null = null;
    if (options?.priority !== undefined && options.priority !== null) {
      const updated = await updateTaskPriorityInDb(task.id, options.priority);
      resolvedPriority = updated.priority;
    }

    let resolvedRecurrenceRule: string | null = null;
    if (options?.recurrenceRule !== undefined) {
      const updated = await updateTaskRecurrenceInDb(
        task.id,
        options.recurrenceRule,
      );
      resolvedRecurrenceRule = updated.recurrenceRule;
    }

    let resolvedLabels: TaskLabel[] = [];
    if (options?.label?.trim()) {
      await addTaskLabelInDb(task.id, options.label.trim());
      resolvedLabels = await getTaskLabels(task.id);
      refreshLabels();
    }

    const createdSubtasks: Task[] = [];
    if (subtasksEnabled && options?.subtasks?.length) {
      for (const subtaskName of options.subtasks) {
        const subtask = await createSubtask(task.id, subtaskName);
        createdSubtasks.push({
          id: subtask.id,
          name: subtask.name,
          completed: false,
          details: "",
          hasDetails: false,
          dueDate: null,
          dueTimeMinutes: null,
          dueDurationMinutes: null,
          dueTimeZone: "floating",
          calendarColor: null,
          recurrenceRule: null,
          priority: null,
          pinned: false,
          important: false,
          isNote: false,
          parentId: subtask.parentId,
          labels: [],
        });
      }
    }

    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: task.details,
      hasDetails: taskDetailsHasContent(task.details),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      dueTimeMinutes: resolvedDueTimeMinutes,
      dueDurationMinutes: resolvedDueDurationMinutes,
      dueTimeZone: resolvedDueTimeZone,
      calendarColor: null,
      recurrenceRule: resolvedRecurrenceRule,
      priority: resolvedPriority,
      pinned: false,
      important: markImportant,
      isNote: false,
      parentId: null,
      labels: resolvedLabels,
    };

    setTasksByList((current) => ({
      ...current,
      [targetListId]: [
        newTask,
        ...createdSubtasks,
        ...(current[targetListId] ?? []),
      ],
    }));

    if (options?.keepFormOpen) {
      await selectNewTaskInList(task.id);
    } else {
      await selectNewTaskAndFocusDetails(task.id);
    }
  }

  async function addCalendarTask(payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
    dueTimeMinutes?: number | null;
  }) {
    const { name, dueDate, details, listId, dueTimeMinutes = null } = payload;
    if (!name.trim() || !listId) return;

    const task = await createTask(listId, name.trim(), dueDate);
    const detailsHtml = plainTextToTaskDetails(details);

    if (detailsHtml) {
      await updateTaskDetailsInDb(task.id, detailsHtml);
    }

    let resolvedDueTimeMinutes: number | null = null;
    let resolvedDueDurationMinutes: number | null = null;
    let resolvedDueTimeZone: TaskDueTime["dueTimeZone"] = "floating";

    if (dueTimeMinutes !== null && dueTimeMinutes !== undefined) {
      const updated = await updateTaskDueTimeInDb(task.id, {
        dueTimeMinutes,
        dueDurationMinutes: null,
        dueTimeZone: "floating",
      });
      resolvedDueTimeMinutes = updated.dueTimeMinutes;
      resolvedDueDurationMinutes = updated.dueDurationMinutes;
      resolvedDueTimeZone = updated.dueTimeZone;
    }

    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: detailsHtml,
      hasDetails: taskDetailsHasContent(detailsHtml),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      dueTimeMinutes: resolvedDueTimeMinutes,
      dueDurationMinutes: resolvedDueDurationMinutes,
      dueTimeZone: resolvedDueTimeZone,
      calendarColor: null,
      recurrenceRule: null,
      priority: null,
      pinned: false,
      important: false,
      isNote: false,
      parentId: null,
      labels: [],
    };

    setTasksByList((current) => ({
      ...current,
      [listId]: [newTask, ...(current[listId] ?? [])],
    }));

    if (activeView === "calendar" || isListCalendarOpen) {
      return;
    }

    selectNewTaskAndFocusDetails(task.id);
  }

  async function toggleTask(taskId: string) {
    let listId = selectedListId;

    if (!listId) {
      for (const [id, listTasks] of Object.entries(tasksByList)) {
        if (listTasks.some((item) => item.id === taskId)) {
          listId = id;
          break;
        }
      }
    }

    if (!listId) return;

    const task = (tasksByList[listId] ?? []).find((item) => item.id === taskId);
    if (!task) return;

    const completed = !task.completed;

    if (completed) {
      if (completingTaskIds.has(taskId) || checkAnimatingTaskIds.has(taskId)) {
        return;
      }

      setCheckAnimatingTaskIds((current) => new Set(current).add(taskId));

      const useAcceleratedCompletion = sessionCompletionCountRef.current >= 1;
      sessionCompletionCountRef.current += 1;
      const checkboxAnimationMs = getCompletionAnimationMs(
        CHECKBOX_COMPLETE_ANIMATION_MS,
        useAcceleratedCompletion,
      );
      const completionDisplayMs = getCompletionAnimationMs(
        COMPLETION_DISPLAY_MS,
        useAcceleratedCompletion,
      );
      setCompletingTasks((current) => {
        const ids = new Set(current.ids).add(taskId);
        if (!useAcceleratedCompletion) {
          return { ...current, ids };
        }

        return {
          ids,
          withoutBackgroundIds: new Set(current.withoutBackgroundIds).add(taskId),
        };
      });

      if (selectedTaskId === taskId) {
        const nextTaskId =
          getVisibleTasks(
            activeView,
            selectedListId ?? listId,
            selectedLabelId,
            lists,
            tasksByList,
          ).find((item) => item.id !== taskId)?.id ?? null;
        setSelectedTaskId(nextTaskId);
      }

      clearCompletionTimer(taskId);
      completionTimerRef.current[taskId] = window.setTimeout(() => {
        setCheckAnimatingTaskIds((current) => {
          if (!current.has(taskId)) return current;
          const next = new Set(current);
          next.delete(taskId);
          return next;
        });
        scheduleUndo({
          taskId,
          listId,
          taskName: task.name,
        });

        completionTimerRef.current[taskId] = window.setTimeout(() => {
          void finalizeTaskCompletion(taskId, listId);
        }, completionDisplayMs);
      }, checkboxAnimationMs);
      return;
    }

    dismissUndo();
    clearCompletionTimer(taskId);
    removeCompletingTask(taskId);

    await toggleTaskInDb(taskId, false);

    setTasksByList((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).map((item) =>
        item.id === taskId ? { ...item, completed: false } : item,
      ),
    }));
  }

  const handleDetailsSaved = useCallback((taskId: string, details: string) => {
    const hasDetails = taskDetailsHasContent(details);
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, details, hasDetails } : task,
        );
      }

      return next;
    });
  }, []);

  const handleTaskHasDetailsKnown = useCallback(
    (taskId: string, hasDetails: boolean) => {
      setTasksByList((current) => {
        let changed = false;
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) => {
            if (task.id !== taskId || task.hasDetails === hasDetails) {
              return task;
            }

            changed = true;
            return { ...task, hasDetails };
          });
        }

        return changed ? next : current;
      });
    },
    [],
  );

  const handleTaskRenamed = useCallback((taskId: string, name: string) => {
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, name } : task,
        );
      }

      return next;
    });
  }, []);

  const handleDueDateUpdated = useCallback(
    (
      taskId: string,
      dueDate: string | null,
      dueTime?: {
        dueTimeMinutes: number | null;
        dueDurationMinutes: number | null;
        dueTimeZone: string;
      },
    ) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueDate,
                  ...(dueTime ?? {}),
                }
              : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handleRecurrenceUpdated = useCallback(
    (taskId: string, recurrenceRule: string | null) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, recurrenceRule } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handleUndoRecurrence = useCallback(async () => {
    const undo = pendingRecurrenceUndoRef.current;
    if (!undo) return;

    const previousRule = parseRecurrenceRule(undo.previousRecurrenceRule);
    const updated = await updateTaskRecurrenceInDb(undo.taskId, previousRule);
    handleRecurrenceUpdated(undo.taskId, updated.recurrenceRule);
    dismissRecurrenceUndo();
  }, [dismissRecurrenceUndo, handleRecurrenceUpdated]);

  const handlePriorityUpdated = useCallback(
    (taskId: string, priority: number | null) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, priority } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handleCalendarColorUpdated = useCallback(
    (taskId: string, calendarColor: string | null) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, calendarColor } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handlePinnedUpdated = useCallback((taskId: string, pinned: boolean) => {
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, pinned } : task,
        );
      }

      return next;
    });
  }, []);

  const handleImportantUpdated = useCallback(
    (taskId: string, important: boolean) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, important } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handleTaskLabelsUpdated = useCallback(
    (taskId: string, nextLabels: TaskLabel[]) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, labels: nextLabels } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  async function renameTask(taskId: string, name: string) {
    const updatedTask = await renameTaskInDb(taskId, name);
    handleTaskRenamed(taskId, updatedTask.name);
  }

  const handleDueTimeUpdated = useCallback(
    (taskId: string, dueTime: TaskDueTime) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueTimeMinutes: dueTime.dueTimeMinutes,
                  dueDurationMinutes: dueTime.dueDurationMinutes,
                  dueTimeZone: dueTime.dueTimeZone,
                }
              : task,
          );
        }

        return next;
      });
    },
    [],
  );

  async function setTaskDueTime(taskId: string, dueTime: TaskDueTime) {
    handleDueTimeUpdated(taskId, dueTime);

    const updated = await updateTaskDueTimeInDb(taskId, dueTime);
    handleDueTimeUpdated(taskId, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  async function setTaskDueDate(taskId: string, dateValue: string | null) {
    const normalizedDateValue = dateValue ?? null;
    const optimisticDueDate = normalizedDateValue
      ? new Date(`${normalizedDateValue}T00:00:00`).toISOString()
      : null;
    handleDueDateUpdated(taskId, optimisticDueDate);

    const updated = await updateTaskDueDateInDb(taskId, normalizedDateValue);
    const dueDate = updated.dueDate
      ? new Date(updated.dueDate).toISOString()
      : null;

    handleDueDateUpdated(taskId, dueDate, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  // Updates both the due date and due time in a single optimistic update and
  // a single server round trip. Used when a calendar drag moves a task to a
  // different day AND a different time slot at once — issuing separate
  // setTaskDueDate/setTaskDueTime calls in that case can race on the server
  // (the date-change request resets time fields) and cause the task to
  // briefly flash back to its old position before settling.
  async function setTaskDueDateAndTime(
    taskId: string,
    dateValue: string | null,
    dueTime: TaskDueTime,
  ) {
    const normalizedDateValue = dateValue ?? null;
    const optimisticDueDate = normalizedDateValue
      ? new Date(`${normalizedDateValue}T00:00:00`).toISOString()
      : null;
    handleDueDateUpdated(taskId, optimisticDueDate, {
      dueTimeMinutes: dueTime.dueTimeMinutes,
      dueDurationMinutes: dueTime.dueDurationMinutes,
      dueTimeZone: dueTime.dueTimeZone,
    });

    const updated = await updateTaskDueDateAndTimeInDb(
      taskId,
      normalizedDateValue,
      dueTime,
    );
    const dueDate = updated.dueDate
      ? new Date(updated.dueDate).toISOString()
      : null;

    handleDueDateUpdated(taskId, dueDate, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  async function setTaskRecurrence(
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) {
    let previousRecurrenceRule: string | null = null;
    let taskName = "";
    let listId = "";

    for (const [currentListId, listTasks] of Object.entries(
      tasksByListRef.current,
    )) {
      const task = listTasks.find((item) => item.id === taskId);
      if (!task) continue;

      previousRecurrenceRule = task.recurrenceRule;
      taskName = task.name;
      listId = currentListId;
      break;
    }

    const updated = await updateTaskRecurrenceInDb(taskId, rule);
    handleRecurrenceUpdated(taskId, updated.recurrenceRule);

    if (previousRecurrenceRule !== updated.recurrenceRule) {
      scheduleRecurrenceUndo({
        taskId,
        listId,
        taskName,
        previousRecurrenceRule,
        message: getRecurrenceUndoMessage(rule),
      });
    }
  }

  async function setTaskPriority(taskId: string, priority: number | null) {
    const updated = await updateTaskPriorityInDb(taskId, priority);
    handlePriorityUpdated(taskId, updated.priority);
  }

  async function setTaskCalendarColor(
    taskId: string,
    calendarColor: string | null,
  ) {
    let previousColor: string | null = null;
    for (const listTasks of Object.values(tasksByList)) {
      const match = listTasks.find((task) => task.id === taskId);
      if (match) {
        previousColor = match.calendarColor;
        break;
      }
    }

    handleCalendarColorUpdated(taskId, calendarColor);

    try {
      const updated = await updateTaskCalendarColorInDb(taskId, calendarColor);
      handleCalendarColorUpdated(taskId, updated.calendarColor);
    } catch {
      handleCalendarColorUpdated(taskId, previousColor);
    }
  }

  async function setTaskPinned(taskId: string, pinned: boolean) {
    handlePinnedUpdated(taskId, pinned);

    try {
      await updateTaskPinnedInDb(taskId, pinned);
    } catch {
      handlePinnedUpdated(taskId, !pinned);
    }
  }

  async function setTaskImportant(taskId: string, important: boolean) {
    handleImportantUpdated(taskId, important);

    try {
      await updateTaskImportantInDb(taskId, important);
    } catch {
      handleImportantUpdated(taskId, !important);
    }
  }

  async function toggleTaskLabel(
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) {
    const updatedLabels = await setTaskLabelInDb(taskId, labelId, assigned);
    handleTaskLabelsUpdated(taskId, updatedLabels);
    refreshLabels();
    return updatedLabels;
  }

  function findTaskListId(taskId: string) {
    for (const [listId, listTasks] of Object.entries(tasksByList)) {
      if (listTasks.some((item) => item.id === taskId)) {
        return listId;
      }
    }

    return null;
  }

  function getSubtaskInsertIndex(tasks: Task[], parentId: string) {
    const parentIndex = tasks.findIndex((item) => item.id === parentId);
    if (parentIndex < 0) return tasks.length;

    let insertIndex = parentIndex + 1;
    while (
      insertIndex < tasks.length &&
      tasks[insertIndex]?.parentId === parentId
    ) {
      insertIndex += 1;
    }

    return insertIndex;
  }

  async function addSubtask(parentId: string): Promise<TaskListItem | null> {
    const parentListId = findTaskListId(parentId);
    if (!parentListId) return null;

    const parentTask = (tasksByList[parentListId] ?? []).find(
      (item) => item.id === parentId,
    );
    if (!parentTask || parentTask.parentId || parentTask.isNote) {
      return null;
    }

    try {
      const subtask = await createSubtask(parentId, "Subtask");
      const newTask: TaskListItem = {
        id: subtask.id,
        name: subtask.name,
        completed: false,
        details: "",
        hasDetails: false,
        dueDate: null,
        dueTimeMinutes: null,
        dueDurationMinutes: null,
        dueTimeZone: "floating",
        calendarColor: null,
        recurrenceRule: null,
        priority: null,
        pinned: false,
        important: false,
        isNote: false,
        parentId: subtask.parentId,
        labels: [],
        listId: parentListId,
        listName: lists.find((list) => list.id === parentListId)?.name,
      };

      setTasksByList((current) => {
        const listTasks = current[parentListId] ?? [];
        const insertIndex = getSubtaskInsertIndex(listTasks, parentId);

        return {
          ...current,
          [parentListId]: [
            ...listTasks.slice(0, insertIndex),
            newTask,
            ...listTasks.slice(insertIndex),
          ],
        };
      });

      return newTask;
    } catch {
      return null;
    }
  }

  async function deleteTaskById(taskId: string) {
    const listId = findTaskListId(taskId);
    if (!listId) return;

    const listTasks = tasksByList[listId] ?? [];
    const childIds = listTasks
      .filter((item) => item.parentId === taskId)
      .map((item) => item.id);
    const removedIds = new Set([taskId, ...childIds]);

    if (selectedTaskId && removedIds.has(selectedTaskId)) {
      await detailsSaveControllerRef.current?.flushSave();
    }

    await deleteTaskInDb(taskId);

    setTasksByList((current) => {
      const next = { ...current };

      for (const currentListId of Object.keys(next)) {
        next[currentListId] = next[currentListId].filter(
          (item) => !removedIds.has(item.id),
        );
      }

      return next;
    });

    if (selectedTaskId && removedIds.has(selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }

  async function moveTaskToList(
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) {
    if (sourceListId === targetListId) return;

    const sourceTasks = tasksByList[sourceListId] ?? [];
    const task = sourceTasks.find((item) => item.id === taskId);
    if (!task) return;

    const childIds = sourceTasks
      .filter((item) => item.parentId === taskId)
      .map((item) => item.id);
    const movingIds = new Set([taskId, ...childIds]);
    const removedSelectionId =
      selectedTaskId && movingIds.has(selectedTaskId) ? selectedTaskId : null;
    const shouldReselect = removedSelectionId !== null;
    const nextTaskId = shouldReselect
      ? getNextTaskIdAfterRemove(
          getVisibleTasks(
            activeView,
            selectedListId ?? sourceListId,
            selectedLabelId,
            lists,
            tasksByList,
          ),
          removedSelectionId,
        )
      : null;

    if (removedSelectionId) {
      await detailsSaveControllerRef.current?.flushSave();
    }

    await moveTaskToListInDb(taskId, targetListId);

    setTasksByList((current) => {
      const sourceList = current[sourceListId] ?? [];
      const nextSource = sourceList.filter((item) => !movingIds.has(item.id));
      const movedTasks = sourceList
        .filter((item) => movingIds.has(item.id))
        .map((item) => ({
          ...item,
          ...(item.id === taskId && item.parentId ? { parentId: null } : {}),
        }));
      const nextTarget = [...movedTasks, ...(current[targetListId] ?? [])];

      return {
        ...current,
        [sourceListId]: nextSource,
        [targetListId]: nextTarget,
      };
    });

    if (shouldReselect) {
      await selectTask(nextTaskId);
    }
  }

  async function reorderTasks(
    listId: string,
    activeTaskIds: string[],
    section: "pinned" | "unpinned",
    parentUpdates: Array<{ taskId: string; parentId: string | null }> = [],
  ) {
    let mergedTaskIds: string[] | null = null;
    let previousSnapshot: ListTasksSnapshot | null = null;

    setTasksByList((current) => {
      const currentTasks = current[listId] ?? [];
      const expectedActiveCount =
        section === "pinned"
          ? currentTasks.filter((task) => !task.completed && task.pinned).length
          : currentTasks.filter((task) => !task.completed && !task.pinned)
              .length;

      if (activeTaskIds.length !== expectedActiveCount) {
        return current;
      }

      let mergedTasks =
        section === "pinned"
          ? mergeReorderedPinnedTasks(currentTasks, activeTaskIds)
          : mergeReorderedUnpinnedTasks(currentTasks, activeTaskIds);

      if (parentUpdates.length > 0) {
        const parentByTaskId = new Map(
          parentUpdates.map((update) => [update.taskId, update.parentId]),
        );
        mergedTasks = mergedTasks.map((task) =>
          parentByTaskId.has(task.id)
            ? { ...task, parentId: parentByTaskId.get(task.id)! }
            : task,
        );
      }

      mergedTaskIds = mergedTasks.map((task) => task.id);

      const previousIds = currentTasks.map((task) => task.id);
      const orderChanged = mergedTaskIds.join(",") !== previousIds.join(",");
      const parentChanged = parentUpdates.some((update) => {
        const task = currentTasks.find((item) => item.id === update.taskId);
        return task && (task.parentId ?? null) !== update.parentId;
      });

      if (!orderChanged && !parentChanged) {
        mergedTaskIds = null;
        return current;
      }

      previousSnapshot = {
        listId,
        tasks: cloneListTasks(currentTasks),
      };

      return {
        ...current,
        [listId]: mergedTasks,
      };
    });

    if (!mergedTaskIds || !previousSnapshot) return;

    reorderUndoStackRef.current = [
      ...reorderUndoStackRef.current,
      previousSnapshot,
    ];
    reorderRedoStackRef.current = [];

    await reorderTasksInDb(listId, mergedTaskIds, parentUpdates);
  }

  const closeListCalendar = useCallback(() => {
    setIsListCalendarOpen(false);
    setIsListCalendarPreview(false);
    setListCalendarShowingDetails(false);
    setCalendarExternalDropTarget(null);
    listCalendarReturnTaskIdRef.current = null;

    if (!selectedListId) return;

    setSelectedTaskId(
      getFirstVisibleTaskId(null, selectedListId, null, lists, tasksByList),
    );
  }, [lists, selectedListId, tasksByList]);

  const cancelListCalendarPreviewClose = useCallback(() => {
    if (listCalendarPreviewCloseTimerRef.current !== null) {
      window.clearTimeout(listCalendarPreviewCloseTimerRef.current);
      listCalendarPreviewCloseTimerRef.current = null;
    }
  }, []);

  const openListCalendarPreview = useCallback(() => {
    if (!selectedListId || isListCalendarOpen) return;

    cancelListCalendarPreviewClose();
    setIsListCalendarPreview(true);
  }, [cancelListCalendarPreviewClose, isListCalendarOpen, selectedListId]);

  const scheduleListCalendarPreviewClose = useCallback(() => {
    if (isListCalendarOpen) return;

    cancelListCalendarPreviewClose();
    listCalendarPreviewCloseTimerRef.current = window.setTimeout(() => {
      listCalendarPreviewCloseTimerRef.current = null;
      setIsListCalendarPreview(false);
    }, 150);
  }, [cancelListCalendarPreviewClose, isListCalendarOpen]);

  const toggleListCalendar = useCallback(() => {
    if (!selectedListId) return;

    cancelListCalendarPreviewClose();
    setIsListCalendarPreview(false);

    if (isListCalendarOpen) {
      if (listCalendarShowingDetails) {
        setListCalendarShowingDetails(false);
        return;
      }
      closeListCalendar();
      return;
    }

    setIsListCalendarOpen(true);
    setListCalendarShowingDetails(false);
  }, [
    cancelListCalendarPreviewClose,
    closeListCalendar,
    isListCalendarOpen,
    listCalendarShowingDetails,
    selectedListId,
  ]);

  const handleTaskListSelect = useCallback(
    async (taskId: string) => {
      if (isListCalendarOpen) {
        listCalendarReturnTaskIdRef.current = null;
        setListCalendarShowingDetails(true);
        await selectTask(taskId);
        return;
      }
      await selectTask(taskId);
      setFocusTaskTitleRequest((current) => current + 1);
    },
    [isListCalendarOpen, selectTask],
  );

  const handleListCalendarTaskSelect = useCallback(
    async (taskId: string) => {
      await selectTask(taskId);
    },
    [selectTask],
  );

  useEffect(() => {
    const route = parseTodoPath(pathname, searchParams);
    if (
      route?.kind === "listCalendar" &&
      route.listId === selectedListId
    ) {
      return;
    }

    setIsListCalendarOpen(false);
    setIsListCalendarPreview(false);
    setListCalendarShowingDetails(false);
    listCalendarReturnTaskIdRef.current = null;
    setCalendarExternalDropTarget(null);
  }, [selectedListId, pathname]);

  useEffect(() => {
    setSidebarHoverPreview(null);
  }, [selectedListId, selectedLabelId, activeView]);

  useEffect(() => {
    if (isListCalendarOpen || isListCalendarPreview) return;
    if (activeView !== null || selectedLabelId !== null) return;
    if (!selectedListId || selectedTaskId) return;

    const firstTaskId = getFirstVisibleTaskId(
      null,
      selectedListId,
      null,
      lists,
      tasksByList,
    );
    if (firstTaskId) {
      setSelectedTaskId(firstTaskId);
    }
  }, [
    activeView,
    isListCalendarOpen,
    isListCalendarPreview,
    lists,
    selectedLabelId,
    selectedListId,
    selectedTaskId,
    tasksByList,
  ]);

  useEffect(() => {
    if (
      activeView !== "calendar" &&
      !isListCalendarOpen &&
      !isListCalendarPreview
    ) {
      return;
    }

    setSidebarHoverPreview(null);
  }, [activeView, isListCalendarOpen, isListCalendarPreview]);

  useEffect(() => {
    return () => {
      cancelSidebarHoverClear();
      cancelListCalendarPreviewClose();
      if (listSelectionHighlightTimerRef.current !== null) {
        window.clearTimeout(listSelectionHighlightTimerRef.current);
      }
    };
  }, [cancelListCalendarPreviewClose, cancelSidebarHoverClear]);

  const useFixedWidthTaskListPanel =
    displayedListId !== null ||
    displayedLabelId !== null ||
    displayedActiveView === "today" ||
    displayedActiveView === "inbox" ||
    displayedActiveView === "important";
  const showListCalendar = isListCalendarOpen || isListCalendarPreview;
  const showListCalendarPanel =
    showListCalendar && !(isListCalendarOpen && listCalendarShowingDetails);
  const showRightPanel =
    selectedTaskId !== null || showListCalendar || useFixedWidthTaskListPanel;
  const showTaskDetails =
    selectedTaskId !== null &&
    (!showListCalendar || (isListCalendarOpen && listCalendarShowingDetails));
  const compactDetailView =
    isCompactLayout && (selectedTaskId !== null || showListCalendar);
  const compactShowTaskList = !isCompactLayout || !compactDetailView;

  const handleCompactBack = useCallback(() => {
    if (isListCalendarOpen && listCalendarShowingDetails) {
      setListCalendarShowingDetails(false);
      return;
    }
    if (isListCalendarOpen) {
      setIsListCalendarOpen(false);
      setListCalendarShowingDetails(false);
      return;
    }
    setSelectedTaskId(null);
  }, [isListCalendarOpen, listCalendarShowingDetails]);

  const selectedTaskSnapshot = useMemo(() => {
    if (!selectedTaskId) return null;

    for (const listTasks of Object.values(tasksByList)) {
      const task = listTasks.find((item) => item.id === selectedTaskId);
      if (!task) continue;

      return {
        name: task.name,
        completed: task.completed,
        dueDate: task.dueDate,
        dueTimeMinutes: task.dueTimeMinutes,
        dueDurationMinutes: task.dueDurationMinutes,
        dueTimeZone: task.dueTimeZone,
        recurrenceRule: task.recurrenceRule,
        isNote: task.isNote,
      };
    }

    return null;
  }, [selectedTaskId, tasksByList]);

  const selectedTaskSubtasksContext = useMemo(() => {
    if (!selectedTaskId) {
      return { subtasks: [], canManageSubtasks: false };
    }

    for (const listTasks of Object.values(tasksByList)) {
      const task = listTasks.find((item) => item.id === selectedTaskId);
      if (!task) continue;

      return {
        subtasks: listTasks
          .filter((item) => item.parentId === selectedTaskId)
          .map((item) => ({
            id: item.id,
            name: item.name,
            completed: item.completed,
          })),
        canManageSubtasks:
          subtasksEnabled && !task.parentId && !task.isNote,
      };
    }

    return { subtasks: [], canManageSubtasks: false };
  }, [selectedTaskId, tasksByList, subtasksEnabled]);

  const handleAddSubtaskFromDetails = useCallback(
    async (parentTaskId: string) => {
      const subtask = await addSubtask(parentTaskId);
      if (!subtask) return null;

      return {
        id: subtask.id,
        name: subtask.name,
        completed: subtask.completed,
      };
    },
    [addSubtask],
  );

  const calendarPanelSharedProps = {
    tasks: calendarTasks,
    searchTasks,
    lists,
    completingTaskIds,
    completingWithoutBackgroundTaskIds,
    checkAnimatingTaskIds,
    selectedTaskId,
    onToggleTask: toggleTask,
    onSelectTask: selectTask,
    onRenameTask: renameTask,
  onSetTaskDueDate: setTaskDueDate,
  onSetTaskDueTime: setTaskDueTime,
  onSetTaskPriority: setTaskPriority,
    onSetTaskCalendarColor: setTaskCalendarColor,
    onToggleTaskLabel: toggleTaskLabel,
    onLabelsChanged: refreshLabels,
    onMoveTaskToList: moveTaskToList,
    onDetailsSaved: handleDetailsSaved,
    onTaskHasDetailsKnown: handleTaskHasDetailsKnown,
    onTaskRenamed: handleTaskRenamed,
    onDueDateUpdated: handleDueDateUpdated,
    onRecurrenceUpdated: handleRecurrenceUpdated,
    onSaveTaskRecurrence: setTaskRecurrence,
    onAddCalendarTask: addCalendarTask,
    labels,
    onDeleteTask: deleteTaskById,
    defaultListId: inboxListId,
  } as const;

  return (
    <>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          lists={lists}
          labels={sidebarLabels}
          taskCountByListId={taskCountByListId}
          taskCountByLabelId={taskCountByLabelId}
          completedTasks={completedTasks}
          searchTasks={searchTasks}
          completingTaskIds={completingTaskIds}
          checkAnimatingTaskIds={checkAnimatingTaskIds}
          calendarTasks={calendarTasks}
          selectedListId={selectedListId}
          suppressListSelectionHighlightId={suppressListSelectionHighlightId}
          selectedLabelId={selectedLabelId}
          isTodaySelected={activeView === "today"}
          isInboxSelected={activeView === "inbox"}
          // isNext7DaysSelected={activeView === "next7days"}
          isImportantSelected={activeView === "important"}
          isCalendarSelected={activeView === "calendar"}
          selectedTaskId={selectedTaskId}
          onSelectList={selectList}
          onSelectLabel={selectLabel}
          onSelectToday={selectToday}
          onSelectInbox={selectInbox}
          // onSelectNext7Days={selectNext7Days}
          onSelectImportant={selectImportant}
          onSelectCalendar={selectCalendar}
          onSelectCompletedTask={selectCompletedTask}
          onSelectSearchTask={selectSearchTask}
          onToggleTask={toggleTask}
          onAddList={addList}
          onAddLabel={addLabel}
          onRenameList={renameList}
          onRemoveList={removeList}
          onRenameLabel={renameLabel}
          onRemoveLabel={removeLabel}
          onUpdateLabelColor={updateLabelColor}
          onReorderLists={reorderLists}
          onReorderLabels={reorderLabels}
          onSidebarHoverStart={handleSidebarHoverStart}
          onSidebarHoverEnd={handleSidebarHoverEnd}
          sidebarHoverPreview={sidebarHoverPreview}
          compactDrawer={isCompactLayout}
          drawerOpen={sidebarDrawerOpen}
          onDrawerClose={() => setSidebarDrawerOpen(false)}
          taskDropHighlightListId={sidebarListDropTarget?.listId ?? null}
        />
        {showingCalendarMonth ? (
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            onMouseEnter={commitSidebarHoverSelection}
          >
            {isCompactLayout ? (
              <div className="flex shrink-0 items-center border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 lg:hidden">
                <button
                  type="button"
                  aria-label="Open menu"
                  className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => setSidebarDrawerOpen(true)}
                >
                  <LuMenu className="size-5" aria-hidden="true" />
                </button>
                <span className="ml-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Calendar
                </span>
              </div>
            ) : null}
            <CalendarPanel
              {...calendarPanelSharedProps}
              view={calendarPanelView}
              onViewChange={handleCalendarViewChange}
              multiDayCount={calendarMultiDayCount}
              multiWeekCount={calendarMultiWeekCount}
              onMultiDayCountChange={handleCalendarMultiDayCountChange}
              onMultiWeekCountChange={handleCalendarMultiWeekCountChange}
              persistViewSession={false}
            />
          </div>
        ) : showRightPanel ? (
          <div
            ref={splitContainerRef}
            className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            {compactShowTaskList ? (
              <div
                className="flex min-h-0 shrink-0"
                onMouseEnter={commitSidebarHoverSelection}
              >
                <TaskListPanel
                  title={taskListTitle}
                  viewResetKey={taskListViewResetKey}
                  tasks={taskListItems}
                  completedTasks={listCompletedTasks}
                  lists={lists}
                  completingTaskIds={completingTaskIds}
                  completingWithoutBackgroundTaskIds={
                    completingWithoutBackgroundTaskIds
                  }
                  checkAnimatingTaskIds={checkAnimatingTaskIds}
                  selectedTaskId={selectedTaskId}
                  panelWidth={isCompactLayout ? undefined : taskListWidth}
                  panelMaxWidth={
                    isCompactLayout
                      ? undefined
                      : hasResizedTaskList
                        ? undefined
                        : TASK_LIST_PANEL_AUTO_EXPAND_MAX_WIDTH
                  }
                  autoExpandMaxWidth={TASK_LIST_PANEL_AUTO_EXPAND_MAX_WIDTH}
                  onAutoExpandWidth={handleTaskListAutoExpandWidth}
                  expanded={isCompactLayout}
                  showAddTask={
                    displayedListId !== null ||
                    displayedLabelId !== null ||
                    displayedActiveView === "inbox" ||
                    ((displayedActiveView === "today" ||
                      displayedActiveView === "important") &&
                      lists.length > 0)
                  }
                  isLabelFilter={displayedLabelId !== null}
                  preselectedLabelId={displayedLabelId}
                  preselectedLabelName={displayedLabel?.label ?? null}
                  listId={taskListPanelListId}
                  onAddTask={addTask}
                  onToggleTask={toggleTask}
                  onSelectTask={handleTaskListSelect}
                  onSelectTaskQuiet={selectTask}
                  onSelectTaskImmediate={selectTaskImmediate}
                  onListTitleEditStart={handleListTitleEditStart}
                  onListTitleEditEnd={handleListTitleEditEnd}
                  onRenameTask={renameTask}
                  onTaskNameChange={handleTaskRenamed}
                  onReorderTasks={reorderTasks}
                  onSetTaskDueDate={setTaskDueDate}
                  onSetTaskDueTime={setTaskDueTime}
                  onSetTaskRecurrence={setTaskRecurrence}
                  onSetTaskPriority={setTaskPriority}
                  onSetTaskPinned={setTaskPinned}
                  onSetTaskImportant={
                    importantEnabled ? setTaskImportant : undefined
                  }
                  onConvertTaskToNote={toggleTaskNoteType}
                  onAddSubtask={subtasksEnabled ? addSubtask : undefined}
                  onDeleteTask={deleteTaskById}
                  onToggleTaskLabel={toggleTaskLabel}
                  onLabelsChanged={refreshLabels}
                  onMoveTaskToList={moveTaskToList}
                  showListCalendarButton={displayedListId !== null}
                  isListCalendarOpen={isListCalendarOpen}
                  isListCalendarPreview={isListCalendarPreview}
                  listCalendarShowingDetails={listCalendarShowingDetails}
                  listCalendarButtonRef={listCalendarButtonRef}
                  onListCalendarClick={toggleListCalendar}
                  onListCalendarHoverStart={openListCalendarPreview}
                  onListCalendarHoverEnd={scheduleListCalendarPreviewClose}
                  enableCalendarDragDrop={isListCalendarOpen}
                  onCalendarDropTargetChange={handleCalendarDropTargetChange}
                  onSidebarListDropTargetChange={handleSidebarListDropTargetChange}
                  isListHovered={sidebarHoverPreview !== null}
                  showSidebarMenu={isCompactLayout}
                  onOpenSidebar={() => setSidebarDrawerOpen(true)}
                  subtasksEnabled={subtasksEnabled}
                />
                {!isCompactLayout ? (
                  <PanelResizeHandle onPointerDown={handleTaskListResizeStart} />
                ) : null}
              </div>
            ) : null}
            {!isCompactLayout || compactDetailView ? (
            <div
              className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
                isCompactLayout ? "min-w-0" : "min-w-[350px]"
              }`}
            >
              {showListCalendarPanel ? (
                <CalendarViewsPanel
                  tasks={taskListItems}
                  searchTasks={searchTasks}
                  lists={lists}
                  completingTaskIds={completingTaskIds}
                  completingWithoutBackgroundTaskIds={
                    completingWithoutBackgroundTaskIds
                  }
                  checkAnimatingTaskIds={checkAnimatingTaskIds}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={handleListCalendarTaskSelect}
                  onToggleTask={toggleTask}
                  onSetTaskDueDate={setTaskDueDate}
                  onSetTaskDueTime={setTaskDueTime}
                  onSetTaskDueDateAndTime={setTaskDueDateAndTime}
                  onSetTaskCalendarColor={setTaskCalendarColor}
                  onSetTaskPriority={setTaskPriority}
                  onToggleTaskLabel={toggleTaskLabel}
                  onLabelsChanged={refreshLabels}
                  onMoveTaskToList={moveTaskToList}
                  labels={labels}
                  onDeleteTask={deleteTaskById}
                  onDetailsSaved={handleDetailsSaved}
                  onTaskHasDetailsKnown={handleTaskHasDetailsKnown}
                  onTaskRenamed={handleTaskRenamed}
                  onDueDateUpdated={handleDueDateUpdated}
                  onRecurrenceUpdated={handleRecurrenceUpdated}
                  onSaveTaskRecurrence={setTaskRecurrence}
                  onAddCalendarTask={addCalendarTask}
                  defaultListId={displayedListId}
                  view={listCalendarPanelView}
                  onViewChange={handleListCalendarViewChange}
                  multiDayCount={listCalendarMultiDayCount}
                  multiWeekCount={listCalendarMultiWeekCount}
                  onMultiDayCountChange={handleListCalendarMultiDayCountChange}
                  onMultiWeekCountChange={handleListCalendarMultiWeekCountChange}
                  persistViewSession={false}
                  fullWidth
                  externalDropTargetDateKey={
                    calendarExternalDropTarget?.dateKey ?? null
                  }
                  externalDropTargetTimeMinutes={
                    calendarExternalDropTarget?.dueTimeMinutes ?? null
                  }
                  externalDraggingTaskId={
                    calendarExternalDropTarget?.taskId ?? null
                  }
                  externalDraggingTaskName={
                    calendarExternalDropTarget?.taskName ?? null
                  }
                />
              ) : null}
              {showTaskDetails && (
                <div
                  className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-[filter] duration-200 ${
                    isSidebarHoverPreview
                      ? "pointer-events-none blur-[1.5px] brightness-[0.985]"
                      : ""
                  }`}
                >
                  <TaskDetailsPanel
                    taskId={selectedTaskId}
                    taskSnapshot={selectedTaskSnapshot}
                    focusNoteAtEndRequest={focusNoteAtEndRequest}
                    focusTaskTitleRequest={focusTaskTitleRequest}
                    suppressDetailsTitleFocusRef={suppressDetailsTitleFocusRef}
                    registerSaveController={registerDetailsSaveController}
                    onDetailsSaved={handleDetailsSaved}
                    onTaskHasDetailsKnown={handleTaskHasDetailsKnown}
                    onTaskRenamed={handleTaskRenamed}
                    onDueDateUpdated={handleDueDateUpdated}
                    onToggleTask={toggleTask}
                    onRecurrenceUpdated={handleRecurrenceUpdated}
                    onSaveTaskRecurrence={setTaskRecurrence}
                    subtasks={selectedTaskSubtasksContext.subtasks}
                    canManageSubtasks={selectedTaskSubtasksContext.canManageSubtasks}
                    onAddSubtask={handleAddSubtaskFromDetails}
                    onBack={isCompactLayout ? handleCompactBack : undefined}
                  />
                </div>
              )}
            </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div onMouseEnter={commitSidebarHoverSelection}>
              <TaskListPanel
                title={taskListTitle}
                viewResetKey={taskListViewResetKey}
                tasks={taskListItems}
                completedTasks={listCompletedTasks}
                lists={lists}
                completingTaskIds={completingTaskIds}
                completingWithoutBackgroundTaskIds={
                  completingWithoutBackgroundTaskIds
                }
                checkAnimatingTaskIds={checkAnimatingTaskIds}
                selectedTaskId={selectedTaskId}
                expanded={!showListCalendar}
                showAddTask={
                  displayedListId !== null ||
                  displayedLabelId !== null ||
                  displayedActiveView === "inbox" ||
                  ((displayedActiveView === "today" ||
                    displayedActiveView === "important") &&
                    lists.length > 0)
                }
                isLabelFilter={displayedLabelId !== null}
                preselectedLabelId={displayedLabelId}
                preselectedLabelName={displayedLabel?.label ?? null}
                listId={taskListPanelListId}
                onAddTask={addTask}
                onToggleTask={toggleTask}
                onSelectTask={handleTaskListSelect}
                onSelectTaskQuiet={selectTask}
                onSelectTaskImmediate={selectTaskImmediate}
                onListTitleEditStart={handleListTitleEditStart}
                onListTitleEditEnd={handleListTitleEditEnd}
                onRenameTask={renameTask}
                onTaskNameChange={handleTaskRenamed}
                onReorderTasks={reorderTasks}
                onSetTaskDueDate={setTaskDueDate}
                onSetTaskDueTime={setTaskDueTime}
                onSetTaskRecurrence={setTaskRecurrence}
                onSetTaskPriority={setTaskPriority}
                onSetTaskPinned={setTaskPinned}
                onSetTaskImportant={
                  importantEnabled ? setTaskImportant : undefined
                }
                onConvertTaskToNote={toggleTaskNoteType}
                onAddSubtask={subtasksEnabled ? addSubtask : undefined}
                onDeleteTask={deleteTaskById}
                onToggleTaskLabel={toggleTaskLabel}
                onLabelsChanged={refreshLabels}
                onMoveTaskToList={moveTaskToList}
                showListCalendarButton={displayedListId !== null}
                isListCalendarOpen={isListCalendarOpen}
                isListCalendarPreview={isListCalendarPreview}
                listCalendarShowingDetails={listCalendarShowingDetails}
                listCalendarButtonRef={listCalendarButtonRef}
                onListCalendarClick={toggleListCalendar}
                onListCalendarHoverStart={openListCalendarPreview}
                onListCalendarHoverEnd={scheduleListCalendarPreviewClose}
                enableCalendarDragDrop={isListCalendarOpen}
                onCalendarDropTargetChange={handleCalendarDropTargetChange}
                onSidebarListDropTargetChange={handleSidebarListDropTargetChange}
                isListHovered={sidebarHoverPreview !== null}
                onPanelMouseEnter={commitSidebarHoverSelection}
                showSidebarMenu={isCompactLayout}
                onOpenSidebar={() => setSidebarDrawerOpen(true)}
                subtasksEnabled={subtasksEnabled}
              />
            </div>
            {showListCalendarPanel ? (
              <div className="flex min-h-0 min-w-[350px] flex-1 flex-col overflow-hidden">
                <CalendarViewsPanel
                  tasks={taskListItems}
                  searchTasks={searchTasks}
                  lists={lists}
                  completingTaskIds={completingTaskIds}
                  completingWithoutBackgroundTaskIds={
                    completingWithoutBackgroundTaskIds
                  }
                  checkAnimatingTaskIds={checkAnimatingTaskIds}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={handleListCalendarTaskSelect}
                  onToggleTask={toggleTask}
                  onSetTaskDueDate={setTaskDueDate}
                  onSetTaskDueTime={setTaskDueTime}
                  onSetTaskDueDateAndTime={setTaskDueDateAndTime}
                  onSetTaskCalendarColor={setTaskCalendarColor}
                  onSetTaskPriority={setTaskPriority}
                  onToggleTaskLabel={toggleTaskLabel}
                  onLabelsChanged={refreshLabels}
                  onMoveTaskToList={moveTaskToList}
                  labels={labels}
                  onDeleteTask={deleteTaskById}
                  onDetailsSaved={handleDetailsSaved}
                  onTaskHasDetailsKnown={handleTaskHasDetailsKnown}
                  onTaskRenamed={handleTaskRenamed}
                  onDueDateUpdated={handleDueDateUpdated}
                  onRecurrenceUpdated={handleRecurrenceUpdated}
                  onSaveTaskRecurrence={setTaskRecurrence}
                  onAddCalendarTask={addCalendarTask}
                  defaultListId={displayedListId}
                  view={listCalendarPanelView}
                  onViewChange={handleListCalendarViewChange}
                  multiDayCount={listCalendarMultiDayCount}
                  multiWeekCount={listCalendarMultiWeekCount}
                  onMultiDayCountChange={handleListCalendarMultiDayCountChange}
                  onMultiWeekCountChange={handleListCalendarMultiWeekCountChange}
                  persistViewSession={false}
                  fullWidth
                  externalDropTargetDateKey={
                    calendarExternalDropTarget?.dateKey ?? null
                  }
                  externalDropTargetTimeMinutes={
                    calendarExternalDropTarget?.dueTimeMinutes ?? null
                  }
                  externalDraggingTaskId={
                    calendarExternalDropTarget?.taskId ?? null
                  }
                  externalDraggingTaskName={
                    calendarExternalDropTarget?.taskName ?? null
                  }
                />
              </div>
            ) : null}
            {showTaskDetails ? (
              <div className="flex min-h-0 min-w-[350px] flex-1 flex-col overflow-hidden">
                <TaskDetailsPanel
                  taskId={selectedTaskId}
                  taskSnapshot={selectedTaskSnapshot}
                  focusNoteAtEndRequest={focusNoteAtEndRequest}
                  focusTaskTitleRequest={focusTaskTitleRequest}
                  suppressDetailsTitleFocusRef={suppressDetailsTitleFocusRef}
                  registerSaveController={registerDetailsSaveController}
                  onDetailsSaved={handleDetailsSaved}
                  onTaskHasDetailsKnown={handleTaskHasDetailsKnown}
                  onTaskRenamed={handleTaskRenamed}
                  onDueDateUpdated={handleDueDateUpdated}
                  onToggleTask={toggleTask}
                  onRecurrenceUpdated={handleRecurrenceUpdated}
                  onSaveTaskRecurrence={setTaskRecurrence}
                  subtasks={selectedTaskSubtasksContext.subtasks}
                  canManageSubtasks={selectedTaskSubtasksContext.canManageSubtasks}
                  onAddSubtask={handleAddSubtaskFromDetails}
                  onBack={isCompactLayout ? handleCompactBack : undefined}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
      <AppFontSwitcher />
      <TemplateOptionsDrawer />
      <CalendarShortcutModal
        open={isCalendarShortcutModalOpen}
        onClose={closeCalendarShortcutModal}
        onExpandToFullPage={expandCalendarShortcutModal}
        {...calendarPanelSharedProps}
      />
      <UndoButton
        visible={pendingRecurrenceUndo !== null}
        message={pendingRecurrenceUndo?.message ?? "Recurring task set"}
        ariaLabel={
          pendingRecurrenceUndo
            ? `Undo repeat change for ${pendingRecurrenceUndo.taskName}`
            : undefined
        }
        onUndo={() => void handleUndoRecurrence()}
      />
      <UndoButton
        visible={pendingUndo !== null}
        message="Task completed"
        ariaLabel={
          pendingUndo
            ? `Undo completing ${pendingUndo.taskName}`
            : undefined
        }
        onUndo={handleUndoCompletion}
      />
    </>
  );
}
