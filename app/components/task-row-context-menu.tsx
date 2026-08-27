"use client";

import { BiChevronRight } from "react-icons/bi";
import { TaskContextMenuDateShortcuts } from "./task-context-menu-date-shortcuts";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { Label } from "./task-label-selector";
import { TaskLabelSelector } from "./task-label-selector";
import { TaskPrioritySelector } from "./task-priority-selector";
import type { TaskListItem, TodoList } from "./todo-app";

export type TaskRowContextMenuView = "main" | "label" | "moveTo";

type TaskRowContextMenuProps = {
  task: TaskListItem;
  view: TaskRowContextMenuView;
  lists: TodoList[];
  currentListId: string | null;
  moveQuery: string;
  availableLabels: Label[];
  assignedLabelIds: string[];
  labelQuery: string;
  isLabelSubmitting?: boolean;
  fixedPosition?: { x: number; y: number };
  onMoveQueryChange: (value: string) => void;
  onLabelQueryChange: (value: string) => void;
  onToggleLabelSelection: (labelId: string) => void;
  onCreateLabel: (label: string, color: string) => void;
  onClose: () => void;
  onToggleTaskPinned: () => void;
  onToggleTaskImportant: () => void;
  onOpenLabelMenu: () => void;
  onOpenMoveMenu: () => void;
  onMoveTaskToList: (listId: string) => void;
  onSetTaskDueDate: (dateValue: string) => void;
  onOpenCustomDatePicker: () => void;
  onSelectTaskPriority: (priority: number) => void;
  onClearTaskPriority: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasPinActions: boolean;
  hasImportantActions: boolean;
  hasLabelActions: boolean;
  hasMoveActions: boolean;
};

const menuClassName =
  "overflow-visible rounded-[23px] bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]";

const menuItemClassName =
  "flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

function MainMenuItems({
  task,
  view,
  hasPinActions,
  hasImportantActions,
  hasPriorityActions,
  hasDueDateActions,
  hasLabelActions,
  hasMoveActions,
  onClose,
  onToggleTaskPinned,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onSetTaskDueDate,
  onOpenCustomDatePicker,
  onSelectTaskPriority,
  onClearTaskPriority,
}: Pick<
  TaskRowContextMenuProps,
  | "task"
  | "view"
  | "hasPinActions"
  | "hasImportantActions"
  | "hasPriorityActions"
  | "hasDueDateActions"
  | "hasLabelActions"
  | "hasMoveActions"
  | "onClose"
  | "onToggleTaskPinned"
  | "onToggleTaskImportant"
  | "onOpenLabelMenu"
  | "onOpenMoveMenu"
  | "onSetTaskDueDate"
  | "onOpenCustomDatePicker"
  | "onSelectTaskPriority"
  | "onClearTaskPriority"
>) {
  const menuWidthClass =
    hasDueDateActions || hasPriorityActions ? "w-[196px]" : "w-36";
  const prioritySelector = hasPriorityActions ? (
    <TaskPrioritySelector
      selectedPriority={task.priority}
      onSelectPriority={(priority) => {
        onSelectTaskPriority(priority);
        onClose();
      }}
      onClearPriority={() => {
        onClearTaskPriority();
        onClose();
      }}
    />
  ) : null;

  return (
    <div role="menu" className={`${menuWidthClass} ${menuClassName}`}>
      {hasDueDateActions ? (
        <TaskContextMenuDateShortcuts
          onSelectDate={(dateValue) => {
            onSetTaskDueDate(dateValue);
            onClose();
          }}
          onOpenCustomDatePicker={() => {
            onOpenCustomDatePicker();
            onClose();
          }}
        />
      ) : null}
      {hasDueDateActions && hasPriorityActions ? prioritySelector : null}
      {hasPinActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTaskPinned();
          }}
        >
          {task.pinned ? "Unpin task" : "Pin task"}
        </button>
      ) : null}
      {!hasDueDateActions && hasPriorityActions ? prioritySelector : null}
      {hasImportantActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTaskImportant();
          }}
        >
          {task.important ? "Remove from important" : "Mark as important"}
        </button>
      ) : null}
      {hasMoveActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} justify-between ${
            view === "moveTo" ? "bg-zinc-100 dark:bg-zinc-800" : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMoveMenu();
          }}
        >
          Move to
          <BiChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
        </button>
      ) : null}
      {hasLabelActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenLabelMenu();
          }}
        >
          {task.labels.length > 0 ? "Labels" : "Add label"}
        </button>
      ) : null}
    </div>
  );
}

