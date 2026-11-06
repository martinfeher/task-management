import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

/**
 * Permanently deletes the signed-in user's account.
 *
 * All owned rows (lists, tasks, labels, template settings, sessions, …)
 * carry `onDelete: Cascade` foreign keys in `prisma/schema.prisma`, so a
 * single `user.delete` lets Postgres cascade the rest — no manual cleanup
 * needed here.
 */
export async function DELETE() {
  try {
    const { id: userId } = await requireUser();
    await prisma.user.delete({ where: { id: userId } });
    return jsonWithCors({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonWithCors({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Failed to delete account:", error);
    return jsonWithCors({ error: "Failed to delete account" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
