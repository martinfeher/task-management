"use client";

import {
  useRef,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { HiNumberedList } from "react-icons/hi2";
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
import { BulletListIcon } from "./line-control-icons";

export type FormatToolbarDropdown =
  | "highlight"
  | "list"
  | "block"
  | "fontFamily"
  | "fontSize"
  | "overflow";

export const FORMAT_TOOLBAR_ICON_SIZE_CLASS = "size-[18px]";
export const FORMAT_TOOLBAR_ICON_TEXT_CLASS = "text-[17px]";
export const FORMAT_TOOLBAR_TEXT_COLOR_ICON_SIZE_CLASS = "size-[20px]";

export const FORMAT_TOOLBAR_DROPDOWN_TRIGGER_CLASS =
  "flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS =
  "overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 min-w-[168px]";

export const FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_TOOLTIP_CLASS =
  "add-task-date-tooltip add-task-date-tooltip-below pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity";

type FormatToolbarTooltipWrapProps = {
  label: string;
  tooltipId: string;
  hideTooltip?: boolean;
  children: ReactNode;
};

export function FormatToolbarTooltipWrap({
  label,
  tooltipId,
  hideTooltip = false,
  children,
}: FormatToolbarTooltipWrapProps) {
  return (
    <div className="group/format-tooltip relative">
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={`${FORMAT_TOOLBAR_TOOLTIP_CLASS} ${
          hideTooltip ? "" : "group-hover/format-tooltip:opacity-100"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

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
  { type: "numbered", label: "Numbered list", Icon: HiNumberedList },
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

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace("#", "").trim();

  if (normalized.length === 3) {
    return [
      Number.parseInt(normalized[0] + normalized[0], 16),
      Number.parseInt(normalized[1] + normalized[1], 16),
      Number.parseInt(normalized[2] + normalized[2], 16),
    ];
  }

  if (normalized.length === 6) {
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }

  return null;
}

function normalizeColorValue(color: string) {
  return color.toLowerCase().replace(/\s/g, "");
}

function rgbStringToHex(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;

  const [r, g, b] = match.slice(1, 4).map((value) => Number(value));
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorsEquivalent(a: string, b: string) {
  const normalizedA = normalizeColorValue(a);
  const normalizedB = normalizeColorValue(b);
  if (normalizedA === normalizedB) return true;

  const hexA = normalizedA.startsWith("#")
    ? normalizedA
    : rgbStringToHex(a)?.toLowerCase();
  const hexB = normalizedB.startsWith("#")
    ? normalizedB
    : rgbStringToHex(b)?.toLowerCase();

  return Boolean(hexA && hexB && hexA === hexB);
}

function FormatHighlightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.8944 5.55279C12.725 5.214 12.3787 5 12 5C11.6212 5 11.2749 5.214 11.1055 5.55279L5.10555 17.5528C4.85856 18.0468 5.05878 18.6474 5.55276 18.8944C6.04674 19.1414 6.64741 18.9412 6.8944 18.4472L8.64957 14.9369C8.75862 14.9777 8.87671 15 9 15H15C15.1233 15 15.2413 14.9777 15.3504 14.9369L17.1055 18.4472C17.3525 18.9412 17.9532 19.1414 18.4472 18.8944C18.9412 18.6474 19.1414 18.0468 18.8944 17.5528L12.8944 5.55279ZM14.3819 13L12 8.23607L9.61801 13H14.3819Z"
      />
    </svg>
  );
}

function BlockTypeIcon({
  type,
  active,
}: {
  type: DetailTextBlockType;
  active: boolean;
}) {
  const colorClass =
    type === "text" && active
      ? "text-[#323232]"
      : active
        ? "text-[#2563eb]"
        : "text-zinc-700 dark:text-zinc-200";

  if (type === "text") {
    return (
      <IoTextOutline
        className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} ${colorClass}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <HeadingLevelIcon
      level={type === "h1" ? 1 : type === "h2" ? 2 : 3}
      className={`${FORMAT_TOOLBAR_ICON_TEXT_CLASS} ${colorClass}`}
    />
  );
}

type DropdownShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  tooltipId: string;
  tooltipLabel: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  openClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  trigger: ReactNode;
  children: ReactNode;
};

const FORMAT_TOOLBAR_DROPDOWN_HOVER_CLOSE_MS = 120;

function FormatToolbarDropdownShell({
  open,
  onOpenChange,
  ariaLabel,
  tooltipId,
  tooltipLabel,
  triggerClassName = FORMAT_TOOLBAR_DROPDOWN_TRIGGER_CLASS,
  triggerStyle,
  openClassName = "bg-zinc-100 dark:bg-zinc-800",
  menuClassName = FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS,
  align = "left",
  trigger,
  children,
}: DropdownShellProps) {
  const closeTimerRef = useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function handleMouseEnter() {
    clearCloseTimer();
    onOpenChange(true);
  }

  function handleMouseLeave() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onOpenChange(false);
    }, FORMAT_TOOLBAR_DROPDOWN_HOVER_CLOSE_MS);
  }

  return (
    <FormatToolbarTooltipWrap
      label={tooltipLabel}
      tooltipId={tooltipId}
      hideTooltip={open}
    >
      <div className="relative">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-describedby={tooltipId}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`${triggerClassName} ${open ? openClassName : ""}`}
          style={triggerStyle}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => onOpenChange(!open)}
        >
          {trigger}
        </button>

        {open ? (
          <div
            className={`absolute top-full z-10 ${align === "right" ? "right-0" : "left-0"} pt-1`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              role="menu"
              aria-label={ariaLabel}
              className={menuClassName}
              onMouseDown={(event) => event.preventDefault()}
            >
              {children}
            </div>
          </div>
        ) : null}
      </div>
    </FormatToolbarTooltipWrap>
  );
}

type DetailTextColorOption = {
  label: string;
  value: string;
  borderColor?: string;
};

export type RecentFormatColor = {
  kind: "text" | "highlight";
  color: string;
  label: string;
};

const FORMAT_COLOR_MENU_SECTION_TITLE_CLASS =
  "mb-2 text-[12px] font-medium text-zinc-700 dark:text-zinc-100";

function TextColorSwatchButton({
  option,
  selected,
  onSelect,
}: {
  option: DetailTextColorOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={option.label}
      title={option.label}
      className={`flex size-7 items-center justify-center rounded-full border bg-white text-[13px] font-medium leading-none transition-transform hover:scale-110 dark:bg-zinc-900 ${
        selected
          ? "ring-1 ring-zinc-200 ring-offset-1 dark:ring-zinc-700"
          : ""
      }`}
      style={{
        color: option.value,
        borderColor: option.borderColor ?? "#f4f4f3",
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      A
    </button>
  );
}

function HighlightColorSwatchButton({
  option,
  selected,
  onSelect,
}: {
  option: { label: string; value: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={option.label}
      title={option.label}
      className={`size-6 rounded-full border transition-transform hover:scale-110 ${
        option.value.toLowerCase() === "#ffffff"
          ? "border-zinc-300 dark:border-zinc-500"
          : "border-zinc-200/80 dark:border-zinc-600"
      } ${
        selected
          ? "ring-[1.4px] ring-[#b4b4bb] ring-offset-1 dark:ring-[#8d8d95]"
          : ""
      }`}
      style={{ backgroundColor: option.value }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    />
  );
}

type DetailFormatTextHighlightColorDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTextColor: string;
  selectedHighlightColor: string;
  textColorOptions: readonly DetailTextColorOption[];
  highlightColorOptions: readonly { label: string; value: string }[];
  isHighlightActive?: boolean;
  onSelectTextColor: (color: string) => void;
  onSelectHighlightColor: (color: string) => void;
  recentColors?: RecentFormatColor[];
};

export function DetailFormatTextHighlightColorDropdown({
  open,
  onOpenChange,
  selectedTextColor,
  selectedHighlightColor,
  textColorOptions,
  highlightColorOptions,
  isHighlightActive = false,
  onSelectTextColor,
  onSelectHighlightColor,
  recentColors = [],
}: DetailFormatTextHighlightColorDropdownProps) {
  const menuSelectedHighlightColor = isHighlightActive
    ? selectedHighlightColor
    : "#ffffff";
  const matchedTextColorOption = textColorOptions.find((option) =>
    colorsEquivalent(option.value, selectedTextColor),
  );
  const defaultTextColor = textColorOptions[0]?.value ?? selectedTextColor;
  const hasCustomTextColor = !colorsEquivalent(selectedTextColor, defaultTextColor);

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Text and highlight color"
      tooltipId="format-toolbar-highlight-tooltip"
      tooltipLabel="Text & highlight color"
      openClassName=""
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[220px]`}
      triggerClassName="format-highlight-trigger flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm text-zinc-700 transition-[background-color] duration-150 dark:text-zinc-200"
      trigger={
        <>
          <span
            className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border bg-white dark:bg-zinc-900"
            style={{
              color: hasCustomTextColor ? selectedTextColor : undefined,
              borderColor: matchedTextColorOption?.borderColor ?? "#e9e9e7",
              backgroundColor: isHighlightActive
                ? selectedHighlightColor
                : undefined,
            }}
          >
            <FormatHighlightIcon
              className={`${FORMAT_TOOLBAR_TEXT_COLOR_ICON_SIZE_CLASS} ${
                hasCustomTextColor
                  ? "text-current"
                  : "text-zinc-700 dark:text-zinc-200"
              }`}
            />
          </span>
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
      <div className="space-y-3 px-3 py-2">
        {recentColors.length > 0 ? (
          <section>
            <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Recently Used</p>
            <div className="flex flex-wrap gap-1.5">
              {recentColors.map((entry) =>
                entry.kind === "text" ? (
                  <TextColorSwatchButton
                    key={`recent-text-${entry.color}`}
                    option={{
                      label: entry.label,
                      value: entry.color,
                      borderColor: textColorOptions.find((option) =>
                        colorsEquivalent(option.value, entry.color),
                      )?.borderColor,
                    }}
                    selected={colorsEquivalent(entry.color, selectedTextColor)}
                    onSelect={() => {
                      onSelectTextColor(entry.color);
                      onOpenChange(false);
                    }}
                  />
                ) : (
                  <HighlightColorSwatchButton
                    key={`recent-highlight-${entry.color}`}
                    option={{ label: entry.label, value: entry.color }}
                    selected={colorsEquivalent(
                      entry.color,
                      menuSelectedHighlightColor,
                    )}
                    onSelect={() => {
                      onSelectHighlightColor(entry.color);
                      onOpenChange(false);
                    }}
                  />
                ),
              )}
            </div>
          </section>
        ) : null}

        <section>
          <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Text Color</p>
          <div className="grid grid-cols-5 gap-1.5">
            {textColorOptions.map((option) => (
              <TextColorSwatchButton
                key={option.value}
                option={option}
                selected={colorsEquivalent(option.value, selectedTextColor)}
                onSelect={() => {
                  onSelectTextColor(option.value);
                  onOpenChange(false);
                }}
              />
            ))}
          </div>
        </section>

        <section>
          <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Highlight Color</p>
          <div className="grid grid-cols-5 gap-1.5">
            {highlightColorOptions.map((option) => (
              <HighlightColorSwatchButton
                key={option.value}
                option={option}
                selected={colorsEquivalent(option.value, menuSelectedHighlightColor)}
                onSelect={() => {
                  onSelectHighlightColor(option.value);
                  onOpenChange(false);
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </FormatToolbarDropdownShell>
  );
}

/** @deprecated Use DetailFormatTextHighlightColorDropdown */
export const DetailFormatHighlightColorDropdown = DetailFormatTextHighlightColorDropdown;

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
      tooltipId="format-toolbar-list-type-tooltip"
      tooltipLabel="List type"
      trigger={
        <>
          <BulletListIcon
            className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} text-zinc-700 dark:text-zinc-200`}
          />
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
          <Icon className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} text-zinc-600 dark:text-zinc-300`} />
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
      tooltipId="format-toolbar-block-type-tooltip"
      tooltipLabel="Text style"
      trigger={
        <>
          <span
            className={`font-medium text-zinc-800 dark:text-zinc-100 ${
              activeType === "text" ? "text-[14px]" : FORMAT_TOOLBAR_ICON_TEXT_CLASS
            }`}
          >
            Aa
          </span>
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

type DetailFormatFontFamilyDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: DetailFontFamilyId;
  onSelectFamily: (familyId: DetailFontFamilyId) => void;
};

export function DetailFormatFontFamilyDropdown({
  open,
  onOpenChange,
  familyId,
  onSelectFamily,
}: DetailFormatFontFamilyDropdownProps) {
  const familyLabel =
    DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === familyId)?.label ??
    "Sans Serif";

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Font family"
      tooltipId="format-toolbar-font-family-tooltip"
      tooltipLabel="Font family"
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[168px] max-h-72 overflow-y-auto`}
      trigger={
        <>
          <span className="max-w-[120px] truncate whitespace-nowrap">
            {familyLabel}
          </span>
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
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
          onClick={() => {
            onSelectFamily(option.id);
            onOpenChange(false);
          }}
        >
          {option.label}
        </button>
      ))}
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatFontSizeDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size: DetailFontSizeOption;
  onSelectSize: (size: DetailFontSizeOption) => void;
};

export function DetailFormatFontSizeDropdown({
  open,
  onOpenChange,
  size,
  onSelectSize,
}: DetailFormatFontSizeDropdownProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Font size"
      tooltipId="format-toolbar-font-size-tooltip"
      tooltipLabel="Font size"
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[168px]`}
      trigger={
        <>
          <span className="whitespace-nowrap">{size}</span>
          <LuChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </>
      }
    >
      <div className="grid grid-cols-4 gap-0.5 px-2 py-2">
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
  onSuperscript: () => void;
  onSubscript: () => void;
  onGrammarCheck: () => void;
};

export function DetailFormatOverflowMenu({
  open,
  onOpenChange,
  menuRef,
  onStrikethrough,
  onSuperscript,
  onSubscript,
  onGrammarCheck,
}: DetailFormatOverflowMenuProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="More formatting options"
      tooltipId="format-toolbar-more-tooltip"
      tooltipLabel="More options"
      align="right"
      trigger={
        <span
          className={`flex ${FORMAT_TOOLBAR_ICON_SIZE_CLASS} items-center justify-center ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} tracking-widest text-zinc-600 dark:text-zinc-300`}
        >
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
          <span
            className={`flex ${FORMAT_TOOLBAR_ICON_SIZE_CLASS} items-center justify-center ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} line-through`}
          >
            S
          </span>
          Strikethrough
        </button>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS}
          onClick={() => {
            onSuperscript();
            onOpenChange(false);
          }}
        >
          <span
            className={`flex ${FORMAT_TOOLBAR_ICON_SIZE_CLASS} items-center justify-center ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} font-medium`}
          >
            x²
          </span>
          Superscript
        </button>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS}
          onClick={() => {
            onSubscript();
            onOpenChange(false);
          }}
        >
          <span
            className={`flex ${FORMAT_TOOLBAR_ICON_SIZE_CLASS} items-center justify-center ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} font-medium`}
          >
            x₂
          </span>
          Subscript
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
