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

export const APP_BACKUP_FORMAT_VERSION = 1;
export const APP_BACKUP_MANIFEST_NAME = "manifest.json";
export const APP_BACKUP_DATABASE_NAME = "database.json";
export const APP_BACKUP_UPLOADS_PREFIX = "uploads/";

const UPLOAD_TASKS_DIR = path.join(process.cwd(), "uploads", "tasks");
const UPLOAD_AUDIO_DIR = path.join(process.cwd(), "uploads", "task-audio");

export type AppBackupManifest = {
  formatVersion: number;
  exportedAt: string;
  app: "todolistWeb";
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

export async function loadAppBackupDatabase(): Promise<AppBackupDatabase> {
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
    prisma.listFolder.findMany(),
    prisma.todoList.findMany(),
    prisma.kanbanColumn.findMany(),
    prisma.task.findMany(),
    prisma.taskVersion.findMany(),
    prisma.tag.findMany(),
    prisma.taskTag.findMany(),
    prisma.appSetting.findMany(),
    prisma.sidebarTemplateSetting.findMany(),
    prisma.taskListTemplateSetting.findMany(),
    prisma.calendarTaskTemplateSetting.findMany(),
    prisma.tooltipTemplateSetting.findMany(),
    prisma.templateStyle.findMany(),
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

async function collectUploadFiles(baseDir: string, zipPrefix: string) {
  const entries: { archivePath: string; absolutePath: string }[] = [];

  async function walk(relativeDir: string) {
    const absoluteDir = path.join(baseDir, relativeDir);
    if (!existsSync(absoluteDir)) return;

    const names = await readdir(absoluteDir);
    for (const name of names) {
      const rel = relativeDir ? path.join(relativeDir, name) : name;
      const absolutePath = path.join(baseDir, rel);
      const info = await stat(absolutePath);
      if (info.isDirectory()) {
        await walk(rel);
        continue;
      }
      entries.push({
        archivePath: `${zipPrefix}${rel.split(path.sep).join("/")}`,
        absolutePath,
      });
    }
  }

  await walk("");
  return entries;
}

export function createBackupZipStream() {
  const archive = createZipArchive({ zlib: { level: 6 } });
  const output = new PassThrough();
  archive.pipe(output);

  void (async () => {
    try {
      const manifest: AppBackupManifest = {
        formatVersion: APP_BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        app: "todolistWeb",
      };
      const database = await loadAppBackupDatabase();

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
        )),
        ...(await collectUploadFiles(
          UPLOAD_AUDIO_DIR,
          `${APP_BACKUP_UPLOADS_PREFIX}task-audio/`,
        )),
      ];

      for (const entry of uploadEntries) {
        archive.file(entry.absolutePath, { name: entry.archivePath });
      }

      await archive.finalize();
    } catch (error) {
      archive.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return Readable.toWeb(output) as ReadableStream<Uint8Array>;
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

async function restoreDatabasePayload(payload: AppBackupDatabase) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      TRUNCATE
        "TaskTag",
        "TaskVersion",
        "Task",
        "KanbanColumn",
        "TodoList",
        "ListFolder",
        "Tag",
        "AppSetting",
        "SidebarTemplateSetting",
        "TaskListTemplateSetting",
        "CalendarTaskTemplateSetting",
        "TooltipTemplateSetting",
        "TemplateStyle"
      RESTART IDENTITY CASCADE
    `);

    await tx.$executeRawUnsafe(`SET session_replication_role = 'replica'`);

    try {
      if (payload.listFolders.length > 0) {
        await tx.listFolder.createMany({ data: payload.listFolders });
      }

      if (payload.todoLists.length > 0) {
        await tx.todoList.createMany({ data: payload.todoLists });
      }

      if (payload.kanbanColumns.length > 0) {
        await tx.kanbanColumn.createMany({ data: payload.kanbanColumns });
      }

      if (payload.tags.length > 0) {
        await tx.tag.createMany({ data: payload.tags });
      }

      if (payload.tasks.length > 0) {
        await tx.task.createMany({
          data: payload.tasks as Prisma.TaskCreateManyInput[],
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

      if (payload.appSettings.length > 0) {
        await tx.appSetting.createMany({ data: payload.appSettings });
      }

      if (payload.sidebarTemplateSettings.length > 0) {
        await tx.sidebarTemplateSetting.createMany({
          data: payload.sidebarTemplateSettings,
        });
      }

      if (payload.taskListTemplateSettings.length > 0) {
        await tx.taskListTemplateSetting.createMany({
          data: payload.taskListTemplateSettings,
        });
      }

      if (payload.calendarTaskTemplateSettings.length > 0) {
        await tx.calendarTaskTemplateSetting.createMany({
          data: payload.calendarTaskTemplateSettings,
        });
      }

      if (payload.tooltipTemplateSettings.length > 0) {
        await tx.tooltipTemplateSetting.createMany({
          data: payload.tooltipTemplateSettings,
        });
      }

      if (payload.templateStyles.length > 0) {
        await tx.templateStyle.createMany({
          data: payload.templateStyles as Prisma.TemplateStyleCreateManyInput[],
        });
      }
    } finally {
      await tx.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
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
  return unzipSync(new Uint8Array(buffer));
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

async function replaceUploadsFromZipEntries(
  entries: Record<string, Uint8Array>,
) {
  await rm(UPLOAD_TASKS_DIR, { recursive: true, force: true });
  await rm(UPLOAD_AUDIO_DIR, { recursive: true, force: true });
  await mkdir(UPLOAD_TASKS_DIR, { recursive: true });
  await mkdir(UPLOAD_AUDIO_DIR, { recursive: true });

  for (const [entryPath, data] of Object.entries(entries)) {
    const normalized = normalizeZipEntryPath(entryPath);
    if (!normalized || normalized.endsWith("/")) continue;
    if (!normalized.startsWith(APP_BACKUP_UPLOADS_PREFIX)) continue;

    const safePath = assertSafeBackupEntryPath(normalized);
    const relative = safePath.slice(APP_BACKUP_UPLOADS_PREFIX.length);
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

export async function restoreAppBackupFromZipBuffer(buffer: Buffer) {
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

  await restoreDatabasePayload(database);
  await replaceUploadsFromZipEntries(entries);
}

/** Write backup zip to disk (used by scripts/tests). */
export async function writeBackupZipToFile(outputPath: string) {
  const archive = createZipArchive({ zlib: { level: 6 } });
  const stream = createWriteStream(outputPath);
  archive.pipe(stream);

  const manifest: AppBackupManifest = {
    formatVersion: APP_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: "todolistWeb",
  };
  const database = await loadAppBackupDatabase();

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
    )),
    ...(await collectUploadFiles(
      UPLOAD_AUDIO_DIR,
      `${APP_BACKUP_UPLOADS_PREFIX}task-audio/`,
    )),
  ];

  for (const entry of uploadEntries) {
    archive.file(entry.absolutePath, { name: entry.archivePath });
  }

  await archive.finalize();
  await finished(stream);
}

export async function readBackupZipFile(filePath: string) {
  const buffer = await readFile(filePath);
  await restoreAppBackupFromZipBuffer(buffer);
}
