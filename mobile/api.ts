import {
  clearMobileListSnapshot,
  dedupeMobileRequest,
  type MobileTask,
} from "./mobile-session";

export type { MobileTask };

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function getFirstListId(): Promise<string> {
  return dedupeMobileRequest("lists:first", async () => {
    const data = await api<{ lists: { id: string }[] }>("/api/lists");
    const listId = data.lists[0]?.id;
    if (!listId) throw new Error("No lists found");
    return listId;
  });
}

export async function getListTasks(listId: string) {
  return dedupeMobileRequest(`tasks:list:${listId}`, () =>
    api<{
      title: string;
      pinned: MobileTask[];
      tasks: MobileTask[];
    }>(`/api/tasks?listId=${listId}`),
  );
}

export async function getTask(taskId: string) {
  return api<{
    id: string;
    name: string;
    details: string;
    completed: boolean;
    recurrenceRule: string | null;
  }>(`/api/tasks/${taskId}`);
}

export async function patchTask(
  taskId: string,
  body: Record<string, unknown>,
) {
  const result = await api(`/api/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  clearMobileListSnapshot();
  return result;
}

export async function putDetails(taskId: string, details: string) {
  const result = await api(`/api/tasks/${taskId}/details`, {
    method: "PUT",
    body: JSON.stringify({ details }),
  });
  clearMobileListSnapshot();
  return result;
}

export async function uploadTaskImage(taskId: string) {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), "mobile.png");

  const response = await fetch(`${API_URL}/api/tasks/${taskId}/images`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  clearMobileListSnapshot();
  return response.json() as Promise<{ url: string }>;
}

export function getApiUrl() {
  return API_URL;
}
