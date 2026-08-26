import { revalidatePath } from "next/cache";
import { getTasksApiData, type TasksQuery } from "@/lib/mobile-api-data";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { prisma } from "@/lib/prisma";
import {
  createSubtask,
  createTask,
  updateTaskPriority,
  updateTaskRecurrence,
} from "@/app/actions/todo";
import { LABEL_CATEGORY, getPriorityFromTaskTags } from "@/lib/task-tags";
import { normalizeDueTimeZone } from "@/lib/task-due-time";
import type { TaskRecurrenceRule } from "@/lib/task-recurrence";

function parseTasksQuery(searchParams: URLSearchParams): TasksQuery | null {
  const view = searchParams.get("view");
  const listId = searchParams.get("listId");
  const labelId = searchParams.get("labelId");

  if (listId) {
    return { view: "list", listId };
  }

  if (view === "today") {
    return { view: "today" };
  }

  if (view === "important") {
    return { view: "important" };
  }

  if (view === "calendar") {
    return { view: "calendar" };
  }

  if (view === "label" && labelId) {
    return { view: "label", labelId };
  }

  return null;
}

export async function GET(request: Request) {
  const query = parseTasksQuery(new URL(request.url).searchParams);

  if (!query) {
    return jsonWithCors(
      { error: "Provide listId or view query parameter" },
      { status: 400 },
    );
  }

  try {
    const data = await getTasksApiData(query);
    return jsonWithCors(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tasks";
    const status = message.endsWith("not found") ? 404 : 500;
    console.error("Failed to load tasks for mobile API:", error);
    return jsonWithCors({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  let body: {
    name?: string;
    listId?: string;
    dueDate?: string | null;
    details?: string;
    priority?: number | null;
    labelIds?: string[];
    parentId?: string | null;
    recurrenceRule?: TaskRecurrenceRule | null;
  };
  try {
    body = (await request.json()) as {
      name?: string;
      listId?: string;
      dueDate?: string | null;
      details?: string;
      priority?: number | null;
      labelIds?: string[];
      parentId?: string | null;
      recurrenceRule?: TaskRecurrenceRule | null;
    };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const listId = body.listId?.trim() ?? "";
  const dueDate = body.dueDate?.trim() || null;
  const details = typeof body.details === "string" ? body.details : "";
  const parentId = body.parentId?.trim() || null;
  const labelIds = Array.isArray(body.labelIds)
    ? body.labelIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!name) {
    return jsonWithCors({ error: "name is required" }, { status: 400 });
  }

  if (parentId) {
    try {
      const subtask = await createSubtask(parentId, name);
      if (details) {
        await prisma.task.update({
          where: { id: subtask.id },
          data: { details },
        });
      }
      if (body.priority !== undefined) {
        await updateTaskPriority(subtask.id, body.priority ?? null);
      }
      if (labelIds.length > 0) {
        await prisma.taskTag.createMany({
          data: labelIds.map((tagId) => ({
            taskId: subtask.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
      const labels = await prisma.taskTag.findMany({
        where: {
          taskId: subtask.id,
          tag: { category: LABEL_CATEGORY },
        },
        include: { tag: { select: { id: true, label: true } } },
      });
      const list = await prisma.todoList.findUnique({
        where: { id: subtask.listId },
        select: { id: true, name: true },
      });
      revalidatePath("/");
      return jsonWithCors(
        {
          id: subtask.id,
          name: subtask.name,
          completed: false,
          dueDate: null,
          pinned: false,
          important: false,
          priority: body.priority ?? null,
          parentId: subtask.parentId,
          depth: 1,
          labels: labels.map((entry) => ({
            id: entry.tag.id,
            label: entry.tag.label,
          })),
          listId: list?.id ?? subtask.listId,
          listName: list?.name ?? "",
        },
        { status: 201 },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create subtask";
      return jsonWithCors({ error: message }, { status: 400 });
    }
  }

  if (!listId) {
    return jsonWithCors({ error: "listId is required" }, { status: 400 });
  }

  const list = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { id: true, name: true },
  });

  if (!list) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    const task = await createTask(listId, name, dueDate);

    if (details) {
      await prisma.task.update({
        where: { id: task.id },
        data: { details },
      });
    }

    if (body.priority !== undefined) {
      await updateTaskPriority(task.id, body.priority ?? null);
    }

    if (body.recurrenceRule !== undefined) {
      await updateTaskRecurrence(task.id, body.recurrenceRule);
    }

    if (labelIds.length > 0) {
      await prisma.taskTag.createMany({
        data: labelIds.map((tagId) => ({
          taskId: task.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    const labels = await prisma.taskTag.findMany({
      where: {
        taskId: task.id,
        tag: { category: LABEL_CATEGORY },
      },
      include: { tag: { select: { id: true, label: true } } },
    });

    const tags = await prisma.taskTag.findMany({
      where: { taskId: task.id },
      include: {
        tag: { select: { category: true, level: true } },
      },
    });

    const taskRecord = await prisma.task.findUnique({
      where: { id: task.id },
      select: {
        id: true,
        name: true,
        completed: true,
        dueDate: true,
        dueTimeMinutes: true,
        dueDurationMinutes: true,
        dueTimeZone: true,
        calendarColor: true,
        recurrenceRule: true,
        pinned: true,
        important: true,
        parentId: true,
      },
    });

    if (!taskRecord) {
      return jsonWithCors({ error: "Task not found" }, { status: 404 });
    }

    revalidatePath("/");

    return jsonWithCors(
      {
        id: taskRecord.id,
        name: taskRecord.name,
        completed: taskRecord.completed,
        dueDate: taskRecord.dueDate ? taskRecord.dueDate.toISOString() : null,
        dueTimeMinutes: taskRecord.dueTimeMinutes,
        dueDurationMinutes: taskRecord.dueDurationMinutes,
        dueTimeZone: normalizeDueTimeZone(taskRecord.dueTimeZone),
        calendarColor: taskRecord.calendarColor,
        recurrenceRule: taskRecord.recurrenceRule,
        pinned: taskRecord.pinned,
        important: taskRecord.important,
        priority: getPriorityFromTaskTags(tags),
        parentId: taskRecord.parentId,
        depth: 0,
        labels: labels.map((entry) => ({
          id: entry.tag.id,
          label: entry.tag.label,
        })),
        listId: list.id,
        listName: list.name,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task";
    console.error("Failed to create task for mobile API:", error);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
