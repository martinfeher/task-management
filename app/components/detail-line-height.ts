import {
  ensureBlockLines,
  getActiveLineElement,
  getLinesInSelection,
  getSelectedBlockLinesInRange,
  isCodeLine,
  isTitleLine,
  clearFixedLineDimensions,
  stripTrailingBreakFromNonEmptyLine,
} from "./detail-lines";

export const DEFAULT_DETAIL_LINE_HEIGHT = 1.75;
export const DETAIL_LINE_HEIGHT_MIN = 1;
export const DETAIL_LINE_HEIGHT_MAX = 2.5;
export const DETAIL_LINE_HEIGHT_STEP = 0.1;

export const DETAIL_LINE_HEIGHT_OPTIONS = Array.from(
  { length: Math.round((DETAIL_LINE_HEIGHT_MAX - DETAIL_LINE_HEIGHT_MIN) / DETAIL_LINE_HEIGHT_STEP) + 1 },
  (_, index) =>
    Number(
      (DETAIL_LINE_HEIGHT_MIN + index * DETAIL_LINE_HEIGHT_STEP).toFixed(1),
    ),
);

export type DetailLineHeightOption = (typeof DETAIL_LINE_HEIGHT_OPTIONS)[number];

export function isDefaultDetailLineHeight(lineHeight: number) {
  return Math.abs(lineHeight - DEFAULT_DETAIL_LINE_HEIGHT) < 0.001;
}

export function normalizeDetailLineHeight(value: string | number): DetailLineHeightOption {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DETAIL_LINE_HEIGHT;
  }

  const clamped = Math.min(
    DETAIL_LINE_HEIGHT_MAX,
    Math.max(DETAIL_LINE_HEIGHT_MIN, parsed),
  );
  const stepped =
    Math.round(clamped / DETAIL_LINE_HEIGHT_STEP) * DETAIL_LINE_HEIGHT_STEP;

  return Number(stepped.toFixed(1)) as DetailLineHeightOption;
}

function getLineHeightFromLine(line: HTMLElement) {
  const inline = line.style.lineHeight.trim();
  if (inline) {
    return normalizeDetailLineHeight(inline);
  }

  const cssVar = line.style.getPropertyValue("--detail-line-height").trim();
  if (cssVar) {
    return normalizeDetailLineHeight(cssVar);
  }

  return DEFAULT_DETAIL_LINE_HEIGHT;
}

function filterLineHeightTargetLines(
  editor: HTMLElement,
  lines: HTMLElement[],
) {
  return lines.filter(
    (line) =>
      !isTitleLine(editor, line) &&
      !isCodeLine(line) &&
      !line.querySelector(".detail-image-wrapper"),
  );
}

function getReadOnlyLinesForLineHeight(editor: HTMLElement) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
    return [];
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    const activeLine = getActiveLineElement(editor);
    return activeLine ? [activeLine] : [];
  }

  return getSelectedBlockLinesInRange(editor, range);
}

function getTargetLinesForLineHeight(
  editor: HTMLElement,
  savedRange?: Range | null,
) {
  ensureBlockLines(editor);

  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRange.cloneRange());
  }

  const lines = filterLineHeightTargetLines(
    editor,
    getLinesInSelection(editor),
  );

  if (lines.length > 0) {
    return lines;
  }

  const activeLine = getActiveLineElement(editor);
  if (
    activeLine &&
    !isTitleLine(editor, activeLine) &&
    !isCodeLine(activeLine) &&
    !activeLine.querySelector(".detail-image-wrapper")
  ) {
    return [activeLine];
  }

  return [];
}

export function getDetailSelectionLineHeight(editor: HTMLElement): DetailLineHeightOption {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
    return DEFAULT_DETAIL_LINE_HEIGHT;
  }

  const lines = filterLineHeightTargetLines(
    editor,
    getReadOnlyLinesForLineHeight(editor),
  );
  if (lines.length === 0) {
    return DEFAULT_DETAIL_LINE_HEIGHT;
  }

  return getLineHeightFromLine(lines[0]);
}

export function resetDetailLineHeightOnLines(lines: HTMLElement[]) {
  let changed = false;

  for (const line of lines) {
    const hadCustomLineHeight =
      line.style.lineHeight.trim() !== "" ||
      line.style.getPropertyValue("--detail-line-height").trim() !== "";

    line.style.removeProperty("--detail-line-height");
    line.style.removeProperty("line-height");
    clearFixedLineDimensions(line);
    stripTrailingBreakFromNonEmptyLine(line);

    if (hadCustomLineHeight) {
      changed = true;
    }
  }

  return changed;
}

export function applyDetailLineHeight(
  editor: HTMLElement,
  lineHeight: DetailLineHeightOption,
  savedRange?: Range | null,
): boolean {
  const normalized = normalizeDetailLineHeight(lineHeight);
  const lines = getTargetLinesForLineHeight(editor, savedRange);
  if (lines.length === 0) return false;

  editor.focus();

  for (const line of lines) {
    clearFixedLineDimensions(line);

    if (isDefaultDetailLineHeight(normalized)) {
      line.style.removeProperty("--detail-line-height");
      line.style.removeProperty("line-height");
    } else {
      line.style.setProperty("--detail-line-height", String(normalized));
      line.style.lineHeight = String(normalized);
    }

    stripTrailingBreakFromNonEmptyLine(line);
  }

  return true;
}
