import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getTaskListBackgroundSettings,
  setTaskListBackgroundSettings,
} from "@/lib/task-list-background-settings";
import { parseTaskListBackgroundSettings } from "@/lib/task-list-background-types";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const settings = await getTaskListBackgroundSettings(userId);
    return jsonWithCors(settings);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to load task list background settings:", error);
    return jsonWithCors(
      { error: "Failed to load task list background settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTaskListBackgroundSettings(body);
  if (!parsed) {
    return jsonWithCors(
      { error: "Invalid task list background settings payload" },
      { status: 400 },
    );
  }

  try {
    const { id: userId } = await requireUser();
    const settings = await setTaskListBackgroundSettings(userId, parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to save task list background settings:", error);
    return jsonWithCors(
      { error: "Failed to save task list background settings" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
