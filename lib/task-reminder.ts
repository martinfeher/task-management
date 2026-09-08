export type TaskReminderOptionId =
  | "on-time"
  | "5-min"
  | "30-min"
  | "1-hour"
  | "1-day"
  | "custom";

export type TaskReminderOption = {
  id: TaskReminderOptionId;
  label: string;
};

export const REMINDER_MENU_OPTIONS: TaskReminderOption[] = [
  { id: "on-time", label: "On time" },
  { id: "5-min", label: "5 minutes early" },
  { id: "30-min", label: "30 minutes early" },
  { id: "1-hour", label: "1 hour early" },
  { id: "1-day", label: "1 day early" },
  { id: "custom", label: "Custom" },
];

export function formatReminderLabel(
  optionId: TaskReminderOptionId | null,
): string {
  if (!optionId) return "Reminder";

  return (
    REMINDER_MENU_OPTIONS.find((option) => option.id === optionId)?.label ??
    "Reminder"
  );
}
