import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "node:path";

const sqliteUrl = process.env.SQLITE_DATABASE_URL ?? "file:./prisma/dev.db";
const postgresUrl = process.env.DATABASE_URL;

type TodoListRow = {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type TagRow = {
  id: string;
  slug: string;
  label: string;
  category: string;
  level: number | null;
  createdAt: string;
};

type TaskRow = {
  id: string;
  name: string;
  completed: number;
  details: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  position: number;
  pinned: number;
  important: number;
  parentId: string | null;
  listId: string;
  createdAt: string;
  updatedAt: string;
};

type TaskTagRow = {
  taskId: string;
  tagId: string;
  createdAt: string;
};

type AppSettingRow = {
  key: string;
  value: string;
  updatedAt: string;
};

function resolveSqlitePath(url: string) {
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
  }

  throw new Error(`Unsupported SQLITE_DATABASE_URL: ${url}`);
}

function requirePostgresUrl() {
  if (
    !postgresUrl ||
    (!postgresUrl.startsWith("postgresql://") &&
      !postgresUrl.startsWith("postgres://"))
  ) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL connection string in .env",
    );
  }

  return postgresUrl;
}

function createPostgresClient(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}

function readSqliteRows(db: Database.Database) {
  const lists = db
    .prepare(
      `SELECT id, name, position, createdAt, updatedAt FROM TodoList ORDER BY position, createdAt`,
    )
    .all() as TodoListRow[];

  const tags = db
    .prepare(
      `SELECT id, slug, label, category, level, createdAt FROM Tag ORDER BY createdAt`,
    )
    .all() as TagRow[];

  const tasks = db
    .prepare(
      `SELECT id, name, completed, details, dueDate, dueTimeMinutes, dueDurationMinutes, dueTimeZone, position, pinned, important, parentId, listId, createdAt, updatedAt FROM Task ORDER BY createdAt`,
    )
    .all() as TaskRow[];

  const taskTags = db
    .prepare(`SELECT taskId, tagId, createdAt FROM TaskTag ORDER BY createdAt`)
    .all() as TaskTagRow[];

  const settings = db
    .prepare(`SELECT key, value, updatedAt FROM AppSetting ORDER BY key`)
    .all() as AppSettingRow[];

  return { lists, tags, tasks, taskTags, settings };
}

async function verifyPostgresConnection(postgres: PrismaClient) {
  const rows = await postgres.$queryRaw<{ version: string }[]>`
    SELECT version()
  `;

  console.log(`PostgreSQL connection OK: ${rows[0]?.version ?? "unknown"}`);
}

async function copyData(
  source: ReturnType<typeof readSqliteRows>,
  postgres: PrismaClient,
) {
  const { lists, tags, tasks, taskTags, settings } = source;

  console.log(
    `SQLite source: ${lists.length} lists, ${tags.length} tags, ${tasks.length} tasks, ${taskTags.length} task tags, ${settings.length} settings`,
  );

  await postgres.$executeRawUnsafe(
    `TRUNCATE "TaskTag", "Task", "Tag", "TodoList", "AppSetting" RESTART IDENTITY CASCADE`,
  );

  await postgres.$executeRawUnsafe(`SET session_replication_role = 'replica'`);

  try {
    if (lists.length > 0) {
      await postgres.todoList.createMany({
        data: lists.map((row) => ({
          id: row.id,
          name: row.name,
          position: row.position,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        })),
      });
    }

    if (tags.length > 0) {
      await postgres.tag.createMany({
        data: tags.map((row) => ({
          id: row.id,
          slug: row.slug,
          label: row.label,
          category: row.category,
          level: row.level,
          createdAt: new Date(row.createdAt),
        })),
      });
    }

    if (tasks.length > 0) {
      await postgres.task.createMany({
        data: tasks.map((row) => ({
          id: row.id,
          name: row.name,
          completed: Boolean(row.completed),
          details: row.details,
          dueDate: row.dueDate ? new Date(row.dueDate) : null,
          dueTimeMinutes: row.dueTimeMinutes,
          dueDurationMinutes: row.dueDurationMinutes,
          dueTimeZone: row.dueTimeZone,
          position: row.position,
          pinned: Boolean(row.pinned),
          important: Boolean(row.important),
          parentId: row.parentId,
          listId: row.listId,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        })),
      });
    }

    if (taskTags.length > 0) {
      await postgres.taskTag.createMany({
        data: taskTags.map((row) => ({
          taskId: row.taskId,
          tagId: row.tagId,
          createdAt: new Date(row.createdAt),
        })),
      });
    }

    if (settings.length > 0) {
      await postgres.appSetting.createMany({
        data: settings.map((row) => ({
          key: row.key,
          value: row.value,
          updatedAt: new Date(row.updatedAt),
        })),
      });
    }
  } finally {
    await postgres.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
  }

  const [pgLists, pgTasks] = await Promise.all([
    postgres.todoList.count(),
    postgres.task.count(),
  ]);

  console.log(
    `PostgreSQL target: ${pgLists} lists, ${pgTasks} tasks copied successfully`,
  );
}

async function main() {
  const url = requirePostgresUrl();
  const sqlitePath = resolveSqlitePath(sqliteUrl);
  const sqlite = new Database(sqlitePath, { readonly: true });
  const postgres = createPostgresClient(url);

  try {
    await verifyPostgresConnection(postgres);
    const source = readSqliteRows(sqlite);
    await copyData(source, postgres);
  } finally {
    sqlite.close();
    await postgres.$disconnect();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
