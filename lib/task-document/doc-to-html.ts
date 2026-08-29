import type {
  BlockNode,
  InlineNode,
  ListItemContentNode,
  Mark,
  TaskDoc,
  TextNode,
} from "./types";

/**
 * Serializes a TaskDoc back into the legacy `.detail-line` HTML shape
 * (docs/details-api.md) so existing consumers (the current web editor during
 * transition, and `react-native-enriched` on mobile) keep working unchanged.
 *
 * Editor-only UI chrome (delete buttons, resize handles) is intentionally
 * NOT re-created here — the web editor already adds those dynamically when
 * HTML is loaded into a live `contentEditable` (see `normalizeImageLines` in
 * `app/components/detail-lines.ts`), so omitting them keeps this output
 * minimal and avoids duplicating that logic.
 */

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string) {
  return escapeHtml(text);
}

function markStyle(mark: Mark): string | null {
  switch (mark.type) {
    case "highlight":
      return `background-color: ${mark.attrs.color};`;
    case "textStyle": {
      const parts: string[] = [];
      if (mark.attrs.color) parts.push(`color: ${mark.attrs.color};`);
      if (mark.attrs.fontFamily) parts.push(`font-family: ${mark.attrs.fontFamily};`);
      if (mark.attrs.fontSize) parts.push(`font-size: ${mark.attrs.fontSize};`);
      return parts.length > 0 ? parts.join(" ") : null;
    }
    default:
      return null;
  }
}

function renderTextNode(node: TextNode): string {
  let html = escapeHtml(node.text);
  const marks = node.marks ?? [];

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        html = `<b>${html}</b>`;
        break;
      case "italic":
        html = `<i>${html}</i>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "link":
        html = `<a href="${escapeAttr(mark.attrs.href)}">${html}</a>`;
        break;
      default:
        break;
    }
  }

  // Combine highlight/textStyle into a single wrapping span with merged CSS.
  const styleParts = marks.map(markStyle).filter((value): value is string => Boolean(value));
  if (styleParts.length > 0) {
    html = `<span style="${styleParts.join(" ")}">${html}</span>`;
  }

  return html || "<br>";
}

function renderInlineNode(node: InlineNode): string {
  return node.type === "hardBreak" ? "<br>" : renderTextNode(node);
}

function renderInline(content: InlineNode[] | undefined): string {
  if (!content || content.length === 0) return "<br>";
  const html = content.map(renderInlineNode).join("");
  return html || "<br>";
}

function renderLine(innerHtml: string, dataLineType?: string, extraAttrs = ""): string {
  const typeAttr = dataLineType ? ` data-line-type="${dataLineType}"` : "";
  return `<div class="detail-line"${typeAttr}${extraAttrs}>${innerHtml || "<br>"}</div>`;
}

function renderListItemContent(node: ListItemContentNode): string {
  if (node.type === "heading") {
    return renderInline(node.content);
  }
  return renderInline(node.content);
}

function renderBlock(block: BlockNode): string {
  switch (block.type) {
    case "paragraph":
      return renderLine(renderInline(block.content));
    case "heading":
      return renderLine(renderInline(block.content), `h${block.attrs.level}`);
    case "codeBlock": {
      const text = (block.content ?? []).map((node) => node.text).join("");
      const escaped = escapeHtml(text).replace(/\n/g, "<br>");
      return renderLine(escaped || "<br>", "code");
    }
    case "image": {
      const { src, alt, width, height } = block.attrs;
      const styleParts = ["display: block;", "clear: both;", "margin-bottom: 0.35rem;"];
      const imgStyleParts: string[] = [];
      if (width) imgStyleParts.push(`width: ${width}px;`);
      if (height) imgStyleParts.push(`height: ${height}px;`);
      imgStyleParts.push("max-width: 100%;");
      const img = `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt ?? "Embedded image")}" class="detail-image" draggable="false" style="${imgStyleParts.join(" ")}">`;
      const wrapper = `<div class="detail-image-wrapper" contenteditable="false" style="${styleParts.join(" ")}">${img}</div>`;
      return renderLine(wrapper, undefined, " data-empty=\"true\"");
    }
    case "bulletList":
      return block.content
        .map((item) => renderLine(renderListItemContent(item.content[0]), "bullet"))
        .join("");
    case "orderedList": {
      let counter = block.attrs?.start ?? 1;
      return block.content
        .map((item) => {
          const html = renderLine(renderListItemContent(item.content[0]), "numbered", ` data-list-number="${counter}"`);
          counter += 1;
          return html;
        })
        .join("");
    }
    case "taskList":
      return block.content
        .map((item) => {
          const inner = `<span class="detail-checklist-text">${renderListItemContent(item.content[0])}</span>`;
          return renderLine(inner, "checklist", ` data-checked="${item.attrs.checked ? "true" : "false"}"`);
        })
        .join("");
    default:
      return "";
  }
}

export function docToHtml(doc: TaskDoc): string {
  if (!doc.content || doc.content.length === 0) return "";
  return doc.content.map(renderBlock).join("");
}
