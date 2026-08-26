"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { BiChevronDown, BiSortAlt2 } from "react-icons/bi";
import { LuCalendarCheck2, LuCheck, LuMenu, LuPlus, LuX } from "react-icons/lu";
import { PiArrowBendDownRight } from "react-icons/pi";
import { createLabel, getLabels } from "@/app/actions/todo";
import { TaskDatePicker } from "./task-date-picker";
import { TaskSetDateIcon } from "./task-set-date-icon";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";
import {
  TaskListTaskRow,
  getTaskRowLeftBorderClass,
  isTaskDatePickerTriggerElement,
} from "./task-list-task-row";
import type { Label } from "./task-label-selector";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import type { TaskListItem, TodoList, AddTaskOptions } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  parseNaturalLanguageTask,
  summarizeNaturalLanguageParse,
} from "@/lib/natural-language-task";
import { resolveCalendarSlotFromPoint } from "@/lib/calendar-drag";
import type { CalendarExternalDragTarget } from "@/lib/calendar-time-grid";
import {
  getSidebarListDropTargetKey,
  resolveSidebarListFromPoint,
  type SidebarListDragTarget,
} from "@/lib/sidebar-list-drag";
import { formatShortDayMonth } from "@/lib/date-format";
import {
  buildVisibleTasks,
  clampSubtaskKeepDropIndex,
  collectParentUpdates,
  getDragBlockIds,
  getDropIndicatorIndent,
  reorderVisibleTaskIds,
  resolveHierarchyDragIntent,
  SUBTASK_INDENT_PX,
  SUBTASK_ICON_INDENT_PX,
  SUBTASK_ROOT_LEFT_PX,
  type HierarchyDragIntent,
} from "@/lib/task-subtasks";
import {
  getReorderTargetIndex,
  getTaskDropIndex,
  getTaskRowElements,
} from "./task-reorder";

export const TASK_LIST_PANEL_DEFAULT_WIDTH = 350;
export const TASK_LIST_PANEL_AUTO_EXPAND_MAX_WIDTH = 450;
export const TASK_LIST_PANEL_MIN_WIDTH = 350;

function measureTaskListTruncationOverflow(root: HTMLElement | null) {
  if (!root) return 0;

  let maxOverflow = 0;
  root.querySelectorAll<HTMLElement>("[data-task-truncate-measure]").forEach((el) => {
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow > maxOverflow) {
      maxOverflow = overflow;
    }
  });

  return maxOverflow;
}

type SortField = "date" | "title";
type SortDirection = "asc" | "desc";

type SortOption = {
  field: SortField;
  direction: SortDirection;
  label: string;
};

type DropIndicatorState = {
  top: number;
  section: "pinned" | "unpinned";
  indent: number;
};

type TaskDragState = {
  sourceRow: HTMLElement;
  captureTarget: HTMLElement;
  sourceIndex: number;
  dropIndex: number;
  sourceTaskId: string;
  sourceTaskName: string;
  taskIds: string[];
  blockIds: string[];
  pointerId: number;
  section: "pinned" | "unpinned";
  hierarchyIntent: HierarchyDragIntent;
  sourceParentId: string | null;
  lastPointerX: number;
  lastPointerY: number;
  startClientX: number;
  startClientY: number;
  rowHeight: number;
  appliedTargetIndex: number | null;
  appliedNestSignal: number | null;
  lastCalendarDropTargetKey: string | null;
  lastSidebarListDropTargetKey: string | null;
};

const NEST_SIGNAL_OFFSET_PX = 15;

function getCalendarDropTargetKey(
  target: CalendarExternalDragTarget | null,
): string | null {
  if (!target) return null;

  return `${target.dateKey}:${target.dueTimeMinutes ?? "allday"}:${target.taskId}`;
}

function applyRowShifts(
  rows: HTMLElement[],
  sourceRow: HTMLElement,
  sourceIndex: number,
  targetIndex: number,
  rowHeight: number,
) {
  rows.forEach((row, index) => {
    if (row === sourceRow) return;

    let shift = 0;
    if (
      targetIndex > sourceIndex &&
      index > sourceIndex &&
      index <= targetIndex
    ) {
      shift = -rowHeight;
    } else if (
      targetIndex < sourceIndex &&
      index >= targetIndex &&
      index < sourceIndex
    ) {
      shift = rowHeight;
    }

    row.style.transform = shift ? `translateY(${shift}px)` : "";
  });
}

function resetRowShifts(rows: HTMLElement[], sourceRow: HTMLElement) {
  rows.forEach((row) => {
    if (row === sourceRow) return;
    row.style.transform = "";
  });
}

const SORT_OPTIONS: SortOption[] = [
  { field: "date", direction: "asc", label: "Date (ascending)" },
  { field: "date", direction: "desc", label: "Date (descending)" },
  { field: "title", direction: "asc", label: "Title (A-Z)" },
  { field: "title", direction: "desc", label: "Title (Z-A)" },
];

function shouldIgnoreAddTaskShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  if (target.closest("[data-task-details-panel]")) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function formatActiveSortLabel(label: string) {
  return label
    .replace("ascending", "asc")
    .replace("descending", "desc")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ROW_DRAG_THRESHOLD_PX = 5;

function shouldStartRowDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest(
    "input, button, textarea, select, a, [role='menu'], [role='menuitem'], [role='checkbox'], .checkbox-wrapper-29, label.checkbox",
  );
}

function trySetPointerCapture(target: HTMLElement, pointerId: number) {
  if (!target.isConnected) return false;

  try {
    if (!target.hasPointerCapture(pointerId)) {
      target.setPointerCapture(pointerId);
    }
    return true;
  } catch {
    return false;
  }
}

function tryReleasePointerCapture(target: HTMLElement, pointerId: number) {
  if (!target.isConnected) return;

  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // Ignore release failures during teardown.
  }
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

function formatTaskDueDateLabel(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = startOfDay(date);

  if (isSameDay(dueDay, today)) return "Today";
  if (isSameDay(dueDay, tomorrow)) return "Tomorrow";

  return formatShortDayMonth(date);
}

