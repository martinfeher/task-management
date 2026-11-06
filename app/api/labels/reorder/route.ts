import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { reorderLabels } from "@/app/actions/todo";
import { UnauthorizedError } from "@/lib/require-user";

export async function PUT(request: Request) {
  let body: { labelIds?: string[] };
  try {
    body = (await request.json()) as { labelIds?: string[] };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.labelIds) || body.labelIds.length === 0) {
    return jsonWithCors({ error: "labelIds is required" }, { status: 400 });
  }

  try {
    await reorderLabels(body.labelIds);
    return jsonWithCors({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to reorder labels";
    return jsonWithCors({ error: message }, { status: 400 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
