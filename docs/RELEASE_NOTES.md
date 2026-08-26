# Release notes — v1.0

Task management + calendar planning web app with REST API for mobile (Expo) clients.

## Included

- Lists, tasks, subtasks, labels, priority, drag reorder
- Rich task details editor (blocks, images, links, version history)
- Calendar views: day, week, month, multi-day, multi-week
- Recurrence (daily/weekly/monthly) from details panel and list row date picker
- Mobile REST API with CORS for tasks, details, images, versions, labels, search
- Responsive layout below 1024px (drawer sidebar, stacked list/details)

## Known limitations

- **No user authentication** — single shared database; API is open CORS.
- **Images on local disk** — requires persistent volume; not object storage (S3).
- **Desktop-first** details layout (~700px split pane on large screens).
- **Version preview** is plain text, not rich HTML.
- **No push/email reminders** or offline sync queue.
- **Year calendar view** not implemented.

## Mobile client

Minimal Expo companion in [`mobile/`](../mobile/README.md). Point `EXPO_PUBLIC_API_URL` at your deployment.

## Upgrade

Run database migrations on every deploy:

```bash
npm run db:migrate:deploy
```
