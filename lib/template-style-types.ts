import {
  normalizeCalendarTaskBackgroundSettings,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";
import {
  normalizeSidebarBackgroundSettings,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";
import {
  getDefaultTemplateSettingsSnapshot,
  normalizeTemplateSettingsSnapshot,
  type TemplateSettingsSnapshot,
} from "@/lib/template-settings-history";

export type { TemplateSettingsSnapshot } from "@/lib/template-settings-history";

export type TemplateStyleRecord = {
  id: string;
  name: string;
  settings: TemplateSettingsSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type TemplateStyleInput = {
  name: string;
  settings: TemplateSettingsSnapshot;
};

export type TemplateStylesResponse = {
  styles: TemplateStyleRecord[];
  activeStyleId: string | null;
};

export const ACTIVE_TEMPLATE_STYLE_KEY = "template.activeStyleId";

export function normalizeTemplateStyleName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildSettingsFromLegacyColumns(value: {
  sidebarBackgroundId: string;
  sidebarBaseColor: string;
  calendarBackgroundId: string;
  calendarBaseColor: string;
  calendarEndColor: string;
  calendarTitleColor?: string;
  calendarTimeColor?: string;
}): TemplateSettingsSnapshot {
  const defaults = getDefaultTemplateSettingsSnapshot();

  return normalizeTemplateSettingsSnapshot({
    ...defaults,
    sidebar: normalizeSidebarBackgroundSettings({
      backgroundId: value.sidebarBackgroundId,
      baseColor: value.sidebarBaseColor,
    }),
    calendarTask: normalizeCalendarTaskBackgroundSettings({
      backgroundId: value.calendarBackgroundId,
      baseColor: value.calendarBaseColor,
      endColor: value.calendarEndColor,
      titleColor: value.calendarTitleColor,
      timeColor: value.calendarTimeColor,
    }),
  });
}

export function normalizeTemplateStyleInput(
  value:
    | Partial<{
        name: string;
        settings: unknown;
        sidebarBackgroundId: string;
        sidebarBaseColor: string;
        calendarBackgroundId: string;
        calendarBaseColor: string;
        calendarEndColor: string;
        calendarTitleColor: string;
        calendarTimeColor: string;
      }>
    | null
    | undefined,
): TemplateStyleInput | null {
  if (!value || typeof value.name !== "string") return null;

  const name = normalizeTemplateStyleName(value.name);
  if (!name) return null;

  if (value.settings && typeof value.settings === "object") {
    return {
      name,
      settings: normalizeTemplateSettingsSnapshot(value.settings),
    };
  }

  if (
    typeof value.sidebarBackgroundId === "string" &&
    typeof value.sidebarBaseColor === "string" &&
    typeof value.calendarBackgroundId === "string" &&
    typeof value.calendarBaseColor === "string" &&
    typeof value.calendarEndColor === "string"
  ) {
    return {
      name,
      settings: buildSettingsFromLegacyColumns({
        sidebarBackgroundId: value.sidebarBackgroundId,
        sidebarBaseColor: value.sidebarBaseColor,
        calendarBackgroundId: value.calendarBackgroundId,
        calendarBaseColor: value.calendarBaseColor,
        calendarEndColor: value.calendarEndColor,
        calendarTitleColor: value.calendarTitleColor,
        calendarTimeColor: value.calendarTimeColor,
      }),
    };
  }

  return null;
}

export function parseTemplateStyleInput(value: unknown): TemplateStyleInput | null {
  if (typeof value !== "object" || value === null) return null;
  return normalizeTemplateStyleInput(value as Partial<TemplateStyleInput>);
}

export function serializeTemplateStyleRecord(value: {
  id: string;
  name: string;
  settingsJson?: unknown;
  sidebarBackgroundId: string;
  sidebarBaseColor: string;
  calendarBackgroundId: string;
  calendarBaseColor: string;
  calendarEndColor: string;
  calendarTitleColor?: string;
  calendarTimeColor?: string;
  createdAt: Date;
  updatedAt: Date;
}): TemplateStyleRecord | null {
  const name = normalizeTemplateStyleName(value.name);
  if (!name) return null;

  const settings =
    value.settingsJson && typeof value.settingsJson === "object"
      ? normalizeTemplateSettingsSnapshot(value.settingsJson)
      : buildSettingsFromLegacyColumns(value);

  return {
    id: value.id,
    name,
    settings,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function buildTemplateStyleInputFromSnapshot(
  name: string,
  settings: TemplateSettingsSnapshot,
): TemplateStyleInput | null {
  return normalizeTemplateStyleInput({ name, settings });
}

/** @deprecated Use buildTemplateStyleInputFromSnapshot */
export function buildTemplateStyleInputFromSettings(
  name: string,
  sidebar: SidebarBackgroundSettings,
  calendar: CalendarTaskBackgroundSettings,
): TemplateStyleInput | null {
  const defaults = getDefaultTemplateSettingsSnapshot();

  return buildTemplateStyleInputFromSnapshot(name, {
    ...defaults,
    sidebar: normalizeSidebarBackgroundSettings(sidebar),
    calendarTask: normalizeCalendarTaskBackgroundSettings(calendar),
  });
}

export function getDefaultTemplateStyleInput(name = "Default"): TemplateStyleInput {
  const normalizedName = normalizeTemplateStyleName(name) || "Default";

  return {
    name: normalizedName,
    settings: getDefaultTemplateSettingsSnapshot(),
  };
}

export function getCopyTemplateName(name: string) {
  const trimmed = normalizeTemplateStyleName(name);
  return trimmed ? `${trimmed} copy` : "Untitled copy";
}

export function templateStyleToCalendarSettings(
  style: Pick<TemplateStyleRecord, "settings">,
): CalendarTaskBackgroundSettings {
  return normalizeCalendarTaskBackgroundSettings(style.settings.calendarTask);
}

export function templateStyleToSidebarSettings(
  style: Pick<TemplateStyleRecord, "settings">,
): SidebarBackgroundSettings {
  return normalizeSidebarBackgroundSettings(style.settings.sidebar);
}

export function templateStyleLegacyColumns(settings: TemplateSettingsSnapshot) {
  const sidebar = normalizeSidebarBackgroundSettings(settings.sidebar);
  const calendar = normalizeCalendarTaskBackgroundSettings(settings.calendarTask);

  return {
    sidebarBackgroundId: sidebar.backgroundId,
    sidebarBaseColor: sidebar.baseColor,
    calendarBackgroundId: calendar.backgroundId,
    calendarBaseColor: calendar.baseColor,
    calendarEndColor: calendar.endColor,
    calendarTitleColor: calendar.titleColor,
    calendarTimeColor: calendar.timeColor,
  };
}

export function isLegacyTemplateStylePayload(value: unknown) {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { settings?: unknown };
  return !candidate.settings;
}
