import { mixHexWithWhite } from "@/lib/sidebar-background-types";

/** zinc-900 scrim, 10% brighter toward white → #2f2f32 */
export const CALENDAR_TASK_MODAL_BACKDROP_LIGHT = mixHexWithWhite(
  "#18181b",
  0.1,
);

/** zinc-950 scrim, 10% brighter toward white → #222223 */
export const CALENDAR_TASK_MODAL_BACKDROP_DARK = mixHexWithWhite("#09090b", 0.1);

function hexWithAlpha(hex: string, alpha: number) {
  const channel = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${channel}`;
}

/** Pinned modal scrim (~25% / 40% alpha). */
export const CALENDAR_TASK_MODAL_PINNED_BACKDROP_BG = hexWithAlpha(
  CALENDAR_TASK_MODAL_BACKDROP_LIGHT,
  0.25,
);
export const CALENDAR_TASK_MODAL_PINNED_BACKDROP_BG_DARK = hexWithAlpha(
  CALENDAR_TASK_MODAL_BACKDROP_DARK,
  0.4,
);

/** Hover preview scrim (~15% / 40% alpha). */
export const CALENDAR_TASK_MODAL_HOVER_BACKDROP_BG = hexWithAlpha(
  CALENDAR_TASK_MODAL_BACKDROP_LIGHT,
  0.15,
);
export const CALENDAR_TASK_MODAL_HOVER_BACKDROP_BG_DARK = hexWithAlpha(
  CALENDAR_TASK_MODAL_BACKDROP_DARK,
  0.4,
);

export const CALENDAR_TASK_MODAL_BACKDROP_BLUR_CLASS = "backdrop-blur-[1px]";

/** Static classes for Tailwind scan (#2f2f32 / #222223 @ 10% brighten). */
export const CALENDAR_TASK_MODAL_PINNED_BACKDROP_CLASS =
  "backdrop-blur-[1px] bg-[#2f2f3240] dark:bg-[#22222366]";

export const CALENDAR_TASK_MODAL_HOVER_BACKDROP_CLASS =
  "backdrop-blur-[1px] bg-[#2f2f3226] dark:bg-[#22222366]";
