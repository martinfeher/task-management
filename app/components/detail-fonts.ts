import {
  clearListBlockTypesFromLines,
  DETAIL_LINE_CLASS,
  getActiveLineElement,
  getLineSelectionRange,
  getSelectedBlockLinesInRange,
  isCodeLine,
  isTitleLine,
  renumberNumberedLines,
} from "./detail-lines";
import {
  getDefaultDetailFontSizePx,
  INITIAL_TASK_EDITOR_FONT_SIZE_PX,
} from "@/lib/task-editor-defaults-settings";
import {
  resetDetailLineHeightOnLines,
} from "./detail-line-height";

export const PASTE_BATCH_ATTR = "data-paste-batch";
export const DEFAULT_DETAIL_FONT_SIZE = `${INITIAL_TASK_EDITOR_FONT_SIZE_PX}px`;
export const DEFAULT_DETAIL_FONT_SIZE_PX = INITIAL_TASK_EDITOR_FONT_SIZE_PX;
export const PASTE_FORMAT_PROMPT_MS = 5000;

export type DetailFontFamilyId =
  | "sans-serif"
  | "inter"
  | "sf-pro"
  | "euclid-circular"
  | "serif"
  | "monospace"
  | "lora"
  | "great-vibes"
  | "mixed";

export const DETAIL_FONT_FAMILY_OPTIONS: {
  id: DetailFontFamilyId;
  label: string;
  value: string;
}[] = [
  {
    id: "sans-serif",
    label: "Sans Serif",
    value:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    id: "inter",
    label: "Inter",
    value: "var(--font-inter), sans-serif",
  },
  {
    id: "sf-pro",
    label: "SF Pro",
    value: "var(--font-sf-pro), sans-serif",
  },
  {
    id: "euclid-circular",
    label: "Euclid Circular",
    value: "var(--font-euclid-circular), sans-serif",
  },
  {
    id: "serif",
    label: "Serif",
    value: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    id: "monospace",
    label: "Monospace",
    value:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
  {
    id: "lora",
    label: "Lora",
    value: "var(--font-lora), serif",
  },
  {
    id: "great-vibes",
    label: "Great Vibes",
    value: "var(--font-great-vibes), cursive",
  },
];

export function getAppFontFamilyId(): Extract<
  DetailFontFamilyId,
  "inter" | "sf-pro" | "euclid-circular"
> {
  if (typeof document === "undefined") {
    return "inter";
  }

  const appFont = document.documentElement.dataset.appFont;

  if (appFont === "sf-pro") {
    return "sf-pro";
  }

  if (appFont === "euclid-circular") {
    return "euclid-circular";
  }

  return "inter";
}

export function getFormatToolbarFontFamilyOptions() {
  const appFontId = getAppFontFamilyId();
  const appFont = DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === appFontId);
  const sansSerif = DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === "sans-serif");
  const serif = DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === "serif");
  const monospace = DETAIL_FONT_FAMILY_OPTIONS.find(
    (option) => option.id === "monospace",
  );
  const lora = DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === "lora");
  const greatVibes = DETAIL_FONT_FAMILY_OPTIONS.find(
    (option) => option.id === "great-vibes",
  );

  return [appFont, sansSerif, serif, monospace, lora, greatVibes].filter(
    (option): option is (typeof DETAIL_FONT_FAMILY_OPTIONS)[number] =>
      Boolean(option),
  );
}

export const DETAIL_FONT_SIZE_OPTIONS = [
  8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 36, 48, 72,
] as const;

export type DetailFontSizeOption = (typeof DETAIL_FONT_SIZE_OPTIONS)[number];

export type DetailSelectionFontState = {
  familyId: DetailFontFamilyId;
  size: DetailFontSizeOption;
};

export function getDetailFontFamilyLabel(familyId: DetailFontFamilyId) {
  if (familyId === "mixed") {
    return "Mixed";
  }

  return (
    DETAIL_FONT_FAMILY_OPTIONS.find((option) => option.id === familyId)?.label ??
    "Sans Serif"
  );
}

const FORMATTING_TAGS = new Set([
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
]);

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

