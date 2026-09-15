import {
  applyInitialImageDisplaySize,
  ensureImageResizeHandles,
  waitForInitialImageDisplaySize,
} from "./detail-image-resize";
import {
  choosePasteLineParts,
  DETAIL_CLIPBOARD_ROOT_ATTR,
  htmlToPasteLineParts,
  normalizeTitlePasteText,
  plainTextToPasteLineParts,
  type PasteLinePart,
} from "./detail-paste";

export const DETAIL_LINE_CLASS = "detail-line";
export const MAX_LIST_INDENT_LEVEL = 16;

export type LineBlockType =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "checklist"
  | "image"
  | "code";

function generateLineId() {
  return crypto.randomUUID();
}

function createLineElement(html = "<br>", type: LineBlockType = "text") {
  const line = document.createElement("div");
  line.className = DETAIL_LINE_CLASS;
  line.dataset.lineId = generateLineId();
  if (type !== "text") {
    line.dataset.lineType = type;
  }
  line.innerHTML = html;
  return line;
}

function isBlankLinePart(part: string) {
  const trimmed = part.trim();
  if (!trimmed) return true;

  return (
    /^<br\s*\/?>$/i.test(trimmed) ||
    /^<div>\s*<br\s*\/?>\s*<\/div>$/i.test(trimmed) ||
    /^<div>\s*<\/div>$/i.test(trimmed)
  );
}

function stripTrailingLineBreakMarkup(html: string) {
  let result = html;
  let previous = "";

  while (result !== previous) {
    previous = result;
    result = result
      .replace(/(<br\s*\/?>\s*)+$/gi, "")
      .replace(/(<div>\s*<br\s*\/?>\s*<\/div>\s*)+$/gi, "")
      .trimEnd();
  }

  return result;
}

const LINE_BREAK_SENTINEL = "\u0000";

export function normalizeClipboardPlainText(plainText: string) {
  return plainText.replace(/\r\n?|\n/g, "\n");
}

export function splitClipboardPlainTextIntoLines(plainText: string) {
  const lines = normalizeClipboardPlainText(plainText).split("\n");

  // A single trailing newline is usually a paragraph terminator, not an extra
  // blank line. Without this, "hello\n" becomes two lines: "hello" and "".
  if (lines.length > 1 && lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

export function clipboardPlainTextHasLineBreaks(plainText: string) {
  return /\r\n|\n|\r/.test(plainText);
}

const CLIPBOARD_LIST_MARKER_LINE = /^\s*[-*•⁃]\s/;

export function clipboardPlainTextHasListMarkers(plainText: string) {
  if (!plainText.trim()) return false;

  return normalizeClipboardPlainText(plainText)
    .split("\n")
    .some((line) => CLIPBOARD_LIST_MARKER_LINE.test(line));
}

/** Prefer plain text when list markers are present — HTML paste drops "-" prefixes. */
export function shouldPreferPlainTextPaste(plainText: string, html: string) {
  if (!clipboardPlainTextHasListMarkers(plainText)) return false;
  if (/<img[\s>]/i.test(html)) return false;

  return true;
}

function normalizeBlockBreaksInHtml(html: string) {
  return html
    .replace(/\r\n/g, "\n")
    // Clipboard HTML often pretty-prints tags on separate lines; those newlines
    // are not blank lines and must not become extra breaks on top of <p>/<br>.
    .replace(/>\s*\n+\s*</g, "><")
    .replace(/<p[^>]*>\s*<br\b[^>]*>\s*<\/p>/gi, LINE_BREAK_SENTINEL)
    .replace(/<div[^>]*>\s*<br\b[^>]*>\s*<\/div>/gi, LINE_BREAK_SENTINEL)
    .replace(/<br\b[^>]*>/gi, LINE_BREAK_SENTINEL)
    .replace(/<\/p>\s*/gi, LINE_BREAK_SENTINEL)
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/div>\s*<div[^>]*>/gi, LINE_BREAK_SENTINEL)
    .replace(/<\/div>/gi, LINE_BREAK_SENTINEL)
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/li>\s*<li\b[^>]*>/gi, LINE_BREAK_SENTINEL)
    .replace(/<\/li>/gi, LINE_BREAK_SENTINEL)
    .replace(/<li\b[^>]*>/gi, "")
    .replace(/<\/ul>\s*/gi, LINE_BREAK_SENTINEL)
    .replace(/<ul\b[^>]*>/gi, "")
    .replace(/<\/ol>\s*/gi, LINE_BREAK_SENTINEL)
    .replace(/<ol\b[^>]*>/gi, "")
    .replace(/\n/g, LINE_BREAK_SENTINEL);
}

function htmlToLineParts(html: string) {
  if (!html.trim()) return ["<br>"];

  const withoutTrailingBreaks = stripTrailingLineBreakMarkup(html);
  if (!withoutTrailingBreaks.trim()) return ["<br>"];

  const normalized = normalizeBlockBreaksInHtml(withoutTrailingBreaks);

  const parts = normalized.split(LINE_BREAK_SENTINEL).map((part) => part.trim());

  while (parts.length > 1 && isBlankLinePart(parts[parts.length - 1])) {
    parts.pop();
  }

  return parts.length > 0 ? parts.map((part) => part || "<br>") : ["<br>"];
}

export function getLineElements(editor: HTMLElement) {
  return Array.from(
    editor.querySelectorAll(`:scope > .${DETAIL_LINE_CLASS}`),
  ) as HTMLElement[];
}

export function getLineById(editor: HTMLElement, lineId: string) {
  return (
    getLineElements(editor).find((line) => line.dataset.lineId === lineId) ??
    null
  );
}

function cleanupEmptyPastedListContainers(editor: HTMLElement) {
  for (const list of editor.querySelectorAll("ul, ol")) {
    if (!(list instanceof HTMLElement)) continue;
    if ((list.textContent ?? "").replace(/\u00a0|\u200B/g, " ").trim()) {
      continue;
    }
    list.remove();
  }
}

export function repairPastedEditorStructure(editor: HTMLElement) {
  absorbOrphanEditorNodes(editor);
  cleanupEmptyPastedListContainers(editor);
}

function absorbOrphanEditorNodes(editor: HTMLElement) {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const orphanNodes: Node[] = [];

  for (const child of [...editor.childNodes]) {
    if (
      child instanceof HTMLElement &&
      child.classList.contains(DETAIL_LINE_CLASS)
    ) {
      continue;
    }

    if (
      child.nodeType === Node.TEXT_NODE &&
      !(child.textContent ?? "").replace(/\u00a0|\u200B/g, " ").trim()
    ) {
      child.remove();
      continue;
    }

    orphanNodes.push(child);
  }

  if (orphanNodes.length === 0) {
    return false;
  }

  const wrapper = document.createElement("div");
  for (const node of orphanNodes) {
    wrapper.appendChild(node);
  }

  const parts = htmlToLineParts(wrapper.innerHTML);
  const lines = getLineElements(editor);
  let previousLine = lines[lines.length - 1] ?? lines[0];

  if (!previousLine) {
    previousLine = createLineElement("<br>", "text");
    editor.appendChild(previousLine);
  }

  for (const part of parts) {
    const newLine = createLineElement(part, "text");
    previousLine.after(newLine);
    previousLine = newLine;
  }

  splitBlockLinesOnBreaks(editor);
  return true;
}

export function ensureBlockLines(editor: HTMLElement) {
  const existingLines = getLineElements(editor);

  if (existingLines.length > 0) {
    existingLines.forEach((line) => {
      if (!line.dataset.lineId) {
        line.dataset.lineId = generateLineId();
      }
    });
    flattenNestedDetailLines(editor);
    normalizeImageLines(editor);
    return;
  }

  const parts = htmlToLineParts(editor.innerHTML);
  editor.innerHTML = "";
  parts.forEach((part) => {
    editor.appendChild(createLineElement(part));
  });
}

export function splitBlockLinesOnBreaks(editor: HTMLElement) {
  ensureBlockLines(editor);

  const lines = getLineElements(editor);
  let changed = false;

  for (const line of [...lines]) {
    if (line.querySelector(".detail-image-wrapper") || isCodeLine(line)) {
      continue;
    }

    const parts = htmlToLineParts(line.innerHTML);
    if (parts.length <= 1) continue;

    const lineType = (line.dataset.lineType as LineBlockType | undefined) ?? "text";
    line.innerHTML = parts[0];

    let previousLine = line;
    for (let index = 1; index < parts.length; index += 1) {
      const newLine = createLineElement(parts[index], "text");

      if (lineType !== "text" && lineType !== "h1") {
        applyBlockTypeToLine(newLine, lineType, getLineElements(editor));
      }

      previousLine.after(newLine);
      previousLine = newLine;
    }

    changed = true;
  }

  if (changed) {
    syncLineEmptyState(editor);
  }

  return changed;
}

