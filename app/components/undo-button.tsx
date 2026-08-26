"use client";

import { LuUndo2 } from "react-icons/lu";

type UndoButtonProps = {
  visible: boolean;
  message?: string;
  ariaLabel?: string;
  onUndo: () => void;
};

export function UndoButton({
  visible,
  message = "Task completed",
  ariaLabel,
  onUndo,
}: UndoButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onUndo}
      aria-label={ariaLabel ?? `Undo ${message.toLowerCase()}`}
      className="fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 shadow-[0_4px_16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200 transition-opacity hover:opacity-95 dark:bg-white dark:text-zinc-900 dark:ring-zinc-300"
    >
      {message}
      <LuUndo2 className="size-5 shrink-0 text-[#8d99a2]" aria-hidden />
    </button>
  );
}
