"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { TaskRowMenuTransition } from "./task-row-menu-transition";
import { createPortal } from "react-dom";
import { useIsTaskRestoredForFade } from "@/lib/task-restore-fade";
import { InteractIcon } from "./line-control-icons";
import { TaskSetDateIcon } from "./task-set-date-icon";
import {
  CHECKED_ROW_DIM_MS,
  getCompletionAnimationMs,
  TASK_COMPLETE_ANIMATION_MS,
  TaskCompletionCheckbox,
} from "./task-completion-checkbox";
import {
  TaskDatePicker,
  TASK_DATE_PICKER_GAP,
  TASK_DATE_PICKER_HEIGHT,
  TASK_DATE_PICKER_WIDTH,
} from "./task-date-picker";
import {
  computeAnchoredMenuPosition,
  type AnchoredMenuPosition,
} from "@/lib/anchored-menu-position";
import type { TaskReminderOptionId } from "@/lib/task-reminder";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import { TaskLabelSelector, type Label } from "./task-label-selector";
import { TaskLabelPills } from "./task-label-pills";
import { TaskListImageThumbs } from "./task-list-image-thumbs";
import { TaskPriorityMenu } from "./task-priority-menu";
import { TaskPriorityPill } from "./task-priority-pill";
import { TaskPriorityFlagIcon } from "./task-priority-icon";
import { PiDotsThreeBold } from "react-icons/pi";
import { LiaTagSolid } from "react-icons/lia";
import { CiStickyNote } from "react-icons/ci";
import { LuNotebookText } from "react-icons/lu";
import { PiNoteLight } from "react-icons/pi";

import { BiAlarm, BiCalendar, BiRevision } from "react-icons/bi";
import { IoMdTime } from "react-icons/io";
import { MdKeyboardArrowDown } from "react-icons/md";
import { RiArrowDropRightLine } from "react-icons/ri";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import { parseRecurrenceRule } from "@/lib/task-recurrence";
import {
  formatDueTimeLabel,
  normalizeDueTimeMinutes,
} from "@/lib/task-due-time";
import { SUBTASK_INDENT_PX, SUBTASK_ICON_INDENT_PX } from "@/lib/task-subtasks";
import { formatTaskListScheduleSubline } from "@/lib/task-due-date";

type TaskListTaskRowProps = {
  task: TaskListItem;
  depth?: number;
  isCompleting?: boolean;
  showCompletionBackground?: boolean;
  useFastCompletionAnimation?: boolean;
  isCheckAnimating?: boolean;
  selectedTaskId: string | null;
  /** True after arrow-key row navigation until the pointer moves. */
  isKeyboardNavigating?: boolean;
  editingTaskId: string | null;
  titleDraft: string;
  selectAllTitleOnEdit?: boolean;
  onTitleEditReady?: () => void;
  showDragHandle: boolean;
  openDatePickerTaskId: string | null;
  isPointerMenuOpen?: boolean;
  openLabelMenuTaskId: string | null;
  openMoveMenuTaskId: string | null;
  openPriorityMenuTaskId: string | null;
  lists: TodoList[];
  currentListId: string | null;
  moveQuery: string;
  availableLabels: Label[];
  assignedLabelIds: string[];
  labelQuery: string;
  isLabelSubmitting: boolean;
  taskDateMenuRef: RefObject<HTMLDivElement | null>;
  taskLabelMenuRef: RefObject<HTMLDivElement | null>;
  taskPriorityMenuRef: RefObject<HTMLDivElement | null>;
  taskContextMenuRef: RefObject<HTMLDivElement | null>;
  dueDateLabel: string | null;
  onTaskClick: (task: TaskListItem, event?: React.MouseEvent) => void;
  onTaskContextMenu: (
    event: React.MouseEvent<HTMLLIElement>,
    task: TaskListItem,
  ) => void;
  onToggleTask: (taskId: string) => void;
  onTitleDraftChange: (taskId: string, value: string) => void;
  onCommitTitleEdit: (task: TaskListItem) => void;
  onTitleKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>,
    task: TaskListItem,
  ) => void;
  onTaskDragStart: (
    event: React.PointerEvent<HTMLLIElement>,
    taskId: string,
  ) => void;
  onToggleDatePicker: (taskId: string) => void;
  onOpenDatePicker: (taskId: string) => void;
  onHoverOpenDatePicker?: (taskId: string) => void;
  onScheduleCloseDatePicker?: () => void;
  onDateInputFocusChange?: (focused: boolean) => void;
  onHoverOpenLabelMenu?: (taskId: string) => void;
  onScheduleCloseLabelMenu?: () => void;
  onHoverOpenPriorityMenu?: (taskId: string) => void;
  onScheduleClosePriorityMenu?: () => void;
  onSelectTaskDueDate: (taskId: string, dateValue: string | null) => void;
  onSaveTaskDueTime: (
    taskId: string,
    dueTime: TaskDueTime,
    options?: { keepOpen?: boolean },
  ) => void;
  onSaveTaskRecurrence: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => void | Promise<void>;
  onOpenTaskRowMenu: (task: TaskListItem, anchor: HTMLElement) => void;
  onHoverOpenTaskRowMenu?: (task: TaskListItem, anchor: HTMLElement) => void;
  onScheduleCloseTaskRowMenu?: () => void;
  onTogglePriorityMenu: (taskId: string) => void;
  onToggleTaskImportant: (task: TaskListItem) => void;
  onOpenLabelMenu: (taskId: string) => void;
  onOpenMoveMenu: (taskId: string) => void;
  onMoveQueryChange: (value: string) => void;
  onMoveTaskToList: (taskId: string, targetListId: string) => void;
  onLabelQueryChange: (value: string) => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (label: string, color: string) => void;
  onSetTaskDueDateFromMenu: (taskId: string, dateValue: string) => void;
  onClearTaskDueDateFromMenu: (taskId: string) => void;
  onOpenCustomDatePicker: (taskId: string) => void;
  onSelectTaskPriority: (taskId: string, priority: number) => void;
  onClearTaskPriority: (taskId: string) => void;
  onConvertTaskToNote: (taskId: string) => void;
  onAddSubtask: (taskId: string) => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onCloseTaskMenu: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasNoteActions: boolean;
  hasImportantActions: boolean;
  hasLabelActions: boolean;
  hasMoveActions: boolean;
  hasSubtaskActions: boolean;
  hasDuplicateActions: boolean;
  hasDeleteActions: boolean;
  useWiderRowPadding?: boolean;
  subtaskCount?: number;
  subtasksExpanded?: boolean;
  onToggleSubtasksExpanded?: () => void;
  showSubtaskCollapseToggle?: boolean;
};

