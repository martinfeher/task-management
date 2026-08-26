import { addDays, startOfLocalDay, toDateKey } from "./task-due-date";
import type { TaskDueTime } from "./task-due-time";
import type { TaskPriorityLevel } from "./task-priority";
import type { TaskRecurrenceRule } from "./task-recurrence";

export type NaturalLanguageListRef = {
  id: string;
  name: string;
};

export type NaturalLanguageTaskParse = {
  name: string;
  dueDate: string | null;
  dueTime: TaskDueTime | null;
  recurrenceRule: TaskRecurrenceRule | null;
  priority: TaskPriorityLevel | null;
  label: string | null;
  listId: string | null;
  subtasks: string[];
};

export type NaturalLanguageParseContext = {
  now?: Date;
  lists?: NaturalLanguageListRef[];
};

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function stripSegment(text: string, segment: string | RegExp) {
  return normalizeWhitespace(text.replace(segment, " "));
}

function weekdayIndex(name: string): number | null {
  const lowered = name.toLowerCase();
  const index = WEEKDAY_NAMES.indexOf(lowered as (typeof WEEKDAY_NAMES)[number]);
  return index >= 0 ? index : null;
}

function nextWeekday(
  dayIndex: number,
  from: Date,
  options?: { forceNext?: boolean },
) {
  const current = from.getDay();
  let offset = (dayIndex - current + 7) % 7;
  if (offset === 0 && options?.forceNext) {
    offset = 7;
  }
  return addDays(from, offset);
}

function parseHourMinute(
  hourText: string,
  minuteText: string | undefined,
  period: string | undefined,
): number | null {
  let hour = parseInt(hourText, 10);
  const minute = minuteText ? parseInt(minuteText, 10) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute >= 60) return null;

  const normalizedPeriod = period?.toLowerCase();
  if (normalizedPeriod === "am" || normalizedPeriod === "a.m.") {
    if (hour === 12) hour = 0;
  } else if (normalizedPeriod === "pm" || normalizedPeriod === "p.m.") {
    if (hour < 12) hour += 12;
  } else if (!period) {
    if (hour >= 1 && hour <= 6) {
      hour += 12;
    } else if (hour === 12) {
      // noon
    } else if (hour < 1 || hour > 12) {
      return null;
    }
  }

  if (hour < 0 || hour >= 24) return null;

  return hour * 60 + minute;
}

function extractTime(text: string) {
  const patterns = [
    /\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i,
    /\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const minutes = parseHourMinute(match[1], match[2], match[3]);
    if (minutes === null) continue;

    return {
      dueTimeMinutes: minutes,
      text: stripSegment(text, pattern),
    };
  }

  return { dueTimeMinutes: null as number | null, text };
}

