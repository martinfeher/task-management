import { redirect } from "next/navigation";
import { TodoAppClientShell } from "./todo-app-client-shell";
import { getTodoData } from "@/lib/todo-data";
import { getCurrentUser } from "@/lib/require-user";
import type { TodoRoute } from "@/lib/todo-routes";

type TodoAppPageProps = {
  initialRoute?: TodoRoute;
};

export async function TodoAppPage({ initialRoute }: TodoAppPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { lists, folders, labels, tasksByList, kanbanColumnsByList } =
    await getTodoData(user.id);

  return (
    <TodoAppClientShell
      initialLists={lists}
      initialFolders={folders}
      initialLabels={labels}
      initialTasksByList={tasksByList}
      initialKanbanColumnsByList={kanbanColumnsByList}
      initialRoute={initialRoute}
    />
  );
}
