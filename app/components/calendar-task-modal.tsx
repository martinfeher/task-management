"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { TaskDetailsPanel } from "./task-details-panel";

export type CalendarTaskSnapshot = {
  name: string;
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
}: CalendarTaskModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close task editor"
        className="absolute inset-0 bg-zinc-900/25 backdrop-brightness-[1.1]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        className="relative z-10 flex h-[min(85vh,820px)] w-full min-w-[600px] max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-[#fbfbfc] shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close task editor"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <LuX className="size-4" />
        </button>

        <div className="min-h-0 flex-1 overflow-hidden">
          <TaskDetailsPanel
            taskId={taskId}
            taskSnapshot={taskSnapshot}
            onDetailsSaved={onDetailsSaved}
            onTaskHasDetailsKnown={onTaskHasDetailsKnown}
            onTaskRenamed={onTaskRenamed}
            onDueDateUpdated={onDueDateUpdated}
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
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: task.dueTimeZone,
  };
}
