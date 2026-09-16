import { BiRevision } from "react-icons/bi";
import { isTaskPriorityLevel } from "@/lib/task-priority";
import { parseRecurrenceRule } from "@/lib/task-recurrence";
import { TaskPriorityFlagIcon } from "./task-priority-icon";

export function CalendarTaskPriorityFlag({
  priority,
}: {
  priority?: number | null;
}) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;

  return (
    <TaskPriorityFlagIcon
      level={priority}
      className="size-[12px] shrink-0 opacity-60"
    />
  );
}

type CalendarTaskTitleProps = {
  name: string;
  recurrenceRule?: string | null;
  priority?: number | null;
};

export function CalendarTaskTitle({
  name,
  recurrenceRule,
  priority,
}: CalendarTaskTitleProps) {
  const repeats = Boolean(parseRecurrenceRule(recurrenceRule));

  return (
    <span className="flex min-w-0 flex-1 items-center gap-0.5">
      {repeats ? (
        <BiRevision
          className="size-3 shrink-0 opacity-70"
          aria-label="Repeats"
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <CalendarTaskPriorityFlag priority={priority} />
    </span>
  );
}
