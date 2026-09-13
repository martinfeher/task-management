"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { AiOutlineLineHeight } from "react-icons/ai";
import { HiNumberedList } from "react-icons/hi2";
import { IoTextOutline } from "react-icons/io5";
import { LuChevronDown } from "react-icons/lu";
import { VscChecklist } from "react-icons/vsc";
import type { DetailTextBlockType, LineBlockType } from "./detail-lines";
import {
  DETAIL_FONT_SIZE_OPTIONS,
  getDetailFontFamilyLabel,
  getFormatToolbarFontFamilyOptions,
  type DetailFontFamilyId,
  type DetailFontSizeOption,
} from "./detail-fonts";
import { BulletListIcon } from "./line-control-icons";
import { DetailLineHeightControl } from "./detail-line-height-control";
import type { DetailLineHeightOption } from "./detail-line-height";

export type FormatToolbarDropdown =
  | "textColor"
  | "highlight"
  | "list"
  | "block"
  | "fontFamily"
  | "fontSize"
  | "overflow";

export const FORMAT_TOOLBAR_ICON_SIZE_CLASS = "size-[18px]";
export const FORMAT_TOOLBAR_ICON_TEXT_CLASS = "text-[17px]";
export const FORMAT_TOOLBAR_TEXT_COLOR_ICON_SIZE_CLASS = "size-[20px]";

/** 10% brighter than Tailwind zinc-700 / zinc-200 */
export const FORMAT_TOOLBAR_ICON_COLOR = "text-[#525259] dark:text-[#e7e7e9]";
/** 10% brighter than Tailwind zinc-600 / zinc-300 */
export const FORMAT_TOOLBAR_ICON_COLOR_MUTED = "text-[#63636b] dark:text-[#d8d8dc]";
/** 10% brighter than Tailwind zinc-500 */
export const FORMAT_TOOLBAR_CHEVRON_COLOR = "text-[#7f7f87]";
/** 10% brighter than Tailwind zinc-800 / zinc-100 */
export const FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR =
  "text-[#3d3d3f] dark:text-[#f5f5f6]";
/** Default text-color trigger icon — intentionally unchanged */
const FORMAT_TOOLBAR_TEXT_COLOR_ICON_COLOR = "text-zinc-700 dark:text-zinc-200";

export const FORMAT_TOOLBAR_DROPDOWN_TRIGGER_CLASS =
  `flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

export const FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS =
  "overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 min-w-[168px] cursor-pointer";

export const FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS =
  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_FONT_FAMILY_TRIGGER_CLASS =
  `flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-1 text-[13px] ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

export const FORMAT_TOOLBAR_FONT_FAMILY_ITEM_CLASS =
  "flex w-full items-center px-3 py-1.5 text-left text-[14px] text-[#48484a] hover:text-[#292929] transition-colors hover:bg-zinc-100 dark:text-[#fbfbfb] dark:hover:bg-zinc-800 cursor-pointer";

export const FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS = "text-[14px] px-0";
/** 15% brighter than #83a1e0 / Tailwind blue-300 (#93c5fd) */
export const FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR =
  "text-[#96afe5] dark:text-[#a3cefd]";

