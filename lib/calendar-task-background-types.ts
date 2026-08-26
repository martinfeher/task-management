import {
  mixHexColors,
  normalizeHexColor,
} from "@/lib/sidebar-background-types";

export type CalendarTaskBackgroundId =
  | "solid"
  | "gradient-soft"
  | "gradient-short"
  | "gradient-horizontal";

export type CalendarTaskBackgroundOption = {
  id: CalendarTaskBackgroundId;
  label: string;
  usesBaseColor: boolean;
  usesEndColor: boolean;
};

export type CalendarTaskBackgroundSettings = {
  backgroundId: CalendarTaskBackgroundId;
  baseColor: string;
  endColor: string;
  titleColor: string;
  timeColor: string;
};

export type CalendarTaskBackgroundPresentation = {
  background: string;
};

export const DEFAULT_CALENDAR_TASK_BASE_COLOR = "#bbd8fe";
export const DEFAULT_CALENDAR_TASK_END_COLOR = "#ffffff";
export const DEFAULT_CALENDAR_TASK_TITLE_COLOR = "#1f1f1f";
export const DEFAULT_CALENDAR_TASK_TIME_COLOR = "#8f8f8f";
export const DEFAULT_CALENDAR_TASK_BACKGROUND_ID: CalendarTaskBackgroundId =
  "solid";

export const CALENDAR_TASK_BACKGROUND_OPTIONS: CalendarTaskBackgroundOption[] =
  [
    {
      id: "solid",
      label: "Plain color",
      usesBaseColor: true,
      usesEndColor: false,
    },
    {
      id: "gradient-soft",
      label: "Soft gradient",
      usesBaseColor: true,
      usesEndColor: true,
    },
    {
      id: "gradient-short",
      label: "Short gradient",
      usesBaseColor: true,
      usesEndColor: true,
    },
    {
      id: "gradient-horizontal",
      label: "Side gradient",
      usesBaseColor: true,
      usesEndColor: true,
    },
  ];

export function isCalendarTaskBackgroundId(
  value: string,
): value is CalendarTaskBackgroundId {
  return CALENDAR_TASK_BACKGROUND_OPTIONS.some((option) => option.id === value);
}

export function getDefaultCalendarTaskBackgroundSettings(): CalendarTaskBackgroundSettings {
  return {
    backgroundId: DEFAULT_CALENDAR_TASK_BACKGROUND_ID,
    baseColor: DEFAULT_CALENDAR_TASK_BASE_COLOR,
    endColor: DEFAULT_CALENDAR_TASK_END_COLOR,
    titleColor: DEFAULT_CALENDAR_TASK_TITLE_COLOR,
    timeColor: DEFAULT_CALENDAR_TASK_TIME_COLOR,
  };
}

export function normalizeCalendarTaskBackgroundSettings(
  value:
    | Partial<{
        backgroundId?: string;
        baseColor?: string;
        endColor?: string;
        titleColor?: string;
        timeColor?: string;
      }>
    | null
    | undefined,
): CalendarTaskBackgroundSettings {
  const defaults = getDefaultCalendarTaskBackgroundSettings();
  const backgroundId =
    value?.backgroundId && isCalendarTaskBackgroundId(value.backgroundId)
      ? value.backgroundId
      : defaults.backgroundId;
  const baseColor =
    normalizeHexColor(value?.baseColor ?? "") ?? defaults.baseColor;
  const endColor =
    normalizeHexColor(value?.endColor ?? "") ?? defaults.endColor;
  const titleColor =
    normalizeHexColor(value?.titleColor ?? "") ?? defaults.titleColor;
  const timeColor =
    normalizeHexColor(value?.timeColor ?? "") ?? defaults.timeColor;

  return { backgroundId, baseColor, endColor, titleColor, timeColor };
}

export function parseCalendarTaskBackgroundSettings(
  value: unknown,
): CalendarTaskBackgroundSettings | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<CalendarTaskBackgroundSettings>;
  if (
    typeof candidate.backgroundId !== "string" ||
    typeof candidate.baseColor !== "string"
  ) {
    return null;
  }

  return normalizeCalendarTaskBackgroundSettings(candidate);
}

export function getCalendarTaskBackgroundOption(
  id: CalendarTaskBackgroundId = DEFAULT_CALENDAR_TASK_BACKGROUND_ID,
) {
  return (
    CALENDAR_TASK_BACKGROUND_OPTIONS.find((option) => option.id === id) ??
    CALENDAR_TASK_BACKGROUND_OPTIONS[0]
  );
}

export function getCalendarTaskBackgroundPresentation(
  id: CalendarTaskBackgroundId,
  baseColor: string = DEFAULT_CALENDAR_TASK_BASE_COLOR,
  endColor: string = DEFAULT_CALENDAR_TASK_END_COLOR,
): CalendarTaskBackgroundPresentation {
  const normalizedBase =
    normalizeHexColor(baseColor) ?? DEFAULT_CALENDAR_TASK_BASE_COLOR;
  const normalizedEnd =
    normalizeHexColor(endColor) ?? DEFAULT_CALENDAR_TASK_END_COLOR;

  switch (id) {
    case "solid":
      return { background: normalizedBase };
    case "gradient-soft":
      return {
        background: `linear-gradient(180deg, ${normalizedBase} 0%, ${mixHexColors(normalizedBase, normalizedEnd, 0.45)} 35%, ${normalizedEnd} 100%)`,
      };
    case "gradient-short":
      return {
        background: `linear-gradient(180deg, ${normalizedBase} 0%, ${normalizedEnd} 28%)`,
      };
    case "gradient-horizontal":
      return {
        background: `linear-gradient(90deg, ${normalizedBase} 0%, ${mixHexColors(normalizedBase, normalizedEnd, 0.45)} 65%, ${normalizedEnd} 100%)`,
      };
  }
}

export function areCalendarTaskBackgroundSettingsEqual(
  a: CalendarTaskBackgroundSettings,
  b: CalendarTaskBackgroundSettings,
) {
  return (
    a.backgroundId === b.backgroundId &&
    a.baseColor === b.baseColor &&
    a.endColor === b.endColor &&
    a.titleColor === b.titleColor &&
    a.timeColor === b.timeColor
  );
}
