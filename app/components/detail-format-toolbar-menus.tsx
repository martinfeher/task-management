"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AiOutlineLineHeight } from "react-icons/ai";
import { HiNumberedList } from "react-icons/hi2";
import { IoTextOutline } from "react-icons/io5";
import { LuCheck, LuChevronDown, LuMinus, LuPlus } from "react-icons/lu";
import { VscChecklist } from "react-icons/vsc";
import type { DetailTextBlockType, LineBlockType } from "./detail-lines";
import {
  DETAIL_FONT_SIZE_OPTIONS,
  detailFontSizeFromSliderValue,
  getDetailFontFamilyLabel,
  stepDetailFontSizeOption,
  getDetailFontFamilyValue,
  getFormatToolbarFontFamilyOptions,
  type DetailFontFamilyId,
  type DetailFontSizeOption,
} from "./detail-fonts";
import { BulletListIcon } from "./line-control-icons";
import { DetailLineHeightControl } from "./detail-line-height-control";
import type { DetailLineHeightOption } from "./detail-line-height";
import { FROSTED_POPOVER_SURFACE_CLASS } from "@/lib/frosted-popover-surface";

const FORMAT_TOOLBAR_MENU_SCROLL_CLASS_PATTERN =
  /\b(?:overflow-(?:hidden|y-auto|x-hidden)|max-h-\[[^\]]+\]|max-h-\S+)\b/g;

