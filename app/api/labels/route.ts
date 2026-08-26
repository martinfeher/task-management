import { prisma } from "@/lib/prisma";
import { LABEL_CATEGORY } from "@/lib/task-tags";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { createLabel } from "@/app/actions/todo";

export async function GET() {
  const labels = await prisma.tag.findMany({
    where: { category: LABEL_CATEGORY },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, color: true },
  });

  return jsonWithCors({ labels });
}

export async function POST(request: Request) {
  let body: { label?: string };
  try {
    body = (await request.json()) as { label?: string };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = body.label?.trim() ?? "";
  if (!label) {
    return jsonWithCors({ error: "label is required" }, { status: 400 });
  }

  try {
    const created = await createLabel(label);
    return jsonWithCors(
      { id: created.id, label: created.label },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create label";
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
