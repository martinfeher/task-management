import { NextResponse } from "next/server";
import { resolveCorsHeaders } from "@/lib/api-cors";
import {
  getMimeTypeForFilename,
  readTaskImageFile,
} from "@/lib/task-image-storage";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/require-user";

type RouteContext = {
  params: Promise<{ taskId: string; filename: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId, filename } = await context.params;
  const corsHeaders = await resolveCorsHeaders();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in" },
      { status: 401, headers: corsHeaders },
    );
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    select: { id: true },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  try {
    const buffer = await readTaskImageFile(taskId, filename);

    return new NextResponse(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": getMimeTypeForFilename(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: await resolveCorsHeaders(),
  });
}
