/** Industry-standard clipboard text limit (512 KB). */
export const MAX_PASTE_TEXT_BYTES = 512 * 1024;

const FORMATTING_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "SUB",
  "SUP",
]);

const ALLOWED_PASTE_TAGS = new Set([
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
  "A",
  "BR",
  "SPAN",
  "P",
  "DIV",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "IMG",
  "FONT",
]);

const BLOCK_PASTE_TAGS = new Set([
  "P",
  "DIV",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

const DANGEROUS_PASTE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "META",
  "LINK",
  "HEAD",
  "TITLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "FORM",
  "BUTTON",
  "BASE",
  "SVG",
  "MATH",
  "NOSCRIPT",
  "TEMPLATE",
  "FRAME",
  "FRAMESET",
]);

export type PasteLinePart = {
  html: string;
  lineType?: "text" | "h2" | "h3" | "bullet" | "numbered" | "checklist";
  checked?: boolean;
};

function normalizeClipboardPlainText(plainText: string) {
  return plainText.replace(/\r\n?|\n/g, "\n");
}

function getUtf8ByteLength(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }

  return value.length;
}

export function clampPastePlainText(plainText: string) {
  if (getUtf8ByteLength(plainText) <= MAX_PASTE_TEXT_BYTES) {
    return { text: plainText, truncated: false };
  }

  let truncated = "";
  for (const char of plainText) {
    const next = truncated + char;
    if (getUtf8ByteLength(next) > MAX_PASTE_TEXT_BYTES) {
      break;
    }
    truncated = next;
  }

  return { text: truncated, truncated: true };
}

export function normalizeTitlePasteText(plainText: string) {
  return normalizeClipboardPlainText(plainText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function isSafePasteUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html")
  ) {
    return false;
  }

  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("data:image/") ||
    lower.startsWith("/") ||
    lower.startsWith("#") ||
    !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  );
}

