import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const MAX_TASK_AUDIO_BYTES = 12 * 1024 * 1024;

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "task-audio");

const MIME_TO_EXT: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-caf": "caf",
  "audio/3gpp": "3gp",
};

const EXT_TO_MIME: Record<string, string> = {
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  caf: "audio/x-caf",
  "3gp": "audio/3gpp",
};

const SAFE_TASK_ID = /^[a-z0-9]+$/i;
const SAFE_FILENAME = /^[a-z0-9-]+\.(m4a|aac|mp3|wav|caf|3gp)$/i;

function assertSafeTaskId(taskId: string) {
  if (!SAFE_TASK_ID.test(taskId)) {
    throw new Error("Invalid task id");
  }
}

function assertSafeFilename(filename: string) {
  if (!SAFE_FILENAME.test(filename)) {
    throw new Error("Invalid filename");
  }
}

function getExtensionForMime(mimeType: string) {
  const extension = MIME_TO_EXT[mimeType.toLowerCase()];
  if (!extension) {
    throw new Error("Unsupported audio type");
  }

  return extension;
}

export function getTaskAudioPublicUrl(taskId: string, filename: string) {
  assertSafeTaskId(taskId);
  assertSafeFilename(filename);
  return `/api/task-audio/${taskId}/${filename}`;
}

export function getTaskAudioPath(taskId: string, filename: string) {
  assertSafeTaskId(taskId);
  assertSafeFilename(filename);
  return path.join(UPLOAD_ROOT, taskId, filename);
}

export function getMimeTypeForAudioFilename(filename: string) {
  assertSafeFilename(filename);
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[extension] ?? "application/octet-stream";
}

async function ensureTaskAudioDir(taskId: string) {
  assertSafeTaskId(taskId);
  await mkdir(path.join(UPLOAD_ROOT, taskId), { recursive: true });
}

export async function saveTaskAudio(
  taskId: string,
  buffer: Buffer,
  mimeType: string,
) {
  if (!mimeType.startsWith("audio/")) {
    throw new Error("File must be an audio recording");
  }

  if (buffer.byteLength > MAX_TASK_AUDIO_BYTES) {
    throw new Error("Audio file is too large");
  }

  await ensureTaskAudioDir(taskId);

  const extension = getExtensionForMime(mimeType);
  const filename = `${randomUUID()}.${extension}`;
  const filePath = getTaskAudioPath(taskId, filename);

  await writeFile(filePath, buffer);

  return getTaskAudioPublicUrl(taskId, filename);
}

export async function readTaskAudioFile(taskId: string, filename: string) {
  const filePath = getTaskAudioPath(taskId, filename);
  return readFile(filePath);
}

export async function deleteTaskAudioFile(taskId: string, filename: string) {
  assertSafeTaskId(taskId);
  assertSafeFilename(filename);
  await rm(getTaskAudioPath(taskId, filename), { force: true });
}

export function extractReferencedAudioFilenames(
  taskId: string,
  detailsHtml: string,
) {
  assertSafeTaskId(taskId);

  const filenames = new Set<string>();
  const pattern = new RegExp(
    `/api/task-audio/${taskId}/([a-z0-9-]+\\.(?:m4a|aac|mp3|wav|caf|3gp))`,
    "gi",
  );

  for (const match of detailsHtml.matchAll(pattern)) {
    filenames.add(match[1]);
  }

  return filenames;
}
