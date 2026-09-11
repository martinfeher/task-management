-- CreateTable
CREATE TABLE "TaskListTemplateSetting" (
    "id" TEXT NOT NULL,
    "backgroundId" TEXT NOT NULL DEFAULT 'white',
    "baseColor" TEXT NOT NULL DEFAULT '#f1f5ff',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskListTemplateSetting_pkey" PRIMARY KEY ("id")
);
