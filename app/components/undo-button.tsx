"use client";

import { LuUndo2 } from "react-icons/lu";

/** Keep in sync with `w-[244px]` on the main list sidebar. */
const SIDEBAR_PANEL_WIDTH_PX = 244;
const UNDO_AFTER_SIDEBAR_GAP_PX = 8;
const UNDO_EXTRA_OFFSET_PX = 48;

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
      className="fixed bottom-1.5 left-2 z-[10060] flex max-w-[min(calc(100vw-1rem),360px)] cursor-pointer items-center gap-3 rounded-full bg-[#444456]/75 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_7px_17px_rgba(0,0,0,0.25)] ring-1 ring-zinc-700/75 backdrop-blur-[4px] transition-[background-color] hover:bg-[#444456]/85 dark:text-zinc-50 dark:ring-zinc-500 lg:left-[var(--undo-after-sidebar-left)]"
      style={
        {
          "--undo-after-sidebar-left": `${SIDEBAR_PANEL_WIDTH_PX + UNDO_AFTER_SIDEBAR_GAP_PX + UNDO_EXTRA_OFFSET_PX}px`,
        } as React.CSSProperties
      }
    >
      <span className="min-w-0 truncate">{message}</span>
      <LuUndo2 className="size-[17.5px] shrink-0 text-zinc-300" aria-hidden />
    </button>
  );
}
