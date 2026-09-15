"use client";

import { createPortal } from "react-dom";
import type { RefObject } from "react";

export type ListContextMenuPosition = {
  top: number;
  left: number;
};

type ListFolderOption = {
  id: string;
  name: string;
};

type ListContextMenuProps = {
  listName: string;
  fixedPosition: ListContextMenuPosition;
  menuRef?: RefObject<HTMLDivElement | null>;
  folders?: ListFolderOption[];
  currentFolderId?: string | null;
  onRename: () => void;
  onRemove: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
};

const MENU_WIDTH = 176;
const MENU_HEIGHT = 220;

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
  folders = [],
  currentFolderId = null,
  onRename,
  onRemove,
  onMoveToFolder,
}: ListContextMenuProps) {
  const moveTargets = folders.filter((folder) => folder.id !== currentFolderId);
  const showMoveSection = Boolean(onMoveToFolder && (moveTargets.length > 0 || currentFolderId));

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
      <div className="sidebar-context-menu w-44 py-1">
        <button
          type="button"
          role="menuitem"
          className="flex h-[35px] w-full items-center px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800"
          onClick={onRename}
        >
          Rename
        </button>
        {showMoveSection ? (
          <>
            <div className="mx-3 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            {moveTargets.map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="menuitem"
                className="flex h-[35px] w-full items-center px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800"
                onClick={() => onMoveToFolder?.(folder.id)}
              >
                Move to {folder.name}
              </button>
            ))}
            {currentFolderId ? (
              <button
                type="button"
                role="menuitem"
                className="flex h-[35px] w-full items-center px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800"
                onClick={() => onMoveToFolder?.(null)}
              >
                Remove from folder
              </button>
            ) : null}
          </>
        ) : null}
        <div className="mx-3 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
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
