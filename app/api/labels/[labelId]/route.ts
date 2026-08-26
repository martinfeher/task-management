import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { LABEL_CATEGORY } from "@/lib/task-tags";
import { deleteLabel, renameLabel, updateLabelColor } from "@/app/actions/todo";

type RouteContext = {
  params: Promise<{ labelId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { labelId } = await context.params;

  let body: { label?: string; color?: string };
  try {
    body = (await request.json()) as { label?: string; color?: string };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = body.label?.trim();
  const color = body.color?.trim();

  if (!label && !color) {
    return jsonWithCors({ error: "label or color is required" }, { status: 400 });
  }

  const existing = await prisma.tag.findFirst({
    where: { id: labelId, category: LABEL_CATEGORY },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Label not found" }, { status: 404 });
  }

  try {
    if (label) {
      const updated = await renameLabel(labelId, label);
      if (!color) {
        return jsonWithCors({ id: updated.id, label: updated.label });
      }
    }

    if (color) {
      const updated = await updateLabelColor(labelId, color);
      return jsonWithCors({
        id: updated.id,
        label: updated.label,
        color: updated.color,
      });
    }

    const existingLabel = await prisma.tag.findFirst({
      where: { id: labelId, category: LABEL_CATEGORY },
      select: { id: true, label: true, color: true },
    });

    return jsonWithCors({
      id: existingLabel!.id,
      label: existingLabel!.label,
      color: existingLabel!.color,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename label";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { labelId } = await context.params;

  const existing = await prisma.tag.findFirst({
    where: { id: labelId, category: LABEL_CATEGORY },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Label not found" }, { status: 404 });
  }

  try {
    await deleteLabel(labelId);
    return jsonWithCors({ id: labelId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete label";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
