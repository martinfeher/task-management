import { createHash } from "crypto";
import type { TaskDoc } from "./types";

/** Deterministic JSON stringify — sorts object keys so hash doesn't depend on key order. */
export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function taskDocContentHash(name: string, doc: TaskDoc): string {
  return createHash("sha256")
    .update(name)
    .update("\0")
    .update(canonicalizeJson(doc))
    .digest("hex");
}
