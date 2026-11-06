import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getPanelTextColorsSettings,
  setPanelTextColorsSettings,
} from "@/lib/panel-text-shade-server";
import { parsePanelTextColorsSettings } from "@/lib/panel-text-shade-types";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const settings = await getPanelTextColorsSettings(userId);
    return jsonWithCors(settings);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to load panel text color settings:", error);
    return jsonWithCors(
      { error: "Failed to load panel text color settings" },
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

  const parsed = parsePanelTextColorsSettings(body);
  if (!parsed) {
    return jsonWithCors(
      { error: "Invalid panel text color settings payload" },
      { status: 400 },
    );
  }

  try {
    const { id: userId } = await requireUser();
    const settings = await setPanelTextColorsSettings(userId, parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to save panel text color settings:", error);
    return jsonWithCors(
      { error: "Failed to save panel text color settings" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
