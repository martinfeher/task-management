"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LuRotateCcw, LuTrash2, LuX } from "react-icons/lu";
import {
  getArchivedTasks,
  permanentlyDeleteArchivedTask,
  restoreArchivedTask,
  type ArchivedTaskItem,
  type RestoredTaskItem,
} from "@/app/actions/todo";
import { ConfirmModal } from "./confirm-modal";

type ArchiveScope = "all" | "tasks" | "notes";

type ArchiveModalProps = {
  open: boolean;
  revealOrigin?: { x: number; y: number } | null;
  onClose: () => void;
  onTasksRestored?: (tasks: RestoredTaskItem[]) => void;
};

const ARCHIVE_SCOPE_TABS: { id: ArchiveScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tasks", label: "Tasks" },
  { id: "notes", label: "Notes" },
];

function getDefaultArchiveRevealOrigin() {
  return {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight * 0.12 : 0,
  };
}

function formatDeletedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchesScope(item: ArchivedTaskItem, scope: ArchiveScope) {
  if (scope === "all") return true;
  if (scope === "notes") return item.isNote;
  return !item.isNote;
}

export function ArchiveModal({
  open,
  revealOrigin = null,
  onClose,
  onTasksRestored,
}: ArchiveModalProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isEntered, setIsEntered] = useState(false);
  const [scope, setScope] = useState<ArchiveScope>("all");
  const [items, setItems] = useState<ArchivedTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ArchivedTaskItem | null>(
    null,
  );
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

    let cancelled = false;
    setIsLoading(true);

    void getArchivedTasks()
      .then((archivedItems) => {
        if (!cancelled) {
          setItems(archivedItems);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
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

  const filteredItems = useMemo(
    () => items.filter((item) => matchesScope(item, scope)),
    [items, scope],
  );

  async function handleRestore(taskId: string) {
    setBusyTaskId(taskId);

    try {
      const restoredTasks = await restoreArchivedTask(taskId);
      setItems((current) => current.filter((item) => item.id !== taskId));
      onTasksRestored?.(restoredTasks);
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handlePermanentDelete() {
    if (!pendingDelete) return;

    const taskId = pendingDelete.id;
    setBusyTaskId(taskId);

    try {
      await permanentlyDeleteArchivedTask(taskId);
      setItems((current) => current.filter((item) => item.id !== taskId));
      setPendingDelete(null);
    } finally {
      setBusyTaskId(null);
    }
  }

  if (!isMounted) return null;

  const origin = revealOrigin ?? getDefaultArchiveRevealOrigin();
  const revealStyle = {
    "--search-reveal-x": `${origin.x}px`,
    "--search-reveal-y": `${origin.y}px`,
  } as CSSProperties;

  return (
    <>
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
          aria-labelledby="archive-modal-title"
          className={`search-modal-panel flex max-h-[min(75vh,600px)] w-full max-w-2xl flex-col overflow-hidden bg-white dark:bg-zinc-900 ${
            isEntered ? "is-entered" : ""
          }`}
          style={revealStyle}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2
              id="archive-modal-title"
              className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Archive
            </h2>
            <button
              type="button"
              aria-label="Close archive"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <LuX className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            {ARCHIVE_SCOPE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScope(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  scope === tab.id
                    ? "bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {isLoading ? (
              <p className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                Loading deleted items...
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                {scope === "all"
                  ? "No deleted tasks or notes."
                  : scope === "notes"
                    ? "No deleted notes."
                    : "No deleted tasks."}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredItems.map((item) => (
                  <li
                    key={item.id}
                    className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                          {item.name}
                        </p>
                        <span className="shrink-0 rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {item.isNote ? "Note" : "Task"}
                        </span>
                      </div>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {item.listName} · Deleted {formatDeletedAt(item.deletedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label={`Restore ${item.name}`}
                        disabled={busyTaskId === item.id}
                        onClick={() => void handleRestore(item.id)}
                        className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                      >
                        <LuRotateCcw className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${item.name} permanently`}
                        disabled={busyTaskId === item.id}
                        onClick={() => setPendingDelete(item)}
                        className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      >
                        <LuTrash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete permanently?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed forever and cannot be restored.`
            : ""
        }
        confirmLabel="Delete forever"
        onConfirm={() => void handlePermanentDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
