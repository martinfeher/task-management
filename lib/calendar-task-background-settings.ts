import { prisma } from "@/lib/prisma";
import {
  getDefaultCalendarTaskBackgroundSettings,
  normalizeCalendarTaskBackgroundSettings,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";

export const CALENDAR_TASK_TEMPLATE_SETTING_ID = "default";

export async function getCalendarTaskBackgroundSettings(): Promise<CalendarTaskBackgroundSettings> {
  const setting = await prisma.calendarTaskTemplateSetting.findUnique({
    where: { id: CALENDAR_TASK_TEMPLATE_SETTING_ID },
    select: {
      backgroundId: true,
      baseColor: true,
      endColor: true,
      titleColor: true,
      timeColor: true,
    },
  });

  if (!setting) {
    return getDefaultCalendarTaskBackgroundSettings();
  }

  return normalizeCalendarTaskBackgroundSettings(setting);
}

export async function setCalendarTaskBackgroundSettings(
  settings: CalendarTaskBackgroundSettings,
) {
  const normalized = normalizeCalendarTaskBackgroundSettings(settings);

  await prisma.calendarTaskTemplateSetting.upsert({
    where: { id: CALENDAR_TASK_TEMPLATE_SETTING_ID },
    create: {
      id: CALENDAR_TASK_TEMPLATE_SETTING_ID,
      backgroundId: normalized.backgroundId,
      baseColor: normalized.baseColor,
      endColor: normalized.endColor,
      titleColor: normalized.titleColor,
      timeColor: normalized.timeColor,
    },
    update: {
      backgroundId: normalized.backgroundId,
      baseColor: normalized.baseColor,
      endColor: normalized.endColor,
      titleColor: normalized.titleColor,
      timeColor: normalized.timeColor,
    },
  });

  return normalized;
}
