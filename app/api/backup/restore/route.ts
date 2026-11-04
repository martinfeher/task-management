import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { restoreAppBackupFromZipBuffer } from "@/lib/app-backup";

export const runtime = "nodejs";

const DEFAULT_MAX_BACKUP_BYTES = 150 * 1024 * 1024;

function getMaxBackupBytes() {
  const raw = process.env.BACKUP_MAX_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_BACKUP_BYTES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_BACKUP_BYTES;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonWithCors({ error: "No backup file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return jsonWithCors(
        { error: "Backup file must be a .zip archive" },
        { status: 400 },
      );
    }

    const maxBytes = getMaxBackupBytes();
    if (file.size > maxBytes) {
      return jsonWithCors(
        {
          error: `Backup file is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`,
        },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await restoreAppBackupFromZipBuffer(buffer);

    return jsonWithCors({ ok: true });
  } catch (error) {
    console.error("Failed to restore backup:", error);
    const message =
      error instanceof Error ? error.message : "Failed to restore backup";
    return jsonWithCors({ error: message }, { status: 400 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
