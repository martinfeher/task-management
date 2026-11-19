export type AnchoredMenuPosition = {
  left: number;
  /** Set when the menu opens below the anchor: its top edge sits `gap` under it. */
  top?: number;
  /**
   * Set when the menu opens above the anchor: CSS `bottom` for a fixed menu, so
   * its bottom edge sits exactly `gap` over the anchor whatever its real height.
   */
  bottom?: number;
  placement: "below" | "above";
};

type VerticalBounds = { top: number; bottom: number };

type ComputeAnchoredMenuPositionOptions = {
  menuWidth: number;
  /** Max/estimated height; only used to choose above vs. below, never to place the menu. */
  menuHeight: number;
  gap?: number;
  /** Horizontal alignment against the anchor. */
  align?: "center" | "left" | "right";
  /** Extra shift to the right (px), applied after alignment. */
  offsetX?: number;
  /** Region the menu should stay in (defaults to the viewport). */
  bounds?: VerticalBounds;
  viewportPadding?: number;
};

/**
 * Places a fixed-position menu directly under or over its anchor.
 *
 * The above/below choice uses the estimated height, but the menu is then pinned
 * to the anchor edge (`top` when below, `bottom` when above) instead of being
 * placed from that estimate. A menu shorter than the estimate therefore never
 * ends up floating away from its icon.
 */
export function computeAnchoredMenuPosition(
  rect: DOMRect,
  {
    menuWidth,
    menuHeight,
    gap = 4,
    align = "center",
    offsetX = 0,
    bounds,
    viewportPadding = 8,
  }: ComputeAnchoredMenuPositionOptions,
): AnchoredMenuPosition {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  let left: number;
  if (align === "right") {
    left = rect.right - menuWidth;
  } else if (align === "left") {
    left = rect.left;
  } else {
    left = rect.left + rect.width / 2 - menuWidth / 2;
  }
  left = Math.max(
    viewportPadding,
    Math.min(left + offsetX, viewportWidth - menuWidth - viewportPadding),
  );

  const regionTop = Math.max(bounds?.top ?? 0, viewportPadding);
  const regionBottom = Math.min(
    bounds?.bottom ?? viewportHeight,
    viewportHeight - viewportPadding,
  );
  const spaceBelow = regionBottom - (rect.bottom + gap);
  const spaceAbove = rect.top - gap - regionTop;

  const placeBelow =
    menuHeight <= spaceBelow ||
    (menuHeight > spaceAbove && spaceBelow >= spaceAbove);

  if (placeBelow) {
    return { left, top: rect.bottom + gap, placement: "below" };
  }

  return {
    left,
    bottom: viewportHeight - rect.top + gap,
    placement: "above",
  };
}
