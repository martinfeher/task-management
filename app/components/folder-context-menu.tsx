"use client";

import { createPortal } from "react-dom";
import type { RefObject } from "react";

export type FolderContextMenuPosition = {
  top: number;
  left: number;
};

type FolderContextMenuProps = {
  folderName: string;
  fixedPosition: FolderContextMenuPosition;
  menuRef?: RefObject<HTMLDivElement | null>;
  onRename: () => void;
  onRemove: () => void;
};

const MENU_WIDTH = 144;
const MENU_HEIGHT = 88;

export function clampFolderContextMenuPosition(
  top: number,
  left: number,
  menuWidth = MENU_WIDTH,
  menuHeight = MENU_HEIGHT,
): FolderContextMenuPosition {
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

export function FolderContextMenu({
  folderName,
  fixedPosition,
  menuRef,
  onRename,
  onRemove,
}: FolderContextMenuProps) {
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Menu for ${folderName}`}
      className="fixed z-[100]"
      style={{
        top: fixedPosition.top,
        left: fixedPosition.left,
      }}
    >
      <div className="sidebar-context-menu w-36 py-1">
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
          Delete
        </button>
      </div>
    </div>,
    document.body,
  );
}
