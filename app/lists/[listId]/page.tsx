import { TodoAppPage } from "../../components/todo-app-page";

type ListPageProps = {
  params: Promise<{ listId: string }>;
};

export default async function ListPage({ params }: ListPageProps) {
  const { listId } = await params;

  return <TodoAppPage initialRoute={{ kind: "list", listId }} />;
}
