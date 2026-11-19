"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
// import { IoMdPricetag } from "react-icons/io";
import { IoDuplicateOutline } from "react-icons/io5";
import { PiListStarThin, PiNoteThin } from "react-icons/pi";
import { RiDeleteBinLine } from "react-icons/ri";
import { LiaTagSolid } from "react-icons/lia";
import { LuListVideo } from "react-icons/lu";
import {
  TaskContextMenuDateShortcuts,
  type TaskContextMenuDateShortcutVariant,
} from "./task-context-menu-date-shortcuts";
import { TaskListSubtaskIcon } from "./task-list-subtask-icon";
import { TaskRowMenuTransition } from "./task-row-menu-transition";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { Label } from "./task-label-selector";
import { TaskLabelSelector } from "./task-label-selector";
import { TaskPrioritySelector } from "./task-priority-selector";
import type { TaskListItem, TodoList } from "./todo-app";
import { FROSTED_POPOVER_SURFACE_CLASS } from "@/lib/frosted-popover-surface";
import {
  TASK_CONTEXT_MENU_COLORS,
  taskContextMenuTextColor,
} from "@/lib/task-context-menu-colors";

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
  dateShortcutVariant?: TaskContextMenuDateShortcutVariant;
};

const menuClassName = `overflow-visible rounded-[23px] p-[5px] ${FROSTED_POPOVER_SURFACE_CLASS}`;

const MOVE_FLYOUT_WIDTH_PX = 240;
const MOVE_FLYOUT_GAP_PX = 4;
const MOVE_FLYOUT_VIEWPORT_PADDING_PX = 8;

type MoveSubmenuSide = "left" | "right";

function resolveMoveFlyoutSide(anchorLeft: number, mainMenuWidth: number) {
  const spaceOnRight =
    window.innerWidth -
    MOVE_FLYOUT_VIEWPORT_PADDING_PX -
    anchorLeft -
    mainMenuWidth -
    MOVE_FLYOUT_GAP_PX;
  return spaceOnRight < MOVE_FLYOUT_WIDTH_PX ? "left" : "right";
}

const menuItemClassName =
  "tcm-menu-item flex h-[35px] w-full items-center px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800";

const deleteMenuItemClassName =
  "tcm-menu-item tcm-menu-item--delete flex h-[35px] w-full items-center px-3 text-left text-sm dark:hover:bg-red-950/40";

const taskContextMenuSurfaceStyle = {
  color: TASK_CONTEXT_MENU_COLORS.textPrimary,
  ["--tcm-text-primary" as string]: TASK_CONTEXT_MENU_COLORS.textPrimary,
  ["--tcm-text-secondary" as string]: TASK_CONTEXT_MENU_COLORS.textSecondary,
  ["--tcm-icon-350" as string]: TASK_CONTEXT_MENU_COLORS.icon350,
  ["--tcm-icon-400" as string]: TASK_CONTEXT_MENU_COLORS.icon400,
  ["--tcm-icon-450" as string]: TASK_CONTEXT_MENU_COLORS.icon450,
  ["--tcm-icon-500" as string]: TASK_CONTEXT_MENU_COLORS.icon500,
  ["--tcm-icon-550" as string]: TASK_CONTEXT_MENU_COLORS.icon550,
  ["--tcm-icon-600" as string]: TASK_CONTEXT_MENU_COLORS.icon600,
  ["--tcm-icon-650" as string]: TASK_CONTEXT_MENU_COLORS.icon650,
  ["--tcm-tag-icon" as string]: TASK_CONTEXT_MENU_COLORS.tagIcon,
  ["--tcm-delete-icon" as string]: TASK_CONTEXT_MENU_COLORS.deleteIcon,
  ["--tcm-delete-text" as string]: TASK_CONTEXT_MENU_COLORS.deleteText,
  ["--tcm-delete-icon-hover" as string]:
    TASK_CONTEXT_MENU_COLORS.deleteIconHover,
} as const;

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
  dateShortcutVariant = "full",
  moveSubmenuSide = "right",
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
  | "dateShortcutVariant"
