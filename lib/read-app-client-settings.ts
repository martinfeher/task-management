import { readCalendarTaskDefaultColorFromStorage } from "@/lib/calendar-task-default-color";
import { readImportantEnabledFromStorage } from "@/lib/important-settings";
import { readListPreviewEnabledFromStorage } from "@/lib/list-preview-settings";
import { readSubtasksEnabledFromStorage } from "@/lib/subtasks-settings";
import {
  readTaskEditorDefaultsFromStorage,
  type TaskEditorDefaults,
} from "@/lib/task-editor-defaults-settings";
import type { CalendarTaskColor } from "@/lib/calendar-task-colors";

export type AppClientSettings = {
  importantEnabled: boolean;
  listPreviewEnabled: boolean;
  subtasksEnabled: boolean;
  taskEditorDefaults: TaskEditorDefaults;
  calendarTaskDefaultColor: CalendarTaskColor;
};

export function readAppClientSettings(): AppClientSettings {
  return {
    importantEnabled: readImportantEnabledFromStorage(),
    listPreviewEnabled: readListPreviewEnabledFromStorage(),
    subtasksEnabled: readSubtasksEnabledFromStorage(),
    taskEditorDefaults: readTaskEditorDefaultsFromStorage(),
    calendarTaskDefaultColor: readCalendarTaskDefaultColorFromStorage(),
  };
}
