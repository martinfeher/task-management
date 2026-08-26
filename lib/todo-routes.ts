export type ListCalendarView =
  | "day"
  | "week"
  | "month"
  | "days"
  | "weeks";

const LIST_CALENDAR_VIEWS = new Set<ListCalendarView>([
  "day",
  "week",
  "month",
  "days",
  "weeks",
]);

export const LIST_CALENDAR_MULTI_DAY_DEFAULT = 3;
export const LIST_CALENDAR_MULTI_DAY_MIN = 2;
export const LIST_CALENDAR_MULTI_DAY_MAX = 30;
export const LIST_CALENDAR_MULTI_WEEK_DEFAULT = 2;
export const LIST_CALENDAR_MULTI_WEEK_MIN = 2;
export const LIST_CALENDAR_MULTI_WEEK_MAX = 12;

export function clampListCalendarMultiDayCount(
  value: number | string | null | undefined,
) {
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) : value ?? NaN;
  if (!Number.isFinite(parsed)) {
    return LIST_CALENDAR_MULTI_DAY_DEFAULT;
  }

  return Math.min(
    LIST_CALENDAR_MULTI_DAY_MAX,
    Math.max(LIST_CALENDAR_MULTI_DAY_MIN, Math.round(parsed)),
  );
}

export function clampListCalendarMultiWeekCount(
  value: number | string | null | undefined,
) {
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) : value ?? NaN;
  if (!Number.isFinite(parsed)) {
    return LIST_CALENDAR_MULTI_WEEK_DEFAULT;
  }

  return Math.min(
    LIST_CALENDAR_MULTI_WEEK_MAX,
    Math.max(LIST_CALENDAR_MULTI_WEEK_MIN, Math.round(parsed)),
  );
}

export function parseListCalendarView(value: string): ListCalendarView | null {
  if (!LIST_CALENDAR_VIEWS.has(value as ListCalendarView)) {
    return null;
  }

  return value as ListCalendarView;
}

export type CalendarRouteView = {
  calendarView: ListCalendarView;
  multiDayCount?: number;
  multiWeekCount?: number;
};

function parseCalendarRouteView(
  viewSegment: string,
  params: URLSearchParams | null,
): CalendarRouteView {
  if (viewSegment === "days") {
    return {
      calendarView: "days",
      multiDayCount: clampListCalendarMultiDayCount(params?.get("n")),
    };
  }

  if (viewSegment === "weeks") {
    return {
      calendarView: "weeks",
      multiWeekCount: clampListCalendarMultiWeekCount(params?.get("n")),
    };
  }

  return {
    calendarView: parseListCalendarView(viewSegment) ?? "week",
  };
}

function buildCalendarViewPath(
  basePathname: string,
  calendarView: ListCalendarView,
  multiDayCount?: number,
  multiWeekCount?: number,
) {
  const pathname = `${basePathname}/${calendarView}`;

  if (calendarView === "days") {
    return `${pathname}?n=${clampListCalendarMultiDayCount(multiDayCount)}`;
  }

  if (calendarView === "weeks") {
    return `${pathname}?n=${clampListCalendarMultiWeekCount(multiWeekCount)}`;
  }

  return pathname;
}

export type TodoRoute =
  | { kind: "home" }
  | { kind: "list"; listId: string }
  | {
      kind: "listCalendar";
      listId: string;
      calendarView: ListCalendarView;
      multiDayCount?: number;
      multiWeekCount?: number;
    }
  | { kind: "task"; taskId: string }
  | { kind: "today" }
  | { kind: "important" }
  | {
      kind: "calendar";
      calendarView: ListCalendarView;
      multiDayCount?: number;
      multiWeekCount?: number;
    }
  | { kind: "label"; labelId: string };

function toSearchParams(
  searchParams?: URLSearchParams | string | null,
): URLSearchParams | null {
  if (!searchParams) return null;
  if (searchParams instanceof URLSearchParams) return searchParams;
  return new URLSearchParams(searchParams);
}

export function buildTodoPath(route: TodoRoute): string {
  switch (route.kind) {
    case "home":
      return "/";
    case "list":
      return `/lists/${encodeURIComponent(route.listId)}`;
    case "listCalendar":
      return buildCalendarViewPath(
        `/lists/${encodeURIComponent(route.listId)}/calendar`,
        route.calendarView,
        route.multiDayCount,
        route.multiWeekCount,
      );
    case "task":
      return `/tasks/${encodeURIComponent(route.taskId)}`;
    case "today":
      return "/today";
    case "important":
      return "/important";
    case "calendar":
      return buildCalendarViewPath(
        "/calendar",
        route.calendarView,
        route.multiDayCount,
        route.multiWeekCount,
      );
    case "label":
      return `/labels/${encodeURIComponent(route.labelId)}`;
  }
}