> & {
  onMoveMouseEnter?: () => void;
  onMoveMouseLeave?: () => void;
  moveSubmenuSide?: MoveSubmenuSide;
}) {
  const menuWidthClass =
    hasDueDateActions || hasPriorityActions ? "w-[196px]" : "w-36";
  const prioritySelector = hasPriorityActions ? (
    <TaskPrioritySelector
      selectedPriority={task.priority}
      tone="contextMenu"
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
          variant={dateShortcutVariant}
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
                className="tcm-icon size-[19px]! mb-[1.5px] dark:text-zinc-400"
                style={{
                  color: "var(--tcm-icon-350)",
                  ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon350,
                  ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon400,
                }}
              />
            </span>
            <span
              className="text-[15px]"
              style={taskContextMenuTextColor("textSecondary")}
            >
              Move to
            </span>
          </span>
          {moveSubmenuSide === "left" ? (
            <BiChevronLeft
              className="tcm-icon size-5 shrink-0"
              style={{
                color: "var(--tcm-icon-350)",
                ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon350,
                ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon400,
              }}
              aria-hidden
            />
          ) : (
            <BiChevronRight
              className="tcm-icon size-5 shrink-0"
              style={{
                color: "var(--tcm-icon-350)",
                ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon350,
                ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon400,
              }}
              aria-hidden
            />
          )}
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
                className="tcm-icon size-[20px]! dark:text-zinc-400"
                style={{
                  color: "var(--tcm-tag-icon)",
                  ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.tagIcon,
                  ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon450,
                }}
              />
            </span>
            <span
              className="text-[15px]"
              style={taskContextMenuTextColor("textSecondary")}
            >
              {task.labels.length > 0 ? "Labels" : "Add label"}
            </span>
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
              <span
                className="tcm-icon flex items-center justify-center dark:text-zinc-400"
                style={{
                  color: "var(--tcm-icon-400)",
                  ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon400,
                  ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon450,
                }}
              >
                <TaskListSubtaskIcon className="size-[19px]!" />
              </span>
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
                className="tcm-icon size-[20px] dark:text-zinc-400"
                style={{
                  color: "var(--tcm-icon-500)",
                  ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon500,
                  ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon550,
                }}
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
                className="tcm-icon size-[19px]! dark:text-zinc-400"
                style={{
                  transform: "scaleX(0.87)",
                  color: "var(--tcm-icon-600)",
                  ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon600,
                  ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon650,
                }}
              />
            </span>
            {task.isNote ? "convert to Task" : "convert to Note"}
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
                className="tcm-icon size-[15px] dark:text-zinc-400"
                style={{
                  color: "var(--tcm-icon-450)",
                  ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.icon450,
                  ["--tcm-icon-hover" as string]: TASK_CONTEXT_MENU_COLORS.icon500,
                }}
              />
            </span>
            Duplicate
          </span>
        </button>
      ) : null}
      {hasDeleteActions ? (
        <>
          <div role="separator" className="mx-4 border-t border-[#f3f3f5]" />
          <button
            type="button"
            role="menuitem"
            className={`${deleteMenuItemClassName} group -ml-[3px] cursor-pointer`}
            style={taskContextMenuTextColor("deleteText")}
       
            onClick={(event) => {
              event.stopPropagation();
              onDeleteTask();
            }}
          >
            <span className={menuItemWithIconClassName}>
              <span className={deleteMenuItemIconSlotClassName}>
                <RiDeleteBinLine
                  className="tcm-icon !size-[18px] ml-[3px] mb-[1px] dark:text-red-400"
                  strokeWidth={0.2}
                  style={{
                    transform: "scaleX(0.87)",
                    color: "var(--tcm-delete-icon)",
                    ["--tcm-icon" as string]: TASK_CONTEXT_MENU_COLORS.deleteIcon,
                    ["--tcm-icon-hover" as string]:
                      TASK_CONTEXT_MENU_COLORS.deleteIconHover,
                  }}
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
  dateShortcutVariant = "full",
}: TaskRowContextMenuProps) {
  const [isMoveHoverPreviewOpen, setIsMoveHoverPreviewOpen] = useState(false);
  const [moveSubmenuSide, setMoveSubmenuSide] =
    useState<MoveSubmenuSide>("right");
  const moveHoverCloseTimerRef = useRef<number | null>(null);
  const moveFlyoutRowRef = useRef<HTMLDivElement>(null);

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

  const estimateMainMenuWidth =
    hasDueDateActions || hasPriorityActions ? 196 : 144;

  const updateMoveSubmenuSide = () => {
    if (!showMoveFlyout) {
      setMoveSubmenuSide("right");
      return;
    }

    const row = moveFlyoutRowRef.current;
    let anchorLeft = fixedPosition?.x ?? 0;
    let mainMenuWidth = estimateMainMenuWidth;

    if (row) {
      const mainMenu = row.querySelector(':scope > [role="menu"]');
      if (mainMenu instanceof HTMLElement) {
        mainMenuWidth = mainMenu.getBoundingClientRect().width;
      }
      anchorLeft = row.getBoundingClientRect().left;
    }

    setMoveSubmenuSide(resolveMoveFlyoutSide(anchorLeft, mainMenuWidth));
  };

  useLayoutEffect(() => {
    updateMoveSubmenuSide();
  }, [
    estimateMainMenuWidth,
    fixedPosition?.x,
    fixedPosition?.y,
    showMoveFlyout,
    view,
  ]);

  useEffect(() => {
    if (!showMoveFlyout) return;

    const handleResize = () => updateMoveSubmenuSide();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [showMoveFlyout]);

  const mainMenuProps = {
    task,
    view: showMoveFlyout ? ("moveTo" as const) : view,
    moveSubmenuSide,
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
    dateShortcutVariant,
  };

  const moveFlyoutAutoFocus = view === "moveTo";

  const moveFlyoutRow = (
    <div
      ref={moveFlyoutRowRef}
      className={`flex items-start gap-1 ${
        moveSubmenuSide === "left" ? "flex-row-reverse" : ""
      }`}
      onMouseEnter={openMoveHoverPreview}
      onMouseLeave={scheduleCloseMoveHoverPreview}
    >
      <MainMenuItems {...mainMenuProps} />
      <div
        className={moveSubmenuSide === "left" ? "-mr-0.75" : "-ml-0.75"}
        onMouseEnter={openMoveHoverPreview}
      >
        <TaskMoveToSelector
          lists={lists}
          currentListId={currentListId}
          query={moveQuery}
          onQueryChange={onMoveQueryChange}
          onSelectList={onMoveTaskToList}
          onCancel={onClose}
          autoFocus={moveFlyoutAutoFocus}
          tone="contextMenu"
        />
      </div>
    </div>
  );

  const fixedLeftOffset =
    fixedPosition && showMoveFlyout && moveSubmenuSide === "left"
      ? -(MOVE_FLYOUT_WIDTH_PX + MOVE_FLYOUT_GAP_PX)
      : 0;

  const menu = (
    <div
      className="task-list-context-menu"
      style={taskContextMenuSurfaceStyle}
    >
      {view === "main" && !showMoveFlyout && <MainMenuItems {...mainMenuProps} />}

      {view === "main" && showMoveFlyout ? moveFlyoutRow : null}

      {view === "moveTo" ? moveFlyoutRow : null}

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
          tone="contextMenu"
        />
      )}
    </div>
  );

  if (fixedPosition) {
    return (
      <TaskRowMenuTransition
        className="fixed z-[100]"
        style={{
          left: fixedPosition.x + fixedLeftOffset,
          top: fixedPosition.y,
        }}
      >
        {menu}
      </TaskRowMenuTransition>
    );
  }

  return menu;
}
