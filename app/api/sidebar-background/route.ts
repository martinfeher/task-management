import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getSidebarBackgroundSettings,
  setSidebarBackgroundSettings,
} from "@/lib/sidebar-background-settings";
import { parseSidebarBackgroundSettings } from "@/lib/sidebar-background-types";

export async function GET() {
  try {
    const settings = await getSidebarBackgroundSettings();
    return jsonWithCors(settings);
  } catch (error) {
    console.error("Failed to load sidebar background settings:", error);
    return jsonWithCors(
      { error: "Failed to load sidebar background settings" },
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

  const parsed = parseSidebarBackgroundSettings(body);
  if (!parsed) {
    return jsonWithCors(
      { error: "Invalid sidebar background settings payload" },
      { status: 400 },
    );
  }

  try {
    const settings = await setSidebarBackgroundSettings(parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
    console.error("Failed to save sidebar background settings:", error);
    return jsonWithCors(
      { error: "Failed to save sidebar background settings" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
