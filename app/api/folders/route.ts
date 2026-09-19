import { createListFolder } from "@/app/actions/todo";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";

export async function POST(request: Request) {
  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return jsonWithCors({ error: "name is required" }, { status: 400 });
  }

  try {
    const folder = await createListFolder(name);
    return jsonWithCors(
      { id: folder.id, name: folder.name, position: folder.position },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create folder";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
