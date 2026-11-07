"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  APP_FONT_STORAGE_KEY,
  appFontCookieValue,
  parseAppFont,
  type AppFont,
} from "@/lib/app-font";

export type { AppFont } from "@/lib/app-font";

export function getStoredAppFont(): AppFont {
  if (typeof window === "undefined") return "inter";

  const stored = localStorage.getItem(APP_FONT_STORAGE_KEY);
  return parseAppFont(stored);
}

export function applyAppFont(font: AppFont) {
  document.documentElement.dataset.appFont = font;
}

function persistAppFont(font: AppFont) {
  applyAppFont(font);
  localStorage.setItem(APP_FONT_STORAGE_KEY, font);
  document.cookie = appFontCookieValue(font);
}

const FONT_OPTIONS: { value: AppFont; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "sf-pro", label: "SF Pro" },
  { value: "euclid-circular", label: "Euclid Circular" },
];

function getFontPreviewStyle(font: AppFont): CSSProperties {
  switch (font) {
    case "sf-pro":
      return { fontFamily: "var(--font-sf-pro), sans-serif" };
    case "euclid-circular":
      return { fontFamily: "var(--font-euclid-circular), sans-serif" };
    default:
      return { fontFamily: "var(--font-inter), sans-serif" };
  }
}

/**
 * Headless: re-applies the stored font on app start so the localStorage
 * choice, the `data-app-font` attribute and the cookie stay in sync.
 */
export function AppFontBootstrap() {
  useEffect(() => {
    persistAppFont(getStoredAppFont());
  }, []);

  return null;
}

/** Segmented font picker, rendered inside Settings → General. */
export function AppFontSetting() {
  // Only mounted client-side after the Settings modal opens, so reading
  // localStorage during the initial render can't cause a hydration mismatch.
  const [font, setFont] = useState<AppFont>(getStoredAppFont);

  function selectFont(next: AppFont) {
    setFont(next);
    persistAppFont(next);
  }

  return (
    <div className="space-y-2.5">
      <p className="text-sm text-zinc-900 dark:text-zinc-50">Interface font</p>
      <div
        role="group"
        aria-label="Interface font"
        className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      >
        {FONT_OPTIONS.map((option) => {
          const isActive = font === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => selectFont(option.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
              style={getFontPreviewStyle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
