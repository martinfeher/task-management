import type { CSSProperties } from "react";

/** Mix each sRGB channel 12% toward white. */
export function lightenHexBy12(hex: string): string {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length !== 6) return hex;

  const channels = [0, 2, 4].map((start) =>
    parseInt(normalized.slice(start, start + 2), 16),
  );
  const lightened = channels.map((channel) =>
    Math.round(channel + (255 - channel) * 0.12),
  );

  return `#${lightened
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

const TASK_CONTEXT_MENU_COLOR_BASE = {
  textPrimary: "#18181b",
  textSecondary: "#27272a",
  icon350: "#c3c3c8",
  icon400: "#a1a1aa",
  icon450: "#9a9aa1",
  icon500: "#71717a",
  icon550: "#7a7a81",
  icon600: "#52525b",
  icon650: "#65656b",
  tagIcon: "#b4b4c8",
  deleteIcon: "#e07142",
  deleteText: "#dc2626",
  deleteIconHover: "#ef4444",
  dateIcon: "#8b8d92",
  sunsetIcon: "#adaeb2",
  calendarPlusIcon: "#acafb4",
  clearDate: "#c8c1b6",
  searchIcon: "#6f6f6f",
} as const;

export type TaskContextMenuColorKey = keyof typeof TASK_CONTEXT_MENU_COLOR_BASE;

export const TASK_CONTEXT_MENU_COLORS = Object.fromEntries(
  Object.entries(TASK_CONTEXT_MENU_COLOR_BASE).map(([key, value]) => [
    key,
    lightenHexBy12(value),
  ]),
) as { [K in TaskContextMenuColorKey]: string };

export function taskContextMenuTextColor(
  key: TaskContextMenuColorKey,
): CSSProperties {
  return { color: TASK_CONTEXT_MENU_COLORS[key] };
}
