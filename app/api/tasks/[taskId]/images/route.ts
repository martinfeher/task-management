import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { prisma } from "@/lib/prisma";
import { saveTaskImage } from "@/lib/task-image-storage";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonWithCors({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await saveTaskImage(taskId, buffer, file.type || "image/jpeg");
    return jsonWithCors({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image upload failed";
    return jsonWithCors({ error: message }, { status: 400 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
