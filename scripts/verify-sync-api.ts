/**
 * End-to-end check of the offline sync endpoints against a running dev
 * server (`npm run dev`). Signs up a throwaway user, exercises push/pull,
 * then deletes that user and everything it created.
 *
 *   npm run verify:sync            # uses http://localhost:3000
 *   SYNC_API_BASE=http://host:3000 npm run verify:sync
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const BASE = process.env.SYNC_API_BASE ?? "http://localhost:3000";
const email = `sync-verify-${Date.now()}@example.test`;
let token = "";
let failures = 0;
let counter = 0;

type PushResult = {
  mutationId: string;
  status: "applied" | "ignored" | "rejected";
  tempId?: string;
  id?: string;
  error?: string;
  task?: Record<string, unknown> & { id: string; deletedAt: string | null } | null;
};

function check(label: string, condition: unknown, detail?: unknown) {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) {
    failures += 1;
    console.log("      ", JSON.stringify(detail));
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as T };
}

const mutationId = () => `verify-${Date.now()}-${counter++}`;

async function push(mutations: unknown[]) {
  const { body } = await call<{ results: PushResult[] }>("/api/sync/push", {
    method: "POST",
    body: JSON.stringify({ mutations }),
  });
  return body?.results ?? [];
}

async function run() {
  const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password: `verify-${Date.now()}-pw`, name: "Sync verify" }),
  });
  token = signUp.headers.get("set-auth-token") ?? "";
  check("sign up throwaway user", signUp.ok && token, { status: signUp.status });
  if (!token) return;

  const lists = await call<{ lists?: { id: string }[] }>("/api/lists");
  let listId = lists.body?.lists?.[0]?.id;
  if (!listId) {
    listId = (await call<{ id: string }>("/api/lists", { method: "POST", body: JSON.stringify({ name: "Verify" }) })).body.id;
  }

  const initial = await call<{ tasks: unknown[] }>("/api/sync/pull");
  check("initial pull", initial.status === 200 && Array.isArray(initial.body.tasks), initial.body);

  const t0 = Date.now();
  const createMutation = {
    mutationId: mutationId(),
    kind: "create",
    entityId: "local_a",
    at: t0,
    fields: {
      name: { value: "Offline task", at: t0 },
      listId: { value: listId, at: t0 },
      details: { value: "<p>notes</p>", at: t0 },
      priority: { value: 2, at: t0 },
      dueDate: { value: "2026-12-01", at: t0 },
    },
  };
  const [created, subtask, tempUpdate] = await push([
    createMutation,
    {
      mutationId: mutationId(),
      kind: "create",
      entityId: "local_b",
      at: t0,
      fields: { name: { value: "Sub", at: t0 }, listId: { value: listId, at: t0 }, parentId: { value: "local_a", at: t0 } },
    },
    { mutationId: mutationId(), kind: "update", entityId: "local_a", at: t0 + 1, fields: { important: { value: true, at: t0 + 1 } } },
  ]);
  const taskId = created?.id ?? "";
  check("create returns server id for temp id", created?.status === "applied" && created.tempId === "local_a" && taskId && !taskId.startsWith("local_"), created);
  check("create applies extra fields", created?.task?.priority === 2 && created.task.details === "<p>notes</p>", created?.task);
  check("subtask resolves temp parent in same batch", subtask?.task?.parentId === taskId, subtask);
  check("update on temp id in same batch", tempUpdate?.task?.important === true, tempUpdate);

  const [retried] = await push([createMutation]);
  check("retried create is idempotent", retried?.id === taskId, retried);
  const pulledAfterRetry = await call<{ tasks: { name: string; deletedAt: string | null }[] }>("/api/sync/pull");
  check(
    "retry did not duplicate the task",
    pulledAfterRetry.body.tasks.filter((task) => task.name === "Offline task" && !task.deletedAt).length === 1,
    pulledAfterRetry.body.tasks.map((task) => task.name),
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  await call(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ name: "Web name" }) });
  const [stale] = await push([
    {
      mutationId: mutationId(),
      kind: "update",
      entityId: taskId,
      at: t0 + 5,
      fields: { name: { value: "Stale offline name", at: t0 + 5 }, pinned: { value: true, at: t0 + 5 } },
    },
  ]);
  check("LWW keeps newer web edit", stale?.task?.name === "Web name", stale?.task);
  check("LWW applies other fields from the same offline edit", stale?.task?.pinned === true, stale?.task);

  const later = Date.now() + 10;
  const [newer] = await push([
    { mutationId: mutationId(), kind: "update", entityId: taskId, at: later, fields: { name: { value: "Newest offline", at: later }, dueTimeMinutes: { value: 600, at: later } } },
  ]);
  check("LWW applies newer offline edit", newer?.task?.name === "Newest offline" && newer.task.dueTimeMinutes === 600, newer?.task);

  const [staleDelete] = await push([{ mutationId: mutationId(), kind: "delete", entityId: taskId, at: t0 + 2 }]);
  check("delete older than the last edit is ignored", staleDelete?.status === "ignored" && staleDelete.task?.deletedAt === null, staleDelete);

  const since = new Date(Date.now() - 1000).toISOString();
  const [deleted] = await push([{ mutationId: mutationId(), kind: "delete", entityId: taskId, at: Date.now() + 100 }]);
  check("newer delete applies", deleted?.status === "applied" && deleted.task?.deletedAt, deleted);
  const zombieAt = Date.now() + 200;
  const [zombie] = await push([
    { mutationId: mutationId(), kind: "update", entityId: taskId, at: zombieAt, fields: { name: { value: "zombie", at: zombieAt } } },
  ]);
  check("edits to a deleted task are ignored", zombie?.status === "ignored" && zombie.task?.name !== "zombie", zombie);

  const pulled = await call<{ tasks: { id: string; deletedAt: string | null }[] }>(`/api/sync/pull?since=${encodeURIComponent(since)}`);
  check("pull since returns the tombstone", pulled.body.tasks.some((task) => task.id === taskId && task.deletedAt), pulled.body);

  const [rejected] = await push([
    { mutationId: mutationId(), kind: "create", entityId: "local_z", at: Date.now(), fields: { name: { value: "Z", at: Date.now() }, listId: { value: "missing", at: Date.now() } } },
  ]);
  check("create in an unknown list is rejected", rejected?.status === "rejected", rejected);
}

async function cleanup() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (user) {
      await prisma.syncMutation.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

run()
  .catch((error) => {
    failures += 1;
    console.error(error);
  })
  .finally(async () => {
    await cleanup();
    console.log(failures === 0 ? "\nAll sync checks passed" : `\n${failures} sync check(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
  });
