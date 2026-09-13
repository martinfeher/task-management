"use client";

import { useEffect } from "react";
import {
  applyTaskEditorDefaults,
  readTaskEditorDefaultsFromStorage,
} from "@/lib/task-editor-defaults-settings";

export function TaskEditorDefaultsBootstrap() {
  useEffect(() => {
    applyTaskEditorDefaults(readTaskEditorDefaultsFromStorage());
  }, []);

  return null;
}
