"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BiLink, BiLeftArrowAlt, BiRedo, BiUndo } from "react-icons/bi";
import { LuCheck, LuCode, LuHeading1, LuHeading2, LuHeading3, LuHistory, LuPilcrow, LuRemoveFormatting, LuType, LuX } from "react-icons/lu";
import { renameTask, updateTaskDueDate, updateTaskDueTime, updateTaskRecurrence } from "@/app/actions/todo";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import { serializeRecurrenceRule } from "@/lib/task-recurrence";
import type { TaskReminderOptionId } from "@/lib/task-reminder";
import {
  fetchTaskById,
  invalidateTaskDetailsFetchCache,
  saveTaskDetails,
  saveTaskDetailsKeepalive,
  saveTaskNameKeepalive,
} from "@/lib/task-details-api";
import {
  resolveTaskDetailsForSave,
  taskDetailsHasContent,
} from "@/lib/task-details-content";
import { formatShortDayMonthYear } from "@/lib/date-format";
import {
  formatDueTimeLabel,
  formatDurationLabel,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  getDefaultDetailFontSizePx,
  getDefaultDetailLineHeight,
  useTaskEditorDefaults,
} from "@/lib/task-editor-defaults-settings";
import {
  applyBlockTypeToSelection,
  buildEditorHtmlFromTask,
  ensureBlockLines,
  ensureTitleLine,
  getActiveLineElement,
  DETAIL_LINE_CLASS,
  getActiveTextBlockType,
  getDropIndex,
  getLineElementAtPoint,
  getLineById,
  getLineElements,
  getLineIndex,
  getSelectedListBlockLines,
  getSelectedBlockLinesInRange,
  indentListLines,
  handleClickBelowLastLine,
  insertImagesIntoEditor,
  insertTypedLineBelowLine,
  repairPastedEditorStructure,
  insertHtmlAtSelection,
  insertLineBeforeBodyPlaceholder,
  insertPlainTextAtSelection,
  insertTitleLinePaste,
  captureEditorSelectionRange,
  renumberNumberedLines,
  serializeEditorSelectionForClipboard,
  shouldPreferPlainTextPaste,
  isChecklistLine,
  isChecklistToggleClick,
  isCodeLine,
  isListBlockLine,
  isDetailLineEmpty,
  isBodyPlaceholderLine,
  isEmptyEditableBodyLine,
  isCaretAtStartOfLine,
  getDetailLineFromNode,
  isTitleLine,
  type LineBlockType,
  placeCaretInLine,
  placeCaretAtEndOfLine,
  focusNoteAtEnd,
  focusTaskTitle,
  focusDetailLine,
  selectAllDetailEditorContent,
  removeImageWrapper,
  reorderLine,
  getEditorTitle,
  splitEditorContent,
  splitBlockLinesOnBreaks,
  splitLineAtCursor,
  enterFromTitleLine,
  removeLeadingEmptyBodyLineOnBackspace,
  syncEditorBodyPlaceholderVisibility,
  syncLineEmptyState,
  toggleChecklistLine,
} from "./detail-lines";
import {
  deleteUploadedTaskImage,
  extractTaskImageFilename,
  getImageFilesFromDataTransfer,
  hasImageFilesInDataTransfer,
  uploadEmbeddedImagesInHtml,
  uploadImageFiles,
} from "./detail-images";
import {
  getImageDragTarget,
  startImagePointerInteraction,
} from "./detail-image-drag";
import {
  getImageResizeHandle,
  startImageResize,
} from "./detail-image-resize";
import {
  applyLinkToSelection,
  findDetailLinkFromTarget,
  getLinkEditorState,
  getLinkFromSelection,
  normalizeLinks,
  openDetailLinkInNewTab,
  removeLinkFromSelection,
} from "./detail-links";
import {
  applyDetailLineHeight,
  getDetailSelectionLineHeight,
  isDefaultDetailLineHeight,
  normalizeDetailLineHeight,
  type DetailLineHeightOption,
} from "./detail-line-height";
import {
  applyDetailFontFamily,
  applyDetailFontSize,
  getAppFontFamilyId,
  getDefaultDetailFontSizeOption,
  getDetailFontFamilyValue,
  getDetailSelectionFontState,
  isDefaultAppFont,
  isDefaultDetailFontSize,
  pastedHtmlHasFormatting,
  sanitizePastedHtml,
  stripFormattingInSelection,
  type DetailFontFamilyId,
  type DetailFontSizeOption,
} from "./detail-fonts";
import {
  clampPastePlainText,
  isDetailLinesClipboardHtml,
} from "./detail-paste";
import { DetailFontFamilyControl } from "./detail-font-family-control";
import { DetailFontSizeControl } from "./detail-font-size-control";
import {
  DetailFormatBlockTypeDropdown,
  DetailFormatHighlightColorDropdown,
  DetailFormatTextColorDropdown,
  DetailFormatFontFamilyDropdown,
  DetailFormatFontSizeDropdown,
  DetailFormatListDropdown,
  DetailFormatOverflowMenu,
  FormatToolbarTooltipWrap,
  getFormatToolbarShortcut,
  FORMAT_TOOLBAR_ICON_COLOR,
  FORMAT_TOOLBAR_ICON_SIZE_CLASS,
  type FormatToolbarDropdown,
  type RecentFormatColor,
} from "./detail-format-toolbar-menus";

type HeaderFormatDropdown = "family" | "size";
import {
  TaskDatePicker,
  computeTaskDatePickerMenuPosition,
} from "./task-date-picker";
import { TaskVersionHistoryOffcanvas } from "./task-version-history-offcanvas";
import {
  TaskModalFooter,
  type TaskModalFooterConfig,
} from "./task-modal-footer";
import {
  TaskDetailsSubtasksSection,
  type TaskDetailsSubtask,
} from "./task-details-subtasks-section";
import {
  getSlashCommandPreviewTopOffset,
  isSlashCommandPreviewBlockType,
  SlashCommandBlockPreview,
} from "./slash-command-block-preview";
import {
  BulletListIcon,
  ChecklistIcon,
  getLineControlsPositionForLine,
  InteractIcon,
  NumberedListIcon,
  PlusIcon,
} from "./line-control-icons";

type TaskDetails = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  isNote: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  recurrenceRule: string | null;
};

type TaskDetailsSnapshot = {
  name: string;
  completed: boolean;
  isNote?: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  recurrenceRule?: string | null;
};

const taskDetailsCache = new Map<string, TaskDetails>();

function buildTaskDetailsFromSnapshot(
  taskId: string,
  snapshot: TaskDetailsSnapshot,
): TaskDetails {
  return {
    id: taskId,
    name: snapshot.name,
    completed: snapshot.completed,
    isNote: snapshot.isNote ?? false,
    details: "",
    dueDate: snapshot.dueDate,
    dueTimeMinutes: snapshot.dueTimeMinutes,
    dueDurationMinutes: snapshot.dueDurationMinutes,
    dueTimeZone: snapshot.dueTimeZone,
    recurrenceRule: snapshot.recurrenceRule ?? null,
  };
}

export type TaskDetailsSaveController = {
  flushSave: () => Promise<void>;
};

type TaskDetailsPanelProps = {
  taskId: string | null;
  taskSnapshot?: TaskDetailsSnapshot | null;
  focusNoteAtEndRequest?: number;
  focusTaskTitleRequest?: number;
  suppressDetailsTitleFocusRef?: RefObject<boolean>;
  registerSaveController?: (controller: TaskDetailsSaveController | null) => void;
  onDetailsSaved: (taskId: string, details: string) => void;
  onTaskHasDetailsKnown?: (taskId: string, hasDetails: boolean) => void;
  onTaskRenamed: (taskId: string, name: string) => void;
  onDueDateUpdated: (
    taskId: string,
    dueDate: string | null,
    dueTime?: {
      dueTimeMinutes: number | null;
      dueDurationMinutes: number | null;
      dueTimeZone: string;
    },
  ) => void;
  onToggleTask?: (taskId: string) => void;
  subtasks?: TaskDetailsSubtask[];
  canManageSubtasks?: boolean;
  onAddSubtask?: (
    taskId: string,
  ) => Promise<TaskDetailsSubtask | null> | TaskDetailsSubtask | null;
  onRenameSubtask?: (subtaskId: string, name: string) => void | Promise<void>;
  onDeleteSubtask?: (subtaskId: string) => void | Promise<void>;
  onEditSubtask?: (subtaskId: string) => void | Promise<void>;
  onRecurrenceUpdated?: (taskId: string, recurrenceRule: string | null) => void;
  onSaveTaskRecurrence?: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => Promise<void>;
  onBack?: () => void;
  layout?: "default" | "modal";
  modalFooterConfig?: TaskModalFooterConfig | null;
  hideModalFormatToggle?: boolean;
  onClose?: () => void;
};

type SaveStatus = "idle" | "loading" | "pending" | "saved" | "error";

type FormatMenuState = {
  x: number;
  y: number;
  alignLeft?: boolean;
  placement?: "above" | "below";
  anchorBottom?: number;
  preferBelow?: boolean;
};

type SlashCommandMenuState = {
  top: number;
  left: number;
  lineId: string;
  query: string;
  selectedIndex: number;
  fromContextMenu?: boolean;
};

type LineControlItem = {
  lineId: string;
  top: number;
  showPlus: boolean;
  showDrag: boolean;
};

type DropIndicatorState = {
  top: number;
};

type AddBlockMenuState = {
  top: number;
  left: number;
};

const FORMAT_TOOLBAR_SURFACE_CLASS =
  "format-toolbar-popover-surface overflow-visible rounded-[19px] border border-zinc-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_8px_24px_rgba(0,0,0,0.32)]";

function getFormatToolbarPopoverClass(formatMenu: FormatMenuState) {
  const placement = formatMenu.placement === "below" ? "below" : "above";
  const align = formatMenu.alignLeft ? "align-left" : "align-center";

  return `format-toolbar-popover format-toolbar-popover--${placement} format-toolbar-popover--${align}`;
}

const TASK_DETAILS_BLOCK_MENU_CLASS =
  "task-details-block-menu min-w-[168px] py-0!";

const TASK_DETAILS_BLOCK_MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

const FORMAT_TOOLBAR_ROW_CLASS = "flex items-center gap-0.5 px-1.5 py-1";

const FORMAT_TOOLBAR_TEXT_BUTTON_CLASS =
  `flex h-8 min-w-8 items-center justify-center rounded-[9px] px-2 cursor-pointer text-[16px] ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`;

const FORMAT_TOOLBAR_ICON_BUTTON_CLASS =
  `flex h-8 w-8 items-center justify-center rounded-lg ${FORMAT_TOOLBAR_ICON_COLOR} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer`;

const TASK_DETAILS_DATE_MENU_HOVER_CLOSE_MS = 120;

const FORMAT_TOOLBAR_ACTIVE_BUTTON_CLASS =
  "bg-[#c3eaff] text-[#2563eb] dark:text-blue-300";

type FormatMenuInlineFormats = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: boolean;
  highlightColor: string;
  textColor: string;
};

const DEFAULT_FORMAT_MENU_INLINE_FORMATS: FormatMenuInlineFormats = {
  bold: false,
  italic: false,
  underline: false,
  highlight: false,
  highlightColor: "#fef08a",
  // textColor: "#414141",
  textColor: "#2e2e2e",
};

const RECENT_FORMAT_COLORS_STORAGE_KEY = "todolist:recent-format-colors";
const MAX_RECENT_FORMAT_COLORS = 5;

const TASK_DETAILS_TOOLTIP_CLASS =
  "add-task-date-tooltip add-task-date-tooltip-below pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity";

const FORMAT_TOOLBAR_DIVIDER_CLASS =
  "mx-0.5 h-5 w-px shrink-0 self-center bg-zinc-200 dark:bg-zinc-700";

type TextBlockType = "text" | "h1" | "h2" | "h3";

const TEXT_BLOCK_OPTIONS: {
  type: TextBlockType;
  label: string;
  Icon: typeof LuPilcrow;
}[] = [
  { type: "text", label: "Text", Icon: LuPilcrow },
  { type: "h1", label: "Heading 1", Icon: LuHeading1 },
  { type: "h2", label: "Heading 2", Icon: LuHeading2 },
  { type: "h3", label: "Heading 3", Icon: LuHeading3 },
];

const ADD_BLOCK_OPTIONS: {
  type: LineBlockType;
  label: string;
  Icon: typeof LuPilcrow;
}[] = [
  ...TEXT_BLOCK_OPTIONS,
  { type: "bullet", label: "Bullet list", Icon: BulletListIcon },
  { type: "numbered", label: "Numbered list", Icon: NumberedListIcon },
  { type: "checklist", label: "Checklist", Icon: ChecklistIcon },
  { type: "code", label: "Code", Icon: LuCode },
];

const SLASH_LINK_OPTION = {
  kind: "link" as const,
  id: "link" as const,
  label: "Link",
  Icon: BiLink,
};

type SlashCommandOption =
  | {
      kind: "block";
      type: LineBlockType;
      label: string;
      Icon: typeof LuPilcrow;
    }
  | typeof SLASH_LINK_OPTION;

function slashLinkMatchesQuery(query: string) {
  if (!query) return true;

  return (
    "link".includes(query) ||
    SLASH_LINK_OPTION.label.toLowerCase().includes(query)
  );
}

function getSlashCommandOptions(query: string): SlashCommandOption[] {
  const blockOptions: SlashCommandOption[] = (
    query ? filterSlashCommandOptions(query) : ADD_BLOCK_OPTIONS
  ).map((option) => ({ kind: "block", ...option }));

  if (slashLinkMatchesQuery(query)) {
    return [...blockOptions, SLASH_LINK_OPTION];
  }

  return blockOptions;
}

function getLinePlainText(line: HTMLElement) {
  return (line.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

function parseSlashCommand(text: string) {
  const match = text.match(/^\/([^\s/]*)$/);
  if (!match) return null;

  return { query: match[1].toLowerCase() };
}

function filterSlashCommandOptions(query: string) {
  if (!query) return ADD_BLOCK_OPTIONS;

  return ADD_BLOCK_OPTIONS.filter(
    (option) =>
      option.label.toLowerCase().includes(query) ||
      option.type.toLowerCase().includes(query),
  );
}

function getSlashCommandMenuPosition(line: HTMLElement) {
  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.height > 0 || rect.width > 0) {
      return { top: rect.bottom + 4, left: rect.left };
    }
  }

  const lineRect = line.getBoundingClientRect();
  return { top: lineRect.top + 4, left: lineRect.left + 4 };
}

function placeCaretAtPoint(editor: HTMLElement, x: number, y: number) {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };

  let range: Range | null = null;
  if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(x, y);
  } else if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }

  if (!range || !editor.contains(range.startContainer)) return;

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function lineHasSlashCommand(line: HTMLElement) {
  return parseSlashCommand(getLinePlainText(line)) !== null;
}

function clearSlashCommandText(line: HTMLElement) {
  line.textContent = "";
  line.innerHTML = "<br>";
}

const AUTO_SAVE_DEBOUNCE_MS = 2000;
const LARGE_CONTENT_AUTO_SAVE_DEBOUNCE_MS = 4000;
const MIN_SAVE_INTERVAL_MS = 1500;
const CLIPBOARD_SAVE_NOTICE_MS = 4000;
const HISTORY_DEBOUNCE_MS = 400;
const LARGE_CONTENT_HISTORY_DEBOUNCE_MS = 1200;
const HISTORY_LIMIT = 50;
const LARGE_CONTENT_HISTORY_LIMIT = 8;
const LARGE_CONTENT_THRESHOLD = 200_000;
const LINE_CONTROLS_DEBOUNCE_MS = 16;
const FORMAT_MENU_DEBOUNCE_MS = 80;
const SMALL_CONTENT_INPUT_DEBOUNCE_MS = 80;
const INPUT_NORMALIZE_DEBOUNCE_MS = 400;
const TITLE_SYNC_DEBOUNCE_MS = 300;
const MAX_DETAILS_SAVE_BYTES = 9 * 1024 * 1024;

const HIGHLIGHT_COLOR = "#fef08a";
const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLOR;

const HIGHLIGHT_COLOR_OPTIONS = [
  { label: "None", value: "#ffffff" },
  { label: "Gray", value: "#f3f4f6" },
  { label: "Beige", value: "#f5f0e6" },
  { label: "Peach", value: "#ffedd5" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Mint", value: "#d1fae5" },
  { label: "Blue", value: "#bae6fd" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Red", value: "#fecaca" },
] as const;

const DEFAULT_TEXT_COLOR = "#2e2e2e";

const TEXT_COLOR_OPTIONS = [
  { label: "Charcoal", value: "#2e2e2e" },
  { label: "Dark gray", value: "#545454" },
  { label: "Gray", value: "#878787" },
  { label: "Light gray", value: "#b4b4b4" },
  { label: "Purple", value: "#7838d2" },
  { label: "Magenta", value: "#c438c4" },
  { label: "Red", value: "#e03131" },
  { label: "Orange", value: "#e8590c" },
  { label: "Gold", value: "#d4a012" },
  { label: "Green", value: "#17a148" },
  { label: "Blue", value: "#228be6" },
  { label: "Navy", value: "#1c44b3" },
] as const;

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

function readRecentFormatColors(): RecentFormatColor[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_FORMAT_COLORS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is RecentFormatColor =>
          typeof entry === "object" &&
          entry !== null &&
          (entry as RecentFormatColor).kind !== undefined &&
          typeof (entry as RecentFormatColor).color === "string" &&
          typeof (entry as RecentFormatColor).label === "string",
      )
      .slice(0, MAX_RECENT_FORMAT_COLORS);
  } catch {
    return [];
  }
}

function rememberRecentFormatColor(
  current: RecentFormatColor[],
  entry: RecentFormatColor,
) {
  const next = [
    entry,
    ...current.filter(
      (item) =>
        !(
          item.kind === entry.kind &&
          colorsEquivalent(item.color, entry.color)
        ),
    ),
  ].slice(0, MAX_RECENT_FORMAT_COLORS);

  try {
    window.localStorage.setItem(
      RECENT_FORMAT_COLORS_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    return current;
  }

  return next;
}

function formatDueDateLabel(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return formatShortDayMonthYear(date);
}

function formatSaveTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeDetails(html: string) {
  const trimmed = html.trim();
  if (
    !trimmed ||
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p><br></p>"
  ) {
    return "";
  }
  return html;
}

function resolveTaskDetailsForLoad(pending: string | undefined, loaded: string) {
  const normalizedLoaded = normalizeDetails(loaded);
  if (pending === undefined) {
    return normalizedLoaded;
  }

  const normalizedPending = normalizeDetails(pending);
  if (taskDetailsHasContent(normalizedPending)) {
    return normalizedPending;
  }

  if (taskDetailsHasContent(normalizedLoaded)) {
    return normalizedLoaded;
  }

  return normalizedPending;
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

const HIGHLIGHT_COLOR_VALUES = new Set(
  HIGHLIGHT_COLOR_OPTIONS.map((option) => normalizeColorValue(option.value)),
);

function isHighlightColor(color: string) {
  if (!color) return false;

  const normalized = normalizeColorValue(color);
  if (HIGHLIGHT_COLOR_VALUES.has(normalized)) {
    return normalized !== "#ffffff";
  }

  const rgbHex = rgbStringToHex(color);
  if (rgbHex && HIGHLIGHT_COLOR_VALUES.has(rgbHex) && rgbHex !== "#ffffff") {
    return true;
  }

  return (
    normalized === "yellow" ||
    normalized === "rgb(254,240,138)" ||
    normalized === "rgba(254,240,138,1)" ||
    isHighlightYellow(color)
  );
}

function isHighlightYellow(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);

  return r >= 240 && g >= 220 && b <= 180;
}

function nodeHasHighlight(node: Node | null, editor: HTMLElement) {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      if (current.tagName === "MARK") return true;

      const inlineBg = current.style.backgroundColor;
      const computedBg = window.getComputedStyle(current).backgroundColor;

      if (isHighlightColor(inlineBg) || isHighlightColor(computedBg)) {
        return true;
      }
    }

    current = current.parentNode;
  }

  return false;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeColorValue(hex).replace("#", "");

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

function colorToRgb(color: string): [number, number, number] | null {
  if (normalizeColorValue(color).startsWith("#")) {
    return hexToRgb(color);
  }

  const fromRgb = rgbStringToHex(color);
  return fromRgb ? hexToRgb(fromRgb) : null;
}

function resolveHighlightColorOption(color: string) {
  if (!color) return DEFAULT_HIGHLIGHT_COLOR;

  const normalized = normalizeColorValue(color);
  const rgbHex = rgbStringToHex(color)?.toLowerCase();

  for (const option of HIGHLIGHT_COLOR_OPTIONS) {
    if (option.value === "#ffffff") continue;

    const optionNormalized = normalizeColorValue(option.value);
    if (normalized === optionNormalized) return option.value;
    if (rgbHex && rgbHex === optionNormalized) return option.value;
  }

  const inputRgb = colorToRgb(color);
  if (!inputRgb) return DEFAULT_HIGHLIGHT_COLOR;

  let bestMatch = DEFAULT_HIGHLIGHT_COLOR;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const option of HIGHLIGHT_COLOR_OPTIONS) {
    if (option.value === "#ffffff") continue;

    const optionRgb = colorToRgb(option.value);
    if (!optionRgb) continue;

    const distance = Math.hypot(
      inputRgb[0] - optionRgb[0],
      inputRgb[1] - optionRgb[1],
      inputRgb[2] - optionRgb[2],
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = option.value;
    }
  }

  return bestMatch;
}

function getExplicitBackgroundColor(element: HTMLElement) {
  const inlineBg = element.style.backgroundColor.trim();
  if (inlineBg) return inlineBg;

  const styleAttr = element.getAttribute("style");
  const match = styleAttr?.match(/background-color:\s*([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

function getHighlightColorFromElement(element: HTMLElement) {
  const explicitBg = getExplicitBackgroundColor(element);
  if (explicitBg && isHighlightColor(explicitBg)) {
    return resolveHighlightColorOption(explicitBg);
  }

  if (element.tagName === "MARK" && !explicitBg) {
    return null;
  }

  const computedBg = window.getComputedStyle(element).backgroundColor;
  if (
    computedBg &&
    computedBg !== "rgba(0, 0, 0, 0)" &&
    computedBg !== "transparent" &&
    isHighlightColor(computedBg)
  ) {
    return resolveHighlightColorOption(computedBg);
  }

  return null;
}

function getHighlightColorFromNode(
  node: Node | null,
  editor: HTMLElement,
): string | null {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      const color = getHighlightColorFromElement(current);
      if (color) return color;
    }

    current = current.parentNode;
  }

  return null;
}

function getSelectionHighlightColor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.isCollapsed ||
    !editor.contains(selection.anchorNode)
  ) {
    return DEFAULT_HIGHLIGHT_COLOR;
  }

  const colors: string[] = [];

  const addColor = (color: string | null) => {
    if (color) colors.push(color);
  };

  addColor(getHighlightColorFromNode(selection.anchorNode, editor));
  addColor(getHighlightColorFromNode(selection.focusNode, editor));

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const candidates = editor.querySelectorAll("mark, span, font");

    for (const element of candidates) {
      if (!(element instanceof HTMLElement)) continue;
      if (!range.intersectsNode(element)) continue;
      addColor(getHighlightColorFromElement(element));
    }
  }

  return colors[0] ?? DEFAULT_HIGHLIGHT_COLOR;
}

function getFormatSelectionPreviewText(range: Range | null) {
  if (!range || range.collapsed) return "";

  const normalized = range
    .toString()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return "";

  const maxLines = 6;
  const lines = normalized.split("\n");
  let preview = lines.slice(0, maxLines).join("\n");
  if (lines.length > maxLines) {
    preview += "\n…";
  }

  if (preview.length > 200) {
    preview = `${preview.slice(0, 200)}…`;
  }

  return preview;
}

function getTextColorPreviewTypography(
  fontFamilyId: DetailFontFamilyId,
  fontSize: DetailFontSizeOption,
  lineHeight: DetailLineHeightOption,
) {
  return {
    fontFamily:
      getDetailFontFamilyValue(fontFamilyId) ??
      getDetailFontFamilyValue(getAppFontFamilyId()),
    fontSize,
    lineHeight,
  };
}

