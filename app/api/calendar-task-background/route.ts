import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getCalendarTaskBackgroundSettings,
  setCalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-settings";
import { parseCalendarTaskBackgroundSettings } from "@/lib/calendar-task-background-types";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const settings = await getCalendarTaskBackgroundSettings(userId);
    return jsonWithCors(settings);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to load calendar task background settings:", error);
    return jsonWithCors(
      { error: "Failed to load calendar task background settings" },
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

  const parsed = parseCalendarTaskBackgroundSettings(body);
  if (!parsed) {
    return jsonWithCors(
      { error: "Invalid calendar task background settings payload" },
      { status: 400 },
    );
  }

  try {
    const { id: userId } = await requireUser();
    const settings = await setCalendarTaskBackgroundSettings(userId, parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to save calendar task background settings:", error);
    return jsonWithCors(
      { error: "Failed to save calendar task background settings" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
