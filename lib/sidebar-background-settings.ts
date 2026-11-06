import { prisma } from "@/lib/prisma";
import {
  getDefaultSidebarBackgroundSettings,
  normalizeSidebarBackgroundSettings,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";

export async function getSidebarBackgroundSettings(
  userId: string,
): Promise<SidebarBackgroundSettings> {
  const setting = await prisma.sidebarTemplateSetting.findUnique({
    where: { userId },
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
  userId: string,
  settings: SidebarBackgroundSettings,
) {
  const normalized = normalizeSidebarBackgroundSettings(settings);

  await prisma.sidebarTemplateSetting.upsert({
    where: { userId },
    create: {
      userId,
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
