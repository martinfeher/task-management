import { optionsWithCors, resolveCorsHeaders } from "@/lib/api-cors";
import { auth } from "@/lib/auth";
import {
  devMobileSessionSecretMatches,
  DEV_MOBILE_SESSION_SECRET_HEADER,
  isDevMobileSessionRouteEnabled,
  readDevMobileSessionEmail,
  readDevMobileSessionPassword,
  readDevMobileSessionSecret,
} from "@/lib/dev-mobile-session";

/**
 * Development-only: mint a real Better Auth bearer session for the configured user
 * so the Expo app can skip OAuth / manual sign-in while still hitting real APIs.
 */
export async function POST(request: Request) {
  if (!isDevMobileSessionRouteEnabled()) {
    return new Response(null, { status: 404 });
  }

  const providedSecret = request.headers.get(DEV_MOBILE_SESSION_SECRET_HEADER)?.trim() ?? "";
  const expectedSecret = readDevMobileSessionSecret();
  if (!devMobileSessionSecretMatches(providedSecret, expectedSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const password = readDevMobileSessionPassword();
  if (!password) {
    console.warn(
      "[dev/mobile-session] DEV_MOBILE_SESSION_PASSWORD is not set; cannot sign in",
    );
    return Response.json({ error: "Dev session not configured" }, { status: 503 });
  }

  const email = readDevMobileSessionEmail();

  try {
    const authResponse = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      asResponse: true,
    });

    if (!authResponse.ok) {
      console.warn(
        "[dev/mobile-session] signInEmail failed",
        email,
        authResponse.status,
      );
      return Response.json({ error: "Dev sign-in failed" }, { status: 401 });
    }

    const corsHeaders = await resolveCorsHeaders();
    const responseHeaders = new Headers(corsHeaders);
    const contentType = authResponse.headers.get("Content-Type");
    if (contentType) {
      responseHeaders.set("Content-Type", contentType);
    }
    const token = authResponse.headers.get("set-auth-token");
    if (token) {
      responseHeaders.set("set-auth-token", token);
    }

    const body = await authResponse.text();
    return new Response(body, {
      status: authResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[dev/mobile-session]", error);
    return Response.json({ error: "Dev session failed" }, { status: 500 });
  }
}

export async function OPTIONS() {
  if (!isDevMobileSessionRouteEnabled()) {
    return new Response(null, { status: 404 });
  }
  return optionsWithCors();
}
