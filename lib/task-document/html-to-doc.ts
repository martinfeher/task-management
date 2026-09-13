import { parse, HTMLElement as ParsedElement, NodeType, type Node as ParsedNode } from "node-html-parser";

import type {
  BlockNode,
  BulletListNode,
  InlineNode,
  ListItemContentNode,
  ListItemNode,
  Mark,
  OrderedListNode,
  TaskDoc,
  TaskItemNode,
  TaskListNode,
  TextNode,
} from "./types";
import { resolveDetailFontFamilyCss } from "./detail-font-families";

/**
 * Converts the legacy `.detail-line` HTML (see docs/details-api.md) produced
 * by the web contentEditable editor into a canonical TaskDoc.
 *
 * Design notes:
 * - This targets the *documented* line model (data-line-type per top-level
 *   `.detail-line` div). Real production `details` values are known to also
 *   carry incidental browser/paste noise (editor UI chrome like delete/resize
 *   buttons baked into storage, and inline styles like `color: rgb(85,85,85)`
 *   or `background-color: rgb(255,255,255)` that just mirror the editor's own
 *   default styling rather than user-applied formatting). Those are filtered
 *   out here so the resulting doc reflects real user intent, not incidental
 *   presentational noise.
 */

type LineType = "text" | "h2" | "h3" | "bullet" | "numbered" | "checklist" | "code";

// Matches the editor's own default styling (app/components/task-details-panel.tsx,
// app/components/detail-fonts.ts) — treated as noise, not user-applied formatting.
const DEFAULT_TEXT_COLORS = new Set(["#555555", "rgb(85, 85, 85)"]);
const NOISE_BACKGROUND_COLORS = new Set([
  "rgb(255, 255, 255)",
  "#ffffff",
  "#fff",
  "white",
  "transparent",
  "rgba(0, 0, 0, 0)",
  "initial",
  "inherit",
]);
const DEFAULT_FONT_SIZE_PX = 17;

const UI_CHROME_CLASSES = [
  "detail-image-delete",
  "detail-image-resize-handles",
  "detail-image-resize-handle",
];
const UI_CHROME_TAGS = new Set(["button", "svg", "path"]);

function parseStyleAttr(style: string | undefined): Record<string, string> {
  if (!style) return {};
  const result: Record<string, string> = {};
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function isUiChromeElement(el: ParsedElement): boolean {
  const tag = el.rawTagName?.toLowerCase();
  if (tag && UI_CHROME_TAGS.has(tag)) return true;
  return UI_CHROME_CLASSES.some((cls) => el.classList.contains(cls));
}

type MarkAcc = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlightColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  linkHref?: string;
};

function accToMarks(acc: MarkAcc): Mark[] {
  const marks: Mark[] = [];
  if (acc.bold) marks.push({ type: "bold" });
  if (acc.italic) marks.push({ type: "italic" });
  if (acc.underline) marks.push({ type: "underline" });
  if (acc.strike) marks.push({ type: "strike" });
  if (acc.highlightColor) marks.push({ type: "highlight", attrs: { color: acc.highlightColor } });

  const textStyleAttrs: { color?: string; fontFamily?: string; fontSize?: string } = {};
  if (acc.color) textStyleAttrs.color = acc.color;
  if (acc.fontFamily) textStyleAttrs.fontFamily = acc.fontFamily;
  if (acc.fontSize) textStyleAttrs.fontSize = acc.fontSize;
  if (Object.keys(textStyleAttrs).length > 0) {
    marks.push({ type: "textStyle", attrs: textStyleAttrs });
  }

  if (acc.linkHref) marks.push({ type: "link", attrs: { href: acc.linkHref } });
  return marks;
}

function applySpanStyle(el: ParsedElement, acc: MarkAcc): MarkAcc {
  const style = parseStyleAttr(el.getAttribute("style"));
  const next: MarkAcc = { ...acc };

  const color = style.color?.trim();
  if (color && !DEFAULT_TEXT_COLORS.has(color.toLowerCase())) {
    next.color = color;
  }

  const background = style["background-color"]?.trim();
  if (background && !NOISE_BACKGROUND_COLORS.has(background.toLowerCase())) {
    next.highlightColor = background;
  }

  const fontFamily = style["font-family"]?.trim();
  const resolvedFontFamily = resolveDetailFontFamilyCss(fontFamily);
  if (resolvedFontFamily) {
    next.fontFamily = resolvedFontFamily;
  }

  const fontSize = style["font-size"]?.trim();
  if (fontSize) {
    const px = Number.parseFloat(fontSize);
    if (Number.isFinite(px) && Math.round(px) !== DEFAULT_FONT_SIZE_PX) {
      next.fontSize = `${Math.round(px)}px`;
    }
  }

  return next;
}