function resolveTextColorOption(color: string) {
  if (!color) return DEFAULT_TEXT_COLOR;

  for (const option of TEXT_COLOR_OPTIONS) {
    if (colorsEquivalent(option.value, color)) return option.value;
  }

  const inputRgb = colorToRgb(color);
  if (!inputRgb) return DEFAULT_TEXT_COLOR;

  let bestMatch = DEFAULT_TEXT_COLOR;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const option of TEXT_COLOR_OPTIONS) {
    const optionRgb = colorToRgb(option.value);
    if (!optionRgb) continue;

    const distance = Math.hypot(
      inputRgb[0] - optionRgb[0],
      inputRgb[1] - optionRgb[1],
      inputRgb[2] - optionRgb[2],
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = option.value;
    }
  }

  return bestMatch;
}

function getTextColorFromNode(
  node: Node | null,
  editor: HTMLElement,
): string | null {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      const inlineColor = current.style.color.trim();
      if (inlineColor) {
        return resolveTextColorOption(inlineColor);
      }

      const computedColor = window.getComputedStyle(current).color;
      if (
        computedColor &&
        computedColor !== "rgba(0, 0, 0, 0)" &&
        !colorsEquivalent(computedColor, "#555555") &&
        !colorsEquivalent(computedColor, DEFAULT_TEXT_COLOR)
      ) {
        return resolveTextColorOption(computedColor);
      }
    }

    current = current.parentNode;
  }

  return null;
}

function getSelectionTextColor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.isCollapsed ||
    !editor.contains(selection.anchorNode)
  ) {
    return DEFAULT_TEXT_COLOR;
  }

  document.execCommand("styleWithCSS", false, "true");
  const commandValue = document.queryCommandValue("foreColor");
  if (commandValue) {
    return resolveTextColorOption(String(commandValue));
  }

  const colors: string[] = [];
  const addColor = (color: string | null) => {
    if (color) colors.push(color);
  };

  addColor(getTextColorFromNode(selection.anchorNode, editor));
  addColor(getTextColorFromNode(selection.focusNode, editor));

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const candidates = editor.querySelectorAll("span, font, mark, a");

    for (const element of candidates) {
      if (!(element instanceof HTMLElement)) continue;
      if (!range.intersectsNode(element)) continue;
      addColor(getTextColorFromNode(element, editor));
    }
  }

  return colors[0] ?? DEFAULT_TEXT_COLOR;
}

function selectionHasHighlight(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return false;

  return (
    nodeHasHighlight(anchorNode, editor) ||
    nodeHasHighlight(focusNode, editor)
  );
}

function getDetailSelectionInlineFormatState(
  editor: HTMLElement,
): FormatMenuInlineFormats {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.isCollapsed ||
    !editor.contains(selection.anchorNode)
  ) {
    return DEFAULT_FORMAT_MENU_INLINE_FORMATS;
  }

  const hasHighlight = selectionHasHighlight(editor);

  return {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
    highlight: hasHighlight,
    highlightColor: hasHighlight
      ? getSelectionHighlightColor(editor)
      : DEFAULT_HIGHLIGHT_COLOR,
    textColor: getSelectionTextColor(editor),
  };
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function removeHighlightFromSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("removeFormat", false, "hiliteColor");
  document.execCommand("removeFormat", false, "backColor");

  const range = selection.getRangeAt(0);
  const elements = Array.from(editor.querySelectorAll("mark, span[style]"));

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    if (!range.intersectsNode(element)) continue;

    const inlineBg = element.style.backgroundColor;
    const computedBg = window.getComputedStyle(element).backgroundColor;

    if (
      element.tagName === "MARK" ||
      isHighlightColor(inlineBg) ||
      isHighlightColor(computedBg)
    ) {
      unwrapElement(element);
    }
  }
}

function applyHighlight(editor: HTMLElement, color: string = HIGHLIGHT_COLOR) {
  document.execCommand("styleWithCSS", false, "true");
  const applied = document.execCommand("hiliteColor", false, color);
  if (!applied) {
    document.execCommand("backColor", false, color);
  }
}

function restoreEditorSelectionRange(range: Range) {
  const selection = window.getSelection();
  if (!selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

function getCaretRangeFromPoint(clientX: number, clientY: number): Range | null {
  try {
    if (typeof document.caretRangeFromPoint === "function") {
      return document.caretRangeFromPoint(clientX, clientY);
    }

    const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);
    if (!caretPosition) return null;

    const range = document.createRange();
    const { offsetNode, offset } = caretPosition;

    if (offsetNode.nodeType === Node.TEXT_NODE) {
      const maxOffset = (offsetNode.textContent ?? "").length;
      range.setStart(offsetNode, Math.min(Math.max(offset, 0), maxOffset));
    } else if (offsetNode.nodeType === Node.ELEMENT_NODE) {
      const maxOffset = offsetNode.childNodes.length;
      range.setStart(offsetNode, Math.min(Math.max(offset, 0), maxOffset));
    } else {
      return null;
    }

    range.collapse(true);
    return range;
  } catch {
    return null;
  }
}

function editorHasLiveExtendedTextSelection(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  return Boolean(
    selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode) &&
      !selection.isCollapsed &&
      selection.toString().trim(),
  );
}

function rangeIsWithinTitleLine(editor: HTMLElement, range: Range) {
  if (range.collapsed || !range.toString().trim()) return false;

  const startLine = getDetailLineFromNode(range.startContainer, editor);
  const endLine = getDetailLineFromNode(range.endContainer, editor);

  if (!startLine || !endLine) return false;

  return (
    isTitleLine(editor, startLine) && isTitleLine(editor, endLine)
  );
}

function editorSelectionIsWithinTitleLine(editor: HTMLElement) {
  const selection = window.getSelection();
  if (
    !selection?.rangeCount ||
    !selection.anchorNode ||
    !editor.contains(selection.anchorNode)
  ) {
    return false;
  }

  return rangeIsWithinTitleLine(editor, selection.getRangeAt(0));
}

function isMultiClickMouseEvent(event: Pick<MouseEvent, "detail">) {
  return event.detail >= 2;
}

function shouldPlaceCaretAtLineStart(
  editor: HTMLElement,
  line: HTMLElement,
) {
  return isEmptyEditableBodyLine(editor, line);
}

function scheduleCaretAtLineStart(editor: HTMLElement, line: HTMLElement) {
  const place = () => {
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !editor.contains(line)) return;
    if (!shouldPlaceCaretAtLineStart(editor, line)) return;
    if (isCaretAtStartOfLine(line)) return;

    focusDetailLine(editor, line);
  };

  place();
  requestAnimationFrame(place);
  window.setTimeout(place, 0);
}

function collapseEditorSelectionAtPoint(
  editor: HTMLElement,
  clientX: number,
  clientY: number,
) {
  const selection = window.getSelection();
  if (!selection) return;

  const probe = getCaretRangeFromPoint(clientX, clientY);
  if (probe && editor.contains(probe.startContainer)) {
    const probeLine = getDetailLineFromNode(probe.startContainer, editor);
    if (probeLine && shouldPlaceCaretAtLineStart(editor, probeLine)) {
      placeCaretInLine(probeLine);
    return;
  }

    try {
      selection.removeAllRanges();
      selection.addRange(probe);
      return;
    } catch {
      // Fall back to line-based caret placement below.
    }
  }

  const line = getLineElementAtPoint(editor, clientY);
  if (line && editor.contains(line)) {
    if (shouldPlaceCaretAtLineStart(editor, line)) {
      placeCaretInLine(line);
      return;
    }

    const lineRect = line.getBoundingClientRect();
    const midpoint = lineRect.left + lineRect.width / 2;
    if (clientX >= midpoint) {
      placeCaretAtEndOfLine(line);
    } else {
      placeCaretInLine(line);
    }
    return;
  }

  selection.removeAllRanges();
}

function resolveFormatMenuRange(
  editor: HTMLElement,
  savedRange: Range | null,
): Range | null {
  const selection = window.getSelection();
  const selectionInEditor = Boolean(
    selection?.rangeCount &&
      ((selection.anchorNode && editor.contains(selection.anchorNode)) ||
        (selection.focusNode && editor.contains(selection.focusNode))),
  );

  if (selectionInEditor && selection) {
    const current = selection.getRangeAt(0);
    if (!current.collapsed && current.toString().trim()) {
      return current.cloneRange();
    }
  }

  if (
    savedRange &&
    !savedRange.collapsed &&
    savedRange.toString().trim() &&
    editor.contains(savedRange.commonAncestorContainer)
  ) {
    return savedRange.cloneRange();
  }

  return null;
}

function rangeHasFormatableEditorContent(
  editor: HTMLElement,
  range: Range,
) {
  if (range.collapsed || !range.toString().trim()) {
    return false;
  }

  if (rangeIsWithinTitleLine(editor, range)) {
    return false;
  }

  let matchedLines: HTMLElement[] = [];

  for (const line of getLineElements(editor)) {
    try {
      if (range.intersectsNode(line)) {
        matchedLines.push(line);
      }
    } catch {
      // Ignore lines the range cannot test against.
    }
  }

  if (matchedLines.length === 0) {
    matchedLines = getSelectedBlockLinesInRange(editor, range);
  }

  return matchedLines.some(
    (line) =>
      !isCodeLine(line) &&
      !isTitleLine(editor, line) &&
      !line.querySelector(".detail-image-wrapper"),
  );
}

const FORMATTED_INLINE_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "MARK",
  "SUB",
  "SUP",
  "FONT",
  "A",
]);

function lineHasCustomLineHeight(line: HTMLElement) {
  const inline = line.style.lineHeight.trim();
  const cssVar = line.style.getPropertyValue("--detail-line-height").trim();

  if (inline) {
    const parsed = Number.parseFloat(inline);
    if (Number.isFinite(parsed) && !isDefaultDetailLineHeight(parsed)) {
      return true;
    }
  }

  if (cssVar) {
    const parsed = Number.parseFloat(cssVar);
    if (Number.isFinite(parsed) && !isDefaultDetailLineHeight(parsed)) {
      return true;
    }
  }

  return false;
}

function elementHasAppliedTextColor(element: HTMLElement) {
  const inlineColor = element.style.color.trim();
  if (!inlineColor) return false;

  return (
    !colorsEquivalent(inlineColor, DEFAULT_TEXT_COLOR) &&
    !colorsEquivalent(inlineColor, "#555555") &&
    !colorsEquivalent(inlineColor, "#71717a")
  );
}

function elementHasClearableFormatting(element: HTMLElement) {
  if (FORMATTED_INLINE_TAGS.has(element.tagName)) {
    return true;
  }

  if (element.tagName === "FONT") {
    if (
      element.hasAttribute("face") ||
      element.hasAttribute("size") ||
      element.hasAttribute("color")
    ) {
      return true;
    }
  }

  if (elementHasAppliedTextColor(element)) return true;

  const explicitBg = getExplicitBackgroundColor(element);
  if (explicitBg && isHighlightColor(explicitBg)) return true;

  if (element.tagName === "MARK") return true;

  if (
    element.style.fontSize &&
    !isDefaultDetailFontSize(element.style.fontSize)
  ) {
    return true;
  }

  if (
    element.style.fontFamily &&
    !isDefaultAppFont(element.style.fontFamily)
  ) {
    return true;
  }

  const fontWeight = element.style.fontWeight.trim();
  if (fontWeight && fontWeight !== "normal" && fontWeight !== "400") {
    return true;
  }

  const fontStyle = element.style.fontStyle.trim();
  if (fontStyle && fontStyle !== "normal") {
    return true;
  }

  const textDecoration = element.style.textDecorationLine.trim();
  if (textDecoration && textDecoration !== "none") {
    return true;
  }

  return false;
}

function selectionBoundaryHasClearableFormatting(
  node: Node,
  editor: HTMLElement,
): boolean {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (current instanceof HTMLElement && elementHasClearableFormatting(current)) {
      return true;
    }
    current = current.parentNode;
  }

  return false;
}

function selectionHasActiveToolbarFormatting(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  if (
    !selection?.rangeCount ||
    selection.isCollapsed ||
    !selection.anchorNode ||
    !editor.contains(selection.anchorNode)
  ) {
    return false;
  }

  const inline = getDetailSelectionInlineFormatState(editor);
  if (inline.bold || inline.italic || inline.underline || inline.highlight) {
    return true;
  }

  const textColor = getSelectionTextColor(editor);
  if (
    !colorsEquivalent(textColor, DEFAULT_TEXT_COLOR) &&
    !colorsEquivalent(textColor, "#555555") &&
    !colorsEquivalent(textColor, "#71717a")
  ) {
    return true;
  }

  const fontState = getDetailSelectionFontState(editor);
  if (fontState.size !== getDefaultDetailFontSizePx()) {
    return true;
  }

  if (
    fontState.familyId &&
    fontState.familyId !== "sans-serif" &&
    fontState.familyId !== "mixed"
  ) {
    return true;
  }

  if (!isDefaultDetailLineHeight(getDetailSelectionLineHeight(editor))) {
    return true;
  }

  return getActiveTextBlockType(editor) !== "text";
}

function rangeHasClearableFormatting(range: Range, editor: HTMLElement) {
  const lines = getSelectedBlockLinesInRange(editor, range).filter(
    (line) =>
      !isCodeLine(line) &&
      !isTitleLine(editor, line) &&
      !line.querySelector(".detail-image-wrapper"),
  );

  for (const line of lines) {
    if (lineHasCustomLineHeight(line)) return true;

    const lineType = line.dataset.lineType ?? "text";
    if (lineType !== "text") {
      return true;
    }
  }

  if (selectionBoundaryHasClearableFormatting(range.startContainer, editor)) {
    return true;
  }

  if (
    range.endContainer !== range.startContainer &&
    selectionBoundaryHasClearableFormatting(range.endContainer, editor)
  ) {
    return true;
  }

  for (const line of lines) {
    const walker = document.createTreeWalker(
      line,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_REJECT;
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          if (node.closest(".detail-image-wrapper")) return NodeFilter.FILTER_REJECT;

          return elementHasClearableFormatting(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      },
    );

    if (walker.nextNode() !== null) {
      return true;
    }
  }

  return false;
}

function selectionHasNonDefaultFormatting(
  editor: HTMLElement,
  savedRange?: Range | null,
) {
  const range = resolveFormatMenuRange(editor, savedRange ?? null);
  if (!range || !rangeHasFormatableEditorContent(editor, range)) {
    return false;
  }

  return (
    rangeHasClearableFormatting(range, editor) ||
    selectionHasActiveToolbarFormatting(editor)
  );
}

function captureLiveEditorFormatSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  if (
    !selection?.rangeCount ||
    selection.isCollapsed ||
    !selection.toString().trim()
  ) {
    return null;
  }

  if (
    !(selection.anchorNode && editor.contains(selection.anchorNode)) &&
    !(selection.focusNode && editor.contains(selection.focusNode))
  ) {
    return null;
  }

  return selection.getRangeAt(0).cloneRange();
}

const FORMAT_MENU_ABOVE_SELECTION_GAP = 10;
const FORMAT_MENU_BELOW_SELECTION_GAP = 3;
const FORMAT_MENU_LARGE_SELECTION_LINE_THRESHOLD = 7;
const FORMAT_MENU_BELOW_FIRST_SELECTED_LINE_GAP = 27;
const FORMAT_MENU_BELOW_TRANSFORM_OFFSET_PX = 8;
const FORMAT_MENU_ESTIMATED_HEIGHT = 44;

function shouldPlaceFormatMenuBelowTitle(
  editor: HTMLElement,
  range: Range,
  selectedLines: HTMLElement[],
  selectionTop: number,
) {
  const titleLine = getLineElements(editor)[0];
  if (!titleLine || !isTitleLine(editor, titleLine)) return false;

  if (selectedLines.some((line) => isTitleLine(editor, line))) {
    return true;
  }

  const titleBottom = titleLine.getBoundingClientRect().bottom;
  const toolbarBottomWhenAbove =
    selectionTop -
    FORMAT_MENU_ABOVE_SELECTION_GAP -
    FORMAT_MENU_ESTIMATED_HEIGHT;

  return toolbarBottomWhenAbove < titleBottom;
}

function getFormatableSelectedLines(editor: HTMLElement, range: Range) {
  return getLineElements(editor).filter(
    (line) =>
      range.intersectsNode(line) &&
      !isTitleLine(editor, line) &&
      !isCodeLine(line) &&
      !line.querySelector(".detail-image-wrapper"),
  );
}

function getFormatMenuPositionFromRange(range: Range, editor: HTMLElement) {
  const selectedLines = getLineElements(editor).filter((line) =>
    range.intersectsNode(line),
  );
  const formatableSelectedLines = getFormatableSelectedLines(editor, range);

  if (
    formatableSelectedLines.length >
    FORMAT_MENU_LARGE_SELECTION_LINE_THRESHOLD
  ) {
    const firstLine = formatableSelectedLines[0];
    const firstRect = firstLine.getBoundingClientRect();
    const alignLeft = formatableSelectedLines.length > 2;

    return {
      x: alignLeft ? firstRect.left : firstRect.left + firstRect.width / 2,
      y:
        firstRect.bottom +
        FORMAT_MENU_BELOW_FIRST_SELECTED_LINE_GAP -
        FORMAT_MENU_BELOW_TRANSFORM_OFFSET_PX,
      alignLeft,
      placement: "below" as const,
      anchorBottom: firstRect.bottom,
      preferBelow: true,
    };
  }

  const alignLeft = selectedLines.length > 2;
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );

  const top =
    rects.length > 0
      ? Math.min(...rects.map((rect) => rect.top))
      : range.getBoundingClientRect().top;

  let left: number;
  let right: number;

  if (alignLeft && selectedLines.length > 0) {
    left = Math.min(
      ...selectedLines.map((line) => line.getBoundingClientRect().left),
    );
    right = Math.max(
      ...selectedLines.map((line) => line.getBoundingClientRect().right),
    );
  } else if (rects.length > 0) {
    left = Math.min(...rects.map((rect) => rect.left));
    right = Math.max(...rects.map((rect) => rect.right));
  } else {
    const fallback = range.getBoundingClientRect();
    left = fallback.left;
    right = fallback.right;
  }

  const anchorBottom =
    rects.length > 0
      ? Math.max(...rects.map((rect) => rect.bottom))
      : range.getBoundingClientRect().bottom;
  const shouldPlaceBelow = shouldPlaceFormatMenuBelowTitle(
    editor,
    range,
    selectedLines,
    top,
  );

  if (shouldPlaceBelow) {
    return {
      x: alignLeft ? left : left + (right - left) / 2,
      y: anchorBottom + FORMAT_MENU_BELOW_SELECTION_GAP,
      alignLeft,
      placement: "below" as const,
      anchorBottom,
      preferBelow: true,
    };
  }

  return {
    x: alignLeft ? left : left + (right - left) / 2,
    y: top - FORMAT_MENU_ABOVE_SELECTION_GAP,
    alignLeft,
    placement: "above" as const,
    anchorBottom,
  };
}

const FORMAT_MENU_VIEWPORT_PADDING = 8;

/** Matches `pl-[30px]` on `.task-details-editor` — line controls live in this gutter. */
const TASK_DETAILS_LINE_CONTROLS_GUTTER_PX = 30;

const TASK_DETAILS_EDITOR_MIN_HEIGHT_PX = 500;
const TASK_DETAILS_EDITOR_BOTTOM_INSET_PX = 30;

function getEditorReservedBelowSpacePx(
  editor: HTMLElement,
  panel: HTMLElement | null,
  isModalLayout: boolean,
) {
  let reserved = TASK_DETAILS_EDITOR_BOTTOM_INSET_PX;

  const contentRoot = editor.closest("[data-task-details-content]");
  if (contentRoot instanceof HTMLElement) {
    const styles = window.getComputedStyle(contentRoot);
    reserved += parseFloat(styles.paddingBottom) || 0;

    const subtasks = contentRoot.querySelector("[data-task-details-subtasks]");
    if (subtasks instanceof HTMLElement) {
      reserved += subtasks.getBoundingClientRect().height;
    }
  }

  if (isModalLayout && panel) {
    const footer = panel.querySelector("footer");
    if (footer instanceof HTMLElement) {
      reserved += footer.getBoundingClientRect().height;
    }
  }

  return reserved;
}

function isPointerInLineControlsGutter(clientX: number, editor: HTMLElement) {
  const rect = editor.getBoundingClientRect();
  return clientX - rect.left <= TASK_DETAILS_LINE_CONTROLS_GUTTER_PX;
}

function clampFormatMenuPosition(
  position: FormatMenuState,
  menuWidth: number,
  menuHeight: number,
): FormatMenuState {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const { alignLeft, anchorBottom } = position;
  let { x, y } = position;
  let placement = position.placement ?? "above";

  if (alignLeft) {
    x = Math.max(
      FORMAT_MENU_VIEWPORT_PADDING,
      Math.min(x, viewportWidth - menuWidth - FORMAT_MENU_VIEWPORT_PADDING),
    );
  } else {
    const half = menuWidth / 2;
    x = Math.max(
      FORMAT_MENU_VIEWPORT_PADDING + half,
      Math.min(x, viewportWidth - FORMAT_MENU_VIEWPORT_PADDING - half),
    );
  }

  const aboveTop = y - menuHeight;
  if (placement === "above" && aboveTop < FORMAT_MENU_VIEWPORT_PADDING) {
    placement = "below";
    y =
      (anchorBottom ?? y + menuHeight + 16) + FORMAT_MENU_BELOW_SELECTION_GAP;
  } else if (
    placement === "below" &&
    y + menuHeight > viewportHeight - FORMAT_MENU_VIEWPORT_PADDING
  ) {
    if (
      !position.preferBelow &&
      (anchorBottom ?? y) - menuHeight - FORMAT_MENU_ABOVE_SELECTION_GAP >=
        FORMAT_MENU_VIEWPORT_PADDING
    ) {
      placement = "above";
      y = (anchorBottom ?? y) - FORMAT_MENU_ABOVE_SELECTION_GAP;
    } else {
      y = Math.min(
        y,
        viewportHeight - menuHeight - FORMAT_MENU_VIEWPORT_PADDING,
      );
    }
  }

  return { x, y, alignLeft, placement, anchorBottom, preferBelow: position.preferBelow };
}

const TASK_DETAILS_SKELETON_BAR_CLASS =
  "task-details-skeleton-bar animate-pulse";

