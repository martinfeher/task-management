import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  deleteListFolder,
  renameListFolder,
} from "@/app/actions/todo";

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

  const existing = await prisma.listFolder.findUnique({
    where: { id: folderId },
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
    const message =
      error instanceof Error ? error.message : "Failed to rename folder";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  const existing = await prisma.listFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Folder not found" }, { status: 404 });
  }

  try {
    await deleteListFolder(folderId);
    return jsonWithCors({ id: folderId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete folder";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
