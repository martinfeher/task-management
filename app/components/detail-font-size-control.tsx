"use client";

import { useRef } from "react";
import { LuChevronDown } from "react-icons/lu";
import {
  DETAIL_FONT_SIZE_OPTIONS,
  type DetailFontSizeOption,
} from "./detail-fonts";
import {
  FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS,
  FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR,
  FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS,
  FORMAT_TOOLBAR_ICON_COLOR,
  FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR,
} from "./detail-format-toolbar-menus";

type DetailFontSizeControlProps = {
  value: DetailFontSizeOption;
  disabled?: boolean;
  compact?: boolean;
  formatToolbar?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (size: DetailFontSizeOption) => void;
};

const FORMAT_TOOLBAR_FONT_SIZE_HOVER_CLOSE_MS = 120;

const menuClassName =
  "absolute top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

const menuItemClassName =
  "flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

const formatToolbarMenuItemClassName =
  `flex w-full items-center px-3 py-1.5 text-left ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800`;

export function DetailFontSizeControl({
  value,
  disabled = false,
  compact = false,
  formatToolbar = false,
  open = false,
  onOpenChange,
  onSelect,
}: DetailFontSizeControlProps) {
  const closeTimerRef = useRef<number | null>(null);

  const buttonClassName = formatToolbar
    ? `flex h-8 min-w-[28px] cursor-pointer items-center justify-center rounded-lg px-2 ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 ${
        open ? "bg-zinc-100 dark:bg-zinc-800" : ""
      }`
    : compact
      ? "flex h-[30px] min-w-[44px] cursor-pointer items-center justify-between gap-0.5 rounded border border-zinc-200 bg-white px-1.5 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      : "flex h-8 w-[52px] cursor-pointer items-center justify-between rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

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
    }, FORMAT_TOOLBAR_FONT_SIZE_HOVER_CLOSE_MS);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Font size: ${value}`}
        className={buttonClassName}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!open) {
            onOpenChange?.(true);
          }
        }}
      >
        <span>{value}</span>
        {formatToolbar ? null : (
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        )}
      </button>

      {open ? (
        <div
          className={`absolute top-full z-50 ${formatToolbar ? "left-0 pt-1" : "left-0 mt-1"}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {formatToolbar ? (
            <div
              role="listbox"
              aria-label="Font size"
              className={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[168px]`}
            >
              <div className="grid grid-cols-4 gap-0.5 px-1 py-1">
                {DETAIL_FONT_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={option === value}
                    className={`rounded-md px-1 py-1 text-center ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-800 ${
                      option === value
                        ? `bg-zinc-100 font-medium ${FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR} dark:bg-zinc-800`
                        : FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(option);
                      onOpenChange?.(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              role="listbox"
              aria-label="Font size"
              className={`${menuClassName} min-w-[72px] max-h-64 overflow-y-auto`}
            >
              {DETAIL_FONT_SIZE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={`${formatToolbarMenuItemClassName} justify-center ${
                    option === value ? "bg-zinc-100 dark:bg-zinc-800" : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
