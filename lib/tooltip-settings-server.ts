import { prisma } from "@/lib/prisma";
import {
  getDefaultTooltipSettings,
  normalizeTooltipSettings,
  type TooltipSettings,
} from "@/lib/tooltip-settings-types";

export const TOOLTIP_TEMPLATE_SETTING_ID = "default";

export async function getTooltipSettings(): Promise<TooltipSettings> {
  const setting = await prisma.tooltipTemplateSetting.findUnique({
    where: { id: TOOLTIP_TEMPLATE_SETTING_ID },
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

export async function setTooltipSettings(settings: TooltipSettings) {
  const normalized = normalizeTooltipSettings(settings);

  await prisma.tooltipTemplateSetting.upsert({
    where: { id: TOOLTIP_TEMPLATE_SETTING_ID },
    create: {
      id: TOOLTIP_TEMPLATE_SETTING_ID,
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
