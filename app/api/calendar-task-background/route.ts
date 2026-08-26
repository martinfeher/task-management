import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getCalendarTaskBackgroundSettings,
  setCalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-settings";
import { parseCalendarTaskBackgroundSettings } from "@/lib/calendar-task-background-types";

export async function GET() {
  try {
    const settings = await getCalendarTaskBackgroundSettings();
    return jsonWithCors(settings);
  } catch (error) {
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
    const settings = await setCalendarTaskBackgroundSettings(parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
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
