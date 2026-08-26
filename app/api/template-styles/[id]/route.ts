import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  deleteTemplateStyle,
  getTemplateStyleById,
  setActiveTemplateStyleId,
  updateTemplateStyle,
} from "@/lib/template-style-settings";
import { parseTemplateStyleInput } from "@/lib/template-style-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const style = await getTemplateStyleById(id);
    if (!style) {
      return jsonWithCors({ error: "Template style not found" }, { status: 404 });
    }

    return jsonWithCors(style);
  } catch (error) {
    console.error("Failed to load template style:", error);
    return jsonWithCors({ error: "Failed to load template style" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
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
    const style = await updateTemplateStyle(id, parsed);
    return jsonWithCors({ ok: true, style });
  } catch (error) {
    console.error("Failed to update template style:", error);
    return jsonWithCors({ error: "Failed to update template style" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await deleteTemplateStyle(id);
    return jsonWithCors({ ok: true });
  } catch (error) {
    console.error("Failed to delete template style:", error);
    return jsonWithCors({ error: "Failed to delete template style" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as { action?: string }).action !== "activate"
  ) {
    return jsonWithCors({ error: "Unsupported patch action" }, { status: 400 });
  }

  try {
    const style = await getTemplateStyleById(id);
    if (!style) {
      return jsonWithCors({ error: "Template style not found" }, { status: 404 });
    }

    await setActiveTemplateStyleId(id);
    return jsonWithCors({ ok: true, style });
  } catch (error) {
    console.error("Failed to activate template style:", error);
    return jsonWithCors({ error: "Failed to activate template style" }, { status: 500 });
  }
}
