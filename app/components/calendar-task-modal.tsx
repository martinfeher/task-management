"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { getCalendarSidebarBackdropClipStyle } from "@/lib/calendar-sidebar-backdrop-clip";
import {
  CALENDAR_TASK_MODAL_HOVER_BACKDROP_CLASS,
  CALENDAR_TASK_MODAL_PINNED_BACKDROP_CLASS,
} from "@/lib/calendar-task-modal-backdrop";
import { createPortal } from "react-dom";
import {
  TaskDetailsPanel,
  type TaskDetailsSaveController,
} from "./task-details-panel";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  CALENDAR_TASK_MODAL_CONTENT_SWITCH_MS,
  CALENDAR_TASK_MODAL_MIN_HEIGHT_PX,
  CALENDAR_TASK_MODAL_OPEN_TRANSITION_EASING,
  CALENDAR_TASK_MODAL_OPEN_TRANSITION_MS,
  CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX,
  CALENDAR_TASK_MODAL_WIDTH_PX,
  peekCalendarTaskOpenOrigin,
  type CalendarTaskModalAnchorRect,
} from "@/lib/calendar-task-modal-position";
import {
  useCalendarTaskModalActions,
  useCalendarTaskModalTask,
} from "./calendar-task-modal-actions";
import {
  CALENDAR_SIDEBAR_HOVER_PREVIEW_CLEAR_MS,
  CALENDAR_SIDEBAR_HOVER_PREVIEW_TRANSITION_MS,
} from "@/lib/calendar-sidebar-hover-preview";
import { CalendarModalNavigationTaskPreview } from "./calendar-modal-navigation-task-preview";
import type { TaskListItem } from "./todo-app";

export {
  getCalendarTaskClickAnchorRect,
  type CalendarTaskModalAnchorRect,
} from "@/lib/calendar-task-modal-position";

/** Width of the modal when shrunk behind an image preview overlay. */
const CALENDAR_TASK_MODAL_MINIMIZED_WIDTH_PX = 100;
const CALENDAR_TASK_MODAL_MINIMIZED_MARGIN_PX = 20;

export type CalendarTaskSnapshot = {
  name: string;
  completed: boolean;
  isNote?: boolean;
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
  /** Clip the dimming layer so an open task sidebar stays undimmed. */
  sidebarBackdropClip?: {
    enabled: boolean;
    sidebarRef: RefObject<HTMLElement | null>;
    sidebarPosition: "left" | "right";
  };
  onHoverPreviewPointerEnter?: () => void;
  onHoverPreviewPointerLeave?: () => void;
  /** Schedule order (e.g. sidebar upcoming list) for header prev/next controls. */
  navigableTaskIds?: string[];
  onNavigateTask?: (taskId: string) => void;
  onNewTaskDraftComplete?: () => void;
  onClose: () => void;
  /** Leave modal and show this task in the list + details panel layout. */
  onExpandToTaskPanel?: (taskId: string) => void | Promise<void>;
} & CalendarTaskEditorCallbacks;

