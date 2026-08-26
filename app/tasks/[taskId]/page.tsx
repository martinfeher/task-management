import { TodoAppPage } from "../../components/todo-app-page";

type TaskPageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;

  return <TodoAppPage initialRoute={{ kind: "task", taskId }} />;
}
