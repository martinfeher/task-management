import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  createManualTaskVersion,
  fetchTaskVersions,
} from "@/lib/task-version-persistence";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const { id: userId } = await requireUser();
    const versions = await fetchTaskVersions(taskId, userId);
    return jsonWithCors({ versions });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to load task versions";
    const status = message === "Task not found" ? 404 : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  try {
    const { id: userId } = await requireUser();
    const result = await createManualTaskVersion(taskId, userId);
    const versions = await fetchTaskVersions(taskId, userId);
    return jsonWithCors({ ...result, versions });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to save task version";
    const status = message === "Task not found" ? 404 : 500;
    return jsonWithCors({ error: message }, { status });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
