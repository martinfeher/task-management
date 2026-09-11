"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronDown, BiChevronRight } from "react-icons/bi";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";

export type TaskDetailsSubtask = {
  id: string;
  name: string;
  completed: boolean;
};

type TaskDetailsSubtasksSectionProps = {
  taskId: string;
  subtasks: TaskDetailsSubtask[];
  onAddSubtask: (
    taskId: string,
  ) => Promise<TaskDetailsSubtask | null> | TaskDetailsSubtask | null;
  onToggleSubtask: (subtaskId: string) => void;
  onRenameSubtask: (subtaskId: string, name: string) => void;
};

const SUBTASKS_EXPANDED_SESSION_KEY = "todolist.subtasks-expanded-by-task";

function readSubtasksExpandedByTask() {
  if (typeof window === "undefined") return {} as Record<string, boolean>;

  try {
    const raw = window.sessionStorage.getItem(SUBTASKS_EXPANDED_SESSION_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

function getSavedSubtasksExpanded(taskId: string) {
  return readSubtasksExpandedByTask()[taskId];
}

function saveSubtasksExpanded(taskId: string, expanded: boolean) {
  if (typeof window === "undefined") return;

  const next = {
    ...readSubtasksExpandedByTask(),
    [taskId]: expanded,
  };
  window.sessionStorage.setItem(
    SUBTASKS_EXPANDED_SESSION_KEY,
    JSON.stringify(next),
  );
}

function clearSubtasksExpanded(taskId: string) {
  if (typeof window === "undefined") return;

  const current = readSubtasksExpandedByTask();
  if (!(taskId in current)) return;

  const next = { ...current };
  delete next[taskId];
  window.sessionStorage.setItem(
    SUBTASKS_EXPANDED_SESSION_KEY,
    JSON.stringify(next),
  );
}

function resolveSubtasksExpandedState(taskId: string, subtaskCount: number) {
  const saved = getSavedSubtasksExpanded(taskId);
  if (saved !== undefined) return saved;
  return subtaskCount > 0;
}

function orderSubtasksForDisplay(subtasks: TaskDetailsSubtask[]) {
  return subtasks
    .map((subtask, index) => ({ subtask, index }))
    .sort((a, b) => {
      if (a.subtask.completed !== b.subtask.completed) {
        return Number(a.subtask.completed) - Number(b.subtask.completed);
      }

      return a.index - b.index;
    })
    .map(({ subtask }) => subtask);
}

export function TaskDetailsSubtasksSection({
  taskId,
  subtasks,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
}: TaskDetailsSubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(() =>
    resolveSubtasksExpandedState(taskId, subtasks.length),
  );
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const previousSubtaskCountRef = useRef(subtasks.length);

  const orderedSubtasks = useMemo(
    () => orderSubtasksForDisplay(subtasks),
    [subtasks],
  );
  const completedCount = subtasks.filter((subtask) => subtask.completed).length;

  useEffect(() => {
    previousSubtaskCountRef.current = subtasks.length;
    setIsExpanded(resolveSubtasksExpandedState(taskId, subtasks.length));
  }, [taskId]);

  useEffect(() => {
    previousSubtaskCountRef.current = subtasks.length;

    if (subtasks.length === 0) {
      setIsExpanded(false);
      clearSubtasksExpanded(taskId);
      return;
    }

    if (getSavedSubtasksExpanded(taskId) !== undefined) return;

    setIsExpanded(true);
    saveSubtasksExpanded(taskId, true);
  }, [subtasks.length, taskId]);

  function handleToggleExpanded() {
    setIsExpanded((current) => {
      const next = !current;
      saveSubtasksExpanded(taskId, next);
      return next;
    });
  }

  useEffect(() => {
    if (!editingSubtaskId) return;

    const frame = requestAnimationFrame(() => {
      const input = editInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [editingSubtaskId]);

  function commitSubtaskRename(subtaskId: string) {
    const trimmed = editingName.trim();
    setEditingSubtaskId(null);
    setEditingName("");

    if (!trimmed) return;

    const current = subtasks.find((subtask) => subtask.id === subtaskId);
    if (!current || current.name === trimmed) return;

    onRenameSubtask(subtaskId, trimmed);
  }

  async function handleAddSubtask() {
    if (isAdding) return;

    setIsAdding(true);
    try {
      const created = await onAddSubtask(taskId);
      if (!created) return;

      setIsExpanded(true);
      saveSubtasksExpanded(taskId, true);
      setEditingSubtaskId(created.id);
      setEditingName(created.name);
    } finally {
      setIsAdding(false);
    }
  }

  const addSubtaskButton = (
    <button
      type="button"
      disabled={isAdding}
      onClick={() => void handleAddSubtask()}
      className="flex w-full items-center gap-2 py-2 text-left text-[13px] text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      <div className="text-[16px] leading-none text-zinc-400" aria-hidden>
        +
      </div>
      Add sub-task
    </button>
  );

  return (
    <section className="mt-4 shrink-0 border-t border-zinc-200 pl-[15px] pr-3 pt-3 dark:border-zinc-700">
      {subtasks.length === 0 ? (
        <div className="ml-1">{addSubtaskButton}</div>
      ) : (
        <>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={handleToggleExpanded}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <BiChevronDown className="size-4 shrink-0 text-zinc-400" aria-hidden />
        ) : (
          <BiChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
        )}
        <span className="text-[14px] font-semibold text-slate-500 dark:text-zinc-50">
          Sub-tasks
        </span>
        <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
          {completedCount}/{subtasks.length}
        </span>
      </button>

      {isExpanded ? (
        <div className="mt-3 border-t border-zinc-200 dark:border-zinc-700">
          {orderedSubtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="border-b border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex items-center gap-2.5 py-2.5 ml-1">
                <TaskCompletionCheckbox
                  checked={subtask.completed}
                  onChange={() => onToggleSubtask(subtask.id)}
                  aria-label={
                    subtask.completed
                      ? `Mark ${subtask.name} incomplete`
                      : `Mark ${subtask.name} complete`
                  }
                  className="shrink-0"
                />
                {editingSubtaskId === subtask.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onBlur={() => commitSubtaskRename(subtask.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitSubtaskRename(subtask.id);
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingSubtaskId(null);
                        setEditingName("");
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-zinc-600 outline-none dark:text-zinc-50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSubtaskId(subtask.id);
                      setEditingName(subtask.name);
                    }}
                    className={`min-w-0 flex-1 truncate text-left text-[14px] ${
                      subtask.completed
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : "text-slate-500 dark:text-zinc-50"
                    }`}
                  >
                    {subtask.name}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="ml-[20px]">{addSubtaskButton}</div>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
