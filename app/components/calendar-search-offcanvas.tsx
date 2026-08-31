"use client";

import { useEffect, useMemo, useRef } from "react";
import { LuX } from "react-icons/lu";
import { formatDueTimeLabel } from "@/lib/task-due-time";
import {
  formatCalendarTaskDueDateLabel,
  getCalendarSidebarSearchResults,
} from "@/lib/calendar-task-search";
import { startOfDay } from "./calendar-mini-month";
import type { SearchTask } from "./todo-app";

type CalendarSearchOffcanvasProps = {
  open: boolean;
  query: string;
  tasks: SearchTask[];
  onClose: () => void;
  onSelectTask: (task: SearchTask) => void;
};

export function CalendarSearchOffcanvas({
  open,
  query,
  tasks,
  onClose,
  onSelectTask,
}: CalendarSearchOffcanvasProps) {
  const panelRef = useRef<HTMLElement>(null);

  const results = useMemo(
    () => getCalendarSidebarSearchResults(tasks, query, startOfDay(new Date())),
    [query, tasks],
  );

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open, query]);

  if (!open) return null;

  const trimmedQuery = query.trim();

  return (
    <>
      <button
        type="button"
        aria-label="Close search results"
        className="fixed inset-0 z-40 cursor-default bg-black/10 dark:bg-black/30"
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label="Calendar search results"
        className="fixed top-0 right-0 z-50 flex h-dvh w-[320px] flex-col border-l border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Search results
            </h2>
            {trimmedQuery ? (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                “{trimmedQuery}”
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close search panel"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LuX className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!trimmedQuery ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              Type in the search field to find scheduled tasks.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              No tasks match your search.
            </p>
          ) : (
            <ul className="py-1">
              {results.map((task) => {
                const dueTimeLabel = formatDueTimeLabel(task.dueTimeMinutes);
                const dueDateLabel = task.dueDate
                  ? formatCalendarTaskDueDateLabel(task.dueDate)
                  : null;
                const scheduleLabel = dueTimeLabel
                  ? `${dueDateLabel ?? "Scheduled"} · ${dueTimeLabel}`
                  : dueDateLabel;

                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      disabled={!task.dueDate}
                      className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-900"
                    >
                      <span className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                        {task.name}
                      </span>
                      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {task.listName ?? "List"}
                        {scheduleLabel ? ` · ${scheduleLabel}` : " · No date"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
