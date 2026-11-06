import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getTrustedOriginsFromEnv } from "@/lib/trusted-origins";

// Allow-list of browser origins permitted to call these API routes with
// cookies attached. Mirrors Better Auth's trustedOrigins so there's a single
// place to configure "which web origins can talk to us" (comma-separated).
// Native/mobile clients don't send an Origin header and authenticate with a
// bearer token instead, so they're unaffected by this allow-list — CORS is
// a browser-enforced mechanism only.
const TRUSTED_ORIGINS = [...getTrustedOriginsFromEnv()];

if (process.env.BETTER_AUTH_URL) {
  TRUSTED_ORIGINS.push(process.env.BETTER_AUTH_URL);
}

const ALLOWED_ORIGINS = new Set(TRUSTED_ORIGINS);

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  // "Authorization" is required so the mobile app's bearer-token requests
  // pass CORS preflight too (harmless for cookie-based web requests).
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  Vary: "Origin",
} as const;

/**
 * Computes CORS headers for the current request. Reflects the incoming
 * Origin only when it's on the allow-list (and enables credentialed
 * requests for it); otherwise omits Access-Control-Allow-Origin entirely so
 * browsers refuse to let untrusted sites read the response. Deliberately
 * NOT a wildcard: a wildcard Origin can never be combined with
 * credentials (cookies), which would break cookie-authenticated requests
 * and, more importantly, would make it impossible to scope access to our
 * own web app.
 */
export async function resolveCorsHeaders(): Promise<Record<string, string>> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return { ...BASE_CORS_HEADERS };
  }

  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * @deprecated Static headers kept only for any lingering direct references.
 * Prefer `jsonWithCors`/`optionsWithCors`, which compute the correct
 * per-request, origin-aware headers via `resolveCorsHeaders()`.
 */
export const API_CORS_HEADERS = BASE_CORS_HEADERS;

export async function jsonWithCors<T>(body: T, init?: ResponseInit) {
  const corsHeaders = await resolveCorsHeaders();
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

export async function optionsWithCors() {
  const corsHeaders = await resolveCorsHeaders();
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