export function isDefaultAppFont(fontFamily: string) {
  if (!fontFamily.trim()) return true;

  const lower = fontFamily.toLowerCase();
  if (
    lower.includes("sf pro") ||
    lower.includes("sf-pro") ||
    lower.includes("var(--font-sf-pro)") ||
    lower.includes("inter") ||
    lower.includes("var(--font-inter)") ||
    lower.includes("euclid") ||
    lower.includes("var(--font-euclid-circular)")
  ) {
    return true;
  }

  const parts = lower
    .split(",")
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ""));

  const genericFamilies = new Set([
    "",
    "inherit",
    "initial",
    "unset",
    "ui-sans-serif",
    "system-ui",
    "sans-serif",
    "-apple-system",
    "blinkmacsystemfont",
  ]);

  return parts.every(
    (part) =>
      genericFamilies.has(part) ||
      part.includes("sf pro") ||
      part.includes("sf-pro") ||
      part.includes("inter") ||
      part.includes("euclid"),
  );
}

export function isDefaultDetailFontSize(fontSize: string) {
  if (!fontSize.trim()) return true;

  const defaultSizePx = getDefaultDetailFontSizePx();
  const normalized = fontSize.trim().toLowerCase();
  if (
    normalized === "inherit" ||
    normalized === "initial" ||
    normalized === "unset" ||
    normalized === DEFAULT_DETAIL_FONT_SIZE ||
    normalized === `${defaultSizePx}px` ||
    normalized === "1.0625rem"
  ) {
    return true;
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isFinite(parsed) && Math.round(parsed) === defaultSizePx) {
    return true;
  }

  return false;
}

export function getDefaultAppFontFamily() {
  if (typeof document === "undefined") {
    return "var(--font-inter), sans-serif";
  }

  const appFont = document.documentElement.dataset.appFont;

  if (appFont === "sf-pro") {
    return "var(--font-sf-pro), sans-serif";
  }

  if (appFont === "euclid-circular") {
    return "var(--font-euclid-circular), sans-serif";
  }

  return "var(--font-inter), sans-serif";
}

