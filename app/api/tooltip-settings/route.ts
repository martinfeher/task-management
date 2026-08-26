import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getTooltipSettings,
  setTooltipSettings,
} from "@/lib/tooltip-settings-server";
import { parseTooltipSettings } from "@/lib/tooltip-settings-types";

export async function GET() {
  try {
    const settings = await getTooltipSettings();
    return jsonWithCors(settings);
  } catch (error) {
    console.error("Failed to load tooltip settings:", error);
    return jsonWithCors({ error: "Failed to load tooltip settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTooltipSettings(body);
  if (!parsed) {
    return jsonWithCors(
      { error: "Invalid tooltip settings payload" },
      { status: 400 },
    );
  }

  try {
    const settings = await setTooltipSettings(parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
    console.error("Failed to save tooltip settings:", error);
    return jsonWithCors({ error: "Failed to save tooltip settings" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
