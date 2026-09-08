"use client";

import { useEffect, useRef, useState } from "react";
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

export function TaskDetailsSubtasksSection({
  taskId,
  subtasks,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
}: TaskDetailsSubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const completedCount = subtasks.filter((subtask) => subtask.completed).length;

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
      setEditingSubtaskId(created.id);
      setEditingName(created.name);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <section className="mt-4 shrink-0 border-t border-zinc-200 pl-[30px] pr-3 pt-4 dark:border-zinc-700">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <BiChevronDown className="size-4 shrink-0 text-zinc-400" aria-hidden />
        ) : (
          <BiChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
        )}
        <span className="text-[15px] font-semibold text-zinc-500 dark:text-zinc-50">
          Sub-tasks
        </span>
        <span className="text-[15px] text-zinc-400 dark:text-zinc-500">
          {completedCount}/{subtasks.length}
        </span>
      </button>

      {isExpanded ? (
        <div className="mt-3 border-t border-zinc-200 dark:border-zinc-700">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="border-b border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex items-center gap-2.5 py-2.5">
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
                    className={`min-w-0 flex-1 truncate text-left text-[15px] ${
                      subtask.completed
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : "text-zinc-900 dark:text-zinc-50"
                    }`}
                  >
                    {subtask.name}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={isAdding}
            onClick={() => void handleAddSubtask()}
            className="flex w-full items-center gap-2 py-2.5 text-left text-[15px] text-zinc-500 transition-colors hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <span className="text-[18px] leading-none text-[#e55353]" aria-hidden>
              +
            </span>
            Add sub-task
          </button>
        </div>
      ) : null}
    </section>
  );
}
