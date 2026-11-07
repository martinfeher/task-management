# Deployment guide (v1)

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Persistent disk for `uploads/tasks/` and `uploads/task-audio/`
- A Google Cloud OAuth client (Web application) — see [Auth setup](#auth-setup-better-auth--google)

## Quick staging (local)

```bash
docker compose -f docker-compose.staging.yml up -d postgres
export DATABASE_URL="postgresql://todolist:todolist@localhost:5432/todolist?schema=public"
npm run db:migrate:deploy
npm run build
npm run start
```

## Auth setup (Better Auth: Google + email/password)

The app uses [Better Auth](https://www.better-auth.com/) with **Google OAuth**
and **email + password** (credential) accounts. `lib/auth.ts` is the server config;
`lib/require-user.ts` is the single choke point every Server Action and
Route Handler calls to get the current user (`requireUser()` throws
`UnauthorizedError` → routes map that to `401`; nothing ever trusts a
`userId` sent by the client).

1. In Google Cloud Console, create an **OAuth client ID** of type **Web
   application**.
2. Add an authorized redirect URI for every environment:
   - `https://<your-domain>/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (dev)
3. Request only the `openid email profile` scopes (Better Auth's default).
4. Set these env vars (see `.env.example`):
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
   - `BETTER_AUTH_URL` — the public base URL of this deployment
   - `AUTH_TRUSTED_ORIGINS` — comma-separated browser origins allowed to
     call the API with cookies (your web app's origin, plus any Capacitor
     scheme like `capacitor://localhost` for the mobile app). This list
     also drives the CORS allow-list in `lib/api-cors.ts` — see
     [CORS](#cors) below.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
5. Google's `email_verified` claim is honored for **OAuth only**:
   `databaseHooks.user.create.before` rejects Google sign-up when Google reports
   the email as unverified. Email/password users can sign in without verifying
   first (`emailAndPassword.requireEmailVerification` is off); turn it on and
   add `emailVerification` if you need verified-email-only access.

### Email & password + password reset

- **Sign up / sign in**: `/login` — create account or sign in with email.
- **Forgot password**: `/forgot-password` → sends a reset link via **`SMTP_*`**
  env vars (see `.env.example`). If SMTP is not set, **development** logs the
  link to the server console instead of sending mail.
- **Set new password**: users land on `/reset-password?token=…` from the
  email link (handled by Better Auth’s `/api/auth/reset-password/:token`
  redirect).

Mobile clients (Expo/Capacitor) authenticate with a **bearer token**
instead of cookies, via Better Auth's `bearer()` plugin — no CORS
preflight/credentials dance needed for native fetch.

## CORS

`lib/api-cors.ts` reflects `Access-Control-Allow-Origin` only for origins
in `AUTH_TRUSTED_ORIGINS` (plus `BETTER_AUTH_URL`), and sets
`Access-Control-Allow-Credentials: true` only for those. There is **no
wildcard** `*` — an untrusted origin gets a response with no CORS headers
at all, so browsers refuse to let it read the response (and, combined with
cookies' `SameSite` attribute, can't ride the user's session either).
Native mobile HTTP clients aren't subject to CORS at all (it's a
browser-only mechanism), so the bearer-token mobile app is unaffected.

## Migrating existing single-tenant data to a real owner account

If this deployment already has data from before multi-user support
existed (every `ListFolder` / `TodoList` / `Task` / `Tag` / settings row
had `userId = NULL`), claim it for one account using the **expand → claim
→ contract** pattern:

1. **Expand** (already done in this codebase): `userId` columns were added
   as nullable, so old rows keep working and old code paths didn't need to
   change atomically with the schema.
2. **Sign in once** as the intended owner via Google. This creates the
   `User` row (and auto-seeds a starter "My tasks" list + default priority
   tags for the new account — see the note the script prints at the end).
3. **Claim**: set `LEGACY_OWNER_EMAIL` in `.env` to that exact email. This
   variable is **only** read when you run the claim script — it does **not**
   attach legacy data on login by itself. Then run:
   ```bash
   npm run diagnose:legacy-data             # optional: counts of legacy vs owned rows
   npm run claim:legacy-data -- --dry-run   # preview counts, changes nothing
   npm run claim:legacy-data                # apply
   ```
   `scripts/claim-legacy-data.ts` is transactional and **idempotent** — it
   only ever reassigns rows that still have `userId = NULL`, so re-running
   it after a successful claim is a safe no-op. It also merges unavoidable
   collisions (e.g. duplicate priority tags, or a settings row that already
   exists for the new account) without ever deleting real list/task data.
4. **Contract** (do this as its own follow-up migration once you've
   verified the claim): make `userId` `NOT NULL` on the claimed tables, add
   the `@@unique([userId, slug])` constraint on `Tag`, etc. Not included
   yet in this codebase so the claim step above can be rehearsed safely
   first.

**Before step 3**, take a backup:

```bash
pg_dump --format=custom "$DATABASE_URL" > backups/pre-claim-$(date +%Y%m%d_%H%M%S).dump
tar -czf backups/uploads-pre-claim-$(date +%Y%m%d_%H%M%S).tar.gz uploads/
```

## Production checklist

1. Set `DATABASE_URL` and the auth env vars above in hosting secrets.
2. Run `npm run build` on deploy (includes `prisma migrate deploy`) — do
   **not** run `prisma migrate dev` against production; it can force a
   destructive reset on drift. Deploys should only ever run
   `prisma migrate deploy`.
3. Mount a **persistent volume** at `uploads/`.
4. Optional: `OPENAI_API_KEY` for grammar check in the details editor
   (now requires a signed-in session, so it can't be used as an open
   proxy for anonymous OpenAI calls).
5. Optional: `BACKUP_MAX_UPLOAD_BYTES` to cap restore upload size.

## Security (v1 → multi-user)

- **Authenticated**: every Server Action and Route Handler calls
  `requireUser()`/`getCurrentUser()` and scopes all reads/writes by
  `userId`. Unauthenticated mutating requests get `401`.
- Backup/restore (`app/api/backup/*`) is scoped to the signed-in user only
  — it reassigns `userId` on every restored row (so a crafted backup can't
  plant data under another account) and only replaces that user's own
  uploaded files.
- `proxy.ts` (Next's renamed `middleware.ts`) only does an **optimistic**
  redirect to `/login` for logged-out page loads; it is **not** the real
  security boundary — that's `requireUser()` in each Server
  Action/Route Handler.
- CORS is allow-listed (see above), not wildcard.

## Verify after deploy

```bash
npm run verify:api -- http://localhost:3000
npm run qa:gate
```

See also [`v1-qa-checklist.md`](v1-qa-checklist.md) and [`RELEASE_NOTES.md`](RELEASE_NOTES.md).