export const FORMAT_TOOLBAR_FONT_SIZE_TRIGGER_CLASS =
  `flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS =
  `inline-flex h-[18px] w-[22px] shrink-0 items-center justify-center leading-none ${FORMAT_TOOLBAR_ICON_COLOR}`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_BASE_CLASS =
  "rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 w-[151px] min-w-[151px]";

const FORMAT_TOOLBAR_OVERFLOW_MENU_CLASS =
  `${FORMAT_TOOLBAR_OVERFLOW_MENU_BASE_CLASS} overflow-hidden`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_SCROLLABLE_CLASS =
  `${FORMAT_TOOLBAR_OVERFLOW_MENU_BASE_CLASS} max-h-[min(70vh,360px)] overflow-x-hidden overflow-y-auto`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_TRIGGER_CLASS =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800";

const FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 px-[10.8px] py-1.5 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_TOOLTIP_CLASS =
  "add-task-date-tooltip add-task-date-tooltip-below pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity";

export const FORMAT_TOOLBAR_TOOLTIP_SHORTCUT_CLASS =
  "format-toolbar-tooltip-shortcut mt-0.5 block text-[10px] font-normal leading-none";

export function getFormatToolbarShortcut(key: string) {
  const isApple =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.userAgent);

  return isApple ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

type FormatToolbarTooltipWrapProps = {
  label: string;
  tooltipId: string;
  hideTooltip?: boolean;
  shortcut?: string;
  children: ReactNode;
};

export function FormatToolbarTooltipWrap({
  label,
  tooltipId,
  hideTooltip = false,
  shortcut,
  children,
}: FormatToolbarTooltipWrapProps) {
  return (
    <div className="group/format-tooltip relative">
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={`${FORMAT_TOOLBAR_TOOLTIP_CLASS} ${
          shortcut ? "py-2 text-center" : ""
        } ${hideTooltip ? "" : "group-hover/format-tooltip:opacity-100"}`}
      >
        <span className="block whitespace-nowrap">{label}</span>
        {shortcut ? (
          <span className={FORMAT_TOOLBAR_TOOLTIP_SHORTCUT_CLASS}>{shortcut}</span>
        ) : null}
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
      ? "text-[#474747] dark:text-[#474747]"
      : active
        ? "text-[#2563eb]"
        : FORMAT_TOOLBAR_ICON_COLOR;

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
  menuStyle?: CSSProperties;
  align?: "left" | "right" | "center";
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
  menuStyle,
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
            className={`absolute top-full z-10 pt-1 ${
              align === "right"
                ? "right-0"
                : align === "center"
                  ? "left-1/2 -translate-x-1/2"
                  : "left-0"
            }`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              role="menu"
              aria-label={ariaLabel}
              className={menuClassName}
              style={menuStyle}
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
  "mb-2 text-[11px] font-medium text-gray-600 dark:text-zinc-300";

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
          ? "ring-[1px] ring-[#d5d5d9] ring-offset-[1px] dark:ring-[#b9b9bb]"
          : ""
      }`}
      style={{ backgroundColor: option.value }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    />
  );
}

type DetailFormatTextColorDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTextColor: string;
  textColorOptions: readonly DetailTextColorOption[];
  onSelectTextColor: (color: string) => void;
  recentColors?: RecentFormatColor[];
};

export function DetailFormatTextColorDropdown({
  open,
  onOpenChange,
  selectedTextColor,
  textColorOptions,
  onSelectTextColor,
  recentColors = [],
}: DetailFormatTextColorDropdownProps) {
  const matchedTextColorOption = textColorOptions.find((option) =>
    colorsEquivalent(option.value, selectedTextColor),
  );
  const recentTextColors = recentColors.filter((entry) => entry.kind === "text");

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Text color"
      tooltipId="format-toolbar-text-color-tooltip"
      tooltipLabel="Text color"
      openClassName=""
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[220px]`}
      triggerClassName={`format-text-color-trigger flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm ${FORMAT_TOOLBAR_ICON_COLOR} transition-[background-color] duration-150`}
      trigger={
        <>
          <span
            className="size-[16px] shrink-0 rounded-full border bg-white p-[2px] dark:bg-zinc-900"
            style={{
              borderColor: matchedTextColorOption?.borderColor ?? "#454454",
            }}
          >
            <span
              className="block size-full rounded-full"
              style={{ backgroundColor: selectedTextColor }}
            />
          </span>
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
        </>
      }
    >
      <div className="space-y-3 px-3 py-2">
        {recentTextColors.length > 0 ? (
          <section>
            <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Recently Used</p>
            <div className="flex flex-wrap gap-1.5">
              {recentTextColors.map((entry) => (
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
              ))}
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
      </div>
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatHighlightColorDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHighlightColor: string;
  highlightColorOptions: readonly { label: string; value: string }[];
  isHighlightActive?: boolean;
  onSelectHighlightColor: (color: string) => void;
  recentColors?: RecentFormatColor[];
};

export function DetailFormatHighlightColorDropdown({
  open,
  onOpenChange,
  selectedHighlightColor,
  highlightColorOptions,
  isHighlightActive = false,
  onSelectHighlightColor,
  recentColors = [],
}: DetailFormatHighlightColorDropdownProps) {
  const menuSelectedHighlightColor = isHighlightActive
    ? selectedHighlightColor
    : "#ffffff";
  const recentHighlightColors = recentColors.filter(
    (entry) => entry.kind === "highlight",
  );

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Highlight color"
      tooltipId="format-toolbar-highlight-tooltip"
      tooltipLabel="Highlight color"
      openClassName=""
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[220px]`}
      triggerClassName={`format-highlight-trigger flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm ${FORMAT_TOOLBAR_ICON_COLOR} transition-[background-color] duration-150`}
      trigger={
        <>
          <span
            className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border bg-white dark:bg-zinc-900"
            style={{
              borderColor: "#e9e9e7",
              backgroundColor: isHighlightActive
                ? selectedHighlightColor
                : undefined,
            }}
          >
            <FormatHighlightIcon
              className={`${FORMAT_TOOLBAR_TEXT_COLOR_ICON_SIZE_CLASS} ${FORMAT_TOOLBAR_TEXT_COLOR_ICON_COLOR}`}
            />
          </span>
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
        </>
      }
    >
      <div className="space-y-3 px-3 py-2">
        {recentHighlightColors.length > 0 ? (
          <section>
            <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Recently Used</p>
            <div className="flex flex-wrap gap-1.5">
              {recentHighlightColors.map((entry) => (
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
              ))}
            </div>
          </section>
        ) : null}

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

