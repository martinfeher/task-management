import { getSidebarApiData } from "@/lib/mobile-api-data";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { createTodoList } from "@/app/actions/todo";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const data = await getSidebarApiData(userId);
    return jsonWithCors(data);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
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
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create list";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
