export type RecurrenceFrequency = "daily" | "weekdays" | "weekly" | "monthly";

export type TaskRecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
};

export function parseRecurrenceRule(
  value: string | null | undefined,
): TaskRecurrenceRule | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<TaskRecurrenceRule>;
    if (
      parsed.frequency !== "daily" &&
      parsed.frequency !== "weekdays" &&
      parsed.frequency !== "weekly" &&
      parsed.frequency !== "monthly"
    ) {
      return null;
    }

    const interval =
      typeof parsed.interval === "number" && parsed.interval >= 1
        ? Math.floor(parsed.interval)
        : 1;

    return { frequency: parsed.frequency, interval };
  } catch {
    return null;
  }
}

export function serializeRecurrenceRule(rule: TaskRecurrenceRule | null): string | null {
  if (!rule) return null;

  return JSON.stringify({
    frequency: rule.frequency,
    interval: Math.max(1, Math.floor(rule.interval)),
  });
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

export function advanceDueDate(
  dueDate: Date,
  rule: TaskRecurrenceRule,
): Date {
  const next = startOfLocalDay(dueDate);
  const interval = Math.max(1, rule.interval);

  switch (rule.frequency) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekdays":
      for (let step = 0; step < interval; step += 1) {
        do {
          next.setDate(next.getDate() + 1);
        } while (next.getDay() === 0 || next.getDay() === 6);
      }
      break;
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      break;
    default:
      break;
  }

  return next;
}

export function formatRecurrenceLabel(rule: TaskRecurrenceRule | null): string {
  if (!rule) return "Does not repeat";

  const interval = Math.max(1, rule.interval);
  if (interval === 1) {
    switch (rule.frequency) {
      case "daily":
        return "Daily";
      case "weekdays":
        return "Every weekday";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Repeat";
    }
  }

  switch (rule.frequency) {
    case "daily":
      return `Every ${interval} days`;
    case "weekdays":
      return interval === 1 ? "Every weekday" : `Every ${interval} weekdays`;
    case "weekly":
      return `Every ${interval} weeks`;
    case "monthly":
      return `Every ${interval} months`;
    default:
      return "Repeat";
  }
}

export const RECURRENCE_PRESETS: TaskRecurrenceRule[] = [
  { frequency: "daily", interval: 1 },
  { frequency: "weekdays", interval: 1 },
  { frequency: "weekly", interval: 1 },
  { frequency: "monthly", interval: 1 },
];

export type RecurrenceMenuOption = {
  id: string;
  label: string;
  rule: TaskRecurrenceRule | null;
};

export const RECURRENCE_MENU_OPTIONS: RecurrenceMenuOption[] = [
  { id: "none", label: "Does not repeat", rule: null },
  { id: "daily", label: "Daily", rule: { frequency: "daily", interval: 1 } },
  {
    id: "weekdays",
    label: "Every weekday",
    rule: { frequency: "weekdays", interval: 1 },
  },
  { id: "weekly", label: "Weekly", rule: { frequency: "weekly", interval: 1 } },
  {
    id: "monthly",
    label: "Monthly",
    rule: { frequency: "monthly", interval: 1 },
  },
];

export function getRecurrenceMenuSelectionId(
  rule: TaskRecurrenceRule | null,
): string | null {
  if (!rule) return "none";

  const match = RECURRENCE_MENU_OPTIONS.find(
    (option) =>
      option.rule !== null &&
      option.rule.frequency === rule.frequency &&
      option.rule.interval === rule.interval,
  );

  return match?.id ?? null;
}

export const RECURRENCE_OPTIONS: {
  rule: TaskRecurrenceRule | null;
  label: string;
}[] = [
  { rule: null, label: "Does not repeat" },
  ...RECURRENCE_PRESETS.map((rule) => ({
    rule,
    label: formatRecurrenceLabel(rule),
  })),
];

export function getRecurrenceUndoMessage(rule: TaskRecurrenceRule | null): string {
  if (!rule) return "Repeat removed";

  return `${formatRecurrenceLabel(rule)} repeat set`;
}

export function recurrenceRulesEqual(
  a: TaskRecurrenceRule | null,
  b: TaskRecurrenceRule | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.frequency === b.frequency && a.interval === b.interval;
}

export function getRecurringOccurrenceDateKeys(
  anchorDateKey: string,
  rule: TaskRecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences = 400,
): string[] {
  const start = startOfLocalDay(rangeStart);
  const end = startOfLocalDay(rangeEnd);
  const anchor = startOfLocalDay(new Date(`${anchorDateKey}T12:00:00`));

  if (Number.isNaN(anchor.getTime()) || end < start) {
    return [];
  }

  let cursor = anchor;
  let safety = 0;

  while (cursor < start && safety < maxOccurrences) {
    const next = advanceDueDate(cursor, rule);
    if (next.getTime() === cursor.getTime()) break;
    cursor = next;
    safety += 1;
  }

  const keys: string[] = [];
  safety = 0;

  while (cursor <= end && safety < maxOccurrences) {
    if (cursor >= start) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      keys.push(`${year}-${month}-${day}`);
    }

    const next = advanceDueDate(cursor, rule);
    if (next.getTime() === cursor.getTime()) break;
    cursor = next;
    safety += 1;
  }

  return keys;
}