/** @deprecated Use DetailFormatTextColorDropdown and DetailFormatHighlightColorDropdown */
export const DetailFormatTextHighlightColorDropdown = DetailFormatHighlightColorDropdown;

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
            className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} ${FORMAT_TOOLBAR_ICON_COLOR}`}
          />
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
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
          <Icon className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} ${FORMAT_TOOLBAR_ICON_COLOR_MUTED}`} />
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
            className={`font-medium ${FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR} ${
              activeType === "text" ? "text-[14px]" : FORMAT_TOOLBAR_ICON_TEXT_CLASS
            }`}
          >
            Aa
          </span>
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
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
  const formatToolbarFontOptions = getFormatToolbarFontFamilyOptions();
  const familyLabel = getDetailFontFamilyLabel(familyId);

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Font family"
      tooltipId="format-toolbar-font-family-tooltip"
      tooltipLabel="Font family"
      triggerClassName={FORMAT_TOOLBAR_FONT_FAMILY_TRIGGER_CLASS}
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} max-h-72 overflow-y-auto`}
      menuStyle={{ minWidth: "128px" }}
      trigger={
        <>
          <span className="max-w-[120px] truncate whitespace-nowrap">
            {familyLabel}
          </span>
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
        </>
      }
    >
      {formatToolbarFontOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          role="menuitem"
          className={`${FORMAT_TOOLBAR_FONT_FAMILY_ITEM_CLASS} ${
            familyId !== "mixed" && option.id === familyId
              ? "bg-zinc-100 dark:bg-zinc-800"
              : ""
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
      triggerClassName={FORMAT_TOOLBAR_FONT_SIZE_TRIGGER_CLASS}
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[168px]`}
      trigger={
        <>
          <span className={`whitespace-nowrap ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS}`}>
            {size}
          </span>
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
        </>
      }
    >
      <div className="grid grid-cols-4 gap-0.5 px-1 py-1">
        {DETAIL_FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitem"
            className={`rounded-md px-1 py-1 text-center ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-800 ${
              option === size
                ? `bg-zinc-100 font-medium ${FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR} dark:bg-zinc-800`
                : FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR
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
  lineHeight: DetailLineHeightOption;
  onSelectLineHeight: (lineHeight: DetailLineHeightOption) => void;
  onUnderline: () => void;
  onStrikethrough: () => void;
  onSuperscript: () => void;
  onSubscript: () => void;
};

