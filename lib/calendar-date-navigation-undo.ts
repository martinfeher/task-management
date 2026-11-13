export type CalendarDateNavigationSnapshot = {
  anchorDateKey: string;
  focusDateKey: string;
  sidebarMonthKey: string;
  daysRangeStartKey: string | null;
};

export type CalendarDateNavigationPanelState = {
  focusDateKey: string;
  sidebarMonthKey: string;
  daysRangeStartKey: string | null;
};

export function buildCalendarDateNavigationSnapshot(
  anchorDateKey: string,
  panel: CalendarDateNavigationPanelState,
): CalendarDateNavigationSnapshot {
  return {
    anchorDateKey,
    focusDateKey: panel.focusDateKey,
    sidebarMonthKey: panel.sidebarMonthKey,
    daysRangeStartKey: panel.daysRangeStartKey,
  };
}

export function calendarDateNavigationSnapshotsEqual(
  a: CalendarDateNavigationSnapshot,
  b: CalendarDateNavigationSnapshot,
) {
  return (
    a.anchorDateKey === b.anchorDateKey &&
    a.focusDateKey === b.focusDateKey &&
    a.sidebarMonthKey === b.sidebarMonthKey &&
    a.daysRangeStartKey === b.daysRangeStartKey
  );
}
