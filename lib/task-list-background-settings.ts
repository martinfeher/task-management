import { prisma } from "@/lib/prisma";
import {
  getDefaultTaskListBackgroundSettings,
  normalizeTaskListBackgroundSettings,
  type TaskListBackgroundSettings,
} from "@/lib/task-list-background-types";

export async function getTaskListBackgroundSettings(
  userId: string,
): Promise<TaskListBackgroundSettings> {
  const setting = await prisma.taskListTemplateSetting.findUnique({
    where: { userId },
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
  userId: string,
  settings: TaskListBackgroundSettings,
) {
  const normalized = normalizeTaskListBackgroundSettings(settings);

  await prisma.taskListTemplateSetting.upsert({
    where: { userId },
    create: {
      userId,
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
