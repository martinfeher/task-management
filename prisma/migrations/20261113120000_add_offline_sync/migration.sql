-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "fieldUpdatedAt" JSONB;

-- CreateTable
CREATE TABLE "SyncMutation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB NOT NULL,

    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("userId","id")
);

-- CreateIndex
CREATE INDEX "SyncMutation_appliedAt_idx" ON "SyncMutation"("appliedAt");

-- CreateIndex
CREATE INDEX "Task_userId_updatedAt_idx" ON "Task"("userId", "updatedAt");
