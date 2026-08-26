# Todo Mobile (Expo)

Minimal Expo client for the Todo/Calendar REST API.

## Setup

```bash
cd mobile
npm install
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your server (e.g. http://192.168.1.10:3000 for device testing)
npm start
```

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
