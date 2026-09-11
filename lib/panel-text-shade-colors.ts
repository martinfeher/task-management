export type PanelTextShadeId = "zinc" | "slate" | "gray";

export const PANEL_TEXT_SHADE_STEPS = [
  50, 100, 150, 200, 250, 300, 350, 400, 500, 550, 600, 650, 700, 750, 800, 850,
  900, 950,
] as const;

export type PanelTextShadeStep = (typeof PANEL_TEXT_SHADE_STEPS)[number];

export type PanelTextShadeToken = `${PanelTextShadeId}-${PanelTextShadeStep}`;

export const PANEL_TEXT_PALETTE_IDS = ["zinc", "slate", "gray"] as const;

export const PANEL_TEXT_SHADE_COLORS: Record<
  PanelTextShadeId,
  Record<PanelTextShadeStep, string>
> = {
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    150: "#eceef1",
    200: "#e5e7eb",
    250: "#dbdee3",
    300: "#d1d5dc",
    350: "#b4bbc5",
    400: "#99a1af",
    500: "#6a7282",
    550: "#5a6373",
    600: "#4a5565",
    650: "#404b5c",
    700: "#364153",
    750: "#2a3546",
    800: "#1e2939",
    850: "#172030",
    900: "#101828",
    950: "#030712",
  },
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    150: "#e9eff5",
    200: "#e2e8f0",
    250: "#d6dfe9",
    300: "#cad5e2",
    350: "#acbbce",
    400: "#90a1b9",
    500: "#62748e",
    550: "#53647d",
    600: "#45556c",
    650: "#3b4b62",
    700: "#314158",
    750: "#27354a",
    800: "#1d293d",
    850: "#152034",
    900: "#0f172b",
    950: "#020618",
  },
  zinc: {
    50: "#fafafa",
    100: "#f4f4f5",
    150: "#ececee",
    200: "#e4e4e7",
    250: "#dcdce0",
    300: "#d4d4d8",
    350: "#b9b9c0",
    400: "#9f9fa9",
    500: "#71717b",
    550: "#61616c",
    600: "#52525c",
    650: "#484851",
    700: "#3f3f46",
    750: "#333338",
    800: "#27272a",
    850: "#1f1f23",
    900: "#18181b",
    950: "#09090b",
  },
};

export const PANEL_TEXT_SHADE_DROPDOWN_OPTIONS: Array<{
  palette: PanelTextShadeId;
  label: string;
  tokens: PanelTextShadeToken[];
}> = PANEL_TEXT_PALETTE_IDS.map((palette) => ({
  palette,
  label: `Tailwind ${palette}`,
  tokens: PANEL_TEXT_SHADE_STEPS.map(
    (step) => `${palette}-${step}` as PanelTextShadeToken,
  ),
}));

const PANEL_TEXT_SHADE_TOKEN_SET = new Set<string>(
  PANEL_TEXT_SHADE_DROPDOWN_OPTIONS.flatMap((group) => group.tokens),
);

export function isPanelTextShadeToken(value: string): value is PanelTextShadeToken {
  return PANEL_TEXT_SHADE_TOKEN_SET.has(value);
}

export function getShadeHex(token: PanelTextShadeToken): string {
  const [palette, stepRaw] = token.split("-") as [PanelTextShadeId, string];
  const step = Number.parseInt(stepRaw, 10) as PanelTextShadeStep;
  return PANEL_TEXT_SHADE_COLORS[palette][step];
}

export function getPanelTextShadeCssVariables(palette: PanelTextShadeId) {
  const colors = PANEL_TEXT_SHADE_COLORS[palette];
  return Object.fromEntries(
    PANEL_TEXT_SHADE_STEPS.map((step) => [`--panel-text-${step}`, colors[step]]),
  ) as Record<`--panel-text-${PanelTextShadeStep}`, string>;
}
