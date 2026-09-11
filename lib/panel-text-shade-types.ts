import { normalizeHexColor } from "@/lib/sidebar-background-types";
import {
  getShadeHex,
  isPanelTextShadeToken,
  type PanelTextShadeId,
  type PanelTextShadeToken,
} from "@/lib/panel-text-shade-colors";

export type { PanelTextShadeId, PanelTextShadeToken } from "@/lib/panel-text-shade-colors";

export type PanelTextElementKey =
  | "listSearchText"
  | "listItems"
  | "labelItems"
  | "taskListTitle"
  | "taskTitle"
  | "subtaskTitle"
  | "taskDateTime"
  | "completedTasks";

export type PanelTextColorValue = {
  shade: PanelTextShadeToken;
  color: string;
};

export type PanelTextColorsSettings = Record<
  PanelTextElementKey,
  PanelTextColorValue
>;

export const PANEL_TEXT_ELEMENT_KEYS: PanelTextElementKey[] = [
  "listSearchText",
  "listItems",
  "labelItems",
  "taskListTitle",
  "taskTitle",
  "subtaskTitle",
  "taskDateTime",
  "completedTasks",
];

export const PANEL_TEXT_ELEMENT_LABELS: Record<PanelTextElementKey, string> = {
  listSearchText: "Search item text",
  listItems: "List items",
  labelItems: "Label items",
  taskListTitle: "List title",
  taskTitle: "Task title",
  subtaskTitle: "Subtask title",
  taskDateTime: "Date and time",
  completedTasks: "Completed tasks",
};

export const PANEL_TEXT_ELEMENT_GROUPS: Array<{
  title: string;
  keys: PanelTextElementKey[];
}> = [
  {
    title: "List panel",
    keys: ["listSearchText", "listItems", "labelItems"],
  },
  {
    title: "Task list panel",
    keys: [
      "taskListTitle",
      "taskTitle",
      "subtaskTitle",
      "taskDateTime",
      "completedTasks",
    ],
  },
];

export const PANEL_TEXT_ELEMENT_CSS_VARS: Record<PanelTextElementKey, string> =
  {
    listSearchText: "--panel-text-list-search",
    listItems: "--panel-text-list-items",
    labelItems: "--panel-text-label-items",
    taskListTitle: "--panel-text-task-list-title",
    taskTitle: "--panel-text-task-title",
    subtaskTitle: "--panel-text-subtask-title",
    taskDateTime: "--panel-text-task-datetime",
    completedTasks: "--panel-text-completed-tasks",
  };

const DEFAULT_SHADES: Record<PanelTextElementKey, PanelTextShadeToken> = {
  listSearchText: "zinc-700",
  listItems: "zinc-800",
  labelItems: "zinc-600",
  taskListTitle: "zinc-700",
  taskTitle: "zinc-700",
  subtaskTitle: "zinc-700",
  taskDateTime: "zinc-400",
  completedTasks: "zinc-400",
};

export function getDefaultPanelTextColorValue(
  key: PanelTextElementKey,
): PanelTextColorValue {
  const shade = DEFAULT_SHADES[key];
  return {
    shade,
    color: getShadeHex(shade),
  };
}

export function getDefaultPanelTextColorsSettings(): PanelTextColorsSettings {
  return Object.fromEntries(
    PANEL_TEXT_ELEMENT_KEYS.map((key) => [
      key,
      getDefaultPanelTextColorValue(key),
    ]),
  ) as PanelTextColorsSettings;
}

function normalizePanelTextColorValue(
  key: PanelTextElementKey,
  value: Partial<PanelTextColorValue> | null | undefined,
): PanelTextColorValue {
  const fallback = getDefaultPanelTextColorValue(key);
  const shade =
    typeof value?.shade === "string" && isPanelTextShadeToken(value.shade)
      ? value.shade
      : fallback.shade;
  const colorFromShade = getShadeHex(shade);
  const color = normalizeHexColor(value?.color ?? "") ?? colorFromShade;

  return { shade, color };
}

export function normalizePanelTextColorsSettings(
  value: Partial<Record<PanelTextElementKey, Partial<PanelTextColorValue>>> | null,
): PanelTextColorsSettings {
  const defaults = getDefaultPanelTextColorsSettings();

  return Object.fromEntries(
    PANEL_TEXT_ELEMENT_KEYS.map((key) => [
      key,
      normalizePanelTextColorValue(key, value?.[key] ?? defaults[key]),
    ]),
  ) as PanelTextColorsSettings;
}

export function parsePanelTextColorsSettings(
  value: unknown,
): PanelTextColorsSettings | null {
  if (typeof value !== "object" || value === null) return null;

  return normalizePanelTextColorsSettings(
    value as Partial<Record<PanelTextElementKey, Partial<PanelTextColorValue>>>,
  );
}

export function arePanelTextColorsSettingsEqual(
  a: PanelTextColorsSettings,
  b: PanelTextColorsSettings,
) {
  return PANEL_TEXT_ELEMENT_KEYS.every((key) => {
    const left = a[key];
    const right = b[key];
    return left.shade === right.shade && left.color === right.color;
  });
}

/** @deprecated Legacy palette-only settings */
export type PanelTextShadeSettings = PanelTextColorsSettings;

export function parsePanelTextShadeSettings(
  value: unknown,
): PanelTextColorsSettings | null {
  return parsePanelTextColorsSettings(value);
}
