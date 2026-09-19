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
  lineType?:
    | "text"
    | "h1"
    | "h2"
    | "h3"
    | "bullet"
    | "numbered"
    | "checklist"
    | "image"
    | "code";
  checked?: boolean;
  listIndent?: number;
};

/** Marks clipboard HTML produced by our editor copy handler. */
export const DETAIL_CLIPBOARD_ROOT_ATTR = "data-todolist-detail-lines";

const DETAIL_LINE_CLASS = "detail-line";

export function isDetailLinesClipboardHtml(html: string) {
  return html.includes(DETAIL_CLIPBOARD_ROOT_ATTR);
}

function getDetailLinePasteHtml(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`.${DETAIL_LINE_CLASS}`)
    .forEach((nestedLine) => nestedLine.remove());

  return clone.innerHTML.trim() || "<br>";
}

function detailLineElementToPastePart(element: HTMLElement): PasteLinePart {
  const rawType = element.dataset.lineType;
  const lineType =
    rawType && rawType !== "text"
      ? (rawType as PasteLinePart["lineType"])
      : undefined;
  const listIndent = Number.parseInt(element.dataset.listIndent ?? "0", 10);

  return {
    html: getDetailLinePasteHtml(element),
    lineType,
    checked:
      lineType === "checklist"
        ? element.dataset.checked === "true"
        : undefined,
    listIndent: listIndent > 0 ? listIndent : undefined,
  };
}

function detailLinesHtmlToPasteLineParts(html: string): PasteLinePart[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.body.querySelector(`[${DETAIL_CLIPBOARD_ROOT_ATTR}]`);
  const scope = root ?? doc.body;

  // Browsers often re-nest sibling `.detail-line` elements when reading
  // clipboard HTML back, so collect every line under the root in document
  // order — not just direct children.
  const lineElements = [...scope.querySelectorAll(`.${DETAIL_LINE_CLASS}`)].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );

  return lineElements.map(detailLineElementToPastePart);
}

function pasteHtmlHasInlineFormatting(html: string) {
  const sanitized = sanitizePastedHtml(html);
  if (!sanitized.trim()) return false;

  if (/<(b|strong|i|em|u|s|strike|mark)\b/i.test(sanitized)) {
    return true;
  }

  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  for (const element of doc.body.querySelectorAll("*")) {
    if (!(element instanceof HTMLElement)) continue;
    if (isBoldStyle(element.style) || isItalicStyle(element.style)) {
      return true;
    }
    if (element.style.color || element.style.backgroundColor) {
      return true;
    }
  }

  return false;
}

/** Prefer HTML parts when clipboard HTML carries structure or inline formatting. */
function shouldPreferHtmlPasteParts(html: string) {
  if (/<(ul|ol)\b/i.test(html)) return true;
  if (pasteHtmlHasInlineFormatting(html)) return true;
  return false;
}

function plainLineShouldRetainBold(line: string) {
  return /^\d+[.)]\s+\S/.test(line);
}

