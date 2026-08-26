import {
  applyInitialImageDisplaySize,
  ensureImageResizeHandles,
  waitForInitialImageDisplaySize,
} from "./detail-image-resize";

export const DETAIL_LINE_CLASS = "detail-line";

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

function normalizeBlockBreaksInHtml(html: string) {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "<<LINE_BREAK>>")
    .replace(/<\/p>\s*/gi, "<<LINE_BREAK>>")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/div>\s*<div[^>]*>/gi, "<<LINE_BREAK>>")
    .replace(/<\/div>/gi, "<<LINE_BREAK>>")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/li>\s*<li[^>]*>/gi, "<<LINE_BREAK>>")
    .replace(/<\/li>/gi, "<<LINE_BREAK>>")
    .replace(/<li[^>]*>/gi, "")
    .replace(/\n/g, "<<LINE_BREAK>>");
}

function htmlToLineParts(html: string) {
  if (!html.trim()) return ["<br>"];

  const withoutTrailingBreaks = stripTrailingLineBreakMarkup(html);
  if (!withoutTrailingBreaks.trim()) return ["<br>"];

  const normalized = normalizeBlockBreaksInHtml(withoutTrailingBreaks);

  const parts = normalized.split("<<LINE_BREAK>>").map((part) => part.trim());

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

export function ensureBlockLines(editor: HTMLElement) {
  const existingLines = getLineElements(editor);

  if (existingLines.length > 0) {
    existingLines.forEach((line) => {
      if (!line.dataset.lineId) {
        line.dataset.lineId = generateLineId();
      }
    });
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
  delete line.dataset.checked;
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

export function splitLineAtCursor(editor: HTMLElement) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const activeLine = getActiveLineElement(editor);
  if (!activeLine) return;

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

  activeLine.after(newLine);

  if (lineType === "code") {
    normalizeCodeLine(activeLine);
    normalizeCodeLine(newLine);
  }

  placeCaretInLine(newLine);
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

function plainTextToLineHtml(text: string) {
  if (!text) return "<br>";
  return escapeHtml(text);
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

function createLineFromPaste(html: string, sourceLine: HTMLElement, editor: HTMLElement) {
  const line = createLineElement(html);
  inheritLineBlockTypeFromSource(line, sourceLine, editor);
  return line;
}

export function insertPlainTextAtSelection(editor: HTMLElement, plainText: string) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const activeLine = getActiveLineElement(editor);
  if (
    !activeLine ||
    isTitleLine(editor, activeLine) ||
    isCodeLine(activeLine)
  ) {
    return;
  }

  const pastedLines = plainText.replace(/\r\n/g, "\n").split("\n");
  const range = selection.getRangeAt(0);

  if (!activeLine.contains(range.commonAncestorContainer)) {
    return;
  }

  if (pastedLines.length === 1) {
    range.deleteContents();
    const textNode = document.createTextNode(pastedLines[0]);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
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

  activeLine.innerHTML = mergeLineHtml(
    beforeHtml,
    plainTextToLineHtml(pastedLines[0]),
  );

  let previousLine = activeLine;

  for (let index = 1; index < pastedLines.length - 1; index += 1) {
    const newLine = createLineFromPaste(
      plainTextToLineHtml(pastedLines[index]),
      activeLine,
      editor,
    );
    previousLine.after(newLine);
    previousLine = newLine;
  }

  const lastLine = createLineFromPaste(
    mergeLineHtml(
      plainTextToLineHtml(pastedLines[pastedLines.length - 1]),
      afterHtml,
    ),
    activeLine,
    editor,
  );
  previousLine.after(lastLine);

  placeCaretInLine(lastLine);
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

export function placeCaretInLine(line: HTMLElement) {
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
    range.collapse(true);
  }

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

export function syncLineEmptyState(editor: HTMLElement) {
  normalizeImageLines(editor);
  normalizeCodeLines(editor);
  normalizeChecklistLines(editor);

  const activeLine = getActiveLineElement(editor);

  getLineElements(editor).forEach((line, index) => {
    const isEmpty = isLineEmpty(line);

    if (isEmpty) {
      line.dataset.empty = "true";
    } else {
      delete line.dataset.empty;
    }

    const showBodyPlaceholder =
      isEmpty &&
      index > 0 &&
      line === activeLine &&
      !line.querySelector(".detail-image-wrapper") &&
      !isCodeLine(line);

    if (showBodyPlaceholder) {
      line.dataset.bodyPlaceholder = "true";
    } else {
      delete line.dataset.bodyPlaceholder;
    }
  });
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
      editor.appendChild(line.cloneNode(true));
    });
  } else {
    editor.appendChild(createLineElement("<br>", "text"));
  }

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

  const lines = getLineElements(editor);
  const title = getEditorTitle(editor);
  const detailsRoot = document.createElement("div");

  lines.slice(1).forEach((line) => {
    detailsRoot.appendChild(line.cloneNode(true));
  });

  const detailsHtml = detailsRoot.innerHTML.trim();
  const details = isDetailsHtmlEmpty(detailsHtml) ? "" : detailsRoot.innerHTML;

  return { title, details };
}
