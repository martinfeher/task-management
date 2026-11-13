import type { CSSProperties } from "react";

export function getCalendarSidebarBackdropClipStyle(
  sidebar: HTMLElement | null,
  sidebarPosition: "left" | "right",
): CSSProperties {
  if (!sidebar) {
    return {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  }

  const rect = sidebar.getBoundingClientRect();

  if (sidebarPosition === "right") {
    return {
      position: "fixed",
      top: 0,
      left: 0,
      bottom: 0,
      width: Math.max(0, rect.left),
    };
  }

  return {
    position: "fixed",
    top: 0,
    left: Math.max(0, rect.right),
    right: 0,
    bottom: 0,
  };
}
