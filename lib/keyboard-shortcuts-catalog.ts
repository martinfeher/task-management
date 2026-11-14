export type KeyboardShortcutEntry = {
  description: string;
  keys: string[];
};

export type KeyboardShortcutGroup = {
  title: string;
  shortcuts: KeyboardShortcutEntry[];
};

export function isAppleKeyboardPlatform() {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.userAgent)
  );
}

export function getModifierKeyLabel() {
  return isAppleKeyboardPlatform() ? "⌘" : "Ctrl";
}

export function getKeyboardShortcutCatalog(): KeyboardShortcutGroup[] {
  const mod = getModifierKeyLabel();

  return [
    {
      title: "General",
      shortcuts: [
        { description: "Search", keys: [mod, "K"] },
        { description: "Open settings", keys: [mod, ","] },
        { description: "Open calendar quick view", keys: ["Alt", "+", "Alt"] },
        { description: "Close modal, menu, or dialog", keys: ["Esc"] },
      ],
    },
    {
      title: "Task list",
      shortcuts: [
        { description: "Focus add task input", keys: [mod, "Enter"] },
        {
          description: "Previous / next task while editing a title",
          keys: ["↑", "↓"],
        },
        { description: "Save task title", keys: ["Enter"] },
        { description: "Cancel task title edit", keys: ["Esc"] },
        { description: "Undo list reorder or undo completion", keys: [mod, "Z"] },
        { description: "Redo list reorder", keys: [mod, "Shift", "Z"] },
        ...(mod === "Ctrl"
          ? [{ description: "Redo list reorder (Windows)", keys: ["Ctrl", "Y"] }]
          : []),
      ],
    },
    {
      title: "Search",
      shortcuts: [
        { description: "Move selection up / down", keys: ["↑", "↓"] },
        { description: "Open selected result", keys: ["Enter"] },
        {
          description: "Open selected result in new tab",
          keys: [mod, "Enter"],
        },
      ],
    },
    {
      title: "Task details editor",
      shortcuts: [
        { description: "Undo", keys: [mod, "Z"] },
        { description: "Redo", keys: [mod, "Y"] },
        { description: "Redo", keys: [mod, "Shift", "Z"] },
        { description: "Add link (when editor is focused)", keys: [mod, "K"] },
        { description: "Select all body text", keys: [mod, "A"] },
        { description: "Indent list item", keys: ["Tab"] },
        { description: "Outdent list item", keys: ["Shift", "Tab"] },
        { description: "New line or list item", keys: ["Enter"] },
        { description: "Bold (format menu)", keys: [mod, "B"] },
        { description: "Italic (format menu)", keys: [mod, "I"] },
        {
          description: "Navigate slash command menu",
          keys: ["↑", "↓", "Enter", "Esc"],
        },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        {
          description: "Open task or link in new tab",
          keys: [mod, "Click"],
        },
      ],
    },
  ];
}
