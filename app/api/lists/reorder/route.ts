import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  reorderSidebarTopLevel,
  reorderTodoLists,
} from "@/app/actions/todo";

type ReorderBody = {
  listIds?: string[];
  listPositions?: Array<{ id: string; position: number }>;
  folderPositions?: Array<{ id: string; position: number }>;
};

export async function PUT(request: Request) {
  let body: ReorderBody;
  try {
    body = (await request.json()) as ReorderBody;
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    Array.isArray(body.listPositions) ||
    Array.isArray(body.folderPositions)
  ) {
    const listPositions = body.listPositions ?? [];
    const folderPositions = body.folderPositions ?? [];

    if (
      !Array.isArray(listPositions) ||
      !Array.isArray(folderPositions) ||
      listPositions.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          typeof item.position !== "number",
      ) ||
      folderPositions.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          typeof item.position !== "number",
      )
    ) {
      return jsonWithCors(
        { error: "listPositions and folderPositions must be position arrays" },
        { status: 400 },
      );
    }

    try {
      await reorderSidebarTopLevel(listPositions, folderPositions);
      return jsonWithCors({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reorder sidebar";
      return jsonWithCors({ error: message }, { status: 400 });
    }
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
