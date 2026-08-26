import { TodoAppPage } from "../../components/todo-app-page";

type LabelPageProps = {
  params: Promise<{ labelId: string }>;
};

export default async function LabelPage({ params }: LabelPageProps) {
  const { labelId } = await params;

  return <TodoAppPage initialRoute={{ kind: "label", labelId }} />;
}
