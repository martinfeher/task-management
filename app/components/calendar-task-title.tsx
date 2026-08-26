import { BiRevision } from "react-icons/bi";
import { parseRecurrenceRule } from "@/lib/task-recurrence";

type CalendarTaskTitleProps = {
  name: string;
  recurrenceRule?: string | null;
};

export function CalendarTaskTitle({
  name,
  recurrenceRule,
}: CalendarTaskTitleProps) {
  const repeats = Boolean(parseRecurrenceRule(recurrenceRule));

  return (
    <span className="flex min-w-0 flex-1 items-center gap-0.5 truncate">
      {repeats ? (
        <BiRevision
          className="size-3 shrink-0 opacity-70"
          aria-label="Repeats"
        />
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
