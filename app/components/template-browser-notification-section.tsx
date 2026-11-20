"use client";

import { useState } from "react";

export function TemplateBrowserNotificationSection() {
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function handleSendTestNotification() {
    setStatus(null);

    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("This browser does not support notifications.");
      return;
    }

    setIsWorking(true);
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setStatus(
          permission === "denied"
            ? "Notifications are blocked. Enable them in your browser’s site settings."
            : "Notification permission was not granted.",
        );
        return;
      }

      const notification = new Notification("Todolist", {
        body: "This is a test notification from template settings.",
        tag: "todolist-template-settings-test",
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      setStatus("Test notification sent.");
    } catch {
      setStatus("Could not show a notification.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Browser notifications
      </h3>
      <p className="mb-2 px-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Request permission if needed, then send a test notification to confirm it
        works in this browser.
      </p>
      <div className="space-y-2 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => void handleSendTestNotification()}
          disabled={isWorking}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {isWorking ? "Working…" : "Send test notification"}
        </button>
        {status ? (
          <p
            className={`text-[11px] leading-relaxed ${
              status === "Test notification sent."
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}