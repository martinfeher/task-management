import {
  areCalendarTaskBackgroundSettingsEqual,
  getDefaultCalendarTaskBackgroundSettings,
  normalizeCalendarTaskBackgroundSettings,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";
import {
  arePanelTextColorsSettingsEqual,
  getDefaultPanelTextColorsSettings,
  normalizePanelTextColorsSettings,
  type PanelTextColorsSettings,
} from "@/lib/panel-text-shade-types";
import {
  areSidebarBackgroundSettingsEqual,
  getDefaultSidebarBackgroundSettings,
  normalizeSidebarBackgroundSettings,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";
import {
  areTaskListBackgroundSettingsEqual,
  getDefaultTaskListBackgroundSettings,
  normalizeTaskListBackgroundSettings,
  type TaskListBackgroundSettings,
} from "@/lib/task-list-background-types";
import {
  areTooltipSettingsEqual,
  getDefaultTooltipSettings,
  normalizeTooltipSettings,
  type TooltipSettings,
} from "@/lib/tooltip-settings-types";

export type TemplateSettingsSnapshot = {
  panelTextColors: PanelTextColorsSettings;
  sidebar: SidebarBackgroundSettings;
  taskList: TaskListBackgroundSettings;
  calendarTask: CalendarTaskBackgroundSettings;
  tooltip: TooltipSettings;
};

export function cloneTemplateSettingsSnapshot(
  snapshot: TemplateSettingsSnapshot,
): TemplateSettingsSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TemplateSettingsSnapshot;
}

export function areTemplateSettingsSnapshotsEqual(
  a: TemplateSettingsSnapshot,
  b: TemplateSettingsSnapshot,
) {
  return (
    arePanelTextColorsSettingsEqual(a.panelTextColors, b.panelTextColors) &&
    areSidebarBackgroundSettingsEqual(a.sidebar, b.sidebar) &&
    areTaskListBackgroundSettingsEqual(a.taskList, b.taskList) &&
    areCalendarTaskBackgroundSettingsEqual(a.calendarTask, b.calendarTask) &&
    areTooltipSettingsEqual(a.tooltip, b.tooltip)
  );
}

export function getDefaultTemplateSettingsSnapshot(): TemplateSettingsSnapshot {
  return {
    panelTextColors: getDefaultPanelTextColorsSettings(),
    sidebar: getDefaultSidebarBackgroundSettings(),
    taskList: getDefaultTaskListBackgroundSettings(),
    calendarTask: getDefaultCalendarTaskBackgroundSettings(),
    tooltip: getDefaultTooltipSettings(),
  };
}

export function normalizeTemplateSettingsSnapshot(
  value: unknown,
): TemplateSettingsSnapshot {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Partial<TemplateSettingsSnapshot>)
      : {};

  return {
    panelTextColors: normalizePanelTextColorsSettings(
      candidate.panelTextColors ?? null,
    ),
    sidebar: normalizeSidebarBackgroundSettings(candidate.sidebar ?? null),
    taskList: normalizeTaskListBackgroundSettings(candidate.taskList ?? null),
    calendarTask: normalizeCalendarTaskBackgroundSettings(
      candidate.calendarTask ?? null,
    ),
    tooltip: normalizeTooltipSettings(candidate.tooltip ?? null),
  };
}
