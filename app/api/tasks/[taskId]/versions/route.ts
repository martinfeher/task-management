import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  createManualTaskVersion,
  fetchTaskVersions,
} from "@/lib/task-version-persistence";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const versions = await fetchTaskVersions(taskId);
    return jsonWithCors({ versions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load task versions";
    const status = message === "Task not found" ? 404 : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const result = await createManualTaskVersion(taskId);
    const versions = await fetchTaskVersions(taskId);
    return jsonWithCors({ ...result, versions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save task version";
    const status = message === "Task not found" ? 404 : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
