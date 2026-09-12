import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const PRISMA_CLIENT_VERSION = "postgresql-v14";

function assertGeneratedClientSupportsSchema() {
  if (!("important" in Prisma.TaskScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date. Run: npx prisma generate",
    );
  }

  if (!("isNote" in Prisma.TaskScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date (missing Task.isNote). Run: npx prisma migrate deploy && npx prisma generate",
    );
  }

  if (!("deletedAt" in Prisma.TaskScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date (missing Task.deletedAt). Run: npx prisma migrate deploy && npx prisma generate",
    );
  }

  if (!("titleColor" in Prisma.CalendarTaskTemplateSettingScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date. Run: npx prisma generate",
    );
  }

  if (!("calendarTitleColor" in Prisma.TemplateStyleScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date. Run: npx prisma generate",
    );
  }

  if (!("settingsJson" in Prisma.TemplateStyleScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date (missing TemplateStyle.settingsJson). Run: npx prisma migrate deploy && npx prisma generate",
    );
  }

  if (!("color" in Prisma.TagScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date. Run: npx prisma generate",
    );
  }

  if (!("position" in Prisma.TagScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date. Run: npx prisma generate",
    );
  }
}

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a PostgreSQL connection string to .env",
    );
  }

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL connection string (postgresql://...)",
    );
  }

  return url;
}

function createPrismaClient() {
  assertGeneratedClientSupportsSchema();

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }),
  });

  (
    client as PrismaClient & {
      __clientVersion?: string;
    }
  ).__clientVersion = PRISMA_CLIENT_VERSION;

  return client;
}

function isPrismaClientCurrent(client: PrismaClient) {
  return (
    "tag" in client &&
    "taskTag" in client &&
    "sidebarTemplateSetting" in client &&
    "calendarTaskTemplateSetting" in client &&
    "templateStyle" in client &&
    (client as PrismaClient & { __clientVersion?: string }).__clientVersion ===
      PRISMA_CLIENT_VERSION
  );
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma;

  if (cached && isPrismaClientCurrent(cached)) {
    return cached;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = getPrismaClient();