function extractDuration(text: string) {
  const patterns = [
    /\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i,
    /\bfor\s+(\d+)\s*(minutes?|mins?|min|m)\b/i,
    /\b(\d+)\s*(minutes?|mins?|min)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const amount = parseFloat(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const unit = match[2].toLowerCase();
    const dueDurationMinutes =
      unit.startsWith("h") || unit === "hr" || unit === "hrs"
        ? Math.round(amount * 60)
        : Math.round(amount);

    return {
      dueDurationMinutes,
      text: stripSegment(text, pattern),
    };
  }

  return { dueDurationMinutes: null as number | null, text };
}

function extractPriority(text: string) {
  const numericMatch = text.match(/\b(?:p|!)\s*([123])\b/i);
  if (numericMatch) {
    const level = parseInt(numericMatch[1], 10) as TaskPriorityLevel;
    return {
      priority: level,
      text: stripSegment(text, numericMatch[0]),
    };
  }

  const namedPatterns: Array<{ pattern: RegExp; level: TaskPriorityLevel }> = [
    { pattern: /\bhigh\s+priority\b/i, level: 1 },
    { pattern: /\bmedium\s+priority\b/i, level: 2 },
    { pattern: /\blow\s+priority\b/i, level: 3 },
  ];

  for (const entry of namedPatterns) {
    const match = text.match(entry.pattern);
    if (!match) continue;

    return {
      priority: entry.level,
      text: stripSegment(text, entry.pattern),
    };
  }

  return { priority: null as TaskPriorityLevel | null, text };
}

function extractLabel(text: string) {
  const match = text.match(/@([a-zA-Z][\w-]*)/);
  if (!match) {
    return { label: null as string | null, text };
  }

  return {
    label: match[1],
    text: stripSegment(text, match[0]),
  };
}

function extractListReference(text: string, lists: NaturalLanguageListRef[]) {
  const match = text.match(/#([a-zA-Z][\w-]*)/);
  if (!match) {
    return { listId: null as string | null, text };
  }

  const query = match[1].toLowerCase();
  const list =
    lists.find((entry) => entry.name.toLowerCase() === query) ??
    lists.find((entry) =>
      entry.name.toLowerCase().replace(/\s+/g, "").includes(query),
    );

  return {
    listId: list?.id ?? null,
    text: stripSegment(text, match[0]),
  };
}

function extractSubtasks(text: string) {
  const match = text.match(/^(.+?):\s+([^:]+(?:,\s*[^:,]+)+)\s*$/);
  if (!match) {
    return { subtasks: [] as string[], text };
  }

  const subtasks = match[2]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (subtasks.length < 2) {
    return { subtasks: [] as string[], text };
  }

  return {
    subtasks,
    text: match[1].trim(),
  };
}

function extractRecurrence(text: string) {
  const everyIntervalMatch = text.match(
    /\bevery\s+(\d+)\s+(day|days|week|weeks|month|months)\b/i,
  );
  if (everyIntervalMatch) {
    const interval = Math.max(1, parseInt(everyIntervalMatch[1], 10));
    const unit = everyIntervalMatch[2].toLowerCase();
    const frequency = unit.startsWith("day")
      ? "daily"
      : unit.startsWith("week")
        ? "weekly"
        : "monthly";

    return {
      recurrenceRule: { frequency, interval } as TaskRecurrenceRule,
      text: stripSegment(text, everyIntervalMatch[0]),
    };
  }

  const presets: Array<{ pattern: RegExp; rule: TaskRecurrenceRule }> = [
    {
      pattern: /\bon the \d+(?:st|nd|rd|th) of every month\b/i,
      rule: { frequency: "monthly", interval: 1 },
    },
    {
      pattern: /\bevery month(?:ly)?\b/i,
      rule: { frequency: "monthly", interval: 1 },
    },
    {
      pattern: /\bevery week(?:ly)?\b/i,
      rule: { frequency: "weekly", interval: 1 },
    },
    {
      pattern: /\bevery day\b|\bdaily\b/i,
      rule: { frequency: "daily", interval: 1 },
    },
  ];

  for (const preset of presets) {
    const match = text.match(preset.pattern);
    if (!match) continue;

    return {
      recurrenceRule: preset.rule,
      text: stripSegment(text, match[0]),
    };
  }

  return { recurrenceRule: null as TaskRecurrenceRule | null, text };
}

function monthDayDate(day: number, from: Date) {
  const anchor = startOfLocalDay(from);
  let candidate = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    day,
    12,
    0,
    0,
    0,
  );

  if (candidate.getDate() !== day) {
    candidate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12, 0, 0, 0);
  }

  if (candidate < anchor) {
    candidate = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + 1,
      day,
      12,
      0,
      0,
      0,
    );
    if (candidate.getDate() !== day) {
      candidate = new Date(
        anchor.getFullYear(),
        anchor.getMonth() + 2,
        0,
        12,
        0,
        0,
        0,
      );
    }
  }

  return candidate;
}

function extractDueDate(text: string, now: Date) {
  const today = startOfLocalDay(now);
  let dueDate: Date | null = null;
  let working = text;

  const apply = (pattern: RegExp, resolver: (match: RegExpMatchArray) => Date | null) => {
    const match = working.match(pattern);
    if (!match) return;
    const resolved = resolver(match);
    if (!resolved) return;
    dueDate = resolved;
    working = stripSegment(working, match[0]);
  };

  apply(/\btoday\b/i, () => today);
  apply(/\btomorrow\b/i, () => addDays(today, 1));

  apply(/\b(?:next week|sometime next week)\b/i, () => {
    const day = today.getDay();
    const daysUntilNextMonday = (8 - day) % 7 || 7;
    return addDays(today, daysUntilNextMonday);
  });

  apply(
    /\b(?:by|on)\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    (match) => {
      const index = weekdayIndex(match[1]);
      return index === null ? null : nextWeekday(index, today, { forceNext: true });
    },
  );

  apply(
    /\b(?:by|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    (match) => {
      const index = weekdayIndex(match[1]);
      return index === null ? null : nextWeekday(index, today);
    },
  );

  apply(/\bon the (\d{1,2})(?:st|nd|rd|th)(?:\s+of\s+[a-z]+)?\b/i, (match) => {
    const day = parseInt(match[1], 10);
    if (!Number.isFinite(day)) return null;
    return monthDayDate(day, today);
  });

  apply(
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    (match) => {
      const index = weekdayIndex(match[1]);
      return index === null ? null : nextWeekday(index, today, { forceNext: true });
    },
  );

  apply(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, (match) => {
    const index = weekdayIndex(match[1]);
    return index === null ? null : nextWeekday(index, today);
  });

  return {
    dueDate: dueDate ? toDateKey(dueDate) : null,
    text: working,
  };
}

function stripUnsupportedPhrases(text: string) {
  let working = text;

  const patterns = [
    /,?\s*remind me\b[^,.]*/i,
    /\bwhen I leave work\b/i,
    /\bwith\s+[A-Z][\w-]*(?:\s+[A-Z][\w-]*)?\b/,
    /\bbefore the\b[^,.]*/i,
    /\buntil\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|\w+)\b/i,
    /\bevery weekday(?:s)?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/i,
    /\bon the \d+(?:st|nd|rd|th)\b/i,
  ];

  for (const pattern of patterns) {
    working = stripSegment(working, pattern);
  }

  return working;
}

