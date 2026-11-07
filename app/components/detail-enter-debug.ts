/**
 * Opt-in diagnostics for Enter handling in the task details editor.
 *
 * Enable in the browser console:
 *   localStorage.setItem("todolist.debugEditorEnter", "1")
 * Disable:
 *   localStorage.removeItem("todolist.debugEditorEnter")
 */

const DEBUG_FLAG_KEY = "todolist.debugEditorEnter";
const SESSION_DURATION_MS = 3000;

let sessionStartedAt = 0;
let sessionId = 0;
let observer: MutationObserver | null = null;
let observerTimer: number | null = null;

export function isEditorEnterDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function isSessionActive() {
  return (
    sessionStartedAt > 0 &&
    performance.now() - sessionStartedAt < SESSION_DURATION_MS
  );
}

function elapsedLabel() {
  return `#${sessionId} +${Math.round(performance.now() - sessionStartedAt)}ms`;
}

function getDetailLines(editor: HTMLElement) {
  return Array.from(
    editor.querySelectorAll(":scope > .detail-line"),
  ) as HTMLElement[];
}

function describeNode(node: Node | null, editor: HTMLElement) {
  if (!node) return "null";

  const parts: string[] = [];
  let current: Node | null = node;

  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      if (current.classList.contains("detail-line")) {
        parts.push(`line[${getDetailLines(editor).indexOf(current)}]`);
        break;
      }
      const className = current.className
        ? `.${String(current.className).split(" ").join(".")}`
        : "";
      parts.push(`${current.tagName.toLowerCase()}${className}`);
    } else if (current.nodeType === Node.TEXT_NODE) {
      parts.push(`#text(${JSON.stringify((current.textContent ?? "").slice(0, 20))})`);
    }
    current = current.parentNode;
  }

  if (current === editor) parts.push("editor");
  return parts.join(" < ");
}

function describeSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { rangeCount: 0 };

  const range = selection.getRangeAt(0);
  return {
    collapsed: range.collapsed,
    start: describeNode(range.startContainer, editor),
    startOffset: range.startOffset,
    end: describeNode(range.endContainer, editor),
    endOffset: range.endOffset,
  };
}

function snapshotLines(editor: HTMLElement) {
  return getDetailLines(editor).map((line, index) => ({
    index,
    type: line.dataset.lineType ?? "text",
    checked: line.dataset.checked ?? "",
    indent: line.dataset.listIndent ?? "",
    empty: !(line.textContent ?? "").replace(/\u00a0|\u200B/g, " ").trim(),
    dataEmpty: line.dataset.empty ?? "",
    text: (line.textContent ?? "").slice(0, 40),
    html: line.innerHTML.slice(0, 140),
  }));
}

function getOrphanNodes(editor: HTMLElement) {
  return Array.from(editor.childNodes)
    .filter(
      (node) =>
        !(node instanceof HTMLElement && node.classList.contains("detail-line")),
    )
    .map((node) =>
      node instanceof HTMLElement
        ? node.outerHTML.slice(0, 140)
        : `#${node.nodeName}(${JSON.stringify((node.textContent ?? "").slice(0, 40))})`,
    );
}

/** Starts a debug session; call when Enter is pressed in the editor. */
export function beginEditorEnterDebugSession(editor: HTMLElement) {
  if (!isEditorEnterDebugEnabled()) return;

  sessionId += 1;
  sessionStartedAt = performance.now();

  observer?.disconnect();
  if (observerTimer !== null) window.clearTimeout(observerTimer);

  observer = new MutationObserver((records) => {
    const added: string[] = [];
    const removed: string[] = [];

    for (const record of records) {
      record.addedNodes.forEach((node) => {
        added.push(
          node instanceof HTMLElement
            ? node.outerHTML.slice(0, 140)
            : `#${node.nodeName}`,
        );
      });
      record.removedNodes.forEach((node) => {
        removed.push(
          node instanceof HTMLElement
            ? node.outerHTML.slice(0, 140)
            : `#${node.nodeName}`,
        );
      });
    }

    if (added.length === 0 && removed.length === 0) return;
    logEditorEnterDebug("MutationObserver: editor children changed", editor, {
      added,
      removed,
    });
  });
  observer.observe(editor, { childList: true });

  observerTimer = window.setTimeout(() => {
    observer?.disconnect();
    observer = null;
    observerTimer = null;
  }, SESSION_DURATION_MS);
}

/** Logs the full line structure of the editor at a named stage. */
export function logEditorEnterDebug(
  stage: string,
  editor: HTMLElement,
  extra?: Record<string, unknown>,
) {
  if (!isEditorEnterDebugEnabled() || !isSessionActive()) return;

  console.groupCollapsed(`[enter-debug ${elapsedLabel()}] ${stage}`);
  if (extra) console.log(extra);
  console.log("selection", describeSelection(editor));
  console.table(snapshotLines(editor));
  const orphans = getOrphanNodes(editor);
  if (orphans.length > 0) {
    console.warn("non-.detail-line children of editor", orphans);
  }
  console.groupEnd();
}

/** Logs a code path (with stack trace) that creates or moves lines. */
export function traceEditorEnterDebug(
  label: string,
  extra?: Record<string, unknown>,
) {
  if (!isEditorEnterDebugEnabled() || !isSessionActive()) return;

  console.groupCollapsed(`[enter-debug ${elapsedLabel()}] ${label}`);
  if (extra) console.log(extra);
  console.trace("stack");
  console.groupEnd();
}