function stripOfficeHtmlCruft(html: string) {
  return html
    .replace(/<!--\[if[\s\S]*?endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?o:p[^>]*>/gi, "")
    .replace(/<\/?w:[^>]*>/gi, "")
    .replace(/<\/?m:[^>]*>/gi, "")
    .replace(/<\/?v:[^>]*>/gi, "")
    .replace(/<\/?st1:[^>]*>/gi, "")
    .replace(/<\/?xml[^>]*>/gi, "");
}

function isBoldStyle(style: CSSStyleDeclaration) {
  const weight = style.fontWeight;
  return (
    weight === "bold" ||
    weight === "bolder" ||
    (Number.parseInt(weight, 10) || 0) >= 600
  );
}

function isItalicStyle(style: CSSStyleDeclaration) {
  return style.fontStyle === "italic" || style.fontStyle === "oblique";
}

function sanitizeCssColor(value: string | null | undefined) {
  if (!value?.trim()) return null;

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.includes("url(") ||
    lower.includes("expression") ||
    lower.includes("javascript") ||
    lower === "inherit" ||
    lower === "initial" ||
    lower === "unset" ||
    lower === "currentcolor" ||
    lower === "windowtext" ||
    lower === "windowframe"
  ) {
    return null;
  }

  if (typeof document === "undefined") {
    if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
    if (/^rgba?\(/i.test(trimmed)) return trimmed;
    return null;
  }

  const probe = document.createElement("span");
  probe.style.color = trimmed;
  if (!probe.style.color) return null;

  return probe.style.color;
}

function isIgnorableDefaultTextColor(color: string) {
  const normalized = color.replace(/\s/g, "").toLowerCase();
  return (
    normalized === "rgb(0,0,0)" ||
    normalized === "#000" ||
    normalized === "#000000" ||
    normalized === "black"
  );
}

function readSourceTextColor(source: HTMLElement) {
  const fromStyle = sanitizeCssColor(source.style.color);
  if (fromStyle) return fromStyle;

  if (source.tagName === "FONT") {
    return sanitizeCssColor(source.getAttribute("color"));
  }

  return null;
}

function applySafeTextColor(source: HTMLElement, target: HTMLElement) {
  const safeColor = readSourceTextColor(source);
  if (safeColor && !isIgnorableDefaultTextColor(safeColor)) {
    target.style.color = safeColor;
  }
}

/**
 * Copies over the specific inline style properties needed to detect bold /
 * italic / color from the *source* clipboard element onto the sanitized
 * *clone*, before normalizeInlineFormatting() runs. Without this, formatting
 * applied purely via CSS (e.g. `<span style="font-weight:700">`, common from
 * Google Docs, Apple Notes, and web pages) would be silently dropped, since
 * the clone otherwise starts with no inline style at all.
 */
function applySourceInlineFormatting(source: HTMLElement, target: HTMLElement) {
  const fontWeight = source.style.fontWeight;
  if (fontWeight) {
    target.style.fontWeight = fontWeight;
  }

  const fontStyle = source.style.fontStyle;
  if (fontStyle) {
    target.style.fontStyle = fontStyle;
  }

  applySafeTextColor(source, target);
}

function retainOnlySafeTextColorStyle(element: HTMLElement) {
  const safeColor = sanitizeCssColor(element.style.color);
  element.removeAttribute("style");

  if (safeColor && !isIgnorableDefaultTextColor(safeColor)) {
    element.style.color = safeColor;
  }
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function wrapNodeContents(element: HTMLElement, wrapperTag: "strong" | "em") {
  const wrapper = element.ownerDocument.createElement(wrapperTag);
  while (element.firstChild) {
    wrapper.appendChild(element.firstChild);
  }
  element.appendChild(wrapper);
}

function normalizeInlineFormatting(element: HTMLElement) {
  // Bold/italic can arrive as CSS (font-weight/font-style) on any element,
  // not just <span>/<font> — convert it into a real <strong>/<em> wrapper
  // regardless of tag so it survives sanitization.
  const style = element.style;

  if (isBoldStyle(style)) {
    wrapNodeContents(element, "strong");
    element.style.removeProperty("font-weight");
  }

  if (isItalicStyle(style)) {
    wrapNodeContents(element, "em");
    element.style.removeProperty("font-style");
  }

  if (element.tagName === "SPAN" || element.tagName === "FONT") {
    element.style.removeProperty("background-color");
    element.style.removeProperty("background");
    element.style.removeProperty("font-family");
    element.style.removeProperty("font-size");
    element.style.removeProperty("line-height");
    element.style.removeProperty("text-decoration");
    for (const property of [...element.style]) {
      if (property.toLowerCase().startsWith("mso-")) {
        element.style.removeProperty(property);
      }
    }
    element.style.removeProperty("letter-spacing");
    element.style.removeProperty("text-indent");
    element.style.removeProperty("margin");
    element.style.removeProperty("padding");
    element.style.removeProperty("width");
    element.style.removeProperty("height");
    element.style.removeProperty("position");
    element.style.removeProperty("top");
    element.style.removeProperty("left");
    element.style.removeProperty("display");

    retainOnlySafeTextColorStyle(element);

    if (
      element.tagName === "FONT" ||
      (element.tagName === "SPAN" &&
        element.attributes.length === 0 &&
        element.childNodes.length === 1 &&
        element.firstChild instanceof HTMLElement &&
        (element.firstChild.tagName === "STRONG" ||
          element.firstChild.tagName === "EM"))
    ) {
      unwrapElement(element);
    }
  }

  if (element.tagName === "FONT") {
    retainOnlySafeTextColorStyle(element);
  }

  if (
    FORMATTING_TAGS.has(element.tagName) ||
    element.tagName === "A" ||
    element.tagName === "MARK"
  ) {
    retainOnlySafeTextColorStyle(element);
  }
}

function stripUnsafeAttributes(element: HTMLElement) {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();

    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "style") {
      retainOnlySafeTextColorStyle(element);
      continue;
    }

    if (name === "href" && element.tagName === "A") {
      if (!isSafePasteUrl(attribute.value)) {
        element.removeAttribute("href");
      }
      continue;
    }

    if (name === "src" && element.tagName === "IMG") {
      if (!isSafePasteUrl(attribute.value)) {
        element.removeAttribute("src");
      }
      continue;
    }

    if (
      name !== "href" &&
      name !== "src" &&
      name !== "alt" &&
      name !== "type" &&
      name !== "checked" &&
      name !== "role"
    ) {
      element.removeAttribute(attribute.name);
    }
  }

  element.removeAttribute("contenteditable");
  element.removeAttribute("spellcheck");
  element.removeAttribute("class");
  element.removeAttribute("id");
  element.draggable = false;
}