function lineHtmlIsFullyBold(html: string) {
  if (!html.trim() || typeof DOMParser === "undefined") {
    return false;
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root?.textContent?.trim()) {
    return false;
  }

  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      textNodes.push(node as Text);
    }
    node = walker.nextNode();
  }

  if (textNodes.length === 0) {
    return false;
  }

  return textNodes.every((textNode) => {
    let parent: HTMLElement | null = textNode.parentElement;
    while (parent && parent !== root) {
      if (parent.tagName === "STRONG" || parent.tagName === "B") {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  });
}

function stripOuterBoldTags(html: string) {
  let current = html.trim();

  while (current) {
    const match = current.match(/^<(strong|b)(\s[^>]*)?>([\s\S]*)<\/\1>$/i);
    if (!match) break;
    current = match[3].trim();
  }

  return current || "<br>";
}

function lineHtmlStartsWithBoldWord(html: string) {
  if (!html.trim() || typeof DOMParser === "undefined") {
    return false;
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) {
    return false;
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text | null;
  if (!textNode?.textContent?.trim()) {
    return false;
  }

  if (!/^(\s*)(\S+)/.test(textNode.textContent)) {
    return false;
  }

  let parent: HTMLElement | null = textNode.parentElement;
  while (parent && parent !== root) {
    if (parent.tagName === "STRONG" || parent.tagName === "B") {
      return true;
    }
    if (isBoldStyle(parent.style)) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

function unboldFirstWordInLineHtml(html: string) {
  if (typeof DOMParser === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) {
    return html;
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text | null;
  if (!textNode?.textContent) {
    return html;
  }

  const content = textNode.textContent;
  const wordMatch = content.match(/^(\s*)(\S+)([\s\S]*)$/);
  if (!wordMatch) {
    return html;
  }

  const [, leading, word, remainder] = wordMatch;
  let parent: HTMLElement | null = textNode.parentElement;
  let boldElement: HTMLElement | null = null;

  while (parent && parent !== root) {
    if (parent.tagName === "STRONG" || parent.tagName === "B") {
      boldElement = parent;
      break;
    }
    parent = parent.parentElement;
  }

  if (!boldElement) {
    return html;
  }

  textNode.textContent = `${leading}${remainder}`;

  const wordText = doc.createTextNode(word);
  boldElement.parentNode?.insertBefore(wordText, boldElement);

  if (!textNode.textContent?.trim() && !boldElement.textContent?.trim()) {
    boldElement.remove();
  }

  return root.innerHTML.trim() || "<br>";
}

function getPlainTextLines(plainText: string) {
  const lines = normalizeClipboardPlainText(plainText).split("\n");
  if (lines.length > 1 && lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

export function normalizeMultiLinePasteBoldParts(
  parts: PasteLinePart[],
  plainText?: string | null,
) {
  if (parts.length <= 2) {
    return parts;
  }

  const plainLines = plainText?.trim() ? getPlainTextLines(plainText) : [];
  const expectedBoldLines = plainLines.filter((line) =>
    plainLineShouldRetainBold(line.trim()),
  ).length;
  const fullyBoldParts = parts.filter((part) => lineHtmlIsFullyBold(part.html));
  const hasBoldBleed = fullyBoldParts.length > expectedBoldLines;

  return parts.map((part, index) => {
    const plainLine = plainLines[index]?.trim() ?? "";
    let html = part.html;

    if (
      hasBoldBleed &&
      lineHtmlIsFullyBold(html) &&
      plainLine &&
      !plainLineShouldRetainBold(plainLine)
    ) {
      html = stripOuterBoldTags(html);
    }

    if (
      index === 0 &&
      parts.length > 2 &&
      plainLine &&
      !plainLineShouldRetainBold(plainLine) &&
      lineHtmlStartsWithBoldWord(html)
    ) {
      html = unboldFirstWordInLineHtml(html);
    }

    if (plainLine && plainLineShouldRetainBold(plainLine) && !lineHtmlIsFullyBold(html)) {
      html = `<strong>${html}</strong>`;
    }

    return html === part.html ? part : { ...part, html: html.trim() || "<br>" };
  });
}

function elementSubtreeContainsTextNewline(element: HTMLElement) {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.includes("\n")) {
      return true;
    }
    node = walker.nextNode();
  }
  return false;
}

function splitNodeChildrenOnTextNewlines(
  nodes: Node[],
  frames: PasteFormatFrame[],
  doc: Document,
  segments: string[],
) {
  let currentNodes: Node[] = [];

  const flush = () => {
    if (currentNodes.length === 0) {
      return;
    }

    const html = wrapNodesInFormatFrames(currentNodes, frames, doc);
    if (html) {
      segments.push(html);
    }
    currentNodes = [];
  };

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text.includes("\n")) {
        if (text) {
          currentNodes.push(doc.createTextNode(text));
        }
        continue;
      }

      const pieces = text.split("\n");
      for (let index = 0; index < pieces.length; index += 1) {
        if (pieces[index]) {
          currentNodes.push(doc.createTextNode(pieces[index]!));
        }
        if (index < pieces.length - 1) {
          flush();
        }
      }
      continue;
    }

    if (node instanceof HTMLElement) {
      if (elementSubtreeContainsTextNewline(node)) {
        flush();
        const childFrames = shouldAddFormatFrameWhenSplittingOnBreaks(node)
          ? [...frames, createPasteFormatFrame(node)]
          : frames;
        splitNodeChildrenOnTextNewlines(
          [...node.childNodes],
          childFrames,
          doc,
          segments,
        );
        continue;
      }

      currentNodes.push(node.cloneNode(true));
      continue;
    }

    currentNodes.push(node.cloneNode(true));
  }

  flush();
}

/** Split HTML on literal newline characters while keeping per-line inline formatting. */
function splitHtmlOnTextNewlines(html: string): string[] | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const doc = new DOMParser().parseFromString(
    `<div id="__paste_split_root__">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__paste_split_root__");
  if (!root || !elementSubtreeContainsTextNewline(root)) {
    return null;
  }

  const segments: string[] = [];
  splitNodeChildrenOnTextNewlines([...root.childNodes], [], doc, segments);
  return segments.length > 1 ? segments : null;
}

function expandHtmlPartsToPlainLineCount(
  htmlParts: PasteLinePart[],
  plainText: string,
): PasteLinePart[] {
  const plainLines = getPlainTextLines(plainText);
  if (plainLines.length <= 2 || plainLines.length <= htmlParts.length) {
    return htmlParts;
  }

  if (htmlParts.length !== 1) {
    return htmlParts;
  }

  const expanded = splitHtmlOnTextNewlines(htmlParts[0]!.html);
  if (!expanded || expanded.length !== plainLines.length) {
    return htmlParts;
  }

  return expanded.map((segment) => ({
    html: sanitizePastedHtml(segment).trim() || "<br>",
  }));
}

export function choosePasteLineParts(html: string, plainText?: string | null) {
  const hasHtml = Boolean(html?.trim());
  const htmlParts = hasHtml ? htmlToPasteLineParts(html) : [];

  let parts: PasteLinePart[];

  if (!plainText?.trim()) {
    parts = htmlParts.length > 0 ? htmlParts : [{ html: "<br>" }];
  } else {
    const plainParts = plainTextToPasteLineParts(plainText);
    if (!hasHtml) {
      parts = plainParts;
    } else if (shouldPreferHtmlPasteParts(html)) {
      parts = htmlParts.length > 0 ? htmlParts : plainParts;
    } else if (htmlParts.length >= plainParts.length) {
      parts = htmlParts;
    } else {
      parts = plainParts;
    }

    parts = expandHtmlPartsToPlainLineCount(parts, plainText);
  }

  return normalizeMultiLinePasteBoldParts(parts, plainText);
}

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

const INLINE_FORMATTING_WRAP_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
]);

function childIsBoldFormatting(element: HTMLElement) {
  if (element.tagName === "B" || element.tagName === "STRONG") {
    return true;
  }

  return isBoldStyle(element.style);
}

/** True when a bold/italic wrapper contains both formatted and normal runs. */
function formattingWrapperHasMixedContent(element: HTMLElement) {
  if (element.querySelector("br")) {
    if (element.tagName === "STRONG" || element.tagName === "EM") {
      return element.querySelector("span, p, div, li, font") !== null;
    }
    return true;
  }

  const textNodes = [...element.childNodes].filter(
    (node) =>
      node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim(),
  );
  const elementChildren = [...element.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (textNodes.length > 0 && elementChildren.length > 0) {
    return true;
  }

  if (elementChildren.length > 1) {
    const allBoldChildren = elementChildren.every((child) =>
      childIsBoldFormatting(child),
    );
    if (!allBoldChildren) {
      return true;
    }
  }

  for (const descendant of element.querySelectorAll(
    "span, p, div, li, font",
  )) {
    if (!(descendant instanceof HTMLElement)) continue;
    const weight = descendant.style.fontWeight;
    if (weight && !isBoldStyle(descendant.style)) {
      return true;
    }
  }

  return false;
}

/**
 * Google Docs and similar apps wrap copied ranges in `<b style="font-weight:
 * normal">` (or semantic `<b>` with `<br>` / mixed spans). After we strip the
 * neutralizing style, the bare tag would incorrectly bold/italicize descendants.
 */
function formattingWrapperShouldUnwrap(element: HTMLElement) {
  if (elementHasDirectBlockChild(element)) {
    return true;
  }

  if (INLINE_FORMATTING_WRAP_TAGS.has(element.tagName)) {
    if (formattingWrapperHasMixedContent(element)) {
      return true;
    }
  }

  if (element.tagName === "SPAN" && elementHasDirectBlockChild(element)) {
    return true;
  }

  const styleAttr = element.getAttribute("style");
  if (!styleAttr?.trim()) {
    return false;
  }

  if (element.tagName === "B" || element.tagName === "STRONG") {
    return !isBoldStyle(element.style);
  }

  if (element.tagName === "I" || element.tagName === "EM") {
    return !isItalicStyle(element.style);
  }

  if (element.tagName === "SPAN") {
    const hasWeight = Boolean(element.style.fontWeight);
    const hasStyle = Boolean(element.style.fontStyle);
    if (hasWeight && !isBoldStyle(element.style)) {
      return true;
    }
    if (hasStyle && !isItalicStyle(element.style)) {
      return true;
    }
  }

  return false;
}

function unwrapSpuriousFormattingContainers(root: ParentNode) {
  const elements = [...root.querySelectorAll("b, strong, i, em, span")].reverse();

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    if (formattingWrapperShouldUnwrap(element)) {
      unwrapElement(element);
    }
  }
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
  const fontWeight = element.style.fontWeight;
  const fontStyle = element.style.fontStyle;

  element.removeAttribute("style");

  if (safeColor && !isIgnorableDefaultTextColor(safeColor)) {
    element.style.color = safeColor;
  }

  // Keep explicit normal weight/style so text stays unbold inside stray wrappers.
  if (fontWeight && !isBoldStyle({ fontWeight } as CSSStyleDeclaration)) {
    element.style.fontWeight = fontWeight;
  }

  if (fontStyle && !isItalicStyle({ fontStyle } as CSSStyleDeclaration)) {
    element.style.fontStyle = fontStyle;
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
  // Bold/italic can arrive as CSS (font-weight/font-style) on inline elements.
  // Never wrap entire block tags (<p>, <div>, …) in <strong>/<em> — that
  // would bold every line when a container style leaks onto a block.
  const style = element.style;
  const isBlock = BLOCK_PASTE_TAGS.has(element.tagName);

  if (!isBlock) {
    if (isBoldStyle(style)) {
      wrapNodeContents(element, "strong");
      element.style.removeProperty("font-weight");
    }

    if (isItalicStyle(style)) {
      wrapNodeContents(element, "em");
      element.style.removeProperty("font-style");
    }
  } else {
    if (style.fontWeight) {
      element.style.removeProperty("font-weight");
    }
    if (style.fontStyle) {
      element.style.removeProperty("font-style");
    }
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

  if (
    (INLINE_FORMATTING_WRAP_TAGS.has(source.tagName) ||
      source.tagName === "SPAN") &&
    formattingWrapperShouldUnwrap(source)
  ) {
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

  unwrapSpuriousFormattingContainers(container);

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

/**
 * Converts a CSS length (e.g. "36pt", "0.5in", "48px") to an approximate
 * pixel value so indentation from different sources can be compared on a
 * common scale.
 */
function parseCssLengthToPx(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = value.trim().match(/^(-?[\d.]+)\s*(px|pt|in|cm|mm|pc|q)?$/i);
  if (!match) return null;

  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;

  const unit = (match[2] ?? "px").toLowerCase();
  switch (unit) {
    case "pt":
      return num * (96 / 72);
    case "in":
      return num * 96;
    case "cm":
      return num * (96 / 2.54);
    case "mm":
      return num * (96 / 25.4);
    case "pc":
      return num * 16;
    case "q":
      return num * (96 / 101.6);
    default:
      return num;
  }
}

/**
 * Reads a CSS length directly from an element's raw `style` attribute
 * string. Using the raw attribute (rather than the parsed CSSStyleDeclaration)
 * avoids cross-browser inconsistencies in how logical properties like
 * `padding-inline-start` get normalized, and lets us inspect indentation
 * *before* sanitization strips the style attribute.
 */
function readCssLengthFromStyleAttr(
  styleAttr: string | null,
  property: string,
): number | null {
  if (!styleAttr) return null;

  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i");
  const match = styleAttr.match(pattern);
  if (!match) return null;

  return parseCssLengthToPx(match[1].trim());
}

/**
 * Many word processors (Google Docs in particular) represent multi-level
 * bullet/numbered lists as a *flat* sequence of sibling `<ul>`/`<ol>`
 * elements — each wrapping a single `<li>` — rather than real nested
 * `<ul><li><ul>...` structure. The indentation level lives only in an
 * inline `padding-inline-start`/`padding-left`/`margin-left` style on the
 * list (or its `<li>`), which increases with each nesting level. This reads
 * that indentation, falling back to the first `<li>` child when the list
 * itself has no indent styling.
 */
function getListElementIndentPx(listElement: HTMLElement): number | null {
  const candidates = [listElement, listElement.querySelector(":scope > li")];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const styleAttr = candidate.getAttribute("style");
    const px =
      readCssLengthFromStyleAttr(styleAttr, "padding-inline-start") ??
      readCssLengthFromStyleAttr(styleAttr, "padding-left") ??
      readCssLengthFromStyleAttr(styleAttr, "margin-left");

    if (px !== null && px > 0) {
      return px;
    }
  }

  return null;
}

/**
 * Tracks measured list indentation (in px) across an entire pasted
 * document and maps each measured value to a stable zero-based nesting
 * level, treating close values (within `TOLERANCE_PX`) as the same level.
 * This lets flat sibling lists with only CSS-based indentation (see
 * `getListElementIndentPx`) be reconstructed into proper nesting levels.
 */
function createListIndentTracker() {
  const TOLERANCE_PX = 6;
  const stack: number[] = [];

  return {
    levelFor(indentPx: number) {
      while (
        stack.length > 0 &&
        indentPx < stack[stack.length - 1] - TOLERANCE_PX
      ) {
        stack.pop();
      }

      if (
        stack.length > 0 &&
        Math.abs(indentPx - stack[stack.length - 1]) <= TOLERANCE_PX
      ) {
        return stack.length - 1;
      }

      stack.push(indentPx);
      return stack.length - 1;
    },
  };
}

type ListIndentTracker = ReturnType<typeof createListIndentTracker>;

function isEmptyPasteLineHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<br>") return true;

  const doc = new DOMParser().parseFromString(trimmed, "text/html");
  const text = (doc.body.textContent ?? "").replace(/\u00a0/g, " ").trim();
  return !text;
}

function pushPasteLine(
  lines: PasteLinePart[],
  html: string,
  lineType?: PasteLinePart["lineType"],
  checked?: boolean,
  listIndent?: number,
) {
  const trimmed = html.trim();
  lines.push({
    html: trimmed || "<br>",
    lineType,
    checked,
    listIndent,
  });
}

function getListItemInlineHtml(item: HTMLElement) {
  const clone = item.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(":scope > ul, :scope > ol")
    .forEach((nestedList) => nestedList.remove());

  return getInlineLineHtml(clone);
}

function processPasteListItems(
  listElement: HTMLElement,
  lines: PasteLinePart[],
  depth: number,
  indentTracker: ListIndentTracker,
) {
  const checklist = isChecklistList(listElement);

  if (checklist) {
    const measuredIndentPx = getListElementIndentPx(listElement);
    const level =
      measuredIndentPx !== null ? indentTracker.levelFor(measuredIndentPx) : depth;

    for (const item of listElement.querySelectorAll(":scope > li")) {
      if (!(item instanceof HTMLElement)) continue;

      const inlineHtml = getListItemInlineHtml(item);
      if (isEmptyPasteLineHtml(inlineHtml)) continue;

      pushPasteLine(
        lines,
        inlineHtml,
        "checklist",
        isListItemChecked(item),
        level > 0 ? level : undefined,
      );

      for (const nestedList of item.querySelectorAll(":scope > ul, :scope > ol")) {
        if (nestedList instanceof HTMLElement) {
          processPasteListItems(nestedList, lines, level + 1, indentTracker);
        }
      }
    }
    return;
  }

  // External bullet/numbered lists become plain text lines so pasted content
  // keeps inline formatting (bold, etc.) without turning on app list blocks.
  for (const item of listElement.querySelectorAll(":scope > li")) {
    if (!(item instanceof HTMLElement)) continue;

    const inlineHtml = getListItemInlineHtml(item);
    if (isEmptyPasteLineHtml(inlineHtml)) continue;

    pushPasteLine(lines, inlineHtml);

    for (const nestedList of item.querySelectorAll(":scope > ul, :scope > ol")) {
      if (nestedList instanceof HTMLElement) {
        processPasteListItems(nestedList, lines, 0, indentTracker);
      }
    }
  }
}

function processPasteBlockNode(
  node: Node,
  lines: PasteLinePart[],
  indentTracker: ListIndentTracker,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) {
      pushPasteLine(lines, escapeHtml(text));
    }
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.tagName === "UL" || node.tagName === "OL") {
    processPasteListItems(node, lines, 0, indentTracker);
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
      processPasteBlockNode(child, lines, indentTracker);
    }
    return;
  }

  if (BLOCK_PASTE_TAGS.has(node.tagName)) {
    pushPasteLineSegments(
      lines,
      getInlineLineHtml(node),
      headingLineType(node.tagName),
    );
    return;
  }

  pushPasteLineSegments(lines, getInlineLineHtml(node));
}

type PasteFormatFrame = {
  tag: string;
  attributes: Array<[string, string]>;
};

function isPasteFormatWrapper(element: HTMLElement) {
  if (INLINE_FORMATTING_WRAP_TAGS.has(element.tagName)) {
    return true;
  }

  if (element.tagName === "SPAN" || element.tagName === "FONT") {
    return element.attributes.length > 0;
  }

  return element.tagName === "A" || element.tagName === "MARK";
}

function shouldAddFormatFrameWhenSplittingOnBreaks(element: HTMLElement) {
  if (element.tagName === "B") {
    return false;
  }

  if (formattingWrapperHasMixedContent(element)) {
    return false;
  }

  return isPasteFormatWrapper(element);
}

function createPasteFormatFrame(element: HTMLElement): PasteFormatFrame {
  const attributes: Array<[string, string]> = [];

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (
      name === "style" ||
      name === "href" ||
      name === "color" ||
      name === "face"
    ) {
      attributes.push([attribute.name, attribute.value]);
    }
  }

  return {
    tag: element.tagName.toLowerCase(),
    attributes,
  };
}