function normalizeFontFamilyName(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fontFamiliesMatch(left: string, right: string) {
  const normalizedLeft = normalizeFontFamilyName(left);
  const normalizedRight = normalizeFontFamilyName(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftParts = normalizedLeft.split(",").map((part) => part.trim());
  const rightParts = normalizedRight.split(",").map((part) => part.trim());

  return leftParts.some((part) => rightParts.includes(part));
}

function matchesDetailFontFamilyOption(
  normalized: string,
  option: (typeof DETAIL_FONT_FAMILY_OPTIONS)[number],
) {
  if (fontFamiliesMatch(normalized, option.value)) return true;

  switch (option.id) {
    case "inter":
      return /\binter\b/.test(normalized) && !normalized.includes("euclid");
    case "sf-pro":
      return normalized.includes("sf pro") || normalized.includes("sf-pro");
    case "euclid-circular":
      return normalized.includes("euclid");
    case "lora":
      return /\blora\b/.test(normalized);
    case "great-vibes":
      return (
        normalized.includes("great vibes") || normalized.includes("great-vibes")
      );
    default:
      return false;
  }
}

export function matchDetailFontFamilyId(fontFamily: string): DetailFontFamilyId {
  const normalized = normalizeFontFamilyName(fontFamily);

  if (!normalized) {
    return getAppFontFamilyId();
  }

  for (const option of DETAIL_FONT_FAMILY_OPTIONS) {
    if (matchesDetailFontFamilyOption(normalized, option)) {
      return option.id;
    }
  }

  if (
    isDefaultAppFont(fontFamily) ||
    normalized.includes("ui-sans-serif") ||
    normalized.includes("system-ui")
  ) {
    return getAppFontFamilyId();
  }

  if (/\barial\b|\bverdana\b|\bhelvetica\b/.test(normalized)) {
    return "sans-serif";
  }

  if (/\bgeorgia\b|\btimes new roman\b|\btimes\b/.test(normalized)) {
    return "serif";
  }

  if (/\bcourier\b/.test(normalized)) {
    return "monospace";
  }

  return "sans-serif";
}

function parseFontSizePx(fontSize: string) {
  const parsed = Number.parseFloat(fontSize);
  if (!Number.isFinite(parsed)) return getDefaultDetailFontSizePx();

  if (fontSize.trim().toLowerCase().endsWith("rem")) {
    const rootSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return Math.round(parsed * (Number.isFinite(rootSize) ? rootSize : 16));
  }

  return Math.round(parsed);
}

export function getDefaultDetailFontSizeOption(): DetailFontSizeOption {
  const px = getDefaultDetailFontSizePx();
  if ((DETAIL_FONT_SIZE_OPTIONS as readonly number[]).includes(px)) {
    return px as DetailFontSizeOption;
  }

  let closest: DetailFontSizeOption = DETAIL_FONT_SIZE_OPTIONS[0];
  let closestDistance = Math.abs(px - closest);

  for (const option of DETAIL_FONT_SIZE_OPTIONS) {
    const distance = Math.abs(px - option);
    if (distance < closestDistance) {
      closest = option;
      closestDistance = distance;
    }
  }

  return closest;
}

export function matchDetailFontSize(fontSize: string): DetailFontSizeOption {
  const parsed = parseFontSizePx(fontSize);
  if (isDefaultDetailFontSize(`${parsed}px`)) {
    return getDefaultDetailFontSizeOption();
  }

  let closest: DetailFontSizeOption = DETAIL_FONT_SIZE_OPTIONS[0];
  let closestDistance = Math.abs(parsed - closest);

  for (const option of DETAIL_FONT_SIZE_OPTIONS) {
    const distance = Math.abs(parsed - option);
    if (distance < closestDistance) {
      closest = option;
      closestDistance = distance;
    }
  }

  return closest;
}

function getSelectionElement(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode) return null;
  if (!editor.contains(selection.anchorNode)) return null;

  let node: Node | null = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}

function getFontFamilyIdAtNode(
  node: Node | null,
  editor: HTMLElement,
): DetailFontFamilyId {
  if (!node) {
    return getAppFontFamilyId();
  }

  let current: Node | null = node;
  if (current.nodeType === Node.TEXT_NODE) {
    current = current.parentElement;
  }

  while (current && current !== editor) {
    if (!(current instanceof HTMLElement)) {
      current = current.parentNode;
      continue;
    }

    const inlineFamily = current.style.fontFamily;
    if (inlineFamily) {
      return matchDetailFontFamilyId(inlineFamily);
    }

    current = current.parentNode;
  }

  let element: Node | null = node;
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentElement;
  }

  while (element && element !== editor) {
    if (element instanceof HTMLElement) {
      return matchDetailFontFamilyId(
        window.getComputedStyle(element).fontFamily,
      );
    }
    element = element.parentNode;
  }

  return getAppFontFamilyId();
}

function collectTextNodesInRange(range: Range) {
  const textNodes: Text[] = [];

  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    textNodes.push(range.commonAncestorContainer as Text);
    return textNodes;
  }

  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) {
      textNodes.push(walker.currentNode);
    }
  }

  return textNodes;
}

function hasSelectedTextInRange(textNode: Text, range: Range) {
  const content = textNode.textContent ?? "";
  if (!content) return false;

  const start =
    textNode === range.startContainer ? range.startOffset : 0;
  const end = textNode === range.endContainer ? range.endOffset : content.length;

  return start < end;
}

function collectUniqueFontFamilyIdsInRange(
  range: Range,
  editor: HTMLElement,
): DetailFontFamilyId[] {
  const unique = new Set<DetailFontFamilyId>();

  for (const textNode of collectTextNodesInRange(range)) {
    if (!hasSelectedTextInRange(textNode, range)) {
      continue;
    }

    unique.add(getFontFamilyIdAtNode(textNode, editor));
  }

  return Array.from(unique);
}