function getDueDateTimestamp(dueDate: string | null) {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function sortTasks(
  tasks: TaskListItem[],
  field: SortField,
  direction: SortDirection,
) {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    if (field === "title") {
      const comparison = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
      return direction === "asc" ? comparison : -comparison;
    }

    const aDate = getDueDateTimestamp(a.dueDate);
    const bDate = getDueDateTimestamp(b.dueDate);

    if (aDate === null && bDate === null) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }

    if (aDate === null) return direction === "asc" ? 1 : -1;
    if (bDate === null) return direction === "asc" ? -1 : 1;

    const comparison = aDate - bDate;
    if (comparison !== 0) {
      return direction === "asc" ? comparison : -comparison;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return sorted;
}

type PointerContextMenuState = {
  taskId: string;
  x: number;
  y: number;
  view: TaskRowContextMenuView;
};

type TaskListPanelProps = {
  title: string | null;
  tasks: TaskListItem[];
  completedTasks?: TaskListItem[];
  lists: TodoList[];
  completingTaskIds: Set<string>;
  completingWithoutBackgroundTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  expanded?: boolean;
  panelWidth?: number;
  panelMaxWidth?: number;
  autoExpandMaxWidth?: number;
  onAutoExpandWidth?: (width: number) => void;
  embedded?: boolean;
  showHeader?: boolean;
  showAddTask?: boolean;
  isLabelFilter?: boolean;
  listId?: string | null;
  onAddTask: (name: string, options?: AddTaskOptions) => void | Promise<void>;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void | Promise<void>;
  focusTitleInDetailsPanel?: boolean;
  onRenameTask: (taskId: string, name: string) => void;
  onTaskNameChange?: (taskId: string, name: string) => void;
  onReorderTasks?: (
    listId: string,
    taskIds: string[],
    section: "pinned" | "unpinned",
    parentUpdates?: Array<{ taskId: string; parentId: string | null }>,
  ) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskRecurrence?: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => void | Promise<void>;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onSetTaskPinned?: (taskId: string, pinned: boolean) => void;
  onSetTaskImportant?: (taskId: string, important: boolean) => void;
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
  showListCalendarButton?: boolean;
  isListCalendarOpen?: boolean;
  isListCalendarPreview?: boolean;
  listCalendarButtonRef?: RefObject<HTMLButtonElement | null>;
  onListCalendarClick?: () => void;
  onListCalendarHoverStart?: () => void;
  onListCalendarHoverEnd?: () => void;
  enableCalendarDragDrop?: boolean;
  onCalendarDropTargetChange?: (target: CalendarExternalDragTarget | null) => void;
  onSidebarListDropTargetChange?: (target: SidebarListDragTarget | null) => void;
  isListHovered?: boolean;
  onPanelMouseEnter?: () => void;
  showSidebarMenu?: boolean;
  onOpenSidebar?: () => void;
};

export function TaskListPanel({
  title,
  tasks,
  completedTasks = [],
  lists,
  completingTaskIds,
  completingWithoutBackgroundTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
  expanded = false,
  panelWidth,
  panelMaxWidth,
  autoExpandMaxWidth = TASK_LIST_PANEL_AUTO_EXPAND_MAX_WIDTH,
  onAutoExpandWidth,
  embedded = false,
  showHeader = true,
  showAddTask = false,
  isLabelFilter = false,
  listId = null,
  onAddTask,
  onToggleTask,
  onSelectTask,
  focusTitleInDetailsPanel = false,
  onRenameTask,
  onTaskNameChange,
  onReorderTasks,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskRecurrence,
  onSetTaskPriority,
  onSetTaskPinned,
  onSetTaskImportant,
  onToggleTaskLabel,
  onLabelsChanged,
  onMoveTaskToList,
  showListCalendarButton = false,
  isListCalendarOpen = false,
  isListCalendarPreview = false,
  listCalendarButtonRef,
  onListCalendarClick,
  onListCalendarHoverStart,
  onListCalendarHoverEnd,
  enableCalendarDragDrop = false,
  onCalendarDropTargetChange,
  onSidebarListDropTargetChange,
  isListHovered = false,
  onPanelMouseEnter,
  showSidebarMenu = false,
  onOpenSidebar,
}: TaskListPanelProps) {
  const [newTaskName, setNewTaskName] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const newTaskParsePreview = useMemo(() => {
    if (!newTaskName.trim()) return null;
    const parsed = parseNaturalLanguageTask(newTaskName, { lists });
    return summarizeNaturalLanguageParse(parsed);
  }, [lists, newTaskName]);
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(null);
  const [newTaskDueTime, setNewTaskDueTime] = useState<TaskDueTime | null>(null);
  const [isAddTaskDatePickerOpen, setIsAddTaskDatePickerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const titleDraftRef = useRef(titleDraft);
  titleDraftRef.current = titleDraft;
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<SortOption | null>(null);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [openDatePickerTaskId, setOpenDatePickerTaskId] = useState<string | null>(
    null,
  );
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [openLabelMenuTaskId, setOpenLabelMenuTaskId] = useState<string | null>(
    null,
  );
  const [openMoveMenuTaskId, setOpenMoveMenuTaskId] = useState<string | null>(
    null,
  );
  const [openPriorityMenuTaskId, setOpenPriorityMenuTaskId] = useState<
    string | null
  >(null);
  const [moveQuery, setMoveQuery] = useState("");
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [assignedLabelIds, setAssignedLabelIds] = useState<string[]>([]);
  const [labelQuery, setLabelQuery] = useState("");
  const [isLabelSubmitting, setIsLabelSubmitting] = useState(false);
  const [pointerContextMenu, setPointerContextMenu] =
    useState<PointerContextMenuState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(
    null,
  );

  const activeLabelMenuTaskId =
    openLabelMenuTaskId ??
    (pointerContextMenu?.view === "label" ? pointerContextMenu.taskId : null);

  useEffect(() => {
    if (!activeLabelMenuTaskId) return;

    let cancelled = false;

    void getLabels()
      .then((tags) => {
        if (!cancelled) {
          setAvailableLabels(tags);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableLabels([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLabelMenuTaskId]);

  useEffect(() => {
    if (!activeLabelMenuTaskId) return;

    const task = orderedTasks.find((item) => item.id === activeLabelMenuTaskId);
    if (!task) return;

    setAssignedLabelIds(task.labels.map((tag) => tag.id));
  }, [activeLabelMenuTaskId, orderedTasks]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const addTaskFormRef = useRef<HTMLFormElement>(null);
  const addTaskDateMenuRef = useRef<HTMLDivElement>(null);
  const addTaskDatePickerRef = useRef<HTMLDivElement>(null);
  const isAddTaskDatePickerOpenRef = useRef(false);
  const shouldFocusAddTaskDatePickerRef = useRef(false);
  const keepAddTaskOpenRef = useRef(false);
  const titleEditReadyRef = useRef(false);
  const titleEditIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const taskDateMenuRef = useRef<HTMLDivElement>(null);
  const taskLabelMenuRef = useRef<HTMLDivElement>(null);
  const taskPriorityMenuRef = useRef<HTMLDivElement>(null);
  const taskContextMenuRef = useRef<HTMLDivElement>(null);
  const pointerContextMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pinnedListRef = useRef<HTMLUListElement>(null);
  const taskListScrollRef = useRef<HTMLDivElement>(null);
  const [embeddedAutoWidth, setEmbeddedAutoWidth] = useState(
    TASK_LIST_PANEL_DEFAULT_WIDTH,
  );
  const dragStateRef = useRef<TaskDragState | null>(null);
  const suppressRowClickRef = useRef(false);

  const canReorder = showAddTask && Boolean(listId && onReorderTasks);
  const enableSidebarListDragDrop =
    Boolean(onMoveTaskToList) && lists.length > 1;

  const pinnedTasks = useMemo(
    () =>
      showAddTask ? orderedTasks.filter((task) => Boolean(task.pinned)) : [],
    [orderedTasks, showAddTask],
  );

  const listTasks = useMemo(
    () =>
      showAddTask
        ? orderedTasks.filter((task) => !Boolean(task.pinned))
        : orderedTasks,
    [orderedTasks, showAddTask],
  );

  const pinnedVisibleTasks = useMemo(
    () =>
      canReorder
        ? buildVisibleTasks(orderedTasks, true)
        : pinnedTasks.map((task) => ({ ...task, depth: 0 })),
    [canReorder, orderedTasks, pinnedTasks],
  );

  const unpinnedVisibleTasks = useMemo(
    () =>
      canReorder
        ? buildVisibleTasks(orderedTasks, false)
        : listTasks.map((task) => ({ ...task, depth: 0 })),
    [canReorder, listTasks, orderedTasks],
  );

  const tasksById = useMemo(
    () => new Map(orderedTasks.map((task) => [task.id, task])),
    [orderedTasks],
  );

  const hasScheduledTasks = useMemo(
    () => orderedTasks.some((task) => task.dueDate),
    [orderedTasks],
  );

  useEffect(() => {
    setOrderedTasks((current) => {
      if (
        current.length === tasks.length &&
        current.every((task, index) => task === tasks[index])
      ) {
        return current;
      }

      return tasks;
    });
  }, [tasks]);

  useEffect(() => {
    if (!editingTaskId) return;

    const task = tasks.find((item) => item.id === editingTaskId);
    if (!task || task.name === titleDraft) return;
    if (document.activeElement === titleInputRef.current) return;

    setTitleDraft(task.name);
  }, [tasks, editingTaskId, titleDraft]);

  useEffect(() => {
    setEditingTaskId(null);
    setTitleDraft("");
    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu(null);
    setIsAddingTask(false);
    setNewTaskName("");
    setActiveSort(null);
    setIsCompletedOpen(false);
  }, [title]);

  useEffect(() => {
    if (panelWidth != null) return;
    setEmbeddedAutoWidth(TASK_LIST_PANEL_DEFAULT_WIDTH);
  }, [panelWidth, title, listId, isLabelFilter]);

  const resolvedPanelWidth = panelWidth ?? embeddedAutoWidth;

  const applyAutoExpandedWidth = useCallback(
    (nextWidth: number) => {
      const clampedWidth = Math.min(
        autoExpandMaxWidth,
        Math.max(TASK_LIST_PANEL_DEFAULT_WIDTH, nextWidth),
      );

      if (panelWidth != null) {
        onAutoExpandWidth?.(clampedWidth);
        return;
      }

      setEmbeddedAutoWidth((currentWidth) =>
        currentWidth === clampedWidth ? currentWidth : clampedWidth,
      );
    },
    [autoExpandMaxWidth, onAutoExpandWidth, panelWidth],
  );

  useLayoutEffect(() => {
    const root = taskListScrollRef.current;
    if (!root || !title) return;

    const measureAndExpand = () => {
      const overflow = measureTaskListTruncationOverflow(root);
      if (overflow <= 1) return;
      if (resolvedPanelWidth >= autoExpandMaxWidth) return;

      applyAutoExpandedWidth(resolvedPanelWidth + overflow);
    };

    measureAndExpand();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureAndExpand);
    observer.observe(root);
    return () => observer.disconnect();
  }, [
    applyAutoExpandedWidth,
    autoExpandMaxWidth,
    completedTasks,
    editingTaskId,
    isCompletedOpen,
    listTasks,
    pinnedVisibleTasks,
    resolvedPanelWidth,
    title,
    unpinnedVisibleTasks,
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (taskDateMenuRef.current?.contains(target)) return;
      if (isTaskDatePickerTriggerElement(target)) return;
      if (taskLabelMenuRef.current?.contains(target)) return;
      if (taskPriorityMenuRef.current?.contains(target)) return;
      if (taskContextMenuRef.current?.contains(target)) return;
      if (pointerContextMenuRef.current?.contains(target)) return;

      setOpenDatePickerTaskId(null);
      setOpenMenuTaskId(null);
      setOpenLabelMenuTaskId(null);
      setOpenMoveMenuTaskId(null);
      setOpenPriorityMenuTaskId(null);
      resetLabelMenuState();
      resetMoveMenuState();
      setPointerContextMenu(null);
    }

    if (
      !openDatePickerTaskId &&
      !openMenuTaskId &&
      !openLabelMenuTaskId &&
      !openMoveMenuTaskId &&
      !openPriorityMenuTaskId &&
      !pointerContextMenu
    ) {
      return;
    }

    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [
    openDatePickerTaskId,
    openMenuTaskId,
    openLabelMenuTaskId,
    openMoveMenuTaskId,
    openPriorityMenuTaskId,
    pointerContextMenu,
  ]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (openDatePickerTaskId) {
        setOpenDatePickerTaskId(null);
        return;
      }

      setOpenMenuTaskId(null);
      setOpenLabelMenuTaskId(null);
      setOpenMoveMenuTaskId(null);
      setOpenPriorityMenuTaskId(null);
      resetLabelMenuState();
      resetMoveMenuState();
      setPointerContextMenu(null);
    }

    if (
      !openDatePickerTaskId &&
      !openMenuTaskId &&
      !openLabelMenuTaskId &&
      !openMoveMenuTaskId &&
      !openPriorityMenuTaskId &&
      !pointerContextMenu
    ) {
      return;
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    openDatePickerTaskId,
    openMenuTaskId,
    openLabelMenuTaskId,
    openMoveMenuTaskId,
    openPriorityMenuTaskId,
    pointerContextMenu,
  ]);

  useEffect(() => {
    if (!editingTaskId) {
      titleEditReadyRef.current = false;
      return;
    }

    requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) return;

      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
      titleEditReadyRef.current = true;
    });
  }, [editingTaskId]);

  useEffect(() => {
    if (!editingTaskId) {
      clearTitleEditIdleTimeout();
      return;
    }

    const task = orderedTasks.find((item) => item.id === editingTaskId);
    if (!task) {
      clearTitleEditIdleTimeout();
      return;
    }

    scheduleTitleEditIdleExit(task);

    return () => {
      clearTitleEditIdleTimeout();
    };
  }, [editingTaskId, orderedTasks]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }

    if (!isSortMenuOpen) return;

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    if (orderedTasks.length < 2) {
      setActiveSort(null);
      setIsSortMenuOpen(false);
    }
  }, [orderedTasks.length]);

  useEffect(() => {
    if (!showAddTask) return;

    function handleAddTaskShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key !== "Enter") return;
      if (event.altKey || event.shiftKey) return;
      if (shouldIgnoreAddTaskShortcut(event.target)) return;

      event.preventDefault();
      setIsAddingTask(true);
    }

    window.addEventListener("keydown", handleAddTaskShortcut);
    return () => window.removeEventListener("keydown", handleAddTaskShortcut);
  }, [showAddTask]);

  useEffect(() => {
    if (!isAddingTask) return;

    requestAnimationFrame(() => {
      newTaskInputRef.current?.focus();
    });
  }, [isAddingTask]);

  useEffect(() => {
    isAddTaskDatePickerOpenRef.current = isAddTaskDatePickerOpen;
  }, [isAddTaskDatePickerOpen]);

  useEffect(() => {
    if (!isAddTaskDatePickerOpen) return;
    if (!shouldFocusAddTaskDatePickerRef.current) return;

    shouldFocusAddTaskDatePickerRef.current = false;
    requestAnimationFrame(() => {
      const dateInput = addTaskDatePickerRef.current?.querySelector("input");
      if (dateInput instanceof HTMLInputElement) {
        dateInput.focus();
      }
    });
  }, [isAddTaskDatePickerOpen]);

  useEffect(() => {
    if (!isAddTaskDatePickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (addTaskDateMenuRef.current?.contains(target)) return;
      if (addTaskDatePickerRef.current?.contains(target)) return;
      setIsAddTaskDatePickerOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [isAddTaskDatePickerOpen]);

  function startAddingTask() {
    keepAddTaskOpenRef.current = false;
    setIsAddingTask(true);
  }

  function resetNewTaskSchedule() {
    setNewTaskDueDate(null);
    setNewTaskDueTime(null);
    setIsAddTaskDatePickerOpen(false);
  }

  function cancelAddTask() {
    keepAddTaskOpenRef.current = false;
    setIsAddingTask(false);
    setNewTaskName("");
    resetNewTaskSchedule();
  }

  function isFocusWithinAddTaskForm() {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof Node)) return false;

    if (addTaskFormRef.current?.contains(activeElement)) return true;
    if (addTaskDatePickerRef.current?.contains(activeElement)) return true;

    return false;
  }

  function openAddTaskDatePicker(focusPickerInput = false) {
    shouldFocusAddTaskDatePickerRef.current = focusPickerInput;
    setIsAddTaskDatePickerOpen(true);
  }

  async function submitNewTask() {
    if (!newTaskName.trim()) {
      cancelAddTask();
      return;
    }

    const rawInput = newTaskName.trim();
    const parsed = parseNaturalLanguageTask(rawInput, { lists });
    const taskName = parsed.name.trim() || rawInput;
    const manualDueDate = newTaskDueDate;
    const manualDueTime = newTaskDueTime;

    const addOptions: AddTaskOptions = {
      keepFormOpen: true,
      ...(manualDueDate !== null || parsed.dueDate
        ? { dueDate: manualDueDate ?? parsed.dueDate }
        : {}),
      ...(manualDueTime !== null || parsed.dueTime
        ? {
            dueTime:
              manualDueTime ??
              parsed.dueTime ?? {
                dueTimeMinutes: null,
                dueDurationMinutes: null,
                dueTimeZone: "floating",
              },
          }
        : {}),
      ...(parsed.priority !== null ? { priority: parsed.priority } : {}),
      ...(parsed.label ? { label: parsed.label } : {}),
      ...(parsed.recurrenceRule ? { recurrenceRule: parsed.recurrenceRule } : {}),
      ...(parsed.listId ? { listId: parsed.listId } : {}),
      ...(parsed.subtasks.length > 0 ? { subtasks: parsed.subtasks } : {}),
    };

    keepAddTaskOpenRef.current = true;
    setIsAddingTask(true);
    setNewTaskName("");
    resetNewTaskSchedule();
    setActiveSort(null);

    try {
      await onAddTask(taskName, addOptions);
    } finally {
      const refocusAddTaskInput = () => {
        newTaskInputRef.current?.focus();
      };

      refocusAddTaskInput();
      requestAnimationFrame(() => {
        refocusAddTaskInput();
        requestAnimationFrame(() => {
          keepAddTaskOpenRef.current = false;
        });
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitNewTask();
  }

  function startTitleEdit(task: TaskListItem) {
    setEditingTaskId(task.id);
    setTitleDraft(task.name);
  }

  function clearTitleEditIdleTimeout() {
    if (titleEditIdleTimeoutRef.current === null) return;

    clearTimeout(titleEditIdleTimeoutRef.current);
    titleEditIdleTimeoutRef.current = null;
  }

  function scheduleTitleEditIdleExit(task: TaskListItem) {
    clearTitleEditIdleTimeout();
    titleEditIdleTimeoutRef.current = setTimeout(() => {
      if (!titleEditReadyRef.current) return;

      const trimmed = titleDraftRef.current.trim();
      if (!trimmed) {
        cancelTitleEdit(task);
        return;
      }

      if (trimmed !== task.name) {
        onRenameTask(task.id, trimmed);
      }

      setEditingTaskId(null);
      clearTitleEditIdleTimeout();
    }, 5000);
  }

  async function handleTaskClick(task: TaskListItem) {
    if (suppressRowClickRef.current) {
      suppressRowClickRef.current = false;
      return;
    }

    await onSelectTask(task.id);
    if (focusTitleInDetailsPanel) {
      if (editingTaskId !== null) {
        clearTitleEditIdleTimeout();
        setEditingTaskId(null);
      }
      return;
    }

    startTitleEdit(task);
  }

  function cancelTitleEdit(task: TaskListItem) {
    clearTitleEditIdleTimeout();
    setTitleDraft(task.name);
    setEditingTaskId(null);
  }

  function commitTitleEdit(task: TaskListItem) {
    clearTitleEditIdleTimeout();
    const trimmed = titleDraft.trim();

    if (!trimmed) {
      cancelTitleEdit(task);
      return;
    }

    if (trimmed !== task.name) {
      onRenameTask(task.id, trimmed);
    }

    setEditingTaskId(null);
  }

  function handleTitleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    task: TaskListItem,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitleEdit(task);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit(task);
      return;
    }

    scheduleTitleEditIdleExit(task);
  }

  function applySort(field: SortField, direction: SortDirection) {
    const pinned = orderedTasks.filter((task) => task.pinned);
    const unpinned = orderedTasks.filter((task) => !task.pinned);
    const sorted = sortTasks(unpinned, field, direction);
    setOrderedTasks([...pinned, ...sorted]);

    if (listId && onReorderTasks) {
      onReorderTasks(
        listId,
        sorted.map((task) => task.id),
        "unpinned",
      );
    }

    const sortOption = SORT_OPTIONS.find(
      (option) => option.field === field && option.direction === direction,
    );
    setActiveSort(sortOption ?? null);
    setIsSortMenuOpen(false);
  }

  function resetLabelMenuState() {
    setAssignedLabelIds([]);
    setLabelQuery("");
    setIsLabelSubmitting(false);
  }

  function resetMoveMenuState() {
    setMoveQuery("");
  }

  function resolveTaskListId(task: TaskListItem): string | null {
    return task.listId ?? listId ?? null;
  }

  function initLabelMenuForTask(taskId: string) {
    const task = orderedTasks.find((item) => item.id === taskId);
    setAssignedLabelIds(task?.labels.map((item) => item.id) ?? []);
    setLabelQuery("");
    setIsLabelSubmitting(false);
  }

  function closeTaskMenus() {
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu(null);
  }

  function togglePriorityMenu(taskId: string) {
    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu(null);
    setOpenPriorityMenuTaskId((current) =>
      current === taskId ? null : taskId,
    );
  }

  function toggleDatePicker(taskId: string) {
    closeTaskMenus();
    setOpenDatePickerTaskId((current) => (current === taskId ? null : taskId));
  }

  function openDatePicker(taskId: string) {
    suppressRowClickRef.current = true;
    closeTaskMenus();
    setOpenDatePickerTaskId(taskId);
  }

  function toggleTaskMenu(taskId: string) {
    setOpenDatePickerTaskId(null);
    setPointerContextMenu(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setOpenMenuTaskId((current) => (current === taskId ? null : taskId));
  }

  function openLabelMenu(taskId: string) {
    if (
      openLabelMenuTaskId === taskId &&
      pointerContextMenu?.taskId !== taskId
    ) {
      setOpenLabelMenuTaskId(null);
      resetLabelMenuState();
      return;
    }

    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    resetMoveMenuState();
    initLabelMenuForTask(taskId);
    if (pointerContextMenu?.taskId === taskId) {
      setPointerContextMenu({ ...pointerContextMenu, view: "label" });
      return;
    }

    setPointerContextMenu(null);
    setOpenLabelMenuTaskId(taskId);
  }

  function openMoveMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    resetLabelMenuState();
    setMoveQuery("");
    if (pointerContextMenu?.taskId === taskId) {
      setPointerContextMenu({ ...pointerContextMenu, view: "moveTo" });
      return;
    }

    setPointerContextMenu(null);
    setOpenMoveMenuTaskId(taskId);
  }

  function handleMoveTaskToList(taskId: string, targetListId: string) {
    if (!onMoveTaskToList) return;

    const task = orderedTasks.find((item) => item.id === taskId);
    if (!task) return;

    const sourceListId = resolveTaskListId(task);
    if (!sourceListId || sourceListId === targetListId) return;

    onMoveTaskToList(taskId, sourceListId, targetListId);
    closeTaskMenus();
  }

  async function handleToggleLabel(taskId: string, labelId: string) {
    if (!onToggleTaskLabel) return;

    const isAssigned = assignedLabelIds.includes(labelId);
    setIsLabelSubmitting(true);

    try {
      const updatedTags = await onToggleTaskLabel(taskId, labelId, !isAssigned);
      setAssignedLabelIds(updatedTags.map((tag) => tag.id));
    } catch {
      return;
    } finally {
      setIsLabelSubmitting(false);
    }
  }

  async function handleCreateLabel(
    taskId: string,
    label: string,
    color: string,
  ) {
    const trimmed = label.trim();
    if (!trimmed) return;

    setIsLabelSubmitting(true);

    try {
      const tag = await createLabel(trimmed, color);
      setAvailableLabels((current) => {
        if (current.some((item) => item.id === tag.id)) {
          return current;
        }

        return [...current, tag].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        );
      });

      if (onToggleTaskLabel) {
        const updatedTags = await onToggleTaskLabel(taskId, tag.id, true);
        setAssignedLabelIds(updatedTags.map((item) => item.id));
      } else {
        setAssignedLabelIds((current) =>
          current.includes(tag.id) ? current : [...current, tag.id],
        );
      }

      setLabelQuery("");
      onLabelsChanged?.();
    } catch {
      return;
    } finally {
      setIsLabelSubmitting(false);
    }
  }

  function handleSelectTaskDueDate(taskId: string, dateValue: string | null) {
    onSetTaskDueDate?.(taskId, dateValue);
  }

  function handleSetTaskDueDateFromMenu(taskId: string, dateValue: string) {
    onSetTaskDueDate?.(taskId, dateValue);
    closeTaskMenus();
  }

  function handleOpenCustomDatePicker(taskId: string) {
    openDatePicker(taskId);
  }

  function handleSaveTaskDueTime(taskId: string, dueTime: TaskDueTime) {
    onSetTaskDueTime?.(taskId, dueTime);
    setOpenDatePickerTaskId(null);
  }

  function handleSaveTaskRecurrence(
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) {
    void onSetTaskRecurrence?.(taskId, rule);
  }

  function handleSelectTaskPriority(taskId: string, priority: number) {
    onSetTaskPriority?.(taskId, priority);
    closeTaskMenus();
  }

  function handleToggleTaskPinned(task: TaskListItem) {
    onSetTaskPinned?.(task.id, !task.pinned);
    closeTaskMenus();
  }

  function handleToggleTaskImportant(task: TaskListItem) {
    onSetTaskImportant?.(task.id, !task.important);
    closeTaskMenus();
  }

  function handleClearTaskPriority(taskId: string) {
    onSetTaskPriority?.(taskId, null);
    closeTaskMenus();
  }

  function handleTaskContextMenu(
    event: React.MouseEvent<HTMLLIElement>,
    task: TaskListItem,
  ) {
    event.preventDefault();
    event.stopPropagation();

    onSelectTask(task.id);
    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu({
      taskId: task.id,
      x: event.clientX,
      y: event.clientY,
      view: "main",
    });
  }

  function handleDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    dragState.lastPointerX = event.clientX;
    dragState.lastPointerY = event.clientY;

    const deltaY = event.clientY - dragState.startClientY;
    const list =
      dragState.section === "pinned"
        ? pinnedListRef.current
        : listRef.current;

    if (enableSidebarListDragDrop) {
      const targetListId = resolveSidebarListFromPoint(
        event.clientX,
        event.clientY,
      );

      if (targetListId) {
        const sourceTask = tasksById.get(dragState.sourceTaskId);
        const sourceListId = sourceTask
          ? resolveTaskListId(sourceTask)
          : listId;
        const isValidTarget =
          Boolean(sourceListId) && targetListId !== sourceListId;
        const nextDropTargetKey = getSidebarListDropTargetKey(
          dragState.sourceTaskId,
          targetListId,
        );

        if (nextDropTargetKey !== dragState.lastSidebarListDropTargetKey) {
          dragState.lastSidebarListDropTargetKey = nextDropTargetKey;
          onSidebarListDropTargetChange?.(
            isValidTarget
              ? {
                  taskId: dragState.sourceTaskId,
                  taskName: dragState.sourceTaskName,
                  listId: targetListId,
                }
              : null,
          );
        }

        if (dragState.lastCalendarDropTargetKey !== null) {
          dragState.lastCalendarDropTargetKey = null;
          onCalendarDropTargetChange?.(null);
        }

        setDropIndicator((current) => (current === null ? current : null));
        if (list) {
          resetRowShifts(getTaskRowElements(list), dragState.sourceRow);
        }
        dragState.appliedTargetIndex = null;
        if (dragState.appliedNestSignal !== 0) {
          dragState.sourceRow.style.transform = "translateX(0px)";
          dragState.appliedNestSignal = 0;
        }
        dragState.sourceRow.style.translate = "";
        dragState.sourceRow.style.scale = "";
        dragState.sourceRow.classList.remove("task-row-calendar-drag-source");
        dragState.sourceRow.classList.add("task-row-sidebar-drag-source");
        return;
      }

      if (dragState.lastSidebarListDropTargetKey !== null) {
        dragState.lastSidebarListDropTargetKey = null;
        onSidebarListDropTargetChange?.(null);
      }
      dragState.sourceRow.classList.remove("task-row-sidebar-drag-source");
    }

    if (enableCalendarDragDrop) {
      const dropSlot = resolveCalendarSlotFromPoint(
        event.clientX,
        event.clientY,
      );

      if (dropSlot) {
        const nextDropTargetKey = getCalendarDropTargetKey({
          ...dropSlot,
          taskId: dragState.sourceTaskId,
          taskName: dragState.sourceTaskName,
        });

        if (nextDropTargetKey !== dragState.lastCalendarDropTargetKey) {
          dragState.lastCalendarDropTargetKey = nextDropTargetKey;
          onCalendarDropTargetChange?.({
            ...dropSlot,
            taskId: dragState.sourceTaskId,
            taskName: dragState.sourceTaskName,
          });
        }

        setDropIndicator((current) => (current === null ? current : null));
        if (list) {
          resetRowShifts(getTaskRowElements(list), dragState.sourceRow);
        }
        dragState.appliedTargetIndex = null;
        if (dragState.appliedNestSignal !== 0) {
          dragState.sourceRow.style.transform = "translateX(0px)";
          dragState.appliedNestSignal = 0;
        }
        dragState.sourceRow.style.translate = "";
        dragState.sourceRow.style.scale = "";
        dragState.sourceRow.classList.add("task-row-calendar-drag-source");
        return;
      }

      if (dragState.lastCalendarDropTargetKey !== null) {
        dragState.lastCalendarDropTargetKey = null;
        onCalendarDropTargetChange?.(null);
      }
      dragState.sourceRow.classList.remove("task-row-calendar-drag-source");
    }

    dragState.sourceRow.style.translate = `0px ${deltaY}px`;

    if (!list) return;

    const rows = getTaskRowElements(list);
    let dropIndex = getTaskDropIndex(
      event.clientY,
      rows,
      dragState.sourceIndex,
    );

    const listRect = list.getBoundingClientRect();
    const hasChildBlock = dragState.blockIds.length > 1;
    const sourceParentId = dragState.sourceParentId;
    const hierarchyIntent = hasChildBlock
      ? "root"
      : resolveHierarchyDragIntent(
          event.clientX,
          dragState.startClientX,
          sourceParentId,
        );
    dragState.hierarchyIntent = hierarchyIntent;

    const nestSignalOffset =
      hierarchyIntent === "nest" || hierarchyIntent === "keep"
        ? NEST_SIGNAL_OFFSET_PX
        : 0;
    if (nestSignalOffset !== dragState.appliedNestSignal) {
      dragState.sourceRow.style.transform = `translateX(${nestSignalOffset}px)`;
      dragState.appliedNestSignal = nestSignalOffset;
    }

    if (sourceParentId && hierarchyIntent === "keep") {
      dropIndex = clampSubtaskKeepDropIndex(
        dragState.taskIds,
        dragState.sourceIndex,
        dropIndex,
        sourceParentId,
        tasksById,
      );
    }

    dragState.dropIndex = dropIndex;

    const targetIndex = getReorderTargetIndex(dragState.sourceIndex, dropIndex);
    if (targetIndex !== dragState.appliedTargetIndex) {
      applyRowShifts(
        rows,
        dragState.sourceRow,
        dragState.sourceIndex,
        targetIndex,
        dragState.rowHeight,
      );
      dragState.appliedTargetIndex = targetIndex;
    }

    let indicatorTop: number;

    if (dropIndex >= rows.length) {
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;
      const rect = lastRow.getBoundingClientRect();
      indicatorTop = rect.bottom - listRect.top;
    } else {
      const targetRow = rows[dropIndex];
      const rect = targetRow.getBoundingClientRect();
      indicatorTop = rect.top - listRect.top;
    }

    const indent = getDropIndicatorIndent(
      hierarchyIntent,
      dropIndex,
      sourceParentId,
    );

    setDropIndicator({ top: indicatorTop, section: dragState.section, indent });
  }

  function beginTaskDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    sourceTaskId: string,
    taskIds: string[],
    blockIds: string[],
    section: "pinned" | "unpinned",
    sourceParentId: string | null,
    startClientX: number,
    startClientY: number,
  ) {
    const list =
      section === "pinned" ? pinnedListRef.current : listRef.current;
    let activeRow = sourceRow;
    if (!activeRow.isConnected && list) {
      activeRow =
        getTaskRowElements(list).find(
          (row) => row.dataset.taskId === sourceTaskId,
        ) ?? sourceRow;
    }

    const rows = list ? getTaskRowElements(list) : [];
    const activeIndex = rows.indexOf(activeRow);
    const resolvedIndex = activeIndex >= 0 ? activeIndex : sourceIndex;

    dragStateRef.current = {
      sourceRow: activeRow,
      captureTarget: activeRow,
      sourceIndex: resolvedIndex,
      dropIndex: resolvedIndex,
      sourceTaskId,
      sourceTaskName: tasksById.get(sourceTaskId)?.name ?? "",
      taskIds,
      blockIds,
      pointerId,
      section,
      hierarchyIntent: sourceParentId ? "keep" : "root",
      sourceParentId,
      lastPointerX: 0,
      lastPointerY: 0,
      startClientX,
      startClientY,
      rowHeight: activeRow.getBoundingClientRect().height,
      appliedTargetIndex: null,
      appliedNestSignal: null,
      lastCalendarDropTargetKey: null,
      lastSidebarListDropTargetKey: null,
    };

    if (list) {
      getTaskRowElements(list).forEach((row) => {
        if (row !== activeRow) row.classList.add("task-row-shifting");
      });
    }

    activeRow.classList.add("task-row-dragging");
    activeRow.style.scale = "1.02";
    trySetPointerCapture(activeRow, pointerId);
    activeRow.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function handleDragEnd() {
    const dragState = dragStateRef.current;
    const wasDragging = dragState !== null;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.removeEventListener("pointercancel", handleDragEnd);
    document.body.style.cursor = "";

    if (dragState) {
      tryReleasePointerCapture(dragState.captureTarget, dragState.pointerId);
      dragState.sourceRow.classList.remove(
        "task-row-dragging",
        "task-row-calendar-drag-source",
        "task-row-sidebar-drag-source",
      );
      dragState.sourceRow.style.transform = "";
      dragState.sourceRow.style.translate = "";
      dragState.sourceRow.style.scale = "";
      dragState.sourceRow.style.cursor = "";

      const list =
        dragState.section === "pinned"
          ? pinnedListRef.current
          : listRef.current;
      if (list) {
        getTaskRowElements(list).forEach((row) => {
          row.classList.remove("task-row-shifting");
          if (row !== dragState.sourceRow) {
            row.style.transform = "";
          }
        });
      }
    }

    setDropIndicator(null);

    if (
      enableSidebarListDragDrop &&
      dragState &&
      dragState.lastSidebarListDropTargetKey !== null
    ) {
      dragState.lastSidebarListDropTargetKey = null;
      onSidebarListDropTargetChange?.(null);
    }

    if (
      enableSidebarListDragDrop &&
      dragState &&
      onMoveTaskToList
    ) {
      const targetListId = resolveSidebarListFromPoint(
        dragState.lastPointerX,
        dragState.lastPointerY,
      );

      if (targetListId) {
        handleMoveTaskToList(dragState.sourceTaskId, targetListId);

        if (wasDragging) {
          suppressRowClickRef.current = true;
        }

        dragStateRef.current = null;
        return;
      }
    }

    if (
      enableCalendarDragDrop &&
      dragState &&
      dragState.lastCalendarDropTargetKey !== null
    ) {
      dragState.lastCalendarDropTargetKey = null;
      onCalendarDropTargetChange?.(null);
    }

    if (
      dragState &&
      enableCalendarDragDrop &&
      onSetTaskDueDate
    ) {
      const dropSlot = resolveCalendarSlotFromPoint(
        dragState.lastPointerX,
        dragState.lastPointerY,
      );

      if (dropSlot) {
        onSetTaskDueDate(dragState.sourceTaskId, dropSlot.dateKey);

        if (dropSlot.dueTimeMinutes !== null && onSetTaskDueTime) {
          onSetTaskDueTime(dragState.sourceTaskId, {
            dueTimeMinutes: dropSlot.dueTimeMinutes,
            dueDurationMinutes: null,
            dueTimeZone: "floating",
          });
        }

        if (wasDragging) {
          suppressRowClickRef.current = true;
        }

        dragStateRef.current = null;
        return;
      }
    }

    if (dragState && listId && onReorderTasks && canReorder) {
      let dropIndex = dragState.dropIndex;

      if (
        dragState.sourceParentId &&
        dragState.hierarchyIntent === "keep"
      ) {
        dropIndex = clampSubtaskKeepDropIndex(
          dragState.taskIds,
          dragState.sourceIndex,
          dropIndex,
          dragState.sourceParentId,
          tasksById,
        );
      }

      const nextIds = reorderVisibleTaskIds(
        dragState.taskIds,
        dragState.sourceIndex,
        dropIndex,
        dragState.blockIds,
      );

      const orderChanged = nextIds.join(",") !== dragState.taskIds.join(",");
      const hierarchyIntentByTaskId = new Map([
        [dragState.sourceTaskId, dragState.hierarchyIntent],
      ]);
      const parentUpdates = collectParentUpdates(
        orderedTasks,
        nextIds,
        [dragState.sourceTaskId],
        hierarchyIntentByTaskId,
        tasksById,
      );
      const parentChanged = parentUpdates.length > 0;

      if (orderChanged || parentChanged) {
        setActiveSort(null);
        onReorderTasks(
          listId,
          nextIds,
          dragState.section,
          parentUpdates,
        );
      }
    }

    if (wasDragging) {
      suppressRowClickRef.current = true;
    }

    dragStateRef.current = null;
  }

  function handleRowPointerDown(
    event: React.PointerEvent<HTMLLIElement>,
    taskId: string,
    section: "pinned" | "unpinned",
  ) {
    if ((!canReorder && !enableCalendarDragDrop && !enableSidebarListDragDrop) || event.button !== 0) return;
    if (!shouldStartRowDrag(event.target)) return;

    const list =
      section === "pinned" ? pinnedListRef.current : listRef.current;
    if (!list) return;

    const rows = getTaskRowElements(list);
    const sourceRow = rows.find((row) => row.dataset.taskId === taskId);
    if (!sourceRow) return;

    const dragRow = sourceRow;
    const sourceIndex = rows.indexOf(dragRow);
    if (sourceIndex < 0) return;

    const visibleTasks =
      section === "pinned" ? pinnedVisibleTasks : unpinnedVisibleTasks;
    const taskIds = visibleTasks.map((task) => task.id);
    const blockIds = getDragBlockIds(taskIds, sourceIndex, tasksById);
    const sourceParentId = tasksById.get(taskId)?.parentId ?? null;

    const captureTarget = dragRow;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    trySetPointerCapture(captureTarget, pointerId);

    dragRow.style.cursor = "move";
    document.body.style.cursor = "move";

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;

      if (dragStarted) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < ROW_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginTaskDrag(
        dragRow,
        pointerId,
        sourceIndex,
        taskId,
        taskIds,
        blockIds,
        section,
        sourceParentId,
        startX,
        startY,
      );
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
      if (!dragStarted) {
        tryReleasePointerCapture(captureTarget, pointerId);
        dragRow.style.cursor = "";
        document.body.style.cursor = "";
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function renderTaskItems(
    taskItems: Array<TaskListItem & { depth?: number }>,
    section: "pinned" | "unpinned",
  ) {
    const hasLabelActions = Boolean(onToggleTaskLabel);
    const hasMoveActions = Boolean(onMoveTaskToList) && lists.length > 1;
    const useWiderRowPadding = title === "Today" || title === "Important";

    return taskItems.flatMap((task, index) => {
      const depth = task.depth ?? 0;
      const previousTask = index > 0 ? taskItems[index - 1] : null;
      const showSubtaskConnector =
        depth === 1 &&
        previousTask &&
        (previousTask.depth ?? 0) === 0 &&
        task.parentId === previousTask.id;

      const row = (
        <TaskListTaskRow
          key={task.id}
          task={task}
          depth={depth}
          isCompleting={completingTaskIds.has(task.id)}
          showCompletionBackground={
            completingTaskIds.has(task.id) &&
            !completingWithoutBackgroundTaskIds?.has(task.id)
          }
          useFastCompletionAnimation={completingWithoutBackgroundTaskIds?.has(
            task.id,
          )}
          isCheckAnimating={checkAnimatingTaskIds?.has(task.id) ?? false}
          selectedTaskId={selectedTaskId}
          editingTaskId={editingTaskId}
          titleDraft={titleDraft}
          titleInputRef={titleInputRef}
          showDragHandle={canReorder || enableCalendarDragDrop || enableSidebarListDragDrop}
          openDatePickerTaskId={openDatePickerTaskId}
          openMenuTaskId={openMenuTaskId}
          openLabelMenuTaskId={openLabelMenuTaskId}
          openMoveMenuTaskId={openMoveMenuTaskId}
          openPriorityMenuTaskId={openPriorityMenuTaskId}
          lists={lists}
          currentListId={resolveTaskListId(task)}
          moveQuery={moveQuery}
          availableLabels={availableLabels}
          assignedLabelIds={assignedLabelIds}
          labelQuery={labelQuery}
          isLabelSubmitting={isLabelSubmitting}
          taskDateMenuRef={taskDateMenuRef}
          taskLabelMenuRef={taskLabelMenuRef}
          taskPriorityMenuRef={taskPriorityMenuRef}
          taskContextMenuRef={taskContextMenuRef}
          dueDateLabel={formatTaskDueDateLabel(task.dueDate)}
          onTaskClick={handleTaskClick}
          onTaskContextMenu={handleTaskContextMenu}
          onToggleTask={onToggleTask}
          onTitleDraftChange={(taskId, value) => {
            setTitleDraft(value);
            onTaskNameChange?.(taskId, value);
          }}
          onCommitTitleEdit={(item) => {
            if (!titleEditReadyRef.current) return;
            commitTitleEdit(item);
          }}
          onTitleKeyDown={handleTitleKeyDown}
          onTaskDragStart={(event, taskId) =>
            handleRowPointerDown(event, taskId, section)
          }
          onToggleDatePicker={toggleDatePicker}
          onOpenDatePicker={openDatePicker}
          onSelectTaskDueDate={handleSelectTaskDueDate}
          onSaveTaskDueTime={handleSaveTaskDueTime}
          onSaveTaskRecurrence={handleSaveTaskRecurrence}
          onToggleTaskMenu={toggleTaskMenu}
          onTogglePriorityMenu={togglePriorityMenu}
          onToggleTaskPinned={handleToggleTaskPinned}
          onToggleTaskImportant={handleToggleTaskImportant}
          onOpenLabelMenu={openLabelMenu}
          onOpenMoveMenu={openMoveMenu}
          onMoveQueryChange={setMoveQuery}
          onMoveTaskToList={handleMoveTaskToList}
          onLabelQueryChange={setLabelQuery}
          onToggleLabel={(labelId) => handleToggleLabel(task.id, labelId)}
          onCreateLabel={(label, color) =>
            handleCreateLabel(task.id, label, color)
          }
          onSetTaskDueDateFromMenu={handleSetTaskDueDateFromMenu}
          onOpenCustomDatePicker={handleOpenCustomDatePicker}
          onSelectTaskPriority={handleSelectTaskPriority}
          onClearTaskPriority={handleClearTaskPriority}
          onCloseTaskMenu={closeTaskMenus}
          hasDueDateActions={Boolean(onSetTaskDueDate)}
          hasPriorityActions={Boolean(onSetTaskPriority)}
          hasPinActions={Boolean(onSetTaskPinned)}
          hasImportantActions={Boolean(onSetTaskImportant)}
          hasLabelActions={hasLabelActions}
          hasMoveActions={hasMoveActions}
          useWiderRowPadding={useWiderRowPadding}
        />
      );

      if (!showSubtaskConnector) {
        return [row];
      }

      return [
        <li
          key={`${task.id}-subtask-connector`}
          aria-hidden="true"
          className="flex h-4 items-center border-b border-zinc-100 py-0 pr-2 dark:border-zinc-900"
          style={{
            paddingLeft: SUBTASK_ROOT_LEFT_PX + SUBTASK_INDENT_PX + SUBTASK_ICON_INDENT_PX,
          }}
        >
          <PiArrowBendDownRight className="size-3.5 text-zinc-400 dark:text-zinc-500" />
        </li>,
        row,
      ];
    });
  }

  const pointerMenuTask = pointerContextMenu
    ? orderedTasks.find((task) => task.id === pointerContextMenu.taskId)
    : null;

  return (
    <section
      style={
        panelWidth != null
          ? {
              width: resolvedPanelWidth,
              minWidth: TASK_LIST_PANEL_MIN_WIDTH,
              maxWidth: panelMaxWidth,
              flexShrink: 0,
            }
          : title
            ? {
                width: resolvedPanelWidth,
                minWidth: TASK_LIST_PANEL_MIN_WIDTH,
                maxWidth: autoExpandMaxWidth,
                flexShrink: 0,
              }
            : undefined
      }
      onMouseEnter={onPanelMouseEnter}
      className={`relative shrink-0 bg-white dark:bg-zinc-950 border-l border-l-[#ffffff] ${
        isListHovered ? "border-l border-l-[#bbbbbb]" : ""
      } ${
        panelWidth != null || title
          ? "flex min-h-0 flex-col border-r border-zinc-200 dark:border-zinc-800"
          : embedded
            ? "w-[350px] border-r border-zinc-200 dark:border-zinc-800"
            : "w-full max-w-[350px] min-w-[350px] border-r border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {title ? (
        <div
          className={`flex flex-col ${
            panelWidth != null || title ? "min-h-0 flex-1" : ""
          }`}
        >
          {showHeader && (
            <header className="flex items-center justify-between gap-2 border-b border-zinc-200 py-[9px] pl-[26px] pr-4 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-1.5">
                {showSidebarMenu && onOpenSidebar ? (
                  <button
                    type="button"
                    aria-label="Open menu"
                    className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
                    onClick={onOpenSidebar}
                  >
                    <LuMenu className="size-5" aria-hidden="true" />
                  </button>
                ) : null}
                <h1 className="min-w-0 truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </h1>
                {showListCalendarButton && hasScheduledTasks ? (
                  <button
                    ref={listCalendarButtonRef}
                    type="button"
                    onClick={onListCalendarClick}
                    onMouseEnter={() => onListCalendarHoverStart?.()}
                    onMouseLeave={() => onListCalendarHoverEnd?.()}
                    aria-pressed={isListCalendarOpen}
                    aria-label={`Calendar - ${title}`}
                    className={`group flex shrink-0 items-center overflow-hidden rounded-lg py-[4px] pl-[9px] ml-1 pr-[9px] transition-[background-color,padding,max-width,opacity] cursor-pointer ${
                      isListCalendarOpen || isListCalendarPreview
                        ? "bg-[#4873c7] text-white"
                        : "bg-[#eceef0] text-zinc-700 hover:bg-zinc-250 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <LuCalendarCheck2
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span
                      className={`overflow-hidden whitespace-nowrap text-[12px] font-medium transition-[max-width,opacity,padding] duration-200 ease-out ${
                        isListCalendarOpen || isListCalendarPreview
                          ? "max-w-[12rem] pl-1.5 opacity-100"
                          : "max-w-0 opacity-0 group-hover:max-w-[12rem] group-hover:pl-1.5 group-hover:opacity-100"
                      }`}
                    >
                      Calendar
                    </span>
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
              {orderedTasks.length >= 2 ? (
                <div
                  className="relative flex shrink-0 items-center rounded-[5px] bg-[#f5f6f7]"
                  ref={sortMenuRef}
                  onMouseEnter={() => setIsSortMenuOpen(true)}
                  onMouseLeave={() => setIsSortMenuOpen(false)}
                >
                  <button
                    type="button"
                    aria-label={
                      activeSort
                        ? `Sort tasks. Currently sorted by ${activeSort.label}`
                        : "Sort tasks"
                    }
                    aria-haspopup="menu"
                    aria-expanded={isSortMenuOpen}
                    className="flex h-[27px] cursor-pointer items-center rounded-lg pl-1 pr-[6px] text-[14px] text-[#777777] transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <BiSortAlt2
                      className="size-[15px] shrink-0"
                      aria-hidden="true"
                    />
                    {activeSort ? (
                      <div className="ml-[1px] flex">
                        Sort:{" "}
                        <div className="ml-[1px] mt-[3.5px] cursor-pointer text-[11px] font-medium">
                          {formatActiveSortLabel(activeSort.label)}
                        </div>
                      </div>
                    ) : (
                      "Sort"
                    )}
                  </button>

                  {isSortMenuOpen && (
                    <div className="absolute right-0 top-full z-50 min-w-[180px] pt-1">
                      <div
                        role="menu"
                        className="overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <button
                            key={`${option.field}-${option.direction}`}
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              applySort(option.field, option.direction)
                            }
                            className="flex h-[35px] w-full cursor-pointer items-center px-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              </div>
            </header>
          )}

          <div className="relative z-20 flex items-center overflow-visible pl-[16px] pr-[6px] py-2 min-h-[50px]">
            {showAddTask ? (
              isAddingTask ? (
                <div className="mr-[10px]! min-w-0 flex-1 overflow-visible">
                  <form
                    ref={addTaskFormRef}
                    onSubmit={handleSubmit}
                    className="add-task-form-enter flex min-w-0 w-full items-center rounded-lg border border-[#d8dde8] bg-[#fbfbfb] pl-2 pr-[6.5px] dark:border-zinc-600 dark:bg-zinc-900"
                  >
                  <input
                    ref={newTaskInputRef}
                    type="text"
                    value={newTaskName}
                    onChange={(event) => setNewTaskName(event.target.value)}
                    placeholder='Add task"'
                    aria-label="Task name"
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-zinc-700 outline-none dark:text-zinc-50"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        if (isAddTaskDatePickerOpenRef.current) {
                          setIsAddTaskDatePickerOpen(false);
                          return;
                        }
                        cancelAddTask();
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        if (keepAddTaskOpenRef.current) return;
                        if (isFocusWithinAddTaskForm()) return;

                        cancelAddTask();
                      }, 0);
                    }}
                  />
                  <div
                    className="group/date-picker relative shrink-0"
                    ref={addTaskDateMenuRef}
                  >
                    <button
                      type="button"
                      aria-label={
                        newTaskDueDate
                          ? "Change due date and time"
                          : "Set due date and time"
                      }
                      aria-haspopup="dialog"
                      aria-expanded={isAddTaskDatePickerOpen}
                      aria-describedby="add-task-calendar-tooltip"
                      onMouseDown={(event) => event.preventDefault()}
                      onFocus={() => openAddTaskDatePicker(true)}
                      onClick={() =>
                        setIsAddTaskDatePickerOpen((open) => !open)
                      }
                      className={`group flex h-7 shrink-0 cursor-pointer items-center gap-0.5 rounded-[7px] pl-1.5 pr-[4px] mr-1 transition-colors hover:bg-[#f0f0f2] hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
                        newTaskDueDate || newTaskDueTime
                          ? "text-[#4873c7] dark:text-[#7da2ff]"
                          : ""
                      }`}
                    >
                      <TaskSetDateIcon className="size-[22px] text-[#7c7c8b] group-hover:text-[#54545e]" />
                      <BiChevronDown
                        className={`size-3 text-[#bbbbbb] transition-transform ${
                          isAddTaskDatePickerOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <span
                      id="add-task-calendar-tooltip"
                      role="tooltip"
                      className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/date-picker:opacity-100"
                    >
                      Set Date
                    </span>
                    {isAddTaskDatePickerOpen ? (
                      <div
                        ref={addTaskDatePickerRef}
                        className="absolute right-0 top-full z-[100] mt-1"
                        onKeyDown={(event) => {
                          if (event.key !== "Escape") return;
                          event.stopPropagation();
                          setIsAddTaskDatePickerOpen(false);
                          newTaskInputRef.current?.focus();
                        }}
                      >
                        <TaskDatePicker
                          dueDate={newTaskDueDate}
                          dueTimeMinutes={
                            newTaskDueTime?.dueTimeMinutes ?? null
                          }
                          dueDurationMinutes={
                            newTaskDueTime?.dueDurationMinutes ?? null
                          }
                          dueTimeZone={newTaskDueTime?.dueTimeZone ?? null}
                          onSelectDate={(dateValue) => {
                            setNewTaskDueDate(dateValue);
                            if (dateValue === null) {
                              setNewTaskDueTime(null);
                            }
                          }}
                          onSaveDueTime={(dueTime) => {
                            setNewTaskDueTime(dueTime);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
               
                  <button
                    type="submit"
                    onMouseDown={(event) => event.preventDefault()}
                    disabled={!newTaskName.trim()}
                    className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[10px] bg-[#b4bdc5] px-[9px] text-xs font-medium text-white transition-colors enabled:hover:bg-zinc-500 disabled:cursor-not-allowed"
                    // className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[10px] bg-zinc-400 px-[9px] text-xs font-medium text-white transition-colors enabled:hover:bg-zinc-500 disabled:cursor-not-allowed"
                  >
                    <LuCheck className="size-3.5" aria-hidden="true" />
                    Add
                  </button>
                </form>
                {newTaskParsePreview ? (
                  <p className="mt-1 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                    {newTaskParsePreview}
                  </p>
                ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startAddingTask}
                  title="Add task (Ctrl+Enter / Cmd+Enter)"
                  className="flex h-[33px] items-center gap-2 rounded-[10px] bg-[#4873c7] pl-[13px] pr-[15px] text-sm font-medium text-white transition-colors cursor-pointer hover:bg-[#3f68bd]"
                >
                  <LuPlus className="size-4" aria-hidden="true" />
                  Add task
                </button>
              )
            ) : null}
          </div>

          <div
            ref={taskListScrollRef}
            className={
              panelWidth != null || title
                ? "min-h-0 flex-1 overflow-y-auto"
                : undefined
            }
          >
          {showAddTask && pinnedVisibleTasks.length > 0 && (
            <div className="mb-2 border-b border-zinc-200 bg-zinc-50/40 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 dark:text-zinc-400">
                Pinned
              </p>
              <ul ref={pinnedListRef} className="relative flex flex-col">
                {dropIndicator?.section === "pinned" && (
                  <div
                    className="pointer-events-none absolute right-4 z-20 h-0.5 bg-blue-500"
                    style={{
                      top: dropIndicator.top,
                      left: 16 + dropIndicator.indent,
                    }}
                  />
                )}
                {renderTaskItems(pinnedVisibleTasks, "pinned")}
              </ul>
            </div>
          )}

          <ul
            ref={listRef}
            className={`relative flex flex-col ${
              showAddTask && pinnedVisibleTasks.length > 0
                ? "border-t border-zinc-200 dark:border-zinc-700"
                : ""
            }`}
          >
            {dropIndicator?.section === "unpinned" && (
              <div
                className="pointer-events-none absolute right-4 z-20 h-0.5 bg-blue-500"
                style={{
                  top: dropIndicator.top,
                  left: 16 + dropIndicator.indent,
                }}
              />
            )}

            {listTasks.length === 0 && pinnedVisibleTasks.length === 0 ? (
              <li className="pl-[33px] pr-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {title === "Today"
                  ? "No tasks for today"
                  // : title === "Next 7 days"
                  //   ? "No tasks in the next 7 days"
                  : title === "Important"
                    ? "No important tasks"
                    : title === "Calendar"
                      ? "No scheduled tasks"
                      : isLabelFilter
                        ? "No tasks with this label"
                        : "No tasks"}
              </li>
            ) : (
              renderTaskItems(
                canReorder ? unpinnedVisibleTasks : listTasks,
                "unpinned",
              )
            )}
          </ul>

          {showAddTask && listId ? (
            <div className="border-t border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setIsCompletedOpen((open) => !open)}
                aria-expanded={isCompletedOpen}
                className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm text-[#777b7e] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              >
                <BiChevronDown
                  className={`size-4 shrink-0 text-zinc-400 transition-transform ${
                    isCompletedOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                />
                <span>Completed</span>
                {completedTasks.length > 0 ? (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {completedTasks.length}
                  </span>
                ) : null}
              </button>

              {isCompletedOpen ? (
                completedTasks.length === 0 ? (
                  <p className="px-4 pb-3 text-sm text-zinc-500 dark:text-zinc-400">
                    No completed tasks
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {completedTasks.map((task) => (
                      <li
                        key={task.id}
                        className={`group flex min-h-[35px] items-center border-b border-zinc-100 ml-[23px] py-1 pr-2 pl-[5px] dark:border-zinc-900 ${getTaskRowLeftBorderClass(
                          task.id,
                          selectedTaskId,
                        )} ${
                          task.id === selectedTaskId
                            ? "bg-[#e9ebee]/50 hover:bg-[#e9ebee]/80"
                            : "hover:bg-[#faf6ff]"
                        }`}
                      >
                        <TaskCompletionCheckbox
                          variant="box"
                          checkKey={task.id}
                          checked
                          persistCheckmark
                          className="task-list-checkbox self-center"
                          onChange={() => onToggleTask(task.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Reopen ${task.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectTask(task.id)}
                          className="min-w-0 flex-1 ml-[9px] text-left"
                        >
                          <span
                            data-task-truncate-measure
                            className="block truncate text-sm leading-[19px] text-zinc-400 dark:text-zinc-500"
                          >
                            {task.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          ) : null}
          </div>

        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a list, Today, or Calendar to view tasks
          </p>
        </div>
      )}

      {pointerContextMenu && pointerMenuTask ? (
        <div ref={pointerContextMenuRef}>
          <TaskRowContextMenu
            task={pointerMenuTask}
            view={pointerContextMenu.view}
            lists={lists}
            currentListId={resolveTaskListId(pointerMenuTask)}
            moveQuery={moveQuery}
            availableLabels={availableLabels}
            assignedLabelIds={assignedLabelIds}
            labelQuery={labelQuery}
            isLabelSubmitting={isLabelSubmitting}
            fixedPosition={{
              x: pointerContextMenu.x,
              y: pointerContextMenu.y,
            }}
            onMoveQueryChange={setMoveQuery}
            onLabelQueryChange={setLabelQuery}
            onToggleLabelSelection={(labelId) =>
              handleToggleLabel(pointerMenuTask.id, labelId)
            }
            onCreateLabel={(label, color) =>
              handleCreateLabel(pointerMenuTask.id, label, color)
            }
            onClose={closeTaskMenus}
            onToggleTaskPinned={() => handleToggleTaskPinned(pointerMenuTask)}
            onToggleTaskImportant={() =>
              handleToggleTaskImportant(pointerMenuTask)
            }
            onOpenLabelMenu={() => openLabelMenu(pointerMenuTask.id)}
            onOpenMoveMenu={() => openMoveMenu(pointerMenuTask.id)}
            onMoveTaskToList={(targetListId) =>
              handleMoveTaskToList(pointerMenuTask.id, targetListId)
            }
            onSetTaskDueDate={(dateValue) =>
              handleSetTaskDueDateFromMenu(pointerMenuTask.id, dateValue)
            }
            onOpenCustomDatePicker={() =>
              handleOpenCustomDatePicker(pointerMenuTask.id)
            }
            onSelectTaskPriority={(priority) =>
              handleSelectTaskPriority(pointerMenuTask.id, priority)
            }
            onClearTaskPriority={() =>
              handleClearTaskPriority(pointerMenuTask.id)
            }
            hasDueDateActions={Boolean(onSetTaskDueDate)}
            hasPriorityActions={Boolean(onSetTaskPriority)}
            hasPinActions={Boolean(onSetTaskPinned)}
            hasImportantActions={Boolean(onSetTaskImportant)}
            hasLabelActions={Boolean(onToggleTaskLabel)}
            hasMoveActions={Boolean(onMoveTaskToList) && lists.length > 1}
          />
        </div>
      ) : null}
    </section>
  );
}
