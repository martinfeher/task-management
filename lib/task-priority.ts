import type { CSSProperties } from "react";

export const TASK_PRIORITY_LEVELS = [1, 2, 3] as const;

export type TaskPriorityLevel = (typeof TASK_PRIORITY_LEVELS)[number];

export const TASK_PRIORITY_SURFACE_COLORS: Record<
  TaskPriorityLevel,
  { flag: string; background: string; text: string }
> = {
  1: { flag: "#e95440", background: "#fde9e7", text: "#c7453a" },
  2: { flag: "#f97316", background: "#ffedd5", text: "#c2410c" },
  3: { flag: "#5b8def", background: "#e8f1fd", text: "#3d73c9" },
};

export const TASK_PRIORITY_BAR_COLORS: Record<
  TaskPriorityLevel,
  { active: string; inactive: string }
> = {
  1: {
    active: TASK_PRIORITY_SURFACE_COLORS[1].flag,
    inactive: "#f7c4bc",
  },
  2: {
    active: TASK_PRIORITY_SURFACE_COLORS[2].flag,
    inactive: "#fed7aa",
  },
  3: {
    active: TASK_PRIORITY_SURFACE_COLORS[3].flag,
    inactive: "#c7daf8",
  },
};

export const TASK_PRIORITY_OPTIONS: {
  level: TaskPriorityLevel;
  color: string;
  label: string;
  shortLetter: string;
}[] = [
  {
    level: 1,
    color: TASK_PRIORITY_BAR_COLORS[1].active,
    label: "High priority",
    shortLetter: "H",
  },
  {
    level: 2,
    color: TASK_PRIORITY_BAR_COLORS[2].active,
    label: "Medium priority",
    shortLetter: "M",
  },
  {
    level: 3,
    color: TASK_PRIORITY_BAR_COLORS[3].active,
    label: "Low priority",
    shortLetter: "L",
  },
];

export const TASK_PRIORITY_PILL_CLASSES: Record<
  TaskPriorityLevel,
  { bgClass: string; textClass: string }
> = {
  1: { bgClass: "bg-[#fde9e7]", textClass: "text-[#c7453a]" },
  2: { bgClass: "bg-[#ffedd5]", textClass: "text-[#c2410c]" },
  3: { bgClass: "bg-[#e8f1fd]", textClass: "text-[#3d73c9]" },
};

export function getTaskPriorityFilledBarCount(level: TaskPriorityLevel) {
  if (level === 1) return 3;
  if (level === 2) return 2;
  return 1;
}

export function isTaskPriorityLevel(value: number): value is TaskPriorityLevel {
  return value === 1 || value === 2 || value === 3;
}

export function getTaskPrioritySurface(priority: number | null | undefined) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;
  return TASK_PRIORITY_SURFACE_COLORS[priority];
}

export function getTaskPriorityColor(priority: number | null | undefined) {
  return getTaskPrioritySurface(priority)?.flag ?? null;
}

export function getTaskPriorityItemStyle(
  priority: number | null | undefined,
): CSSProperties | undefined {
  const surface = getTaskPrioritySurface(priority);
  if (!surface) return undefined;

  return {
    backgroundColor: surface.background,
    ["--calendar-task-item-background" as string]: surface.background,
    ["--calendar-task-title-source-color" as string]: surface.background,
  };
}

export function getTaskPriorityLabel(priority: number | null | undefined) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;

  return (
    TASK_PRIORITY_OPTIONS.find((option) => option.level === priority)?.label ??
    null
  );
}

export function getTaskPriorityShortLabel(priority: number | null | undefined) {
  if (priority === 1) return "High";
  if (priority === 2) return "Medium";
  if (priority === 3) return "Low";
  return null;
}

export function getTaskPriorityPillClasses(priority: number | null | undefined) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;
  return TASK_PRIORITY_PILL_CLASSES[priority];
}
