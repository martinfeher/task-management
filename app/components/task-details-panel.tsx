"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BiLink, BiLeftArrowAlt, BiRedo, BiUndo } from "react-icons/bi";
import { LuCheck, LuCode, LuHeading1, LuHeading2, LuHeading3, LuHighlighter, LuHistory, LuPilcrow, LuRemoveFormatting } from "react-icons/lu";
import { renameTask, updateTaskDueDate, updateTaskDueTime, updateTaskRecurrence } from "@/app/actions/todo";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import { serializeRecurrenceRule } from "@/lib/task-recurrence";
import { checkGrammar } from "@/lib/grammar-check-api";
import { fetchTaskById, saveTaskDetails, saveTaskDetailsKeepalive, saveTaskNameKeepalive } from "@/lib/task-details-api";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { formatShortDayMonthYear } from "@/lib/date-format";
import {
  formatDueTimeLabel,
  formatDurationLabel,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  applyBlockTypeToSelection,
  buildEditorHtmlFromTask,
  ensureBlockLines,
  ensureTitleLine,
  getActiveLineElement,
  getActiveTextBlockType,
  getDropIndex,
  getLineElementAtPoint,
  getLineById,
  getLineElements,
  getLineIndex,
  getSelectedBlockLinesInRange,
  handleClickBelowLastLine,
  insertImagesIntoEditor,
  insertTypedLineBelowLine,
  insertPlainTextAtSelection,
  isChecklistLine,
  isChecklistToggleClick,
  isCodeLine,
  isDetailLineEmpty,
  isTitleLine,
  type LineBlockType,
  placeCaretInLine,
  focusNoteAtEnd,
  focusTaskTitle,
  focusDetailLine,
  removeImageWrapper,
  reorderLine,
  getEditorTitle,
  splitEditorContent,
  splitBlockLinesOnBreaks,
  splitLineAtCursor,
  syncLineEmptyState,
  toggleChecklistLine,
} from "./detail-lines";
import {
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
  getLinkEditorState,
  getLinkFromSelection,
  normalizeLinks,
  removeLinkFromSelection,
} from "./detail-links";
import {
  applyDetailFontFamily,
  applyDetailFontSize,
  clearPasteBatchMarkers,
  DEFAULT_DETAIL_FONT_SIZE_PX,
  getDetailSelectionFontState,
  getPasteBatchPromptPosition,
  insertPasteFragmentAtSelection,
  PASTE_FORMAT_PROMPT_MS,
  pastedHtmlHasFormatting,
  preparePasteFragment,
  stripFormattingInPasteBatch,
  stripFormattingInSelection,
  type DetailFontFamilyId,
  type DetailFontSizeOption,
} from "./detail-fonts";
import {
  DetailFormatBlockTypeDropdown,
  DetailFormatColorDropdown,
  DetailFormatFontComboDropdown,
  DetailFormatListDropdown,
  DetailFormatOverflowMenu,
  type FormatToolbarDropdown,
} from "./detail-format-toolbar-menus";
import { GrammarCheckModal } from "./grammar-check-modal";
import { TaskDatePicker } from "./task-date-picker";
import { TaskVersionHistoryOffcanvas } from "./task-version-history-offcanvas";
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
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  recurrenceRule: string | null;
};

type TaskDetailsSnapshot = {
  name: string;
  completed: boolean;
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
  onRecurrenceUpdated?: (taskId: string, recurrenceRule: string | null) => void;
  onSaveTaskRecurrence?: (
    taskId: string,
    rule: TaskRecurrenceRule | null,
  ) => Promise<void>;
  onBack?: () => void;
};

type SaveStatus = "idle" | "loading" | "pending" | "saved" | "error";

type FormatMenuState = {
  x: number;
  y: number;
  alignLeft?: boolean;
  placement?: "above" | "below";
  anchorBottom?: number;
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

const FORMAT_TOOLBAR_CONTAINER_CLASS =
  "fixed z-50 -translate-y-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_8px_24px_rgba(0,0,0,0.32)]";

const FORMAT_TOOLBAR_ROW_CLASS = "flex items-center gap-0.5 px-1.5 py-1";

const FORMAT_TOOLBAR_TEXT_BUTTON_CLASS =
  "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800";

const FORMAT_TOOLBAR_ICON_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800";

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
const DEFAULT_TEXT_COLOR = "#444444";

const TEXT_COLOR_OPTIONS = [
  { label: "Default", value: DEFAULT_TEXT_COLOR },
  { label: "Red", value: "#db4035" },
  { label: "Orange", value: "#ff9933" },
  { label: "Yellow", value: "#b58900" },
  { label: "Green", value: "#299438" },
  { label: "Blue", value: "#246fe0" },
  { label: "Purple", value: "#884dff" },
  { label: "Pink", value: "#c855d6" },
] as const;

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

function isHighlightColor(color: string) {
  if (!color) return false;

  const normalized = color.toLowerCase().replace(/\s/g, "");
  return (
    normalized === HIGHLIGHT_COLOR ||
    normalized === "yellow" ||
    normalized === "rgb(254,240,138)" ||
    normalized === "rgba(254,240,138,1)"
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

      if (isHighlightColor(inlineBg) || isHighlightYellow(computedBg)) {
        return true;
      }
    }

    current = current.parentNode;
  }

  return false;
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
      isHighlightYellow(computedBg)
    ) {
      unwrapElement(element);
    }
  }
}

function applyHighlight(editor: HTMLElement) {
  if (selectionHasHighlight(editor)) {
    removeHighlightFromSelection(editor);
    return;
  }

  document.execCommand("styleWithCSS", false, "true");
  const applied = document.execCommand("hiliteColor", false, HIGHLIGHT_COLOR);
  if (!applied) {
    document.execCommand("backColor", false, HIGHLIGHT_COLOR);
  }
}

function getFormatMenuPositionFromRange(range: Range, editor: HTMLElement) {
  const selectedLines = getLineElements(editor).filter((line) =>
    range.intersectsNode(line),
  );
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

  return {
    x: alignLeft ? left : left + (right - left) / 2,
    y: top - 8,
    alignLeft,
    placement: "above" as const,
    anchorBottom:
      rects.length > 0
        ? Math.max(...rects.map((rect) => rect.bottom))
        : range.getBoundingClientRect().bottom,
  };
}

const FORMAT_MENU_VIEWPORT_PADDING = 8;

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
    y = (anchorBottom ?? y + menuHeight + 16) + 8;
  } else if (
    placement === "below" &&
    y + menuHeight > viewportHeight - FORMAT_MENU_VIEWPORT_PADDING
  ) {
    placement = "above";
    y = (anchorBottom ?? y) - 8;
  }

  return { x, y, alignLeft, placement, anchorBottom };
}