export function getActiveLineElement(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.focusNode || !editor.contains(selection.focusNode)) {
    return null;
  }

  let node: Node | null = selection.focusNode;

  while (node && node !== editor) {
    if (
      node instanceof HTMLElement &&
      node.classList.contains(DETAIL_LINE_CLASS)
    ) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}

export type DetailTextBlockType = "text" | "h1" | "h2" | "h3";

export function getActiveTextBlockType(
  editor: HTMLElement,
): DetailTextBlockType {
  const line = getActiveLineElement(editor);
  if (!line) return "text";

  if (isTitleLine(editor, line)) {
    return "h1";
  }

  const type = line.dataset.lineType;
  if (type === "h1" || type === "h2" || type === "h3") {
    return type;
  }

  return "text";
}

export function getLineElementAtPoint(editor: HTMLElement, clientY: number) {
  const lines = getLineElements(editor);

  for (const line of lines) {
    const rect = line.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return line;
    }
  }

  return null;
}

function mapFilteredDropIndex(
  filteredIndex: number,
  sourceIndex: number | null,
) {
  if (sourceIndex === null) return filteredIndex;

  return filteredIndex >= sourceIndex ? filteredIndex + 1 : filteredIndex;
}

export function getDropIndex(
  clientY: number,
  lines: HTMLElement[],
  draggingIndex: number | null = null,
) {
  if (draggingIndex !== null) {
    for (let index = 0; index < lines.length; index += 1) {
      if (index === draggingIndex) continue;

      const rect = lines[index].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return index > draggingIndex ? index + 1 : index;
      }
    }

    const filteredLines = lines.filter((_, index) => index !== draggingIndex);

    for (let index = 0; index < filteredLines.length; index += 1) {
      const rect = filteredLines[index].getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        return mapFilteredDropIndex(index, draggingIndex);
      }
    }

    return mapFilteredDropIndex(filteredLines.length, draggingIndex);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rect = lines[index].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) {
      return index;
    }
  }

  return lines.length;
}

export function reorderLine(
  editor: HTMLElement,
  sourceIndex: number,
  dropIndex: number,
) {
  const lines = getLineElements(editor);
  if (sourceIndex < 0 || sourceIndex >= lines.length) return false;

  let targetIndex = dropIndex;
  if (sourceIndex < dropIndex) {
    targetIndex -= 1;
  }

  if (targetIndex === sourceIndex) return false;

  const moved = lines[sourceIndex];
  moved.remove();

  const remaining = getLineElements(editor);

  if (targetIndex >= remaining.length) {
    editor.appendChild(moved);
  } else {
    remaining[targetIndex].before(moved);
  }

  return true;
}

export function getLineIndex(editor: HTMLElement, line: HTMLElement) {
  return getLineElements(editor).indexOf(line);
}

export function isTitleLine(
  editor: HTMLElement,
  line: HTMLElement | null | undefined,
) {
  if (!line || !editor.contains(line)) return false;
  return getLineIndex(editor, line) === 0;
}

function getNumberForLine(lines: HTMLElement[], lineIndex: number) {
  if (
    lineIndex > 0 &&
    lines[lineIndex - 1].dataset.lineType === "numbered"
  ) {
    const previous = Number(lines[lineIndex - 1].dataset.listNumber ?? "1");
    return Number.isFinite(previous) ? previous + 1 : 1;
  }

  return 1;
}

function clearLineBlockType(line: HTMLElement) {
  unwrapChecklistTextWrapper(line);
  delete line.dataset.lineType;
  delete line.dataset.listNumber;
  delete line.dataset.listIndent;
  delete line.dataset.checked;
}

export function isListBlockLine(line: HTMLElement | null | undefined) {
  if (!line) return false;

  const type = line.dataset.lineType;
  return type === "bullet" || type === "numbered" || type === "checklist";
}

export function getListIndentLevel(line: HTMLElement) {
  const parsed = Number.parseInt(line.dataset.listIndent ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(MAX_LIST_INDENT_LEVEL, parsed);
}

export function setListIndentLevel(line: HTMLElement, level: number) {
  const clamped = Math.max(0, Math.min(MAX_LIST_INDENT_LEVEL, level));

  if (clamped === 0) {
    delete line.dataset.listIndent;
    return;
  }

  line.dataset.listIndent = String(clamped);
}

export function copyListIndent(fromLine: HTMLElement, toLine: HTMLElement) {
  setListIndentLevel(toLine, getListIndentLevel(fromLine));
}

function canIncreaseListIndent(editor: HTMLElement, line: HTMLElement) {
  if (!isListBlockLine(line) || isTitleLine(editor, line)) {
    return false;
  }

  const currentLevel = getListIndentLevel(line);
  if (currentLevel >= MAX_LIST_INDENT_LEVEL) {
    return false;
  }

  const lines = getLineElements(editor);
  const index = lines.indexOf(line);
  if (index <= 0) {
    return false;
  }

  const previousLine = lines[index - 1];
  if (isTitleLine(editor, previousLine)) {
    return false;
  }

  const previousLevel = isListBlockLine(previousLine)
    ? getListIndentLevel(previousLine)
    : 0;

  return currentLevel < previousLevel + 1;
}

export function indentListLines(
  editor: HTMLElement,
  lines: HTMLElement[],
  delta: number,
) {
  if (lines.length === 0 || delta === 0) {
    return false;
  }

  const ordered = [...lines].sort(
    (left, right) => getLineIndex(editor, left) - getLineIndex(editor, right),
  );

  let changed = false;

  if (delta > 0) {
    for (const line of ordered) {
      if (!isListBlockLine(line)) continue;

      if (canIncreaseListIndent(editor, line)) {
        setListIndentLevel(line, getListIndentLevel(line) + 1);
        changed = true;
      }
    }
    return changed;
  }

  for (const line of [...ordered].reverse()) {
    if (!isListBlockLine(line)) continue;

    const currentLevel = getListIndentLevel(line);
    if (currentLevel > 0) {
      setListIndentLevel(line, currentLevel - 1);
      changed = true;
    }
  }

  return changed;
}

export function getSelectedListBlockLines(
  editor: HTMLElement,
  range?: Range | null,
) {
  const selection = window.getSelection();
  const activeRange =
    range ?? (selection?.rangeCount ? selection.getRangeAt(0) : null);

  if (!activeRange) {
    return [];
  }

  return getSelectedBlockLinesInRange(editor, activeRange).filter((line) =>
    isListBlockLine(line),
  );
}

export function clearListBlockTypesFromLines(lines: HTMLElement[]) {
  let changed = false;

  for (const line of lines) {
    const type = line.dataset.lineType;
    if (type === "bullet" || type === "numbered" || type === "checklist") {
      clearLineBlockType(line);
      changed = true;
    }
  }

  return changed;
}

export function renumberNumberedLines(editor: HTMLElement) {
  const lines = getLineElements(editor);
  let counter = 0;

  for (const line of lines) {
    if (line.dataset.lineType === "numbered") {
      counter += 1;
      line.dataset.listNumber = String(counter);
    } else {
      counter = 0;
    }
  }
}

function applyBlockTypeToLine(
  line: HTMLElement,
  type: LineBlockType,
  lines: HTMLElement[],
  numberedStart?: number,
) {
  if (type === "text") {
    clearLineBlockType(line);
    return;
  }

  line.dataset.lineType = type;

  if (type === "numbered") {
    const lineIndex = lines.indexOf(line);
    line.dataset.listNumber = String(
      numberedStart ?? getNumberForLine(lines, lineIndex),
    );
    delete line.dataset.checked;
    return;
  }

  delete line.dataset.listNumber;

  if (type === "checklist") {
    line.dataset.checked = line.dataset.checked ?? "false";
    ensureChecklistTextWrapper(line);
    return;
  }

  delete line.dataset.checked;
}

function codeLineNeedsNormalization(line: HTMLElement) {
  return Boolean(
    line.querySelector(
      "span, b, strong, i, em, u, mark, s, strike, a, div, p, img, script, style, font",
    ),
  );
}

export function isCodeLine(line: HTMLElement | null) {
  return line?.dataset.lineType === "code";
}

export function isChecklistLine(line: HTMLElement | null) {
  return line?.dataset.lineType === "checklist";
}

const CHECKLIST_TEXT_CLASS = "detail-checklist-text";

function ensureChecklistTextWrapper(line: HTMLElement) {
  if (!isChecklistLine(line)) return;

  const existing = line.querySelector(`:scope > .${CHECKLIST_TEXT_CLASS}`);
  if (existing instanceof HTMLElement) return;

  const wrapper = document.createElement("span");
  wrapper.className = CHECKLIST_TEXT_CLASS;

  while (line.firstChild) {
    wrapper.appendChild(line.firstChild);
  }

  if (!wrapper.childNodes.length) {
    wrapper.innerHTML = "<br>";
  }

  line.appendChild(wrapper);
}

function unwrapChecklistTextWrapper(line: HTMLElement) {
  const wrapper = line.querySelector(`:scope > .${CHECKLIST_TEXT_CLASS}`);
  if (!(wrapper instanceof HTMLElement)) return;

  while (wrapper.firstChild) {
    line.insertBefore(wrapper.firstChild, wrapper);
  }

  wrapper.remove();
}

function normalizeChecklistLine(line: HTMLElement) {
  if (!isChecklistLine(line)) return false;

  ensureChecklistTextWrapper(line);
  return true;
}

function normalizeChecklistLines(editor: HTMLElement) {
  getLineElements(editor).forEach((line) => {
    normalizeChecklistLine(line);
  });
}

export function toggleChecklistLine(line: HTMLElement) {
  if (!isChecklistLine(line)) return false;

  line.dataset.checked = line.dataset.checked === "true" ? "false" : "true";
  return true;
}

const CHECKLIST_TOGGLE_WIDTH_PX = 24;

export function isChecklistToggleClick(line: HTMLElement, clientX: number) {
  if (!isChecklistLine(line)) return false;

  const rect = line.getBoundingClientRect();
  return clientX - rect.left <= CHECKLIST_TOGGLE_WIDTH_PX;
}

export function normalizeCodeLine(line: HTMLElement) {
  if (line.dataset.lineType !== "code") return false;
  if (!codeLineNeedsNormalization(line)) return false;

  const text = line.innerText.replace(/\r\n/g, "\n").replace(/\n$/, "");
  line.textContent = text;
  if (!line.textContent) {
    line.innerHTML = "<br>";
  }

  return true;
}

function normalizeCodeLines(editor: HTMLElement) {
  getLineElements(editor).forEach((line) => {
    normalizeCodeLine(line);
  });
}

function getLineElementForNode(
  editor: HTMLElement,
  node: Node,
): HTMLElement | null {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (
      current instanceof HTMLElement &&
      current.classList.contains(DETAIL_LINE_CLASS)
    ) {
      return current;
    }
    current = current.parentNode;
  }

  return null;
}

