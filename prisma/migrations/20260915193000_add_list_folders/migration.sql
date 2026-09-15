-- CreateTable
CREATE TABLE "ListFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TodoList" ADD COLUMN "folderId" TEXT;

-- AddForeignKey
ALTER TABLE "TodoList" ADD CONSTRAINT "TodoList_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ListFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
