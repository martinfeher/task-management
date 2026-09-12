export type SidebarBackgroundId =
  | "zinc-50"
  | "solid-blue"
  | "gradient-soft"
  | "gradient-short";

export type SidebarBackgroundOption = {
  id: SidebarBackgroundId;
  label: string;
  usesBaseColor: boolean;
};

export type SidebarBackgroundSettings = {
  backgroundId: SidebarBackgroundId;
  baseColor: string;
};

export type SidebarBackgroundPresentation = {
  className: string;
  style?: { background?: string };
};

export const DEFAULT_SIDEBAR_BASE_COLOR = "#f1f5ff";
export const DEFAULT_SIDEBAR_BACKGROUND_ID: SidebarBackgroundId = "solid-blue";

export const SIDEBAR_BACKGROUND_OPTIONS: SidebarBackgroundOption[] = [

  {
    id: "solid-blue",
    label: "Light blue",
    usesBaseColor: true,
  },
  {
    id: "gradient-soft",
    label: "Soft gradient",
    usesBaseColor: true,
  },
  {
    id: "gradient-short",
    label: "Short gradient",
    usesBaseColor: true,
  },
];

export function isSidebarBackgroundId(
  value: string,
): value is SidebarBackgroundId {
  return SIDEBAR_BACKGROUND_OPTIONS.some((option) => option.id === value);
}

export function normalizeHexColor(value: string) {
  const trimmed = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function mixHexWithWhite(hex: string, whiteRatio: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const ratio = Math.max(0, Math.min(1, whiteRatio));
  return rgbToHex(
    rgb.r + (255 - rgb.r) * ratio,
    rgb.g + (255 - rgb.g) * ratio,
    rgb.b + (255 - rgb.b) * ratio,
  );
}

export function mixHexColors(hexA: string, hexB: string, ratioB: number) {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return hexA;

  const ratio = Math.max(0, Math.min(1, ratioB));
  return rgbToHex(
    rgbA.r + (rgbB.r - rgbA.r) * ratio,
    rgbA.g + (rgbB.g - rgbA.g) * ratio,
    rgbA.b + (rgbB.b - rgbA.b) * ratio,
  );
}

export function getDefaultSidebarBackgroundSettings(): SidebarBackgroundSettings {
  return {
    backgroundId: DEFAULT_SIDEBAR_BACKGROUND_ID,
    baseColor: DEFAULT_SIDEBAR_BASE_COLOR,
  };
}

export function normalizeSidebarBackgroundSettings(
  value:
    | Partial<{
        backgroundId?: string;
        baseColor?: string;
      }>
    | null
    | undefined,
): SidebarBackgroundSettings {
  const defaults = getDefaultSidebarBackgroundSettings();
  const backgroundId =
    value?.backgroundId && isSidebarBackgroundId(value.backgroundId)
      ? value.backgroundId
      : defaults.backgroundId;
  const baseColor =
    normalizeHexColor(value?.baseColor ?? "") ?? defaults.baseColor;

  return { backgroundId, baseColor };
}

export function parseSidebarBackgroundSettings(
  value: unknown,
): SidebarBackgroundSettings | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<SidebarBackgroundSettings>;
  if (
    typeof candidate.backgroundId !== "string" ||
    typeof candidate.baseColor !== "string"
  ) {
    return null;
  }

  return normalizeSidebarBackgroundSettings(candidate);
}

export function getSidebarBackgroundOption(
  id: SidebarBackgroundId = DEFAULT_SIDEBAR_BACKGROUND_ID,
) {
  return (
    SIDEBAR_BACKGROUND_OPTIONS.find((option) => option.id === id) ??
    SIDEBAR_BACKGROUND_OPTIONS[1]
  );
}

export function getSidebarBackgroundPresentation(
  id: SidebarBackgroundId,
  baseColor: string = DEFAULT_SIDEBAR_BASE_COLOR,
): SidebarBackgroundPresentation {
  const normalizedBase =
    normalizeHexColor(baseColor) ?? DEFAULT_SIDEBAR_BASE_COLOR;

  switch (id) {
    case "zinc-50":
      return { className: "bg-zinc-50" };
    case "solid-blue":
      return { className: "", style: { background: normalizedBase } };
    case "gradient-soft":
      return {
        className: "",
        style: {
          background: `linear-gradient(180deg, ${normalizedBase} 0%, ${mixHexWithWhite(normalizedBase, 0.45)} 35%, #ffffff 100%)`,
        },
      };
    case "gradient-short":
      return {
        className: "",
        style: {
          background: `linear-gradient(180deg, ${normalizedBase} 0%, #ffffff 28%)`,
        },
      };
  }
}

export function areSidebarBackgroundSettingsEqual(
  a: SidebarBackgroundSettings,
  b: SidebarBackgroundSettings,
) {
  return a.backgroundId === b.backgroundId && a.baseColor === b.baseColor;
}