function wrapNodesInFormatFrames(
  nodes: Node[],
  frames: PasteFormatFrame[],
  doc: Document,
): string {
  if (nodes.length === 0) {
    return "";
  }

  const container = doc.createElement("div");
  let parent: HTMLElement = container;

  for (const frame of frames) {
    const wrapper = doc.createElement(frame.tag);
    for (const [name, value] of frame.attributes) {
      wrapper.setAttribute(name, value);
    }
    parent.appendChild(wrapper);
    parent = wrapper;
  }

  for (const node of nodes) {
    parent.appendChild(node);
  }

  return container.innerHTML.trim();
}

function splitNodeChildrenOnBreaks(
  nodes: Node[],
  frames: PasteFormatFrame[],
  doc: Document,
  segments: string[],
) {
  let currentNodes: Node[] = [];

  const flush = () => {
    if (currentNodes.length === 0) {
      return;
    }

    const html = wrapNodesInFormatFrames(currentNodes, frames, doc);
    if (html) {
      segments.push(html);
    }
    currentNodes = [];
  };

  for (const node of nodes) {
    if (node instanceof HTMLElement && node.tagName === "BR") {
      flush();
      continue;
    }

    if (node instanceof HTMLElement && node.querySelector("br")) {
      flush();
      const childFrames = shouldAddFormatFrameWhenSplittingOnBreaks(node)
        ? [...frames, createPasteFormatFrame(node)]
        : frames;
      splitNodeChildrenOnBreaks(
        [...node.childNodes],
        childFrames,
        doc,
        segments,
      );
      continue;
    }

    currentNodes.push(node.cloneNode(true));
  }

  flush();
}

