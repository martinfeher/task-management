-- DropIndex
DROP INDEX "Tag_slug_key";

-- AlterTable
-- `id` needs a temporary default so existing rows (the pre-multi-user
-- AppSetting rows, keyed only by `key` until now) get backfilled with a
-- real value before the NOT NULL + new primary key are enforced. Postgres
-- 13+ has gen_random_uuid() built in, so no extension is required. The
-- default is dropped right after since Prisma generates ids with cuid()
-- at the application layer for new rows going forward.
ALTER TABLE "AppSetting" DROP CONSTRAINT "AppSetting_pkey",
ADD COLUMN     "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN     "userId" TEXT,
ADD CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id");

ALTER TABLE "AppSetting" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CalendarTaskTemplateSetting" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "timeColor" SET DEFAULT '#8f8f8f',
ALTER COLUMN "titleColor" SET DEFAULT '#1f1f1f';

-- AlterTable
ALTER TABLE "ListFolder" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "SidebarTemplateSetting" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "TaskListTemplateSetting" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "TemplateStyle" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "calendarTimeColor" SET DEFAULT '#8f8f8f',
ALTER COLUMN "calendarTitleColor" SET DEFAULT '#1f1f1f';

-- AlterTable
ALTER TABLE "TodoList" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "TooltipTemplateSetting" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_userId_key_key" ON "AppSetting"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarTaskTemplateSetting_userId_key" ON "CalendarTaskTemplateSetting"("userId");

-- CreateIndex
CREATE INDEX "ListFolder_userId_idx" ON "ListFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SidebarTemplateSetting_userId_key" ON "SidebarTemplateSetting"("userId");

-- CreateIndex
CREATE INDEX "Tag_userId_slug_idx" ON "Tag"("userId", "slug");

-- CreateIndex
CREATE INDEX "Tag_userId_category_idx" ON "Tag"("userId", "category");

-- CreateIndex
CREATE INDEX "Task_userId_listId_position_idx" ON "Task"("userId", "listId", "position");

-- CreateIndex
CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_userId_deletedAt_idx" ON "Task"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskListTemplateSetting_userId_key" ON "TaskListTemplateSetting"("userId");

-- CreateIndex
CREATE INDEX "TemplateStyle_userId_idx" ON "TemplateStyle"("userId");

-- CreateIndex
CREATE INDEX "TodoList_userId_position_idx" ON "TodoList"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TooltipTemplateSetting_userId_key" ON "TooltipTemplateSetting"("userId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFolder" ADD CONSTRAINT "ListFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoList" ADD CONSTRAINT "TodoList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidebarTemplateSetting" ADD CONSTRAINT "SidebarTemplateSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskListTemplateSetting" ADD CONSTRAINT "TaskListTemplateSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarTaskTemplateSetting" ADD CONSTRAINT "CalendarTaskTemplateSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TooltipTemplateSetting" ADD CONSTRAINT "TooltipTemplateSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateStyle" ADD CONSTRAINT "TemplateStyle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

