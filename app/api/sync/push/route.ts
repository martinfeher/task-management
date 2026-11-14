import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { requireUser, UnauthorizedError } from "@/lib/require-user";
import { applySyncMutations } from "@/lib/sync-apply";

const MAX_MUTATIONS_PER_PUSH = 100;

export async function POST(request: Request) {
  let body: { mutations?: unknown };
  try {
    body = (await request.json()) as { mutations?: unknown };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.mutations)) {
    return jsonWithCors({ error: "mutations must be an array" }, { status: 400 });
  }

  if (body.mutations.length > MAX_MUTATIONS_PER_PUSH) {
    return jsonWithCors(
      { error: `At most ${MAX_MUTATIONS_PER_PUSH} mutations per push` },
      { status: 413 },
    );
  }

  try {
    const { id: userId } = await requireUser();
    const results = await applySyncMutations(userId, body.mutations);
    return jsonWithCors({ serverNow: new Date().toISOString(), results });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to apply sync push:", error);
    return jsonWithCors({ error: "Failed to apply changes" }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
