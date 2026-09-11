import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getPanelTextColorsSettings,
  setPanelTextColorsSettings,
} from "@/lib/panel-text-shade-server";
import { parsePanelTextColorsSettings } from "@/lib/panel-text-shade-types";

export async function GET() {
  try {
    const settings = await getPanelTextColorsSettings();
    return jsonWithCors(settings);
  } catch (error) {
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
    const settings = await setPanelTextColorsSettings(parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
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