function isSafeHref(href: string) {
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function parseInlineChildren(node: ParsedNode, acc: MarkAcc, out: InlineNode[]): void {
  for (const child of node.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const text = (child as unknown as { text: string }).text;
      if (text) {
        const marks = accToMarks(acc);
        out.push(marks.length > 0 ? { type: "text", text, marks } : { type: "text", text });
      }
      continue;
    }

    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const el = child as ParsedElement;
    if (isUiChromeElement(el)) continue;

    const tag = el.rawTagName?.toLowerCase();

    switch (tag) {
      case "br":
        out.push({ type: "hardBreak" });
        continue;
      case "b":
      case "strong":
        parseInlineChildren(el, { ...acc, bold: true }, out);
        break;
      case "i":
      case "em":
        parseInlineChildren(el, { ...acc, italic: true }, out);
        break;
      case "u":
        parseInlineChildren(el, { ...acc, underline: true }, out);
        break;
      case "s":
      case "strike":
      case "del":
        parseInlineChildren(el, { ...acc, strike: true }, out);
        break;
      case "a": {
        const href = el.getAttribute("href");
        parseInlineChildren(el, href && isSafeHref(href) ? { ...acc, linkHref: href } : acc, out);
        break;
      }
      case "span":
      case "font":
        parseInlineChildren(el, applySpanStyle(el, acc), out);
        break;
      default:
        // Unknown/structural wrapper (div, p, etc. shouldn't normally appear
        // inline) — flatten by descending without adding marks.
        parseInlineChildren(el, acc, out);
        break;
    }
  }
}

/** Drops leading/trailing placeholder `<br>`s and collapses all-break content to empty. */
function normalizeInlineContent(nodes: InlineNode[]): InlineNode[] {
  const hasText = nodes.some((node) => node.type === "text" && node.text.length > 0);
  if (!hasText) return [];

  let start = 0;
  let end = nodes.length;
  while (start < end && nodes[start].type === "hardBreak") start += 1;
  while (end > start && nodes[end - 1].type === "hardBreak") end -= 1;

  return nodes.slice(start, end);
}

function parseInlineContent(line: ParsedElement): InlineNode[] {
  const out: InlineNode[] = [];
  parseInlineChildren(line, {}, out);
  return normalizeInlineContent(out);
}

function parseCodeContent(line: ParsedElement): TextNode[] {
  const text = line.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoded = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n$/, "");

  return decoded ? [{ type: "text", text: decoded }] : [];
}

function parseImageLine(line: ParsedElement): BlockNode | null {
  const wrapper = line.querySelector(".detail-image-wrapper");
  const img = (wrapper ?? line).querySelector("img");
  if (!img) return null;

  const src = img.getAttribute("src");
  if (!src || !isSafeHref(src)) return null;

  const attrs: { src: string; alt?: string; width?: number; height?: number } = { src };
  const alt = img.getAttribute("alt");
  if (alt) attrs.alt = alt;

  const style = parseStyleAttr(img.getAttribute("style"));
  const width = Number.parseFloat(style.width ?? "");
  const height = Number.parseFloat(style.height ?? "");
  if (Number.isFinite(width)) attrs.width = Math.round(width);
  if (Number.isFinite(height)) attrs.height = Math.round(height);

  return { type: "image", attrs };
}

function getLineType(line: ParsedElement): LineType {
  const type = line.getAttribute("data-line-type");
  if (type === "h2" || type === "h3" || type === "bullet" || type === "numbered" || type === "checklist" || type === "code") {
    return type;
  }
  return "text";
}

function lineToListItemContent(line: ParsedElement, checklistText: ParsedElement | null): ListItemContentNode {
  const content = checklistText ? parseInlineContent(checklistText) : parseInlineContent(line);
  return { type: "paragraph", content };
}

