import { ZipArchive, type Archiver } from "archiver";
import { createWriteStream, existsSync } from "fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { PassThrough, Readable } from "stream";
import { finished } from "stream/promises";
import { strFromU8, unzipSync } from "fflate";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function createZipArchive(options?: { zlib?: { level?: number } }): Archiver {
  return new ZipArchive(options);
}

export const APP_BACKUP_FORMAT_VERSION = 2;
export const APP_BACKUP_MANIFEST_NAME = "manifest.json";
export const APP_BACKUP_DATABASE_NAME = "database.json";
export const APP_BACKUP_UPLOADS_PREFIX = "uploads/";

/** Guard against decompression bombs in uploaded backup zips. */
const MAX_BACKUP_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1 GB

const UPLOAD_TASKS_DIR = path.join(process.cwd(), "uploads", "tasks");
const UPLOAD_AUDIO_DIR = path.join(process.cwd(), "uploads", "task-audio");

export type AppBackupManifest = {
  formatVersion: number;
  exportedAt: string;
  app: "todolistWeb";
  /** The account this backup belongs to; restore only ever targets this same user. */
  ownerUserId: string;
};

export type AppBackupDatabase = {
  listFolders: Awaited<ReturnType<typeof prisma.listFolder.findMany>>;
  todoLists: Awaited<ReturnType<typeof prisma.todoList.findMany>>;
  kanbanColumns: Awaited<ReturnType<typeof prisma.kanbanColumn.findMany>>;
  tasks: Awaited<ReturnType<typeof prisma.task.findMany>>;
  taskVersions: Awaited<ReturnType<typeof prisma.taskVersion.findMany>>;
  tags: Awaited<ReturnType<typeof prisma.tag.findMany>>;
  taskTags: Awaited<ReturnType<typeof prisma.taskTag.findMany>>;
  appSettings: Awaited<ReturnType<typeof prisma.appSetting.findMany>>;
  sidebarTemplateSettings: Awaited<
    ReturnType<typeof prisma.sidebarTemplateSetting.findMany>
  >;
  taskListTemplateSettings: Awaited<
    ReturnType<typeof prisma.taskListTemplateSetting.findMany>
  >;
  calendarTaskTemplateSettings: Awaited<
    ReturnType<typeof prisma.calendarTaskTemplateSetting.findMany>
  >;
  tooltipTemplateSettings: Awaited<
    ReturnType<typeof prisma.tooltipTemplateSetting.findMany>
  >;
  templateStyles: Awaited<ReturnType<typeof prisma.templateStyle.findMany>>;
};

/** Loads only the data owned by `userId` — backups never span users. */
export async function loadAppBackupDatabase(
  userId: string,
): Promise<AppBackupDatabase> {
  const [
    listFolders,
    todoLists,
    kanbanColumns,
    tasks,
    taskVersions,
    tags,
    taskTags,
    appSettings,
    sidebarTemplateSettings,
    taskListTemplateSettings,
    calendarTaskTemplateSettings,
    tooltipTemplateSettings,
    templateStyles,
  ] = await Promise.all([
    prisma.listFolder.findMany({ where: { userId } }),
    prisma.todoList.findMany({ where: { userId } }),
    prisma.kanbanColumn.findMany({ where: { list: { userId } } }),
    prisma.task.findMany({ where: { userId } }),
    prisma.taskVersion.findMany({ where: { task: { userId } } }),
    prisma.tag.findMany({ where: { userId } }),
    prisma.taskTag.findMany({ where: { task: { userId } } }),
    prisma.appSetting.findMany({ where: { userId } }),
    prisma.sidebarTemplateSetting.findMany({ where: { userId } }),
    prisma.taskListTemplateSetting.findMany({ where: { userId } }),
    prisma.calendarTaskTemplateSetting.findMany({ where: { userId } }),
    prisma.tooltipTemplateSetting.findMany({ where: { userId } }),
    prisma.templateStyle.findMany({ where: { userId } }),
  ]);

  return {
    listFolders,
    todoLists,
    kanbanColumns,
    tasks,
    taskVersions,
    tags,
    taskTags,
    appSettings,
    sidebarTemplateSettings,
    taskListTemplateSettings,
    calendarTaskTemplateSettings,
    tooltipTemplateSettings,
    templateStyles,
  };
}

