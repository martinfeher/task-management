import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { repairBrokenTaskImageReferences } from "@/lib/task-image-storage";
import { LABEL_CATEGORY } from "@/lib/task-tags";
import { normalizeDueTimeZone } from "@/lib/task-due-time";
import { getPriorityFromTaskTags } from "@/lib/task-tags";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";
import {
  deleteTask,
  moveTaskToList,
  toggleTask,
  updateTaskCalendarColor,
  updateTaskDueDate,
  updateTaskDueTime,
  updateTaskPriority,
  updateTaskRecurrence,
} from "@/app/actions/todo";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      name: true,
      completed: true,
      details: true,
      detailsDoc: true,
      schemaVersion: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
      calendarColor: true,
      recurrenceRule: true,
      recurrenceAnchor: true,
      important: true,
      pinned: true,
      list: {
        select: {
          id: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: { id: true, label: true, category: true, level: true },
          },
        },
        orderBy: {
          tag: { label: "asc" },
        },
      },
    },
  });

  if (!task) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  const { details, changed } = await repairBrokenTaskImageReferences(
    taskId,
    task.details,
  );

  if (changed) {
    await prisma.task.update({
      where: { id: taskId },
      data: { details },
    });
  }

  return jsonWithCors({
    id: task.id,
    name: task.name,
    completed: task.completed,
    details,
    // Canonical ProseMirror/Tiptap-style doc — long-term source of truth for
    // rich formatting, kept in lockstep with `details` HTML by
    // `persistTaskDetailsUpdate`. `details` remains the legacy/edit-surface
    // representation for both clients.
    detailsDoc: task.detailsDoc ?? null,
    schemaVersion: task.schemaVersion,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    calendarColor: task.calendarColor,
    recurrenceRule: task.recurrenceRule,
    recurrenceAnchor: task.recurrenceAnchor
      ? task.recurrenceAnchor.toISOString()
      : null,
    important: task.important,
    pinned: task.pinned,
    priority: getPriorityFromTaskTags(task.tags),
    listId: task.list.id,
    listName: task.list.name,
    labels: task.tags
      .filter((entry) => entry.tag.category === LABEL_CATEGORY)
      .map((entry) => ({ id: entry.tag.id, label: entry.tag.label })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  let body: {
    completed?: boolean;
    important?: boolean;
    pinned?: boolean;
    priority?: number | null;
    name?: string;
    listId?: string;
    dueDate?: string | null;
    dueTimeMinutes?: number | null;
    dueDurationMinutes?: number | null;
    calendarColor?: string | null;
    recurrenceRule?: TaskRecurrenceRule | null;
  };
  try {
    body = (await request.json()) as {
      completed?: boolean;
      important?: boolean;
      pinned?: boolean;
      priority?: number | null;
      name?: string;
      listId?: string;
      dueDate?: string | null;
      dueTimeMinutes?: number | null;
      dueDurationMinutes?: number | null;
      calendarColor?: string | null;
      recurrenceRule?: TaskRecurrenceRule | null;
    };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    body.completed === undefined &&
    body.important === undefined &&
    body.pinned === undefined &&
    body.priority === undefined &&
    body.name === undefined &&
    body.listId === undefined &&
    body.dueDate === undefined &&
    body.dueTimeMinutes === undefined &&
    body.dueDurationMinutes === undefined &&
    body.calendarColor === undefined &&
    body.recurrenceRule === undefined
  ) {
    return jsonWithCors(
      {
        error:
          "Provide completed, important, pinned, priority, name, listId, dueDate, dueTimeMinutes, dueDurationMinutes, calendarColor, and/or recurrenceRule",
      },
      { status: 400 },
    );
  }

  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    return jsonWithCors({ error: "completed must be a boolean" }, { status: 400 });
  }

  if (body.important !== undefined && typeof body.important !== "boolean") {
    return jsonWithCors({ error: "important must be a boolean" }, { status: 400 });
  }

  if (body.pinned !== undefined && typeof body.pinned !== "boolean") {
    return jsonWithCors({ error: "pinned must be a boolean" }, { status: 400 });
  }

  if (
    body.priority !== undefined &&
    body.priority !== null &&
    (typeof body.priority !== "number" ||
      !Number.isInteger(body.priority) ||
      body.priority < 1 ||
      body.priority > 3)
  ) {
    return jsonWithCors(
      { error: "priority must be null or an integer 1–3" },
      { status: 400 },
    );
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return jsonWithCors({ error: "name must be a string" }, { status: 400 });
    }
    if (!body.name.trim()) {
      return jsonWithCors({ error: "name cannot be empty" }, { status: 400 });
    }
  }

  if (body.listId !== undefined) {
    if (typeof body.listId !== "string" || !body.listId.trim()) {
      return jsonWithCors({ error: "listId must be a non-empty string" }, {
        status: 400,
      });
    }
  }

  if (body.dueDate !== undefined && body.dueDate !== null) {
    if (typeof body.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      return jsonWithCors(
        { error: "dueDate must be null or YYYY-MM-DD" },
        { status: 400 },
      );
    }
  }

  if (
    body.dueTimeMinutes !== undefined &&
    body.dueTimeMinutes !== null &&
    (typeof body.dueTimeMinutes !== "number" ||
      !Number.isInteger(body.dueTimeMinutes) ||
      body.dueTimeMinutes < 0 ||
      body.dueTimeMinutes > 1439)
  ) {
    return jsonWithCors(
      { error: "dueTimeMinutes must be null or an integer 0–1439" },
      { status: 400 },
    );
  }

  if (
    body.dueDurationMinutes !== undefined &&
    body.dueDurationMinutes !== null &&
    (typeof body.dueDurationMinutes !== "number" ||
      !Number.isInteger(body.dueDurationMinutes) ||
      body.dueDurationMinutes < 1)
  ) {
    return jsonWithCors(
      { error: "dueDurationMinutes must be null or a positive integer" },
      { status: 400 },
    );
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, listId: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  try {
    if (body.listId !== undefined) {
      const targetListId = body.listId.trim();
      if (targetListId === existing.listId) {
        const currentList = await prisma.todoList.findUnique({
          where: { id: targetListId },
          select: { id: true, name: true },
        });
        return jsonWithCors({
          id: taskId,
          listId: currentList?.id ?? targetListId,
          listName: currentList?.name ?? "",
        });
      }

      const targetList = await prisma.todoList.findUnique({
        where: { id: targetListId },
        select: { id: true, name: true },
      });

      if (!targetList) {
        return jsonWithCors({ error: "List not found" }, { status: 404 });
      }

      await moveTaskToList(taskId, targetListId);
      revalidatePath("/");

      return jsonWithCors({
        id: taskId,
        listId: targetList.id,
        listName: targetList.name,
      });
    }

    if (body.priority !== undefined) {
      await updateTaskPriority(taskId, body.priority);
    }

    if (body.calendarColor !== undefined) {
      await updateTaskCalendarColor(taskId, body.calendarColor);
    }

    if (body.recurrenceRule !== undefined) {
      await updateTaskRecurrence(taskId, body.recurrenceRule);
    }

    let spawnedTask:
      | {
          id: string;
          listId: string;
          name: string;
          dueDate: string | null;
          recurrenceRule: string | null;
        }
      | undefined;

    if (body.completed !== undefined) {
      const toggleResult = await toggleTask(taskId, body.completed);
      if (toggleResult.spawnedTask) {
        spawnedTask = toggleResult.spawnedTask;
      }
    }

    if (body.dueDate !== undefined) {
      await updateTaskDueDate(taskId, body.dueDate);
    }

    if (
      body.dueTimeMinutes !== undefined ||
      body.dueDurationMinutes !== undefined
    ) {
      const current = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          dueTimeMinutes: true,
          dueDurationMinutes: true,
          dueTimeZone: true,
        },
      });
      if (!current) {
        return jsonWithCors({ error: "Task not found" }, { status: 404 });
      }
      await updateTaskDueTime(taskId, {
        dueTimeMinutes:
          body.dueTimeMinutes !== undefined
            ? body.dueTimeMinutes
            : current.dueTimeMinutes,
        dueDurationMinutes:
          body.dueDurationMinutes !== undefined
            ? body.dueDurationMinutes
            : current.dueDurationMinutes,
        dueTimeZone: normalizeDueTimeZone(current.dueTimeZone),
      });
    }

    const updateData = {
      ...(body.important !== undefined ? { important: body.important } : {}),
      ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    };

    const taskSelect = {
      id: true,
      name: true,
      completed: true,
      important: true,
      pinned: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
      calendarColor: true,
      recurrenceRule: true,
      recurrenceAnchor: true,
      tags: {
        include: {
          tag: {
            select: { category: true, level: true },
          },
        },
      },
    } as const;

    const task =
      Object.keys(updateData).length > 0
        ? await prisma.task.update({
            where: { id: taskId },
            data: updateData,
            select: taskSelect,
          })
        : await prisma.task.findUnique({
            where: { id: taskId },
            select: taskSelect,
          });

    if (!task) {
      return jsonWithCors({ error: "Task not found" }, { status: 404 });
    }

    revalidatePath("/");

    return jsonWithCors({
      id: task.id,
      name: task.name,
      completed: task.completed,
      important: task.important,
      pinned: task.pinned,
      priority: getPriorityFromTaskTags(task.tags),
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      dueTimeMinutes: task.dueTimeMinutes,
      dueDurationMinutes: task.dueDurationMinutes,
      dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
      calendarColor: task.calendarColor,
      recurrenceRule: task.recurrenceRule,
      recurrenceAnchor: task.recurrenceAnchor
        ? task.recurrenceAnchor.toISOString()
        : null,
      ...(spawnedTask ? { spawnedTask } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update task";
    console.error("Failed to update task for mobile API:", error);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  try {
    await deleteTask(taskId);
    return jsonWithCors({ id: taskId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete task";
    console.error("Failed to delete task for mobile API:", error);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
