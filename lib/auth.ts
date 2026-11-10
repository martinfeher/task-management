import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { nextCookies } from "better-auth/next-js";
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { prisma } from "@/lib/prisma";
import { getTrustedOriginsFromEnv } from "@/lib/trusted-origins";
import { escapeHtml, sendAuthEmail } from "@/lib/auth-email";

const trustedOrigins = getTrustedOriginsFromEnv();

/**
 * Server-side Better Auth instance.
 *
 * - Google OAuth and email + password (credential) sign-in.
 * - Password reset emails when SMTP env vars are set (see `.env.example`).
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
  emailAndPassword: {
    enabled: true,
    // Allow new email/password users to sign in immediately (no verify-email flow).
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your Todolist password",
        text: `Hi ${user.name},\n\nReset your password by opening this link (valid for a limited time):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hi ${escapeHtml(user.name)},</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    },
  },
  // Reject Google OAuth sign-up when Google reports an unverified email.
  // Email/password sign-up sets emailVerified false until verified — do not block that path.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const ep = tryGetCurrentAuthEndpointContext();
          const path = String(ep?.path ?? "");
          const isGoogleOAuth =
            path.includes("callback") && path.includes("google");
          if (isGoogleOAuth && !user.emailVerified) {
            return false;
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [bearer(), nextCookies(), expo()],
});

export type Session = typeof auth.$Infer.Session;
