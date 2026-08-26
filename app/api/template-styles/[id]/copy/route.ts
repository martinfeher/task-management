import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { copyTemplateStyle } from "@/lib/template-style-settings";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const name =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { name?: unknown }).name === "string"
      ? (body as { name: string }).name
      : undefined;

  try {
    const style = await copyTemplateStyle(id, name);
    return jsonWithCors({ ok: true, style }, { status: 201 });
  } catch (error) {
    console.error("Failed to copy template style:", error);
    return jsonWithCors({ error: "Failed to copy template style" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
