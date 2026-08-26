export type AppFont = "inter" | "sf-pro" | "euclid-circular";

export const APP_FONT_STORAGE_KEY = "todolist-app-font";

export function parseAppFont(value: string | undefined | null): AppFont {
  if (value === "sf-pro") return "sf-pro";
  if (value === "euclid-circular" || value === "circular") return "euclid-circular";
  return "inter";
}

export function appFontCookieValue(font: AppFont) {
  return `${APP_FONT_STORAGE_KEY}=${font}; path=/; max-age=31536000; SameSite=Lax`;
}