export function parseNaturalLanguageTask(
  input: string,
  context: NaturalLanguageParseContext = {},
): NaturalLanguageTaskParse {
  const now = context.now ?? new Date();
  let text = normalizeWhitespace(input);

  if (!text) {
    return {
      name: "",
      dueDate: null,
      dueTime: null,
      recurrenceRule: null,
      priority: null,
      label: null,
      listId: null,
      subtasks: [],
    };
  }

  const subtaskResult = extractSubtasks(text);
  text = subtaskResult.text;

  const listResult = extractListReference(text, context.lists ?? []);
  text = listResult.text;

  const labelResult = extractLabel(text);
  text = labelResult.text;

  const priorityResult = extractPriority(text);
  text = priorityResult.text;

  const recurrenceResult = extractRecurrence(text);
  text = recurrenceResult.text;

  const durationResult = extractDuration(text);
  text = durationResult.text;

  const timeResult = extractTime(text);
  text = timeResult.text;

  const dateResult = extractDueDate(text, now);
  text = dateResult.text;

  let dueDate = dateResult.dueDate;
  if (!dueDate && recurrenceResult.recurrenceRule?.frequency === "monthly") {
    const monthlyDayMatch = input.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/i);
    if (monthlyDayMatch) {
      const day = parseInt(monthlyDayMatch[1], 10);
      if (Number.isFinite(day)) {
        dueDate = toDateKey(monthDayDate(day, now));
      }
    }
  }

  text = stripUnsupportedPhrases(text);
  text = normalizeWhitespace(text.replace(/^[,.\-–—]+|[,.\-–—]+$/g, ""));

  const dueTime: TaskDueTime | null =
    timeResult.dueTimeMinutes !== null || durationResult.dueDurationMinutes !== null
      ? {
          dueTimeMinutes: timeResult.dueTimeMinutes,
          dueDurationMinutes: durationResult.dueDurationMinutes,
          dueTimeZone: "floating",
        }
      : null;

  return {
    name: text,
    dueDate,
    dueTime,
    recurrenceRule: recurrenceResult.recurrenceRule,
    priority: priorityResult.priority,
    label: labelResult.label,
    listId: listResult.listId,
    subtasks: subtaskResult.subtasks,
  };
}

export function summarizeNaturalLanguageParse(
  parsed: NaturalLanguageTaskParse,
): string | null {
  const parts: string[] = [];

  if (parsed.dueDate) parts.push(parsed.dueDate);
  if (parsed.dueTime?.dueTimeMinutes != null) {
    const hours24 = Math.floor(parsed.dueTime.dueTimeMinutes / 60);
    const mins = parsed.dueTime.dueTimeMinutes % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    parts.push(`${hours12}:${String(mins).padStart(2, "0")} ${period}`);
  }
  if (parsed.dueTime?.dueDurationMinutes) {
    parts.push(`${parsed.dueTime.dueDurationMinutes} min`);
  }
  if (parsed.recurrenceRule) {
    parts.push(
      parsed.recurrenceRule.interval === 1
        ? parsed.recurrenceRule.frequency
        : `every ${parsed.recurrenceRule.interval} ${parsed.recurrenceRule.frequency.replace("ly", "")}s`,
    );
  }
  if (parsed.priority) parts.push(`P${parsed.priority}`);
  if (parsed.label) parts.push(`@${parsed.label}`);
  if (parsed.subtasks.length > 0) {
    parts.push(`${parsed.subtasks.length} subtasks`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
