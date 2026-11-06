"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Uses cookie-based sessions for the web
 * app. Mobile (Expo/Capacitor) clients authenticate separately with a
 * bearer token against the same `/api/auth/*` endpoints (see
 * `mobile/resolve-api-url.ts` and the server's `bearer()` plugin in
 * `lib/auth.ts`) rather than through this client.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});

export const { useSession, signIn, signOut } = authClient;
