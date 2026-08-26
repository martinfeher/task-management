"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { InteractIcon } from "./line-control-icons";
import { TaskSetDateIcon } from "./task-set-date-icon";
import {
  CHECKED_ROW_DIM_MS,
  getCompletionAnimationMs,
  TASK_COMPLETE_ANIMATION_MS,
  TaskCompletionCheckbox,
} from "./task-completion-checkbox";
import { TaskDatePicker, TASK_DATE_PICKER_WIDTH } from "./task-date-picker";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import { TaskLabelSelector, type Label } from "./task-label-selector";
import { TaskLabelPills } from "./task-label-pills";
import { TaskPriorityMenu } from "./task-priority-menu";
import { TaskPriorityPill } from "./task-priority-pill";
import { PiDotsThreeBold } from "react-icons/pi";
import { BiAlarm, BiCalendar, BiRevision } from "react-icons/bi";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import { parseRecurrenceRule } from "@/lib/task-recurrence";
import {
  formatDueTimeLabel,
  normalizeDueTimeMinutes,
} from "@/lib/task-due-time";
import { SUBTASK_INDENT_PX, SUBTASK_ICON_INDENT_PX } from "@/lib/task-subtasks";
import { isDueDateToday } from "@/lib/task-due-date";

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
  titleInputRef: RefObject<HTMLInputElement | null>;
  showDragHandle: boolean;
  openDatePickerTaskId: string | null;
  openMenuTaskId: string | null;
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
  onTaskClick: (task: TaskListItem) => void;
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
  onSaveTaskDueTime: (taskId: string, dueTime: TaskDueTime) => void;
  onSaveTaskRecurrence: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => void;
  onToggleTaskMenu: (taskId: string) => void;
  onTogglePriorityMenu: (taskId: string) => void;
  onToggleTaskPinned: (task: TaskListItem) => void;
  onToggleTaskImportant: (task: TaskListItem) => void;
  onOpenLabelMenu: (taskId: string) => void;
  onOpenMoveMenu: (taskId: string) => void;
  onMoveQueryChange: (value: string) => void;
  onMoveTaskToList: (taskId: string, targetListId: string) => void;
  onLabelQueryChange: (value: string) => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (label: string, color: string) => void;
  onSetTaskDueDateFromMenu: (taskId: string, dateValue: string) => void;
  onOpenCustomDatePicker: (taskId: string) => void;
  onSelectTaskPriority: (taskId: string, priority: number) => void;
  onClearTaskPriority: (taskId: string) => void;
  onCloseTaskMenu: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasPinActions: boolean;
  hasImportantActions: boolean;
  hasLabelActions: boolean;
  hasMoveActions: boolean;
  useWiderRowPadding?: boolean;
};

const TASK_DATE_PICKER_GAP = 4;
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
  "text-[#98979c] group-hover:text-[#79787c]";
const TASK_ROW_SCHEDULE_TRANSITION_CLASS =
  "transition-colors duration-200 ease-in-out";

function formatTaskDueWeekdayLabel(dueDate: string) {
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
}

function formatTaskListScheduleSubline(
  dueDate: string | null,
  dueTimeLabel: string | null,
  dueDateLabel: string | null,
) {
  if (dueTimeLabel) {
    if (!dueDate || isDueDateToday(dueDate)) {
      return dueTimeLabel;
    }

    const weekdayLabel = formatTaskDueWeekdayLabel(dueDate);
    return weekdayLabel ? `${weekdayLabel} ${dueTimeLabel}` : dueTimeLabel;
  }

  return dueDateLabel;
}

export function getTaskRowLeftBorderClass(
  taskId: string,
  selectedTaskId: string | null,
) {
  if (taskId === selectedTaskId) {
    return `${TASK_ROW_LEFT_BORDER_WIDTH_CLASS} ${TASK_ROW_LEFT_BORDER_COLOR_CLASS}`;
  }

  return "border-l-0 hover:shadow-[inset_2px_0_0_#DADFDF]";
}

function getRowMenuView(
  taskId: string,
  openMenuTaskId: string | null,
  openMoveMenuTaskId: string | null,
): TaskRowContextMenuView | null {
  if (openMoveMenuTaskId === taskId) return "moveTo";
  if (openMenuTaskId === taskId) return "main";
  return null;
}

