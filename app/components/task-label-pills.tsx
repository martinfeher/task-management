import {
  getLabelColor,
  getLabelPillClassName,
  getLabelPillStyle,
} from "@/lib/label-colors";
import type { TaskLabel } from "./todo-app";

export const TASK_ITEM_LABEL_MAX_WIDTH_PX = 80;

type TaskLabelPillsProps = {
  labels: TaskLabel[];
  className?: string;
  truncateAtPx?: number | null;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function TaskLabelPills({
  labels,
  className = "",
  truncateAtPx = TASK_ITEM_LABEL_MAX_WIDTH_PX,
  onClick,
}: TaskLabelPillsProps) {
  if (labels.length === 0) return null;

  return (
    <button
      type="button"
      aria-label="Edit labels"
      aria-haspopup="dialog"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1 rounded-md transition-colors cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${className}`}
    >
      {labels.map((item) => {
        const palette = getLabelColor(item);

        return (
          <span
            key={item.id}
            className={`${getLabelPillClassName(palette)} ${
              truncateAtPx != null ? "inline-block" : ""
            }`}
            style={{
              ...getLabelPillStyle(palette),
              ...(truncateAtPx != null ? { maxWidth: truncateAtPx } : {}),
            }}
            title={item.label}
          >
            {item.label}
          </span>
        );
      })}
    </button>
  );
}