const TASK_LABEL_SELECTOR_WIDTH = 220;
const TASK_LABEL_SELECTOR_GAP = 4;
const TASK_LABEL_SELECTOR_MAX_HEIGHT = 360;

function computeTaskLabelSelectorPosition(rect: DOMRect) {
  return computeAnchoredMenuPosition(rect, {
    menuWidth: TASK_LABEL_SELECTOR_WIDTH,
    menuHeight: TASK_LABEL_SELECTOR_MAX_HEIGHT,
    gap: TASK_LABEL_SELECTOR_GAP,
    align: "center",
  });
}

function resolveClickedLabelPillAnchor(
  event: React.MouseEvent<HTMLButtonElement>,
): HTMLElement {
  const pill = (event.target as HTMLElement).closest("[data-label-pill]");
  if (
    pill instanceof HTMLElement &&
    event.currentTarget.contains(pill)
  ) {
    return pill;
  }

  return event.currentTarget;
}
const TASK_PRIORITY_MENU_WIDTH = 196;
const TASK_PRIORITY_MENU_HEIGHT = 72;
const TASK_PRIORITY_MENU_GAP = 4;

function getTaskListPanelScrollBounds(anchor: HTMLElement | null) {
  const viewportPadding = 8;
  const scrollContainer = anchor?.closest(
    ".list-panel-scroll",
  ) as HTMLElement | null;

  if (!scrollContainer) {
    return {
      top: viewportPadding,
      bottom: window.innerHeight - viewportPadding,
    };
  }

  const panelRect = scrollContainer.getBoundingClientRect();
  return {
    top: panelRect.top + viewportPadding,
    bottom: panelRect.bottom - viewportPadding,
  };
}

function computeTaskPriorityMenuPosition(
  rect: DOMRect,
  anchor: HTMLElement | null,
) {
  return computeAnchoredMenuPosition(rect, {
    menuWidth: TASK_PRIORITY_MENU_WIDTH,
    menuHeight: TASK_PRIORITY_MENU_HEIGHT,
    gap: TASK_PRIORITY_MENU_GAP,
    align: "center",
    bounds: getTaskListPanelScrollBounds(anchor),
  });
}

const TASK_ROW_LEFT_BORDER_WIDTH_CLASS = "border-l-[2px]";
const TASK_ROW_LEFT_BORDER_COLOR_CLASS = "border-l-[#dADFeF]";

// Schedule/time subline: base #98979c, row hover 20% darker → #79787c
const TASK_ROW_SCHEDULE_COLOR_CLASS =
  "ptxt-task-datetime group-hover:text-[#7696bf]";
  // "ptxt-400 group-hover:text-[#6f90bf]";
  // "ptxt-400 group-hover:text-[#6fa0cf]";
  // "ptxt-400 group-hover:text-[#6a99c6]";
  // "ptxt-400 group-hover:text-[#6793bc]";
  // "ptxt-400 group-hover:text-[#67a3cc]";
  // "ptxt-400 group-hover:text-[#699abd]";
  // "ptxt-400 group-hover:text-[#8f8d93]";
const TASK_ROW_SCHEDULE_TRANSITION_CLASS =
  "transition-colors duration-200 ease-in-out";

export function getTaskListItemDividerClass(task: {
  isNote: boolean;
  dueDate: string | null;
}) {
  if (task.isNote) {
    return "task-list-item-divider task-list-item-divider--note";
  }

  if (task.dueDate) {
    return "task-list-item-divider task-list-item-divider--dated";
  }

  return "task-list-item-divider";
}

export function getTaskRowLeftBorderClass(
  taskId: string,
  selectedTaskId: string | null,
) {
  if (taskId === selectedTaskId) {
    return `${TASK_ROW_LEFT_BORDER_WIDTH_CLASS} ${TASK_ROW_LEFT_BORDER_COLOR_CLASS}`;
  }

  return `${TASK_ROW_LEFT_BORDER_WIDTH_CLASS} border-l-transparent hover:border-l-[#DADFDF] transition-[background-color,border-color]`;
}

function getRowMenuView(
  taskId: string,
  openMoveMenuTaskId: string | null,
): TaskRowContextMenuView | null {
  if (openMoveMenuTaskId === taskId) return "moveTo";
  return null;
}

function computeTaskDatePickerPosition(anchor: HTMLElement) {
  return computeAnchoredMenuPosition(anchor.getBoundingClientRect(), {
    menuWidth: TASK_DATE_PICKER_WIDTH,
    menuHeight: TASK_DATE_PICKER_HEIGHT,
    gap: TASK_DATE_PICKER_GAP,
    align: "center",
    bounds: getTaskListPanelScrollBounds(anchor),
  });
}

function isTaskDatePickerTrigger(target: Node) {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-task-date-picker-trigger]"))
  );
}

export function isTaskDatePickerTriggerElement(target: Node) {
  return isTaskDatePickerTrigger(target);
}

export function isTaskPriorityTriggerElement(target: Node) {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-task-priority-trigger]"))
  );
}

