import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { getTrustedOriginsFromEnv } from "@/lib/trusted-origins";

const trustedOrigins = getTrustedOriginsFromEnv();

/**
 * Server-side Better Auth instance.
 *
 * - Google is the only sign-in method (no email/password).
 * - The Prisma adapter persists User/Session/Account/Verification rows
 *   defined in `prisma/schema.prisma`.
 * - `bearer()` lets the Expo/Capacitor mobile clients authenticate with a
 *   bearer token instead of a browser cookie.
 * - `nextCookies()` must stay last so it can set cookies from Server Actions.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // Reject account creation for Google accounts whose email Google has not
  // verified. `user.emailVerified` is populated from the provider's
  // `email_verified` claim before this hook runs.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.emailVerified) {
            return false;
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [bearer(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
