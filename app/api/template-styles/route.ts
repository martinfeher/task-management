import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  createTemplateStyle,
  listTemplateStyles,
} from "@/lib/template-style-settings";
import { parseTemplateStyleInput } from "@/lib/template-style-types";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const data = await listTemplateStyles(userId);
    return jsonWithCors(data);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to list template styles:", error);
    return jsonWithCors({ error: "Failed to list template styles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTemplateStyleInput(body);
  if (!parsed) {
    return jsonWithCors({ error: "Invalid template style payload" }, { status: 400 });
  }

  try {
    const { id: userId } = await requireUser();
    const style = await createTemplateStyle(parsed, userId);
    return jsonWithCors({ ok: true, style }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to create template style:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create template style";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
