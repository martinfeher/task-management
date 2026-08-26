export type CalendarViewTab =
  | "day"
  | "week"
  | "month"
  | "days"
  | "weeks";

export type CalendarViewSession = {
  activeView: CalendarViewTab;
  multiDayCount: number;
  multiWeekCount: number;
};

export const DEFAULT_CALENDAR_VIEW: CalendarViewTab = "week";

const CALENDAR_VIEW_STORAGE_KEY = "todolist:calendar-view";
const LEGACY_CALENDAR_VIEW_SESSION_KEY = "todolist:calendar-view";

const VALID_VIEWS = new Set<CalendarViewTab>([
  "day",
  "week",
  "month",
  "days",
  "weeks",
]);

const DEFAULT_MULTI_DAY_COUNT = 3;
const DEFAULT_MULTI_WEEK_COUNT = 2;

function clampCount(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseCalendarViewSession(raw: string | null): CalendarViewSession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CalendarViewSession>;
    if (!parsed.activeView || !VALID_VIEWS.has(parsed.activeView)) {
      return null;
    }

    return {
      activeView: parsed.activeView,
      multiDayCount: clampCount(
        parsed.multiDayCount,
        2,
        30,
        DEFAULT_MULTI_DAY_COUNT,
      ),
      multiWeekCount: clampCount(
        parsed.multiWeekCount,
        2,
        12,
        DEFAULT_MULTI_WEEK_COUNT,
      ),
    };
  } catch {
    return null;
  }
}

export function getDefaultCalendarViewSession(): CalendarViewSession {
  return {
    activeView: DEFAULT_CALENDAR_VIEW,
    multiDayCount: DEFAULT_MULTI_DAY_COUNT,
    multiWeekCount: DEFAULT_MULTI_WEEK_COUNT,
  };
}

export function resolveCalendarViewSession(
  stored: CalendarViewSession | null,
): CalendarViewSession {
  return stored ?? getDefaultCalendarViewSession();
}

export function readCalendarViewSession(): CalendarViewSession | null {
  if (typeof window === "undefined") return null;

  const fromLocalStorage = parseCalendarViewSession(
    localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY),
  );
  if (fromLocalStorage) {
    return fromLocalStorage;
  }

  return parseCalendarViewSession(
    sessionStorage.getItem(LEGACY_CALENDAR_VIEW_SESSION_KEY),
  );
}

export function saveCalendarViewSession(session: CalendarViewSession) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify(session);

  try {
    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, payload);
  } catch {
    // Ignore quota / privacy mode errors.
  }

  try {
    sessionStorage.setItem(LEGACY_CALENDAR_VIEW_SESSION_KEY, payload);
  } catch {
    // Ignore quota / privacy mode errors.
  }
}
