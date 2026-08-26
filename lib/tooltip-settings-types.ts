import { normalizeHexColor } from "@/lib/sidebar-background-types";

export type TooltipSettings = {
  backgroundColor: string;
  textColor: string;
  cornerRadiusPx: number;
};

export const DEFAULT_TOOLTIP_BACKGROUND_COLOR = "#3d3e3f";
export const DEFAULT_TOOLTIP_TEXT_COLOR = "#ffffff";
export const DEFAULT_TOOLTIP_CORNER_RADIUS_PX = 6;
export const MIN_TOOLTIP_CORNER_RADIUS_PX = 0;
export const MAX_TOOLTIP_CORNER_RADIUS_PX = 24;

export function getDefaultTooltipSettings(): TooltipSettings {
  return {
    backgroundColor: DEFAULT_TOOLTIP_BACKGROUND_COLOR,
    textColor: DEFAULT_TOOLTIP_TEXT_COLOR,
    cornerRadiusPx: DEFAULT_TOOLTIP_CORNER_RADIUS_PX,
  };
}

export function normalizeCornerRadiusPx(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TOOLTIP_CORNER_RADIUS_PX;
  }

  return Math.max(
    MIN_TOOLTIP_CORNER_RADIUS_PX,
    Math.min(MAX_TOOLTIP_CORNER_RADIUS_PX, Math.round(parsed)),
  );
}

export function normalizeTooltipSettings(
  value:
    | Partial<{
        backgroundColor: string;
        textColor: string;
        cornerRadiusPx: number | string;
      }>
    | null
    | undefined,
): TooltipSettings {
  const defaults = getDefaultTooltipSettings();

  return {
    backgroundColor:
      (value?.backgroundColor &&
        normalizeHexColor(value.backgroundColor)) ||
      defaults.backgroundColor,
    textColor:
      (value?.textColor && normalizeHexColor(value.textColor)) ||
      defaults.textColor,
    cornerRadiusPx: normalizeCornerRadiusPx(value?.cornerRadiusPx),
  };
}

export function areTooltipSettingsEqual(
  left: TooltipSettings,
  right: TooltipSettings,
) {
  return (
    left.backgroundColor === right.backgroundColor &&
    left.textColor === right.textColor &&
    left.cornerRadiusPx === right.cornerRadiusPx
  );
}

export function parseTooltipSettings(value: unknown): TooltipSettings | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<TooltipSettings>;
  if (
    typeof candidate.backgroundColor !== "string" ||
    typeof candidate.textColor !== "string"
  ) {
    return null;
  }

  if (
    candidate.cornerRadiusPx !== undefined &&
    typeof candidate.cornerRadiusPx !== "number" &&
    typeof candidate.cornerRadiusPx !== "string"
  ) {
    return null;
  }

  return normalizeTooltipSettings(candidate);
}
