"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LuChevronDown, LuChevronUp, LuHistory, LuRotateCcw, LuX } from "react-icons/lu";
import { taskDetailsToPlainText } from "@/lib/task-details-content";
import type { TaskVersionListItem } from "@/lib/task-versions-shared";
import {
  formatTaskVersionTimestamp,
  getTaskVersionSourceBadgeClass,
  getTaskVersionSourceLabel,
} from "@/lib/task-versions-shared";
import {
  createManualTaskVersion,
  fetchTaskVersionById,
  fetchTaskVersions,
  restoreTaskVersion,
  type TaskVersionDetail,
} from "@/lib/task-versions-api";

type TaskVersionHistoryOffcanvasProps = {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onRestore: (payload: { name: string; details: string }) => void | Promise<void>;
};

export function TaskVersionHistoryOffcanvas({
  open,
  taskId,
  onClose,
  onRestore,
}: TaskVersionHistoryOffcanvasProps) {
  const panelRef = useRef<HTMLElement>(null);
  const expandedVersionIdRef = useRef<string | null>(null);
  const [versions, setVersions] = useState<TaskVersionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);
  const [confirmRestoreVersionId, setConfirmRestoreVersionId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<TaskVersionDetail | null>(null);
  const [expandedLoadingId, setExpandedLoadingId] = useState<string | null>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!taskId) {
      setVersions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextVersions = await fetchTaskVersions(taskId);
      setVersions(nextVersions);
    } catch {
      setError("Could not load version history.");
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!open || !taskId) return;
    void loadVersions();
  }, [loadVersions, open, taskId]);

  useEffect(() => {
    if (!open) {
      setConfirmRestoreVersionId(null);
      setExpandedVersionId(null);
      expandedVersionIdRef.current = null;
      setExpandedVersion(null);
      setExpandedLoadingId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (confirmRestoreVersionId) {
          setConfirmRestoreVersionId(null);
          return;
        }
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmRestoreVersionId, onClose, open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open, taskId]);

  async function handleSaveSnapshot() {
    if (!taskId || isSavingSnapshot) return;

    setIsSavingSnapshot(true);
    setError(null);

    try {
      const result = await createManualTaskVersion(taskId);
      setVersions(result.versions);
    } catch {
      setError("Could not save a snapshot.");
    } finally {
      setIsSavingSnapshot(false);
    }
  }

  async function handleTogglePreview(versionId: string) {
    if (!taskId) return;

    if (expandedVersionId === versionId) {
      setExpandedVersionId(null);
      expandedVersionIdRef.current = null;
      setExpandedVersion(null);
      return;
    }

    setExpandedVersionId(versionId);
    expandedVersionIdRef.current = versionId;
    setExpandedVersion(null);
    setExpandedLoadingId(versionId);
    setError(null);

    try {
      const version = await fetchTaskVersionById(taskId, versionId);
      if (expandedVersionIdRef.current !== versionId) return;
      setExpandedVersion(version);
    } catch {
      if (expandedVersionIdRef.current === versionId) {
        setError("Could not load version preview.");
        setExpandedVersionId(null);
        expandedVersionIdRef.current = null;
      }
    } finally {
      if (expandedVersionIdRef.current === versionId) {
        setExpandedLoadingId(null);
      }
    }
  }

  async function handleConfirmRestore(versionId: string) {
    if (!taskId || pendingVersionId) return;

    setPendingVersionId(versionId);
    setError(null);

    try {
      const result = await restoreTaskVersion(taskId, versionId);
      if (result.restored) {
        await onRestore({
          name: result.name,
          details: result.details,
        });
        await loadVersions();
      }
      setConfirmRestoreVersionId(null);
      setExpandedVersionId(null);
      expandedVersionIdRef.current = null;
      setExpandedVersion(null);
    } catch {
      setError("Could not restore this version.");
    } finally {
      setPendingVersionId(null);
    }
  }

  if (!open || !taskId) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close version history"
        className="fixed inset-0 z-40 cursor-default bg-black/10 dark:bg-black/30"
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label="Task version history"
        className="fixed top-0 right-0 z-50 flex h-dvh w-[360px] max-w-[calc(100vw-1rem)] flex-col border-l border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LuHistory className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Version history
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Up to 30 snapshots. Auto snapshots are created at least 30s apart.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LuX className="size-4" />
          </button>
        </div>

        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => void handleSaveSnapshot()}
            disabled={isSavingSnapshot}
            className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isSavingSnapshot ? "Saving snapshot…" : "Save snapshot now"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              Loading versions…
            </p>
          ) : error ? (
            <p className="px-2 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No saved versions yet. Keep editing and versions will appear here
              after changes spaced at least 30 seconds apart.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {versions.map((version) => {
                const isPending = pendingVersionId === version.id;
                const isExpanded = expandedVersionId === version.id;
                const isConfirming = confirmRestoreVersionId === version.id;
                const isCurrent = version.isCurrent === true;
                const previewText =
                  isExpanded && expandedVersion
                    ? taskDetailsToPlainText(expandedVersion.details) ||
                      expandedVersion.name.trim() ||
                      "Empty task"
                    : version.preview;

                return (
                  <li key={version.id}>
                    <div
                      className={`rounded-xl border px-3 py-2.5 transition-colors ${
                        isExpanded
                          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70"
                          : "border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 flex-1 cursor-pointer text-left"
                          onClick={() => void handleTogglePreview(version.id)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {formatTaskVersionTimestamp(version.createdAt)}
                            </p>
                            {isCurrent ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getTaskVersionSourceBadgeClass(version.source)}`}
                            >
                              {getTaskVersionSourceLabel(version.source)}
                            </span>
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={isExpanded ? "Hide preview" : "Show preview"}
                            onClick={() => void handleTogglePreview(version.id)}
                            className="flex cursor-pointer items-center justify-center rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            {isExpanded ? (
                              <LuChevronUp className="size-4" />
                            ) : (
                              <LuChevronDown className="size-4" />
                            )}
                          </button>
                          {!isCurrent ? (
                            <button
                              type="button"
                              disabled={Boolean(pendingVersionId)}
                              onClick={() => {
                                setConfirmRestoreVersionId(version.id);
                                if (!isExpanded) {
                                  void handleTogglePreview(version.id);
                                }
                              }}
                              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <LuRotateCcw className="size-3.5" />
                              Restore
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                          {expandedLoadingId === version.id ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              Loading preview…
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                              {previewText}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 line-clamp-3 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                          {version.preview}
                        </p>
                      )}

                      {isConfirming ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
                          <p className="text-sm text-amber-900 dark:text-amber-100">
                            Restore this version? Your current content will be
                            saved as a version first.
                          </p>
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={Boolean(pendingVersionId)}
                              onClick={() => setConfirmRestoreVersionId(null)}
                              className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(pendingVersionId)}
                              onClick={() => void handleConfirmRestore(version.id)}
                              className="cursor-pointer rounded-md bg-[#4873c7] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3f68bd] disabled:opacity-50"
                            >
                              {isPending ? "Restoring…" : "Restore"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
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
