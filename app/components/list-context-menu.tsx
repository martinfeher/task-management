"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RefObject } from "react";
import { BiChevronRight } from "react-icons/bi";

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
  onEdit: () => void;
  onRename: () => void;
  onRemove: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
};

const MENU_WIDTH = 176;
const MENU_HEIGHT = 155;

const menuItemClassName =
  "flex h-[35px] w-full items-center px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800";

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
  onEdit,
  onRename,
  onRemove,
  onMoveToFolder,
}: ListContextMenuProps) {
  const [isMoveSubmenuOpen, setIsMoveSubmenuOpen] = useState(false);
  const moveSubmenuCloseTimerRef = useRef<number | null>(null);
  const moveTargets = folders.filter((folder) => folder.id !== currentFolderId);
  const showMoveItem = Boolean(
    onMoveToFolder && (moveTargets.length > 0 || currentFolderId),
  );

  const clearMoveSubmenuCloseTimer = () => {
    if (moveSubmenuCloseTimerRef.current !== null) {
      window.clearTimeout(moveSubmenuCloseTimerRef.current);
      moveSubmenuCloseTimerRef.current = null;
    }
  };

  const openMoveSubmenu = () => {
    if (!showMoveItem) return;
    clearMoveSubmenuCloseTimer();
    setIsMoveSubmenuOpen(true);
  };

  const scheduleCloseMoveSubmenu = () => {
    clearMoveSubmenuCloseTimer();
    moveSubmenuCloseTimerRef.current = window.setTimeout(() => {
      moveSubmenuCloseTimerRef.current = null;
      setIsMoveSubmenuOpen(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      clearMoveSubmenuCloseTimer();
    };
  }, []);

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
      <div
        className="flex items-start gap-1"
        onMouseLeave={() => {
          clearMoveSubmenuCloseTimer();
          setIsMoveSubmenuOpen(false);
        }}
      >
        <div className="sidebar-context-menu w-36 py-1">
          <button
            type="button"
            role="menuitem"
            className={menuItemClassName}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClassName}
            onClick={onRename}
          >
            Rename
          </button>
          {showMoveItem ? (
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isMoveSubmenuOpen}
              className={`${menuItemClassName} group cursor-pointer justify-between ${
                isMoveSubmenuOpen ? "bg-zinc-100 dark:bg-zinc-800" : ""
              }`}
              onMouseEnter={openMoveSubmenu}
              onMouseLeave={scheduleCloseMoveSubmenu}
              onClick={(event) => {
                event.stopPropagation();
                openMoveSubmenu();
              }}
            >
              <span>Move to</span>
              <BiChevronRight
                className="size-4 shrink-0 text-zinc-400 group-hover:text-zinc-500"
                aria-hidden="true"
              />
            </button>
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

        {showMoveItem && isMoveSubmenuOpen ? (
          <div
            role="menu"
            aria-label="Move list to folder"
            className="sidebar-context-menu w-44 py-1"
            onMouseEnter={openMoveSubmenu}
            onMouseLeave={scheduleCloseMoveSubmenu}
          >
            {moveTargets.map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="menuitem"
                className={`${menuItemClassName} truncate`}
                onClick={() => onMoveToFolder?.(folder.id)}
              >
                {folder.name}
              </button>
            ))}
            {currentFolderId ? (
              <>
                {moveTargets.length > 0 ? (
                  <div className="mx-3 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName}
                  onClick={() => onMoveToFolder?.(null)}
                >
                  Remove from folder
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
