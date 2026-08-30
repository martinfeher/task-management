/**
 * Canonical font-family CSS values produced by the detail editor toolbar
 * (see app/components/detail-fonts.ts). Used when converting HTML to TaskDoc
 * and when validating textStyle marks.
 */
export const DETAIL_FONT_FAMILY_CSS_VALUES = [
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "var(--font-inter), sans-serif",
  "var(--font-sf-pro), sans-serif",
  "var(--font-euclid-circular), sans-serif",
  "Georgia, 'Times New Roman', Times, serif",
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  "var(--font-lora), serif",
  "var(--font-great-vibes), cursive",
] as const;

export function normalizeFontFamilyValue(value: string) {
  return value
    .toLowerCase()
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDetailFontFamilyCss(raw: string | undefined) {
  if (!raw?.trim()) return undefined;

  const normalized = normalizeFontFamilyValue(raw);
  for (const known of DETAIL_FONT_FAMILY_CSS_VALUES) {
    if (normalizeFontFamilyValue(known) === normalized) {
      return known;
    }
  }

  return undefined;
}

export function isAllowedDetailFontFamily(raw: string) {
  return resolveDetailFontFamilyCss(raw) !== undefined;
}
