import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  deleteListFolder,
  renameListFolder,
} from "@/app/actions/todo";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { folderId } = await context.params;

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

  const existing = await prisma.listFolder.findFirst({
    where: { id: folderId, userId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Folder not found" }, { status: 404 });
  }

  try {
    const folder = await renameListFolder(folderId, name);
    return jsonWithCors({
      id: folder.id,
      name: folder.name,
      position: folder.position,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to rename folder";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  let userId: string;
  try {
    ({ id: userId } = await requireUser());
  } catch {
    return jsonWithCors({ error: "Not signed in" }, { status: 401 });
  }

  const existing = await prisma.listFolder.findFirst({
    where: { id: folderId, userId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Folder not found" }, { status: 404 });
  }

  try {
    await deleteListFolder(folderId);
    return jsonWithCors({ id: folderId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to delete folder";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
