"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type LoginFormProps = {
  googleConfigured: boolean;
};

export function LoginForm({ googleConfigured }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    if (!googleConfigured) {
      setError(
        "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (see .env.example), restart the dev server, and add the redirect URI in Google Cloud Console.",
      );
      return;
    }

    setIsSigningIn(true);

    const next = searchParams.get("next") ?? "/";

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
    });

    const signInError = result.error;
    if (signInError) {
      const code =
        signInError && typeof signInError === "object" && "code" in signInError
          ? String((signInError as { code?: string }).code)
          : undefined;
      let message =
        typeof signInError === "object" && signInError !== null && "message" in signInError
          ? String((signInError as { message?: string }).message)
          : "Could not sign in with Google";

      if (
        code === "CLIENT_ID_AND_SECRET_REQUIRED" ||
        code === "PROVIDER_NOT_FOUND" ||
        message.includes("CLIENT_ID_AND_SECRET") ||
        message.includes("Client Id and Client Secret")
      ) {
        message =
          "Google OAuth credentials are missing or invalid. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, restart the server, and ensure the redirect URI matches this app.";
      } else if (code === "INVALID_ORIGIN" || code === "INVALID_CALLBACK_URL") {
        message =
          "This origin is not allowed for sign-in. Add your app URL to AUTH_TRUSTED_ORIGINS (or BETTER_AUTH_TRUSTED_ORIGINS) and BETTER_AUTH_URL.";
      }

      setError(message);
      setIsSigningIn(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with Google to access your lists and tasks.
        </p>

        {!googleConfigured ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Google OAuth is not configured in this environment. Add{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">
              GOOGLE_CLIENT_ID
            </code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">
              GOOGLE_CLIENT_SECRET
            </code>{" "}
            to{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">
              .env
            </code>
            , use redirect{" "}
            <code className="break-all rounded bg-amber-100 px-1 dark:bg-amber-900/60">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/auth/callback/google`
                : "http://localhost:3000/api/auth/callback/google"}
            </code>{" "}
            in Google Cloud Console, then restart{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">
              npm run dev
            </code>
            .
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSigningIn || !googleConfigured}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.3h6.47c-.29 1.48-1.14 2.73-2.43 3.58v2.97h3.86c2.26-2.09 3.59-5.17 3.59-8.58z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.9-2.92l-3.86-2.97c-1.07.72-2.45 1.15-4.04 1.15-3.11 0-5.74-2.09-6.68-4.9H1.26v3.07C3.19 21.3 7.27 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.32 14.36A7.2 7.2 0 0 1 4.93 12c0-.82.14-1.62.39-2.36V6.57H1.26A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.26 5.43l4.06-3.07z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.27 0 3.19 2.7 1.26 6.57l4.06 3.07c.94-2.81 3.57-4.89 6.68-4.89z"
            />
          </svg>
          {isSigningIn ? "Signing in..." : "Continue with Google"}
        </button>

        {error ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