/** Split HTML on <br> while keeping balanced inline formatting per segment. */
function splitHtmlOnBreaksToSegments(html: string): string[] {
  const doc = new DOMParser().parseFromString(
    `<div id="__paste_split_root__">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__paste_split_root__");
  if (!root || !root.querySelector("br")) {
    return [html.trim() || "<br>"];
  }

  const segments: string[] = [];
  splitNodeChildrenOnBreaks([...root.childNodes], [], doc, segments);
  return segments.length > 0 ? segments : ["<br>"];
}

function pushPasteLineSegments(
  lines: PasteLinePart[],
  html: string,
  lineType?: PasteLinePart["lineType"],
) {
  if (!/<br\b/i.test(html)) {
    pushPasteLine(lines, html, lineType);
    return;
  }

  for (const segment of splitHtmlOnBreaksToSegments(html)) {
    if (isEmptyPasteLineHtml(segment)) continue;
    pushPasteLine(lines, segment, lineType);
  }
}

const PLAIN_BULLET_LINE = /^(\s*)([-*•⁃]\s+)(.*)$/;
const PLAIN_NUMBERED_LINE = /^(\s*)(\d+[.)]\s+)(.*)$/;
const PLAIN_CHECKLIST_LINE = /^(\s*)\[( |x|X)\]\s+(.*)$/;
const PLAIN_LIST_INDENT_SPACES = 2;

function plainTextListIndentLevel(leadingWhitespace: string) {
  const normalized = leadingWhitespace.replace(/\t/g, "  ");
  return Math.max(0, Math.floor(normalized.length / PLAIN_LIST_INDENT_SPACES));
}

export function plainTextLineToPastePart(line: string): PasteLinePart {
  const checklistMatch = line.match(PLAIN_CHECKLIST_LINE);
  if (checklistMatch) {
    const listIndent = plainTextListIndentLevel(checklistMatch[1]);
    return {
      html: escapeHtml(checklistMatch[3].trim()) || "<br>",
      lineType: "checklist",
      checked: checklistMatch[2].toLowerCase() === "x",
      listIndent: listIndent > 0 ? listIndent : undefined,
    };
  }

  const bulletMatch = line.match(PLAIN_BULLET_LINE);
  if (bulletMatch) {
    return {
      html: escapeHtml(bulletMatch[3].trim()) || "<br>",
    };
  }

  const numberedMatch = line.match(PLAIN_NUMBERED_LINE);
  if (numberedMatch) {
    return {
      html: escapeHtml(numberedMatch[3].trim()) || "<br>",
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

function splitNonBlockClipboardHtml(cleaned: string): string[] {
  const doc = new DOMParser().parseFromString(cleaned, "text/html");
  doc
    .querySelectorAll("script, style, meta, link, head, title, iframe, object, embed")
    .forEach((element) => element.remove());

  if (doc.body.querySelector("br")) {
    return splitHtmlOnBreaksToSegments(cleaned);
  }

  const meaningfulNodes = [...doc.body.childNodes].filter((node) =>
    node.nodeType === Node.TEXT_NODE
      ? Boolean(node.textContent?.trim())
      : node.nodeType === Node.ELEMENT_NODE,
  );

  if (meaningfulNodes.length > 1) {
    return meaningfulNodes
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return escapeHtml(node.textContent ?? "");
        }
        if (node instanceof HTMLElement) {
          return node.innerHTML.trim();
        }
        return "";
      })
      .filter((segment) => segment.trim());
  }

  if (meaningfulNodes.length === 1 && meaningfulNodes[0] instanceof HTMLElement) {
    const element = meaningfulNodes[0];

    if (elementHasDirectBlockChild(element)) {
      const blockChildren = [...element.children].filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && BLOCK_PASTE_TAGS.has(child.tagName),
      );
      if (blockChildren.length > 1) {
        return blockChildren.map((child) => getInlineLineHtml(child));
      }
    }

    const inlineChildren = [...element.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (
      inlineChildren.length > 1 &&
      (formattingWrapperShouldUnwrap(element) ||
        INLINE_FORMATTING_WRAP_TAGS.has(element.tagName))
    ) {
      return inlineChildren
        .map((child) => child.innerHTML.trim())
        .filter(Boolean);
    }
  }

  return [cleaned.trim() || "<br>"];
}

export function htmlToPasteLineParts(html: string): PasteLinePart[] {
  // Structure (list nesting, indentation) is extracted from the lightly
  // cleaned — but not yet attribute-stripped — HTML, since full
  // sanitization (via `sanitizePastedHtml`) removes the inline
  // `padding-inline-start`/`margin-left` styles that encode indentation
  // for sources like Google Docs. Each line's own content is sanitized
  // individually afterward, so this is not a security trade-off.
  const cleaned = stripOfficeHtmlCruft(html);
  if (!cleaned.trim()) {
    return [{ html: "<br>" }];
  }

  if (isDetailLinesClipboardHtml(cleaned)) {
    const parts = detailLinesHtmlToPasteLineParts(cleaned);
    for (const line of parts) {
      line.html = sanitizePastedHtml(line.html).trim() || "<br>";
    }
    return parts.length > 0 ? parts : [{ html: "<br>" }];
  }

  if (!pastedHtmlHasBlockStructure(cleaned)) {
    return splitNonBlockClipboardHtml(cleaned).map((segment) => ({
      html: sanitizePastedHtml(segment).trim() || "<br>",
    }));
  }

  const doc = new DOMParser().parseFromString(cleaned, "text/html");
  doc
    .querySelectorAll("script, style, meta, link, head, title, iframe, object, embed")
    .forEach((element) => element.remove());

  const lines: PasteLinePart[] = [];
  const indentTracker = createListIndentTracker();

  for (const child of [...doc.body.childNodes]) {
    processPasteBlockNode(child, lines, indentTracker);
  }

  if (lines.length === 0) {
    const sanitized = sanitizePastedHtml(cleaned);
    return [{ html: sanitized.trim() || "<br>" }];
  }

  for (const line of lines) {
    line.html = sanitizePastedHtml(line.html).trim() || "<br>";
  }

  return lines;
}
