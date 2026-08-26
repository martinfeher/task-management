import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { taskDetailsHasContent, taskDetailsToPlainText } from "@/lib/task-details-content";
import type { TaskVersionListItem, TaskVersionSource } from "@/lib/task-versions-shared";

export type { TaskVersionListItem, TaskVersionSource } from "@/lib/task-versions-shared";

export const TASK_VERSION_INTERVAL_MS = 30_000;
export const TASK_VERSION_MAX_COUNT = 30;
const TASK_VERSION_PREVIEW_MAX_LENGTH = 120;

export function taskVersionContentHash(name: string, details: string) {
  return createHash("sha256")
    .update(name)
    .update("\0")
    .update(details)
    .digest("hex");
}

function buildVersionPreview(name: string, details: string) {
  const plain = taskDetailsToPlainText(details);
  const combined = plain ? `${name.trim()}: ${plain}` : name.trim();
  const normalized = combined.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Empty task";
  }

  if (normalized.length <= TASK_VERSION_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, TASK_VERSION_PREVIEW_MAX_LENGTH - 1)}…`;
}

async function pruneTaskVersions(taskId: string) {
  const staleVersions = await prisma.taskVersion.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: TASK_VERSION_MAX_COUNT,
  });

  if (staleVersions.length === 0) {
    return;
  }

  await prisma.taskVersion.deleteMany({
    where: {
      id: {
        in: staleVersions.map((version) => version.id),
      },
    },
  });
}

async function insertTaskVersion(
  taskId: string,
  name: string,
  details: string,
  source: TaskVersionSource,
) {
  await prisma.taskVersion.create({
    data: {
      taskId,
      name,
      details,
      contentHash: taskVersionContentHash(name, details),
      source,
    },
  });

  await pruneTaskVersions(taskId);
}

function shouldSkipInitialEmptySnapshot(name: string, details: string) {
  return !taskDetailsHasContent(details) && name.trim().length === 0;
}

export async function maybeCreateTaskVersionBeforeChange(
  taskId: string,
  name: string,
  details: string,
  source: TaskVersionSource = "auto",
) {
  const contentHash = taskVersionContentHash(name, details);
  const latestVersion = await prisma.taskVersion.findFirst({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: {
      contentHash: true,
      createdAt: true,
    },
  });

  if (latestVersion?.contentHash === contentHash) {
    return false;
  }

  if (
    !latestVersion &&
    source === "auto" &&
    shouldSkipInitialEmptySnapshot(name, details)
  ) {
    return false;
  }

  if (
    latestVersion &&
    source === "auto" &&
    Date.now() - latestVersion.createdAt.getTime() < TASK_VERSION_INTERVAL_MS
  ) {
    return false;
  }

  await insertTaskVersion(taskId, name, details, source);
  return true;
}

export async function createTaskVersionForced(
  taskId: string,
  name: string,
  details: string,
  source: Extract<TaskVersionSource, "manual" | "revert">,
) {
  const contentHash = taskVersionContentHash(name, details);
  const latestVersion = await prisma.taskVersion.findFirst({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: { contentHash: true },
  });

  if (latestVersion?.contentHash === contentHash) {
    return false;
  }

  await insertTaskVersion(taskId, name, details, source);
  return true;
}

export async function listTaskVersions(taskId: string): Promise<TaskVersionListItem[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      details: true,
    },
  });

  const currentHash = task
    ? taskVersionContentHash(task.name, task.details)
    : null;

  const versions = await prisma.taskVersion.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      source: true,
      name: true,
      details: true,
      contentHash: true,
    },
  });

  return versions.map((version) => ({
    id: version.id,
    createdAt: version.createdAt.toISOString(),
    source: version.source as TaskVersionSource,
    name: version.name,
    preview: buildVersionPreview(version.name, version.details),
    isCurrent: currentHash ? version.contentHash === currentHash : false,
  }));
}

export async function getTaskVersionForRestore(taskId: string, versionId: string) {
  return prisma.taskVersion.findFirst({
    where: {
      id: versionId,
      taskId,
    },
    select: {
      id: true,
      name: true,
      details: true,
      contentHash: true,
      createdAt: true,
      source: true,
    },
  });
}

export async function getAllTaskVersionDetailsHtml(taskId: string) {
  const versions = await prisma.taskVersion.findMany({
    where: { taskId },
    select: { details: true },
  });

  return versions.map((version) => version.details);
}