export function getDetailSelectionFontState(
  editor: HTMLElement,
): DetailSelectionFontState {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
    return {
      familyId: getAppFontFamilyId(),
      size: getDefaultDetailFontSizeOption(),
    };
  }

  const range = selection.getRangeAt(0);
  let familyId: DetailFontFamilyId;

  if (!selection.isCollapsed && !range.collapsed) {
    const familyIds = collectUniqueFontFamilyIdsInRange(range, editor);

    if (familyIds.length > 1) {
      familyId = "mixed";
    } else if (familyIds.length === 1) {
      familyId = familyIds[0];
    } else {
      familyId = getFontFamilyIdAtNode(range.startContainer, editor);
    }
  } else {
    familyId = getFontFamilyIdAtNode(
      selection.focusNode ?? selection.anchorNode ?? range.startContainer,
      editor,
    );
  }

  let node: Node | null = selection.isCollapsed
    ? selection.focusNode ?? selection.anchorNode
    : range.startContainer;

  if (node?.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  while (node && node !== editor) {
    if (!(node instanceof HTMLElement)) {
      node = node.parentNode;
      continue;
    }

    const inlineSize = node.style.fontSize;

    if (inlineSize) {
      return {
        familyId,
        size: matchDetailFontSize(inlineSize),
      };
    }

    node = node.parentNode;
  }

  const element = getSelectionElement(editor);
  if (!element) {
    return {
      familyId,
      size: getDefaultDetailFontSizeOption(),
    };
  }

  const computed = window.getComputedStyle(element);
  return {
    familyId,
    size: matchDetailFontSize(computed.fontSize),
  };
}

function canApplyDetailFont(editor: HTMLElement) {
  const activeLine = getActiveLineElement(editor);
  return Boolean(activeLine) && !isCodeLine(activeLine);
}

function removeStylePropertyFromRange(
  range: Range,
  property: "fontFamily" | "fontSize",
) {
  const elements = new Set<HTMLElement>();
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        return range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  if (
    range.commonAncestorContainer instanceof HTMLElement &&
    range.intersectsNode(range.commonAncestorContainer)
  ) {
    elements.add(range.commonAncestorContainer);
  }

  while (walker.nextNode()) {
    if (walker.currentNode instanceof HTMLElement) {
      elements.add(walker.currentNode);
    }
  }

  for (const element of elements) {
    if (property === "fontFamily") {
      element.style.removeProperty("font-family");
      if (element.tagName === "FONT") {
        element.removeAttribute("face");
      }
    } else {
      element.style.removeProperty("font-size");
      if (element.tagName === "FONT") {
        element.removeAttribute("size");
      }
    }

    cleanupStyledElement(element);
  }
}

function isInlineFormattingElement(element: HTMLElement) {
  if (FORMATTING_TAGS.has(element.tagName)) return true;
  if (element.tagName === "FONT" || element.tagName === "A") return true;
  if (element.style.cssText.trim()) return true;

  return false;
}

function unwrapInlineFormattingAroundText(textNode: Text, boundary: HTMLElement) {
  let parent = textNode.parentNode;

  while (parent instanceof HTMLElement && parent !== boundary) {
    if (!isInlineFormattingElement(parent)) break;
    unwrapElement(parent);
    parent = textNode.parentNode;
  }
}

function cleanupEmptyFormattingInRange(line: HTMLElement, range: Range) {
  const candidates = line.querySelectorAll(
    "span, mark, b, strong, i, em, u, s, strike, font, a",
  );

  for (const element of Array.from(candidates)) {
    if (!(element instanceof HTMLElement)) continue;
    if (!range.intersectsNode(element)) continue;
    if (element.textContent?.length !== 0) continue;

    element.remove();
  }
}

function replaceRangeWithPlainText(
  range: Range,
  line: HTMLElement,
): Text | null {
  const text = range.toString();
  if (!text) {
    if (!range.collapsed) {
      range.deleteContents();
      cleanupEmptyFormattingInRange(line, range);
    }
    return null;
  }

  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  unwrapInlineFormattingAroundText(textNode, line);
  cleanupEmptyFormattingInRange(line, range);

  return textNode;
}

