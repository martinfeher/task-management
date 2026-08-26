import { TodoAppPage } from "../components/todo-app-page";

export default function ImportantPage() {
  return <TodoAppPage initialRoute={{ kind: "important" }} />;
}
