import { API_CORS_HEADERS } from "@/lib/api-cors";
import {
  createBackupZipStream,
  getBackupDownloadFilename,
} from "@/lib/app-backup";

export const runtime = "nodejs";

export async function GET() {
  try {
    const filename = getBackupDownloadFilename();
    const body = createBackupZipStream();

    return new Response(body, {
      headers: {
        ...API_CORS_HEADERS,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to create backup:", error);
    return Response.json(
      { error: "Failed to create backup" },
      { status: 500, headers: API_CORS_HEADERS },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}
