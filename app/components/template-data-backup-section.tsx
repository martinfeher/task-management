"use client";

import { useRef, useState } from "react";
import { LuDownload, LuUpload } from "react-icons/lu";

export function TemplateDataBackupSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  async function handleDownload() {
    setError(null);
    setRestoreSuccess(false);
    setIsDownloading(true);

    try {
      const response = await fetch("/api/backup", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Download failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "todolist-backup.zip";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message === "Failed to fetch"
            ? "Could not reach the backup server. Check that you are signed in and the app is running."
            : downloadError.message
          : "Download failed";
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleRestoreFile(file: File) {
    setError(null);
    setRestoreSuccess(false);
    setIsRestoring(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/backup/restore", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Restore failed");
      }

      setRestoreSuccess(true);
      setConfirmRestore(false);
      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Restore failed",
      );
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirmRestore) {
      setError("Confirm restore before choosing a file.");
      event.target.value = "";
      return;
    }

    void handleRestoreFile(file);
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Data backup
      </h3>
      <p className="mb-2 px-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Download a ZIP of your lists, tasks, notes, labels, template settings,
        and uploaded images or audio. Restore replaces all current data.
      </p>
      <div className="space-y-2 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={isDownloading || isRestoring}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <LuDownload className="size-4 shrink-0" aria-hidden="true" />
          {isDownloading ? "Preparing backup…" : "Download backup"}
        </button>

        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={confirmRestore}
            onChange={(event) => {
              setConfirmRestore(event.target.checked);
              setError(null);
              setRestoreSuccess(false);
            }}
            className="mt-0.5 shrink-0"
          />
          <span>
            I understand restore will permanently replace all current app data
            with the backup file.
          </span>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={handleFileChange}
        />
        <button
          type="button"
          disabled={!confirmRestore || isRestoring || isDownloading}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
        >
          <LuUpload className="size-4 shrink-0" aria-hidden="true" />
          {isRestoring ? "Restoring…" : "Restore from backup"}
        </button>

        {error ? (
          <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {restoreSuccess ? (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Restore complete. Reloading…
          </p>
        ) : null}
      </div>
    </section>
  );
}
