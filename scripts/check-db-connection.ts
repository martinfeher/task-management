import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const postgresUrl = process.env.DATABASE_URL;

async function main() {
  if (
    !postgresUrl ||
    (!postgresUrl.startsWith("postgresql://") &&
      !postgresUrl.startsWith("postgres://"))
  ) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }

  const postgres = new PrismaClient({
    adapter: new PrismaPg({ connectionString: postgresUrl }),
  });

  try {
    await postgres.$executeRawUnsafe(`
      ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
    `);

    const [versionRow] = await postgres.$queryRaw<{ version: string }[]>`
      SELECT version()
    `;
    const [listCount, taskCount, tagColumns] = await Promise.all([
      postgres.todoList.count(),
      postgres.task.count(),
      postgres.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Tag'
          AND column_name = 'position'
      `,
    ]);

    if (tagColumns.length === 0) {
      throw new Error('Tag.position column is missing after schema ensure');
    }

    await postgres.tag.findMany({
      where: { category: "label" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 1,
      select: { id: true },
    });

    console.log("Connection: OK");
    console.log(`Server: ${versionRow.version}`);
    console.log(`Data: ${listCount} lists, ${taskCount} tasks`);
    console.log("Schema: Tag.position is available");
  } finally {
    await postgres.$disconnect();
  }
}

main().catch((error) => {
  console.error("Connection failed:", error);
  process.exit(1);
});