function buildBulletList(lines: ParsedElement[]): BulletListNode {
  return {
    type: "bulletList",
    content: lines.map<ListItemNode>((line) => ({
      type: "listItem",
      content: [lineToListItemContent(line, null)],
    })),
  };
}

function buildOrderedList(lines: ParsedElement[]): OrderedListNode {
  const firstNumber = Number.parseInt(lines[0]?.getAttribute("data-list-number") ?? "1", 10);
  const node: OrderedListNode = {
    type: "orderedList",
    content: lines.map<ListItemNode>((line) => ({
      type: "listItem",
      content: [lineToListItemContent(line, null)],
    })),
  };
  if (Number.isFinite(firstNumber) && firstNumber !== 1) {
    node.attrs = { start: firstNumber };
  }
  return node;
}

function buildTaskList(lines: ParsedElement[]): TaskListNode {
  return {
    type: "taskList",
    content: lines.map<TaskItemNode>((line) => {
      const textWrapper = line.querySelector(".detail-checklist-text");
      return {
        type: "taskItem",
        attrs: { checked: line.getAttribute("data-checked") === "true" },
        content: [lineToListItemContent(line, textWrapper)],
      };
    }),
  };
}

function isListLineType(type: LineType): type is "bullet" | "numbered" | "checklist" {
  return type === "bullet" || type === "numbered" || type === "checklist";
}

const LINE_BREAK_SENTINEL = "\u0000";

/**
 * Some historical rows predate the `.detail-line` wrapper model and store
 * raw contentEditable output (plain `<br>`-separated text, occasionally
 * wrapped in bare `<div>`/`<p>`). Splitting on those boundaries mirrors what
 * the client's own `htmlToLineParts()` (detail-lines.ts) does when it
 * encounters the same legacy shape, so no line breaks are silently lost.
 */
function splitLegacyHtmlIntoParts(html: string): string[] {
  const normalized = html
    .replace(/\r\n/g, "\n")
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

  const parts = normalized.split(LINE_BREAK_SENTINEL).map((part) => part.trim());
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
  return parts.length > 0 ? parts : [""];
}

export function htmlToDoc(html: string): TaskDoc {
  const trimmed = html.trim();
  if (!trimmed) return { type: "doc", content: [] };

  const root = parse(trimmed);
  const lineElements = root
    .querySelectorAll(".detail-line")
    .filter((el) => el.parentNode === root);

  // Fallback for content that predates the `.detail-line` wrapper model
  // (raw `<br>`-separated text) — split into one paragraph per line so no
  // content is silently merged or lost.
  if (lineElements.length === 0) {
    const parts = splitLegacyHtmlIntoParts(trimmed);
    const blocks = parts.map(
      (part) =>
        ({
          type: "paragraph" as const,
          content: part ? parseInlineContent(parse(part)) : [],
        }),
    );

    const isAllEmpty = blocks.every((block) => block.content.length === 0);
    return isAllEmpty ? { type: "doc", content: [] } : { type: "doc", content: blocks };
  }

  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lineElements.length) {
    const line = lineElements[index];
    const lineType = getLineType(line);

    if (line.querySelector(".detail-image-wrapper") || line.querySelector("img")) {
      const imageBlock = parseImageLine(line);
      if (imageBlock) blocks.push(imageBlock);
      index += 1;
      continue;
    }

    if (isListLineType(lineType)) {
      const run: ParsedElement[] = [line];
      let next = index + 1;
      while (next < lineElements.length && getLineType(lineElements[next]) === lineType) {
        run.push(lineElements[next]);
        next += 1;
      }
      index = next;

      if (lineType === "bullet") blocks.push(buildBulletList(run));
      else if (lineType === "numbered") blocks.push(buildOrderedList(run));
      else blocks.push(buildTaskList(run));
      continue;
    }

    if (lineType === "code") {
      blocks.push({ type: "codeBlock", content: parseCodeContent(line) });
      index += 1;
      continue;
    }

    if (lineType === "h2" || lineType === "h3") {
      blocks.push({
        type: "heading",
        attrs: { level: lineType === "h2" ? 2 : 3 },
        content: parseInlineContent(line),
      });
      index += 1;
      continue;
    }

    blocks.push({ type: "paragraph", content: parseInlineContent(line) });
    index += 1;
  }

  return { type: "doc", content: blocks };
}