function lineMatchesListSelection(line: HTMLElement, editor: HTMLElement) {
  if (isTitleLine(editor, line)) return false;
  if (isCodeLine(line)) return false;
  if (line.querySelector(".detail-image-wrapper")) return false;
  return true;
}

function getLineElementForRangeBoundary(
  editor: HTMLElement,
  range: Range,
  boundary: "start" | "end",
) {
  const container =
    boundary === "start" ? range.startContainer : range.endContainer;
  const offset = boundary === "start" ? range.startOffset : range.endOffset;

  if (container === editor) {
    const childCount = editor.childNodes.length;
    if (childCount === 0) return null;

    const childIndex =
      boundary === "start"
        ? Math.min(offset, childCount - 1)
        : Math.max(0, Math.min(offset - 1, childCount - 1));
    const child = editor.childNodes[childIndex];

    if (child instanceof HTMLElement) {
      if (child.classList.contains(DETAIL_LINE_CLASS)) {
        return child;
      }

      return getLineElementForNode(editor, child);
    }

    return null;
  }

  return getLineElementForNode(editor, container);
}

function getFullLinesInRange(editor: HTMLElement, range: Range) {
  ensureBlockLines(editor);

  if (range.collapsed) {
    const activeLine = getActiveLineElement(editor);
    if (!activeLine || !lineMatchesListSelection(activeLine, editor)) {
      return [];
    }

    return [activeLine];
  }

  const intersectingLines = getLineElements(editor).filter((line) => {
    if (!lineMatchesListSelection(line, editor)) return false;

    try {
      return range.intersectsNode(line);
    } catch {
      return false;
    }
  });

  if (intersectingLines.length > 0) {
    return intersectingLines;
  }

  const startLine = getLineElementForRangeBoundary(editor, range, "start");
  const endLine = getLineElementForRangeBoundary(editor, range, "end");
  if (!startLine || !endLine) {
    return [];
  }

  const lines = getLineElements(editor);
  const startIndex = lines.indexOf(startLine);
  const endIndex = lines.indexOf(endLine);
  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  return lines.slice(from, to + 1).filter((line) => lineMatchesListSelection(line, editor));
}

export function getSelectedBlockLinesInRange(editor: HTMLElement, range: Range) {
  return getFullLinesInRange(editor, range);
}

function isListBlockType(type: LineBlockType) {
  return type === "bullet" || type === "numbered" || type === "checklist";
}

function rangeToInnerHtml(range: Range) {
  const fragment = range.cloneContents();
  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);
  const html = wrapper.innerHTML.trim();
  return html || "<br>";
}

function isWholeLineSelected(line: HTMLElement, range: Range) {
  const lineRange = document.createRange();
  lineRange.selectNodeContents(line);

  return (
    range.compareBoundaryPoints(Range.START_TO_START, lineRange) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, lineRange) >= 0
  );
}

export function getLineSelectionRange(line: HTMLElement, range: Range) {
  const lineRange = document.createRange();
  lineRange.selectNodeContents(line);

  const selectedRange = document.createRange();
  selectedRange.setStart(
    range.compareBoundaryPoints(Range.START_TO_START, lineRange) <= 0
      ? lineRange.startContainer
      : range.startContainer,
    range.compareBoundaryPoints(Range.START_TO_START, lineRange) <= 0
      ? lineRange.startOffset
      : range.startOffset,
  );
  selectedRange.setEnd(
    range.compareBoundaryPoints(Range.END_TO_END, lineRange) >= 0
      ? lineRange.endContainer
      : range.endContainer,
    range.compareBoundaryPoints(Range.END_TO_END, lineRange) >= 0
      ? lineRange.endOffset
      : range.endOffset,
  );

  return selectedRange;
}

function lineSelectionRange(line: HTMLElement, range: Range) {
  return getLineSelectionRange(line, range);
}

function isEmptySplitHtml(html: string) {
  return isLineEmpty(createLineElement(html));
}

function createLineFromSplit(
  html: string,
  sourceLine: HTMLElement,
  preserveBlockType: boolean,
) {
  const sourceType =
    (sourceLine.dataset.lineType as LineBlockType | undefined) ?? "text";
  const type = preserveBlockType && sourceType !== "text" ? sourceType : "text";
  const line = createLineElement(html, type);

  if (preserveBlockType && sourceType === "checklist") {
    line.dataset.checked = sourceLine.dataset.checked ?? "false";
  }

  if (preserveBlockType && sourceType === "numbered") {
    const editor = sourceLine.parentElement;
    const lines = editor ? getLineElements(editor) : [];
    line.dataset.listNumber = String(
      getNumberForLine(lines, Math.max(0, lines.indexOf(sourceLine))),
    );
  }

  if (preserveBlockType && isListBlockLine(sourceLine)) {
    copyListIndent(sourceLine, line);
  }

  return line;
}

function splitLineForBlockTypeRange(
  line: HTMLElement,
  range: Range,
): HTMLElement[] {
  if (isWholeLineSelected(line, range)) {
    return [line];
  }

  const lineRange = document.createRange();
  lineRange.selectNodeContents(line);

  const beforeRange = document.createRange();
  beforeRange.setStart(lineRange.startContainer, lineRange.startOffset);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const selectedRange = lineSelectionRange(line, range);

  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEnd(lineRange.endContainer, lineRange.endOffset);

  const beforeHtml = rangeToInnerHtml(beforeRange);
  const selectedHtml = rangeToInnerHtml(selectedRange);
  const afterHtml = rangeToInnerHtml(afterRange);

  const beforeLine = isEmptySplitHtml(beforeHtml)
    ? null
    : createLineFromSplit(beforeHtml, line, true);
  const selectedLine = createLineElement(selectedHtml);
  const afterLine = isEmptySplitHtml(afterHtml)
    ? null
    : createLineFromSplit(afterHtml, line, true);

  const replacementLines: HTMLElement[] = [];
  if (beforeLine) {
    replacementLines.push(beforeLine);
  }
  replacementLines.push(selectedLine);
  if (afterLine) {
    replacementLines.push(afterLine);
  }

  line.replaceWith(...replacementLines);

  return [selectedLine];
}

