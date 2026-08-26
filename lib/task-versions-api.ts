import type { TaskVersionListItem, TaskVersionSource } from "@/lib/task-versions-shared";

export type TaskVersionDetail = {
  id: string;
  name: string;
  details: string;
  createdAt: string;
  source: TaskVersionSource;
};

export async function fetchTaskVersions(
  taskId: string,
): Promise<TaskVersionListItem[]> {
  const response = await fetch(`/api/tasks/${taskId}/versions`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load task versions");
  }

  const data = (await response.json()) as { versions: TaskVersionListItem[] };
  return data.versions;
}

export async function createManualTaskVersion(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/versions`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to save task version");
  }

  const data = (await response.json()) as {
    created: boolean;
    versions: TaskVersionListItem[];
  };

  return data;
}

export async function restoreTaskVersion(
  taskId: string,
  versionId: string,
): Promise<{
  name: string;
  details: string;
  restored: boolean;
}> {
  const response = await fetch(
    `/api/tasks/${taskId}/versions/${versionId}/restore`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to restore task version");
  }

  const data = (await response.json()) as {
    name: string;
    details: string;
    restored: boolean;
  };

  return data;
}

export async function fetchTaskVersionById(
  taskId: string,
  versionId: string,
): Promise<TaskVersionDetail> {
  const response = await fetch(
    `/api/tasks/${taskId}/versions/${versionId}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load task version");
  }

  return (await response.json()) as TaskVersionDetail;
}
