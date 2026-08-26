-- CreateTable
CREATE TABLE "SidebarTemplateSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "backgroundId" TEXT NOT NULL DEFAULT 'solid-blue',
    "baseColor" TEXT NOT NULL DEFAULT '#f1f5ff',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SidebarTemplateSetting_pkey" PRIMARY KEY ("id")
);
