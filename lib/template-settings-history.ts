import {
  areCalendarTaskBackgroundSettingsEqual,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";
import {
  arePanelTextColorsSettingsEqual,
  type PanelTextColorsSettings,
} from "@/lib/panel-text-shade-types";
import {
  areSidebarBackgroundSettingsEqual,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";
import {
  areTaskListBackgroundSettingsEqual,
  type TaskListBackgroundSettings,
} from "@/lib/task-list-background-types";
import {
  areTooltipSettingsEqual,
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
