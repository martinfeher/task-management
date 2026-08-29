/**
 * Canonical ProseMirror/Tiptap-style document model for `Task.detailsDoc`.
 *
 * This is intentionally a closed schema: only the node/mark types listed here
 * are considered valid. `validate.ts` enforces that at the API boundary so
 * every client (web, mobile, future desktop) renders the same document the
 * same way.
 *
 * Scope note: this document represents the task *body* only (what is stored
 * in `Task.details` today). The task title continues to live in `Task.name`,
 * matching the existing `details-api.md` contract ("details — body lines
 * only, no title line").
 */

export const MARK_TYPES = [
  "bold",
  "italic",
  "underline",
  "strike",
  "highlight",
  "textStyle",
  "link",
] as const;

export type MarkType = (typeof MARK_TYPES)[number];

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "highlight"; attrs: { color: string } }
  | { type: "textStyle"; attrs: Partial<{ color: string; fontFamily: string; fontSize: string }> }
  | { type: "link"; attrs: { href: string } };

export type TextNode = {
  type: "text";
  text: string;
  marks?: Mark[];
};

/** Mid-paragraph soft line break (Shift+Enter), distinct from paragraph boundaries. */
export type HardBreakNode = {
  type: "hardBreak";
};

export type InlineNode = TextNode | HardBreakNode;

export type HeadingNode = {
  type: "heading";
  attrs: { level: 2 | 3 };
  content?: InlineNode[];
};

export type ParagraphNode = {
  type: "paragraph";
  content?: InlineNode[];
};

export type CodeBlockNode = {
  type: "codeBlock";
  content?: TextNode[];
};

export type ImageNode = {
  type: "image";
  attrs: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  };
};

export type ListItemContentNode = ParagraphNode | HeadingNode;

export type ListItemNode = {
  type: "listItem";
  content: ListItemContentNode[];
};

export type BulletListNode = {
  type: "bulletList";
  content: ListItemNode[];
};

export type OrderedListNode = {
  type: "orderedList";
  attrs?: { start: number };
  content: ListItemNode[];
};

export type TaskItemNode = {
  type: "taskItem";
  attrs: { checked: boolean };
  content: ListItemContentNode[];
};

export type TaskListNode = {
  type: "taskList";
  content: TaskItemNode[];
};

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | CodeBlockNode
  | ImageNode
  | BulletListNode
  | OrderedListNode
  | TaskListNode;

export type TaskDoc = {
  type: "doc";
  content: BlockNode[];
};

export const CURRENT_SCHEMA_VERSION = 1;

export function emptyDoc(): TaskDoc {
  return { type: "doc", content: [] };
}
