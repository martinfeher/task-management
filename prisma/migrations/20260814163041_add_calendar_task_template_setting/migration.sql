-- CreateTable
CREATE TABLE "CalendarTaskTemplateSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "backgroundId" TEXT NOT NULL DEFAULT 'solid',
    "baseColor" TEXT NOT NULL DEFAULT '#bbd8fe',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTaskTemplateSetting_pkey" PRIMARY KEY ("id")
);
