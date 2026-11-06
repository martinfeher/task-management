import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { copyTemplateStyle } from "@/lib/template-style-settings";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

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
    const { id: userId } = await requireUser();
    const style = await copyTemplateStyle(id, userId, name);
    return jsonWithCors({ ok: true, style }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to copy template style:", error);
    return jsonWithCors({ error: "Failed to copy template style" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
