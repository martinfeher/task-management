"use client";

import { LuChevronDown } from "react-icons/lu";
import {
  DETAIL_FONT_FAMILY_OPTIONS,
  type DetailFontFamilyId,
} from "./detail-fonts";

type DetailFontFamilyControlProps = {
  value: DetailFontFamilyId;
  disabled?: boolean;
  formatToolbar?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (familyId: DetailFontFamilyId) => void;
};

const menuClassName =
  "absolute top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

const menuItemClassName =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export function DetailFontFamilyControl({
  value,
  disabled = false,
  formatToolbar = false,
  open = false,
  onOpenChange,
  onSelect,
}: DetailFontFamilyControlProps) {
  const label =
    DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === value)?.label ??
    "Sans Serif";

  const buttonClassName = formatToolbar
    ? "flex h-8 min-w-[72px] cursor-pointer items-center justify-center rounded-lg px-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
    : "flex h-8 min-w-[112px] cursor-pointer items-center justify-between gap-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

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
        onClick={() => onOpenChange?.(!open)}
      >
        <span className="truncate">{label}</span>
        {formatToolbar ? null : (
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        )}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Font family"
          className={`${menuClassName} left-0 min-w-[168px] max-h-64 overflow-y-auto`}
        >
          {DETAIL_FONT_FAMILY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={`${menuItemClassName} ${
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
      ) : null}
    </div>
  );
}
