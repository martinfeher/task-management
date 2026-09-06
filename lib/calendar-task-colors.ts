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

export const CALENDAR_TASK_TITLE_BRIGHTNESS_CSS_VAR =
  "--calendar-task-title-brightness";

/** Title lightness multiplier applied to the task swatch (0.3 = 70% darker). */
export const DEFAULT_CALENDAR_TASK_TITLE_BRIGHTNESS = 0.3;

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

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function rgbToHsl(
  red: number,
  green: number,
  blue: number,
): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / delta + 2) / 6;
        break;
      default:
        hue = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return [hue * 360, saturation * 100, lightness * 100];
}

function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number,
): [number, number, number] {
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  if (saturation === 0) {
    const channel = l * 255;
    return [channel, channel, channel];
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  ];
}

export function getCalendarTaskTitleColorFromBackground(
  backgroundHex: string,
  brightness: number = DEFAULT_CALENDAR_TASK_TITLE_BRIGHTNESS,
) {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return DEFAULT_CALENDAR_TASK_TITLE_COLOR;

  const [hue, saturation, lightness] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const adjustedLightness = Math.max(
    0,
    Math.min(100, lightness * brightness),
  );
  const [red, green, blue] = hslToRgb(hue, saturation, adjustedLightness);
  return rgbToHex(red, green, blue);
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
    ["--calendar-task-title-source-color" as string]: surface.background,
    ["--calendar-task-time-color" as string]: DEFAULT_CALENDAR_TASK_TIME_COLOR,
  };
}
