# Todo / Calendar App

Web todo list with rich task details, calendar views, and a REST API for mobile (Expo) clients.

## Requirements

- Node.js 20+
- PostgreSQL

## Setup

```bash
npm install
cp .env.example .env   # if present; otherwise create .env
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | No | Grammar check in details editor |

### Database

```bash
npm run db:migrate:deploy   # production/staging
# or
npm run db:migrate          # local dev
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy notes

1. Set `DATABASE_URL` in hosting secrets.
2. Run migrations on deploy: `npm run db:migrate:deploy`.
3. Mount a **persistent volume** at `uploads/tasks/` — task images are stored on disk; ephemeral containers lose uploads without it.
4. API routes use **open CORS and no auth** — suitable for private/staging use only unless you add authentication.

## API documentation

- Mobile REST (lists, tasks, labels): [`docs/mobile-api.md`](docs/mobile-api.md)
- Task details, images, versions: [`docs/details-api.md`](docs/details-api.md)
- v1 QA checklist: [`docs/v1-qa-checklist.md`](docs/v1-qa-checklist.md)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |
| `npm run verify:api -- http://localhost:3000` | Verify mobile REST API (server must be running) |
| `npm run qa:gate -- http://localhost:3000` | Week 1 web QA gate script |
| `npm run qa:gate:mobile -- http://localhost:3000` | Week 2 mobile QA gate (API + web persistence) |

## Mobile app

See [`mobile/README.md`](mobile/README.md) for the minimal Expo client.

## Staging database

```bash
docker compose -f docker-compose.staging.yml up -d postgres
export DATABASE_URL="postgresql://todolist:todolist@localhost:5432/todolist?schema=public"
npm run db:migrate:deploy
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for production deployment.

---

Copyright (c) 2026 Martin Feher. All rights reserved.
