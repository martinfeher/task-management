"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCheck, LuX } from "react-icons/lu";
import {
  TaskDetailsPanel,
  type TaskDetailsSaveController,
} from "./task-details-panel";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  useCalendarTaskModalActions,
  useCalendarTaskModalTask,
} from "./calendar-task-modal-actions";

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
  onClose: () => void;
} & CalendarTaskEditorCallbacks;

export function CalendarTaskModal({
  taskId,
  taskSnapshot = null,
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
  const modalActions = useCalendarTaskModalActions();
  const modalTask = useCalendarTaskModalTask(taskId);
  const showMarkComplete =
    Boolean(onToggleTask) &&
    modalTask !== null &&
    !modalTask.completed &&
    !modalTask.isNote;

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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close task editor"
        className="absolute inset-0 bg-zinc-900/25 backdrop-brightness-[1.1]"
        onClick={() => void handleClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        className="calendar-task-modal relative z-10 flex h-[min(85vh,820px)] w-full min-w-[600px] max-w-4xl flex-col overflow-hidden bg-white dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
          {showMarkComplete ? (
            <button
              type="button"
              onClick={() => onToggleTask?.(taskId)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#e6e9ec] bg-white py-[5px] pl-2 pr-[9px] text-[12px] font-normal text-[#454545] transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <LuCheck className="size-3.5 shrink-0" aria-hidden="true" />
              Mark complete
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Close task editor"
            onClick={() => void handleClose()}
            className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors cursor-pointer hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LuX className="size-4 cursor-pointer" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
