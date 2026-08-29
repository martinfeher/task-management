import type { BlockNode, InlineNode, ListItemContentNode, TaskDoc } from "./types";

function inlineToPlainText(content: InlineNode[] | undefined): string {
  return (content ?? [])
    .map((node) => (node.type === "hardBreak" ? "\n" : node.text))
    .join("");
}

function listItemContentToPlainText(node: ListItemContentNode): string {
  return inlineToPlainText(node.content);
}

function blockToPlainTextLines(block: BlockNode): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return [inlineToPlainText(block.content)];
    case "codeBlock":
      return [inlineToPlainText(block.content)];
    case "image":
      return [];
    case "bulletList":
    case "orderedList":
      return block.content.map((item) => listItemContentToPlainText(item.content[0]));
    case "taskList":
      return block.content.map((item) => listItemContentToPlainText(item.content[0]));
    default:
      return [];
  }
}

/** Mirrors `taskDetailsToPlainText()` output shape for search/versioning parity. */
export function docToPlainText(doc: TaskDoc): string {
  const lines = doc.content.flatMap(blockToPlainTextLines);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function docHasContent(doc: TaskDoc): boolean {
  if (doc.content.some((block) => block.type === "image")) return true;
  return docToPlainText(doc).length > 0;
}
