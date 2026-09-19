"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { BiAlarm, BiRevision } from "react-icons/bi";
import { IoMdTime } from "react-icons/io";
import { LuList, LuPlus, LuX } from "react-icons/lu";
import { PiDotsThreeBold } from "react-icons/pi";
import type { KanbanColumnRecord } from "@/app/actions/kanban";
import { createLabel, getLabels } from "@/app/actions/todo";
import { getLabelDotColor } from "@/lib/label-colors";
import { getListColor } from "@/lib/list-colors";
import {
  formatTaskDueDateLabel,
  formatTaskListScheduleSubline,
} from "@/lib/task-due-date";
import {
  formatDueTimeLabel,
  normalizeDueTimeMinutes,
  type TaskDueTime,
} from "@/lib/task-due-time";
import { parseRecurrenceRule, type TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  createKanbanTaskDragGhost,
  KANBAN_DRAG_THRESHOLD_PX,
  KANBAN_DROP_INDICATOR_COLOR,
  KANBAN_TASK_DRAG_SOURCE_CLASS,
  resolveKanbanDropTarget,
  shouldStartKanbanTaskDrag,
  tryReleasePointerCapture,
  trySetPointerCapture,
  updateKanbanTaskDragGhostPosition,
} from "./kanban-task-drag";
import { ConfirmModal } from "./confirm-modal";
import { TaskDatePicker, TASK_DATE_PICKER_WIDTH } from "./task-date-picker";
import type { Label } from "./task-label-selector";
import {
  CHECKED_ROW_DIM_MS,
  getCompletionAnimationMs,
  TASK_COMPLETE_ANIMATION_MS,
  TaskCompletionCheckbox,
} from "./task-completion-checkbox";
import { TaskPriorityPill } from "./task-priority-pill";
import { TaskRowContextMenu } from "./task-row-context-menu";
import type { TaskLabel, TaskListItem, TodoList } from "./todo-app";

const NOT_ASSIGNED_COLUMN_NAME = "Not assigned";
const TASK_ROW_CONTEXT_MENU_WIDTH = 220;
const TASK_ROW_CONTEXT_MENU_HEIGHT = 420;
const TASK_DATE_PICKER_HEIGHT = 400;
const KANBAN_TASK_SCHEDULE_COLOR_CLASS = "ptxt-task-datetime";
const KANBAN_COLUMN_SURFACE_CLASS =
  "shadow-[0_1px_3px_rgba(15,23,42,0.06),0_2px_10px_rgba(15,23,42,0.08)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.22),0_6px_20px_rgba(0,0,0,0.3)]";

function KanbanTaskLabelDots({
  labels,
  className = "",
  onOpenLabels,
}: {
  labels: TaskLabel[];
  className?: string;
  onOpenLabels?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  if (labels.length === 0) return null;

  return (
    <button
      type="button"
      data-kanban-task-label-trigger
      aria-label="Edit labels"
      aria-haspopup="dialog"
      onClick={(event) => {
        event.stopPropagation();
        onOpenLabels?.(event);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
      }}
      className={`absolute bottom-1.5 right-2 flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${className}`}
    >
      {labels.map((label) => (
        <span
          key={label.id}
          className="group/kanban-label-dot relative"
        >
          <span
            className="block size-[7px] rounded-full"
            style={{ backgroundColor: getLabelDotColor(label) }}
            aria-hidden="true"
          />
          <span
            role="tooltip"
            className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+6px)] right-0 left-auto z-50 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/kanban-label-dot:opacity-100 task-context-menu-tooltip-end"
          >
            {label.label}
          </span>
        </span>
      ))}
    </button>
  );
}

function getKanbanTaskSchedule(task: TaskListItem) {
  const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
  const dueDateLabel = formatTaskDueDateLabel(task.dueDate);
  const dueScheduleSubline = formatTaskListScheduleSubline(
    task.dueDate,
    dueTimeLabel,
    dueDateLabel,
  );
  const showDueSchedule = Boolean(
    !task.isNote && (task.dueDate || dueTimeLabel !== null),
  );

  return {
    dueScheduleSubline,
    showDueSchedule,
    hasDueTime: normalizeDueTimeMinutes(task.dueTimeMinutes) !== null,
    hasRecurrence: Boolean(parseRecurrenceRule(task.recurrenceRule)),
  };
}

function clampPointerContextMenuPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }

  return {
    x: Math.min(
      Math.max(8, x),
      window.innerWidth - TASK_ROW_CONTEXT_MENU_WIDTH - 8,
    ),
    y: Math.min(
      Math.max(8, y),
      window.innerHeight - TASK_ROW_CONTEXT_MENU_HEIGHT - 8,
    ),
  };
}

function computeKanbanTaskMenuAnchorPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  return clampPointerContextMenuPosition(
    rect.right - TASK_ROW_CONTEXT_MENU_WIDTH,
    rect.bottom + 4,
  );
}

type KanbanTaskContextMenuState = {
  task: TaskListItem;
  x: number;
  y: number;
  view: "main" | "label";
};

type KanbanDatePickerState = {
  task: TaskListItem;
  x: number;
  y: number;
};

type ListKanbanPanelProps = {
  list: TodoList;
  lists: TodoList[];
  columns: KanbanColumnRecord[];
  tasks: TaskListItem[];
  completingTaskIds?: Set<string>;
  completingWithoutBackgroundTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  onToggleTask: (taskId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskRecurrence?: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => void | Promise<void>;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onToggleTaskLabel?: (
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) => Promise<Label[]>;
  onLabelsChanged?: () => void;
  onDuplicateTask?: (taskId: string) => Promise<void> | void;
  onDeleteTask?: (taskId: string) => Promise<void> | void;
  onAddColumn: (name: string) => Promise<void> | void;
  onAddTask: (columnId: string, name: string) => Promise<void> | void;
  onMoveTask: (
    taskId: string,
    targetColumnId: string,
    targetIndex: number,
  ) => Promise<void> | void;
  onRemoveColumn: (columnId: string) => Promise<void> | void;
  onRenameColumn?: (columnId: string, name: string) => Promise<void> | void;
  showSidebarMenu?: boolean;
  onOpenSidebar?: () => void;
};

type ColumnAddTaskState = {
  columnId: string;
  value: string;
};

type KanbanDragState = {
  sourceRow: HTMLElement;
  captureTarget: HTMLElement;
  sourceTaskId: string;
  sourceColumnId: string;
  sourceIndex: number;
  dropColumnId: string;
  dropIndex: number;
  pointerId: number;
  lastPointerX: number;
  lastPointerY: number;
  dragGhost: HTMLElement | null;
  ghostPointerOffsetX: number;
  ghostPointerOffsetY: number;
};

type DropIndicatorState = {
  columnId: string;
  top: number;
} | null;

type ColumnPendingRemoval = {
  column: KanbanColumnRecord;
  taskCount: number;
};

type ColumnRenameState = {
  columnId: string;
  value: string;
};

export function ListKanbanPanel({
  list,
  lists,
  columns,
  tasks,
  completingTaskIds = new Set(),
  completingWithoutBackgroundTaskIds = new Set(),
  checkAnimatingTaskIds = new Set(),
  onToggleTask,
  onOpenTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskRecurrence,
  onSetTaskPriority,
  onToggleTaskLabel,
  onLabelsChanged,
  onDuplicateTask,
  onDeleteTask,
  onAddColumn,
  onAddTask,
  onMoveTask,
  onRemoveColumn,
  onRenameColumn,
  showSidebarMenu = false,
  onOpenSidebar,
}: ListKanbanPanelProps) {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingTask, setAddingTask] = useState<ColumnAddTaskState | null>(null);
  const [renamingColumn, setRenamingColumn] = useState<ColumnRenameState | null>(
    null,
  );
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>(null);
  const [columnPendingRemoval, setColumnPendingRemoval] =
    useState<ColumnPendingRemoval | null>(null);
  const [taskContextMenu, setTaskContextMenu] =
    useState<KanbanTaskContextMenuState | null>(null);
  const [openDatePicker, setOpenDatePicker] =
    useState<KanbanDatePickerState | null>(null);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [assignedLabelIds, setAssignedLabelIds] = useState<string[]>([]);
  const [labelQuery, setLabelQuery] = useState("");
  const [isLabelSubmitting, setIsLabelSubmitting] = useState(false);
  const columnInputRef = useRef<HTMLInputElement>(null);
  const columnRenameInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const taskContextMenuRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<KanbanDragState | null>(null);
  const listColor = getListColor({ color: list.color ?? null });

  const contextMenuTask = taskContextMenu
    ? (tasks.find((item) => item.id === taskContextMenu.task.id) ??
      taskContextMenu.task)
    : null;

  const datePickerTask = openDatePicker
    ? (tasks.find((item) => item.id === openDatePicker.task.id) ??
      openDatePicker.task)
    : null;

  function resetLabelMenuState() {
    setAssignedLabelIds([]);
    setLabelQuery("");
    setIsLabelSubmitting(false);
  }

  function closeTaskContextMenu() {
    setTaskContextMenu(null);
    resetLabelMenuState();
  }

  function closeDatePicker() {
    setOpenDatePicker(null);
  }

  useEffect(() => {
    if (!taskContextMenu) return;

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
  }, [taskContextMenu?.task.id]);

  useEffect(() => {
    if (!taskContextMenu && !openDatePicker) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (taskContextMenuRef.current?.contains(target)) return;
      if (datePickerRef.current?.contains(target)) return;
      if (taskContextMenu) closeTaskContextMenu();
      if (openDatePicker) closeDatePicker();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (taskContextMenu) {
        closeTaskContextMenu();
        return;
      }
      if (openDatePicker) {
        closeDatePicker();
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [taskContextMenu, openDatePicker]);

  async function handleToggleLabel(taskId: string, labelId: string) {
    if (!onToggleTaskLabel) return;

    let nextAssigned = false;

    setAssignedLabelIds((current) => {
      const isAssigned = current.includes(labelId);
      nextAssigned = !isAssigned;
      return isAssigned
        ? current.filter((id) => id !== labelId)
        : current.includes(labelId)
          ? current
          : [...current, labelId];
    });
    setIsLabelSubmitting(true);

    try {
      const updatedTags = await onToggleTaskLabel(
        taskId,
        labelId,
        nextAssigned,
      );
      setAssignedLabelIds(updatedTags.map((tag) => tag.id));
    } catch {
      setAssignedLabelIds((current) =>
        nextAssigned
          ? current.filter((id) => id !== labelId)
          : current.includes(labelId)
            ? current
            : [...current, labelId],
      );
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

  function openLabelMenuFromContextMenu() {
    setTaskContextMenu((current) =>
      current ? { ...current, view: "label" } : current,
    );
  }

  function openLabelMenuForTask(
    task: TaskListItem,
    anchor: HTMLElement,
  ) {
    const rect = anchor.getBoundingClientRect();
    const position = clampPointerContextMenuPosition(
      rect.left,
      rect.bottom + 4,
    );

    setAssignedLabelIds(task.labels.map((label) => label.id));
    setLabelQuery("");
    setIsLabelSubmitting(false);
    setTaskContextMenu({
      task,
      x: position.x,
      y: position.y,
      view: "label",
    });
  }

  function openCustomDatePickerFromContextMenu() {
    if (!taskContextMenu || !contextMenuTask) return;

    setOpenDatePicker({
      task: contextMenuTask,
      x: taskContextMenu.x,
      y: taskContextMenu.y,
    });
  }

  function handleTaskContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    task: TaskListItem,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const position = clampPointerContextMenuPosition(
      event.clientX,
      event.clientY,
    );

    openTaskContextMenu(task, position.x, position.y);
  }

  function openTaskContextMenu(task: TaskListItem, x: number, y: number) {
    setAssignedLabelIds(task.labels.map((label) => label.id));
    setLabelQuery("");
    setIsLabelSubmitting(false);
    setTaskContextMenu({
      task,
      x,
      y,
      view: "main",
    });
  }

  function openTaskMenuFromButton(task: TaskListItem, anchor: HTMLElement) {
    if (
      taskContextMenu?.task.id === task.id &&
      taskContextMenu.view === "main"
    ) {
      closeTaskContextMenu();
      return;
    }

    const position = computeKanbanTaskMenuAnchorPosition(anchor);
    openTaskContextMenu(task, position.x, position.y);
  }

  const tasksByColumnId = useMemo(() => {
    const grouped = new Map<string, TaskListItem[]>();

    for (const column of columns) {
      grouped.set(column.id, []);
    }

    for (const task of tasks) {
      if (task.completed || task.parentId) continue;
      const columnId = task.kanbanColumnId;
      if (!columnId || !grouped.has(columnId)) continue;
      grouped.get(columnId)?.push(task);
    }

    return grouped;
  }, [columns, tasks]);

  function clearDragVisuals(dragState: KanbanDragState) {
    dragState.dragGhost?.remove();
    dragState.dragGhost = null;
    dragState.sourceRow.classList.remove(
      KANBAN_TASK_DRAG_SOURCE_CLASS,
      "task-row-dragging",
    );
    dragState.sourceRow.style.transform = "";
    dragState.sourceRow.style.cursor = "";
  }

  function ensureDragVisuals(
    dragState: KanbanDragState,
    clientX: number,
    clientY: number,
  ) {
    if (!dragState.dragGhost) {
      const rect = dragState.sourceRow.getBoundingClientRect();
      dragState.ghostPointerOffsetX = clientX - rect.left;
      dragState.ghostPointerOffsetY = clientY - rect.top;
      dragState.dragGhost = createKanbanTaskDragGhost(dragState.sourceRow);
    }

    dragState.sourceRow.classList.add(
      KANBAN_TASK_DRAG_SOURCE_CLASS,
      "task-row-dragging",
    );

    updateKanbanTaskDragGhostPosition(
      dragState.dragGhost,
      clientX,
      clientY,
      dragState.ghostPointerOffsetX,
      dragState.ghostPointerOffsetY,
    );
  }

  function handleDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    dragState.lastPointerX = event.clientX;
    dragState.lastPointerY = event.clientY;
    ensureDragVisuals(dragState, event.clientX, event.clientY);

    const dropTarget = resolveKanbanDropTarget(
      event.clientX,
      event.clientY,
      dragState.sourceColumnId,
      dragState.sourceTaskId,
    );

    if (!dropTarget) {
      setDropIndicator(null);
      return;
    }

    dragState.dropColumnId = dropTarget.columnId;
    dragState.dropIndex = dropTarget.dropIndex;
    setDropIndicator({
      columnId: dropTarget.columnId,
      top: dropTarget.indicatorTop,
    });
  }

  function beginTaskDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceTaskId: string,
    sourceColumnId: string,
    sourceIndex: number,
    startClientX: number,
    startClientY: number,
  ) {
    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceTaskId,
      sourceColumnId,
      sourceIndex,
      dropColumnId: sourceColumnId,
      dropIndex: sourceIndex,
      pointerId,
      lastPointerX: startClientX,
      lastPointerY: startClientY,
      dragGhost: null,
      ghostPointerOffsetX:
        startClientX - sourceRow.getBoundingClientRect().left,
      ghostPointerOffsetY: startClientY - sourceRow.getBoundingClientRect().top,
    };

    ensureDragVisuals(dragStateRef.current, startClientX, startClientY);
    trySetPointerCapture(sourceRow, pointerId);
    sourceRow.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function handleDragEnd() {
    const dragState = dragStateRef.current;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.removeEventListener("pointercancel", handleDragEnd);
    document.body.style.cursor = "";
    setDropIndicator(null);

    if (dragState) {
      tryReleasePointerCapture(dragState.captureTarget, dragState.pointerId);
      clearDragVisuals(dragState);

      let insertIndex = dragState.dropIndex;
      if (
        dragState.dropColumnId === dragState.sourceColumnId &&
        dragState.sourceIndex < dragState.dropIndex
      ) {
        insertIndex -= 1;
      }

      const moved =
        dragState.dropColumnId !== dragState.sourceColumnId ||
        insertIndex !== dragState.sourceIndex;

      if (moved) {
        void onMoveTask(
          dragState.sourceTaskId,
          dragState.dropColumnId,
          insertIndex,
        );
      }
    }

    dragStateRef.current = null;
  }

  function startColumnRename(column: KanbanColumnRecord) {
    if (!onRenameColumn) return;

    setRenamingColumn({ columnId: column.id, value: column.name });
    requestAnimationFrame(() => {
      const input = columnRenameInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  async function commitColumnRename(columnId: string) {
    if (!renamingColumn || renamingColumn.columnId !== columnId) return;

    const trimmed = renamingColumn.value.trim();
    const column = columns.find((item) => item.id === columnId);
    setRenamingColumn(null);

    if (!trimmed || !column || trimmed === column.name) return;

    await onRenameColumn?.(columnId, trimmed);
  }

  function cancelColumnRename() {
    setRenamingColumn(null);
  }

  function handleTaskPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    taskId: string,
    columnId: string,
    sourceIndex: number,
  ) {
    if (event.button !== 0) return;
    if (completingTaskIds.has(taskId)) return;
    if (!shouldStartKanbanTaskDrag(event.target)) return;

    const sourceRow = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    trySetPointerCapture(sourceRow, pointerId);
    sourceRow.style.cursor = "move";

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
      if (Math.hypot(dx, dy) < KANBAN_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginTaskDrag(
        sourceRow,
        pointerId,
        taskId,
        columnId,
        sourceIndex,
        startX,
        startY,
      );
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
      if (!dragStarted) {
        tryReleasePointerCapture(sourceRow, pointerId);
        sourceRow.style.cursor = "";
        onOpenTask?.(taskId);
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  async function handleAddColumnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newColumnName.trim();
    if (!trimmed) return;

    await onAddColumn(trimmed);
    setNewColumnName("");
    setIsAddingColumn(false);
  }

  async function handleAddTaskSubmit(
    event: FormEvent<HTMLFormElement>,
    columnId: string,
  ) {
    event.preventDefault();
    if (!addingTask || addingTask.columnId !== columnId) return;

    const trimmed = addingTask.value.trim();
    if (!trimmed) return;

    await onAddTask(columnId, trimmed);
    setAddingTask(null);
  }

  function startAddTask(columnId: string) {
    setAddingTask({ columnId, value: "" });
    requestAnimationFrame(() => taskInputRef.current?.focus());
  }

  return (
    <div className="panel-text-scope flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbfc] dark:bg-zinc-950">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        {showSidebarMenu ? (
          <button
            type="button"
            aria-label="Open menu"
            className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            onClick={onOpenSidebar}
          >
            <span className="sr-only">Open menu</span>
            ☰
          </button>
        ) : null}
        <LuList
          className="size-[18px] shrink-0"
          style={{ color: listColor }}
          aria-hidden="true"
        />
        <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {list.name}
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max items-start gap-3 px-4 py-4">
          {columns.map((column) => {
            const columnTasks = tasksByColumnId.get(column.id) ?? [];
            const isAddingTaskHere = addingTask?.columnId === column.id;
            const canRemoveColumn = column.name !== NOT_ASSIGNED_COLUMN_NAME;

            return (
              <section
                key={column.id}
                data-kanban-column-id={column.id}
                className={`flex w-[280px] shrink-0 flex-col rounded-[20px] border border-zinc-100 bg-white dark:border-zinc-700/80 dark:bg-zinc-900 ${KANBAN_COLUMN_SURFACE_CLASS}`}
              >
                <div className="flex items-start gap-1 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                  <div className="min-w-0 flex-1">
                    {renamingColumn?.columnId === column.id ? (
                      <input
                        ref={columnRenameInputRef}
                        type="text"
                        value={renamingColumn.value}
                        onChange={(event) =>
                          setRenamingColumn({
                            columnId: column.id,
                            value: event.target.value,
                          })
                        }
                        onBlur={() => void commitColumnRename(column.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitColumnRename(column.id);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelColumnRename();
                          }
                        }}
                        aria-label={`Rename ${column.name} block`}
                        className="w-full rounded-md border border-zinc-200 ring-0 bg-white px-1.5 py-0.5 text-sm font-semibold text-zinc-800 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startColumnRename(column)}
                        disabled={!onRenameColumn}
                        className="w-full truncate text-left text-sm font-semibold text-zinc-700 enabled:cursor-text enabled:hover:text-zinc-950 disabled:cursor-default dark:text-zinc-100 dark:enabled:hover:text-white"
                      >
                        {column.name}
                      </button>
                    )}
                    {columnTasks.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {columnTasks.length} task
                        {columnTasks.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  {canRemoveColumn ? (
                    <button
                      type="button"
                      aria-label={`Remove ${column.name} block`}
                      onClick={() =>
                        setColumnPendingRemoval({
                          column,
                          taskCount: columnTasks.length,
                        })
                      }
                      className="-mt-1.5 -mr-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <LuX className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div
                  data-kanban-column-body={column.id}
                  className="relative flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
                >
                  {dropIndicator?.columnId === column.id ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 left-2 z-20 flex items-center"
                      style={{ top: dropIndicator.top }}
                    >
                      <div
                        className="size-[7px] shrink-0 rounded-full bg-transparent box-border"
                        style={{
                          border: `2px solid ${KANBAN_DROP_INDICATOR_COLOR}`,
                        }}
                      />
                      <div
                        className="h-[2px] flex-1"
                        style={{ backgroundColor: KANBAN_DROP_INDICATOR_COLOR }}
                      />
                    </div>
                  ) : null}

                  {columnTasks.map((task, taskIndex) => {
                    const schedule = getKanbanTaskSchedule(task);
                    const isCompleting = completingTaskIds.has(task.id);
                    const isCheckAnimating = checkAnimatingTaskIds.has(task.id);
                    const showCompletionBackground =
                      isCompleting &&
                      !completingWithoutBackgroundTaskIds.has(task.id);
                    const useFastCompletionAnimation =
                      completingWithoutBackgroundTaskIds.has(task.id);
                    const hideDueDate = isCheckAnimating || isCompleting;
                    const checkedContentDim = hideDueDate
                      ? "opacity-50"
                      : "opacity-100";
                    const checkedTextStyle = hideDueDate
                      ? "ptxt-completed-tasks"
                      : "text-zinc-800 dark:text-zinc-100";
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
                    } as CSSProperties;
                    const isTaskMenuOpen =
                      taskContextMenu?.task.id === task.id &&
                      (taskContextMenu.view === "main" ||
                        taskContextMenu.view === "label");
                    const hasLabels = task.labels.length > 0;

                    return (
                      <article
                        key={task.id}
                        data-kanban-task-id={task.id}
                        aria-label={
                          isCompleting ? `${task.name} completed` : undefined
                        }
                        onPointerDown={(event) =>
                          handleTaskPointerDown(
                            event,
                            task.id,
                            column.id,
                            taskIndex,
                          )
                        }
                        onContextMenu={
                          isCompleting
                            ? undefined
                            : (event) => handleTaskContextMenu(event, task)
                        }
                        className={`group relative touch-none rounded-[12px] border border-zinc-200 hover:border-slate-350 bg-[#f8f8fb] px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 ${
                          isCompleting
                            ? showCompletionBackground
                              ? "task-row-completing"
                              : "task-row-completing task-row-completing-no-bg"
                            : "cursor-pointer"
                        }`}
                        style={isCompleting ? completeDurationStyle : undefined}
                      >
                        <div className="relative flex items-start gap-2 pr-5">
                          <TaskCompletionCheckbox
                            variant="box"
                            checkKey={task.id}
                            animateCheck={isCheckAnimating}
                            checked={
                              task.completed || isCheckAnimating || isCompleting
                            }
                            className="task-list-checkbox mt-0.5 shrink-0"
                            onChange={
                              isCompleting
                                ? () => {}
                                : () => onToggleTask(task.id)
                            }
                            onClick={(event) => event.stopPropagation()}
                            aria-label={
                              isCompleting
                                ? `${task.name} completed`
                                : `Mark ${task.name} complete`
                            }
                          />
                          <div
                            className={`min-w-0 flex-1 ${hasLabels ? "pr-5" : ""} ${checkedContentDim}`}
                            style={{ transition: dimTransition }}
                          >
                            <span
                              className={`block truncate ${checkedTextStyle}`}
                              style={{ transitionDuration: `${checkedRowDimMs}ms` }}
                              title={task.name}
                            >
                              {task.name}
                            </span>
                            {schedule.showDueSchedule && schedule.dueScheduleSubline ? (
                              <div
                                className={`mt-0.5 inline-flex w-fit max-w-full items-center gap-1 text-[11px] leading-none ${KANBAN_TASK_SCHEDULE_COLOR_CLASS} ${
                                  hideDueDate ? "hidden" : ""
                                } ${hasLabels ? "pr-4" : ""}`}
                              >
                                <IoMdTime
                                  className="size-3 shrink-0"
                                  aria-hidden="true"
                                />
                                {schedule.hasRecurrence ? (
                                  <BiRevision
                                    className="size-3 shrink-0 opacity-70"
                                    aria-label="Repeats"
                                  />
                                ) : null}
                                <span className="truncate">
                                  {schedule.dueScheduleSubline}
                                </span>
                                {schedule.hasDueTime ? (
                                  <BiAlarm
                                    className="size-3 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 ${checkedContentDim}`}
                            style={{ transition: dimTransition }}
                          >
                            <TaskPriorityPill priority={task.priority} />
                          </span>
                          {!isCompleting ? (
                            <div
                              className={`absolute right-0 top-0.5 z-10 transition-opacity ${
                                isTaskMenuOpen
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <button
                                type="button"
                                data-kanban-task-menu-trigger
                                aria-label={`Open menu for ${task.name}`}
                                aria-haspopup="menu"
                                aria-expanded={isTaskMenuOpen}
                                title="More options"
                                className="flex size-[22px] -mt-[2px]! shrink-0 cursor-pointer items-center justify-center rounded-full ptxt-400 transition-colors hover:bg-zinc-200/80 hover:ptxt-500 dark:hover:bg-zinc-800 dark:hover:ptxt-100"
                                onPointerDown={(event) => {
                                  if (event.button !== 0) return;
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskMenuFromButton(
                                    task,
                                    event.currentTarget,
                                  );
                                }}
                              >
                                <PiDotsThreeBold className="size-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {hasLabels && !isCompleting ? (
                          <KanbanTaskLabelDots
                            labels={task.labels}
                            className={checkedContentDim}
                            onOpenLabels={(event) =>
                              openLabelMenuForTask(task, event.currentTarget)
                            }
                          />
                        ) : null}
                      </article>
                    );
                  })}

                  {isAddingTaskHere ? (
                    <form
                      onSubmit={(event) => handleAddTaskSubmit(event, column.id)}
                      className="rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      <input
                        ref={taskInputRef}
                        type="text"
                        value={addingTask.value}
                        onChange={(event) =>
                          setAddingTask({
                            columnId: column.id,
                            value: event.target.value,
                          })
                        }
                        placeholder="Task name"
                        aria-label="New task name"
                        className="w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setAddingTask(null);
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startAddTask(column.id)}
                      className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <LuPlus className="size-3.5 shrink-0" aria-hidden="true" />
                      Add task
                    </button>
                  )}
                </div>
              </section>
            );
          })}

          <div className="flex w-[220px] shrink-0 flex-col pt-4">
            {isAddingColumn ? (
              <form
                onSubmit={handleAddColumnSubmit}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <input
                  ref={columnInputRef}
                  type="text"
                  value={newColumnName}
                  onChange={(event) => setNewColumnName(event.target.value)}
                  placeholder="Column name"
                  aria-label="New column name"
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsAddingColumn(false);
                      setNewColumnName("");
                    }
                  }}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingColumn(false);
                      setNewColumnName("");
                    }}
                    className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newColumnName.trim()}
                    className="cursor-pointer rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(true);
                  requestAnimationFrame(() => columnInputRef.current?.focus());
                }}
                className="flex cursor-pointer items-center gap-1 text-sm font-medium text-[#818c92] transition-colors hover:text-zinc-450 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <LuPlus className="size-4 shrink-0" aria-hidden="true" />
                Add block
              </button>
            )}
          </div>
        </div>
      </div>

      {taskContextMenu && contextMenuTask
        ? createPortal(
            <div ref={taskContextMenuRef}>
              <TaskRowContextMenu
                task={contextMenuTask}
                view={taskContextMenu.view}
                lists={lists}
                currentListId={list.id}
                moveQuery=""
                availableLabels={availableLabels}
                assignedLabelIds={assignedLabelIds}
                labelQuery={labelQuery}
                isLabelSubmitting={isLabelSubmitting}
                fixedPosition={{
                  x: taskContextMenu.x,
                  y: taskContextMenu.y,
                }}
                onMoveQueryChange={() => {}}
                onLabelQueryChange={setLabelQuery}
                onToggleLabelSelection={(labelId) => {
                  void handleToggleLabel(contextMenuTask.id, labelId);
                }}
                onCreateLabel={(label, color) => {
                  void handleCreateLabel(contextMenuTask.id, label, color);
                }}
                onClose={closeTaskContextMenu}
                onToggleTaskImportant={() => {}}
                onOpenLabelMenu={openLabelMenuFromContextMenu}
                onOpenMoveMenu={() => {}}
                onMoveTaskToList={() => {}}
                onSetTaskDueDate={(dateValue) => {
                  onSetTaskDueDate?.(contextMenuTask.id, dateValue);
                }}
                onClearTaskDueDate={() => {
                  onSetTaskDueDate?.(contextMenuTask.id, null);
                }}
                onOpenCustomDatePicker={openCustomDatePickerFromContextMenu}
                onSelectTaskPriority={(priority) => {
                  onSetTaskPriority?.(contextMenuTask.id, priority);
                }}
                onClearTaskPriority={() => {
                  onSetTaskPriority?.(contextMenuTask.id, null);
                }}
                onConvertTaskToNote={() => {}}
                onAddSubtask={() => {}}
                onDuplicateTask={() => {
                  void onDuplicateTask?.(contextMenuTask.id);
                }}
                onDeleteTask={() => {
                  void onDeleteTask?.(contextMenuTask.id);
                }}
                hasDueDateActions={Boolean(onSetTaskDueDate)}
                hasPriorityActions={Boolean(onSetTaskPriority)}
                hasNoteActions={false}
                hasImportantActions={false}
                hasLabelActions={Boolean(onToggleTaskLabel)}
                hasMoveActions={false}
                hasSubtaskActions={false}
                hasDuplicateActions={Boolean(onDuplicateTask)}
                hasDeleteActions={Boolean(onDeleteTask)}
                dateShortcutVariant="compact"
              />
            </div>,
            document.body,
          )
        : null}

      {openDatePicker && datePickerTask
        ? createPortal(
            <div
              ref={datePickerRef}
              data-task-date-picker-menu
              className="fixed z-[100]"
              style={{
                left: Math.min(
                  Math.max(8, openDatePicker.x),
                  typeof window !== "undefined"
                    ? window.innerWidth - TASK_DATE_PICKER_WIDTH - 8
                    : openDatePicker.x,
                ),
                top: Math.min(
                  Math.max(8, openDatePicker.y),
                  typeof window !== "undefined"
                    ? window.innerHeight - TASK_DATE_PICKER_HEIGHT - 8
                    : openDatePicker.y,
                ),
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <TaskDatePicker
                className="task-item-date-picker-popover"
                dueDate={datePickerTask.dueDate}
                dueTimeMinutes={datePickerTask.dueTimeMinutes}
                dueDurationMinutes={datePickerTask.dueDurationMinutes}
                dueTimeZone={datePickerTask.dueTimeZone}
                recurrenceRule={datePickerTask.recurrenceRule}
                onSelectDate={(dateValue) => {
                  onSetTaskDueDate?.(datePickerTask.id, dateValue);
                  if (dateValue === null) {
                    closeDatePicker();
                  }
                }}
                onSaveDueTime={
                  onSetTaskDueTime
                    ? (dueTime, options) => {
                        onSetTaskDueTime(datePickerTask.id, dueTime);
                        if (!options?.keepOpen) {
                          closeDatePicker();
                        }
                      }
                    : undefined
                }
                onSaveRecurrence={
                  onSetTaskRecurrence
                    ? (rule) => onSetTaskRecurrence(datePickerTask.id, rule)
                    : undefined
                }
              />
            </div>,
            document.body,
          )
        : null}

      <ConfirmModal
        open={columnPendingRemoval !== null}
        title="Remove block"
        message={
          columnPendingRemoval
            ? columnPendingRemoval.taskCount > 0
              ? `"${columnPendingRemoval.column.name}" has ${columnPendingRemoval.taskCount} task${
                  columnPendingRemoval.taskCount === 1 ? "" : "s"
                }. Move or complete them before removing this block.`
              : `Remove the block "${columnPendingRemoval.column.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Remove block"
        showConfirm={columnPendingRemoval?.taskCount === 0}
        onConfirm={() => {
          if (!columnPendingRemoval || columnPendingRemoval.taskCount > 0) {
            setColumnPendingRemoval(null);
            return;
          }

          void onRemoveColumn(columnPendingRemoval.column.id);
          setColumnPendingRemoval(null);
        }}
        onCancel={() => setColumnPendingRemoval(null)}
      />
    </div>
  );
}
