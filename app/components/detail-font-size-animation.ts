import { DETAIL_LINE_CLASS, isCodeLine } from "./detail-lines";

export const DETAIL_FONT_SIZE_TRANSITION_MS = 220;

type TextFontSizeSnapshot = {
  sizePx: number;
};

type FontSizeTransitionTask = {
  element: HTMLElement;
  startPx: number;
  endPx: number;
  clearInlineAfter: boolean;
};

function prefersReducedDetailFontSizeAnimation() {
  if (typeof window === "undefined") return true;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function shouldAnimateDetailFontSize() {
  return !prefersReducedDetailFontSizeAnimation();
}

function isAnimatableTextNode(editor: HTMLElement, range: Range, node: Text) {
  if (!editor.contains(node)) return false;
  if (!range.intersectsNode(node)) return false;
  if (!(node.textContent ?? "").replace(/\uFEFF/g, "").length) return false;

  const line = node.parentElement?.closest(`.${DETAIL_LINE_CLASS}`);
  if (!(line instanceof HTMLElement)) return false;
  if (isCodeLine(line)) return false;
  if (line.querySelector(".detail-image-wrapper")?.contains(node)) return false;

  return true;
}

function getTextNodesInRange(editor: HTMLElement, range: Range) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Text)) continue;
    if (!isAnimatableTextNode(editor, range, node)) continue;
    nodes.push(node);
  }

  return nodes;
}

function getFontSizeForTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent) return 0;

  const parsed = Number.parseFloat(window.getComputedStyle(parent).fontSize);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAnimatableFontElement(node: Text) {
  const line = node.parentElement?.closest(`.${DETAIL_LINE_CLASS}`);
  if (!(line instanceof HTMLElement)) return null;

  let element: HTMLElement | null = node.parentElement;
  while (element && element !== line) {
    if (element.style.fontSize.trim()) {
      return element;
    }
    element = element.parentElement;
  }

  return node.parentElement;
}

export function snapshotTextFontSizesInRange(
  editor: HTMLElement,
  range: Range,
): TextFontSizeSnapshot[] {
  return getTextNodesInRange(editor, range).map((node) => ({
    sizePx: getFontSizeForTextNode(node),
  }));
}

export function playDetailFontSizeTransition(
  editor: HTMLElement,
  range: Range,
  before: TextFontSizeSnapshot[],
) {
  if (!shouldAnimateDetailFontSize()) return;

  const textNodes = getTextNodesInRange(editor, range);
  if (textNodes.length === 0) return;

  const tasks = new Map<HTMLElement, FontSizeTransitionTask>();

  for (let index = 0; index < textNodes.length; index += 1) {
    const node = textNodes[index];
    const startPx = before[index]?.sizePx;
    if (startPx === undefined || !Number.isFinite(startPx)) continue;

    const element = getAnimatableFontElement(node);
    if (!element) continue;

    const endPx = Number.parseFloat(window.getComputedStyle(element).fontSize);
    if (!Number.isFinite(endPx) || Math.abs(startPx - endPx) < 0.5) continue;

    const clearInlineAfter = element.style.fontSize.trim() === "";
    const existing = tasks.get(element);
    if (existing) continue;

    tasks.set(element, {
      element,
      startPx,
      endPx,
      clearInlineAfter,
    });
  }

  if (tasks.size === 0) return;

  editor.setAttribute("data-font-size-animating", "true");

  for (const task of tasks.values()) {
    task.element.style.fontSize = `${task.startPx}px`;
  }

  let pending = tasks.size;
  let fallbackTimeoutId: number | null = null;
  const finishedElements = new Set<HTMLElement>();

  function finishAll() {
    if (fallbackTimeoutId !== null) {
      window.clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = null;
    }
    editor.removeAttribute("data-font-size-animating");
  }

  function finishTask(element: HTMLElement, task: FontSizeTransitionTask) {
    if (finishedElements.has(element)) return;
    finishedElements.add(element);

    if (task.clearInlineAfter) {
      element.style.removeProperty("font-size");
    } else {
      element.style.fontSize = `${task.endPx}px`;
    }

    pending -= 1;
    if (pending > 0) return;
    finishAll();
  }

  fallbackTimeoutId = window.setTimeout(() => {
    if (pending <= 0) return;
    for (const task of tasks.values()) {
      finishTask(task.element, task);
    }
  }, DETAIL_FONT_SIZE_TRANSITION_MS + 80);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const task of tasks.values()) {
        const { element, endPx } = task;
        element.style.fontSize = `${endPx}px`;

        const onTransitionEnd = (event: TransitionEvent) => {
          if (event.propertyName !== "font-size") return;
          element.removeEventListener("transitionend", onTransitionEnd);
          finishTask(element, task);
        };

        element.addEventListener("transitionend", onTransitionEnd);
      }
    });
  });
}