import { TodoAppClientShell } from "./todo-app-client-shell";
import { getTodoData } from "@/lib/todo-data";
import type { TodoRoute } from "@/lib/todo-routes";

type TodoAppPageProps = {
  initialRoute?: TodoRoute;
};

export async function TodoAppPage({ initialRoute }: TodoAppPageProps) {
  const { lists, folders, labels, tasksByList, kanbanColumnsByList } =
    await getTodoData();

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
