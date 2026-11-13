"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  TaskDetailsPanel,
  type TaskDetailsSaveController,
} from "./task-details-panel";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  CALENDAR_TASK_MODAL_CONTENT_SWITCH_MS,
  CALENDAR_TASK_MODAL_MIN_HEIGHT_PX,
  CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX,
  CALENDAR_TASK_MODAL_WIDTH_PX,
  type CalendarTaskModalAnchorRect,
} from "@/lib/calendar-task-modal-position";
import {
  useCalendarTaskModalActions,
  useCalendarTaskModalTask,
} from "./calendar-task-modal-actions";
import { CALENDAR_SIDEBAR_HOVER_PREVIEW_TRANSITION_MS } from "@/lib/calendar-sidebar-hover-preview";

export {
  getCalendarTaskClickAnchorRect,
  type CalendarTaskModalAnchorRect,
} from "@/lib/calendar-task-modal-position";

export type CalendarTaskSnapshot = {
  name: string;
  completed: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
};

export type CalendarTaskEditorCallbacks = {
  onDetailsSaved: (taskId: string, details: string) => void;
  onTaskHasDetailsKnown?: (taskId: string, hasDetails: boolean) => void;
  onTaskRenamed: (taskId: string, name: string) => void;
  onDueDateUpdated: (
    taskId: string,
    dueDate: string | null,
    dueTime?: {
      dueTimeMinutes: number | null;
      dueDurationMinutes: number | null;
      dueTimeZone: string;
    },
  ) => void;
  onRecurrenceUpdated?: (taskId: string, recurrenceRule: string | null) => void;
  onSaveTaskRecurrence?: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => Promise<void>;
  onToggleTask?: (taskId: string) => void;
};

type CalendarTaskModalProps = {
  taskId: string;
  taskSnapshot?: CalendarTaskSnapshot | null;
  anchorRect?: CalendarTaskModalAnchorRect | null;
  isNewTaskDraft?: boolean;
  /** Sidebar hover: centered modal without blocking the rest of the calendar. */
  isHoverPreview?: boolean;
  hoverPreviewVisible?: boolean;
  /** When false, no dimming overlay (e.g. calendar sidebar task list). */
  showBackdrop?: boolean;
  onHoverPreviewPointerEnter?: () => void;
  onHoverPreviewPointerLeave?: () => void;
  /** Schedule order (e.g. sidebar upcoming list) for header prev/next controls. */
  navigableTaskIds?: string[];
  onNavigateTask?: (taskId: string) => void;
  onNewTaskDraftComplete?: () => void;
  onClose: () => void;
} & CalendarTaskEditorCallbacks;

