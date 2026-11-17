"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BsArchiveFill } from "react-icons/bs";
import { LuRotateCcw, LuX } from "react-icons/lu";
import type { CompletedTask } from "./todo-app";

type CompletedTasksModalProps = {
  open: boolean;
  revealOrigin?: { x: number; y: number } | null;
  tasks: CompletedTask[];
  onClose: () => void;
  onUndoTask: (taskId: string) => void | Promise<void>;
  onArchiveTask: (taskId: string) => void | Promise<void>;
  onOpenTask?: (taskId: string, listId: string) => void;
};

function getDefaultCompletedRevealOrigin() {
  return {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight * 0.12 : 0,
  };
}

export function CompletedTasksModal({
  open,
  revealOrigin = null,
  tasks,
  onClose,
  onUndoTask,
  onArchiveTask,
  onOpenTask,
}: CompletedTasksModalProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isEntered, setIsEntered] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setIsMounted(true);
    const frame = requestAnimationFrame(() => setIsEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open) return;

    setIsEntered(false);
    const timeout = window.setTimeout(() => setIsMounted(false), 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function runAction(
    taskId: string,
    action: (id: string) => void | Promise<void>,
  ) {
    setBusyTaskId(taskId);
    try {
      await action(taskId);
    } finally {
      setBusyTaskId(null);
    }
  }

  if (!isMounted) return null;

  const origin = revealOrigin ?? getDefaultCompletedRevealOrigin();
  const revealStyle = {
    "--search-reveal-x": `${origin.x}px`,
    "--search-reveal-y": `${origin.y}px`,
  } as CSSProperties;

  return (
    <div
      className={`search-modal-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] ${
        isMounted ? "is-visible" : ""
      }`}
      style={revealStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="completed-tasks-modal-title"
        className={`search-modal-panel flex max-h-[min(75vh,600px)] w-full max-w-2xl flex-col overflow-hidden bg-white dark:bg-zinc-900 ${
          isEntered ? "is-entered" : ""
        }`}
        style={revealStyle}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2
            id="completed-tasks-modal-title"
            className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Completed
          </h2>
          <button
            type="button"
            aria-label="Close completed tasks"
            onClick={onClose}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LuX className="size-4" aria-hidden="true" />
          </button>
        </div>

        <p className="shrink-0 border-b border-zinc-200 px-4 py-2 text-[13px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-400">
          {tasks.length === 0
            ? "Tasks you mark complete appear here."
            : `${tasks.length} completed ${tasks.length === 1 ? "task" : "tasks"}. Undo reopens a task; archive moves it to Archive.`}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {tasks.length === 0 ? (
            <p className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              No completed tasks
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                >
                  <button
                    type="button"
                    disabled={busyTaskId === task.id}
                    onClick={() => {
                      onOpenTask?.(task.id, task.listId);
                      onClose();
                    }}
                    className="min-w-0 flex-1 text-left disabled:opacity-50"
                  >
                    <p className="truncate text-sm text-zinc-500 line-through dark:text-zinc-400">
                      {task.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                      {task.listName}
                      {task.isNote ? " · Note" : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Undo completion of ${task.name}`}
                      disabled={busyTaskId === task.id}
                      onClick={() => void runAction(task.id, onUndoTask)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                      title="Undo"
                    >
                      <LuRotateCcw className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Archive ${task.name}`}
                      disabled={busyTaskId === task.id}
                      onClick={() => void runAction(task.id, onArchiveTask)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                      title="Archive"
                    >
                      <BsArchiveFill className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}