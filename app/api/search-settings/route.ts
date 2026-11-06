import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getLastSearchQuery,
  setLastSearchQuery,
} from "@/lib/search-settings";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export async function GET() {
  try {
    const { id: userId } = await requireUser();
    const query = await getLastSearchQuery(userId);
    return jsonWithCors({ query });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to load last search query:", error);
    return jsonWithCors(
      { error: "Failed to load last search query" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { query?: unknown }).query !== "string"
  ) {
    return jsonWithCors({ error: "Invalid query payload" }, { status: 400 });
  }

  const { query } = body as { query: string };

  try {
    const { id: userId } = await requireUser();
    await setLastSearchQuery(userId, query);
    return jsonWithCors({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to save last search query:", error);
    return jsonWithCors(
      { error: "Failed to save last search query" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
