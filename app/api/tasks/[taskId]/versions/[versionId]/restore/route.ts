import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { restoreTaskVersion } from "@/lib/task-version-persistence";

type RouteContext = {
  params: Promise<{ taskId: string; versionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { taskId, versionId } = await context.params;

  try {
    const result = await restoreTaskVersion(taskId, versionId);
    return jsonWithCors({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to restore task version";
    const status =
      message === "Task not found" || message === "Version not found"
        ? 404
        : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
