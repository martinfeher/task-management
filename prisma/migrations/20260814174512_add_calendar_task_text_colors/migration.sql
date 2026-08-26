-- AlterTable
ALTER TABLE "CalendarTaskTemplateSetting" ADD COLUMN     "timeColor" TEXT NOT NULL DEFAULT '#6e6e6e',
ADD COLUMN     "titleColor" TEXT NOT NULL DEFAULT '#2a2832';

-- AlterTable
ALTER TABLE "TemplateStyle" ADD COLUMN     "calendarTimeColor" TEXT NOT NULL DEFAULT '#6e6e6e',
ADD COLUMN     "calendarTitleColor" TEXT NOT NULL DEFAULT '#2a2832';