function getTargetLinesForBlockType(editor: HTMLElement, range: Range) {
  ensureBlockLines(editor);

  if (range.collapsed) {
    const activeLine = getActiveLineElement(editor);
    return activeLine ? [activeLine] : [];
  }

  const intersectingLines = getLineElements(editor).filter((line) =>
    range.intersectsNode(line),
  );
  const targetLines: HTMLElement[] = [];

  for (let index = intersectingLines.length - 1; index >= 0; index -= 1) {
    const line = intersectingLines[index];

    if (line.querySelector(".detail-image-wrapper") || isCodeLine(line)) {
      continue;
    }

    if (isTitleLine(editor, line)) {
      continue;
    }

    targetLines.unshift(...splitLineForBlockTypeRange(line, range));
  }

  return targetLines;
}

export function getLinesInSelection(editor: HTMLElement) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];

  const activeLine = getActiveLineElement(editor);
  if (!activeLine) return [];

  if (selection.isCollapsed) {
    return [activeLine];
  }

  return getTargetLinesForBlockType(editor, selection.getRangeAt(0));
}

export function applyBlockTypeToSelection(
  editor: HTMLElement,
  type: LineBlockType,
  selectionRange?: Range | null,
  explicitLines?: HTMLElement[],
) {
  ensureBlockLines(editor);

  let selectedLines: HTMLElement[];
  const useFullLines = isListBlockType(type);

  if (explicitLines && explicitLines.length > 0) {
    selectedLines = explicitLines.filter((line) =>
      editor.contains(line) && lineMatchesListSelection(line, editor),
    );
  } else if (
    selectionRange &&
    editor.contains(selectionRange.commonAncestorContainer)
  ) {
    selectedLines = useFullLines
      ? getFullLinesInRange(editor, selectionRange)
      : getTargetLinesForBlockType(editor, selectionRange);
  } else {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      selectedLines = [];
    } else if (useFullLines) {
      selectedLines = getFullLinesInRange(editor, selection.getRangeAt(0));
    } else {
      selectedLines = getLinesInSelection(editor);
    }
  }

  if (selectedLines.length === 0) return;

  const allAlreadyType = selectedLines.every(
    (line) => line.dataset.lineType === type,
  );

  if (allAlreadyType) {
    selectedLines.forEach((line) => {
      clearLineBlockType(line);
    });
    return;
  }

  const allLines = getLineElements(editor);
  let nextNumber =
    type === "numbered"
      ? getNumberForLine(allLines, allLines.indexOf(selectedLines[0]))
      : 1;

  selectedLines.forEach((line) => {
    if (line.querySelector(".detail-image-wrapper")) return;

    if (type === "numbered") {
      applyBlockTypeToLine(line, type, allLines, nextNumber);
      nextNumber += 1;
      return;
    }

    applyBlockTypeToLine(line, type, allLines);
    if (type === "code") {
      normalizeCodeLine(line);
    }
  });
}

export function insertLineBelowLine(editor: HTMLElement, line: HTMLElement) {
  insertTypedLineBelowLine(editor, line, "text");
}

export function insertLineBeforeBodyPlaceholder(
  editor: HTMLElement,
  placeholderLine: HTMLElement,
) {
  ensureBlockLines(editor);

  const lineType =
    (placeholderLine.dataset.lineType as LineBlockType | undefined) ?? "text";
  const newLine = createLineElement(
    "<br>",
    lineType === "h1" ? "text" : lineType,
  );

  if (lineType === "numbered") {
    newLine.dataset.listNumber = String(
      getNextListNumber(editor, placeholderLine),
    );
  }

  if (lineType === "checklist") {
    newLine.dataset.checked = "false";
  }

  placeholderLine.before(newLine);
  placeCaretInLine(newLine);
}

export function handleClickBelowLastLine(
  editor: HTMLElement,
  clientY: number,
): "inserted" | "focused" | null {
  ensureBlockLines(editor);

  const lines = getLineElements(editor);
  const lastLine = lines[lines.length - 1];
  if (!lastLine) return null;

  const lastRect = lastLine.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();

  if (clientY <= lastRect.bottom || clientY > editorRect.bottom) {
    return null;
  }

  editor.focus();

  const lastLineHasContent =
    !isDetailLineEmpty(lastLine) ||
    lastLine.querySelector(".detail-image-wrapper") !== null;

  if (lastLineHasContent) {
    insertLineBelowLine(editor, lastLine);
    return "inserted";
  }

  placeCaretInLine(lastLine);
  return "focused";
}

function getNextListNumber(editor: HTMLElement, afterLine: HTMLElement) {
  const lines = getLineElements(editor);
  const afterIndex = lines.indexOf(afterLine);

  if (afterIndex >= 0 && lines[afterIndex].dataset.lineType === "numbered") {
    const current = Number(lines[afterIndex].dataset.listNumber ?? "1");
    return Number.isFinite(current) ? current + 1 : 1;
  }

  return 1;
}

export function insertTypedLineBelowLine(
  editor: HTMLElement,
  line: HTMLElement,
  type: LineBlockType,
) {
  ensureBlockLines(editor);

  const newLine = createLineElement("<br>", type);

  if (type === "numbered") {
    newLine.dataset.listNumber = String(getNextListNumber(editor, line));
  }

  if (type === "checklist") {
    newLine.dataset.checked = "false";
  }

  line.after(newLine);
  if (isListBlockLine(line)) {
    copyListIndent(line, newLine);
  }
  focusDetailLine(editor, newLine);
}

export function insertLineBelow(editor: HTMLElement) {
  ensureBlockLines(editor);

  const activeLine = getActiveLineElement(editor);
  if (activeLine) {
    insertLineBelowLine(editor, activeLine);
    return;
  }

  const newLine = createLineElement("<br>");
  editor.appendChild(newLine);
  focusDetailLine(editor, newLine);
}

export function enterFromTitleLine(editor: HTMLElement) {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const lines = getLineElements(editor);
  const titleLine = lines[0];
  if (!titleLine) return;

  const firstBodyLine = lines[1];
  if (!firstBodyLine) {
    insertLineBelowLine(editor, titleLine);
    return;
  }

  if (isBodyPlaceholderLine(firstBodyLine)) {
    insertLineBeforeBodyPlaceholder(editor, firstBodyLine);
    return;
  }

  if (isLineEmpty(firstBodyLine)) {
    placeCaretInLine(firstBodyLine);
    return;
  }

  insertLineBelowLine(editor, titleLine);
}

export function splitLineAtCursor(editor: HTMLElement) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const activeLine = getActiveLineElement(editor);
  if (!activeLine) return;

  if (isTitleLine(editor, activeLine)) {
    enterFromTitleLine(editor);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!activeLine.contains(range.startContainer)) return;

  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(activeLine);
  afterRange.setStart(range.endContainer, range.endOffset);

  const afterContent = afterRange.cloneContents();
  const afterWrapper = document.createElement("div");
  afterWrapper.appendChild(afterContent);
  const afterHtml = afterWrapper.innerHTML.trim() || "<br>";

  afterRange.deleteContents();

  if (!activeLine.innerHTML.trim()) {
    activeLine.innerHTML = "<br>";
  }

  const newLine = createLineElement(afterHtml);
  const lineType = activeLine.dataset.lineType as LineBlockType | undefined;

  if (lineType && lineType !== "text") {
    applyBlockTypeToLine(newLine, lineType, getLineElements(editor));
  }

  if (lineType === "checklist") {
    newLine.dataset.checked = "false";
  }

  if (isListBlockLine(activeLine)) {
    copyListIndent(activeLine, newLine);
  }

  activeLine.after(newLine);

  if (lineType === "code") {
    normalizeCodeLine(activeLine);
    normalizeCodeLine(newLine);
  }

  placeCaretInLine(newLine);
}

function hasNonPlaceholderBodyContentBelow(
  editor: HTMLElement,
  fromIndex: number,
) {
  const lines = getLineElements(editor);
  return lines
    .slice(fromIndex + 1)
    .some(
      (line) => !isBodyPlaceholderLine(line) && isBodyLineWithContent(line),
    );
}

export function removeLeadingEmptyBodyLineOnBackspace(
  editor: HTMLElement,
): boolean {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const activeLine = getActiveLineElement(editor);
  if (!activeLine || isTitleLine(editor, activeLine)) {
    return false;
  }

  const lines = getLineElements(editor);
  const lineIndex = lines.indexOf(activeLine);
  if (lineIndex !== 1) {
    return false;
  }

  if (!isEmptyEditableBodyLine(editor, activeLine)) {
    return false;
  }

  if (!hasNonPlaceholderBodyContentBelow(editor, lineIndex)) {
    return false;
  }

  const nextLine = lines[2];
  if (!nextLine) {
    return false;
  }

  activeLine.remove();
  placeCaretInLine(nextLine);
  renumberNumberedLines(editor);
  return true;
}

function mergeLineHtml(existingHtml: string, appendedHtml: string) {
  const left = existingHtml.trim();
  const right = appendedHtml.trim();

  if (!left || left === "<br>") {
    return right || "<br>";
  }

  if (!right || right === "<br>") {
    return left;
  }

  return left + right;
}

