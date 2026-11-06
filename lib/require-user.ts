import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Returns the signed-in user for the current request, or `null` if there is
 * no session. Works from Server Components, Server Actions and Route
 * Handlers alike since it reads the incoming request headers.
 */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/**
 * The single choke point every Server Action and Route Handler should call
 * before touching user data. Throws `UnauthorizedError` when there is no
 * session; callers must not accept a `userId` from the client instead.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/** JSON 401 response for Route Handlers that catch `UnauthorizedError`. */
export function unauthorizedResponse() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
