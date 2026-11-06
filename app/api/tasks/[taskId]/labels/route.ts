import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LABEL_CATEGORY } from "@/lib/task-tags";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { requireUser } from "@/lib/require-user";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  let body: { labelId?: string; assigned?: boolean };
  try {
    body = (await request.json()) as { labelId?: string; assigned?: boolean };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.labelId !== "string" || typeof body.assigned !== "boolean") {
    return jsonWithCors(
      { error: "labelId and assigned are required" },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    ({ id: userId } = await requireUser());
  } catch {
    return jsonWithCors({ error: "Not signed in" }, { status: 401 });
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });

  if (!task) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  // Make sure the label being (dis)assigned also belongs to this user —
  // without this check, a user could attach another user's label id to
  // their own task (or discover its existence via create/delete side effects).
  const label = await prisma.tag.findFirst({
    where: { id: body.labelId, userId, category: LABEL_CATEGORY },
    select: { id: true },
  });

  if (!label) {
    return jsonWithCors({ error: "Label not found" }, { status: 404 });
  }

  if (body.assigned) {
    await prisma.taskTag.upsert({
      where: {
        taskId_tagId: {
          taskId,
          tagId: body.labelId,
        },
      },
      create: {
        taskId,
        tagId: body.labelId,
      },
      update: {},
    });
  } else {
    await prisma.taskTag.deleteMany({
      where: {
        taskId,
        tagId: body.labelId,
        tag: { category: LABEL_CATEGORY },
      },
    });
  }

  const labels = await prisma.taskTag.findMany({
    where: {
      taskId,
      tag: { category: LABEL_CATEGORY, userId },
    },
    include: {
      tag: {
        select: { id: true, label: true },
      },
    },
    orderBy: { tag: { label: "asc" } },
  });

  revalidatePath("/");

  return jsonWithCors({
    labels: labels.map((entry) => entry.tag),
  });
}

export function OPTIONS() {
  return optionsWithCors();
}