export function stripFormattingInSelection(
  editor: HTMLElement,
  savedRange?: Range | null,
): boolean {
  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    restoreSelectionRange(savedRange.cloneRange());
  } else {
    editor.focus();
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  if (!editor.contains(selection.anchorNode)) return false;

  const range = selection.getRangeAt(0).cloneRange();
  if (range.collapsed || !range.toString()) return false;

  const lines = getSelectedBlockLinesInRange(editor, range).filter(
    (line) => !isCodeLine(line),
  );
  if (lines.length === 0) return false;

  const lineHeightTargets = lines.filter(
    (line) =>
      !isTitleLine(editor, line) &&
      !line.querySelector(".detail-image-wrapper"),
  );

  const lineSelections = lines
    .map((line) => ({
      line,
      range: getLineSelectionRange(line, range),
    }))
    .filter(({ range: lineRange }) => lineRange.toString().length > 0);

  if (lineSelections.length === 0) return false;

  const insertedNodes: Text[] = [];

  for (const { line, range: lineRange } of lineSelections.reverse()) {
    const textNode = replaceRangeWithPlainText(lineRange, line);
    if (textNode) {
      insertedNodes.unshift(textNode);
    }
  }

  const clearedListTypes = clearListBlockTypesFromLines(lines);
  if (clearedListTypes) {
    renumberNumberedLines(editor);
  }

  const resetLineHeight = resetDetailLineHeightOnLines(lineHeightTargets);

  if (insertedNodes.length === 0) {
    return clearedListTypes || resetLineHeight;
  }

  const nextRange = document.createRange();
  nextRange.setStart(insertedNodes[0], 0);
  const lastNode = insertedNodes[insertedNodes.length - 1];
  nextRange.setEnd(lastNode, lastNode.textContent?.length ?? 0);
  restoreSelectionRange(nextRange);

  return true;
}

function getTextNodesInRange(range: Range, editor: HTMLElement) {
  function acceptTextNode(node: Text) {
    if (!editor.contains(node)) return false;
    if (!range.intersectsNode(node)) return false;
    if (node.textContent === "\uFEFF") return false;
    return true;
  }

  const root = range.commonAncestorContainer;
  if (root instanceof Text && acceptTextNode(root)) {
    return [root];
  }

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
      return acceptTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  return nodes;
}

function getRangeForTextNode(textNode: Text, parentRange: Range) {
  const range = document.createRange();
  range.selectNodeContents(textNode);

  if (parentRange.compareBoundaryPoints(Range.START_TO_START, range) > 0) {
    range.setStart(parentRange.startContainer, parentRange.startOffset);
  }

  if (parentRange.compareBoundaryPoints(Range.END_TO_END, range) < 0) {
    range.setEnd(parentRange.endContainer, parentRange.endOffset);
  }

  return range;
}

function createStyledSpan(styles: { fontFamily?: string; fontSize?: string }) {
  const span = document.createElement("span");

  if (styles.fontFamily) {
    span.style.fontFamily = styles.fontFamily;
  }

  if (styles.fontSize) {
    span.style.fontSize = styles.fontSize;
  }

  return span;
}

function surroundRangeWithSpan(range: Range, span: HTMLSpanElement) {
  if (range.collapsed || !range.toString()) return null;

  try {
    range.surroundContents(span);
    return span;
  } catch {
    const fragment = range.extractContents();
    if (!fragment.textContent) return null;

    span.appendChild(fragment);
    range.insertNode(span);
    return span;
  }
}

