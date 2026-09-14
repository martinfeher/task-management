"use client";

import { useEffect, useRef, useState } from "react";
import { BiChevronRight } from "react-icons/bi";
// import { IoMdPricetag } from "react-icons/io";
import { IoDuplicateOutline } from "react-icons/io5";
import { PiListStarThin, PiNoteThin } from "react-icons/pi";
import { RiDeleteBinLine } from "react-icons/ri";

import { LiaTagSolid } from "react-icons/lia";


import { LuListVideo } from "react-icons/lu";
import { TaskContextMenuDateShortcuts } from "./task-context-menu-date-shortcuts";
import { TaskListSubtaskIcon } from "./task-list-subtask-icon";
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
  onToggleTaskImportant: () => void;
  onOpenLabelMenu: () => void;
  onOpenMoveMenu: () => void;
  onMoveTaskToList: (listId: string) => void;
  onSetTaskDueDate: (dateValue: string) => void;
  onClearTaskDueDate: () => void;
  onOpenCustomDatePicker: () => void;
  onSelectTaskPriority: (priority: number) => void;
  onClearTaskPriority: () => void;
  onConvertTaskToNote: () => void;
  onAddSubtask: () => void;
  onDuplicateTask: () => void;
  onDeleteTask: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasNoteActions: boolean;
  hasImportantActions: boolean;
  hasLabelActions: boolean;
  hasMoveActions: boolean;
  hasSubtaskActions: boolean;
  hasDuplicateActions: boolean;
  hasDeleteActions: boolean;
};

const menuClassName =
  "overflow-visible rounded-[23px] bg-white p-[5px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]";

const menuItemClassName =
  "flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

const deleteMenuItemClassName =
  "flex h-[35px] w-full items-center px-3 text-left text-sm text-red-600 dark:text-red-400 dark:hover:bg-red-950/40";

const menuItemWithIconClassName =
  "flex items-center gap-2 leading-none";

const menuItemIconSlotClassName =
  "flex size-[21px] shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-[15px]";

const menuItemIconSlot20ClassName =
  "flex size-[19px] shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-[20px]";

const deleteMenuItemIconSlotClassName =
  "flex size-[25px] shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-[25px]";

