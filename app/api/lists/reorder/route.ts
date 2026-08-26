import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { reorderTodoLists } from "@/app/actions/todo";

export async function PUT(request: Request) {
  let body: { listIds?: string[] };
  try {
    body = (await request.json()) as { listIds?: string[] };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.listIds)) {
    return jsonWithCors({ error: "listIds must be an array" }, { status: 400 });
  }

  try {
    await reorderTodoLists(body.listIds);
    return jsonWithCors({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder lists";
    return jsonWithCors({ error: message }, { status: 400 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
