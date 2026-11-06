import { prisma } from "@/lib/prisma";
import {
  getDefaultTooltipSettings,
  normalizeTooltipSettings,
  type TooltipSettings,
} from "@/lib/tooltip-settings-types";

export async function getTooltipSettings(
  userId: string,
): Promise<TooltipSettings> {
  const setting = await prisma.tooltipTemplateSetting.findUnique({
    where: { userId },
    select: {
      backgroundColor: true,
      textColor: true,
      cornerRadiusPx: true,
    },
  });

  if (!setting) {
    return getDefaultTooltipSettings();
  }

  return normalizeTooltipSettings(setting);
}

export async function setTooltipSettings(
  userId: string,
  settings: TooltipSettings,
) {
  const normalized = normalizeTooltipSettings(settings);

  await prisma.tooltipTemplateSetting.upsert({
    where: { userId },
    create: {
      userId,
      backgroundColor: normalized.backgroundColor,
      textColor: normalized.textColor,
      cornerRadiusPx: normalized.cornerRadiusPx,
    },
    update: {
      backgroundColor: normalized.backgroundColor,
      textColor: normalized.textColor,
      cornerRadiusPx: normalized.cornerRadiusPx,
    },
  });

  return normalized;
}