function computeTaskDatePickerPosition(
  anchor: HTMLElement,
  preferScheduleAlignment: boolean,
) {
  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 8;
  let left = preferScheduleAlignment
    ? rect.left
    : rect.right - TASK_DATE_PICKER_WIDTH;
  left = Math.max(
    viewportPadding,
    Math.min(
      left,
      window.innerWidth - TASK_DATE_PICKER_WIDTH - viewportPadding,
    ),
  );

  return {
    top: rect.bottom + TASK_DATE_PICKER_GAP,
    left,
  };
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
  titleInputRef,
  showDragHandle,
  openDatePickerTaskId,
  openMenuTaskId,
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
  onToggleTaskMenu,
  onTogglePriorityMenu,
  onToggleTaskPinned,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveQueryChange,
  onMoveTaskToList,
  onLabelQueryChange,
  onToggleLabel,
  onCreateLabel,
  onSetTaskDueDateFromMenu,
  onOpenCustomDatePicker,
  onSelectTaskPriority,
  onClearTaskPriority,
  onCloseTaskMenu,
  hasDueDateActions,
  hasPriorityActions,
  hasPinActions,
  hasImportantActions,
  hasLabelActions,
  hasMoveActions,
  useWiderRowPadding = false,
}: TaskListTaskRowProps) {
  const rowMenuView = getRowMenuView(
    task.id,
    openMenuTaskId,
    openMoveMenuTaskId,
  );
  const isLabelMenuOpen = openLabelMenuTaskId === task.id;
  const isPriorityMenuOpen = openPriorityMenuTaskId === task.id;
  const isRowMenuOpen =
    !isCompleting &&
    (openDatePickerTaskId === task.id ||
      isLabelMenuOpen ||
      isPriorityMenuOpen ||
      rowMenuView !== null);

  const basePaddingLeft = useWiderRowPadding ? 22 : 0;
  const rowPaddingLeft = basePaddingLeft + depth * SUBTASK_INDENT_PX;
  const isSelected = task.id === selectedTaskId;
  const leftBorderClass = getTaskRowLeftBorderClass(task.id, selectedTaskId);
  const hideDueDate = isCheckAnimating || isCompleting;
  const checkedContentDim = hideDueDate ? "opacity-50" : "opacity-100";
  const checkedTextStyle = hideDueDate
    ? "text-zinc-400 dark:text-zinc-500"
    : "text-zinc-700 dark:text-zinc-50";
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
    !hasDueTime &&
    !task.dueDate &&
    task.labels.length === 0;
  const dueScheduleSubline = formatTaskListScheduleSubline(
    task.dueDate,
    dueTimeLabel,
    dueDateLabel,
  );
  const showDueSchedule = Boolean(
    task.dueDate || dueTimeLabel !== null,
  );
  const hasRecurrence = Boolean(parseRecurrenceRule(task.recurrenceRule));

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

  useEffect(() => {
    if (!isDatePickerOpen) return;

    requestAnimationFrame(() => {
      const dateInput = taskDateMenuRef.current?.querySelector("input");
      if (dateInput instanceof HTMLInputElement) {
        dateInput.focus();
      }
    });
  }, [isDatePickerOpen, task.id, taskDateMenuRef]);

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
      onClick={isCompleting ? undefined : () => onTaskClick(task)}
      onContextMenu={
        isCompleting ? undefined : (event) => onTaskContextMenu(event, task)
      }
      onPointerDown={
        !isCompleting && showDragHandle
          ? (event) => onTaskDragStart(event, task.id)
          : undefined
      }
      className={`group flex min-h-[35px] items-center rounded-r-[3px] border-b border-zinc-100 py-1.5 pr-2 pl-0 dark:border-zinc-900 ${leftBorderClass} ${
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
        paddingLeft: rowPaddingLeft,
        ...(isCompleting ? completeDurationStyle : {}),
      }}
    >
      {showDragHandle ? (
        <span
          aria-hidden="true"
          className={`flex size-[19px] mr-[1px] shrink-0 cursor-move items-center justify-center ${
            hideDueDate ? "" : "group-hover:opacity-100"
          } ${checkedContentDim}`}
          style={{ transition: dimTransition }}
        >
          <InteractIcon className="size-3.5 text-[#c3c6cc] group-hover:text-[#7e828b]" />
        </span>
      ) : null}

      <TaskCompletionCheckbox
        variant="box"
        checkKey={task.id}
        animateCheck={isCheckAnimating}
        checked={task.completed || isCheckAnimating || isCompleting}
        className="task-list-checkbox shrink-0"
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

      <div
        className={`ml-[6px] flex min-w-0 flex-1 flex-col justify-center ${checkedContentDim}`}
        style={{ transition: dimTransition }}
      >
        {editingTaskId === task.id ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleDraft}
            onChange={(event) => onTitleDraftChange(task.id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => onCommitTitleEdit(task)}
            onKeyDown={(event) => onTitleKeyDown(event, task)}
            className="min-w-0 w-full border-0 bg-transparent p-0 text-left text-sm leading-[19px] text-zinc-900 outline-none dark:text-zinc-50"
          />
        ) : (
          <span
            data-task-truncate-measure
            className={`min-w-0 truncate text-left text-sm leading-[19px] transition-colors ${checkedTextStyle}`}
            style={{ transitionDuration: `${CHECKED_ROW_DIM_MS}ms` }}
          >
            {task.name}
          </span>
        )}
        {showDueSchedule && dueScheduleSubline ? (
          hasDueDateActions ? (
            <button
              ref={scheduleAnchorRef}
              type="button"
              aria-label={`${dueScheduleSubline}. Change date`}
              aria-haspopup="dialog"
              aria-expanded={isDatePickerOpen}
              title="Change date"
              className={`group/schedule mt-0.5 inline-flex w-fit max-w-full self-start cursor-pointer appearance-none items-center gap-1 border-0 bg-transparent p-0 text-left text-[11px] leading-none outline-none focus:outline-none focus-visible:outline-none ${TASK_ROW_SCHEDULE_COLOR_CLASS} ${TASK_ROW_SCHEDULE_TRANSITION_CLASS}`}
              style={{ transition: dimTransition }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                handleDatePickerTrigger(event, true);
              }}
              onClick={(event) => event.stopPropagation()}
              data-task-date-picker-trigger
            >
              <BiCalendar
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
            </button>
          ) : (
            <div
              className={`group/schedule mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-none ${TASK_ROW_SCHEDULE_COLOR_CLASS} ${TASK_ROW_SCHEDULE_TRANSITION_CLASS}`}
              style={{ transition: dimTransition }}
            >
              <BiCalendar
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
          className={`absolute inset-y-0 -right-[5px] z-20 flex items-center transition-opacity ${
            isRowMenuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
          }`}
        >
          {showSetDateOnHover ? (
            <div className="group/set-date relative">
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
                className={`flex h-[19px] w-[19px] shrink-0 mr-1 items-center justify-center rounded-md text-zinc-400 transition-colors cursor-pointer hover:text-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                  task.dueDate ? "text-zinc-400 dark:text-zinc-300" : ""
                }`}
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
                  className="fixed z-[100]"
                  style={{
                    top: datePickerPosition?.top ?? 0,
                    left: datePickerPosition?.left ?? 0,
                    visibility: datePickerPosition ? "visible" : "hidden",
                  }}
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
                    onSelectDate={(dateValue) =>
                      onSelectTaskDueDate(task.id, dateValue)
                    }
                    onSaveDueTime={(dueTime) =>
                      onSaveTaskDueTime(task.id, dueTime)
                    }
                    onSaveRecurrence={(rule) =>
                      onSaveTaskRecurrence(task.id, rule)
                    }
                  />
                </div>,
                document.body,
              )
            : null}

          <div
            className="relative"
            ref={rowMenuView ? taskContextMenuRef : null}
          >
            <button
              ref={rowMenuButtonRef}
              type="button"
              aria-label={`Open menu for ${task.name}`}
              aria-haspopup="menu"
              aria-expanded={rowMenuView !== null}
              title="More options"
              className="flex size-[23px] shrink-0 items-center justify-center rounded-full text-zinc-400 cursor-pointer transition-colors hover:bg-zinc-200/80 hover:text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={(event) => {
                event.stopPropagation();
                onToggleTaskMenu(task.id);
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
                  onToggleTaskPinned={() => onToggleTaskPinned(task)}
                  onToggleTaskImportant={() => onToggleTaskImportant(task)}
                  onOpenLabelMenu={() => onOpenLabelMenu(task.id)}
                  onOpenMoveMenu={() => onOpenMoveMenu(task.id)}
                  onMoveTaskToList={(targetListId) =>
                    onMoveTaskToList(task.id, targetListId)
                  }
                  onSetTaskDueDate={(dateValue) =>
                    onSetTaskDueDateFromMenu(task.id, dateValue)
                  }
                  onOpenCustomDatePicker={() => onOpenCustomDatePicker(task.id)}
                  onSelectTaskPriority={(priority) =>
                    onSelectTaskPriority(task.id, priority)
                  }
                  onClearTaskPriority={() => onClearTaskPriority(task.id)}
                  hasDueDateActions={hasDueDateActions}
                  hasPriorityActions={hasPriorityActions}
                  hasPinActions={hasPinActions}
                  hasImportantActions={hasImportantActions}
                  hasLabelActions={hasLabelActions}
                  hasMoveActions={hasMoveActions}
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
                className="fixed z-50"
                style={{
                  top: priorityMenuPosition.top,
                  left: priorityMenuPosition.left,
                }}
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
    </li>
  );
}
