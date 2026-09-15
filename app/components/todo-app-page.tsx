import { TodoApp } from "./todo-app";
import { getTodoData } from "@/lib/todo-data";
import type { TodoRoute } from "@/lib/todo-routes";

type TodoAppPageProps = {
  initialRoute?: TodoRoute;
};

export async function TodoAppPage({ initialRoute }: TodoAppPageProps) {
  const { lists, folders, labels, tasksByList } = await getTodoData();

  return (
    <TodoApp
      initialLists={lists}
      initialFolders={folders}
      initialLabels={labels}
      initialTasksByList={tasksByList}
      initialRoute={initialRoute}
    />
  );
}
