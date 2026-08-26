"use client";

import type { ComponentType, ReactNode, RefObject } from "react";
import { IoTextOutline } from "react-icons/io5";
import { LuChevronDown } from "react-icons/lu";
import { VscChecklist } from "react-icons/vsc";
import type { DetailTextBlockType, LineBlockType } from "./detail-lines";
import {
  DETAIL_FONT_FAMILY_OPTIONS,
  DETAIL_FONT_SIZE_OPTIONS,
  type DetailFontFamilyId,
  type DetailFontSizeOption,
} from "./detail-fonts";
import {
  BulletListIcon,
  NumberedListIcon,
} from "./line-control-icons";

export type FormatToolbarDropdown = "color" | "list" | "block" | "font" | "overflow";

export const FORMAT_TOOLBAR_DROPDOWN_TRIGGER_CLASS =
  "flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS =
  "absolute top-full z-10 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

export const FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

const TEXT_BLOCK_OPTIONS: {
  type: DetailTextBlockType;
  label: string;
}[] = [
  { type: "text", label: "Body text" },
  { type: "h1", label: "Heading 1" },
  { type: "h2", label: "Heading 2" },
  { type: "h3", label: "Heading 3" },
];

const LIST_OPTIONS: {
  type: Extract<LineBlockType, "bullet" | "numbered" | "checklist">;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { type: "bullet", label: "Bullet list", Icon: BulletListIcon },
  { type: "numbered", label: "Numbered list", Icon: NumberedListIcon },
  { type: "checklist", label: "Checklist", Icon: VscChecklist },
];

function HeadingLevelIcon({
  level,
  className,
}: {
  level: 1 | 2 | 3;
  className?: string;
}) {
  const subscript = level === 1 ? "₁" : level === 2 ? "₂" : "₃";

  return (
    <span
      className={`inline-flex items-baseline font-medium leading-none ${className ?? ""}`}
    >
      H
      <span className="text-[10px] leading-none">{subscript}</span>
    </span>
  );
}

function BlockTypeIcon({
  type,
  active,
}: {
  type: DetailTextBlockType;
  active: boolean;
}) {
  const colorClass = active ? "text-[#2563eb]" : "text-zinc-700 dark:text-zinc-200";

  if (type === "text") {
    return <IoTextOutline className={`size-4 ${colorClass}`} aria-hidden="true" />;
  }

  return (
    <HeadingLevelIcon
      level={type === "h1" ? 1 : type === "h2" ? 2 : 3}
      className={`text-[15px] ${colorClass}`}
    />
  );
}

type DropdownShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  trigger: ReactNode;
  children: ReactNode;
};

function FormatToolbarDropdownShell({
  open,
  onOpenChange,
  ariaLabel,
  triggerClassName = FORMAT_TOOLBAR_DROPDOWN_TRIGGER_CLASS,
  menuClassName = FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS,
  align = "left",
  trigger,
  children,
}: DropdownShellProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${triggerClassName} ${open ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={ariaLabel}
          className={`${menuClassName} ${align === "right" ? "right-0" : "left-0"} min-w-[168px]`}
          onMouseDown={(event) => event.preventDefault()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type DetailFormatColorDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTextColor: string;
  textColorOptions: readonly { label: string; value: string }[];
  onSelectColor: (color: string) => void;
};

export function DetailFormatColorDropdown({
  open,
  onOpenChange,
  defaultTextColor,
  textColorOptions,
  onSelectColor,
}: DetailFormatColorDropdownProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Text color"
      trigger={
        <>
          <span className="relative flex min-w-5 items-center justify-center px-0.5">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              A
            </span>
            <span
              className="absolute -bottom-0.5 left-0.5 right-0.5 h-0.5 rounded-full"
              style={{ backgroundColor: defaultTextColor }}
            />
          </span>
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
      <div className="px-3 py-2">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Text color
        </p>
        <div className="flex flex-wrap gap-1.5">
          {textColorOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              aria-label={option.label}
              title={option.label}
              className="size-5 rounded-full border border-zinc-200 transition-transform hover:scale-110 dark:border-zinc-600"
              style={{ backgroundColor: option.value }}
              onClick={() => {
                onSelectColor(option.value);
                onOpenChange(false);
              }}
            />
          ))}
        </div>
      </div>
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatListDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: Extract<LineBlockType, "bullet" | "numbered" | "checklist">) => void;
};

