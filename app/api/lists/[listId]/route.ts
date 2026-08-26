import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  deleteTodoList,
  renameTodoList,
} from "@/app/actions/todo";

type RouteContext = {
  params: Promise<{ listId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { listId } = await context.params;

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return jsonWithCors({ error: "name is required" }, { status: 400 });
  }

  const existing = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    const list = await renameTodoList(listId, name);
    return jsonWithCors({ id: list.id, name: list.name });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename list";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { listId } = await context.params;

  const existing = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    await deleteTodoList(listId);
    return jsonWithCors({ id: listId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete list";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