export function TaskListTaskRow({
  task,
  depth = 0,
  isCompleting = false,
  showCompletionBackground = true,
  useFastCompletionAnimation = false,
  isCheckAnimating = false,
  selectedTaskId,
  isKeyboardNavigating = false,
  editingTaskId,
  titleDraft,
  selectAllTitleOnEdit = false,
  onTitleEditReady,
  showDragHandle,
  openDatePickerTaskId,
  isPointerMenuOpen = false,
  openLabelMenuTaskId,
  openMoveMenuTaskId,
  openPriorityMenuTaskId,
  lists,
  currentListId,
  moveQuery,
  availableLabels,
  assignedLabelIds,
  labelQuery,
  isLabelSubmitting,
  taskDateMenuRef,
  taskLabelMenuRef,
  taskPriorityMenuRef,
  taskContextMenuRef,
  dueDateLabel,
  onTaskClick,
  onTaskContextMenu,
  onToggleTask,
  onTitleDraftChange,
  onCommitTitleEdit,
  onTitleKeyDown,
  onTaskDragStart,
  onToggleDatePicker,
  onOpenDatePicker,
  onHoverOpenDatePicker,
  onScheduleCloseDatePicker,
  onDateInputFocusChange,
  onHoverOpenLabelMenu,
  onScheduleCloseLabelMenu,
  onHoverOpenPriorityMenu,
  onScheduleClosePriorityMenu,
  onSelectTaskDueDate,
  onSaveTaskDueTime,
  onSaveTaskRecurrence,
  onOpenTaskRowMenu,
  onHoverOpenTaskRowMenu,
  onScheduleCloseTaskRowMenu,
  onTogglePriorityMenu,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveQueryChange,
  onMoveTaskToList,
  onLabelQueryChange,
  onToggleLabel,
  onCreateLabel,
  onSetTaskDueDateFromMenu,
  onClearTaskDueDateFromMenu,
  onOpenCustomDatePicker,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConvertTaskToNote,
  onAddSubtask,
  onDuplicateTask,
  onDeleteTask,
  onCloseTaskMenu,
  hasDueDateActions,
  hasPriorityActions,
  hasNoteActions,
  hasImportantActions,
  hasLabelActions,
  hasMoveActions,
  hasSubtaskActions,
  hasDuplicateActions,
  hasDeleteActions,
  useWiderRowPadding = false,
  subtaskCount = 0,
  subtasksExpanded = true,
  onToggleSubtasksExpanded,
  showSubtaskCollapseToggle = false,
}: TaskListTaskRowProps) {
  const isRestoredForFade = useIsTaskRestoredForFade(task.id);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [reminderOptionId, setReminderOptionId] =
    useState<TaskReminderOptionId | null>(null);

  useLayoutEffect(() => {
    if (editingTaskId !== task.id) return;

    const input = titleInputRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });
    if (selectAllTitleOnEdit) {
      input.select();
    } else {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    onTitleEditReady?.();
  }, [editingTaskId, onTitleEditReady, selectAllTitleOnEdit, task.id, titleDraft]);

  const rowMenuView = getRowMenuView(task.id, openMoveMenuTaskId);
  const isLabelMenuOpen = openLabelMenuTaskId === task.id;
  const isPriorityMenuOpen = openPriorityMenuTaskId === task.id;
  const isRowMenuOpen =
    !isCompleting &&
    (openDatePickerTaskId === task.id ||
      isLabelMenuOpen ||
      isPriorityMenuOpen ||
      isPointerMenuOpen ||
      rowMenuView !== null);
  const isSelected = task.id === selectedTaskId;
  const isTitleEditFocusRow =
    editingTaskId !== null && editingTaskId === task.id;
  const isListFocusRow =
    editingTaskId !== null ? isTitleEditFocusRow : isSelected;
  const suppressRowHoverChrome =
    editingTaskId !== null && editingTaskId !== task.id;
  const showRowHoverActions = isRowMenuOpen || isListFocusRow;
  /** Selected row: hide action icons while the pointer is over the list panel, unless this row is hovered or has a menu open. */
  const hideSelectedActionsOnPanelHover =
    isSelected &&
    !isRowMenuOpen &&
    editingTaskId === null &&
    !isKeyboardNavigating;
  /** After arrow-key navigation (pointer not moved): only the active row shows actions, not the row under the pointer. */
  const suppressPointerHoverActions =
    isKeyboardNavigating && !showRowHoverActions;
  const rowActionsPointerClass = suppressPointerHoverActions
    ? "pointer-events-none"
    : hideSelectedActionsOnPanelHover
      ? "pointer-events-auto task-row-selected-quick-actions"
      : showRowHoverActions
        ? "pointer-events-auto"
        : "pointer-events-none group-hover:pointer-events-auto";
  /** Set priority pill stays visible on selected rows; it must not use quick-action hide rules. */
  const priorityPillPointerClass = suppressPointerHoverActions
    ? "pointer-events-none"
    : hasPriorityActions
      ? "pointer-events-auto"
      : "pointer-events-none";

  const basePaddingLeft = useWiderRowPadding ? 1 : 0;
  const rowOuterPaddingLeft = depth * SUBTASK_INDENT_PX;
  const rowContentPaddingLeft = basePaddingLeft;
  const leftBorderClass = getTaskRowLeftBorderClass(
    task.id,
    editingTaskId ?? selectedTaskId,
  );
  const dividerClass = getTaskListItemDividerClass(task);
  const hideDueDate = isCheckAnimating || isCompleting;
  const checkedContentDim = hideDueDate ? "opacity-50" : "opacity-100";
  const titleColorClass =
    depth > 0 ? "ptxt-subtask-title" : "ptxt-task-title";
  const checkedTextStyle = hideDueDate
    ? "ptxt-completed-tasks"
    : titleColorClass;
  const taskTitleTextClass =
    depth > 0 ? "text-[14px] leading-[18px]" : "text-[15px] leading-[20px]";
  const completionAnimationMs = getCompletionAnimationMs(
    TASK_COMPLETE_ANIMATION_MS,
    useFastCompletionAnimation,
  );
  const checkedRowDimMs = getCompletionAnimationMs(
    CHECKED_ROW_DIM_MS,
    useFastCompletionAnimation,
  );
  const dimTransition = `color ${checkedRowDimMs}ms ease-out, opacity ${checkedRowDimMs}ms ease-out`;
  const completeDurationStyle = {
    "--task-complete-duration": `${completionAnimationMs}ms`,
  } as React.CSSProperties;
  const datePickerAnchorRef = useRef<HTMLButtonElement>(null);
  const scheduleAnchorRef = useRef<HTMLButtonElement>(null);
  const scheduleTimeIconRef = useRef<HTMLSpanElement>(null);
  const rowMenuButtonRef = useRef<HTMLButtonElement>(null);
  const priorityMenuButtonRef = useRef<HTMLButtonElement>(null);
  const labelPillsAnchorRef = useRef<HTMLSpanElement>(null);
  const labelHoverTriggerRef = useRef<HTMLButtonElement>(null);
  const labelMenuAnchorRef = useRef<HTMLElement | null>(null);
  const [datePickerPosition, setDatePickerPosition] =
    useState<AnchoredMenuPosition | null>(null);
  const [labelMenuPosition, setLabelMenuPosition] =
    useState<AnchoredMenuPosition | null>(null);
  const [priorityMenuPosition, setPriorityMenuPosition] =
    useState<AnchoredMenuPosition | null>(null);
  const isDatePickerOpen = openDatePickerTaskId === task.id;
  const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
  const hasDueTime = normalizeDueTimeMinutes(task.dueTimeMinutes) !== null;
  const showSetDateOnHover =
    hasDueDateActions &&
    !task.isNote &&
    !hasDueTime &&
    !task.dueDate &&
    task.labels.length === 0;
  const showHoverLabelIcon =
    !isCompleting && task.labels.length === 0 && hasLabelActions;
  const showHoverPriorityIcon =
    !isCompleting && task.priority == null && hasPriorityActions;
  const showPriorityPillInActionColumn =
    !isCompleting && task.priority != null;
  const showPriorityActionSlot =
    showHoverPriorityIcon || showPriorityPillInActionColumn;
  const taskRowHoverActionSlotPx = 24;
  const taskRowHoverActionCount =
    (showSetDateOnHover ? 1 : 0) +
    (showHoverLabelIcon ? 1 : 0) +
    (showPriorityActionSlot ? 1 : 0) +
    1;
  const taskRowMetaMarginRightPx =
    task.labels.length > 0
      ? Math.max(
          showPriorityPillInActionColumn ? 54 : 20,
          taskRowHoverActionCount * taskRowHoverActionSlotPx,
        )
      : 0;
  /** Real widths of the hover action slots (icon + side margins), so previews clear them. */
  const taskRowImageMarginRightPx =
    (showSetDateOnHover ? 23 : 0) +
    (showHoverLabelIcon ? 31 : 0) +
    (showPriorityActionSlot ? 31 : 0) +
    23 +
    4;
  const taskRowTrailingReservePx =
    showPriorityPillInActionColumn &&
    task.labels.length === 0 &&
    (!task.imageSrcs || task.imageSrcs.length === 0)
      ? taskRowImageMarginRightPx
      : 0;
  const rowActionHoverVisibilityClass = hideSelectedActionsOnPanelHover
    ? "opacity-100 transition-opacity task-row-selected-quick-actions"
    : showRowHoverActions
      ? "opacity-100"
      : "opacity-0 transition-opacity group-hover:opacity-100";
  const dueScheduleSubline = formatTaskListScheduleSubline(
    task.dueDate,
    dueTimeLabel,
    dueDateLabel,
  );
  const showDueSchedule = Boolean(
    !task.isNote && (task.dueDate || dueTimeLabel !== null),
  );
  const showSubtaskCollapse =
    showSubtaskCollapseToggle &&
    depth === 0 &&
    subtaskCount > 0 &&
    Boolean(onToggleSubtasksExpanded);
  const showSublineRow = showDueSchedule || showSubtaskCollapse;
  const hasSubtasksWithoutSchedule = showSubtaskCollapse && !showDueSchedule;
  const hasRecurrence = Boolean(parseRecurrenceRule(task.recurrenceRule));
  const rowMinHeightClass =
    depth > 0
      ? showDueSchedule
        ? "min-h-[32px]"
        : "min-h-[34px]"
      : showSublineRow
        ? subtaskCount > 0
          ? "h-[44px]"
          : "min-h-[35px]"
        : subtaskCount > 0
          ? "h-[44px]"
          : "min-h-[37px]";

  function resolveTaskRowDatePickerAnchor(): HTMLElement | null {
    const dateIconAnchor = datePickerAnchorRef.current;
    const scheduleAnchor = scheduleAnchorRef.current;
    const menuAnchor = rowMenuButtonRef.current;
    const anchor = dateIconAnchor ?? scheduleAnchor ?? menuAnchor;

    if (
      anchor === scheduleAnchor &&
      scheduleTimeIconRef.current
    ) {
      return scheduleTimeIconRef.current;
    }

    return anchor;
  }

  function handleDatePickerTrigger(
    event: React.SyntheticEvent<HTMLButtonElement>,
    fromScheduleRow: boolean,
  ) {
    event.stopPropagation();

    const anchor =
      fromScheduleRow && scheduleTimeIconRef.current
        ? scheduleTimeIconRef.current
        : event.currentTarget;

    setDatePickerPosition(computeTaskDatePickerPosition(anchor));

    if (openDatePickerTaskId === task.id) {
      onToggleDatePicker(task.id);
      return;
    }

    onOpenDatePicker(task.id);
  }

  function keepDatePickerPreviewOpen() {
    onHoverOpenDatePicker?.(task.id);
  }

  function keepLabelMenuPreviewOpen() {
    onHoverOpenLabelMenu?.(task.id);
  }

  function keepPriorityMenuPreviewOpen() {
    onHoverOpenPriorityMenu?.(task.id);
  }

  useLayoutEffect(() => {
    if (!isDatePickerOpen) return;

    function updateDatePickerPosition() {
      const anchor = resolveTaskRowDatePickerAnchor();
      if (!anchor) return;

      setDatePickerPosition(computeTaskDatePickerPosition(anchor));
    }

    updateDatePickerPosition();
    window.addEventListener("resize", updateDatePickerPosition);
    window.addEventListener("scroll", updateDatePickerPosition, true);

    return () => {
      window.removeEventListener("resize", updateDatePickerPosition);
      window.removeEventListener("scroll", updateDatePickerPosition, true);
      // Drop the stale position so the next open measures fresh before animating.
      setDatePickerPosition(null);
    };
  }, [isDatePickerOpen]);

  useLayoutEffect(() => {
    if (!isLabelMenuOpen) return;

    function updateLabelMenuPosition() {
      const anchor =
        labelMenuAnchorRef.current ??
        labelPillsAnchorRef.current ??
        labelHoverTriggerRef.current;
      if (!anchor) return;

      setLabelMenuPosition(
        computeTaskLabelSelectorPosition(anchor.getBoundingClientRect()),
      );
    }

    updateLabelMenuPosition();
    window.addEventListener("resize", updateLabelMenuPosition);
    window.addEventListener("scroll", updateLabelMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateLabelMenuPosition);
      window.removeEventListener("scroll", updateLabelMenuPosition, true);
      setLabelMenuPosition(null);
    };
  }, [isLabelMenuOpen]);

  useLayoutEffect(() => {
    if (isLabelMenuOpen) return;
    labelMenuAnchorRef.current = null;
  }, [isLabelMenuOpen]);

  useLayoutEffect(() => {
    if (!isPriorityMenuOpen) return;

    function updatePriorityMenuPosition() {
      const anchor = priorityMenuButtonRef.current;
      if (!anchor) return;

      setPriorityMenuPosition(
        computeTaskPriorityMenuPosition(anchor.getBoundingClientRect(), anchor),
      );
    }

    updatePriorityMenuPosition();
    window.addEventListener("resize", updatePriorityMenuPosition);
    window.addEventListener("scroll", updatePriorityMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updatePriorityMenuPosition);
      window.removeEventListener("scroll", updatePriorityMenuPosition, true);
      setPriorityMenuPosition(null);
    };
  }, [isPriorityMenuOpen]);

  return (
    <li
      data-task-id={task.id}
      aria-current={
        task.id === (editingTaskId ?? selectedTaskId) ? "true" : undefined
      }
      aria-label={isCompleting ? `${task.name} completed` : undefined}
      onClick={isCompleting ? undefined : (event) => onTaskClick(task, event)}
      onContextMenu={
        isCompleting ? undefined : (event) => onTaskContextMenu(event, task)
      }
      onPointerDown={
        !isCompleting && showDragHandle
          ? (event) => onTaskDragStart(event, task.id)
          : undefined
      }
      className={`group ${dividerClass} flex ${rowMinHeightClass} items-center rounded-r-[3px] py-1.5 pr-2 pl-0 ${leftBorderClass} ${
      // className={`group flex min-h-[35px] items-center rounded-r-[3px] border-b border-zinc-100 py-1 pr-2 pl-[1px] dark:border-zinc-900 ${
        isCompleting
          ? showCompletionBackground
            ? "task-row-completing"
            : "task-row-completing task-row-completing-no-bg"
          : "cursor-pointer"
      } ${showDragHandle && !isCompleting ? "touch-none" : ""} ${
        isRestoredForFade ? "task-row-restore-fade-in" : ""
      } ${
        isCompleting
          ? ""
          : isListFocusRow
            ? "relative z-[1] bg-[#e9ebee]/50 shadow-[0_7px_17px_rgba(0,0,0,0.06)] hover:bg-[#e9ebee]/80"
            : suppressRowHoverChrome
              ? ""
              : "hover:bg-[#faf6ff]"
      }`}
      style={{
        paddingLeft: rowOuterPaddingLeft,
        ...(isCompleting ? completeDurationStyle : {}),
      }}
    >
      {showDragHandle && depth === 0 ? (
        <span
          className={`flex size-[19px] shrink-0 cursor-move items-center justify-center ${
            hideDueDate || suppressRowHoverChrome
              ? ""
              : "group-hover:opacity-100"
          } ${checkedContentDim}`}
          style={{ transition: dimTransition }}
        >
          <InteractIcon className="size-3.5 ptxt-task-interaction-icon" />
        </span>
      ) : null}

      <div
        className="flex min-w-0 flex-1 items-center"
        style={
          rowContentPaddingLeft > 0
            ? { paddingLeft: rowContentPaddingLeft }
            : undefined
        }
      >
      {task.isNote ? (
        <span
          className="group/note-icon relative task-list-checkbox flex size-[24px] shrink-0 items-center ptxt-500"
          aria-label="Note"
          aria-describedby={`note-icon-tooltip-${task.id}`}
        >
          <PiNoteLight
            aria-hidden="true"
            className="task-list-note-icon shrink-0 size-[21px] -ml-[1.5px]"
            style={{ transform: "scaleX(0.785)" }}
            strokeWidth={0.2}
          />
          <span
            id={`note-icon-tooltip-${task.id}`}
            role="tooltip"
            className="add-task-date-tooltip app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+10px)] z-40 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium"
          >
            Note
          </span>
        </span>
      ) : (
        <TaskCompletionCheckbox
          variant="box"
          checkKey={task.id}
          animateCheck={isCheckAnimating}
          checked={task.completed || isCheckAnimating || isCompleting}
          className={`task-list-checkbox shrink-0${
            depth > 0 ? " task-list-subtask-checkbox" : ""
          }`}
          onChange={
            isCompleting ? () => {} : () => onToggleTask(task.id)
          }
          onClick={(event) => event.stopPropagation()}
          aria-label={
            isCompleting
              ? `${task.name} completed`
              : `Mark ${task.name} complete`
          }
        />
      )}

      <div
        className={`${task.isNote ? "ml-0" : "ml-[7px]"} flex min-w-0 flex-1 flex-col justify-center ${checkedContentDim}`}
        style={{ transition: dimTransition }}
      >
        {editingTaskId === task.id ? (
          <input
            ref={titleInputRef}
            data-task-title-input
            type="text"
            value={titleDraft}
            onChange={(event) => onTitleDraftChange(task.id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => onCommitTitleEdit(task)}
            onKeyDown={(event) => onTitleKeyDown(event, task)}
            className={`min-w-0 w-full border-0 bg-transparent p-0 text-left ${taskTitleTextClass} ${titleColorClass} outline-none${
              hasSubtasksWithoutSchedule ? " relative top-[3px]" : ""
            }`}
          />
        ) : (
          <span
            data-task-truncate-measure
            className={`min-w-0 truncate text-left ${taskTitleTextClass} transition-colors ${checkedTextStyle}${
              hasSubtasksWithoutSchedule ? " relative top-[6px]" : ""
            }`}
            style={{ transitionDuration: `${CHECKED_ROW_DIM_MS}ms` }}
          >
            {task.name}
          </span>
        )}
        {showSublineRow ? (
          <div className="mt-0.5 inline-flex w-fit max-w-full self-start items-center gap-0.5">
            {showSubtaskCollapse ? (
              <>
                <button
                  type="button"
                  aria-label={
                    subtasksExpanded ? "Collapse subtasks" : "Show subtasks"
                  }
                  aria-expanded={subtasksExpanded}
                  aria-describedby={
                    subtasksExpanded
                      ? `subtask-collapse-tooltip-${task.id}`
                      : undefined
                  }
                  title={
                    subtasksExpanded ? "Collapse subtasks" : "Show subtasks"
                  }
                  className={`group/subtask-collapse relative flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 ptxt-400 outline-none transition-colors hover:ptxt-600${
                    hasSubtasksWithoutSchedule ? " top-[2px]" : ""
                  }`}
                  style={{ transition: dimTransition }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleSubtasksExpanded?.();
                  }}
                >
                  {subtasksExpanded ? (
                    <>
                      <MdKeyboardArrowDown className="size-[15px]! text-[#a4a5a8] group-hover/subtask-collapse:text-[#828285]" aria-hidden="true" />
                      <span
                        id={`subtask-collapse-tooltip-${task.id}`}
                        role="tooltip"
                        className="add-task-date-tooltip add-task-date-tooltip-sm app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+10px)] z-40 whitespace-nowrap font-medium"
                      >
                        Collapse subtasks
                      </span>
                    </>
                  ) : (
                    <RiArrowDropRightLine className="size-[21px] shrink-0 text-[#babbbd] group-hover/subtask-collapse:text-[#8c8c8e]" aria-hidden="true" />
                  )}
                </button>
                <div
                  className={`group/subtask-toggle relative${
                    hasSubtasksWithoutSchedule ? " top-[2px]" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-label={
                      subtasksExpanded ? "Collapse subtasks" : "Show subtasks"
                    }
                    aria-expanded={subtasksExpanded}
                    title="Subtasks"
                    aria-describedby={`subtask-toggle-tooltip-${task.id}`}
                    className={`flex mr-[2px] h-[18px] shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 outline-none transition-colors${
                      subtasksExpanded ? "-ml-0.5" : "-ml-[7px]!"
                    }`}
                    style={{ transition: dimTransition }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleSubtasksExpanded?.();
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      className="block size-[11px] shrink-0 text-[#afafaf] transition-colors group-hover:text-[#767679]"
                    >
                      <rect
                        x="16"
                        y="9"
                        width="4"
                        height="4"
                        rx="2"
                        transform="rotate(90 16 9)"
                        stroke="currentColor"
                      />
                      <rect
                        x="20"
                        y="17"
                        width="4"
                        height="4"
                        rx="2"
                        transform="rotate(90 20 17)"
                        stroke="currentColor"
                      />
                      <path
                        d="M5 4V15C5 16.8856 5 17.8284 5.58579 18.4142C6.17157 19 7.11438 19 9 19H16"
                        stroke="currentColor"
                      />
                      <path
                        d="M5 7V7C5 8.88562 5 9.82843 5.58579 10.4142C6.17157 11 7.11438 11 9 11H12"
                        stroke="currentColor"
                      />
                    </svg>
                  </button>
                  <span
                    id={`subtask-toggle-tooltip-${task.id}`}
                    role="tooltip"
                    className="add-task-date-tooltip app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+10px)] z-40 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium"
                  >
                    Subtasks
                  </span>
                </div>
              </>
            ) : null}
            {showDueSchedule && dueScheduleSubline ? (
              hasDueDateActions ? (
                <button
                  ref={scheduleAnchorRef}
                  type="button"
                  aria-label={`${dueScheduleSubline}. Change date`}
                  aria-haspopup="dialog"
                  aria-expanded={isDatePickerOpen}
                  title="Change date"
                  className={`group/schedule inline-flex w-fit max-w-full cursor-pointer appearance-none items-center gap-1 border-0 bg-transparent p-0 text-left text-[11px] leading-none outline-none focus:outline-none focus-visible:outline-none ${TASK_ROW_SCHEDULE_COLOR_CLASS} ${TASK_ROW_SCHEDULE_TRANSITION_CLASS}`}
                  style={{ transition: dimTransition }}
                  onMouseEnter={keepDatePickerPreviewOpen}
                  onMouseLeave={() => onScheduleCloseDatePicker?.()}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    handleDatePickerTrigger(event, true);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  data-task-date-picker-trigger
                >
                  <span
                    ref={scheduleTimeIconRef}
                    className="inline-flex shrink-0"
                  >
                    <IoMdTime
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="truncate">{dueScheduleSubline}</span>
                </button>
              ) : (
                <div
                  className={`group/schedule flex min-w-0 items-center gap-1 text-[11px] leading-none ${TASK_ROW_SCHEDULE_COLOR_CLASS} ${TASK_ROW_SCHEDULE_TRANSITION_CLASS}`}
                  style={{ transition: dimTransition }}
                >
                  <IoMdTime
                    className="size-3 shrink-0"
                    aria-hidden="true"
                  />
                  {hasRecurrence ? (
                    <BiRevision
                      className="size-3 shrink-0 opacity-70"
                      aria-label="Repeats"
                    />
                  ) : null}
                  <span className="truncate">{dueScheduleSubline}</span>
                  {hasDueTime ? (
                    <BiAlarm className="size-3 shrink-0" aria-hidden="true" />
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      {!hideDueDate ? (
      <div
        className="relative ml-auto flex min-h-[22px] shrink-0 self-center items-center justify-end gap-1.5 pl-2"
        style={
          taskRowTrailingReservePx > 0
            ? { minWidth: taskRowTrailingReservePx }
            : undefined
        }
      >
        {task.imageSrcs && task.imageSrcs.length > 0 ? (
          <TaskListImageThumbs
            srcs={task.imageSrcs}
            active={isListFocusRow}
            className={checkedContentDim}
            style={{
              transition: dimTransition,
              // Clear the absolutely positioned hover actions (date, label,
              // priority, ⋮) so they never sit on top of the previews.
              marginRight:
                task.labels.length > 0 ? undefined : taskRowImageMarginRightPx,
            }}
          />
        ) : null}

        {task.labels.length > 0 ? (
          <span
            ref={labelPillsAnchorRef}
            className={`relative z-10 flex min-w-0 max-w-[180px] items-center gap-1 ${checkedContentDim}`}
            style={{
              transition: dimTransition,
              marginRight: taskRowMetaMarginRightPx,
            }}
            onMouseEnter={
              hasLabelActions ? keepLabelMenuPreviewOpen : undefined
            }
            onMouseLeave={
              hasLabelActions
                ? () => onScheduleCloseLabelMenu?.()
                : undefined
            }
          >
            <TaskLabelPills
              labels={task.labels}
              className="min-w-0"
              onClick={
                hasLabelActions
                  ? (event) => {
                      event.stopPropagation();
                      labelMenuAnchorRef.current =
                        resolveClickedLabelPillAnchor(event);
                      onOpenLabelMenu(task.id);
                    }
                  : undefined
              }
            />
          </span>
        ) : null}

        <div className="absolute inset-y-0 -right-[5px] z-20 flex items-center pointer-events-none">
          {showSetDateOnHover ? (
            <div
              className={`group/set-date relative ${rowActionsPointerClass} ${rowActionHoverVisibilityClass}`}
              onMouseEnter={keepDatePickerPreviewOpen}
              onMouseLeave={() => onScheduleCloseDatePicker?.()}
            >
              <button
                ref={datePickerAnchorRef}
                type="button"
                data-task-date-picker-trigger
                aria-label={
                  dueDateLabel
                    ? `Due ${dueDateLabel}. Change date`
                    : "Set task date"
                }
                aria-haspopup="dialog"
                aria-expanded={openDatePickerTaskId === task.id}
                aria-describedby={`set-date-tooltip-${task.id}`}
                className="relative flex h-[19px] w-[19px] shrink-0 mr-1 items-center justify-center rounded-md text-[#bfbfcd] transition-colors cursor-pointer hover:opacity-80 dark:hover:bg-zinc-800"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  handleDatePickerTrigger(event, false);
                }}
              >
                <TaskSetDateIcon className="size-[22px]" />
                <span
                  id={`set-date-tooltip-${task.id}`}
                  role="tooltip"
                  className={`add-task-date-tooltip app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+10px)] z-40 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${
                    isDatePickerOpen ? "opacity-0" : ""
                  }`}
                >
                  Set date
                </span>
              </button>
            </div>
          ) : null}

          {isDatePickerOpen
            ? createPortal(
                <TaskRowMenuTransition
                  solid
                  innerRef={taskDateMenuRef}
                  active={datePickerPosition !== null}
                  data-task-date-picker-menu
                  className="fixed z-[100]"
                  style={{
                    top: datePickerPosition?.top,
                    bottom: datePickerPosition?.bottom,
                    left: datePickerPosition?.left ?? 0,
                    visibility: datePickerPosition ? "visible" : "hidden",
                  }}
                  onMouseEnter={keepDatePickerPreviewOpen}
                  onMouseLeave={() => onScheduleCloseDatePicker?.()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.stopPropagation();
                    onToggleDatePicker(task.id);
                  }}
                >
                  <TaskDatePicker
                    className="task-item-date-picker-popover"
                    onDateInputFocusChange={onDateInputFocusChange}
                    dueDate={task.dueDate}
                    dueTimeMinutes={task.dueTimeMinutes}
                    dueDurationMinutes={task.dueDurationMinutes}
                    dueTimeZone={task.dueTimeZone}
                    recurrenceRule={task.recurrenceRule}
                    reminderOptionId={reminderOptionId}
                    onSelectDate={(dateValue) =>
                      onSelectTaskDueDate(task.id, dateValue)
                    }
                    onSaveDueTime={(dueTime, options) =>
                      onSaveTaskDueTime(task.id, dueTime, options)
                    }
                    onSaveRecurrence={(rule) =>
                      onSaveTaskRecurrence(task.id, rule)
                    }
                    onSaveReminder={(optionId) => {
                      setReminderOptionId(optionId);
                    }}
                  />
                </TaskRowMenuTransition>,
                document.body,
              )
            : null}

          {showHoverLabelIcon ? (
            <div
              className={`group/add-label relative z-[1] ml-[2px] mr-1 flex w-[25px] shrink-0 items-center justify-center ${rowActionsPointerClass} ${rowActionHoverVisibilityClass}`}
              onMouseEnter={keepLabelMenuPreviewOpen}
              onMouseLeave={() => onScheduleCloseLabelMenu?.()}
            >
              <button
                ref={labelHoverTriggerRef}
                type="button"
                data-task-label-trigger
                aria-label="Add label"
                aria-haspopup="dialog"
                aria-expanded={isLabelMenuOpen}
                aria-describedby={`set-label-tooltip-${task.id}`}
                className="relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md cursor-pointer transition-colors hover:opacity-80 dark:hover:bg-zinc-800"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  labelMenuAnchorRef.current = event.currentTarget;
                  onOpenLabelMenu(task.id);
                }}
              >
                <LiaTagSolid className="size-[17px]! text-[#bfbfcd]! group-hover/add-label:text-zinc-450 dark:text-zinc-400" />
                <span
                  id={`set-label-tooltip-${task.id}`}
                  role="tooltip"
                  className={`add-task-date-tooltip app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+10px)] z-40 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${
                    isLabelMenuOpen ? "opacity-0" : ""
                  }`}
                >
                  Add label
                </span>
              </button>
            </div>
          ) : null}

          {showHoverPriorityIcon ? (
            <div
              className={`group/add-priority relative z-0 ml-[2px] mr-1 flex w-[25px] shrink-0 items-center justify-center ${rowActionsPointerClass} ${rowActionHoverVisibilityClass}`}
              onMouseEnter={keepPriorityMenuPreviewOpen}
              onMouseLeave={() => onScheduleClosePriorityMenu?.()}
            >
              <button
                ref={priorityMenuButtonRef}
                type="button"
                data-task-priority-trigger
                aria-label="Set priority"
                aria-haspopup="menu"
                aria-expanded={isPriorityMenuOpen}
                aria-describedby={`set-priority-tooltip-${task.id}`}
                className="relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md cursor-pointer transition-colors hover:opacity-80 dark:hover:bg-zinc-800"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePriorityMenu(task.id);
                }}
              >
                <TaskPriorityFlagIcon outline className="size-[14px] text-[#bfbfcd]!" />
                <span
                  id={`set-priority-tooltip-${task.id}`}
                  role="tooltip"
                  className={`add-task-date-tooltip app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+10px)] z-40 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${
                    isPriorityMenuOpen ? "opacity-0" : ""
                  }`}
                >
                  Priority
                </span>
              </button>
            </div>
          ) : null}

          {showPriorityPillInActionColumn ? (
            <div
              className={`relative z-[2] ml-[2px] mr-1 flex w-[25px] shrink-0 items-center justify-center ${priorityPillPointerClass}`}
              onMouseEnter={
                hasPriorityActions ? keepPriorityMenuPreviewOpen : undefined
              }
              onMouseLeave={
                hasPriorityActions
                  ? () => onScheduleClosePriorityMenu?.()
                  : undefined
              }
            >
              <TaskPriorityPill
                priority={task.priority}
                interactive={hasPriorityActions}
                menuOpen={isPriorityMenuOpen}
                buttonRef={priorityMenuButtonRef}
                onToggleMenu={() => onTogglePriorityMenu(task.id)}
              />
            </div>
          ) : null}

          <div
            className={`relative ${rowActionsPointerClass} ${rowActionHoverVisibilityClass}`}
            ref={rowMenuView ? taskContextMenuRef : null}
            onMouseEnter={() => {
              const anchor = rowMenuButtonRef.current;
              if (anchor) onHoverOpenTaskRowMenu?.(task, anchor);
            }}
            onMouseLeave={() => onScheduleCloseTaskRowMenu?.()}
          >
            <button
              ref={rowMenuButtonRef}
              type="button"
              data-task-row-menu-trigger
              aria-label={`Open menu for ${task.name}`}
              aria-haspopup="menu"
              aria-expanded={isPointerMenuOpen || rowMenuView !== null}
              title="More options"
              className="flex size-[23px] shrink-0 items-center justify-center rounded-full ptxt-400 cursor-pointer transition-colors hover:bg-zinc-200/80 hover:ptxt-500 dark:ptxt-400 dark:hover:bg-zinc-800 dark:hover:ptxt-100"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onOpenTaskRowMenu(task, event.currentTarget);
              }}
            >
              <PiDotsThreeBold className="size-4" />
            </button>

            {rowMenuView ? (
              <div className="absolute right-0 top-full z-30 mt-1">
                <TaskRowContextMenu
                  task={task}
                  view={rowMenuView}
                  lists={lists}
                  currentListId={currentListId ?? task.listId ?? null}
                  moveQuery={moveQuery}
                  availableLabels={availableLabels}
                  assignedLabelIds={assignedLabelIds}
                  labelQuery={labelQuery}
                  isLabelSubmitting={isLabelSubmitting}
                  onMoveQueryChange={onMoveQueryChange}
                  onLabelQueryChange={onLabelQueryChange}
                  onToggleLabelSelection={onToggleLabel}
                  onCreateLabel={onCreateLabel}
                  onClose={onCloseTaskMenu}
                  onToggleTaskImportant={() => onToggleTaskImportant(task)}
                  onOpenLabelMenu={() => onOpenLabelMenu(task.id)}
                  onOpenMoveMenu={() => onOpenMoveMenu(task.id)}
                  onMoveTaskToList={(targetListId) =>
                    onMoveTaskToList(task.id, targetListId)
                  }
                  onSetTaskDueDate={(dateValue) =>
                    onSetTaskDueDateFromMenu(task.id, dateValue)
                  }
                  onClearTaskDueDate={() =>
                    onClearTaskDueDateFromMenu(task.id)
                  }
                  onOpenCustomDatePicker={() => onOpenCustomDatePicker(task.id)}
                  onSelectTaskPriority={(priority) =>
                    onSelectTaskPriority(task.id, priority)
                  }
                  onClearTaskPriority={() => onClearTaskPriority(task.id)}
                  onConvertTaskToNote={() => {
                    onConvertTaskToNote(task.id);
                    onCloseTaskMenu();
                  }}
                  onAddSubtask={() => {
                    onAddSubtask(task.id);
                    onCloseTaskMenu();
                  }}
                  onDuplicateTask={() => {
                    onDuplicateTask(task.id);
                    onCloseTaskMenu();
                  }}
                  onDeleteTask={() => {
                    onDeleteTask(task.id);
                    onCloseTaskMenu();
                  }}
                  hasDueDateActions={hasDueDateActions}
                  hasPriorityActions={hasPriorityActions}
                  hasNoteActions={hasNoteActions}
                  hasImportantActions={hasImportantActions}
                  hasLabelActions={hasLabelActions}
                  hasMoveActions={hasMoveActions}
                  hasSubtaskActions={hasSubtaskActions}
                  hasDuplicateActions={hasDuplicateActions}
                  hasDeleteActions={hasDeleteActions}
                />
              </div>
            ) : null}
          </div>
        </div>

        {isLabelMenuOpen && labelMenuPosition
          ? createPortal(
              <TaskRowMenuTransition
                solid
                innerRef={taskLabelMenuRef}
                className="fixed z-50"
                style={{
                  top: labelMenuPosition.top,
                  bottom: labelMenuPosition.bottom,
                  left: labelMenuPosition.left,
                }}
                onMouseEnter={keepLabelMenuPreviewOpen}
                onMouseLeave={() => onScheduleCloseLabelMenu?.()}
              >
                <TaskLabelSelector
                  surface="solid"
                  labels={availableLabels}
                  assignedLabelIds={assignedLabelIds}
                  query={labelQuery}
                  isSubmitting={isLabelSubmitting}
                  onQueryChange={onLabelQueryChange}
                  onToggleLabel={onToggleLabel}
                  onCreateLabel={onCreateLabel}
                  onCancel={onCloseTaskMenu}
                />
              </TaskRowMenuTransition>,
              document.body,
            )
          : null}

        {isPriorityMenuOpen && priorityMenuPosition
          ? createPortal(
              <TaskRowMenuTransition
                innerRef={taskPriorityMenuRef}
                data-task-priority-menu
                className="fixed z-50"
                style={{
                  top: priorityMenuPosition.top,
                  bottom: priorityMenuPosition.bottom,
                  left: priorityMenuPosition.left,
                }}
                onMouseEnter={keepPriorityMenuPreviewOpen}
                onMouseLeave={() => onScheduleClosePriorityMenu?.()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <TaskPriorityMenu
                  selectedPriority={task.priority}
                  onSelectPriority={(priority) =>
                    onSelectTaskPriority(task.id, priority)
                  }
                  onClearPriority={() => onClearTaskPriority(task.id)}
                />
              </TaskRowMenuTransition>,
              document.body,
            )
          : null}
      </div>
      ) : null}
      </div>
    </li>
  );
}
