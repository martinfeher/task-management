import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getTooltipSettings,
  setTooltipSettings,
} from "@/lib/tooltip-settings-server";
import { parseTooltipSettings } from "@/lib/tooltip-settings-types";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const settings = await getTooltipSettings(userId);
    return jsonWithCors(settings);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
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
    const { id: userId } = await requireUser();
    const settings = await setTooltipSettings(userId, parsed);
    return jsonWithCors({ ok: true, settings });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to save tooltip settings:", error);
    return jsonWithCors({ error: "Failed to save tooltip settings" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
