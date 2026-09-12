import {
  mixHexWithWhite,
  normalizeHexColor,
} from "@/lib/sidebar-background-types";

export type TaskListBackgroundId =
  | "white"
  | "zinc-50"
  | "solid-blue"
  | "gradient-soft"
  | "gradient-short";

export type TaskListBackgroundOption = {
  id: TaskListBackgroundId;
  label: string;
  usesBaseColor: boolean;
};

export type TaskListBackgroundSettings = {
  backgroundId: TaskListBackgroundId;
  baseColor: string;
};

export type TaskListBackgroundPresentation = {
  className: string;
  style?: { background?: string };
};

export const DEFAULT_TASK_LIST_BASE_COLOR = "#f1f5ff";
export const DEFAULT_TASK_LIST_BACKGROUND_ID: TaskListBackgroundId = "white";

export const TASK_LIST_BACKGROUND_OPTIONS: TaskListBackgroundOption[] = [
  {
    id: "white",
    label: "White",
    usesBaseColor: false,
  },
  {
    id: "solid-blue",
    label: "Light blue",
    usesBaseColor: true,
  },
  {
    id: "gradient-soft",
    label: "Soft gradient",
    usesBaseColor: true,
  },
  {
    id: "gradient-short",
    label: "Short gradient",
    usesBaseColor: true,
  },
];

export function isTaskListBackgroundId(
  value: string,
): value is TaskListBackgroundId {
  return TASK_LIST_BACKGROUND_OPTIONS.some((option) => option.id === value);
}

export function getDefaultTaskListBackgroundSettings(): TaskListBackgroundSettings {
  return {
    backgroundId: DEFAULT_TASK_LIST_BACKGROUND_ID,
    baseColor: DEFAULT_TASK_LIST_BASE_COLOR,
  };
}

export function normalizeTaskListBackgroundSettings(
  value:
    | Partial<{
        backgroundId?: string;
        baseColor?: string;
      }>
    | null
    | undefined,
): TaskListBackgroundSettings {
  const defaults = getDefaultTaskListBackgroundSettings();
  const backgroundId =
    value?.backgroundId && isTaskListBackgroundId(value.backgroundId)
      ? value.backgroundId
      : defaults.backgroundId;
  const baseColor =
    normalizeHexColor(value?.baseColor ?? "") ?? defaults.baseColor;

  return { backgroundId, baseColor };
}

export function parseTaskListBackgroundSettings(
  value: unknown,
): TaskListBackgroundSettings | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<TaskListBackgroundSettings>;
  if (
    typeof candidate.backgroundId !== "string" ||
    typeof candidate.baseColor !== "string"
  ) {
    return null;
  }

  return normalizeTaskListBackgroundSettings(candidate);
}

export function getTaskListBackgroundOption(
  id: TaskListBackgroundId = DEFAULT_TASK_LIST_BACKGROUND_ID,
) {
  return (
    TASK_LIST_BACKGROUND_OPTIONS.find((option) => option.id === id) ??
    TASK_LIST_BACKGROUND_OPTIONS[0]
  );
}

export function getTaskListBackgroundPresentation(
  id: TaskListBackgroundId,
  baseColor: string = DEFAULT_TASK_LIST_BASE_COLOR,
): TaskListBackgroundPresentation {
  const normalizedBase =
    normalizeHexColor(baseColor) ?? DEFAULT_TASK_LIST_BASE_COLOR;

  switch (id) {
    case "white":
      return { className: "bg-white" };
    case "zinc-50":
      return { className: "bg-zinc-50" };
    case "solid-blue":
      return { className: "", style: { background: normalizedBase } };
    case "gradient-soft":
      return {
        className: "",
        style: {
          background: `linear-gradient(180deg, ${normalizedBase} 0%, ${mixHexWithWhite(normalizedBase, 0.45)} 35%, #ffffff 100%)`,
        },
      };
    case "gradient-short":
      return {
        className: "",
        style: {
          background: `linear-gradient(180deg, ${normalizedBase} 0%, #ffffff 28%)`,
        },
      };
  }
}

export function areTaskListBackgroundSettingsEqual(
  a: TaskListBackgroundSettings,
  b: TaskListBackgroundSettings,
) {
  return a.backgroundId === b.backgroundId && a.baseColor === b.baseColor;
}
