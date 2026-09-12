import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  createTemplateStyle,
  listTemplateStyles,
} from "@/lib/template-style-settings";
import { parseTemplateStyleInput } from "@/lib/template-style-types";

export async function GET() {
  try {
    const data = await listTemplateStyles();
    return jsonWithCors(data);
  } catch (error) {
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
    const style = await createTemplateStyle(parsed);
    return jsonWithCors({ ok: true, style }, { status: 201 });
  } catch (error) {
    console.error("Failed to create template style:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create template style";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
