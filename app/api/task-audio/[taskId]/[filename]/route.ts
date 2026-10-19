import { NextResponse } from "next/server";
import { API_CORS_HEADERS } from "@/lib/api-cors";
import {
  getMimeTypeForAudioFilename,
  readTaskAudioFile,
} from "@/lib/task-audio-storage";

type RouteContext = {
  params: Promise<{ taskId: string; filename: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId, filename } = await context.params;

  try {
    const buffer = await readTaskAudioFile(taskId, filename);

    return new NextResponse(buffer, {
      headers: {
        ...API_CORS_HEADERS,
        "Content-Type": getMimeTypeForAudioFilename(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Audio not found" },
      { status: 404, headers: API_CORS_HEADERS },
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}