export function TaskRowContextMenu({
  task,
  view,
  lists,
  currentListId,
  moveQuery,
  availableLabels,
  assignedLabelIds,
  labelQuery,
  isLabelSubmitting = false,
  fixedPosition,
  onMoveQueryChange,
  onLabelQueryChange,
  onToggleLabelSelection,
  onCreateLabel,
  onClose,
  onToggleTaskPinned,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveTaskToList,
  onSetTaskDueDate,
  onOpenCustomDatePicker,
  onSelectTaskPriority,
  onClearTaskPriority,
  hasDueDateActions,
  hasPriorityActions,
  hasPinActions,
  hasImportantActions,
  hasLabelActions,
  hasMoveActions,
}: TaskRowContextMenuProps) {
  const menu = (
    <>
      {view === "main" && (
        <MainMenuItems
          task={task}
          view={view}
          hasPinActions={hasPinActions}
          hasImportantActions={hasImportantActions}
          hasPriorityActions={hasPriorityActions}
          hasDueDateActions={hasDueDateActions}
          hasLabelActions={hasLabelActions}
          hasMoveActions={hasMoveActions}
          onClose={onClose}
          onToggleTaskPinned={onToggleTaskPinned}
          onToggleTaskImportant={onToggleTaskImportant}
          onOpenLabelMenu={onOpenLabelMenu}
          onOpenMoveMenu={onOpenMoveMenu}
          onSetTaskDueDate={onSetTaskDueDate}
          onOpenCustomDatePicker={onOpenCustomDatePicker}
          onSelectTaskPriority={onSelectTaskPriority}
          onClearTaskPriority={onClearTaskPriority}
        />
      )}

      {view === "moveTo" && (
        <div className="flex items-start gap-1">
          <MainMenuItems
            task={task}
            view={view}
            hasPinActions={hasPinActions}
            hasImportantActions={hasImportantActions}
            hasPriorityActions={hasPriorityActions}
            hasDueDateActions={hasDueDateActions}
            hasLabelActions={hasLabelActions}
            hasMoveActions={hasMoveActions}
            onClose={onClose}
            onToggleTaskPinned={onToggleTaskPinned}
            onToggleTaskImportant={onToggleTaskImportant}
            onOpenLabelMenu={onOpenLabelMenu}
            onOpenMoveMenu={onOpenMoveMenu}
            onSetTaskDueDate={onSetTaskDueDate}
            onOpenCustomDatePicker={onOpenCustomDatePicker}
            onSelectTaskPriority={onSelectTaskPriority}
            onClearTaskPriority={onClearTaskPriority}
          />
          <TaskMoveToSelector
            lists={lists}
            currentListId={currentListId}
            query={moveQuery}
            onQueryChange={onMoveQueryChange}
            onSelectList={onMoveTaskToList}
            onCancel={onClose}
          />
        </div>
      )}

      {view === "label" && (
        <TaskLabelSelector
          labels={availableLabels}
          assignedLabelIds={assignedLabelIds}
          query={labelQuery}
          isSubmitting={isLabelSubmitting}
          onQueryChange={onLabelQueryChange}
          onToggleLabel={onToggleLabelSelection}
          onCreateLabel={onCreateLabel}
          onCancel={onClose}
        />
      )}
    </>
  );

  if (fixedPosition) {
    return (
      <div
        className="fixed z-50"
        style={{ left: fixedPosition.x, top: fixedPosition.y }}
      >
        {menu}
      </div>
    );
  }

  return menu;
}