function inheritLineBlockTypeFromSource(
  newLine: HTMLElement,
  sourceLine: HTMLElement,
  editor: HTMLElement,
) {
  const sourceLineType =
    (sourceLine.dataset.lineType as LineBlockType | undefined) ?? "text";

  if (sourceLineType === "text" || sourceLineType === "h1") {
    return;
  }

  applyBlockTypeToLine(newLine, sourceLineType, getLineElements(editor));

  if (sourceLineType === "checklist") {
    newLine.dataset.checked = "false";
  }
}

function createLineFromPastePart(
  part: PasteLinePart,
  sourceLine: HTMLElement,
  editor: HTMLElement,
) {
  const line = createLineElement(part.html);

  if (part.lineType && part.lineType !== "text") {
    applyBlockTypeToLine(line, part.lineType, getLineElements(editor));

    if (part.lineType === "checklist") {
      line.dataset.checked = part.checked ? "true" : "false";
    }

    if (part.listIndent && part.listIndent > 0) {
      setListIndentLevel(line, part.listIndent);
    }
  } else {
    inheritLineBlockTypeFromSource(line, sourceLine, editor);
  }

  return line;
}

function markPasteBatchSubtree(root: HTMLElement, pasteId: string) {
  root.dataset.pasteBatch = pasteId;

  for (const element of root.querySelectorAll("*")) {
    if (element instanceof HTMLElement) {
      element.dataset.pasteBatch = pasteId;
    }
  }
}

export function resolveBodyPasteTarget(editor: HTMLElement) {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  let activeLine = getActiveLineElement(editor);
  const lines = getLineElements(editor);

  if (activeLine && (isTitleLine(editor, activeLine) || isCodeLine(activeLine))) {
    activeLine = null;
  }

  if (!activeLine) {
    const bodyLines = lines.slice(1).filter((line) => !isCodeLine(line));
    const selection = window.getSelection();
    const focusNode = selection?.focusNode ?? null;

    activeLine =
      bodyLines.find(
        (line) => focusNode && line.contains(focusNode),
      ) ??
      bodyLines.find((line) => isBodyPlaceholderLine(line)) ??
      bodyLines[0] ??
      null;

    if (activeLine) {
      editor.focus();
      placeCaretInLine(activeLine);
    }
  }

  if (!activeLine || isTitleLine(editor, activeLine) || isCodeLine(activeLine)) {
    return null;
  }

  const selection = window.getSelection();
  if (!selection) return null;

  if (selection.rangeCount === 0) {
    placeCaretInLine(activeLine);
  }

  if (!selection.rangeCount) return null;

  let range = selection.getRangeAt(0);
  if (!activeLine.contains(range.commonAncestorContainer)) {
    placeCaretInLine(activeLine);
    if (!selection.rangeCount) return null;
    range = selection.getRangeAt(0);
    if (!activeLine.contains(range.commonAncestorContainer)) {
      return null;
    }
  }

  return { line: activeLine, range: range.cloneRange() };
}

function insertHtmlFragmentAtRange(range: Range, html: string) {
  range.deleteContents();

  const temp = document.createElement("div");
  temp.innerHTML = html;
  const fragment = document.createDocumentFragment();

  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild);
  }

  range.insertNode(fragment);
  range.collapse(false);
}

export function insertTitleLinePaste(editor: HTMLElement, plainText: string) {
  ensureTitleLine(editor);

  const titleLine = getLineElements(editor)[0];
  if (!titleLine) return false;

  const normalized = normalizeTitlePasteText(plainText);
  if (!normalized) return false;

  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    if (titleLine.contains(range.commonAncestorContainer)) {
      range.deleteContents();
    }
  }

  titleLine.textContent = normalized;
  editor.focus();
  placeCaretAtEndOfLine(titleLine);
  return true;
}

export function captureEditorSelectionRange(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return null;
  }

  return range.cloneRange();
}

function insertLinePartsAtSelection(
  editor: HTMLElement,
  parts: PasteLinePart[],
  pasteId?: string,
  savedRange?: Range | null,
) {
  if (parts.length === 0) return false;

  let target: { line: HTMLElement; range: Range } | null = null;

  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    const line =
      getDetailLineFromNode(savedRange.startContainer, editor) ??
      getDetailLineFromNode(savedRange.endContainer, editor);

    if (line && !isTitleLine(editor, line) && !isCodeLine(line)) {
      target = { line, range: savedRange.cloneRange() };
    }
  }

  if (!target) {
    target = resolveBodyPasteTarget(editor);
  }

  if (!target) return false;

  const selection = window.getSelection();
  if (!selection) return false;

  selection.removeAllRanges();
  selection.addRange(target.range);

  const range = target.range;
  const selectedLines = getFullLinesInRange(editor, range).filter(
    (line) => !isTitleLine(editor, line) && !isCodeLine(line),
  );
  const activeLine = selectedLines[0] ?? target.line;
  const sourceLine = activeLine;

  if (selectedLines.length <= 1) {
    if (parts.length === 1) {
      insertHtmlFragmentAtRange(range, parts[0].html);
      selection.removeAllRanges();
      selection.addRange(range);
      if (parts[0].lineType && parts[0].lineType !== "text") {
        applyBlockTypeToLine(activeLine, parts[0].lineType, getLineElements(editor));
        if (parts[0].lineType === "checklist") {
          activeLine.dataset.checked = parts[0].checked ? "true" : "false";
        }
      }
      if (pasteId) {
        markPasteBatchSubtree(activeLine, pasteId);
      }
      return true;
    }

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(activeLine);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = document.createRange();
    afterRange.selectNodeContents(activeLine);
    afterRange.setStart(range.endContainer, range.endOffset);

    const beforeWrapper = document.createElement("div");
    beforeWrapper.appendChild(beforeRange.cloneContents());
    const beforeHtml = beforeWrapper.innerHTML;

    const afterWrapper = document.createElement("div");
    afterWrapper.appendChild(afterRange.cloneContents());
    const afterHtml = afterWrapper.innerHTML.trim() || "<br>";

    range.deleteContents();

    activeLine.innerHTML = mergeLineHtml(beforeHtml, parts[0].html);
    if (parts[0].lineType && parts[0].lineType !== "text") {
      applyBlockTypeToLine(activeLine, parts[0].lineType, getLineElements(editor));
      if (parts[0].lineType === "checklist") {
        activeLine.dataset.checked = parts[0].checked ? "true" : "false";
      }
    }
    if (pasteId) {
      markPasteBatchSubtree(activeLine, pasteId);
    }

    let previousLine = activeLine;

    for (let index = 1; index < parts.length - 1; index += 1) {
      const newLine = createLineFromPastePart(parts[index], sourceLine, editor);
      if (pasteId) {
        markPasteBatchSubtree(newLine, pasteId);
      }
      previousLine.after(newLine);
      previousLine = newLine;
    }

    const lastLine = createLineFromPastePart(
      {
        ...parts[parts.length - 1],
        html: mergeLineHtml(parts[parts.length - 1].html, afterHtml),
      },
      sourceLine,
      editor,
    );
    if (pasteId) {
      markPasteBatchSubtree(lastLine, pasteId);
    }
    previousLine.after(lastLine);
    placeCaretInLine(lastLine);
    return true;
  }

  const firstLine = selectedLines[0];
  const lastLine = selectedLines[selectedLines.length - 1];

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(firstLine);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.selectNodeContents(lastLine);
  afterRange.setStart(range.endContainer, range.endOffset);

  const beforeWrapper = document.createElement("div");
  beforeWrapper.appendChild(beforeRange.cloneContents());
  const beforeHtml = beforeWrapper.innerHTML;

  const afterWrapper = document.createElement("div");
  afterWrapper.appendChild(afterRange.cloneContents());
  const afterHtml = afterWrapper.innerHTML.trim() || "<br>";

  const allLines = getLineElements(editor);
  const firstIdx = allLines.indexOf(firstLine);
  const lastIdx = allLines.indexOf(lastLine);

  for (let index = lastIdx; index > firstIdx; index -= 1) {
    allLines[index]?.remove();
  }

  if (parts.length === 1) {
    firstLine.innerHTML = mergeLineHtml(
      mergeLineHtml(beforeHtml, parts[0].html),
      afterHtml,
    );
    if (parts[0].lineType && parts[0].lineType !== "text") {
      applyBlockTypeToLine(firstLine, parts[0].lineType, getLineElements(editor));
      if (parts[0].lineType === "checklist") {
        firstLine.dataset.checked = parts[0].checked ? "true" : "false";
      }
    }
    if (pasteId) {
      markPasteBatchSubtree(firstLine, pasteId);
    }
    placeCaretInLine(firstLine);
    return true;
  }

  firstLine.innerHTML = mergeLineHtml(beforeHtml, parts[0].html);
  if (parts[0].lineType && parts[0].lineType !== "text") {
    applyBlockTypeToLine(firstLine, parts[0].lineType, getLineElements(editor));
    if (parts[0].lineType === "checklist") {
      firstLine.dataset.checked = parts[0].checked ? "true" : "false";
    }
  }
  if (pasteId) {
    markPasteBatchSubtree(firstLine, pasteId);
  }

  let previousLine = firstLine;

  for (let index = 1; index < parts.length - 1; index += 1) {
    const newLine = createLineFromPastePart(parts[index], sourceLine, editor);
    if (pasteId) {
      markPasteBatchSubtree(newLine, pasteId);
    }
    previousLine.after(newLine);
    previousLine = newLine;
  }

  const trailingLine = createLineFromPastePart(
    {
      ...parts[parts.length - 1],
      html: mergeLineHtml(parts[parts.length - 1].html, afterHtml),
    },
    sourceLine,
    editor,
  );
  if (pasteId) {
    markPasteBatchSubtree(trailingLine, pasteId);
  }
  previousLine.after(trailingLine);
  placeCaretInLine(trailingLine);
  return true;
}

