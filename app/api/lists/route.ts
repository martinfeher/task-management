import { getSidebarApiData } from "@/lib/mobile-api-data";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { createTodoList } from "@/app/actions/todo";

export async function GET() {
  try {
    const data = await getSidebarApiData();
    return jsonWithCors(data);
  } catch (error) {
    console.error("Failed to load lists for mobile API:", error);
    return jsonWithCors({ error: "Failed to load lists" }, { status: 500 });
  }
}

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
    const list = await createTodoList(name);
    return jsonWithCors(
      { id: list.id, name: list.name, taskCount: 0 },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create list";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
