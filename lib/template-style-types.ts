import {
  getDefaultCalendarTaskBackgroundSettings,
  isCalendarTaskBackgroundId,
  normalizeCalendarTaskBackgroundSettings,
  type CalendarTaskBackgroundId,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";
import {
  getDefaultSidebarBackgroundSettings,
  isSidebarBackgroundId,
  normalizeHexColor,
  normalizeSidebarBackgroundSettings,
  type SidebarBackgroundId,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";

export type TemplateStyleRecord = {
  id: string;
  name: string;
  sidebarBackgroundId: SidebarBackgroundId;
  sidebarBaseColor: string;
  calendarBackgroundId: CalendarTaskBackgroundId;
  calendarBaseColor: string;
  calendarEndColor: string;
  calendarTitleColor: string;
  calendarTimeColor: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateStyleInput = {
  name: string;
  sidebarBackgroundId: SidebarBackgroundId;
  sidebarBaseColor: string;
  calendarBackgroundId: CalendarTaskBackgroundId;
  calendarBaseColor: string;
  calendarEndColor: string;
  calendarTitleColor: string;
  calendarTimeColor: string;
};

export type TemplateStylesResponse = {
  styles: TemplateStyleRecord[];
  activeStyleId: string | null;
};

export const ACTIVE_TEMPLATE_STYLE_KEY = "template.activeStyleId";

export function normalizeTemplateStyleName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTemplateStyleInput(
  value:
    | Partial<{
        name: string;
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

  const sidebar = normalizeSidebarBackgroundSettings({
    backgroundId: value.sidebarBackgroundId,
    baseColor: value.sidebarBaseColor,
  });
  const calendar = normalizeCalendarTaskBackgroundSettings({
    backgroundId: value.calendarBackgroundId,
    baseColor: value.calendarBaseColor,
    endColor: value.calendarEndColor,
    titleColor: value.calendarTitleColor,
    timeColor: value.calendarTimeColor,
  });

  return {
    name,
    sidebarBackgroundId: sidebar.backgroundId,
    sidebarBaseColor: sidebar.baseColor,
    calendarBackgroundId: calendar.backgroundId,
    calendarBaseColor: calendar.baseColor,
    calendarEndColor: calendar.endColor,
    calendarTitleColor: calendar.titleColor,
    calendarTimeColor: calendar.timeColor,
  };
}

export function parseTemplateStyleInput(value: unknown): TemplateStyleInput | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<TemplateStyleInput>;
  if (
    typeof candidate.sidebarBackgroundId !== "string" ||
    typeof candidate.sidebarBaseColor !== "string" ||
    typeof candidate.calendarBackgroundId !== "string" ||
    typeof candidate.calendarBaseColor !== "string" ||
    typeof candidate.calendarEndColor !== "string"
  ) {
    return null;
  }

  if (
    !isSidebarBackgroundId(candidate.sidebarBackgroundId) ||
    !isCalendarTaskBackgroundId(candidate.calendarBackgroundId)
  ) {
    return null;
  }

  return normalizeTemplateStyleInput(candidate);
}

export function serializeTemplateStyleRecord(value: {
  id: string;
  name: string;
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
  const normalized = normalizeTemplateStyleInput({
    name: value.name,
    sidebarBackgroundId: value.sidebarBackgroundId,
    sidebarBaseColor: value.sidebarBaseColor,
    calendarBackgroundId: value.calendarBackgroundId,
    calendarBaseColor: value.calendarBaseColor,
    calendarEndColor: value.calendarEndColor,
    calendarTitleColor: value.calendarTitleColor,
    calendarTimeColor: value.calendarTimeColor,
  });

  if (!normalized) return null;

  return {
    id: value.id,
    ...normalized,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function buildTemplateStyleInputFromSettings(
  name: string,
  sidebar: SidebarBackgroundSettings,
  calendar: CalendarTaskBackgroundSettings,
): TemplateStyleInput | null {
  return normalizeTemplateStyleInput({
    name,
    sidebarBackgroundId: sidebar.backgroundId,
    sidebarBaseColor: sidebar.baseColor,
    calendarBackgroundId: calendar.backgroundId,
    calendarBaseColor: calendar.baseColor,
    calendarEndColor: calendar.endColor,
    calendarTitleColor: calendar.titleColor,
    calendarTimeColor: calendar.timeColor,
  });
}

export function getDefaultTemplateStyleInput(name = "Default"): TemplateStyleInput {
  const sidebar = getDefaultSidebarBackgroundSettings();
  const calendar = getDefaultCalendarTaskBackgroundSettings();

  return {
    name: normalizeTemplateStyleName(name) || "Default",
    sidebarBackgroundId: sidebar.backgroundId,
    sidebarBaseColor: sidebar.baseColor,
    calendarBackgroundId: calendar.backgroundId,
    calendarBaseColor: calendar.baseColor,
    calendarEndColor: calendar.endColor,
    calendarTitleColor: calendar.titleColor,
    calendarTimeColor: calendar.timeColor,
  };
}

export function getCopyTemplateName(name: string) {
  const trimmed = normalizeTemplateStyleName(name);
  return trimmed ? `${trimmed} copy` : "Untitled copy";
}

export function templateStyleToCalendarSettings(
  style: Pick<
    TemplateStyleRecord,
    | "calendarBackgroundId"
    | "calendarBaseColor"
    | "calendarEndColor"
    | "calendarTitleColor"
    | "calendarTimeColor"
  >,
): CalendarTaskBackgroundSettings {
  return normalizeCalendarTaskBackgroundSettings({
    backgroundId: style.calendarBackgroundId,
    baseColor: style.calendarBaseColor,
    endColor: style.calendarEndColor,
    titleColor: style.calendarTitleColor,
    timeColor: style.calendarTimeColor,
  });
}
