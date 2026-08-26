"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type GrammarCheckModalProps = {
  open: boolean;
  originalText: string;
  correctedText: string | null;
  isLoading: boolean;
  error: string | null;
  onApply: () => void;
  onClose: () => void;
};

export function GrammarCheckModal({
  open,
  originalText,
  correctedText,
  isLoading,
  error,
  onApply,
  onClose,
}: GrammarCheckModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || isLoading) return;
      onClose();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, isLoading, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex cursor-default items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grammar-check-modal-title"
        className="flex w-full max-w-lg flex-col rounded-lg bg-white p-5 shadow-xl dark:bg-zinc-900 [&_button]:cursor-pointer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2
          id="grammar-check-modal-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Grammar check
        </h2>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Selected text
            </p>
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
              {originalText}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Suggestion
            </p>
            {isLoading ? (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Checking grammar...
              </p>
            ) : error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            ) : (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-zinc-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-zinc-100">
                {correctedText}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-[35px] rounded-md px-4 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={isLoading || !correctedText || Boolean(error)}
            className="h-[35px] rounded-md bg-[#4873c7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3f68bd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
