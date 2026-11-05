"use client";

import { AppClientSettingsProvider } from "./app-client-settings-provider";
import { TodoApp } from "./todo-app";
import type { ComponentProps } from "react";

type TodoAppClientShellProps = ComponentProps<typeof TodoApp>;

export function TodoAppClientShell(props: TodoAppClientShellProps) {
  return (
    <AppClientSettingsProvider>
      <TodoApp {...props} />
    </AppClientSettingsProvider>
  );
}
