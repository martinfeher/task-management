-- AlterTable
ALTER TABLE "Task" ADD COLUMN "detailsDoc" JSONB;
ALTER TABLE "Task" ADD COLUMN "detailsText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Task" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TaskVersion" ADD COLUMN "detailsDoc" JSONB;
