import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { restoreTaskVersion } from "@/lib/task-version-persistence";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

type RouteContext = {
  params: Promise<{ taskId: string; versionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { taskId, versionId } = await context.params;

  try {
    const { id: userId } = await requireUser();
    const result = await restoreTaskVersion(taskId, versionId, userId);
    return jsonWithCors({ ok: true, ...result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
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
