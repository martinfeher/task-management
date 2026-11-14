import { timingSafeEqual } from "node:crypto";

export const DEV_MOBILE_SESSION_SECRET_HEADER = "X-Dev-Mobile-Session-Secret";

const DEFAULT_DEV_MOBILE_SESSION_EMAIL = "mn.feher@gmail.com";

export function isDevMobileSessionRouteEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    Boolean(process.env.DEV_MOBILE_SESSION_SECRET?.trim())
  );
}

export function readDevMobileSessionSecret() {
  return process.env.DEV_MOBILE_SESSION_SECRET?.trim() ?? "";
}

export function readDevMobileSessionEmail() {
  return (
    process.env.DEV_MOBILE_SESSION_EMAIL?.trim() || DEFAULT_DEV_MOBILE_SESSION_EMAIL
  );
}

export function readDevMobileSessionPassword() {
  return process.env.DEV_MOBILE_SESSION_PASSWORD?.trim() ?? "";
}

/** Constant-time compare for the shared dev secret header. */
export function devMobileSessionSecretMatches(provided: string, expected: string) {
  if (!provided || !expected) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
