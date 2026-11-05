"use client";

import {
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LuX } from "react-icons/lu";
import {
  getKeyboardShortcutCatalog,
  type KeyboardShortcutEntry,
} from "@/lib/keyboard-shortcuts-catalog";

type KeyboardShortcutsModalProps = {
  open: boolean;
  revealOrigin?: { x: number; y: number } | null;
  onClose: () => void;
};

function getDefaultRevealOrigin() {
  return {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight * 0.12 : 0,
  };
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </kbd>
  );
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {keys.map((key, index) => (
        <ShortcutKey key={`${key}-${index}`}>{key}</ShortcutKey>
      ))}
    </div>
  );
}

function ShortcutRow({ entry }: { entry: KeyboardShortcutEntry }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-zinc-700 dark:text-zinc-200">
        {entry.description}
      </span>
      <ShortcutKeys keys={entry.keys} />
    </div>
  );
}

export function KeyboardShortcutsModal({
  open,
  revealOrigin = null,
  onClose,
}: KeyboardShortcutsModalProps) {
  const groups = useMemo(() => getKeyboardShortcutCatalog(), []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const origin = revealOrigin ?? getDefaultRevealOrigin();
  const revealStyle = {
    "--search-reveal-x": `${origin.x}px`,
    "--search-reveal-y": `${origin.y}px`,
  } as CSSProperties;

  return (
    <div
      className="search-modal-overlay is-visible fixed inset-0 z-10000 flex items-start justify-center p-4 pt-[8vh]"
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
        aria-labelledby="keyboard-shortcuts-modal-title"
        className="search-modal-panel is-entered flex max-h-[min(80vh,640px)] w-full max-w-2xl flex-col overflow-hidden bg-white dark:bg-zinc-900"
        style={revealStyle}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2
            id="keyboard-shortcuts-modal-title"
            className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LuX className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.title}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {group.title}
                </h3>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {group.shortcuts.map((entry) => (
                    <ShortcutRow
                      key={`${group.title}-${entry.description}-${entry.keys.join("-")}`}
                      entry={entry}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
