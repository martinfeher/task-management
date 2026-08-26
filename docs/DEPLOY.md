# Deployment guide (v1)

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Persistent disk for `uploads/tasks/` (task images)

## Quick staging (local)

```bash
docker compose -f docker-compose.staging.yml up -d postgres
export DATABASE_URL="postgresql://todolist:todolist@localhost:5432/todolist?schema=public"
npm run db:migrate:deploy
npm run build
npm run start
```

## Production checklist

1. Set `DATABASE_URL` in hosting secrets.
2. Run `npm run build` on deploy (includes `prisma migrate deploy`).
3. Mount **persistent volume** at `uploads/tasks/`.
4. Optional: `OPENAI_API_KEY` for grammar check in details editor.

## Security (v1)

- **No authentication** — suitable for private/staging or trusted networks only.
- REST API uses **open CORS** (`lib/api-cors.ts`). Do not expose publicly without auth or a reverse proxy with access control.

## Verify after deploy

```bash
npm run verify:api -- http://localhost:3000
npm run qa:gate
```

See also [`v1-qa-checklist.md`](v1-qa-checklist.md) and [`RELEASE_NOTES.md`](RELEASE_NOTES.md).