export function insertPlainTextAtSelection(
  editor: HTMLElement,
  plainText: string,
  savedRange?: Range | null,
) {
  return insertLinePartsAtSelection(
    editor,
    plainTextToPasteLineParts(plainText),
    undefined,
    savedRange,
  );
}

export function insertHtmlAtSelection(
  editor: HTMLElement,
  html: string,
  pasteId?: string,
  savedRange?: Range | null,
  plainText?: string | null,
) {
  return insertLinePartsAtSelection(
    editor,
    choosePasteLineParts(html, plainText),
    pasteId,
    savedRange,
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createImageDeleteButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "detail-image-delete";
  button.setAttribute("aria-label", "Delete image");
  button.setAttribute("title", "Delete image");
  button.contentEditable = "false";
  button.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 4l8 8M12 4 4 12" stroke-linecap="round" /></svg>';
  return button;
}

function wrapImageWithControls(image: HTMLImageElement) {
  let wrapper = image.parentElement;

  if (!wrapper?.classList.contains("detail-image-wrapper")) {
    wrapper = document.createElement("div");
    wrapper.className = "detail-image-wrapper";
    image.replaceWith(wrapper);
    wrapper.appendChild(image);
  }

  prepareBlockImageWrapper(wrapper);

  if (!wrapper.querySelector(".detail-image-delete")) {
    wrapper.appendChild(createImageDeleteButton());
  }

  ensureImageResizeHandles(wrapper);

  return wrapper;
}

function prepareBlockImageWrapper(wrapper: HTMLElement) {
  wrapper.contentEditable = "false";
  wrapper.classList.add("detail-image-wrapper");
  wrapper.style.removeProperty("float");
  wrapper.style.display = "block";
  wrapper.style.clear = "both";
  wrapper.style.removeProperty("margin-right");

  if (!wrapper.style.marginBottom) {
    wrapper.style.marginBottom = "0.35rem";
  }
}

function createImageWrapper(src: string) {
  const image = document.createElement("img");
  image.src = src;
  image.alt = "Embedded image";
  image.className = "detail-image";
  image.draggable = false;

  const wrapper = document.createElement("div");
  wrapper.className = "detail-image-wrapper";
  wrapper.appendChild(image);
  wrapper.appendChild(createImageDeleteButton());
  ensureImageResizeHandles(wrapper);
  prepareBlockImageWrapper(wrapper);

  return wrapper;
}

function ensureContentBelowWrapper(wrapper: HTMLElement) {
  let next = wrapper.nextSibling;

  while (
    next?.nodeType === Node.TEXT_NODE &&
    !(next.textContent ?? "").replace(/\u200B/g, "").trim()
  ) {
    const toRemove = next;
    next = next.nextSibling;
    toRemove.remove();
  }

  if (!next) {
    wrapper.after(document.createElement("br"));
  }
}

export function placeCaretBelowWrapper(wrapper: HTMLElement) {
  ensureContentBelowWrapper(wrapper);

  const line = wrapper.parentElement;
  const selection = window.getSelection();
  if (!line || !selection) return;

  const range = document.createRange();
  range.setStartAfter(wrapper);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertImageWrapperIntoLine(
  editor: HTMLElement,
  line: HTMLElement,
  wrapper: HTMLElement,
) {
  prepareBlockImageWrapper(wrapper);

  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

  if (range && line.contains(range.startContainer)) {
    range.deleteContents();
    range.insertNode(wrapper);
  } else {
    line.appendChild(wrapper);
  }

  placeCaretBelowWrapper(wrapper);
  editor.focus();
}

function migrateLegacyImageLine(line: HTMLElement) {
  if (line.dataset.lineType !== "image") return;

  delete line.dataset.lineType;
  line.removeAttribute("contenteditable");

  const wrapper = line.querySelector(".detail-image-wrapper");
  if (wrapper instanceof HTMLElement) {
    prepareBlockImageWrapper(wrapper);
    ensureContentBelowWrapper(wrapper);
  }
}

export function removeImageWrapper(editor: HTMLElement, wrapper: HTMLElement) {
  ensureBlockLines(editor);

  const line = wrapper.closest(`.${DETAIL_LINE_CLASS}`);
  if (!(line instanceof HTMLElement) || getLineIndex(editor, line) <= 0) {
    return false;
  }

  wrapper.remove();
  ensureTitleLine(editor);
  syncLineEmptyState(editor);
  placeCaretInLine(line);
  editor.focus();

  return true;
}

const CLIPBOARD_REVEAL_ATTR = "data-clipboard-reveal";

function startClipboardRevealAnimation(wrapper: HTMLElement) {
  wrapper.setAttribute(CLIPBOARD_REVEAL_ATTR, "true");

  const image = wrapper.querySelector("img.detail-image");
  if (!(image instanceof HTMLImageElement)) {
    wrapper.removeAttribute(CLIPBOARD_REVEAL_ATTR);
    return;
  }

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    wrapper.removeAttribute(CLIPBOARD_REVEAL_ATTR);
    image.removeEventListener("animationend", cleanup);
  };

  image.addEventListener("animationend", cleanup);
  window.setTimeout(cleanup, 650);
}

export async function insertImagesIntoEditor(
  editor: HTMLElement,
  imageSources: string[],
  referenceLine?: HTMLElement | null,
  options?: { fromClipboard?: boolean },
) {
  if (imageSources.length === 0) return;

  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const lines = getLineElements(editor);
  let targetLine =
    referenceLine && lines.includes(referenceLine)
      ? referenceLine
      : getActiveLineElement(editor);

  if (!targetLine || getLineIndex(editor, targetLine) === 0) {
    targetLine = lines[1] ?? createLineElement("<br>", "text");
    if (!lines.includes(targetLine)) {
      const titleLine = lines[0];
      if (titleLine) {
        titleLine.after(targetLine);
      } else {
        editor.appendChild(targetLine);
      }
    }
  }

  for (const source of imageSources) {
    const wrapper = createImageWrapper(source);
    const image = wrapper.querySelector("img.detail-image");
    if (image instanceof HTMLImageElement) {
      await waitForInitialImageDisplaySize(image);
    }

    insertImageWrapperIntoLine(editor, targetLine, wrapper);

    if (options?.fromClipboard) {
      startClipboardRevealAnimation(wrapper);
    }
  }

  syncLineEmptyState(editor);
}

function normalizeImageLines(editor: HTMLElement) {
  getLineElements(editor).forEach((line) => {
    migrateLegacyImageLine(line);

    const image = line.querySelector("img");

    if (image && line.dataset.lineType !== "h1") {
      if (line.dataset.lineType === "image") {
        delete line.dataset.lineType;
      }

      line.removeAttribute("contenteditable");

      if (!image.classList.contains("detail-image")) {
        image.classList.add("detail-image");
      }

      image.draggable = false;
      const wrapper = wrapImageWithControls(image);
      prepareBlockImageWrapper(wrapper);

      if (!image.style.width) {
        if (image.complete && image.naturalWidth > 0) {
          applyInitialImageDisplaySize(image);
        } else {
          image.addEventListener(
            "load",
            () => {
              if (!image.style.width) {
                applyInitialImageDisplaySize(image);
              }
            },
            { once: true },
          );
        }
      }
    }
  });
}

function isLineEmpty(line: HTMLElement) {
  if (line.querySelector("img")) {
    const clone = line.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".detail-image-wrapper").forEach((wrapper) => {
      wrapper.remove();
    });
    return !(clone.textContent ?? "")
      .replace(/\u00a0|\u200B/g, " ")
      .trim();
  }

  return !(line.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

export function isDetailLineEmpty(line: HTMLElement) {
  return isLineEmpty(line);
}

export function isBodyPlaceholderLine(line: HTMLElement) {
  const editor = line.parentElement;
  if (!editor) return false;

  const lines = getLineElements(editor);
  const index = lines.indexOf(line);
  if (index <= 0) return false;
  if (!isLineEmpty(line)) return false;
  if (!isBodyPlaceholderCandidateLine(line)) return false;

  return index === lines.length - 1;
}

export function isEmptyEditableBodyLine(
  editor: HTMLElement,
  line: HTMLElement | null | undefined,
) {
  if (!line || !editor.contains(line)) return false;
  if (isTitleLine(editor, line)) return false;
  if (!isBodyPlaceholderCandidateLine(line)) return false;
  return isLineEmpty(line);
}

export function getDetailLineFromNode(node: Node | null, editor: HTMLElement) {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (
      current instanceof HTMLElement &&
      current.classList.contains(DETAIL_LINE_CLASS)
    ) {
      return current;
    }
    current = current.parentNode;
  }

  return null;
}

export function isCaretAtStartOfLine(line: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return false;

  const { focusNode, focusOffset } = selection;
  if (!focusNode) return false;

  if (focusNode === line) {
    return focusOffset === 0;
  }

  if (focusNode.parentElement === line) {
    const childIndex = Array.from(line.childNodes).indexOf(focusNode as ChildNode);
    return childIndex === 0 && focusOffset === 0;
  }

  return false;
}

function normalizeEmptyLineForCaret(line: HTMLElement) {
  if (line.querySelector(".detail-image-wrapper")) return;

  if (!line.querySelector("br")) {
    line.innerHTML = "<br>";
    return;
  }

  if (!(line.textContent ?? "").replace(/[\u00a0\u200B]/g, " ").trim()) {
    line.textContent = "";
    line.innerHTML = "<br>";
  }
}

export function placeCaretInLine(line: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;

  if (isLineEmpty(line) || isBodyPlaceholderLine(line)) {
    normalizeEmptyLineForCaret(line);

    const range = document.createRange();
    range.setStart(line, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(line);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function placeCaretAtEndOfLine(line: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;

  if (isLineEmpty(line) && !line.querySelector("br")) {
    line.innerHTML = "<br>";
  }

  const range = document.createRange();
  const br = line.querySelector("br");

  if (isLineEmpty(line) && br) {
    range.setStartBefore(br);
    range.collapse(true);
  } else {
    range.selectNodeContents(line);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export function focusTaskTitle(editor: HTMLElement) {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const lines = getLineElements(editor);
  const titleLine = lines[0];
  if (!titleLine) return;

  editor.focus();
  placeCaretAtEndOfLine(titleLine);
}

export function focusNoteAtEnd(editor: HTMLElement) {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const lines = getLineElements(editor);
  const noteLines = lines.slice(1);
  if (noteLines.length === 0) return;

  let targetLine = noteLines[noteLines.length - 1];

  for (let index = noteLines.length - 1; index >= 0; index -= 1) {
    const line = noteLines[index];
    if (
      !isDetailLineEmpty(line) ||
      line.querySelector(".detail-image-wrapper") !== null
    ) {
      targetLine = line;
      break;
    }
  }

  editor.focus();

  const imageWrapper = targetLine.querySelector(
    ".detail-image-wrapper:last-of-type",
  ) as HTMLElement | null;

  if (imageWrapper && isDetailLineEmpty(targetLine)) {
    placeCaretBelowWrapper(imageWrapper);
    return;
  }

  placeCaretAtEndOfLine(targetLine);
}

export function focusDetailLine(editor: HTMLElement, line: HTMLElement) {
  editor.focus();
  placeCaretInLine(line);
}

function setRangeEndAtLineEnd(range: Range, line: HTMLElement) {
  const endRange = document.createRange();
  endRange.selectNodeContents(line);
  range.setEnd(endRange.endContainer, endRange.endOffset);
}

export function selectAllEditorBodyContent(editor: HTMLElement) {
  repairPastedEditorStructure(editor);
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const bodyLines = getLineElements(editor).slice(1);
  if (bodyLines.length === 0) return false;

  let lastSelectableIndex = bodyLines.length - 1;
  while (
    lastSelectableIndex >= 0 &&
    isBodyPlaceholderLine(bodyLines[lastSelectableIndex])
  ) {
    lastSelectableIndex -= 1;
  }

  if (lastSelectableIndex < 0) return false;

  const firstLine = bodyLines[0];
  const lastLine = bodyLines[lastSelectableIndex];
  const range = document.createRange();
  range.setStart(firstLine, 0);
  setRangeEndAtLineEnd(range, lastLine);

  const selection = window.getSelection();
  if (!selection) return false;

  editor.focus();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function selectAllDetailEditorContent(editor: HTMLElement) {
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const activeLine = getActiveLineElement(editor);
  if (activeLine && isTitleLine(editor, activeLine)) {
    const range = document.createRange();
    range.selectNodeContents(activeLine);
    const selection = window.getSelection();
    if (!selection) return false;

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  return selectAllEditorBodyContent(editor);
}

function getLinesIntersectingRange(editor: HTMLElement, range: Range) {
  ensureBlockLines(editor);

  const intersectingLines = getLineElements(editor).filter((line) => {
    try {
      return range.intersectsNode(line);
    } catch {
      return false;
    }
  });

  if (intersectingLines.length > 0) {
    return intersectingLines;
  }

  const startLine = getLineElementForRangeBoundary(editor, range, "start");
  const endLine = getLineElementForRangeBoundary(editor, range, "end");
  if (!startLine || !endLine) {
    return [];
  }

  const lines = getLineElements(editor);
  const startIndex = lines.indexOf(startLine);
  const endIndex = lines.indexOf(endLine);
  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  return lines.slice(from, to + 1);
}

function cloneLineMetadataForClipboard(source: HTMLElement, target: HTMLElement) {
  if (source.dataset.lineType) {
    target.dataset.lineType = source.dataset.lineType;
  }

  if (source.dataset.listIndent) {
    target.dataset.listIndent = source.dataset.listIndent;
  }

  if (source.dataset.listNumber) {
    target.dataset.listNumber = source.dataset.listNumber;
  }

  if (source.dataset.checked) {
    target.dataset.checked = source.dataset.checked;
  }
}

function detailLineSelectionHtml(
  line: HTMLElement,
  range: Range,
  isFirstLine: boolean,
  isLastLine: boolean,
) {
  if (
    (isFirstLine || isLastLine) &&
    !isWholeLineSelected(line, range)
  ) {
    return rangeToInnerHtml(getLineSelectionRange(line, range));
  }

  return line.innerHTML;
}

function detailLineToPlainText(line: HTMLElement, html: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const text = (wrapper.textContent ?? "").replace(/\u00a0/g, " ");

  const lineType = line.dataset.lineType ?? "text";
  const indentPrefix = " ".repeat(getListIndentLevel(line) * 2);

  if (lineType === "bullet") {
    return `${indentPrefix}• ${text}`;
  }

  if (lineType === "numbered") {
    return `${indentPrefix}${line.dataset.listNumber ?? "1"}. ${text}`;
  }

  if (lineType === "checklist") {
    const marker = line.dataset.checked === "true" ? "[x]" : "[ ]";
    return `${indentPrefix}${marker} ${text}`;
  }

  return text;
}

function serializeDetailLineForClipboard(
  line: HTMLElement,
  range: Range,
  isFirstLine: boolean,
  isLastLine: boolean,
) {
  const clone = document.createElement("div");
  clone.className = DETAIL_LINE_CLASS;
  cloneLineMetadataForClipboard(line, clone);

  const html = detailLineSelectionHtml(line, range, isFirstLine, isLastLine);
  clone.innerHTML = html;

  return {
    element: clone,
    plainText: detailLineToPlainText(line, html),
  };
}

export function serializeEditorSelectionForClipboard(
  editor: HTMLElement,
  range: Range,
) {
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) {
    return null;
  }

  const lines = getLinesIntersectingRange(editor, range);
  if (lines.length === 0) {
    return null;
  }

  const container = document.createElement("div");
  container.setAttribute(DETAIL_CLIPBOARD_ROOT_ATTR, "1");

  const plainParts: string[] = [];
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  for (const line of lines) {
    const serialized = serializeDetailLineForClipboard(
      line,
      range,
      line === firstLine,
      line === lastLine,
    );
    container.appendChild(serialized.element);
    plainParts.push(serialized.plainText);
  }

  return {
    html: container.outerHTML,
    plainText: plainParts.join("\n"),
  };
}

function isDetailsHtmlEmpty(html: string) {
  const trimmed = html.trim();
  if (
    !trimmed ||
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p><br></p>"
  ) {
    return true;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  ensureBlockLines(container);

  return getLineElements(container).every((line) => isLineEmpty(line));
}

function stripLineTransientState(line: HTMLElement) {
  delete line.dataset.empty;
  delete line.dataset.bodyPlaceholder;
  stripLinePollutedStyles(line);
}

const ALLOWED_DETAIL_LINE_STYLE_PROPERTIES = new Set([
  "--detail-line-height",
  "line-height",
  "font-size",
  "font-family",
  "color",
  "background-color",
  "text-align",
  "text-decoration",
  "font-weight",
  "font-style",
]);

function stripLinePollutedStyles(line: HTMLElement) {
  line.style.removeProperty("height");
  line.style.removeProperty("min-height");
  line.style.removeProperty("max-height");

  if (!line.style.cssText.trim()) {
    line.removeAttribute("style");
    return;
  }

  for (const property of Array.from(line.style)) {
    if (!ALLOWED_DETAIL_LINE_STYLE_PROPERTIES.has(property)) {
      line.style.removeProperty(property);
    }
  }

  if (!line.style.cssText.trim()) {
    line.removeAttribute("style");
  }
}

function lineHasNestedDetailLines(line: HTMLElement) {
  return line.querySelector(`:scope > .${DETAIL_LINE_CLASS}`) !== null;
}

function lineHasOwnTextContent(line: HTMLElement) {
  const clone = line.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`:scope > .${DETAIL_LINE_CLASS}`)
    .forEach((nested) => nested.remove());

  return Boolean((clone.textContent ?? "").replace(/\u00a0|\u200B/g, " ").trim());
}

export function flattenNestedDetailLines(editor: HTMLElement) {
  let changed = false;

  while (true) {
    const containerLine = getLineElements(editor).find(lineHasNestedDetailLines);
    if (!containerLine) break;

    const nestedLines = Array.from(
      containerLine.querySelectorAll(`:scope > .${DETAIL_LINE_CLASS}`),
    ) as HTMLElement[];

    for (const nestedLine of nestedLines) {
      stripLineTransientState(nestedLine);
      containerLine.before(nestedLine);
    }

    if (!lineHasOwnTextContent(containerLine)) {
      containerLine.remove();
    } else {
      splitBlockLinesOnBreaks(editor);
    }

    changed = true;
  }

  return changed;
}

function isBodyPlaceholderCandidateLine(line: HTMLElement) {
  return (
    !line.querySelector(".detail-image-wrapper") && !isCodeLine(line)
  );
}

function isBodyLineWithContent(line: HTMLElement) {
  return !isLineEmpty(line) || line.querySelector(".detail-image-wrapper") !== null;
}

function isRemovableTrailingEmptyBodyLine(line: HTMLElement) {
  return (
    isLineEmpty(line) &&
    !isCodeLine(line) &&
    !line.querySelector(".detail-image-wrapper")
  );
}

function syncTrailingBodyPlaceholderLine(editor: HTMLElement) {
  const lines = getLineElements(editor);
  if (lines.length <= 1) return;

  const bodyLines = lines.slice(1);
  const bodyHasContent = bodyLines.some(isBodyLineWithContent);

  if (!bodyHasContent) {
    while (bodyLines.length > 1) {
      bodyLines.pop()?.remove();
    }

    if (getLineElements(editor).length === 1) {
      editor.appendChild(createLineElement("<br>", "text"));
    }

    return;
  }

  const lastLine = getLineElements(editor).at(-1);
  if (lastLine && isBodyLineWithContent(lastLine)) {
    editor.appendChild(createLineElement("<br>", "text"));
  }
}

export function clearFixedLineDimensions(line: HTMLElement) {
  line.style.removeProperty("height");
  line.style.removeProperty("min-height");
  line.style.removeProperty("max-height");
}

export function stripTrailingBreakFromNonEmptyLine(line: HTMLElement) {
  if (isLineEmpty(line)) return false;

  let changed = false;

  while (line.lastChild) {
    const last = line.lastChild;

    if (last instanceof HTMLBRElement) {
      line.removeChild(last);
      changed = true;
      continue;
    }

    if (
      last instanceof Text &&
      !(last.textContent ?? "").replace(/\u00a0/g, " ").trim()
    ) {
      line.removeChild(last);
      changed = true;
      continue;
    }

    break;
  }

  return changed;
}

export function syncLineEmptyState(editor: HTMLElement) {
  flattenNestedDetailLines(editor);
  normalizeImageLines(editor);
  normalizeCodeLines(editor);
  normalizeChecklistLines(editor);
  syncTrailingBodyPlaceholderLine(editor);

  const lines = getLineElements(editor);

  lines.forEach((line, index) => {
    if (index > 0 && !isCodeLine(line)) {
      clearFixedLineDimensions(line);
    }

    const isEmpty = isLineEmpty(line);

    if (isEmpty) {
      line.dataset.empty = "true";
    } else {
      delete line.dataset.empty;
      stripTrailingBreakFromNonEmptyLine(line);
    }

    delete line.dataset.bodyPlaceholder;
    delete line.dataset.showBodyPlaceholder;
  });
}

export function syncEditorBodyPlaceholderVisibility(editor: HTMLElement) {
  for (const line of getLineElements(editor)) {
    delete line.dataset.showBodyPlaceholder;
  }

  const selection = window.getSelection();
  const editorHasFocus =
    document.activeElement === editor ||
    (document.activeElement instanceof Node &&
      editor.contains(document.activeElement));
  const selectionInEditor =
    Boolean(selection?.rangeCount) &&
    ((selection?.anchorNode != null && editor.contains(selection.anchorNode)) ||
      (selection?.focusNode != null && editor.contains(selection.focusNode)));

  if (!editorHasFocus || !selectionInEditor) {
    delete editor.dataset.hideBodyPlaceholder;
    return;
  }

  const activeLine = getActiveLineElement(editor);
  if (activeLine && isEmptyEditableBodyLine(editor, activeLine)) {
    activeLine.dataset.showBodyPlaceholder = "true";
    delete editor.dataset.hideBodyPlaceholder;
    return;
  }

  if (activeLine && !isLineEmpty(activeLine)) {
    editor.dataset.hideBodyPlaceholder = "true";
  } else {
    delete editor.dataset.hideBodyPlaceholder;
  }
}

export function ensureTitleLine(editor: HTMLElement) {
  ensureBlockLines(editor);

  const lines = getLineElements(editor);
  if (lines.length === 0) {
    editor.appendChild(createLineElement("<br>", "h1"));
    editor.appendChild(createLineElement("<br>", "text"));
    return;
  }

  const firstLine = lines[0];
  if (firstLine.dataset.lineType !== "h1") {
    firstLine.dataset.lineType = "h1";
  }

  if (lines.length === 1) {
    editor.appendChild(createLineElement("<br>", "text"));
  }
}

export function buildEditorHtmlFromTask(title: string, detailsHtml: string) {
  const editor = document.createElement("div");
  const titleText = title.trim();
  editor.appendChild(
    createLineElement(titleText ? escapeHtml(titleText) : "<br>", "h1"),
  );

  if (!isDetailsHtmlEmpty(detailsHtml)) {
    const detailsRoot = document.createElement("div");
    detailsRoot.innerHTML = detailsHtml;
    ensureBlockLines(detailsRoot);
    getLineElements(detailsRoot).forEach((line) => {
      const clone = line.cloneNode(true) as HTMLElement;
      stripLineTransientState(clone);
      editor.appendChild(clone);
    });
  } else {
    editor.appendChild(createLineElement("<br>", "text"));
  }

  syncLineEmptyState(editor);

  return editor.innerHTML;
}

export function getEditorTitle(editor: HTMLElement) {
  const lines = getLineElements(editor);
  return (lines[0]?.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

export function splitEditorContent(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  ensureBlockLines(editor);
  ensureTitleLine(editor);
  syncLineEmptyState(editor);

  const lines = getLineElements(editor);
  const title = getEditorTitle(editor);
  const detailsRoot = document.createElement("div");

  const bodyLines = lines.slice(1).map((line) => {
    const clone = line.cloneNode(true) as HTMLElement;
    stripLineTransientState(clone);
    return clone;
  });

  while (bodyLines.length > 0) {
    const lastLine = bodyLines[bodyLines.length - 1];
    if (!isRemovableTrailingEmptyBodyLine(lastLine)) break;
    bodyLines.pop();
  }

  bodyLines.forEach((line) => {
    detailsRoot.appendChild(line);
  });

  const detailsHtml = detailsRoot.innerHTML.trim();
  const details = isDetailsHtmlEmpty(detailsHtml) ? "" : detailsRoot.innerHTML;

  return { title, details };
}
