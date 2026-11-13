import { resolveCorsHeaders } from "@/lib/api-cors";
import {
  createBackupZipBuffer,
  getBackupDownloadFilename,
} from "@/lib/app-backup";
import { requireUser, UnauthorizedError } from "@/lib/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const corsHeaders = await resolveCorsHeaders();
  try {
    const { id: userId } = await requireUser();
    const filename = getBackupDownloadFilename();
    const body = await createBackupZipBuffer(userId);

    return new Response(new Uint8Array(body), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json(
        { error: "Not signed in" },
        { status: 401, headers: corsHeaders },
      );
    }
    console.error("Failed to create backup:", error);
    return Response.json(
      { error: "Failed to create backup" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: await resolveCorsHeaders(),
  });
}
