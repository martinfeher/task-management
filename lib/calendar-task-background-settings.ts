import { prisma } from "@/lib/prisma";
import {
  getDefaultCalendarTaskBackgroundSettings,
  normalizeCalendarTaskBackgroundSettings,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";

export async function getCalendarTaskBackgroundSettings(
  userId: string,
): Promise<CalendarTaskBackgroundSettings> {
  const setting = await prisma.calendarTaskTemplateSetting.findUnique({
    where: { userId },
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
  userId: string,
  settings: CalendarTaskBackgroundSettings,
) {
  const normalized = normalizeCalendarTaskBackgroundSettings(settings);

  await prisma.calendarTaskTemplateSetting.upsert({
    where: { userId },
    create: {
      userId,
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
