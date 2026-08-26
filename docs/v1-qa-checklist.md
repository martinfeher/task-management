# v1 QA checklist

Manual gate before production tag. Run on **staging** after migrations and persistent `uploads/tasks/` volume are in place.

Automated helpers (with server running):

```bash
npm run qa:gate -- https://staging.example.com
npm run verify:api -- https://staging.example.com
npm run qa:gate:mobile -- https://staging.example.com
```

## Infrastructure

- [x] `npm run db:migrate:deploy` applied (includes `TaskVersion`, task recurrence)
- [x] `uploads/tasks/` persists across deploy/restart (volume documented in `docker-compose.staging.yml` + `docs/DEPLOY.md`)
- [x] `npx tsc --noEmit` passes; `npm run lint` has pre-existing React 19 `set-state-in-effect` warnings in legacy components (non-blocking for v1)

## Web — core

- [x] Create list, add task, reload — data persists (`npm run qa:gate`)
- [ ] Complete task with undo — undo restores within window
- [x] Task switch in split view — details save without loss (`flushSave` on task select in `todo-app.tsx`)
- [x] Details: bullet list, heading, image upload (< 9 MB) — format menu + `qa:gate` image upload
- [x] Tab close / navigate away — keepalive saves title + details (`pagehide`)
- [x] Version history: manual snapshot + restore (`qa:gate`)

## Web — repeat due dates

- [x] Set repeat (daily/weekly/monthly) on task with due date — list row + details date picker
- [x] Complete recurring task — new open instance appears with correct next due date (`verify:api`)
- [x] Recurrence icon visible on list row and calendar block
- [x] Clear repeat — no spawn on complete

## Web — responsive (< 1024px)

- [ ] Hamburger opens sidebar drawer
- [ ] List full width; selecting task shows details full width
- [ ] Back button returns to list
- [ ] List calendar view usable without horizontal overflow on chrome
- [ ] Create task, edit details, save on phone-width viewport

## Mobile REST (curl or Expo)

- [x] `GET /api/tasks?listId=…` — tasks include `dueTimeMinutes`, `calendarColor`, `recurrenceRule`
- [x] `PATCH /api/tasks/{id}` — `calendarColor`, `recurrenceRule` round-trip
- [ ] `GET/PATCH /api/labels` — color + reorder via `PUT /api/labels/reorder`
- [x] `PUT /api/tasks/{id}/details`, `GET/POST` task images (CORS)
- [x] Complete recurring task via API — next instance created (`verify:api`)

## Polish

- [ ] Dark mode spot-check (sidebar, details, calendar)
- [x] README env vars documented

## Sign-off

- [x] No data-loss or save-failure blockers open
- [x] Production deploy + smoke test (`npm run build`, `qa:gate`, `verify:api` on local production server)

**Triage (defer post-v1):** responsive manual pass, label reorder curl test, dark mode spot-check, undo window timing.
