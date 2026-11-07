"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/reset-password`;

    const { error: reqError } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo,
    });

    if (reqError) {
      const msg =
        typeof reqError === "object" && reqError !== null && "message" in reqError
          ? String((reqError as { message?: string }).message)
          : "Could not send reset email.";
      setError(msg);
      setStatus("idle");
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a link to choose a new
          password.
        </p>

        {status === "sent" ? (
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
            If an account exists for that address, check your inbox for a reset
            link. With SMTP unset in development, the link is printed in the
            server console.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:border-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {status === "loading" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <Link
            href="/login"
            className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-zinc-50"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
