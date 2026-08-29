import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { prisma } from "@/lib/prisma";
import {
  deleteTaskImageFile,
  extractReferencedImageFilenames,
} from "@/lib/task-image-storage";
import { getAllTaskVersionDetailsHtml } from "@/lib/task-versions";

type RouteContext = {
  params: Promise<{ taskId: string; filename: string }>;
};

async function isTaskImageReferenced(taskId: string, filename: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { details: true },
  });

  if (!task) {
    return false;
  }

  const referenced = extractReferencedImageFilenames(taskId, task.details);
  if (referenced.has(filename)) {
    return true;
  }

  const versionDetails = await getAllTaskVersionDetailsHtml(taskId);
  for (const details of versionDetails) {
    const versionReferenced = extractReferencedImageFilenames(taskId, details);
    if (versionReferenced.has(filename)) {
      return true;
    }
  }

  return false;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { taskId, filename } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  try {
    if (await isTaskImageReferenced(taskId, filename)) {
      return jsonWithCors(
        { error: "Image is still referenced in task content" },
        { status: 409 },
      );
    }

    await deleteTaskImageFile(taskId, filename);
    return jsonWithCors({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete image";
    return jsonWithCors({ error: message }, { status: 400 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
