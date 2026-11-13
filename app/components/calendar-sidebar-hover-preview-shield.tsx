"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { getCalendarSidebarBackdropClipStyle } from "@/lib/calendar-sidebar-backdrop-clip";
import { CALENDAR_TASK_MODAL_PINNED_BACKDROP_CLASS } from "@/lib/calendar-task-modal-backdrop";
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
      setShieldStyle(
        getCalendarSidebarBackdropClipStyle(
          sidebarRef.current,
          sidebarPosition,
        ),
      );
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
      className={`calendar-sidebar-hover-preview-shield fixed z-[10040] cursor-default ${CALENDAR_TASK_MODAL_PINNED_BACKDROP_CLASS} transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