function appendSanitizedNodes(
  target: HTMLElement | DocumentFragment,
  source: Node,
  doc: Document,
) {
  if (source.nodeType === Node.TEXT_NODE) {
    target.appendChild(source.cloneNode(true));
    return;
  }

  if (!(source instanceof HTMLElement)) return;

  if (DANGEROUS_PASTE_TAGS.has(source.tagName)) {
    return;
  }

  if (source.tagName === "INPUT") {
    if (source.getAttribute("type")?.toLowerCase() === "checkbox") {
      return;
    }
    return;
  }

  if (!ALLOWED_PASTE_TAGS.has(source.tagName)) {
    for (const child of [...source.childNodes]) {
      appendSanitizedNodes(target, child, doc);
    }
    return;
  }

  const clone =
    source.tagName === "FONT"
      ? doc.createElement("span")
      : doc.createElement(source.tagName.toLowerCase());

  if (source.tagName === "A") {
    const href = source.getAttribute("href");
    if (href && isSafePasteUrl(href)) {
      clone.setAttribute("href", href);
    }
  }

  if (source.tagName === "IMG") {
    const src = source.getAttribute("src");
    if (src && isSafePasteUrl(src)) {
      clone.setAttribute("src", src);
    }
    clone.setAttribute("alt", source.getAttribute("alt") ?? "");
  }

  for (const child of [...source.childNodes]) {
    appendSanitizedNodes(clone, child, doc);
  }

  applySourceInlineFormatting(source, clone);
  normalizeInlineFormatting(clone);
  stripUnsafeAttributes(clone);

  if (
    clone.tagName === "SPAN" &&
    clone.attributes.length === 0 &&
    clone.childNodes.length === 1
  ) {
    target.appendChild(clone.firstChild!.cloneNode(true));
    return;
  }

  target.appendChild(clone);
}

export function sanitizePastedHtml(html: string) {
  const cleaned = stripOfficeHtmlCruft(html);
  const doc = new DOMParser().parseFromString(cleaned, "text/html");

  doc
    .querySelectorAll("script, style, meta, link, head, title, iframe, object, embed")
    .forEach((element) => element.remove());

  const container = doc.createElement("div");

  for (const child of [...doc.body.childNodes]) {
    appendSanitizedNodes(container, child, doc);
  }

  for (const element of container.querySelectorAll("*")) {
    if (element instanceof HTMLElement) {
      normalizeInlineFormatting(element);
      stripUnsafeAttributes(element);
    }
  }

  return container.innerHTML;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Many apps (Google Docs, Notion, Confluence, ...) wrap each list item's
 * text in its own nested `<p>`/`<div>` (e.g. `<li><p role="presentation">
 * text</p></li>`). Embedding that block tag verbatim inside a single-line
 * `.detail-line` causes a stray blank line to render below the marker
 * (block elements get their own box). Unwrap a lone nested P/DIV wrapper so
 * only its inline content is used for the line.
 */
function unwrapSingleBlockChild(element: HTMLElement) {
  let current: HTMLElement = element;

  while (true) {
    const meaningfulChildren = [...current.childNodes].filter(
      (child) =>
        !(
          child.nodeType === Node.TEXT_NODE &&
          !(child.textContent ?? "").trim()
        ),
    );

    const onlyChild = meaningfulChildren[0];
    if (
      meaningfulChildren.length !== 1 ||
      !(onlyChild instanceof HTMLElement) ||
      (onlyChild.tagName !== "P" && onlyChild.tagName !== "DIV")
    ) {
      break;
    }

    current = onlyChild;
  }

  return current;
}

function getInlineLineHtml(element: HTMLElement) {
  const html = unwrapSingleBlockChild(element).innerHTML.trim();
  return html || "<br>";
}

function elementHasDirectBlockChild(element: HTMLElement) {
  return [...element.children].some(
    (child) => child instanceof HTMLElement && BLOCK_PASTE_TAGS.has(child.tagName),
  );
}

function isChecklistList(element: HTMLElement) {
  if (element.getAttribute("role") === "list") {
    return element.querySelector('[role="checkbox"]') !== null;
  }

  if (
    element.classList.contains("contains-task-list") ||
    element.classList.contains("task-list")
  ) {
    return true;
  }

  return element.querySelector(':scope > li input[type="checkbox"]') !== null;
}

function isListItemChecked(element: HTMLElement) {
  const checkbox = element.querySelector(':scope > input[type="checkbox"]');
  if (checkbox instanceof HTMLInputElement) {
    return checkbox.checked;
  }

  const ariaChecked = element.getAttribute("aria-checked");
  if (ariaChecked === "true") return true;

  const roleCheckbox = element.querySelector('[role="checkbox"]');
  if (roleCheckbox instanceof HTMLElement) {
    return roleCheckbox.getAttribute("aria-checked") === "true";
  }

  return false;
}

function headingLineType(tagName: string): PasteLinePart["lineType"] | undefined {
  if (tagName === "H2") return "h2";
  if (tagName === "H3") return "h3";
  return undefined;
}

function pushPasteLine(
  lines: PasteLinePart[],
  html: string,
  lineType?: PasteLinePart["lineType"],
  checked?: boolean,
) {
  const trimmed = html.trim();
  lines.push({
    html: trimmed || "<br>",
    lineType,
    checked,
  });
}

function processPasteBlockNode(node: Node, lines: PasteLinePart[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) {
      pushPasteLine(lines, escapeHtml(text));
    }
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.tagName === "UL") {
    const checklist = isChecklistList(node);
    for (const item of node.querySelectorAll(":scope > li")) {
      if (!(item instanceof HTMLElement)) continue;
      pushPasteLine(
        lines,
        getInlineLineHtml(item),
        checklist ? "checklist" : "bullet",
        checklist ? isListItemChecked(item) : undefined,
      );
    }
    return;
  }

  if (node.tagName === "OL") {
    for (const item of node.querySelectorAll(":scope > li")) {
      if (!(item instanceof HTMLElement)) continue;
      pushPasteLine(lines, getInlineLineHtml(item), "numbered");
    }
    return;
  }

  // Some sources (most notably Google Docs, which wraps the entire copied
  // range in a single top-level `<b id="docs-internal-guid-...">` element)
  // nest real block structure (<p>/<ul>/<ol>/<h*>) inside a tag that isn't
  // itself a block tag. Descending into any element that directly contains
  // block children — regardless of the wrapper's own tag — keeps that
  // structure (and each list's bullet/numbered semantics) intact instead of
  // collapsing everything into one flattened line.
  if (elementHasDirectBlockChild(node)) {
    for (const child of [...node.childNodes]) {
      processPasteBlockNode(child, lines);
    }
    return;
  }

  if (BLOCK_PASTE_TAGS.has(node.tagName)) {
    pushPasteLine(lines, getInlineLineHtml(node), headingLineType(node.tagName));
    return;
  }

  pushPasteLine(lines, getInlineLineHtml(node));
}

