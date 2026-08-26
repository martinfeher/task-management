import { LuFlag } from "react-icons/lu";
import {
  getTaskPriorityColor,
  getTaskPriorityFilledBarCount,
  TASK_PRIORITY_BAR_COLORS,
  type TaskPriorityLevel,
} from "@/lib/task-priority";

const PRIORITY_BARS = [
  { x: 0, height: 6 },
  { x: 5, height: 9 },
  { x: 10, height: 12 },
] as const;

type TaskPriorityBarsIconProps = {
  level: TaskPriorityLevel;
  className?: string;
};

export function TaskPriorityBarsIcon({
  level,
  className = "size-4",
}: TaskPriorityBarsIconProps) {
  const colors = TASK_PRIORITY_BAR_COLORS[level];
  const filledBars = getTaskPriorityFilledBarCount(level);

  return (
    <svg
      viewBox="0 0 15 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {PRIORITY_BARS.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={12 - bar.height}
          width={3}
          height={bar.height}
          rx={1.5}
          fill={index < filledBars ? colors.active : colors.inactive}
        />
      ))}
    </svg>
  );
}

type TaskPriorityFlagIconProps = {
  level?: TaskPriorityLevel | null;
  className?: string;
  outline?: boolean;
};

export function TaskPriorityFlagIcon({
  level = null,
  className = "size-4",
  outline = false,
}: TaskPriorityFlagIconProps) {
  const color = level ? getTaskPriorityColor(level) : undefined;

  if (outline || !color) {
    return (
      <LuFlag
        aria-hidden="true"
        className={`${className} text-zinc-800 dark:text-zinc-200`}
        strokeWidth={1.75}
      />
    );
  }

  return (
    <LuFlag
      aria-hidden="true"
      className={className}
      strokeWidth={1.75}
      style={{ color, fill: color }}
    />
  );
}
