import { prisma } from "@/lib/prisma";
import {
  getDefaultPanelTextColorsSettings,
  normalizePanelTextColorsSettings,
  parsePanelTextColorsSettings,
  type PanelTextColorsSettings,
} from "@/lib/panel-text-shade-types";

export const PANEL_TEXT_COLORS_SETTING_KEY = "panel.textColors";

export async function getPanelTextColorsSettings(): Promise<PanelTextColorsSettings> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: PANEL_TEXT_COLORS_SETTING_KEY },
    select: { value: true },
  });

  if (!setting?.value) {
    return getDefaultPanelTextColorsSettings();
  }

  try {
    const parsed = parsePanelTextColorsSettings(JSON.parse(setting.value));
    return parsed ?? getDefaultPanelTextColorsSettings();
  } catch {
    return getDefaultPanelTextColorsSettings();
  }
}

export async function setPanelTextColorsSettings(
  settings: PanelTextColorsSettings,
) {
  const normalized = normalizePanelTextColorsSettings(settings);

  await prisma.appSetting.upsert({
    where: { key: PANEL_TEXT_COLORS_SETTING_KEY },
    create: {
      key: PANEL_TEXT_COLORS_SETTING_KEY,
      value: JSON.stringify(normalized),
    },
    update: {
      value: JSON.stringify(normalized),
    },
  });

  return normalized;
}

/** @deprecated Use getPanelTextColorsSettings */
export const getPanelTextShadeSettings = getPanelTextColorsSettings;

/** @deprecated Use setPanelTextColorsSettings */
export const setPanelTextShadeSettings = setPanelTextColorsSettings;