export function CalendarTaskModal({
  taskId,
  taskSnapshot = null,
  anchorRect: _anchorRect = null,
  isNewTaskDraft = false,
  isHoverPreview = false,
  hoverPreviewVisible = true,
  showBackdrop = true,
  sidebarBackdropClip,
  onHoverPreviewPointerEnter,
  onHoverPreviewPointerLeave,
  navigableTaskIds,
  onNavigateTask,
  onNewTaskDraftComplete,
  onClose,
  onExpandToTaskPanel,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onToggleTask,
}: CalendarTaskModalProps) {
  const [focusNoteAtEndRequest, setFocusNoteAtEndRequest] = useState(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [imagePreviewCloseRequest, setImagePreviewCloseRequest] = useState(0);
  const [minimizedTransform, setMinimizedTransform] = useState<string | null>(
    null,
  );
  const detailsSaveControllerRef = useRef<TaskDetailsSaveController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const skipTaskContentSwitchAnimationRef = useRef(true);
  const modalActions = useCalendarTaskModalActions();
  const shouldAnimateTaskContentSwitch = !isHoverPreview && !isNewTaskDraft;
  const [displayedTaskId, setDisplayedTaskId] = useState(taskId);
  const [contentSwitchPhase, setContentSwitchPhase] = useState<
    "idle" | "in"
  >("idle");
  const modalTask = useCalendarTaskModalTask(displayedTaskId);
  const navPreviewClearTimerRef = useRef<number | null>(null);
  const [navigationPreview, setNavigationPreview] = useState<{
    task: TaskListItem;
    anchorRect: DOMRect;
  } | null>(null);
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

  const deleteEmptyNewTaskDraft = useCallback(async (): Promise<boolean> => {
    if (!isNewTaskDraft) return false;
    if (detailsSaveControllerRef.current?.hasCreateTitle?.() === true) {
      return false;
    }
    await modalActions?.onDeleteTask?.(taskId);
    onNewTaskDraftComplete?.();
    return true;
  }, [
    isNewTaskDraft,
    modalActions,
    onNewTaskDraftComplete,
    taskId,
  ]);

  const handleClose = useCallback(async () => {
    if (await deleteEmptyNewTaskDraft()) {
      onClose();
      return;
    }
    await detailsSaveControllerRef.current?.flushSave();
    onClose();
  }, [deleteEmptyNewTaskDraft, onClose]);

  const handleMarkTaskComplete = useCallback(
    async (toggleTaskId: string) => {
      await detailsSaveControllerRef.current?.flushSave();
      onToggleTask?.(toggleTaskId);
      onClose();
    },
    [onClose, onToggleTask],
  );

  const handleCreateNewTask = useCallback(async () => {
    if (detailsSaveControllerRef.current?.hasCreateTitle?.() === false) {
      return;
    }
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
      setNavigationPreview(null);
      await detailsSaveControllerRef.current?.flushSave();
      onNavigateTask?.(targetTaskId);
    },
    [onNavigateTask],
  );

  const cancelNavigationPreviewClear = useCallback(() => {
    if (navPreviewClearTimerRef.current !== null) {
      window.clearTimeout(navPreviewClearTimerRef.current);
      navPreviewClearTimerRef.current = null;
    }
  }, []);

  const handleNavigationPreviewChange = useCallback(
    (previewTaskId: string | null, anchor?: DOMRect) => {
      cancelNavigationPreviewClear();
      if (previewTaskId && anchor) {
        const task =
          modalActions?.tasks.find((item) => item.id === previewTaskId) ??
          null;
        if (!task) {
          setNavigationPreview(null);
          return;
        }
        setNavigationPreview({
          task,
          anchorRect: DOMRect.fromRect(anchor),
        });
        return;
      }

      navPreviewClearTimerRef.current = window.setTimeout(() => {
        setNavigationPreview(null);
        navPreviewClearTimerRef.current = null;
      }, CALENDAR_SIDEBAR_HOVER_PREVIEW_CLEAR_MS);
    },
    [cancelNavigationPreviewClear, modalActions?.tasks],
  );

  const handleNavigationPreviewPointerEnter = useCallback(() => {
    cancelNavigationPreviewClear();
  }, [cancelNavigationPreviewClear]);

  const handleNavigationPreviewPointerLeave = useCallback(() => {
    handleNavigationPreviewChange(null);
  }, [handleNavigationPreviewChange]);

  const handleNavigationPreviewOpen = useCallback(
    (targetTaskId: string) => {
      cancelNavigationPreviewClear();
      setNavigationPreview(null);
      void handleNavigateToTask(targetTaskId);
    },
    [cancelNavigationPreviewClear, handleNavigateToTask],
  );

  useEffect(() => {
    return () => {
      cancelNavigationPreviewClear();
    };
  }, [cancelNavigationPreviewClear]);

  useEffect(() => {
    setNavigationPreview(null);
  }, [taskId]);

  const handleExpandToTaskPanel = useCallback(() => {
    if (!onExpandToTaskPanel || isNewTaskDraft || isHoverPreview) return;
    void onExpandToTaskPanel(displayedTaskId);
  }, [
    displayedTaskId,
    isHoverPreview,
    isNewTaskDraft,
    onExpandToTaskPanel,
  ]);

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
    const taskById = new Map(
      modalActions?.tasks.map((task) => [task.id, task] as const) ?? [],
    );
    const previousTaskId = canGoPrevious
      ? navigableTaskIds[navigableIndex - 1]
      : null;
    const nextTaskId = canGoNext
      ? navigableTaskIds[navigableIndex + 1]
      : null;
    const previousTask = previousTaskId
      ? (taskById.get(previousTaskId) ?? null)
      : null;
    const nextTask = nextTaskId ? (taskById.get(nextTaskId) ?? null) : null;

    return {
      canGoPrevious,
      canGoNext,
      previousTaskId,
      nextTaskId,
      previousTaskTitle: previousTask?.name ?? null,
      nextTaskTitle: nextTask?.name ?? null,
      previousTask,
      nextTask,
      onNavigationPreviewChange: handleNavigationPreviewChange,
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
    handleNavigationPreviewChange,
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

    setDisplayedTaskId(taskId);
    setContentSwitchPhase("in");
  }, [displayedTaskId, shouldAnimateTaskContentSwitch, taskId]);

  useEffect(() => {
    if (contentSwitchPhase !== "in") return;

    const timer = window.setTimeout(() => {
      setContentSwitchPhase("idle");
    }, CALENDAR_TASK_MODAL_CONTENT_SWITCH_MS);

    return () => window.clearTimeout(timer);
  }, [contentSwitchPhase]);

  useEffect(() => {
    if (isHoverPreview) return;
    setFocusNoteAtEndRequest((current) => current + 1);
  }, [displayedTaskId, isHoverPreview]);

  useEffect(() => {
    if (isHoverPreview || !showBackdrop) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      void handleClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isHoverPreview, showBackdrop]);

  const clipSidebarBackdrop =
    showBackdrop &&
    !isHoverPreview &&
    sidebarBackdropClip?.enabled === true;

  const [backdropClipStyle, setBackdropClipStyle] =
    useState<CSSProperties | null>(null);

  const allowBackgroundInteraction = isHoverPreview || !showBackdrop;
  const leaveSidebarInteractive =
    clipSidebarBackdrop && !allowBackgroundInteraction;

  const dialogClassName = isHoverPreview
    ? "calendar-task-modal relative z-10 flex h-auto min-h-0 max-h-[calc(100vh-48px)] flex-col overflow-hidden bg-[#efefef] dark:bg-zinc-950"
    : "calendar-task-modal relative z-10 flex h-[min(var(--calendar-task-modal-height),calc(100vh-48px))] min-h-0 flex-col overflow-hidden bg-[#efefef] dark:bg-zinc-950";

  useLayoutEffect(() => {
    dialogRef.current?.scrollTo({ top: 0 });
  }, [taskId]);

  // Calendar item -> modal: a ghost in the item's color grows from the clicked
  // item's rectangle to the modal's rectangle while the modal fades in on top.
  useLayoutEffect(() => {
    if (isHoverPreview || isNewTaskDraft || !showBackdrop) return;

    const dialog = dialogRef.current;
    const container = dialog?.parentElement;
    if (!dialog || !container || typeof dialog.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const origin = peekCalendarTaskOpenOrigin();
    if (!origin) return;

    const target = dialog.getBoundingClientRect();
    if (target.width <= 0 || target.height <= 0) return;

    const surface =
      dialog.querySelector<HTMLElement>(".task-details-panel-background") ??
      dialog;
    const targetBackground = window.getComputedStyle(surface).backgroundColor;
    const targetRadius = window.getComputedStyle(dialog).borderTopLeftRadius;

    const ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
      position: "fixed",
      zIndex: "5",
      pointerEvents: "none",
      left: `${origin.rect.left}px`,
      top: `${origin.rect.top}px`,
      width: `${origin.rect.width}px`,
      height: `${origin.rect.height}px`,
      backgroundColor: origin.backgroundColor,
      borderRadius: origin.borderRadius,
    });
    container.insertBefore(ghost, dialog);

    const ghostAnimation = ghost.animate(
      [
        {
          left: `${origin.rect.left}px`,
          top: `${origin.rect.top}px`,
          width: `${origin.rect.width}px`,
          height: `${origin.rect.height}px`,
          backgroundColor: origin.backgroundColor,
          borderRadius: origin.borderRadius,
          boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
        },
        {
          left: `${target.left}px`,
          top: `${target.top}px`,
          width: `${target.width}px`,
          height: `${target.height}px`,
          backgroundColor: targetBackground,
          borderRadius: targetRadius,
          boxShadow: "0 10px 23px rgba(0, 0, 0, 0.09)",
        },
      ],
      {
        duration: CALENDAR_TASK_MODAL_OPEN_TRANSITION_MS,
        easing: CALENDAR_TASK_MODAL_OPEN_TRANSITION_EASING,
        fill: "forwards",
      },
    );
    ghostAnimation.onfinish = () => ghost.remove();

    // Hold the real modal back until the ghost is nearly full size, then fade in.
    const dialogAnimation = dialog.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }],
      {
        duration: CALENDAR_TASK_MODAL_OPEN_TRANSITION_MS,
        easing: "linear",
        fill: "backwards",
      },
    );

    return () => {
      ghostAnimation.cancel();
      dialogAnimation.cancel();
      ghost.remove();
    };
  }, [isHoverPreview, isNewTaskDraft, showBackdrop]);

  /** While an image preview covers the modal, shrink it to a small clickable chip bottom-right. */
  const isMinimizedForImagePreview = isImagePreviewOpen && !isHoverPreview;

  useLayoutEffect(() => {
    if (!isMinimizedForImagePreview) {
      setMinimizedTransform(null);
      return;
    }

    function updateMinimizedTransform() {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const width = dialog.offsetWidth;
      const height = dialog.offsetHeight;
      if (width === 0 || height === 0) return;

      const scale = CALENDAR_TASK_MODAL_MINIMIZED_WIDTH_PX / width;
      const scaledHeight = height * scale;
      // The dialog is centered in the viewport (symmetric padding), so offsets are
      // measured from the viewport center to the target chip center.
      const targetCenterX =
        window.innerWidth -
        CALENDAR_TASK_MODAL_MINIMIZED_MARGIN_PX -
        CALENDAR_TASK_MODAL_MINIMIZED_WIDTH_PX / 2;
      const targetCenterY =
        window.innerHeight -
        CALENDAR_TASK_MODAL_MINIMIZED_MARGIN_PX -
        scaledHeight / 2;
      const dx = targetCenterX - window.innerWidth / 2;
      const dy = targetCenterY - window.innerHeight / 2;

      setMinimizedTransform(`translate(${dx}px, ${dy}px) scale(${scale})`);
    }

    updateMinimizedTransform();
    window.addEventListener("resize", updateMinimizedTransform);
    return () => window.removeEventListener("resize", updateMinimizedTransform);
  }, [isMinimizedForImagePreview]);

  const handleRestoreFromImagePreview = useCallback(() => {
    setImagePreviewCloseRequest((current) => current + 1);
  }, []);

  useLayoutEffect(() => {
    const clipConfig = sidebarBackdropClip;
    if (!clipSidebarBackdrop || !clipConfig) {
      setBackdropClipStyle(null);
      return;
    }

    const { sidebarRef, sidebarPosition } = clipConfig;

    function updateBackdropClip() {
      setBackdropClipStyle(
        getCalendarSidebarBackdropClipStyle(
          sidebarRef.current,
          sidebarPosition,
        ),
      );
    }

    updateBackdropClip();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateBackdropClip())
        : null;
    if (observer && sidebarRef.current) {
      observer.observe(sidebarRef.current);
    }

    window.addEventListener("resize", updateBackdropClip);
    window.addEventListener("scroll", updateBackdropClip, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateBackdropClip);
      window.removeEventListener("scroll", updateBackdropClip, true);
    };
  }, [clipSidebarBackdrop, sidebarBackdropClip]);

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center ${
        isMinimizedForImagePreview ? "z-[10080]" : "z-[10050]"
      } ${
        allowBackgroundInteraction ||
        leaveSidebarInteractive ||
        isMinimizedForImagePreview
          ? "pointer-events-none"
          : ""
      }`}
      style={{ padding: CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX }}
    >
      {showBackdrop ? (
        isHoverPreview ? (
          <div
            className={`pointer-events-none fixed inset-0 ${CALENDAR_TASK_MODAL_HOVER_BACKDROP_CLASS}`}
            aria-hidden
          />
        ) : (
          <button
            type="button"
            aria-label="Close task editor"
            className={`calendar-task-modal-backdrop-fade-in fixed ${CALENDAR_TASK_MODAL_PINNED_BACKDROP_CLASS} ${
              isMinimizedForImagePreview
                ? "pointer-events-none invisible"
                : leaveSidebarInteractive
                  ? "pointer-events-auto"
                  : ""
            } ${backdropClipStyle ? "" : "inset-0"}`}
            tabIndex={isMinimizedForImagePreview ? -1 : undefined}
            style={backdropClipStyle ?? undefined}
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
            : `transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                leaveSidebarInteractive || isMinimizedForImagePreview
                  ? "pointer-events-auto"
                  : ""
              }`
        }`}
        style={{
          width: CALENDAR_TASK_MODAL_WIDTH_PX,
          ...(isHoverPreview
            ? {
                minHeight: CALENDAR_TASK_MODAL_MIN_HEIGHT_PX,
                transitionDuration: `${CALENDAR_SIDEBAR_HOVER_PREVIEW_TRANSITION_MS}ms`,
              }
            : {
                ["--calendar-task-modal-height" as string]: `${CALENDAR_TASK_MODAL_MIN_HEIGHT_PX}px`,
                transform: minimizedTransform ?? "none",
                ...(isMinimizedForImagePreview
                  ? { boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35)" }
                  : null),
              }),
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseEnter={isHoverPreview ? onHoverPreviewPointerEnter : undefined}
        onMouseLeave={isHoverPreview ? onHoverPreviewPointerLeave : undefined}
      >
        {isMinimizedForImagePreview ? (
          <button
            type="button"
            aria-label="Restore task editor"
            title="Back to task"
            onClick={handleRestoreFromImagePreview}
            className="absolute inset-0 z-[60] cursor-pointer rounded-[inherit] border-0 bg-transparent p-0 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/70"
          />
        ) : null}
        <div
          inert={isMinimizedForImagePreview}
          className={`flex h-full min-h-0 flex-1 flex-col ${
            contentSwitchPhase === "in"
              ? "calendar-task-modal-content-transition--in"
              : ""
          }`}
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
            onExpandFromModal={
              onExpandToTaskPanel && !isNewTaskDraft && !isHoverPreview
                ? handleExpandToTaskPanel
                : undefined
            }
            modalFooterConfig={modalFooterConfig}
            modalCreateAction={modalCreateAction}
            modalTaskNavigation={modalTaskNavigation}
            hideModalFormatToggle
            onImagePreviewOpenChange={setIsImagePreviewOpen}
            imagePreviewCloseRequest={imagePreviewCloseRequest}
          />
        </div>
      </div>

      {navigationPreview ? (
        <CalendarModalNavigationTaskPreview
          task={navigationPreview.task}
          anchorRect={navigationPreview.anchorRect}
          onPointerEnter={handleNavigationPreviewPointerEnter}
          onPointerLeave={handleNavigationPreviewPointerLeave}
          onOpenTask={handleNavigationPreviewOpen}
        />
      ) : null}
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
    isNote?: boolean;
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
    isNote: task.isNote,
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: task.dueTimeZone,
  };
}