async function collectUploadFiles(
  baseDir: string,
  zipPrefix: string,
  allowedDirNames?: Set<string>,
) {
  const entries: { archivePath: string; absolutePath: string }[] = [];

  if (!existsSync(baseDir)) return entries;

  const topLevelNames = await readdir(baseDir);
  for (const name of topLevelNames) {
    if (allowedDirNames && !allowedDirNames.has(name)) continue;

    const absoluteTop = path.join(baseDir, name);
    const info = await stat(absoluteTop);
    if (!info.isDirectory()) continue;

    async function walk(relativeDir: string) {
      const absoluteDir = path.join(baseDir, relativeDir);
      const names = await readdir(absoluteDir);
      for (const entryName of names) {
        const rel = path.join(relativeDir, entryName);
        const absolutePath = path.join(baseDir, rel);
        const entryInfo = await stat(absolutePath);
        if (entryInfo.isDirectory()) {
          await walk(rel);
          continue;
        }
        entries.push({
          archivePath: `${zipPrefix}${rel.split(path.sep).join("/")}`,
          absolutePath,
        });
      }
    }

    await walk(name);
  }

  return entries;
}

async function getOwnedTaskIds(userId: string) {
  const tasks = await prisma.task.findMany({
    where: { userId },
    select: { id: true },
  });
  return new Set(tasks.map((task) => task.id));
}

async function populateBackupArchive(archive: Archiver, userId: string) {
  const manifest: AppBackupManifest = {
    formatVersion: APP_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: "todolistWeb",
    ownerUserId: userId,
  };
  const database = await loadAppBackupDatabase(userId);
  const ownedTaskIds = new Set(database.tasks.map((task) => task.id));

  archive.append(JSON.stringify(manifest, null, 2), {
    name: APP_BACKUP_MANIFEST_NAME,
  });
  archive.append(JSON.stringify(database, null, 2), {
    name: APP_BACKUP_DATABASE_NAME,
  });

  const uploadEntries = [
    ...(await collectUploadFiles(
      UPLOAD_TASKS_DIR,
      `${APP_BACKUP_UPLOADS_PREFIX}tasks/`,
      ownedTaskIds,
    )),
    ...(await collectUploadFiles(
      UPLOAD_AUDIO_DIR,
      `${APP_BACKUP_UPLOADS_PREFIX}task-audio/`,
      ownedTaskIds,
    )),
  ];

  for (const entry of uploadEntries) {
    archive.file(entry.absolutePath, { name: entry.archivePath });
  }
}

