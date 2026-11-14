import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { requireUser, UnauthorizedError } from "@/lib/require-user";
import { loadSyncTasks } from "@/lib/sync-apply";

/**
 * Tasks changed since `since` (ISO time), including deleted ones as
 * tombstones. Without `since`, returns every live task for the first sync.
 */
export async function GET(request: Request) {
  const sinceParam = new URL(request.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  if (since && Number.isNaN(since.getTime())) {
    return jsonWithCors({ error: "since must be an ISO date" }, { status: 400 });
  }

  try {
    const { id: userId } = await requireUser();
    // Captured before the query so nothing committed during it is skipped next time.
    const serverNow = new Date();
    const tasks = await loadSyncTasks(
      since ? { userId, updatedAt: { gt: since } } : { userId, deletedAt: null },
    );
    return jsonWithCors({ serverNow: serverNow.toISOString(), tasks });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to load sync changes:", error);
    return jsonWithCors({ error: "Failed to load changes" }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
