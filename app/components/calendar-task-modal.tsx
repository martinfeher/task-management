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
  computeCalendarTaskModalStyle,
  getCalendarTaskModalWidth,
  type CalendarTaskModalAnchorRect,
} from "@/lib/calendar-task-modal-position";
import {
  useCalendarTaskModalActions,
  useCalendarTaskModalTask,
} from "./calendar-task-modal-actions";

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
  onClose: () => void;
} & CalendarTaskEditorCallbacks;

export function CalendarTaskModal({
  taskId,
  taskSnapshot = null,
  anchorRect = null,
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
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const detailsSaveControllerRef = useRef<TaskDetailsSaveController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalActions = useCalendarTaskModalActions();
  const modalTask = useCalendarTaskModalTask(taskId);
  const isAnchored = anchorRect !== null;

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
          }
        : null,
    [handleClose, modalActions, modalTask],
  );

  useEffect(() => {
    setFocusNoteAtEndRequest((current) => current + 1);
  }, [taskId]);

  useEffect(() => {
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
  }, [handleClose]);

  useLayoutEffect(() => {
    if (!anchorRect) return;

    function updateViewportWidth() {
      setViewportWidth(window.innerWidth);
    }

    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);

    return () => {
      window.removeEventListener("resize", updateViewportWidth);
    };
  }, [anchorRect, taskId]);

  const anchoredStyle = useMemo(() => {
    if (!anchorRect) return null;

    const measuredWidth = dialogRef.current?.getBoundingClientRect().width;
    const modalWidth =
      measuredWidth ||
      getCalendarTaskModalWidth(viewportWidth ?? window.innerWidth);

    return computeCalendarTaskModalStyle(anchorRect, modalWidth);
  }, [anchorRect, viewportWidth, taskId]);

  const dialogClassName = isAnchored
    ? "calendar-task-modal relative z-10 flex min-w-[600px] max-w-4xl flex-col overflow-hidden overflow-y-auto bg-white dark:bg-zinc-950"
    : "calendar-task-modal relative z-10 mx-auto flex w-full min-w-[600px] max-w-4xl flex-col overflow-hidden bg-white dark:bg-zinc-950";

  return createPortal(
    <div
      className={
        isAnchored
          ? "fixed inset-0 z-[100]"
          : "fixed inset-0 z-[100] overflow-y-auto px-6 py-6"
      }
    >
      <button
        type="button"
        aria-label="Close task editor"
        className="fixed inset-0 bg-zinc-900/25 backdrop-brightness-[1.1]"
        onClick={() => void handleClose()}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        className={dialogClassName}
        style={isAnchored ? anchoredStyle ?? undefined : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col">
          <TaskDetailsPanel
            taskId={taskId}
            taskSnapshot={taskSnapshot}
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
            onClose={() => void handleClose()}
            modalFooterConfig={modalFooterConfig}
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
