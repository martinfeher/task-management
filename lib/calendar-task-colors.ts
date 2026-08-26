import type { CSSProperties } from "react";
import {
  mixHexColors,
  normalizeHexColor,
} from "@/lib/sidebar-background-types";
import {
  DEFAULT_CALENDAR_TASK_TIME_COLOR,
  DEFAULT_CALENDAR_TASK_TITLE_COLOR,
} from "@/lib/calendar-task-background-types";

export const CALENDAR_TASK_COLOR_OPTIONS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#78716c",
  "#64748b",
] as const;

export type CalendarTaskColor = (typeof CALENDAR_TASK_COLOR_OPTIONS)[number];

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length === 3) {
    return [
      Number.parseInt(normalized[0] + normalized[0], 16),
      Number.parseInt(normalized[1] + normalized[1], 16),
      Number.parseInt(normalized[2] + normalized[2], 16),
    ];
  }

  if (normalized.length === 6) {
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }

  return null;
}

function getContrastTextColor(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#2a2832";

  const [red, green, blue] = rgb.map((channel) => channel / 255);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.62 ? "#2a2832" : "#ffffff";
}

export function normalizeCalendarTaskColor(
  color: string | null | undefined,
): CalendarTaskColor | null {
  if (!color) return null;

  const normalized = normalizeHexColor(color)?.toLowerCase();
  if (!normalized) return null;

  return (
    CALENDAR_TASK_COLOR_OPTIONS.find(
      (option) => option.toLowerCase() === normalized,
    ) ?? null
  );
}

export function getCalendarTaskColorSurface(color: string) {
  const swatch = normalizeHexColor(color) ?? color;
  const background = mixHexColors(swatch, "#ffffff", 0.58);
  const text = getContrastTextColor(background);

  return { swatch, background, text };
}

export function getCalendarTaskColorItemStyle(
  color: string | null | undefined,
): CSSProperties | undefined {
  const normalized = normalizeCalendarTaskColor(color);
  if (!normalized) return undefined;

  const surface = getCalendarTaskColorSurface(normalized);
  return {
    backgroundColor: surface.background,
    ["--calendar-task-item-background" as string]: surface.background,
    ["--calendar-task-title-color" as string]: DEFAULT_CALENDAR_TASK_TITLE_COLOR,
    ["--calendar-task-time-color" as string]: DEFAULT_CALENDAR_TASK_TIME_COLOR,
  };
}
