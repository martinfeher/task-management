"use client";

import { useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  getLabelColor,
  LABEL_PRESET_COLORS,
  normalizeLabelColorHex,
} from "@/lib/label-colors";
import type { TaskLabel } from "./todo-app";

export type LabelContextMenuPosition = {
  top: number;
  left: number;
};

type LabelContextMenuProps = {
  label: TaskLabel;
  fixedPosition: LabelContextMenuPosition;
  menuRef?: RefObject<HTMLDivElement | null>;
  onEditTitle: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
};

const MENU_WIDTH = 176;
const MENU_HEIGHT = 108;
const MENU_BODY_HEIGHT = 35 * 3 + 8;

export function clampLabelContextMenuPosition(
  top: number,
  left: number,
  menuWidth = MENU_WIDTH,
  menuHeight = MENU_HEIGHT,
): LabelContextMenuPosition {
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

export function LabelContextMenu({
  label,
  fixedPosition,
  menuRef,
  onEditTitle,
  onDelete,
  onColorChange,
}: LabelContextMenuProps) {
  const labelColor = getLabelColor(label);
  const [showPresets, setShowPresets] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100]"
      style={{
        top: fixedPosition.top,
        left: fixedPosition.left,
      }}
      onMouseLeave={() => setShowPresets(false)}
    >
      <div className="relative w-44 overflow-visible rounded-[23px] bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]">
        <button
          type="button"
          className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
          onClick={onEditTitle}
        >
          Edit title
        </button>
        <button
          type="button"
          className="flex h-[35px] w-full items-center px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          onClick={onDelete}
        >
          Delete
        </button>
        <div
          className="relative flex h-[35px] w-full items-center px-3 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onMouseEnter={() => setShowPresets(true)}
        >
          <span className="text-sm text-zinc-900 dark:text-zinc-50">Color</span>
          <button
            type="button"
            aria-label={`Pick custom color for ${label.label}`}
            className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-200 p-0.5 dark:border-zinc-600"
            onClick={(event) => {
              event.stopPropagation();
              colorInputRef.current?.click();
            }}
          >
            <span
              aria-hidden="true"
              className="size-full rounded-full"
              style={{ backgroundColor: labelColor.dot }}
            />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            aria-label={`Pick color for ${label.label}`}
            value={normalizeLabelColorHex(labelColor.dot)}
            onChange={(event) => {
              event.stopPropagation();
              onColorChange(event.target.value);
            }}
            className="sr-only"
          />
        </div>
      </div>

      {showPresets ? (
        <div
          className="absolute left-[42%] z-10 flex -translate-x-1/4 items-center gap-1 rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ top: MENU_BODY_HEIGHT - 8 }}
          onMouseEnter={() => setShowPresets(true)}
        >
          {LABEL_PRESET_COLORS.map((preset) => (
            <button
              key={preset.dot}
              type="button"
              aria-label={`Set label color ${preset.dot}`}
              className="size-5 rounded-full border border-zinc-200 transition-transform hover:scale-110 dark:border-zinc-600"
              style={{ backgroundColor: preset.dot }}
              onClick={(event) => {
                event.stopPropagation();
                onColorChange(preset.dot);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
