"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const err = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  const invalidTokenMessage = useMemo(() => {
    if (err === "INVALID_TOKEN") {
      return "This reset link is invalid or has expired. Request a new one.";
    }
    return null;
  }, [err]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");

    const { error: resetErr } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (resetErr) {
      const msg =
        typeof resetErr === "object" && resetErr !== null && "message" in resetErr
          ? String((resetErr as { message?: string }).message)
          : "Could not reset password.";
      setError(msg);
      setStatus("idle");
      return;
    }

    router.replace("/login?reset=1");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          New password
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a strong password for your account.
        </p>

        {invalidTokenMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {invalidTokenMessage}
          </p>
        ) : null}

        {!token && !invalidTokenMessage ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            No token in this URL. Use the link from your reset email, or{" "}
            <Link
              href="/forgot-password"
              className="font-medium underline underline-offset-2"
            >
              request a new link
            </Link>
            .
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading" || !token}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {status === "loading" ? "Saving…" : "Update password"}
          </button>
        </form>

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