const PLAIN_BULLET_LINE = /^\s*[-*•⁃]\s+(.*)$/;
const PLAIN_NUMBERED_LINE = /^\s*\d+[.)]\s+(.*)$/;
const PLAIN_CHECKLIST_LINE = /^\s*\[( |x|X)\]\s+(.*)$/;

export function plainTextLineToPastePart(line: string): PasteLinePart {
  const checklistMatch = line.match(PLAIN_CHECKLIST_LINE);
  if (checklistMatch) {
    return {
      html: escapeHtml(checklistMatch[2].trim()) || "<br>",
      lineType: "checklist",
      checked: checklistMatch[1].toLowerCase() === "x",
    };
  }

  const bulletMatch = line.match(PLAIN_BULLET_LINE);
  if (bulletMatch) {
    return {
      html: escapeHtml(bulletMatch[1].trim()) || "<br>",
      lineType: "bullet",
    };
  }

  const numberedMatch = line.match(PLAIN_NUMBERED_LINE);
  if (numberedMatch) {
    return {
      html: escapeHtml(numberedMatch[1].trim()) || "<br>",
      lineType: "numbered",
    };
  }

  return {
    html: line ? escapeHtml(line) : "<br>",
  };
}

export function plainTextToPasteLineParts(plainText: string): PasteLinePart[] {
  const normalized = normalizeClipboardPlainText(plainText);
  const lines = normalized.split("\n");

  if (lines.length > 1 && lines.at(-1) === "") {
    lines.pop();
  }

  if (lines.length === 0) {
    return [{ html: "<br>" }];
  }

  return lines.map(plainTextLineToPastePart);
}

function pastedHtmlHasBlockStructure(html: string) {
  return /<(p|div|ul|ol|li|h[1-6])\b/i.test(html);
}

export function htmlToPasteLineParts(html: string): PasteLinePart[] {
  const sanitized = sanitizePastedHtml(html);
  if (!sanitized.trim()) {
    return [{ html: "<br>" }];
  }

  if (!pastedHtmlHasBlockStructure(sanitized)) {
    return [{ html: sanitized.trim() }];
  }

  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const lines: PasteLinePart[] = [];

  for (const child of [...doc.body.childNodes]) {
    processPasteBlockNode(child, lines);
  }

  if (lines.length === 0) {
    return [{ html: sanitized.trim() || "<br>" }];
  }

  return lines;
}
