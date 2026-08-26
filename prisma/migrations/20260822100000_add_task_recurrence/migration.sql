-- AlterTable
ALTER TABLE "Task" ADD COLUMN "recurrenceRule" TEXT,
ADD COLUMN "recurrenceAnchor" TIMESTAMP(3);
