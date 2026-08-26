-- Update default calendar task text colors when they are still the previous defaults.
UPDATE "CalendarTaskTemplateSetting"
SET "titleColor" = '#1f1f1f'
WHERE "titleColor" = '#2a2832';

UPDATE "CalendarTaskTemplateSetting"
SET "timeColor" = '#8f8f8f'
WHERE "timeColor" = '#6e6e6e';

UPDATE "TemplateStyle"
SET "calendarTitleColor" = '#1f1f1f'
WHERE "calendarTitleColor" = '#2a2832';

UPDATE "TemplateStyle"
SET "calendarTimeColor" = '#8f8f8f'
WHERE "calendarTimeColor" = '#6e6e6e';
