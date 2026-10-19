# Todo Mobile (Expo)

Minimal Expo client for the Todo/Calendar REST API.

## Setup

```bash
# Terminal 1 — web API (listens on all interfaces for phones on the same Wi‑Fi)
npm run dev

# Terminal 2 — Expo (from repo root; sets LAN API URL when possible)
npm run expo:start
```

Or from `mobile/` after `npm install` and `cp .env.example .env`:

```bash
npm start
```

For a **physical device**, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your computer's LAN IP (e.g. `http://192.168.1.10:3000`). In dev, the app also tries to infer that host from the Metro bundler when you use `localhost` in `.env`.

## Features (v1 shell)

- List tasks for the first todo list
- View task name and details HTML (rendered as text)
- Toggle complete
- Set weekly recurrence via API

## API

Uses endpoints documented in [`../docs/mobile-api.md`](../docs/mobile-api.md) and [`../docs/details-api.md`](../docs/details-api.md).

## Notes

- No auth — point only at private/staging servers.
- For local device testing, use your machine LAN IP, not `localhost`.
