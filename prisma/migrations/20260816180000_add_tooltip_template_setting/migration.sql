-- CreateTable
CREATE TABLE "TooltipTemplateSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "backgroundColor" TEXT NOT NULL DEFAULT '#3d3e3f',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "cornerRadiusPx" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TooltipTemplateSetting_pkey" PRIMARY KEY ("id")
);
