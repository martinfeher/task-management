import type { CSSProperties } from "react";
import { labelSlug } from "@/lib/task-tags";

export type LabelLike = {
  id: string;
  label: string;
  color?: string | null;
};

export type LabelColor = {
  bg: string;
  text: string;
  dot: string;
  bgClass: string;
  textClass: string;
};

export const LABEL_COLOR_PALETTE: LabelColor[] = [
  {
    bg: "#dbeafe",
    text: "#1e40af",
    dot: "#4873c7",
    bgClass: "bg-[#dbeafe]",
    textClass: "text-[#1e40af]",
  },
  {
    bg: "#dcfce7",
    text: "#166534",
    dot: "#22c55e",
    bgClass: "bg-[#dcfce7]",
    textClass: "text-[#166534]",
  },
  {
    bg: "#fef3c7",
    text: "#92400e",
    dot: "#f59e0b",
    bgClass: "bg-[#fef3c7]",
    textClass: "text-[#92400e]",
  },
  {
    bg: "#fce7f3",
    text: "#9d174d",
    dot: "#ec4899",
    bgClass: "bg-[#fce7f3]",
    textClass: "text-[#9d174d]",
  },
  {
    bg: "#ede9fe",
    text: "#5b21b6",
    dot: "#8b5cf6",
    bgClass: "bg-[#ede9fe]",
    textClass: "text-[#5b21b6]",
  },
  {
    bg: "#ffedd5",
    text: "#9a3412",
    dot: "#f97316",
    bgClass: "bg-[#ffedd5]",
    textClass: "text-[#9a3412]",
  },
  {
    bg: "#cffafe",
    text: "#155e75",
    dot: "#06b6d4",
    bgClass: "bg-[#cffafe]",
    textClass: "text-[#155e75]",
  },
  {
    bg: "#fee2e2",
    text: "#991b1b",
    dot: "#ef4444",
    bgClass: "bg-[#fee2e2]",
    textClass: "text-[#991b1b]",
  },
  {
    bg: "#e0e7ff",
    text: "#3730a3",
    dot: "#6366f1",
    bgClass: "bg-[#e0e7ff]",
    textClass: "text-[#3730a3]",
  },
  {
    bg: "#ecfccb",
    text: "#3f6212",
    dot: "#84cc16",
    bgClass: "bg-[#ecfccb]",
    textClass: "text-[#3f6212]",
  },
];

export const LABEL_PRESET_COLORS = LABEL_COLOR_PALETTE.slice(0, 10);

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

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

function rgbToHex([red, green, blue]: [number, number, number]) {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixRgb(
  source: [number, number, number],
  target: [number, number, number],
  sourceWeight: number,
) {
  const weight = Math.min(1, Math.max(0, sourceWeight));
  return rgbToHex([
    Math.round(source[0] * weight + target[0] * (1 - weight)),
    Math.round(source[1] * weight + target[1] * (1 - weight)),
    Math.round(source[2] * weight + target[2] * (1 - weight)),
  ]);
}

export function normalizeLabelColorHex(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return LABEL_COLOR_PALETTE[0].dot;
  }

  return rgbToHex(rgb);
}

function createCustomLabelColor(dot: string): LabelColor {
  const rgb = hexToRgb(dot);
  if (!rgb) {
    return LABEL_COLOR_PALETTE[0];
  }

  return {
    dot,
    bg: mixRgb(rgb, [255, 255, 255], 0.18),
    text: mixRgb(rgb, [0, 0, 0], 0.72),
    bgClass: "",
    textClass: "",
  };
}

function findPresetByDot(dot: string) {
  const normalized = normalizeLabelColorHex(dot).toLowerCase();
  return LABEL_COLOR_PALETTE.find(
    (entry) => entry.dot.toLowerCase() === normalized,
  );
}

export function getLabelColorKey(label: LabelLike) {
  return labelSlug(label.label) || label.id;
}

export function getLabelColorIndex(label: LabelLike) {
  return hashString(getLabelColorKey(label)) % LABEL_COLOR_PALETTE.length;
}

export function getLabelColor(label: LabelLike): LabelColor {
  if (label.color) {
    const preset = findPresetByDot(label.color);
    if (preset) {
      return preset;
    }

    return createCustomLabelColor(normalizeLabelColorHex(label.color));
  }

  return LABEL_COLOR_PALETTE[getLabelColorIndex(label)];
}

export function getLabelDotColor(label: LabelLike) {
  return getLabelColor(label).dot;
}

function getContrastTextColor(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";

  const [red, green, blue] = rgb.map((channel) => channel / 255);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.62 ? "#444444" : "#ffffff";
}

export function getLabelPillClassName(_palette: LabelColor) {
  return "truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium";
  // return "truncate rounded-full pl-2 pr-1 py-0.5 text-[10px] font-medium";
}

export function getLabelPillStyle(palette: LabelColor): CSSProperties {
  return {
    backgroundColor: palette.dot,
    color: getContrastTextColor(palette.dot),
  };
}

export function getLabelIconContainerClassName(palette: LabelColor) {
  return `inline-flex size-4 shrink-0 items-center justify-center rounded ${
    palette.bgClass || ""
  }`;
}

export function getLabelIconContainerStyle(
  palette: LabelColor,
): CSSProperties | undefined {
  if (palette.bgClass) {
    return undefined;
  }

  return { backgroundColor: palette.bg };
}

export function getLabelIconClassName(palette: LabelColor) {
  return `size-3 ${palette.textClass || ""}`;
}

export function getLabelIconStyle(
  palette: LabelColor,
): CSSProperties | undefined {
  if (palette.textClass) {
    return undefined;
  }

  return { color: palette.text };
}
