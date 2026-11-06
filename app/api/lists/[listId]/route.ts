import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  deleteTodoList,
  renameTodoList,
} from "@/app/actions/todo";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

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

  let userId: string;
  try {
    ({ id: userId } = await requireUser());
  } catch {
    return jsonWithCors({ error: "Not signed in" }, { status: 401 });
  }

  const existing = await prisma.todoList.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    const list = await renameTodoList(listId, name);
    return jsonWithCors({ id: list.id, name: list.name });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to rename list";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { listId } = await context.params;

  let userId: string;
  try {
    ({ id: userId } = await requireUser());
  } catch {
    return jsonWithCors({ error: "Not signed in" }, { status: 401 });
  }

  const existing = await prisma.todoList.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    await deleteTodoList(listId);
    return jsonWithCors({ id: listId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to delete list";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