function restoreSelectionRange(range: Range) {
  const selection = window.getSelection();
  if (!selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

function isRangeInEditor(editor: HTMLElement, range: Range) {
  try {
    return editor.contains(range.commonAncestorContainer);
  } catch {
    return false;
  }
}

function hasRangeText(range: Range) {
  return !range.collapsed && range.toString().length > 0;
}

function resolveApplyRange(editor: HTMLElement, savedRange?: Range | null) {
  const selection = window.getSelection();
  const currentInEditor =
    selection?.rangeCount &&
    selection.anchorNode &&
    editor.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;
  const savedInEditor =
    savedRange && isRangeInEditor(editor, savedRange)
      ? savedRange.cloneRange()
      : null;

  if (currentInEditor && hasRangeText(currentInEditor)) {
    return currentInEditor.cloneRange();
  }

  if (savedInEditor && hasRangeText(savedInEditor)) {
    return savedInEditor;
  }

  if (currentInEditor) {
    return currentInEditor.cloneRange();
  }

  if (savedInEditor) {
    return savedInEditor;
  }

  return null;
}

function applyStyleToSelection(
  editor: HTMLElement,
  styles: { fontFamily?: string; fontSize?: string },
  savedRange?: Range | null,
) {
  if (savedRange) {
    restoreSelectionRange(savedRange);
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  if (!editor.contains(selection.anchorNode)) return false;

  editor.focus();
  const parentRange = selection.getRangeAt(0).cloneRange();

  if (parentRange.collapsed) {
    const span = createStyledSpan(styles);
    span.appendChild(document.createTextNode("\uFEFF"));
    parentRange.insertNode(span);

    const textNode = span.firstChild;
    if (!textNode) return false;

    const nextRange = document.createRange();
    nextRange.setStart(textNode, textNode.textContent?.length ?? 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    return true;
  }

  const textNodes = getTextNodesInRange(parentRange, editor);
  if (textNodes.length === 0) return false;

  const wrappedSpans: HTMLSpanElement[] = [];

  for (let index = textNodes.length - 1; index >= 0; index -= 1) {
    const textNode = textNodes[index];
    const nodeRange = getRangeForTextNode(textNode, parentRange);
    const wrapped = surroundRangeWithSpan(
      nodeRange,
      createStyledSpan(styles),
    );

    if (wrapped) {
      wrappedSpans.push(wrapped);
    }
  }

  if (wrappedSpans.length === 0) return false;

  const selectionRange = document.createRange();
  selectionRange.setStartBefore(wrappedSpans[wrappedSpans.length - 1]);
  selectionRange.setEndAfter(wrappedSpans[0]);
  selection.removeAllRanges();
  selection.addRange(selectionRange);
  return true;
}

export function applyDetailFontFamily(
  editor: HTMLElement,
  familyId: DetailFontFamilyId,
  savedRange?: Range | null,
) {
  const range = resolveApplyRange(editor, savedRange);
  if (!range) return false;

  editor.focus();
  restoreSelectionRange(range);

  if (!canApplyDetailFont(editor)) return false;

  if (familyId === "mixed") return false;

  const option = DETAIL_FONT_FAMILY_OPTIONS.find((item) => item.id === familyId);
  if (!option) return false;

  if (familyId === getAppFontFamilyId()) {
    removeStylePropertyFromRange(range.cloneRange(), "fontFamily");
    restoreSelectionRange(range);
    return true;
  }

  return applyStyleToSelection(editor, { fontFamily: option.value }, range);
}

export function applyDetailFontSize(
  editor: HTMLElement,
  size: DetailFontSizeOption,
  savedRange?: Range | null,
) {
  const range = resolveApplyRange(editor, savedRange);
  if (!range) return false;

  editor.focus();
  restoreSelectionRange(range);

  if (!canApplyDetailFont(editor)) return false;

  if (size === getDefaultDetailFontSizePx()) {
    removeStylePropertyFromRange(range.cloneRange(), "fontSize");
    restoreSelectionRange(range);
    return true;
  }

  return applyStyleToSelection(
    editor,
    { fontSize: `${size}px` },
    range,
  );
}

function shouldSkipFontNormalization(element: Element) {
  const line = element.closest(`.${DETAIL_LINE_CLASS}`);
  if (!(line instanceof HTMLElement)) return false;

  return isCodeLine(line) || Boolean(element.closest(".detail-image-wrapper"));
}

function cleanupStyledElement(element: HTMLElement) {
  if (!element.style.cssText.trim()) {
    element.removeAttribute("style");
  }

  if (
    element.attributes.length === 0 &&
    (element.tagName === "SPAN" || element.tagName === "FONT")
  ) {
    unwrapElement(element);
  }
}

function normalizePastedElement(element: HTMLElement) {
  element.removeAttribute("contenteditable");
  element.removeAttribute("spellcheck");
  element.removeAttribute("autocorrect");
  element.removeAttribute("autocapitalize");
  element.draggable = false;

  if (element.hasAttribute("style")) {
    element.style.removeProperty("user-select");
    element.style.removeProperty("-webkit-user-select");
    element.style.removeProperty("-moz-user-select");
    element.style.removeProperty("pointer-events");

    if (!element.style.cssText.trim()) {
      element.removeAttribute("style");
    }
  }

  if (element.classList.contains(DETAIL_LINE_CLASS)) {
    delete element.dataset.lineId;
    delete element.dataset.lineType;
    delete element.dataset.listNumber;
    delete element.dataset.checked;
    delete element.dataset.empty;
    delete element.dataset.bodyPlaceholder;
    element.classList.remove(DETAIL_LINE_CLASS);
  }
}

export function sanitizePastedHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc
    .querySelectorAll("script, style, meta, link, head, title")
    .forEach((element) => element.remove());

  for (const line of [
    ...doc.body.querySelectorAll(`.${DETAIL_LINE_CLASS}`),
  ]) {
    if (line instanceof HTMLElement) {
      unwrapElement(line);
    }
  }

  for (const element of doc.body.querySelectorAll("*")) {
    if (element instanceof HTMLElement) {
      normalizePastedElement(element);
    }
  }

  return doc.body.innerHTML;
}

function elementHasPasteFormatting(element: HTMLElement) {
  if (FORMATTING_TAGS.has(element.tagName)) return true;

  if (element.tagName === "FONT") {
    if (element.hasAttribute("face") || element.hasAttribute("size")) {
      return true;
    }
  }

  const style = element.style;
  if (style.fontFamily && !isDefaultAppFont(style.fontFamily)) return true;
  if (style.fontSize && !isDefaultDetailFontSize(style.fontSize)) return true;
  if (
    style.fontWeight &&
    style.fontWeight !== "normal" &&
    style.fontWeight !== "400"
  ) {
    return true;
  }
  if (style.fontStyle && style.fontStyle !== "normal") return true;
  if (style.textDecoration && style.textDecoration !== "none") return true;
  if (style.color) return true;
  if (style.backgroundColor) return true;

  return false;
}

export function pastedHtmlHasFormatting(html: string) {
  const sanitized = sanitizePastedHtml(html);
  if (!sanitized.trim()) return false;

  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const body = doc.body;

  for (const element of body.querySelectorAll("*")) {
    if (!(element instanceof HTMLElement)) continue;
    if (elementHasPasteFormatting(element)) return true;
  }

  return false;
}

export function markPasteBatch(root: ParentNode, pasteId: string) {
  if (root instanceof HTMLElement) {
    root.dataset.pasteBatch = pasteId;
  }

  for (const element of root.querySelectorAll("*")) {
    if (element instanceof HTMLElement) {
      element.dataset.pasteBatch = pasteId;
    }
  }
}

export function preparePasteFragment(html: string, pasteId: string) {
  const template = document.createElement("template");
  template.innerHTML = sanitizePastedHtml(html);

  const fragment = document.createDocumentFragment();

  while (template.content.firstChild) {
    const node = template.content.firstChild;

    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) {
        fragment.appendChild(node);
        continue;
      }

      const span = document.createElement("span");
      span.dataset.pasteBatch = pasteId;
      span.appendChild(node);
      fragment.appendChild(span);
      continue;
    }

    if (node instanceof HTMLElement) {
      markPasteBatch(node, pasteId);
    }

    fragment.appendChild(node);
  }

  return fragment;
}

export function insertPasteFragmentAtSelection(fragment: DocumentFragment) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const lastInsertedNode = fragment.lastChild;
  range.insertNode(fragment);

  if (!lastInsertedNode) return;

  range.setStartAfter(lastInsertedNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getPasteBatchSelector(pasteId: string) {
  return `[${PASTE_BATCH_ATTR}="${pasteId}"]`;
}

function cleanupPasteBatchElement(element: HTMLElement) {
  if (!element.style.cssText.trim()) {
    element.removeAttribute("style");
  }

  if (
    element.attributes.length === 1 &&
    element.hasAttribute(PASTE_BATCH_ATTR)
  ) {
    if (element.tagName === "SPAN" || element.tagName === "FONT") {
      unwrapElement(element);
    }
  }
}

export function stripFormattingInPasteBatch(
  editor: HTMLElement,
  pasteId: string,
) {
  let changed = false;
  const selector = getPasteBatchSelector(pasteId);
  const elements = Array.from(editor.querySelectorAll(selector)) as HTMLElement[];

  for (const element of [...elements].reverse()) {
    if (shouldSkipFontNormalization(element)) continue;

    if (FORMATTING_TAGS.has(element.tagName)) {
      unwrapElement(element);
      changed = true;
      continue;
    }

    if (element.tagName === "FONT") {
      unwrapElement(element);
      changed = true;
      continue;
    }

    if (element.hasAttribute("style")) {
      element.removeAttribute("style");
      changed = true;
    }

    cleanupPasteBatchElement(element);
  }

  return changed;
}

export function resetFontFamilyInPasteBatch(
  editor: HTMLElement,
  pasteId: string,
) {
  let changed = false;
  const selector = getPasteBatchSelector(pasteId);

  for (const element of Array.from(editor.querySelectorAll(selector))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    if (element.tagName === "FONT" && element.hasAttribute("face")) {
      element.removeAttribute("face");
      changed = true;
    }

    if (element.style.fontFamily) {
      element.style.removeProperty("font-family");
      changed = true;
    }

    cleanupPasteBatchElement(element);
  }

  return changed;
}

export function resetFontSizeInPasteBatch(
  editor: HTMLElement,
  pasteId: string,
) {
  let changed = false;
  const selector = getPasteBatchSelector(pasteId);

  for (const element of Array.from(editor.querySelectorAll(selector))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    if (element.tagName === "FONT" && element.hasAttribute("size")) {
      element.removeAttribute("size");
      changed = true;
    }

    if (element.style.fontSize) {
      element.style.removeProperty("font-size");
      changed = true;
    }

    cleanupPasteBatchElement(element);
  }

  return changed;
}

export function getPasteBatchPromptPosition(
  editor: HTMLElement,
  wrapper: HTMLElement,
  pasteId: string,
) {
  const selector = getPasteBatchSelector(pasteId);
  const lines = Array.from(
    editor.querySelectorAll(`:scope > .${DETAIL_LINE_CLASS}`),
  ).filter((line) => line.querySelector(selector));

  const targetLine = lines.at(-1);
  const wrapperRect = wrapper.getBoundingClientRect();

  if (targetLine instanceof HTMLElement) {
    const lineRect = targetLine.getBoundingClientRect();
    return {
      top: Math.max(8, lineRect.bottom - wrapperRect.top + 8),
      left: Math.max(8, lineRect.left - wrapperRect.left),
    };
  }

  const lastBatchElement = editor.querySelector(selector);
  if (lastBatchElement instanceof HTMLElement) {
    const rect = lastBatchElement.getBoundingClientRect();
    return {
      top: Math.max(8, rect.bottom - wrapperRect.top + 8),
      left: Math.max(8, rect.left - wrapperRect.left),
    };
  }

  return { top: 12, left: 12 };
}

export function clearPasteBatchMarkers(editor: HTMLElement, pasteId: string) {
  for (const element of Array.from(
    editor.querySelectorAll(getPasteBatchSelector(pasteId)),
  )) {
    if (element instanceof HTMLElement) {
      delete element.dataset.pasteBatch;
    }
  }
}

export function clearAllPasteBatchMarkers(editor: HTMLElement) {
  for (const element of Array.from(
    editor.querySelectorAll(`[${PASTE_BATCH_ATTR}]`),
  )) {
    if (element instanceof HTMLElement) {
      delete element.dataset.pasteBatch;
    }
  }
}

export function normalizeEditorFonts(editor: HTMLElement) {
  let changed = false;

  for (const element of Array.from(editor.querySelectorAll("font"))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    if (element.hasAttribute("face")) {
      element.removeAttribute("face");
      changed = true;
    }

    if (element.style.fontFamily) {
      element.style.removeProperty("font-family");
      changed = true;
    }

    if (
      element.attributes.length === 0 ||
      (element.attributes.length === 1 &&
        element.hasAttribute("style") &&
        !element.style.cssText.trim())
    ) {
      unwrapElement(element);
      changed = true;
      continue;
    }

    cleanupStyledElement(element);
  }

  for (const element of Array.from(editor.querySelectorAll("[style*='font']"))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    const fontFamily = element.style.fontFamily;
    if (fontFamily && !isDefaultAppFont(fontFamily)) {
      element.style.removeProperty("font-family");
      changed = true;
      cleanupStyledElement(element);
    }
  }

  return changed;
}
