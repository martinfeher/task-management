import { prisma } from "@/lib/prisma";
import {
  getDefaultTaskListBackgroundSettings,
  normalizeTaskListBackgroundSettings,
  type TaskListBackgroundSettings,
} from "@/lib/task-list-background-types";

export const TASK_LIST_TEMPLATE_SETTING_ID = "default";

export async function getTaskListBackgroundSettings(): Promise<TaskListBackgroundSettings> {
  const setting = await prisma.taskListTemplateSetting.findUnique({
    where: { id: TASK_LIST_TEMPLATE_SETTING_ID },
    select: {
      backgroundId: true,
      baseColor: true,
    },
  });

  if (!setting) {
    return getDefaultTaskListBackgroundSettings();
  }

  return normalizeTaskListBackgroundSettings(setting);
}

export async function setTaskListBackgroundSettings(
  settings: TaskListBackgroundSettings,
) {
  const normalized = normalizeTaskListBackgroundSettings(settings);

  await prisma.taskListTemplateSetting.upsert({
    where: { id: TASK_LIST_TEMPLATE_SETTING_ID },
    create: {
      id: TASK_LIST_TEMPLATE_SETTING_ID,
      backgroundId: normalized.backgroundId,
      baseColor: normalized.baseColor,
    },
    update: {
      backgroundId: normalized.backgroundId,
      baseColor: normalized.baseColor,
    },
  });

  return normalized;
}