function TaskDetailsSkeleton() {
  return (
    <div className="flex flex-col px-2 pb-4" aria-hidden="true">
      <div className="min-h-[850px] rounded-xl bg-white py-3 pl-[60px] pr-3 dark:bg-zinc-950">
        <div className={`h-7 w-1/2 rounded ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
        <div className={`mt-5 h-3.5 w-[92%] rounded ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
        <div className={`mt-2.5 h-3.5 w-[85%] rounded ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
        <div className={`mt-2.5 h-3.5 w-[78%] rounded ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
        <div className={`mt-2.5 h-3.5 w-[64%] rounded ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
      </div>
    </div>
  );
}

export function TaskDetailsPanel({
  taskId,
  taskSnapshot = null,
  focusNoteAtEndRequest = 0,
  focusTaskTitleRequest = 0,
  suppressDetailsTitleFocusRef,
  registerSaveController,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onToggleTask,
  subtasks = [],
  canManageSubtasks = false,
  onAddSubtask,
  onRenameSubtask,
  onDeleteSubtask,
  onEditSubtask,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onBack,
  layout = "default",
  modalFooterConfig = null,
  hideModalFormatToggle = false,
  onClose,
}: TaskDetailsPanelProps) {
  const isModalLayout = layout === "modal";
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showClipboardNotice, setShowClipboardNotice] = useState(false);
  const [clipboardNoticeMessage, setClipboardNoticeMessage] = useState("Clipboard");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [formatMenu, setFormatMenu] = useState<FormatMenuState | null>(null);
  const [lineControls, setLineControls] = useState<LineControlItem[]>([]);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const [addBlockMenu, setAddBlockMenu] = useState<AddBlockMenuState | null>(null);
  const [slashCommandMenu, setSlashCommandMenu] =
    useState<SlashCommandMenuState | null>(null);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [taskReminderOptionId, setTaskReminderOptionId] =
    useState<TaskReminderOptionId | null>(null);
  const taskReminderByIdRef = useRef<Map<string, TaskReminderOptionId>>(
    new Map(),
  );
  const [dateMenuPosition, setDateMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [openFormatDropdown, setOpenFormatDropdown] =
    useState<FormatToolbarDropdown | null>(null);
  const [openHeaderFormatDropdown, setOpenHeaderFormatDropdown] =
    useState<HeaderFormatDropdown | null>(null);
  const [isModalFormatToolbarOpen, setIsModalFormatToolbarOpen] = useState(false);
  const [openModalFormatDropdown, setOpenModalFormatDropdown] =
    useState<HeaderFormatDropdown | null>(null);
  const { defaultFontSizePx, defaultLineHeight } = useTaskEditorDefaults();
  const [formatMenuFontSize, setFormatMenuFontSize] =
    useState<DetailFontSizeOption>(() => getDefaultDetailFontSizeOption());
  const [formatMenuFontFamily, setFormatMenuFontFamily] =
    useState<DetailFontFamilyId>(() => getAppFontFamilyId());
  const [formatMenuBlockType, setFormatMenuBlockType] =
    useState<TextBlockType>("text");
  const [formatMenuLineHeight, setFormatMenuLineHeight] =
    useState<DetailLineHeightOption>(() =>
      normalizeDetailLineHeight(getDefaultDetailLineHeight()) as DetailLineHeightOption,
    );
  useEffect(() => {
    setFormatMenuFontSize(getDefaultDetailFontSizeOption());
    setFormatMenuLineHeight(
      normalizeDetailLineHeight(defaultLineHeight) as DetailLineHeightOption,
    );
  }, [defaultFontSizePx, defaultLineHeight]);
  const [formatMenuInlineFormats, setFormatMenuInlineFormats] =
    useState<FormatMenuInlineFormats>(DEFAULT_FORMAT_MENU_INLINE_FORMATS);
  const [showHeaderClearFormatting, setShowHeaderClearFormatting] =
    useState(false);
  const [recentFormatColors, setRecentFormatColors] = useState<RecentFormatColor[]>(
    () => readRecentFormatColors(),
  );
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkHasExisting, setLinkHasExisting] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const savedDetailsRef = useRef("");
  const detailsRef = useRef("");
  const detailsUserModifiedRef = useRef(false);
  const isLargeContentRef = useRef(false);
  const saveStatusRef = useRef<SaveStatus>("idle");
  const taskIdRef = useRef<string | null>(null);
  const taskNameRef = useRef("");
  const syncedTitleRef = useRef("");
  const hydratedTaskIdRef = useRef<string | null>(null);
  const handledFocusNoteAtEndRequestRef = useRef(0);
  const handledFocusTaskTitleRequestRef = useRef(0);
  const pendingFocusTaskTitleRequestRef = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorHeightFrameRef = useRef<number | null>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const headerFormatControlsRef = useRef<HTMLDivElement>(null);
  const headerFormatActionsRef = useRef<HTMLDivElement>(null);
  const formatOverflowMenuRef = useRef<HTMLDivElement>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const linkTextInputRef = useRef<HTMLInputElement>(null);
  const savedLinkSelectionRef = useRef<Range | null>(null);
  const savedFormatSelectionRef = useRef<Range | null>(null);
  const savedFormatLineIdsRef = useRef<string[]>([]);
  const openFormatDropdownRef = useRef<FormatToolbarDropdown | null>(null);
  openFormatDropdownRef.current = openFormatDropdown;
  const openHeaderFormatDropdownRef = useRef<HeaderFormatDropdown | null>(null);
  openHeaderFormatDropdownRef.current = openHeaderFormatDropdown;
  const openModalFormatDropdownRef = useRef<HeaderFormatDropdown | null>(null);
  openModalFormatDropdownRef.current = openModalFormatDropdown;
  const showLinkMenuRef = useRef(false);
  const addBlockMenuRef = useRef<HTMLDivElement>(null);
  const slashCommandMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuCloseTimerRef = useRef<number | null>(null);
  const dateMenuHoverDismissedRef = useRef(false);
  const isRecurrenceMenuOpenRef = useRef(false);
  const isReminderMenuOpenRef = useRef(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isDateMenuOpen) {
      setDateMenuPosition(null);
    }
  }, [isDateMenuOpen]);

  useLayoutEffect(() => {
    if (!isDateMenuOpen || !isModalLayout) return;

    function updateDateMenuPosition() {
      const anchor = dateButtonRef.current;
      if (!anchor) return;

      setDateMenuPosition(computeTaskDatePickerMenuPosition(anchor));
    }

    updateDateMenuPosition();
    window.addEventListener("resize", updateDateMenuPosition);
    window.addEventListener("scroll", updateDateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateDateMenuPosition);
      window.removeEventListener("scroll", updateDateMenuPosition, true);
    };
  }, [isDateMenuOpen, isModalLayout]);

  useEffect(() => {
    if (!isDateMenuOpen) {
      isRecurrenceMenuOpenRef.current = false;
      isReminderMenuOpenRef.current = false;
    }
  }, [isDateMenuOpen]);

  useEffect(() => {
    if (!task) {
      setTaskReminderOptionId(null);
      return;
    }

    setTaskReminderOptionId(taskReminderByIdRef.current.get(task.id) ?? null);
  }, [task?.id]);

  const lineControlsRef = useRef<HTMLDivElement>(null);
  const hoveredLineRef = useRef<HTMLElement | null>(null);
  const clickedLineRef = useRef<HTMLElement | null>(null);
  const pendingClickLineRef = useRef<HTMLElement | null>(null);
  const activeLineControlsRef = useRef<HTMLElement | null>(null);
  const isMouseOverEditorRef = useRef(false);
  const pointerInGutterRef = useRef(false);
  const isEditorPointerDownRef = useRef(false);
  const dragStateRef = useRef<{
    sourceIndex: number;
    sourceLine: HTMLElement;
    dropIndex: number;
  } | null>(null);
  const previousTextRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const saveAbortRef = useRef(false);
  const lastSaveCompletedAtRef = useRef(0);
  const historyTimerRef = useRef<number | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const isReadyRef = useRef(false);
  const imageDropDepthRef = useRef(0);
  const inputNormalizeFrameRef = useRef<number | null>(null);
  const inputNormalizeTimerRef = useRef<number | null>(null);
  const formatMenuTimerRef = useRef<number | null>(null);
  const formatMenuRevealTimerRef = useRef<number | null>(null);
  const formatMenuRevealFrameRef = useRef<number | null>(null);
  const formatMenuVisibleRef = useRef(false);
  const lineControlsTimerRef = useRef<number | null>(null);
  const titleSyncTimerRef = useRef<number | null>(null);
  const clipboardNoticeTimerRef = useRef<number | null>(null);
  const localPendingByTaskRef = useRef<
    Map<string, { details: string; title: string }>
  >(new Map());
  const requestSaveRef = useRef<
    ((mode?: "debounced" | "flush" | "immediate") => void) | null
  >(null);
  const taskStateRef = useRef<TaskDetails | null>(null);
  const taskSnapshotRef = useRef(taskSnapshot);
  const taskLoadHandlersRef = useRef<{
    hydrateFromTaskRecord: (
      loadedTask: TaskDetails,
      pendingLocal?: { details: string; title: string },
    ) => void;
    onTaskHasDetailsKnown?: (taskId: string, hasDetails: boolean) => void;
    captureTaskSnapshotForSwitch: (currentTaskId: string) => {
      title: string;
      details: string;
    };
    persistTaskContent: (
      taskId: string,
      content: { title: string; details: string },
      baseline?: { details: string; name: string },
    ) => Promise<boolean>;
    waitForSaveIdle: () => Promise<void>;
    closeFormatMenu: () => void;
  } | null>(null);

  taskStateRef.current = task;
  taskSnapshotRef.current = taskSnapshot;

  function shouldDeferEditorStructureSync(editor: HTMLElement) {
    return (
      isEditorPointerDownRef.current ||
      editorHasLiveExtendedTextSelection(editor)
    );
  }

  function syncEditorLineEmptyState(editor: HTMLElement) {
    if (shouldDeferEditorStructureSync(editor)) return;

    const before = normalizeDetails(editor.innerHTML);
    syncLineEmptyState(editor);
    syncEditorBodyPlaceholderVisibility(editor);
    const after = normalizeDetails(editor.innerHTML);
    if (before !== after) {
      detailsRef.current = after;
    }
  }

  function setLineControlsPointerEventsEnabled(enabled: boolean) {
    const root = lineControlsRef.current;
    if (!root) return;

    root.querySelectorAll("button").forEach((button) => {
      button.style.pointerEvents = enabled ? "auto" : "none";
    });
  }

  const readEditorContent = useCallback(() => {
    if (editorRef.current) {
      return normalizeDetails(editorRef.current.innerHTML);
    }

    return normalizeDetails(detailsRef.current);
  }, []);

  const readCurrentSplitContent = useCallback(() => {
    const editorHtml = readEditorContent();
    detailsRef.current = editorHtml;
    return splitEditorContent(editorHtml);
  }, [readEditorContent]);

  const resolveDetailsForPersistence = useCallback(
    (nextDetails: string, savedDetails: string) =>
      resolveTaskDetailsForSave(nextDetails, savedDetails, {
        allowClear: detailsUserModifiedRef.current,
      }),
    [],
  );

  const rememberPendingLocalSave = useCallback(() => {
    const currentTaskId = taskIdRef.current;
    if (!currentTaskId || !isReadyRef.current) return;

    const { title, details } = readCurrentSplitContent();
    const titleChanged = Boolean(title) && title !== taskNameRef.current;
    const resolvedDetails = resolveDetailsForPersistence(
      details,
      savedDetailsRef.current,
    );

    if (resolvedDetails !== savedDetailsRef.current || titleChanged) {
      localPendingByTaskRef.current.set(currentTaskId, {
        details: resolvedDetails,
        title,
      });
      return;
    }

    localPendingByTaskRef.current.delete(currentTaskId);
  }, [readCurrentSplitContent, resolveDetailsForPersistence]);

  const captureTaskSnapshotForSwitch = useCallback((currentTaskId: string) => {
    if (editorRef.current) {
      detailsRef.current = normalizeDetails(editorRef.current.innerHTML);
    }

    const editorHtml = detailsRef.current;
    const { title, details } = splitEditorContent(editorHtml);
    const resolvedDetails = resolveDetailsForPersistence(
      details,
      savedDetailsRef.current,
    );

    if (
      resolvedDetails !== savedDetailsRef.current ||
      (Boolean(title) && title !== taskNameRef.current)
    ) {
      localPendingByTaskRef.current.set(currentTaskId, {
        details: resolvedDetails,
        title,
      });
    }

    return { title, details: resolvedDetails };
  }, [resolveDetailsForPersistence]);

  const clearPendingLocalSave = useCallback((currentTaskId: string) => {
    localPendingByTaskRef.current.delete(currentTaskId);
  }, []);

  const hydrateFromTaskRecord = useCallback(
    (
      loadedTask: TaskDetails,
      pendingLocal?: { details: string; title: string },
    ) => {
      const loadedDetails = normalizeDetails(loadedTask.details);
      const effectiveDetails = resolveTaskDetailsForLoad(
        pendingLocal?.details,
        loadedDetails,
      );
      const effectiveName = pendingLocal?.title || loadedTask.name;
      const editorHtml = buildEditorHtmlFromTask(
        effectiveName,
        effectiveDetails,
      );

      setTask({
        ...loadedTask,
        name: effectiveName,
        dueDate: loadedTask.dueDate
          ? new Date(loadedTask.dueDate).toISOString()
          : null,
      });
      savedDetailsRef.current = loadedDetails;
      detailsRef.current = editorHtml;
      isLargeContentRef.current =
        effectiveDetails.length > LARGE_CONTENT_THRESHOLD ||
        editorHtml.length > LARGE_CONTENT_THRESHOLD;
      taskNameRef.current = loadedTask.name;
      syncedTitleRef.current = effectiveName;
      taskIdRef.current = loadedTask.id;
      isReadyRef.current = true;
      detailsUserModifiedRef.current = false;
      hydratedTaskIdRef.current = null;
      setSaveStatus("idle");
      saveStatusRef.current = "idle";
      setSaveErrorMessage(null);
      setMetadataError(null);

      taskDetailsCache.set(loadedTask.id, {
        ...loadedTask,
        name: effectiveName,
        details: effectiveDetails,
        dueDate: loadedTask.dueDate
          ? new Date(loadedTask.dueDate).toISOString()
          : null,
      });

      const hasUnsavedLocal =
        effectiveDetails !== loadedDetails ||
        effectiveName.trim() !== loadedTask.name.trim();

      if (hasUnsavedLocal) {
        queueMicrotask(() => {
          requestSaveRef.current?.("immediate");
        });
      }
    },
    [],
  );

  const waitForSaveIdle = useCallback(async () => {
    while (saveInFlightRef.current) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 10);
      });
    }
  }, []);

  const syncEditorContent = useCallback(() => {
    const html = readEditorContent();
    detailsRef.current = html;
    if (isReadyRef.current) {
      detailsUserModifiedRef.current = true;
    }
    rememberPendingLocalSave();
    return html;
  }, [readEditorContent, rememberPendingLocalSave]);

  const syncTitleToTaskList = useCallback(() => {
    const currentTaskId = taskIdRef.current;
    const editor = editorRef.current;
    if (!currentTaskId || !editor || !isReadyRef.current) return;

    const title = getEditorTitle(editor);
    if (!title || title === syncedTitleRef.current) return;

    syncedTitleRef.current = title;
    setTask((current) =>
      current ? { ...current, name: title } : current,
    );

    if (titleSyncTimerRef.current !== null) {
      window.clearTimeout(titleSyncTimerRef.current);
    }

    titleSyncTimerRef.current = window.setTimeout(() => {
      titleSyncTimerRef.current = null;
      onTaskRenamed(currentTaskId, title);
    }, TITLE_SYNC_DEBOUNCE_MS);
  }, [onTaskRenamed]);

  const syncExternalTaskName = useCallback(
    (name: string) => {
      const editor = editorRef.current;
      if (!editor || !isReadyRef.current) return;

      const title = getEditorTitle(editor);
      if (title === name) {
        syncedTitleRef.current = name;
        return;
      }

      const activeLine =
        document.activeElement === editor ? getActiveLineElement(editor) : null;
      const titleLine = getLineElements(editor)[0];
      if (activeLine && titleLine && activeLine === titleLine) return;

      ensureBlockLines(editor);
      ensureTitleLine(editor);

      const lines = getLineElements(editor);
      if (!lines[0]) return;

      if (name) {
        lines[0].textContent = name;
      } else {
        lines[0].innerHTML = "<br>";
      }

      syncEditorLineEmptyState(editor);
      syncedTitleRef.current = name;
      setTask((current) => (current ? { ...current, name } : current));
      detailsRef.current = editor.innerHTML;
    },
    [],
  );

  const markSavePending = useCallback(() => {
    if (saveStatusRef.current === "pending") return;
    saveStatusRef.current = "pending";
    setSaveStatus("pending");
  }, []);

  const showClipboardSaveNotice = useCallback((message = "Clipboard") => {
    if (clipboardNoticeTimerRef.current !== null) {
      window.clearTimeout(clipboardNoticeTimerRef.current);
    }

    setClipboardNoticeMessage(message);
    setShowClipboardNotice(true);
    clipboardNoticeTimerRef.current = window.setTimeout(() => {
      clipboardNoticeTimerRef.current = null;
      setShowClipboardNotice(false);
      setClipboardNoticeMessage("Clipboard");
    }, CLIPBOARD_SAVE_NOTICE_MS);
  }, []);

  const updateHistoryAvailability = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const resetHistory = useCallback(
    (html: string) => {
      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }

      historyRef.current = [html];
      historyIndexRef.current = 0;
      updateHistoryAvailability();
    },
    [updateHistoryAvailability],
  );

  const pushHistorySnapshot = useCallback(() => {
    if (isApplyingHistoryRef.current) return;

    const snapshot = readEditorContent();
    const current = historyRef.current[historyIndexRef.current];

    if (snapshot === current) return;

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);

    const historyLimit = isLargeContentRef.current
      ? LARGE_CONTENT_HISTORY_LIMIT
      : HISTORY_LIMIT;

    if (nextHistory.length > historyLimit) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    updateHistoryAvailability();
  }, [readEditorContent, updateHistoryAvailability]);

  const scheduleHistorySnapshot = useCallback(() => {
    if (isApplyingHistoryRef.current) return;

    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
    }

    const debounceMs = isLargeContentRef.current
      ? LARGE_CONTENT_HISTORY_DEBOUNCE_MS
      : HISTORY_DEBOUNCE_MS;

    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      pushHistorySnapshot();
    }, debounceMs);
  }, [pushHistorySnapshot]);

  const flushHistorySnapshot = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }

    pushHistorySnapshot();
  }, [pushHistorySnapshot]);

  const recordHistorySnapshot = useCallback(() => {
    flushHistorySnapshot();
  }, [flushHistorySnapshot]);

  const persistTaskContent = useCallback(
    async (
      taskId: string,
      content: { title: string; details: string },
      baseline?: { details: string; name: string },
    ) => {
      const savedDetailsBaseline =
        baseline?.details ?? savedDetailsRef.current;
      const savedNameBaseline = baseline?.name ?? taskNameRef.current;
      const resolvedDetails = resolveDetailsForPersistence(
        content.details,
        savedDetailsBaseline,
      );

      const detailsChanged = resolvedDetails !== savedDetailsBaseline;
      const titleChanged = Boolean(
        content.title && content.title !== savedNameBaseline,
      );

      if (!detailsChanged && !titleChanged) {
        return false;
      }

        saveStatusRef.current = "pending";
        setSaveStatus("pending");

      let savedSomething = false;

        if (detailsChanged) {
        const detailsBytes = new TextEncoder().encode(resolvedDetails).byteLength;
            if (detailsBytes > MAX_DETAILS_SAVE_BYTES) {
              saveStatusRef.current = "error";
              setSaveStatus("error");
          setSaveErrorMessage(
            "Content is too large to save (9 MB limit). Try removing images or shortening the note.",
          );
          return false;
        }

        await saveTaskDetails(taskId, resolvedDetails);

        if (taskIdRef.current === taskId) {
          savedDetailsRef.current = resolvedDetails;
          detailsUserModifiedRef.current = false;
        }
        clearPendingLocalSave(taskId);
        onDetailsSaved(taskId, resolvedDetails);
        onTaskHasDetailsKnown?.(
          taskId,
          taskDetailsHasContent(resolvedDetails),
        );
        savedSomething = true;
      }

      if (titleChanged && content.title) {
        const updatedTask = await renameTask(taskId, content.title);

        clearPendingLocalSave(taskId);
        onTaskRenamed(taskId, updatedTask.name);

        if (taskIdRef.current === taskId) {
          taskNameRef.current = updatedTask.name;
          syncedTitleRef.current = updatedTask.name;
          setTask((current) =>
            current ? { ...current, name: updatedTask.name } : current,
          );
        }

        savedSomething = true;
      }

      if (savedSomething && taskIdRef.current === taskId) {
        saveStatusRef.current = "saved";
        setSaveStatus("saved");
        setSaveErrorMessage(null);
          lastSaveCompletedAtRef.current = Date.now();
          setLastSavedAt(new Date());
      }

      return savedSomething;
    },
    [
      clearPendingLocalSave,
      onDetailsSaved,
      onTaskHasDetailsKnown,
      onTaskRenamed,
      resolveDetailsForPersistence,
    ],
  );

  const saveDetails = useCallback(async () => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;

    try {
      while (true) {
        if (saveAbortRef.current) break;

        const currentTaskId = taskIdRef.current;
        if (!currentTaskId || !isReadyRef.current) break;

        const content = readCurrentSplitContent();
        const savedDetailsBaseline = savedDetailsRef.current;
        const savedNameBaseline = taskNameRef.current;
        const resolvedDetails = resolveDetailsForPersistence(
          content.details,
          savedDetailsBaseline,
        );
        const contentToPersist = {
          title: content.title,
          details: resolvedDetails,
        };

        const detailsChanged = resolvedDetails !== savedDetailsBaseline;
        const titleChanged = Boolean(
          content.title && content.title !== savedNameBaseline,
        );

        if (!detailsChanged && !titleChanged) break;

        await persistTaskContent(currentTaskId, contentToPersist, {
          details: savedDetailsBaseline,
          name: savedNameBaseline,
        });

        if (
          saveAbortRef.current ||
          taskIdRef.current !== currentTaskId ||
          !isReadyRef.current
        ) {
          break;
        }

        const latest = readCurrentSplitContent();
        const latestResolvedDetails = resolveDetailsForPersistence(
          latest.details,
          savedDetailsRef.current,
        );
        const stillDirty =
          latestResolvedDetails !== savedDetailsRef.current ||
          (Boolean(latest.title) && latest.title !== taskNameRef.current);

        if (!stillDirty && !saveQueuedRef.current) break;
      }
    } catch {
      rememberPendingLocalSave();
      saveStatusRef.current = "error";
      setSaveStatus("error");
      setSaveErrorMessage("Something went wrong while saving.");

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        if (taskIdRef.current && isReadyRef.current && !saveAbortRef.current) {
          markSavePending();
          void saveDetails();
        }
      }, 3000);
    } finally {
      saveInFlightRef.current = false;

      if (
        saveQueuedRef.current &&
        !saveAbortRef.current &&
        taskIdRef.current &&
        isReadyRef.current
      ) {
        saveQueuedRef.current = false;
        void saveDetails();
      } else {
        saveQueuedRef.current = false;
      }
    }
  }, [
    persistTaskContent,
    readCurrentSplitContent,
    rememberPendingLocalSave,
    markSavePending,
    resolveDetailsForPersistence,
  ]);

  const runPendingAutoSave = useCallback(
    (force = false) => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (!force) {
        const sinceLastSave = Date.now() - lastSaveCompletedAtRef.current;
        const minGapRemaining = MIN_SAVE_INTERVAL_MS - sinceLastSave;

        if (minGapRemaining > 0) {
          saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null;
            void saveDetails();
          }, minGapRemaining);
          return;
        }
      }

      void saveDetails();
    },
    [saveDetails],
  );

  const scheduleAutoSave = useCallback(() => {
    markSavePending();
    rememberPendingLocalSave();

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const debounceMs = isLargeContentRef.current
      ? LARGE_CONTENT_AUTO_SAVE_DEBOUNCE_MS
      : AUTO_SAVE_DEBOUNCE_MS;

    saveTimerRef.current = window.setTimeout(() => {
      runPendingAutoSave();
    }, debounceMs);
  }, [markSavePending, rememberPendingLocalSave, runPendingAutoSave]);

  const flushAutoSave = useCallback(() => {
    runPendingAutoSave(true);
  }, [runPendingAutoSave]);

  const requestSave = useCallback(
    (mode: "debounced" | "flush" | "immediate" = "debounced") => {
      if (mode === "immediate") {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        markSavePending();
        void saveDetails();
        return;
      }

      if (mode === "flush") {
        flushAutoSave();
        return;
      }

      scheduleAutoSave();
    },
    [flushAutoSave, markSavePending, saveDetails, scheduleAutoSave],
  );

  requestSaveRef.current = requestSave;

  const flushSave = useCallback(async () => {
    const currentTaskId = taskIdRef.current;
    if (!currentTaskId || !isReadyRef.current) return;

    const snapshot = captureTaskSnapshotForSwitch(currentTaskId);
    const savedDetailsBaseline = savedDetailsRef.current;
    const savedNameBaseline = taskNameRef.current;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    await waitForSaveIdle();

    saveInFlightRef.current = true;
    try {
      await persistTaskContent(currentTaskId, snapshot, {
        details: savedDetailsBaseline,
        name: savedNameBaseline,
      });
    } catch {
      rememberPendingLocalSave();
      saveStatusRef.current = "error";
      setSaveStatus("error");
      setSaveErrorMessage("Something went wrong while saving.");
    } finally {
      saveInFlightRef.current = false;
    }

    await waitForSaveIdle();
  }, [
    captureTaskSnapshotForSwitch,
    persistTaskContent,
    rememberPendingLocalSave,
    waitForSaveIdle,
  ]);

  useEffect(() => {
    if (!registerSaveController) return;

    registerSaveController({ flushSave });

    return () => {
      registerSaveController(null);
    };
  }, [flushSave, registerSaveController]);

  const updateLineControls = useCallback(() => {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    if (!editor || !wrapper) {
      setLineControls([]);
      return;
    }

    if (dragStateRef.current) return;
    if (isEditorPointerDownRef.current) {
      setLineControls([]);
      return;
    }
    if (editorHasLiveExtendedTextSelection(editor)) {
      setLineControls([]);
      return;
    }

    let line: HTMLElement | null = null;
    const hoveredLine =
      isMouseOverEditorRef.current &&
      hoveredLineRef.current &&
      editor.contains(hoveredLineRef.current)
        ? hoveredLineRef.current
        : null;

    const editorHasFocus =
      document.activeElement === editor ||
      (document.activeElement instanceof Node &&
        editor.contains(document.activeElement));
    const activeLine = editorHasFocus ? getActiveLineElement(editor) : null;
    const focusedEmptyBodyLine =
      activeLine && isEmptyEditableBodyLine(editor, activeLine)
        ? activeLine
        : null;

    if (slashCommandMenu && activeLineControlsRef.current) {
      line = activeLineControlsRef.current;
    } else if (addBlockMenu && activeLineControlsRef.current) {
      line = activeLineControlsRef.current;
    } else if (focusedEmptyBodyLine) {
      line = focusedEmptyBodyLine;
    } else if (
      isMouseOverEditorRef.current &&
      hoveredLine &&
      !isTitleLine(editor, hoveredLine) &&
      !hoveredLine.querySelector(".detail-image-wrapper") &&
      !isCodeLine(hoveredLine)
    ) {
      line = hoveredLine;
    } else {
      activeLineControlsRef.current = null;
      setLineControls([]);
      return;
    }

    if (!line || !editor.contains(line)) {
      activeLineControlsRef.current = null;
      setLineControls([]);
      return;
    }

    if (getLineIndex(editor, line) === 0) {
      activeLineControlsRef.current = null;
      setLineControls([]);
      return;
    }

    const lineId = line.dataset.lineId;
    if (!lineId) {
      activeLineControlsRef.current = null;
      setLineControls([]);
      return;
    }

    const position = getLineControlsPositionForLine(line, wrapper);
    if (!position) {
      activeLineControlsRef.current = null;
      setLineControls([]);
      return;
    }

    activeLineControlsRef.current = line;
    const isEmpty = isDetailLineEmpty(line);
    const keepAddBlockMenuOpen =
      Boolean(addBlockMenu) && activeLineControlsRef.current === line;
    const keepSlashCommandMenuOpen =
      Boolean(slashCommandMenu) && activeLineControlsRef.current === line;
    const showControls =
      keepAddBlockMenuOpen ||
      keepSlashCommandMenuOpen ||
      focusedEmptyBodyLine === line ||
      (isMouseOverEditorRef.current && hoveredLine === line);

    setLineControls([
      {
        lineId,
        top: position.top,
        showPlus: isEmpty && showControls,
        showDrag: !isEmpty && showControls,
      },
    ]);
  }, [addBlockMenu, slashCommandMenu]);

  const applyFocusTaskTitleIfReady = useCallback(
    (requestId: number) => {
      if (!requestId) return false;
      if (suppressDetailsTitleFocusRef?.current) return false;
      if (requestId === handledFocusTaskTitleRequestRef.current) return true;
      if (!isReadyRef.current || !editorRef.current || !taskId) return false;
      if (hydratedTaskIdRef.current !== taskId) return false;

      handledFocusTaskTitleRequestRef.current = requestId;
      pendingFocusTaskTitleRequestRef.current = 0;

      requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;

        focusTaskTitle(editor);
        updateLineControls();
      });
      return true;
    },
    [suppressDetailsTitleFocusRef, taskId, updateLineControls],
  );

  const scheduleLineControlsUpdate = useCallback(() => {
    if (lineControlsTimerRef.current !== null) {
      window.clearTimeout(lineControlsTimerRef.current);
    }

    lineControlsTimerRef.current = window.setTimeout(() => {
      lineControlsTimerRef.current = null;
      updateLineControls();
    }, LINE_CONTROLS_DEBOUNCE_MS);
  }, [updateLineControls]);

  const syncEditorHeight = useCallback(() => {
    const editor = editorRef.current;
    const panel = panelRef.current;
    if (!editor || !task) return;

    editor.style.height = "auto";
    const contentHeight = editor.scrollHeight;
    const viewportBottom =
      window.visualViewport?.height ?? window.innerHeight;
    const editorTop = editor.getBoundingClientRect().top;
    const reservedBelow = getEditorReservedBelowSpacePx(
      editor,
      panel,
      isModalLayout,
    );
    const maxHeight = Math.max(
      TASK_DETAILS_EDITOR_MIN_HEIGHT_PX,
      viewportBottom - editorTop - reservedBelow,
    );
    const nextHeight = Math.max(
      TASK_DETAILS_EDITOR_MIN_HEIGHT_PX,
      Math.min(contentHeight, maxHeight),
    );

    editor.style.height = `${nextHeight}px`;
  }, [isModalLayout, task]);

  const scheduleEditorHeightSync = useCallback(() => {
    if (editorHeightFrameRef.current !== null) {
      window.cancelAnimationFrame(editorHeightFrameRef.current);
    }

    editorHeightFrameRef.current = window.requestAnimationFrame(() => {
      editorHeightFrameRef.current = null;
      syncEditorHeight();
    });
  }, [syncEditorHeight]);

  function beginEditorPointerInteraction() {
    isEditorPointerDownRef.current = true;
    setLineControlsPointerEventsEnabled(false);
    setLineControls([]);

    if (inputNormalizeTimerRef.current !== null) {
      window.clearTimeout(inputNormalizeTimerRef.current);
      inputNormalizeTimerRef.current = null;
    }

    if (inputNormalizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      inputNormalizeFrameRef.current = null;
    }
  }

  function finishEditorPointerInteraction() {
    if (!isEditorPointerDownRef.current) return;

    isEditorPointerDownRef.current = false;
    setLineControlsPointerEventsEnabled(true);

    window.setTimeout(() => {
      const editor = editorRef.current;
      if (editor && !editorHasLiveExtendedTextSelection(editor)) {
        syncEditorLineEmptyState(editor);
      }
      updateLineControls();
    }, 0);
  }

  const runEditorNormalization = useCallback(
    (mode: "light" | "full") => {
      const editor = editorRef.current;
      if (!editor) return;
      if (shouldDeferEditorStructureSync(editor)) return;

      ensureBlockLines(editor);
      ensureTitleLine(editor);

      if (mode === "full") {
        splitBlockLinesOnBreaks(editor);
        normalizeLinks(editor);
        syncEditorLineEmptyState(editor);
      }

      syncEditorContent();
      syncTitleToTaskList();
      scheduleHistorySnapshot();
      scheduleAutoSave();
      scheduleLineControlsUpdate();
      scheduleEditorHeightSync();
    },
    [
      scheduleAutoSave,
      scheduleEditorHeightSync,
      scheduleHistorySnapshot,
      scheduleLineControlsUpdate,
      syncEditorContent,
      syncTitleToTaskList,
    ],
  );

  const normalizeEditorAfterInput = useCallback(() => {
    runEditorNormalization(isLargeContentRef.current ? "light" : "full");
  }, [runEditorNormalization]);

  const scheduleInputNormalization = useCallback(() => {
    if (inputNormalizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      inputNormalizeFrameRef.current = null;
    }

    if (inputNormalizeTimerRef.current !== null) {
      window.clearTimeout(inputNormalizeTimerRef.current);
      inputNormalizeTimerRef.current = null;
    }

    const debounceMs = isLargeContentRef.current
      ? INPUT_NORMALIZE_DEBOUNCE_MS
      : SMALL_CONTENT_INPUT_DEBOUNCE_MS;

    inputNormalizeTimerRef.current = window.setTimeout(() => {
      inputNormalizeTimerRef.current = null;
      inputNormalizeFrameRef.current = window.requestAnimationFrame(() => {
        inputNormalizeFrameRef.current = null;
        normalizeEditorAfterInput();
      });
    }, debounceMs);
  }, [normalizeEditorAfterInput]);

  const closeFormatDropdowns = useCallback(() => {
    setOpenFormatDropdown(null);
    setOpenHeaderFormatDropdown(null);
  }, []);

  const syncHeaderClearFormattingState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      setShowHeaderClearFormatting(false);
      return;
    }

    const hasExtendedSelection =
      editorHasLiveExtendedTextSelection(editor) ||
      Boolean(
        savedFormatSelectionRef.current &&
          !savedFormatSelectionRef.current.collapsed &&
          savedFormatSelectionRef.current.toString().trim(),
      );

    if (!hasExtendedSelection) {
      setShowHeaderClearFormatting(false);
      return;
    }

    setShowHeaderClearFormatting(
      selectionHasNonDefaultFormatting(
        editor,
        savedFormatSelectionRef.current,
      ),
    );
  }, []);

  const closeFormatMenu = useCallback((options?: {
    clearSavedSelection?: boolean;
    preserveToolbarDropdowns?: boolean;
  }) => {
    setFormatMenu(null);
    formatMenuVisibleRef.current = false;
    if (options?.preserveToolbarDropdowns) {
      setOpenFormatDropdown(null);
    } else {
      closeFormatDropdowns();
    }
    setShowLinkMenu(false);
    showLinkMenuRef.current = false;
    setLinkHasExisting(false);
    savedLinkSelectionRef.current = null;
    if (options?.clearSavedSelection !== false) {
    savedFormatSelectionRef.current = null;
      savedFormatLineIdsRef.current = [];
      setShowHeaderClearFormatting(false);
    } else {
      syncHeaderClearFormattingState();
    }
  }, [closeFormatDropdowns, syncHeaderClearFormattingState]);

  const dismissFormatMenu = useCallback(() => {
    if (formatMenuTimerRef.current !== null) {
      window.clearTimeout(formatMenuTimerRef.current);
      formatMenuTimerRef.current = null;
    }

    closeFormatMenu();

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (
      editor &&
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode) &&
      !selection.isCollapsed
    ) {
      const range = selection.getRangeAt(0);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [closeFormatMenu]);

  taskLoadHandlersRef.current = {
    hydrateFromTaskRecord,
    onTaskHasDetailsKnown,
    captureTaskSnapshotForSwitch,
    persistTaskContent,
    waitForSaveIdle,
    closeFormatMenu,
  };

  const rememberFormatSelection = useCallback(
    (editor: HTMLElement, range: Range) => {
      savedFormatSelectionRef.current = range.cloneRange();
      savedFormatLineIdsRef.current = getSelectedBlockLinesInRange(editor, range)
        .map((line) => line.dataset.lineId)
        .filter((lineId): lineId is string => Boolean(lineId));
    },
    [],
  );

  const captureFormatSelectionFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      !selection.isCollapsed &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode)
    ) {
      rememberFormatSelection(editor, selection.getRangeAt(0));
    }
  }, [rememberFormatSelection]);

  const setFormatDropdownOpen = useCallback(
    (dropdown: FormatToolbarDropdown, open: boolean) => {
      if (open) {
        setOpenHeaderFormatDropdown(null);
        captureFormatSelectionFromEditor();
        setOpenFormatDropdown(dropdown);

        const editor = editorRef.current;
        if (
          editor &&
          (dropdown === "textColor" || dropdown === "highlight")
        ) {
          setFormatMenuInlineFormats(getDetailSelectionInlineFormatState(editor));
        }

        return;
      }

      setOpenFormatDropdown((current) => (current === dropdown ? null : current));
    },
    [captureFormatSelectionFromEditor],
  );

  const syncFormatMenuSelectionState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;

    setFormatMenuInlineFormats(getDetailSelectionInlineFormatState(editor));
    setFormatMenuFontSize(getDetailSelectionFontState(editor).size);
    setFormatMenuFontFamily(getDetailSelectionFontState(editor).familyId);
    setFormatMenuLineHeight(getDetailSelectionLineHeight(editor));
    setFormatMenuBlockType(getActiveTextBlockType(editor));
    syncHeaderClearFormattingState();
  }, [syncHeaderClearFormattingState]);

  const syncFormatMenuFontState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const range = savedFormatSelectionRef.current
      ? savedFormatSelectionRef.current.cloneRange()
      : null;
    const selection = window.getSelection();
    let effectiveRange: Range | null = null;

    if (
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode)
    ) {
      const currentRange = selection.getRangeAt(0);
      if (!currentRange.collapsed && currentRange.toString().length > 0) {
        effectiveRange = currentRange.cloneRange();
      } else if (
        range &&
        editor.contains(range.commonAncestorContainer) &&
        !range.collapsed &&
        range.toString().length > 0
      ) {
        effectiveRange = range;
      } else {
        effectiveRange = currentRange.cloneRange();
      }
    } else if (
      range &&
      editor.contains(range.commonAncestorContainer)
    ) {
      effectiveRange = range;
    }

    if (!effectiveRange) return;

    const previousRange =
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null;

    const selectionForRead = effectiveRange.cloneRange();
    const selectionObj = window.getSelection();
    selectionObj?.removeAllRanges();
    selectionObj?.addRange(selectionForRead);

    rememberFormatSelection(editor, effectiveRange);
    const fontState = getDetailSelectionFontState(editor);
    setFormatMenuFontSize(fontState.size);
    setFormatMenuFontFamily(fontState.familyId);
    setFormatMenuLineHeight(getDetailSelectionLineHeight(editor));
    setFormatMenuBlockType(getActiveTextBlockType(editor));

    if (previousRange) {
      selectionObj?.removeAllRanges();
      selectionObj?.addRange(previousRange);
    }
  }, [rememberFormatSelection]);

  const setHeaderFormatDropdownOpen = useCallback(
    (dropdown: HeaderFormatDropdown, open: boolean) => {
      if (open) {
        if (formatMenuTimerRef.current !== null) {
          window.clearTimeout(formatMenuTimerRef.current);
          formatMenuTimerRef.current = null;
        }
        if (formatMenuRevealTimerRef.current !== null) {
          window.clearTimeout(formatMenuRevealTimerRef.current);
          formatMenuRevealTimerRef.current = null;
        }
        if (formatMenuRevealFrameRef.current !== null) {
          window.cancelAnimationFrame(formatMenuRevealFrameRef.current);
          formatMenuRevealFrameRef.current = null;
        }
        closeFormatMenu({
          clearSavedSelection: false,
          preserveToolbarDropdowns: true,
        });
        syncFormatMenuFontState();
      }
      setOpenHeaderFormatDropdown(open ? dropdown : null);
    },
    [closeFormatMenu, syncFormatMenuFontState],
  );

  const setModalFormatDropdownOpen = useCallback(
    (dropdown: HeaderFormatDropdown, open: boolean) => {
      if (open) {
        syncFormatMenuFontState();
        setOpenFormatDropdown(null);
      }
      setOpenModalFormatDropdown(open ? dropdown : null);
    },
    [syncFormatMenuFontState],
  );

  const handleModalFormatToggle = useCallback(() => {
    setIsModalFormatToolbarOpen((current) => {
      const next = !current;
      if (next) {
        syncFormatMenuFontState();
        syncFormatMenuSelectionState();
      } else {
        setOpenModalFormatDropdown(null);
      }
      return next;
    });
  }, [syncFormatMenuFontState, syncFormatMenuSelectionState]);

  const handleDetailFontApplied = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      syncEditorLineEmptyState(editor);
    }
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }, [
    recordHistorySnapshot,
    scheduleAutoSave,
    syncEditorContent,
    updateLineControls,
  ]);

  const applyFormatFontSize = useCallback(
    (size: DetailFontSizeOption) => {
      const editor = editorRef.current;
      if (!editor) return;

      const savedRange = savedFormatSelectionRef.current?.cloneRange() ?? null;
      if (
        savedRange &&
        editor.contains(savedRange.commonAncestorContainer)
      ) {
        restoreEditorSelectionRange(savedRange);
      }

      captureFormatSelectionFromEditor();
      const rangeToApply =
        savedFormatSelectionRef.current?.cloneRange() ?? savedRange;

      if (applyDetailFontSize(editor, size, rangeToApply)) {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
          rememberFormatSelection(editor, selection.getRangeAt(0));
        }
        setFormatMenuFontSize(size);
        handleDetailFontApplied();
      }

      closeFormatDropdowns();
    },
    [
      captureFormatSelectionFromEditor,
      closeFormatDropdowns,
      handleDetailFontApplied,
      rememberFormatSelection,
    ],
  );

  const applyFormatFontFamily = useCallback(
    (familyId: DetailFontFamilyId) => {
      const editor = editorRef.current;
      if (!editor) return;

      const savedRange = savedFormatSelectionRef.current?.cloneRange() ?? null;
      if (
        savedRange &&
        editor.contains(savedRange.commonAncestorContainer)
      ) {
        restoreEditorSelectionRange(savedRange);
      }

      captureFormatSelectionFromEditor();
      const rangeToApply =
        savedFormatSelectionRef.current?.cloneRange() ?? savedRange;

      if (
        applyDetailFontFamily(
          editor,
          familyId,
          rangeToApply,
        )
      ) {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
          rememberFormatSelection(editor, selection.getRangeAt(0));
        }
        setFormatMenuFontFamily(familyId);
        handleDetailFontApplied();
      }

      closeFormatDropdowns();
    },
    [
      captureFormatSelectionFromEditor,
      closeFormatDropdowns,
      handleDetailFontApplied,
      rememberFormatSelection,
    ],
  );

  const applyFormatLineHeight = useCallback(
    (lineHeight: DetailLineHeightOption) => {
    const editor = editorRef.current;
      if (!editor) return;

      const savedRange = savedFormatSelectionRef.current?.cloneRange() ?? null;
      if (
        savedRange &&
        editor.contains(savedRange.commonAncestorContainer)
      ) {
        restoreEditorSelectionRange(savedRange);
      }

      captureFormatSelectionFromEditor();
      const rangeToApply =
        savedFormatSelectionRef.current?.cloneRange() ?? savedRange;

      if (applyDetailLineHeight(editor, lineHeight, rangeToApply)) {
        setFormatMenuLineHeight(lineHeight);
        handleDetailFontApplied();
      }

      closeFormatDropdowns();
    },
    [
      captureFormatSelectionFromEditor,
      closeFormatDropdowns,
      handleDetailFontApplied,
    ],
  );

  const applyFormatBlockType = useCallback(
    (type: TextBlockType) => {
    const editor = editorRef.current;
    if (!editor) return;

      editor.focus();

      const savedRange = savedFormatSelectionRef.current;
      const selection = window.getSelection();
      if (savedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange.cloneRange());
      }

      const rangeToApply =
        selection?.rangeCount && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : savedRange?.cloneRange() ?? null;

      const activeLine = getActiveLineElement(editor);
      if (!activeLine || isCodeLine(activeLine)) return;
      if (isTitleLine(editor, activeLine) && type !== "h1") return;

      applyBlockTypeToSelection(editor, type, rangeToApply);
      setFormatMenuBlockType(type);
      syncEditorLineEmptyState(editor);
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
      updateLineControls();
      closeFormatDropdowns();
    },
    [
      closeFormatDropdowns,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
      updateLineControls,
    ],
  );

  useEffect(() => {
    if (!formatMenu) return;

    function handleFormatMenuEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      const target = event.target as Node | null;
      if (!target || !panelRef.current?.contains(target)) return;

      event.preventDefault();
      event.stopPropagation();
      dismissFormatMenu();
    }

    document.addEventListener("keydown", handleFormatMenuEscape, true);
    return () => {
      document.removeEventListener("keydown", handleFormatMenuEscape, true);
    };
  }, [dismissFormatMenu, formatMenu]);

  const finalizePasteEditorState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    ensureBlockLines(editor);
    splitBlockLinesOnBreaks(editor);
    ensureTitleLine(editor);
    repairPastedEditorStructure(editor);
    renumberNumberedLines(editor);
    normalizeLinks(editor);
    syncEditorLineEmptyState(editor);
    syncEditorContent();
    syncTitleToTaskList();
    recordHistorySnapshot();
    requestSave("immediate");
    updateLineControls();
  }, [
    recordHistorySnapshot,
    requestSave,
    syncEditorContent,
    syncTitleToTaskList,
    updateLineControls,
  ]);

  const restoreSavedLinkSelection = useCallback(() => {
    const editor = editorRef.current;
    const savedRange = savedLinkSelectionRef.current;
    const selection = window.getSelection();

    if (!editor || !savedRange || !selection) return;

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }, []);

  const updateFormatMenu = useCallback(() => {
    if (showLinkMenuRef.current) return;

    if (
      openFormatDropdownRef.current ||
      openHeaderFormatDropdownRef.current ||
      openModalFormatDropdownRef.current
    ) {
      syncFormatMenuSelectionState();
      return;
    }

    const selection = window.getSelection();
    const editor = editorRef.current;

    if (!editor) {
      closeFormatMenu();
      return;
    }

    if (
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode) &&
      !selection.isCollapsed &&
      rangeIsWithinTitleLine(editor, selection.getRangeAt(0))
    ) {
      closeFormatMenu({ clearSavedSelection: true });
      syncHeaderClearFormattingState();
      return;
    }

    if (
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode) &&
      selection.isCollapsed
    ) {
      const link = getLinkFromSelection(selection, editor);
      if (link) {
        const linkLine = link.closest(`.${DETAIL_LINE_CLASS}`);
        if (
          linkLine instanceof HTMLElement &&
          isTitleLine(editor, linkLine)
        ) {
        closeFormatMenu();
        return;
      }

      const linkRect = link.getBoundingClientRect();
        const linkState = getLinkEditorState(editor, selection);
        savedLinkSelectionRef.current = selection.getRangeAt(0).cloneRange();
        setLinkText(linkState.text);
        setLinkUrl(linkState.url);
        setLinkHasExisting(linkState.hasExistingLink);
        showLinkMenuRef.current = true;
        setShowLinkMenu(true);
      setFormatMenu({
        x: linkRect.left + linkRect.width / 2,
          y: linkRect.top - FORMAT_MENU_ABOVE_SELECTION_GAP,
          alignLeft: false,
          placement: "above",
          anchorBottom: linkRect.bottom,
        });
        formatMenuVisibleRef.current = true;

        requestAnimationFrame(() => {
          linkUrlInputRef.current?.focus();
          linkUrlInputRef.current?.select();
        });

        rememberFormatSelection(editor, selection.getRangeAt(0));
        const fontState = getDetailSelectionFontState(editor);
        setFormatMenuFontSize(fontState.size);
        setFormatMenuFontFamily(fontState.familyId);
        setFormatMenuLineHeight(getDetailSelectionLineHeight(editor));
        setFormatMenuBlockType(getActiveTextBlockType(editor));
        setFormatMenuInlineFormats(getDetailSelectionInlineFormatState(editor));
        closeFormatDropdowns();
        return;
      }
    }

    const range = resolveFormatMenuRange(editor, null);
    if (!range || !rangeHasFormatableEditorContent(editor, range)) {
      const hasPendingSelection = editorHasLiveExtendedTextSelection(editor);
      const titleSelection =
        hasPendingSelection && editorSelectionIsWithinTitleLine(editor);
      syncHeaderClearFormattingState();
      closeFormatMenu({
        clearSavedSelection: !hasPendingSelection || titleSelection,
      });
      return;
    }

    rememberFormatSelection(editor, range);
    setShowLinkMenu(false);
    showLinkMenuRef.current = false;
    setFormatMenu(getFormatMenuPositionFromRange(range, editor));
    formatMenuVisibleRef.current = true;

    const fontState = getDetailSelectionFontState(editor);
    setFormatMenuFontSize(fontState.size);
    setFormatMenuFontFamily(fontState.familyId);
    setFormatMenuLineHeight(getDetailSelectionLineHeight(editor));
    setFormatMenuBlockType(getActiveTextBlockType(editor));
    setFormatMenuInlineFormats(getDetailSelectionInlineFormatState(editor));
    syncHeaderClearFormattingState();
    closeFormatDropdowns();
  }, [closeFormatDropdowns, closeFormatMenu, rememberFormatSelection, syncFormatMenuSelectionState, syncHeaderClearFormattingState]);

  const scheduleFormatMenuReveal = useCallback(() => {
    if (formatMenuRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(formatMenuRevealFrameRef.current);
    }
    if (formatMenuRevealTimerRef.current !== null) {
      window.clearTimeout(formatMenuRevealTimerRef.current);
      formatMenuRevealTimerRef.current = null;
    }
    if (formatMenuTimerRef.current !== null) {
      window.clearTimeout(formatMenuTimerRef.current);
      formatMenuTimerRef.current = null;
    }

    let attempt = 0;

    const runAttempt = () => {
      attempt += 1;
      const editor = editorRef.current;
      if (!editor) return;

      if (editorSelectionIsWithinTitleLine(editor)) {
        closeFormatMenu({ clearSavedSelection: true });
        return;
      }

      const liveRange = captureLiveEditorFormatSelection(editor);
      if (liveRange) {
        rememberFormatSelection(editor, liveRange);
      }

      updateFormatMenu();

      const resolvedRange = resolveFormatMenuRange(editor, null);
      const shouldHaveMenu = Boolean(
        resolvedRange &&
          rangeHasFormatableEditorContent(editor, resolvedRange),
      );

      if (shouldHaveMenu && !formatMenuVisibleRef.current && attempt < 5) {
        formatMenuRevealTimerRef.current = window.setTimeout(() => {
          formatMenuRevealTimerRef.current = null;
          runAttempt();
        }, attempt <= 1 ? 0 : 16);
      }
    };

    formatMenuRevealFrameRef.current = window.requestAnimationFrame(() => {
      formatMenuRevealFrameRef.current = null;
      runAttempt();
    });
  }, [closeFormatMenu, rememberFormatSelection, updateFormatMenu]);

  useEffect(() => {
    function handleDocumentMouseUp() {
      finishEditorPointerInteraction();
      scheduleFormatMenuReveal();
    }

    document.addEventListener("mouseup", handleDocumentMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleDocumentMouseUp);
    };
  }, [scheduleFormatMenuReveal]);

  const applyFormat = useCallback(
    (
      command:
        | "bold"
        | "italic"
        | "underline"
        | "strikeThrough"
        | "highlight"
        | "superscript"
        | "subscript",
    ) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      editor.focus();

      if (command === "highlight") {
        applyHighlight(editor, DEFAULT_HIGHLIGHT_COLOR);
      } else {
        document.execCommand(command, false);
      }

      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
    },
    [closeFormatMenu, recordHistorySnapshot, scheduleAutoSave, syncEditorContent],
  );

  const handleModalInlineFormatApply = useCallback(
    (command: "bold" | "italic" | "underline") => {
      captureFormatSelectionFromEditor();
      applyFormat(command);
      requestAnimationFrame(() => {
        syncFormatMenuSelectionState();
      });
    },
    [applyFormat, captureFormatSelectionFromEditor, syncFormatMenuSelectionState],
  );

  const clearFormatting = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) return;

    const savedRange =
      savedFormatSelectionRef.current?.cloneRange() ??
      captureLiveEditorFormatSelection(editor);

    if (!savedRange) {
      return;
    }

    const changedFormatting = stripFormattingInSelection(editor, savedRange);

    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode) &&
      !selection.isCollapsed
    ) {
      rememberFormatSelection(editor, selection.getRangeAt(0));
    }

    if (!changedFormatting) {
      syncHeaderClearFormattingState();
      return;
    }

    syncEditorLineEmptyState(editor);
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    closeFormatDropdowns();
    setFormatMenuBlockType(getActiveTextBlockType(editor));
    setFormatMenuInlineFormats(DEFAULT_FORMAT_MENU_INLINE_FORMATS);
    setFormatMenuLineHeight(
      normalizeDetailLineHeight(getDefaultDetailLineHeight()) as DetailLineHeightOption,
    );
    syncHeaderClearFormattingState();
    updateLineControls();
    window.requestAnimationFrame(() => {
      syncHeaderClearFormattingState();
    });
  }, [
    rememberFormatSelection,
    recordHistorySnapshot,
    scheduleAutoSave,
    syncEditorContent,
    closeFormatDropdowns,
    updateLineControls,
    syncHeaderClearFormattingState,
  ]);

  const openLinkMenu = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) return;

    if (selection && selection.rangeCount > 0) {
      savedLinkSelectionRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      savedLinkSelectionRef.current = null;
    }

    const state = getLinkEditorState(editor, selection);
    setLinkText(state.text);
    setLinkUrl(state.url);
    setLinkHasExisting(state.hasExistingLink);
    showLinkMenuRef.current = true;
    setShowLinkMenu(true);
    closeFormatDropdowns();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (selection.isCollapsed) {
        const link = getLinkFromSelection(selection, editor);
        if (link) {
          const linkRect = link.getBoundingClientRect();
          setFormatMenu({
            x: linkRect.left + linkRect.width / 2,
            y: linkRect.top - FORMAT_MENU_ABOVE_SELECTION_GAP,
            alignLeft: false,
            placement: "above",
            anchorBottom: linkRect.bottom,
          });
        }
      } else if (range.toString().trim()) {
        setFormatMenu(getFormatMenuPositionFromRange(range, editor));
      }
    }

    requestAnimationFrame(() => {
      linkUrlInputRef.current?.focus();
      linkUrlInputRef.current?.select();
    });
  }, []);

  const applyLink = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) return;

    if (!linkUrl.trim()) {
      closeFormatMenu();
      return;
    }

    editor.focus();
    restoreSavedLinkSelection();
    const displayText = linkText.trim() || linkUrl.trim();
    const applied = applyLinkToSelection(editor, linkUrl, displayText);
    if (!applied) return;

    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    closeFormatMenu();
  }, [
    closeFormatMenu,
    linkText,
    linkUrl,
    recordHistorySnapshot,
    restoreSavedLinkSelection,
    scheduleAutoSave,
    syncEditorContent,
  ]);

  const unlinkSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    restoreSavedLinkSelection();

    if (!removeLinkFromSelection(editor)) return;

    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    closeFormatMenu();
  }, [
    closeFormatMenu,
    recordHistorySnapshot,
    restoreSavedLinkSelection,
    scheduleAutoSave,
    syncEditorContent,
  ]);

  const applyTextColor = useCallback(
    (color: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      captureFormatSelectionFromEditor();
      const savedRange = savedFormatSelectionRef.current?.cloneRange() ?? null;

      editor.focus();
      if (
        savedRange &&
        editor.contains(savedRange.commonAncestorContainer)
      ) {
        restoreEditorSelectionRange(savedRange);
      }

      const resolvedColor = resolveTextColorOption(color);
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, resolvedColor);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      setRecentFormatColors((current) =>
        rememberRecentFormatColor(current, {
          kind: "text",
          color: resolvedColor,
          label:
            TEXT_COLOR_OPTIONS.find((option) =>
              colorsEquivalent(option.value, resolvedColor),
            )?.label ?? "Text color",
        }),
      );

      const selection = window.getSelection();
      if (
        selection?.rangeCount &&
        selection.anchorNode &&
        editor.contains(selection.anchorNode) &&
        !selection.isCollapsed
      ) {
        const range = selection.getRangeAt(0);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      closeFormatMenu({ clearSavedSelection: true });
    },
    [
      captureFormatSelectionFromEditor,
      closeFormatMenu,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
    ],
  );

  const applyHighlightColor = useCallback(
    (color: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      captureFormatSelectionFromEditor();
      const savedRange = savedFormatSelectionRef.current?.cloneRange() ?? null;

      editor.focus();
      if (
        savedRange &&
        editor.contains(savedRange.commonAncestorContainer)
      ) {
        restoreEditorSelectionRange(savedRange);
      }

      if (normalizeColorValue(color) === "#ffffff") {
        removeHighlightFromSelection(editor);
      } else {
        applyHighlight(editor, color);
      }

      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatDropdowns();

      const resolvedColor = resolveHighlightColorOption(color);
      const nextInlineFormats = getDetailSelectionInlineFormatState(editor);
      setFormatMenuInlineFormats(
        normalizeColorValue(color) === "#ffffff"
          ? nextInlineFormats
          : {
              ...nextInlineFormats,
              highlight: true,
              highlightColor: resolvedColor,
            },
      );

      if (normalizeColorValue(color) !== "#ffffff") {
        setRecentFormatColors((current) =>
          rememberRecentFormatColor(current, {
            kind: "highlight",
            color: resolvedColor,
            label:
              HIGHLIGHT_COLOR_OPTIONS.find((option) =>
                colorsEquivalent(option.value, resolvedColor),
              )?.label ?? "Highlight",
          }),
        );
      }
    },
    [
      captureFormatSelectionFromEditor,
      closeFormatDropdowns,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
    ],
  );

  const applyLineBlockType = useCallback(
    (type: "bullet" | "numbered" | "checklist") => {
      const editor = editorRef.current;
      if (!editor) return;

      splitBlockLinesOnBreaks(editor);

      editor.focus();

      const savedRange = savedFormatSelectionRef.current;
      const savedLineIds = savedFormatLineIdsRef.current;
      const selection = window.getSelection();
      if (savedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange.cloneRange());
      }

      const rangeToApply =
        selection?.rangeCount && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : savedRange?.cloneRange() ?? null;

      const selectedLinesFromIds = savedLineIds
        .map((lineId) => getLineById(editor, lineId))
        .filter((line): line is HTMLElement => line !== null);

      const selectedLinesFromRange = rangeToApply
        ? getSelectedBlockLinesInRange(editor, rangeToApply)
        : [];

      const selectedLineIds = new Set<string>();
      for (const line of [...selectedLinesFromIds, ...selectedLinesFromRange]) {
        if (line.dataset.lineId) {
          selectedLineIds.add(line.dataset.lineId);
        }
      }

      const selectedLines = getLineElements(editor).filter(
        (line) => line.dataset.lineId && selectedLineIds.has(line.dataset.lineId),
      );

      applyBlockTypeToSelection(
        editor,
        type,
        rangeToApply,
        selectedLines.length > 0 ? selectedLines : undefined,
      );
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
      updateLineControls();
    },
    [
      closeFormatMenu,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
      updateLineControls,
    ],
  );

  const restoreHistorySnapshot = useCallback(
    (index: number) => {
      const editor = editorRef.current;
      const html = historyRef.current[index];

      if (!editor || html === undefined) return;

      isApplyingHistoryRef.current = true;
      editor.innerHTML = html;
      ensureBlockLines(editor);
      ensureTitleLine(editor);
      syncEditorLineEmptyState(editor);
      historyIndexRef.current = index;
      previousTextRef.current = editor.textContent ?? "";
      syncEditorContent();
      syncTitleToTaskList();
      updateHistoryAvailability();
      updateLineControls();
      closeFormatMenu();
      setAddBlockMenu(null);
      setSlashCommandMenu(null);
      scheduleAutoSave();
      scheduleEditorHeightSync();

      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [
      closeFormatMenu,
      scheduleAutoSave,
      scheduleEditorHeightSync,
      syncEditorContent,
      syncTitleToTaskList,
      updateHistoryAvailability,
      updateLineControls,
    ],
  );

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    restoreHistorySnapshot(historyIndexRef.current - 1);
  }, [restoreHistorySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    restoreHistorySnapshot(historyIndexRef.current + 1);
  }, [restoreHistorySnapshot]);

  const applyRestoredTaskVersion = useCallback(
    async ({ name, details }: { name: string; details: string }) => {
      await flushSave();

      const currentTaskId = taskIdRef.current;
      if (!currentTaskId) return;

      const normalizedDetails = normalizeDetails(details);
      const editorHtml = buildEditorHtmlFromTask(name, normalizedDetails);

      savedDetailsRef.current = normalizedDetails;
      detailsRef.current = editorHtml;
      isLargeContentRef.current =
        normalizedDetails.length > LARGE_CONTENT_THRESHOLD ||
        editorHtml.length > LARGE_CONTENT_THRESHOLD;
      taskNameRef.current = name;
      syncedTitleRef.current = name;
      clearPendingLocalSave(currentTaskId);

      setTask((current) => {
        if (!current) return current;

        taskDetailsCache.set(currentTaskId, {
          id: currentTaskId,
          name,
          completed: current.completed,
          isNote: current.isNote,
          details: normalizedDetails,
          dueDate: current.dueDate,
          dueTimeMinutes: current.dueTimeMinutes,
          dueDurationMinutes: current.dueDurationMinutes,
          dueTimeZone: current.dueTimeZone,
          recurrenceRule: current.recurrenceRule,
        });

        return { ...current, name };
      });

      const editor = editorRef.current;
      if (editor && isReadyRef.current) {
        editor.innerHTML = editorHtml;
        ensureBlockLines(editor);
        ensureTitleLine(editor);
        syncEditorLineEmptyState(editor);
        detailsRef.current = normalizeDetails(editor.innerHTML);
        previousTextRef.current = editor.textContent ?? "";
        hydratedTaskIdRef.current = currentTaskId;
        resetHistory(readEditorContent());
        updateLineControls();
        scheduleEditorHeightSync();
      } else {
        hydratedTaskIdRef.current = null;
      }

      onDetailsSaved(currentTaskId, normalizedDetails);
      onTaskRenamed(currentTaskId, name);
      onTaskHasDetailsKnown?.(
        currentTaskId,
        taskDetailsHasContent(normalizedDetails),
      );

      saveStatusRef.current = "saved";
      setSaveStatus("saved");
      lastSaveCompletedAtRef.current = Date.now();
      setLastSavedAt(new Date());
      closeFormatMenu();
      setSlashCommandMenu(null);
    },
    [
      clearPendingLocalSave,
      closeFormatMenu,
      flushSave,
      onDetailsSaved,
      onTaskHasDetailsKnown,
      onTaskRenamed,
      readEditorContent,
      resetHistory,
      scheduleEditorHeightSync,
      updateLineControls,
    ],
  );

  useEffect(() => {
    setIsVersionHistoryOpen(false);
  }, [taskId]);

  useLayoutEffect(() => {
    if (!isReadyRef.current || !task?.id) return;

    const editor = editorRef.current;
    if (!editor) return;
    if (shouldDeferEditorStructureSync(editor)) return;

    const targetHtml = detailsRef.current;
    const editorHtml = normalizeDetails(editor.innerHTML);
    const normalizedTargetHtml = normalizeDetails(targetHtml);
    if (
      hydratedTaskIdRef.current === task.id &&
      editorHtml === normalizedTargetHtml
    ) {
      return;
    }

    editor.innerHTML = targetHtml;
    ensureBlockLines(editor);
    ensureTitleLine(editor);
    syncEditorLineEmptyState(editor);
    detailsRef.current = normalizeDetails(editor.innerHTML);
    previousTextRef.current = editor.textContent ?? "";
    hydratedTaskIdRef.current = task.id;
    resetHistory(readEditorContent());

    requestAnimationFrame(() => {
      updateLineControls();
      syncEditorHeight();
      if (task.isNote) {
        syncFormatMenuFontState();
      }
    });
  }, [
    readEditorContent,
    resetHistory,
    syncEditorHeight,
    syncFormatMenuFontState,
    task?.details,
    task?.id,
    task?.isNote,
    updateLineControls,
  ]);

  useLayoutEffect(() => {
    if (!task) return;

    scheduleEditorHeightSync();

    function handleViewportChange() {
      scheduleEditorHeightSync();
    }

    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);

    const resizeObserver = new ResizeObserver(() => {
      scheduleEditorHeightSync();
    });
    const contentRoot = panelRef.current?.querySelector(
      "[data-task-details-content]",
    );
    if (contentRoot instanceof HTMLElement) {
      resizeObserver.observe(contentRoot);
    }
    const subtasksSection = contentRoot?.querySelector(
      "[data-task-details-subtasks]",
    );
    if (subtasksSection instanceof HTMLElement) {
      resizeObserver.observe(subtasksSection);
    }
    const footer = panelRef.current?.querySelector("footer");
    if (footer instanceof HTMLElement) {
      resizeObserver.observe(footer);
    }

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      resizeObserver.disconnect();
    };
  }, [
    isModalLayout,
    scheduleEditorHeightSync,
    subtasks.length,
    task?.id,
  ]);

  useEffect(() => {
    if (!focusTaskTitleRequest) return;
    if (!applyFocusTaskTitleIfReady(focusTaskTitleRequest)) {
      pendingFocusTaskTitleRequestRef.current = focusTaskTitleRequest;
    }
  }, [applyFocusTaskTitleIfReady, focusTaskTitleRequest, task?.id]);

  useEffect(() => {
    if (!focusNoteAtEndRequest) return;
    if (focusNoteAtEndRequest === handledFocusNoteAtEndRequestRef.current) {
      return;
    }
    if (!isReadyRef.current || !editorRef.current || !taskId) return;
    if (hydratedTaskIdRef.current !== taskId) return;

    handledFocusNoteAtEndRequestRef.current = focusNoteAtEndRequest;

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;

      focusNoteAtEnd(editor);
      updateLineControls();
    });
  }, [focusNoteAtEndRequest, task?.id, taskId, updateLineControls]);

  useEffect(() => {
    if (!taskId || !taskSnapshot || !isReadyRef.current) return;
    if (taskId !== taskIdRef.current) return;

    syncExternalTaskName(taskSnapshot.name);

    if (isDateMenuOpen) return;

    setTask((current) => {
      if (!current) return current;

      const dueDateSame = current.dueDate === taskSnapshot.dueDate;
      const dueTimeSame =
        current.dueTimeMinutes === taskSnapshot.dueTimeMinutes &&
        current.dueDurationMinutes === taskSnapshot.dueDurationMinutes &&
        current.dueTimeZone === taskSnapshot.dueTimeZone;
      const recurrenceSame =
        current.recurrenceRule === taskSnapshot.recurrenceRule;

      if (dueDateSame && dueTimeSame && recurrenceSame) return current;

      return {
        ...current,
        dueDate: taskSnapshot.dueDate,
        dueTimeMinutes: taskSnapshot.dueTimeMinutes,
        dueDurationMinutes: taskSnapshot.dueDurationMinutes,
        dueTimeZone: taskSnapshot.dueTimeZone,
        recurrenceRule: taskSnapshot.recurrenceRule ?? null,
      };
    });
  }, [
    taskId,
    taskSnapshot?.name,
    taskSnapshot?.dueDate,
    taskSnapshot?.dueTimeMinutes,
    taskSnapshot?.dueDurationMinutes,
    taskSnapshot?.dueTimeZone,
    taskSnapshot?.recurrenceRule,
    isDateMenuOpen,
    syncExternalTaskName,
  ]);

  useEffect(() => {
    if (clipboardNoticeTimerRef.current !== null) {
      window.clearTimeout(clipboardNoticeTimerRef.current);
      clipboardNoticeTimerRef.current = null;
    }
    setShowClipboardNotice(false);
    setLastSavedAt(null);

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!taskId) {
      isReadyRef.current = false;
      hydratedTaskIdRef.current = null;
      detailsUserModifiedRef.current = false;
      setTask(null);
      savedDetailsRef.current = "";
      detailsRef.current = "";
      isLargeContentRef.current = false;
      taskNameRef.current = "";
      syncedTitleRef.current = "";
      previousTextRef.current = "";
      taskIdRef.current = null;
      saveStatusRef.current = "idle";
      setSaveStatus("idle");
      if (clipboardNoticeTimerRef.current !== null) {
        window.clearTimeout(clipboardNoticeTimerRef.current);
        clipboardNoticeTimerRef.current = null;
      }
      setShowClipboardNotice(false);
      setLastSavedAt(null);
      closeFormatMenu();
      setLineControls([]);
      setAddBlockMenu(null);
      setSlashCommandMenu(null);
      setIsDateMenuOpen(false);
      setCanUndo(false);
      setCanRedo(false);
      historyRef.current = [];
      historyIndexRef.current = -1;
      return;
    }

    let cancelled = false;
    saveAbortRef.current = false;
    taskLoadHandlersRef.current?.closeFormatMenu();
    setLineControls([]);
    setAddBlockMenu(null);
    setSlashCommandMenu(null);
    setIsDateMenuOpen(false);

    const pendingLocal = localPendingByTaskRef.current.get(taskId);
    const cachedTask = taskDetailsCache.get(taskId);
    const snapshot = taskSnapshotRef.current;

    if (cachedTask) {
      taskLoadHandlersRef.current?.hydrateFromTaskRecord(cachedTask, pendingLocal);
    } else if (snapshot) {
      taskLoadHandlersRef.current?.hydrateFromTaskRecord(
        buildTaskDetailsFromSnapshot(taskId, snapshot),
        pendingLocal,
      );
    } else {
    isReadyRef.current = false;
    hydratedTaskIdRef.current = null;
      setTask(null);
    setSaveStatus("loading");
    saveStatusRef.current = "loading";
    }

    void fetchTaskById(taskId)
      .then((loadedTask) => {
        if (cancelled || taskIdRef.current !== taskId) return;

        if (!loadedTask) {
          if (!cachedTask && !snapshot) {
          setTask(null);
          savedDetailsRef.current = "";
          detailsRef.current = "";
          previousTextRef.current = "";
          setSaveStatus("error");
          }
          return;
        }

        const latestPendingLocal = localPendingByTaskRef.current.get(taskId);
        taskLoadHandlersRef.current?.hydrateFromTaskRecord(
          {
          ...loadedTask,
          dueDate: loadedTask.dueDate
            ? new Date(loadedTask.dueDate).toISOString()
            : null,
          },
          latestPendingLocal,
        );
        taskLoadHandlersRef.current?.onTaskHasDetailsKnown?.(
          loadedTask.id,
          taskDetailsHasContent(
            resolveTaskDetailsForLoad(
              latestPendingLocal?.details,
              normalizeDetails(loadedTask.details),
            ),
          ),
        );
      })
      .catch(() => {
        if (!cancelled && !cachedTask && !snapshot) {
          isReadyRef.current = false;
          setSaveStatus("error");
        }
      });

    return () => {
      cancelled = true;
      saveAbortRef.current = true;
      saveQueuedRef.current = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const previousTaskId = taskIdRef.current;
      if (!previousTaskId) {
        isReadyRef.current = false;
        return;
      }

      const cleanupHandlers = taskLoadHandlersRef.current;
      const currentTask = taskStateRef.current;
      const snapshotForSwitch =
        cleanupHandlers?.captureTaskSnapshotForSwitch(previousTaskId) ?? {
          title: "",
          details: "",
        };
      const savedDetailsAtSwitch = savedDetailsRef.current;
      const taskNameAtSwitch = taskNameRef.current;

      if (currentTask || taskDetailsCache.has(previousTaskId)) {
        const existing = taskDetailsCache.get(previousTaskId);
        const detailsToCache =
          snapshotForSwitch.details !== savedDetailsAtSwitch
            ? snapshotForSwitch.details
            : savedDetailsAtSwitch;
        taskDetailsCache.set(previousTaskId, {
          id: previousTaskId,
          name: snapshotForSwitch.title || taskNameAtSwitch,
          completed: currentTask?.completed ?? existing?.completed ?? false,
          isNote: currentTask?.isNote ?? existing?.isNote ?? false,
          details: detailsToCache,
          dueDate: currentTask?.dueDate ?? existing?.dueDate ?? null,
          dueTimeMinutes:
            currentTask?.dueTimeMinutes ?? existing?.dueTimeMinutes ?? null,
          dueDurationMinutes:
            currentTask?.dueDurationMinutes ??
            existing?.dueDurationMinutes ??
            null,
          dueTimeZone: currentTask?.dueTimeZone ?? existing?.dueTimeZone ?? "UTC",
          recurrenceRule:
            currentTask?.recurrenceRule ?? existing?.recurrenceRule ?? null,
        });
      }

      isReadyRef.current = false;

      void (async () => {
        await cleanupHandlers?.waitForSaveIdle();

        const detailsToPersist = resolveTaskDetailsForSave(
          snapshotForSwitch.details,
          savedDetailsAtSwitch,
          { allowClear: detailsUserModifiedRef.current },
        );

        try {
          await cleanupHandlers?.persistTaskContent(
            previousTaskId,
            {
              title: snapshotForSwitch.title,
              details: detailsToPersist,
            },
            {
              details: savedDetailsAtSwitch,
              name: taskNameAtSwitch,
            },
          );
          } catch {
          if (detailsToPersist !== savedDetailsAtSwitch) {
              saveTaskDetailsKeepalive(previousTaskId, detailsToPersist);
          }
        }
      })();
    };
  }, [taskId]);

  useEffect(() => {
    function handlePageHide() {
      const currentTaskId = taskIdRef.current;
      if (!currentTaskId || !isReadyRef.current) return;

      const editorHtml = editorRef.current
        ? editorRef.current.innerHTML
        : detailsRef.current;
      const { title, details } = splitEditorContent(
        normalizeDetails(editorHtml),
      );
      const resolvedDetails = resolveTaskDetailsForSave(
        details,
        savedDetailsRef.current,
        { allowClear: detailsUserModifiedRef.current },
      );

      const detailsChanged = resolvedDetails !== savedDetailsRef.current;
      const titleChanged = Boolean(title) && title !== taskNameRef.current;

      if (!detailsChanged && !titleChanged) return;

      if (detailsChanged) {
        saveTaskDetailsKeepalive(currentTaskId, resolvedDetails);
      }

      if (titleChanged) {
        saveTaskNameKeepalive(currentTaskId, title);
      }
    }

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
      }

      if (lineControlsTimerRef.current !== null) {
        window.clearTimeout(lineControlsTimerRef.current);
      }

      if (titleSyncTimerRef.current !== null) {
        window.clearTimeout(titleSyncTimerRef.current);
      }

      if (inputNormalizeFrameRef.current !== null) {
        window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      }

      if (inputNormalizeTimerRef.current !== null) {
        window.clearTimeout(inputNormalizeTimerRef.current);
      }

      if (formatMenuTimerRef.current !== null) {
        window.clearTimeout(formatMenuTimerRef.current);
      }

      if (formatMenuRevealTimerRef.current !== null) {
        window.clearTimeout(formatMenuRevealTimerRef.current);
      }

      if (formatMenuRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(formatMenuRevealFrameRef.current);
      }

      if (clipboardNoticeTimerRef.current !== null) {
        window.clearTimeout(clipboardNoticeTimerRef.current);
      }

      if (dateMenuCloseTimerRef.current !== null) {
        window.clearTimeout(dateMenuCloseTimerRef.current);
      }

      document.removeEventListener("pointermove", handleDragMove);
      document.removeEventListener("pointerup", handleDragEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const targetElement = target instanceof Element ? target : null;
      const editor = editorRef.current;

      if (
        targetElement?.closest(
          "[data-task-date-picker-root], [data-task-date-picker-menu]",
        )
      ) {
        return;
      }

      if (editor && editor.contains(target) && !event.shiftKey && !isMultiClickMouseEvent(event)) {
        savedFormatSelectionRef.current = null;
        savedFormatLineIdsRef.current = [];
        if (formatMenuTimerRef.current !== null) {
          window.clearTimeout(formatMenuTimerRef.current);
          formatMenuTimerRef.current = null;
        }
        closeFormatMenu();

        if (editorHasLiveExtendedTextSelection(editor)) {
          collapseEditorSelectionAtPoint(editor, event.clientX, event.clientY);
        }
      }

      if (formatMenuRef.current?.contains(target)) {
        return;
      }

      if (headerFormatControlsRef.current?.contains(target)) {
        return;
      }

      if (headerFormatActionsRef.current?.contains(target)) {
        return;
      }

      if (!editor?.contains(target)) {
        closeFormatMenu();
      }

      if (lineControlsRef.current?.contains(target)) {
        return;
      }

      if (addBlockMenuRef.current?.contains(target)) {
        return;
      }

      if (slashCommandMenuRef.current?.contains(target)) {
        return;
      }

      if (dateMenuRef.current?.contains(target)) {
        return;
      }

      if (dateButtonRef.current?.contains(target)) {
        return;
      }

      setAddBlockMenu(null);
      setSlashCommandMenu(null);
      if (dateMenuCloseTimerRef.current !== null) {
        window.clearTimeout(dateMenuCloseTimerRef.current);
        dateMenuCloseTimerRef.current = null;
      }
      setIsDateMenuOpen(false);
      scheduleLineControlsUpdate();

      if (!panelRef.current?.contains(target)) {
        requestSave("immediate");
      }
    }

    function handleSelectionChange() {
      const editor = editorRef.current;

      if (isEditorPointerDownRef.current) {
        const pendingLine = pendingClickLineRef.current;
        if (
          editor &&
          pendingLine &&
          isEmptyEditableBodyLine(editor, pendingLine) &&
          editor.contains(pendingLine)
        ) {
        const selection = window.getSelection();
        if (
            selection?.isCollapsed &&
            !isCaretAtStartOfLine(pendingLine)
          ) {
            placeCaretInLine(pendingLine);
          }
        }
        return;
      }

      if (!editor) return;

      const selection = window.getSelection();
      const selectionInEditor =
        Boolean(selection?.rangeCount) &&
        ((selection?.anchorNode != null &&
          editor.contains(selection.anchorNode)) ||
          (selection?.focusNode != null &&
            editor.contains(selection.focusNode)));

      if (selectionInEditor) {
        if (!editorHasLiveExtendedTextSelection(editor)) {
          syncEditorLineEmptyState(editor);
        }

        setSlashCommandMenu((current) => {
          if (!current || !editor) return current;

          const activeLine = getActiveLineElement(editor);
          const activeLineId = activeLine?.dataset.lineId;
          if (activeLineId && activeLineId !== current.lineId) {
            return null;
          }

          return current;
        });

        if (editorSelectionIsWithinTitleLine(editor)) {
          closeFormatMenu({ clearSavedSelection: true });
          scheduleLineControlsUpdate();
          return;
        }

        const liveRange = captureLiveEditorFormatSelection(editor);
        if (liveRange) {
          rememberFormatSelection(editor, liveRange);
        }
      }

      if (!formatMenuRef.current?.contains(document.activeElement)) {
        if (formatMenuTimerRef.current !== null) {
          window.clearTimeout(formatMenuTimerRef.current);
        }

        const shouldShowFormatMenuImmediately =
          !isEditorPointerDownRef.current &&
          editorHasLiveExtendedTextSelection(editor);

        if (shouldShowFormatMenuImmediately) {
          formatMenuTimerRef.current = null;
          scheduleFormatMenuReveal();
        } else {
        formatMenuTimerRef.current = window.setTimeout(() => {
          formatMenuTimerRef.current = null;
            scheduleFormatMenuReveal();
        }, FORMAT_MENU_DEBOUNCE_MS);
        }
      }

      scheduleLineControlsUpdate();
    }

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [closeFormatMenu, rememberFormatSelection, requestSave, scheduleFormatMenuReveal, scheduleLineControlsUpdate]);

  useLayoutEffect(() => {
    if (!formatMenu || !formatMenuRef.current) return;

    const rect = formatMenuRef.current.getBoundingClientRect();
    const clamped = clampFormatMenuPosition(formatMenu, rect.width, rect.height);

    if (
      clamped.x !== formatMenu.x ||
      clamped.y !== formatMenu.y ||
      clamped.placement !== formatMenu.placement
    ) {
      setFormatMenu(clamped);
    }
  }, [
    formatMenu,
    openFormatDropdown,
    showLinkMenu,
  ]);

  useEffect(() => {
    if (!formatMenu) return;

    const editor = editorRef.current;
    const reposition = () => updateFormatMenu();

    editor?.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition, { passive: true });

    return () => {
      editor?.removeEventListener("scroll", reposition);
      window.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [formatMenu, updateFormatMenu]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!taskIdRef.current || !panelRef.current) return;

      const target = event.target as Node | null;
      if (!target || !panelRef.current.contains(target)) return;

      if (
        target instanceof HTMLElement &&
        target.matches("input[data-subtask-edit-input]")
      ) {
        return;
      }

      if (
        target instanceof HTMLElement &&
        (target.closest("[data-template-options-drawer]") ||
          target.closest("[data-template-color-popover]"))
      ) {
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (key === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (key === "k") {
        const editor = editorRef.current;
        const isEditorTarget =
          target === editor ||
          (editor instanceof HTMLElement && editor.contains(target));
        if (!isEditorTarget) return;

        event.preventDefault();
        openLinkMenu();
      }
    }

    document.addEventListener("keydown", handleShortcut, true);
    return () => document.removeEventListener("keydown", handleShortcut, true);
  }, [handleUndo, handleRedo, openLinkMenu]);

  function updateSlashCommandMenu() {
    const editor = editorRef.current;
    if (!editor) {
      setSlashCommandMenu(null);
      return;
    }

    const activeLine = getActiveLineElement(editor);
    if (
      !activeLine ||
      isTitleLine(editor, activeLine) ||
      isCodeLine(activeLine) ||
      activeLine.querySelector(".detail-image-wrapper")
    ) {
      setSlashCommandMenu(null);
      return;
    }

    const lineId = activeLine.dataset.lineId;
    if (!lineId) {
      setSlashCommandMenu(null);
      return;
    }

    const parsed = parseSlashCommand(getLinePlainText(activeLine));
    if (!parsed) {
      setSlashCommandMenu((current) => {
        if (
          current?.fromContextMenu &&
          current.lineId === lineId &&
          isDetailLineEmpty(activeLine)
        ) {
          const position = getSlashCommandMenuPosition(activeLine);
          return {
            ...current,
            top: position.top,
            left: position.left,
          };
        }

        return null;
      });
      return;
    }

    const filtered = getSlashCommandOptions(parsed.query);
    if (filtered.length === 0) {
      setSlashCommandMenu(null);
      return;
    }

    const position = getSlashCommandMenuPosition(activeLine);
    setSlashCommandMenu((current) => ({
      top: position.top,
      left: position.left,
      lineId,
      query: parsed.query,
      selectedIndex:
        current?.lineId === lineId && current.query === parsed.query
          ? Math.min(current.selectedIndex, filtered.length - 1)
          : 0,
    }));
  }

  function openSlashCommandMenuForLine(line: HTMLElement) {
    const editor = editorRef.current;
    if (!editor) return;

    const lineId = line.dataset.lineId;
    if (!lineId) return;

    activeLineControlsRef.current = line;
    focusDetailLine(editor, line);
    setAddBlockMenu(null);

    const position = getSlashCommandMenuPosition(line);
    setSlashCommandMenu({
      top: position.top,
      left: position.left,
      lineId,
      query: "",
      selectedIndex: 0,
      fromContextMenu: true,
    });
  }

  function cancelSlashCommand() {
    const editor = editorRef.current;
    if (editor && slashCommandMenu && !slashCommandMenu.fromContextMenu) {
      const line = getLineById(editor, slashCommandMenu.lineId);
      if (line && lineHasSlashCommand(line)) {
        clearSlashCommandText(line);
        placeCaretInLine(line);
        syncEditorContent();
        syncEditorLineEmptyState(editor);
      }
    }

    setSlashCommandMenu(null);
  }

  function handleApplySlashCommand(type: LineBlockType) {
    const editor = editorRef.current;
    if (!editor) return;

    const line = slashCommandMenu
      ? getLineById(editor, slashCommandMenu.lineId)
      : getActiveLineElement(editor);
    if (!line || isTitleLine(editor, line)) return;

    editor.focus();

    if (lineHasSlashCommand(line)) {
      clearSlashCommandText(line);

      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(line);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    applyBlockTypeToSelection(editor, type);
    setSlashCommandMenu(null);
    syncEditorContent();
    syncEditorLineEmptyState(editor);
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }

  function handleApplySlashLink() {
    const editor = editorRef.current;
    if (!editor) return;

    const line = slashCommandMenu
      ? getLineById(editor, slashCommandMenu.lineId)
      : getActiveLineElement(editor);
    if (!line || isTitleLine(editor, line) || isCodeLine(line)) return;

    editor.focus();

    if (lineHasSlashCommand(line)) {
      clearSlashCommandText(line);
    }

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(line);
      if (!getLinePlainText(line)) {
        range.collapse(true);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      savedLinkSelectionRef.current = range.cloneRange();
    }

    const state = getLinkEditorState(editor, selection);
    setLinkText(state.text);
    setLinkUrl(state.url);
    setLinkHasExisting(state.hasExistingLink);
    showLinkMenuRef.current = true;
    setShowLinkMenu(true);
    closeFormatDropdowns();
    setSlashCommandMenu(null);

    const lineRect = line.getBoundingClientRect();
    setFormatMenu({
      x: lineRect.left + lineRect.width / 2,
      y: lineRect.top - FORMAT_MENU_ABOVE_SELECTION_GAP,
      alignLeft: false,
      placement: "above",
      anchorBottom: lineRect.bottom,
    });

    syncEditorLineEmptyState(editor);

    requestAnimationFrame(() => {
      linkUrlInputRef.current?.focus();
      linkUrlInputRef.current?.select();
    });
  }

  function handleApplySlashCommandOption(option: SlashCommandOption) {
    if (option.kind === "link") {
      handleApplySlashLink();
      return;
    }

    handleApplySlashCommand(option.type);
  }

  function handleEditorInput() {
    if (editorRef.current && isReadyRef.current) {
      detailsUserModifiedRef.current = true;
      detailsRef.current = normalizeDetails(editorRef.current.innerHTML);
      rememberPendingLocalSave();
    }

    scheduleEditorHeightSync();
    scheduleInputNormalization();
    updateSlashCommandMenu();
  }

  async function insertImagesFromFiles(
    files: File[],
    referenceLine?: HTMLElement | null,
    options?: { fromClipboard?: boolean },
  ) {
    const editor = editorRef.current;
    const currentTaskId = taskIdRef.current;

    if (!editor || files.length === 0 || !currentTaskId) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    try {
      markSavePending();
      await waitForSaveIdle();

      const sources = await uploadImageFiles(currentTaskId, files);

      if (taskIdRef.current !== currentTaskId || !editorRef.current) {
        return;
      }

      await insertImagesIntoEditor(editor, sources, referenceLine, {
        fromClipboard: options?.fromClipboard,
      });
      syncEditorContent();
      recordHistorySnapshot();
      if (options?.fromClipboard) {
        showClipboardSaveNotice();
      }
      requestSave("immediate");
      updateLineControls();
      scheduleEditorHeightSync();
    } catch (error) {
      rememberPendingLocalSave();
      saveStatusRef.current = "error";
      setSaveStatus("error");
      setSaveErrorMessage(
        error instanceof Error && error.message.includes("too large")
          ? "Image is too large (max 8 MB)."
          : "Image upload failed.",
      );
      scheduleAutoSave();
    }
  }

  function writeEditorSelectionToClipboard(
    event: React.ClipboardEvent<HTMLDivElement>,
  ) {
    const editor = editorRef.current;
    if (!editor) return false;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return false;

    const range = selection.getRangeAt(0);
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) {
      return false;
    }

    const payload = serializeEditorSelectionForClipboard(editor, range);
    if (!payload) return false;

    event.preventDefault();
    event.clipboardData.setData("text/plain", payload.plainText);
    event.clipboardData.setData("text/html", payload.html);
    return true;
  }

  function handleEditorCopy(event: React.ClipboardEvent<HTMLDivElement>) {
    writeEditorSelectionToClipboard(event);
  }

  function handleEditorCut(event: React.ClipboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor || !writeEditorSelectionToClipboard(event)) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    selection.getRangeAt(0).deleteContents();
    syncEditorLineEmptyState(editor);
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }

  function handleEditorPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const savedPasteRange = captureEditorSelectionRange(editor);
    const activeLine = getActiveLineElement(editor);
    let plainText = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");

    if (plainText) {
      const clamped = clampPastePlainText(plainText);
      plainText = clamped.text;
      if (clamped.truncated) {
        showClipboardSaveNotice("Paste truncated to 512 KB");
      }
    }

    if (isTitleLine(editor, activeLine)) {
      event.preventDefault();
      if (!plainText && html) {
        const temp = document.createElement("div");
        temp.innerHTML = sanitizePastedHtml(html);
        plainText = temp.textContent ?? "";
      }
      if (!plainText) return;

      insertTitleLinePaste(editor, plainText);
      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    if (isCodeLine(activeLine)) {
      event.preventDefault();
      if (!plainText) return;

      editor.focus();
      if (savedPasteRange) {
        restoreEditorSelectionRange(savedPasteRange);
      }
      document.execCommand("insertText", false, plainText);
      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    const files = getImageFilesFromDataTransfer(event.clipboardData);
    if (files.length > 0) {
      event.preventDefault();
      void insertImagesFromFiles(files, activeLine, { fromClipboard: true });
      return;
    }

    const htmlHasListStructure = /<(ul|ol)\b/i.test(html);
    const htmlHasFormatting = Boolean(html) && pastedHtmlHasFormatting(html);
    const htmlIsDetailLinesClipboard = isDetailLinesClipboardHtml(html);

    if (
      plainText &&
      shouldPreferPlainTextPaste(plainText, html) &&
      !htmlHasListStructure &&
      !htmlHasFormatting &&
      !htmlIsDetailLinesClipboard
    ) {
      event.preventDefault();
      if (!insertPlainTextAtSelection(editor, plainText, savedPasteRange)) {
        editor.focus();
        if (savedPasteRange) {
          restoreEditorSelectionRange(savedPasteRange);
        }
        document.execCommand("insertText", false, plainText);
      }
      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    if (html && plainText && pastedHtmlHasFormatting(html)) {
      event.preventDefault();

      const currentTaskId = taskIdRef.current;

      void (async () => {
        let htmlToPaste = html;

        if (currentTaskId && html.includes("<img")) {
          try {
            saveStatusRef.current = "pending";
            setSaveStatus("pending");
            htmlToPaste = await uploadEmbeddedImagesInHtml(html, currentTaskId);
          } catch {
            htmlToPaste = html;
          }
        }

        const currentEditor = editorRef.current;
        if (!currentEditor || taskIdRef.current !== currentTaskId) return;

        currentEditor.focus();
        if (
          savedPasteRange &&
          currentEditor.contains(savedPasteRange.commonAncestorContainer)
        ) {
          restoreEditorSelectionRange(savedPasteRange);
        }

        if (
          !insertHtmlAtSelection(
            currentEditor,
            htmlToPaste,
            undefined,
            savedPasteRange,
            plainText,
          )
        ) {
          if (savedPasteRange) {
            restoreEditorSelectionRange(savedPasteRange);
          }
          document.execCommand("insertText", false, plainText);
        }

        requestAnimationFrame(() => {
          finalizePasteEditorState();
        });
      })();
      return;
    }

    if (html && plainText) {
      event.preventDefault();
      if (
        !insertHtmlAtSelection(
          editor,
          html,
          undefined,
          savedPasteRange,
          plainText,
        )
      ) {
        editor.focus();
        if (savedPasteRange) {
          restoreEditorSelectionRange(savedPasteRange);
        }
        document.execCommand("insertText", false, plainText);
      }

      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    if (plainText) {
      event.preventDefault();
      if (!insertPlainTextAtSelection(editor, plainText, savedPasteRange)) {
        editor.focus();
        if (savedPasteRange) {
          restoreEditorSelectionRange(savedPasteRange);
        }
        document.execCommand("insertText", false, plainText);
      }
      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    requestAnimationFrame(() => {
      finalizePasteEditorState();
    });
  }

  function handleEditorDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFilesInDataTransfer(event.dataTransfer)) return;

    event.preventDefault();
    imageDropDepthRef.current += 1;
    setIsImageDropActive(true);
  }

  function handleEditorDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFilesInDataTransfer(event.dataTransfer)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsImageDropActive(true);
  }

  function handleEditorDragLeave(event: React.DragEvent<HTMLDivElement>) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;

    imageDropDepthRef.current -= 1;
    if (imageDropDepthRef.current <= 0) {
      imageDropDepthRef.current = 0;
      setIsImageDropActive(false);
    }
  }

  function handleEditorDrop(event: React.DragEvent<HTMLDivElement>) {
    imageDropDepthRef.current = 0;
    setIsImageDropActive(false);

    const files = getImageFilesFromDataTransfer(event.dataTransfer);
    if (files.length === 0) return;

    event.preventDefault();

    const editor = editorRef.current;
    if (!editor) return;

    const targetLine = getLineElementAtPoint(editor, event.clientY);
    void insertImagesFromFiles(files, targetLine);
  }

  function handleEditorBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      (lineControlsRef.current?.contains(nextTarget) ||
        addBlockMenuRef.current?.contains(nextTarget) ||
        formatMenuRef.current?.contains(nextTarget) ||
        headerFormatControlsRef.current?.contains(nextTarget))
    ) {
      return;
    }

    const editor = editorRef.current;
    if (editor) {
      if (!editorHasLiveExtendedTextSelection(editor)) {
        syncEditorLineEmptyState(editor);
      }
    }

    if (inputNormalizeTimerRef.current !== null) {
      window.clearTimeout(inputNormalizeTimerRef.current);
      inputNormalizeTimerRef.current = null;
    }

    if (inputNormalizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      inputNormalizeFrameRef.current = null;
    }

    if (!editor || !editorHasLiveExtendedTextSelection(editor)) {
    runEditorNormalization("full");
    }

    flushHistorySnapshot();
    requestSave("immediate");
    scheduleLineControlsUpdate();
  }

  function handleEditorWrapperMouseMove(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const editor = editorRef.current;
    if (!editor || dragStateRef.current) return;

    if (!isEditorPointerDownRef.current) {
    ensureBlockLines(editor);
    }

    const line = getLineElementAtPoint(editor, event.clientY);
    hoveredLineRef.current = line;
    pointerInGutterRef.current = isPointerInLineControlsGutter(
      event.clientX,
      editor,
    );
    if (!shouldDeferEditorStructureSync(editor)) {
      syncEditorLineEmptyState(editor);
      updateLineControls();
    }
  }

  function handleEditorWrapperMouseEnter(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    isMouseOverEditorRef.current = true;

    const editor = editorRef.current;
    if (!editor || dragStateRef.current) return;

    hoveredLineRef.current = getLineElementAtPoint(editor, event.clientY);
    pointerInGutterRef.current = isPointerInLineControlsGutter(
      event.clientX,
      editor,
    );
    if (!shouldDeferEditorStructureSync(editor)) {
      syncEditorLineEmptyState(editor);
      updateLineControls();
    }
  }

  function handleEditorWrapperMouseLeave(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      (lineControlsRef.current?.contains(relatedTarget) ||
        addBlockMenuRef.current?.contains(relatedTarget) ||
        slashCommandMenuRef.current?.contains(relatedTarget))
    ) {
      return;
    }

    isMouseOverEditorRef.current = false;
    hoveredLineRef.current = null;
    pointerInGutterRef.current = false;
    const editor = editorRef.current;
    if (editor) {
      syncEditorLineEmptyState(editor);
    }
    updateLineControls();
  }

  function handleEditorFocus() {
    const editor = editorRef.current;
    const activeLine = editor ? getActiveLineElement(editor) : null;

    if (
      editor &&
      activeLine &&
      shouldPlaceCaretAtLineStart(editor, activeLine) &&
      !isEditorPointerDownRef.current
    ) {
      focusDetailLine(editor, activeLine);
    }

    if (editor && !shouldDeferEditorStructureSync(editor)) {
      syncEditorLineEmptyState(editor);
    }

    if (task?.isNote) {
      syncFormatMenuFontState();
    }

    updateLineControls();
  }

  function handleEditorDragStart(event: React.DragEvent<HTMLDivElement>) {
    // Prevent the browser from drag-moving selected contenteditable text.
    event.preventDefault();
  }

  function handleEditorMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const link = findDetailLinkFromTarget(event.target, editor);
    if (link) {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        openDetailLinkInNewTab(link);
      }
      return;
    }

    beginEditorPointerInteraction();

    const isMultiClick = isMultiClickMouseEvent(event);

    if (!event.shiftKey && !isMultiClick) {
      savedFormatSelectionRef.current = null;
      savedFormatLineIdsRef.current = [];
      if (formatMenuTimerRef.current !== null) {
        window.clearTimeout(formatMenuTimerRef.current);
        formatMenuTimerRef.current = null;
      }
      closeFormatMenu();

      if (editorHasLiveExtendedTextSelection(editor)) {
        collapseEditorSelectionAtPoint(editor, event.clientX, event.clientY);
      }
    }

    const hoverLine = getLineElementAtPoint(editor, event.clientY);
    if (hoverLine) {
      hoveredLineRef.current = hoverLine;
    }
    pointerInGutterRef.current = isPointerInLineControlsGutter(
      event.clientX,
      editor,
    );

    const clickResult = handleClickBelowLastLine(editor, event.clientY);
    if (clickResult) {
      if (clickResult === "inserted") {
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
      }
      syncEditorLineEmptyState(editor);
      const activeLine = getActiveLineElement(editor);
      if (activeLine && !isTitleLine(editor, activeLine)) {
        clickedLineRef.current = activeLine;
        pendingClickLineRef.current = activeLine;
      }
      updateLineControls();
      requestAnimationFrame(() => {
        updateLineControls();
      });
      return;
    }

    const line = getLineElementAtPoint(editor, event.clientY);
    if (!line || line.querySelector(".detail-image-wrapper") || isCodeLine(line)) {
      return;
    }

    if (isTitleLine(editor, line)) {
      return;
    }

    if (
      isListBlockLine(line) &&
      isEmptyEditableBodyLine(editor, line) &&
      !(isChecklistLine(line) && isChecklistToggleClick(line, event.clientX)) &&
      !event.shiftKey &&
      !isMultiClick
    ) {
      event.preventDefault();
      focusDetailLine(editor, line);
      clickedLineRef.current = line;
      pendingClickLineRef.current = line;
      updateLineControls();
      requestAnimationFrame(() => {
        updateLineControls();
      });
      return;
    }

    clickedLineRef.current = line;
    pendingClickLineRef.current = line;

    updateLineControls();
    requestAnimationFrame(() => {
      updateLineControls();
    });
  }

  function handlePlusClick(
    event: React.MouseEvent<HTMLButtonElement>,
    lineId: string,
  ) {
    event.stopPropagation();

    const editor = editorRef.current;
    if (!editor) return;

    const line = getLineById(editor, lineId);
    if (!line) return;

    activeLineControlsRef.current = line;

    if (isBodyPlaceholderLine(line)) {
      if (slashCommandMenu?.lineId === lineId) {
    setSlashCommandMenu(null);
      } else {
        openSlashCommandMenuForLine(line);
      }
      updateLineControls();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setSlashCommandMenu(null);
    setAddBlockMenu((current) =>
      current
        ? null
        : {
            top: rect.bottom + 4,
            left: rect.left,
          },
    );
  }

  function handleInsertBlockType(type: LineBlockType) {
    const editor = editorRef.current;
    if (!editor) return;

    const line =
      activeLineControlsRef.current ?? getActiveLineElement(editor);
    if (!line) return;

    insertTypedLineBelowLine(editor, line, type);
    hoveredLineRef.current = line;
    setAddBlockMenu(null);
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }

  function handleDragMove(event: PointerEvent) {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    const dragState = dragStateRef.current;

    if (!editor || !wrapper || !dragState) return;

    const lines = getLineElements(editor);
    const dropIndex = Math.max(
      1,
      getDropIndex(event.clientY, lines, dragState.sourceIndex),
    );
    dragState.dropIndex = dropIndex;

    const wrapperRect = wrapper.getBoundingClientRect();
    let indicatorTop: number;

    if (dropIndex >= lines.length) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;
      const rect = lastLine.getBoundingClientRect();
      indicatorTop = rect.bottom - wrapperRect.top;
    } else {
      const targetLine = lines[dropIndex];
      const rect = targetLine.getBoundingClientRect();
      indicatorTop = rect.top - wrapperRect.top;
    }

    setDropIndicator({ top: indicatorTop });
  }

  function handleDragEnd() {
    const editor = editorRef.current;
    const dragState = dragStateRef.current;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    dragState?.sourceLine.classList.remove("opacity-50");
    setDropIndicator(null);

    if (editor && dragState) {
      const changed = reorderLine(
        editor,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      if (changed) {
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
      }

      updateLineControls();
    }

    dragStateRef.current = null;
  }

  function beginLineReorderDrag(line: HTMLElement) {
    const editor = editorRef.current;
    if (!editor) return;

    ensureBlockLines(editor);

    const sourceIndex = getLineIndex(editor, line);
    if (sourceIndex <= 0) return;

    dragStateRef.current = {
      sourceLine: line,
      sourceIndex,
      dropIndex: sourceIndex,
    };

    line.classList.add("opacity-50");

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
  }

  function handleLineDragStart(
    event: React.PointerEvent<HTMLButtonElement>,
    lineId: string,
  ) {
    event.preventDefault();

    const editor = editorRef.current;
    if (!editor) return;

    const line = getLineById(editor, lineId);
    if (!line) return;

    activeLineControlsRef.current = line;
    beginLineReorderDrag(line);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "a" &&
      !event.shiftKey
    ) {
      const editor = editorRef.current;
      if (editor) {
        event.preventDefault();
        if (selectAllDetailEditorContent(editor)) {
          scheduleFormatMenuReveal();
        }
      }
      return;
    }

    if (slashCommandMenu) {
      const filtered = getSlashCommandOptions(slashCommandMenu.query);
      const selectedIndex = Math.min(
        slashCommandMenu.selectedIndex,
        Math.max(filtered.length - 1, 0),
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashCommandMenu((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.min(selectedIndex + 1, filtered.length - 1),
              }
            : null,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashCommandMenu((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.max(selectedIndex - 1, 0),
              }
            : null,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const option = filtered[selectedIndex];
        if (option) {
          handleApplySlashCommandOption(option);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cancelSlashCommand();
        return;
      }
    }

    if (event.key === "Escape" && formatMenu) {
      event.preventDefault();
      dismissFormatMenu();
      return;
    }

    if (
      (event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight") &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      const editor = editorRef.current;
      if (editor && editorHasLiveExtendedTextSelection(editor)) {
        savedFormatSelectionRef.current = null;
        savedFormatLineIdsRef.current = [];
        if (formatMenuTimerRef.current !== null) {
          window.clearTimeout(formatMenuTimerRef.current);
          formatMenuTimerRef.current = null;
        }
        closeFormatMenu({ clearSavedSelection: true });
      }
    }

    if (event.key === "Tab") {
      const editor = editorRef.current;
      if (!editor) return;

      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const listLines = getSelectedListBlockLines(
        editor,
        selection.getRangeAt(0),
      );
      if (listLines.length === 0) return;

      event.preventDefault();
      const delta = event.shiftKey ? -1 : 1;
      if (!indentListLines(editor, listLines, delta)) return;

      renumberNumberedLines(editor);
      syncEditorLineEmptyState(editor);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      updateLineControls();
      return;
    }

    if (event.key === "Backspace") {
      const editor = editorRef.current;
      if (!editor) return;

      if (removeLeadingEmptyBodyLineOnBackspace(editor)) {
        event.preventDefault();
        syncEditorLineEmptyState(editor);
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
        updateLineControls();
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (inputNormalizeTimerRef.current !== null) {
        window.clearTimeout(inputNormalizeTimerRef.current);
        inputNormalizeTimerRef.current = null;
      }
      if (inputNormalizeFrameRef.current !== null) {
        window.cancelAnimationFrame(inputNormalizeFrameRef.current);
        inputNormalizeFrameRef.current = null;
      }

      const editor = editorRef.current;
      if (!editor) return;

      let activeLine = getActiveLineElement(editor);
      if (!activeLine) {
        const lines = getLineElements(editor);
        const lastLine = lines[lines.length - 1];
        if (lastLine && isBodyPlaceholderLine(lastLine)) {
          activeLine = lastLine;
          placeCaretInLine(lastLine);
        }
      }
      if (!activeLine) return;

      if (isTitleLine(editor, activeLine)) {
        enterFromTitleLine(editor);
      } else if (isBodyPlaceholderLine(activeLine)) {
        insertLineBeforeBodyPlaceholder(editor, activeLine);
      } else {
      splitLineAtCursor(editor);
      }
      setSlashCommandMenu(null);
      syncEditorLineEmptyState(editor);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      updateLineControls();
      return;
    }
  }

  function handleEditorKeyUp() {
    if (formatMenuTimerRef.current !== null) {
      window.clearTimeout(formatMenuTimerRef.current);
    }

    formatMenuTimerRef.current = window.setTimeout(() => {
      formatMenuTimerRef.current = null;
      scheduleFormatMenuReveal();
    }, FORMAT_MENU_DEBOUNCE_MS);

    if (task?.isNote) {
      syncFormatMenuFontState();
    }

    scheduleLineControlsUpdate();
  }

  function handleEditorMouseUp() {
    const editor = editorRef.current;
    const pendingLine = pendingClickLineRef.current;
    pendingClickLineRef.current = null;

    finishEditorPointerInteraction();
    scheduleFormatMenuReveal();

    if (
      editor &&
      pendingLine &&
      !isTitleLine(editor, pendingLine) &&
      shouldPlaceCaretAtLineStart(editor, pendingLine) &&
      !editorHasLiveExtendedTextSelection(editor)
    ) {
      scheduleCaretAtLineStart(editor, pendingLine);
    }

    updateLineControls();
  }

  function handleEditorContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    setAddBlockMenu(null);
    setSlashCommandMenu(null);
    closeFormatMenu();

    const clickedLine = (event.target as HTMLElement).closest(".detail-line");
    if (clickedLine instanceof HTMLElement && isTitleLine(editor, clickedLine)) {
      event.preventDefault();
      return;
    }

    const activeLine =
      (clickedLine instanceof HTMLElement ? clickedLine : null) ??
      getActiveLineElement(editor) ??
      getLineElementAtPoint(editor, event.clientY);

    if (
      !activeLine ||
      isTitleLine(editor, activeLine) ||
      isCodeLine(activeLine) ||
      activeLine.querySelector(".detail-image-wrapper")
    ) {
      event.preventDefault();
    }
  }

  function handleEditorWrapperPointerDownCapture(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const target = event.target as HTMLElement;

    const handle = getImageResizeHandle(target);
    if (handle) {
      const wrapper = target.closest(".detail-image-wrapper");
      if (!(wrapper instanceof HTMLElement)) return;

      startImageResize(event.nativeEvent, handle, wrapper, () => {
        syncEditorContent();
        recordHistorySnapshot();
        requestSave("flush");
        scheduleEditorHeightSync();
      });
      return;
    }

    const dragTarget = getImageDragTarget(target);
    if (!dragTarget) return;

    const editor = editorRef.current;
    if (!editor) return;

    event.preventDefault();

    startImagePointerInteraction(
      event.nativeEvent,
      dragTarget.wrapper,
      dragTarget.line,
      editor,
      () => {
        syncEditorContent();
        recordHistorySnapshot();
        requestSave("flush");
        scheduleEditorHeightSync();
      },
    );
  }

  function handleEditorDoubleClick() {
    scheduleFormatMenuReveal();
    updateLineControls();
  }

  function handleEditorClick(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const clickedLine = (event.target as HTMLElement).closest(".detail-line");
    if (
      clickedLine instanceof HTMLElement &&
      isChecklistLine(clickedLine) &&
      isChecklistToggleClick(clickedLine, event.clientX)
    ) {
      event.preventDefault();
      toggleChecklistLine(clickedLine);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      return;
    }

    const link = findDetailLinkFromTarget(event.target, editor);
    if (link && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      openDetailLinkInNewTab(link);
      return;
    }

    const deleteButton = (event.target as HTMLElement).closest(
      ".detail-image-delete",
    );
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();

      const imageWrapper = deleteButton.closest(".detail-image-wrapper");
      if (!(imageWrapper instanceof HTMLElement)) return;

      const image = imageWrapper.querySelector("img.detail-image");
      const imageSrc =
        image instanceof HTMLImageElement ? image.getAttribute("src") ?? "" : "";
      const currentTaskId = taskIdRef.current;
      const imageFilename =
        currentTaskId && imageSrc
          ? extractTaskImageFilename(currentTaskId, imageSrc)
          : null;

      const removed = removeImageWrapper(editor, imageWrapper);
      if (!removed) return;

      syncEditorContent();
      recordHistorySnapshot();
      requestSave("flush");
      updateLineControls();

      if (currentTaskId && imageFilename) {
        void (async () => {
          await waitForSaveIdle();
          if (taskIdRef.current !== currentTaskId) return;
          try {
            await deleteUploadedTaskImage(currentTaskId, imageFilename);
          } catch {
            // File cleanup is best-effort; content save is the source of truth.
          }
        })();
      }
      return;
    }

    if (
      clickedLine instanceof HTMLElement &&
      !isTitleLine(editor, clickedLine) &&
      shouldPlaceCaretAtLineStart(editor, clickedLine)
    ) {
      scheduleCaretAtLineStart(editor, clickedLine);
    }

    if (task?.isNote) {
      syncFormatMenuFontState();
    }
  }

  function clearDateMenuCloseTimer() {
    if (dateMenuCloseTimerRef.current !== null) {
      window.clearTimeout(dateMenuCloseTimerRef.current);
      dateMenuCloseTimerRef.current = null;
    }
  }

  function openDateMenu() {
    if (!task) return;

    clearDateMenuCloseTimer();
    setIsDateMenuOpen(true);
  }

  function scheduleDateMenuClose() {
    if (isRecurrenceMenuOpenRef.current || isReminderMenuOpenRef.current) return;

    clearDateMenuCloseTimer();
    dateMenuCloseTimerRef.current = window.setTimeout(() => {
      dateMenuCloseTimerRef.current = null;
      setIsDateMenuOpen(false);
    }, TASK_DETAILS_DATE_MENU_HOVER_CLOSE_MS);
  }

  function isMovingWithinDateMenuSurface(relatedTarget: EventTarget | null) {
    if (!(relatedTarget instanceof Node)) return false;

    return (
      dateMenuRef.current?.contains(relatedTarget) === true ||
      dateButtonRef.current?.contains(relatedTarget) === true
    );
  }

  function handleDateMenuMouseLeave(event: React.MouseEvent) {
    if (isMovingWithinDateMenuSurface(event.relatedTarget)) return;

    dateMenuHoverDismissedRef.current = false;
    scheduleDateMenuClose();
  }

  function handleDatePickerMouseLeave(event: React.MouseEvent) {
    if (isMovingWithinDateMenuSurface(event.relatedTarget)) return;

    scheduleDateMenuClose();
  }

  function handleDateMenuMouseEnter() {
    if (dateMenuHoverDismissedRef.current) return;
    openDateMenu();
  }

  function handleDateButtonClick() {
    if (!task) return;

    clearDateMenuCloseTimer();
    setIsDateMenuOpen((open) => {
      if (open) {
        dateMenuHoverDismissedRef.current = true;
      }
      return !open;
    });
  }

  async function handleSelectDueDate(dateValue: string | null) {
    if (!task) return;

    try {
      const updated = await updateTaskDueDate(task.id, dateValue);
      const dueDate = updated.dueDate
        ? new Date(updated.dueDate).toISOString()
        : null;

      setTask((current) =>
        current
          ? {
              ...current,
              dueDate,
              dueTimeMinutes: updated.dueTimeMinutes,
              dueDurationMinutes: updated.dueDurationMinutes,
              dueTimeZone: updated.dueTimeZone,
            }
          : current,
      );
      onDueDateUpdated(task.id, dueDate, {
        dueTimeMinutes: updated.dueTimeMinutes,
        dueDurationMinutes: updated.dueDurationMinutes,
        dueTimeZone: updated.dueTimeZone,
      });
      if (dateValue === null) {
        clearDateMenuCloseTimer();
        setIsDateMenuOpen(false);
      }
      setMetadataError(null);
    } catch {
      setMetadataError("Could not update the due date.");
    }
  }

  async function handleSaveRecurrence(rule: TaskRecurrenceRule | null) {
    if (!task) return;

    try {
      if (onSaveTaskRecurrence) {
        await onSaveTaskRecurrence(task.id, rule);
      } else {
        const updated = await updateTaskRecurrence(task.id, rule);
        onRecurrenceUpdated?.(task.id, updated.recurrenceRule);
      }

      const nextRecurrenceRule = serializeRecurrenceRule(rule);
      invalidateTaskDetailsFetchCache(task.id);
      setTask((current) => {
        if (!current) return current;

        taskDetailsCache.set(task.id, {
          id: task.id,
          name: current.name,
          completed: current.completed,
          isNote: current.isNote,
          details: savedDetailsRef.current,
          dueDate: current.dueDate,
          dueTimeMinutes: current.dueTimeMinutes,
          dueDurationMinutes: current.dueDurationMinutes,
          dueTimeZone: current.dueTimeZone,
          recurrenceRule: nextRecurrenceRule,
        });

        return {
          ...current,
          recurrenceRule: nextRecurrenceRule,
        };
      });
      if (!onSaveTaskRecurrence) {
        onRecurrenceUpdated?.(task.id, nextRecurrenceRule);
      }
      setMetadataError(null);
    } catch {
      setMetadataError("Could not update repeat settings.");
    }
  }

  async function handleSaveDueTime(
    dueTime: TaskDueTime,
    options?: { keepOpen?: boolean },
  ) {
    if (!task) return;

    try {
      const updated = await updateTaskDueTime(task.id, dueTime);

      setTask((current) =>
        current
          ? {
              ...current,
              dueTimeMinutes: updated.dueTimeMinutes,
              dueDurationMinutes: updated.dueDurationMinutes,
              dueTimeZone: updated.dueTimeZone,
            }
          : current,
      );
      onDueDateUpdated(task.id, task.dueDate, {
        dueTimeMinutes: updated.dueTimeMinutes,
        dueDurationMinutes: updated.dueDurationMinutes,
        dueTimeZone: updated.dueTimeZone,
      });
      if (!options?.keepOpen) {
        clearDateMenuCloseTimer();
      setIsDateMenuOpen(false);
      }
      setMetadataError(null);
    } catch {
      setMetadataError("Could not update the due time.");
    }
  }

  const dueDateLabel = task ? formatDueDateLabel(task.dueDate) : null;
  const dueTimeLabel = task ? formatDueTimeLabel(task.dueTimeMinutes) : null;
  const showModalMarkComplete =
    isModalLayout &&
    Boolean(onToggleTask && task && !task.completed && !task.isNote);
  const showModalFormatToggle =
    isModalLayout &&
    Boolean(task && !task.isNote) &&
    !hideModalFormatToggle;

  function renderModalHeaderActions() {
    if (!isModalLayout || !task) return null;

    return (
      <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
        {showModalMarkComplete ? (
          <button
            type="button"
            onClick={() => onToggleTask?.(task.id)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#e6e9ec] bg-white py-[5px] pl-2 pr-[9px] text-[12px] font-normal text-[#454545] transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <LuCheck className="size-3.5 shrink-0" aria-hidden="true" />
            Mark complete
          </button>
        ) : null}

        {showModalFormatToggle ? (
          <>
            <button
              type="button"
              aria-label={
                isModalFormatToolbarOpen
                  ? "Hide formatting options"
                  : "Show formatting options"
              }
              aria-expanded={isModalFormatToolbarOpen}
              aria-pressed={isModalFormatToolbarOpen}
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleModalFormatToggle}
              className={`flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
                isModalFormatToolbarOpen
                  ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              <LuType className="size-[18px]" aria-hidden="true" />
            </button>

            {isModalFormatToolbarOpen ? (
              <div
                className="flex items-center gap-0.5 rounded-full bg-[#eceef0] px-1 py-0.5 dark:bg-zinc-800"
                onMouseDown={(event) => {
                  if (event.button !== 0) return;

                  const editor = editorRef.current;
                  if (!editor) return;

                  const selection = window.getSelection();
                  if (
                    selection?.rangeCount &&
                    !selection.isCollapsed &&
                    selection.anchorNode &&
                    editor.contains(selection.anchorNode)
                  ) {
                    rememberFormatSelection(editor, selection.getRangeAt(0));
                  } else {
                    captureFormatSelectionFromEditor();
                  }
                }}
              >
                <button
                  type="button"
                  aria-label="Bold"
                  aria-pressed={formatMenuInlineFormats.bold}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-full text-[15px] font-bold transition-colors ${
                    formatMenuInlineFormats.bold
                      ? "bg-[#c3eaff] text-[#2563eb] dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleModalInlineFormatApply("bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  aria-label="Italic"
                  aria-pressed={formatMenuInlineFormats.italic}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-full text-[15px] italic transition-colors ${
                    formatMenuInlineFormats.italic
                      ? "bg-[#c3eaff] text-[#2563eb] dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleModalInlineFormatApply("italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  aria-label="Underline"
                  aria-pressed={formatMenuInlineFormats.underline}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-full text-[15px] underline transition-colors ${
                    formatMenuInlineFormats.underline
                      ? "bg-[#c3eaff] text-[#2563eb] dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleModalInlineFormatApply("underline")}
                >
                  U
                </button>

                <span
                  className="mx-0.5 h-5 w-px shrink-0 bg-zinc-300 dark:bg-zinc-600"
                  aria-hidden="true"
                />

                <DetailFontFamilyControl
                  formatToolbar
                  value={formatMenuFontFamily}
                  open={openModalFormatDropdown === "family"}
                  onOpenChange={(open) =>
                    setModalFormatDropdownOpen("family", open)
                  }
                  onSelect={applyFormatFontFamily}
                />
                <DetailFontSizeControl
                  formatToolbar
                  value={formatMenuFontSize}
                  open={openModalFormatDropdown === "size"}
                  onOpenChange={(open) =>
                    setModalFormatDropdownOpen("size", open)
                  }
                  onSelect={applyFormatFontSize}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {onClose ? (
          <button
            type="button"
            aria-label="Close task editor"
            onClick={() => void onClose()}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LuX className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }

  function renderTaskDatePickerMenu() {
    if (!task || !isDateMenuOpen) return null;

    const datePickerMenu = (
      <div
        ref={dateMenuRef}
        data-task-date-picker-menu
        className={
          isModalLayout
            ? "fixed z-[110]"
            : "absolute left-0 top-full z-50 pt-1.5"
        }
        style={
          isModalLayout
            ? {
                top: dateMenuPosition?.top ?? 0,
                left: dateMenuPosition?.left ?? 0,
                visibility: dateMenuPosition ? "visible" : "hidden",
              }
            : undefined
        }
        onMouseEnter={clearDateMenuCloseTimer}
        onMouseLeave={handleDatePickerMouseLeave}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TaskDatePicker
          dueDate={task.dueDate}
          dueTimeMinutes={task.dueTimeMinutes}
          dueDurationMinutes={task.dueDurationMinutes}
          dueTimeZone={task.dueTimeZone}
          recurrenceRule={task.recurrenceRule}
          reminderOptionId={taskReminderOptionId}
          onSelectDate={(dateValue) => void handleSelectDueDate(dateValue)}
          onSaveDueTime={(dueTime, options) =>
            void handleSaveDueTime(dueTime, options)
          }
          onSaveRecurrence={(rule) => void handleSaveRecurrence(rule)}
          onSaveReminder={(optionId) => {
            if (!task) return;
            taskReminderByIdRef.current.set(task.id, optionId);
            setTaskReminderOptionId(optionId);
          }}
          onRecurrenceMenuOpenChange={(open) => {
            isRecurrenceMenuOpenRef.current = open;
            if (open) {
              clearDateMenuCloseTimer();
            }
          }}
          onReminderMenuOpenChange={(open) => {
            isReminderMenuOpenRef.current = open;
            if (open) {
              clearDateMenuCloseTimer();
            }
          }}
        />
      </div>
    );

    if (isModalLayout && typeof document !== "undefined") {
      return createPortal(datePickerMenu, document.body);
    }

    return datePickerMenu;
  }

  return (
    <section
      ref={panelRef}
      data-task-details-panel
      data-task-details-layout={layout}
      className={`task-details-panel-background relative flex min-w-[300px] flex-col ${
        isModalLayout ? "" : "min-h-0 flex-1"
      }`}
      aria-busy={saveStatus === "loading" ? true : undefined}
    >
      {renderModalHeaderActions()}
      <div
        className={`relative flex shrink-0 items-center justify-between overflow-visible px-2.5 pt-[6px] pb-[4px] ${
          isModalLayout
            ? isModalFormatToolbarOpen
              ? "pr-[22rem]"
              : "pr-48"
            : ""
        }`}
      >
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              aria-label="Back to task list"
              title="Back to task list"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            >
              <BiLeftArrowAlt className="size-6" />
            </button>
          ) : null}
          {taskId && saveStatus === "loading" && !task ? (
            <div className="flex items-center gap-3" aria-hidden="true">
              <div
                className={`h-[30px] w-[68px] rounded-full ${TASK_DETAILS_SKELETON_BAR_CLASS}`}
              />
              <span className="ml-2 text-[#cfcfcf]">|</span>
              <div className={`h-5 w-7 ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
              <div className={`h-5 w-7 ${TASK_DETAILS_SKELETON_BAR_CLASS}`} />
            </div>
          ) : task ? (
            <>
              <div
                className="relative"
                onMouseEnter={handleDateMenuMouseEnter}
                onMouseLeave={handleDateMenuMouseLeave}
              >
                <button
                  ref={dateButtonRef}
                  type="button"
                  aria-label={
                    dueDateLabel
                      ? `Due ${dueDateLabel}. Change date`
                      : "Set task date"
                  }
                  aria-haspopup="dialog"
                  aria-expanded={isDateMenuOpen}
                  onClick={handleDateButtonClick}
                  className={`flex cursor-pointer gap-[2px] rounded-full bg-[#eceef0] pl-3.5 pr-3 text-[12px] font-semibold uppercase tracking-wide text-zinc-600 transition-colors hover:bg-[#e0e2e5] dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 ${
                    isModalLayout
                      ? "h-[33px] items-center"
                      : dueDateLabel && dueTimeLabel
                        ? "items-start py-[7px]"
                        : dueDateLabel
                          ? "h-8 items-center"
                          : "items-center py-[7px]"
                  }`}
                >
                  <div
                    className={
                      dueDateLabel
                        ? `shrink-0 text-[12px] ${
                            dueTimeLabel ? "mb-[6px]" : ""
                          } ${isModalLayout ? "leading-none" : "leading-[13px]"}`
                        : undefined
                    }
                  >
                    Date
                  </div>
             
                  {dueDateLabel ? (
                    <div
                      className={`relative ml-px flex flex-col normal-case tracking-normal ${
                        dueTimeLabel
                          ? isModalLayout
                            ? "h-[17px] items-end justify-center"
                            : "mb-0 h-[17px] items-end"
                          : "items-center justify-center"
                      }`}
                      title={
                        dueTimeLabel
                          ? `${dueDateLabel} • ${dueTimeLabel}`
                          : dueDateLabel || undefined
                      }
                    >
                    <span 
                        className={`font-normal text-[#5F5F5F] dark:text-zinc-300 ${
                          isModalLayout
                            ? "text-[12px] leading-[12px]"
                            : "text-[13px] leading-[13px]"
                        }`}
                      >
                        {dueDateLabel}
                      </span>
                      {dueTimeLabel ? (
                        <div
                          className={
                            isModalLayout
                              ? "font-normal text-[#9f9f9f] text-[7px] leading-[7px] pt-[2px]!"
                              : "absolute -bottom-[5.5px] right-[2px] font-normal text-[#9f9f9f] text-[7px] leading-tight"
                          }
                        >
                          {dueTimeLabel}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <PlusIcon className="ml-1 size-3 text-[#5F5F5F]" />
                  )}
                </button>

                {renderTaskDatePickerMenu()}
              </div>
              <span className="text-[#cfcfcf] ml-2">|</span>
              <div
                ref={headerFormatActionsRef}
                className="flex items-center overflow-visible rounded"
              >
                <div className="group/undo relative">
                <button
                  type="button"
                  aria-label="Undo"
                    aria-describedby="task-details-undo-tooltip"
                  disabled={!canUndo}
                  onClick={handleUndo}
                    className={`flex h-10 rounded-full min-w-[2.25rem] items-center justify-center px-2.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:pointer-events-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                    canUndo ? "cursor-pointer" : "cursor-not-allowed"
                  } disabled:opacity-40`}
                >
                  <BiUndo className="size-[21px]" />
                </button>
                  <span
                    id="task-details-undo-tooltip"
                    role="tooltip"
                    className={`${TASK_DETAILS_TOOLTIP_CLASS} group-hover/undo:opacity-100`}
                  >
                    Undo
                  </span>
                </div>
                
                <div className="group/redo relative">
                <button
                  type="button"
                  aria-label="Redo"
                    aria-describedby="task-details-redo-tooltip"
                  disabled={!canRedo}
                  onClick={handleRedo}
                    className={`flex h-7 min-w-[2.25rem] items-center justify-center px-2.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:pointer-events-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                    canRedo ? "cursor-pointer" : "cursor-not-allowed"
                  } disabled:opacity-40`}
                >
                  <BiRedo className="size-[21px]" />
                </button>
                  <span
                    id="task-details-redo-tooltip"
                    role="tooltip"
                    className={`${TASK_DETAILS_TOOLTIP_CLASS} group-hover/redo:opacity-100`}
                  >
                    Redo
                  </span>
              </div>
                {showHeaderClearFormatting ? (
                  <div className="group/clear-format relative">
                    <button
                      type="button"
                      aria-label="Remove formatting"
                      aria-describedby="task-details-clear-formatting-tooltip"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        captureFormatSelectionFromEditor();
                        clearFormatting();
                      }}
                      className="flex h-10 min-w-[2.25rem] cursor-pointer items-center justify-center rounded-full px-2.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <LuRemoveFormatting className="size-[18px]" />
                    </button>
                    <span
                      id="task-details-clear-formatting-tooltip"
                      role="tooltip"
                      className={`${TASK_DETAILS_TOOLTIP_CLASS} group-hover/clear-format:opacity-100`}
                    >
                      Remove formatting
                    </span>
                  </div>
                ) : null}
                <div className="group/history relative">
                  <button
                    type="button"
                    aria-label="Version history"
                    aria-describedby="task-details-history-tooltip"
                    onClick={() => setIsVersionHistoryOpen(true)}
                    className="flex h-10 min-w-[2.25rem] cursor-pointer items-center justify-center px-1 text-slate-400 transition-colors rounded-full hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <LuHistory className="size-[16px] text-[#b6b6b6]" />
                  </button>
                  <span
                    id="task-details-history-tooltip"
                    role="tooltip"
                    className={`${TASK_DETAILS_TOOLTIP_CLASS} group-hover/history:opacity-100`}
                  >
                    Version history
                  </span>
                </div>
              </div>
              {task.isNote ? (
                <>
                  <span className="text-[#cfcfcf]" aria-hidden="true">
                    |
                  </span>
                  <div
                    ref={headerFormatControlsRef}
                    className="flex items-center gap-1"
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;

                      const editor = editorRef.current;
                      if (!editor) return;

                      const selection = window.getSelection();
                      if (
                        selection?.rangeCount &&
                        !selection.isCollapsed &&
                        selection.anchorNode &&
                        editor.contains(selection.anchorNode)
                      ) {
                        rememberFormatSelection(editor, selection.getRangeAt(0));
                      }
                    }}
                  >
                    <DetailFontFamilyControl
                      formatToolbar
                      value={formatMenuFontFamily}
                      open={openHeaderFormatDropdown === "family"}
                      onOpenChange={(open) =>
                        setHeaderFormatDropdownOpen("family", open)
                      }
                      onSelect={applyFormatFontFamily}
                    />
                    <span className="text-[#cfcfcf]" aria-hidden="true">
                      |
                    </span>
                    <DetailFontSizeControl
                      formatToolbar
                      value={formatMenuFontSize}
                      open={openHeaderFormatDropdown === "size"}
                      onOpenChange={(open) =>
                        setHeaderFormatDropdownOpen("size", open)
                      }
                      onSelect={applyFormatFontSize}
                    />
              </div>
                </>
              ) : null}
              {onToggleTask && !task.completed && !task.isNote && !isModalLayout ? (
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-full border border-[#e6e9ec] bg-white pl-2 pr-[9px] py-[5px] text-[12px] font-normal text-[#454545] transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <LuCheck className="size-3.5 shrink-0" aria-hidden="true" />
                  Mark complete
                </button>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Date
            </span>
          )}
        </div>
      </div>

      {taskId && saveStatus === "loading" && !task ? (
        <>
          <span className="sr-only">Loading task details</span>
          <TaskDetailsSkeleton />
        </>
      ) : task ? (
        <div
          data-task-details-content
          className={`flex flex-col px-4 ${
            isModalLayout ? "pb-0" : "min-h-0 flex-1 pb-[30px]"
          }`}
        >
          <div
            ref={editorWrapperRef}
            className="relative text-[#555555]"
            onMouseEnter={handleEditorWrapperMouseEnter}
            onMouseLeave={handleEditorWrapperMouseLeave}
            onMouseMove={handleEditorWrapperMouseMove}
            onDragEnter={handleEditorDragEnter}
            onDragOver={handleEditorDragOver}
            onDragLeave={handleEditorDragLeave}
            onDrop={handleEditorDrop}
            onPointerDownCapture={handleEditorWrapperPointerDownCapture}
          >
            {isImageDropActive && (
              <div className="pointer-events-none absolute inset-0 z-30 rounded-[30px] border-2 border-dashed border-blue-400 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20" />
            )}

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onCopy={handleEditorCopy}
              onCut={handleEditorCut}
              onPaste={handleEditorPaste}
              onDragStart={handleEditorDragStart}
              onBlur={handleEditorBlur}
              onFocus={handleEditorFocus}
              onMouseUp={handleEditorMouseUp}
              onContextMenu={handleEditorContextMenu}
              onMouseDown={handleEditorMouseDown}
              onDoubleClick={handleEditorDoubleClick}
              onClick={handleEditorClick}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={handleEditorKeyUp}
              onScroll={updateLineControls}
              className={`task-details-editor w-full resize-none rounded-xl pt-[13px] pl-[30px] pr-3 pb-4! text-[#555555] outline-none transition-colors dark:text-zinc-300 [&_.detail-line[data-line-type=bullet]]:pl-1 [&_.detail-line[data-line-type=checklist]]:cursor-pointer [&_.detail-line[data-line-type=checklist]]:pl-1 [&_.detail-line[data-line-type=h1]]:text-[26px] [&_.detail-line[data-line-type=h1]]:font-bold [&_.detail-line[data-line-type=h1]]:leading-[36px] [&_.detail-line[data-line-type=h1]]:text-[#4B4B4B] dark:[&_.detail-line[data-line-type=h1]]:text-[#F5F5F5] [&_.detail-line[data-line-type=h2]]:text-[23px] [&_.detail-line[data-line-type=h2]]:font-semibold [&_.detail-line[data-line-type=h2]]:leading-[30px] [&_.detail-line[data-line-type=h3]]:text-[19px] [&_.detail-line[data-line-type=h3]]:font-semibold [&_.detail-line[data-line-type=h3]]:leading-[26px] [&_.detail-line[data-line-type=numbered]]:pl-1 [&_mark]:bg-yellow-200 dark:[&_mark]:bg-yellow-300/30 [&_s]:line-through [&_strike]:line-through [&_u]:underline ${
                isModalLayout
                  ? "min-h-0 max-h-[min(60vh,560px)] overflow-auto"
                  : "min-h-[500px] overflow-auto"
              }`}
            />

            {dropIndicator && (
              <div
                className="pointer-events-none absolute right-3 left-10 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicator.top }}
              />
            )}

              <div
                ref={lineControlsRef}
                className="pointer-events-none absolute inset-0 z-10"
              >
              {lineControls.map(({ lineId, top, showPlus, showDrag }) => (
                  <div
                    key={lineId}
                    className="pointer-events-none absolute left-1 flex h-[1.75em] -translate-y-1/2 items-center"
                    style={{ top }}
                  >
                    {showPlus ? (
                    <button
                      type="button"
                      aria-label="Add block below"
                      title="Add block below"
                      aria-haspopup="menu"
                        aria-expanded={
                          addBlockMenu !== null ||
                          (slashCommandMenu?.lineId === lineId &&
                            slashCommandMenu.fromContextMenu)
                        }
                        className="pointer-events-auto flex size-[19px] cursor-grab items-center justify-center rounded rounded-lg px-[1px] py-[3px] text-zinc-350 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => handlePlusClick(event, lineId)}
                    >
                        <PlusIcon className="size-[21px]" />
                    </button>
                    ) : null}
                    {showDrag ? (
                    <button
                      type="button"
                      aria-label="Drag line"
                      title="Drag to reorder line"
                        className="pointer-events-auto flex w-[23px] h-[26px] cursor-grab items-center justify-center rounded-full px-[1px] py-[3px] mr-[2px] text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      onPointerDown={(event) =>
                        handleLineDragStart(event, lineId)
                      }
                    >
                      <InteractIcon className="size-4" />
                    </button>
                    ) : null}
                  </div>
                ))}
              </div>
          </div>

          {canManageSubtasks && onAddSubtask && onToggleTask && onDeleteSubtask ? (
            <div data-task-details-subtasks>
              <TaskDetailsSubtasksSection
                taskId={task.id}
                subtasks={subtasks}
                onAddSubtask={onAddSubtask}
                onToggleSubtask={onToggleTask}
                onRenameSubtask={onRenameSubtask ?? onTaskRenamed}
                onDeleteSubtask={onDeleteSubtask}
                onEditSubtask={onEditSubtask}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400">
          Select a task to view details
        </p>
      )}

      {addBlockMenu && (
        <div
          ref={addBlockMenuRef}
          role="menu"
          className={`fixed z-50 ${TASK_DETAILS_BLOCK_MENU_CLASS}`}
          style={{ top: addBlockMenu.top, left: addBlockMenu.left }}
        >
          {ADD_BLOCK_OPTIONS.map((option, index) => (
            <div key={option.type}>
              {index === TEXT_BLOCK_OPTIONS.length && (
                <div
                  role="separator"
                  className="my-1 border-t border-zinc-200 dark:border-zinc-700"
                />
              )}
              <button
                type="button"
                role="menuitem"
                className={TASK_DETAILS_BLOCK_MENU_ITEM_CLASS}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleInsertBlockType(option.type)}
              >
                <option.Icon className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                {option.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {slashCommandMenu && (() => {
        const filteredOptions = getSlashCommandOptions(slashCommandMenu.query);
        const selectedIndex = Math.min(
          slashCommandMenu.selectedIndex,
          Math.max(filteredOptions.length - 1, 0),
        );
        const blockOptionCount = filteredOptions.filter(
          (option) => option.kind === "block",
        ).length;
        const selectedOption = filteredOptions[selectedIndex];
        const previewType =
          selectedOption?.kind === "block" &&
          isSlashCommandPreviewBlockType(selectedOption.type)
            ? selectedOption.type
            : null;
        const previewTopOffset = previewType
          ? getSlashCommandPreviewTopOffset(
              selectedIndex,
              filteredOptions,
              !slashCommandMenu.query,
            )
          : 0;

        return (
          <div
            ref={slashCommandMenuRef}
            className="fixed z-50"
            style={{
              top: slashCommandMenu.top,
              left: slashCommandMenu.left,
            }}
          >
            {previewType ? (
              <div
                className="absolute left-full ml-2"
                style={{ top: previewTopOffset }}
              >
                <SlashCommandBlockPreview type={previewType} />
              </div>
            ) : null}
            <div
          role="menu"
              aria-label="Block type commands"
              className={TASK_DETAILS_BLOCK_MENU_CLASS}
          >
            {filteredOptions.map((option, index) => (
                <div key={option.kind === "link" ? "link" : option.type}>
                {!slashCommandMenu.query &&
                    option.kind === "block" &&
                  index === TEXT_BLOCK_OPTIONS.length && (
                    <div
                      role="separator"
                      className="my-1 border-t border-zinc-200 dark:border-zinc-700"
                    />
                  )}
                  {!slashCommandMenu.query &&
                    option.kind === "link" &&
                    blockOptionCount > 0 && (
                      <div
                        role="separator"
                        className="my-1 border-t border-zinc-200 dark:border-zinc-700"
                      />
                    )}
                <button
                  type="button"
                  role="menuitem"
                    className={`${TASK_DETAILS_BLOCK_MENU_ITEM_CLASS} ${
                    index === selectedIndex
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() =>
                    setSlashCommandMenu((current) =>
                      current ? { ...current, selectedIndex: index } : null,
                    )
                  }
                    onClick={() => handleApplySlashCommandOption(option)}
                >
                  <option.Icon className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  {option.label}
                </button>
              </div>
            ))}
        </div>
          </div>
        );
      })()}

      {formatMenu && (
        <div
          ref={formatMenuRef}
          className={getFormatToolbarPopoverClass(formatMenu)}
          style={{ left: formatMenu.x, top: formatMenu.y }}
        >
          <div
            className={FORMAT_TOOLBAR_SURFACE_CLASS}
            onMouseDownCapture={(event) => {
              if (event.button !== 0) return;
              captureFormatSelectionFromEditor();
            }}
        >
          {showLinkMenu ? (
            <div className="flex w-[min(280px,calc(100vw-2rem))] flex-col gap-2.5 p-2.5">
              <input
                ref={linkTextInputRef}
                type="text"
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                placeholder="Display text"
                aria-label="Link display text"
                className="w-full rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    dismissFormatMenu();
                  }
                }}
              />
              <input
                ref={linkUrlInputRef}
                type="text"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="Paste or type a link"
                aria-label="Link URL"
                className="w-full rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    dismissFormatMenu();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                  Cmd/Ctrl+click to open
                </p>
                <div className="flex items-center gap-1">
                  {linkHasExisting ? (
                  <button
                    type="button"
                      onClick={unlinkSelection}
                      className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Unlink
                  </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={applyLink}
                    className="rounded-full bg-[#4873c7] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3f68bd]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={FORMAT_TOOLBAR_ROW_CLASS}>
                <FormatToolbarTooltipWrap
                  label="Bold"
                  shortcut={getFormatToolbarShortcut("b")}
                  tooltipId="format-toolbar-bold-tooltip"
                >
                <button
                  type="button"
                  aria-label="Bold"
                    aria-pressed={formatMenuInlineFormats.bold}
                    aria-describedby="format-toolbar-bold-tooltip"
                    className={`${FORMAT_TOOLBAR_TEXT_BUTTON_CLASS} font-bold ${
                      formatMenuInlineFormats.bold
                        ? FORMAT_TOOLBAR_ACTIVE_BUTTON_CLASS
                        : ""
                    }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("bold")}
                >
                  B
                </button>
                </FormatToolbarTooltipWrap>
                <FormatToolbarTooltipWrap
                  label="Italic"
                  shortcut={getFormatToolbarShortcut("i")}
                  tooltipId="format-toolbar-italic-tooltip"
                >
                <button
                  type="button"
                  aria-label="Italic"
                    aria-pressed={formatMenuInlineFormats.italic}
                    aria-describedby="format-toolbar-italic-tooltip"
                    className={`${FORMAT_TOOLBAR_TEXT_BUTTON_CLASS} italic ${
                      formatMenuInlineFormats.italic
                        ? FORMAT_TOOLBAR_ACTIVE_BUTTON_CLASS
                        : ""
                    }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("italic")}
                >
                  I
                </button>
                </FormatToolbarTooltipWrap>
                <div aria-hidden="true" className={FORMAT_TOOLBAR_DIVIDER_CLASS} />

                <DetailFormatTextColorDropdown
                  open={openFormatDropdown === "textColor"}
                  onOpenChange={(open) =>
                    setFormatDropdownOpen("textColor", open)
                  }
                  selectedTextColor={formatMenuInlineFormats.textColor}
                  textColorOptions={TEXT_COLOR_OPTIONS}
                  onSelectTextColor={applyTextColor}
                  recentColors={recentFormatColors}
                  previewText={getFormatSelectionPreviewText(
                    savedFormatSelectionRef.current,
                  )}
                  previewTypography={getTextColorPreviewTypography(
                    formatMenuFontFamily,
                    formatMenuFontSize,
                    formatMenuLineHeight,
                  )}
                />

                <DetailFormatHighlightColorDropdown
                  open={openFormatDropdown === "highlight"}
                  onOpenChange={(open) =>
                    setFormatDropdownOpen("highlight", open)
                  }
                  selectedHighlightColor={formatMenuInlineFormats.highlightColor}
                  highlightColorOptions={HIGHLIGHT_COLOR_OPTIONS}
                  isHighlightActive={formatMenuInlineFormats.highlight}
                  onSelectHighlightColor={applyHighlightColor}
                  recentColors={recentFormatColors}
                />

                <div aria-hidden="true" className={FORMAT_TOOLBAR_DIVIDER_CLASS} />

                <DetailFormatListDropdown
                  open={openFormatDropdown === "list"}
                  onOpenChange={(open) => setFormatDropdownOpen("list", open)}
                  onSelect={applyLineBlockType}
                />

                <DetailFormatBlockTypeDropdown
                  open={openFormatDropdown === "block"}
                  onOpenChange={(open) => setFormatDropdownOpen("block", open)}
                  activeType={formatMenuBlockType}
                  onSelect={applyFormatBlockType}
                  isTypeDisabled={(type) => {
                    const editor = editorRef.current;
                    if (!editor) return true;

                    const line = getActiveLineElement(editor);
                    if (!line || isCodeLine(line)) return true;

                    return isTitleLine(editor, line) && type !== "h1";
                  }}
                />

                <DetailFormatFontFamilyDropdown
                  open={openFormatDropdown === "fontFamily"}
                  onOpenChange={(open) => {
                    setFormatDropdownOpen("fontFamily", open);
                    if (open) {
                      syncFormatMenuFontState();
                    }
                  }}
                  familyId={formatMenuFontFamily}
                  onSelectFamily={applyFormatFontFamily}
                />

                <DetailFormatFontSizeDropdown
                  open={openFormatDropdown === "fontSize"}
                  onOpenChange={(open) => {
                    setFormatDropdownOpen("fontSize", open);
                    if (open) {
                      syncFormatMenuFontState();
                    }
                  }}
                  size={formatMenuFontSize}
                  onSelectSize={applyFormatFontSize}
                />

                <div aria-hidden="true" className={FORMAT_TOOLBAR_DIVIDER_CLASS} />

                <FormatToolbarTooltipWrap
                  label="Add link (⌘K / Ctrl+K)"
                  tooltipId="format-toolbar-link-tooltip"
                >
                <button
                  type="button"
                  aria-label="Add link"
                    aria-describedby="format-toolbar-link-tooltip"
                  className={FORMAT_TOOLBAR_ICON_BUTTON_CLASS}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openLinkMenu}
                >
                    <BiLink className={FORMAT_TOOLBAR_ICON_SIZE_CLASS} />
                </button>
                </FormatToolbarTooltipWrap>

                <FormatToolbarTooltipWrap
                  label="Remove formatting"
                  tooltipId="format-toolbar-clear-tooltip"
                >
                  <button
                    type="button"
                    aria-label="Remove formatting"
                    aria-describedby="format-toolbar-clear-tooltip"
                    className={FORMAT_TOOLBAR_ICON_BUTTON_CLASS}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      clearFormatting();
                    }}
                  >
                    <LuRemoveFormatting
                      className={`${FORMAT_TOOLBAR_ICON_SIZE_CLASS} text-[#5e5e66] dark:text-[#ffffff] cursor-pointer`}
                  />
                  </button>
                </FormatToolbarTooltipWrap>

                <DetailFormatOverflowMenu
                  open={openFormatDropdown === "overflow"}
                  onOpenChange={(open) => {
                    setFormatDropdownOpen("overflow", open);
                    if (open) {
                      syncFormatMenuFontState();
                    }
                  }}
                  menuRef={formatOverflowMenuRef}
                  lineHeight={formatMenuLineHeight}
                  onSelectLineHeight={applyFormatLineHeight}
                  onUnderline={() => applyFormat("underline")}
                  onStrikethrough={() => applyFormat("strikeThrough")}
                  onSuperscript={() => applyFormat("superscript")}
                  onSubscript={() => applyFormat("subscript")}
                />
                </div>
            </>
          )}
          </div>
        </div>
      )}

      <TaskVersionHistoryOffcanvas
        open={isVersionHistoryOpen}
        taskId={taskId}
        onClose={() => setIsVersionHistoryOpen(false)}
        onRestore={applyRestoredTaskVersion}
      />

      {isModalLayout && task && modalFooterConfig ? (
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-100 px-[22px] py-2.5 dark:border-zinc-800">
          <TaskModalFooter taskId={task.id} {...modalFooterConfig} />
          {taskId &&
          saveStatus !== "loading" &&
          (saveStatus !== "idle" ||
            showClipboardNotice ||
            lastSavedAt !== null) ? (
            <div className="shrink-0">
              <span className="flex flex-wrap items-center justify-end gap-2 text-xs text-[#82828a] dark:text-[#acacb4]">
                {showClipboardNotice ? <span>{clipboardNoticeMessage}</span> : null}
                {metadataError ? (
                  <span className="text-red-600 dark:text-red-400">
                    {metadataError}
                  </span>
                ) : null}
                {saveStatus === "pending" ? <span>Unsaved changes</span> : null}
                {saveStatus === "error" ? (
                  <span className="pointer-events-auto flex items-center gap-2 text-red-600 dark:text-red-400">
                    <span>{saveErrorMessage ?? "Something went wrong"}</span>
                  <button
                    type="button"
                      onClick={() => void saveDetails()}
                      className="rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      Retry
                  </button>
                  </span>
                ) : null}
                {lastSavedAt && saveStatus === "saved" ? (
                  <span>Saved · {formatSaveTime(lastSavedAt)}</span>
                ) : null}
              </span>
              </div>
          ) : null}
        </footer>
      ) : null}

      {!isModalLayout &&
      taskId &&
      saveStatus !== "loading" &&
      (saveStatus !== "idle" ||
        showClipboardNotice ||
        lastSavedAt !== null) ? (
        <div className="pointer-events-none absolute bottom-3 right-4 z-10">
          <span className="flex flex-wrap items-center justify-end gap-2 text-xs text-[#82828a] dark:text-[#acacb4]">
            {showClipboardNotice ? <span>{clipboardNoticeMessage}</span> : null}
            {metadataError ? (
              <span className="text-red-600 dark:text-red-400">{metadataError}</span>
            ) : null}
            {saveStatus === "pending" ? <span>Unsaved changes</span> : null}
            {saveStatus === "error" ? (
              <span className="pointer-events-auto flex items-center gap-2 text-red-600 dark:text-red-400">
                <span>{saveErrorMessage ?? "Something went wrong"}</span>
                    <button
                      type="button"
                  onClick={() => void saveDetails()}
                  className="rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Retry
                </button>
              </span>
            ) : null}
            {lastSavedAt && saveStatus === "saved" ? (
              <span>Saved · {formatSaveTime(lastSavedAt)}</span>
            ) : null}
          </span>
                </div>
      ) : null}
    </section>
  );
}