export function DetailFormatOverflowMenu({
  open,
  onOpenChange,
  menuRef,
  lineHeight,
  onSelectLineHeight,
  onUnderline,
  onStrikethrough,
  onSuperscript,
  onSubscript,
}: DetailFormatOverflowMenuProps) {
  const [lineHeightPanelOpen, setLineHeightPanelOpen] = useState(false);
  const lineHeightCloseTimerRef = useRef<number | null>(null);
  const lineHeightOpen = open && lineHeightPanelOpen;

  useEffect(() => {
    if (!open) {
      setLineHeightPanelOpen(false);
    }
  }, [open]);

  function clearLineHeightCloseTimer() {
    if (lineHeightCloseTimerRef.current !== null) {
      window.clearTimeout(lineHeightCloseTimerRef.current);
      lineHeightCloseTimerRef.current = null;
    }
  }

  function handleLineHeightMouseEnter() {
    clearLineHeightCloseTimer();
    setLineHeightPanelOpen(true);
  }

  function handleLineHeightMouseLeave() {
    clearLineHeightCloseTimer();
    lineHeightCloseTimerRef.current = window.setTimeout(() => {
      lineHeightCloseTimerRef.current = null;
      setLineHeightPanelOpen(false);
    }, FORMAT_TOOLBAR_DROPDOWN_HOVER_CLOSE_MS);
  }

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="More formatting options"
      tooltipId="format-toolbar-more-tooltip"
      tooltipLabel="More options"
      align="center"
      triggerClassName={FORMAT_TOOLBAR_OVERFLOW_MENU_TRIGGER_CLASS}
      menuClassName={
        lineHeightOpen
          ? FORMAT_TOOLBAR_OVERFLOW_MENU_SCROLLABLE_CLASS
          : FORMAT_TOOLBAR_OVERFLOW_MENU_CLASS
      }
      trigger={
        <span
          className={`flex ${FORMAT_TOOLBAR_ICON_SIZE_CLASS} items-center justify-center ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} tracking-widest ${FORMAT_TOOLBAR_ICON_COLOR_MUTED}`}
        >
          ···
        </span>
      }
    >
      <div ref={menuRef}>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS}
          style={{ fontSize: "13px" }}
          onClick={() => {
            onUnderline();
            onOpenChange(false);
          }}
        >
          <span
            className={`${FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS} ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} -translate-x-[3px] underline`}
          >
            U
          </span>
          Underline
        </button>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS}
          style={{ fontSize: "13px" }}
          onClick={() => {
            onStrikethrough();
            onOpenChange(false);
          }}
        >
          <span
            className={`${FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS} ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} -translate-x-[3px] line-through`}
          >
            S
          </span>
          Strikethrough
        </button>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS}
          style={{ fontSize: "13px" }}
          onClick={() => {
            onSuperscript();
            onOpenChange(false);
          }}
        >
          <span
            className={`${FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS} ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} font-medium`}
          >
            x²
          </span>
          Superscript
        </button>
        <button
          type="button"
          role="menuitem"
          className={FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS}
          style={{ fontSize: "13px" }}
          onClick={() => {
            onSubscript();
            onOpenChange(false);
          }}
        >
          <span
            className={`${FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS} ${FORMAT_TOOLBAR_ICON_TEXT_CLASS} font-medium`}
          >
            x₂
          </span>
          Subscript
        </button>
        <div
          onMouseEnter={handleLineHeightMouseEnter}
          onMouseLeave={handleLineHeightMouseLeave}
        >
          <button
            type="button"
            role="menuitem"
            aria-haspopup="listbox"
            aria-expanded={lineHeightOpen}
            className={`${FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS} ${
              lineHeightOpen ? "bg-zinc-100 dark:bg-zinc-800" : ""
            }`}
            style={{ fontSize: "13px" }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setLineHeightPanelOpen(true)}
          >
            <span className={FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS}>
              <AiOutlineLineHeight
                className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} ${FORMAT_TOOLBAR_ICON_COLOR_MUTED}`}
                aria-hidden="true"
              />
            </span>
            Line height
          </button>

          {lineHeightOpen ? (
            <DetailLineHeightControl
              open={lineHeightOpen}
              value={lineHeight}
              onSelect={(nextLineHeight) => {
                onSelectLineHeight(nextLineHeight);
                setLineHeightPanelOpen(false);
                onOpenChange(false);
              }}
              className="mx-1 mb-1 border-0 shadow-none"
            />
          ) : null}
        </div>
      </div>
    </FormatToolbarDropdownShell>
  );
}
