import { prisma } from "@/lib/prisma";
import {
  getDefaultSidebarBackgroundSettings,
  normalizeSidebarBackgroundSettings,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";

export const SIDEBAR_TEMPLATE_SETTING_ID = "default";

export async function getSidebarBackgroundSettings(): Promise<SidebarBackgroundSettings> {
  const setting = await prisma.sidebarTemplateSetting.findUnique({
    where: { id: SIDEBAR_TEMPLATE_SETTING_ID },
    select: {
      backgroundId: true,
      baseColor: true,
    },
  });

  if (!setting) {
    return getDefaultSidebarBackgroundSettings();
  }

  return normalizeSidebarBackgroundSettings(setting);
}

export async function setSidebarBackgroundSettings(
  settings: SidebarBackgroundSettings,
) {
  const normalized = normalizeSidebarBackgroundSettings(settings);

  await prisma.sidebarTemplateSetting.upsert({
    where: { id: SIDEBAR_TEMPLATE_SETTING_ID },
    create: {
      id: SIDEBAR_TEMPLATE_SETTING_ID,
      backgroundId: normalized.backgroundId,
      baseColor: normalized.baseColor,
    },
    update: {
      backgroundId: normalized.backgroundId,
      baseColor: normalized.baseColor,
    },
  });

  return normalized;
}
