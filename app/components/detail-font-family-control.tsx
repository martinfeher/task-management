"use client";

import { useRef } from "react";
import { LuChevronDown } from "react-icons/lu";
import {
  DETAIL_FONT_FAMILY_OPTIONS,
  getFormatToolbarFontFamilyOptions,
  type DetailFontFamilyId,
} from "./detail-fonts";
import { FORMAT_TOOLBAR_FONT_FAMILY_ITEM_CLASS } from "./detail-format-toolbar-menus";

type DetailFontFamilyControlProps = {
  value: DetailFontFamilyId;
  disabled?: boolean;
  formatToolbar?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (familyId: DetailFontFamilyId) => void;
};

const menuPanelClassName =
  "overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

const menuItemClassName =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800 cursor-pointer";

const FORMAT_TOOLBAR_FONT_FAMILY_HOVER_CLOSE_MS = 120;

export function DetailFontFamilyControl({
  value,
  disabled = false,
  formatToolbar = false,
  open = false,
  onOpenChange,
  onSelect,
}: DetailFontFamilyControlProps) {
  const closeTimerRef = useRef<number | null>(null);
  const fontOptions = getFormatToolbarFontFamilyOptions();
  const label =
    DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === value)?.label ??
    fontOptions[0]?.label ??
    "Sans Serif";

  const buttonClassName = formatToolbar
    ? "flex h-8 min-w-[72px] cursor-pointer items-center justify-center rounded-lg px-2 text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
    : "flex h-8 min-w-[112px] cursor-pointer items-center justify-between gap-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function handleMouseEnter() {
    if (disabled || !formatToolbar) return;

    clearCloseTimer();
    onOpenChange?.(true);
  }

  function handleMouseLeave() {
    if (disabled || !formatToolbar) return;

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onOpenChange?.(false);
    }, FORMAT_TOOLBAR_FONT_FAMILY_HOVER_CLOSE_MS);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Font family: ${label}`}
        className={buttonClassName}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => onOpenChange?.(!open)}
      >
        <span className="truncate">{label}</span>
        {formatToolbar ? null : (
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        )}
      </button>

      {open ? (
        <div
          className="absolute top-full left-0 z-50 pt-1"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            role="listbox"
            aria-label="Font family"
            className={`${menuPanelClassName} min-w-[168px] max-h-64 overflow-y-auto`}
          >
            {fontOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === value}
                className={`${formatToolbar ? FORMAT_TOOLBAR_FONT_FAMILY_ITEM_CLASS : menuItemClassName} ${
                  option.id === value ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
                style={option.value ? { fontFamily: option.value } : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