function MainMenuItems({
  task,
  view,
  hasImportantActions,
  hasPriorityActions,
  hasNoteActions,
  hasDueDateActions,
  hasLabelActions,
  hasMoveActions,
  hasSubtaskActions,
  hasDuplicateActions,
  hasDeleteActions,
  onClose,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveMouseEnter,
  onMoveMouseLeave,
  onSetTaskDueDate,
  onClearTaskDueDate,
  onOpenCustomDatePicker,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConvertTaskToNote,
  onAddSubtask,
  onDuplicateTask,
  onDeleteTask,
}: Pick<
  TaskRowContextMenuProps,
  | "task"
  | "view"
  | "hasImportantActions"
  | "hasPriorityActions"
  | "hasNoteActions"
  | "hasDueDateActions"
  | "hasLabelActions"
  | "hasMoveActions"
  | "hasSubtaskActions"
  | "hasDuplicateActions"
  | "hasDeleteActions"
  | "onClose"
  | "onToggleTaskImportant"
  | "onOpenLabelMenu"
  | "onOpenMoveMenu"
  | "onSetTaskDueDate"
  | "onClearTaskDueDate"
  | "onOpenCustomDatePicker"
  | "onSelectTaskPriority"
  | "onClearTaskPriority"
  | "onConvertTaskToNote"
  | "onAddSubtask"
  | "onDuplicateTask"
  | "onDeleteTask"
> & {
  onMoveMouseEnter?: () => void;
  onMoveMouseLeave?: () => void;
}) {
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
          hasDueDate={Boolean(task.dueDate)}
          onSelectDate={(dateValue) => {
            onSetTaskDueDate(dateValue);
            onClose();
          }}
          onClearDate={() => {
            onClearTaskDueDate();
            onClose();
          }}
          onOpenCustomDatePicker={() => {
            onOpenCustomDatePicker();
            onClose();
          }}
        />
      ) : null}
      {hasDueDateActions && hasPriorityActions ? prioritySelector : null}
      {!hasDueDateActions && hasPriorityActions ? prioritySelector : null}
       {hasMoveActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} group cursor-pointer justify-between ${
            view === "moveTo" ? "bg-zinc-100 dark:bg-zinc-800" : ""
          }`}
          onMouseEnter={onMoveMouseEnter}
          onMouseLeave={onMoveMouseLeave}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMoveMenu();
          }}
        >
          <span className={`${menuItemWithIconClassName} group`}>
     
            <span className={menuItemIconSlotClassName}>
              <LuListVideo
                className="size-[19px]! mt-[1px] text-zinc-350 group-hover:text-zinc-400 dark:text-zinc-400"
              />
            </span>
            <span className="text-[15px] text-zinc-800">Move to</span>
          </span>
          <BiChevronRight className="size-5 shrink-0 text-zinc-350 group-hover:text-zinc-400" aria-hidden />
        </button>
      ) : null}
      {hasLabelActions ? (
        <button
          type="button"
          role="menuitem"
            className={`${menuItemClassName} group cursor-pointer`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenLabelMenu();
          }}
        >
          <span className={menuItemWithIconClassName}>
            <span className={menuItemIconSlotClassName}>
              <LiaTagSolid
                className="size-[20px]! text-[#b4b4c8]! group-hover:text-zinc-450 dark:text-zinc-400"
              />
            </span>
            <span className="text-[15px] text-zinc-800">{task.labels.length > 0 ? "Labels" : "Add label"}</span>
          </span>
        </button>
      ) : null}

      {hasSubtaskActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} group cursor-pointer`}
          onClick={(event) => {
            event.stopPropagation();
            onAddSubtask();
          }}
        >
          <span className={menuItemWithIconClassName}>
            <span className={menuItemIconSlotClassName}>
              <TaskListSubtaskIcon className="size-[19px]! text-zinc-400 group-hover:text-zinc-450 dark:text-zinc-400" />
            </span>
            Add subtask
          </span>
        </button>
      ) : null}
      
      {hasImportantActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} group cursor-pointer`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTaskImportant();
          }}
        >
          <span className={menuItemWithIconClassName}>
            <span className={menuItemIconSlot20ClassName}>
              <PiListStarThin
                className="size-[20px] text-zinc-500 group-hover:text-zinc-550 dark:text-zinc-400"
              />
            </span>
            {task.important ? "Remove from important" : "Mark as important"}
          </span>
        </button>
      ) : null}
      {hasNoteActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} group cursor-pointer`}
          onClick={(event) => {
            event.stopPropagation();
            onConvertTaskToNote();
          }}
        >
          <span className={menuItemWithIconClassName}>
            <span className={menuItemIconSlotClassName}>
              <PiNoteThin
                style={{ transform: "scaleX(0.87)" }}
                className="size-[19px]! text-zinc-600 group-hover:text-zinc-650 dark:text-zinc-400"
              />
            </span>
            {task.isNote ? "turn into Task" : "convert to Note"}
          </span>
        </button>
      ) : null}
      {hasDuplicateActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} group cursor-pointer`}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicateTask();
          }}
        >
          <span className={menuItemWithIconClassName}>
            <span className={menuItemIconSlotClassName}>
              <IoDuplicateOutline
                className="size-[15px] text-zinc-450 group-hover:text-zinc-500 dark:text-zinc-400"
              />
            </span>
            Duplicate
          </span>
        </button>
      ) : null}
      {hasDeleteActions ? (
        <>
          <div role="separator" className="mx-4 border-t border-[#e4e4e4]" />
          <button
            type="button"
            role="menuitem"
            className={`${deleteMenuItemClassName} group -ml-[3px] cursor-pointer`}
       
            onClick={(event) => {
              event.stopPropagation();
              onDeleteTask();
            }}
          >
            <span className={menuItemWithIconClassName}>
              <span className={deleteMenuItemIconSlotClassName}>
                <RiDeleteBinLine
                  className="!size-[18px] ml-[3px] mb-[1px] text-[#e07142] group-hover:text-red-500 dark:text-red-400"
                  strokeWidth={0.2}
                  style={{ transform: "scaleX(0.87)" }}
                />
              </span>
              <span className="text-[15px]">Delete</span>
            </span>
          </button>
        </>
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
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveTaskToList,
  onSetTaskDueDate,
  onClearTaskDueDate,
  onOpenCustomDatePicker,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConvertTaskToNote,
  onAddSubtask,
  onDuplicateTask,
  onDeleteTask,
  hasDueDateActions,
  hasPriorityActions,
  hasNoteActions,
  hasImportantActions,
  hasLabelActions,
  hasMoveActions,
  hasSubtaskActions,
  hasDuplicateActions,
  hasDeleteActions,
}: TaskRowContextMenuProps) {
  const [isMoveHoverPreviewOpen, setIsMoveHoverPreviewOpen] = useState(false);
  const moveHoverCloseTimerRef = useRef<number | null>(null);

  const clearMoveHoverCloseTimer = () => {
    if (moveHoverCloseTimerRef.current !== null) {
      window.clearTimeout(moveHoverCloseTimerRef.current);
      moveHoverCloseTimerRef.current = null;
    }
  };

  const openMoveHoverPreview = () => {
    if (!hasMoveActions) return;

    clearMoveHoverCloseTimer();
    setIsMoveHoverPreviewOpen((current) => {
      if (!current) {
        onMoveQueryChange("");
      }
      return true;
    });
  };

  const scheduleCloseMoveHoverPreview = () => {
    clearMoveHoverCloseTimer();
    moveHoverCloseTimerRef.current = window.setTimeout(() => {
      moveHoverCloseTimerRef.current = null;
      setIsMoveHoverPreviewOpen(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      clearMoveHoverCloseTimer();
    };
  }, []);

  useEffect(() => {
    if (view !== "main") {
      setIsMoveHoverPreviewOpen(false);
    }
  }, [view]);

  const showMoveFlyout = view === "moveTo" || isMoveHoverPreviewOpen;

  const mainMenuProps = {
    task,
    view: showMoveFlyout ? ("moveTo" as const) : view,
    hasImportantActions,
    hasPriorityActions,
    hasNoteActions,
    hasDueDateActions,
    hasLabelActions,
    hasMoveActions,
    hasSubtaskActions,
    hasDuplicateActions,
    hasDeleteActions,
    onClose,
    onToggleTaskImportant,
    onOpenLabelMenu,
    onOpenMoveMenu,
    onMoveMouseEnter: openMoveHoverPreview,
    onMoveMouseLeave: scheduleCloseMoveHoverPreview,
    onSetTaskDueDate,
    onClearTaskDueDate,
    onOpenCustomDatePicker,
    onSelectTaskPriority,
    onClearTaskPriority,
    onConvertTaskToNote,
    onAddSubtask,
    onDuplicateTask,
    onDeleteTask,
  };

  const menu = (
    <>
      {view === "main" && !showMoveFlyout && <MainMenuItems {...mainMenuProps} />}

      {view === "main" && showMoveFlyout && (
        <div
          className="flex items-start gap-1"
          onMouseEnter={openMoveHoverPreview}
          onMouseLeave={scheduleCloseMoveHoverPreview}
        >
          <MainMenuItems {...mainMenuProps} />
          <div
            className="-ml-0.75"
            onMouseEnter={openMoveHoverPreview}
          >
            <TaskMoveToSelector
              lists={lists}
              currentListId={currentListId}
              query={moveQuery}
              onQueryChange={onMoveQueryChange}
              onSelectList={onMoveTaskToList}
              onCancel={onClose}
              autoFocus={false}
            />
          </div>
        </div>
      )}

      {view === "moveTo" && (
        <div
          className="flex items-start gap-1"
          onMouseEnter={openMoveHoverPreview}
          onMouseLeave={scheduleCloseMoveHoverPreview}
        >
          <MainMenuItems {...mainMenuProps} />
          <div
            className="-ml-0.75"
            onMouseEnter={openMoveHoverPreview}
          >
            <TaskMoveToSelector
              lists={lists}
              currentListId={currentListId}
              query={moveQuery}
              onQueryChange={onMoveQueryChange}
              onSelectList={onMoveTaskToList}
              onCancel={onClose}
              autoFocus
            />
          </div>
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
        className="fixed z-[100]"
        style={{ left: fixedPosition.x, top: fixedPosition.y }}
      >
        {menu}
      </div>
    );
  }

  return menu;
}