export function createBackupZipStream(userId: string) {
  const archive = createZipArchive({ zlib: { level: 6 } });
  const output = new PassThrough();
  archive.pipe(output);

  void (async () => {
    try {
      await populateBackupArchive(archive, userId);
      await archive.finalize();
    } catch (error) {
      archive.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return Readable.toWeb(output) as ReadableStream<Uint8Array>;
}

/** Fully buffered zip for HTTP download (errors surface before the response is sent). */
export async function createBackupZipBuffer(userId: string): Promise<Buffer> {
  const archive = createZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    archive.on("end", () => resolve());
    archive.on("error", reject);

    void (async () => {
      try {
        await populateBackupArchive(archive, userId);
        await archive.finalize();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  });

  return Buffer.concat(chunks);
}

export function getBackupDownloadFilename(exportedAt = new Date()) {
  const stamp = exportedAt.toISOString().slice(0, 10);
  return `todolist-backup-${stamp}.zip`;
}

const BACKUP_DATE_FIELD_NAMES = new Set([
  "createdAt",
  "updatedAt",
  "dueDate",
  "recurrenceAnchor",
  "deletedAt",
]);

function isIsoDateTimeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function parseBackupDatabaseJson(text: string): AppBackupDatabase {
  const raw = JSON.parse(text, (key, value) => {
    if (
      typeof value === "string" &&
      BACKUP_DATE_FIELD_NAMES.has(key) &&
      isIsoDateTimeString(value)
    ) {
      return new Date(value);
    }
    return value;
  });

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid backup: database.json is missing or malformed");
  }

  const record = raw as Record<string, unknown>;
  const requiredKeys: (keyof AppBackupDatabase)[] = [
    "listFolders",
    "todoLists",
    "kanbanColumns",
    "tasks",
    "taskVersions",
    "tags",
    "taskTags",
    "appSettings",
    "sidebarTemplateSettings",
    "taskListTemplateSettings",
    "calendarTaskTemplateSettings",
    "tooltipTemplateSettings",
    "templateStyles",
  ];

  for (const key of requiredKeys) {
    if (!Array.isArray(record[key])) {
      throw new Error(`Invalid backup: database.json missing array "${key}"`);
    }
  }

  return raw as AppBackupDatabase;
}

/** Strips any `userId`/`id` collisions and reassigns every row to `userId`. */
function reownRows<T extends Record<string, unknown>>(
  rows: T[],
  userId: string,
): T[] {
  return rows.map((row) =>
    "userId" in row ? { ...row, userId } : row,
  );
}

/**
 * Replaces `userId`'s own data with the payload's data. Only ever touches
 * rows this user owns — other users' rows are never read, deleted, or
 * written. Every restored row is force-reassigned to `userId` regardless of
 * what the backup file claims, so a crafted backup cannot plant data under
 * someone else's account.
 */
async function restoreDatabasePayloadForUser(
  payload: AppBackupDatabase,
  userId: string,
) {
  await prisma.$transaction(async (tx) => {
    // Delete this user's existing rows in FK-safe (children-first) order.
    await tx.taskTag.deleteMany({ where: { task: { userId } } });
    await tx.taskVersion.deleteMany({ where: { task: { userId } } });
    await tx.task.deleteMany({ where: { userId } });
    await tx.kanbanColumn.deleteMany({ where: { list: { userId } } });
    await tx.todoList.deleteMany({ where: { userId } });
    await tx.listFolder.deleteMany({ where: { userId } });
    await tx.tag.deleteMany({ where: { userId } });
    await tx.appSetting.deleteMany({ where: { userId } });
    await tx.sidebarTemplateSetting.deleteMany({ where: { userId } });
    await tx.taskListTemplateSetting.deleteMany({ where: { userId } });
    await tx.calendarTaskTemplateSetting.deleteMany({ where: { userId } });
    await tx.tooltipTemplateSetting.deleteMany({ where: { userId } });
    await tx.templateStyle.deleteMany({ where: { userId } });

    // Recreate in FK-safe (parents-first) order, reassigned to this user.
    const listFolders = reownRows(payload.listFolders, userId);
    if (listFolders.length > 0) {
      await tx.listFolder.createMany({ data: listFolders });
    }

    const todoLists = reownRows(payload.todoLists, userId);
    if (todoLists.length > 0) {
      await tx.todoList.createMany({ data: todoLists });
    }

    if (payload.kanbanColumns.length > 0) {
      await tx.kanbanColumn.createMany({ data: payload.kanbanColumns });
    }

    const tags = reownRows(payload.tags, userId);
    if (tags.length > 0) {
      await tx.tag.createMany({ data: tags });
    }

    const tasks = reownRows(payload.tasks, userId);
    if (tasks.length > 0) {
      await tx.task.createMany({
        data: tasks as Prisma.TaskCreateManyInput[],
      });
    }

    if (payload.taskTags.length > 0) {
      await tx.taskTag.createMany({ data: payload.taskTags });
    }

    if (payload.taskVersions.length > 0) {
      await tx.taskVersion.createMany({
        data: payload.taskVersions as Prisma.TaskVersionCreateManyInput[],
      });
    }

    const appSettings = reownRows(payload.appSettings, userId);
    if (appSettings.length > 0) {
      await tx.appSetting.createMany({ data: appSettings });
    }

    const sidebarTemplateSettings = reownRows(
      payload.sidebarTemplateSettings,
      userId,
    );
    if (sidebarTemplateSettings.length > 0) {
      await tx.sidebarTemplateSetting.createMany({
        data: sidebarTemplateSettings,
      });
    }

    const taskListTemplateSettings = reownRows(
      payload.taskListTemplateSettings,
      userId,
    );
    if (taskListTemplateSettings.length > 0) {
      await tx.taskListTemplateSetting.createMany({
        data: taskListTemplateSettings,
      });
    }

    const calendarTaskTemplateSettings = reownRows(
      payload.calendarTaskTemplateSettings,
      userId,
    );
    if (calendarTaskTemplateSettings.length > 0) {
      await tx.calendarTaskTemplateSetting.createMany({
        data: calendarTaskTemplateSettings,
      });
    }

    const tooltipTemplateSettings = reownRows(
      payload.tooltipTemplateSettings,
      userId,
    );
    if (tooltipTemplateSettings.length > 0) {
      await tx.tooltipTemplateSetting.createMany({
        data: tooltipTemplateSettings,
      });
    }

    const templateStyles = reownRows(payload.templateStyles, userId);
    if (templateStyles.length > 0) {
      await tx.templateStyle.createMany({
        data: templateStyles as Prisma.TemplateStyleCreateManyInput[],
      });
    }
  });
}

function assertSafeBackupEntryPath(entryPath: string) {
  const normalized = entryPath.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    !normalized.startsWith(APP_BACKUP_UPLOADS_PREFIX)
  ) {
    throw new Error(`Invalid backup file path: ${entryPath}`);
  }
  return normalized;
}

function normalizeZipEntryPath(entryPath: string) {
  return entryPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function unzipBackupBuffer(buffer: Buffer) {
  const entries = unzipSync(new Uint8Array(buffer));

  let totalBytes = 0;
  for (const data of Object.values(entries)) {
    totalBytes += data.byteLength;
    if (totalBytes > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      throw new Error("Backup archive is too large once decompressed");
    }
  }

  return entries;
}

function findZipEntry(
  entries: Record<string, Uint8Array>,
  targetName: string,
) {
  const normalizedTarget = normalizeZipEntryPath(targetName);
  const entryKey = Object.keys(entries).find(
    (key) => normalizeZipEntryPath(key) === normalizedTarget,
  );
  return entryKey ? entries[entryKey] : null;
}

/**
 * Replaces this user's own uploaded files only. Other users' files under
 * `uploads/tasks/<taskId>/` and `uploads/task-audio/<taskId>/` are left
 * untouched since this never deletes/writes outside `ownedTaskIds`.
 */
async function replaceOwnedUploadsFromZipEntries(
  entries: Record<string, Uint8Array>,
  ownedTaskIds: Set<string>,
) {
  for (const taskId of ownedTaskIds) {
    await rm(path.join(UPLOAD_TASKS_DIR, taskId), { recursive: true, force: true });
    await rm(path.join(UPLOAD_AUDIO_DIR, taskId), { recursive: true, force: true });
  }

  for (const [entryPath, data] of Object.entries(entries)) {
    const normalized = normalizeZipEntryPath(entryPath);
    if (!normalized || normalized.endsWith("/")) continue;
    if (!normalized.startsWith(APP_BACKUP_UPLOADS_PREFIX)) continue;

    const safePath = assertSafeBackupEntryPath(normalized);
    const relative = safePath.slice(APP_BACKUP_UPLOADS_PREFIX.length);
    const [, taskId] = relative.split("/");

    // Only restore files under this user's own task ids.
    if (!taskId || !ownedTaskIds.has(taskId)) continue;

    const targetPath = path.join(
      process.cwd(),
      APP_BACKUP_UPLOADS_PREFIX,
      relative,
    );
    const targetDir = path.dirname(targetPath);
    await mkdir(targetDir, { recursive: true });
    await writeFile(targetPath, Buffer.from(data));
  }
}

export async function restoreAppBackupFromZipBuffer(
  buffer: Buffer,
  userId: string,
) {
  const entries = unzipBackupBuffer(buffer);

  const manifestBytes = findZipEntry(entries, APP_BACKUP_MANIFEST_NAME);
  const databaseBytes = findZipEntry(entries, APP_BACKUP_DATABASE_NAME);

  if (!manifestBytes || !databaseBytes) {
    throw new Error(
      "Invalid backup: expected manifest.json and database.json",
    );
  }

  const manifest = JSON.parse(strFromU8(manifestBytes)) as AppBackupManifest;

  if (manifest.formatVersion !== APP_BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Unsupported backup format version: ${manifest.formatVersion}`,
    );
  }

  if (manifest.app !== "todolistWeb") {
    throw new Error("Invalid backup: unexpected app identifier");
  }

  const database = parseBackupDatabaseJson(strFromU8(databaseBytes));

  await restoreDatabasePayloadForUser(database, userId);
  const ownedTaskIds = await getOwnedTaskIds(userId);
  await replaceOwnedUploadsFromZipEntries(entries, ownedTaskIds);
}

/** Write backup zip to disk (used by scripts/tests). */
export async function writeBackupZipToFile(outputPath: string, userId: string) {
  const archive = createZipArchive({ zlib: { level: 6 } });
  const stream = createWriteStream(outputPath);
  archive.pipe(stream);

  await populateBackupArchive(archive, userId);
  await archive.finalize();
  await finished(stream);
}

export async function readBackupZipFile(filePath: string, userId: string) {
  const buffer = await readFile(filePath);
  await restoreAppBackupFromZipBuffer(buffer, userId);
}
