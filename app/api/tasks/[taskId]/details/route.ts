import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { persistTaskDetailsUpdate } from "@/lib/task-version-persistence";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { details?: unknown }).details !== "string"
  ) {
    return jsonWithCors({ error: "Invalid details payload" }, { status: 400 });
  }

  const { details } = body as { details: string };

  try {
    const result = await persistTaskDetailsUpdate(taskId, details);
    return jsonWithCors({ ok: true, skipped: !result.changed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save task details";
    const status = message === "Task not found" ? 404 : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
