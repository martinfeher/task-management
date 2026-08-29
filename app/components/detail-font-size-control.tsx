"use client";

import { LuChevronDown } from "react-icons/lu";
import {
  DETAIL_FONT_SIZE_OPTIONS,
  type DetailFontSizeOption,
} from "./detail-fonts";

type DetailFontSizeControlProps = {
  value: DetailFontSizeOption;
  disabled?: boolean;
  compact?: boolean;
  formatToolbar?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (size: DetailFontSizeOption) => void;
};

const menuClassName =
  "absolute top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

const menuItemClassName =
  "flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export function DetailFontSizeControl({
  value,
  disabled = false,
  compact = false,
  formatToolbar = false,
  open = false,
  onOpenChange,
  onSelect,
}: DetailFontSizeControlProps) {
  const buttonClassName = formatToolbar
    ? "flex h-8 min-w-[28px] cursor-pointer items-center justify-center rounded-lg px-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
    : compact
      ? "flex h-[30px] min-w-[44px] cursor-pointer items-center justify-between gap-0.5 rounded border border-zinc-200 bg-white px-1.5 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      : "flex h-8 w-[52px] cursor-pointer items-center justify-between rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

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
        onClick={() => onOpenChange?.(!open)}
      >
        <span>{value}</span>
        {formatToolbar ? null : (
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        )}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Font size"
          className={`${menuClassName} left-0 min-w-[72px] max-h-64 overflow-y-auto`}
        >
          {DETAIL_FONT_SIZE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={`${menuItemClassName} justify-center ${
                option === value ? "bg-zinc-100 dark:bg-zinc-800" : ""
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