const TASK_DETAILS_SKELETON_BAR_CLASS =
  "task-details-skeleton-bar animate-pulse";

function TaskDetailsSkeleton() {
  return (
    <div className="flex flex-col px-4 pb-4" aria-hidden="true">
      <div className="min-h-[650px] rounded-xl bg-white py-3 pl-[60px] pr-3 dark:bg-zinc-950">
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
  registerSaveController,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
  onToggleTask,
  onRecurrenceUpdated,
  onSaveTaskRecurrence,
  onBack,
}: TaskDetailsPanelProps) {
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showClipboardNotice, setShowClipboardNotice] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [formatMenu, setFormatMenu] = useState<FormatMenuState | null>(null);
  const [lineControls, setLineControls] = useState<LineControlItem[]>([]);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const [addBlockMenu, setAddBlockMenu] = useState<AddBlockMenuState | null>(null);
  const [slashCommandMenu, setSlashCommandMenu] =
    useState<SlashCommandMenuState | null>(null);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [openFormatDropdown, setOpenFormatDropdown] =
    useState<FormatToolbarDropdown | null>(null);
  const [formatMenuFontSize, setFormatMenuFontSize] =
    useState<DetailFontSizeOption>(DEFAULT_DETAIL_FONT_SIZE_PX);
  const [formatMenuFontFamily, setFormatMenuFontFamily] =
    useState<DetailFontFamilyId>("sans-serif");
  const [formatMenuBlockType, setFormatMenuBlockType] =
    useState<TextBlockType>("text");
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkHasExisting, setLinkHasExisting] = useState(false);
  const [grammarModalOpen, setGrammarModalOpen] = useState(false);
  const [grammarOriginalText, setGrammarOriginalText] = useState("");
  const [grammarCorrectedText, setGrammarCorrectedText] = useState<string | null>(
    null,
  );
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [grammarError, setGrammarError] = useState<string | null>(null);
  const [pasteFormatPrompt, setPasteFormatPrompt] = useState<{
    pasteId: string;
    top: number;
    left: number;
    removeFormatting: boolean;
  } | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const savedDetailsRef = useRef("");
  const detailsRef = useRef("");
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
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const formatOverflowMenuRef = useRef<HTMLDivElement>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const linkTextInputRef = useRef<HTMLInputElement>(null);
  const savedLinkSelectionRef = useRef<Range | null>(null);
  const savedFormatSelectionRef = useRef<Range | null>(null);
  const savedFormatLineIdsRef = useRef<string[]>([]);
  const savedGrammarSelectionRef = useRef<Range | null>(null);
  const showLinkMenuRef = useRef(false);
  const addBlockMenuRef = useRef<HTMLDivElement>(null);
  const slashCommandMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const lineControlsRef = useRef<HTMLDivElement>(null);
  const hoveredLineRef = useRef<HTMLElement | null>(null);
  const clickedLineRef = useRef<HTMLElement | null>(null);
  const pendingClickLineRef = useRef<HTMLElement | null>(null);
  const activeLineControlsRef = useRef<HTMLElement | null>(null);
  const isMouseOverEditorRef = useRef(false);
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
  const pasteFormatPromptTimerRef = useRef<number | null>(null);
  const pasteFormatPromptRef = useRef(pasteFormatPrompt);
  const inputNormalizeFrameRef = useRef<number | null>(null);
  const inputNormalizeTimerRef = useRef<number | null>(null);
  const formatMenuTimerRef = useRef<number | null>(null);
  const lineControlsTimerRef = useRef<number | null>(null);
  const titleSyncTimerRef = useRef<number | null>(null);
  const clipboardNoticeTimerRef = useRef<number | null>(null);
  const localPendingByTaskRef = useRef<
    Map<string, { details: string; title: string }>
  >(new Map());

  const readEditorContent = useCallback(() => {
    return normalizeDetails(editorRef.current?.innerHTML ?? "");
  }, []);

  const readCurrentSplitContent = useCallback(() => {
    const editorHtml = readEditorContent();
    detailsRef.current = editorHtml;
    return splitEditorContent(editorHtml);
  }, [readEditorContent]);

  const rememberPendingLocalSave = useCallback(() => {
    const currentTaskId = taskIdRef.current;
    if (!currentTaskId || !isReadyRef.current) return;

    const { title, details } = readCurrentSplitContent();
    const titleChanged = Boolean(title) && title !== taskNameRef.current;

    if (details !== savedDetailsRef.current || titleChanged) {
      localPendingByTaskRef.current.set(currentTaskId, { details, title });
      return;
    }

    localPendingByTaskRef.current.delete(currentTaskId);
  }, [readCurrentSplitContent]);

  const captureTaskSnapshotForSwitch = useCallback((currentTaskId: string) => {
    if (editorRef.current) {
      detailsRef.current = normalizeDetails(editorRef.current.innerHTML);
    }

    const editorHtml = detailsRef.current;
    const { title, details } = splitEditorContent(editorHtml);

    if (
      taskDetailsHasContent(details) ||
      details !== savedDetailsRef.current ||
      (Boolean(title) && title !== taskNameRef.current)
    ) {
      localPendingByTaskRef.current.set(currentTaskId, { details, title });
    }

    return { title, details };
  }, []);

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
      savedDetailsRef.current = effectiveDetails;
      detailsRef.current = editorHtml;
      isLargeContentRef.current =
        effectiveDetails.length > LARGE_CONTENT_THRESHOLD ||
        editorHtml.length > LARGE_CONTENT_THRESHOLD;
      taskNameRef.current = effectiveName;
      syncedTitleRef.current = effectiveName;
      taskIdRef.current = loadedTask.id;
      isReadyRef.current = true;
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

      syncLineEmptyState(editor);
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

  const showClipboardSaveNotice = useCallback(() => {
    if (clipboardNoticeTimerRef.current !== null) {
      window.clearTimeout(clipboardNoticeTimerRef.current);
    }

    setShowClipboardNotice(true);
    clipboardNoticeTimerRef.current = window.setTimeout(() => {
      clipboardNoticeTimerRef.current = null;
      setShowClipboardNotice(false);
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

      const detailsChanged = content.details !== savedDetailsBaseline;
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
        const detailsBytes = new TextEncoder().encode(content.details).byteLength;
        if (detailsBytes > MAX_DETAILS_SAVE_BYTES) {
          saveStatusRef.current = "error";
          setSaveStatus("error");
          setSaveErrorMessage(
            "Content is too large to save (9 MB limit). Try removing images or shortening the note.",
          );
          return false;
        }

        await saveTaskDetails(taskId, content.details);

        if (taskIdRef.current === taskId) {
          savedDetailsRef.current = content.details;
        }
        clearPendingLocalSave(taskId);
        onDetailsSaved(taskId, content.details);
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
    [clearPendingLocalSave, onDetailsSaved, onTaskRenamed],
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

        const detailsChanged = content.details !== savedDetailsBaseline;
        const titleChanged = Boolean(
          content.title && content.title !== savedNameBaseline,
        );

        if (!detailsChanged && !titleChanged) break;

        await persistTaskContent(currentTaskId, content, {
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
        const stillDirty =
          latest.details !== savedDetailsRef.current ||
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

    let line: HTMLElement | null = null;
    const editorFocused = editor.contains(document.activeElement);
    const pendingLine = pendingClickLineRef.current;
    const activeLine = editorFocused ? getActiveLineElement(editor) : null;
    const hoveredLine =
      isMouseOverEditorRef.current &&
      hoveredLineRef.current &&
      editor.contains(hoveredLineRef.current)
        ? hoveredLineRef.current
        : null;

    if (addBlockMenu && activeLineControlsRef.current) {
      line = activeLineControlsRef.current;
    } else if (pendingLine && editor.contains(pendingLine)) {
      line = pendingLine;
      clickedLineRef.current = pendingLine;
    } else if (
      hoveredLine &&
      !isTitleLine(editor, hoveredLine) &&
      !hoveredLine.querySelector(".detail-image-wrapper") &&
      !isCodeLine(hoveredLine)
    ) {
      line = hoveredLine;
    } else if (editorFocused) {
      line = activeLine ?? clickedLineRef.current;
      if (line) {
        clickedLineRef.current = line;
      }
    } else if (clickedLineRef.current && editor.contains(clickedLineRef.current)) {
      line = clickedLineRef.current;
    } else {
      clickedLineRef.current = null;
      setLineControls([]);
      return;
    }

    if (!line || !editor.contains(line)) {
      setLineControls([]);
      return;
    }

    if (getLineIndex(editor, line) === 0) {
      setLineControls([]);
      return;
    }

    const lineId = line.dataset.lineId;
    if (!lineId) {
      setLineControls([]);
      return;
    }

    const position = getLineControlsPositionForLine(line, wrapper);
    if (!position) {
      setLineControls([]);
      return;
    }

    activeLineControlsRef.current = line;
    const isEmpty = isDetailLineEmpty(line);
    setLineControls([
      {
        lineId,
        top: position.top,
        showPlus: isEmpty,
        showDrag: !isEmpty,
      },
    ]);
  }, [addBlockMenu]);

  const applyFocusTaskTitleIfReady = useCallback(
    (requestId: number) => {
      if (!requestId) return false;
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
    [taskId, updateLineControls],
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

  const runEditorNormalization = useCallback(
    (mode: "light" | "full") => {
      const editor = editorRef.current;
      if (!editor) return;

      ensureBlockLines(editor);
      ensureTitleLine(editor);

      if (mode === "full") {
        splitBlockLinesOnBreaks(editor);
        normalizeLinks(editor);
        syncLineEmptyState(editor);
      }

      syncEditorContent();
      syncTitleToTaskList();
      scheduleHistorySnapshot();
      scheduleAutoSave();
      scheduleLineControlsUpdate();
    },
    [
      scheduleAutoSave,
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
  }, []);

  const setFormatDropdownOpen = useCallback(
    (dropdown: FormatToolbarDropdown, open: boolean) => {
      setOpenFormatDropdown(open ? dropdown : null);
    },
    [],
  );

  const closeFormatMenu = useCallback(() => {
    setFormatMenu(null);
    closeFormatDropdowns();
    setShowLinkMenu(false);
    showLinkMenuRef.current = false;
    setLinkHasExisting(false);
    savedLinkSelectionRef.current = null;
    savedFormatSelectionRef.current = null;
    savedFormatLineIdsRef.current = [];
  }, [closeFormatDropdowns]);

  const rememberFormatSelection = useCallback(
    (editor: HTMLElement, range: Range) => {
      savedFormatSelectionRef.current = range.cloneRange();
      savedFormatLineIdsRef.current = getSelectedBlockLinesInRange(editor, range)
        .map((line) => line.dataset.lineId)
        .filter((lineId): lineId is string => Boolean(lineId));
    },
    [],
  );

  const handleDetailFontApplied = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      syncLineEmptyState(editor);
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

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      if (applyDetailFontSize(editor, size, savedFormatSelectionRef.current)) {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
          rememberFormatSelection(editor, selection.getRangeAt(0));
        }
        setFormatMenuFontSize(size);
        handleDetailFontApplied();
      }

      closeFormatDropdowns();
    },
    [closeFormatDropdowns, handleDetailFontApplied, rememberFormatSelection],
  );

  const applyFormatFontFamily = useCallback(
    (familyId: DetailFontFamilyId) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      if (
        applyDetailFontFamily(
          editor,
          familyId,
          savedFormatSelectionRef.current,
        )
      ) {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
          rememberFormatSelection(editor, selection.getRangeAt(0));
        }
        setFormatMenuFontFamily(familyId);
        handleDetailFontApplied();
      }
    },
    [handleDetailFontApplied, rememberFormatSelection],
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
      syncLineEmptyState(editor);
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
    pasteFormatPromptRef.current = pasteFormatPrompt;
  }, [pasteFormatPrompt]);

  const dismissPasteFormatPrompt = useCallback((pasteId?: string) => {
    if (pasteFormatPromptTimerRef.current !== null) {
      window.clearTimeout(pasteFormatPromptTimerRef.current);
      pasteFormatPromptTimerRef.current = null;
    }

    const editor = editorRef.current;
    const idToClear = pasteId ?? pasteFormatPromptRef.current?.pasteId;
    if (editor && idToClear) {
      clearPasteBatchMarkers(editor, idToClear);
    }

    setPasteFormatPrompt(null);
  }, []);

  const getPastePromptPosition = useCallback((pasteId: string) => {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    if (!editor || !wrapper) {
      return { top: 12, left: 12 };
    }

    return getPasteBatchPromptPosition(editor, wrapper, pasteId);
  }, []);

  const showPasteFormatPrompt = useCallback(
    (pasteId: string) => {
      dismissPasteFormatPrompt();

      const position = getPastePromptPosition(pasteId);
      setPasteFormatPrompt({
        pasteId,
        top: position.top,
        left: position.left,
        removeFormatting: false,
      });

      pasteFormatPromptTimerRef.current = window.setTimeout(() => {
        dismissPasteFormatPrompt(pasteId);
      }, PASTE_FORMAT_PROMPT_MS);
    },
    [dismissPasteFormatPrompt, getPastePromptPosition],
  );

  useEffect(() => {
    if (!pasteFormatPrompt) return;

    function handlePastePromptEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      dismissPasteFormatPrompt();
    }

    document.addEventListener("keydown", handlePastePromptEscape);
    return () => {
      document.removeEventListener("keydown", handlePastePromptEscape);
    };
  }, [dismissPasteFormatPrompt, pasteFormatPrompt]);

  const finalizePasteEditorState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    ensureBlockLines(editor);
    splitBlockLinesOnBreaks(editor);
    ensureTitleLine(editor);
    normalizeLinks(editor);
    syncLineEmptyState(editor);
    syncEditorContent();
    syncTitleToTaskList();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }, [
    recordHistorySnapshot,
    scheduleAutoSave,
    syncEditorContent,
    syncTitleToTaskList,
    updateLineControls,
  ]);

  const applyPasteFormatOption = useCallback(
    (enabled: boolean) => {
      const editor = editorRef.current;
      const current = pasteFormatPromptRef.current;
      if (!editor || !current) return;

      const pasteId = current.pasteId;

      requestAnimationFrame(() => {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;

        if (enabled) {
          stripFormattingInPasteBatch(currentEditor, pasteId);
        }

        ensureBlockLines(currentEditor);
        syncLineEmptyState(currentEditor);
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
        dismissPasteFormatPrompt(pasteId);
      });
    },
    [
      dismissPasteFormatPrompt,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
    ],
  );

  useEffect(() => {
    return () => {
      if (pasteFormatPromptTimerRef.current !== null) {
        window.clearTimeout(pasteFormatPromptTimerRef.current);
      }
    };
  }, []);

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

    const selection = window.getSelection();
    const editor = editorRef.current;

    if (!selection || !editor || !editor.contains(selection.anchorNode)) {
      closeFormatMenu();
      return;
    }

    const activeLine = getActiveLineElement(editor);
    if (isTitleLine(editor, activeLine)) {
      closeFormatMenu();
      return;
    }

    if (selection.isCollapsed) {
      const link = getLinkFromSelection(selection, editor);
      if (!link) {
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
        y: linkRect.top - 8,
        alignLeft: false,
        placement: "above",
        anchorBottom: linkRect.bottom,
      });

      requestAnimationFrame(() => {
        linkUrlInputRef.current?.focus();
        linkUrlInputRef.current?.select();
      });
    } else {
      const range = selection.getRangeAt(0);
      if (!range.toString().trim()) {
        closeFormatMenu();
        return;
      }

      const position = getFormatMenuPositionFromRange(range, editor);
      setFormatMenu(position);
    }

    rememberFormatSelection(editor, selection.getRangeAt(0));
    const fontState = getDetailSelectionFontState(editor);
    setFormatMenuFontSize(fontState.size);
    setFormatMenuFontFamily(fontState.familyId);
    setFormatMenuBlockType(getActiveTextBlockType(editor));
    closeFormatDropdowns();
  }, [closeFormatDropdowns, rememberFormatSelection]);

  const applyFormat = useCallback(
    (command: "bold" | "italic" | "underline" | "strikeThrough" | "highlight") => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      editor.focus();

      if (command === "highlight") {
        applyHighlight(editor);
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

  const clearFormatting = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) return;

    if (
      !stripFormattingInSelection(editor, savedFormatSelectionRef.current)
    ) {
      return;
    }

    syncLineEmptyState(editor);
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    closeFormatDropdowns();
    if (editor) {
      setFormatMenuBlockType(getActiveTextBlockType(editor));
    }
    updateLineControls();
  }, [
    recordHistorySnapshot,
    scheduleAutoSave,
    syncEditorContent,
    closeFormatDropdowns,
    updateLineControls,
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
            y: linkRect.top - 8,
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
      if (state.hasExistingLink || state.text) {
        linkTextInputRef.current?.focus();
        linkTextInputRef.current?.select();
        return;
      }

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

  const runGrammarCheck = useCallback(async () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const activeLine = getActiveLineElement(editor);
    if (
      isCodeLine(activeLine) ||
      activeLine?.querySelector(".detail-image-wrapper")
    ) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    savedGrammarSelectionRef.current = selection.getRangeAt(0).cloneRange();
    setGrammarOriginalText(selectedText);
    setGrammarCorrectedText(null);
    setGrammarError(null);
    setGrammarLoading(true);
    setGrammarModalOpen(true);
    closeFormatMenu();

    try {
      const corrected = await checkGrammar(selectedText);
      setGrammarCorrectedText(corrected);
    } catch (error) {
      setGrammarError(
        error instanceof Error ? error.message : "Failed to check grammar",
      );
    } finally {
      setGrammarLoading(false);
    }
  }, [closeFormatMenu]);

  const applyGrammarCorrection = useCallback(() => {
    const editor = editorRef.current;
    const correctedText = grammarCorrectedText;
    const savedRange = savedGrammarSelectionRef.current;
    const selection = window.getSelection();

    if (!editor || !correctedText || !savedRange || !selection) return;

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    document.execCommand("insertText", false, correctedText);

    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    setGrammarModalOpen(false);
    savedGrammarSelectionRef.current = null;
  }, [
    grammarCorrectedText,
    recordHistorySnapshot,
    scheduleAutoSave,
    syncEditorContent,
  ]);

  const applyTextColor = useCallback(
    (color: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      editor.focus();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, color);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
    },
    [closeFormatMenu, recordHistorySnapshot, scheduleAutoSave, syncEditorContent],
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

      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [
      closeFormatMenu,
      scheduleAutoSave,
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
        syncLineEmptyState(editor);
        previousTextRef.current = editor.textContent ?? "";
        hydratedTaskIdRef.current = currentTaskId;
        resetHistory(readEditorContent());
        updateLineControls();
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
      updateLineControls,
    ],
  );

  useEffect(() => {
    setIsVersionHistoryOpen(false);
  }, [taskId]);

  useLayoutEffect(() => {
    if (!isReadyRef.current || !task?.id) return;
    if (hydratedTaskIdRef.current === task.id) return;

    const editor = editorRef.current;
    if (!editor) return;

    editor.innerHTML = detailsRef.current;
    ensureBlockLines(editor);
    ensureTitleLine(editor);
    syncLineEmptyState(editor);
    previousTextRef.current = editor.textContent ?? "";
    hydratedTaskIdRef.current = task.id;
    resetHistory(readEditorContent());

    requestAnimationFrame(() => {
      updateLineControls();
      const pendingFocusRequest = pendingFocusTaskTitleRequestRef.current;
      if (pendingFocusRequest) {
        applyFocusTaskTitleIfReady(pendingFocusRequest);
      }
    });
  }, [applyFocusTaskTitleIfReady, readEditorContent, resetHistory, task?.id, updateLineControls]);

  useEffect(() => {
    if (!focusTaskTitleRequest) return;
    if (!applyFocusTaskTitleIfReady(focusTaskTitleRequest)) {
      pendingFocusTaskTitleRequestRef.current = focusTaskTitleRequest;
    }
  }, [applyFocusTaskTitleIfReady, focusTaskTitleRequest]);

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

      if (dueDateSame && dueTimeSame) return current;

      return {
        ...current,
        dueDate: taskSnapshot.dueDate,
        dueTimeMinutes: taskSnapshot.dueTimeMinutes,
        dueDurationMinutes: taskSnapshot.dueDurationMinutes,
        dueTimeZone: taskSnapshot.dueTimeZone,
      };
    });
  }, [
    taskId,
    taskSnapshot?.name,
    taskSnapshot?.dueDate,
    taskSnapshot?.dueTimeMinutes,
    taskSnapshot?.dueDurationMinutes,
    taskSnapshot?.dueTimeZone,
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
    closeFormatMenu();
    setLineControls([]);
    setAddBlockMenu(null);
    setSlashCommandMenu(null);
    setIsDateMenuOpen(false);

    const pendingLocal = localPendingByTaskRef.current.get(taskId);
    const cachedTask = taskDetailsCache.get(taskId);

    if (cachedTask) {
      hydrateFromTaskRecord(cachedTask, pendingLocal);
    } else if (taskSnapshot) {
      hydrateFromTaskRecord(
        buildTaskDetailsFromSnapshot(taskId, taskSnapshot),
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
        if (cancelled) return;

        if (!loadedTask) {
          if (!cachedTask && !taskSnapshot) {
            setTask(null);
            savedDetailsRef.current = "";
            detailsRef.current = "";
            previousTextRef.current = "";
            setSaveStatus("error");
          }
          return;
        }

        const latestPendingLocal = localPendingByTaskRef.current.get(taskId);
        hydrateFromTaskRecord(
          {
            ...loadedTask,
            dueDate: loadedTask.dueDate
              ? new Date(loadedTask.dueDate).toISOString()
              : null,
          },
          latestPendingLocal,
        );
        onTaskHasDetailsKnown?.(
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
        if (!cancelled && !cachedTask && !taskSnapshot) {
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

      const snapshot = captureTaskSnapshotForSwitch(previousTaskId);
      const savedDetailsAtSwitch = savedDetailsRef.current;
      const taskNameAtSwitch = taskNameRef.current;

      if (task || taskDetailsCache.has(previousTaskId)) {
        const existing = taskDetailsCache.get(previousTaskId);
        const detailsToCache = taskDetailsHasContent(snapshot.details)
          ? snapshot.details
          : savedDetailsAtSwitch;
        taskDetailsCache.set(previousTaskId, {
          id: previousTaskId,
          name: snapshot.title || taskNameAtSwitch,
          completed: task?.completed ?? existing?.completed ?? false,
          details: detailsToCache,
          dueDate: task?.dueDate ?? existing?.dueDate ?? null,
          dueTimeMinutes:
            task?.dueTimeMinutes ?? existing?.dueTimeMinutes ?? null,
          dueDurationMinutes:
            task?.dueDurationMinutes ?? existing?.dueDurationMinutes ?? null,
          dueTimeZone: task?.dueTimeZone ?? existing?.dueTimeZone ?? "UTC",
          recurrenceRule:
            task?.recurrenceRule ?? existing?.recurrenceRule ?? null,
        });
      }

      isReadyRef.current = false;

      void (async () => {
        await waitForSaveIdle();

        const detailsToPersist = taskDetailsHasContent(snapshot.details)
          ? snapshot.details
          : taskDetailsHasContent(savedDetailsAtSwitch)
            ? savedDetailsAtSwitch
            : snapshot.details;

        const wouldLoseSavedContent =
          !taskDetailsHasContent(detailsToPersist) &&
          taskDetailsHasContent(savedDetailsAtSwitch);

        try {
          await persistTaskContent(
            previousTaskId,
            {
              title: snapshot.title,
              details: wouldLoseSavedContent
                ? savedDetailsAtSwitch
                : detailsToPersist,
            },
            {
              details: savedDetailsAtSwitch,
              name: taskNameAtSwitch,
            },
          );
        } catch {
          if (
            taskDetailsHasContent(
              wouldLoseSavedContent ? savedDetailsAtSwitch : detailsToPersist,
            )
          ) {
            saveTaskDetailsKeepalive(
              previousTaskId,
              wouldLoseSavedContent
                ? savedDetailsAtSwitch
                : detailsToPersist,
            );
          }
        }
      })();
    };
  }, [
    captureTaskSnapshotForSwitch,
    closeFormatMenu,
    hydrateFromTaskRecord,
    onTaskHasDetailsKnown,
    persistTaskContent,
    taskId,
    waitForSaveIdle,
  ]);

  useEffect(() => {
    function handlePageHide() {
      const currentTaskId = taskIdRef.current;
      if (!currentTaskId || !isReadyRef.current) return;

      const editorHtml = editorRef.current?.innerHTML ?? detailsRef.current;
      const { title, details } = splitEditorContent(editorHtml);

      const detailsChanged = details !== savedDetailsRef.current;
      const titleChanged = Boolean(title) && title !== taskNameRef.current;

      if (!detailsChanged && !titleChanged) return;

      if (detailsChanged) {
        saveTaskDetailsKeepalive(currentTaskId, details);
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

      if (clipboardNoticeTimerRef.current !== null) {
        window.clearTimeout(clipboardNoticeTimerRef.current);
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

      if (formatMenuRef.current?.contains(target)) {
        return;
      }

      closeFormatMenu();

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
      setIsDateMenuOpen(false);
      scheduleLineControlsUpdate();

      if (!panelRef.current?.contains(target)) {
        requestSave("immediate");
      }
    }

    function handleSelectionChange() {
      const editor = editorRef.current;
      if (editor?.contains(document.activeElement)) {
        syncLineEmptyState(editor);

        const selection = window.getSelection();
        if (
          selection?.rangeCount &&
          !selection.isCollapsed &&
          editor.contains(selection.anchorNode)
        ) {
          rememberFormatSelection(editor, selection.getRangeAt(0));
        }
      }

      if (!formatMenuRef.current?.contains(document.activeElement)) {
        if (formatMenuTimerRef.current !== null) {
          window.clearTimeout(formatMenuTimerRef.current);
        }

        formatMenuTimerRef.current = window.setTimeout(() => {
          formatMenuTimerRef.current = null;
          updateFormatMenu();
        }, FORMAT_MENU_DEBOUNCE_MS);
      }

      scheduleLineControlsUpdate();
    }

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [closeFormatMenu, rememberFormatSelection, requestSave, scheduleLineControlsUpdate, updateFormatMenu]);

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

    const parsed = parseSlashCommand(getLinePlainText(activeLine));
    if (!parsed) {
      setSlashCommandMenu(null);
      return;
    }

    const filtered = getSlashCommandOptions(parsed.query);
    if (filtered.length === 0) {
      setSlashCommandMenu(null);
      return;
    }

    const lineId = activeLine.dataset.lineId;
    if (!lineId) {
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

  function cancelSlashCommand() {
    const editor = editorRef.current;
    if (editor && slashCommandMenu) {
      const line = getLineById(editor, slashCommandMenu.lineId);
      if (line && lineHasSlashCommand(line)) {
        clearSlashCommandText(line);
        placeCaretInLine(line);
        syncEditorContent();
        syncLineEmptyState(editor);
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
    syncLineEmptyState(editor);
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
      y: lineRect.top - 8,
      alignLeft: false,
      placement: "above",
      anchorBottom: lineRect.bottom,
    });

    syncLineEmptyState(editor);

    requestAnimationFrame(() => {
      if (state.text) {
        linkTextInputRef.current?.focus();
        linkTextInputRef.current?.select();
        return;
      }

      linkUrlInputRef.current?.focus();
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
      detailsRef.current = normalizeDetails(editorRef.current.innerHTML);
      rememberPendingLocalSave();
    }

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

  function handleEditorPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      if (!text) return;

      editor.focus();
      document.execCommand("insertText", false, text);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      updateLineControls();
      return;
    }

    const files = getImageFilesFromDataTransfer(event.clipboardData);
    if (files.length > 0) {
      event.preventDefault();
      void insertImagesFromFiles(files, activeLine, { fromClipboard: true });
      return;
    }

    const html = event.clipboardData.getData("text/html");
    const plainText = event.clipboardData.getData("text/plain");

    if (plainText && /\r?\n/.test(plainText)) {
      event.preventDefault();
      editor.focus();
      insertPlainTextAtSelection(editor, plainText);
      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    if (html && plainText && pastedHtmlHasFormatting(html)) {
      event.preventDefault();

      const pasteId = crypto.randomUUID();
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

        if (!editorRef.current || taskIdRef.current !== currentTaskId) return;

        const fragment = preparePasteFragment(htmlToPaste, pasteId);

        editor.focus();
        insertPasteFragmentAtSelection(fragment);

        requestAnimationFrame(() => {
          finalizePasteEditorState();
          showPasteFormatPrompt(pasteId);
          requestSave("immediate");
        });
      })();
      return;
    }

    if (html && plainText) {
      event.preventDefault();
      const pasteId = crypto.randomUUID();
      const fragment = preparePasteFragment(html, pasteId);

      editor.focus();
      insertPasteFragmentAtSelection(fragment);

      requestAnimationFrame(() => {
        finalizePasteEditorState();
      });
      return;
    }

    if (plainText) {
      event.preventDefault();
      editor.focus();
      insertPlainTextAtSelection(editor, plainText);
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
        addBlockMenuRef.current?.contains(nextTarget))
    ) {
      return;
    }

    const editor = editorRef.current;
    if (editor) {
      syncLineEmptyState(editor);
    }

    if (inputNormalizeTimerRef.current !== null) {
      window.clearTimeout(inputNormalizeTimerRef.current);
      inputNormalizeTimerRef.current = null;
    }

    if (inputNormalizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      inputNormalizeFrameRef.current = null;
    }

    runEditorNormalization("full");
    flushHistorySnapshot();
    requestSave("immediate");
    scheduleLineControlsUpdate();
  }

  function handleEditorWrapperMouseMove(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const editor = editorRef.current;
    if (!editor || dragStateRef.current) return;

    ensureBlockLines(editor);

    const line = getLineElementAtPoint(editor, event.clientY);
    hoveredLineRef.current = line;
    scheduleLineControlsUpdate();
  }

  function handleEditorWrapperMouseEnter() {
    isMouseOverEditorRef.current = true;
  }

  function handleEditorWrapperMouseLeave(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      (lineControlsRef.current?.contains(relatedTarget) ||
        addBlockMenuRef.current?.contains(relatedTarget))
    ) {
      return;
    }

    isMouseOverEditorRef.current = false;
    hoveredLineRef.current = null;
    scheduleLineControlsUpdate();
  }

  function handleEditorFocus() {
    const editor = editorRef.current;
    const activeLine = editor ? getActiveLineElement(editor) : null;

    if (editor && activeLine && isDetailLineEmpty(activeLine)) {
      focusDetailLine(editor, activeLine);
    }

    if (editor) {
      syncLineEmptyState(editor);
    }

    updateLineControls();
  }

  function handleEditorMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const hoverLine = getLineElementAtPoint(editor, event.clientY);
    if (hoverLine) {
      hoveredLineRef.current = hoverLine;
    }

    const clickResult = handleClickBelowLastLine(editor, event.clientY);
    if (clickResult) {
      if (clickResult === "inserted") {
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
      }
      syncLineEmptyState(editor);
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

    clickedLineRef.current = line;
    pendingClickLineRef.current = line;

    if (isDetailLineEmpty(line)) {
      event.preventDefault();
      focusDetailLine(editor, line);
      syncLineEmptyState(editor);
    }

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

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (!activeLine) return;

      splitLineAtCursor(editor);
      setSlashCommandMenu(null);
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
      updateFormatMenu();
    }, FORMAT_MENU_DEBOUNCE_MS);

    scheduleLineControlsUpdate();
  }

  function handleEditorMouseUp() {
    if (formatMenuTimerRef.current !== null) {
      window.clearTimeout(formatMenuTimerRef.current);
    }

    formatMenuTimerRef.current = window.setTimeout(() => {
      formatMenuTimerRef.current = null;
      updateFormatMenu();
    }, FORMAT_MENU_DEBOUNCE_MS);

    const editor = editorRef.current;
    if (editor) {
      syncLineEmptyState(editor);

      const selection = window.getSelection();
      if (
        selection?.rangeCount &&
        !selection.isCollapsed &&
        editor.contains(selection.anchorNode)
      ) {
        rememberFormatSelection(editor, selection.getRangeAt(0));
      }
    }

    pendingClickLineRef.current = null;
    updateLineControls();
  }

  function handleEditorContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const clickedLine = (event.target as HTMLElement).closest(".detail-line");
    if (clickedLine instanceof HTMLElement && isTitleLine(editor, clickedLine)) {
      event.preventDefault();
      return;
    }

    const selection = window.getSelection();
    const hasTextSelection =
      selection !== null &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      editor.contains(selection.anchorNode) &&
      selection.toString().trim().length > 0;

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
      return;
    }

    event.preventDefault();
    setAddBlockMenu(null);
    setSlashCommandMenu(null);

    if (hasTextSelection && selection) {
      const range = selection.getRangeAt(0);
      rememberFormatSelection(editor, range);
      setFormatMenu(getFormatMenuPositionFromRange(range, editor));
      setFormatMenuFontSize(getDetailSelectionFontState(editor).size);
      setFormatMenuBlockType(getActiveTextBlockType(editor));
      closeFormatDropdowns();
      setShowLinkMenu(false);
      showLinkMenuRef.current = false;
      return;
    }

    closeFormatMenu();
    placeCaretAtPoint(editor, event.clientX, event.clientY);

    const lineId = activeLine.dataset.lineId;
    if (!lineId) return;

    editor.focus();
    syncLineEmptyState(editor);

    const position = getSlashCommandMenuPosition(activeLine);
    setSlashCommandMenu({
      top: position.top,
      left: position.left,
      lineId,
      query: "",
      selectedIndex: 0,
      fromContextMenu: true,
    });
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
      },
    );
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

    const link = (event.target as HTMLElement).closest("a.detail-link");
    if (link instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      window.open(link.href, "_blank", "noopener,noreferrer");
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

      const removed = removeImageWrapper(editor, imageWrapper);
      if (!removed) return;

      syncEditorContent();
      recordHistorySnapshot();
      requestSave("flush");
      updateLineControls();
      return;
    }
  }

  function handleDateButtonClick() {
    if (!task) return;
    setIsDateMenuOpen((open) => !open);
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
      setTask((current) =>
        current
          ? {
              ...current,
              recurrenceRule: nextRecurrenceRule,
            }
          : current,
      );
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
        setIsDateMenuOpen(false);
      }
      setMetadataError(null);
    } catch {
      setMetadataError("Could not update the due time.");
    }
  }

  const dueDateLabel = task ? formatDueDateLabel(task.dueDate) : null;
  const dueTimeLabel = task ? formatDueTimeLabel(task.dueTimeMinutes) : null;

  return (
    <section
      ref={panelRef}
      data-task-details-panel
      className="relative min-w-[300px] flex-1 bg-[#f8f8f9] "
      aria-busy={saveStatus === "loading" ? true : undefined}
    >
      <div className="relative flex items-center justify-between overflow-visible px-4 pt-1 pb-1">
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
              <div className="relative">
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
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-[#eceef0] pl-3.5 pr-3 py-[7px] text-[12px] font-semibold uppercase tracking-wide text-zinc-600 transition-colors hover:bg-[#e0e2e5] dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <span className={dueDateLabel ? "text-[11px]" : undefined}>Date</span>
             
                  {dueDateLabel ? (
                    <span 
                      className="ml-px flex flex-col items-start normal-case tracking-normal"
                      title={dueTimeLabel ? `${dueDateLabel} • ${dueTimeLabel}` : dueDateLabel || undefined}
                    >
                      <span className="font-normal text-[#5F5F5F] dark:text-zinc-300 text-[13px]">
                        {dueDateLabel}
                      </span>
                    </span>
                  ) : (
                    <PlusIcon className="ml-1 size-3 text-[#5F5F5F]" />
                  )}
                </button>

                {isDateMenuOpen && (
                  <div
                    ref={dateMenuRef}
                    className="absolute left-0 top-full z-50 mt-1.5"
                  >
                    <TaskDatePicker
                      dueDate={task.dueDate}
                      dueTimeMinutes={task.dueTimeMinutes}
                      dueDurationMinutes={task.dueDurationMinutes}
                      dueTimeZone={task.dueTimeZone}
                      recurrenceRule={task.recurrenceRule}
                      onSelectDate={(dateValue) =>
                        void handleSelectDueDate(dateValue)
                      }
                      onSaveDueTime={(dueTime, options) =>
                        void handleSaveDueTime(dueTime, options)
                      }
                      onSaveRecurrence={(rule) => void handleSaveRecurrence(rule)}
                    />
                  </div>
                )}
              </div>
              <span className="text-[#cfcfcf] ml-2">|</span>
              <div className="flex items-center overflow-visible rounded">
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
              {onToggleTask && !task.completed ? (
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
        {taskId &&
          saveStatus !== "loading" &&
          (saveStatus !== "idle" ||
            showClipboardNotice ||
            lastSavedAt !== null) && (
          <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {showClipboardNotice ? <span>Clipboard</span> : null}
            {metadataError ? (
              <span className="text-red-600 dark:text-red-400">{metadataError}</span>
            ) : null}
            {saveStatus === "pending" ? <span>Unsaved changes</span> : null}
            {saveStatus === "error" ? (
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
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
        )}
      </div>

      {taskId && saveStatus === "loading" && !task ? (
        <>
          <span className="sr-only">Loading task details</span>
          <TaskDetailsSkeleton />
        </>
      ) : task ? (
        <div className="flex flex-col px-4 pb-4">
          <div
            ref={editorWrapperRef}
            className="relative overflow-visible text-[#555555]"
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
              <div className="pointer-events-none absolute inset-0 z-30 rounded-md border-2 border-dashed border-blue-400 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20" />
            )}

            {pasteFormatPrompt && (
              <div
                className="absolute z-40 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
                style={{
                  top: pasteFormatPrompt.top,
                  left: pasteFormatPrompt.left,
                }}
                onMouseDown={(event) => event.preventDefault()}
              >
                <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                    checked={pasteFormatPrompt.removeFormatting}
                    onChange={(event) =>
                      applyPasteFormatOption(event.target.checked)
                    }
                  />
                  Remove formatting
                </label>
              </div>
            )}

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              onBlur={handleEditorBlur}
              onFocus={handleEditorFocus}
              onMouseUp={handleEditorMouseUp}
              onContextMenu={handleEditorContextMenu}
              onMouseDown={handleEditorMouseDown}
              onClick={handleEditorClick}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={handleEditorKeyUp}
              onScroll={updateLineControls}
              className="task-details-editor min-h-[650px] w-full resize-y overflow-auto rounded-xl bg-white py-2 pl-[30px] pr-3 text-[17px] leading-[1.75] text-[#555555] outline-none transition-colors dark:bg-zinc-950 dark:text-zinc-300 [&_.detail-line[data-line-type=bullet]]:pl-1 [&_.detail-line[data-line-type=checklist]]:cursor-pointer [&_.detail-line[data-line-type=checklist]]:pl-1 [&_.detail-line[data-line-type=h1]]:text-[24px] [&_.detail-line[data-line-type=h1]]:font-bold [&_.detail-line[data-line-type=h1]]:leading-[32px] [&_.detail-line[data-line-type=h1]]:text-[#4B4B4B] dark:[&_.detail-line[data-line-type=h1]]:text-[#F5F5F5] [&_.detail-line[data-line-type=h2]]:text-[1.3125rem] [&_.detail-line[data-line-type=h2]]:font-semibold [&_.detail-line[data-line-type=h2]]:leading-[1.6875rem] [&_.detail-line[data-line-type=h3]]:text-[1.125rem] [&_.detail-line[data-line-type=h3]]:font-semibold [&_.detail-line[data-line-type=h3]]:leading-[1.5rem] [&_.detail-line[data-line-type=numbered]]:pl-1 [&_mark]:bg-yellow-200 dark:[&_mark]:bg-yellow-500/30 [&_s]:line-through [&_strike]:line-through [&_u]:underline"
            />

            {dropIndicator && (
              <div
                className="pointer-events-none absolute right-3 left-10 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicator.top }}
              />
            )}

            {lineControls.length > 0 && (
              <div
                ref={lineControlsRef}
                className="pointer-events-none absolute inset-0 z-10"
              >
                {lineControls.map(({ lineId, top, showPlus, showDrag }) => (
                  <div
                    key={lineId}
                    className="pointer-events-auto absolute left-1 flex h-[1.75em] -translate-y-1/2 items-center"
                    style={{ top }}
                  >
                    {showPlus ? (
                      <button
                        type="button"
                        aria-label="Add block below"
                        title="Add block below"
                        aria-haspopup="menu"
                        aria-expanded={addBlockMenu !== null}
                        className="flex size-[19px] cursor-grab items-center justify-center rounded rounded-lg px-[1px] py-[3px] text-zinc-350 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
                        className="flex w-[23px] h-[26px] cursor-grab items-center justify-center rounded-full px-[1px] py-[3px] mr-[2px] text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
            )}
          </div>
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
          className="fixed z-50 min-w-[168px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
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
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
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

        return (
          <div
            ref={slashCommandMenuRef}
            role="menu"
            aria-label="Block type commands"
            className="fixed z-50 min-w-[168px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{
              top: slashCommandMenu.top,
              left: slashCommandMenu.left,
            }}
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
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800 ${
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
        );
      })()}

      {formatMenu && (
        <div
          ref={formatMenuRef}
          className={`${FORMAT_TOOLBAR_CONTAINER_CLASS} ${
            openFormatDropdown ? "overflow-visible" : ""
          } ${
            formatMenu.alignLeft ? "" : "-translate-x-1/2"
          } ${
            formatMenu.placement === "below" ? "translate-y-2" : "-translate-y-full"
          }`}
          style={{ left: formatMenu.x, top: formatMenu.y }}
        >
          {showLinkMenu ? (
            <div className="space-y-2 px-2 py-2">
              <input
                ref={linkTextInputRef}
                type="text"
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                placeholder="Display text"
                aria-label="Link display text"
                className="w-[min(280px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeFormatMenu();
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
                className="w-[min(280px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeFormatMenu();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                    className="rounded-md bg-[#4873c7] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3f68bd]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={FORMAT_TOOLBAR_ROW_CLASS}>
                <button
                  type="button"
                  aria-label="Bold"
                  title="Bold"
                  className={`${FORMAT_TOOLBAR_TEXT_BUTTON_CLASS} font-bold`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  aria-label="Italic"
                  title="Italic"
                  className={`${FORMAT_TOOLBAR_TEXT_BUTTON_CLASS} italic`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  aria-label="Underline"
                  title="Underline"
                  className={`${FORMAT_TOOLBAR_TEXT_BUTTON_CLASS} underline`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("underline")}
                >
                  U
                </button>

                <div aria-hidden="true" className={FORMAT_TOOLBAR_DIVIDER_CLASS} />

                <DetailFormatColorDropdown
                  open={openFormatDropdown === "color"}
                  onOpenChange={(open) => setFormatDropdownOpen("color", open)}
                  defaultTextColor={DEFAULT_TEXT_COLOR}
                  textColorOptions={TEXT_COLOR_OPTIONS}
                  onSelectColor={applyTextColor}
                />

                <button
                  type="button"
                  aria-label="Highlight"
                  title="Highlight"
                  className={FORMAT_TOOLBAR_ICON_BUTTON_CLASS}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("highlight")}
                >
                  <LuHighlighter className="size-4" />
                </button>

                <div aria-hidden="true" className={FORMAT_TOOLBAR_DIVIDER_CLASS} />

                <button
                  type="button"
                  aria-label="Add link"
                  title="Add link (⌘K / Ctrl+K)"
                  className={FORMAT_TOOLBAR_ICON_BUTTON_CLASS}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openLinkMenu}
                >
                  <BiLink className="size-4" />
                </button>

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

                <DetailFormatFontComboDropdown
                  open={openFormatDropdown === "font"}
                  onOpenChange={(open) => {
                    setFormatDropdownOpen("font", open);
                    if (open) {
                      const editor = editorRef.current;
                      if (editor) {
                        const fontState = getDetailSelectionFontState(editor);
                        setFormatMenuFontFamily(fontState.familyId);
                        setFormatMenuFontSize(fontState.size);
                      }
                    }
                  }}
                  familyId={formatMenuFontFamily}
                  size={formatMenuFontSize}
                  onSelectFamily={applyFormatFontFamily}
                  onSelectSize={applyFormatFontSize}
                />

                <div aria-hidden="true" className={FORMAT_TOOLBAR_DIVIDER_CLASS} />

                <button
                  type="button"
                  aria-label="Clear formatting"
                  title="Clear formatting"
                  className={FORMAT_TOOLBAR_ICON_BUTTON_CLASS}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    clearFormatting();
                  }}
                >
                  <LuRemoveFormatting className="size-4" />
                </button>

                <DetailFormatOverflowMenu
                  open={openFormatDropdown === "overflow"}
                  onOpenChange={(open) => setFormatDropdownOpen("overflow", open)}
                  menuRef={formatOverflowMenuRef}
                  onStrikethrough={() => applyFormat("strikeThrough")}
                  onGrammarCheck={() => void runGrammarCheck()}
                />
              </div>
            </>
          )}
        </div>
      )}

      <TaskVersionHistoryOffcanvas
        open={isVersionHistoryOpen}
        taskId={taskId}
        onClose={() => setIsVersionHistoryOpen(false)}
        onRestore={applyRestoredTaskVersion}
      />

      <GrammarCheckModal
        open={grammarModalOpen}
        originalText={grammarOriginalText}
        correctedText={grammarCorrectedText}
        isLoading={grammarLoading}
        error={grammarError}
        onApply={applyGrammarCorrection}
        onClose={() => {
          if (grammarLoading) return;
          setGrammarModalOpen(false);
        }}
      />

    </section>
  );
}
