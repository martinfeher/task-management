import {
  repairBrokenTaskImageReferences,
} from "@/lib/task-image-storage";
import {
  CURRENT_SCHEMA_VERSION,
  docToPlainText,
  htmlToDoc,
  validateTaskDoc,
} from "@/lib/task-document";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import {
  createTaskVersionForced,
  getTaskVersionForRestore,
  listTaskVersions,
  maybeCreateTaskVersionBeforeChange,
  type TaskVersionListItem,
} from "@/lib/task-versions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

function buildDetailsDocFields(detailsHtml: string): {
  detailsDoc: Prisma.InputJsonValue | typeof Prisma.DbNull;
  detailsText: string;
  schemaVersion: number;
} {
  if (!taskDetailsHasContent(detailsHtml)) {
    return {
      detailsDoc: Prisma.DbNull,
      detailsText: "",
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  try {
    const doc = htmlToDoc(detailsHtml);
    validateTaskDoc(doc);
    return {
      detailsDoc: doc as Prisma.InputJsonValue,
      detailsText: docToPlainText(doc),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  } catch {
    return {
      detailsDoc: Prisma.DbNull,
      detailsText: "",
      schemaVersion: 1,
    };
  }
}

export async function persistTaskDetailsUpdate(taskId: string, details: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      details: true,
    },
  });

  if (!existing) {
    throw new Error("Task not found");
  }

  const { details: normalizedDetails, changed: repairedReferences } =
    await repairBrokenTaskImageReferences(taskId, details);

  if (existing.details === normalizedDetails) {
    if (repairedReferences) {
      const docFields = buildDetailsDocFields(normalizedDetails);
      await prisma.task.update({
        where: { id: taskId },
        data: {
          details: normalizedDetails,
          ...docFields,
        },
      });
    }

    return { changed: repairedReferences };
  }

  await maybeCreateTaskVersionBeforeChange(
    taskId,
    existing.name,
    existing.details,
    "auto",
  );

  const docFields = buildDetailsDocFields(normalizedDetails);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      details: normalizedDetails,
      ...docFields,
    },
  });

  return { changed: true as const };
}

export async function persistTaskRename(taskId: string, name: string) {
  const trimmedName = name.trim();
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      details: true,
    },
  });

  if (!existing) {
    throw new Error("Task not found");
  }

  if (existing.name === trimmedName) {
    return existing;
  }

  await maybeCreateTaskVersionBeforeChange(
    taskId,
    existing.name,
    existing.details,
    "auto",
  );

  return prisma.task.update({
    where: { id: taskId },
    data: { name: trimmedName },
  });
}

export async function fetchTaskVersions(taskId: string): Promise<TaskVersionListItem[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return listTaskVersions(taskId);
}

export async function fetchTaskVersionById(taskId: string, versionId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const version = await getTaskVersionForRestore(taskId, versionId);
  if (!version) {
    return null;
  }

  return {
    id: version.id,
    name: version.name,
    details: version.details,
    createdAt: version.createdAt.toISOString(),
    source: version.source,
  };
}

export async function createManualTaskVersion(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      details: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const created = await createTaskVersionForced(
    taskId,
    task.name,
    task.details,
    "manual",
  );

  return { created };
}

export async function restoreTaskVersion(taskId: string, versionId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      details: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const version = await getTaskVersionForRestore(taskId, versionId);
  if (!version) {
    throw new Error("Version not found");
  }

  if (
    task.name === version.name &&
    task.details === version.details
  ) {
    return {
      name: task.name,
      details: task.details,
      restored: false as const,
    };
  }

  await createTaskVersionForced(taskId, task.name, task.details, "revert");

  await prisma.task.update({
    where: { id: taskId },
    data: {
      name: version.name,
      details: version.details,
    },
  });

  return {
    name: version.name,
    details: version.details,
    restored: true as const,
  };
}
