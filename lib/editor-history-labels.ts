export type EditorHistoryEntry = {
  html: string;
  label: string;
};

export const EDITOR_HISTORY_DEFAULT_LABEL = "Edit text";

export const EDITOR_HISTORY_OPEN_TASK_LABEL = "Open task";

export function formatUndoTooltipLabel(actionLabel: string) {
  return `Undo | ${actionLabel}`;
}

export function formatRedoTooltipLabel(actionLabel: string) {
  return `Redo | ${actionLabel}`;
}

export function inlineFormatHistoryLabel(
  command: string,
): string {
  switch (command) {
    case "bold":
      return "Bold";
    case "italic":
      return "Italic";
    case "underline":
      return "Underline";
    case "strikeThrough":
      return "Strikethrough";
    case "highlight":
      return "Highlight";
    case "superscript":
      return "Superscript";
    case "subscript":
      return "Subscript";
    default:
      return "Formatting";
  }
}

export function blockTypeHistoryLabel(type: string): string {
  switch (type) {
    case "paragraph":
      return "Text block";
    case "h1":
      return "Heading 1";
    case "h2":
      return "Heading 2";
    case "h3":
      return "Heading 3";
    case "bullet":
      return "Bullet list";
    case "numbered":
      return "Numbered list";
    case "checklist":
      return "Checklist";
    case "quote":
      return "Quote";
    case "code":
      return "Code block";
    default:
      return "Block type";
  }
}
