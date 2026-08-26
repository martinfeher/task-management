-- CreateTable
CREATE TABLE "TemplateStyle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sidebarBackgroundId" TEXT NOT NULL DEFAULT 'solid-blue',
    "sidebarBaseColor" TEXT NOT NULL DEFAULT '#f1f5ff',
    "calendarBackgroundId" TEXT NOT NULL DEFAULT 'solid',
    "calendarBaseColor" TEXT NOT NULL DEFAULT '#bbd8fe',
    "calendarEndColor" TEXT NOT NULL DEFAULT '#ffffff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateStyle_pkey" PRIMARY KEY ("id")
);
