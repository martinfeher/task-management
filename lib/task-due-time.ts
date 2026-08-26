export type DueTimeZone = "floating" | "local";

export type TaskDueTime = {
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: DueTimeZone;
};

export const DURATION_OPTIONS = [
  { value: null, label: "No duration" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
] as const;

export const TIME_PICKER_DURATION_OPTIONS = [
  { value: null, label: "None" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
] as const;

export const TIME_PRESETS = [
  { id: "morning", label: "Morning", minutes: 9 * 60 },
  { id: "midday", label: "Midday", minutes: 12 * 60 },
  { id: "afternoon", label: "Afternoon", minutes: 15 * 60 },
  { id: "evening", label: "Evening", minutes: 18 * 60 },
] as const;

export const TIME_LIST_INTERVAL_MINUTES = 30;

export const TIME_ZONE_OPTIONS: { value: DueTimeZone; label: string }[] = [
  { value: "floating", label: "Floating time" },
  { value: "local", label: "Local time" },
];

export function normalizeDueTimeZone(value: string | null | undefined): DueTimeZone {
  return value === "local" ? "local" : "floating";
}

export function normalizeDueTimeMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;

  const minutes = Math.round(value);
  if (minutes < 0 || minutes >= 24 * 60) return null;

  return minutes;
}

export function normalizeDueDurationMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;

  const minutes = Math.round(value);
  if (minutes <= 0) return null;

  return minutes;
}

export function minutesToTimeInputValue(minutes: number | null) {
  const normalized = normalizeDueTimeMinutes(minutes ?? 0) ?? 22 * 60 + 30;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function timeInputValueToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  return normalizeDueTimeMinutes(
    parseInt(match[1], 10) * 60 + parseInt(match[2], 10),
  );
}

export function formatDueTimeLabel(minutes: number | null) {
  const normalized = normalizeDueTimeMinutes(minutes);
  if (normalized === null) return null;

  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}

export function formatDurationLabel(minutes: number | null) {
  if (minutes === null) return "No duration";

  const option = DURATION_OPTIONS.find((entry) => entry.value === minutes);
  if (option) return option.label;

  if (minutes < 60) return `${minutes} minutes`;

  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours} hours`;
}

export function getDefaultDueTimeDraft(
  dueTime: Partial<TaskDueTime> | null | undefined,
): TaskDueTime {
  return {
    dueTimeMinutes:
      normalizeDueTimeMinutes(dueTime?.dueTimeMinutes ?? null) ?? 22 * 60 + 30,
    dueDurationMinutes: normalizeDueDurationMinutes(
      dueTime?.dueDurationMinutes ?? null,
    ),
    dueTimeZone: normalizeDueTimeZone(dueTime?.dueTimeZone),
  };
}

function parseHourMinuteParts(
  hourText: string,
  minuteText: string | undefined,
  period: string | undefined,
): number | null {
  let hour = parseInt(hourText, 10);
  const minute = minuteText ? parseInt(minuteText, 10) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute >= 60) return null;

  const normalizedPeriod = period?.replace(/\./g, "").toLowerCase();
  if (normalizedPeriod === "am") {
    if (hour === 12) hour = 0;
  } else if (normalizedPeriod === "pm") {
    if (hour < 12) hour += 12;
  } else if (!period) {
    if (hour >= 1 && hour <= 6) {
      hour += 12;
    } else if (hour === 12) {
      // noon
    } else if (hour < 1 || hour > 23) {
      return null;
    }
  }

  if (hour < 0 || hour >= 24) return null;

  return normalizeDueTimeMinutes(hour * 60 + minute);
}

export function formatTime24Hour(minutes: number | null) {
  const normalized = normalizeDueTimeMinutes(minutes);
  if (normalized === null) return "";

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function generateTimeListOptions(
  intervalMinutes = TIME_LIST_INTERVAL_MINUTES,
) {
  const options: number[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
    options.push(minutes);
  }

  return options;
}

export function parseTypedTime(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (amPmMatch) {
    return parseHourMinuteParts(amPmMatch[1], amPmMatch[2], amPmMatch[3]);
  }

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return parseHourMinuteParts(colonMatch[1], colonMatch[2], undefined);
  }

  const digitsOnly = trimmed.replace(/\s/g, "");
  if (/^\d{3,4}$/.test(digitsOnly)) {
    const padded = digitsOnly.padStart(4, "0");
    const hour = parseInt(padded.slice(0, 2), 10);
    const minute = parseInt(padded.slice(2, 4), 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return normalizeDueTimeMinutes(hour * 60 + minute);
    }
  }

  if (/^\d{1,2}$/.test(digitsOnly)) {
    return parseHourMinuteParts(digitsOnly, undefined, undefined);
  }

  return null;
}
