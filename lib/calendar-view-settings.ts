import { LIST_CALENDAR_MULTI_DAY_DEFAULT } from "./todo-routes";

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
  /** Sidebar / timed view focus (`YYYY-MM-DD`). */
  focusDateKey?: string;
  /** Multi-day view visible range start (`YYYY-MM-DD`). */
  daysRangeStartKey?: string;
  /** Sidebar mini-month month anchor (`YYYY-MM-DD`, first of month). */
  sidebarMonthKey?: string;
  /** Last vertical scroll offsets for timed grids, keyed by calendar view tab. */
  timedGridScrollTopByView?: Partial<Record<CalendarViewTab, number>>;
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

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DEFAULT_MULTI_WEEK_COUNT = 2;

function clampCount(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseOptionalDateKey(value: unknown): string | undefined {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return undefined;
  }

  return value;
}

function parseTimedGridScrollTopByView(
  value: unknown,
): Partial<Record<CalendarViewTab, number>> | undefined {
  if (!value || typeof value !== "object") return undefined;

  const result: Partial<Record<CalendarViewTab, number>> = {};
  for (const view of VALID_VIEWS) {
    const scrollTop = (value as Record<string, unknown>)[view];
    if (typeof scrollTop !== "number" || !Number.isFinite(scrollTop) || scrollTop < 0) {
      continue;
    }
    result[view] = Math.round(scrollTop);
  }

  return Object.keys(result).length > 0 ? result : undefined;
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
        LIST_CALENDAR_MULTI_DAY_DEFAULT,
      ),
      multiWeekCount: clampCount(
        parsed.multiWeekCount,
        2,
        12,
        DEFAULT_MULTI_WEEK_COUNT,
      ),
      focusDateKey: parseOptionalDateKey(parsed.focusDateKey),
      daysRangeStartKey: parseOptionalDateKey(parsed.daysRangeStartKey),
      sidebarMonthKey: parseOptionalDateKey(parsed.sidebarMonthKey),
      timedGridScrollTopByView: parseTimedGridScrollTopByView(
        parsed.timedGridScrollTopByView,
      ),
    };
  } catch {
    return null;
  }
}

export function getDefaultCalendarViewSession(): CalendarViewSession {
  return {
    activeView: DEFAULT_CALENDAR_VIEW,
    multiDayCount: LIST_CALENDAR_MULTI_DAY_DEFAULT,
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

export function patchCalendarViewSession(patch: Partial<CalendarViewSession>) {
  saveCalendarViewSession({
    ...resolveCalendarViewSession(readCalendarViewSession()),
    ...patch,
  });
}
