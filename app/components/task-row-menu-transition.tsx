"use client";

import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type Ref,
} from "react";

/** A menu opening within this window of another closing counts as a "switch". */
const MENU_SWITCH_WINDOW_MS = 250;
/** Beyond this distance the slide would look like a jump, so just fade in. */
const MENU_SWITCH_MAX_DISTANCE_PX = 480;
const MENU_ENTER_MS = 150;
const MENU_SWITCH_MS = 230;
const MENU_EXIT_MS = 150;
const MENU_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Where the most recently closed task-row menu was, so the next one can glide from it. */
let lastClosedMenu: { left: number; top: number; at: number } | null = null;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function playMenuEnter(node: HTMLElement) {
  const previous = lastClosedMenu;
  lastClosedMenu = null;

  if (typeof node.animate !== "function" || prefersReducedMotion()) return;

  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  if (previous && performance.now() - previous.at <= MENU_SWITCH_WINDOW_MS) {
    const dx = previous.left - rect.left;
    const dy = previous.top - rect.top;

    if (Math.hypot(dx, dy) <= MENU_SWITCH_MAX_DISTANCE_PX) {
      // Another menu was just open: glide in from where it was.
      node.animate(
        [
          {
            opacity: 0,
            transform: `translate(${dx}px, ${dy}px) scale(0.97)`,
          },
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
        ],
        { duration: MENU_SWITCH_MS, easing: MENU_EASING },
      );
      return;
    }
  }

  node.animate(
    [
      { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: MENU_ENTER_MS, easing: MENU_EASING },
  );
}

/**
 * Fades out a static copy of the menu in place so closing (or switching to a
 * different menu) cross-fades instead of vanishing.
 */
function playMenuExit(node: HTMLElement) {
  if (!node.isConnected) return;

  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  lastClosedMenu = { left: rect.left, top: rect.top, at: performance.now() };

  if (typeof node.animate !== "function" || prefersReducedMotion()) return;

  const ghost = node.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    margin: "0",
    pointerEvents: "none",
    visibility: "visible",
    transformOrigin: "top left",
  });
  document.body.appendChild(ghost);

  const animation = ghost.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "scale(0.98)" },
    ],
    { duration: MENU_EXIT_MS, easing: "ease-out", fill: "forwards" },
  );
  const cleanup = () => ghost.remove();
  animation.onfinish = cleanup;
  animation.oncancel = cleanup;
}

type TaskRowMenuTransitionProps = ComponentPropsWithoutRef<"div"> & {
  /** Forwarded to the underlying element (the wrapper owns its own ref). */
  innerRef?: Ref<HTMLDivElement>;
  /** Set to false while the menu is mounted but not yet positioned. */
  active?: boolean;
};

/**
 * Wrapper for the fixed-position menus opened from a task row (date, label,
 * priority and three-dots menus). Fades/slides in on open, glides from the
 * previous menu's position when switching between icons, and fades out on close.
 */
export function TaskRowMenuTransition({
  innerRef,
  active = true,
  style,
  children,
  ...rest
}: TaskRowMenuTransitionProps) {
  const localRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(innerRef, () => localRef.current as HTMLDivElement, []);

  useLayoutEffect(() => {
    if (!active) return;

    const node = localRef.current;
    if (!node) return;

    playMenuEnter(node);
    return () => playMenuExit(node);
  }, [active]);

  return (
    <div
      {...rest}
      ref={localRef}
      style={{ transformOrigin: "top left", ...style }}
    >
      {children}
    </div>
  );
}
