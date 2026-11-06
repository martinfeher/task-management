import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();

    const lists = await prisma.todoList.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        tasks: {
          where: { userId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            completed: true,
            details: true,
            dueDate: true,
            pinned: true,
            important: true,
            parentId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const tasks = lists.flatMap((list) =>
      list.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        completed: task.completed,
        details: task.details,
        hasDetails: taskDetailsHasContent(task.details),
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        pinned: task.pinned,
        important: task.important,
        parentId: task.parentId,
        listId: list.id,
        listName: list.name,
      })),
    );

    return jsonWithCors({ tasks });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to load search tasks:", error);
    return jsonWithCors({ error: "Failed to load search tasks" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