export function parseTodoPath(
  pathname: string,
  searchParams?: URLSearchParams | string | null,
): TodoRoute | null {
  const params = toSearchParams(searchParams);

  if (pathname === "/") return { kind: "home" };
  if (pathname === "/today") return { kind: "today" };
  if (pathname === "/important") return { kind: "important" };

  const calendarMatch = pathname.match(
    /^\/calendar(?:\/(day|week|month|days|weeks))?$/,
  );
  if (calendarMatch) {
    const view = parseCalendarRouteView(calendarMatch[1] ?? "week", params);
    return { kind: "calendar", ...view };
  }

  const legacyListTaskMatch = pathname.match(
    /^\/lists\/([^/]+)\/tasks\/([^/]+)$/,
  );
  if (legacyListTaskMatch) {
    return { kind: "task", taskId: decodeURIComponent(legacyListTaskMatch[2]) };
  }

  const listCalendarMatch = pathname.match(
    /^\/lists\/([^/]+)\/calendar(?:\/(day|week|month|days|weeks))?$/,
  );
  if (listCalendarMatch) {
    const listId = decodeURIComponent(listCalendarMatch[1]);
    const view = parseCalendarRouteView(listCalendarMatch[2] ?? "week", params);

    return {
      kind: "listCalendar",
      listId,
      ...view,
    };
  }

  const listMatch = pathname.match(/^\/lists\/([^/]+)$/);
  if (listMatch) {
    return { kind: "list", listId: decodeURIComponent(listMatch[1]) };
  }

  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch) {
    return { kind: "task", taskId: decodeURIComponent(taskMatch[1]) };
  }

  const labelMatch = pathname.match(/^\/labels\/([^/]+)$/);
  if (labelMatch) {
    return { kind: "label", labelId: decodeURIComponent(labelMatch[1]) };
  }

  return null;
}

export function findListIdForTask(
  taskId: string,
  tasksByList: Record<string, Array<{ id: string }>>,
): string | null {
  for (const [listId, tasks] of Object.entries(tasksByList)) {
    if (tasks.some((task) => task.id === taskId)) {
      return listId;
    }
  }

  return null;
}

export type TodoRouteAppState = {
  activeView: "today" | "important" | "calendar" | null;
  selectedListId: string | null;
  selectedTaskId: string | null;
  selectedLabelId: string | null;
  isListCalendarOpen: boolean;
  listCalendarView: ListCalendarView;
  listCalendarMultiDayCount: number;
  listCalendarMultiWeekCount: number;
  calendarView: ListCalendarView;
  calendarMultiDayCount: number;
  calendarMultiWeekCount: number;
};

export function getRouteFromAppState(
  state: TodoRouteAppState,
): TodoRoute {
  if (state.activeView === "calendar") {
    return {
      kind: "calendar",
      calendarView: state.calendarView,
      multiDayCount: state.calendarMultiDayCount,
      multiWeekCount: state.calendarMultiWeekCount,
    };
  }

  if (state.activeView === "today") {
    return { kind: "today" };
  }

  if (state.activeView === "important") {
    return { kind: "important" };
  }

  if (state.selectedLabelId) {
    return { kind: "label", labelId: state.selectedLabelId };
  }

  if (state.isListCalendarOpen && state.selectedListId) {
    return {
      kind: "listCalendar",
      listId: state.selectedListId,
      calendarView: state.listCalendarView,
      multiDayCount: state.listCalendarMultiDayCount,
      multiWeekCount: state.listCalendarMultiWeekCount,
    };
  }

  if (state.selectedTaskId) {
    return { kind: "task", taskId: state.selectedTaskId };
  }

  if (state.selectedListId) {
    return { kind: "list", listId: state.selectedListId };
  }

  return { kind: "home" };
}

function calendarRoutesEqual(
  a: {
    calendarView: ListCalendarView;
    multiDayCount?: number;
    multiWeekCount?: number;
  },
  b: {
    calendarView: ListCalendarView;
    multiDayCount?: number;
    multiWeekCount?: number;
  },
) {
  return (
    a.calendarView === b.calendarView &&
    clampListCalendarMultiDayCount(a.multiDayCount) ===
      clampListCalendarMultiDayCount(b.multiDayCount) &&
    clampListCalendarMultiWeekCount(a.multiWeekCount) ===
      clampListCalendarMultiWeekCount(b.multiWeekCount)
  );
}

export function routesEqual(a: TodoRoute, b: TodoRoute) {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "home":
    case "today":
    case "important":
      return true;
    case "calendar":
      return b.kind === "calendar" && calendarRoutesEqual(a, b);
    case "list":
      return b.kind === "list" && a.listId === b.listId;
    case "listCalendar":
      return (
        b.kind === "listCalendar" &&
        a.listId === b.listId &&
        calendarRoutesEqual(a, b)
      );
    case "task":
      return b.kind === "task" && a.taskId === b.taskId;
    case "label":
      return b.kind === "label" && a.labelId === b.labelId;
  }
}

export function getTodoLocationKey(
  pathname: string,
  searchParams?: URLSearchParams | string | null,
) {
  const params = toSearchParams(searchParams);
  const search = params?.toString() ?? "";
  return search ? `${pathname}?${search}` : pathname;
}
