"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BiChevronDown, BiChevronRight } from "react-icons/bi";
import {
  clearSubtasksExpanded,
  getSavedSubtasksExpanded,
  resolveSubtasksExpandedState,
  saveSubtasksExpanded,
} from "@/lib/task-subtasks";
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
  const editHistoryRef = useRef<string[]>([]);
  const editHistoryIndexRef = useRef(0);
  const skipEditHistoryPushRef = useRef(false);

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

  function beginEditingSubtask(subtaskId: string, name: string) {
    editHistoryRef.current = [name];
    editHistoryIndexRef.current = 0;
    skipEditHistoryPushRef.current = false;
    setEditingSubtaskId(subtaskId);
    setEditingName(name);
  }

  function pushEditHistory(value: string) {
    if (skipEditHistoryPushRef.current) return;

    const history = editHistoryRef.current;
    const index = editHistoryIndexRef.current;
    if (history[index] === value) return;

    editHistoryRef.current = [...history.slice(0, index + 1), value];
    editHistoryIndexRef.current = editHistoryRef.current.length - 1;
  }

  function applyEditHistoryValue(value: string) {
    skipEditHistoryPushRef.current = true;
    setEditingName(value);
  }

  function undoSubtaskEdit(): boolean {
    if (editHistoryIndexRef.current <= 0) return false;

    editHistoryIndexRef.current -= 1;
    applyEditHistoryValue(editHistoryRef.current[editHistoryIndexRef.current] ?? "");
    return true;
  }

  function redoSubtaskEdit(): boolean {
    if (editHistoryIndexRef.current >= editHistoryRef.current.length - 1) {
      return false;
    }

    editHistoryIndexRef.current += 1;
    applyEditHistoryValue(editHistoryRef.current[editHistoryIndexRef.current] ?? "");
    return true;
  }

  useLayoutEffect(() => {
    skipEditHistoryPushRef.current = false;
  }, [editingName]);

  useLayoutEffect(() => {
    if (!editingSubtaskId) return;

    const hasSubtask = subtasks.some((subtask) => subtask.id === editingSubtaskId);
    if (!hasSubtask) return;

    let frame1 = 0;
    let frame2 = 0;

    const focusInput = () => {
      const input = editInputRef.current;
      if (!input) return false;

      input.focus({ preventScroll: true });
      input.select();
      return true;
    };

    if (focusInput()) return;

    frame1 = requestAnimationFrame(() => {
      if (focusInput()) return;
      frame2 = requestAnimationFrame(focusInput);
    });

    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [editingSubtaskId, subtasks]);

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
      beginEditingSubtask(created.id, created.name);
    } finally {
      setIsAdding(false);
    }
  }

  const addSubtaskButton = (
    <button
      type="button"
      disabled={isAdding}
      onClick={() => void handleAddSubtask()}
      className="flex w-full items-center gap-2 py-2 text-left text-[13px] text-slate-400 cursor-pointer transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
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
                    data-subtask-edit-input
                    type="text"
                    value={editingName}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setEditingName(nextValue);
                      pushEditHistory(nextValue);
                    }}
                    onBlur={() => commitSubtaskRename(subtask.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitSubtaskRename(subtask.id);
                        return;
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingSubtaskId(null);
                        setEditingName("");
                        return;
                      }

                      if (!(event.metaKey || event.ctrlKey)) return;

                      const key = event.key.toLowerCase();

                      if (key === "z" && !event.shiftKey) {
                        event.preventDefault();
                        event.stopPropagation();
                        undoSubtaskEdit();
                        return;
                      }

                      if (key === "y" || (key === "z" && event.shiftKey)) {
                        event.preventDefault();
                        event.stopPropagation();
                        redoSubtaskEdit();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-zinc-600 outline-none dark:text-zinc-50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      beginEditingSubtask(subtask.id, subtask.name);
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
