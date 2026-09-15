import { LABEL_PRESET_COLORS, normalizeLabelColorHex } from "@/lib/label-colors";
import type { TodoList } from "@/app/components/todo-app";

export const DEFAULT_LIST_COLOR = "#acadb7";

export const LIST_COLOR_PRESETS = LABEL_PRESET_COLORS.map((preset) => preset.dot);

export function normalizeListColorHex(color: string) {
  return normalizeLabelColorHex(color);
}

export function getListColor(list: Pick<TodoList, "color">) {
  if (!list.color) return DEFAULT_LIST_COLOR;
  return normalizeListColorHex(list.color);
}