function splitFormatToolbarMenuSurfaceClasses(menuClassName: string) {
  const scrollClassName = (
    menuClassName.match(FORMAT_TOOLBAR_MENU_SCROLL_CLASS_PATTERN) ?? []
  ).join(" ");
  const surfaceClassName = menuClassName
    .replace(FORMAT_TOOLBAR_MENU_SCROLL_CLASS_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return { surfaceClassName, scrollClassName };
}

export type FormatToolbarDropdown =
  | "textColor"
  | "highlight"
  | "list"
  | "typography"
  | "fontFamily"
  | "lineHeight"
  | "overflow";

export const FORMAT_TOOLBAR_ICON_SIZE_CLASS = "size-[18px]";
export const FORMAT_TOOLBAR_ICON_TEXT_CLASS = "text-[17px]";
export const FORMAT_TOOLBAR_TEXT_COLOR_ICON_SIZE_CLASS = "size-[20px]";

/** 10% brighter than Tailwind zinc-700 / zinc-200 */
export const FORMAT_TOOLBAR_ICON_COLOR = "text-[#525259] dark:text-[#e7e7e9]";
/** 10% brighter than Tailwind zinc-600 / zinc-300 */
export const FORMAT_TOOLBAR_ICON_COLOR_MUTED = "text-[#63636b] dark:text-[#d8d8dc]";
/** Line height trigger: 2px smaller than `FORMAT_TOOLBAR_ICON_SIZE_CLASS`, 15% brighter than muted. */
const FORMAT_TOOLBAR_LINE_HEIGHT_ICON_SIZE_CLASS = "size-[16px]";
const FORMAT_TOOLBAR_LINE_HEIGHT_ICON_COLOR =
  "text-[#7a7a81] dark:text-[#dedee1]";
/** 10% brighter than Tailwind zinc-500 */
export const FORMAT_TOOLBAR_CHEVRON_COLOR = "text-[#7f7f87]";
/** 10% brighter than Tailwind zinc-800 / zinc-100 */
export const FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR =
  "text-[#3d3d3f] dark:text-[#f5f5f6]";

/** Default text-color trigger icon — intentionally unchanged */
const FORMAT_TOOLBAR_TEXT_COLOR_ICON_COLOR = "text-zinc-700 dark:text-zinc-200";

export const FORMAT_TOOLBAR_DROPDOWN_TRIGGER_CLASS =
  `flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

const FORMAT_TOOLBAR_DROPDOWN_MENU_SURFACE_CLASS = `format-toolbar-dropdown-menu ${FROSTED_POPOVER_SURFACE_CLASS}`;

export const FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS = `overflow-hidden rounded-[12px] py-1 min-w-[168px] cursor-pointer ${FORMAT_TOOLBAR_DROPDOWN_MENU_SURFACE_CLASS}`;

/** List and heading menus: 8px inset on all sides. */
export const FORMAT_TOOLBAR_LIST_BLOCK_MENU_CLASS = `overflow-hidden rounded-[12px] p-2 min-w-[168px] cursor-pointer ${FORMAT_TOOLBAR_DROPDOWN_MENU_SURFACE_CLASS}`;

/** Font-family submenu: 14px corners + frosted blur (see globals.css). */
export const FORMAT_TOOLBAR_FONT_FAMILY_MENU_CLASS = `format-toolbar-font-family-submenu overflow-hidden rounded-[14px] p-2 min-w-[168px] cursor-pointer ${FORMAT_TOOLBAR_DROPDOWN_MENU_SURFACE_CLASS}`;

export const FORMAT_TOOLBAR_DROPDOWN_ITEM_CLASS =
  "menu-item-hover-focus flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_LIST_BLOCK_MENU_ITEM_CLASS =
  "menu-item-hover-focus flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

/** List type dropdown (bullet / numbered / checklist) option text. */
const FORMAT_TOOLBAR_LIST_TYPE_MENU_ITEM_CLASS =
  "menu-item-hover-focus flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm text-[#696970] hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

export const FORMAT_TOOLBAR_FONT_FAMILY_TRIGGER_CLASS =
  `flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-1 text-[13px] ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

export const FORMAT_TOOLBAR_FONT_FAMILY_ITEM_CLASS =
  "menu-item-hover-focus flex w-full items-center pl-[14px] pr-2 py-1.5 text-left text-[14px] text-[#48484a] hover:text-[#292929] hover:bg-zinc-100 dark:text-[#fbfbfb] dark:hover:bg-zinc-800 cursor-pointer";

export const FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS = "text-[14px] px-0";
/** 15% brighter than #83a1e0 / Tailwind blue-300 (#93c5fd) */
export const FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR =
  "text-[#96afe5] dark:text-[#a3cefd]";

export const FORMAT_TOOLBAR_FONT_SIZE_TRIGGER_CLASS =
  `flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_ICON_CLASS =
  `inline-flex h-[18px] w-[22px] shrink-0 items-center justify-center leading-none ${FORMAT_TOOLBAR_ICON_COLOR}`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_BASE_CLASS = `rounded-[12px] p-2 w-[151px] min-w-[151px] ${FORMAT_TOOLBAR_DROPDOWN_MENU_SURFACE_CLASS}`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_CLASS =
  `${FORMAT_TOOLBAR_OVERFLOW_MENU_BASE_CLASS} overflow-hidden`;

const FORMAT_TOOLBAR_OVERFLOW_MENU_TRIGGER_CLASS =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800";

const FORMAT_TOOLBAR_OVERFLOW_MENU_ITEM_CLASS =
  "menu-item-hover-focus flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

/** Where the format toolbar sits relative to the text selection. */
export type FormatToolbarAnchorPlacement = "above" | "below";

const FormatToolbarAnchorPlacementContext =
  createContext<FormatToolbarAnchorPlacement>("below");

export function FormatToolbarAnchorPlacementProvider({
  placement,
  children,
}: {
  placement: FormatToolbarAnchorPlacement;
  children: ReactNode;
}) {
  return (
    <FormatToolbarAnchorPlacementContext.Provider value={placement}>
      {children}
    </FormatToolbarAnchorPlacementContext.Provider>
  );
}

function useFormatToolbarAnchorPlacement() {
  return useContext(FormatToolbarAnchorPlacementContext);
}

const FORMAT_TOOLBAR_TOOLTIP_CHROME =
  "add-task-date-tooltip pointer-events-none absolute z-50 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium";

function getFormatToolbarTooltipPositionClass(
  placement: FormatToolbarAnchorPlacement,
  showOnHover: boolean,
) {
  const motion = showOnHover ? "app-hover-tooltip " : "";
  if (placement === "above") {
    return `${FORMAT_TOOLBAR_TOOLTIP_CHROME} ${motion}app-hover-tooltip-above-center bottom-[calc(100%+6px)]`;
  }

  return `${FORMAT_TOOLBAR_TOOLTIP_CHROME} ${motion}app-hover-tooltip-below-center add-task-date-tooltip-below top-[calc(100%+6px)]`;
}

/** @deprecated Use placement-aware tooltips via FormatToolbarAnchorPlacementProvider */
export const FORMAT_TOOLBAR_TOOLTIP_CLASS =
  getFormatToolbarTooltipPositionClass("below", true);

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
  const placement = useFormatToolbarAnchorPlacement();

  return (
    <div className="group/format-tooltip relative">
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={`${getFormatToolbarTooltipPositionClass(placement, !hideTooltip)} ${
          shortcut ? "py-2 text-center" : ""
        } ${hideTooltip ? "opacity-0" : ""}`}
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

export type DetailTypographyPreset = {
  id: string;
  label: string;
  size: DetailFontSizeOption;
  blockType: DetailTextBlockType;
};

const DETAIL_TYPOGRAPHY_PRESETS: DetailTypographyPreset[] = [
  { id: "small", label: "Small", size: 12, blockType: "text" },
  { id: "body", label: "Body", size: 15, blockType: "text" },
  { id: "h3", label: "Heading 3", size: 22, blockType: "h3" },
  { id: "h2", label: "Heading 2", size: 28, blockType: "h2" },
  { id: "h1", label: "Heading 1", size: 36, blockType: "h1" },
];

const FORMAT_TOOLBAR_TYPOGRAPHY_MENU_CLASS = `${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} w-[222px] min-w-[222px] p-2`;

const FORMAT_TOOLBAR_TYPOGRAPHY_TRIGGER_CLASS =
  `flex h-7 min-w-0 cursor-pointer items-center gap-1 rounded-full px-1.5 ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-200/60 dark:hover:bg-zinc-700/80`;

const FORMAT_TOOLBAR_TYPOGRAPHY_STEPPER_CLASS =
  "menu-item-hover-focus flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-700/80";

function isTypographyPresetActive(
  preset: DetailTypographyPreset,
  blockType: DetailTextBlockType,
  size: DetailFontSizeOption,
) {
  return preset.blockType === blockType && preset.size === size;
}

function getTypographyStyleLabel(
  blockType: DetailTextBlockType,
  size: DetailFontSizeOption,
) {
  const preset = DETAIL_TYPOGRAPHY_PRESETS.find((entry) =>
    isTypographyPresetActive(entry, blockType, size),
  );
  if (preset) return preset.label;

  if (blockType === "h1") return "Heading 1";
  if (blockType === "h2") return "Heading 2";
  if (blockType === "h3") return "Heading 3";
  return "Body";
}

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

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) =>
      Math.min(255, Math.max(0, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Mix each channel toward white for a brighter ring around text-color swatches. */
const TEXT_COLOR_SWATCH_BORDER_BRIGHTEN = 0.7;
const TEXT_COLOR_SWATCH_LETTER_SIZE_CLASS = "text-[15px]";
const TEXT_COLOR_PREVIEW_FRAME_COLOR = "#B2D7eE";
// const TEXT_COLOR_PREVIEW_FRAME_COLOR = "#ced0df";
// const TEXT_COLOR_PREVIEW_FRAME_COLOR = "#c3c5d3";
// const TEXT_COLOR_PREVIEW_FRAME_COLOR = "#ababb7";
const TEXT_COLOR_GRID_COLUMNS = 6;

function brightenHexColor(hex: string, amount = TEXT_COLOR_SWATCH_BORDER_BRIGHTEN) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const [r, g, b] = rgb.map((channel) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount)),
  );

  return rgbToHex(r, g, b);
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
  menuRef?: RefObject<HTMLDivElement | null>;
  menuAnchorExtraGapPx?: number;
  trigger: ReactNode;
  children: ReactNode;
};

const FORMAT_TOOLBAR_DROPDOWN_HOVER_CLOSE_MS = 120;
const FORMAT_TOOLBAR_DROPDOWN_PORTAL_Z_CLASS = "z-[10080]";
const FORMAT_TOOLBAR_DROPDOWN_GAP_PX = 4;
const FORMAT_TOOLBAR_DROPDOWN_VIEWPORT_PADDING_PX = 8;
const FORMAT_TOOLBAR_DROPDOWN_EXTRA_GAP_PX = 7;

function getFormatToolbarDropdownGapPx(menuAnchorExtraGapPx: number) {
  return menuAnchorExtraGapPx > 0
    ? FORMAT_TOOLBAR_DROPDOWN_EXTRA_GAP_PX
    : FORMAT_TOOLBAR_DROPDOWN_GAP_PX;
}

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
  menuRef,
  menuAnchorExtraGapPx = 0,
  trigger,
  children,
}: DropdownShellProps) {
  const { surfaceClassName, scrollClassName } =
    splitFormatToolbarMenuSurfaceClasses(menuClassName);
  const placement = useFormatToolbarAnchorPlacement();
  const closeTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const internalMenuRef = useRef<HTMLDivElement>(null);
  const resolvedMenuRef = menuRef ?? internalMenuRef;
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    side: FormatToolbarAnchorPlacement;
  } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = resolvedMenuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = getFormatToolbarDropdownGapPx(menuAnchorExtraGapPx);
    const aboveTop = triggerRect.top - gap - menuRect.height;
    const belowTop = triggerRect.bottom + gap;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    // The toolbar itself never moves when a submenu opens; instead the submenu
    // opens on the opposite side when it would not fit on the preferred one.
    let side: FormatToolbarAnchorPlacement = placement;
    if (placement === "above" && aboveTop < FORMAT_TOOLBAR_DROPDOWN_VIEWPORT_PADDING_PX) {
      side = "below";
    } else if (
      placement === "below" &&
      belowTop + menuRect.height >
        viewportHeight - FORMAT_TOOLBAR_DROPDOWN_VIEWPORT_PADDING_PX &&
      aboveTop >= FORMAT_TOOLBAR_DROPDOWN_VIEWPORT_PADDING_PX
    ) {
      side = "above";
    }

    const top = side === "above" ? aboveTop : belowTop;

    let left: number;
    if (align === "right") {
      left = triggerRect.right - menuRect.width;
    } else if (align === "center") {
      left = triggerRect.left + triggerRect.width / 2 - menuRect.width / 2;
    } else {
      left = triggerRect.left;
    }

    setMenuPosition((current) =>
      current &&
      current.top === top &&
      current.left === left &&
      current.side === side
        ? current
        : { top, left, side },
    );
  }, [align, menuAnchorExtraGapPx, placement, resolvedMenuRef]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition, children]);

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
          ref={triggerRef}
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
          onClick={() => {
            if (!open) {
              onOpenChange(true);
            }
          }}
        >
          {trigger}
        </button>

        {open ? (
          <div
            aria-hidden="true"
            className={`absolute z-10 ${
              align === "right"
                ? "right-0"
                : align === "center"
                  ? "left-1/2 -translate-x-1/2 w-8"
                  : "left-0"
            } ${
              (menuPosition?.side ?? placement) === "above"
                ? "bottom-full"
                : "top-full"
            }`}
            style={{
              height: getFormatToolbarDropdownGapPx(menuAnchorExtraGapPx),
              width: align === "center" ? undefined : "100%",
              minWidth: align === "center" ? 32 : undefined,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ) : null}

        {open && typeof document !== "undefined"
          ? createPortal(
              <div
                data-format-toolbar-dropdown-portal
                className={`fixed ${FORMAT_TOOLBAR_DROPDOWN_PORTAL_Z_CLASS}`}
                style={{
                  top: menuPosition?.top ?? -10000,
                  left: menuPosition?.left ?? -10000,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  ref={resolvedMenuRef}
                  role="menu"
                  aria-label={ariaLabel}
                  className={`${surfaceClassName} overflow-visible`}
                  style={menuStyle}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <div
                    className={`overflow-hidden rounded-[inherit] ${scrollClassName}`}
                  >
                    {children}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
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

const FORMAT_TEXT_COLOR_CUSTOM_RING_GRADIENT =
  "conic-gradient(#a855f7, #ef4444, #facc15, #22c55e, #3b82f6, #a855f7)";

const FORMAT_TEXT_COLOR_CUSTOM_CHIP_CLASS =
  "menu-item-hover-focus flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-transform hover:scale-110";

function toNativeColorInputValue(color: string) {
  const normalized = normalizeColorValue(color);
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  const hex = rgbStringToHex(color);
  return hex ?? "#000000";
}

export type TextColorPreviewTypography = {
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
};

function TextColorSwatchButton({
  option,
  selected,
  onSelect,
  onPreviewHover,
}: {
  option: DetailTextColorOption;
  selected: boolean;
  onSelect: () => void;
  onPreviewHover?: (option: DetailTextColorOption) => void;
}) {
  const swatchBorderColor = brightenHexColor(option.value);

  return (
    <button
      type="button"
      role="menuitem"
      aria-label={option.label}
      title={option.label}
      className={`flex size-7 items-center justify-center rounded-full border-[0.5px] bg-white cursor-pointer ${TEXT_COLOR_SWATCH_LETTER_SIZE_CLASS} font-medium leading-none transition-transform hover:scale-110 dark:bg-zinc-900 ${
        selected
          ? "ring-[1px] ring-zinc-200 ring-offset-1 dark:ring-zinc-700"
          : ""
      }`}
      style={{
        color: option.value,
        borderColor: swatchBorderColor,
      }}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => onPreviewHover?.(option)}
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
  onPreviewHover,
}: {
  option: { label: string; value: string };
  selected: boolean;
  onSelect: () => void;
  onPreviewHover?: (option: { label: string; value: string }) => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={option.label}
      title={option.label}
      className={`size-6 cursor-pointer rounded-full border transition-transform hover:scale-110 ${
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
      onMouseEnter={() => onPreviewHover?.(option)}
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
  onPreviewTextColorChange?: (color: string) => void;
  onPreviewTextColorClear?: () => void;
  recentColors?: RecentFormatColor[];
  previewText?: string;
  previewTypography?: TextColorPreviewTypography;
};

export function DetailFormatTextColorDropdown({
  open,
  onOpenChange,
  selectedTextColor,
  textColorOptions,
  onSelectTextColor,
  onPreviewTextColorChange,
  onPreviewTextColorClear,
  recentColors = [],
  previewText,
  previewTypography,
}: DetailFormatTextColorDropdownProps) {
  const placement = useFormatToolbarAnchorPlacement();
  const menuRef = useRef<HTMLDivElement>(null);
  const customColorInputRef = useRef<HTMLInputElement>(null);
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const previewContent = previewText?.trim() ?? "";
  const previewFontSize = previewTypography
    ? Math.min(previewTypography.fontSize, 16)
    : 16;
  const matchedTextColorOption = textColorOptions.find((option) =>
    colorsEquivalent(option.value, selectedTextColor),
  );
  const recentTextColors = recentColors.filter((entry) => entry.kind === "text");

  function updatePreviewPosition() {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPreviewPosition({
      top:
        placement === "above" ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }

  function handlePreviewHover(option: DetailTextColorOption) {
    onPreviewTextColorChange?.(option.value);

    if (onPreviewTextColorChange) return;

    if (!previewContent) return;

    updatePreviewPosition();
    setPreviewColor(option.value);
  }

  function clearPreview() {
    onPreviewTextColorClear?.();
    setPreviewColor(null);
  }

  useEffect(() => {
    if (!open) {
      clearPreview();
    }
  }, [open]);

  useEffect(() => {
    if (!previewColor) return;

    function handleReposition() {
      updatePreviewPosition();
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [previewColor]);

  return (
    <>
      <FormatToolbarDropdownShell
        open={open}
        onOpenChange={onOpenChange}
        ariaLabel="Text color"
        tooltipId="format-toolbar-text-color-tooltip"
        tooltipLabel="Text color"
        openClassName=""
        menuRef={menuRef}
        menuClassName={`format-toolbar-color-submenu ${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[260px] overflow-visible`}
        triggerClassName={`format-text-color-trigger flex h-8 cursor-pointer items-center gap-0.5 rounded-lg px-2 text-sm ${FORMAT_TOOLBAR_ICON_COLOR} transition-[background-color] duration-150`}
        trigger={
          <>
            <span
              className="size-[16px] shrink-0 rounded-full border bg-white p-[2px] dark:bg-zinc-900"
              style={{
                borderColor: brightenHexColor(
                  matchedTextColorOption?.value ?? selectedTextColor,
                ),
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
        <div className="space-y-3 px-3 py-2" onMouseLeave={clearPreview}>
          <section>
            <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Recently Used</p>
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {recentTextColors.map((entry) => (
                  <TextColorSwatchButton
                    key={`recent-text-${entry.color}`}
                    option={{
                      label: entry.label,
                      value: entry.color,
                    }}
                    selected={colorsEquivalent(entry.color, selectedTextColor)}
                    onPreviewHover={handlePreviewHover}
                    onSelect={() => {
                      onSelectTextColor(entry.color);
                    }}
                  />
                ))}
              </div>
              <div className="group/format-color-custom relative shrink-0 translate-x-[3px] -translate-y-[3px]">
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Custom color"
                  aria-describedby="format-toolbar-text-color-custom-tooltip"
                  className={FORMAT_TEXT_COLOR_CUSTOM_CHIP_CLASS}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    customColorInputRef.current?.click();
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="relative flex size-7 items-center justify-center rounded-full p-[2px]"
                    style={{ background: FORMAT_TEXT_COLOR_CUSTOM_RING_GRADIENT }}
                  >
                    <span className="flex size-full items-center justify-center rounded-full bg-white dark:bg-zinc-900">
                      <LuPlus className="size-3 text-zinc-800 dark:text-zinc-100" />
                    </span>
                  </span>
                </button>
                <input
                  ref={customColorInputRef}
                  type="color"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="pointer-events-none absolute size-0 opacity-0"
                  value={toNativeColorInputValue(selectedTextColor)}
                  onInput={(event) => {
                    onPreviewTextColorChange?.(event.currentTarget.value);
                  }}
                  onChange={(event) => {
                    const nextColor = event.target.value;
                    onPreviewTextColorChange?.(nextColor);
                    onSelectTextColor(nextColor);
                  }}
                />
                <span
                  id="format-toolbar-text-color-custom-tooltip"
                  role="tooltip"
                  className={`${FORMAT_TOOLBAR_TOOLTIP_CHROME} app-hover-tooltip app-hover-tooltip-above-center bottom-[calc(100%+6px)] z-[10100]`}
                >
                  Custom color
                </span>
              </div>
            </div>
          </section>

          <section>
            <p className={FORMAT_COLOR_MENU_SECTION_TITLE_CLASS}>Text Color</p>
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${TEXT_COLOR_GRID_COLUMNS}, minmax(0, 1fr))`,
              }}
            >
              {textColorOptions.map((option) => (
                <TextColorSwatchButton
                  key={option.value}
                  option={option}
                  selected={colorsEquivalent(option.value, selectedTextColor)}
                  onPreviewHover={handlePreviewHover}
                  onSelect={() => {
                    onSelectTextColor(option.value);
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      </FormatToolbarDropdownShell>

      {previewColor && previewContent
        ? createPortal(
            <div
              className={`pointer-events-none fixed z-[300] w-max max-h-[200px] max-w-[min(400px,calc(100vw-16px))] -translate-x-1/2 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-[19px] border-[3px] bg-white px-4 py-2 shadow-md dark:bg-zinc-900 ${
                placement === "above" ? "-translate-y-full" : ""
              }`}
              style={{
                top: previewPosition.top,
                left: previewPosition.left,
                color: previewColor,
                borderColor: TEXT_COLOR_PREVIEW_FRAME_COLOR,
                fontFamily: previewTypography?.fontFamily,
                fontSize: `${previewFontSize}px`,
                lineHeight: previewTypography?.lineHeight,
              }}
            >
              {previewContent}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

type DetailFormatHighlightColorDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHighlightColor: string;
  highlightColorOptions: readonly { label: string; value: string }[];
  isHighlightActive?: boolean;
  onSelectHighlightColor: (color: string) => void;
  onPreviewHighlightColorChange?: (color: string) => void;
  onPreviewHighlightColorClear?: () => void;
  recentColors?: RecentFormatColor[];
};

export function DetailFormatHighlightColorDropdown({
  open,
  onOpenChange,
  selectedHighlightColor,
  highlightColorOptions,
  isHighlightActive = false,
  onSelectHighlightColor,
  onPreviewHighlightColorChange,
  onPreviewHighlightColorClear,
  recentColors = [],
}: DetailFormatHighlightColorDropdownProps) {
  const menuSelectedHighlightColor = isHighlightActive
    ? selectedHighlightColor
    : "#ffffff";
  const recentHighlightColors = recentColors.filter(
    (entry) => entry.kind === "highlight",
  );

  function handlePreviewHover(option: { label: string; value: string }) {
    onPreviewHighlightColorChange?.(option.value);
  }

  function clearPreview() {
    onPreviewHighlightColorClear?.();
  }

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Highlight color"
      tooltipId="format-toolbar-highlight-tooltip"
      tooltipLabel="Highlight color"
      openClassName=""
      menuClassName={`format-toolbar-color-submenu ${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[220px]`}
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
      <div className="space-y-3 px-3 py-2" onMouseLeave={clearPreview}>
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
                  onPreviewHover={handlePreviewHover}
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
                onPreviewHover={handlePreviewHover}
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
      menuClassName={FORMAT_TOOLBAR_LIST_BLOCK_MENU_CLASS}
      menuAnchorExtraGapPx={3}
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
          className={FORMAT_TOOLBAR_LIST_TYPE_MENU_ITEM_CLASS}
          onClick={() => {
            onSelect(type);
            onOpenChange(false);
          }}
        >
          <Icon
            className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} text-zinc-600 dark:text-zinc-400`}
          />
          {label}
        </button>
      ))}
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatTypographyDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockType: DetailTextBlockType;
  size: DetailFontSizeOption;
  isBlockTypeDisabled?: (type: DetailTextBlockType) => boolean;
  onSelectBlockType: (type: DetailTextBlockType) => void;
  onSelectSize: (size: DetailFontSizeOption) => void;
  onSelectPreset?: (preset: DetailTypographyPreset) => void;
  onPreviewSize?: (size: DetailFontSizeOption) => void;
  onPreviewSizeClear?: () => void;
  /** Restore the editor selection before +/- steps (toolbar clicks collapse selection). */
  onBeforeFontSizeStep?: () => void;
};

export function DetailFormatTypographyDropdown({
  open,
  onOpenChange,
  blockType,
  size,
  isBlockTypeDisabled,
  onSelectBlockType,
  onSelectSize,
  onSelectPreset,
  onPreviewSize,
  onPreviewSizeClear,
  onBeforeFontSizeStep,
}: DetailFormatTypographyDropdownProps) {
  const styleLabel = getTypographyStyleLabel(blockType, size);
  const sliderMin = DETAIL_FONT_SIZE_OPTIONS[0];
  const sliderMax = DETAIL_FONT_SIZE_OPTIONS[DETAIL_FONT_SIZE_OPTIONS.length - 1];
  const [sliderValue, setSliderValue] = useState<number>(size);

  useLayoutEffect(() => {
    if (open) {
      setSliderValue(size);
    }
  }, [open, size]);

  function applyPreset(preset: DetailTypographyPreset) {
    if (isBlockTypeDisabled?.(preset.blockType)) return;

    onBeforeFontSizeStep?.();

    if (onSelectPreset) {
      onSelectPreset(preset);
      return;
    }

    if (preset.blockType !== blockType) {
      onSelectBlockType(preset.blockType);
    }
    if (preset.size !== size) {
      onSelectSize(preset.size);
    }
    onOpenChange(false);
  }

  function stepSize(direction: -1 | 1) {
    onBeforeFontSizeStep?.();
    const next = stepDetailFontSizeOption(size, direction);
    onSelectSize(next);
  }

  function handleFontSizeStepPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    onBeforeFontSizeStep?.();
  }

  function commitSliderValue(value: number) {
    onBeforeFontSizeStep?.();
    const next = detailFontSizeFromSliderValue(value);
    setSliderValue(next);
    onSelectSize(next);
  }

  function handleSliderPointerDown(
    event: React.PointerEvent<HTMLInputElement>,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    onBeforeFontSizeStep?.();
  }

  return (
    <div
      className="flex h-8 items-center gap-0.5 rounded-full bg-zinc-100/80 px-0.5 dark:bg-zinc-800/70"
      onMouseLeave={() => onPreviewSizeClear?.()}
    >
      <button
        type="button"
        className={FORMAT_TOOLBAR_TYPOGRAPHY_STEPPER_CLASS}
        aria-label="Decrease font size"
        onPointerDown={handleFontSizeStepPointerDown}
        onClick={() => stepSize(-1)}
      >
        <LuMinus className="size-3" aria-hidden="true" />
      </button>

      <FormatToolbarDropdownShell
        open={open}
        onOpenChange={onOpenChange}
        ariaLabel="Text style and font size"
        tooltipId="format-toolbar-typography-tooltip"
        tooltipLabel="Text style & size"
        align="center"
        triggerClassName={FORMAT_TOOLBAR_TYPOGRAPHY_TRIGGER_CLASS}
        menuClassName={FORMAT_TOOLBAR_TYPOGRAPHY_MENU_CLASS}
        menuAnchorExtraGapPx={3}
        trigger={
          <>
            <span
              className={`shrink-0 text-[11px] font-semibold tabular-nums ${FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR}`}
            >
              {size}
            </span>
            <span
              className={`max-w-[5.5rem] truncate text-[9px] ${FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR}`}
            >
              {styleLabel}
            </span>
            <LuChevronDown
              className={`size-3 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`}
            />
          </>
        }
      >
        <div className="pb-1" onMouseLeave={() => onPreviewSizeClear?.()}>
          {DETAIL_TYPOGRAPHY_PRESETS.map((preset) => {
            const active = isTypographyPresetActive(preset, blockType, size);
            const disabled = isBlockTypeDisabled?.(preset.blockType) ?? false;

            return (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                disabled={disabled}
                className={`menu-item-hover-focus flex w-full cursor-pointer items-center gap-2 rounded-[16px] pl-2.5 pr-1 py-1.5 text-left text-[13px] ${
                  active
                    ? "bg-[#eef3fb] dark:bg-zinc-600"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onPreviewSize?.(preset.size)}
                onClick={() => applyPreset(preset)}
              >
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-650 dark:text-zinc-200">
                  {preset.label}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR}`}
                >
                  {preset.size}
                </span>
                {active ? (
                  <LuCheck
                    className="size-3.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="size-3.5 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-zinc-200/90 pt-2 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={FORMAT_TOOLBAR_TYPOGRAPHY_STEPPER_CLASS}
              aria-label="Decrease font size"
              onPointerDown={handleFontSizeStepPointerDown}
              onClick={() => stepSize(-1)}
            >
              <LuMinus className="size-3.5" aria-hidden="true" />
            </button>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={sliderValue}
              aria-label="Custom font size"
              className="format-toolbar-typography-slider min-w-0 flex-1 accent-emerald-700"
              onPointerDown={handleSliderPointerDown}
              onInput={(event) => {
                const nextValue = Number(event.currentTarget.value);
                setSliderValue(nextValue);
                onPreviewSize?.(detailFontSizeFromSliderValue(nextValue));
              }}
              onChange={(event) => {
                commitSliderValue(Number(event.currentTarget.value));
              }}
            />
            <span
              className={`flex h-7 min-w-[2rem] items-center justify-center rounded-md bg-zinc-100 px-1 tabular-nums text-[12px] font-medium dark:bg-zinc-800 ${FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR}`}
            >
              {sliderValue}
            </span>
            <button
              type="button"
              className={FORMAT_TOOLBAR_TYPOGRAPHY_STEPPER_CLASS}
              aria-label="Increase font size"
              onPointerDown={handleFontSizeStepPointerDown}
              onClick={() => stepSize(1)}
            >
              <LuPlus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </FormatToolbarDropdownShell>

      <button
        type="button"
        className={FORMAT_TOOLBAR_TYPOGRAPHY_STEPPER_CLASS}
        aria-label="Increase font size"
        onPointerDown={handleFontSizeStepPointerDown}
        onClick={() => stepSize(1)}
      >
        <LuPlus className="size-3" aria-hidden="true" />
      </button>
    </div>
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
      menuClassName={FORMAT_TOOLBAR_LIST_BLOCK_MENU_CLASS}
      menuAnchorExtraGapPx={3}
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
            className={`${FORMAT_TOOLBAR_LIST_BLOCK_MENU_ITEM_CLASS} ${
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
  onPreviewFamily?: (familyId: DetailFontFamilyId) => void;
  onPreviewFamilyClear?: () => void;
};

export function DetailFormatFontFamilyDropdown({
  open,
  onOpenChange,
  familyId,
  onSelectFamily,
  onPreviewFamily,
  onPreviewFamilyClear,
}: DetailFormatFontFamilyDropdownProps) {
  const formatToolbarFontOptions = getFormatToolbarFontFamilyOptions();
  const familyLabel = getDetailFontFamilyLabel(familyId);
  const selectedFontFamily = getDetailFontFamilyValue(familyId);

  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Font family"
      tooltipId="format-toolbar-font-family-tooltip"
      tooltipLabel="Font family"
      triggerClassName={FORMAT_TOOLBAR_FONT_FAMILY_TRIGGER_CLASS}
      menuClassName={`${FORMAT_TOOLBAR_FONT_FAMILY_MENU_CLASS} max-h-72 overflow-y-auto`}
      menuStyle={{ minWidth: "128px" }}
      trigger={
        <>
          <span
            className="max-w-[120px] truncate whitespace-nowrap"
            style={
              selectedFontFamily
                ? { fontFamily: selectedFontFamily }
                : undefined
            }
          >
            {familyLabel}
          </span>
          <LuChevronDown className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`} />
        </>
      }
    >
      <div onMouseLeave={() => onPreviewFamilyClear?.()}>
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
          onMouseEnter={() => onPreviewFamily?.(option.id)}
          onClick={() => {
            onSelectFamily(option.id);
            onOpenChange(false);
          }}
        >
          {option.label}
        </button>
      ))}
      </div>
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatFontSizeDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size: DetailFontSizeOption;
  onSelectSize: (size: DetailFontSizeOption) => void;
  onPreviewSize?: (size: DetailFontSizeOption) => void;
  onPreviewSizeClear?: () => void;
};

export function DetailFormatFontSizeDropdown({
  open,
  onOpenChange,
  size,
  onSelectSize,
  onPreviewSize,
  onPreviewSizeClear,
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
      <div
        className="grid grid-cols-4 gap-0.5 px-1 py-1"
        onMouseLeave={() => onPreviewSizeClear?.()}
      >
        {DETAIL_FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitem"
            onMouseEnter={() => onPreviewSize?.(option)}
            className={`menu-item-hover-focus cursor-pointer rounded-md px-1 py-1 text-center ${FORMAT_TOOLBAR_FONT_SIZE_TEXT_CLASS} hover:bg-zinc-100/50 dark:hover:bg-zinc-800 ${
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

type DetailFormatLineHeightDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineHeight: DetailLineHeightOption;
  onSelectLineHeight: (lineHeight: DetailLineHeightOption) => void;
};

export function DetailFormatLineHeightDropdown({
  open,
  onOpenChange,
  lineHeight,
  onSelectLineHeight,
}: DetailFormatLineHeightDropdownProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Line height"
      tooltipId="format-toolbar-line-height-tooltip"
      tooltipLabel="Line height"
      triggerClassName={FORMAT_TOOLBAR_FONT_SIZE_TRIGGER_CLASS}
      menuClassName={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} min-w-[188px] p-0`}
      trigger={
        <>
          <AiOutlineLineHeight
            className={`${FORMAT_TOOLBAR_LINE_HEIGHT_ICON_SIZE_CLASS} ${FORMAT_TOOLBAR_LINE_HEIGHT_ICON_COLOR}`}
            aria-hidden="true"
          />
          <LuChevronDown
            className={`size-3.5 shrink-0 ${FORMAT_TOOLBAR_CHEVRON_COLOR}`}
            aria-hidden="true"
          />
        </>
      }
    >
      <DetailLineHeightControl
        open={open}
        value={lineHeight}
        onSelect={(nextLineHeight) => {
          onSelectLineHeight(nextLineHeight);
          onOpenChange(false);
        }}
        className="max-h-[min(70vh,300px)] border-0 shadow-none"
      />
    </FormatToolbarDropdownShell>
  );
}

type DetailFormatOverflowMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuRef?: RefObject<HTMLDivElement | null>;
  onUnderline: () => void;
  onStrikethrough: () => void;
  onSuperscript: () => void;
  onSubscript: () => void;
};

export function DetailFormatOverflowMenu({
  open,
  onOpenChange,
  menuRef,
  onUnderline,
  onStrikethrough,
  onSuperscript,
  onSubscript,
}: DetailFormatOverflowMenuProps) {
  return (
    <FormatToolbarDropdownShell
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="More formatting options"
      tooltipId="format-toolbar-more-tooltip"
      tooltipLabel="More options"
      align="center"
      triggerClassName={FORMAT_TOOLBAR_OVERFLOW_MENU_TRIGGER_CLASS}
      menuClassName={FORMAT_TOOLBAR_OVERFLOW_MENU_CLASS}
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
      </div>
    </FormatToolbarDropdownShell>
  );
}
