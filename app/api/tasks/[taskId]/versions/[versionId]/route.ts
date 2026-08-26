import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { fetchTaskVersionById } from "@/lib/task-version-persistence";

type RouteContext = {
  params: Promise<{ taskId: string; versionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId, versionId } = await context.params;

  try {
    const version = await fetchTaskVersionById(taskId, versionId);
    if (!version) {
      return jsonWithCors({ error: "Version not found" }, { status: 404 });
    }

    return jsonWithCors(version);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load task version";
    const status = message === "Task not found" ? 404 : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
