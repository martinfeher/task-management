/**
 * Origins allowed for Better Auth CSRF/origin checks and for `lib/api-cors.ts`.
 * Merges `AUTH_TRUSTED_ORIGINS` and `BETTER_AUTH_TRUSTED_ORIGINS` (Better Auth's
 * built-in env name) so either variable works.
 */
export function parseTrustedOriginsList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getTrustedOriginsFromEnv(): string[] {
  const fromAuth = parseTrustedOriginsList(process.env.AUTH_TRUSTED_ORIGINS);
  const fromBetterAuth = parseTrustedOriginsList(
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  );
  return [...new Set([...fromAuth, ...fromBetterAuth])];
}
