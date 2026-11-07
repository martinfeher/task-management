import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth redirect only. This does NOT verify the session (no DB
 * call), it just checks whether a session cookie is present, so it is cheap
 * to run on every page request. The real authorization check is
 * `requireUser()` (`lib/require-user.ts`), called inside every Server
 * Action and Route Handler — do not rely on this file for security.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on every page request except:
     * - api (Route Handlers, including /api/auth/*)
     * - _next/static, _next/image (build assets)
     * - favicon.ico and other public static files
     * - /login itself (avoid a redirect loop)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|login|forgot-password|reset-password).*)",
  ],
};
