"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
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
  computeTaskDatePickerMenuPosition,
} from "./task-date-picker";
import type { TaskReminderOptionId } from "@/lib/task-reminder";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import { TaskLabelSelector, type Label } from "./task-label-selector";
import { TaskLabelPills } from "./task-label-pills";
import { TaskPriorityMenu } from "./task-priority-menu";
import { TaskPriorityPill } from "./task-priority-pill";
import { PiDotsThreeBold } from "react-icons/pi";
import { CiStickyNote } from "react-icons/ci";
import { BiAlarm, BiCalendar, BiRevision } from "react-icons/bi";
import { IoMdTime } from "react-icons/io";
import { MdKeyboardArrowDown } from "react-icons/md";
import { RiArrowDropRightLine } from "react-icons/ri";
import { TaskListSubtaskIcon } from "./task-list-subtask-icon";
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

const TASK_LABEL_SELECTOR_WIDTH = 280;
const TASK_LABEL_SELECTOR_GAP = 4;
const TASK_LABEL_SELECTOR_MAX_HEIGHT = 360;
const TASK_PRIORITY_MENU_WIDTH = 196;
const TASK_PRIORITY_MENU_HEIGHT = 72;
const TASK_PRIORITY_MENU_GAP = 4;

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

function computeTaskDatePickerPosition(
  anchor: HTMLElement,
  preferScheduleAlignment: boolean,
) {
  return computeTaskDatePickerMenuPosition(anchor, {
    align: preferScheduleAlignment ? "left" : "right",
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
  onSelectTaskDueDate,
  onSaveTaskDueTime,
  onSaveTaskRecurrence,
  onOpenTaskRowMenu,
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
  const rowActionsPointerClass = isRowMenuOpen
    ? "pointer-events-auto"
    : "pointer-events-none group-hover:pointer-events-auto";

  const basePaddingLeft = useWiderRowPadding ? 1 : 0;
  const rowOuterPaddingLeft = depth * SUBTASK_INDENT_PX;
  const rowContentPaddingLeft = basePaddingLeft;
  const isSelected = task.id === selectedTaskId;
  const leftBorderClass = getTaskRowLeftBorderClass(task.id, selectedTaskId);
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
  const rowMenuButtonRef = useRef<HTMLButtonElement>(null);
  const priorityMenuButtonRef = useRef<HTMLButtonElement>(null);
  const labelMenuAnchorRef = useRef<HTMLDivElement>(null);
  const [datePickerPosition, setDatePickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [labelMenuPosition, setLabelMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [priorityMenuPosition, setPriorityMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const isDatePickerOpen = openDatePickerTaskId === task.id;
  const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
  const hasDueTime = normalizeDueTimeMinutes(task.dueTimeMinutes) !== null;
  const showSetDateOnHover =
    hasDueDateActions &&
    !task.isNote &&
    !hasDueTime &&
    !task.dueDate &&
    task.labels.length === 0 &&
    task.priority == null;
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

  function handleDatePickerTrigger(
    event: React.SyntheticEvent<HTMLButtonElement>,
    preferScheduleAlignment: boolean,
  ) {
    event.stopPropagation();

    const anchor = event.currentTarget;

    setDatePickerPosition(
      computeTaskDatePickerPosition(anchor, preferScheduleAlignment),
    );

    if (openDatePickerTaskId === task.id) {
      onToggleDatePicker(task.id);
      return;
    }

    onOpenDatePicker(task.id);
  }

  useLayoutEffect(() => {
    if (!isDatePickerOpen) return;

    function updateDatePickerPosition() {
      const dateIconAnchor = datePickerAnchorRef.current;
      const scheduleAnchor = scheduleAnchorRef.current;
      const menuAnchor = rowMenuButtonRef.current;
      const anchor = dateIconAnchor ?? scheduleAnchor ?? menuAnchor;
      if (!anchor) return;

      setDatePickerPosition(
        computeTaskDatePickerPosition(anchor, anchor === scheduleAnchor),
      );
    }

    updateDatePickerPosition();
    window.addEventListener("resize", updateDatePickerPosition);
    window.addEventListener("scroll", updateDatePickerPosition, true);

    return () => {
      window.removeEventListener("resize", updateDatePickerPosition);
      window.removeEventListener("scroll", updateDatePickerPosition, true);
    };
  }, [isDatePickerOpen]);

  useLayoutEffect(() => {
    if (!isLabelMenuOpen) return;

    function updateLabelMenuPosition() {
      const anchor = labelMenuAnchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 8;
      let left = rect.right + TASK_LABEL_SELECTOR_GAP;
      let top = rect.top;

      if (
        left + TASK_LABEL_SELECTOR_WIDTH >
        window.innerWidth - viewportPadding
      ) {
        left = rect.left - TASK_LABEL_SELECTOR_WIDTH - TASK_LABEL_SELECTOR_GAP;
      }

      left = Math.max(
        viewportPadding,
        Math.min(
          left,
          window.innerWidth - TASK_LABEL_SELECTOR_WIDTH - viewportPadding,
        ),
      );
      top = Math.max(
        viewportPadding,
        Math.min(
          top,
          window.innerHeight - TASK_LABEL_SELECTOR_MAX_HEIGHT - viewportPadding,
        ),
      );

      setLabelMenuPosition({ top, left });
    }

    updateLabelMenuPosition();
    window.addEventListener("resize", updateLabelMenuPosition);
    window.addEventListener("scroll", updateLabelMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateLabelMenuPosition);
      window.removeEventListener("scroll", updateLabelMenuPosition, true);
    };
  }, [isLabelMenuOpen]);

  useLayoutEffect(() => {
    if (!isPriorityMenuOpen) return;

    function updatePriorityMenuPosition() {
      const anchor = priorityMenuButtonRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 8;
      let left = rect.left + rect.width / 2 - TASK_PRIORITY_MENU_WIDTH / 2;
      left = Math.max(
        viewportPadding,
        Math.min(
          left,
          window.innerWidth - TASK_PRIORITY_MENU_WIDTH - viewportPadding,
        ),
      );

      let top = rect.bottom + TASK_PRIORITY_MENU_GAP;
      top = Math.max(
        viewportPadding,
        Math.min(
          top,
          window.innerHeight - TASK_PRIORITY_MENU_HEIGHT - viewportPadding,
        ),
      );

      setPriorityMenuPosition({ top, left });
    }

    updatePriorityMenuPosition();
    window.addEventListener("resize", updatePriorityMenuPosition);
    window.addEventListener("scroll", updatePriorityMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updatePriorityMenuPosition);
      window.removeEventListener("scroll", updatePriorityMenuPosition, true);
    };
  }, [isPriorityMenuOpen]);

  return (
    <li
      data-task-id={task.id}
      aria-current={task.id === selectedTaskId ? "true" : undefined}
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
        isCompleting
          ? ""
          : isSelected
            ? "bg-[#e9ebee]/50 hover:bg-[#e9ebee]/80"
            : "hover:bg-[#faf6ff]"
      }`}
      style={{
        paddingLeft: rowOuterPaddingLeft,
        ...(isCompleting ? completeDurationStyle : {}),
      }}
    >
      {showDragHandle && depth === 0 ? (
        <span
          aria-hidden="true"
          className={`flex size-[19px] shrink-0 cursor-move items-center justify-center ${
            hideDueDate ? "" : "group-hover:opacity-100"
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
          <CiStickyNote
            aria-hidden="true"
            className="shrink-0 size-[20px] -ml-[1.5px] text-[#818188]"
            // className="shrink-0 size-[20px] -ml-[1.5px] text-[#8d8d9c]"
            style={{ transform: "scaleX(0.785)" }}
            // strokeWidth={0.01}
          />
          <span
            id={`note-icon-tooltip-${task.id}`}
            role="tooltip"
            className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/note-icon:opacity-100"
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
                        className="add-task-date-tooltip add-task-date-tooltip-sm pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap font-medium opacity-0 transition-opacity group-hover/subtask-collapse:opacity-100"
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
                      subtasksExpanded ? "-ml-0.5" : "-ml-[9px]!"
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
                    <TaskListSubtaskIcon className="size-[13px] shrink-0 text-[#afafaf] transition-colors group-hover:text-[#767679]" />
                  </button>
                  <span
                    id={`subtask-toggle-tooltip-${task.id}`}
                    role="tooltip"
                    className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/subtask-toggle:opacity-100"
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
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    handleDatePickerTrigger(event, true);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  data-task-date-picker-trigger
                >
                  <IoMdTime
                    className="size-3 shrink-0"
                    aria-hidden="true"
                  />
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
        ref={labelMenuAnchorRef}
        className="relative ml-auto flex min-h-[19px] shrink-0 self-center items-center justify-end gap-1.5 pl-2"
      >
        {task.labels.length > 0 || task.priority != null ? (
          <span
            className={`relative z-10 flex min-w-0 max-w-[180px] -translate-x-[20px] items-center gap-1 ${checkedContentDim}`}
            style={{ transition: dimTransition }}
          >
            {task.labels.length > 0 ? (
              <TaskLabelPills
                labels={task.labels}
                className="min-w-0"
                onClick={
                  hasLabelActions
                    ? (event) => {
                        event.stopPropagation();
                        onOpenLabelMenu(task.id);
                      }
                    : undefined
                }
              />
            ) : null}
            <TaskPriorityPill
              priority={task.priority}
              interactive={hasPriorityActions}
              menuOpen={isPriorityMenuOpen}
              buttonRef={priorityMenuButtonRef}
              onToggleMenu={() => onTogglePriorityMenu(task.id)}
            />
          </span>
        ) : null}

        <div
          className={`absolute inset-y-0 -right-[5px] z-20 flex items-center pointer-events-none transition-opacity ${
            isRowMenuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {showSetDateOnHover ? (
            <div className={`group/set-date relative ${rowActionsPointerClass}`}>
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
                className="flex h-[19px] w-[19px] shrink-0 mr-1 items-center justify-center rounded-md ptxt-task-datetime transition-colors cursor-pointer hover:opacity-80 dark:hover:bg-zinc-800"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  handleDatePickerTrigger(event, false);
                }}
              >
                <TaskSetDateIcon className="size-[22px]" />
              </button>
              <span
                id={`set-date-tooltip-${task.id}`}
                role="tooltip"
                className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/set-date:opacity-100"
              >
                Set date
              </span>
            </div>
          ) : null}

          {isDatePickerOpen
            ? createPortal(
                <div
                  ref={taskDateMenuRef}
                  data-task-date-picker-menu
                  className="fixed z-[100]"
                  style={{
                    top: datePickerPosition?.top ?? 0,
                    left: datePickerPosition?.left ?? 0,
                    visibility: datePickerPosition ? "visible" : "hidden",
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.stopPropagation();
                    onToggleDatePicker(task.id);
                  }}
                >
                  <TaskDatePicker
                    className="task-item-date-picker-popover"
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
                </div>,
                document.body,
              )
            : null}

          <div
            className={`relative ${rowActionsPointerClass}`}
            ref={rowMenuView ? taskContextMenuRef : null}
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
              <div
                ref={taskLabelMenuRef}
                className="fixed z-50"
                style={{
                  top: labelMenuPosition.top,
                  left: labelMenuPosition.left,
                }}
              >
                <TaskLabelSelector
                  labels={availableLabels}
                  assignedLabelIds={assignedLabelIds}
                  query={labelQuery}
                  isSubmitting={isLabelSubmitting}
                  onQueryChange={onLabelQueryChange}
                  onToggleLabel={onToggleLabel}
                  onCreateLabel={onCreateLabel}
                  onCancel={onCloseTaskMenu}
                />
              </div>,
              document.body,
            )
          : null}

        {isPriorityMenuOpen && priorityMenuPosition
          ? createPortal(
              <div
                ref={taskPriorityMenuRef}
                data-task-priority-menu
                className="fixed z-50"
                style={{
                  top: priorityMenuPosition.top,
                  left: priorityMenuPosition.left,
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <TaskPriorityMenu
                  selectedPriority={task.priority}
                  onSelectPriority={(priority) =>
                    onSelectTaskPriority(task.id, priority)
                  }
                  onClearPriority={() => onClearTaskPriority(task.id)}
                />
              </div>,
              document.body,
            )
          : null}
      </div>
      ) : null}
      </div>
    </li>
  );
}