export function DetailFormatListDropdown({
  open,
  onOpenChange,
  onSelect,
}: DetailFormatListDropdownProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="List type"
      trigger={
        <>
          <BulletListIcon className="size-4 text-zinc-700 dark:text-zinc-200" />
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
      {LIST_OPTIONS.map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS}
          onClick={() => {
            onSelect(type);
            onOpenChange(false);
          }}
        >
          <Icon className="size-4 text-zinc-600 dark:text-zinc-300" />
          {label}
        </button>
      ))}
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatBlockTypeDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeType: DetailTextBlockType;
  isTypeDisabled?: (type: DetailTextBlockType) => boolean;
  onSelect: (type: DetailTextBlockType) => void;
};

export function DetailFormatBlockTypeDropdown({
  open,
  onOpenChange,
  activeType,
  isTypeDisabled,
  onSelect,
}: DetailFormatBlockTypeDropdownProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Block type"
      trigger={
        <>
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Aa</span>
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
      {TEXT_BLOCK_OPTIONS.map((option) => {
        const active = activeType === option.type;
        const disabled = isTypeDisabled?.(option.type) ?? false;

        return (
          <button
            key={option.type}
            type="button"
            role="menuitem"
            disabled={disabled}
            className={`${FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS} ${
              active ? "bg-zinc-100 dark:bg-zinc-800" : ""
            } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
            onClick={() => {
              if (disabled) return;
              onSelect(option.type);
              onOpenChange(false);
            }}
          >
            <BlockTypeIcon type={option.type} active={active} />
            {option.label}
          </button>
        );
      })}
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatFontComboDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: DetailFontFamilyId;
  size: DetailFontSizeOption;
  onSelectFamily: (familyId: DetailFontFamilyId) => void;
  onSelectSize: (size: DetailFontSizeOption) => void;
};

export function DetailFormatFontComboDropdown({
  open,
  onOpenChange,
  familyId,
  size,
  onSelectFamily,
  onSelectSize,
}: DetailFormatFontComboDropdownProps) {
  const familyLabel =
    DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === familyId)?.label ??
    "Sans Serif";

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Font family and size"
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[200px] max-h-72 overflow-y-auto`}
      trigger={
        <>
          <span className="max-w-[120px] truncate whitespace-nowrap">
            {familyLabel} · {size}
          </span>
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Font
      </p>
      {DETAIL_FONT_FAMILY_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="menuitem"
          className={`${FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS} ${
            option.id === familyId ? "bg-zinc-100 dark:bg-zinc-800" : ""
          }`}
          style={option.value ? { fontFamily: option.value } : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelectFamily(option.id)}
        >
          {option.label}
        </button>
      ))}
      <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Size
      </p>
      <div className="grid grid-cols-4 gap-0.5 px-2 pb-2">
        {DETAIL_FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitem"
            className={`rounded-md px-1 py-1 text-center text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              option === size
                ? "bg-zinc-100 font-medium text-[#2563eb] dark:bg-zinc-800 dark:text-blue-300"
                : "text-zinc-800 dark:text-zinc-100"
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSelectSize(option);
              onOpenChange(false);
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatOverflowMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuRef?: RefObject<HTMLDivElement | null>;
  onStrikethrough: () => void;
  onGrammarCheck: () => void;
};

export function DetailFormatOverflowMenu({
  open,
  onOpenChange,
  menuRef,
  onStrikethrough,
  onGrammarCheck,
}: DetailFormatOverflowMenuProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="More formatting options"
      align="right"
      trigger={
        <span className="flex size-4 items-center justify-center tracking-widest text-zinc-600 dark:text-zinc-300">
          ···
        </span>
      }
    >
      <div ref={menuRef}>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS}
          onClick={() => {
            onStrikethrough();
            onOpenChange(false);
          }}
        >
          <span className="flex size-5 items-center justify-center text-sm line-through">
            S
          </span>
          Strikethrough
        </button>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS}
          onClick={() => {
            onGrammarCheck();
            onOpenChange(false);
          }}
        >
          <span className="flex size-5 items-center justify-center text-xs font-semibold">
            ABC
          </span>
          Check grammar
        </button>
      </div>
    </FormatToolbarDropdownShell>
  );
}
