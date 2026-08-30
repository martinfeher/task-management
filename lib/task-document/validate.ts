import { isAllowedDetailFontFamily } from "./detail-font-families";
import {
  type BlockNode,
  type InlineNode,
  type ListItemContentNode,
  type ListItemNode,
  type Mark,
  type TaskDoc,
  type TextNode,
} from "./types";

/** Rejects anything but simple hex/rgb/rgba/hsl/named CSS colors — no url(), no expressions. */
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\)|[a-zA-Z]+)$/;
const SAFE_FONT_FAMILY =
  /^(var\(--[a-z0-9-]+\),\s*[a-z\s'-]+|[a-zA-Z0-9\s,'"-]{1,160})$/i;
const SAFE_FONT_SIZE = /^[0-9]{1,3}(\.[0-9]+)?(px|pt|rem|em)$/;

function isSafeHref(href: string) {
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

class DocValidationError extends Error {}

function fail(message: string): never {
  throw new DocValidationError(message);
}

function validateMark(value: unknown): Mark {
  if (!value || typeof value !== "object") fail("Mark must be an object");
  const mark = value as Record<string, unknown>;

  switch (mark.type) {
    case "bold":
    case "italic":
    case "underline":
    case "strike":
      return { type: mark.type };
    case "highlight": {
      const attrs = mark.attrs as Record<string, unknown> | undefined;
      const color = typeof attrs?.color === "string" ? attrs.color : "";
      if (!SAFE_COLOR.test(color)) fail(`Unsafe highlight color: ${color}`);
      return { type: "highlight", attrs: { color } };
    }
    case "textStyle": {
      const attrs = (mark.attrs as Record<string, unknown> | undefined) ?? {};
      const out: { color?: string; fontFamily?: string; fontSize?: string } = {};
      if (attrs.color !== undefined) {
        if (typeof attrs.color !== "string" || !SAFE_COLOR.test(attrs.color)) {
          fail(`Unsafe textStyle color: ${String(attrs.color)}`);
        }
        out.color = attrs.color;
      }
      if (attrs.fontFamily !== undefined) {
        if (
          typeof attrs.fontFamily !== "string" ||
          (!isAllowedDetailFontFamily(attrs.fontFamily) &&
            !SAFE_FONT_FAMILY.test(attrs.fontFamily))
        ) {
          fail(`Unsafe fontFamily: ${String(attrs.fontFamily)}`);
        }
        out.fontFamily = attrs.fontFamily;
      }
      if (attrs.fontSize !== undefined) {
        if (typeof attrs.fontSize !== "string" || !SAFE_FONT_SIZE.test(attrs.fontSize)) {
          fail(`Unsafe fontSize: ${String(attrs.fontSize)}`);
        }
        out.fontSize = attrs.fontSize;
      }
      return { type: "textStyle", attrs: out };
    }
    case "link": {
      const attrs = mark.attrs as Record<string, unknown> | undefined;
      const href = typeof attrs?.href === "string" ? attrs.href : "";
      if (!href || !isSafeHref(href)) fail(`Unsafe link href: ${href}`);
      return { type: "link", attrs: { href } };
    }
    default:
      fail(`Unknown mark type: ${String(mark.type)}`);
  }
}

function validateTextNode(value: unknown): TextNode {
  if (!value || typeof value !== "object") fail("Text node must be an object");
  const node = value as Record<string, unknown>;
  if (node.type !== "text") fail(`Expected text node, got ${String(node.type)}`);
  if (typeof node.text !== "string") fail("Text node missing text string");

  const marks = Array.isArray(node.marks) ? node.marks.map(validateMark) : undefined;
  return marks && marks.length > 0 ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
}

function validateInlineNode(value: unknown): InlineNode {
  if (!value || typeof value !== "object") fail("Inline node must be an object");
  const node = value as Record<string, unknown>;
  if (node.type === "hardBreak") return { type: "hardBreak" };
  return validateTextNode(value);
}

function validateInlineContent(value: unknown): InlineNode[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail("content must be an array");
  return value.map(validateInlineNode);
}

/** Code blocks carry plain text only — no marks, no hard breaks (newlines live in the text). */
function validateCodeContent(value: unknown): TextNode[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail("content must be an array");
  return value.map(validateTextNode);
}

function validateListItemContentNode(value: unknown): ListItemContentNode {
  if (!value || typeof value !== "object") fail("List item content must be an object");
  const node = value as Record<string, unknown>;

  if (node.type === "paragraph") {
    return { type: "paragraph", content: validateInlineContent(node.content) };
  }
  if (node.type === "heading") {
    const level = (node.attrs as Record<string, unknown> | undefined)?.level;
    if (level !== 2 && level !== 3) fail(`Invalid heading level: ${String(level)}`);
    return { type: "heading", attrs: { level }, content: validateInlineContent(node.content) };
  }
  fail(`Unsupported list item content type: ${String(node.type)}`);
}

function validateListItem(value: unknown): ListItemNode {
  if (!value || typeof value !== "object") fail("List item must be an object");
  const node = value as Record<string, unknown>;
  if (node.type !== "listItem") fail(`Expected listItem, got ${String(node.type)}`);
  if (!Array.isArray(node.content) || node.content.length === 0) {
    fail("listItem must have content");
  }
  return { type: "listItem", content: node.content.map(validateListItemContentNode) };
}

function validateTaskItem(value: unknown) {
  if (!value || typeof value !== "object") fail("Task item must be an object");
  const node = value as Record<string, unknown>;
  if (node.type !== "taskItem") fail(`Expected taskItem, got ${String(node.type)}`);
  const checked = (node.attrs as Record<string, unknown> | undefined)?.checked;
  if (typeof checked !== "boolean") fail("taskItem.attrs.checked must be boolean");
  if (!Array.isArray(node.content) || node.content.length === 0) {
    fail("taskItem must have content");
  }
  return {
    type: "taskItem" as const,
    attrs: { checked },
    content: node.content.map(validateListItemContentNode),
  };
}

function validateBlockNode(value: unknown): BlockNode {
  if (!value || typeof value !== "object") fail("Block node must be an object");
  const node = value as Record<string, unknown>;

  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", content: validateInlineContent(node.content) };
    case "heading": {
      const level = (node.attrs as Record<string, unknown> | undefined)?.level;
      if (level !== 2 && level !== 3) fail(`Invalid heading level: ${String(level)}`);
      return { type: "heading", attrs: { level }, content: validateInlineContent(node.content) };
    }
    case "codeBlock":
      return { type: "codeBlock", content: validateCodeContent(node.content) };
    case "image": {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      const src = typeof attrs?.src === "string" ? attrs.src : "";
      if (!src || !isSafeHref(src)) fail(`Unsafe image src: ${src}`);
      const out: { src: string; alt?: string; width?: number; height?: number } = { src };
      if (typeof attrs?.alt === "string") out.alt = attrs.alt;
      if (typeof attrs?.width === "number") out.width = attrs.width;
      if (typeof attrs?.height === "number") out.height = attrs.height;
      return { type: "image", attrs: out };
    }
    case "bulletList": {
      if (!Array.isArray(node.content)) fail("bulletList must have content array");
      return { type: "bulletList", content: node.content.map(validateListItem) };
    }
    case "orderedList": {
      if (!Array.isArray(node.content)) fail("orderedList must have content array");
      const start = (node.attrs as Record<string, unknown> | undefined)?.start;
      const result: BlockNode = {
        type: "orderedList",
        content: node.content.map(validateListItem),
      };
      if (typeof start === "number" && Number.isFinite(start)) {
        (result as { attrs?: { start: number } }).attrs = { start };
      }
      return result;
    }
    case "taskList": {
      if (!Array.isArray(node.content)) fail("taskList must have content array");
      return { type: "taskList", content: node.content.map(validateTaskItem) };
    }
    default:
      fail(`Unknown block node type: ${String(node.type)}`);
  }
}

/**
 * Validates and normalizes an arbitrary JSON value into a TaskDoc.
 * Throws DocValidationError with a descriptive message on any schema violation
 * (unknown node/mark types, unsafe URLs/colors, malformed attrs).
 */
export function validateTaskDoc(value: unknown): TaskDoc {
  if (!value || typeof value !== "object") fail("Document must be an object");
  const doc = value as Record<string, unknown>;
  if (doc.type !== "doc") fail(`Expected doc root, got ${String(doc.type)}`);
  if (!Array.isArray(doc.content)) fail("doc.content must be an array");

  return { type: "doc", content: doc.content.map(validateBlockNode) };
}

export function isValidTaskDoc(value: unknown): value is TaskDoc {
  try {
    validateTaskDoc(value);
    return true;
  } catch {
    return false;
  }
}

export { DocValidationError };
