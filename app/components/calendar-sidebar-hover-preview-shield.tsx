"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { CALENDAR_SIDEBAR_HOVER_PREVIEW_TRANSITION_MS } from "@/lib/calendar-sidebar-hover-preview";

type CalendarSidebarHoverPreviewShieldProps = {
  active: boolean;
  visible: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  sidebarPosition: "left" | "right";
};

export function CalendarSidebarHoverPreviewShield({
  active,
  visible,
  sidebarRef,
  sidebarPosition,
}: CalendarSidebarHoverPreviewShieldProps) {
  const [shieldStyle, setShieldStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setShieldStyle(null);
      return;
    }

    function updateShieldBounds() {
      const sidebar = sidebarRef.current;
      if (!sidebar) {
        setShieldStyle({
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        });
        return;
      }

      const rect = sidebar.getBoundingClientRect();

      if (sidebarPosition === "right") {
        setShieldStyle({
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: Math.max(0, rect.left),
        });
        return;
      }

      setShieldStyle({
        position: "fixed",
        top: 0,
        left: Math.max(0, rect.right),
        right: 0,
        bottom: 0,
      });
    }

    updateShieldBounds();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateShieldBounds())
        : null;
    if (observer && sidebarRef.current) {
      observer.observe(sidebarRef.current);
    }

    window.addEventListener("resize", updateShieldBounds);
    window.addEventListener("scroll", updateShieldBounds, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateShieldBounds);
      window.removeEventListener("scroll", updateShieldBounds, true);
    };
  }, [active, sidebarPosition, sidebarRef]);

  if (!active || !shieldStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`calendar-sidebar-hover-preview-shield z-[10040] cursor-default bg-zinc-900/25 backdrop-brightness-[1.05] transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-zinc-950/35 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        ...shieldStyle,
        transitionDuration: `${CALENDAR_SIDEBAR_HOVER_PREVIEW_TRANSITION_MS}ms`,
      }}
      aria-hidden
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    />,
    document.body,
  );
}
