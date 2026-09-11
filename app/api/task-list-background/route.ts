import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getTaskListBackgroundSettings,
  setTaskListBackgroundSettings,
} from "@/lib/task-list-background-settings";
import { parseTaskListBackgroundSettings } from "@/lib/task-list-background-types";

export async function GET() {
  try {
    const settings = await getTaskListBackgroundSettings();
    return jsonWithCors(settings);
  } catch (error) {
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
    const settings = await setTaskListBackgroundSettings(parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
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