export function CalendarTaskModal({
  taskId,
  taskSnapshot = null,
  anchorRect: _anchorRect = null,
  isNewTaskDraft = false,
  isHoverPreview = false,
  hoverPreviewVisible = true,
  showBackdrop = true,
  onHoverPreviewPointerEnter,
  onHoverPreviewPointerLeave,
  navigableTaskIds,
  onNavigateTask,
  onNewTaskDraftComplete,
  onClose,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onToggleTask,
}: CalendarTaskModalProps) {
  const [focusNoteAtEndRequest, setFocusNoteAtEndRequest] = useState(0);
  const detailsSaveControllerRef = useRef<TaskDetailsSaveController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const skipTaskContentSwitchAnimationRef = useRef(true);
  const modalActions = useCalendarTaskModalActions();
  const shouldAnimateTaskContentSwitch = !isHoverPreview && !isNewTaskDraft;
  const [displayedTaskId, setDisplayedTaskId] = useState(taskId);
  const [contentSwitchPhase, setContentSwitchPhase] = useState<
    "idle" | "out" | "in"
  >("idle");
  const modalTask = useCalendarTaskModalTask(displayedTaskId);
  const displayedTaskSnapshot = useMemo(() => {
    const fromTasks = getCalendarTaskSnapshot(
      displayedTaskId,
      modalActions?.tasks ?? [],
    );
    if (fromTasks) return fromTasks;
    if (displayedTaskId === taskId) return taskSnapshot;
    return taskSnapshot;
  }, [displayedTaskId, modalActions?.tasks, taskId, taskSnapshot]);
  const isTaskContentSwitching = contentSwitchPhase !== "idle";

  const registerDetailsSaveController = useCallback(
    (controller: TaskDetailsSaveController | null) => {
      detailsSaveControllerRef.current = controller;
    },
    [],
  );

  const handleClose = useCallback(async () => {
    await detailsSaveControllerRef.current?.flushSave();
    onClose();
  }, [onClose]);

  const handleMarkTaskComplete = useCallback(
    async (toggleTaskId: string) => {
      await detailsSaveControllerRef.current?.flushSave();
      onToggleTask?.(toggleTaskId);
      onClose();
    },
    [onClose, onToggleTask],
  );

  const handleCreateNewTask = useCallback(async () => {
    await detailsSaveControllerRef.current?.flushSave();
    onNewTaskDraftComplete?.();
    onClose();
  }, [onClose, onNewTaskDraftComplete]);

  const modalCreateAction = useMemo(
    () =>
      isNewTaskDraft
        ? {
            label: "Create",
            onClick: handleCreateNewTask,
          }
        : null,
    [handleCreateNewTask, isNewTaskDraft],
  );

  const navigableIndex =
    navigableTaskIds?.indexOf(taskId) ?? -1;

  const handleNavigateToTask = useCallback(
    async (targetTaskId: string) => {
      await detailsSaveControllerRef.current?.flushSave();
      onNavigateTask?.(targetTaskId);
    },
    [onNavigateTask],
  );

  const modalTaskNavigation = useMemo(() => {
    if (
      isNewTaskDraft ||
      !navigableTaskIds?.length ||
      navigableIndex < 0 ||
      !onNavigateTask
    ) {
      return null;
    }

    const canGoPrevious = navigableIndex > 0;
    const canGoNext = navigableIndex < navigableTaskIds.length - 1;
    const taskNameById = new Map(
      modalActions?.tasks.map((task) => [task.id, task.name] as const) ?? [],
    );
    const previousTaskId = canGoPrevious
      ? navigableTaskIds[navigableIndex - 1]
      : null;
    const nextTaskId = canGoNext
      ? navigableTaskIds[navigableIndex + 1]
      : null;

    return {
      canGoPrevious,
      canGoNext,
      previousTaskTitle: previousTaskId
        ? (taskNameById.get(previousTaskId) ?? null)
        : null,
      nextTaskTitle: nextTaskId ? (taskNameById.get(nextTaskId) ?? null) : null,
      onPrevious:
        canGoPrevious && !isTaskContentSwitching
          ? () => void handleNavigateToTask(navigableTaskIds[navigableIndex - 1])
          : undefined,
      onNext:
        canGoNext && !isTaskContentSwitching
          ? () => void handleNavigateToTask(navigableTaskIds[navigableIndex + 1])
          : undefined,
    };
  }, [
    handleNavigateToTask,
    isNewTaskDraft,
    isTaskContentSwitching,
    modalActions?.tasks,
    navigableIndex,
    navigableTaskIds,
    onNavigateTask,
  ]);

  const modalFooterConfig = useMemo(
    () =>
      modalActions
        ? {
            listId: modalTask?.listId ?? null,
            priority: modalTask?.priority ?? null,
            assignedLabelIds: modalTask?.labels.map((label) => label.id) ?? [],
            lists: modalActions.lists,
            labels: modalActions.labels,
            onSetTaskPriority: modalActions.onSetTaskPriority,
            onToggleTaskLabel: modalActions.onToggleTaskLabel,
            onLabelsChanged: modalActions.onLabelsChanged,
            onMoveTaskToList: modalActions.onMoveTaskToList,
            onDeleteTask: modalActions.onDeleteTask
              ? async (deletedTaskId: string) => {
                  await modalActions.onDeleteTask?.(deletedTaskId);
                  await handleClose();
                }
              : undefined,
            showLabelsAfterCopyLink: true,
            openMenusOnHover: true,
            hideDelete: isNewTaskDraft,
            deleteButtonVariant: "icon" as const,
          }
        : null,
    [handleClose, isNewTaskDraft, modalActions, modalTask],
  );

  useEffect(() => {
    if (skipTaskContentSwitchAnimationRef.current) {
      skipTaskContentSwitchAnimationRef.current = false;
      setDisplayedTaskId(taskId);
      setContentSwitchPhase("idle");
      return;
    }

    if (!shouldAnimateTaskContentSwitch) {
      setDisplayedTaskId(taskId);
      setContentSwitchPhase("idle");
      return;
    }

    if (taskId === displayedTaskId) return;

    if (contentSwitchPhase !== "idle") return;

    setContentSwitchPhase("out");
  }, [
    contentSwitchPhase,
    displayedTaskId,
    shouldAnimateTaskContentSwitch,
    taskId,
  ]);

  useEffect(() => {
    if (contentSwitchPhase !== "out") return;

    const timer = window.setTimeout(() => {
      setDisplayedTaskId(taskId);
      setContentSwitchPhase("in");
    }, CALENDAR_TASK_MODAL_CONTENT_SWITCH_MS);

    return () => window.clearTimeout(timer);
  }, [contentSwitchPhase, taskId]);

  useEffect(() => {
    if (contentSwitchPhase !== "in") return;

    const timer = window.setTimeout(() => {
      setContentSwitchPhase("idle");
    }, CALENDAR_TASK_MODAL_CONTENT_SWITCH_MS);

    return () => window.clearTimeout(timer);
  }, [contentSwitchPhase]);

  useEffect(() => {
    setFocusNoteAtEndRequest((current) => current + 1);
  }, [displayedTaskId]);

  useEffect(() => {
    if (isHoverPreview || !showBackdrop) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isHoverPreview, showBackdrop]);

  const allowBackgroundInteraction = isHoverPreview || !showBackdrop;

  const dialogClassName =
    "calendar-task-modal relative z-10 flex h-auto min-h-0 max-h-[calc(100vh-48px)] flex-col overflow-hidden bg-white dark:bg-zinc-950";

  useLayoutEffect(() => {
    dialogRef.current?.scrollTo({ top: 0 });
  }, [taskId]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[10050] flex items-center justify-center ${
        allowBackgroundInteraction ? "pointer-events-none" : ""
      }`}
      style={{ padding: CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX }}
    >
      {showBackdrop ? (
        isHoverPreview ? (
          <div
            className="pointer-events-none fixed inset-0 bg-zinc-900/15 backdrop-brightness-[1.05] dark:bg-zinc-950/40"
            aria-hidden
          />
        ) : (
          <button
            type="button"
            aria-label="Close task editor"
            className="fixed inset-0 bg-zinc-900/25 backdrop-brightness-[1.1]"
            onClick={() => void handleClose()}
          />
        )
      ) : null}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={allowBackgroundInteraction ? undefined : true}
        aria-label={isHoverPreview ? "Task preview" : "Edit task"}
        className={`${dialogClassName} ${
          isHoverPreview
            ? `${hoverPreviewVisible ? "pointer-events-auto" : "pointer-events-none"} shadow-[0_10px_23px_rgba(0,0,0,0.09)] ring-1 ring-zinc-200/80 transition-[opacity,transform] ease-[cubic-bezier(0.22,1,0.36,1)] dark:ring-zinc-800 ${
                hoverPreviewVisible
                  ? "scale-100 opacity-100"
                  : "scale-[0.985] opacity-0"
              }`
            : ""
        }`}
        style={{
          width: CALENDAR_TASK_MODAL_WIDTH_PX,
          minHeight: CALENDAR_TASK_MODAL_MIN_HEIGHT_PX,
          ...(isHoverPreview
            ? {
                transitionDuration: `${CALENDAR_SIDEBAR_HOVER_PREVIEW_TRANSITION_MS}ms`,
              }
            : undefined),
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseEnter={isHoverPreview ? onHoverPreviewPointerEnter : undefined}
        onMouseLeave={isHoverPreview ? onHoverPreviewPointerLeave : undefined}
      >
        <div
          className={`calendar-task-modal-content-transition flex min-h-0 flex-1 flex-col ${
            contentSwitchPhase === "out"
              ? "calendar-task-modal-content-transition--out"
              : contentSwitchPhase === "in"
                ? "calendar-task-modal-content-transition--in"
                : ""
          }`}
          style={
            isTaskContentSwitching ? { pointerEvents: "none" } : undefined
          }
        >
          <TaskDetailsPanel
            taskId={displayedTaskId}
            taskSnapshot={displayedTaskSnapshot}
            layout="modal"
            focusNoteAtEndRequest={focusNoteAtEndRequest}
            registerSaveController={registerDetailsSaveController}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
            onRecurrenceUpdated={onRecurrenceUpdated}
            onSaveTaskRecurrence={onSaveTaskRecurrence}
            onToggleTask={onToggleTask}
            onMarkTaskComplete={
              onToggleTask ? handleMarkTaskComplete : undefined
            }
            onClose={() => void handleClose()}
            modalFooterConfig={modalFooterConfig}
            modalCreateAction={modalCreateAction}
            modalTaskNavigation={modalTaskNavigation}
            hideModalFormatToggle
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function getCalendarTaskSnapshot(
  taskId: string,
  tasks: Array<{
    id: string;
    name: string;
    completed: boolean;
    dueDate: string | null;
    dueTimeMinutes: number | null;
    dueDurationMinutes: number | null;
    dueTimeZone: string;
  }>,
): CalendarTaskSnapshot | null {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return null;

  return {
    name: task.name,
    completed: task.completed,
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: task.dueTimeZone,
  };
}
