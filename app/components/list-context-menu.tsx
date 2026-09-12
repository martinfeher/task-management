"use client";

import { createPortal } from "react-dom";
import type { RefObject } from "react";

export type ListContextMenuPosition = {
  top: number;
  left: number;
};

type ListContextMenuProps = {
  listName: string;
  fixedPosition: ListContextMenuPosition;
  menuRef?: RefObject<HTMLDivElement | null>;
  onRename: () => void;
  onRemove: () => void;
};

const MENU_WIDTH = 144;
const MENU_HEIGHT = 88;

export function clampListContextMenuPosition(
  top: number,
  left: number,
  menuWidth = MENU_WIDTH,
  menuHeight = MENU_HEIGHT,
): ListContextMenuPosition {
  if (typeof window === "undefined") {
    return { top, left };
  }

  const maxLeft = window.innerWidth - menuWidth - 8;
  const maxTop = window.innerHeight - menuHeight - 8;

  return {
    top: Math.min(Math.max(8, top), maxTop),
    left: Math.min(Math.max(8, left), maxLeft),
  };
}

export function ListContextMenu({
  listName,
  fixedPosition,
  menuRef,
  onRename,
  onRemove,
}: ListContextMenuProps) {
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Menu for ${listName}`}
      className="fixed z-[100]"
      style={{
        top: fixedPosition.top,
        left: fixedPosition.left,
      }}
    >
      <div className="w-36 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          role="menuitem"
          className="flex h-[35px] w-full items-center px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800"
          onClick={onRename}
        >
          Rename
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex h-[35px] w-full items-center px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>,
    document.body,
  );
}
